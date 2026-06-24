-- Company invoice data table
create table if not exists pos_company_data (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  company_name text,
  address text,
  postal_code text,
  city text,
  country text default 'Slovenija',
  tax_number text,
  vat_id text,
  iban text,
  bank text,
  email text,
  phone text,
  website text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_id)
);

-- RLS
alter table pos_company_data enable row level security;

create policy "Service role full access on pos_company_data"
  on pos_company_data for all
  using (true)
  with check (true);
