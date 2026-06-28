-- Prevent two invoices being issued for one appointment/payment.
--
-- Root cause of the duplicate-invoice bug was the Stripe webhook handling BOTH
-- checkout.session.completed AND payment_intent.succeeded. The webhook is now
-- fixed to handle only checkout.session.completed, but we also enforce
-- single-invoice-per-appointment at the DB level as a hard safety net.
--
-- NOTE: a partial UNIQUE *constraint* (UNIQUE (...) WHERE ...) is not valid
-- PostgreSQL syntax — only partial unique *indexes* support a WHERE clause.
-- A reversal (storno) leaves the original as 'storno_original' and adds a
-- 'storno' invoice, so both of those statuses are excluded to allow a fresh
-- invoice to be re-issued for the same appointment afterwards.

-- 1. Clean up any existing duplicates BEFORE adding the index, otherwise the
--    CREATE UNIQUE INDEX would fail. For each appointment_id that has more than
--    one active (non-storno/non-cancelled) invoice, keep the earliest by
--    created_at and remove the rest (line items first, then the invoice).
with ranked as (
  select
    id,
    row_number() over (
      partition by appointment_id
      order by created_at asc, id asc
    ) as rn
  from pos_invoices
  where appointment_id is not null
    and status not in ('storno', 'storno_original', 'cancelled')
),
dupes as (
  select id from ranked where rn > 1
)
delete from pos_invoice_items
where invoice_id in (select id from dupes);

with ranked as (
  select
    id,
    row_number() over (
      partition by appointment_id
      order by created_at asc, id asc
    ) as rn
  from pos_invoices
  where appointment_id is not null
    and status not in ('storno', 'storno_original', 'cancelled')
),
dupes as (
  select id from ranked where rn > 1
)
delete from pos_invoices
where id in (select id from dupes);

-- 2. Enforce one active invoice per appointment going forward.
create unique index if not exists unique_appointment_invoice
  on pos_invoices (appointment_id)
  where appointment_id is not null
    and status not in ('storno', 'storno_original', 'cancelled');
