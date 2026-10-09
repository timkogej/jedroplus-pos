import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { requireCompanyForSlug } from '@/lib/auth/serverCompany'
import { getLoyaltySettings } from '@/lib/loyalty/award'
import Header from '@/components/layout/Header'

export const revalidate = 0

interface StrankaRow {
  'ID stranke': string | null
  Stranka: string | null
  Ime: string | null
  Priimek: string | null
  'Email stranke': string | null
  'Telefonska številka': string | null
}

function displayName(r: StrankaRow): string {
  return r.Stranka || `${r.Ime ?? ''} ${r.Priimek ?? ''}`.trim() || '—'
}

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { q?: string }
}) {
  const company = await requireCompanyForSlug(params.slug)
  const supabase = createServiceClient()
  const loyalty = await getLoyaltySettings(supabase, company.id)

  // Keep the search term to characters that can't break out of the PostgREST filter.
  const q = (searchParams.q ?? '').replace(/[^A-Za-z0-9@._\-ČŠŽčšžĆćĐđ ]/g, '').trim().slice(0, 60)

  let query = supabase
    .from('Stranke')
    .select('"ID stranke", "Stranka", "Ime", "Priimek", "Email stranke", "Telefonska številka"')
    .eq('ID Podjetja', company.company_id)
    .order('Zadnja interakcija', { ascending: false, nullsFirst: false })
    .limit(200)
  if (q) {
    query = query.or(
      `"Stranka".ilike.%${q}%,"Email stranke".ilike.%${q}%,"Ime".ilike.%${q}%,"Priimek".ilike.%${q}%`
    )
  }
  const { data } = await query
  const customers = (data ?? []) as unknown as StrankaRow[]

  const balances = new Map<string, number>()
  if (loyalty.loyalty_enabled) {
    const { data: rows } = await supabase
      .from('pos_loyalty_points')
      .select('client_email, points')
      .eq('company_id', company.id)
    for (const r of rows ?? []) {
      const key = String(r.client_email).toLowerCase()
      balances.set(key, (balances.get(key) ?? 0) + (r.points as number))
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={params.slug} title="Stranke" />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <form method="get" className="flex gap-2" role="search">
            <input
              name="q"
              defaultValue={q}
              placeholder="Išči po imenu ali e-pošti…"
              aria-label="Iskanje strank"
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900"
            />
            <button className="px-4 py-2.5 rounded-lg bg-[#0a0a0a] text-white text-sm font-medium hover:bg-[#1f1f1f]">
              Išči
            </button>
          </form>

          {!loyalty.loyalty_enabled && (
            <p className="text-xs text-gray-500">
              Loyalty program ni vklopljen — točke se ne prikazujejo.{' '}
              <Link href={`/${params.slug}/settings/loyalty`} className="text-brand hover:underline">Vklopi</Link>
            </p>
          )}

          {customers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-sm text-gray-500 font-medium">
                {q ? 'Ni zadetkov za to iskanje' : 'Še ni strank'}
              </p>
            </div>
          ) : (
            <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {customers.map((c, i) => {
                const email = c['Email stranke']?.trim().toLowerCase() ?? ''
                const balance = email ? Math.max(0, balances.get(email) ?? 0) : 0
                const row = (
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{displayName(c)}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {email || 'brez e-pošte'}
                        {c['Telefonska številka'] ? ` · ${c['Telefonska številka']}` : ''}
                      </p>
                    </div>
                    {loyalty.loyalty_enabled && email && (
                      <span className="flex-shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                        {balance} točk
                      </span>
                    )}
                  </div>
                )
                return (
                  <li key={c['ID stranke'] ?? i}>
                    {email ? (
                      <Link
                        href={`/${params.slug}/customers/${encodeURIComponent(email)}`}
                        className="block hover:bg-gray-50 transition-colors"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {customers.length === 200 && (
            <p className="text-xs text-gray-400 text-center">Prikazanih je prvih 200 strank. Zožite iskanje.</p>
          )}
        </div>
      </main>
    </div>
  )
}
