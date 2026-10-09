-- ============================================================
-- 030_performance_indexes.sql
--
-- Composite indexes for the queries that run on every dashboard / list / export
-- load. Each query filters on the company first and then on (or sorts by) a
-- second column; the single-column indexes from 001 can serve only one of the
-- two, so Postgres had to scan or sort the rest.
-- Idempotent. Indexes are tiny compared to the tables; creating them takes a
-- moment (writes to those tables wait while it runs).
-- ============================================================

-- Invoices: dashboard, Z-report, exports, invoice list (company + date range / newest first)
create index if not exists idx_pos_invoices_company_date
  on pos_invoices (company_id, invoice_date desc);
create index if not exists idx_pos_invoices_company_created
  on pos_invoices (company_id, created_at desc);

-- Loyalty ledger lookups by invoice (award / storno / PDF lines)
create index if not exists idx_loyalty_company_invoice
  on pos_loyalty_points (company_id, invoice_id);

-- Customers page: one company's customers, most recent first, and e-mail lookups
create index if not exists idx_stranke_company_last_interaction
  on "Stranke" ("ID Podjetja", "Zadnja interakcija" desc);
create index if not exists idx_stranke_company_email
  on "Stranke" ("ID Podjetja", "Email stranke");

-- Appointments waiting to be invoiced (dashboard + appointments page)
create index if not exists idx_termini_company_status
  on "Termini" ("ID podjetja", "Status");

-- Premises / devices per company
create index if not exists idx_pos_premises_company on pos_premises (company_id);
create index if not exists idx_pos_devices_company on pos_devices (company_id, premise_id);
