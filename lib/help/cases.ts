/** Common situations with a short how-to. Based on docs/RUNBOOK.md. */
export interface HelpCase {
  id: string
  title: string
  steps: string[]
  note?: string
}

export const HELP_CASES: HelpCase[] = [
  {
    id: 'napaka-na-racunu',
    title: 'Naredil sem napako na računu',
    steps: [
      'Računa ni mogoče spremeniti ali izbrisati. Popravite ga s stornom.',
      'Odprite račun in pritisnite Storniraj račun. Blagajna izda nasprotni račun (storno) in ga potrdi pri FURS.',
      'Nato izdajte nov, pravilen račun.',
    ],
    note: 'Storno ni mogoč, če je današnji dan že zaključen (Z-poročilo). Storno vrne tudi porabljene zvestobne točke.',
  },
  {
    id: 'caka-potrditev-furs',
    title: 'Račun ima oznako "Čaka potrditev FURS"',
    steps: [
      'FURS včasih za trenutek ni dosegljiv. Račun je izdan in blagajna ga potrdi pozneje, samodejno.',
      'Ko FURS odgovori, se oznaka spremeni v Potrjeno pri FURS.',
      'Če račun ostane nepotrjen več kot 72 ur, se na pregledu pokaže rdeče opozorilo. Takrat preverite certifikat in nam pišite.',
    ],
  },
  {
    id: 'zakljucek-dneva',
    title: 'Kako zaključim dan',
    steps: [
      'Odprite Z-poročilo.',
      'Preglejte promet za izbrani dan in pritisnite Zaključi dan.',
      'Če ste pozabili zaključiti prejšnji dan, ga izberete na vrhu strani pod "Nezaključeni dnevi".',
    ],
    note: 'Zaključen dan je zaklenjen: za ta datum ni mogoče izdati računa ali storna. Dneva v prihodnosti ni mogoče zaključiti.',
  },
  {
    id: 'nakazilo',
    title: 'Stranka plača z nakazilom',
    steps: [
      'Pri plačilu izberite Bančno nakazilo.',
      'Takšen račun se ne pošlje FURS in ima številko z oznako N.',
      'Plačilo s kartico šteje kot gotovinsko in se potrdi pri FURS.',
    ],
  },
  {
    id: 'potek-certifikata',
    title: 'Certifikat poteče',
    steps: [
      'Opozorilo dobite na pregledu in po e-pošti 30, 14, 7, 3, 2, 1 in 0 dni pred potekom.',
      'Novo potrdilo naročite pri FURS (eDavki).',
      'V Nastavitve → Certifikat naložite novo datoteko .p12 z geslom. Staro se zamenja.',
    ],
    note: 'Dokler je potrdilo poteklo, gotovinskih in kartičnih računov ni mogoče izdati.',
  },
  {
    id: 'stripe-vracilo',
    title: 'Stranka je dobila vračilo plačila prek Stripe',
    steps: [
      'Vračilo v Stripe samo vrne denar. Račun morate stornirati sami.',
      'Na pregledu se pokaže opozorilo z gumbom Odpri račun. Pritisnite Storniraj račun.',
    ],
  },
]
