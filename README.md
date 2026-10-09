# Jedro+ POS — davčna blagajna

Davčna blagajna za podjetja, povezana z aplikacijo Jedro+ (termini, stranke) in portalom za stranke. Izdaja račune, jih potrjuje pri FURS (ZDavPR), vodi zvestobne točke, dnevne zaključke (Z-poročilo) in naročnine.

**Tehnologija:** Next.js 15 (App Router) · React 18 · TypeScript · Tailwind · Supabase (Postgres, Auth, Storage) · Stripe (naročnine + Connect) · Resend (e-pošta) · Vercel.

## Hiter začetek

```bash
npm ci
cp .env.example .env.local        # izpolni vse spremenljivke
npm run dev                       # http://localhost:3001
```

| Ukaz | Kaj naredi |
|---|---|
| `npm run typecheck` | preverjanje tipov |
| `npm test` | testi (logika zneskov, FURS, izdaja računa, storno, webhook) |
| `npm run build` | produkcijski build |

GitHub Actions (`.github/workflows/ci.yml`) zažene vse troje ob vsakem PR in pushu v `main`.

## Okoljske spremenljivke

Vse so naštete in opisane v [`.env.example`](.env.example). Manjkajoče ali nevarne vrednosti se izpišejo ob zagonu strežnika, stanje pa pokaže tudi `/api/health` (podrobnosti z `Authorization: Bearer <CRON_SECRET>`).

Posebej pomembno:
- `CERTIFICATE_ENCRYPTION_KEY` — šifrira FURS potrdila v bazi. **Če ga spremeniš, obstoječih potrdil ni več mogoče prebrati** (naložiti jih je treba znova).
- `RESEND_TEST_TO` — samo za razvoj. Če je nastavljen, gre **vsa** e-pošta na ta naslov namesto strankam.
- `FURS_TLS_INSECURE=true` — samo zasilno, izklopi preverjanje TLS v FURS produkciji.

## Kako deluje (kratko)

- **Prijava osebja:** Supabase Auth, seja v piškotkih. Zaposleni pripada podjetju prek `profiles.default_company_id`. Vsaka stran `/[slug]/…` in vsak API najprej preveri, da uporabnik res sodi v to podjetje (`lib/auth`).
- **Prijava strank (portal):** stranka se prijavi s Supabase žetonom na e-pošto. `/api/portal/*` prebere e-pošto samo iz overjenega žetona in vrne le njene podatke (točke, računi).
- **Račun:** zneske izračuna strežnik (`lib/invoice/totals.ts`), ne brskalnik. Cene so vedno **z DDV**. Podjetje, ki ni zavezanec za DDV, izdaja račune brez DDV (stikalo v Nastavitve → Računi).
- **FURS:** gotovina, kartica in spletna kartična plačila se potrdijo (ZOI + EOR). Če FURS ni dosegljiv, se račun izda z veljavnim ZOI in stanjem `pending_furs`, naknadno ga potrdi `/api/furs/retry`. **Plačilo z nakazilom se ne pošilja FURS** in ima ločeno številčenje z oznako **N**.
- **Nespremenljivost:** izdanih računov ni mogoče brisati ali spreminjati njihovih fiskalnih podatkov (trigger v bazi). Napako popraviš s **stornom**.
- **Zvestobne točke:** knjiga gibanj `pos_loyalty_points`. Točke se porabijo šele z uspešno izdanim računom. Storno vrne porabljene in odvzame zasluženo točke.
- **Stripe:** `checkout.session.completed` izda račun za spletno plačilo termina. Če računa ni mogoče izdati ali pride vračilo, se na pregledu pokaže rdeče opozorilo ("Zahteva vašo pozornost").
- **Čas:** vse, kar se tiče FURS, dnevnih zaključkov in izpisov, je v času `Europe/Ljubljana` (`lib/time.ts`), strežnik pa teče v UTC.

## Opravila po urniku

Vercel (`vercel.json`, v paketu Hobby največ enkrat na dan):

| Pot | Kdaj (UTC) | Kaj |
|---|---|---|
| `/api/furs/retry` | 06:00 | naknadna potrditev računov pri FURS |
| `/api/furs/cert-expiry` | 06:00 | e-pošta o poteku FURS potrdila |
| `/api/z-report/send-reminders` | 19:00 | opomnik za zaključek blagajne |

**Priporočilo:** v n8n nastavi klic `GET https://<domena>/api/furs/retry` z glavo `Authorization: Bearer <CRON_SECRET>` na vsakih 15 minut, da se računi, izdani brez povezave, potrdijo takoj.

## Baza

Migracije so v `supabase/migrations/` in se zaženejo ročno v Supabase SQL Editorju. Vrstni red in opombe: [docs/MIGRATIONS.md](docs/MIGRATIONS.md).

## Delovanje v praksi

Navodila za primere (FURS ne dela, napačen račun, poteklo potrdilo, vračilo Stripe, zaprtje prostora, vrnitev nazaj): [docs/RUNBOOK.md](docs/RUNBOOK.md).
