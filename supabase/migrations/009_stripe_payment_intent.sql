ALTER TABLE pos_invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
CREATE INDEX IF NOT EXISTS idx_pos_invoices_stripe_pi ON pos_invoices(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
