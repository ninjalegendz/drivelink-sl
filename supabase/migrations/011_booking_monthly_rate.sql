-- ============================================================
-- Convert bookings.subtotal_lkr from generated → regular
-- ============================================================
-- The generated formula (days * daily_rate) can't express monthly-rate
-- discounts. We move the calculation to the API so a booking that
-- spans 30+ days can apply monthly_rate_lkr for each full 30-day
-- chunk and daily_rate_lkr for the remainder.
-- ============================================================

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'bookings'
      and column_name  = 'subtotal_lkr'
      and is_generated = 'ALWAYS'
  ) then
    alter table bookings drop column subtotal_lkr;
    alter table bookings add column subtotal_lkr integer not null default 0;
  end if;
end $$;
