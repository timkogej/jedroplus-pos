-- Store the bare sequential counter used for each invoice. FURS (fu:InvoiceNumber
-- and the ZOI input) needs the counter, which cannot be reliably parsed back out
-- of formats like "00042/2026" or "R-00042-2026". Old rows stay NULL; code falls
-- back to parsing invoice_number for those.
alter table pos_invoices add column if not exists invoice_counter integer;

-- At most one storno invoice per original, enforced by the database (the API
-- also claims the original before calling FURS, this is the safety net).
create unique index if not exists unique_storno_per_invoice
  on pos_invoices (storno_of)
  where is_storno = true and storno_of is not null;
