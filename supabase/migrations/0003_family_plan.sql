-- The Family plan is bought by one person and covers their household.
alter table households add column family_until timestamptz;

-- Households hold up to 6 people.
create or replace function join_household(code text) returns households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  select * into h from households where invite_code = lower(code);
  if h.id is null then raise exception 'Invite code not found'; end if;
  if (select count(*) from household_members where household_id = h.id) >= 6
     and not exists (select 1 from household_members where household_id = h.id and user_id = auth.uid()) then
    raise exception 'This household is full (6 people)';
  end if;
  insert into household_members(household_id, user_id) values (h.id, auth.uid()) on conflict do nothing;
  return h;
end $$;
