'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { PosSettings } from '@/types'

export default function LoyaltySettingsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [settings, setSettings] = useState<PosSettings | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [earnRate, setEarnRate] = useState(1)
  const [redeemValue, setRedeemValue] = useState(0.05)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .single()
      if (!company) return

      const { data: s } = await supabase
        .from('pos_settings')
        .select('*')
        .eq('company_id', company.id)
        .single()

      if (s) {
        setSettings(s)
        setEnabled(s.loyalty_enabled ?? false)
        setEarnRate(s.loyalty_earn_rate ?? 1)
        setRedeemValue(s.loyalty_redeem_value ?? 0.05)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  async function save() {
    if (!settings) return
    setSaving(true)
    await supabase
      .from('pos_settings')
      .update({
        loyalty_enabled: enabled,
        loyalty_earn_rate: earnRate,
        loyalty_redeem_value: redeemValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hundredPointsValue = (100 * redeemValue).toFixed(2)

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header slug={slug} title="Loyalty točke" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#6D5EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={slug} title="Loyalty program" />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <div className="mb-5">
          <p className="text-sm text-gray-500">
            Nagrajujte zveste stranke s točkami, ki jih lahko unovčijo za popust pri naslednjem nakupu.
          </p>
        </div>

        {/* Enable toggle */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <p className="text-sm font-medium text-gray-900">Omogoči loyalty program</p>
              <p className="text-xs text-gray-500 mt-0.5">Stranke samodejno zbirajo točke ob izstavitvi računa.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                enabled ? 'bg-[#6D5EF7]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Rate config */}
        <div className={`bg-white rounded-2xl border border-gray-100 p-5 space-y-4 mb-5 transition-opacity ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pravila točk</h3>

          <Input
            label="Točk na 1 € porabe"
            type="number"
            min="0"
            step="0.1"
            value={earnRate}
            onChange={(e) => setEarnRate(parseFloat(e.target.value) || 0)}
            hint={`Stranka dobi ${earnRate || 0} točk za vsak 1 € porabljen.`}
          />

          <Input
            label="Vrednost 1 točke pri unovčitvi (€)"
            type="number"
            min="0"
            step="0.01"
            value={redeemValue}
            onChange={(e) => setRedeemValue(parseFloat(e.target.value) || 0)}
            hint={`100 točk = ${hundredPointsValue} € popusta.`}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} loading={saving}>
            {saved ? 'Shranjeno ✓' : 'Shrani nastavitve'}
          </Button>
          <Link href={`/${slug}/settings`} className="text-sm text-gray-400 hover:text-gray-600">
            Prekliči
          </Link>
        </div>
      </main>
    </div>
  )
}
