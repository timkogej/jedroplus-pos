# Vodič za nove uporabnike — načrt izvedbe

Datum: 2026-10-10 · Status: **izvedeno (glej razdelek 9)** · Osnova: `docs/ux-analysis.md` (razdelek 3) in branje kode na veji `ux-z-date-and-terms` (commit `9833517`).

## 1. Cilj

Nov uporabnik (lastnik ali zaposleni v majhnem podjetju, ne tehnik) mora v prvih 10 minutah vedeti:
1. **Kaj je narejeno in kaj manjka** do prvega pravega fiskalnega računa.
2. **Zakaj** je vsak korak potreben (v enem stavku, brez žargona).
3. **Kam klikniti**, da korak opravi.
4. **Kaj pomeni** vsak izraz, ko ga prvič vidi (FURS, ZOI, certifikat, storno, Z-poročilo …).
5. **Kaj narediti, ko gre kaj narobe** (napaka na računu, FURS ne dela, pozabljen zaključek).

Merilo uspeha: uporabnik, ki ga nihče ne vodi, pride do prvega testnega računa brez klica podpori, do pravega računa pa z največ enim vprašanjem.

## 2. Kaj v kodi že obstaja (in kaj to pomeni za vodič)

| Že obstaja | Datoteka | Posledica |
|---|---|---|
| Onboarding 2 koraka (podatki podjetja, prostor + naprava EN1) | `app/[slug]/onboarding/step1`, `step2`, `OnboardingShell` | ostane, a ga je treba dopolniti (hišna številka, DDV) in končati z vodičem, ne z "Blagajna je pripravljena" |
| "Hitra nastavitev" (3 točke na dnu pregleda) | `dashboard/DashboardBody.tsx` | nadomesti jo nova kartica na vrhu |
| E-pošta ob koncu onboardinga: dobrodošlica + navodila za FURS certifikat korak za korakom | `lib/onboarding/email.ts` | **besedilo za korak "Certifikat" že obstaja** (eDavki, 5 korakov), uporabim ga tudi v aplikaciji |
| Opozorila: neuspeli računi, vračila, potek certifikata, zamujen zaključek | `AttentionBanner`, pregled, `MissedClosingBanner` | ostanejo, vodič jih ne podvaja |
| Registracija prostora pri FURS | `components/settings/PremisesForm.tsx`, `api/furs/register-premise` | **zahteva certifikat** (`lib/furs/api.ts`: brez certifikata napaka "Certifikat ni naložen"). Vrstni red korakov je torej: certifikat, nato registracija. |
| Okolje test/produkcija | `pos_settings.furs_environment`, privzeto `'test'` | preklopi se ročno v bazi. Vodič mora to **pošteno pokazati** (korak "Aktivacija"). |
| Račun brez certifikata v testnem okolju je "demo" (izmišljen ZOI/EOR, značka TESTNI) | `lib/invoice/create-invoice.ts` | preizkusni račun je mogoč **pred** certifikatom, kar vodič izkoristi |
| Račun ne hrani, v katerem okolju je nastal | `pos_invoices` (brez stolpca okolja) | "pravi račun" se mora določiti drugače (glej 4.2) |
| `is_vat_registered` privzeto `true` | `pos_settings` | brez ločenega zastavka ne vemo, ali se je uporabnik za DDV odločil (glej 4.1) |
| Dostopna komponenta `Modal` in `ConfirmDialog` | `components/ui` | uporabim za liste in pojasnila |
| Ni zaslona "Pomoč", ni glosarja, ni "?" ob pojmih | — | novo |
| Dobrodošlica obljublja "Povabite zaposlene" | `lib/onboarding/email.ts` | **v POS te funkcije ni** (grep `invite`/`povabi` v `app`, `lib`, `components`). Besedilo je treba popraviti ali razjasniti (vprašanje 8). |

## 3. Zasnova (kaj bo uporabnik videl)

### 3.1 Koraki vodiča

Devet obveznih korakov in neobvezni "več". Vsak ima: naslov, en stavek "zakaj", gumb, stanje in (kjer treba) razlago "kako".

