-- Ensure pos_settings has at most one row per company so we can UPSERT on company_id.
-- (Stripe Connect onboard/status routes rely on onConflict: 'company_id'.)
-- If duplicate rows already exist this ALTER will fail; dedupe first in that case.
ALTER TABLE pos_settings ADD CONSTRAINT pos_settings_company_id_unique UNIQUE (company_id);
