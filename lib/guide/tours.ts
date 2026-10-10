/**
 * The guided tours (spotlight on an element + a short explanation), modelled on
 * the tour in the Jedro+ app. Each step points at an element marked with
 * data-tour="…". Steps whose element isn't visible (e.g. the sidebar on a phone)
 * are skipped automatically.
 */
export type TourId = 'dashboard' | 'appointments'
export type Placement = 'right' | 'bottom' | 'left' | 'top' | 'center'

export interface TourStep {
  key: string
  title: string
  body: string
  /** CSS selector of the element to highlight; omit for a centred intro card. */
  target?: string
  placement?: Placement
  /** A picture shown inside the card. */
  visual?: 'invoicePreview'
}

const nav = (name: string) => `[data-tour="nav-${name}"]`

export const TOURS: Record<TourId, TourStep[]> = {
  dashboard: [
    {
      key: 'welcome',
      title: 'Dobrodošli v Davčni blagajni',
      body: 'V nekaj korakih vam pokažemo, kje je kaj. Ogled lahko kadarkoli ponovite v razdelku Pomoč.',
      placement: 'center',
    },
    {
      key: 'guide',
      target: '[data-tour="guide-card"]',
      title: 'Pot do prvega računa',
      body: 'Tu vidite, kaj je še treba narediti, da boste lahko izdajali prave račune. Vsak korak ima gumb, ki vas pelje na pravo mesto.',
      placement: 'bottom',
    },
    {
      key: 'newInvoice',
      target: '[data-tour="new-invoice"]',
      title: 'Nov račun',
      body: 'Tu izdate račun. Za začetek izdajte preizkusni račun: označen je TESTNI in ga davčna uprava ne prejme.',
      placement: 'right',
    },
    {
      key: 'appointments',
      target: nav('appointments'),
      title: 'Termini',
      body: 'Dokončani termini iz aplikacije Jedro+ čakajo tukaj. Z enim klikom jih spremenite v račun.',
      placement: 'right',
    },
    {
      key: 'customers',
      target: nav('customers'),
      title: 'Stranke',
      body: 'Seznam strank in njihove zvestobne točke.',
      placement: 'right',
    },
    {
      key: 'invoices',
      target: nav('invoices'),
      title: 'Računi',
      body: 'Vsi izdani računi. Tu račun tudi natisnete, pošljete ali stornirate (popravite).',
      placement: 'right',
    },
    {
      key: 'zReport',
      target: nav('z-report'),
      title: 'Z-poročilo',
      body: 'Ob koncu dneva tu zaključite blagajno. To je dnevni zaključek, ki ga morate narediti vsak dan z računi.',
      placement: 'right',
    },
    {
      key: 'settings',
      target: nav('settings'),
      title: 'Nastavitve',
      body: 'Podatki podjetja, certifikat, poslovni prostori, tiskanje in naročnina.',
      placement: 'right',
    },
    {
      key: 'status',
      target: '[data-tour="status"]',
      title: 'Stanje blagajne',
      body: 'Tu vidite, ali blagajna dela preizkusno ali zares. Klik vam pove več.',
      placement: 'bottom',
    },
    {
      key: 'more',
      target: nav('more'),
      title: 'Več',
      body: 'Stranke, Z-poročilo, Nastavitve, Vodič in Pomoč najdete pod Več.',
      placement: 'top',
    },
    {
      key: 'help',
      target: nav('help'),
      title: 'Pomoč',
      body: 'Razlage pojmov, navodila za pogoste primere in naš e-poštni naslov. Tu lahko ogled ponovite.',
      placement: 'right',
    },
  ],
  appointments: [
    {
      key: 'intro',
      title: 'Račun iz termina',
      body: 'Ko v aplikaciji Jedro+ termin označite kot dokončan, se pojavi tukaj. Račun zanj izdate z dvema klikoma.',
      placement: 'center',
    },
    {
      key: 'card',
      target: '[data-tour="appt-card"]',
      title: 'Kartica termina',
      body: 'Vsak dokončan termin je ena kartica: stranka, storitev, datum in cena. Če je bil dodeljen popust, vidite tudi prvotno ceno.',
      placement: 'bottom',
    },
    {
      key: 'issue',
      target: '[data-tour="appt-issue"]',
      title: 'Pritisnite Izstavi',
      body: 'Gumb Izstavi odpre račun, v katerem so stranka, storitev in cena že vpisani.',
      placement: 'left',
    },
    {
      key: 'result',
      title: 'Tako izgleda račun',
      body: 'Preverite podatke in pritisnite Potrdi in izstavi račun. Potem ga lahko natisnete ali pošljete stranki po e-pošti.',
      placement: 'center',
      visual: 'invoicePreview',
    },
  ],
}
