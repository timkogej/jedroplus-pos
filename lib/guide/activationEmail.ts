import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@jedroplus.com'
import { SUPPORT_EMAIL } from '@/lib/help/contact'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Tells the Jedro+ team that a company has finished its part of the setup and
 * would like real mode switched on. Best-effort: returns false instead of throwing.
 */
export async function sendActivationRequest(input: {
  companyName: string
  slug: string
  companyEmail: string | null
}): Promise<boolean> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return false
    const to = process.env.RESEND_TEST_TO ?? SUPPORT_EMAIL
    const res = await new Resend(apiKey).emails.send({
      from: FROM,
      to,
      subject: `Zahteva za vklop pravega delovanja: ${input.companyName}`,
      html: `
        <p>Podjetje <strong>${esc(input.companyName)}</strong> (<code>${esc(input.slug)}</code>) je pripravljeno na pravo delovanje blagajne:
        certifikat je naložen, prostori so registrirani pri FURS.</p>
        <p>Kontakt podjetja: ${esc(input.companyEmail ?? 'ni naveden')}</p>
        <p>Vklop (SQL Editor v Supabase):</p>
        <pre>select activate_company('${esc(input.slug)}');</pre>`,
    })
    return !res.error
  } catch (err) {
    console.error('[guide] activation e-mail failed:', err instanceof Error ? err.message : err)
    return false
  }
}
