-- 049 — Residential address on the account (blueprint: required signup info).
alter table profiles add column if not exists address text;
