-- Add owner_email to companies so we can resolve the company from the logged-in user's email.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_email TEXT;
CREATE INDEX IF NOT EXISTS idx_companies_owner_email ON companies (owner_email);
