-- ============================================================
-- PART 1: Company–User binding
-- ============================================================

-- Allow looking up a company directly from the Supabase auth uid.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies (user_id);

-- ============================================================
-- PART 2: Invoice number format settings
-- ============================================================

ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS invoice_format       TEXT    DEFAULT 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA';
ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS invoice_separator     TEXT    DEFAULT '-';
ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS invoice_number_length INTEGER DEFAULT 5;
ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS invoice_year_format   TEXT    DEFAULT 'full';   -- 'full' | 'short'
ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS invoice_year_reset    BOOLEAN DEFAULT true;
ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS invoice_last_year     INTEGER DEFAULT NULL;

-- ============================================================
-- PART 3: Year-aware invoice counter RPC
-- ============================================================

CREATE OR REPLACE FUNCTION increment_invoice_counter(
  p_company_id uuid,
  p_year       integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter    integer;
  v_last_year  integer;
  v_year_reset boolean;
  v_cur_year   integer := COALESCE(p_year, EXTRACT(year FROM now())::integer);
BEGIN
  SELECT invoice_counter, invoice_last_year, invoice_year_reset
    INTO v_counter, v_last_year, v_year_reset
    FROM pos_settings
   WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    INSERT INTO pos_settings (company_id, invoice_counter, invoice_last_year)
    VALUES (p_company_id, 2, v_cur_year)
    RETURNING 1 INTO v_counter;
    RETURN 1;
  END IF;

  -- Reset counter when year rolls over and auto-reset is enabled
  IF v_year_reset AND v_last_year IS NOT NULL AND v_last_year <> v_cur_year THEN
    UPDATE pos_settings
       SET invoice_counter  = 2,
           invoice_last_year = v_cur_year,
           updated_at        = now()
     WHERE company_id = p_company_id;
    RETURN 1;
  END IF;

  -- Normal increment
  UPDATE pos_settings
     SET invoice_counter  = invoice_counter + 1,
         invoice_last_year = v_cur_year,
         updated_at        = now()
   WHERE company_id = p_company_id
   RETURNING invoice_counter - 1 INTO v_counter;

  RETURN v_counter;
END;
$$;
