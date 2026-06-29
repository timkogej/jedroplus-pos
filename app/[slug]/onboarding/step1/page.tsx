'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import OnboardingShell from '@/components/onboarding/OnboardingShell'

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

  const [companyId, setCompanyId] = useState('')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [data, setData] = useState<Form>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .eq('slug', slug)
        .single()
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
    if (firstMissing) {
      setError('Izpolnite vsa obvezna polja.')
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

    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    router.push(`/${slug}/onboarding/step2`)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6D5EF7] border-t-transparent" />
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
            value={data.tax_number}
            onChange={(e) => set('tax_number', e.target.value)}
            placeholder="12345678"
            error={missing('tax_number') ? 'Obvezno polje' : undefined}
          />
          <Input
            label="ID za DDV"
            value={data.vat_id}
            onChange={(e) => set('vat_id', e.target.value)}
            placeholder="SI12345678"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Email podjetja *"
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
