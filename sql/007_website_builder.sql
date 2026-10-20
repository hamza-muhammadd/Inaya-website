-- =====================================================================
-- 007 · WEBSITE BUILDER  (additive, safe to re-run, no data is changed or deleted)
-- Run in: Supabase → SQL Editor. Test on a staging project first.
--
-- What it adds
--   pages.archived        hide a page without deleting it
--   pages.draft_meta      per-page settings saved as DRAFT (title, SEO, menu, ...)
--   pages.show_in_nav     show the page in the public menu
--   pages.nav_label       menu text (falls back to the title)
--   pages.nav_order       menu position (low = first)
--   pages.noindex         ask search engines not to index the page
--   pages.is_system       protects built-in pages (home/about/privacy/terms)
--   page_templates        reusable page layouts saved by admins
--   public_pages view     now also exposes menu/noindex fields (published + not archived only)
-- It does NOT touch: existing rows, RLS policies on other tables, storage, users.
-- Built-in templates (Blank, Landing, Info, Programs…) live in the admin code,
-- so this file seeds nothing.
-- =====================================================================

alter table public.pages add column if not exists archived     boolean     not null default false;
alter table public.pages add column if not exists draft_meta   jsonb;
alter table public.pages add column if not exists show_in_nav  boolean     not null default false;
alter table public.pages add column if not exists nav_label    text;
alter table public.pages add column if not exists nav_order    int         not null default 100;
alter table public.pages add column if not exists noindex      boolean     not null default false;
alter table public.pages add column if not exists is_system    boolean     not null default false;

update public.pages set is_system = true where slug in ('home','about','privacy','terms');

-- slug format guard for NEW pages only (existing rows already comply). NOT VALID = existing rows are not re-checked.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pages_slug_format') then
    alter table public.pages add constraint pages_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;
  end if;
end $$;

-- public view: same columns as before (same order) + new ones appended; unchanged security model.
create or replace view public.public_pages as
  select slug, title, seo_title, seo_description, og_image,
         published_sections as sections, published_at,
         show_in_nav, nav_label, nav_order, noindex
  from public.pages
  where status = 'published' and archived = false;
grant select on public.public_pages to anon, authenticated;

-- reusable templates
create table if not exists public.page_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  sections    jsonb not null default '[]'::jsonb,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
alter table public.page_templates enable row level security;
drop policy if exists templates_admin_read  on public.page_templates;
drop policy if exists templates_admin_write on public.page_templates;
create policy templates_admin_read  on public.page_templates for select to authenticated using (public.is_admin());
create policy templates_admin_write on public.page_templates for all    to authenticated using (public.can_write()) with check (public.can_write());
-- no anon access to templates.
