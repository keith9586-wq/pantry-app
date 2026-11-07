-- Sync support for the app.

-- Events now carry ids made on the phone so the same entry is never stored twice.
-- The table has no production data yet, so it is recreated.
drop table if exists item_events;
create table item_events (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  outcome text not null check (outcome in ('used', 'tossed')),
  price numeric,
  at timestamptz not null default now(),
  user_id uuid references auth.users(id) default auth.uid()
);
create index events_household_at on item_events(household_id, at desc);
alter table item_events enable row level security;
create policy "members manage events" on item_events for all using (is_member(household_id)) with check (is_member(household_id));
alter publication supabase_realtime add table item_events;

-- People can leave a household (delete their own membership).
create policy "members leave" on household_members for delete using (user_id = auth.uid());

-- Keep updated_at / updated_by current for conflict checks and "who changed this".
create or replace function touch_row() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_table_name = 'items' then new.updated_by := auth.uid(); end if;
  return new;
end $$;
create trigger items_touch before insert or update on items for each row execute function touch_row();
create trigger shopping_touch before insert or update on shopping_items for each row execute function touch_row();
