'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import type { PosPremise, PosDevice } from '@/types'

interface Props {
  companyId: string
  initialPremises: PosPremise[]
  initialDevices: PosDevice[]
}

export default function PremisesForm({ companyId, initialPremises, initialDevices }: Props) {
  const [premises, setPremises] = useState(initialPremises)
  const [devices, setDevices] = useState(initialDevices)

  const [newPremise, setNewPremise] = useState({ premise_id: '', address: '', city: '', postal_code: '', premise_type: 'premises' })
  const [newDevice, setNewDevice] = useState({ device_id: '', premise_id: initialPremises[0]?.id ?? '' })
  const [addingPremise, setAddingPremise] = useState(false)
  const [addingDevice, setAddingDevice] = useState(false)
  const [error, setError] = useState('')

  async function savePremise() {
    if (!newPremise.premise_id) { setError('Vnesite oznako prostora'); return }
    setAddingPremise(true)
    setError('')
    const { data, error: err } = await supabase
      .from('pos_premises')
      .insert({ company_id: companyId, ...newPremise })
      .select()
      .single()

    if (err) { setError(err.message); setAddingPremise(false); return }
    const added = data as PosPremise
    setPremises((p) => {
      const updated = [...p, added]
      // Keep device form's premise_id valid — default to first premise if none selected yet
      setNewDevice((d) => ({ ...d, premise_id: d.premise_id || updated[0].id }))
      return updated
    })
    setNewPremise({ premise_id: '', address: '', city: '', postal_code: '', premise_type: 'premises' })
    setAddingPremise(false)
  }

  async function saveDevice() {
    if (!newDevice.device_id || !newDevice.premise_id) { setError('Izpolnite podatke naprave'); return }
    setAddingDevice(true)
    setError('')
    const { data, error: err } = await supabase
      .from('pos_devices')
      .insert({ company_id: companyId, ...newDevice })
      .select()
      .single()

    if (err) { setError(err.message); setAddingDevice(false); return }
    setDevices((d) => [...d, data as PosDevice])
    setNewDevice((d) => ({ device_id: '', premise_id: d.premise_id }))
    setAddingDevice(false)
  }

  async function togglePremise(id: string, active: boolean) {
    await supabase.from('pos_premises').update({ is_active: !active }).eq('id', id)
    setPremises((p) => p.map((pr) => pr.id === id ? { ...pr, is_active: !active } : pr))
  }

  const premiseOptions = premises.map((p) => ({ value: p.id, label: `${p.premise_id} - ${p.address ?? ''}` }))

  return (
    <div className="space-y-6">
      {/* Premises list */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Poslovni prostori</h3>
        {premises.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Ni dodanih poslovnih prostorov</p>
        ) : (
          <div className="space-y-2">
            {premises.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.premise_id}</p>
                  <p className="text-xs text-gray-500">{[p.address, p.city, p.postal_code].filter(Boolean).join(', ')}</p>
                  <p className="text-xs text-gray-400">{p.premise_type === 'movable' ? 'Mobilna blagajna' : 'Fiksni prostor'}</p>
                </div>
                <button
                  onClick={() => togglePremise(p.id, p.is_active)}
                  className={`text-xs px-3 py-1 rounded-full border ${p.is_active ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                >
                  {p.is_active ? 'Aktiven' : 'Neaktiven'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add premise */}
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Dodaj poslovni prostor</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Oznaka (npr. PS1)"
              value={newPremise.premise_id}
              onChange={(e) => setNewPremise((p) => ({ ...p, premise_id: e.target.value.toUpperCase() }))}
              placeholder="PS1"
            />
            <Select
              label="Tip"
              options={[{ value: 'premises', label: 'Fiksni prostor' }, { value: 'movable', label: 'Mobilna blagajna' }]}
              value={newPremise.premise_type}
              onChange={(e) => setNewPremise((p) => ({ ...p, premise_type: e.target.value }))}
            />
          </div>
          <Input
            label="Naslov"
            value={newPremise.address}
            onChange={(e) => setNewPremise((p) => ({ ...p, address: e.target.value }))}
            placeholder="Ulica 1"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mesto" value={newPremise.city} onChange={(e) => setNewPremise((p) => ({ ...p, city: e.target.value }))} placeholder="Ljubljana" />
            <Input label="Poštna" value={newPremise.postal_code} onChange={(e) => setNewPremise((p) => ({ ...p, postal_code: e.target.value }))} placeholder="1000" />
          </div>
          <Button onClick={savePremise} loading={addingPremise} size="sm">Dodaj prostor</Button>
        </div>
      </section>

      {/* Devices */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Elektronske naprave</h3>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Ni dodanih naprav</p>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{d.device_id}</p>
                  <p className="text-xs text-gray-500">Prostor: {premises.find((p) => p.id === d.premise_id)?.premise_id ?? '—'}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border ${d.is_active ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {d.is_active ? 'Aktiven' : 'Neaktiven'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Dodaj napravo</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Oznaka naprave (npr. EN1)"
              value={newDevice.device_id}
              onChange={(e) => setNewDevice((d) => ({ ...d, device_id: e.target.value.toUpperCase() }))}
              placeholder="EN1"
            />
            <Select
              label="Poslovni prostor"
              options={premiseOptions.length ? premiseOptions : [{ value: '', label: 'Najprej dodajte prostor' }]}
              value={newDevice.premise_id}
              onChange={(e) => setNewDevice((d) => ({ ...d, premise_id: e.target.value }))}
            />
          </div>
          <Button onClick={saveDevice} loading={addingDevice} size="sm" disabled={!premiseOptions.length}>
            Dodaj napravo
          </Button>
        </div>
      </section>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
      )}
    </div>
  )
}
