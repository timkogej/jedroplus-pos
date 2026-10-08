-- ============================================================
-- 022_security_hardening.sql
--
-- 1. Storage: remove the "FOR ALL USING (bucket_id = 'invoices')" policy from
--    003, which applied to EVERY role (incl. anon) and let anyone overwrite or
--    delete invoice PDFs with the public anon key. Server code uses the
--    service role, which bypasses RLS, so no policy is needed for uploads.
-- 2. Tables the browser never writes (invoices, items, subscriptions,
--    z-reports, loyalty ledger) become READ-ONLY for the browser client. All
--    writes go through API routes with the service role.
-- 3. pos_certificates (encrypted .p12 + password) is no longer reachable from
--    the browser at all; only server code reads it.
-- 4. Fiscal immutability: issued invoices can never be deleted and their
--    fiscal fields can never be edited (ZDavPR retention / integrity).
--
-- Run in the Supabase SQL editor. Idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Storage policies
-- ------------------------------------------------------------
drop policy if exists "Service role can manage invoice PDFs" on storage.objects;
drop policy if exists "Service role can manage z-report PDFs" on storage.objects;

-- ------------------------------------------------------------
-- 2. Read-only browser access
-- ------------------------------------------------------------
drop policy if exists "Company own data only" on pos_invoices;
create policy "Company read own invoices" on pos_invoices
  for select
  using (company_id = (select default_company_id from profiles where id = auth.uid()));

drop policy if exists "Company own data only" on pos_invoice_items;
create policy "Company read own invoice items" on pos_invoice_items
  for select
  using (
    invoice_id in (
      select id from pos_invoices
      where company_id = (select default_company_id from profiles where id = auth.uid())
    )
  );

drop policy if exists "Company own data only" on pos_subscriptions;
create policy "Company read own subscription" on pos_subscriptions
  for select
  using (company_id = (select default_company_id from profiles where id = auth.uid()));

drop policy if exists "Company own data only" on pos_z_reports;
create policy "Company read own z-reports" on pos_z_reports
  for select
  using (company_id = (select default_company_id from profiles where id = auth.uid()));

drop policy if exists "Company own data only" on pos_loyalty_points;
create policy "Company read own loyalty points" on pos_loyalty_points
  for select
  using (company_id = (select default_company_id from profiles where id = auth.uid()));

-- ------------------------------------------------------------
-- 3. Certificates: server-only
-- ------------------------------------------------------------
drop policy if exists "Company own data only" on pos_certificates;
-- RLS stays enabled with no policy => anon/authenticated get nothing.
alter table pos_certificates enable row level security;

-- ------------------------------------------------------------
-- 4. Fiscal immutability
-- ------------------------------------------------------------
create or replace function pos_invoices_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Fiskalnih računov ni dovoljeno brisati (invoice %)', old.invoice_number
      using errcode = 'P0001';
  end if;

  if new.company_id     is distinct from old.company_id
     or new.invoice_number  is distinct from old.invoice_number
     or new.invoice_date    is distinct from old.invoice_date
     or new.subtotal        is distinct from old.subtotal
     or new.discount_amount is distinct from old.discount_amount
     or new.vat_rate        is distinct from old.vat_rate
     or new.vat_amount      is distinct from old.vat_amount
     or new.total           is distinct from old.total
     or new.payment_method  is distinct from old.payment_method
     or new.premise_id      is distinct from old.premise_id
     or new.device_id       is distinct from old.device_id
     or new.is_storno       is distinct from old.is_storno
     or new.storno_of       is distinct from old.storno_of
  then
    raise exception 'Fiskalnih podatkov računa % ni dovoljeno spreminjati', old.invoice_number
      using errcode = 'P0001';
  end if;

  -- ZOI is final once the invoice left the offline queue; EOR is write-once.
  if old.zoi is not null and new.zoi is distinct from old.zoi and old.status <> 'pending_furs' then
    raise exception 'ZOI računa % ni dovoljeno spreminjati', old.invoice_number using errcode = 'P0001';
  end if;
  if old.eor is not null and new.eor is distinct from old.eor then
    raise exception 'EOR računa % ni dovoljeno spreminjati', old.invoice_number using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pos_invoices_guard on pos_invoices;
create trigger trg_pos_invoices_guard
  before update or delete on pos_invoices
  for each row execute function pos_invoices_guard();

create or replace function pos_invoice_items_guard() returns trigger
language plpgsql as $$
begin
  raise exception 'Postavk izdanega računa ni dovoljeno spreminjati ali brisati'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_pos_invoice_items_guard on pos_invoice_items;
create trigger trg_pos_invoice_items_guard
  before update or delete on pos_invoice_items
  for each row execute function pos_invoice_items_guard();
