-- Loyalty points system
-- Ledger table — tracks every point transaction (earn or redeem).
-- Points are scoped per company: the same client at two companies has two
-- separate balances. created_at on every row enables future FIFO expiry logic.

create table if not exists pos_loyalty_points (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  client_id text,                       -- references "Stranke"."ID stranke"
  client_email text not null,
  type text not null,                   -- 'earned' or 'redeemed'
  points integer not null,              -- positive for earned, negative for redeemed
  invoice_id uuid references pos_invoices(id),
  description text,
  created_at timestamptz default now()
);

create index if not exists idx_loyalty_company_email on pos_loyalty_points(company_id, client_email);

alter table pos_loyalty_points enable row level security;

drop policy if exists "Company own data only" on pos_loyalty_points;
create policy "Company own data only" on pos_loyalty_points
  for all using (
    company_id = (
      select default_company_id from profiles
      where id = auth.uid()
    )
  );

-- Settings columns on pos_settings
alter table pos_settings
  add column if not exists loyalty_enabled boolean default false,
  add column if not exists loyalty_earn_rate numeric default 1,      -- points earned per 1 EUR spent
  add column if not exists loyalty_redeem_value numeric default 0.05; -- EUR value per 1 point when redeemed
