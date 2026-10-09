-- ============================================================
-- 026_private_pdf_buckets.sql
--
-- Invoice and Z-report PDFs contain customer names, emails and amounts, but
-- both buckets were public-read. After the code that serves signed links is
-- deployed, close them. Objects keep their paths; the app now reads them through
-- the service role (staff PDF view) or short-lived signed URLs (portal).
--
-- RUN THIS ONLY AFTER the matching app version is live, otherwise old public
-- links stop working before the app knows how to sign new ones.
-- ============================================================

update storage.buckets set public = false where id in ('invoices', 'z-reports');
