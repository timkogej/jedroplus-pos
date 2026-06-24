-- Fix appointment_id column type: uuid → text
-- "Termini" table uses a bigint/integer primary key, not UUID.
-- Existing UUID values cast to text automatically; no data loss.
ALTER TABLE pos_invoices ALTER COLUMN appointment_id TYPE text;
