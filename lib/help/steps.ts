import type { GuideStepId } from '@/lib/guide/steps'

/** Slovenian copy for each step of the setup guide. One place, so wording stays consistent. */
export interface StepCopy {
  title: string
  /** One sentence: why this step exists. */
  why: string
  /** Short numbered instructions. */
  how: string[]
  /** How long it takes / what to expect. */
  time: string
  /** Label of the main button. */
  cta: string
  /** Page the button opens, relative to /[slug]/. */
  href: string
  /** Explanation shown under a locked step: "Najprej: …". */
  after?: string
}

export const STEP_COPY: Record<GuideStepId, StepCopy> = {
  company: {
    title: 'Podatki podjetja',
    why: 'Izpišejo se na vsakem računu.',
    how: [
      'Odprite Nastavitve → Podatki podjetja.',
      'Vpišite naziv, naslov, davčno številko in e-pošto.',
      'Pritisnite Shrani.',
    ],
    time: 'Približno 2 minuti',
    cta: 'Uredi podatke',
    href: 'settings/company',
  },
  vat: {
    title: 'DDV',
    why: 'Povejte, ali ste zavezanec za DDV. Od tega je odvisen izpis na računu.',
    how: [
      'Če ste zavezanec za DDV, računi prikažejo DDV.',
      'Če niste, DDV ni obračunan in na računu je izpisan sklic na 94. člen ZDDV-1.',
      'Odgovor lahko kadarkoli spremenite v Nastavitve → Nastavitve računov.',
    ],
    time: 'Manj kot minuta',
    cta: 'Določi DDV',
    href: 'settings/invoices',
  },
  premise: {
    title: 'Poslovni prostor in naprava',
    why: 'Vsak račun mora povedati, kje in na kateri blagajni je bil izdan.',
    how: [
      'Odprite Nastavitve → Poslovni prostori.',
      'Dodajte prostor z ulico in hišno številko. Večina podjetij ima en prostor.',
      'Naprava (npr. EN1) je lahko ena. Drugo dodate le, če imate več blagajn hkrati.',
    ],
    time: 'Približno 3 minute',
    cta: 'Uredi prostore',
    href: 'settings/premises',
  },
  testInvoice: {
    title: 'Preizkusni račun',
    why: 'Preizkusite blagajno. Račun bo označen TESTNI in ga davčna uprava ne prejme.',
    how: [
      'Pritisnite Nov račun.',
      'Vpišite poljubno storitev in ceno.',
      'Potrdite. Račun potem najdete v seznamu Računi.',
    ],
    time: 'Približno 1 minuta · brez posledic',
    cta: 'Izdaj preizkusni račun',
    href: 'invoices/new',
    after: 'poslovni prostor in naprava',
  },
  certificate: {
    title: 'Digitalno potrdilo (certifikat)',
    why: 'Z njim blagajna podpiše vaše račune. Brez njega so računi samo preizkusni.',
    how: [
      'Odprite eDavki (edavki.durs.gov.si) in se prijavite z davčno številko podjetja.',
      'Izberite Digitalna potrdila → Zahtevaj certifikat.',
      'Prenesite datoteko .p12 in si zapomnite geslo.',
      'V blagajni odprite Nastavitve → Certifikat in naložite datoteko z geslom.',
    ],
    time: 'Potrdilo izda FURS. Zahtevo vložite čim prej.',
    cta: 'Naloži certifikat',
    href: 'settings/certificate',
  },
  registration: {
    title: 'Registracija prostora pri FURS',
    why: 'FURS mora vaš prostor poznati, preden potrdi prvi pravi račun.',
    how: [
      'Odprite Nastavitve → Poslovni prostori.',
      'Preverite hišno številko. Za pravo delovanje potrebujete še katastrske podatke (poiščite jih na e-prostor.gov.si).',
      'Pri prostoru pritisnite Registriraj pri FURS.',
    ],
    time: 'Približno 5 minut',
    cta: 'Registriraj prostor',
    href: 'settings/premises',
    after: 'digitalno potrdilo',
  },
  activation: {
    title: 'Vklop pravega delovanja',
    why: 'Do vklopa so računi preizkusni. Vklop naredi ekipa Jedro+, ko je vse pripravljeno.',
    how: [
      'Ko sta certifikat in registracija opravljena, pritisnite gumb Zahtevaj vklop.',
      'Ekipa Jedro+ preveri nastavitve in vklopi pravo delovanje.',
    ],
    time: 'To naredi ekipa Jedro+',
    cta: 'Zahtevaj vklop pravega delovanja',
    href: 'guide',
    after: 'registracija prostora',
  },
  realInvoice: {
    title: 'Prvi pravi račun',
    why: 'Prvi račun, ki ga FURS uradno potrdi.',
    how: [
      'Izdajte račun kot običajno.',
      'Na računu mora pisati Potrjeno pri FURS in EOR (potrditev davčne uprave).',
    ],
    time: 'Približno 1 minuta',
    cta: 'Izdaj račun',
    href: 'invoices/new',
    after: 'vklop pravega delovanja',
  },
  zReport: {
    title: 'Zaključite dan',
    why: 'Ob koncu vsakega dne z računi naredite Z-poročilo (dnevni zaključek).',
    how: [
      'Odprite Z-poročilo.',
      'Preglejte promet in pritisnite Zaključi dan.',
      'Zaključen dan je zaklenjen: za ta datum ni mogoče izdati računa ali storna.',
    ],
    time: 'Približno 1 minuta na dan',
    cta: 'Odpri Z-poročilo',
    href: 'z-report',
    after: 'preizkusni račun',
  },
}
