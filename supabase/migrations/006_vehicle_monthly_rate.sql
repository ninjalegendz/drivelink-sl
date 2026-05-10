-- ============================================================
-- Add optional monthly rate to vehicles
-- ============================================================
-- Daily rate stays as the primary unit. Monthly rate, when set,
-- gives a discounted package for renters booking 28+ days.
-- The booking math currently still uses daily; monthly is shown
-- on the listing as an alternative price point for now.
-- ============================================================

alter table vehicles add column if not exists monthly_rate_lkr integer;
