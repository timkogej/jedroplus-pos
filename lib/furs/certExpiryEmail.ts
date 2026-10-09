import { Resend } from 'resend'
import type { CertExpiryStatus } from './certExpiry'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Warns the company that its FURS certificate is about to expire (or has). */
export async function sendCertExpiryEmail(input: {
  to: string
  companyName: string
  slug: string
  validTo: string
  status: CertExpiryStatus
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY is not set' }

  const to = process.env.RESEND_TEST_TO ?? input.to
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const link = `${appUrl}/${input.slug}/settings/certificate`
  const date = new Date(input.validTo).toLocaleDateString('sl-SI', { timeZone: 'Europe/Ljubljana' })
  const expired = input.status.state === 'expired'

  const subject = expired
    ? 'FURS certifikat je potekel — računov ni več mogoče izdajati'
    : `FURS certifikat poteče čez ${input.status.daysLeft} dni`
  const lead = expired
    ? `Digitalno potrdilo FURS vašega podjetja je poteklo ${date}. <strong>Dokler ne naložite novega, računov ni mogoče potrjevati in izdajati.</strong>`
    : `Digitalno potrdilo FURS vašega podjetja poteče <strong>${date}</strong> (čez ${input.status.daysLeft} dni). Po poteku računov ne bo več mogoče potrjevati.`

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM,
      to,
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 12px">${escapeHtml(input.companyName)}</h2>
  <p style="font-size:15px;line-height:1.5">${lead}</p>
  <p style="font-size:14px;line-height:1.5">Novo potrdilo naročite pri FURS (e-Davki) in ga naložite v nastavitvah.</p>
  <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:11px 22px;background:#0a0a0a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Odpri nastavitve certifikata</a></p>
</div>`,
    })
    if (error) return { success: false, error: (error as { message?: string }).message ?? JSON.stringify(error) }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Email send failed' }
  }
}
