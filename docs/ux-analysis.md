# Jedro+ POS — analiza izkušnje uporabnika in dizajna

Datum: 2026-10-09 · Projekt: `~/Developer/jedroplus-pos`, veja `fix-duplicate-and-perf`, commit `ff8945b` · Status: **samo analiza, koda ni spremenjena** · Jezik vmesnika: slovenščina

## 0. Kaj je pregledano in kaj ne

**Prebrano v tem projektu:** `README.md`, `docs/RUNBOOK.md`, `docs/MIGRATIONS.md`, seznam vseh datotek v `app/`, `components/`, `lib/`. Podrobno: `[slug]/layout`, pregled (`dashboard/page`, `DashboardBody`), Stranke (seznam, podrobnosti, `AdjustPointsForm`), onboarding (korak 2 in `OnboardingShell`), Z-poročilo (`page`, `ZReportClient`), podrobnosti računa, nastavitve računov (DDV), strani certifikata, obrazec prostorov, `components/ui/*`, `Sidebar`, `MobileNav`, `Header`, `FursStatusIndicator`, `MissedClosingBanner`, `AttentionBanner`, `lib/invoice/create-invoice.ts`, `lib/furs/requirement.ts`.

**Samo delno ali samo iskanja (brez branja cele datoteke):** `InvoiceForm`, `onboarding/step1`, `login`, `pricing`, nastavitve tiskanja, plačil, naročnine, Stripe API-ji. Kjer se trditev opira na starejšo kopijo teh datotek, je označeno **(ni ponovno preverjeno)**.

**Ni narejeno:** vizualni pregled (aplikacije nisem zagnal, ocene izhajajo iz Tailwind razredov, kontrasti so izračunani), testi (`npm test`, `typecheck`, `build` niso zagnani, ker koda ni spremenjena), portal za stranke in n8n (nista v repozitoriju).

**Opomba o `DESIGN_HANDOFF.md`** (989 vrstic): je zastarel. Opisuje gradient kot primarni gumb, koda pa ima črn (`Button.tsx`). Opisuje Next 14, projekt je na Next 15.5. Ni vir resnice.

**Opomba:** pomotoma sem prej analiziral staro kopijo v iCloud mapi. Ta dokument v celoti nadomešča tisto analizo. Kopijo v iCloud sem pustil pri miru. V njej je ostal en ločen dokument `docs/ux-analysis.md` iz tiste prve analize (neveljaven). Brišete ga lahko brez posledic.

### Kaj je v tem projektu že dobro rešeno (ne dotikati se)

Stvari iz prve analize, ki v pravem projektu ne obstajajo več kot težava:
- **Zaslon Stranke obstaja** (`customers/page.tsx`, `[email]/page.tsx`): iskanje, strani po 20, točke, zgodovina gibanj, ročni popravek točk, zadnji računi.
- **Dostopnost osnovnih komponent je dobra:** `Modal` ima `role="dialog"`, `aria-modal`, lovljenje fokusa, vrnitev fokusa in `aria-label="Zapri"`. `Input` in `Select` imata `htmlFor`/`id`, `aria-invalid` in `aria-describedby`. Obstaja `ConfirmDialog` (zamenjava za `window.confirm`), uporabljen tudi pri preskoku onboardinga.
- **Hitrost:** `loading.tsx`, `DashboardSkeleton`, `Suspense` okoli statistike, `NavigationProgress`, predpomnjen layout in FURS status.
- **Ne-DDV zavezanec je podprt:** nastavitev "Podjetje je zavezanec za DDV" (`settings/invoices/page.tsx`), obrazec skrije stolpec DDV in izpiše "Skupaj" (`InvoiceForm.tsx:54, 685-709`), pripis po 94. členu ZDDV-1 (`lib/invoice/vat.ts`).
- **Oznaka "Cena brez DDV" v obrazcu je popravljena** na "Vmesna vsota (z DDV)".
- **Opozorila:** `AttentionBanner` ("Zahteva vašo pozornost") za neuspele spletne račune, vračila Stripe in `furs_failed`, opozorilo o poteku certifikata na pregledu, opomniki po e-pošti.
- **Brand barva** je žeton `text-brand` (`tailwind.config.ts`), ne več heksadecimalni literali.
- **Testi** pokrivajo izdajo, storno, webhook, FURS, zneske (`tests/`).

---

## 1. Zaslonska karta in poti

### 1.1 Zasloni

| Zaslon | Datoteka |
|---|---|
| Prijava | `app/login/page.tsx` |
| Paketi | `app/pricing/page.tsx` |
| Onboarding 1 in 2 | `app/[slug]/onboarding/step1`, `step2` + `components/onboarding/OnboardingShell.tsx` |
| Pregled | `dashboard/page.tsx` + `DashboardBody.tsx` + `DashboardSkeleton.tsx` |
| Termini (za izstavitev) | `appointments/page.tsx` |
| Stranke, podrobnosti stranke | `customers/page.tsx`, `customers/[email]/page.tsx` |
| Računi, nov račun, podrobnosti | `invoices/page.tsx`, `invoices/new/page.tsx` + `InvoiceForm.tsx`, `invoices/[id]/page.tsx` |
| Z-poročilo | `z-report/page.tsx` + `ZReportClient.tsx` |
| Nastavitve (8 podstrani) | `settings/{company,invoices,certificate,premises,print,payments,loyalty,subscription}` |
| Trakovi in opozorila | `MissedClosingBanner`, `SubscriptionBanner`, `AttentionBanner`, `FursStatusIndicator`, opozorili certifikata na pregledu |

### 1.2 Poti: koraki, kje se uporabnik izgubi, kaj manjka

**A. Prva prijava in nastavitev**
`/pricing` → Stripe → `dashboard?subscription=success` → preusmeritev na `onboarding/step1` → `step2` → `dashboard?onboarding=complete`.

