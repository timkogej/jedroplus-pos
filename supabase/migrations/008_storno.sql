-- Add storno (invoice cancellation) support per ZDavPR requirements.
-- Original invoices are never deleted; a linked negative-amount storno invoice
-- is created and confirmed with FURS independently.

alter table pos_invoices
  add column if not exists is_storno boolean not null default false,
  add column if not exists storno_of uuid references pos_invoices(id),
  add column if not exists storno_invoice_id uuid references pos_invoices(id);

-- Status values used:
--   'issued'           – normal confirmed invoice
--   'draft'            – pending FURS confirmation
--   'storno_original'  – was cancelled; see storno_invoice_id for the reversal
--   'storno'           – cancellation invoice; see storno_of for the original
--   'cancelled'        – legacy local-only cancel (pre-storno feature)
