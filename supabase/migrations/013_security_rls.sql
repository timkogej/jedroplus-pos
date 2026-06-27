-- ============================================================
-- 013_security_rls.sql
-- Replace permissive "using (true)" RLS policies with strict,
-- company-scoped policies. Every pos_ table now only exposes rows
-- belonging to the company the logged-in user is attached to via
-- profiles.default_company_id.
--
-- NOTE: server-side code uses the Supabase service role key, which
-- bypasses RLS entirely, so these policies do not affect API routes.
-- They harden direct access from the browser (anon) client.
--
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
-- ============================================================

-- Make sure RLS is on for every table (idempotent).
alter table pos_settings        enable row level security;
alter table pos_premises        enable row level security;
alter table pos_devices         enable row level security;
alter table pos_invoices        enable row level security;
alter table pos_invoice_items   enable row level security;
alter table pos_certificates    enable row level security;
alter table pos_company_data    enable row level security;

-- ------------------------------------------------------------
-- pos_settings
-- ------------------------------------------------------------
drop policy if exists "Allow all for pos_settings"            on pos_settings;
drop policy if exists "Company members can read own settings"   on pos_settings;
drop policy if exists "Company members can update own settings" on pos_settings;
drop policy if exists "Company own data only"                on pos_settings;
create policy "Company own data only" on pos_settings
  for all
  using (
    company_id = (select default_company_id from profiles where id = auth.uid())
  )
  with check (
    company_id = (select default_company_id from profiles where id = auth.uid())
  );

-- ------------------------------------------------------------
-- pos_premises
-- ------------------------------------------------------------
drop policy if exists "Allow all for pos_premises"               on pos_premises;
drop policy if exists "Company members can manage own premises"  on pos_premises;
drop policy if exists "Company own data only"                    on pos_premises;
create policy "Company own data only" on pos_premises
  for all
  using (
    company_id = (select default_company_id from profiles where id = auth.uid())
  )
  with check (
    company_id = (select default_company_id from profiles where id = auth.uid())
  );

-- ------------------------------------------------------------
-- pos_devices
-- ------------------------------------------------------------
drop policy if exists "Allow all for pos_devices"              on pos_devices;
drop policy if exists "Company members can manage own devices" on pos_devices;
drop policy if exists "Company own data only"                  on pos_devices;
create policy "Company own data only" on pos_devices
  for all
  using (
    company_id = (select default_company_id from profiles where id = auth.uid())
  )
  with check (
    company_id = (select default_company_id from profiles where id = auth.uid())
  );

-- ------------------------------------------------------------
-- pos_invoices
-- ------------------------------------------------------------
drop policy if exists "Allow all for pos_invoices"              on pos_invoices;
drop policy if exists "Company members can manage own invoices" on pos_invoices;
drop policy if exists "Company own data only"                   on pos_invoices;
create policy "Company own data only" on pos_invoices
  for all
  using (
    company_id = (select default_company_id from profiles where id = auth.uid())
  )
  with check (
    company_id = (select default_company_id from profiles where id = auth.uid())
  );

-- ------------------------------------------------------------
-- pos_invoice_items (scoped through the parent invoice)
-- ------------------------------------------------------------
drop policy if exists "Allow all for pos_invoice_items"               on pos_invoice_items;
drop policy if exists "Company members can manage own invoice items"  on pos_invoice_items;
drop policy if exists "Company own data only"                         on pos_invoice_items;
create policy "Company own data only" on pos_invoice_items
  for all
  using (
    invoice_id in (
      select id from pos_invoices
      where company_id = (select default_company_id from profiles where id = auth.uid())
    )
  )
  with check (
    invoice_id in (
      select id from pos_invoices
      where company_id = (select default_company_id from profiles where id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- pos_certificates
-- ------------------------------------------------------------
drop policy if exists "Allow all for pos_certificates"               on pos_certificates;
drop policy if exists "Company members can manage own certificates"  on pos_certificates;
drop policy if exists "Company own data only"                        on pos_certificates;
create policy "Company own data only" on pos_certificates
  for all
  using (
    company_id = (select default_company_id from profiles where id = auth.uid())
  )
  with check (
    company_id = (select default_company_id from profiles where id = auth.uid())
  );

-- ------------------------------------------------------------
-- pos_company_data
-- ------------------------------------------------------------
drop policy if exists "Allow all for pos_company_data"            on pos_company_data;
drop policy if exists "Service role full access on pos_company_data" on pos_company_data;
drop policy if exists "Company own data only"                     on pos_company_data;
create policy "Company own data only" on pos_company_data
  for all
  using (
    company_id = (select default_company_id from profiles where id = auth.uid())
  )
  with check (
    company_id = (select default_company_id from profiles where id = auth.uid())
  );