1. **Onboarding ima 2 koraka, dejanska nastavitev pa najmanj 6.** Po koraku 2 uporabnik vidi "Nastavitev končana! Blagajna je pripravljena." (`OnboardingCompleteToast.tsx`). Manjkajo certifikat, registracija prostora pri FURS in (v produkciji) katastrski podatki.
2. **Korak 2 ne zbere hišne številke.** `step2/page.tsx` vstavi samo oznako, naslov, mesto in pošto. `PremisesForm.tsx:37` pa zahteva hišno številko. `RUNBOOK.md:40` pravi, da so katastrski podatki potrebni v produkciji. Uporabnik te podatke najde šele po napaki pri "Registriraj pri FURS". Hišno številko mora dopolniti na drugem zaslonu, ki ga onboarding ne pozna.
3. **Registracija prostora pri FURS ni del onboardinga.** Mora jo sprožiti sam v Nastavitve → Poslovni prostori. Nihče mu tega ne pove.
4. **Preskok onboardinga** shrani piškotek za eno leto (`onboarding_skipped`) in vodenega poteka nikoli več ne ponudi. Po preskoku izdaja računa lahko pade (npr. manjkajo podatki podjetja), uporabnik pa ne ve zakaj.
5. **Napake so surova sporočila baze** (`step1`: `setError(err.message)`, enako v koraku 2). Pogosto angleško.
6. **"Hitra nastavitev" (`DashboardBody.tsx`, zadnji blok) je čisto na dnu pregleda**, za grafom in računi. Ima 3 vrstice (certifikat, prostor, prvi račun). Prva je certifikat, ki ga nov uporabnik običajno še nima. Ostane vidna tudi ob 100 %. `done` za prostor je samo `premiseCount > 0`: ne preveri registracije pri FURS ali hišne številke. Manjkajo podatki podjetja, registracija prostora in Z-poročilo.
7. **Opozorilo na pregledu "Za produkcijsko delovanje dodajte FURS certifikat"** uporablja izraz, ki ga uporabnik ne pozna. Pove "TESTNI", ne pove, kaj pomeni.

**B. Izdaja računa**
Nov račun → vrsta stranke → stranka → podrobnosti (datum, plačilo, prostor, naprava) → postavke → popust → opomba → točke → seštevek → "Potrdi in izstavi račun" → modal "Dostava računa" → (modal "Oblika tiskanja") → podrobnosti računa.

- **Če prostora ni**, `invoices/new/page.tsx:54-55` tiho preusmeri na nastavitve prostorov brez razlage.
- **Prostor in naprava sta izbirna polja na vsakem računu** (`InvoiceForm.tsx:448-455`), tudi ko obstaja samo eden. Šum za večino uporabnikov.
- **Račun v dnevu, ki je že zaključen:** strežnik ga zavrne z "Blagajna za ta dan je že zaključena (Z-poročilo)…" (`create-invoice.ts`). Zgodnjega opozorila v obrazcu ni: uporabnik izpolni cel račun in šele ob koncu dobi napako.
- **Račun brez FURS:** če je certifikat naložen in FURS ne odgovori, račun dobi `pending_furs`. V vmesniku je to samo značka "Čaka potrditev FURS" brez razlage (RUNBOOK jo ima, uporabnik pa ne).
- **(ni ponovno preverjeno):** gumb "Pošlji po e-pošti" v modalu ob izdaji ne naredi nič, če e-pošte ni.

**C. Račun iz termina**
Termini → "Izstavi" → `invoices/new?appointmentId=…&clientName=…&clientEmail=…`.
- **Osebni podatki v URL-ju** (ime, e-pošta). To je v zgodovini brskalnika in v logih. Strežnik iste podatke že bere sam iz tabele `Stranke` (`invoices/new/page.tsx`), URL bi zadoščal samo z `appointmentId`. **(ni ponovno preverjeno v `AppointmentInvoiceCard`)**
- **Prazno stanje terminov** pove "Ko so termini dokončani, se pojavijo tukaj", ne pove, da se termin dokonča v aplikaciji Jedro+. Uporabnik POS ne ve, kje.
- Besedi "Fakturirano" in "na fakturiranje" (pregled) se razlikujeta od "Račun" drugod.

**D. Storno** (`invoices/[id]/page.tsx`)
- **Gumb "Storniraj račun" se pokaže samo ob `status === 'issued'`** (vrstica 291). Račun v `pending_furs` nima poti za popravek in uporabnik ne ve zakaj.
- **RUNBOOK navaja pravila, ki jih vmesnik ne pove:** storno ni mogoč, če je današnji dan že zaključen; storno vrne porabljene točke in odvzame zasluženo; račun brez FURS (nakazilo) se stornira brez FURS. Modal pove samo "Ustvari se nov storno račun… To dejanje je nepopravljivo." Napake zaradi zaključenega dne uporabnik ne pričakuje.
- Dva podobna napisa: `STORNIRAN` (`storno_original`) in `Storniran` (`cancelled`).
- **Na podrobnostih računa ni gumba "Pošlji po e-pošti"**, čeprav API `invoices/[id]/send-email` obstaja. Pozabljen račun se ne da poslati naknadno.
- **Štirje gumbi** za PDF in tisk: "Prenesi PDF", "Natisni", "Poglej račun", "Natisni račun" (vrstice 270-289). Prvi trije so verjetno trije načini za isti PDF.

**E. Dnevni zaključek (Z-poročilo)**
- **Napaka v poti (potrjena):** `MissedClosingBanner` pravi "Ustvarite Z-poročilo za {včerajšnji datum} →" in vodi na `/z-report`. Ta stran ima trdno `today = localDateString()` (`z-report/page.tsx`) in gumb pošlje `reportDate: today` (`ZReportClient.tsx:59`). **Včerajšnjega dne s te strani ni mogoče zaključiti.** Strežnik (`api/z-report/create/route.ts:24-31`) sprejme poljuben datum v preteklosti in zavrne samo prihodnost. Manjka torej samo izbira datuma na strani. Če pa preteklega dne res ne smemo zaključevati (pravno), mora trak povedati, kaj storiti.
- **Poimenovanje:** "Z poročilo" (meni), "Dnevni zaključek blagajne" (naslov strani), "Zaključi blagajno" (modal), "Zaključi dan" (gumb).
- Razlaga, zakaj je zaključek potreben, ni nikjer. RUNBOOK jo ima ("zaklenjen dan").
- Rdeča pika v meniju ob 18:00 ima samo `title` (na telefonu ne deluje). `MobileNav` je nima.

