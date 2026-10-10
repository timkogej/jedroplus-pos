/**
 * Turns raw error messages (Supabase, the database, the network, the API's
 * English fallbacks) into short Slovenian sentences a shop owner understands.
 *
 * Messages that are already Slovenian (ours) pass through unchanged. Only
 * known English/technical messages are rewritten — this never touches how an
 * error is produced, only how it is shown.
 */
export const GENERIC_ERROR = 'Prišlo je do napake. Poskusite znova.'

const RULES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Napačna e-pošta ali geslo.'],
  [/email not confirmed/i, 'E-pošta še ni potrjena. Preverite svoj nabiralnik.'],
  [/rate limit|too many (requests|attempts)|over_request_rate_limit/i, 'Preveč poskusov. Počakajte minuto in poskusite znova.'],
  [/failed to fetch|networkerror|network request failed|load failed|fetch failed/i, 'Povezava ni uspela. Preverite internet in poskusite znova.'],
  [/jwt expired|session (expired|not found)|invalid jwt|refresh token|no user found|^unauthorized$/i, 'Seja je potekla. Prijavite se znova.'],
  [/^forbidden$|row-level security|permission denied|not authorized/i, 'Za to dejanje nimate dovoljenja.'],
  [/duplicate key|already exists|unique constraint/i, 'Ta vnos že obstaja.'],
  [/null value in column|violates not-null/i, 'Izpolnite vsa obvezna polja.'],
  [/violates (foreign key|check) constraint/i, 'Podatkov ni mogoče shraniti v tej obliki. Preverite vnos.'],
  [/timeout|timed out/i, 'Strežnik se ni odzval pravočasno. Poskusite znova.'],
  [/^server error$|internal server error|^no company in profile$/i, 'Napaka strežnika. Poskusite znova.'],
  [/not found/i, 'Zapisa ni mogoče najti.'],
]

/** Looks like a raw technical message rather than something we wrote. */
const TECHNICAL = /relation "|column "|syntax error|pgrst|postgres|supabase|\bsql\b|undefined|\[object|stack|exception|cannot read prop/i

export function friendlyError(raw: unknown, fallback: string = GENERIC_ERROR): string {
  const message =
    typeof raw === 'string' ? raw : raw instanceof Error ? raw.message : (raw as { message?: unknown })?.message
  if (typeof message !== 'string' || !message.trim()) return fallback
  const text = message.trim()
  for (const [pattern, replacement] of RULES) {
    if (pattern.test(text)) return replacement
  }
  if (TECHNICAL.test(text)) return fallback
  return text
}
