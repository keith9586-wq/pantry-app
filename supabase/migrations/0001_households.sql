-- Households share one kitchen and one shopping list. Every row is scoped to a household
-- and row-level security only lets members see their own household.

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Home',
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  inbox_code text not null unique default substr(md5(random()::text), 1, 12),
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  key text not null,
  category text not null,
  storage text not null check (storage in ('fridge', 'freezer', 'pantry')),
  quantity numeric not null default 1,
  unit text not null default 'each',
  fill text not null default 'full' check (fill in ('full', 'half', 'low')),
  added_at timestamptz not null default now(),
  expires_at timestamptz,
  expiry_source text not null default 'predicted' check (expiry_source in ('predicted', 'user')),
  price numeric,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index items_household on items(household_id);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  key text not null,
  category text not null,
  checked boolean not null default false,
  source text not null default 'manual' check (source in ('auto', 'manual', 'recipe')),
  updated_at timestamptz not null default now()
);
create index shopping_household on shopping_items(household_id);

-- Used / thrown-out history that feeds the money saved and wasted view.
create table item_events (
  id bigint generated always as identity primary key,
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  outcome text not null check (outcome in ('used', 'tossed')),
  price numeric,
  at timestamptz not null default now(),
  user_id uuid references auth.users(id)
);
create index events_household_at on item_events(household_id, at desc);

-- Receipts parsed from forwarded emails, waiting for someone to confirm them in the app.
create table pending_receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  source text not null default 'email',
  sender text,
  subject text,
  items jsonb not null,
  received_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create or replace function is_member(h uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid());
$$;

alter table households enable row level security;
alter table household_members enable row level security;
alter table items enable row level security;
alter table shopping_items enable row level security;
alter table item_events enable row level security;
alter table pending_receipts enable row level security;

create policy "members read household" on households for select using (is_member(id));
create policy "members see members" on household_members for select using (is_member(household_id));
create policy "members manage items" on items for all using (is_member(household_id)) with check (is_member(household_id));
create policy "members manage list" on shopping_items for all using (is_member(household_id)) with check (is_member(household_id));
create policy "members manage events" on item_events for all using (is_member(household_id)) with check (is_member(household_id));
create policy "members manage pending" on pending_receipts for all using (is_member(household_id)) with check (is_member(household_id));

-- Creating and joining go through functions so nobody can add themselves to a household by id.
create or replace function create_household(household_name text default 'Home') returns households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  insert into households(name) values (household_name) returning * into h;
  insert into household_members(household_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end $$;

create or replace function join_household(code text) returns households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  select * into h from households where invite_code = lower(code);
  if h.id is null then raise exception 'Invite code not found'; end if;
  insert into household_members(household_id, user_id) values (h.id, auth.uid()) on conflict do nothing;
  return h;
end $$;

-- Live updates so everyone in the home sees changes as they happen.
alter publication supabase_realtime add table items, shopping_items, pending_receipts;
