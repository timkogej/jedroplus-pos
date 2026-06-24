-- Create public storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Allow service role (server-side) to upload and read invoices
CREATE POLICY "Service role can manage invoice PDFs"
  ON storage.objects FOR ALL
  USING (bucket_id = 'invoices');
