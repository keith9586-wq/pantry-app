-- Surplus swap: offer food you won't get to before it spoils to people in your area.
-- Offers show a first name, the food and a rough pickup area only. How to reach the giver
-- is in a separate row that only the giver and the person they accept can read.

create table surplus_offers (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  zip3 text not null check (zip3 ~ '^[0-9]{3}$'),
  giver text not null check (length(giver) between 1 and 30),
  name text not null check (length(name) between 1 and 60),
  amount text not null default '' check (length(amount) <= 30),
  category text not null,
  good_until date not null,
  pickup_area text not null default '' check (length(pickup_area) <= 60),
  note text not null default '' check (length(note) <= 200),
  status text not null default 'open' check (status in ('open', 'promised', 'gone', 'withdrawn')),
  reports int not null default 0,
  created_at timestamptz not null default now()
);
create index surplus_area on surplus_offers (zip3, status, good_until);
alter table surplus_offers enable row level security;

create policy "post offers" on surplus_offers for insert to authenticated with check (
  owner = auth.uid() and status = 'open' and reports = 0
  -- Raw meat, fish and home-cooked food aren't passed between strangers.
  and category not in ('meat', 'seafood') and good_until >= current_date
);
create policy "owner updates" on surplus_offers for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner deletes" on surplus_offers for delete to authenticated using (owner = auth.uid());

-- Owners can't change their own report count.
create or replace function keep_reports() returns trigger language plpgsql as $$
begin
  if current_setting('surplus.reporting', true) is distinct from 'on' then
    new.reports := old.reports;
  end if;
  return new;
end $$;
create trigger surplus_keep_reports before update on surplus_offers for each row execute function keep_reports();

-- How to reach the giver: readable by the giver, and by the person whose claim they accepted.
create table surplus_contacts (
  offer_id uuid primary key references surplus_offers(id) on delete cascade,
  contact text not null check (length(contact) between 3 and 120)
);
alter table surplus_contacts enable row level security;

create table surplus_claims (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references surplus_offers(id) on delete cascade,
  claimer uuid not null default auth.uid() references auth.users(id) on delete cascade,
  claimer_name text not null check (length(claimer_name) between 1 and 30),
  message text not null default '' check (length(message) <= 200),
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (offer_id, claimer)
);
alter table surplus_claims enable row level security;

create or replace function owns_offer(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from surplus_offers where id = o and owner = auth.uid())
$$;
create or replace function accepted_for(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from surplus_claims where offer_id = o and claimer = auth.uid() and accepted)
$$;

create or replace function claimed_by_me(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from surplus_claims where offer_id = o and claimer = auth.uid())
$$;

-- Anyone signed in sees open offers that haven't expired or been reported twice.
-- Owners see their own, and people who asked for one keep seeing it so they know how it went.
create policy "see offers" on surplus_offers for select to authenticated using (
  owner = auth.uid() or claimed_by_me(id) or (status = 'open' and good_until >= current_date and reports < 2)
);

create policy "owner writes contact" on surplus_contacts for all to authenticated using (owns_offer(offer_id)) with check (owns_offer(offer_id));
create policy "accepted reads contact" on surplus_contacts for select to authenticated using (accepted_for(offer_id));

-- Claimers see their own claims; givers see claims on their offers. Only open offers can be claimed, not your own.
create policy "see claims" on surplus_claims for select to authenticated using (claimer = auth.uid() or owns_offer(offer_id));
create policy "make claim" on surplus_claims for insert to authenticated with check (
  claimer = auth.uid() and not accepted and not owns_offer(offer_id)
  and exists (select 1 from surplus_offers where id = offer_id and status = 'open')
);
create policy "withdraw claim" on surplus_claims for delete to authenticated using (claimer = auth.uid());

-- The giver accepts one claim: it unlocks their contact for that person and marks the offer promised.
create or replace function accept_claim(claim uuid) returns void language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  select offer_id into o from surplus_claims where id = claim;
  if o is null or not owns_offer(o) then raise exception 'not your offer'; end if;
  update surplus_claims set accepted = (id = claim) where offer_id = o;
  update surplus_offers set status = 'promised' where id = o;
end $$;

-- Anyone signed in can report an offer once; two reports hide it.
create table surplus_reports (
  offer_id uuid not null references surplus_offers(id) on delete cascade,
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (offer_id, reporter)
);
alter table surplus_reports enable row level security;
create or replace function report_offer(offer uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into surplus_reports (offer_id, reporter) values (offer, auth.uid()) on conflict do nothing;
  if found then
    perform set_config('surplus.reporting', 'on', true);
    update surplus_offers set reports = reports + 1 where id = offer;
    perform set_config('surplus.reporting', 'off', true);
  end if;
end $$;

revoke all on surplus_offers, surplus_contacts, surplus_claims, surplus_reports from anon;
grant select, insert, update, delete on surplus_offers, surplus_contacts, surplus_claims to authenticated;
grant execute on function accept_claim(uuid), report_offer(uuid) to authenticated;
revoke execute on function accept_claim(uuid), report_offer(uuid) from anon, public;
