-- =====================================================================
-- 009 · AUTOMATIC TRANSLATION  (additive, safe to re-run, no existing data is changed)
-- Run in: Supabase > SQL Editor.
--
-- English written in the admin panel stays the only source. Translations are
-- cached here, keyed by a hash of the exact English text:
--   * change the English text and its hash changes, so the old translation is
--     simply no longer found and a fresh one is made;
--   * an administrator can override any translation (is_override = true) and the
--     machine will never write over it.
-- Visitors can only READ finished translations. Only the Edge Function (service
-- role) writes machine translations, and only signed-in staff can write overrides.
-- =====================================================================

create table if not exists public.translations (
  id          bigint generated always as identity primary key,
  lang        text        not null check (lang ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$' and lang <> 'en'),
  src_hash    text        not null check (length(src_hash) between 8 and 64),
  source      text        not null check (length(source) <= 4000),
  text        text,
  status      text        not null default 'ok' check (status in ('ok','failed')),
  is_override boolean     not null default false,
  provider    text,
  error       text,
  attempts    int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (lang, src_hash)
);
create index if not exists translations_lang_status_idx on public.translations (lang, status);

create table if not exists public.translation_usage (
  day      date not null default current_date,
  provider text not null,
  lang     text not null,
  requests int  not null default 0,
  chars    int  not null default 0,
  errors   int  not null default 0,
  primary key (day, provider, lang)
);

alter table public.translations      enable row level security;
alter table public.translation_usage enable row level security;

drop policy if exists tr_read_public on public.translations;
create policy tr_read_public on public.translations for select to anon, authenticated
  using (status = 'ok' and text is not null);

drop policy if exists tr_staff_read on public.translations;
create policy tr_staff_read on public.translations for select to authenticated using (public.can_write());
drop policy if exists tr_staff_write on public.translations;
create policy tr_staff_write on public.translations for insert to authenticated with check (public.can_write() and is_override);
drop policy if exists tr_staff_update on public.translations;
create policy tr_staff_update on public.translations for update to authenticated using (public.can_write()) with check (public.can_write());
drop policy if exists tr_staff_delete on public.translations;
create policy tr_staff_delete on public.translations for delete to authenticated using (public.is_admin());

drop policy if exists tu_staff_read on public.translation_usage;
create policy tu_staff_read on public.translation_usage for select to authenticated using (public.is_admin());

grant select on public.translations to anon, authenticated;
grant insert, update, delete on public.translations to authenticated;
grant select on public.translation_usage to authenticated;