**F. Stranke in točke**
- Zaslon obstaja in je kakovosten. Manjka mu: razlaga, da se stranke dodajajo v Jedro+ (prazno stanje pove samo "Še ni strank"); stolpec zadnjega obiska; filter "samo s točkami". `Stranke` ima v POS samo ogled in popravek točk.
- Ime programa je "Loyalty" (angl.) v nastavitvah, na pregledu ("🎁 Aktivne loyalty stranke") in na strani stranke ("Loyalty program ni vklopljen"). Na isti strani pa "točk".
- Stranka brez e-pošte ni klikljiva in točke se zanjo ne zbirajo (`customers/page.tsx`: povezava samo ob `email`). Brez razlage.

**G. Nastavitve in naročnina**
- Nastavitve so ploski seznam 8 točk brez stanja (**ni ponovno preverjeno**). Uporabnik ne vidi, kaj je nastavljeno.
- **Okolje FURS (test/produkcija) se v vmesniku ne more spremeniti.** Glej razdelek 8.1.

---

## 2. Analiza dizajna

Resnost: **P0** napačno ali zavajajoče, ali dostopnost, ki blokira. **P1** vidna težava. **P2** poliranje. Obseg: **S** < pol dneva, **M** 0,5–2 dni, **L** > 2 dni.

### 2.1 Kaj deluje dobro
- Čist, miren videz kartic (`rounded-2xl border-gray-100` na `#f8f9fc`). Enoten.
- Uvedena je skupna osnova komponent: `Button`, `Input`, `Select`, `Modal`, `ConfirmDialog`, `Badge`, `Card`.
- Mobilni računi so kartice, namizni tabela (`invoices/page.tsx`). Obrazec ima ločen mobilni razpored postavk.
- Statusi imajo besedilo, ne samo barve (Badge).
- Skeleton pri pregledu, indikator navigacije, `error.tsx` za segment.
- Prijava razloži, da so podatki isti kot v Jedro+.

### 2.2 Težave

#### Hierarhija in vsebina

**P1-V1 Pregled ne odgovarja na "kaj naj naredim zdaj?"** Vrstni red: opozorila (če so), 6 kartic za danes, loyalty, graf, 4 kartice meseca, termini, zadnji računi, seznam nastavitve. Za novega uporabnika je najpomembnejše (nastavitev) na dnu, za obstoječega pa ni združenega seznama "danes je treba". Trije ločeni trakovi (opozorila pozornosti, certifikat poteče, certifikat manjka) plus `MissedClosingBanner` in `SubscriptionBanner` v layoutu imajo vsak svoj slog.
→ Blok "Kaj je treba narediti" (največ 3), nato številke. Za novega: vodič (razdelek 3). · **M**

**P2-V2 Dve števili na pregledu se ne ujemata:** "Število računov danes" šteje vse vrstice (tudi storno in storniran original), "Prihodki danes" ne (`DashboardBody.tsx`: `todayRows.length` proti `todayRevenueRows.length`). · **S**

#### Barve in konsistentnost

**P1-V3 Dva primarna slogа gumba.** `Button` je črn, a ga na pregledu (`gradient-bg text-white`), v računih, terminih, prijavi in Z-poročilu prepišejo z gradientom. Na pregledu stojita črn "Dodaj certifikat →" in gradient "+ Izstavi račun". Uporabnik ne ve, kateri je glavni. → `variant="brand"` namesto prepisovanja razredov. · **S**

**P0-V4 Beli tekst na gradientu pade pod kontrast.** `#2AD4C5` (turkizna) proti beli je ≈ 1,9:1, `#2F80ED` ≈ 3,9:1, `#6D5EF7` ≈ 4,6:1. Gumbi z `gradient-bg` imajo belo besedilo čez celoten gradient. Desna stran je slabo berljiva. → Gradient samo vijolica→modra, ali črn gumb. · **S**

**P1-V5 Naslov strani je gradientno besedilo** (`Header.tsx`, `gradient-text`). Turkizen konec na beli ima ≈ 1,9:1. → Naslov `text-gray-900`; gradient samo kot okras. · **S**

**P0-V6 `text-gray-400` na beli** (`#9ca3af`, ≈ 2,5:1) je uporabljen **75-krat** za pomembno vsebino: napotki pod polji (`Input.tsx`), datumi, pomožna besedila, oznake spodnje navigacije (10 px). AA zahteva 4,5:1. → `gray-500` (4,8:1) kot najsvetlejše za besedilo. · **S**

**P1-V7 Opozorila imajo različne slog in tri odtenke rumene** (`yellow` v podrobnostih računa, `amber` na pregledu, `orange` v `SubscriptionBanner`). → ena komponenta `Alert`. · **M**

**P2-V8 Ikone so ročno prekopirani SVG-ji** (>60 kopij istih poti) pomešani z emoji (🎁, 🔄, ✅). → en `Icon` ali `lucide-react`. · **M**

**P2-V9 Značke statusa so definirane na dveh mestih** (`invoices/page.tsx`, `invoices/[id]/page.tsx`) z različnim besedilom: "Potrjeno FURS" proti "Potrjeno pri FURS"; "Čakam FURS" proti "Čaka potrditev FURS". → ena funkcija. · **S**

#### Mobilna uporaba

**P0-M1 Toasti se prekrivajo s spodnjo navigacijo.** `OnboardingCompleteToast.tsx:29` (`fixed bottom-5`) in podrobnosti računa `:446` (`bottom-6`) sta v območju `MobileNav` (`h-16`, `z-40`; toast `z-50` je nad njo in prekriva gumbe). `safe-area-inset` ni uporabljen nikjer v projektu. → pozicija nad navigacijo + `env(safe-area-inset-bottom)` na `MobileNav`. · **S**

**P0-M2 `PremisesForm` ima fiksne `grid-cols-4` (:215) in `grid-cols-3` (:243) brez prelomnic.** Pri 375 px so polja ≈ 80 px široka, oznake kot "Katastrska občina" se izgubijo. Nov prostor je prvi, ki ga mora uporabnik dopolniti, in to je lahko na telefonu. → `grid-cols-1 sm:grid-cols-*`. · **S**

**P1-M3 Nastavitve in odjava na mobilcu sta samo ikoni v glavi** (`Header.tsx`, 32 px, manj od 44 px tarče). `MobileNav` ima 6 mest: Pregled, Termini, +, Računi, Stranke, Z (Nastavitev ni). Po nastavitvah uporabnik, ki mora na prvem koraku v Nastavitve, ne najde poti. → Ikona zobnika 44 px ali mesto "Več". · **S–M**

