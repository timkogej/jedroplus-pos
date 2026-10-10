'use client'
import { createContext, useContext } from 'react'

export interface CompanyInfo {
  id: string
  /** companies.company_id — the short code used by Termini / Stranke. */
  company_id: string | null
  /** URL slug of the company (/[slug]/…). Optional so older callers keep working. */
  slug?: string
  /** companies.name */
  name: string
  /** Display name from "Podatki podjetij" (falls back to name). */
  displayName: string
}

const CompanyContext = createContext<CompanyInfo | null>(null)

export const CompanyProvider = CompanyContext.Provider

/**
 * The company of the current /[slug] page, handed down by the server layout
 * (which has already verified the user belongs to it). Client pages use this
 * instead of asking the database "which company is this slug?" on every load.
 */
export function useCompany(): CompanyInfo {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used inside the /[slug] layout')
  return ctx
}

/** Like useCompany(), but returns null outside the /[slug] layout (e.g. on public pages). */
export function useOptionalCompany(): CompanyInfo | null {
  return useContext(CompanyContext)
}
