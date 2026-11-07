-- Local price map. People who opt in share what they paid, by area (first 3 ZIP digits) and store,
-- with no household, name or exact date attached. Raw reports can't be read by anyone through the API;
-- only the area_prices view is exposed, and it only shows a price once 3 different people reported it.

create table price_reports (
  id bigint generated always as identity primary key,
  -- Used only to count distinct reporters and limit abuse. Never exposed.
  contributor uuid not null default auth.uid() references auth.users(id) on delete cascade,
  zip3 text not null check (zip3 ~ '^[0-9]{3}$'),
  store text not null check (length(store) between 2 and 60),
  key text not null check (length(key) between 1 and 60),
  unit text not null check (length(unit) between 1 and 12),
  unit_price numeric not null check (unit_price > 0 and unit_price < 1000),
  observed_on date not null default current_date
);
create index price_reports_area on price_reports (zip3, key, observed_on);
create index price_reports_contributor on price_reports (contributor, observed_on);

alter table price_reports enable row level security;
-- Insert only, as yourself. There is no select, update or delete policy.
create policy "report own prices" on price_reports for insert to authenticated with check (contributor = auth.uid());

-- At most 300 lines a day from one person, so one account can't flood an area.
create or replace function limit_price_reports() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from price_reports where contributor = new.contributor and observed_on = current_date) >= 300 then
    raise exception 'daily price report limit reached';
  end if;
  new.observed_on := current_date;
  return new;
end $$;
create trigger price_reports_limit before insert on price_reports for each row execute function limit_price_reports();

-- Median price per item, store and area over the last 30 days, shown only with 3+ reporters.
-- This view deliberately runs with its owner's rights (not security_invoker) so it can aggregate
-- reports that no user can read directly.
create view area_prices as
select
  zip3,
  key,
  unit,
  store,
  round(percentile_cont(0.5) within group (order by unit_price)::numeric, 2) as unit_price,
  count(distinct contributor) as reporters,
  max(observed_on) as last_seen
from price_reports
where observed_on >= current_date - 30
group by zip3, key, unit, store
having count(distinct contributor) >= 3;

revoke all on price_reports from anon;
grant insert on price_reports to authenticated;
revoke select on area_prices from anon;
grant select on area_prices to authenticated;
