'use client'
import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

// ─── Format definitions ──────────────────────────────────────────────────────

type FormatId =
  | 'PREFIX-LETO4-STEVILKA'
  | 'PREFIX-LETO2-STEVILKA'
  | 'LETO4-PREFIX-STEVILKA'
  | 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA'
  | 'PREFIX-STEVILKA-LETO4'
  | 'STEVILKA-SLASH-LETO4'
  | 'PREFIX-STEVILKA'

interface FormatDef {
  id: FormatId
  label: string
  hasYear: boolean
  hasPremise: boolean
  fixedSeparator?: string // if set, overrides the separator field
}

const FORMAT_DEFS: FormatDef[] = [
  { id: 'PREFIX-LETO4-STEVILKA',                 label: 'PREFIX-LETO-ŠTEVILKA',                    hasYear: true,  hasPremise: false },
  { id: 'PREFIX-LETO2-STEVILKA',                 label: 'PREFIX-LETO(2)-ŠTEVILKA',                 hasYear: true,  hasPremise: false },
  { id: 'LETO4-PREFIX-STEVILKA',                 label: 'LETO-PREFIX-ŠTEVILKA',                    hasYear: true,  hasPremise: false },
  { id: 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA', label: 'PREFIX-LETO-PROSTOR-NAPRAVA-ŠTEVILKA',    hasYear: true,  hasPremise: true  },
  { id: 'PREFIX-STEVILKA-LETO4',                 label: 'PREFIX-ŠTEVILKA-LETO',                    hasYear: true,  hasPremise: false },
  { id: 'STEVILKA-SLASH-LETO4',                  label: 'ŠTEVILKA/LETO',                           hasYear: true,  hasPremise: false, fixedSeparator: '/' },
  { id: 'PREFIX-STEVILKA',                       label: 'PREFIX + ŠTEVILKA (brez ločil)',           hasYear: false, hasPremise: false, fixedSeparator: ''  },
]

// ─── Build invoice number preview ────────────────────────────────────────────

function buildPreview(
  format: FormatId,
  prefix: string,
  sep: string,
  numLen: number,
  yearFmt: 'full' | 'short',
  premiseEx = 'PS1',
  deviceEx = 'EN1',
  counter = 1,
): string {
  const year = new Date().getFullYear()
  const y4 = String(year)
  const y2 = String(year).slice(-2)
  const yr = yearFmt === 'short' ? y2 : y4
  const n = String(counter).padStart(numLen, '0')
  const p = prefix || 'R'

  switch (format) {
    case 'PREFIX-LETO4-STEVILKA':
    case 'PREFIX-LETO2-STEVILKA':
      return `${p}${sep}${yr}${sep}${n}`
    case 'LETO4-PREFIX-STEVILKA':
      return `${yr}${sep}${p}${sep}${n}`
    case 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA':
      return `${p}${sep}${yr}${sep}${premiseEx}${sep}${deviceEx}${sep}${n}`
    case 'PREFIX-STEVILKA-LETO4':
      return `${p}${sep}${n}${sep}${yr}`
    case 'STEVILKA-SLASH-LETO4':
      return `${n}/${yr}`
    case 'PREFIX-STEVILKA':
      return `${p}${n}`
    default:
      return `${p}${sep}${yr}${sep}${n}`
  }
}

// ─── Format selector card ────────────────────────────────────────────────────

function FormatCard({
  def,
  selected,
  preview,
  onClick,
}: {
  def: FormatDef
  selected: boolean
  preview: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 ${
        selected
          ? 'border-[#6D5EF7]/40 bg-[#6D5EF7]/5 ring-1 ring-[#6D5EF7]/20'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{def.label}</p>
        <p className="text-sm font-mono font-semibold text-gray-900 mt-0.5 truncate">{preview}</p>
      </div>
      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
        selected ? 'border-[#6D5EF7] bg-[#6D5EF7]' : 'border-gray-300'
      }`}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
    </button>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

interface Settings {
  id: string
  invoice_prefix: string
  invoice_counter: number
  invoice_format: string
  invoice_separator: string
  invoice_number_length: number
  invoice_year_format: string
  invoice_year_reset: boolean
}

export default function InvoiceSettingsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [settingsId, setSettingsId] = useState('')
  const [prefix, setPrefix]         = useState('R')
  const [counter, setCounter]       = useState(1)
  const [format, setFormat]         = useState<FormatId>('PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA')
  const [separator, setSeparator]   = useState('-')
  const [numLen, setNumLen]         = useState(5)
  const [yearFmt, setYearFmt]       = useState<'full' | 'short'>('full')
  const [yearReset, setYearReset]   = useState(true)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  // ── Load settings ──────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: company } = await supabase.from('companies').select('id').eq('slug', slug).single()
      if (!company) return

      const { data: s } = await supabase
        .from('pos_settings')
        .select('id, invoice_prefix, invoice_counter, invoice_format, invoice_separator, invoice_number_length, invoice_year_format, invoice_year_reset')
        .eq('company_id', company.id)
        .maybeSingle() as { data: Settings | null }

      if (s) {
        setSettingsId(s.id)
        setPrefix(s.invoice_prefix ?? 'R')
        setCounter(s.invoice_counter ?? 1)
        setFormat((s.invoice_format as FormatId) ?? 'PREFIX-LETO4-PROSTOR-NAPRAVA-STEVILKA')
        setSeparator(s.invoice_separator ?? '-')
        setNumLen(s.invoice_number_length ?? 5)
        setYearFmt((s.invoice_year_format as 'full' | 'short') ?? 'full')
        setYearReset(s.invoice_year_reset ?? true)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  // ── Effective separator (respects fixedSeparator) ──────────
  const effectiveSep = useMemo(() => {
    const def = FORMAT_DEFS.find((d) => d.id === format)
    return def?.fixedSeparator !== undefined ? def.fixedSeparator : separator
  }, [format, separator])

  const currentDef = FORMAT_DEFS.find((d) => d.id === format)

  // ── Live preview ───────────────────────────────────────────
  const preview = buildPreview(format, prefix, effectiveSep, numLen, yearFmt, 'PS1', 'EN1', counter)

  // ── Save ───────────────────────────────────────────────────
  async function save() {
    if (!settingsId) return
    setSaving(true)
    setError('')

    const { error: err } = await supabase
      .from('pos_settings')
      .update({
        invoice_prefix:        prefix,
        invoice_counter:       counter,
        invoice_format:        format,
        invoice_separator:     effectiveSep,
        invoice_number_length: numLen,
        invoice_year_format:   yearFmt,
        invoice_year_reset:    yearReset,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settingsId)

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header slug={slug} title="Nastavitve računov" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#6D5EF7] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header slug={slug} title="Nastavitve računov" />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <p className="text-sm text-gray-500 mb-6">Izberite obliko številke računa in konfigurirajte njene sestavne dele.</p>

        {/* ── STEP 1: Format selector ───────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            1 · Oblika številke računa
          </h3>
          <div className="space-y-2">
            {FORMAT_DEFS.map((def) => (
              <FormatCard
                key={def.id}
                def={def}
                selected={format === def.id}
                preview={buildPreview(def.id, prefix, def.fixedSeparator !== undefined ? def.fixedSeparator : separator, numLen, yearFmt)}
                onClick={() => setFormat(def.id)}
              />
            ))}
          </div>
        </div>

        {/* ── STEP 2: Configuration fields ─────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            2 · Nastavitve
          </h3>

          {/* Always-visible fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Predpona (prefix)"
              value={prefix}
              maxLength={5}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="R"
            />
            <Input
              label="Začetna / trenutna številka"
              type="number"
              min="1"
              value={counter}
              onChange={(e) => setCounter(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Dolžina številke (ničle)"
              value={String(numLen)}
              onChange={(e) => setNumLen(parseInt(e.target.value))}
              options={[
                { value: '3', label: '3 mesta  — 001' },
                { value: '4', label: '4 mesta  — 0001' },
                { value: '5', label: '5 mest   — 00001' },
                { value: '6', label: '6 mest   — 000001' },
              ]}
            />

            {currentDef?.fixedSeparator !== undefined ? (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Ločilo</label>
                <div className="px-3.5 py-2.5 rounded-lg border border-gray-100 bg-gray-50 text-sm text-gray-400">
                  {currentDef.fixedSeparator === '' ? 'brez ločila (fiksno za ta format)' : `"${currentDef.fixedSeparator}" (fiksno za ta format)`}
                </div>
              </div>
            ) : (
              <Select
                label="Ločilo"
                value={separator}
                onChange={(e) => setSeparator(e.target.value)}
                options={[
                  { value: '-', label: 'vezaj  —' },
                  { value: '/', label: 'poševnica  /' },
                  { value: '.', label: 'pika  .' },
                  { value: '_', label: 'podčrtaj  _' },
                  { value: ' ', label: 'presledek' },
                ]}
              />
            )}
          </div>

          {/* Year-related fields */}
          {currentDef?.hasYear && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Oblika leta"
                value={yearFmt}
                onChange={(e) => setYearFmt(e.target.value as 'full' | 'short')}
                options={[
                  { value: 'full',  label: `Polno — ${new Date().getFullYear()}` },
                  { value: 'short', label: `Kratko — ${String(new Date().getFullYear()).slice(-2)}` },
                ]}
              />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Ponastavitev ob menjavi leta</label>
                <button
                  type="button"
                  onClick={() => setYearReset((v) => !v)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm transition-all duration-150 ${
                    yearReset
                      ? 'border-[#6D5EF7]/30 bg-[#6D5EF7]/5 text-[#6D5EF7]'
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  <div className={`w-8 h-4.5 rounded-full transition-colors relative flex-shrink-0 ${yearReset ? 'bg-[#6D5EF7]' : 'bg-gray-200'}`}
                    style={{ height: '18px' }}
                  >
                    <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${yearReset ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  {yearReset ? 'Vklopljeno' : 'Izklopljeno'}
                </button>
              </div>
            </div>
          )}

          {/* Premise/device note */}
          {currentDef?.hasPremise && (
            <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl">
              <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-gray-500">
                Koda poslovnega prostora in naprave se samodejno vzame iz aktivnega poslovnega prostora pri izstavitvi računa.
              </p>
            </div>
          )}
        </div>

        {/* ── STEP 3: Live preview ──────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            3 · Predogled
          </h3>
          <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between gap-4">
            <p className="text-xl font-mono font-semibold text-gray-900 tracking-tight">{preview}</p>
            <p className="text-xs text-gray-400 text-right hidden sm:block">
              naslednji račun
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Oblika: {FORMAT_DEFS.find((d) => d.id === format)?.label}
          </p>
        </div>

        {/* ── Error + Save ──────────────────────────────────── */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">{error}</div>
        )}

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
