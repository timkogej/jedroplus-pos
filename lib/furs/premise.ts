import type { FursCadastralData, FursPremiseAddress } from './xml'

export interface PremiseRow {
  premise_type: string | null
  address: string | null
  house_number: string | null
  house_number_additional: string | null
  city: string | null
  postal_code: string | null
  cadastral_number: string | null
  building_number: string | null
  building_section_number: string | null
}

export type PremiseSubmission =
  | { ok: true; address?: FursPremiseAddress; cadastralData?: FursCadastralData }
  | { ok: false; error: string }

/**
 * Turns a stored premise into what FURS needs in a BusinessPremiseRequest — used
 * both to register a premise and to close it (the closure message repeats the
 * premise data). In production the real cadastral data is mandatory: without it
 * the XML builder falls back to 1/1/1, which would put false data on record.
 */
export function buildPremiseSubmission(
  premise: PremiseRow,
  environment: 'test' | 'production'
): PremiseSubmission {
  if (premise.premise_type === 'movable') return { ok: true }

  let street = premise.address ?? ''
  let houseNumber = premise.house_number ?? ''
  let houseNumberAdditional = premise.house_number_additional ?? undefined

  // Legacy rows store the whole address in one string ("Prešernova cesta 21A")
  if (!houseNumber) {
    const match = street.match(/^(.+?)\s+(\d+)([A-Za-z]?)\s*$/)
    if (match) {
      street = match[1]
      houseNumber = match[2]
      houseNumberAdditional = match[3] || undefined
    }
  }

  if (!street || !houseNumber || !premise.city || !premise.postal_code) {
    return {
      ok: false,
      error: 'Za FURS prostor potrebuje ulico, hišno številko, mesto in poštno številko',
    }
  }

  const address: FursPremiseAddress = {
    street,
    houseNumber,
    houseNumberAdditional,
    community: premise.city, // naselje ni ločeno shranjeno — FURS zahteva vrednost
    city: premise.city,
    postalCode: premise.postal_code,
  }

  if (premise.cadastral_number && premise.building_number && premise.building_section_number) {
    return {
      ok: true,
      address,
      cadastralData: {
        cadastralNumber: premise.cadastral_number,
        buildingNumber: premise.building_number,
        buildingSectionNumber: premise.building_section_number,
      },
    }
  }

  if (environment === 'production') {
    return {
      ok: false,
      error: 'V produkciji vnesite katastrsko občino, številko stavbe in del stavbe (e-prostor.gov.si).',
    }
  }
  return { ok: true, address }
}
