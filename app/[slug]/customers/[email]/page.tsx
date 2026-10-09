import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import { getLoyaltySettings } from '@/lib/loyalty/award'
import { getPointsBalance } from '@/lib/loyalty/balance'
import Header from '@/components/layout/Header'
import AdjustPointsForm from '@/components/customers/AdjustPointsForm'
import { ljParts } from '@/lib/time'

export const revalidate = 0

const TYPE_LABEL: Record<string, string> = {
  earned: 'Zasluženo',
  redeemed: 'Unovčeno',
  adjustment: 'Popravek',
}

function fmt(iso: string): string {
  const p = ljParts(new Date(iso))
  const t = (n: number) => String(n).padStart(2, '0')
  return `${t(p.day)}.${t(p.month)}.${p.year} ${t(p.hour)}:${t(p.minute)}`
}

export default async function CustomerDetailPage({ params }: { params: { slug: string; email: string } }) {
  const company = await requireCompanyForSlug(params.slug)
  const email = decodeURIComponent(params.email).trim().toLowerCase()
  const supabase = createServiceClient()

  const [loyalty, { data: stranka }, { data: ledger }, { data: invoices }] = await Promise.all([
    getLoyaltySettings(supabase, company.id),
    supabase
      .from('Stranke')
      .select('"Stranka", "Ime", "Priimek", "Telefonska številka"')
      .eq('ID Podjetja', company.company_id)
      .ilike('Email stranke', email.replace(/[\\%_]/g, (c) => `\\${c}`))
      .limit(1)
      .maybeSingle(),
    supabase
      .from('pos_loyalty_points')
      .select('id, type, points, description, created_at')
      .eq('company_id', company.id)
      .eq('client_email', email)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('pos_invoices')
      .select('id, invoice_number, invoice_date, total, status')
      .eq('company_id', company.id)
      .ilike('client_email', email.replace(/[\\%_]/g, (c) => `\\${c}`))
      .order('invoice_date', { ascending: false })
      .limit(10),
  ])

  const s = stranka as Record<string, string | null> | null
  const name = s?.Stranka || `${s?.Ime ?? ''} ${s?.Priimek ?? ''}`.trim() || email
  const balance = loyalty.loyalty_enabled ? await getPointsBalance(company.id, email, supabase) : 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={params.slug} title={name} />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          <Link href={`/${params.slug}/customers`} className="text-sm text-gray-400 hover:text-gray-600">
            ← Vse stranke
          </Link>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-medium text-gray-900">{name}</p>
            <p className="text-xs text-gray-400">
              {email}
              {s?.['Telefonska številka'] ? ` · ${s['Telefonska številka']}` : ''}
            </p>
            {loyalty.loyalty_enabled && (
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-3xl font-semibold text-gray-900">{balance}</span>
                <span className="text-sm text-gray-500">
                  točk · vredno {(balance * loyalty.loyalty_redeem_value).toFixed(2)} €
                </span>
              </div>
            )}
          </div>

          {loyalty.loyalty_enabled ? (
            <>
              <AdjustPointsForm companyId={company.id} clientEmail={email} />

              <section aria-labelledby="ledger-h">
                <h2 id="ledger-h" className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Zgodovina točk
                </h2>
                {(ledger ?? []).length === 0 ? (
                  <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 p-5">Še ni gibanj.</p>
                ) : (
                  <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                    {(ledger ?? []).map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900">{TYPE_LABEL[r.type as string] ?? r.type}</p>
                          <p className="text-xs text-gray-400 break-words">{r.description}</p>
                          <p className="text-xs text-gray-300">{fmt(r.created_at as string)}</p>
                        </div>
                        <span className={`flex-shrink-0 text-sm font-semibold ${(r.points as number) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {(r.points as number) > 0 ? '+' : ''}{r.points}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <p className="text-sm text-gray-500">Loyalty program ni vklopljen.</p>
          )}

          <section aria-labelledby="inv-h">
            <h2 id="inv-h" className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Zadnji računi
            </h2>
            {(invoices ?? []).length === 0 ? (
              <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 p-5">Ni računov.</p>
            ) : (
              <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {(invoices ?? []).map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/${params.slug}/invoices/${inv.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
                    >
                      <span className="text-sm text-gray-900">{inv.invoice_number}</span>
                      <span className="text-sm text-gray-600">{Number(inv.total).toFixed(2)} €</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
