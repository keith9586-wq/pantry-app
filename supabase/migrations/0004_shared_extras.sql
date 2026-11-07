-- Share custom recipes, price history and diet profiles with the household.

-- Recipes people typed in. The whole recipe is stored as JSON; ids are made on the phone ("my-<uuid>").
create table recipes (
  id text primary key,
  household_id uuid not null references households(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) default auth.uid()
);
create index recipes_household on recipes(household_id);
alter table recipes enable row level security;
create policy "members manage recipes" on recipes for all using (is_member(household_id)) with check (is_member(household_id));
alter publication supabase_realtime add table recipes;

-- What the household paid for things: one row per item, holding its latest purchases.
create table prices (
  household_id uuid not null references households(id) on delete cascade,
  key text not null,
  name text not null,
  points jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (household_id, key)
);
alter table prices enable row level security;
create policy "members manage prices" on prices for all using (is_member(household_id)) with check (is_member(household_id));
alter publication supabase_realtime add table prices;

-- Each member's diet, allergies and dislikes. Everyone in the household can read them
-- (so recipes can fit everyone at home), but you can only write your own.
create table member_diets (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  diet jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
alter table member_diets enable row level security;
create policy "members read diets" on member_diets for select using (is_member(household_id));
create policy "write own diet" on member_diets for insert with check (user_id = auth.uid() and is_member(household_id));
create policy "update own diet" on member_diets for update using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(household_id));
create policy "delete own diet" on member_diets for delete using (user_id = auth.uid());
alter publication supabase_realtime add table member_diets;

-- A member who leaves takes their diet with them.
create or replace function drop_diet_on_leave() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from member_diets where household_id = old.household_id and user_id = old.user_id;
  return old;
end $$;
create trigger members_drop_diet after delete on household_members for each row execute function drop_diet_on_leave();

create trigger recipes_touch before insert or update on recipes for each row execute function touch_row();
create trigger prices_touch before insert or update on prices for each row execute function touch_row();
create trigger diets_touch before insert or update on member_diets for each row execute function touch_row();
