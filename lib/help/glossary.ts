/** Plain-language explanations of the terms users meet in the cash register. */
export type GlossaryKey =
  | 'furs'
  | 'zoi'
  | 'eor'
  | 'certificate'
  | 'premise'
  | 'device'
  | 'cadastral'
  | 'storno'
  | 'zReport'
  | 'testMode'
  | 'vat'
  | 'taxNumber'
  | 'points'
  | 'stripe'
  | 'subscription'
  | 'transfer'

export interface GlossaryEntry {
  term: string
  /** One or two short sentences — shown in the "?" popover. */
  short: string
  /** Optional extra detail on the Pomoč page. */
  more?: string
}

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  furs: {
    term: 'FURS',
    short: 'Davčna uprava Slovenije. Vaši računi se ji pošljejo, da jih potrdi.',
    more: 'FURS je Finančna uprava Republike Slovenije. Vsak gotovinski račun mora dobiti njeno potrditev. Blagajna to naredi sama v nekaj sekundah.',
  },
  zoi: {
    term: 'ZOI',
    short: 'Vaš podpis računa. Naredi ga blagajna z vašim potrdilom.',
    more: 'Zaščitna oznaka izdajatelja. Dokazuje, da je račun izdalo vaše podjetje. Natisnjena je na računu.',
  },
  eor: {
    term: 'EOR',
    short: 'Potrditev davčne uprave, da je račun prejela. Če je ni, FURS računa še ni potrdil.',
    more: 'Enkratna identifikacijska oznaka računa. Če FURS začasno ni dosegljiv, blagajna račun izda z ZOI in EOR poišče pozneje, samodejno.',
  },
  certificate: {
    term: 'Certifikat (digitalno potrdilo)',
    short: 'Datoteka (.p12), s katero blagajna podpiše vaše račune. Izda jo FURS prek eDavkov.',
    more: 'Datoteko in geslo naložite enkrat v Nastavitve → Certifikat. Potrdilo ima rok veljavnosti. Opozorimo vas 30 dni pred potekom.',
  },
  premise: {
    term: 'Poslovni prostor',
    short: 'Kraj, kjer izdajate račune (lokal, salon, mobilna prodaja).',
    more: 'Vsak prostor se registrira pri FURS. Oznaka je kratka (npr. PS1). Mobilna blagajna nima naslova.',
  },
  device: {
    term: 'Elektronska naprava',
    short: 'Vaša blagajna v prostoru. Običajno ena (EN1).',
    more: 'Oznaka naprave je del številke računa. Dodatno napravo potrebujete samo, če imate več blagajn hkrati.',
  },
  cadastral: {
    term: 'Katastrski podatki',
    short: 'Podatki o stavbi, ki jih zahteva FURS. Poiščite jih na e-prostor.gov.si.',
    more: 'Katastrska občina, številka stavbe in del stavbe. Za pravo delovanje so obvezni.',
  },
  storno: {
    term: 'Storno',
    short: 'Pravilen način popravka računa. Izda se nasprotni račun, original ostane.',
    more: 'Izdanega računa ni mogoče spreminjati ali brisati. Storno ga razveljavi z negativnimi zneski, nato izdate nov, pravilen račun.',
  },
  zReport: {
    term: 'Z-poročilo',
    short: 'Dnevni zaključek: povzetek dneva (koliko ste izdali in kako so plačali).',
    more: 'Naredite ga ob koncu dela. Zaključen dan je zaklenjen: za ta datum ni mogoče izdati računa ali storna. Shrani se kot PDF.',
  },
  testMode: {
    term: 'Testni način',
    short: 'Računi so poskusni. Davčna uprava jih ne prejme.',
    more: 'Dokler nimate potrdila in vklopljenega pravega delovanja, so računi označeni TESTNI. Ne dajajte jih strankam kot prave.',
  },
  vat: {
    term: 'DDV',
    short: 'Cene vnašate z DDV. Blagajna izračuna, koliko je DDV.',
    more: 'Večina storitev je 22 %, nekatere 9,5 %. Če niste zavezanec za DDV, ga izklopite v Nastavitve → Nastavitve računov.',
  },
  taxNumber: {
    term: 'Davčna številka',
    short: 'Osem števil. Ne vpisujte SI pred številko; to je ID za DDV.',
    more: 'ID za DDV ima SI in osem števil. Če niste zavezanec za DDV, ga pustite praznega.',
  },
  points: {
    term: 'Zvestobne točke',
    short: 'Stranka za vsak evro dobi točke in jih unovči kot popust.',
    more: 'Pravila nastavite sami (npr. 1 točka za 1 €, 100 točk = 5 €). Točke so vezane na e-pošto stranke.',
  },
  stripe: {
    term: 'Spletna plačila (Stripe)',
    short: 'Stranke plačajo s kartico prek spleta. Denar gre na vaš račun.',
    more: 'Račun Stripe povežete enkrat. Za vsako plačilo se samodejno izda račun.',
  },
  subscription: {
    term: 'Naročnina',
    short: 'Paket Plus ali Pro. Po preklicu imate dostop do konca plačanega obdobja.',
  },
  transfer: {
    term: 'Račun z nakazilom',
    short: 'Računi, plačani z nakazilom, se ne pošiljajo FURS in imajo številko z oznako N.',
    more: 'Plačilo s kartico šteje kot gotovinsko in se potrdi pri FURS.',
  },
}
