-- Online booking invoices: let a company pick which premise/device is used for
-- invoices created from online (Stripe) payments. If left null, the checkout
-- endpoint falls back to the first active premise + device.
ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS online_premise_id uuid;
ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS online_device_id uuid;