| # | Korak | Zakaj (besedilo uporabniku) | "Narejeno", če … |
|---|---|---|---|
| 1 | Podatki podjetja | Izpišejo se na vsakem računu. | `pos_company_data` ima naziv, naslov, pošto, mesto, davčno št., e-pošto |
| 2 | DDV | Povejte, ali ste zavezanec za DDV. Od tega je odvisen izpis na računu. | uporabnik je potrdil (`vat_confirmed`) |
| 3 | Poslovni prostor in naprava | Vsak račun mora povedati, kje je bil izdan. | ≥ 1 aktiven prostor z naslovom **in hišno številko** + ≥ 1 aktivna naprava |
| 4 | Preizkusni račun | Preizkusite blagajno. Račun je označen TESTNI in ga davčna uprava ne prejme. | ≥ 1 račun |
| 5 | Digitalno potrdilo | Z njim se računi podpišejo. Brez njega so računi samo preizkusni. | aktiven `pos_certificates` |
| 6 | Registracija prostora pri FURS | FURS mora prostor poznati, preden potrdi prvi pravi račun. | vsi aktivni prostori `furs_registered` |
| 7 | Aktivacija pravega delovanja | Jedro+ preklopi blagajno iz preizkusnega v pravo delovanje. | `furs_environment = 'production'` |
| 8 | Prvi pravi račun | Prvi račun, ki ga FURS uradno potrdi. | račun z EOR, ki ni demo, izdan po aktivaciji |
| 9 | Zaključite dan | Vsak dan z računi zaključite (Z-poročilo). | ≥ 1 Z-poročilo |

Neobvezno po koraku 8 ("Še več iz blagajne"): način prejema računa in tiskanje, spletna plačila (Stripe), zvestobne točke.

**Korak 7 je posebnost:** uporabnik ga sam ne more opraviti (preklop je vaš). Zato se prikaže kot stanje "Čaka na Jedro+" in gumb **"Sporočite nam, da je pripravljeno"**, ki vam pošlje e-pošto (nova API pot) in si zapomni čas zahteve. Vi nato zaženete en SQL (ali RPC `activate_company('slug')`, 6.1), ki nastavi okolje in čas aktivacije.

### 3.2 Kje se vodič pojavi

| Mesto | Kaj | Opomba |
|---|---|---|
| **Pregled, vrh** | kartica "Pot do prvega računa" z napredkom, **naslednjim korakom** in gumbom; "Vsi koraki" jo razširi | zamenja "Hitro nastavitev" |
| **Stranski meni** | postavka **Vodič** z napredkom (`4/9`), izgine, ko je vse opravljeno (ostane "Pomoč") | na telefonu v listu "Več" |
| **Stran Vodič** (`/[slug]/guide`) | vsi koraki z razlago in gumbi; za vsak korak odpiralna kartica "Zakaj? Kako? Koliko časa?" | tudi dostop iz e-pošte |
| **Stran Pomoč** (`/[slug]/help`) | slovarček pojmov + 6 pogostih primerov (storno, FURS ne dela, zaključek …) + kontakt | vedno dostopna |
| **"?" ob pojmih** | kratek napis (`HelpTip`) ob izrazih v obrazcih | na telefonu spodnji list |
| **Prazna stanja** | napotek + akcija (Termini, Računi, Stranke, Z-poročila) | |
| **Stanje blagajne** (glava) | kapsula z listom razlage: Preizkusni način / Skoraj pripravljeno / Čaka na Jedro+ / Pravo delovanje | zamenja zdajšnjo "FURS: …" kapsulo |
| **Konec onboardinga** | zaslon "Kaj sledi" s tremi vrsticami in gumbom "Naprej: preizkusni račun" | zamenja takojšnje preusmeritev z napačnim "Blagajna je pripravljena" |

Zapiranje in ponovno odpiranje: kartica ima "Skrij za zdaj" (do naslednje prijave) in "Ne prikaži več". Vodič je vedno dosegljiv prek menija **Vodič** ali **Pomoč → Ponovi ogled**.

### 3.3 Žične skice

