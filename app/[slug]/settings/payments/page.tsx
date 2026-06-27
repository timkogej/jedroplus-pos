'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import type { PosPremise, PosDevice } from '@/types'

interface StatusState {
  connected: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  onboardingComplete: boolean
}

const emptyStatus: StatusState = {
  connected: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  onboardingComplete: false,
}

export default function PaymentsSettingsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [companyId, setCompanyId] = useState('')
  const [status, setStatus] = useState<StatusState>(emptyStatus)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  // Online invoice premise/device selection.
  const [premises, setPremises] = useState<PosPremise[]>([])
  const [devices, setDevices] = useState<PosDevice[]>([])
  const [onlinePremiseId, setOnlinePremiseId] = useState('')
  const [onlineDeviceId, setOnlineDeviceId] = useState('')
  const [savingOnline, setSavingOnline] = useState(false)
  const [onlineSaved, setOnlineSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .single()
      if (!company) {
        setLoading(false)
        return
      }
      setCompanyId(company.id)

      // Load premises, devices, and current online selection in parallel.
      const [{ data: premiseRows }, { data: deviceRows }, { data: settingsRow }] = await Promise.all([
        supabase.from('pos_premises').select('*').eq('company_id', company.id).eq('is_active', true).order('created_at'),
        supabase.from('pos_devices').select('*').eq('company_id', company.id).eq('is_active', true).order('created_at'),
        supabase.from('pos_settings').select('online_premise_id, online_device_id').eq('company_id', company.id).maybeSingle(),
      ])
      setPremises(premiseRows ?? [])
      setDevices(deviceRows ?? [])
      if (settingsRow?.online_premise_id) setOnlinePremiseId(settingsRow.online_premise_id)
      if (settingsRow?.online_device_id) setOnlineDeviceId(settingsRow.online_device_id)

      try {
        const res = await authFetch('/api/stripe/connect/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: company.id }),
        })
        const data = await res.json()
        if (res.ok) {
          setStatus({
            connected: !!data.connected,
            chargesEnabled: !!data.chargesEnabled,
            payoutsEnabled: !!data.payoutsEnabled,
            onboardingComplete: !!data.onboardingComplete,
          })
        } else {
          setError(data.error || 'Napaka pri preverjanju statusa')
        }
      } catch {
        setError('Napaka pri preverjanju statusa')
      }
      setLoading(false)
    }
    load()
  }, [slug])

  async function connect() {
    if (!companyId) return
    setConnecting(true)
    setError('')
    try {
      const res = await authFetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Napaka pri povezavi s Stripe')
        setConnecting(false)
      }
    } catch {
      setError('Napaka pri povezavi s Stripe')
      setConnecting(false)
    }
  }

  async function openDashboard() {
    if (!companyId) return
    setOpening(true)
    setError('')
    try {
      const res = await authFetch('/api/stripe/connect/login-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.open(data.url, '_blank')
      } else {
        setError(data.error || 'Napaka pri odpiranju nadzorne plošče')
      }
    } catch {
      setError('Napaka pri odpiranju nadzorne plošče')
    }
    setOpening(false)
  }

  async function saveOnlineSettings() {
    if (!companyId) return
    setSavingOnline(true)
    setOnlineSaved(false)
    setError('')
    try {
      const res = await authFetch('/api/stripe/settings/online-premise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          onlinePremiseId: onlinePremiseId || null,
          onlineDeviceId: onlineDeviceId || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setOnlineSaved(true)
      } else {
        setError(data.error || 'Napaka pri shranjevanju nastavitev')
      }
    } catch {
      setError('Napaka pri shranjevanju nastavitev')
    }
    setSavingOnline(false)
  }

  // Devices belonging to the currently selected premise.
  const devicesForPremise = devices.filter((d) => d.premise_id === onlinePremiseId)

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header slug={slug} title="Spletna plačila" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#6D5EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const fullyActive = status.connected && status.chargesEnabled
  const incomplete = status.connected && !status.chargesEnabled

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={slug} title="Spletna plačila" />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <p className="text-sm text-gray-500 mb-5">
          Povežite svoj Stripe račun, da boste lahko prejemali spletna plačila za rezervacije
          neposredno na svoj bančni račun.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          {!status.connected && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Stripe ni povezan</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Za sprejemanje spletnih plačil ustvarite ali povežite svoj Stripe račun.
                </p>
              </div>
              <Button onClick={connect} loading={connecting}>
                Poveži Stripe
              </Button>
            </div>
          )}

          {incomplete && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Nastavitev ni dokončana</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Vaš Stripe račun je ustvarjen, vendar plačila še niso aktivna. Dokončajte
                    nastavitev, da boste lahko sprejemali plačila.
                  </p>
                </div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                Spletna plačila trenutno niso aktivna.
              </div>
              <Button onClick={connect} loading={connecting}>
                Dokončaj nastavitev
              </Button>
            </div>
          )}

          {fullyActive && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-2.5 h-2.5 rounded-full bg-green-500" />
                <div>
                  <h3 className="text-sm font-medium text-green-700">Povezano ✓</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Spletna plačila so aktivna. Plačila se nakazujejo neposredno na vaš povezani
                    Stripe račun.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1 text-xs text-gray-500">
                <span>
                  Sprejemanje plačil: {status.chargesEnabled ? 'aktivno' : 'neaktivno'}
                </span>
                <span>
                  Izplačila: {status.payoutsEnabled ? 'aktivna' : 'neaktivna'}
                </span>
              </div>
              <Button variant="secondary" onClick={openDashboard} loading={opening}>
                Upravljaj na Stripe
              </Button>
            </div>
          )}
        </div>

        {fullyActive && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
            <h3 className="text-sm font-medium text-gray-900">Nastavitve za spletna plačila</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Izberite poslovni prostor in elektronsko napravo, ki se uporabita pri izdaji računov
              za spletna plačila rezervacij.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Poslovni prostor za spletne račune
                </label>
                <select
                  value={onlinePremiseId}
                  onChange={(e) => {
                    setOnlinePremiseId(e.target.value)
                    setOnlineDeviceId('')
                    setOnlineSaved(false)
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5EF7]/30"
                >
                  <option value="">Privzeto (prvi aktivni)</option>
                  {premises.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.premise_id}
                      {p.address ? ` — ${p.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Elektronska naprava
                </label>
                <select
                  value={onlineDeviceId}
                  onChange={(e) => {
                    setOnlineDeviceId(e.target.value)
                    setOnlineSaved(false)
                  }}
                  disabled={!onlinePremiseId}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6D5EF7]/30 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">Privzeto (prva aktivna)</option>
                  {devicesForPremise.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.device_id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={saveOnlineSettings} loading={savingOnline}>
                  Shrani
                </Button>
                {onlineSaved && <span className="text-xs text-green-600">Shranjeno ✓</span>}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        <Link href={`/${slug}/settings`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Nazaj na nastavitve
        </Link>
      </main>
    </div>
  )
}
