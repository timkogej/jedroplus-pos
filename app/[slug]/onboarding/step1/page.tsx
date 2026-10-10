'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/components/layout/CompanyContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import OnboardingShell from '@/components/onboarding/OnboardingShell'
import { friendlyError } from '@/lib/errors'
import { authFetch } from '@/lib/authFetch'
import HelpTip from '@/components/help/HelpTip'

interface Form {
  company_name: string
  address: string
  postal_code: string
  city: string
  tax_number: string
  vat_id: string
  email: string
  phone: string
  iban: string
  bank: string
}

const empty: Form = {
  company_name: '',
  address: '',
  postal_code: '',
  city: '',
  tax_number: '',
  vat_id: '',
  email: '',
  phone: '',
  iban: '',
  bank: '',
}

const REQUIRED: (keyof Form)[] = ['company_name', 'address', 'postal_code', 'city', 'tax_number', 'email']

export default function OnboardingStep1() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const companyCtx = useCompany()

  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [data, setData] = useState<Form>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  // null = the user hasn't answered yet
  const [vatPayer, setVatPayer] = useState<boolean | null>(null)

  useEffect(() => {
    async function load() {
      const company: { id: string; name: string } | null = { id: companyCtx.id, name: companyCtx.name }
      const companyErr: { message?: string } | null = null
      if (!company) return
      setCompanyId(company.id)
      setCompanyName(company.name)

      const { data: cd } = await supabase
        .from('pos_company_data')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle()

      if (cd) {
        setData({
          company_name: cd.company_name ?? company.name ?? '',
          address: cd.address ?? '',
          postal_code: cd.postal_code ?? '',
          city: cd.city ?? '',
          tax_number: cd.tax_number ?? '',
          vat_id: cd.vat_id ?? '',
          email: cd.email ?? '',
          phone: cd.phone ?? '',
          iban: cd.iban ?? '',
          bank: cd.bank ?? '',
        })
      } else {
        setData((d) => ({ ...d, company_name: company.name ?? '' }))
      }

      // If the question was already answered (user came back), show that answer.
      const [{ data: st }, { data: os }] = await Promise.all([
        supabase.from('pos_settings').select('is_vat_registered').eq('company_id', company.id).maybeSingle(),
        supabase.from('pos_onboarding_state').select('vat_confirmed').eq('company_id', company.id).maybeSingle(),
      ])
      if (os?.vat_confirmed) setVatPayer(st?.is_vat_registered !== false)
      setLoading(false)
    }
    load()
  }, [slug])

  function set(field: keyof Form, value: string) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  function missing(field: keyof Form) {
    return touched && REQUIRED.includes(field) && !data[field].trim()
  }

  async function next() {
    setTouched(true)
    const firstMissing = REQUIRED.find((f) => !data[f].trim())
    if (firstMissing || vatPayer === null) {
      setError(firstMissing ? 'Izpolnite vsa obvezna polja.' : 'Odgovorite, ali ste zavezanec za DDV.')
      return
    }
    if (!companyId) return

    setSaving(true)
    setError('')

    const { error: err } = await supabase.from('pos_company_data').upsert(
      {
        company_id: companyId,
        company_name: data.company_name.trim(),
        address: data.address.trim(),
        postal_code: data.postal_code.trim(),
        city: data.city.trim(),
        country: 'Slovenija',
        tax_number: data.tax_number.trim(),
        vat_id: data.vat_id.trim() || null,
        email: data.email.trim(),
        phone: data.phone.trim() || null,
        iban: data.iban.trim() || null,
        bank: data.bank.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' }
    )

    if (err) {
      setSaving(false)
      setError(friendlyError(err))
      return
    }

    // The VAT answer is saved by the server (settings + "answered" flag for the guide).
    const vatRes = await authFetch('/api/guide/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, action: 'vat', vatRegistered: vatPayer }),
    })
    setSaving(false)
    if (!vatRes.ok) {
      setError('Odgovora o DDV ni bilo mogoče shraniti. Poskusite znova.')
      return
    }
    router.push(`/${slug}/onboarding/step2`)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    )
  }

  return (
    <OnboardingShell
      slug={slug}
      step={1}
      companyName={companyName}
      title="Nastavite podatke podjetja"
      subtitle="Ti podatki bodo prikazani na vsakem računu"
    >
      <div className="space-y-4">
        <Input
          label="Naziv podjetja *"
          value={data.company_name}
          onChange={(e) => set('company_name', e.target.value)}
          placeholder="Moje podjetje d.o.o."
          error={missing('company_name') ? 'Obvezno polje' : undefined}
        />
        <Input
          label="Naslov *"
          value={data.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="Slovenska cesta 1"
          error={missing('address') ? 'Obvezno polje' : undefined}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Poštna številka *"
            value={data.postal_code}
            onChange={(e) => set('postal_code', e.target.value)}
            placeholder="1000"
            error={missing('postal_code') ? 'Obvezno' : undefined}
          />
          <div className="sm:col-span-2">
            <Input
              label="Mesto *"
              value={data.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Ljubljana"
              error={missing('city') ? 'Obvezno polje' : undefined}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Davčna številka *"
            help="taxNumber"
            value={data.tax_number}
            onChange={(e) => set('tax_number', e.target.value)}
            placeholder="12345678"
            error={missing('tax_number') ? 'Obvezno polje' : undefined}
          />
          <Input
            label="ID za DDV"
            help="vat"
            value={data.vat_id}
            onChange={(e) => set('vat_id', e.target.value)}
            placeholder="SI12345678"
          />
        </div>
        <fieldset aria-describedby="vat-hint">
          <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
            Ali ste zavezanec za DDV? * <HelpTip term="vat" />
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { value: true, title: 'Da, sem zavezanec', hint: 'Računi prikažejo DDV.' },
              { value: false, title: 'Ne, nisem zavezanec', hint: 'DDV ni obračunan.' },
            ].map((o) => (
              <label
                key={String(o.value)}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  vatPayer === o.value ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'
                } ${touched && vatPayer === null ? 'border-red-300' : ''}`}
              >
                <input
                  type="radio"
                  name="vat-payer"
                  checked={vatPayer === o.value}
                  onChange={() => setVatPayer(o.value)}
                  className="mt-0.5 h-4 w-4 accent-brand"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{o.title}</span>
                  <span className="block text-xs text-gray-500">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <p id="vat-hint" className="mt-1.5 text-xs text-gray-500">
            Odgovor lahko pozneje spremenite v Nastavitve → Nastavitve računov.
          </p>
        </fieldset>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="E-pošta podjetja *"
            type="email"
            value={data.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="info@podjetje.si"
            error={missing('email') ? 'Obvezno polje' : undefined}
          />
          <Input
            label="Telefon"
            value={data.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+386 1 234 5678"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="IBAN"
            value={data.iban}
            onChange={(e) => set('iban', e.target.value)}
            placeholder="SI56 1234 5678 9012 345"
          />
          <Input
            label="Banka"
            value={data.bank}
            onChange={(e) => set('bank', e.target.value)}
            placeholder="NLB d.d."
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <div className="flex justify-end pt-1">
          <Button onClick={next} loading={saving}>
            Nadaljuj →
          </Button>
        </div>
      </div>
    </OnboardingShell>
  )
}
