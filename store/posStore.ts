import { create } from 'zustand'
import type { Company, PosSettings, PosInvoice, PosPremise, PosDevice, InvoiceFormData } from '@/types'

interface CompanyIdentity {
  companyId: string
  externalCompanyId: string | null  // "ID Podjetja" used by Termini/Stranke
  companyName: string
  companySlug: string
}

interface PosStore {
  company: Company | null
  settings: PosSettings | null
  currentInvoice: Partial<InvoiceFormData> | null
  premises: PosPremise[]
  devices: PosDevice[]
  fursStatus: 'online' | 'offline' | 'unknown'

  // Resolved identity after login
  companyId: string | null
  externalCompanyId: string | null
  companyName: string | null
  companySlug: string | null

  setCompany: (company: Company) => void
  setSettings: (settings: PosSettings) => void
  setCurrentInvoice: (invoice: Partial<InvoiceFormData>) => void
  updateCurrentInvoice: (partial: Partial<InvoiceFormData>) => void
  clearCurrentInvoice: () => void
  setPremises: (premises: PosPremise[]) => void
  setDevices: (devices: PosDevice[]) => void
  setFursStatus: (status: 'online' | 'offline' | 'unknown') => void
  setCompanyData: (data: CompanyIdentity) => void
  clearCompanyData: () => void
}

export const usePosStore = create<PosStore>((set) => ({
  company: null,
  settings: null,
  currentInvoice: null,
  premises: [],
  devices: [],
  fursStatus: 'unknown',

  companyId: null,
  externalCompanyId: null,
  companyName: null,
  companySlug: null,

  setCompany: (company) => set({ company }),
  setSettings: (settings) => set({ settings }),
  setCurrentInvoice: (invoice) => set({ currentInvoice: invoice }),
  updateCurrentInvoice: (partial) =>
    set((state) => ({
      currentInvoice: state.currentInvoice ? { ...state.currentInvoice, ...partial } : partial,
    })),
  clearCurrentInvoice: () => set({ currentInvoice: null }),
  setPremises: (premises) => set({ premises }),
  setDevices: (devices) => set({ devices }),
  setFursStatus: (fursStatus) => set({ fursStatus }),
  setCompanyData: ({ companyId, externalCompanyId, companyName, companySlug }) =>
    set({ companyId, externalCompanyId, companyName, companySlug }),
  clearCompanyData: () =>
    set({ companyId: null, externalCompanyId: null, companyName: null, companySlug: null }),
}))
