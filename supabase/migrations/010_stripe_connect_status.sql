ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false;
ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean DEFAULT false;
ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean DEFAULT false;
