-- =====================================================================
-- Inaya Quran Academy: STUDENT JOURNEY (profile, attendance, scores, progress, badges, history)
-- Run AFTER 010 (and 012). Safe to run twice.
--
-- One function builds the whole picture for one student. Two doors lead to it:
--   student_journey(student_id)  staff only
--   my_journey()                 the signed-in student, and only their own record
-- Nothing is stored twice: every number is read from the tables that already exist.
-- =====================================================================

alter table public.students add column if not exists photo_url text;

-- how far a student is towards one badge rule (same rule types the badge engine uses)
create or replace function public.rule_progress(p_student uuid, p_program uuid, p_rule jsonb) returns int
language plpgsql stable security definer set search_path = public as $$
declare t text := p_rule->>'type'; got int := 0;
begin
  if t = 'lessons_completed' then
    select count(*) into got from public.student_lesson_progress where student_id = p_student and program_id = p_program and status = 'completed';
  elsif t = 'units_completed' then
    select count(*) into got from public.progress_events where student_id = p_student and program_id = p_program and type = 'unit_completed';
  elsif t = 'levels_completed' then
    select count(*) into got from public.progress_events where student_id = p_student and program_id = p_program and type = 'level_completed';
  elsif t = 'program_completed' then
    got := case when exists (select 1 from public.progress_events where student_id = p_student and program_id = p_program and type = 'program_completed') then 1 else 0 end;
  elsif t = 'perfect_score' then
    got := case when exists (select 1 from public.assessment_attempts where student_id = p_student and program_id = p_program and status = 'graded' and score = 100) then 1 else 0 end;
  elsif t = 'streak_days' then
    got := public.student_streak(p_student);
  end if;
  return got;
end $$;

