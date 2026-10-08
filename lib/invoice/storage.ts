import { randomUUID } from 'crypto'

/**
 * Storage path for a generated PDF. The buckets are public-read so links in
 * emails keep working, which means the path IS the access control: a random
 * UUID segment makes it unguessable (invoice numbers are sequential, so
 * `companyId/R-2026-…-00042.pdf` could be enumerated and leaks buyer data).
 */
export function pdfStorageKey(companyId: string, label: string): string {
  const safe = label.replace(/[^A-Za-z0-9._-]+/g, '_')
  return `${companyId}/${randomUUID()}/${safe}.pdf`
}
