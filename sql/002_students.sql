-- =====================================================================
-- Inaya Quran Academy, Phase 2: STUDENTS (additive migration)
-- Run AFTER schema.sql, in the Supabase SQL editor. Safe to run twice.
-- Does not modify or delete any existing table or row.
-- No payment/card data. Soft delete only (deleted_at).
-- =====================================================================
create sequence if not exists public.student_seq start 1001;

create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  student_code  text unique not null default ('ST-' || nextval('public.student_seq')),
  lead_id       uuid unique references public.leads(id) on delete set null,
  full_name     text not null check (length(trim(full_name)) > 0),
  date_of_birth date,
  gender        text check (gender in ('Male','Female') or gender is null),
  country       text,
  status        text not null default 'Active' check (status in ('Active','On Hold','Completed','Withdrawn')),
  program_id    uuid references public.programs(id) on delete set null,
  level_id      uuid references public.program_levels(id) on delete set null,
  start_date    date,
  notes         text not null default '',
  deleted_at    timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_students_status on public.students(status) where deleted_at is null;

create table if not exists public.guardians (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  relationship  text,
  email         text,
  whatsapp      text,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_guardians_student on public.guardians(student_id);

create table if not exists public.student_notes (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  author      uuid,
  author_email text,
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);
create index if not exists idx_student_notes on public.student_notes(student_id, created_at desc);

create table if not exists public.student_events (
  id          bigserial primary key,
  student_id  uuid not null references public.students(id) on delete cascade,
  actor       uuid,
  event_type  text not null,
  from_status text,
  to_status   text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_student_events on public.student_events(student_id, created_at desc);

-- audit: creation, status change, archive/restore
create or replace function public.trg_student_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into student_events(student_id, actor, event_type, to_status, note)
    values (new.id, auth.uid(), 'created', new.status, case when new.lead_id is not null then 'Converted from inquiry' else 'Added manually' end);
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.status is distinct from old.status then
      insert into student_events(student_id, actor, event_type, from_status, to_status)
      values (new.id, auth.uid(), 'status_change', old.status, new.status);
    end if;
    if new.deleted_at is distinct from old.deleted_at then
      insert into student_events(student_id, actor, event_type, note)
      values (new.id, auth.uid(), case when new.deleted_at is null then 'restored' else 'archived' end, null);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists students_audit_ins on public.students;
create trigger students_audit_ins after insert on public.students for each row execute function public.trg_student_audit();
drop trigger if exists students_audit_upd on public.students;
create trigger students_audit_upd before update on public.students for each row execute function public.trg_student_audit();

-- RLS: staff read; owner/administrator/assessor write. (Teacher scoping arrives with Classes.)
alter table public.students       enable row level security;
alter table public.guardians      enable row level security;
alter table public.student_notes  enable row level security;
alter table public.student_events enable row level security;
drop policy if exists students_read  on public.students;
drop policy if exists students_write on public.students;
create policy students_read  on public.students for select to authenticated using (public.is_admin());
create policy students_write on public.students for all to authenticated using (public.can_write()) with check (public.can_write());
drop policy if exists guardians_read  on public.guardians;
drop policy if exists guardians_write on public.guardians;
create policy guardians_read  on public.guardians for select to authenticated using (public.is_admin());
create policy guardians_write on public.guardians for all to authenticated using (public.can_write()) with check (public.can_write());
drop policy if exists snotes_read  on public.student_notes;
drop policy if exists snotes_write on public.student_notes;
create policy snotes_read  on public.student_notes for select to authenticated using (public.is_admin());
create policy snotes_write on public.student_notes for all to authenticated using (public.can_write()) with check (public.can_write());
drop policy if exists sevents_read on public.student_events;
create policy sevents_read on public.student_events for select to authenticated using (public.is_admin());
-- student_events has no write policy: only the trigger (security definer) writes it.

-- Convert an inquiry into a student. Only for leads whose status is 'Enrollment Confirmed'.
-- One student per lead (unique lead_id). Copies only what the family already gave us.
create or replace function public.convert_lead_to_student(p_lead_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.leads%rowtype; sid uuid; pid uuid;
begin
  if not public.can_write() then raise exception 'Not allowed'; end if;
  select * into l from public.leads where id = p_lead_id;
  if not found then raise exception 'Inquiry not found'; end if;
  if l.status <> 'Enrollment Confirmed' then raise exception 'Only inquiries with status "Enrollment Confirmed" can be converted'; end if;
  select id into sid from public.students where lead_id = p_lead_id;
  if sid is not null then raise exception 'This inquiry is already a student'; end if;
  select id into pid from public.programs where title = l.program_interest limit 1;
  insert into public.students(lead_id, full_name, country, program_id, created_by)
  values (p_lead_id, coalesce(nullif(trim(l.student_name),''), l.name), l.country, pid, auth.uid())
  returning id into sid;
  insert into public.guardians(student_id, name, email, whatsapp, is_primary)
  values (sid, l.name, l.email, l.whatsapp, true);
  return sid;
end $$;
revoke all on function public.convert_lead_to_student(uuid) from public, anon;
grant execute on function public.convert_lead_to_student(uuid) to authenticated;
