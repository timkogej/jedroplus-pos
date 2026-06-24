-- POS Tables Migration for Jedro+ Fiscal Cash Register
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ============================================================
-- pos_settings
-- ============================================================
create table if not exists pos_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  invoice_prefix text default 'R',
  invoice_counter integer default 1,
  default_vat_rate numeric default 22,
  is_vat_registered boolean default true,
  receipt_delivery text default 'email', -- 'email', 'print', 'both', 'ask'
  email_from text,
  stripe_account_id text,
  currency text default 'EUR',
  furs_environment text default 'test', -- 'test' or 'production'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table pos_settings enable row level security;

create policy "Company members can read own settings"
  on pos_settings for select
  using (true);

create policy "Company members can update own settings"
  on pos_settings for all
  using (true);

-- ============================================================
-- pos_certificates
-- ============================================================
create table if not exists pos_certificates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  certificate_data text, -- encrypted base64 .p12
  certificate_password text, -- encrypted
  tax_number text, -- davčna številka podjetja
  valid_from timestamptz,
  valid_to timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table pos_certificates enable row level security;

create policy "Company members can manage own certificates"
  on pos_certificates for all
  using (true);

-- ============================================================
-- pos_premises
-- ============================================================
create table if not exists pos_premises (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  premise_id text not null, -- oznaka poslovnega prostora (e.g. "PS1")
  premise_type text default 'premises', -- 'premises' or 'movable'
  address text,
  city text,
  postal_code text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table pos_premises enable row level security;

create policy "Company members can manage own premises"
  on pos_premises for all
  using (true);

-- ============================================================
-- pos_devices
-- ============================================================
create table if not exists pos_devices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  premise_id uuid references pos_premises(id),
  device_id text not null, -- oznaka elektronske naprave (e.g. "EN1")
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table pos_devices enable row level security;

create policy "Company members can manage own devices"
  on pos_devices for all
  using (true);

-- ============================================================
-- pos_invoices
-- ============================================================
create table if not exists pos_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  appointment_id text, -- references "Termini".id (text because Termini uses integer PK)
  premise_id uuid references pos_premises(id),
  device_id uuid references pos_devices(id),
  invoice_number text not null, -- format: PREFIX-YEAR-PREMISEID-DEVICEID-COUNTER
  invoice_date timestamptz default now(),
  client_id uuid, -- references "Stranke"
  client_name text,
  client_email text,
  client_phone text,
  client_tax_number text,
  subtotal numeric not null,
  discount_amount numeric default 0,
  discount_type text, -- '%' or '€'
  vat_rate numeric default 22,
  vat_amount numeric default 0,
  total numeric not null,
  payment_method text not null, -- 'cash', 'card', 'transfer'
  status text default 'issued', -- 'issued', 'cancelled', 'draft'
  zoi text, -- zaščitna oznaka izdajatelja
  eor text, -- enkratna oznaka računa (from FURS)
  furs_confirmed_at timestamptz,
  furs_response jsonb,
  pdf_url text,
  sent_via_email boolean default false,
  printed boolean default false,
  notes text,
  created_at timestamptz default now()
);

alter table pos_invoices enable row level security;

create policy "Company members can manage own invoices"
  on pos_invoices for all
  using (true);

create index idx_pos_invoices_company_id on pos_invoices(company_id);
create index idx_pos_invoices_appointment_id on pos_invoices(appointment_id);
create index idx_pos_invoices_status on pos_invoices(status);
create index idx_pos_invoices_invoice_date on pos_invoices(invoice_date);

-- ============================================================
-- pos_invoice_items
-- ============================================================
create table if not exists pos_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references pos_invoices(id) on delete cascade,
  description text not null,
  quantity numeric default 1,
  unit_price numeric not null,
  vat_rate numeric default 22,
  vat_amount numeric,
  total numeric not null,
  created_at timestamptz default now()
);

alter table pos_invoice_items enable row level security;

create policy "Company members can manage own invoice items"
  on pos_invoice_items for all
  using (true);

-- ============================================================
-- RPC: Atomic invoice counter increment
-- ============================================================
create or replace function increment_invoice_counter(p_company_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_counter integer;
begin
  update pos_settings
  set invoice_counter = invoice_counter + 1,
      updated_at = now()
  where company_id = p_company_id
  returning invoice_counter - 1 into v_counter;

  if not found then
    insert into pos_settings (company_id, invoice_counter)
    values (p_company_id, 2)
    returning 1 into v_counter;
  end if;

  return v_counter;
end;
$$;