**P1-M4 Z-poročila imajo 8-stolpčno tabelo** v `overflow-x-auto` brez mobilnih kartic (`ZReportClient.tsx`). Glava računov ima 3 gumbe (Računovodski izvoz, Izvoz, + Nov račun), ki zasedejo četrtino zaslona. → kartice za mobilce; izvoz v "⋯" meni. · **M**

**P1-M5 Tarče pod 44 px:** zapiranje trakov (`MissedClosingBanner.tsx`, 16 px ikona), odstranjevanje postavke, ikone v glavi. · **S**

**P2-M6 Vnos števil:** `type="number"` z `parseFloat(...) || 1` pri količini **(ni ponovno preverjeno)** pomeni, da brisanje polja vrne "1". Za slovensko vejico: `inputMode="decimal"`. · **S**

**P2-M7 Modali na mobilcu** so sredinski. Dolge vsebine (dostava računa) bi bile boljše kot "bottom sheet". · **M**

#### Stanja

**P0-S1 Napake so pogosto surove ali angleške.**
- Prijava: `throw new Error(authError.message)` → "Invalid login credentials" (`login/page.tsx:57`).
- Onboarding: `err.message` baze (korak 1 in 2).
- API: "Unauthorized", "Forbidden", "No user found", "No company in profile", "Server error", "Too many requests. / Preveč zahtev." (dvojezično) (grep `app/api`).
→ ena preslikava šifra → slovensko besedilo + "kaj naj storim". **Fiskalnih sporočil ne spreminjati**, samo prikaz. · **M**

**P1-S2 Prazna stanja povedo "kaj", ne "zakaj" in "kaj naprej"** (pregled, računi, termini, Z, stranke, prostori). Predlogi v 3.7. · **S**

**P1-S3 Uspeh in neuspeh shranjevanja:** `Shranjeno ✓` v gumbu za 2 s; pri nastavitvah točk ni obravnave napake **(ni ponovno preverjeno)**. → toast in prava obravnava. · **S**

**P1-S4 Onemogočeni gumbi ne povedo zakaj** (`Button.tsx`: samo `opacity-60`). "Naloži certifikat" je siv, dokler ni datoteke in gesla. → napotek pod gumbom. · **S**

**P1-S5 Izdaja računa med klicem FURS** pokaže samo spinner v gumbu. Če uporabnik zapre zavihek, ne ve, ali je račun izdan. → po 2 s besedilo "Potrjujem pri FURS, ne zapirajte strani". · **S**

#### Dostopnost (ostanek)

**P1-A1 Fokus je neenoten.** `Button` ima `focus:ring-2` (tudi ob kliku z miško), `Input` ima `ring-gray-900/10` (10 % krovnosti, skoraj nevidno), meni (`Sidebar.tsx`) ovije `<div>` v `<Link>` brez lastnega fokusnega stila. → globalen `:focus-visible` z obročem 2 px. · **S**

**P1-A2 Samo barva za pomen:** pika statusa računa (`DashboardBody`), pika FURS statusa, pika Z-poročila v meniju (samo `title`). → besedilo ali `sr-only`. · **S**

**P2-A3 ARIA** je večinoma v komponentah (75 pojavitev `aria-`/`role=`). Prijava: gumb za prikaz gesla ima `tabIndex={-1}`, brez imena **(ni ponovno preverjeno)**. · **S**

#### Mikro-besedilo

**P0-T1 Neenotni izrazi za isto stvar:**

| Pojem | Pojavitve |
|---|---|
| Dnevni zaključek | "Z poročilo", "Z-poročilo", "Dnevni zaključek blagajne", "Zaključi blagajno", "Zaključi dan" |
| Testni način | "Demo način" (status), "TEST", "TESTNI NAČIN", "testni način", okolje "Test" |
| Točke | "Loyalty", "loyalty točke", "Loyalty program", "točke" |
| E-pošta | "E-pošta", "Email", "email" (paketi), "e-naslov" |
| Račun | "Račun", "fakturiranje", "Fakturirano" |
| Storno | "STORNO RAČUN", "STORNIRAN", "Storniran" |
| FURS potrditev | "Potrjeno FURS", "Potrjeno pri FURS", "Čakam FURS", "Čaka potrditev FURS" |

→ Slovarček (3.4) postane vir resnice. · **M**

**P1-T2 Žargon brez razlage na prvem zaslonu:** "produkcijsko delovanje", "certifikat", "Oznaka prostora", "Elektronska naprava", "Katastrska občina / Številka stavbe / Del stavbe", "EOR/ZOI". Nikjer "?". · **M**

**P1-T3 Gumbi na računu in ton:** štirje gumbi PDF/tisk (D); mešan ton ("Preskočite" proti "Izpolnite"; vzklični "Nastavitev končana!"). · **S**

**P2-T4 `console.log`** na 14 mestih v `app/`, `components/`, `lib/`, med njimi prijava z e-pošto. **(ni ponovno preverjeno natančno kje)**. · **S**

**P1-D1 `DESIGN_HANDOFF.md` je zastarel** in vodi v napačno smer (gradient gumb, Next 14). → posodobiti kot živ dokument. · **S**

**P1-D2 Dve poti odjave** (`Sidebar` kliče `clearCompanyData`, `Header` ne). → ena funkcija. · **S**

---

## 3. Začetni vodič

### 3.1 Načela
1. Nov uporabnik v 5 minutah ve, kaj mora narediti naprej, tudi ko je prekinil nastavitev.
2. Pojmi se razložijo tam, kjer se pojavijo.
3. Preizkusni račun je varno igrišče: uporabnik ga izda pred certifikatom.
4. Enaki izrazi povsod (slovarček 3.4 in seznam 3.2 sta vira).
5. Vodič nikoli ne ovira dela. Vedno ga je mogoče skriti in znova odpreti.

### 3.2 Seznam "Pot do prvega računa"
Nadomesti "Hitro nastavitev" (`DashboardBody.tsx`, zadnji blok). Prestavi se **na vrh pregleda**, dokler obvezni koraki niso opravljeni, nato se zloži v majhno kartico, nazadnje v povezavo v meniju.

