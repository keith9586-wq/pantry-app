-- What was finished, how much and how much of it was thrown out: feeds the buy-size coach.
alter table item_events add column if not exists key text;
alter table item_events add column if not exists quantity numeric;
alter table item_events add column if not exists unit text;
alter table item_events add column if not exists share numeric check (share is null or (share >= 0 and share <= 1));