**Kartica na pregledu**
```
┌───────────────────────────────────────────────────────────────┐
│ Pot do prvega računa                         Opravljeno 3 od 9 │
│ ███████████░░░░░░░░░░░░░░░░░░░░░                               │
│                                                               │
│ Naslednji korak: Izdajte preizkusni račun                     │
│ Preizkusite blagajno brez posledic. Račun bo označen TESTNI.  │
│                                                               │
│ [ Izdaj preizkusni račun ]   Vsi koraki ▾        Skrij za zdaj │
└───────────────────────────────────────────────────────────────┘
```

**Stran Vodič (en korak odprt)**
```
  ✔ 1  Podatki podjetja
  ✔ 2  DDV
  ✔ 3  Poslovni prostor in naprava
  ▼ 4  Preizkusni račun                              [ Odpri ]
  ┌───────────────────────────────────────────────────────────┐
  │ Zakaj? Da vidite, kako blagajna deluje, preden gre zares. │
  │ Kako?  1. Pritisnite Nov račun  2. Vpišite poljubno       │
  │        storitev in ceno  3. Potrdite.                     │
  │ Koliko časa? 1 minuta · Brez posledic                     │
  └───────────────────────────────────────────────────────────┘
  ○ 5  Digitalno potrdilo         Traja nekaj dni ⓘ
  ○ 6  Registracija prostora pri FURS
  ○ 7  Aktivacija pravega delovanja     Čaka na Jedro+
  ○ 8  Prvi pravi račun
  ○ 9  Zaključite dan
```

**Stanje blagajne (kapsula in list)**
```
  ● Preizkusni način ▾    →    ┌──────────────────────────────┐
                                │ Preizkusni način              │
                                │ Računi so poskusni. Davčna    │
                                │ uprava jih ne prejme.         │
                                │ Naslednji korak: certifikat   │
                                │ [ Odpri vodič ]               │
                                └──────────────────────────────┘
```

### 3.4 Pomembna besedila (osnutek)

| Mesto | Besedilo |
|---|---|
| Prvi preizkusni račun (v obrazcu) | **To je preizkusni račun.** Davčna uprava ga ne prejme in ni veljaven za stranko. Uporabite ga za preizkus blagajne. |
| Pred aktivacijo | **Skoraj pripravljeno.** Certifikat in prostor sta v redu. Sporočite nam, da je vse pripravljeno, in vklopimo pravo delovanje. |
| Po aktivaciji | **Blagajna je pripravljena za prave račune.** Od zdaj vsak račun potrdi FURS. Preizkusni računi ostanejo v seznamu z oznako TESTNI. |
| Zaključek vodiča | **Vse je nared.** Vodič lahko skrijete. Pomoč je vedno v meniju. |
| Prazna stanja | glej `ux-analysis.md` 3.7 |
| Pojmi (FURS, ZOI, EOR, certifikat, prostor, naprava, storno, Z-poročilo, testni način, DDV, točke, Stripe, naročnina, nakazilo) | glej `ux-analysis.md` 3.4; dopolniti z "Katastrska občina / številka stavbe / del stavbe" (kje najti: e-prostor.gov.si) |
| Pogosti primeri (6) | glej `ux-analysis.md` 3.6; viri: `docs/RUNBOOK.md` |

Besedila bodo v **enem viru** (`lib/help/*`), ne razmetana po komponentah, da jih lahko enotno popravljamo.

## 4. Kako se določi stanje (arhitektura)

### 4.1 Podatki

Vsi pogoji "narejeno" se **izpeljejo iz obstoječih podatkov** (podjetje, prostori, naprave, računi, certifikat, Z-poročila). Edino, kar se mora shraniti na novo, so uporabnikove izbire in časi:

Nova tabela `pos_onboarding_state` (migracija `030_onboarding_state.sql`):

| Stolpec | Pomen |
|---|---|
| `company_id` (PK) | podjetje |
| `vat_confirmed` bool | uporabnik je odgovoril na vprašanje o DDV |
| `guide_hidden_until` timestamptz | "Skrij za zdaj" |
| `guide_dismissed` bool | "Ne prikaži več" |
| `tour_seen` jsonb | kateri ogledi so že videni |
| `activation_requested_at` timestamptz | gumb "Sporočite nam" |
| `activated_at` timestamptz | nastavi se ob aktivaciji (vi) |

Pisanje samo prek API-ja s servisnim ključem, branje po vzorcu `022` (RLS po `profiles.default_company_id`). Brez sprememb fiskalnih tabel.

