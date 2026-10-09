import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PdfBucket = 'invoices' | 'z-reports'

/**
 * Storage path for a generated PDF. The random UUID segment keeps paths
 * unguessable even where an old/public link exists (invoice numbers are
 * sequential, so `companyId/R-2026-…-00042.pdf` could be enumerated).
 */
export function pdfStorageKey(companyId: string, label: string): string {
  const safe = label.replace(/[^A-Za-z0-9._-]+/g, '_')
  return `${companyId}/${randomUUID()}/${safe}.pdf`
}

/**
 * pos_invoices.pdf_url / pos_z_reports.pdf_url hold the URL returned by
 * getPublicUrl(). The buckets are private now, so that URL no longer works on its
 * own — but it still identifies the object. This extracts the storage path.
 */
export function pdfPathFromUrl(url: string | null | undefined, bucket: PdfBucket): string | null {
  if (!url) return null
  const marker = `/object/public/${bucket}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  const path = url.slice(i + marker.length).split('?')[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/** A short-lived signed link for a stored PDF (default 1 hour), or null. */
export async function signedPdfUrl(
  supabase: SupabaseClient,
  bucket: PdfBucket,
  storedUrl: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  const path = pdfPathFromUrl(storedUrl, bucket)
  if (!path) return null
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/** Reads a stored PDF through the service role (works with private buckets). */
export async function downloadStoredPdf(
  supabase: SupabaseClient,
  bucket: PdfBucket,
  storedUrl: string | null | undefined
): Promise<Buffer | null> {
  const path = pdfPathFromUrl(storedUrl, bucket)
  if (!path) return null
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}
