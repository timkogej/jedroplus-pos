'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface CompanyData {
  id?: string
  company_name: string
  address: string
  postal_code: string
  city: string
  country: string
  tax_number: string
  vat_id: string
  iban: string
  bank: string
  email: string
  phone: string
  website: string
}

const empty: CompanyData = {
  company_name: '',
  address: '',
  postal_code: '',
  city: '',
  country: 'Slovenija',
  tax_number: '',
  vat_id: '',
  iban: '',
  bank: '',
  email: '',
  phone: '',
  website: '',
}

export default function CompanyDataPage() {
  const params = useParams()
  const slug = params.slug as string

  const [companyId, setCompanyId] = useState('')
  const [data, setData] = useState<CompanyData>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .single()
      if (!company) return

      setCompanyId(company.id)

      const { data: cd } = await supabase
        .from('pos_company_data')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle()

      if (cd) {
        setData({
          id: cd.id,
          company_name: cd.company_name ?? '',
          address: cd.address ?? '',
          postal_code: cd.postal_code ?? '',
          city: cd.city ?? '',
          country: cd.country ?? 'Slovenija',
          tax_number: cd.tax_number ?? '',
          vat_id: cd.vat_id ?? '',
          iban: cd.iban ?? '',
          bank: cd.bank ?? '',
          email: cd.email ?? '',
          phone: cd.phone ?? '',
          website: cd.website ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [slug])

  async function save() {
    if (!companyId) return
    setSaving(true)
    setError('')

    const payload = {
      company_id: companyId,
      company_name: data.company_name || null,
      address: data.address || null,
      postal_code: data.postal_code || null,
      city: data.city || null,
      country: data.country || 'Slovenija',
      tax_number: data.tax_number || null,
      vat_id: data.vat_id || null,
      iban: data.iban || null,
      bank: data.bank || null,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
      updated_at: new Date().toISOString(),
    }

    const { error: err } = await supabase
      .from('pos_company_data')
      .upsert(payload, { onConflict: 'company_id' })

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  function set(field: keyof CompanyData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header slug={slug} title="Podatki podjetja" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#6D5EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={slug} title="Podatki podjetja za račune" />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <p className="text-sm text-gray-500 mb-5">
          Ti podatki se prikažejo v glavi vsakega PDF računa.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Osnovni podatki</h3>
          <Input
            label="Naziv podjetja (za račun)"
            value={data.company_name}
            onChange={(e) => set('company_name', e.target.value)}
            placeholder="Moje podjetje d.o.o."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Davčna številka" value={data.tax_number} onChange={(e) => set('tax_number', e.target.value)} placeholder="12345678" />
            <Input label="ID za DDV" value={data.vat_id} onChange={(e) => set('vat_id', e.target.value)} placeholder="SI12345678" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Naslov</h3>
          <Input label="Ulica in hišna številka" value={data.address} onChange={(e) => set('address', e.target.value)} placeholder="Slovenska cesta 1" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Poštna številka" value={data.postal_code} onChange={(e) => set('postal_code', e.target.value)} placeholder="1000" />
            <div className="sm:col-span-2">
              <Input label="Kraj" value={data.city} onChange={(e) => set('city', e.target.value)} placeholder="Ljubljana" />
            </div>
          </div>
          <Input label="Država" value={data.country} onChange={(e) => set('country', e.target.value)} placeholder="Slovenija" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bančni podatki</h3>
          <Input label="IBAN" value={data.iban} onChange={(e) => set('iban', e.target.value)} placeholder="SI56 1234 5678 9012 345" />
          <Input label="Banka" value={data.bank} onChange={(e) => set('bank', e.target.value)} placeholder="NLB d.d." />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kontakt</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="E-pošta" type="email" value={data.email} onChange={(e) => set('email', e.target.value)} placeholder="info@podjetje.si" />
            <Input label="Telefon" value={data.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+386 1 234 5678" />
          </div>
          <Input label="Spletna stran" value={data.website} onChange={(e) => set('website', e.target.value)} placeholder="www.podjetje.si" />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={save} loading={saving}>
            {saved ? 'Shranjeno ✓' : 'Shrani podatke'}
          </Button>
          <Link href={`/${slug}/settings`} className="text-sm text-gray-400 hover:text-gray-600">
            Prekliči
          </Link>
        </div>
      </main>
    </div>
  )
}
