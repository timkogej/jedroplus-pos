# Navodila za delovanje

Kaj narediti, ko gre kaj narobe. Najprej vedno preveri stanje sistema:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domena>/api/health
```
Vrne: bazo (ali dela, hitrost), manjkajoče/nevarne nastavitve, čakalno vrsto FURS (koliko računov čaka, najstarejši) in stanje certifikatov.

---

## FURS ni dosegljiv / račun ostane "Čaka potrditev FURS"
- To je pričakovano delovanje: račun je izdan z veljavnim ZOI, stranka ga lahko prejme. Status je `pending_furs`.
- Samodejno ga potrdi `/api/furs/retry` (Vercel enkrat na dan, v n8n priporočeno vsakih 15 minut). Zakon dovoljuje naknadno potrditev.
- Ročni zagon: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domena>/api/furs/retry`
- Po **72 urah** brez uspeha račun dobi status `furs_failed` in na pregledu se pokaže rdeče opozorilo. Takrat: preveri certifikat (poteklo?), registracijo prostora, `/api/health`, in pokliči FURS.

## Poteklo ali poteka FURS potrdilo
- Opozorilo na pregledu in e-pošta 30, 14, 7, 3, 2, 1 in 0 dni pred potekom.
- Novo potrdilo naročiš pri FURS (e-Davki), v **Nastavitve → Certifikat** naložiš `.p12` datoteko in geslo. Staro se deaktivira šele po uspešnem shranjevanju novega.
- Dokler je potrdilo poteklo, gotovinskih in kartičnih računov ni mogoče izdati.

## Račun je napačen
Izdanega računa ni mogoče spreminjati ali brisati (zakon + trigger v bazi). Popravek: **Računi → račun → Storno**, nato izdaj nov, pravilen račun. Storno račun dobi negativne zneske in se pri FURS potrdi s sklicem na original. Račun, ki ni šel FURS-u (nakazilo), se stornira brez FURS.
- Storno se ne izvede, če je današnji dan že zaključen (Z-poročilo).
- Storno vrne stranki porabljene zvestobne točke in odvzame zasluženo.

## Stripe: vračilo plačila stranki
Vračilo v Stripe **samo** vrne denar. Račun je treba **stornirati ročno** (zakon). Ob vračilu se na pregledu pokaže opozorilo z gumbom "Odpri račun" → Storno. Opozorilo se zapre samo.
- Potrebuješ dogodek `charge.refunded` na Stripe webhooku.

## Spletno plačilo je prispelo, računa ni
Najpogosteje je dan že zaključen (Z-poročilo) ali manjka certifikat/prostor. Na pregledu je opozorilo z razlogom. Reši vzrok (npr. naloži certifikat) in račun izdaj ročno za ta termin (**Termini → izstavi račun**).

## Dnevni zaključek (Z-poročilo)
- Zaključi se vsak dan (opomnik ob 21:00 oz. 20:00 po slovenskem času).
- **Zaključen dan je zaklenjen**: za ta datum ni mogoče izdati računa ali storna. Dneva v prihodnosti ni mogoče zaključiti.

## Vklop pravega delovanja (iz testnega okolja v produkcijo)
Vsako novo podjetje začne v testnem okolju (`pos_settings.furs_environment = 'test'`). Računi so tam preizkusni (TESTNI). Uporabnik v vodiču opravi certifikat in registracijo prostora, nato pritisne **Zahtevaj vklop** in vam pride e-pošta.
1. Preveri, da ima podjetje naložen veljaven certifikat in registriran prostor.
2. V Supabase SQL Editorju zaženi: `select activate_company('slug-podjetja');`
3. Funkcija sama preveri pogoje; če niso izpolnjeni, vrne razlog (NAPAKA: …) in ničesar ne spremeni. Ob uspehu vrne `OK: …`, nastavi `furs_environment = 'production'` in zabeleži čas vklopa (`pos_onboarding_state.activated_at`).
4. Vodič se samodejno prestavi na korak "Prvi pravi račun".

## Poslovni prostor
- Nov prostor: dodaj, vnesi naslov (in v produkciji katastrske podatke), pritisni **Registriraj pri FURS**.
- **Trajno zaprtje** ("Zapri pri FURS") je nepovratno. Zavrne se, dokler pri FURS čakajo računi tega prostora. Preizkusi ga samo v FURS testnem okolju.

## Račun z nakazilom
Račun, plačan z neposrednim nakazilom na transakcijski račun, ni gotovinski in se **ne pošlje FURS**. Nima ZOI/EOR/QR in ima številko z oznako **N**. Plačilo s kartico je gotovinsko in se potrdi.

## Objava nove različice in vrnitev nazaj
1. PR → počakaj na zelen CI in Vercel preview → preizkusi → Merge.
2. Najprej zaženi potrebne migracije (glej `docs/MIGRATIONS.md`).
3. Če gre kaj narobe: Vercel → Deployments → prejšnji deploy → **Promote to Production**. Stare različice kode so združljive z novejšo bazo.

## Varnostne kopije
Račune je treba hraniti (zakon). V Supabase vklopi **dnevne varnostne kopije / obnovitev na točko v času** in občasno preveri, da obnova deluje.

## Pogoste napake
| Pojav | Vzrok | Rešitev |
|---|---|---|
| "Certifikat ni naložen" | v produkciji ni aktivnega potrdila | naloži v Nastavitve → Certifikat |
| "CERTIFICATE_ENCRYPTION_KEY ni nastavljen" | manjka spremenljivka v Vercelu | nastavi (isti ključ kot ob nalaganju potrdil) in naredi redeploy |
| Potrdilo se ne dešifrira | ključ se je spremenil | vrni stari ključ ali potrdilo naloži znova |
| E-pošta ne pride k stranki | `RESEND_TEST_TO` je nastavljen | odstrani spremenljivko v produkciji |
| Portal ne more klicati API-ja | `PORTAL_ORIGINS` ne vsebuje naslova portala | dodaj izvor (brez poti in poševnice) in redeploy |
| Vercel deploy javi napako o cronu | paket Hobby ne dovoli pogostejšega od dnevnega | cron v `vercel.json` ostane dnevni, pogostejše klice naredi n8n |
