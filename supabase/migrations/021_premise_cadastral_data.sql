-- FURS BusinessPremiseRequest (fu:PropertyID) requires the real cadastral
-- data for a fixed premise (katastrska občina / št. stavbe / del stavbe,
-- from e-prostor.gov.si) — previously hardcoded to the placeholder 1,1,1.
alter table pos_premises
  add column if not exists cadastral_number text,
  add column if not exists building_number text,
  add column if not exists building_section_number text;

-- Backfill PS1 with its real cadastral data.
update pos_premises
set
  cadastral_number = '1938',
  building_number = '2306',
  building_section_number = '1'
where premise_id = 'PS1'
  and cadastral_number is null;
