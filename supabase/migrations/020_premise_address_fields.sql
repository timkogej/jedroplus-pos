-- FURS BusinessPremiseRequest requires HouseNumber as a separate field
-- (S001 schema error when missing). Split it out of the combined address.
alter table pos_premises
  add column if not exists house_number text,
  add column if not exists house_number_additional text;

-- Backfill existing rows: "Prešernova cesta 21A" → address="Prešernova cesta",
-- house_number="21", house_number_additional="A"
update pos_premises
set
  house_number = (regexp_match(address, '^(.+?)\s+(\d+)([A-Za-z]?)\s*$'))[2],
  house_number_additional = nullif((regexp_match(address, '^(.+?)\s+(\d+)([A-Za-z]?)\s*$'))[3], ''),
  address = (regexp_match(address, '^(.+?)\s+(\d+)([A-Za-z]?)\s*$'))[1]
where house_number is null
  and address ~ '^.+?\s+\d+[A-Za-z]?\s*$';
