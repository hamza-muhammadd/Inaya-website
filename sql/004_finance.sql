-- =====================================================================
-- Inaya Quran Academy, Phase 4: FINANCE (manual records only)
-- Additive. Run AFTER 003_classes.sql. Safe to run twice.
-- NO card numbers, NO online payment processing. Staff record payments
-- that were received outside the system (cash, bank transfer, mobile wallet).
-- Only owner and administrator can read or write finance data.
-- =====================================================================
create or replace function public.is_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and role in ('owner','administrator'));
$$;

create sequence if not exists public.invoice_seq start 1001;

create table if not exists public.fee_plans (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  amount     numeric(12,2) not null check (amount >= 0),
  currency   text not null check (currency ~ '^[A-Z]{3}$'),
  period     text not null default 'Monthly' check (period in ('Monthly','Term','One-time')),
  active     boolean not null default true,
  note       text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  invoice_no  text unique not null default ('INV-' || nextval('public.invoice_seq')),
  student_id  uuid not null references public.students(id) on delete restrict,
  plan_id     uuid references public.fee_plans(id) on delete set null,
  description text not null default '',
  amount      numeric(12,2) not null check (amount > 0),
  currency    text not null check (currency ~ '^[A-Z]{3}$'),
  due_date    date not null,
  voided_at   timestamptz,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_invoices_student on public.invoices(student_id);

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete restrict,
  amount      numeric(12,2) not null check (amount > 0),
  method      text not null check (method in ('Cash','Bank transfer','Mobile wallet','Other')),
  received_on date not null default current_date,
  reference   text check (reference is null or reference !~ '(\d[ -]?){13,}'),   -- blocks card-like numbers
  note        text not null default '',
  recorded_by uuid,
  voided_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_payments_invoice on public.payments(invoice_id);

create table if not exists public.teacher_pay_records (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  period     text not null check (length(trim(period)) > 0),     -- e.g. 2026-10
  amount     numeric(12,2) not null check (amount >= 0),
  currency   text not null check (currency ~ '^[A-Z]{3}$'),
  status     text not null default 'Due' check (status in ('Due','Paid')),
  paid_on    date,
  note       text not null default '',
  voided_at  timestamptz,
  created_at timestamptz not null default now()
);

alter table public.fee_plans           enable row level security;
alter table public.invoices            enable row level security;
alter table public.payments            enable row level security;
alter table public.teacher_pay_records enable row level security;
do $$ declare t text; begin
  foreach t in array array['fee_plans','invoices','payments','teacher_pay_records'] loop
    execute format('drop policy if exists %I on public.%I', t||'_fin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_finance()) with check (public.is_finance())', t||'_fin', t);
  end loop;
end $$;
