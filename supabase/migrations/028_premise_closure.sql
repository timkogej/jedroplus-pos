-- Permanent closure of a business premise (FURS BusinessPremiseRequest with
-- ClosingTag "Z"). After closure no invoices can be issued or submitted for it.
alter table pos_premises add column if not exists furs_closed boolean not null default false;
alter table pos_premises add column if not exists furs_closed_at timestamptz;
