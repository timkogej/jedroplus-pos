'use client'
import { useState, useRef } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface CertificateInfo {
  tax_number: string
  valid_from: string
  valid_to: string
}

interface Props {
  companyId: string
  existingCert?: CertificateInfo | null
}

export default function CertificateUpload({ companyId, existingCert }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<CertificateInfo | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const certInfo = success ?? existingCert
  const isExpiringSoon = certInfo?.valid_to
    ? (new Date(certInfo.valid_to).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000
    : false

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.endsWith('.p12') || dropped?.name.endsWith('.pfx')) {
      setFile(dropped)
    } else {
      setError('Prosimo naložite .p12 ali .pfx datoteko')
    }
  }

  async function handleUpload() {
    if (!file || !password) {
      setError('Izberite datoteko in vnesite geslo')
      return
    }
    setError('')
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('password', password)
      formData.append('company_id', companyId)

      const res = await fetch('/api/certificates/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Napaka pri nalaganju')
      setSuccess(data)
      setFile(null)
      setPassword('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Napaka')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Existing cert info */}
      {certInfo && (
        <div className={`p-4 rounded-xl border ${isExpiringSoon ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-start gap-3">
            <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isExpiringSoon ? 'text-amber-600' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className={`text-sm font-semibold ${isExpiringSoon ? 'text-amber-700' : 'text-green-700'}`}>
                {isExpiringSoon ? 'Certifikat kmalu poteče' : 'Certifikat aktiven'}
              </p>
              {certInfo.tax_number && (
                <p className="text-xs text-gray-600 mt-1">Davčna: {certInfo.tax_number}</p>
              )}
              {certInfo.valid_from && (
                <p className="text-xs text-gray-500">
                  Veljavnost: {new Date(certInfo.valid_from).toLocaleDateString('sl-SI')} –{' '}
                  {certInfo.valid_to ? new Date(certInfo.valid_to).toLocaleDateString('sl-SI') : '—'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${isDragging ? 'border-[#6D5EF7] bg-[#6D5EF7]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
        `}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".p12,.pfx"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {file ? (
          <p className="text-sm font-medium text-gray-900">{file.name}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">Povlecite .p12 datoteko sem</p>
            <p className="text-xs text-gray-400 mt-1">ali kliknite za izbiro</p>
          </>
        )}
      </div>

      <Input
        label="Geslo certifikata"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Geslo vašega .p12 certifikata"
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <Button
        onClick={handleUpload}
        loading={uploading}
        disabled={!file || !password}
        className="w-full"
      >
        Naloži certifikat
      </Button>

      <p className="text-xs text-gray-400 text-center">
        Certifikat je šifriran z AES-256 pred shranjevanjem. Geslo ni dostopno javno.
      </p>
    </div>
  )
}
