-- =====================================================================
-- Inaya Quran Academy, Phase 5: ATTENDANCE
-- Additive. Run AFTER 003_classes.sql. Safe to run twice.
-- One row per student per class per date.
-- =====================================================================
create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.class_groups(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  session_date date not null check (session_date <= current_date),
  status       text not null check (status in ('Present','Absent','Late','Excused')),
  note         text not null default '',
  recorded_by  uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (class_id, student_id, session_date)
);
create index if not exists idx_att_class_date on public.attendance(class_id, session_date);
create index if not exists idx_att_student on public.attendance(student_id, session_date desc);
drop trigger if exists attendance_touch on public.attendance;
create trigger attendance_touch before update on public.attendance for each row execute function public.trg_touch();

alter table public.attendance enable row level security;
drop policy if exists attendance_read  on public.attendance;
drop policy if exists attendance_write on public.attendance;
create policy attendance_read  on public.attendance for select to authenticated using (public.is_admin());
create policy attendance_write on public.attendance for all to authenticated using (public.can_write()) with check (public.can_write());