create or replace function public.journey_data(p_student uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_student jsonb; v_programs jsonb; v_att jsonb; v_scores jsonb; v_prog jsonb; v_badges jsonb; v_certs jsonb; v_hist jsonb;
  today date := (now() at time zone 'UTC')::date;
begin
  select jsonb_build_object('id', s.id, 'code', s.student_code, 'name', s.full_name, 'status', s.status, 'photo_url', s.photo_url, 'country', s.country,
      'start_date', s.start_date, 'email', (select u.email from auth.users u where u.id = s.user_id), 'has_login', s.user_id is not null)
    into v_student from public.students s where s.id = p_student;
  if v_student is null then return null; end if;

  -- enrolments with lesson totals
  select coalesce(jsonb_agg(x.j order by x.e), '[]'::jsonb) into v_programs from (
    select sp.enrolled_at e, jsonb_build_object('program_id', p.id, 'title', p.title, 'status', sp.status, 'enrolled_at', sp.enrolled_at, 'completed_at', sp.completed_at,
        'teacher', t.full_name, 'lessons', c.tot, 'done', c.dn, 'percent', case when c.tot > 0 then round(100.0 * c.dn / c.tot) else 0 end) j
      from public.student_programs sp join public.programs p on p.id = sp.program_id left join public.teachers t on t.id = sp.teacher_id
      cross join lateral (select count(*) tot, count(*) filter (where public.lesson_done(p_student, l.id)) dn
                          from public.learning_lessons l join public.learning_units u on u.id = l.unit_id and u.status = 'published'
                          where l.program_id = p.id and l.status = 'published') c
     where sp.student_id = p_student and sp.status <> 'withdrawn') x;

  -- attendance. Late counts as attended. Excused days are left out of the percentage.
  select jsonb_build_object(
      'total', count(*), 'present', count(*) filter (where status = 'Present'), 'late', count(*) filter (where status = 'Late'),
      'absent', count(*) filter (where status = 'Absent'), 'excused', count(*) filter (where status = 'Excused'),
      'percent', case when count(*) filter (where status <> 'Excused') > 0
                      then round(100.0 * count(*) filter (where status in ('Present', 'Late')) / count(*) filter (where status <> 'Excused')) end)
    into v_att from public.attendance where student_id = p_student;
  v_att := v_att || jsonb_build_object(
    'months', (select coalesce(jsonb_agg(jsonb_build_object('key', to_char(m, 'YYYY-MM'), 'label', to_char(m, 'Mon'),
          'present', coalesce(a.pr, 0), 'late', coalesce(a.la, 0), 'absent', coalesce(a.ab, 0), 'excused', coalesce(a.ex, 0)) order by m), '[]'::jsonb)
        from generate_series(date_trunc('month', today) - interval '5 months', date_trunc('month', today), interval '1 month') m
        left join (select date_trunc('month', session_date) mm, count(*) filter (where status = 'Present') pr, count(*) filter (where status = 'Late') la,
                          count(*) filter (where status = 'Absent') ab, count(*) filter (where status = 'Excused') ex
                     from public.attendance where student_id = p_student group by 1) a on a.mm = m),
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('key', to_char(w, 'YYYY-MM-DD'), 'label', to_char(w, 'DD Mon'),
          'present', coalesce(a.pr, 0), 'late', coalesce(a.la, 0), 'absent', coalesce(a.ab, 0), 'excused', coalesce(a.ex, 0)) order by w), '[]'::jsonb)
        from generate_series(date_trunc('week', today) - interval '7 weeks', date_trunc('week', today), interval '1 week') w
        left join (select date_trunc('week', session_date) ww, count(*) filter (where status = 'Present') pr, count(*) filter (where status = 'Late') la,
                          count(*) filter (where status = 'Absent') ab, count(*) filter (where status = 'Excused') ex
                     from public.attendance where student_id = p_student group by 1) a on a.ww = w),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('date', r.session_date, 'status', r.status, 'class', c.name, 'note', r.note) order by r.session_date desc, c.name), '[]'::jsonb)
        from (select * from public.attendance where student_id = p_student order by session_date desc limit 180) r left join public.class_groups c on c.id = r.class_id));

  -- scores: the best graded attempt of each assessment counts towards the running total
  with best as (
    select distinct on (t.assessment_id) t.assessment_id, t.earned, t.possible, t.score, t.passed
      from public.assessment_attempts t where t.student_id = p_student and t.status = 'graded' and t.possible is not null
      order by t.assessment_id, t.score desc nulls last, t.graded_at desc)
  select jsonb_build_object(
      'attempts', (select count(*) from public.assessment_attempts where student_id = p_student and status = 'graded'),
      'waiting', (select count(*) from public.assessment_attempts where student_id = p_student and status = 'needs_review'),
      'earned', coalesce((select sum(earned) from best), 0), 'possible', coalesce((select sum(possible) from best), 0),
      'percent', (select case when sum(possible) > 0 then round(100.0 * sum(earned) / sum(possible)) end from best),
      'assessments', (select count(*) from best), 'passed', (select count(*) from best where passed))
    into v_scores;
  v_scores := v_scores || jsonb_build_object(
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('key', to_char(w, 'YYYY-MM-DD'), 'label', to_char(w, 'DD Mon'), 'avg', a.av, 'n', coalesce(a.n, 0)) order by w), '[]'::jsonb)
        from generate_series(date_trunc('week', today) - interval '7 weeks', date_trunc('week', today), interval '1 week') w
        left join (select date_trunc('week', graded_at) ww, round(avg(score)) av, count(*) n from public.assessment_attempts
                    where student_id = p_student and status = 'graded' and graded_at is not null group by 1) a on a.ww = w),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('key', to_char(m, 'YYYY-MM'), 'label', to_char(m, 'Mon'), 'avg', a.av, 'n', coalesce(a.n, 0)) order by m), '[]'::jsonb)
        from generate_series(date_trunc('month', today) - interval '5 months', date_trunc('month', today), interval '1 month') m
        left join (select date_trunc('month', graded_at) mm, round(avg(score)) av, count(*) n from public.assessment_attempts
                    where student_id = p_student and status = 'graded' and graded_at is not null group by 1) a on a.mm = m),
    'history', (select coalesce(jsonb_agg(h.j order by h.at desc), '[]'::jsonb) from (
        select t.graded_at at, jsonb_build_object('id', t.id, 'title', a.title, 'scope', a.scope, 'attempt_no', t.attempt_no, 'score', t.score, 'earned', t.earned, 'possible', t.possible,
               'passed', t.passed, 'pass_score', a.pass_score, 'at', t.graded_at) j
          from public.assessment_attempts t join public.learning_assessments a on a.id = t.assessment_id
         where t.student_id = p_student and t.status = 'graded' order by t.graded_at desc nulls last limit 40) h));

  -- lesson progress: daily, weekly, monthly
  select jsonb_build_object(
    'days', (select coalesce(jsonb_agg(jsonb_build_object('key', to_char(d, 'YYYY-MM-DD'), 'label', to_char(d, 'DD Mon'), 'lessons', coalesce(c.n, 0), 'minutes', coalesce(c.m, 0)) order by d), '[]'::jsonb)
        from generate_series(today - 13, today, interval '1 day') d
        left join (select (completed_at at time zone 'UTC')::date dd, count(*) n, round(sum(seconds_spent) / 60.0) m from public.student_lesson_progress
                    where student_id = p_student and status = 'completed' and completed_at is not null group by 1) c on c.dd = d::date),
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('key', to_char(w, 'YYYY-MM-DD'), 'label', to_char(w, 'DD Mon'), 'lessons', coalesce(c.n, 0), 'minutes', coalesce(c.m, 0)) order by w), '[]'::jsonb)
        from generate_series(date_trunc('week', today) - interval '7 weeks', date_trunc('week', today), interval '1 week') w
        left join (select date_trunc('week', completed_at at time zone 'UTC') ww, count(*) n, round(sum(seconds_spent) / 60.0) m from public.student_lesson_progress
                    where student_id = p_student and status = 'completed' and completed_at is not null group by 1) c on c.ww = w),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('key', to_char(m, 'YYYY-MM'), 'label', to_char(m, 'Mon'), 'lessons', coalesce(c.n, 0), 'minutes', coalesce(c.mn, 0)) order by m), '[]'::jsonb)
        from generate_series(date_trunc('month', today) - interval '5 months', date_trunc('month', today), interval '1 month') m
        left join (select date_trunc('month', completed_at at time zone 'UTC') mm, count(*) n, round(sum(seconds_spent) / 60.0) mn from public.student_lesson_progress
                    where student_id = p_student and status = 'completed' and completed_at is not null group by 1) c on c.mm = m),
    'recent', (select coalesce(jsonb_agg(r.j order by r.at desc), '[]'::jsonb) from (
        select s.completed_at at, jsonb_build_object('title', l.title, 'at', s.completed_at, 'minutes', round(s.seconds_spent / 60.0)) j
          from public.student_lesson_progress s join public.learning_lessons l on l.id = s.lesson_id
         where s.student_id = p_student and s.status = 'completed' order by s.completed_at desc limit 12) r),
    'streak', public.student_streak(p_student),
    'xp', (select coalesce(sum(amount), 0) from public.xp_transactions where student_id = p_student),
    'lessons_in_progress', (select count(*) from public.student_lesson_progress where student_id = p_student and status = 'in_progress'))
  into v_prog;

  -- badges, earned and still locked, with how far the student is
  select coalesce(jsonb_agg(b.j order by (b.j->>'earned')::boolean desc, ((b.j->>'need')::int - (b.j->>'got')::int), b.j->>'title'), '[]'::jsonb) into v_badges from (
    select jsonb_build_object('id', d.id, 'title', d.title, 'description', d.description, 'icon', d.icon, 'xp', d.xp, 'type', d.rule->>'type',
        'need', greatest(coalesce((d.rule->>'n')::int, 1), 1), 'earned', sa.awarded_at is not null, 'awarded_at', sa.awarded_at,
        'got', case when sa.awarded_at is not null then greatest(coalesce((d.rule->>'n')::int, 1), 1)
                    when d.program_id is not null then least(public.rule_progress(p_student, d.program_id, d.rule), greatest(coalesce((d.rule->>'n')::int, 1), 1))
                    else least(coalesce((select max(public.rule_progress(p_student, sp.program_id, d.rule)) from public.student_programs sp where sp.student_id = p_student), 0),
                               greatest(coalesce((d.rule->>'n')::int, 1), 1)) end) j
      from public.achievement_defs d left join public.student_achievements sa on sa.achievement_id = d.id and sa.student_id = p_student
     where d.status = 'published' and (d.program_id is null or d.program_id in (select program_id from public.student_programs where student_id = p_student))) b;

  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title, 'issued_at', c.issued_at) order by c.issued_at desc), '[]'::jsonb)
    into v_certs from public.certificates c where c.student_id = p_student and c.revoked_at is null;

  select coalesce(jsonb_agg(e.j order by e.at desc, e.id desc), '[]'::jsonb) into v_hist from (
    select ev.created_at at, ev.id, jsonb_build_object('type', ev.type, 'title', ev.title, 'at', ev.created_at, 'program', p.title) j
      from public.progress_events ev left join public.programs p on p.id = ev.program_id
     where ev.student_id = p_student order by ev.created_at desc, ev.id desc limit 200) e;

  return jsonb_build_object('student', v_student, 'programs', v_programs, 'attendance', v_att, 'scores', v_scores, 'progress', v_prog,
                            'badges', v_badges, 'certificates', v_certs, 'history', v_hist, 'generated_at', now());
end $$;

create or replace function public.student_journey(p_student uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Staff only.'; end if;
  return public.journey_data(p_student);
end $$;

create or replace function public.my_journey() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare sid uuid := public.my_student_id();
begin
  if sid is null then raise exception 'No student record is linked to this sign-in.'; end if;
  return public.journey_data(sid);
end $$;

-- nothing is callable by default; only the two doors are
revoke all on function public.rule_progress(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.journey_data(uuid) from public, anon, authenticated;
revoke all on function public.student_journey(uuid) from public, anon;
revoke all on function public.my_journey() from public, anon;
grant execute on function public.student_journey(uuid) to authenticated;
grant execute on function public.my_journey() to authenticated;
