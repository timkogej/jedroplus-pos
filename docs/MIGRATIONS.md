# Migracije

Zaženi jih **po vrsti** v Supabase → SQL Editor. Vse so napisane tako, da jih je varno zagnati večkrat (`if not exists`, `create or replace`).

> Opomba: SQL Editor izvede celoten vnos kot **eno transakcijo**. Če ena vrstica pade, se razveljavi vse — napaka ne pusti polovično izvedene migracije.

| # | Datoteka | Kaj naredi |
|---|---|---|
| — | `pos_company_data.sql` | tabela s podatki podjetja za glavo računa |
| 001 | `001_pos_tables.sql` | osnovne tabele: nastavitve, potrdila, prostori, naprave, računi, postavke |
| 002 | `002_fix_appointment_id_type.sql` | tip ID termina |
| 003 | `003_invoices_storage.sql` | bucket `invoices` (od 022/026 brez javnega pisanja in zaseben) |
| 004–006 | `…print_format`, `…brand_second`, `…owner_email` | manjše razširitve nastavitev |
| 007 | `007_auth_and_invoice_format.sql` | format številke računa; funkcija za števec (**nadomeščena z 024**) |
| 008 | `008_storno.sql` | stolpci za storno (`is_storno`, `storno_of`, `storno_invoice_id`) |
| 009–010 | `…stripe_payment_intent`, `…stripe_connect_status` | Stripe polja |
| 011 | `011_pos_settings_unique.sql` | ena vrstica nastavitev na podjetje |
| 012 | `012_online_premise_device.sql` | prostor/naprava za spletna plačila |
| 013 | `013_security_rls.sql` | RLS po podjetju (**zožano z 022**) |
| 014 | `014_unique_appointment_invoice.sql` | en račun na termin. ⚠️ **Izbriše podvojene fiskalne račune** — ne zaganjaj na bazi z resničnimi podatki, ne da bi pogledal, kaj bo pobrisano |
| 015 | `015_pos_subscriptions.sql` | naročnine |
| 016 | `016_z_reports.sql` | Z-poročila + bucket `z-reports` |
| 017 | `017_loyalty_points.sql` | zvestobne točke (knjiga gibanj) in nastavitve |
| 018 | `018_furs_retry.sql` | stolpca za ponovno pošiljanje FURS |
| 019–021 | `…furs_premise_registration`, `…premise_address_fields`, `…premise_cadastral_data` | registracija prostora pri FURS, naslov, katastrski podatki |
| 022 | `022_security_hardening.sql` | zaklenjena storage pravila, RLS samo za branje, potrdila samo strežniku, **nespremenljivi računi** |
| 023 | `023_invoice_counter.sql` | `invoice_counter` (goli števec za ZOI/FURS), en storno na račun |
| 024 | `024_fix_invoice_counter_function.sql` | pravilna funkcija števca (vrne število), stolpci formata, zaklep vrstice |
| 025 | `025_loyalty_redeem_and_attention.sql` | atomarno unovčenje točk, tabela opozoril za pregled |
| 026 | `026_private_pdf_buckets.sql` | **zasebna** bucketa za PDF-je |
| 027 | `027_nonfiscal_numbering.sql` | ločeno številčenje (N) za račune z nakazilom |
| 028 | `028_premise_closure.sql` | trajno zaprtje poslovnega prostora |
| 029 | `029_rate_limit_and_zreport_number.sql` | skupna omejitev zahtev, unikatna številka Z-poročila |

## Vrstni red glede na objavo kode

- **Pred objavo kode** zaženi: 022, 023, 024, 025, 027, 028, 029 (koda piše v nove stolpce in kliče nove funkcije).
- **Po objavi kode** zaženi: **026** (zasebni bucket). Če ga zaženeš prej, stare javne povezave na PDF prenehajo delovati, preden jih nova koda zna podpisati.

## Preverjanje, da je baza usklajena s kodo

```sql
select
  (select count(*) from information_schema.columns where table_name='pos_invoices'
     and column_name in ('stripe_payment_intent_id','furs_retry_count','is_storno','invoice_counter')) as invoice_cols_expected_4,
  (select count(*) from information_schema.columns where table_name='pos_settings'
     and column_name in ('invoice_format','loyalty_enabled','stripe_account_id','online_premise_id','furs_environment','nonfiscal_counter')) as settings_cols_expected_6,
  (select count(*) from information_schema.columns where table_name='pos_premises'
     and column_name in ('house_number','cadastral_number','furs_closed')) as premise_cols_expected_3,
  pg_get_function_result('increment_invoice_counter(uuid,integer)'::regprocedure) as counter_returns_integer,
  to_regclass('pos_attention_items') is not null as has_attention,
  to_regclass('pos_rate_limits') is not null as has_rate_limits;
```
