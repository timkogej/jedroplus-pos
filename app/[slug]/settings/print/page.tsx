'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/components/layout/CompanyContext'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import type { PosSettings } from '@/types'
import { friendlyError } from '@/lib/errors'

type PrintFormat = 'a4' | 'thermal' | 'ask'

const FORMAT_OPTIONS: { value: PrintFormat; label: string; description: string }[] = [
  { value: 'a4', label: 'A4', description: 'Vedno natisni na standardnem A4 formatu' },
  { value: 'thermal', label: 'Termalni (80mm)', description: 'Vedno natisni na 80mm termalnem papirju' },
  { value: 'ask', label: 'Vprašaj vsakič', description: 'Po izstavitvi računa prikaži izbiro formata' },
]

export default function PrintSettingsPage() {
  const params = useParams()
  const slug = params.slug as string
  const companyCtx = useCompany()

  const [settings, setSettings] = useState<PosSettings | null>(null)
  const [selected, setSelected] = useState<PrintFormat>('ask')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [companyId, setCompanyId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const company: { id: string; name: string } | null = { id: companyCtx.id, name: companyCtx.name }
      const companyErr: { message?: string } | null = null
      if (!company) {
        setLoading(false)
        return
      }
      setCompanyId(company.id)

      const { data: s } = await supabase
        .from('pos_settings')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle()

      if (s) {
        setSettings(s)
        setSelected((s.print_format as PrintFormat) ?? 'ask')
      }
      setLoading(false)
    }
    load()
  }, [slug])

  async function save() {
    if (!companyId) return
    setError('')
    setSaving(true)
    const { error: err } = await supabase
      .from('pos_settings')
      .upsert(
        { company_id: companyId, print_format: selected, updated_at: new Date().toISOString() },
        { onConflict: 'company_id' }
      )
    setSaving(false)
    if (err) {
      setError(friendlyError(err))
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header slug={slug} title="Tiskanje" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={slug} title="Nastavitve tiskanja" />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <div className="mb-5">
          <p className="text-sm text-gray-500">Izberite privzeti format tiskanja računov.</p>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-3 mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Format tiskanja</h3>
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                selected === opt.value
                  ? 'border-brand bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                selected === opt.value ? 'border-brand' : 'border-gray-300'
              }`}>
                {selected === opt.value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-brand" />
                )}
              </div>
              <div>
                <p className={`text-sm font-semibold ${selected === opt.value ? 'text-brand' : 'text-gray-900'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={save} loading={saving}>
            {saved ? 'Shranjeno ✓' : 'Shrani nastavitve'}
          </Button>
          <Link href={`/${slug}/settings`} className="text-sm text-gray-500 hover:text-gray-600">
            Prekliči
          </Link>
        </div>
      </main>
    </div>
  )
}
