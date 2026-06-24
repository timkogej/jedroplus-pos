alter table pos_settings
  add column if not exists print_format text default 'ask'; -- 'a4', 'thermal', 'ask'
