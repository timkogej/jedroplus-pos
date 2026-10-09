-- ============================================================
-- 027_nonfiscal_numbering.sql
--
-- Invoices paid by direct bank transfer are not cash payments under ZDavPR, so
-- they are NOT sent to FURS. FURS expects the numbers of fiscalized invoices per
-- device to run without gaps, so the non-fiscal invoices must not consume
-- numbers from that series: they get their own counter (and a separate prefix).
-- Idempotent.
-- ============================================================

alter table pos_settings add column if not exists nonfiscal_counter integer default 1;
alter table pos_settings add column if not exists nonfiscal_last_year integer;

create or replace function increment_nonfiscal_counter(
  p_company_id uuid,
  p_year       integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counter   integer;
  v_last_year integer;
  v_cur_year  integer := coalesce(
    p_year,
    extract(year from (now() at time zone 'Europe/Ljubljana'))::integer
  );
begin
  select coalesce(nonfiscal_counter, 1), nonfiscal_last_year
    into v_counter, v_last_year
    from pos_settings
   where company_id = p_company_id
   for update;

  if not found then
    insert into pos_settings (company_id, nonfiscal_counter, nonfiscal_last_year)
    values (p_company_id, 2, v_cur_year);
    return 1;
  end if;

  -- New year: numbering restarts at 1.
  if v_last_year is not null and v_last_year <> v_cur_year then
    update pos_settings
       set nonfiscal_counter = 2, nonfiscal_last_year = v_cur_year, updated_at = now()
     where company_id = p_company_id;
    return 1;
  end if;

  update pos_settings
     set nonfiscal_counter = v_counter + 1, nonfiscal_last_year = v_cur_year, updated_at = now()
   where company_id = p_company_id;

  return v_counter;
end;
$$;

revoke execute on function increment_nonfiscal_counter(uuid, integer) from public, anon, authenticated;
grant  execute on function increment_nonfiscal_counter(uuid, integer) to service_role;
