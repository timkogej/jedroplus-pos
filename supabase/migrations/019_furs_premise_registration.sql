-- FURS business premise registration status (run manually in the Supabase SQL editor).
--
-- Per FURS ZDavPR, a business premise must be registered with FURS
-- (BusinessPremiseRequest) before invoices can be issued from it, or every
-- InvoiceRequest is rejected with error S006.

alter table pos_premises
  add column if not exists furs_registered boolean not null default false,
  add column if not exists furs_registered_at timestamptz;
