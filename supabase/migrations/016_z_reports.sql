-- ============================================================
-- 016_z_reports.sql
-- Daily cash register closing (Z-poročilo / Z-report).
-- One row per company per day; aggregates that day's invoices.
--
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
-- ============================================================

create table if not exists pos_z_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  premise_id uuid references pos_premises(id),
  device_id uuid references pos_devices(id),
  report_date date not null,
  report_number integer not null,
  opened_at timestamptz,
  closed_at timestamptz default now(),
  total_revenue numeric default 0,
  total_invoices integer default 0,
  total_cash numeric default 0,
  total_card numeric default 0,
  total_transfer numeric default 0,
  total_online numeric default 0,
  total_storno numeric default 0,
  total_storno_count integer default 0,
  vat_base_22 numeric default 0,
  vat_amount_22 numeric default 0,
  vat_base_95 numeric default 0,
  vat_amount_95 numeric default 0,
  vat_base_0 numeric default 0,
  status text default 'closed',
  furs_confirmed boolean default false,
  furs_response jsonb,
  pdf_url text,
  notes text,
  created_at timestamptz default now(),
  unique(company_id, report_date)
);

create index if not exists idx_pos_z_reports_company_id on pos_z_reports(company_id);
create index if not exists idx_pos_z_reports_report_date on pos_z_reports(report_date);

-- ------------------------------------------------------------
-- RLS — company-scoped read; writes happen via the service role
-- (API routes), which bypasses RLS. Mirrors 013_security_rls.sql.
-- ------------------------------------------------------------
alter table pos_z_reports enable row level security;

drop policy if exists "Company own data only" on pos_z_reports;
create policy "Company own data only" on pos_z_reports
  for all
  using (
    company_id = (select default_company_id from profiles where id = auth.uid())
  )
  with check (
    company_id = (select default_company_id from profiles where id = auth.uid())
  );

-- ------------------------------------------------------------
-- Storage bucket for generated Z-report PDFs (public, like invoices).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('z-reports', 'z-reports', true)
on conflict (id) do nothing;
