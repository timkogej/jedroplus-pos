# Jedro+ Davčna blagajna — oblikovalska izhodišča

Posodobljeno: 2026-10-11 (po PR #3 in #4). Prejšnja različica (maj 2026, opisovala je gradientne gumbe in Next 14) je v zgodovini gita. Ta dokument ustreza kodi; ob spremembi videza ga posodobite v istem PR.

**Stack:** Next.js 15 (App Router) · React 18 · Tailwind 3.4 · framer-motion · Supabase · Stripe.
**Jezik vmesnika:** slovenščina, vikanje, kratki stavki, brez žargona. Izrazi so v razdelku 6.

---

## 1. Načela

1. **Apple-like:** svetla, mirna površina, malo črt, mehke zaobljenosti, veliko praznega prostora, sistemska pisava.
2. **Ena glavna akcija na zaslon.** Glavni gumb je črn. Gradient je samo znamka (logotip, okrogli "+" na telefonu).
3. **Besedilo je berljivo.** Vsebina nikoli ni svetlejša od `text-gray-500`. Pomen ni nikoli samo v barvi (vedno tudi besedilo ali ikona z imenom).
4. **Telefon je prvovrsten.** Vsak zaslon mora delovati pri 375 px; tarče so vsaj 40 px.
5. **Nič ne zahteva predznanja.** Pojmi imajo "?" (`HelpTip`), koraki imajo razlago "zakaj / kako", napake povedo, kaj narediti.

## 2. Barve in pisava

| Žeton | Vrednost | Uporaba |
|---|---|---|
| `brand` | `#6D5EF7` | poudarek: aktivna postavka, povezave, napredek, fokus (`text-brand`, `bg-brand/10`) |
| Črnilo | `#1d1d1f` | glavni gumb, glavno besedilo (`bg-[#1d1d1f]`) |
| Ozadje strani | `#f5f5f7` | `body` |
| Kartica | `bg-white` + `border-black/[0.06]` + `shadow-[0_1px_2px_rgba(0,0,0,0.04)]` | vse kartice |
| Sivine | `gray-900` naslovi, `gray-600` telo, `gray-500` najsvetlejše za besedilo | `gray-400` samo za dekorativne ikone in placeholder |
| Gradient znamke | `#7B4BEA → #4C74E0 → #35D2D2` (logotip), `.gradient-bg` | samo logotip in "+" na telefonu |
| Napis "Davčna blagajna" | `.brand-gradient-text` (konec temnejši, da je berljiv) | samo ob logotipu |

**Pisava:** sistemska, SF Pro na napravah Apple (`font-sans` v `tailwind.config.ts`: `-apple-system`, `SF Pro Text/Display`, Segoe UI, Roboto …). Brez spletnih pisav. PDF-ji imajo svojo pisavo.

**Velikosti:** naslov strani 24 px (telefon) / 21 px (namizje), naslov kartice 15–16 px, telo 14 px, razlage 12–13 px, oznake spodnje navigacije 11 px. Nič pod 11 px.

**Oblike:** kartice `rounded-2xl`, polja in gumbi `rounded-lg`, menijski "pill" `rounded-[10px]`, kapsule `rounded-full`.

## 3. Struktura zaslona

- **Namizje (≥ 768 px):** `Sidebar` (širina 15 rem, zamegljeno steklo) + `Header` (lepljiv, naslov strani + stanje blagajne + akcija strani). Vsebina ima `md:ml-60`.
- **Telefon:** `Header` ima eno tanko vrstico (logotip + "Davčna blagajna" + stanje FURS), naslov in akcija strani sta navadna vrstica na strani (se pomakneta). Spodaj `MobileNav`: **Pregled · Termini · [+] · Računi · Več**. "Več" odpre list: Vodič (z napredkom), Stranke, Z-poročilo, Nastavitve, Pomoč, Odjava. Rdeča pika na "Več", če po 18:00 dan ni zaključen.
- **Varni rob:** `viewport-fit=cover`; spodnja vrstica in toasti upoštevajo `env(safe-area-inset-bottom)`.

## 4. Komponente

### `components/ui`
| Komponenta | Opis |
|---|---|
| `Button` | `primary` (črn), `secondary`, `ghost`, `danger`; `sm/md/lg`; `loading`. Fokus samo z `focus-visible`. Gradient ne sme prepisati glavnega gumba. |
| `Input`, `Select` | oznaka z `htmlFor`, `aria-invalid`, `aria-describedby`; prop `help="<pojem>"` doda "?" (`HelpTip`). |
| `Modal` | `role="dialog"`, lovljenje fokusa, Esc, vrnitev fokusa, gumb "Zapri". |
| `ConfirmDialog` | zamenja `window.confirm`. |
| `Alert` | `error`, `warning`, `info`, `success`; naslov, besedilo, akcija. **Edina** komponenta za obvestila. |
| `Badge` | značke stanja računa (besedila v razdelku 6). |
| `Popover` | sidrana ploščica (Esc, klik zunaj, ostane na zaslonu); uporabljata `HelpTip` in kapsula stanja. |
| `Card` | bela kartica z mehko obrobo. |
| `DecimalInput` | polje za zneske in količine: da se izprazniti, sprejme vejico in piko, na telefonu pokaže decimalno tipkovnico. Zunaj je navadno število, zato izračuni ostanejo enaki (`lib/decimal.ts`, s testi). |
| `Icon` | **edini** nabor ikon (`<Icon name="check" />`, 36 ikon, obris 24×24). Nova ikona se doda v `ICONS`, ne kot ročen `<svg>`. Ikone so dekorativne (`aria-hidden`); pomen je v besedilu ali `aria-label` na gumbu. Izjema: spinner v `Button`. |

### `components/layout`
`Sidebar`, `Header`, `MobileNav` (+ list "Več"), `JedroLogo` (uradni logotip iz aplikacije Jedro+, `public/brand/jedro-logo.svg`), `FursStatusIndicator` (kapsula + razlaga), `AuthGuard`, `CompanyContext`, trakovi `MissedClosingBanner` in `SubscriptionBanner`, `useZReportWarning` (rdeča pika).

### `components/guide`, `components/help`
`GuideProvider` (stanje vodiča + vodeni ogled), `GuideCard` (pregled), `GuideStepList`, `RestartTours`, `Examples` (primer kartice termina in računa), `HelpTip`.

## 5. Vodič, pomoč in vodeni ogled

- **Koraki** (`lib/guide/steps.ts`, logika s testi) in njihova besedila (`lib/help/steps.ts`). Stanje se izpelje iz obstoječih podatkov; shranjujejo se samo izbire uporabnika (`pos_onboarding_state`, migracija 030).
- **Pojmi** (`lib/help/glossary.ts`) in **pogosti primeri** (`lib/help/cases.ts`): novo besedilo gre tja, ne v komponento.
- **Vodeni ogled** (`lib/guide/tours.ts`): korak kaže na element z `data-tour="…"`; koraki, katerih element ni viden (npr. stranski meni na telefonu), se preskočijo. Nov označen element = dodaj `data-tour` in korak v `tours.ts`.
- **Pravna besedila** niso v aplikaciji, dokler jih ne potrdi računovodja.

## 6. Izrazi (enotni povsod)

| Pojem | V vmesniku |
|---|---|
| Dnevni zaključek | **Z-poročilo**, dejanje **Zaključi dan** |
| Preizkusni račun | značka **TESTNI**, stanje **Testni način** |
| Potrditev FURS | **Potrjeno pri FURS** / **Čaka potrditev FURS** |
| Storno | **STORNO** (storno račun), **STORNIRAN** (razveljavljen račun) |
| E-pošta | **e-pošta** |
| Točke | **zvestobne točke** |
| Računi iz terminov | **Račun izdan** |

## 7. Dostopnost (obvezno za nove zaslone)

- Vsako polje ima oznako (`Input`/`Select`); napake z `aria-describedby`.
- Gumbi samo z ikono imajo `aria-label`; tarča ≥ 40 px.
- Fokus s tipkovnico je viden (globalni `:focus-visible`).
- Opozorila z `Alert` (napaka in opozorilo se naznanita bralniku).
- Modali so dostopni (`Modal`); lastna pojavna okenca uporabljajo `Popover`.

## 8. Znane vrzeli (ni narejeno)

- Samo svetla tema.
- Nekateri drobni napisi so še 12 px (temnejše, a majhno).

## 9. Preverjanje pred objavo

`npm run typecheck`, `npm test`, `npm run build`. Videz preverite na telefonu (375 px) in namizju.
