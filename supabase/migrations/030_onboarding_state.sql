-- ============================================================
-- 030_onboarding_state.sql
--
-- Setup guide ("Vodič") state per company: the user's choices (VAT answer, hidden
-- guide, tours seen) and two timestamps for switching real mode on
-- (activation_requested_at when the user asks, activated_at when Jedro+ does it).
-- Everything else the guide shows is derived from existing tables.
--
-- Browser: read-only (RLS by profiles.default_company_id, like migration 022).
-- Writes go through /api/guide/* with the service role.
-- Also adds activate_company(slug) — the safe way to switch a company to real mode.
-- Run in the Supabase SQL editor. Idempotent.
-- ============================================================

create table if not exists pos_onboarding_state (
  company_id uuid primary key references companies(id) on delete cascade,
  vat_confirmed boolean not null default false,
  guide_hidden_until timestamptz,
  guide_dismissed boolean not null default false,
  tour_seen jsonb not null default '{}'::jsonb,
  activation_requested_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pos_onboarding_state enable row level security;

drop policy if exists "Company read own onboarding state" on pos_onboarding_state;
create policy "Company read own onboarding state" on pos_onboarding_state
  for select
  using (company_id = (select default_company_id from profiles where id = auth.uid()));

-- ------------------------------------------------------------
-- Companies that already issue invoices must not be nagged with the guide:
-- treat the VAT question as answered and the tours as seen. Companies already
-- in real mode get activated_at = their first confirmed non-demo invoice.
-- ------------------------------------------------------------
insert into pos_onboarding_state (company_id, vat_confirmed, tour_seen, activated_at)
select
  c.id,
  true,
  '{"dashboard": true, "appointments": true}'::jsonb,
  case when s.furs_environment = 'production' then
    coalesce(
      (select min(i.created_at) from pos_invoices i
        where i.company_id = c.id and i.eor is not null
          and coalesce(i.furs_response ->> 'demo', 'false') <> 'true'),
      now()
    )
  end
from companies c
left join pos_settings s on s.company_id = c.id
where exists (select 1 from pos_invoices i where i.company_id = c.id)
on conflict (company_id) do nothing;

-- ------------------------------------------------------------
-- activate_company('slug'): switch a company from the test setup to real FURS mode.
-- Refuses unless there is an active, unexpired certificate and every active premise
-- is registered with FURS. Idempotent. Use from the SQL editor (service role); not
-- callable from the browser.
-- ------------------------------------------------------------
create or replace function activate_company(p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from companies where slug = p_slug;
  if v_id is null then
    return 'NAPAKA: podjetje "' || p_slug || '" ne obstaja';
  end if;

  if not exists (
    select 1 from pos_certificates
    where company_id = v_id and is_active and (valid_to is null or valid_to > now())
  ) then
    return 'NAPAKA: ni aktivnega, veljavnega certifikata';
  end if;

  if not exists (
    select 1 from pos_premises where company_id = v_id and is_active and not furs_closed
  ) then
    return 'NAPAKA: ni aktivnega poslovnega prostora';
  end if;

  if exists (
    select 1 from pos_premises
    where company_id = v_id and is_active and not furs_closed and not furs_registered
  ) then
    return 'NAPAKA: vsi aktivni prostori morajo biti registrirani pri FURS';
  end if;

  update pos_settings set furs_environment = 'production', updated_at = now() where company_id = v_id;
  if not found then
    insert into pos_settings (company_id, furs_environment) values (v_id, 'production');
  end if;

  insert into pos_onboarding_state (company_id, activated_at)
  values (v_id, now())
  on conflict (company_id)
  do update set activated_at = coalesce(pos_onboarding_state.activated_at, now()), updated_at = now();

  return 'OK: ' || p_slug || ' je zdaj v pravem delovanju';
end;
$$;

revoke all on function activate_company(text) from public, anon, authenticated;
