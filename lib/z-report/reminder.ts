import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

let resendClient: Resend | null = null

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is not set')
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export interface ZReportReminderInput {
  to: string
  companyName: string
  slug: string
  totalRevenue: number
  invoiceCount: number
  brandPrimary?: string
}

/**
 * Sends the daily "close your register" reminder email for a company that has
 * not yet created today's Z-report.
 */
export async function sendZReportReminder(
  input: ZReportReminderInput
): Promise<{ success: boolean; error?: string }> {
  const { companyName, slug, totalRevenue, invoiceCount } = input
  const to = process.env.RESEND_TEST_TO ?? input.to

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const link = `${appUrl}/${slug}/z-report`

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to,
      subject: 'Opomnik: Zaključite blagajno za danes',
      html: buildHtml({ companyName, link, totalRevenue, invoiceCount, brandPrimary: input.brandPrimary }),
    })

    if (error) {
      const msg = (error as { message?: string }).message ?? JSON.stringify(error)
      console.error('[z-report reminder] FAILED:', msg)
      return { success: false, error: msg }
    }
    console.log('[z-report reminder] sent — id:', data?.id)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Email send failed'
    console.error('[z-report reminder] EXCEPTION:', message)
    return { success: false, error: message }
  }
}

function buildHtml(opts: {
  companyName: string
  link: string
  totalRevenue: number
  invoiceCount: number
  brandPrimary?: string
}): string {
  const brand = opts.brandPrimary ?? '#6D5EF7'
  const amount = opts.totalRevenue.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `<!DOCTYPE html>
<html lang="sl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #f0f0f0;">
        <tr><td style="background:${brand};height:6px;line-height:6px;font-size:1px;border-radius:12px 12px 0 0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <div style="font-size:16px;font-weight:600;color:#0a0a0a;">${escapeHtml(opts.companyName)}</div>
          <h1 style="margin:18px 0 8px;font-size:19px;color:#0a0a0a;">Ne pozabite zaključiti blagajne za danes</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;">Pozdravljeni,<br>za današnji dan še niste ustvarili Z-poročila (dnevnega zaključka blagajne).</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <tr>
              <td style="padding:13px 16px;border-bottom:1px solid #f5f5f5;font-size:13px;color:#6b7280;">Prihodki danes</td>
              <td style="padding:13px 16px;border-bottom:1px solid #f5f5f5;font-size:14px;font-weight:700;color:${brand};text-align:right;">${amount} EUR</td>
            </tr>
            <tr>
              <td style="padding:13px 16px;font-size:13px;color:#6b7280;">Število računov</td>
              <td style="padding:13px 16px;font-size:14px;font-weight:600;color:#0a0a0a;text-align:right;">${opts.invoiceCount}</td>
            </tr>
          </table>
          <a href="${opts.link}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">Zaključi blagajno →</a>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;border-top:1px solid #f5f5f5;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">${escapeHtml(opts.companyName)} · Jedro+ Blagajna</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
