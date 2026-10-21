-- =====================================================================
-- INAYA QURAN ACADEMY, Supabase schema (run ONCE in SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. ADMIN USERS & ROLES
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'owner'
             check (role in ('owner','administrator','assessor','teacher','readonly')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.admin_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admin_users where user_id = auth.uid();
$$;

-- helper: can write (everything except readonly)
create or replace function public.can_write()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users
                 where user_id = auth.uid() and role in ('owner','administrator','assessor'));
$$;

alter table public.admin_users enable row level security;
drop policy if exists admin_users_self on public.admin_users;
create policy admin_users_self on public.admin_users
  for select to authenticated using (user_id = auth.uid());
-- (no insert/update/delete policies: admins are added only via SQL Editor)

-- ---------------------------------------------------------------------
-- 2. GLOBAL SITE SETTINGS (single row)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, data) values (1, jsonb_build_object(
  'academy_name','Inaya Quran Academy',
  'tagline','Learn · Practice · Grow',
  'logo_url','assets/img/logo.png',
  'favicon_url','',
  'colors', jsonb_build_object('primary','#0F4C3A','accent','#B8975A','background','#FBF7EE','text','#26312C'),
  'font','Inter',
  'contact_email','',
  'whatsapp_number','',
  'whatsapp_message','Assalamu Alaikum. I would like to know more about Inaya Quran Academy''s Quran learning programs and free assessment.',
  'response_time','',
  'social', jsonb_build_object('facebook','','instagram','','telegram','','youtube',''),
  'nav', jsonb_build_array(
     jsonb_build_object('label','Home','href','/'),
     jsonb_build_object('label','Programs','href','/programs'),
     jsonb_build_object('label','About','href','/about'),
     jsonb_build_object('label','FAQ','href','/faq'),
     jsonb_build_object('label','Contact','href','/contact')),
  'cta_primary_label','Book a Free Assessment',
  'cta_primary_href','/assessment',
  'cta_secondary_label','Explore Our Programs',
  'cta_secondary_href','/programs',
  'footer_text','Structured Quran learning with care, for every age and level.',
  'copyright','© Inaya Quran Academy. All rights reserved.',
  'seo_title','Inaya Quran Academy, Online Quran Learning',
  'seo_description','Structured online Quran programs: reading & fluency, Tajweed & recitation, and Islamic foundations. Book a free assessment.',
  'og_image','assets/img/og-default.jpg',
  'site_url','https://inayaquran.com',
  'assessment_success','JazakAllahu khairan! We have received your request. Our team will contact you soon, InshaAllah.',
  'contact_success','JazakAllahu khairan! Your message has been sent. We will reply as soon as possible.',
  'analytics', jsonb_build_object('provider','none','ga4_id','','plausible_domain','')
)) on conflict (id) do nothing;

alter table public.site_settings enable row level security;
drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select to anon, authenticated using (true);
drop policy if exists settings_admin_write on public.site_settings;
create policy settings_admin_write on public.site_settings for all to authenticated
  using (public.can_write()) with check (public.can_write());

-- ---------------------------------------------------------------------
-- 3. PAGES (draft vs published sections)
-- ---------------------------------------------------------------------
create table if not exists public.pages (
  slug               text primary key,
  title              text not null,
  seo_title          text,
  seo_description    text,
  og_image           text,
  status             text not null default 'published' check (status in ('draft','published')),
  draft_sections     jsonb not null default '[]'::jsonb,
  published_sections jsonb not null default '[]'::jsonb,
  has_unpublished    boolean not null default false,
  updated_at         timestamptz not null default now(),
  published_at       timestamptz
);

alter table public.pages enable row level security;
drop policy if exists pages_admin_all on public.pages;
drop policy if exists pages_admin_all_read on public.pages;
drop policy if exists pages_admin_all_write on public.pages;
create policy pages_admin_all_read on public.pages for select to authenticated using (public.is_admin());
create policy pages_admin_all_write on public.pages for all to authenticated using (public.can_write()) with check (public.can_write());
-- anon has NO access to the table (so drafts never leak). Public reads use the view below.

