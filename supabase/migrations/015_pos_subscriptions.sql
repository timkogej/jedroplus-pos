-- ============================================================
-- 015_pos_subscriptions.sql
-- POS subscription billing (Stripe). One row per company.
--
-- The table may already exist (created manually during setup) — this
-- migration is idempotent and also (re)applies RLS to match 013's
-- company-scoped pattern.
--
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
-- ============================================================

create table if not exists pos_subscriptions (
  company_id             uuid primary key references companies (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text check (plan in ('plus', 'pro')),
  billing_interval       text check (billing_interval in ('monthly', 'yearly')),
  status                 text,
  trial_ends_at          timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  canceled_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_pos_subscriptions_customer
  on pos_subscriptions (stripe_customer_id);
create index if not exists idx_pos_subscriptions_subscription
  on pos_subscriptions (stripe_subscription_id);

-- ------------------------------------------------------------
-- RLS — company-scoped read; writes happen via the service role
-- (API routes / webhook), which bypasses RLS.
-- ------------------------------------------------------------
alter table pos_subscriptions enable row level security;

drop policy if exists "Company own data only" on pos_subscriptions;
create policy "Company own data only" on pos_subscriptions
  for all
  using (
    company_id = (select default_company_id from profiles where id = auth.uid())
  )
  with check (
    company_id = (select default_company_id from profiles where id = auth.uid())
  );
