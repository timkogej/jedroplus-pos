-- ============================================================
-- 029_rate_limit_and_zreport_number.sql
--
-- 1. Shared rate limiter. The old in-memory limiter is per serverless instance
--    on Vercel, so it never actually limited anything. This keeps the counters
--    in Postgres: one row per key, fixed window, atomic upsert.
-- 2. Z-report numbers: two reports closed at the same moment could get the same
--    number (count + 1). A unique index makes the database the referee; the API
--    retries with the next number.
-- Idempotent.
-- ============================================================

create table if not exists pos_rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

alter table pos_rate_limits enable row level security;  -- no policies: server only

create or replace function rate_limit_hit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into pos_rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else r.count + 1
        end,
        window_start = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start
        end
  returning r.count into v_count;

  -- Housekeeping: now and then drop windows that ended long ago.
  if random() < 0.01 then
    delete from pos_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke execute on function rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant  execute on function rate_limit_hit(text, integer, integer) to service_role;

-- ------------------------------------------------------------
-- Z-report numbers must be unique per company. Only created when the existing
-- data has no duplicates (otherwise resolve them by hand first).
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pos_z_reports group by company_id, report_number having count(*) > 1
  ) then
    raise notice 'pos_z_reports has duplicate report numbers — unique index NOT created, fix the data first';
  else
    create unique index if not exists unique_z_report_number
      on pos_z_reports (company_id, report_number);
  end if;
end $$;
