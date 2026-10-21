-- =====================================================================
-- Inaya Quran Academy, Phase 3: TEACHERS + CLASSES & TIMETABLE
-- Additive. Run AFTER schema.sql and 002_students.sql. Safe to run twice.
-- No compensation/pay data here (that belongs to the Finance phase).
-- Attendance is NOT in this phase.
-- =====================================================================
create sequence if not exists public.teacher_seq start 101;

create table if not exists public.teachers (
  id            uuid primary key default gen_random_uuid(),
  teacher_code  text unique not null default ('TC-' || nextval('public.teacher_seq')),
  full_name     text not null check (length(trim(full_name)) > 0),
  email         text,
  whatsapp      text,
  gender        text check (gender in ('Male','Female') or gender is null),
  country       text,
  status        text not null default 'Active' check (status in ('Active','On Leave','Inactive')),
  qualifications text not null default '',
  availability_note text not null default '',
  notes         text not null default '',
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.class_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  program_id  uuid references public.programs(id) on delete set null,
  level_id    uuid references public.program_levels(id) on delete set null,
  teacher_id  uuid references public.teachers(id) on delete set null,
  status      text not null default 'Planned' check (status in ('Planned','Active','Paused','Completed')),
  capacity    int check (capacity is null or capacity > 0),
  start_date  date,
  end_date    date,
  notes       text not null default '',
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_class_teacher on public.class_groups(teacher_id);

create table if not exists public.class_slots (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.class_groups(id) on delete cascade,
  weekday    int not null check (weekday between 1 and 7),   -- 1 = Monday … 7 = Sunday
  start_time time not null,
  duration_minutes int not null check (duration_minutes between 10 and 300),
  timezone   text not null default 'UTC',
  created_at timestamptz not null default now()
);
create index if not exists idx_slots_class on public.class_slots(class_id);

create table if not exists public.class_students (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.class_groups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  joined_on  date not null default current_date,
  left_on    date,
  unique (class_id, student_id)
);
create index if not exists idx_cs_student on public.class_students(student_id);

create or replace function public.trg_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists teachers_touch on public.teachers;
create trigger teachers_touch before update on public.teachers for each row execute function public.trg_touch();
drop trigger if exists classes_touch on public.class_groups;
create trigger classes_touch before update on public.class_groups for each row execute function public.trg_touch();

alter table public.teachers       enable row level security;
alter table public.class_groups   enable row level security;
alter table public.class_slots    enable row level security;
alter table public.class_students enable row level security;
do $$ declare t text; begin
  foreach t in array array['teachers','class_groups','class_slots','class_students'] loop
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('drop policy if exists %I on public.%I', t||'_write', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_admin())', t||'_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.can_write()) with check (public.can_write())', t||'_write', t);
  end loop;
end $$;