| # | Korak | Zakaj (besedilo uporabniku) | "Narejeno", če … | Povezava |
|---|---|---|---|---|
| 1 | Podatki podjetja | Izpišejo se na vsakem računu. | vrstica `pos_company_data` | `settings/company` |
| 2 | Poslovni prostor in naprava | Vsak račun mora povedati, kje je bil izdan. | prostor z naslovom **in hišno številko**, ≥ 1 naprava | `settings/premises` |
| 3 | DDV | Povejte, ali ste zavezanec za DDV. | uporabnik je potrdil nastavitev (nov zastavek) ali `is_vat_registered` ni `null` | `settings/invoices` |
| 4 | Preizkusni račun | Preizkusite blagajno brez posledic. | ≥ 1 račun | `invoices/new` |
| 5 | Digitalno potrdilo | Z njim se računi podpišejo. Brez njega so računi samo preizkusni. | aktiven `pos_certificates` | `settings/certificate` |
| 6 | Registracija prostora pri FURS | FURS mora prostor poznati, preden potrdi pravi račun. | `furs_registered` | `settings/premises` |
| 7 | Prvi pravi račun | Prvi račun, ki ga FURS potrdi. | račun z EOR, ki ni preizkusen | `invoices/new` |
| 8 | Zaključite dan | Vsak dan z računi zaključite (Z-poročilo). | ≥ 1 `pos_z_reports` | `z-report` |

Neobvezno po koraku 7: tiskanje, spletna plačila, zvestobne točke.

Preverjanje korak 3: `is_vat_registered` je trenutno privzeto "da" (`settings?.is_vat_registered !== false`). Brez zastavka "potrjeno" ne vemo, ali se je uporabnik za DDV odločil. Zastavek v `pos_onboarding_state` (3.9).

```
┌──────────────────────────────────────────────────────────────────────┐
│ Pot do prvega računa                          Opravljeno 3 od 8      │
│ ██████████████░░░░░░░░░░░░░░░░░░░░░░░░                               │
│ ✔ 1  Podatki podjetja                                                │
│ ✔ 2  Poslovni prostor in naprava                                     │
│ ✔ 3  DDV                                                             │
│ ▶ 4  Izdajte preizkusni račun            [ Izdaj preizkusni račun ]  │
│        Preizkusite blagajno. Račun bo označen TESTNI in ga            │
│        davčna uprava ne prejme.                                      │
│ ○ 5  Digitalno potrdilo                  Pridobite pri FURS  ⓘ      │
│ ○ 6  Registracija prostora pri FURS                                  │
│ ○ 7  Prvi pravi račun                                                │
│ ○ 8  Zaključite dan                                                  │
│                                                  [ Skrij za zdaj ]   │
└──────────────────────────────────────────────────────────────────────┘
```
Mobilec: ena kartica z naslednjim korakom in "3 / 8", seznam se razširi s tapom.

### 3.3 Vodeni ogled (kratek, preskočljiv)
Po koncu onboardinga, 4 sporočila: **Pregled** ("Tu vidite današnji promet in kaj je še treba narediti."), **+ Izstavi račun** ("Za začetek izdajte preizkusni račun. Davčna uprava ga ne prejme."), **Z poročilo** ("Ob koncu dneva tu zaključite blagajno. To je zakonska obveznost."), **Nastavitve** ("Certifikat, prostori in tiskanje so tukaj.").
Kontekstni namigi, vsak enkrat: v obrazcu ("Cene vnašate z DDV. Račun sam izračuna DDV."), po prvem računu ("Računa ni mogoče izbrisati. Popravite ga s stornom."), prvi obisk Z-poročila ("Po zaključku računov za ta dan ne boste mogli dodajati.").
Izvedba: lastna komponenta `CoachMark` (~100 vrstic) ali `driver.js`. Ne video. · **M**

### 3.4 Razlage pojmov
Komponenta `<HelpTip term="…" />` ("?" 44 px, odpre kratek napis; mobilec: spodnji list). Besedila v `lib/help/glossary.ts`. Uporablja jih tudi stran "Pomoč".

| Pojem | Razlaga |
|---|---|
| **FURS** | Davčna uprava Slovenije. Vaši računi se ji pošljejo, da jih potrdi. |
| **ZOI** | Vaš podpis računa. Naredi ga blagajna z vašim potrdilom. |
| **EOR** | Potrditev davčne uprave, da je račun prejela. Če je ni, FURS računa še ni potrdil. Blagajna poskusi znova sama. |
| **Certifikat (potrdilo)** | Digitalna datoteka (.p12), s katero blagajna podpiše vaše račune. Naročite jo pri FURS (e-Davki). Naložite jo enkrat. |
| **Poslovni prostor** | Kraj, kjer izdajate račune (lokal, salon, mobilna prodaja). Vsak prostor se registrira pri FURS. |
| **Elektronska naprava** | Vaša blagajna v prostoru. Običajno ena (EN1). |
| **Storno** | Pravilen način popravka računa. Izda se nasprotni račun, original ostane. |
| **Z-poročilo** | Dnevni zaključek: povzetek dneva. Po zaključku za ta dan ne morete več izdati računa ali storna. |
| **Testni način** | Računi so poskusni. Davčna uprava jih ne prejme. |
| **DDV** | Cene vnašate z DDV. Blagajna izračuna, koliko je DDV. Če niste zavezanec, DDV ni obračunan. |
| **Zvestobne točke** | Stranka za vsak evro dobi točke in jih unovči kot popust. Vezane so na e-pošto stranke. |
| **Spletna plačila (Stripe)** | Stranke plačajo s kartico prek spleta. Za vsako plačilo se izda račun. |
| **Naročnina** | Paket Plus ali Pro. Po preklicu imate dostop do konca plačanega obdobja. |
| **Račun z nakazilom** | Računi, plačani z nakazilom na račun, se ne pošiljajo FURS in imajo ločeno številko z oznako N. |

"?" mesta: poslovni prostor, naprava, certifikat, značka TESTNI, EOR/ZOI, Storniraj, Zaključi dan, DDV, točke, nakazilo.

### 3.5 Od nič do prvega fiskalnega računa

```
Naročnina → Podatki podjetja → Prostor + naprava → DDV → Preizkusni račun (TESTNI)
   → Certifikat → Registracija prostora → Prvi pravi račun (EOR) → Zaključek dneva (Z)
```

**Stalna značka "stanje blagajne" v glavi** (zamenja "FURS: Demo način"):

