'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import OnboardingShell from '@/components/onboarding/OnboardingShell'

interface Form {
  premise_id: string
  address: string
  city: string
  postal_code: string
}

const empty: Form = { premise_id: 'PS1', address: '', city: '', postal_code: '' }
const REQUIRED: (keyof Form)[] = ['premise_id', 'address', 'city', 'postal_code']

export default function OnboardingStep2() {
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

      // Prefill the premise address from the company data entered in step 1.
      const { data: cd } = await supabase
        .from('pos_company_data')
        .select('company_name, address, city, postal_code')
        .eq('company_id', company.id)
        .maybeSingle()
      if (cd) {
        setCompanyName(cd.company_name ?? company.name)
        setData((d) => ({
          ...d,
          address: cd.address ?? '',
          city: cd.city ?? '',
          postal_code: cd.postal_code ?? '',
        }))
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

  async function finish() {
    setTouched(true)
    if (REQUIRED.some((f) => !data[f].trim())) {
      setError('Izpolnite vsa obvezna polja.')
      return
    }
    if (!companyId) return

    setSaving(true)
    setError('')

    // 1. Create the business premise.
    const { data: premise, error: premiseErr } = await supabase
      .from('pos_premises')
      .insert({
        company_id: companyId,
        premise_id: data.premise_id.trim().toUpperCase().slice(0, 20),
        premise_type: 'premises',
        address: data.address.trim(),
        city: data.city.trim(),
        postal_code: data.postal_code.trim(),
      })
      .select()
      .single()

    if (premiseErr || !premise) {
      setSaving(false)
      setError(premiseErr?.message ?? 'Napaka pri shranjevanju prostora.')
      return
    }

    // 2. Auto-create the electronic device EN1 for this premise.
    const { error: deviceErr } = await supabase.from('pos_devices').insert({
      company_id: companyId,
      premise_id: premise.id,
      device_id: 'EN1',
    })

    if (deviceErr) {
      setSaving(false)
      setError(deviceErr.message)
      return
    }

    // 3. Fire the completion API (sends onboarding + FURS emails). Best-effort:
    // a failed email must not block the user from reaching the dashboard.
    try {
      await authFetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, slug }),
      })
    } catch {
      // ignore — email is non-critical to onboarding completion
    }

    router.replace(`/${slug}/dashboard?onboarding=complete`)
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
      step={2}
      companyName={companyName}
      title="Nastavite poslovni prostor"
      subtitle="Potrebujete vsaj en poslovni prostor za izdajo računov"
    >
      <div className="space-y-4">
        <Input
          label="Oznaka prostora *"
          value={data.premise_id}
          onChange={(e) => set('premise_id', e.target.value.toUpperCase().slice(0, 20))}
          placeholder="PS1"
          maxLength={20}
          hint="Kratka oznaka poslovnega prostora (npr. PS1)"
          error={missing('premise_id') ? 'Obvezno polje' : undefined}
        />
        <Input
          label="Naslov prostora *"
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

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
          Samodejno bomo ustvarili elektronsko napravo <span className="font-semibold text-gray-700">EN1</span> za ta poslovni prostor.
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => router.push(`/${slug}/onboarding/step1`)}
            className="text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            ← Nazaj
          </button>
          <Button onClick={finish} loading={saving}>
            Zaključi nastavitev →
          </Button>
        </div>
      </div>
    </OnboardingShell>
  )
}
