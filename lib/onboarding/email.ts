import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@jedroplus.com'
const SUPPORT_EMAIL = 'info@jedroplus.com'

let resendClient: Resend | null = null

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is not set')
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface OnboardingEmailInput {
  companyEmail: string
  companyName: string
  dashboardUrl: string
}

/**
 * Sends the two post-onboarding emails — a welcome message and FURS certificate
 * setup instructions — to the company email captured in step 1. Both are
 * best-effort; failures are logged and returned but never thrown.
 */
export async function sendOnboardingEmails(
  input: OnboardingEmailInput
): Promise<{ welcome: boolean; furs: boolean; error?: string }> {
  const { companyEmail, companyName, dashboardUrl } = input
  if (!companyEmail) {
    return { welcome: false, furs: false, error: 'No company email' }
  }

  // In dev/test, RESEND_TEST_TO forces all mail to a single verified address.
  const to = process.env.RESEND_TEST_TO ?? companyEmail

  const resend = getResend()
  const result = { welcome: false, furs: false, error: undefined as string | undefined }

  try {
    const welcome = await resend.emails.send({
      from: FROM,
      to,
      subject: 'Dobrodošli v Jedro+ Blagajni!',
      html: buildWelcomeHtml(companyName, dashboardUrl),
    })
    if (welcome.error) {
      result.error = (welcome.error as { message?: string }).message ?? JSON.stringify(welcome.error)
      console.error('[onboarding-email] welcome FAILED:', result.error)
    } else {
      result.welcome = true
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Welcome email failed'
    console.error('[onboarding-email] welcome EXCEPTION:', err)
  }

  try {
    const furs = await resend.emails.send({
      from: FROM,
      to,
      subject: 'Navodila za pridobitev FURS certifikata',
      html: buildFursHtml(companyName, dashboardUrl),
    })
    if (furs.error) {
      result.error = (furs.error as { message?: string }).message ?? JSON.stringify(furs.error)
      console.error('[onboarding-email] FURS FAILED:', result.error)
    } else {
      result.furs = true
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'FURS email failed'
    console.error('[onboarding-email] FURS EXCEPTION:', err)
  }

  return result
}

const SHELL_OPEN = (companyName: string) => `<!DOCTYPE html>
<html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #f0f0f0;">
<tr><td style="background:linear-gradient(90deg,#6D5EF7 0%,#2AD4C5 100%);height:6px;line-height:6px;font-size:1px;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
<tr><td style="padding:32px 32px 0;"><div style="font-size:16px;font-weight:600;color:#0a0a0a;">${escapeHtml(companyName)}</div></td></tr>
<tr><td style="padding:24px 32px 8px;">`

const SHELL_CLOSE = `</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid #f5f5f5;text-align:center;">
<p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">Jedro+ Blagajna &middot; Podpora: ${SUPPORT_EMAIL}</p>
</td></tr></table></td></tr></table></body></html>`

function buildWelcomeHtml(companyName: string, dashboardUrl: string): string {
  return (
    SHELL_OPEN(companyName) +
    `
    <h1 style="margin:0 0 14px;font-size:20px;font-weight:600;color:#0a0a0a;">Dobrodošli v Jedro+ Blagajni!</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.65;">Vaša blagajna je pripravljena za uporabo. Tukaj je nekaj korakov za začetek:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${stepRow('1', 'Izdajte prvi račun', 'Ustvarite svoj prvi račun neposredno v blagajni.')}
      ${stepRow('2', 'Pridobite FURS certifikat', 'Za produkcijsko delovanje naložite digitalno potrdilo FURS. Navodila smo vam poslali v ločenem e-sporočilu.')}
      ${stepRow('3', 'Povabite zaposlene', 'Dodajte sodelavce, da lahko tudi oni izdajajo račune.')}
    </table>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:8px;"><tr><td style="border-radius:8px;background:#0a0a0a;">
      <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Odprite blagajno →</a>
    </td></tr></table>
    <p style="margin:18px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">Za pomoč nam pišite na <a href="mailto:${SUPPORT_EMAIL}" style="color:#6D5EF7;">${SUPPORT_EMAIL}</a>.</p>
  ` +
    SHELL_CLOSE
  )
}

function buildFursHtml(companyName: string, dashboardUrl: string): string {
  return (
    SHELL_OPEN(companyName) +
    `
    <h1 style="margin:0 0 14px;font-size:20px;font-weight:600;color:#0a0a0a;">Navodila za pridobitev FURS certifikata</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.65;">FURS certifikat (digitalno potrdilo) omogoča davčno potrjevanje računov pri Finančni upravi RS. Brez njega blagajna deluje v <strong>testnem načinu</strong> in računi so označeni kot testni.</p>
    <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#0a0a0a;">Koraki:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${stepRow('1', 'Odprite eDavki', 'Pojdite na <a href="https://edavki.durs.gov.si" style="color:#6D5EF7;">edavki.durs.gov.si</a>.')}
      ${stepRow('2', 'Prijava', 'Prijavite se z davčno številko podjetja.')}
      ${stepRow('3', 'Zahtevajte certifikat', 'Izberite Digitalna potrdila → Zahtevaj certifikat.')}
      ${stepRow('4', 'Prenesite datoteko', 'Prenesite .p12 datoteko certifikata.')}
      ${stepRow('5', 'Naložite v Jedro+', 'V blagajni odprite Nastavitve → Certifikat in naložite .p12 datoteko.')}
    </table>
    <p style="margin:0 0 18px;font-size:13px;color:#6b7280;line-height:1.65;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 14px;">Opomba: do pridobitve certifikata deluje blagajna v testnem načinu — računi niso davčno potrjeni.</p>
    <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#0a0a0a;">
      <a href="${escapeHtml(dashboardUrl)}/settings/certificate" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Dodajte certifikat →</a>
    </td></tr></table>
    <p style="margin:18px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">Vprašanja? Pišite nam na <a href="mailto:${SUPPORT_EMAIL}" style="color:#6D5EF7;">${SUPPORT_EMAIL}</a>.</p>
  ` +
    SHELL_CLOSE
  )
}

function stepRow(num: string, title: string, body: string): string {
  return `<tr>
    <td style="vertical-align:top;width:28px;padding:6px 0;">
      <div style="width:22px;height:22px;border-radius:50%;background:#6D5EF7;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:22px;">${num}</div>
    </td>
    <td style="padding:6px 0 6px 10px;">
      <div style="font-size:14px;font-weight:600;color:#0a0a0a;">${title}</div>
      <div style="font-size:13px;color:#6b7280;line-height:1.55;">${body}</div>
    </td>
  </tr>`
}
