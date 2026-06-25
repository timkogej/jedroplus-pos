import { Resend } from 'resend'
import type { PosInvoice } from '@/types'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

let resendClient: Resend | null = null

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set')
    }
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export interface EmailOptions {
  brandPrimary?: string
  brandSecond?: string
}

export async function sendInvoiceEmail(
  invoice: PosInvoice,
  pdfBase64: string,
  companyName: string,
  options: EmailOptions = {}
): Promise<{ success: boolean; error?: string }> {
  if (!invoice.client_email) {
    console.warn('[email] Skipping — invoice has no client_email')
    return { success: false, error: 'No client email' }
  }

  const to = process.env.RESEND_TEST_TO ?? invoice.client_email

  console.log('[email] ── Sending email ──────────────────────')
  console.log('[email]   FROM:', FROM)
  console.log('[email]   TO  :', to, to !== invoice.client_email ? `(overriding ${invoice.client_email})` : '')
  console.log('[email]   pdfBase64 length:', pdfBase64?.length ?? 0)

  try {
    const payload = {
      from: FROM,
      to,
      subject: `Račun ${invoice.invoice_number} - ${companyName}`,
      html: buildEmailHtml(invoice, companyName, options),
      attachments: pdfBase64
        ? [{ filename: `Racun-${invoice.invoice_number}.pdf`, content: pdfBase64 }]
        : [],
    }

    const { data, error } = await getResend().emails.send(payload)

    console.log('[email]   data :', JSON.stringify(data))
    console.log('[email]   error:', JSON.stringify(error))

    if (error) {
      const msg = (error as { message?: string }).message ?? JSON.stringify(error)
      console.error('[email] FAILED:', msg)
      return { success: false, error: msg }
    }

    console.log('[email] SUCCESS — Resend email id:', data?.id)
    return { success: true }
  } catch (err: unknown) {
    console.error('[email] EXCEPTION during send:', err)
    const message = err instanceof Error ? err.message : 'Email send failed'
    return { success: false, error: message }
  }
}

function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cash: 'Gotovina',
    card: 'Kartica',
    transfer: 'Bančno nakazilo',
    online: 'Spletno plačilo',
  }
  return map[method] ?? method
}

function buildEmailHtml(invoice: PosInvoice, companyName: string, options: EmailOptions): string {
  const brand = options.brandPrimary ?? '#6D5EF7'
  const brand2 = options.brandSecond ?? '#2AD4C5'

  const date = new Date(invoice.invoice_date).toLocaleDateString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const amount = invoice.total.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const clientName = invoice.client_name ? escapeHtml(invoice.client_name) : null

  const eorRow = invoice.eor
    ? `<tr>
        <td style="padding:13px 16px;border-bottom:1px solid #f5f5f5;font-size:13px;color:#6b7280;font-weight:500;">EOR</td>
        <td style="padding:13px 16px;border-bottom:1px solid #f5f5f5;font-size:11px;color:#6b7280;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;text-align:right;">${invoice.eor}</td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Racun ${invoice.invoice_number}</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #f0f0f0;box-shadow:0 1px 3px rgba(0,0,0,0.04);">

          <!-- Top accent bar -->
          <tr>
            <td style="background:${brand};background:linear-gradient(90deg,${brand} 0%,${brand2} 100%);height:6px;line-height:6px;font-size:1px;border-radius:12px 12px 0 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="font-size:16px;font-weight:600;color:#0a0a0a;letter-spacing:-0.2px;">${escapeHtml(companyName)}</div>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">RACUN</div>
                    <div style="font-size:15px;font-weight:600;color:#0a0a0a;margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(invoice.invoice_number)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px;">

              <p style="margin:0 0 14px;font-size:15px;color:#0a0a0a;line-height:1.5;">Pozdravljeni${clientName ? ', ' + clientName : ''},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.65;">V priponki vam posiljamo racun za opravljene storitve. Hvala za vase zaupanje.</p>

              <!-- Summary box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:13px 16px;border-bottom:1px solid #f5f5f5;font-size:13px;color:#6b7280;font-weight:500;">Datum</td>
                  <td style="padding:13px 16px;border-bottom:1px solid #f5f5f5;font-size:13px;color:#0a0a0a;font-weight:500;text-align:right;">${date}</td>
                </tr>
                <tr>
                  <td style="padding:13px 16px;border-bottom:1px solid #f5f5f5;font-size:13px;color:#6b7280;font-weight:500;">Placilni nacin</td>
                  <td style="padding:13px 16px;border-bottom:1px solid #f5f5f5;font-size:13px;color:#0a0a0a;font-weight:500;text-align:right;">${formatPaymentMethod(invoice.payment_method)}</td>
                </tr>
                ${eorRow}
                <tr style="background-color:#fafafa;">
                  <td style="padding:13px 16px;font-size:13px;color:#374151;font-weight:600;">Znesek</td>
                  <td style="padding:13px 16px;font-size:18px;font-weight:700;color:${brand};letter-spacing:-0.3px;text-align:right;">${amount} EUR</td>
                </tr>
              </table>

              <p style="margin:0 0 18px;font-size:13px;color:#6b7280;line-height:1.65;">Racun je davcno potrjen pri FURS. V primeru kakrsnih koli vprasanj smo vam z veseljem na voljo.</p>

              <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">
                Lep pozdrav,<br>
                <strong style="color:#0a0a0a;font-weight:600;">${escapeHtml(companyName)}</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f5f5f5;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                Racun je izstavljen skladno z Zakonom o davcnem potrjevanju racunov (ZDavPR).<br>
                ${escapeHtml(companyName)} &middot; Jedro+
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
