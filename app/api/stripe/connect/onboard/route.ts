import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json()

    if (!companyId) {
      return NextResponse.json({ error: 'Manjka companyId' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Need the slug for the Stripe redirect URLs.
    const { data: company } = await supabase
      .from('companies')
      .select('id, slug')
      .eq('id', companyId)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Podjetje ni najdeno' }, { status: 404 })
    }

    // Load existing settings (the row should exist; if not we create one).
    const { data: settings } = await supabase
      .from('pos_settings')
      .select('id, stripe_account_id')
      .eq('company_id', companyId)
      .maybeSingle()

    let accountId = settings?.stripe_account_id ?? null

    if (!accountId) {
      // Best-effort: use the company's billing email if we have one.
      const { data: companyData } = await supabase
        .from('pos_company_data')
        .select('email')
        .eq('company_id', companyId)
        .maybeSingle()

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'SI',
        email: companyData?.email ?? undefined,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })

      accountId = account.id

      // Persist the new account id. Upsert so it works even if the settings row
      // does not exist yet — a new row only sets company_id + the Stripe field and
      // lets every other column fall back to its schema default.
      const { error: upsertError } = await supabase
        .from('pos_settings')
        .upsert(
          { company_id: companyId, stripe_account_id: accountId },
          { onConflict: 'company_id' }
        )

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 })
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/${company.slug}/settings/payments?refresh=1`,
      return_url: `${baseUrl}/${company.slug}/settings/payments?return=1`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Napaka pri povezavi s Stripe'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
