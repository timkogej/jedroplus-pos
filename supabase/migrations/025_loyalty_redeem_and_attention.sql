-- ============================================================
-- 025_loyalty_redeem_and_attention.sql
--
-- 1. loyalty_redeem(): atomic points redemption. The old API read the balance
--    and inserted a ledger row in two steps, so two parallel requests could
--    spend the same points twice. This takes a per-(company, email) advisory
--    lock, re-checks the balance and inserts in one transaction.
-- 2. pos_attention_items: things that need a human — an online payment whose
--    invoice could not be issued, a Stripe refund that still needs a fiscal
--    storno, ... Shown as a banner on the dashboard.
-- Idempotent.
-- ============================================================

create or replace function loyalty_redeem(
  p_company     uuid,
  p_email       text,
  p_points      integer,
  p_invoice     uuid    default null,
  p_description text    default null,
  p_force       boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := lower(trim(p_email));
  v_balance integer;
  v_id      uuid;
begin
  if p_points is null or p_points <= 0 then
    raise exception 'Neveljavno število točk' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company::text || ':' || v_email));

  select coalesce(sum(points), 0) into v_balance
    from pos_loyalty_points
   where company_id = p_company and client_email = v_email;

  -- p_force is used AFTER an invoice is already fiscalized: the discount was
  -- granted, so the ledger must reflect it even if a race made the balance short.
  if not p_force and v_balance < p_points then
    raise exception 'Stranka nima dovolj točk (na voljo: %)', greatest(v_balance, 0)
      using errcode = 'P0001';
  end if;

  insert into pos_loyalty_points (company_id, client_email, type, points, invoice_id, description)
  values (p_company, v_email, 'redeemed', -p_points, p_invoice,
          coalesce(p_description, 'Unovceno (loyalty)'))
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function loyalty_redeem(uuid, text, integer, uuid, text, boolean) from public, anon, authenticated;
grant  execute on function loyalty_redeem(uuid, text, integer, uuid, text, boolean) to service_role;

-- ------------------------------------------------------------
create table if not exists pos_attention_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  kind        text not null,        -- 'online_invoice_failed' | 'refund_needs_storno'
  reference   text not null,        -- Stripe payment intent / charge id (dedupe key)
  invoice_id  uuid references pos_invoices(id),
  message     text not null,
  details     jsonb,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (kind, reference)
);

create index if not exists idx_attention_open
  on pos_attention_items (company_id) where resolved_at is null;

alter table pos_attention_items enable row level security;
drop policy if exists "Company read own attention items" on pos_attention_items;
create policy "Company read own attention items" on pos_attention_items
  for select
  using (company_id = (select default_company_id from profiles where id = auth.uid()));
-- Writes: service role only (API routes / webhook).
