-- FURS offline retry queue (run manually in the Supabase SQL editor).
--
-- Invoices issued while FURS was unreachable get status 'pending_furs' (real
-- ZOI, no EOR yet). The retry cron (/api/furs/retry, CRON_SECRET) re-submits
-- them with SubsequentSubmit=true; after 3 failed retries → 'furs_failed'.

alter table pos_invoices
  add column if not exists furs_retry_count integer not null default 0,
  add column if not exists furs_last_retry timestamptz;

create index if not exists idx_pos_invoices_pending_furs
  on pos_invoices (status)
  where status = 'pending_furs';