### 4.2 Prvi pravi račun
Računi ne hranijo okolja, zato "pravi" = račun z EOR, ki **ni** demo (`furs_response.demo` ni `true`), ustvarjen **po** `activated_at`. Brez `activated_at` korak ostane "čaka".

### 4.3 Izpeljava stanja
Čista funkcija `deriveGuideSteps(facts)` v `lib/guide/steps.ts` (brez baze, vsa pravila na enem mestu, **pokrita s testi**). Strežniška funkcija `loadGuideFacts(companyId)` zbere dejstva z manj kot 6 poizvedbami v `Promise.all` in jo kličeta pregled in stran Vodič. Ne klicati iz vsake strani (layout je predpomnjen), samo pregled, Vodič in glava (stanje).

### 4.4 API
- `POST /api/guide/preferences` — skrij, ne prikaži več, ogled viden, DDV potrjen (z `requireCompanyAccess`, kot ostale poti).
- `POST /api/guide/request-activation` — shrani čas in pošlje e-pošto na `info@jedroplus.com` (obstoječi `SUPPORT_EMAIL` v onboardingu, Resend je že povezan).
- Preklop aktivacije: SQL ali funkcija, ki jo zaženete vi (6.1). Ni javne poti.

## 5. Izvedba po fazah

Vsaka faza je samostojen commit z `typecheck`, `test`, `build`. Vsaka je uporabna že sama.

### Faza A — temelj (≈ 2 dni)
- `lib/help/glossary.ts`, `lib/help/cases.ts`, `lib/help/steps.ts` (besedila) — enoten vir.
- `lib/guide/steps.ts` (`deriveGuideSteps`) + **testi** (vsa stanja: nov uporabnik, prostor brez hišne številke, certifikat brez registracije, aktivirano, vse narejeno).
- Migracija `030` in API poti.

### Faza B — vidno (≈ 3 dni)
- `GuideCard` na pregledu (nadomesti "Hitro nastavitev"), postavka **Vodič** v meniju (sidebar + "Več"), stran `/[slug]/guide`.
- Stanje blagajne (kapsula + list) namesto "FURS: …" kapsule.
- Onboarding: hišna številka v koraku 2, vprašanje o DDV v koraku 1, zaključni zaslon "Kaj sledi".

### Faza C — pomoč (≈ 2–3 dni)
- `HelpTip` in vstavitve ob obrazcih: poslovni prostor, naprava, katastrski podatki, davčna št., DDV, certifikat, geslo certifikata, zvestobne točke, storno, zaključi dan.
- Stran `/[slug]/help`: pojmi, 6 primerov, kontakt.
- Prazna stanja z napotkom.
- Dopolnila na obstoječih mestih: razlaga storna v modalu, razlaga stanja "Čaka potrditev FURS", razlaga zaključka dneva.

### Faza D — poliranje (≈ 1–2 dni, neobvezno)
- Kratek vodeni ogled (4 sporočila, preskočljiv), `CoachMark`.
- Popravek dobrodošlice po e-pošti (korak 3 "Povabite zaposlene").
- Dopolnitev `docs/RUNBOOK.md` o aktivaciji.

**Skupaj ≈ 8–10 dni dela.**

### Odvisnosti
A → B → C. D po B. Aktivacija (6.1) mora biti dokumentirana pred B.

### Tveganja

| Tveganje | Ukrep |
|---|---|
| Vodič trdi, da je nekaj narejeno, a ni (npr. certifikat je potekel) | pogoji upoštevajo veljavnost certifikata (`isExpired`), test za to |
| Preveč poizvedb na pregledu | ena funkcija `loadGuideFacts` v `Promise.all`; stanje se računa samo na pregledu, Vodiču in v glavi |
| Migracijo je treba zagnati ročno | opisana v `docs/MIGRATIONS.md`; koda mora delovati tudi, če tabele še ni (privzeto "vodič viden, brez shranjenih izbir") |
| Besedila o zakonu | pravne trditve (račun brez EOR, zaključek za pretekli dan) potrdi Tim ali računovodja, **preden** gredo v aplikacijo |
| Napačen občutek "pripravljeno" | stanje "Pravo delovanje" se pokaže šele ob `production` + `activated_at` |