| Stanje | Besedilo | Barva |
|---|---|---|
| Brez certifikata | **Preizkusni način** · računi niso poslani FURS | rumena |
| Certifikat je, prostor ni registriran | **Skoraj pripravljeno** · registrirajte prostor | rumena |
| Certifikat je, okolje je "test" | **Testno okolje FURS** | modra |
| Produkcija, povezava ok | **Povezano s FURS** | zelena |
| Napaka povezave | **FURS trenutno ni dosegljiv** · računi se potrdijo kasneje | rdeča |
| Certifikat poteče | **Certifikat poteče čez N dni** | rumena |

Klik odpre kratek list z razlago in akcijo.

**Besedilo ob prvem preizkusnem računu:**
> **To je preizkusni račun.** Davčna uprava ga ne prejme in ni veljaven za stranko. Uporabite ga za preizkus blagajne. Ko dodate certifikat in vam omogočimo pravo delovanje, bodo vaši računi veljavni.

### 3.6 Navodila za pogoste primere (stran "Pomoč")
Besedila izhajajo iz `docs/RUNBOOK.md`, v preprostem jeziku.

1. **Naredil sem napako na računu.** "Računa ni mogoče spremeniti ali izbrisati. Odprite račun, pritisnite **Storniraj račun**, nato izdajte nov račun. Storno se potrdi pri FURS. Če ste dan že zaključili (Z-poročilo), storna ni mogoče izdati." *(po RUNBOOK: storno se ne izvede, če je današnji dan zaključen.)*
2. **FURS ne deluje / "Čaka potrditev FURS".** "Račun je veljaven in ga lahko izročite stranki. Blagajna ga potrdi pozneje, običajno samodejno. Če ostane nepotrjen dlje kot 3 dni, vas opozorimo na pregledu." *(RUNBOOK: 72 ur; pravna ustreznost izročitve računa z ZOI brez EOR: besedilo naj pred objavo potrdi pravno kdo.)*
3. **Zaključek dneva.** "Ob koncu dneva odprite Z-poročilo in pritisnite **Zaključi dan**. Po zaključku za ta datum računov ni mogoče izdati niti stornirati. Če ste včeraj pozabili, zaključite včerajšnji dan: (po odločitvi 8.3)."
4. **Račun z nakazilom.** "Računi, plačani z nakazilom, se ne pošljejo FURS in imajo številko z oznako N. Kartica šteje kot gotovinsko plačilo in se potrdi."
5. **Certifikat poteče.** "Opozorimo vas 30, 14, 7, 3, 2, 1 in 0 dni prej. Novo potrdilo naročite pri FURS (e-Davki) in ga naložite v Nastavitve → Certifikat."
6. **Stripe vračilo.** "Vračilo v Stripe samo vrne denar. Račun morate stornirati sami. Na pregledu se pokaže opozorilo z gumbom 'Odpri račun'."

### 3.7 Prazna stanja

| Zaslon | Predlog |
|---|---|
| Pregled in računi, brez računov | **Tu bodo vaši računi.** Začnite s preizkusnim računom. Izda se brez posledic. [Izdaj preizkusni račun] |
| Termini | Termini se tu pojavijo, ko jih v aplikaciji Jedro+ označite kot dokončane. Nato jih izdate z enim klikom. |
| Z-poročila | Prvi dan bo na voljo po prvem računu. Zaključek je obvezen ob koncu vsakega dne z računi. |
| Prostori | Brez poslovnega prostora ne morete izdati računa. Dodajte ga spodaj. Večina podjetij ima enega. |
| Stranke | Stranke se dodajo v aplikaciji Jedro+. Tu jih vidite in upravljate njihove točke. |

### 3.8 Kje se vodič prikaže in kako ga zapreš ali znova odpreš

| Mesto | Kaj | Zapiranje |
|---|---|---|
| Pregled (vrh) | kartica "Pot do prvega računa" | "Skrij za zdaj" (do naslednje prijave) in "Ne prikaži več" |
| Stranski meni / "Več" | postavka **Vodič** z `3/8` | stalna do konca |
| Prazna stanja | napotek + akcija | — |
| Ob polju | "?" | klik zunaj / Esc |
| Glava | značka stanja blagajne + list | — |
| Nastavitve | status pri vsaki vrstici (✓ / "Manjka") | — |
| Stran Pomoč | glosar + 6 primerov + gumb **"Ponovi ogled"** | vedno dostopna |

### 3.9 Shranjeno stanje (odločeno: nov stolpec ali tabela)
Predlog: nova tabela `pos_onboarding_state(company_id pk, checklist_hidden_until timestamptz, checklist_dismissed bool, tour_done bool, tour_seen jsonb, vat_confirmed bool, updated_at)`. Brez nje stanje ne velja na več napravah. Nova migracija `030_onboarding_state.sql` (ne dotika se fiskalnih tabel). RLS: samo branje za člane podjetja, pisanje prek API-ja.

### 3.10 Posodobitev obstoječega onboardinga
- **Korak 1:** vrstica "Izpišejo se na vsakem računu." Davčna številka in ID za DDV dobita "?" in preverjanje oblike.
- **Korak 2:** dodati hišno številko, razlago "Kaj je EN1?", gumb "Naprej: preizkusni račun". Po koncu prikazati seznam (3.2), ne "Blagajna je pripravljena". Preslikava napak v slovenščino.
- **Preskok:** namesto enoletnega piškotka stanje "skrito do jutri". Seznam ostane na pregledu.
- **Nov korak (3. v onboardingu): DDV.** "Ali je vaše podjetje zavezanec za DDV?" (da/ne). Zdaj se to najde samo v Nastavitve → Računi.

**Skupni obseg razdelka 3:** M–L, ≈ 6–9 dni.

---

## 4. Ostale izboljšave izkušnje

**Hitrost.** Že veliko narejenega (razdelek 0). Ostane: `DashboardBody` bere vse račune zadnjih 60 dni in jih sešteje v JS ter vse zapise točk za štetje strank (`DashboardBody.tsx`). Pri večjem salonu bo počasno. → SQL agregati. · **M**

**Obvestila.**
- Pet različnih opozoril (pozornost, certifikat poteče, certifikat manjka, zamujen zaključek, naročnina) z različnimi slogi. → en `Alert` in "Center obvestil".
- **Trak "Včeraj niste zaključili blagajne" vodi na stran, ki ne zna zaključiti včeraj** (potrjeno, 1.2 E). To je napaka v poti. · **M** (izbira datuma na strani; strežnik datum že sprejme).
- E-pošta: opomniki za Z (ob 21:00/20:00) in potek certifikata že obstajajo (README). Manjka e-pošta "račun ni potrjen več kot X ur" (RUNBOOK: `furs_failed` po 72 h je samo na pregledu).

