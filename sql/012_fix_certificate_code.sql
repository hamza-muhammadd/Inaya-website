-- Fix: certificate code no longer needs pgcrypto (gen_random_bytes is not on the search path in Supabase).
create or replace function public.issue_certificate_internal(p_student uuid, p_program uuid, p_level uuid, p_title text) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.certificates(student_id, program_id, level_id, code, title, issued_by)
  values (p_student, p_program, p_level, 'IQA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), p_title, auth.uid())
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then perform public.log_event(p_student, p_program, 'certificate', 'level', p_level, 'Certificate issued: ' || p_title); end if;
end $$;
