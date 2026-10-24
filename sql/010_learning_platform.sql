-- =====================================================================
-- Inaya Quran Academy, Phase 7: LEARNING PLATFORM (additive migration)
-- Run AFTER schema.sql and 002..009. Safe to run twice.
--
-- It EXTENDS programs and program_levels (the existing public programs) and
-- adds domains, units, lessons, assessments, student progress, rewards.
-- Nothing is deleted or rewritten. The old curriculum_modules table is kept;
-- the admin builder can import its rows as units.
--
-- Security model
--   * Staff (admin_users) use the same is_admin() / can_write() rules as the rest of the panel.
--     can_review() adds the teacher role, which may grade but not edit the curriculum.
--   * Students are ordinary Supabase Auth users linked through students.user_id.
--     They have NO direct write access to any learning table. Every change they cause
--     (open a lesson, complete it, submit a quiz) goes through a SECURITY DEFINER function
--     that checks enrollment, unlock rules and ownership first.
--   * Answer keys live in their own table that students can never read.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- A. Extend existing tables
-- ---------------------------------------------------------------------
alter table public.programs
  add column if not exists tagline            text    not null default '',
  add column if not exists alt_name           text    not null default '',
  add column if not exists estimated_duration text    not null default '',
  add column if not exists access_mode        text    not null default 'invite',
  add column if not exists learning_enabled   boolean not null default false,
  add column if not exists is_template        boolean not null default false,
  add column if not exists duplicated_from    uuid references public.programs(id) on delete set null,
  add column if not exists settings           jsonb   not null default '{}'::jsonb,
  add column if not exists archived_at        timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'programs_access_mode_chk') then
    alter table public.programs add constraint programs_access_mode_chk check (access_mode in ('open','invite','closed'));
  end if;
end $$;

alter table public.program_levels
  add column if not exists objectives      jsonb not null default '[]'::jsonb,
  add column if not exists color           text  not null default '',
  add column if not exists unlock_rule     jsonb not null default '{}'::jsonb,
  add column if not exists completion_rule jsonb not null default '{}'::jsonb;

-- a student can sign in: one Supabase Auth user per student
alter table public.students add column if not exists user_id uuid unique references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------
-- B. Helper functions
-- ---------------------------------------------------------------------
create or replace function public.can_review() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid()
                 and role in ('owner','administrator','assessor','teacher'));
$$;

create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid() and deleted_at is null limit 1;
$$;

