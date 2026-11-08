-- Pantry check: when someone last confirmed an item is still there.
-- Leftovers: cooked dishes kept in portions alongside bought food.
alter table items add column if not exists checked_at timestamptz;
alter table items add column if not exists leftover boolean not null default false;