create or replace view public.public_pages as
  select slug, title, seo_title, seo_description, og_image,
         published_sections as sections, published_at
  from public.pages where status = 'published';
grant select on public.public_pages to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. PROGRAMS, LEVELS, CURRICULUM
-- ---------------------------------------------------------------------
create table if not exists public.programs (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  title               text not null,
  short_description   text not null default '',
  description         text not null default '',
  objectives          jsonb not null default '[]'::jsonb,
  student_profile     text not null default '',
  curriculum_overview text not null default '',
  cta_label           text not null default 'Book a Free Assessment',
  image_url           text not null default '',
  sort_order          int  not null default 0,
  status              text not null default 'draft' check (status in ('draft','published','archived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.program_levels (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  level_number int  not null check (level_number > 0),
  title        text not null,
  description  text not null default '',
  sort_order   int  not null default 0,
  status       text not null default 'published' check (status in ('draft','published','archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_levels_program on public.program_levels(program_id, sort_order);

-- Curriculum is academic content: ADMIN ONLY, separate from public marketing text
create table if not exists public.curriculum_modules (
  id          uuid primary key default gen_random_uuid(),
  level_id    uuid not null references public.program_levels(id) on delete cascade,
  title       text not null,
  description text not null default '',
  lessons     jsonb not null default '[]'::jsonb,       -- [{title, description}]
  assessment_criteria text not null default '',
  sort_order  int not null default 0,
  status      text not null default 'draft' check (status in ('draft','published','archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_modules_level on public.curriculum_modules(level_id, sort_order);

alter table public.programs enable row level security;
alter table public.program_levels enable row level security;
alter table public.curriculum_modules enable row level security;

drop policy if exists programs_public on public.programs;
create policy programs_public on public.programs for select to anon, authenticated using (status = 'published');
drop policy if exists programs_admin on public.programs;
drop policy if exists programs_admin_read on public.programs;
drop policy if exists programs_admin_write on public.programs;
create policy programs_admin_read on public.programs for select to authenticated using (public.is_admin());
create policy programs_admin_write on public.programs for all to authenticated using (public.can_write()) with check (public.can_write());

drop policy if exists levels_public on public.program_levels;
create policy levels_public on public.program_levels for select to anon, authenticated using (status = 'published');
drop policy if exists levels_admin on public.program_levels;
drop policy if exists levels_admin_read on public.program_levels;
drop policy if exists levels_admin_write on public.program_levels;
create policy levels_admin_read on public.program_levels for select to authenticated using (public.is_admin());
create policy levels_admin_write on public.program_levels for all to authenticated using (public.can_write()) with check (public.can_write());

drop policy if exists modules_admin on public.curriculum_modules;
drop policy if exists modules_admin_read on public.curriculum_modules;
drop policy if exists modules_admin_write on public.curriculum_modules;
create policy modules_admin_read on public.curriculum_modules for select to authenticated using (public.is_admin());
create policy modules_admin_write on public.curriculum_modules for all to authenticated using (public.can_write()) with check (public.can_write());

-- ---------------------------------------------------------------------
-- 5. FAQ
-- ---------------------------------------------------------------------
create table if not exists public.faqs (
  id         uuid primary key default gen_random_uuid(),
  category   text not null default 'General',
  question   text not null,
  answer     text not null,
  sort_order int  not null default 0,
  published  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.faqs enable row level security;
drop policy if exists faqs_public on public.faqs;
create policy faqs_public on public.faqs for select to anon, authenticated using (published);
drop policy if exists faqs_admin on public.faqs;
drop policy if exists faqs_admin_read on public.faqs;
drop policy if exists faqs_admin_write on public.faqs;
create policy faqs_admin_read on public.faqs for select to authenticated using (public.is_admin());
create policy faqs_admin_write on public.faqs for all to authenticated using (public.can_write()) with check (public.can_write());

-- ---------------------------------------------------------------------
-- 6. LEADS (private) + audit trail
-- ---------------------------------------------------------------------
create sequence if not exists public.lead_seq start 1001;

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  lead_code       text unique not null default ('IQA-' || nextval('public.lead_seq')),
  name            text not null,
  student_name    text,
  email           text,
  whatsapp        text,
  age_group       text,
  country         text,
  program_interest text,
  goal            text,
  reading_level   text,
  contact_method  text,
  preferred_time  text,
  consent         boolean not null default false,
  source          text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  landing_page    text,
  status          text not null default 'New' check (status in
                  ('New','Contacted','Assessment Scheduled','Assessment Completed',
                   'Follow-up Required','Enrollment Pending','Enrollment Confirmed','Not Proceeding')),
  internal_notes  text not null default '',
  follow_up_date  date,
  last_contacted_at timestamptz,
  assigned_to     uuid references auth.users(id) on delete set null,
  submission_key  text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint leads_contact_chk check (coalesce(email,'') <> '' or coalesce(whatsapp,'') <> '')
);
create index if not exists idx_leads_status  on public.leads(status);
create index if not exists idx_leads_created on public.leads(created_at desc);
create index if not exists idx_leads_followup on public.leads(follow_up_date) where follow_up_date is not null;

create table if not exists public.lead_events (
  id          bigserial primary key,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  actor       uuid,
  event_type  text not null,
  from_status text,
  to_status   text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_lead_events_lead on public.lead_events(lead_id, created_at desc);

create or replace function public.trg_lead_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into lead_events(lead_id, actor, event_type, to_status, note)
    values (new.id, auth.uid(), 'created', new.status, 'Lead submitted via website');
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.status is distinct from old.status then
      insert into lead_events(lead_id, actor, event_type, from_status, to_status)
      values (new.id, auth.uid(), 'status_change', old.status, new.status);
      if new.status = 'Contacted' then new.last_contacted_at := now(); end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists leads_audit_ins on public.leads;
create trigger leads_audit_ins after insert on public.leads
  for each row execute function public.trg_lead_audit();
drop trigger if exists leads_audit_upd on public.leads;
create trigger leads_audit_upd before update on public.leads
  for each row execute function public.trg_lead_audit();
-- the status-change event is inserted in the BEFORE UPDATE trigger above (lead row already exists)

alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
drop policy if exists leads_admin on public.leads;
drop policy if exists leads_admin_read on public.leads;
drop policy if exists leads_admin_write on public.leads;
create policy leads_admin_read on public.leads for select to authenticated using (public.is_admin());
create policy leads_admin_write on public.leads for all to authenticated using (public.can_write()) with check (public.can_write());
drop policy if exists lead_events_admin on public.lead_events;
create policy lead_events_admin on public.lead_events for select to authenticated using (public.is_admin());
-- no anon policies at all: visitors can only call submit_lead()

-- Public submission function (validated, de-duplicated, rate-limited)
create or replace function public.submit_lead(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := left(btrim(coalesce(payload->>'name','')), 120);
  v_email text := left(lower(btrim(coalesce(payload->>'email',''))), 200);
  v_wa text := left(regexp_replace(coalesce(payload->>'whatsapp',''), '[^0-9+]', '', 'g'), 20);
  v_key text := left(coalesce(payload->>'submission_key',''), 80);
  v_existing text;
  v_recent int;
  v_code text;
begin
  if coalesce(payload->>'website','') <> '' then            -- honeypot filled => bot
    return jsonb_build_object('ok', true, 'lead_code', 'IQA-0');
  end if;
  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if v_email = '' and v_wa = '' then raise exception 'contact_required'; end if;
  if v_email <> '' and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if v_wa <> '' and length(regexp_replace(v_wa,'\D','','g')) < 7 then raise exception 'invalid_whatsapp'; end if;
  if coalesce((payload->>'consent')::boolean, false) is not true then raise exception 'consent_required'; end if;

  -- idempotency: same submission key => return the existing lead
  if v_key <> '' then
    select lead_code into v_existing from leads where submission_key = v_key;
    if found then return jsonb_build_object('ok', true, 'lead_code', v_existing, 'duplicate', true); end if;
  end if;

  -- same contact within 10 minutes => treat as duplicate
  select lead_code into v_existing from leads
   where created_at > now() - interval '10 minutes'
     and ((v_email <> '' and email = v_email) or (v_wa <> '' and whatsapp = v_wa))
   limit 1;
  if found then return jsonb_build_object('ok', true, 'lead_code', v_existing, 'duplicate', true); end if;

  -- global flood guard
  select count(*) into v_recent from leads where created_at > now() - interval '1 minute';
  if v_recent >= 20 then raise exception 'rate_limited'; end if;

  insert into leads(name, student_name, email, whatsapp, age_group, country, program_interest, goal,
                    reading_level, contact_method, preferred_time, consent, source,
                    utm_source, utm_medium, utm_campaign, utm_content, landing_page, submission_key)
  values (v_name,
          left(nullif(btrim(payload->>'student_name'),''),120),
          nullif(v_email,''), nullif(v_wa,''),
          left(nullif(payload->>'age_group',''),40),
          left(nullif(payload->>'country',''),80),
          left(nullif(payload->>'program_interest',''),120),
          left(nullif(payload->>'goal',''),1500),
          left(nullif(payload->>'reading_level',''),80),
          left(nullif(payload->>'contact_method',''),40),
          left(nullif(payload->>'preferred_time',''),120),
          true,
          left(coalesce(nullif(payload->>'source',''),'website'),60),
          left(nullif(payload->>'utm_source',''),80),
          left(nullif(payload->>'utm_medium',''),80),
          left(nullif(payload->>'utm_campaign',''),120),
          left(nullif(payload->>'utm_content',''),120),
          left(nullif(payload->>'landing_page',''),200),
          nullif(v_key,''))
  returning lead_code into v_code;

  return jsonb_build_object('ok', true, 'lead_code', v_code);
end $$;
revoke all on function public.submit_lead(jsonb) from public;
grant execute on function public.submit_lead(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. CONTACT MESSAGES (private)
-- ---------------------------------------------------------------------
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  whatsapp   text,
  message    text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
drop policy if exists contact_admin on public.contact_messages;
drop policy if exists contact_admin_read on public.contact_messages;
drop policy if exists contact_admin_write on public.contact_messages;
create policy contact_admin_read on public.contact_messages for select to authenticated using (public.is_admin());
create policy contact_admin_write on public.contact_messages for all to authenticated using (public.can_write()) with check (public.can_write());

create or replace function public.submit_contact(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := left(btrim(coalesce(payload->>'name','')),120);
  v_email text := left(lower(btrim(coalesce(payload->>'email',''))),200);
  v_wa text := left(regexp_replace(coalesce(payload->>'whatsapp',''),'[^0-9+]','','g'),20);
  v_msg text := left(btrim(coalesce(payload->>'message','')),3000);
begin
  if coalesce(payload->>'website','') <> '' then return jsonb_build_object('ok', true); end if;
  if length(v_name) < 2 or length(v_msg) < 5 then raise exception 'invalid_input'; end if;
  if v_email = '' and v_wa = '' then raise exception 'contact_required'; end if;
  if v_email <> '' and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if (select count(*) from contact_messages where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limited';
  end if;
  insert into contact_messages(name,email,whatsapp,message)
  values (v_name, nullif(v_email,''), nullif(v_wa,''), v_msg);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.submit_contact(jsonb) from public;
grant execute on function public.submit_contact(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. ASSESSMENTS (private, separate from public form)
-- ---------------------------------------------------------------------
create table if not exists public.assessments (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid not null references public.leads(id) on delete cascade,
  assessor_id      uuid references auth.users(id) on delete set null,
  assessor_name    text,
  assessed_on      date not null default current_date,
  skills           jsonb not null default '{}'::jsonb,
  -- skills: {harakat_words, connected_letters, sukun, tanwin, shaddah, madd, quran_reading}
  -- each value in: Strong | Developing | Needs Support | Not Yet Learned
  observations     text not null default '',
  difficulties     text not null default '',
  recommended_level text not null default '',
  next_goal        text not null default '',
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_assess_lead on public.assessments(lead_id, assessed_on desc);
alter table public.assessments enable row level security;
drop policy if exists assess_admin on public.assessments;
drop policy if exists assess_admin_read on public.assessments;
drop policy if exists assess_admin_write on public.assessments;
create policy assess_admin_read on public.assessments for select to authenticated using (public.is_admin());
create policy assess_admin_write on public.assessments for all to authenticated using (public.can_write()) with check (public.can_write());

-- ---------------------------------------------------------------------
-- 9. ENROLLMENTS (private)
-- Flow: Enrollment Confirmed → Payment Pending → Payment Received →
--       Teacher Assignment → Class Scheduling → ACTIVE
-- ---------------------------------------------------------------------
create table if not exists public.enrollments (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads(id) on delete cascade,
  program_id    uuid references public.programs(id) on delete set null,
  level_id      uuid references public.program_levels(id) on delete set null,
  status        text not null default 'Enrollment Confirmed' check (status in
                ('Enrollment Confirmed','Payment Pending','Payment Received',
                 'Teacher Assignment','Class Scheduling','ACTIVE')),
  payment_note  text not null default '',   -- manual verification note only; no card data
  teacher_name  text not null default '',
  schedule_note text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_enroll_status on public.enrollments(status);
alter table public.enrollments enable row level security;
drop policy if exists enroll_admin on public.enrollments;
drop policy if exists enroll_admin_read on public.enrollments;
drop policy if exists enroll_admin_write on public.enrollments;
create policy enroll_admin_read on public.enrollments for select to authenticated using (public.is_admin());
create policy enroll_admin_write on public.enrollments for all to authenticated using (public.can_write()) with check (public.can_write());

-- ---------------------------------------------------------------------
-- 10. MEDIA LIBRARY
-- ---------------------------------------------------------------------
create table if not exists public.media_assets (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  alt_text   text not null default '',
  path       text not null unique,       -- path inside storage bucket 'media'
  url        text not null,
  mime       text not null,
  size_bytes int  not null,
  created_at timestamptz not null default now()
);
alter table public.media_assets enable row level security;
drop policy if exists media_public_read on public.media_assets;
create policy media_public_read on public.media_assets for select to anon, authenticated using (true);
drop policy if exists media_admin on public.media_assets;
create policy media_admin on public.media_assets for all to authenticated
  using (public.can_write()) with check (public.can_write());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media','media', true, 5242880, array['image/png','image/jpeg','image/webp','image/x-icon','image/vnd.microsoft.icon'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/x-icon','image/vnd.microsoft.icon'];

drop policy if exists "media objects public read" on storage.objects;
create policy "media objects public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');
drop policy if exists "media objects admin write" on storage.objects;
create policy "media objects admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.can_write());
drop policy if exists "media objects admin update" on storage.objects;
create policy "media objects admin update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.can_write());
drop policy if exists "media objects admin delete" on storage.objects;
create policy "media objects admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.can_write());

-- ---------------------------------------------------------------------
-- 11. FIRST-PARTY CTA EVENTS (no personal data)
-- ---------------------------------------------------------------------
create table if not exists public.cta_events (
  id           bigserial primary key,
  event        text not null check (event in
               ('page_view','program_view','assessment_cta_click','assessment_form_start',
                'assessment_submitted','whatsapp_click','contact_submitted')),
  page         text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_cta_events on public.cta_events(event, created_at desc);
alter table public.cta_events enable row level security;
drop policy if exists cta_admin_read on public.cta_events;
create policy cta_admin_read on public.cta_events for select to authenticated using (public.is_admin());

create or replace function public.track_event(p_event text, p_page text default null,
  p_source text default null, p_medium text default null, p_campaign text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event not in ('page_view','program_view','assessment_cta_click','assessment_form_start',
                     'assessment_submitted','whatsapp_click','contact_submitted') then return; end if;
  if (select count(*) from cta_events where created_at > now() - interval '1 minute') >= 600 then return; end if;
  insert into cta_events(event,page,utm_source,utm_medium,utm_campaign)
  values (p_event, left(p_page,120), left(p_source,80), left(p_medium,80), left(p_campaign,120));
end $$;
revoke all on function public.track_event(text,text,text,text,text) from public;
grant execute on function public.track_event(text,text,text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 12. DASHBOARD METRICS (admin only, one call)
-- ---------------------------------------------------------------------
create or replace function public.dashboard_metrics(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'total',        count(*),
    'new',          count(*) filter (where status='New'),
    'contacted',    count(*) filter (where status='Contacted'),
    'assess_sched', count(*) filter (where status='Assessment Scheduled'),
    'assess_done',  count(*) filter (where status='Assessment Completed'),
    'followup',     count(*) filter (where status='Follow-up Required'),
    'enroll_pending',   count(*) filter (where status='Enrollment Pending'),
    'enroll_confirmed', count(*) filter (where status='Enrollment Confirmed'),
    'not_proceeding',   count(*) filter (where status='Not Proceeding')
  ) into r
  from leads
  where (p_from is null or created_at >= p_from) and (p_to is null or created_at < p_to);
  return r;
end $$;
revoke all on function public.dashboard_metrics(timestamptz,timestamptz) from public;
grant execute on function public.dashboard_metrics(timestamptz,timestamptz) to authenticated;


-- ---------------------------------------------------------------------
-- 12b. ANALYTICS SUMMARY (admin only; first-party counts, no personal data)
-- ---------------------------------------------------------------------
create or replace function public.analytics_summary(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(jsonb_build_object('event', event, 'n', n)) from (
        select event, count(*) n from cta_events
        where (p_from is null or created_at >= p_from) and (p_to is null or created_at < p_to)
        group by event) e), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(row_to_json(c)) from (
        select coalesce(ev.campaign, ld.campaign) as campaign, coalesce(ev.source, ld.source) as source,
               coalesce(ev.medium, ld.medium) as medium,
               coalesce(ev.page_views,0) page_views, coalesce(ev.cta_clicks,0) cta_clicks,
               coalesce(ev.whatsapp_clicks,0) whatsapp_clicks, coalesce(ev.submissions,0) submissions,
               coalesce(ld.leads,0) leads
        from (select coalesce(utm_campaign,'') campaign, coalesce(utm_source,'') source, coalesce(utm_medium,'') medium,
                     count(*) filter (where event='page_view') page_views,
                     count(*) filter (where event='assessment_cta_click') cta_clicks,
                     count(*) filter (where event='whatsapp_click') whatsapp_clicks,
                     count(*) filter (where event='assessment_submitted') submissions
              from cta_events
              where (utm_campaign is not null or utm_source is not null)
                and (p_from is null or created_at >= p_from) and (p_to is null or created_at < p_to)
              group by 1,2,3) ev
        full join (select coalesce(utm_campaign,'') campaign, coalesce(utm_source,'') source, coalesce(utm_medium,'') medium, count(*) leads
              from leads
              where (utm_campaign is not null or utm_source is not null)
                and (p_from is null or created_at >= p_from) and (p_to is null or created_at < p_to)
              group by 1,2,3) ld
          on ev.campaign = ld.campaign and ev.source = ld.source and ev.medium = ld.medium
        order by 8 desc nulls last, 4 desc) c), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.analytics_summary(timestamptz,timestamptz) from public;
grant execute on function public.analytics_summary(timestamptz,timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 13. SEED CONTENT (official program structure, names are exact)
-- Descriptions use only wording from the academy flyer; edit in /admin.
-- ---------------------------------------------------------------------
insert into public.programs (slug,title,short_description,description,objectives,student_profile,curriculum_overview,sort_order,status) values
('quran-reading-fluency','Quran Reading & Fluency',
 'From letters to fluency, one step at a time.',
 'A structured path that takes a learner from the Arabic letters to confident, fluent Quran reading, one clear level at a time.',
 '["Recognise and read the Arabic letters and their vowel marks","Read connected words and verses with growing accuracy","Build steady, fluent reading"]',
 'Beginners and learners who want to strengthen their Quran reading, children and adults.',
 'Three levels: Reading Foundations, Connected Quran Reading and Reading Fluency. Detailed curriculum is being finalised by the academy.',
 1,'published'),
('quran-recitation-tajweed-sunnah','Quran Recitation, Tajweed & Sunnah',
 'Right pronunciation. Beautiful recitation.',
 'Learn the essential rules of Tajweed, apply them in recitation, and grow towards confident, beautiful recitation.',
 '["Pronounce letters correctly","Learn and apply the essential rules of Tajweed","Recite with confidence"]',
 'Learners who can read the Quran and want to improve their pronunciation and recitation.',
 'Three levels: Essential Tajweed, Applied Tajweed and Confident Recitation. Detailed curriculum is being finalised by the academy.',
 2,'published'),
('islamic-foundations-daily-living','Islamic Foundations & Daily Living',
 'Build character. Live with purpose.',
 'Practical Islamic learning that builds foundations, helps learners practise worship and Sunnah, and shapes character in daily life.',
 '["Understand core Islamic foundations","Practise worship and Sunnah","Build Islamic character for everyday life"]',
 'Children and adults who want structured, practical Islamic learning.',
 'Three levels: My Islamic Foundations, Worship & Sunnah in Practice and Islamic Character & Daily Life. Detailed curriculum is being finalised by the academy.',
 3,'published')
on conflict (slug) do nothing;

insert into public.program_levels (program_id, level_number, title, sort_order)
select p.id, v.n, v.t, v.n from public.programs p
join (values
 ('quran-reading-fluency',1,'Reading Foundations'),
 ('quran-reading-fluency',2,'Connected Quran Reading'),
 ('quran-reading-fluency',3,'Reading Fluency'),
 ('quran-recitation-tajweed-sunnah',1,'Essential Tajweed'),
 ('quran-recitation-tajweed-sunnah',2,'Applied Tajweed'),
 ('quran-recitation-tajweed-sunnah',3,'Confident Recitation'),
 ('islamic-foundations-daily-living',1,'My Islamic Foundations'),
 ('islamic-foundations-daily-living',2,'Worship & Sunnah in Practice'),
 ('islamic-foundations-daily-living',3,'Islamic Character & Daily Life')
) as v(slug,n,t) on v.slug = p.slug
where not exists (select 1 from public.program_levels l where l.program_id = p.id and l.level_number = v.n);

insert into public.faqs (category,question,answer,sort_order)
select * from (values
 ('General','What is the free assessment?','It is a short conversation and reading check with our assessor so we can understand your current level and recommend a suitable starting point. Request it from the Free Assessment page.',1),
 ('General','Who can join?','Children and adults of every age and level. Share the learner''s age group and goals in the assessment form so we can guide you properly.',2),
 ('General','How do classes take place?','Classes are online. Please contact us for the current class options and availability.',3),
 ('Enrollment','How does enrollment work?','1) Request a free assessment. 2) Our team contacts you. 3) The assessor evaluates the learner and recommends a level. 4) If you wish to proceed, we confirm enrollment, arrange payment, assign a teacher and schedule classes.',4),
 ('Enrollment','What are the fees?','Please contact us via WhatsApp or the contact page for current fee information.',5)
) as t(c,q,a,o)
where not exists (select 1 from public.faqs);

-- Pages seed (sections are rendered by the site; edit in /admin → Website Content)
insert into public.pages (slug,title,seo_title,seo_description,status,draft_sections,published_sections,published_at) values
('home','Home','Inaya Quran Academy, Quran Learning Made Simple',
 'Structured online Quran programs with caring teachers. Book a free assessment with Inaya Quran Academy.','published',
 '[]','[]',now()),
('about','About','About Inaya Quran Academy','Learn about Inaya Quran Academy and our approach to structured Quran learning.','published','[]','[]',now()),
('privacy','Privacy Policy','Privacy Policy, Inaya Quran Academy','How Inaya Quran Academy handles your information.','published','[]','[]',now()),
('terms','Terms of Use','Terms of Use, Inaya Quran Academy','Terms for using the Inaya Quran Academy website.','published','[]','[]',now())
on conflict (slug) do nothing;
-- Empty sections ([]) => the website shows the built-in default layout.
-- The first time you save/publish a page in /admin, your edited sections take over.

-- =====================================================================
-- FIRST ADMIN (run AFTER you create the user in Authentication → Users):
--   insert into public.admin_users (user_id, email, role)
--   select id, email, 'owner' from auth.users where email = 'YOUR_EMAIL_HERE'
--   on conflict (user_id) do nothing;
-- =====================================================================