## 6. Aktivacija pravega delovanja (nova rutina)

### 6.1 Za vas
Zdaj je preklop skrit v bazi. Predlog: ena SQL funkcija, dokumentirana v `docs/RUNBOOK.md`:

```sql
-- Preklopi podjetje na pravo delovanje in zabeleži čas (idempotentno)
select activate_company('slug-podjetja');
```
Funkcija: preveri, da je certifikat aktiven in da so vsi aktivni prostori registrirani; šele nato nastavi `furs_environment = 'production'` in `activated_at = now()`. Če pogoj ni izpolnjen, vrne razlog. S tem se ne da preklopiti "na pamet".

### 6.2 Za uporabnika
Korak 7 pokaže "Čaka na Jedro+". Po vašem preklopu se ob naslednjem odprtju pokaže zelen pas "Blagajna je pripravljena za prave račune".

## 7. Česa ne naredimo (zavestno)
- **Ne spreminjamo fiskalne logike**: izračuni, ZOI/QR, FURS klici, številčenje, storno, Z-agregati.
- **Ne dodajamo samodejnega preklopa** v produkcijo (davčne posledice).
- **Ne podvajamo opozoril**, ki že obstajajo (pozornost, potek certifikata).
- **Ne gradimo vodnega ogleda** v prvi fazi (Faza D, neobvezno).
- **Ne pišemo pravnih trditev**, ki jih nihče ni potrdil.

## 8. Vprašanja za vas

1. **Gumb "Sporočite nam, da je pripravljeno"** (6.2): je to pravi način? E-pošta na `info@jedroplus.com` ali kam drugam?
2. **Aktivacija:** ali naj `activate_company` preveri pogoje (certifikat + registriran prostor), ali želite popolnoma ročen preklop?
3. **Korak "DDV"**: ali ga damo v onboarding korak 1 (vprašanje "Ali ste zavezanec za DDV?"), kot predlagam?
4. **Postavka v meniju:** **Vodič** ali **Začetek**? Po koncu: ostane **Pomoč**.
5. **Dobrodošlica po e-pošti** pravi "Povabite zaposlene". Ali ta funkcija obstaja kje drugje (npr. v Jedro+), ali besedilo odstranimo?
6. **Vodeni ogled** (Faza D): želite, ali samo kartico in "?"?
7. **Kontakt za pomoč** na strani Pomoč: samo `info@jedroplus.com`, ali tudi telefon / klepet?
8. **Pravna besedila** (račun brez EOR, zaključek za pretekli dan): ali jih izpustim, dokler jih ne potrdi računovodja? (priporočam, da jih izpustim.)
9. **Obseg prve oddaje:** Faze A + B (kartica, Vodič, stanje, onboarding) in C naslednji korak, ali vse naenkrat?

## 9. Odločitve in stanje izvedbe

Odločitve (Tim, 2026-10-10):
- Gumb za vklop pravega delovanja ostane; besedilo: **"Zahtevaj vklop pravega delovanja"** (poslano na `info@jedroplus.com`). Gumb je za izhod iz testnega načina, ne za testni način.
- Vprašanje o **DDV** je v onboardingu (korak 1).
- Postavka v meniju se imenuje **Vodič**; poleg je **Pomoč**.
- "Povabite zaposlene" obstaja v Jedro+ (besedilo e-pošte ostane).
- **Vodeni ogled** po vzoru glavne aplikacije Jedro+ (obkroži element, zatemni ostalo, razlaga ob strani). Poseben ogled za **Termine** s kartico termina in sliko računa po kliku.
- Stran **Pomoč**: samo e-pošta za kontakt.
- **Pravna besedila** niso v aplikaciji (nič o izročitvi računa brez EOR, nič o pravici do zaključka za nazaj).

Izvedeno: Faza A (logika, testi, migracija 030, API), Faza B (kartica, stran Vodič, meni, stanje blagajne, onboarding), Faza C (razlage "?", stran Pomoč, prazno stanje Termini), Faza D (vodeni ogled). Migracijo 030 je treba zagnati **pred** objavo kode (`docs/MIGRATIONS.md`); vklop pravega delovanja: `docs/RUNBOOK.md`.
