-- Brand from the receipt or barcode, so food recalls can be matched to what's on the shelf.
alter table items add column if not exists brand text;
