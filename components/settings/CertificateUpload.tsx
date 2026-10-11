'use client'
import { useState, useRef } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { authFetch } from '@/lib/authFetch'
import { friendlyError } from '@/lib/errors'
import Alert from '@/components/ui/Alert'

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
  const [connectionTest, setConnectionTest] = useState<'idle' | 'testing' | 'ok' | 'failed'>('idle')

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

      const res = await authFetch('/api/certificates/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Napaka pri nalaganju')
      setSuccess(data)
      setFile(null)
      setPassword('')

      // Immediately test the FURS connection with the new certificate
      setConnectionTest('testing')
      try {
        const statusRes = await authFetch(`/api/furs/status?company_id=${companyId}&fresh=1`)
        const statusData = await statusRes.json()
        setConnectionTest(statusRes.ok && statusData.status === 'connected' ? 'ok' : 'failed')
      } catch {
        setConnectionTest('failed')
      }
    } catch (err: unknown) {
      setError(friendlyError(err, 'Napaka'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Existing cert info */}
      {certInfo && (
        <Alert variant={isExpiringSoon ? 'warning' : 'success'} title={isExpiringSoon ? 'Certifikat kmalu poteče' : 'Certifikat je aktiven'}>
          <div className="space-y-0.5">
            {certInfo.tax_number && <p>Davčna številka: {certInfo.tax_number}</p>}
            {certInfo.valid_from && (
              <p>
                Veljavnost: {new Date(certInfo.valid_from).toLocaleDateString('sl-SI')} –{' '}
                {certInfo.valid_to ? new Date(certInfo.valid_to).toLocaleDateString('sl-SI') : '—'}
              </p>
            )}
            {connectionTest !== 'idle' && (
              <p className="font-medium">
                {connectionTest === 'testing' && 'Testiram povezavo s FURS …'}
                {connectionTest === 'ok' && 'Povezava s FURS je uspešna.'}
                {connectionTest === 'failed' && 'Povezava s FURS ni uspela.'}
              </p>
            )}
          </div>
        </Alert>
      )}

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${isDragging ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
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
            <p className="text-xs text-gray-500 mt-1">ali kliknite za izbiro</p>
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
        <Alert variant="error">{error}</Alert>
      )}

      <Button
        onClick={handleUpload}
        loading={uploading}
        disabled={!file || !password}
        className="w-full"
      >
        Naloži certifikat
      </Button>

      <p className="text-xs text-gray-500 text-center">
        Certifikat je šifriran z AES-256 pred shranjevanjem. Geslo ni dostopno javno.
      </p>
    </div>
  )
}