**Stranke in točke.** Zaslon obstaja. Predlogi: stolpec "zadnji obisk", filter "samo s točkami", razlaga v praznem stanju, ime "zvestobne točke" namesto "loyalty", opozorilo, da stranka brez e-pošte ne zbira točk. Portal za stranke je izven repozitorija, enako besedišče (slovarček) naj uporablja tudi on.

**Tiskanje in dostava.** Štirje gumbi (1.2 D). Dodati "Pošlji po e-pošti" na podrobnosti računa. Na mobilcu namig "Ctrl+P / ⌘P" nima pomena (`invoices/[id]/page.tsx:451`). Izbira tiskanja je v nastavitvah, ne ob prvi izdaji: ob prvi izdaji vprašati "Vedno tako?".

**Napake in okrevanje.**
- FURS ne odgovori ob izdaji: UI ne razloži. Besedilo: "Račun je izdan. FURS ga trenutno ne potrdi. Poskusili bomo znova." (3.6/2)
- Prekinitev omrežja med izdajo: uporabnik ne ve, ali je račun izdan. → "Preverite seznam računov" po napaki. Ali je strežnik idempotenten, je odprto vprašanje (8.6).
- Seja: ob 401 uporabnik vidi surovo napako. `lib/auth/tokenExpiry.ts` obstaja; preveriti, ali ga `authFetch` uporablja za preusmeritev na prijavo **(ni ponovno preverjeno)**.
- Prijava: "Pozabljeno geslo?" ni (geslo je skupno z Jedro+: povezava na tam).
- Na stran za pregled `error.tsx` (segment) obstaja: preveriti besedilo.

---

## 5. Prednostni načrt

### Faza 1 — hitre zmage (≈ 3–4 dni)
| # | Delo | Obseg |
|---|---|---|
| 1.1 | **Slovarček in poenotenje terminov** (T1, 3.4) | S–M |
| 1.2 | Kontrast: `gray-400` → `gray-500` za vsebino, gradient na gumbih, naslov brez gradienta (V4–V6) | S |
| 1.3 | Mobilec: toast nad navigacijo, `safe-area`, `PremisesForm` v 1 stolpec, zobnik 44 px (M1–M3, M5) | S |
| 1.4 | Preslikava napak v slovenščino: prijava, onboarding, API prikaz (S1) | M |
| 1.5 | Pot Z za včeraj (izbira datuma), poenotena imena Z (E) | M |
| 1.6 | Besedila praznih stanj (3.7), obvestilo po onboardingu, razlaga storna (1.2 D) | S |
| 1.7 | Podrobnosti računa: poenotiti PDF/tisk gumbe, dodati "Pošlji po e-pošti" (D) | S |
| 1.8 | Odstraniti `console.log` s podatki (T4) | S |

### Faza 2 — vodič (≈ 6–9 dni)
| # | Delo | Obseg | Odvisnost |
|---|---|---|---|
| 2.1 | `glossary.ts` + `HelpTip` + vstavitve | M | 1.1 |
| 2.2 | Migracija `pos_onboarding_state` + API | S–M | — |
| 2.3 | `ChecklistCard` na vrhu pregleda | M–L | 2.1, 2.2 |
| 2.4 | Onboarding: hišna številka, DDV, "Kaj sledi", brez enoletnega preskoka | S–M | 2.3 |
| 2.5 | Značka "stanje blagajne" + list | M | 2.1 |
| 2.6 | Stran Pomoč (6 primerov, glosar, "Ponovi ogled") | M | 2.1 |
| 2.7 | Vodeni ogled (`CoachMark`) | M | 2.3 |

### Faza 3 — večje
`Alert` in `Icon` komponenti; konsolidacija trakov; mobilne kartice Z-poročil in "bottom sheet"; SQL agregati za pregled; e-pošta "račun ni potrjen"; izboljšave zaslona Stranke; preklop test/produkcija v vmesniku (po odločitvi 8.1); izbira cene z/brez DDV (po odločitvi 8.2); posodobitev `DESIGN_HANDOFF.md`.

**Predlagan vrstni red:** 1.1 → 1.2 + 1.3 → 1.4 + 1.5 + 1.6 + 1.7 → Faza 2 (2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7) → Faza 3.

**Tveganja:** shranjeno stanje vodiča zahteva migracijo (ročno v SQL Editorju, glej `docs/MIGRATIONS.md`); seznam vodiča bere več stanj naenkrat (paziti na pregled, ki je že optimiziran); pravna besedila (3.6/2, /3) mora potrditi Tim ali svetovalec; ogled mora delovati z animiranim menijem (`layoutId`).

## 6. Omejitve izvedbe
- **Brez sprememb fiskalne logike:** zneski, DDV, ZOI/QR, FURS klici, številčenje, storno, Z-izračuni, trigger nespremenljivosti. Predlogi so besedila, postavitev, stanje vmesnika in nova tabela za vodič.
- **Brez pushanja in združevanja** brez izrecnega ukaza ("združi"). Pred vsako objavo: `npm run typecheck`, `npm test`, `npm run build`.
- Vsa besedila v slovenščini, vikanje, brez žargona.
- **Migracijo `030` zaženete vi** ročno v Supabase (kot ostale).

## 7. Potrebni posnetki
Prijava (z napako); pregled za novega uporabnika in za uporabnika z računi; onboarding 1/2 in obvestilo po koncu; "Nov račun" na telefonu (celoten); modal dostave; podrobnosti računa (običajen, TESTNI, STORNO, čaka FURS); seznam računov (mobilec/namizje); Z-poročilo (pred/po zaključku, z opozorilom); Nastavitve, certifikat (z/brez), prostori na mobilcu; Stranke in podrobnosti stranke; spodnja navigacija z odprtim toastom. Alternativa: zaženem `npm run dev` (port 3001), če sami postavite `.env.local`.

## 8. Odgovori na vaša vprašanja in preostala odprta vprašanja

