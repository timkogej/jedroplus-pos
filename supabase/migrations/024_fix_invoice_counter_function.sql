-- ============================================================
-- 024_fix_invoice_counter_function.sql
--
-- The live database had an older, hand-made increment_invoice_counter() that
-- returned TEXT ("R-2026-00001"). The app expects an INTEGER counter (it builds
-- the formatted number itself from pos_settings.invoice_format). This replaces
-- both old overloads, adds the invoice-format columns from 007 that were
-- missing, keeps the row lock (FOR UPDATE) the old version had, and stops
-- anonymous users from calling the function through the public RPC endpoint
-- (it is SECURITY DEFINER and would let anyone burn invoice numbers).
-- Idempotent.
-- ============================================================

alter table companies add column if not exists user_id uuid;
create index if not exists idx_companies_user_id on companies (user_id);

alter table pos_settings add column if not exists invoice_format        text    default 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA';
alter table pos_settings add column if not exists invoice_separator     text    default '-';
alter table pos_settings add column if not exists invoice_number_length integer default 5;
alter table pos_settings add column if not exists invoice_year_format   text    default 'full';
alter table pos_settings add column if not exists invoice_year_reset    boolean default true;
alter table pos_settings add column if not exists invoice_last_year     integer default null;

-- Carry over the year the old function tracked so the counter doesn't reset.
update pos_settings
   set invoice_last_year = invoice_year
 where invoice_last_year is null and invoice_year is not null;

drop function if exists increment_invoice_counter(uuid);
drop function if exists increment_invoice_counter(uuid, integer);

create or replace function increment_invoice_counter(
  p_company_id uuid,
  p_year       integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counter    integer;
  v_last_year  integer;
  v_year_reset boolean;
  v_cur_year   integer := coalesce(
    p_year,
    extract(year from (now() at time zone 'Europe/Ljubljana'))::integer
  );
begin
  select invoice_counter, invoice_last_year, invoice_year_reset
    into v_counter, v_last_year, v_year_reset
    from pos_settings
   where company_id = p_company_id
   for update;

  if not found then
    insert into pos_settings (company_id, invoice_counter, invoice_last_year)
    values (p_company_id, 2, v_cur_year);
    return 1;
  end if;

  -- New year and auto-reset enabled: start again at 1.
  if coalesce(v_year_reset, true) and v_last_year is not null and v_last_year <> v_cur_year then
    update pos_settings
       set invoice_counter   = 2,
           invoice_last_year = v_cur_year,
           updated_at        = now()
     where company_id = p_company_id;
    return 1;
  end if;

  update pos_settings
     set invoice_counter   = coalesce(invoice_counter, 1) + 1,
         invoice_last_year = v_cur_year,
         updated_at        = now()
   where company_id = p_company_id;

  return coalesce(v_counter, 1);
end;
$$;

-- Server (service role) only.
revoke execute on function increment_invoice_counter(uuid, integer) from public, anon, authenticated;
grant  execute on function increment_invoice_counter(uuid, integer) to service_role;
