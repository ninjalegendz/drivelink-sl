-- 070 — Agreement content fingerprint (TRUST-007)
--
-- The agreement terms snapshot (booking_agreements.terms) is already immutable
-- (written once at confirmation) with both-party acceptance stamps + device
-- meta. What it lacked was a tamper-evident FINGERPRINT: a SHA-256 over the
-- canonical terms, computed and frozen at first acceptance. Both parties (and a
-- court) can then verify the exact document that was signed hasn't changed —
-- turning the web/print copy into a durable, verifiable signed record without a
-- separate PDF pipeline. Writes stay server-side (service role only).
alter table public.booking_agreements add column if not exists terms_hash text;