### 8.1 Test in produkcija: kako je dejansko nastavljeno
- **Vrednost je v bazi, ne v vmesniku:** `pos_settings.furs_environment`, `'test'` ali `'production'`, privzeto **`'test'`** za vsako podjetje (`001_pos_tables.sql:21`, `lib/furs/api.ts:106`, `create-invoice.ts:161`). Ni zaslona, kjer bi ga kdorkoli preklopil. Stran certifikata ga samo prikaže in pravi "preklopite na produkcijo" (`settings/certificate/page.tsx`): uporabnik tega ne more storiti.
- **Test ni samo za vas.** Vsako novo podjetje začne v `'test'`. Kaj to pomeni za račun:
  | Okolje | Certifikat | Kaj se zgodi |
  |---|---|---|
  | test | ni naložen | **demo**: izmišljen ZOI/EOR, račun označen TEST, FURS ni poklican |
  | test | je naložen | pravi klic na **testni strežnik** FURS (`FURS_TEST_URL`); račun ni veljaven za davčno upravo |
  | production | ni naložen | zavrnjeno: "Certifikat ni naložen" |
  | production | je naložen | pravi klic na produkcijski FURS |
- **Tveganje:** stranka naloži pravi certifikat, okolje ostane `test`, računi izgledajo potrjeni (ima EOR), v resnici pa jih uradni FURS nikoli ni videl. Znak: `FursStatusIndicator` pokaže "Povezan" tudi za test okolje.
- **Predlog (po vaši odločitvi):** v vmesniku povsod govorimo o "preizkusnem načinu" ali "pravem delovanju". Preklop na "pravo delovanje" naredite **vi** (ali gumb "Aktiviraj", ki ga sprožite iz admin dela), ob pogoju: certifikat naložen, prostor registriran, vsaj en preizkusni račun. Dokler ni preklopa, je stalna značka "Preizkusni način". **Vprašanje: želite ročni preklop (vi v bazi / admin), ali samodejno ob nalaganju certifikata?** Priporočam ročni, ker je to odločitev z davčnimi posledicami.

### 8.2 DDV
Stanje: cene so **vedno z DDV** (`README.md`); stikalo "Podjetje je zavezanec za DDV" že obstaja in pri ne-zavezancu DDV ni obračunan z zakonskim pripisom. **Vaš predlog (nastavitev, ali so cene z ali brez DDV) bi bila nova funkcija.** Bi pomenil drug izračun (neto → bruto) v fiskalni logiki (`lib/invoice/totals.ts`, `buildFursTaxes`), ki je zakonsko občutljiva in pokrita s testi, zato je ne bi delal v vodiču. Moj predlog: **cene z DDV ostanejo; razlago "cene so z DDV" damo v obrazec in vodič.** Če želite neto vnos, je to ločen projekt. Odločite se.

### 8.3 Točka 3 po domače (zaključek za včeraj)
Zgoraj rdeč trak pravi "Včeraj niste zaključili blagajne. Ustvarite Z-poročilo za 8. oktober". Klik vas pelje na stran Z-poročila. Ta stran pa zna zaključiti **samo današnji dan**, trak pa obljublja včerajšnjega. Strežnik bi včerajšnji dan sprejel (zavrne samo prihodnost), manjka izbira datuma na strani. **Vprašanje: ali je zakonsko / vaše pravilo, da se pozabljen zaključek naredi za pretekli dan?** Če da, dodam izbiro datuma (majhna sprememba na vmesniku, ne dotakne se izračuna). Če ne, popravim besedilo traku.

### 8.4 Račun brez EOR (prej točka 4)
To je pravno vprašanje, na katerega ne morem odgovoriti: ali smete stranki dati račun, ki ima vaš podpis (ZOI), a FURS ga še ni potrdil (EOR), ker FURS ni dosegljiv. RUNBOOK trdi, da je to pričakovano delovanje in da zakon dovoljuje naknadno potrditev ("Zakon dovoljuje naknadno potrditev"). Besedilo za stran Pomoč bom napisal v tem duhu, **vi ali računovodja ga potrdite**, preden gre v vmesnik.

### 8.5 Stranke v POS
Obstajajo (razdelek 0). Predlogi so majhni (razdelek 4). Nobena odločitev ni odprta.

### 8.6 Preostala odprta vprašanja
1. **Idempotenca izdaje:** ali strežnik prepreči dvojno izdajo, če uporabnik ob prekinjeni povezavi ponovno odda obrazec? (RUNBOOK omenja `unique appointment invoice` samo za termine.)
2. **Registracija prostora brez certifikata:** ali je mogoča? Od tega je odvisen vrstni red korakov 5 in 6 v 3.2.
3. **Kam vodi "Poklicite podporo"** (e-pošta/telefon) in kje je ponastavitev gesla (Jedro+)?
4. **WCAG 2.1 AA** kot cilj? (Priporočam.)
5. **Ime programa:** "zvestobne točke" namesto "loyalty" povsod (vključno z nastavitvami in portalom)?
6. **Mapa `app/[slug]/settings/certificate/10685219-1.p12`** je v iCloud kopiji, ne v tem projektu. V tem projektu je ni.

---
*Vse trditve so iz izvorne kode na dan 2026-10-09. Trditve o videzu (kontrast, razmiki) so izračunane, ne izmerjene na zaslonu. Označene s "(ni ponovno preverjeno)" izhajajo iz starejše kopije in jih je treba pred izvedbo potrditi.*

---

## 9. Uveljavljeni izrazi (korak 1, narejeno)

Ti izrazi veljajo v vmesniku. Novo besedilo naj jih uporablja.

| Pojem | Izraz v vmesniku |
|---|---|
| Dnevni zaključek | meni in naslov **Z-poročilo**, dejanje **Zaključi dan** |
| Testni račun | značka **TESTNI**, stanje **Testni način** (ne "demo", ne "TEST") |
| Potrditev FURS | **Potrjeno pri FURS** / **Čaka potrditev FURS** |
| Storno | **STORNO** (storno račun), **STORNIRAN** (razveljavljen račun) |
| E-pošta | **e-pošta** (ne "email") |
| Račun | **račun**, **račun izdan** (ne "fakturirano") |
| Točke | **zvestobne točke** (ne "loyalty") |

Nespremenjeno: PDF-ji, e-pošte, CSV izvozi in sporočila strežnika (npr. "TESTNI NACIN" na vodnem žigu PDF-ja), ker so ločen del.