-- ---------------------------------------------------------------------
-- C. Curriculum tables
-- ---------------------------------------------------------------------
create table if not exists public.learning_domains (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  slug        text not null default '',
  description text not null default '',
  icon        text not null default '',
  color       text not null default '',
  sort_order  int  not null default 0,
  status      text not null default 'published' check (status in ('draft','published','archived')),
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_domains_program on public.learning_domains(program_id, sort_order);

create table if not exists public.learning_units (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  level_id        uuid not null references public.program_levels(id) on delete cascade,
  domain_id       uuid not null references public.learning_domains(id) on delete cascade,
  title           text not null check (length(trim(title)) > 0),
  description     text not null default '',
  objectives      jsonb not null default '[]'::jsonb,
  est_minutes     int  check (est_minutes is null or est_minutes >= 0),
  sort_order      int  not null default 0,
  status          text not null default 'published' check (status in ('draft','published','archived')),
  unlock_rule     jsonb not null default '{}'::jsonb,   -- {"mode":"sequential|free|custom","requires":[unit ids]}
  completion_rule jsonb not null default '{}'::jsonb,   -- {"assessment":"pass|none"}
  is_sample       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_units_level on public.learning_units(level_id, domain_id, sort_order);
create index if not exists idx_units_program on public.learning_units(program_id);

create table if not exists public.learning_lessons (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  unit_id         uuid not null references public.learning_units(id) on delete cascade,
  title           text not null check (length(trim(title)) > 0),
  description     text not null default '',
  objectives      jsonb not null default '[]'::jsonb,
  est_minutes     int  check (est_minutes is null or est_minutes >= 0),
  sort_order      int  not null default 0,
  status          text not null default 'published' check (status in ('draft','published','archived')),
  completion_rule jsonb not null default '{}'::jsonb,   -- {"type":"manual|blocks|timed|open","min_seconds":n,"assessment":"pass|none","optional":bool}
  prerequisite_lesson_ids uuid[] not null default '{}',
  available_from  timestamptz,
  is_sample       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_lessons_unit on public.learning_lessons(unit_id, sort_order);
create index if not exists idx_lessons_program on public.learning_lessons(program_id);

create table if not exists public.lesson_blocks (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  lesson_id   uuid not null references public.learning_lessons(id) on delete cascade,
  type        text not null check (type in ('rich_text','arabic_text','quran_verse','image','audio','video','pdf','vocabulary','exercise','teacher_note','resource')),
  data        jsonb not null default '{}'::jsonb,
  sort_order  int  not null default 0,
  required    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_blocks_lesson on public.lesson_blocks(lesson_id, sort_order);

-- ---------------------------------------------------------------------
-- D. Assessments (named learning_assessments: public.assessments is the admission assessment of leads)
-- ---------------------------------------------------------------------
create table if not exists public.learning_assessments (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  scope           text not null check (scope in ('lesson','unit','level')),
  lesson_id       uuid references public.learning_lessons(id) on delete cascade,
  unit_id         uuid references public.learning_units(id) on delete cascade,
  level_id        uuid references public.program_levels(id) on delete cascade,
  title           text not null check (length(trim(title)) > 0),
  instructions    text not null default '',
  pass_score      int  not null default 70 check (pass_score between 0 and 100),
  max_attempts    int  check (max_attempts is null or max_attempts > 0),
  time_limit_min  int  check (time_limit_min is null or time_limit_min > 0),
  question_count  int  check (question_count is null or question_count > 0),
  feedback_mode   text not null default 'full' check (feedback_mode in ('none','score','full')),
  requires_review boolean not null default false,
  available_from  timestamptz,
  available_until timestamptz,
  sort_order      int  not null default 0,
  status          text not null default 'published' check (status in ('draft','published','archived')),
  is_sample       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((scope = 'lesson' and lesson_id is not null) or (scope = 'unit' and unit_id is not null) or (scope = 'level' and level_id is not null))
);
create index if not exists idx_lassess_program on public.learning_assessments(program_id);
create index if not exists idx_lassess_unit on public.learning_assessments(unit_id);
create index if not exists idx_lassess_lesson on public.learning_assessments(lesson_id);

create table if not exists public.assessment_questions (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs(id) on delete cascade,
  assessment_id uuid not null references public.learning_assessments(id) on delete cascade,
  type          text not null check (type in ('single','multiple','true_false','short_answer','matching','ordering','written','audio')),
  prompt        text not null check (length(trim(prompt)) > 0),
  arabic_text   text not null default '',
  options       jsonb not null default '[]'::jsonb,  -- single/multiple: [{id,text}]  matching: {left:[{id,text}],right:[{id,text}]}  ordering: [{id,text}]
  points        numeric(6,2) not null default 1 check (points >= 0),
  explanation   text not null default '',
  sort_order    int  not null default 0,
  status        text not null default 'published' check (status in ('draft','published','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_questions_assessment on public.assessment_questions(assessment_id, sort_order);

create table if not exists public.assessment_answer_keys (
  question_id uuid primary key references public.assessment_questions(id) on delete cascade,
  key         jsonb not null default '{}'::jsonb
  -- single {"correct":"b"}  multiple {"correct":["a","c"]}  true_false {"correct":true}
  -- short_answer {"accepted":["..."],"case_sensitive":false,"review_if_wrong":false}
  -- matching {"pairs":{"l1":"r2"}}  ordering {"order":["a","b","c"]}   written/audio: {}
);

-- ---------------------------------------------------------------------
-- E. Students in programs, progress, attempts
-- ---------------------------------------------------------------------
create table if not exists public.student_programs (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  program_id  uuid not null references public.programs(id) on delete restrict,
  status      text not null default 'active' check (status in ('active','paused','completed','withdrawn')),
  teacher_id  uuid references public.teachers(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  enrolled_by uuid,
  unique (student_id, program_id)
);
create index if not exists idx_sp_program on public.student_programs(program_id, status);

create table if not exists public.student_lesson_progress (
  student_id      uuid not null references public.students(id) on delete cascade,
  lesson_id       uuid not null references public.learning_lessons(id) on delete restrict,
  program_id      uuid not null references public.programs(id) on delete restrict,
  status          text not null default 'in_progress' check (status in ('in_progress','completed')),
  first_opened_at timestamptz not null default now(),
  last_opened_at  timestamptz not null default now(),
  completed_at    timestamptz,
  seconds_spent   int not null default 0 check (seconds_spent >= 0),
  blocks_done     jsonb not null default '[]'::jsonb,
  last_block_id   uuid,
  primary key (student_id, lesson_id)
);
create index if not exists idx_slp_program on public.student_lesson_progress(program_id, student_id);

create table if not exists public.assessment_attempts (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  assessment_id uuid not null references public.learning_assessments(id) on delete restrict,
  program_id    uuid not null references public.programs(id) on delete restrict,
  attempt_no    int  not null,
  status        text not null default 'in_progress' check (status in ('in_progress','needs_review','graded')),
  question_ids  uuid[] not null default '{}',
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  graded_at     timestamptz,
  earned        numeric(8,2),
  possible      numeric(8,2),
  score         numeric(5,2),
  passed        boolean,
  graded_by     uuid,
  review_comment text not null default '',
  unique (student_id, assessment_id, attempt_no)
);
create index if not exists idx_attempts_student on public.assessment_attempts(student_id, assessment_id);
create index if not exists idx_attempts_review on public.assessment_attempts(program_id, status) where status = 'needs_review';

create table if not exists public.attempt_answers (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id  uuid not null references public.assessment_questions(id) on delete restrict,
  answer       jsonb not null default '{}'::jsonb,
  auto_points  numeric(6,2),
  final_points numeric(6,2),
  needs_review boolean not null default false,
  feedback     text not null default '',
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  answered_at  timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.progress_events (
  id         bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  type       text not null,
  ref_type   text,
  ref_id     uuid,
  title      text not null default '',
  data       jsonb not null default '{}'::jsonb,
  actor      uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_student on public.progress_events(student_id, created_at desc);
create index if not exists idx_events_program on public.progress_events(program_id, created_at desc);

create table if not exists public.progression_overrides (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  program_id  uuid not null references public.programs(id) on delete restrict,
  target_type text not null check (target_type in ('lesson','unit','level')),
  target_id   uuid not null,
  action      text not null check (action in ('unlock','complete','approve')),
  reason      text not null check (length(trim(reason)) >= 5),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index if not exists idx_overrides_student on public.progression_overrides(student_id, target_type, target_id);

-- ---------------------------------------------------------------------
-- F. Rewards
-- ---------------------------------------------------------------------
create table if not exists public.xp_transactions (
  id         bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  amount     int  not null,
  reason     text not null,
  event_key  text not null unique,           -- one reward per qualifying event, ever
  created_at timestamptz not null default now()
);
create index if not exists idx_xp_student on public.xp_transactions(student_id);

create table if not exists public.achievement_defs (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid references public.programs(id) on delete cascade,  -- null = every program
  code        text not null,
  title       text not null,
  description text not null default '',
  icon        text not null default '',
  rule        jsonb not null default '{}'::jsonb, -- {"type":"lessons_completed","n":5} | units_completed | levels_completed | program_completed | perfect_score | streak_days
  xp          int  not null default 0 check (xp >= 0),
  status      text not null default 'published' check (status in ('draft','published','archived')),
  is_sample   boolean not null default false,
  unique (program_id, code)
);

create table if not exists public.student_achievements (
  student_id  uuid not null references public.students(id) on delete cascade,
  achievement_id uuid not null references public.achievement_defs(id) on delete cascade,
  awarded_at  timestamptz not null default now(),
  primary key (student_id, achievement_id)
);

create table if not exists public.certificates (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete restrict,
  level_id   uuid references public.program_levels(id) on delete restrict,
  code       text not null unique,
  title      text not null,
  issued_at  timestamptz not null default now(),
  issued_by  uuid,
  revoked_at timestamptz
);
create unique index if not exists uq_cert_target on public.certificates(student_id, program_id, coalesce(level_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------------
-- G. Rules engine (read-only helpers; every unlock decision is made here, in the database)
-- ---------------------------------------------------------------------
create or replace function public.prog_setting(p_program uuid, p_path text[], p_default jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select settings #> p_path from public.programs where id = p_program), p_default);
$$;

create or replace function public.is_enrolled(p_student uuid, p_program uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.student_programs sp join public.students s on s.id = sp.student_id
    where sp.student_id = p_student and sp.program_id = p_program and sp.status in ('active','completed')
      and s.deleted_at is null and s.status in ('Active','Completed'));
$$;

create or replace function public.has_override(p_student uuid, p_type text, p_target uuid, p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.progression_overrides o where o.student_id = p_student and o.target_type = p_type
    and o.target_id = p_target and o.action = p_action and o.revoked_at is null);
$$;

create or replace function public.lesson_done(p_student uuid, p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.student_lesson_progress where student_id = p_student and lesson_id = p_lesson and status = 'completed')
      or public.has_override(p_student, 'lesson', p_lesson, 'complete');
$$;

create or replace function public.assessment_passed(p_student uuid, p_assessment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.assessment_attempts where student_id = p_student and assessment_id = p_assessment
    and status = 'graded' and passed is true);
$$;

create or replace function public.unit_done(p_student uuid, p_unit uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare u public.learning_units; n int;
begin
  select * into u from public.learning_units where id = p_unit;
  if not found then return false; end if;
  if public.has_override(p_student, 'unit', p_unit, 'complete') then return true; end if;
  select count(*) into n from public.learning_lessons l where l.unit_id = p_unit and l.status = 'published'
     and coalesce(l.completion_rule->>'optional', 'false') <> 'true';
  if exists (select 1 from public.learning_lessons l where l.unit_id = p_unit and l.status = 'published'
     and coalesce(l.completion_rule->>'optional', 'false') <> 'true' and not public.lesson_done(p_student, l.id)) then return false; end if;
  if coalesce(u.completion_rule->>'assessment', 'pass') <> 'none' then
    if exists (select 1 from public.learning_assessments a where a.unit_id = p_unit and a.scope = 'unit' and a.status = 'published'
       and not public.assessment_passed(p_student, a.id)) then return false; end if;
    n := n + (select count(*) from public.learning_assessments a where a.unit_id = p_unit and a.scope = 'unit' and a.status = 'published');
  end if;
  return n > 0;
end $$;

create or replace function public.level_done(p_student uuid, p_level uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare lv public.program_levels; n int;
begin
  select * into lv from public.program_levels where id = p_level;
  if not found then return false; end if;
  if public.has_override(p_student, 'level', p_level, 'complete') then return true; end if;
  select count(*) into n from public.learning_units where level_id = p_level and status = 'published';
  if n = 0 then return false; end if;
  if exists (select 1 from public.learning_units u where u.level_id = p_level and u.status = 'published' and not public.unit_done(p_student, u.id)) then return false; end if;
  if exists (select 1 from public.learning_assessments a where a.level_id = p_level and a.scope = 'level' and a.status = 'published'
     and not public.assessment_passed(p_student, a.id)) then return false; end if;
  if coalesce(lv.completion_rule->>'teacher_approval', 'false') = 'true' and not public.has_override(p_student, 'level', p_level, 'approve') then return false; end if;
  return true;
end $$;

create or replace function public.level_open(p_student uuid, p_level uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare lv public.program_levels; mode text; prev uuid; rid text;
begin
  select * into lv from public.program_levels where id = p_level and status = 'published';
  if not found then return false; end if;
  if public.has_override(p_student, 'level', p_level, 'unlock') or public.has_override(p_student, 'level', p_level, 'complete') then return true; end if;
  mode := coalesce(lv.unlock_rule->>'mode', public.prog_setting(lv.program_id, '{progression,level_mode}', '"sequential"'::jsonb) #>> '{}');
  if mode = 'free' then return true; end if;
  if mode = 'custom' then
    for rid in select jsonb_array_elements_text(coalesce(lv.unlock_rule->'requires', '[]'::jsonb)) loop
      if not public.level_done(p_student, rid::uuid) then return false; end if;
    end loop;
    return true;
  end if;
  select l.id into prev from public.program_levels l where l.program_id = lv.program_id and l.status = 'published'
     and (l.sort_order, l.level_number) < (lv.sort_order, lv.level_number) order by l.sort_order desc, l.level_number desc limit 1;
  return prev is null or public.level_done(p_student, prev);
end $$;

create or replace function public.unit_open(p_student uuid, p_unit uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare u public.learning_units; mode text; prev uuid; rid text;
begin
  select * into u from public.learning_units where id = p_unit and status = 'published';
  if not found then return false; end if;
  if public.has_override(p_student, 'unit', p_unit, 'unlock') or public.has_override(p_student, 'unit', p_unit, 'complete') then return true; end if;
  if not public.level_open(p_student, u.level_id) then return false; end if;
  mode := coalesce(u.unlock_rule->>'mode', public.prog_setting(u.program_id, '{progression,unit_mode}', '"sequential"'::jsonb) #>> '{}');
  if mode = 'free' then return true; end if;
  if mode = 'custom' then
    for rid in select jsonb_array_elements_text(coalesce(u.unlock_rule->'requires', '[]'::jsonb)) loop
      if not public.unit_done(p_student, rid::uuid) then return false; end if;
    end loop;
    return true;
  end if;
  select x.id into prev from public.learning_units x where x.level_id = u.level_id and x.domain_id = u.domain_id and x.status = 'published'
     and (x.sort_order, x.created_at, x.id) < (u.sort_order, u.created_at, u.id) order by x.sort_order desc, x.created_at desc, x.id desc limit 1;
  return prev is null or public.unit_done(p_student, prev);
end $$;

create or replace function public.lesson_open(p_student uuid, p_lesson uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare l public.learning_lessons; pid uuid; prev uuid; skip boolean;
begin
  select * into l from public.learning_lessons where id = p_lesson and status = 'published';
  if not found then return false; end if;
  if not exists (select 1 from public.learning_units where id = l.unit_id and status = 'published') then return false; end if;
  if not public.is_enrolled(p_student, l.program_id) then return false; end if;
  skip := public.has_override(p_student, 'lesson', p_lesson, 'unlock') or public.has_override(p_student, 'lesson', p_lesson, 'complete');
  if not public.unit_open(p_student, l.unit_id) then return false; end if;
  if skip then return true; end if;
  if l.available_from is not null and l.available_from > now() then return false; end if;
  foreach pid in array l.prerequisite_lesson_ids loop
    if not public.lesson_done(p_student, pid) then return false; end if;
  end loop;
  if (public.prog_setting(l.program_id, '{progression,lesson_mode}', '"free"'::jsonb) #>> '{}') = 'sequential' then
    select x.id into prev from public.learning_lessons x where x.unit_id = l.unit_id and x.status = 'published'
       and (x.sort_order, x.created_at, x.id) < (l.sort_order, l.created_at, l.id) order by x.sort_order desc, x.created_at desc, x.id desc limit 1;
    if prev is not null and not public.lesson_done(p_student, prev) then return false; end if;
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------------
-- H. Events, rewards, streaks (internal: not callable from the browser)
-- ---------------------------------------------------------------------
create or replace function public.log_event(p_student uuid, p_program uuid, p_type text, p_ref_type text, p_ref_id uuid, p_title text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.progress_events(student_id, program_id, type, ref_type, ref_id, title, data, actor)
  values (p_student, p_program, p_type, p_ref_type, p_ref_id, p_title, coalesce(p_data, '{}'::jsonb), auth.uid());
$$;

create or replace function public.award_xp(p_student uuid, p_program uuid, p_amount int, p_reason text, p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_amount is null or p_amount <= 0 then return false; end if;
  if public.prog_setting(p_program, '{gamification,xp}', 'true'::jsonb) <> 'true'::jsonb then return false; end if;
  insert into public.xp_transactions(student_id, program_id, amount, reason, event_key) values (p_student, p_program, p_amount, p_reason, p_key)
  on conflict (event_key) do nothing;
  get diagnostics n = row_count;
  if n > 0 then perform public.log_event(p_student, p_program, 'xp', null, null, '+' || p_amount || ' XP: ' || p_reason, jsonb_build_object('amount', p_amount)); end if;
  return n > 0;
end $$;

create or replace function public.student_streak(p_student uuid) returns int
language sql stable security definer set search_path = public as $$
  with days as (select distinct (created_at at time zone 'UTC')::date d from public.progress_events
                where student_id = p_student and type in ('lesson_completed','attempt_submitted')),
  r as (select d, d + (row_number() over (order by d desc))::int as g from days),
  top as (select g, d from r order by d desc limit 1)
  select case when (select d from top) >= (now() at time zone 'UTC')::date - 1
              then (select count(*)::int from r where g = (select g from top)) else 0 end;
$$;

create or replace function public.issue_certificate_internal(p_student uuid, p_program uuid, p_level uuid, p_title text) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.certificates(student_id, program_id, level_id, code, title, issued_by)
  values (p_student, p_program, p_level, 'IQA-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)), p_title, auth.uid())
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then perform public.log_event(p_student, p_program, 'certificate', 'level', p_level, 'Certificate issued: ' || p_title); end if;
end $$;

create or replace function public.award_achievements(p_student uuid, p_program uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d record; ok boolean; n int; t text; need int; got int;
begin
  if public.prog_setting(p_program, '{gamification,badges}', 'true'::jsonb) <> 'true'::jsonb then return; end if;
  for d in select * from public.achievement_defs a where a.status = 'published' and (a.program_id is null or a.program_id = p_program) loop
    if exists (select 1 from public.student_achievements where student_id = p_student and achievement_id = d.id) then continue; end if;
    t := d.rule->>'type'; need := coalesce((d.rule->>'n')::int, 1); ok := false;
    if t = 'lessons_completed' then
      select count(*) into got from public.student_lesson_progress where student_id = p_student and program_id = p_program and status = 'completed'; ok := got >= need;
    elsif t = 'units_completed' then
      select count(*) into got from public.progress_events where student_id = p_student and program_id = p_program and type = 'unit_completed'; ok := got >= need;
    elsif t = 'levels_completed' then
      select count(*) into got from public.progress_events where student_id = p_student and program_id = p_program and type = 'level_completed'; ok := got >= need;
    elsif t = 'program_completed' then
      ok := exists (select 1 from public.progress_events where student_id = p_student and program_id = p_program and type = 'program_completed');
    elsif t = 'perfect_score' then
      ok := exists (select 1 from public.assessment_attempts where student_id = p_student and program_id = p_program and status = 'graded' and score = 100);
    elsif t = 'streak_days' then
      ok := public.student_streak(p_student) >= need;
    end if;
    if ok then
      insert into public.student_achievements(student_id, achievement_id) values (p_student, d.id) on conflict do nothing;
      get diagnostics n = row_count;
      if n > 0 then
        perform public.log_event(p_student, p_program, 'achievement', 'achievement', d.id, 'Achievement: ' || d.title);
        perform public.award_xp(p_student, p_program, d.xp, 'Achievement: ' || d.title, 'ach:' || p_student || ':' || d.id);
      end if;
    end if;
  end loop;
end $$;

-- Re-checks unit, level and program completion for one student and records each milestone exactly once.
create or replace function public.after_progress(p_student uuid, p_program uuid) returns void
language plpgsql security definer set search_path = public as $$
declare u record; lv record; certs boolean; nlv int;
begin
  certs := public.prog_setting(p_program, '{gamification,certificates}', 'true'::jsonb) = 'true'::jsonb;
  for u in select id, title from public.learning_units where program_id = p_program and status = 'published' order by sort_order loop
    if public.unit_done(p_student, u.id) and not exists (select 1 from public.progress_events where student_id = p_student and type = 'unit_completed' and ref_id = u.id) then
      perform public.log_event(p_student, p_program, 'unit_completed', 'unit', u.id, 'Completed unit: ' || u.title);
      perform public.award_xp(p_student, p_program, coalesce((public.prog_setting(p_program, '{gamification,xp_unit}', '50'::jsonb) #>> '{}')::int, 50), 'Unit completed: ' || u.title, 'unit:' || p_student || ':' || u.id);
    end if;
  end loop;
  for lv in select id, title from public.program_levels where program_id = p_program and status = 'published' order by sort_order, level_number loop
    if public.level_done(p_student, lv.id) and not exists (select 1 from public.progress_events where student_id = p_student and type = 'level_completed' and ref_id = lv.id) then
      perform public.log_event(p_student, p_program, 'level_completed', 'level', lv.id, 'Completed level: ' || lv.title);
      perform public.award_xp(p_student, p_program, coalesce((public.prog_setting(p_program, '{gamification,xp_level}', '150'::jsonb) #>> '{}')::int, 150), 'Level completed: ' || lv.title, 'level:' || p_student || ':' || lv.id);
      if certs then perform public.issue_certificate_internal(p_student, p_program, lv.id, lv.title || ' certificate'); end if;
    end if;
  end loop;
  select count(*) into nlv from public.program_levels where program_id = p_program and status = 'published';
  if nlv > 0 and not exists (select 1 from public.program_levels l where l.program_id = p_program and l.status = 'published' and not public.level_done(p_student, l.id))
     and not exists (select 1 from public.progress_events where student_id = p_student and program_id = p_program and type = 'program_completed') then
    perform public.log_event(p_student, p_program, 'program_completed', 'program', p_program, 'Completed the program');
    perform public.award_xp(p_student, p_program, coalesce((public.prog_setting(p_program, '{gamification,xp_program}', '300'::jsonb) #>> '{}')::int, 300), 'Program completed', 'program:' || p_student || ':' || p_program);
    if certs then perform public.issue_certificate_internal(p_student, p_program, null, (select title from public.programs where id = p_program) || ' certificate'); end if;
    update public.student_programs set status = 'completed', completed_at = now() where student_id = p_student and program_id = p_program and status = 'active';
  end if;
  perform public.award_achievements(p_student, p_program);
end $$;

-- ---------------------------------------------------------------------
-- I. Grading
-- ---------------------------------------------------------------------
create or replace function public.norm_text(t text) returns text language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g'));
$$;

-- Returns earned points, or NULL when a person must review the answer.
create or replace function public.grade_answer(p_type text, p_points numeric, p_key jsonb, p_answer jsonb) returns numeric
language plpgsql immutable as $$
declare t text; cs boolean; acc text; k text; m int := 0; tot int := 0;
begin
  if p_type in ('written', 'audio') then return null; end if;
  if p_answer is null or p_answer = '{}'::jsonb then return 0; end if;
  if p_type = 'single' then
    return case when p_answer->>'choice' is not null and p_answer->>'choice' = p_key->>'correct' then p_points else 0 end;
  elsif p_type = 'multiple' then
    return case when array(select e from jsonb_array_elements_text(coalesce(p_answer->'choices', '[]'::jsonb)) e order by e)
                   = array(select e from jsonb_array_elements_text(coalesce(p_key->'correct', '[]'::jsonb)) e order by e)
                then p_points else 0 end;
  elsif p_type = 'true_false' then
    return case when p_answer->>'value' is not null and p_answer->>'value' = p_key->>'correct' then p_points else 0 end;
  elsif p_type = 'short_answer' then
    t := coalesce(p_answer->>'text', ''); cs := coalesce((p_key->>'case_sensitive')::boolean, false);
    for acc in select jsonb_array_elements_text(coalesce(p_key->'accepted', '[]'::jsonb)) loop
      if (cs and btrim(regexp_replace(t, '\s+', ' ', 'g')) = btrim(regexp_replace(acc, '\s+', ' ', 'g')))
         or (not cs and public.norm_text(t) = public.norm_text(acc)) then return p_points; end if;
    end loop;
    if coalesce((p_key->>'review_if_wrong')::boolean, false) then return null; end if;
    return 0;
  elsif p_type = 'matching' then
    for k in select jsonb_object_keys(coalesce(p_key->'pairs', '{}'::jsonb)) loop
      tot := tot + 1; if p_answer->'pairs'->>k = p_key->'pairs'->>k then m := m + 1; end if;
    end loop;
    if tot = 0 then return 0; end if;
    return round(p_points * m / tot, 2);
  elsif p_type = 'ordering' then
    return case when p_answer->'order' is not null and p_answer->'order' = p_key->'order' then p_points else 0 end;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- J. Student actions (the only way a student changes anything)
-- ---------------------------------------------------------------------
create or replace function public.open_lesson(p_lesson uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id(); l public.learning_lessons; pr public.student_lesson_progress; is_first boolean;
begin
  if sid is null then raise exception 'Sign in with your student account first.'; end if;
  select * into l from public.learning_lessons where id = p_lesson;
  if not found or not public.lesson_open(sid, p_lesson) then raise exception 'This lesson is locked or not available yet.'; end if;
  insert into public.student_lesson_progress(student_id, lesson_id, program_id) values (sid, p_lesson, l.program_id)
  on conflict (student_id, lesson_id) do update set last_opened_at = now()
  returning * into pr;
  is_first := not exists (select 1 from public.progress_events where student_id = sid and type = 'lesson_started' and ref_id = p_lesson);
  if is_first then perform public.log_event(sid, l.program_id, 'lesson_started', 'lesson', p_lesson, 'Started: ' || l.title); end if;
  -- only a lesson whose rule explicitly says "open" completes by being opened
  if coalesce(l.completion_rule->>'type', 'manual') = 'open' and pr.status <> 'completed' then
    perform public.complete_lesson(p_lesson);
    select * into pr from public.student_lesson_progress where student_id = sid and lesson_id = p_lesson;
  end if;
  return to_jsonb(pr);
end $$;

create or replace function public.mark_block(p_lesson uuid, p_block uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id(); pr public.student_lesson_progress;
begin
  if sid is null or not public.lesson_open(sid, p_lesson) then raise exception 'This lesson is locked or not available yet.'; end if;
  if not exists (select 1 from public.lesson_blocks where id = p_block and lesson_id = p_lesson) then raise exception 'That activity is not part of this lesson.'; end if;
  update public.student_lesson_progress set last_block_id = p_block, last_opened_at = now(),
    blocks_done = case when blocks_done ? p_block::text then blocks_done else blocks_done || to_jsonb(p_block::text) end
  where student_id = sid and lesson_id = p_lesson returning * into pr;
  if not found then raise exception 'Open the lesson first.'; end if;
  return to_jsonb(pr);
end $$;

create or replace function public.track_time(p_lesson uuid, p_seconds int) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id();
begin
  if sid is null or not public.lesson_open(sid, p_lesson) then return; end if;
  update public.student_lesson_progress set seconds_spent = seconds_spent + least(greatest(coalesce(p_seconds, 0), 0), 120), last_opened_at = now()
  where student_id = sid and lesson_id = p_lesson and status = 'in_progress';
end $$;

create or replace function public.complete_lesson(p_lesson uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id(); l public.learning_lessons; pr public.student_lesson_progress; rule text; b record;
begin
  if sid is null then raise exception 'Sign in with your student account first.'; end if;
  select * into l from public.learning_lessons where id = p_lesson;
  if not found or not public.lesson_open(sid, p_lesson) then raise exception 'This lesson is locked or not available yet.'; end if;
  select * into pr from public.student_lesson_progress where student_id = sid and lesson_id = p_lesson;
  if not found then raise exception 'Open the lesson first.'; end if;
  if pr.status = 'completed' then return to_jsonb(pr); end if;
  rule := coalesce(l.completion_rule->>'type', 'manual');
  if rule = 'blocks' then
    for b in select id from public.lesson_blocks where lesson_id = p_lesson and required loop
      if not (pr.blocks_done ? b.id::text) then raise exception 'Finish the required activities first.'; end if;
    end loop;
  elsif rule = 'timed' then
    if pr.seconds_spent < coalesce((l.completion_rule->>'min_seconds')::int, 0) then raise exception 'Spend a little more time on this lesson first.'; end if;
  end if;
  if coalesce(l.completion_rule->>'assessment', 'none') = 'pass' and exists (select 1 from public.learning_assessments a
     where a.lesson_id = p_lesson and a.scope = 'lesson' and a.status = 'published' and not public.assessment_passed(sid, a.id)) then
    raise exception 'Pass the lesson quiz first.';
  end if;
  update public.student_lesson_progress set status = 'completed', completed_at = now() where student_id = sid and lesson_id = p_lesson returning * into pr;
  perform public.log_event(sid, l.program_id, 'lesson_completed', 'lesson', p_lesson, 'Completed: ' || l.title);
  perform public.award_xp(sid, l.program_id, coalesce((public.prog_setting(l.program_id, '{gamification,xp_lesson}', '10'::jsonb) #>> '{}')::int, 10), 'Lesson completed: ' || l.title, 'lesson:' || sid || ':' || p_lesson);
  perform public.after_progress(sid, l.program_id);
  return to_jsonb(pr);
end $$;

create or replace function public.start_attempt(p_assessment uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id(); a public.learning_assessments; cur uuid; n int; lastp public.assessment_attempts; ids uuid[]; maxa int; wait_h int; ok boolean;
begin
  if sid is null then raise exception 'Sign in with your student account first.'; end if;
  select * into a from public.learning_assessments where id = p_assessment and status = 'published';
  if not found or not public.is_enrolled(sid, a.program_id) then raise exception 'This assessment is not available.'; end if;
  ok := case a.scope when 'lesson' then public.lesson_open(sid, a.lesson_id) when 'unit' then public.unit_open(sid, a.unit_id) else public.level_open(sid, a.level_id) end;
  if not ok then raise exception 'Finish the earlier steps to unlock this assessment.'; end if;
  if a.available_from is not null and a.available_from > now() then raise exception 'This assessment opens later.'; end if;
  if a.available_until is not null and a.available_until < now() then raise exception 'This assessment has closed.'; end if;
  select id into cur from public.assessment_attempts where student_id = sid and assessment_id = p_assessment and status = 'in_progress' limit 1;
  if cur is not null then return cur; end if;
  select count(*) into n from public.assessment_attempts where student_id = sid and assessment_id = p_assessment;
  maxa := coalesce(a.max_attempts, (public.prog_setting(a.program_id, '{progression,max_attempts}', 'null'::jsonb) #>> '{}')::int);
  if maxa is not null and n >= maxa then raise exception 'You have used all attempts for this assessment.'; end if;
  wait_h := coalesce((public.prog_setting(a.program_id, '{progression,retry_wait_hours}', '0'::jsonb) #>> '{}')::int, 0);
  if wait_h > 0 then
    select * into lastp from public.assessment_attempts where student_id = sid and assessment_id = p_assessment and submitted_at is not null order by attempt_no desc limit 1;
    if found and lastp.passed is not true and lastp.submitted_at + wait_h * interval '1 hour' > now() then
      raise exception 'Please review the lesson and try again after % hours.', wait_h; end if;
  end if;
  select array_agg(id) into ids from (
    select q.id from public.assessment_questions q where q.assessment_id = p_assessment and q.status = 'published'
    order by case when a.question_count is null then q.sort_order::double precision else random() end, q.sort_order limit coalesce(a.question_count, 1000)) s;
  if ids is null then raise exception 'This assessment has no questions yet.'; end if;
  insert into public.assessment_attempts(student_id, assessment_id, program_id, attempt_no, question_ids)
  values (sid, p_assessment, a.program_id, n + 1, ids) returning id into cur;
  return cur;
end $$;

create or replace function public.attempt_questions(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id(); at public.assessment_attempts; a public.learning_assessments;
begin
  select * into at from public.assessment_attempts where id = p_attempt;
  if not found or not (at.student_id = sid or public.can_review()) then raise exception 'Attempt not found.'; end if;
  select * into a from public.learning_assessments where id = at.assessment_id;
  return jsonb_build_object(
    'attempt', jsonb_build_object('id', at.id, 'status', at.status, 'attempt_no', at.attempt_no, 'started_at', at.started_at),
    'assessment', jsonb_build_object('id', a.id, 'title', a.title, 'instructions', a.instructions, 'time_limit_min', a.time_limit_min, 'pass_score', a.pass_score),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'type', q.type, 'prompt', q.prompt, 'arabic_text', q.arabic_text, 'options', q.options, 'points', q.points, 'answer', aa.answer)
                  order by array_position(at.question_ids, q.id))
       from public.assessment_questions q left join public.attempt_answers aa on aa.attempt_id = at.id and aa.question_id = q.id
       where q.id = any(at.question_ids)), '[]'::jsonb));
end $$;

create or replace function public.save_answer(p_attempt uuid, p_question uuid, p_answer jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id(); at public.assessment_attempts; a public.learning_assessments;
begin
  select * into at from public.assessment_attempts where id = p_attempt for update;
  if not found or at.student_id is distinct from sid then raise exception 'Attempt not found.'; end if;
  if at.status <> 'in_progress' then raise exception 'This attempt was already submitted.'; end if;
  if not (p_question = any(at.question_ids)) then raise exception 'That question is not part of this attempt.'; end if;
  if length(coalesce(p_answer, '{}'::jsonb)::text) > 20000 then raise exception 'That answer is too long.'; end if;
  select * into a from public.learning_assessments where id = at.assessment_id;
  if a.time_limit_min is not null and now() > at.started_at + (a.time_limit_min + 1) * interval '1 minute' then raise exception 'The time for this assessment is over. Submit what you have.'; end if;
  insert into public.attempt_answers(attempt_id, question_id, answer) values (p_attempt, p_question, coalesce(p_answer, '{}'::jsonb))
  on conflict (attempt_id, question_id) do update set answer = excluded.answer, answered_at = now();
end $$;

create or replace function public.finalize_attempt(p_attempt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare at public.assessment_attempts; a public.learning_assessments;
begin
  select * into at from public.assessment_attempts where id = p_attempt;
  select * into a from public.learning_assessments where id = at.assessment_id;
  perform public.log_event(at.student_id, at.program_id, 'attempt_graded', 'assessment', a.id,
    'Assessment graded: ' || a.title || ' (' || coalesce(at.score::text, '0') || '%)', jsonb_build_object('attempt', at.id, 'score', at.score, 'passed', at.passed));
  if at.passed then
    perform public.award_xp(at.student_id, at.program_id, coalesce((public.prog_setting(at.program_id, '{gamification,xp_assessment}', '25'::jsonb) #>> '{}')::int, 25), 'Assessment passed: ' || a.title, 'assess:' || at.student_id || ':' || a.id);
  end if;
  perform public.after_progress(at.student_id, at.program_id);
end $$;

create or replace function public.submit_attempt(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id(); at public.assessment_attempts; a public.learning_assessments; q record;
  pts numeric; v_earned numeric := 0; v_possible numeric := 0; pending boolean := false; sc numeric; st text;
begin
  select * into at from public.assessment_attempts where id = p_attempt for update;
  if not found or at.student_id is distinct from sid then raise exception 'Attempt not found.'; end if;
  if at.status <> 'in_progress' then raise exception 'This attempt was already submitted.'; end if;
  select * into a from public.learning_assessments where id = at.assessment_id;
  for q in select aq.id, aq.type, aq.points, coalesce(k.key, '{}'::jsonb) as key, coalesce(aa.answer, '{}'::jsonb) as answer
           from public.assessment_questions aq left join public.assessment_answer_keys k on k.question_id = aq.id
           left join public.attempt_answers aa on aa.attempt_id = at.id and aa.question_id = aq.id
           where aq.id = any(at.question_ids) loop
    v_possible := v_possible + q.points;
    pts := public.grade_answer(q.type, q.points, q.key, q.answer);
    if pts is null and q.answer = '{}'::jsonb and q.type not in ('written', 'audio') then pts := 0; end if;
    insert into public.attempt_answers(attempt_id, question_id, answer, auto_points, final_points, needs_review)
    values (p_attempt, q.id, q.answer, pts, pts, pts is null)
    on conflict (attempt_id, question_id) do update set auto_points = excluded.auto_points, final_points = excluded.final_points, needs_review = excluded.needs_review;
    if pts is null then pending := true; else v_earned := v_earned + pts; end if;
  end loop;
  sc := case when v_possible > 0 then round(100 * v_earned / v_possible, 2) else 0 end;
  st := case when pending or a.requires_review then 'needs_review' else 'graded' end;
  update public.assessment_attempts set status = st, submitted_at = now(), earned = v_earned, possible = v_possible,
     score = case when pending then null else sc end,
     passed = case when st = 'graded' then sc >= a.pass_score else null end,
     graded_at = case when st = 'graded' then now() else null end
  where id = p_attempt;
  perform public.log_event(sid, at.program_id, 'attempt_submitted', 'assessment', a.id, 'Submitted: ' || a.title || ' (attempt ' || at.attempt_no || ')', jsonb_build_object('attempt', p_attempt));
  if st = 'graded' then perform public.finalize_attempt(p_attempt); end if;
  return public.attempt_result(p_attempt);
end $$;

create or replace function public.attempt_result(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id(); at public.assessment_attempts; a public.learning_assessments; staff boolean := public.can_review(); out jsonb;
begin
  select * into at from public.assessment_attempts where id = p_attempt;
  if not found or not (at.student_id = sid or staff) then raise exception 'Attempt not found.'; end if;
  select * into a from public.learning_assessments where id = at.assessment_id;
  out := jsonb_build_object('id', at.id, 'status', at.status, 'attempt_no', at.attempt_no, 'passed', at.passed, 'pass_score', a.pass_score, 'review_comment', at.review_comment);
  if at.status = 'in_progress' then return out; end if;
  if a.feedback_mode in ('score', 'full') or staff then out := out || jsonb_build_object('score', at.score, 'earned', at.earned, 'possible', at.possible); end if;
  if a.feedback_mode = 'full' or staff then
    out := out || jsonb_build_object('answers', coalesce((select jsonb_agg(jsonb_build_object('question_id', q.id, 'prompt', q.prompt, 'type', q.type, 'answer', aa.answer,
        'points', aa.final_points, 'out_of', q.points, 'needs_review', aa.needs_review, 'feedback', aa.feedback, 'explanation', q.explanation,
        'correct', k.key) order by array_position(at.question_ids, q.id))
      from public.assessment_questions q left join public.attempt_answers aa on aa.attempt_id = at.id and aa.question_id = q.id
      left join public.assessment_answer_keys k on k.question_id = q.id and (at.status = 'graded' or staff)
      where q.id = any(at.question_ids)), '[]'::jsonb));
  end if;
  return out;
end $$;

-- ---------------------------------------------------------------------
-- K. Staff actions
-- ---------------------------------------------------------------------
create or replace function public.enroll_student(p_student uuid, p_program uuid, p_teacher uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare pr public.programs; id uuid;
begin
  if not public.can_write() then raise exception 'You do not have permission to enroll students.'; end if;
  select * into pr from public.programs where programs.id = p_program;
  if not found then raise exception 'Program not found.'; end if;
  if pr.status <> 'published' then raise exception 'Publish the program before enrolling students.'; end if;
  if not exists (select 1 from public.students where students.id = p_student and deleted_at is null) then raise exception 'Student not found.'; end if;
  insert into public.student_programs(student_id, program_id, teacher_id, enrolled_by) values (p_student, p_program, p_teacher, auth.uid())
  on conflict (student_id, program_id) do update set status = 'active', teacher_id = coalesce(excluded.teacher_id, public.student_programs.teacher_id), completed_at = null
  returning student_programs.id into id;
  update public.students set program_id = p_program where students.id = p_student and program_id is null;
  perform public.log_event(p_student, p_program, 'enrolled', 'program', p_program, 'Enrolled in ' || pr.title);
  return id;
end $$;

create or replace function public.set_enrollment(p_id uuid, p_status text, p_teacher uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare sp public.student_programs;
begin
  if not public.can_write() then raise exception 'You do not have permission to change enrollments.'; end if;
  if p_status not in ('active','paused','completed','withdrawn') then raise exception 'Unknown enrollment status.'; end if;
  update public.student_programs set status = p_status, teacher_id = p_teacher where id = p_id returning * into sp;
  if not found then raise exception 'Enrollment not found.'; end if;
  perform public.log_event(sp.student_id, sp.program_id, 'enrollment_' || p_status, 'program', sp.program_id, 'Enrollment is now ' || p_status);
end $$;

create or replace function public.review_attempt(p_attempt uuid, p_grades jsonb, p_comment text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare at public.assessment_attempts; a public.learning_assessments; g jsonb; q public.assessment_questions; pts numeric; v_earned numeric; v_possible numeric; sc numeric;
begin
  if not public.can_review() then raise exception 'You do not have permission to review answers.'; end if;
  select * into at from public.assessment_attempts where id = p_attempt for update;
  if not found then raise exception 'Attempt not found.'; end if;
  if at.status <> 'needs_review' then raise exception 'This attempt is not waiting for review.'; end if;
  select * into a from public.learning_assessments where id = at.assessment_id;
  for g in select * from jsonb_array_elements(coalesce(p_grades, '[]'::jsonb)) loop
    select * into q from public.assessment_questions where id = (g->>'question_id')::uuid and id = any(at.question_ids);
    if not found then raise exception 'A graded question does not belong to this attempt.'; end if;
    pts := (g->>'points')::numeric;
    if pts is null or pts < 0 or pts > q.points then raise exception 'Points for "%" must be between 0 and %.', left(q.prompt, 40), q.points; end if;
    update public.attempt_answers set final_points = pts, needs_review = false, feedback = coalesce(g->>'feedback', ''), reviewed_by = auth.uid(), reviewed_at = now()
    where attempt_id = p_attempt and question_id = q.id;
  end loop;
  if exists (select 1 from public.attempt_answers where attempt_id = p_attempt and needs_review) then
    raise exception 'Grade every written or audio answer before finishing the review.'; end if;
  select coalesce(sum(coalesce(final_points, 0)), 0) into v_earned from public.attempt_answers where attempt_id = p_attempt;
  select coalesce(sum(points), 0) into v_possible from public.assessment_questions where id = any(at.question_ids);
  sc := case when v_possible > 0 then round(100 * v_earned / v_possible, 2) else 0 end;
  update public.assessment_attempts set status = 'graded', earned = v_earned, possible = v_possible, score = sc, passed = sc >= a.pass_score,
    graded_at = now(), graded_by = auth.uid(), review_comment = coalesce(p_comment, '') where id = p_attempt;
  perform public.log_event(at.student_id, at.program_id, 'review_done', 'assessment', a.id, 'Teacher review finished: ' || a.title);
  perform public.finalize_attempt(p_attempt);
  return public.attempt_result(p_attempt);
end $$;

create or replace function public.grant_override(p_student uuid, p_program uuid, p_type text, p_target uuid, p_action text, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare id uuid; ok boolean;
begin
  if not public.can_write() then raise exception 'You do not have permission to override progression.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Write a short reason for the override.'; end if;
  ok := case p_type when 'lesson' then exists (select 1 from public.learning_lessons where learning_lessons.id = p_target and program_id = p_program)
                    when 'unit' then exists (select 1 from public.learning_units where learning_units.id = p_target and program_id = p_program)
                    when 'level' then exists (select 1 from public.program_levels where program_levels.id = p_target and program_id = p_program) else false end;
  if not ok then raise exception 'That item does not belong to this program.'; end if;
  insert into public.progression_overrides(student_id, program_id, target_type, target_id, action, reason, created_by)
  values (p_student, p_program, p_type, p_target, p_action, trim(p_reason), auth.uid()) returning progression_overrides.id into id;
  perform public.log_event(p_student, p_program, 'override', p_type, p_target, 'Override (' || p_action || ' ' || p_type || '): ' || trim(p_reason));
  perform public.after_progress(p_student, p_program);
  return id;
end $$;

create or replace function public.revoke_override(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.progression_overrides;
begin
  if not public.can_write() then raise exception 'You do not have permission to override progression.'; end if;
  update public.progression_overrides set revoked_at = now() where id = p_id and revoked_at is null returning * into o;
  if not found then raise exception 'Override not found.'; end if;
  perform public.log_event(o.student_id, o.program_id, 'override_revoked', o.target_type, o.target_id, 'Override removed');
end $$;

create or replace function public.issue_certificate(p_student uuid, p_program uuid, p_level uuid, p_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write() then raise exception 'You do not have permission to issue certificates.'; end if;
  if length(trim(coalesce(p_title, ''))) = 0 then raise exception 'Give the certificate a title.'; end if;
  perform public.issue_certificate_internal(p_student, p_program, p_level, trim(p_title));
end $$;

create or replace function public.revoke_certificate(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write() then raise exception 'You do not have permission to revoke certificates.'; end if;
  update public.certificates set revoked_at = now() where id = p_id;
end $$;

create or replace function public.clear_sample_flags(p_program uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write() then raise exception 'You do not have permission to edit the curriculum.'; end if;
  update public.learning_domains set is_sample = false where program_id = p_program;
  update public.learning_units set is_sample = false where program_id = p_program;
  update public.learning_lessons set is_sample = false where program_id = p_program;
  update public.learning_assessments set is_sample = false where program_id = p_program;
  update public.achievement_defs set is_sample = false where program_id = p_program;
end $$;

-- ---------------------------------------------------------------------
-- L. Duplicate a program as an independent copy (structure and content only, never student data)
-- ---------------------------------------------------------------------
create or replace function public.remap_rule(p_rule jsonb, p_map jsonb) returns jsonb language sql immutable as $$
  select case when p_rule ? 'requires'
    then jsonb_set(p_rule, '{requires}', coalesce((select jsonb_agg(coalesce(p_map->>x, x)) from jsonb_array_elements_text(p_rule->'requires') x), '[]'::jsonb))
    else p_rule end;
$$;

create or replace function public.duplicate_program(p_source uuid, p_title text, p_slug text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare src public.programs; nid uuid; v_slug text; v_base text; v_i int := 1;
  lv jsonb := '{}'::jsonb; dm jsonb := '{}'::jsonb; un jsonb := '{}'::jsonb; ls jsonb := '{}'::jsonb; qm jsonb := '{}'::jsonb; am jsonb := '{}'::jsonb;
  r record; x uuid;
begin
  if not public.can_write() then raise exception 'You do not have permission to duplicate programs.'; end if;
  if length(trim(coalesce(p_title, ''))) = 0 then raise exception 'Give the new program a name.'; end if;
  select * into src from public.programs where id = p_source;
  if not found then raise exception 'Program not found.'; end if;
  v_base := trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(p_slug), ''), p_title)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'program'; end if;
  v_slug := v_base;
  while exists (select 1 from public.programs where programs.slug = v_slug) loop v_i := v_i + 1; v_slug := v_base || '-' || v_i; end loop;

  insert into public.programs(slug, title, short_description, description, objectives, student_profile, curriculum_overview, cta_label, image_url, sort_order, status,
      tagline, alt_name, estimated_duration, access_mode, learning_enabled, is_template, duplicated_from, settings)
  values (v_slug, trim(p_title), src.short_description, src.description, src.objectives, src.student_profile, src.curriculum_overview, src.cta_label, src.image_url,
      (select coalesce(max(sort_order), 0) + 1 from public.programs), 'draft', src.tagline, '', src.estimated_duration, src.access_mode, src.learning_enabled, false, p_source, src.settings)
  returning id into nid;

  for r in select * from public.program_levels where program_id = p_source order by sort_order, level_number loop
    x := gen_random_uuid(); lv := lv || jsonb_build_object(r.id::text, x::text);
    insert into public.program_levels(id, program_id, level_number, title, description, sort_order, status, objectives, color, unlock_rule, completion_rule)
    values (x, nid, r.level_number, r.title, r.description, r.sort_order, r.status, r.objectives, r.color, r.unlock_rule, r.completion_rule);
  end loop;
  for r in select * from public.learning_domains where program_id = p_source order by sort_order loop
    x := gen_random_uuid(); dm := dm || jsonb_build_object(r.id::text, x::text);
    insert into public.learning_domains(id, program_id, title, slug, description, icon, color, sort_order, status, is_sample)
    values (x, nid, r.title, r.slug, r.description, r.icon, r.color, r.sort_order, r.status, r.is_sample);
  end loop;
  for r in select * from public.learning_units where program_id = p_source order by sort_order loop
    un := un || jsonb_build_object(r.id::text, gen_random_uuid()::text);
  end loop;
  for r in select * from public.learning_units where program_id = p_source order by sort_order loop
    insert into public.learning_units(id, program_id, level_id, domain_id, title, description, objectives, est_minutes, sort_order, status, unlock_rule, completion_rule, is_sample)
    values ((un->>r.id::text)::uuid, nid, (lv->>r.level_id::text)::uuid, (dm->>r.domain_id::text)::uuid, r.title, r.description, r.objectives, r.est_minutes, r.sort_order,
            r.status, public.remap_rule(r.unlock_rule, un), r.completion_rule, r.is_sample);
  end loop;
  update public.program_levels set unlock_rule = public.remap_rule(unlock_rule, lv) where program_id = nid;
  for r in select * from public.learning_lessons where program_id = p_source loop
    ls := ls || jsonb_build_object(r.id::text, gen_random_uuid()::text);
  end loop;
  for r in select * from public.learning_lessons where program_id = p_source order by sort_order loop
    insert into public.learning_lessons(id, program_id, unit_id, title, description, objectives, est_minutes, sort_order, status, completion_rule, prerequisite_lesson_ids, available_from, is_sample)
    values ((ls->>r.id::text)::uuid, nid, (un->>r.unit_id::text)::uuid, r.title, r.description, r.objectives, r.est_minutes, r.sort_order, r.status, r.completion_rule,
            coalesce((select array_agg((ls->>p::text)::uuid) from unnest(r.prerequisite_lesson_ids) p where ls ? p::text), '{}'::uuid[]), r.available_from, r.is_sample);
  end loop;
  insert into public.lesson_blocks(program_id, lesson_id, type, data, sort_order, required)
  select nid, (ls->>b.lesson_id::text)::uuid, b.type, b.data, b.sort_order, b.required from public.lesson_blocks b where b.program_id = p_source;
  for r in select * from public.learning_assessments where program_id = p_source loop
    x := gen_random_uuid(); am := am || jsonb_build_object(r.id::text, x::text);
    insert into public.learning_assessments(id, program_id, scope, lesson_id, unit_id, level_id, title, instructions, pass_score, max_attempts, time_limit_min, question_count,
        feedback_mode, requires_review, available_from, available_until, sort_order, status, is_sample)
    values (x, nid, r.scope, (ls->>r.lesson_id::text)::uuid, (un->>r.unit_id::text)::uuid, (lv->>r.level_id::text)::uuid, r.title, r.instructions, r.pass_score, r.max_attempts,
        r.time_limit_min, r.question_count, r.feedback_mode, r.requires_review, r.available_from, r.available_until, r.sort_order, r.status, r.is_sample);
  end loop;
  for r in select q.* from public.assessment_questions q where q.program_id = p_source loop
    x := gen_random_uuid(); qm := qm || jsonb_build_object(r.id::text, x::text);
    insert into public.assessment_questions(id, program_id, assessment_id, type, prompt, arabic_text, options, points, explanation, sort_order, status)
    values (x, nid, (am->>r.assessment_id::text)::uuid, r.type, r.prompt, r.arabic_text, r.options, r.points, r.explanation, r.sort_order, r.status);
    insert into public.assessment_answer_keys(question_id, key) select x, k.key from public.assessment_answer_keys k where k.question_id = r.id;
  end loop;
  insert into public.achievement_defs(program_id, code, title, description, icon, rule, xp, status, is_sample)
  select nid, d.code, d.title, d.description, d.icon, d.rule, d.xp, d.status, d.is_sample from public.achievement_defs d where d.program_id = p_source;
  return nid;
end $$;

-- ---------------------------------------------------------------------
-- M. Read models: dashboards and the admin progress table
-- ---------------------------------------------------------------------
create or replace function public.current_position(p_student uuid, p_program uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare lv uuid; un uuid;
begin
  select l.id into lv from public.program_levels l where l.program_id = p_program and l.status = 'published' and not public.level_done(p_student, l.id)
     order by l.sort_order, l.level_number limit 1;
  select u.id into un from public.student_lesson_progress sp join public.learning_lessons l on l.id = sp.lesson_id join public.learning_units u on u.id = l.unit_id
     where sp.student_id = p_student and sp.program_id = p_program and sp.status = 'in_progress' and u.status = 'published' order by sp.last_opened_at desc limit 1;
  if un is null then
    select u.id into un from public.learning_units u join public.program_levels pl on pl.id = u.level_id join public.learning_domains d on d.id = u.domain_id
      where u.program_id = p_program and u.status = 'published' and pl.status = 'published' and public.unit_open(p_student, u.id) and not public.unit_done(p_student, u.id)
      order by pl.sort_order, pl.level_number, d.sort_order, u.sort_order limit 1;
  end if;
  if un is not null then select u.level_id into lv from public.learning_units u where u.id = un; end if;
  return jsonb_build_object('level_id', lv, 'unit_id', un, 'domain_id', (select domain_id from public.learning_units where id = un));
end $$;

create or replace function public.next_lesson(p_student uuid, p_program uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select l.id from public.learning_lessons l join public.learning_units u on u.id = l.unit_id and u.status = 'published'
    join public.program_levels lv on lv.id = u.level_id and lv.status = 'published' join public.learning_domains d on d.id = u.domain_id
  where l.program_id = p_program and l.status = 'published' and not public.lesson_done(p_student, l.id) and public.lesson_open(p_student, l.id)
  order by (case when exists (select 1 from public.student_lesson_progress s where s.student_id = p_student and s.lesson_id = l.id) then 0 else 1 end),
           lv.sort_order, lv.level_number, d.sort_order, u.sort_order, l.sort_order, l.created_at limit 1;
$$;

create or replace function public.assessment_state(p_student uuid, p_assessment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.learning_assessments; ok boolean;
begin
  select * into a from public.learning_assessments where id = p_assessment;
  ok := case a.scope when 'lesson' then public.lesson_open(p_student, a.lesson_id) when 'unit' then public.unit_open(p_student, a.unit_id) else public.level_open(p_student, a.level_id) end;
  return jsonb_build_object('id', a.id, 'title', a.title, 'scope', a.scope, 'pass_score', a.pass_score, 'max_attempts', a.max_attempts, 'time_limit_min', a.time_limit_min,
    'instructions', a.instructions, 'available', ok and (a.available_from is null or a.available_from <= now()) and (a.available_until is null or a.available_until >= now()),
    'passed', public.assessment_passed(p_student, a.id),
    'attempts', (select count(*) from public.assessment_attempts t where t.student_id = p_student and t.assessment_id = a.id),
    'best_score', (select max(t.score) from public.assessment_attempts t where t.student_id = p_student and t.assessment_id = a.id and t.status = 'graded'),
    'pending_review', exists (select 1 from public.assessment_attempts t where t.student_id = p_student and t.assessment_id = a.id and t.status = 'needs_review'),
    'in_progress_attempt', (select t.id from public.assessment_attempts t where t.student_id = p_student and t.assessment_id = a.id and t.status = 'in_progress' limit 1));
end $$;

create or replace function public.learning_state(p_student uuid, p_program uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tot int; dn int;
begin
  select count(*) into tot from public.learning_lessons l join public.learning_units u on u.id = l.unit_id and u.status = 'published' where l.program_id = p_program and l.status = 'published';
  select count(*) into dn from public.learning_lessons l join public.learning_units u on u.id = l.unit_id and u.status = 'published' where l.program_id = p_program and l.status = 'published' and public.lesson_done(p_student, l.id);
  return jsonb_build_object(
    'program', (select jsonb_build_object('id', p.id, 'slug', p.slug, 'title', p.title, 'tagline', p.tagline, 'alt_name', p.alt_name, 'description', p.short_description, 'image_url', p.image_url, 'settings', p.settings) from public.programs p where p.id = p_program),
    'enrollment', (select jsonb_build_object('id', sp.id, 'status', sp.status, 'enrolled_at', sp.enrolled_at, 'completed_at', sp.completed_at, 'teacher', t.full_name)
                   from public.student_programs sp left join public.teachers t on t.id = sp.teacher_id where sp.student_id = p_student and sp.program_id = p_program),
    'totals', jsonb_build_object('lessons', tot, 'completed', dn, 'percent', case when tot > 0 then round(100.0 * dn / tot) else 0 end,
      'xp', (select coalesce(sum(amount), 0) from public.xp_transactions where student_id = p_student and program_id = p_program),
      'streak', public.student_streak(p_student)),
    'position', public.current_position(p_student, p_program),
    'next_lesson', public.next_lesson(p_student, p_program),
    'levels', coalesce((select jsonb_agg(x.j order by x.so, x.ln) from (
      select lv.sort_order so, lv.level_number ln, jsonb_build_object('id', lv.id, 'title', lv.title, 'number', lv.level_number, 'description', lv.description, 'color', lv.color, 'objectives', lv.objectives,
        'open', public.level_open(p_student, lv.id), 'done', public.level_done(p_student, lv.id),
        'needs_approval', coalesce(lv.completion_rule->>'teacher_approval', 'false') = 'true' and not public.has_override(p_student, 'level', lv.id, 'approve'),
        'percent', (select case when count(*) > 0 then round(100.0 * count(*) filter (where public.lesson_done(p_student, l.id)) / count(*)) else 0 end
                    from public.learning_lessons l join public.learning_units u on u.id = l.unit_id where u.level_id = lv.id and u.status = 'published' and l.status = 'published'),
        'assessments', coalesce((select jsonb_agg(public.assessment_state(p_student, a.id) order by a.sort_order) from public.learning_assessments a where a.level_id = lv.id and a.scope = 'level' and a.status = 'published'), '[]'::jsonb),
        'domains', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'icon', d.icon, 'color', d.color, 'description', d.description,
          'units', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'title', u.title, 'description', u.description, 'objectives', u.objectives, 'est_minutes', u.est_minutes,
              'open', public.unit_open(p_student, u.id), 'done', public.unit_done(p_student, u.id),
              'percent', (select case when count(*) > 0 then round(100.0 * count(*) filter (where public.lesson_done(p_student, l.id)) / count(*)) else 0 end from public.learning_lessons l where l.unit_id = u.id and l.status = 'published'),
              'lessons', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'est_minutes', l.est_minutes,
                  'status', case when public.lesson_done(p_student, l.id) then 'completed'
                                 when exists (select 1 from public.student_lesson_progress s where s.student_id = p_student and s.lesson_id = l.id) then 'in_progress'
                                 when public.lesson_open(p_student, l.id) then 'available' else 'locked' end,
                  'open', public.lesson_open(p_student, l.id),
                  'completed_at', (select s.completed_at from public.student_lesson_progress s where s.student_id = p_student and s.lesson_id = l.id)) order by l.sort_order, l.created_at)
                  from public.learning_lessons l where l.unit_id = u.id and l.status = 'published'), '[]'::jsonb),
              'assessments', coalesce((select jsonb_agg(public.assessment_state(p_student, a.id) order by a.sort_order) from public.learning_assessments a where a.unit_id = u.id and a.scope = 'unit' and a.status = 'published'), '[]'::jsonb)
            ) order by u.sort_order, u.created_at) from public.learning_units u where u.level_id = lv.id and u.domain_id = d.id and u.status = 'published'), '[]'::jsonb)
          ) order by d.sort_order)
          from public.learning_domains d where d.program_id = p_program and d.status = 'published'
            and exists (select 1 from public.learning_units u where u.level_id = lv.id and u.domain_id = d.id and u.status = 'published')), '[]'::jsonb)
      ) j from public.program_levels lv where lv.program_id = p_program and lv.status = 'published') x), '[]'::jsonb),
    'achievements', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'description', d.description, 'icon', d.icon, 'xp', d.xp, 'awarded_at', sa.awarded_at) order by d.title)
        from public.achievement_defs d left join public.student_achievements sa on sa.achievement_id = d.id and sa.student_id = p_student
        where d.status = 'published' and (d.program_id is null or d.program_id = p_program)), '[]'::jsonb),
    'certificates', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title, 'issued_at', c.issued_at) order by c.issued_at)
        from public.certificates c where c.student_id = p_student and c.program_id = p_program and c.revoked_at is null), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('type', e.type, 'title', e.title, 'at', e.created_at) order by e.created_at desc)
        from (select * from public.progress_events where student_id = p_student and program_id = p_program order by created_at desc, id desc limit 10) e), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(f.j order by f.at desc) from (
        select aa.reviewed_at at, jsonb_build_object('assessment', a.title, 'text', aa.feedback, 'at', aa.reviewed_at) j
          from public.attempt_answers aa join public.assessment_attempts t on t.id = aa.attempt_id join public.learning_assessments a on a.id = t.assessment_id
          where t.student_id = p_student and t.program_id = p_program and aa.feedback <> ''
        union all
        select t.graded_at, jsonb_build_object('assessment', a.title, 'text', t.review_comment, 'at', t.graded_at)
          from public.assessment_attempts t join public.learning_assessments a on a.id = t.assessment_id
          where t.student_id = p_student and t.program_id = p_program and t.review_comment <> '' order by 1 desc limit 6) f), '[]'::jsonb),
    'awaiting_review', (select count(*) from public.assessment_attempts t where t.student_id = p_student and t.program_id = p_program and t.status = 'needs_review')
  );
end $$;

create or replace function public.my_learning(p_program uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sid uuid := public.my_student_id();
begin
  if sid is null or not public.is_enrolled(sid, p_program) then raise exception 'You are not enrolled in this program.'; end if;
  return public.learning_state(sid, p_program);
end $$;

create or replace function public.student_learning(p_student uuid, p_program uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;
  return public.learning_state(p_student, p_program);
end $$;

create or replace function public.my_profile() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sid uuid := public.my_student_id();
begin
  if sid is null then return null; end if;
  return (select jsonb_build_object('id', s.id, 'student_code', s.student_code, 'full_name', s.full_name, 'status', s.status,
    'programs', coalesce((select jsonb_agg(jsonb_build_object('program_id', p.id, 'slug', p.slug, 'title', p.title, 'tagline', p.tagline, 'status', sp.status,
        'percent', (select case when count(*) > 0 then round(100.0 * count(*) filter (where public.lesson_done(s.id, l.id)) / count(*)) else 0 end
                    from public.learning_lessons l join public.learning_units u on u.id = l.unit_id and u.status = 'published' where l.program_id = p.id and l.status = 'published')) order by sp.enrolled_at)
        from public.student_programs sp join public.programs p on p.id = sp.program_id where sp.student_id = s.id and sp.status <> 'withdrawn'), '[]'::jsonb),
    'xp', (select coalesce(sum(amount), 0) from public.xp_transactions where student_id = s.id),
    'streak', public.student_streak(s.id))
    from public.students s where s.id = sid);
end $$;

create or replace function public.progress_overview(p_program uuid default null) returns table (
  student_id uuid, student_code text, full_name text, student_status text, enrollment_id uuid, enrollment_status text, program_id uuid, program_title text,
  teacher_id uuid, teacher_name text, level_id uuid, level_title text, unit_id uuid, unit_title text, domain_title text,
  total_lessons int, completed_lessons int, percent int, latest_score numeric, pending_reviews int, last_activity timestamptz, progression_status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;
  return query
  select s.id, s.student_code, s.full_name, s.status, sp.id, sp.status, p.id, p.title, t.id, t.full_name,
    (pos.v->>'level_id')::uuid, (select title from public.program_levels where id = (pos.v->>'level_id')::uuid),
    (pos.v->>'unit_id')::uuid, (select title from public.learning_units where id = (pos.v->>'unit_id')::uuid),
    (select d.title from public.learning_domains d where d.id = (pos.v->>'domain_id')::uuid),
    tl.total, tl.done, case when tl.total > 0 then round(100.0 * tl.done / tl.total)::int else 0 end,
    (select a.score from public.assessment_attempts a where a.student_id = s.id and a.program_id = p.id and a.status = 'graded' order by a.graded_at desc limit 1),
    (select count(*)::int from public.assessment_attempts a where a.student_id = s.id and a.program_id = p.id and a.status = 'needs_review'),
    (select max(e.created_at) from public.progress_events e where e.student_id = s.id and e.program_id = p.id),
    case sp.status when 'withdrawn' then 'Withdrawn' when 'paused' then 'Paused' when 'completed' then 'Completed'
      else case when exists (select 1 from public.assessment_attempts a where a.student_id = s.id and a.program_id = p.id and a.status = 'needs_review') then 'Awaiting review'
                when tl.done = 0 then 'Not started' else 'In progress' end end
  from public.student_programs sp join public.students s on s.id = sp.student_id and s.deleted_at is null join public.programs p on p.id = sp.program_id
  left join public.teachers t on t.id = sp.teacher_id
  cross join lateral (select public.current_position(s.id, p.id) v) pos
  cross join lateral (select count(*)::int total, count(*) filter (where public.lesson_done(s.id, l.id))::int done
      from public.learning_lessons l join public.learning_units u on u.id = l.unit_id and u.status = 'published' where l.program_id = p.id and l.status = 'published') tl
  where (p_program is null or sp.program_id = p_program)
  order by s.full_name;
end $$;

create or replace function public.review_queue() returns table (
  attempt_id uuid, student_id uuid, student_name text, assessment_id uuid, assessment_title text, program_id uuid, program_title text, attempt_no int, submitted_at timestamptz, pending_answers int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_review() then raise exception 'Staff only.'; end if;
  return query select t.id, s.id, s.full_name, a.id, a.title, p.id, p.title, t.attempt_no, t.submitted_at,
     (select count(*)::int from public.attempt_answers aa where aa.attempt_id = t.id and aa.needs_review)
  from public.assessment_attempts t join public.students s on s.id = t.student_id join public.learning_assessments a on a.id = t.assessment_id join public.programs p on p.id = t.program_id
  where t.status = 'needs_review' order by t.submitted_at;
end $$;

-- anyone holding a certificate code can confirm it is genuine. Only the first name and last initial are returned.
create or replace function public.verify_certificate(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('valid', c.revoked_at is null, 'title', c.title, 'program', p.title, 'issued_at', c.issued_at,
      'holder', split_part(s.full_name, ' ', 1) || case when position(' ' in s.full_name) > 0 then ' ' || left(split_part(s.full_name, ' ', array_length(string_to_array(s.full_name, ' '), 1)), 1) || '.' else '' end)
    from public.certificates c join public.students s on s.id = c.student_id join public.programs p on p.id = c.program_id where c.code = upper(trim(p_code))), jsonb_build_object('valid', false));
$$;

-- ---------------------------------------------------------------------
-- N. Row Level Security
-- ---------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['learning_domains','learning_units','learning_lessons','lesson_blocks','learning_assessments','assessment_questions','assessment_answer_keys',
    'student_programs','student_lesson_progress','assessment_attempts','attempt_answers','progress_events','progression_overrides','xp_transactions','achievement_defs','student_achievements','certificates']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- curriculum structure: the public sees published titles and descriptions of published programs. Lesson CONTENT (blocks) is not public.
do $$ declare t text; begin
  foreach t in array array['learning_domains','learning_units','learning_lessons'] loop
    execute format('drop policy if exists %I on public.%I', t || '_public', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (status = ''published'' and exists (select 1 from public.programs p where p.id = program_id and p.status = ''published''))', t || '_public', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t || '_staff_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.can_write()) with check (public.can_write())', t || '_staff_write', t);
  end loop;
end $$;

drop policy if exists blocks_student on public.lesson_blocks;
create policy blocks_student on public.lesson_blocks for select to authenticated
  using (type <> 'teacher_note' and public.lesson_open(public.my_student_id(), lesson_id));
drop policy if exists blocks_staff_read on public.lesson_blocks;
create policy blocks_staff_read on public.lesson_blocks for select to authenticated using (public.is_admin());
drop policy if exists blocks_staff_write on public.lesson_blocks;
create policy blocks_staff_write on public.lesson_blocks for all to authenticated using (public.can_write()) with check (public.can_write());

drop policy if exists lassess_student on public.learning_assessments;
create policy lassess_student on public.learning_assessments for select to authenticated
  using (status = 'published' and public.is_enrolled(public.my_student_id(), program_id));
drop policy if exists lassess_staff_read on public.learning_assessments;
create policy lassess_staff_read on public.learning_assessments for select to authenticated using (public.is_admin());
drop policy if exists lassess_staff_write on public.learning_assessments;
create policy lassess_staff_write on public.learning_assessments for all to authenticated using (public.can_write()) with check (public.can_write());

-- questions and answer keys: staff only. Students receive questions through attempt_questions(), never the key.
drop policy if exists questions_staff_read on public.assessment_questions;
create policy questions_staff_read on public.assessment_questions for select to authenticated using (public.can_review());
drop policy if exists questions_staff_write on public.assessment_questions;
create policy questions_staff_write on public.assessment_questions for all to authenticated using (public.can_write()) with check (public.can_write());
drop policy if exists keys_staff_read on public.assessment_answer_keys;
create policy keys_staff_read on public.assessment_answer_keys for select to authenticated using (public.can_review());
drop policy if exists keys_staff_write on public.assessment_answer_keys;
create policy keys_staff_write on public.assessment_answer_keys for all to authenticated using (public.can_write()) with check (public.can_write());

-- records about a student: the student reads their own, staff read all, nobody writes directly
drop policy if exists sp_read on public.student_programs;
create policy sp_read on public.student_programs for select to authenticated using (public.is_admin() or student_id = public.my_student_id());
drop policy if exists sp_staff_write on public.student_programs;
create policy sp_staff_write on public.student_programs for all to authenticated using (public.can_write()) with check (public.can_write());
drop policy if exists slp_read on public.student_lesson_progress;
create policy slp_read on public.student_lesson_progress for select to authenticated using (public.is_admin() or student_id = public.my_student_id());
drop policy if exists attempts_read on public.assessment_attempts;
create policy attempts_read on public.assessment_attempts for select to authenticated using (public.is_admin() or student_id = public.my_student_id());
drop policy if exists answers_staff_read on public.attempt_answers;
create policy answers_staff_read on public.attempt_answers for select to authenticated using (public.is_admin());
drop policy if exists events_read on public.progress_events;
create policy events_read on public.progress_events for select to authenticated using (public.is_admin() or student_id = public.my_student_id());
drop policy if exists overrides_staff_read on public.progression_overrides;
create policy overrides_staff_read on public.progression_overrides for select to authenticated using (public.is_admin());
drop policy if exists xp_read on public.xp_transactions;
create policy xp_read on public.xp_transactions for select to authenticated using (public.is_admin() or student_id = public.my_student_id());
drop policy if exists ach_defs_read on public.achievement_defs;
create policy ach_defs_read on public.achievement_defs for select to authenticated using (status = 'published' or public.is_admin());
drop policy if exists ach_defs_write on public.achievement_defs;
create policy ach_defs_write on public.achievement_defs for all to authenticated using (public.can_write()) with check (public.can_write());
drop policy if exists sach_read on public.student_achievements;
create policy sach_read on public.student_achievements for select to authenticated using (public.is_admin() or student_id = public.my_student_id());
drop policy if exists certs_read on public.certificates;
create policy certs_read on public.certificates for select to authenticated using (public.is_admin() or student_id = public.my_student_id());

-- ---------------------------------------------------------------------
-- O. Privileges: belt and braces on top of RLS
-- ---------------------------------------------------------------------
revoke all on public.learning_domains, public.learning_units, public.learning_lessons, public.lesson_blocks, public.learning_assessments, public.assessment_questions,
  public.assessment_answer_keys, public.student_programs, public.student_lesson_progress, public.assessment_attempts, public.attempt_answers, public.progress_events,
  public.progression_overrides, public.xp_transactions, public.achievement_defs, public.student_achievements, public.certificates from anon, authenticated;
grant select on public.learning_domains, public.learning_units, public.learning_lessons to anon;
grant select, insert, update, delete on public.learning_domains, public.learning_units, public.learning_lessons, public.lesson_blocks, public.learning_assessments,
  public.assessment_questions, public.assessment_answer_keys, public.achievement_defs, public.student_programs to authenticated;
grant select on public.student_lesson_progress, public.assessment_attempts, public.attempt_answers, public.progress_events, public.progression_overrides,
  public.xp_transactions, public.student_achievements, public.certificates to authenticated;
grant usage, select on sequence public.progress_events_id_seq, public.xp_transactions_id_seq to authenticated;

-- functions: nothing is callable by default. Browser-facing ones are listed explicitly.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('prog_setting','is_enrolled','has_override','lesson_done','assessment_passed','unit_done','level_done','level_open','unit_open','lesson_open',
      'log_event','award_xp','student_streak','issue_certificate_internal','award_achievements','after_progress','norm_text','grade_answer','finalize_attempt','remap_rule',
      'current_position','next_lesson','assessment_state','learning_state','can_review','my_student_id')
  loop execute format('revoke all on function %s from public, anon, authenticated', f.sig); end loop;
end $$;
-- used inside RLS policies, so the signed-in role must be allowed to run them
grant execute on function public.can_review() to authenticated;
grant execute on function public.my_student_id() to authenticated;
grant execute on function public.is_enrolled(uuid, uuid) to authenticated;
grant execute on function public.lesson_open(uuid, uuid) to authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('open_lesson','mark_block','track_time','complete_lesson','start_attempt','attempt_questions','save_answer','submit_attempt','attempt_result',
      'enroll_student','set_enrollment','review_attempt','grant_override','revoke_override','issue_certificate','revoke_certificate','clear_sample_flags','duplicate_program',
      'my_learning','student_learning','my_profile','progress_overview','review_queue')
  loop execute format('revoke all on function %s from public, anon', f.sig); execute format('grant execute on function %s to authenticated', f.sig); end loop;
end $$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- P. Private storage for audio answers (the public media library must stay public, so this one is separate)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 10485760, array['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/x-wav'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

drop policy if exists submissions_student_insert on storage.objects;
create policy submissions_student_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = public.my_student_id()::text);
drop policy if exists submissions_read on storage.objects;
create policy submissions_read on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and (public.is_admin() or (storage.foldername(name))[1] = public.my_student_id()::text));
