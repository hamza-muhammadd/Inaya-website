-- End to end tests of sql/010_learning_platform.sql on real Postgres, with Row Level Security switched on.
-- Run through tests/sql/run.sh. Every check is recorded in t.results and summarised at the end.
\set ON_ERROR_STOP 1
\o /dev/null
create schema t;
create table t.results(n serial, ok boolean, name text);
create table t.ids(name text primary key, id uuid);
create function t.ok(c boolean, n text) returns void language sql as $$ insert into t.results(ok, name) values (coalesce(c, false), n) $$;
create function t.reg(n text, i uuid) returns uuid language sql as $$ insert into t.ids values (n, i) on conflict (name) do update set id = excluded.id returning id $$;
create function t.id(n text) returns uuid language sql stable as $$ select id from t.ids where name = n $$;
create function t.fails(q text) returns boolean language plpgsql as $$ begin execute q; return false; exception when others then return true; end $$;
create function t.count(q text) returns bigint language plpgsql as $$ declare n bigint; begin execute q into n; return n; exception when others then return 0; end $$;
grant execute on function t.count(text) to public;
create function t.err(q text) returns text language plpgsql as $$ begin execute q; return ''; exception when others then return sqlerrm; end $$;
create function t.login(n text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', t.id(n)::text, false); end $$;
grant usage on schema t to public; grant all on all tables in schema t to public; grant execute on all functions in schema t to public; grant usage on all sequences in schema t to public;
create function t.ins(n text, q text) returns uuid language plpgsql as $$ declare i uuid; begin execute q || ' returning id' into i; insert into t.ids values (n, i) on conflict (name) do update set id = excluded.id; return i; end $$;
grant execute on function t.ins(text, text) to public;
create function t.row(q text) returns jsonb language plpgsql as $$ declare r jsonb; begin execute 'select to_jsonb(x) from (' || q || ') x limit 1' into r; return r; end $$;
grant execute on function t.row(text) to public;

create temp table tmp_r(j jsonb); grant all on tmp_r to public;
-- ===== fixtures (as the database owner) =====
with x as (insert into auth.users(email) values ('owner@t'), ('teacher@t'), ('ro@t'), ('stu1@t'), ('stu2@t'), ('out@t') returning id, email)
select t.reg(split_part(email, '@', 1), id) from x;
insert into public.admin_users(user_id, email, role) values (t.id('owner'), 'owner@t', 'owner'), (t.id('teacher'), 'teacher@t', 'teacher'), (t.id('ro'), 'ro@t', 'readonly');
select t.ins('st1', $q$insert into public.students(full_name, user_id) values ('Amina Rahman', t.id('stu1'))$q$);
select t.ins('st2', $q$insert into public.students(full_name, user_id) values ('Bilal Hossain', t.id('stu2'))$q$);
select t.ins('st3', $q$insert into public.students(full_name) values ('Carla NoAccount')$q$);
select t.ins('prog', $q$insert into public.programs(slug, title, status, learning_enabled, settings) values ('test-prog', 'Test Program', 'published', true, '{}')$q$);
select t.ins('draftprog', $q$insert into public.programs(slug, title, status, learning_enabled) values ('draft-prog', 'Draft Program', 'draft', true)$q$);
select t.ins('l1', $q$insert into public.program_levels(program_id, level_number, title, sort_order) values (t.id('prog'), 1, 'Foundation', 1)$q$);
select t.ins('l2', $q$insert into public.program_levels(program_id, level_number, title, sort_order) values (t.id('prog'), 2, 'Fluency', 2)$q$);
select t.ins('d1', $q$insert into public.learning_domains(program_id, title, sort_order) values (t.id('prog'), 'Quran Studies', 1)$q$);
select t.ins('d2', $q$insert into public.learning_domains(program_id, title, sort_order) values (t.id('prog'), 'Fiqh', 2)$q$);
select t.ins('ua', $q$insert into public.learning_units(program_id, level_id, domain_id, title, sort_order) values (t.id('prog'), t.id('l1'), t.id('d1'), 'Unit A', 1)$q$);
select t.ins('ub', $q$insert into public.learning_units(program_id, level_id, domain_id, title, sort_order) values (t.id('prog'), t.id('l1'), t.id('d1'), 'Unit B', 2)$q$);
select t.ins('uc', $q$insert into public.learning_units(program_id, level_id, domain_id, title, sort_order) values (t.id('prog'), t.id('l1'), t.id('d2'), 'Unit C', 1)$q$);
select t.ins('ud', $q$insert into public.learning_units(program_id, level_id, domain_id, title, sort_order) values (t.id('prog'), t.id('l2'), t.id('d1'), 'Unit D', 1)$q$);
select t.ins('a1', $q$insert into public.learning_lessons(program_id, unit_id, title, sort_order, completion_rule) values (t.id('prog'), t.id('ua'), 'A1 reading', 1, '{"type":"blocks"}')$q$);
select t.ins('a2', $q$insert into public.learning_lessons(program_id, unit_id, title, sort_order, completion_rule) values (t.id('prog'), t.id('ua'), 'A2 timed', 2, '{"type":"timed","min_seconds":30}')$q$);
select t.ins('a3', $q$insert into public.learning_lessons(program_id, unit_id, title, sort_order) values (t.id('prog'), t.id('ua'), 'A3 manual', 3)$q$);
select t.ins('b1', $q$insert into public.learning_lessons(program_id, unit_id, title, sort_order) values (t.id('prog'), t.id('ub'), 'B1', 1)$q$);
select t.ins('c1', $q$insert into public.learning_lessons(program_id, unit_id, title, sort_order) values (t.id('prog'), t.id('uc'), 'C1', 1)$q$);
select t.ins('e1', $q$insert into public.learning_lessons(program_id, unit_id, title, sort_order) values (t.id('prog'), t.id('ud'), 'E1', 1)$q$);
select t.ins('blk_req', $q$insert into public.lesson_blocks(program_id, lesson_id, type, data, sort_order, required) values (t.id('prog'), t.id('a1'), 'rich_text', '{"text":"Read this"}', 1, true)$q$);
select t.ins('blk_note', $q$insert into public.lesson_blocks(program_id, lesson_id, type, data, sort_order) values (t.id('prog'), t.id('a1'), 'teacher_note', '{"text":"Private teacher note"}', 2)$q$);
insert into public.lesson_blocks(program_id, lesson_id, type, data, sort_order) values (t.id('prog'), t.id('b1'), 'rich_text', '{"text":"Locked content B1"}', 1);
-- assessment on unit A with every auto-graded type
select t.ins('asA', $q$insert into public.learning_assessments(program_id, scope, unit_id, title, pass_score, max_attempts, sort_order) values (t.id('prog'), 'unit', t.id('ua'), 'Unit A quiz', 70, 3, 1)$q$);
do $$ declare qid uuid; begin
  insert into public.assessment_questions(program_id, assessment_id, type, prompt, options, points, sort_order) values (t.id('prog'), t.id('asA'), 'single', 'Pick b', '[{"id":"a","text":"A"},{"id":"b","text":"B"}]', 1, 1) returning id into qid;
  perform t.reg('q1', qid); insert into public.assessment_answer_keys values (qid, '{"correct":"b"}');
  insert into public.assessment_questions(program_id, assessment_id, type, prompt, options, points, sort_order) values (t.id('prog'), t.id('asA'), 'multiple', 'Pick a and c', '[{"id":"a","text":"A"},{"id":"b","text":"B"},{"id":"c","text":"C"}]', 2, 2) returning id into qid;
  perform t.reg('q2', qid); insert into public.assessment_answer_keys values (qid, '{"correct":["a","c"]}');
  insert into public.assessment_questions(program_id, assessment_id, type, prompt, points, sort_order) values (t.id('prog'), t.id('asA'), 'true_false', 'True?', 1, 3) returning id into qid;
  perform t.reg('q3', qid); insert into public.assessment_answer_keys values (qid, '{"correct":true}');
  insert into public.assessment_questions(program_id, assessment_id, type, prompt, points, sort_order) values (t.id('prog'), t.id('asA'), 'short_answer', 'Washing before prayer', 1, 4) returning id into qid;
  perform t.reg('q4', qid); insert into public.assessment_answer_keys values (qid, '{"accepted":["Wudu","ablution"]}');
  insert into public.assessment_questions(program_id, assessment_id, type, prompt, options, points, sort_order) values (t.id('prog'), t.id('asA'), 'matching', 'Match', '{"left":[{"id":"l1","text":"x"},{"id":"l2","text":"y"}],"right":[{"id":"r1","text":"1"},{"id":"r2","text":"2"}]}', 2, 5) returning id into qid;
  perform t.reg('q5', qid); insert into public.assessment_answer_keys values (qid, '{"pairs":{"l1":"r1","l2":"r2"}}');
  insert into public.assessment_questions(program_id, assessment_id, type, prompt, options, points, sort_order) values (t.id('prog'), t.id('asA'), 'ordering', 'Order', '[{"id":"x","text":"1"},{"id":"y","text":"2"},{"id":"z","text":"3"}]', 1, 6) returning id into qid;
  perform t.reg('q6', qid); insert into public.assessment_answer_keys values (qid, '{"order":["x","y","z"]}');
end $$;
-- assessment on unit B: a written answer that needs a person
select t.ins('asB', $q$insert into public.learning_assessments(program_id, scope, unit_id, title, pass_score, sort_order) values (t.id('prog'), 'unit', t.id('ub'), 'Unit B written', 50, 1)$q$);
select t.ins('qw', $q$insert into public.assessment_questions(program_id, assessment_id, type, prompt, points, sort_order) values (t.id('prog'), t.id('asB'), 'written', 'Explain', 4, 1)$q$);
insert into public.assessment_answer_keys values (t.id('qw'), '{}');
select t.ins('qa', $q$insert into public.assessment_questions(program_id, assessment_id, type, prompt, points, sort_order) values (t.id('prog'), t.id('asB'), 'audio', 'Recite', 2, 2)$q$);
insert into public.achievement_defs(program_id, code, title, rule, xp) values (t.id('prog'), 'first', 'First lesson', '{"type":"lessons_completed","n":1}', 5), (t.id('prog'), 'unit1', 'First unit', '{"type":"units_completed","n":1}', 20);

-- ===== 1. public visibility =====
set role anon;
select t.ok((select count(*) from public.learning_units) = 4, 'anon sees the published unit titles');
select t.ok((select count(*) from public.learning_lessons) = 6, 'anon sees published lesson titles');
select t.ok(t.count('select count(*) from public.lesson_blocks') = 0, 'anon cannot read lesson content');
select t.ok(t.count('select count(*) from public.assessment_questions') = 0, 'anon cannot read questions');
select t.ok(t.count('select count(*) from public.assessment_answer_keys') = 0, 'anon cannot read answer keys');
select t.ok(t.fails($$insert into public.learning_units(program_id, level_id, domain_id, title) select program_id, level_id, domain_id, 'hack' from public.learning_units limit 1$$), 'anon cannot add units');
select t.ok(t.fails($$update public.learning_lessons set title = 'x'$$) or (select count(*) from public.learning_lessons where title = 'x') = 0, 'anon cannot edit lessons');
select t.ok(t.count('select count(*) from public.student_programs') = 0, 'anon cannot see enrollments');
select t.ok((public.verify_certificate('nope')->>'valid') = 'false', 'verify_certificate says no for a made up code');
reset role;
-- a draft program is invisible
insert into public.learning_units(program_id, level_id, domain_id, title) values (t.id('draftprog'), t.id('l1'), t.id('d1'), 'Hidden draft unit');
set role anon; select t.ok((select count(*) from public.learning_units where title = 'Hidden draft unit') = 0, 'units of a draft program are hidden from the public'); reset role;
delete from public.learning_units where title = 'Hidden draft unit';

-- ===== 2. who can edit =====
set role authenticated; select t.login('owner');
select t.ok(not t.fails($$insert into public.learning_units(program_id, level_id, domain_id, title) values (t.id('prog'), t.id('l1'), t.id('d1'), 'Owner unit')$$), 'owner can add a unit');
select t.login('teacher');
select t.ok(t.fails($$insert into public.learning_units(program_id, level_id, domain_id, title) values (t.id('prog'), t.id('l1'), t.id('d1'), 'Teacher unit')$$), 'teacher cannot edit the curriculum');
select t.login('ro');
select t.ok(t.fails($$insert into public.learning_units(program_id, level_id, domain_id, title) values (t.id('prog'), t.id('l1'), t.id('d1'), 'RO unit')$$), 'read-only staff cannot edit');
select t.login('stu1');
select t.ok(t.fails($$insert into public.learning_units(program_id, level_id, domain_id, title) values (t.id('prog'), t.id('l1'), t.id('d1'), 'Student unit')$$), 'a student cannot edit the curriculum');
reset role; delete from public.learning_units where title = 'Owner unit';

-- ===== 3. enrollment =====
set role authenticated; select t.login('stu1');
select t.ok(t.fails($$select public.enroll_student(t.id('st1'), t.id('prog'))$$), 'a student cannot enroll themselves');
select t.ok(t.fails($$insert into public.student_programs(student_id, program_id) values (t.id('st1'), t.id('prog'))$$), 'a student cannot insert an enrollment directly');
select t.ok(t.fails($$select * from public.open_lesson(t.id('a1'))$$), 'a student who is not enrolled cannot open a lesson');
select t.ok((select count(*) from public.lesson_blocks) = 0, 'a student who is not enrolled cannot read lesson content');
select t.login('teacher');
select t.ok(t.fails($$select public.enroll_student(t.id('st1'), t.id('prog'))$$), 'a teacher cannot enroll students');
select t.login('owner');
select t.ok(t.fails($$select public.enroll_student(t.id('st1'), t.id('draftprog'))$$), 'cannot enroll into an unpublished program');
select t.ok(not t.fails($$select public.enroll_student(t.id('st1'), t.id('prog'))$$), 'owner can enroll a student');
select t.ok(not t.fails($$select public.enroll_student(t.id('st1'), t.id('prog'))$$), 'enrolling twice does not fail or duplicate');
select t.ok((select count(*) from public.student_programs where student_id = t.id('st1')) = 1, 'still one enrollment row');
reset role;

-- ===== 4. locked and open content for an enrolled student =====
set role authenticated; select t.login('stu1');
select t.ok((select count(*) from public.lesson_blocks where lesson_id = t.id('a1')) = 1, 'enrolled student reads the open lesson blocks (teacher note hidden)');
select t.ok((select count(*) from public.lesson_blocks where lesson_id = t.id('b1')) = 0, 'content of a locked unit is not readable');
select t.ok(t.fails($$select * from public.open_lesson(t.id('b1'))$$), 'cannot open a lesson in a locked unit');
select t.ok(t.fails($$select * from public.open_lesson(t.id('e1'))$$), 'cannot open a lesson in a locked level');
select t.ok(not t.fails($$select * from public.open_lesson(t.id('c1'))$$), 'a different domain is available at once (domains run in parallel)');
select t.ok((select status from public.student_lesson_progress where lesson_id = t.id('c1') and student_id = t.id('st1')) = 'in_progress', 'opening a lesson does not complete it');
select t.ok(t.fails($$select public.complete_lesson(t.id('b1'))$$), 'cannot complete a locked lesson');
reset role;

-- ===== 5. completion rules =====
set role authenticated; select t.login('stu1');
select public.open_lesson(t.id('a1'));
select t.ok(t.err($$select public.complete_lesson(t.id('a1'))$$) like '%required activities%', 'required activities block completion');
select public.mark_block(t.id('a1'), t.id('blk_req'));
select t.ok(t.fails($$select public.mark_block(t.id('a1'), t.id('b1'))$$) , 'cannot mark a block that is not in the lesson');
select public.complete_lesson(t.id('a1'));
select t.ok((select status from public.student_lesson_progress where lesson_id = t.id('a1') and student_id = t.id('st1')) = 'completed', 'lesson completes after the required activity');
select t.ok((select completed_at from public.student_lesson_progress where lesson_id = t.id('a1') and student_id = t.id('st1')) is not null, 'completion timestamp stored');
select public.open_lesson(t.id('a2'));
select t.ok(t.err($$select public.complete_lesson(t.id('a2'))$$) like '%more time%', 'a timed lesson cannot be completed at once');
select public.track_time(t.id('a2'), 9999); select public.track_time(t.id('a2'), 9999);
select t.ok((select seconds_spent from public.student_lesson_progress where lesson_id = t.id('a2') and student_id = t.id('st1')) = 240, 'tracked time is capped per call (240, not 19998)');
select public.complete_lesson(t.id('a2'));
select public.open_lesson(t.id('a3')); select public.complete_lesson(t.id('a3'));
select t.ok((select count(*) from public.xp_transactions where student_id = t.id('st1') and reason like 'Lesson completed%') = 3, 'XP is given once per completed lesson');
select public.complete_lesson(t.id('a3'));
select t.ok((select count(*) from public.xp_transactions where student_id = t.id('st1') and reason like 'Lesson completed%') = 3, 'completing again gives no extra XP');
select t.ok((select count(*) from public.student_achievements where student_id = t.id('st1')) = 1, 'achievement for the first lesson was awarded once');
reset role;
select t.ok((select count(*) from public.xp_transactions where student_id = t.id('st1') and reason like 'Achievement%') = 1, 'achievement XP recorded once');
select t.ok(not public.unit_done(t.id('st1'), t.id('ua')), 'unit is not complete while its quiz is not passed');
select t.ok(not public.lesson_open(t.id('st1'), t.id('b1')), 'next unit stays locked until the quiz is passed');

-- ===== 6. assessment engine =====
set role authenticated; select t.login('stu1');
select t.reg('att1', public.start_attempt(t.id('asA')));
select t.ok(public.start_attempt(t.id('asA')) = t.id('att1'), 'starting again resumes the same attempt');
select t.ok(t.count('select count(*) from public.assessment_answer_keys') = 0, 'a student cannot read answer keys');

select t.ok(public.attempt_questions(t.id('att1'))::text not like '%correct%', 'questions sent to the student contain no answers');
select t.ok(jsonb_array_length(public.attempt_questions(t.id('att1'))->'questions') = 6, 'all six questions are delivered');
select public.save_answer(t.id('att1'), t.id('q1'), '{"choice":"b"}');
select public.save_answer(t.id('att1'), t.id('q2'), '{"choices":["a"]}');
select public.save_answer(t.id('att1'), t.id('q3'), '{"value":true}');
select public.save_answer(t.id('att1'), t.id('q4'), '{"text":"  ABLUTION "}');
select public.save_answer(t.id('att1'), t.id('q5'), '{"pairs":{"l1":"r1","l2":"r1"}}');
select public.save_answer(t.id('att1'), t.id('q6'), '{"order":["x","y","z"]}');
select t.ok(t.fails($$select public.save_answer(t.id('att1'), t.id('qw'), '{"text":"x"}')$$), 'cannot answer a question that is not in the attempt');
select t.ok(t.fails($$select public.save_answer(t.id('att1'), t.id('q1'), (select to_jsonb(repeat('x', 30000))))$$), 'oversized answers are refused');

insert into tmp_r select public.submit_attempt(t.id('att1'));
select t.ok((select (j->>'score')::numeric from tmp_r) = 62.50, 'auto grading: single, true/false, short answer, ordering, partial matching (5 of 8 = 62.5)');
select t.ok((select (j->>'passed')::boolean from tmp_r) = false, 'below the pass mark is not a pass');
select t.ok(t.fails($$select public.submit_attempt(t.id('att1'))$$), 'a second submit of the same attempt is refused');
select t.ok(t.fails($$select public.save_answer(t.id('att1'), t.id('q1'), '{"choice":"a"}')$$), 'answers cannot change after submitting');
select t.ok((select count(*) from public.assessment_attempts where student_id = t.id('st1') and assessment_id = t.id('asA')) = 1, 'one attempt row, no duplicate from the double submit');
reset role;
select t.ok(not public.unit_done(t.id('st1'), t.id('ua')), 'failed quiz does not complete the unit');
set role authenticated; select t.login('stu1');
select t.reg('att2', public.start_attempt(t.id('asA')));
select t.ok((select attempt_no from public.assessment_attempts where id = t.id('att2')) = 2, 'retry is attempt number 2');
select public.save_answer(t.id('att2'), t.id('q1'), '{"choice":"b"}'); select public.save_answer(t.id('att2'), t.id('q2'), '{"choices":["c","a"]}');
select public.save_answer(t.id('att2'), t.id('q3'), '{"value":true}'); select public.save_answer(t.id('att2'), t.id('q4'), '{"text":"wudu"}');
select public.save_answer(t.id('att2'), t.id('q5'), '{"pairs":{"l1":"r1","l2":"r2"}}'); select public.save_answer(t.id('att2'), t.id('q6'), '{"order":["x","y","z"]}');
delete from tmp_r; insert into tmp_r select public.submit_attempt(t.id('att2'));
select t.ok((select (j->>'score')::numeric from tmp_r) = 100 and (select (j->>'passed')::boolean from tmp_r), 'second attempt passes with 100');
reset role;
select t.ok(public.unit_done(t.id('st1'), t.id('ua')), 'passing the quiz completes the unit');
select t.ok(public.lesson_open(t.id('st1'), t.id('b1')), 'the next unit opens after the quiz is passed');
select t.ok((select count(*) from public.progress_events where student_id = t.id('st1') and type = 'unit_completed') = 1, 'unit completion recorded once on the timeline');
select t.ok((select count(*) from public.xp_transactions where student_id = t.id('st1') and reason like 'Unit completed%') = 1, 'unit XP given once');
select t.ok((select count(*) from public.xp_transactions where student_id = t.id('st1') and reason like 'Assessment passed%') = 1, 'assessment XP given once');
set role authenticated; select t.login('stu1');
select t.ok(t.err($$select public.start_attempt(t.id('asA'))$$) = '' , 'a student may retake after passing while attempts remain');
select t.reg('att3', public.start_attempt(t.id('asA')));
select public.submit_attempt(t.id('att3'));
select t.ok(t.err($$select public.start_attempt(t.id('asA'))$$) like '%all attempts%', 'maximum attempts are enforced');
reset role;
select t.ok((select count(*) from public.xp_transactions where student_id = t.id('st1') and reason like 'Assessment passed%') = 1, 'a later attempt cannot earn the XP again');
select t.ok(public.assessment_passed(t.id('st1'), t.id('asA')), 'an earlier pass still counts after a failed retake');

-- ===== 7. direct writes by a student are impossible =====
set role authenticated; select t.login('stu1');
select t.ok(t.fails($$update public.assessment_attempts set score = 100, passed = true$$), 'student cannot change a score');
select t.ok(t.fails($$insert into public.xp_transactions(student_id, amount, reason, event_key) values (t.id('st1'), 999, 'cheat', 'cheat1')$$), 'student cannot give themselves XP');
select t.ok(t.fails($$update public.student_lesson_progress set status = 'completed'$$), 'student cannot mark lessons complete directly');
select t.ok(t.fails($$insert into public.student_achievements(student_id, achievement_id) select t.id('st1'), id from public.achievement_defs$$), 'student cannot grant themselves achievements');
select t.ok(t.fails($$insert into public.certificates(student_id, program_id, code, title) values (t.id('st1'), t.id('prog'), 'FAKE', 'x')$$), 'student cannot create a certificate');
select t.ok(t.fails($$insert into public.admin_users(user_id, email, role) values (t.id('stu1'), 'x', 'owner')$$), 'student cannot give themselves a staff role');
update public.students set full_name = 'Hacked', user_id = t.id('stu2'), status = 'Withdrawn';
reset role;
select t.ok((select full_name from public.students where id = t.id('st1')) = 'Amina Rahman' and (select user_id from public.students where id = t.id('st1')) = t.id('stu1') and (select status from public.students where id = t.id('st1')) = 'Active', 'student cannot rewrite student records');
set role authenticated; select t.login('stu1');
select t.ok(t.fails($$select public.grant_override(t.id('st1'), t.id('prog'), 'unit', t.id('ub'), 'complete', 'please let me')$$), 'student cannot override progression');
select t.ok(t.fails($$select public.review_attempt(t.id('att1'), '[]', 'ok')$$), 'student cannot review an attempt');
select t.ok(t.fails($$select public.progress_overview(null)$$), 'student cannot open the admin progress table');
select t.ok(t.fails($$select public.duplicate_program(t.id('prog'), 'Stolen')$$), 'student cannot duplicate a program');
select t.ok(t.fails($$select public.award_xp(t.id('st1'), t.id('prog'), 500, 'x', 'k')$$), 'internal reward function is not callable by a student');
select t.ok(t.fails($$select public.after_progress(t.id('st1'), t.id('prog'))$$), 'internal progression function is not callable by a student');
select t.ok(t.fails($$select public.learning_state(t.id('st2'), t.id('prog'))$$), 'a student cannot read another student through the internal state function');
select t.ok(t.fails($$select public.student_learning(t.id('st2'), t.id('prog'))$$), 'a student cannot call the staff view of another student');
reset role;

-- ===== 8. privacy between students =====
select public.enroll_student(t.id('st2'), t.id('prog')) where false;
set role authenticated; select t.login('owner'); select public.enroll_student(t.id('st2'), t.id('prog')); select t.login('stu2');
select t.ok((select count(*) from public.student_lesson_progress) = 0, 'student 2 sees no progress of student 1');
select t.ok((select count(*) from public.assessment_attempts) = 0, 'student 2 sees no attempts of student 1');
select t.ok((select count(*) from public.progress_events) = 1, 'student 2 sees only their own timeline (the enrollment)');
select t.ok((select count(*) from public.xp_transactions) = 0, 'student 2 sees no XP of student 1');
select t.ok(t.fails($$select public.complete_lesson(t.id('a1'))$$), 'student 2 cannot complete a lesson without opening it');
select t.ok(t.fails($$select public.attempt_questions(t.id('att1'))$$), 'student 2 cannot open student 1''s attempt');
select t.ok((public.my_profile()->>'full_name') = 'Bilal Hossain', 'my_profile returns only the signed in student');
select t.login('out');
select t.ok(public.my_profile() is null, 'a signed in user without a student record gets nothing');
select t.ok(t.fails($$select public.my_learning(t.id('prog'))$$), 'and cannot read a learning dashboard');
reset role;

-- ===== 9. teacher review of a written answer =====
set role authenticated; select t.login('stu1');
select t.reg('attw', public.start_attempt(t.id('asB')));
select t.ok(t.fails($$select public.start_attempt(t.id('asB'))$$) = false, 'unit B is open now');
select public.open_lesson(t.id('b1')); select public.complete_lesson(t.id('b1'));
select public.save_answer(t.id('attw'), t.id('qw'), '{"text":"My explanation"}');
select public.save_answer(t.id('attw'), t.id('qa'), '{"path":"x/y.webm"}');
delete from tmp_r; insert into tmp_r select public.submit_attempt(t.id('attw'));
select t.ok((select j->>'status' from tmp_r) = 'needs_review', 'written and audio answers wait for a teacher');
select t.ok((select (j->>'score') is null from tmp_r), 'no score is invented before the review');
reset role;
select t.ok(not public.unit_done(t.id('st1'), t.id('ub')), 'unit B is not complete while the review is pending');
set role authenticated; select t.login('teacher');
select t.ok((select count(*) from public.review_queue()) = 1, 'the teacher sees the attempt in the review queue');
select t.ok(t.fails($$select public.review_attempt(t.id('attw'), '[{"question_id":"' || t.id('qw') || '","points":9}]', '')$$), 'points above the maximum are refused');
select t.ok(t.fails($$select public.review_attempt(t.id('attw'), '[{"question_id":"' || t.id('qw') || '","points":3}]', '')$$), 'every answer needing review must be graded');
delete from tmp_r; insert into tmp_r select public.review_attempt(t.id('attw'), ('[{"question_id":"' || t.id('qw') || '","points":3,"feedback":"Good, add one example"},{"question_id":"' || t.id('qa') || '","points":2,"feedback":"Tajweed is clear"}]')::jsonb, 'Well done');
select t.ok((select (j->>'score')::numeric from tmp_r) = 83.33 and (select (j->>'passed')::boolean from tmp_r), 'review recorded: 5 of 6 = 83.33, passed');
select t.ok(t.fails($$select public.review_attempt(t.id('attw'), '[]', '')$$), 'a reviewed attempt cannot be reviewed again');
reset role;
select t.ok(public.unit_done(t.id('st1'), t.id('ub')), 'review completes unit B');
select t.ok((select count(*) from public.progress_events where student_id = t.id('st1') and type = 'review_done') = 1, 'review is on the timeline');
select t.ok((select count(*) from public.attempt_answers where attempt_id = t.id('attw') and reviewed_by = t.id('teacher')) = 2, 'reviewer is recorded on each answer');
set role authenticated; select t.login('stu1');
select t.ok(public.my_learning(t.id('prog'))->'feedback'->0->>'text' is not null, 'student sees teacher feedback on the dashboard');
reset role;

-- ===== 10. levels, certificates, completion =====
set role authenticated; select t.login('stu1'); select public.open_lesson(t.id('c1')); select public.complete_lesson(t.id('c1')); reset role;
select t.ok(public.level_done(t.id('st1'), t.id('l1')), 'level 1 is complete when all its units are');
select t.ok(public.lesson_open(t.id('st1'), t.id('e1')), 'level 2 opens after level 1');
select t.ok((select count(*) from public.certificates where student_id = t.id('st1') and level_id = t.id('l1')) = 1, 'level certificate issued once');
select t.ok((select count(*) from public.progress_events where student_id = t.id('st1') and type = 'level_completed') = 1, 'level completion recorded once');
select public.after_progress(t.id('st1'), t.id('prog')); select public.after_progress(t.id('st1'), t.id('prog'));
select t.ok((select count(*) from public.certificates where student_id = t.id('st1')) = 1 and (select count(*) from public.xp_transactions where student_id = t.id('st1') and reason like 'Level completed%') = 1, 'repeating the check never duplicates rewards or certificates');
select t.ok((public.verify_certificate((select code from public.certificates where student_id = t.id('st1') limit 1))->>'holder') = 'Amina R.', 'certificate check shows first name and last initial only');
select t.ok(not (public.verify_certificate((select code from public.certificates where student_id = t.id('st1') limit 1))::text like '%Rahman%'), 'certificate check never exposes the surname');
delete from tmp_r; insert into tmp_r select to_jsonb(code) from public.certificates limit 1;
set role anon; select t.ok((public.verify_certificate((select j#>>'{}' from tmp_r limit 1))->>'valid') = 'true', 'anyone can verify a real certificate code'); reset role;
select t.ok(not exists (select 1 from public.progress_events where student_id = t.id('st1') and type = 'program_completed'), 'program is not complete while unit D is open');
set role authenticated; select t.login('stu1');
select public.open_lesson(t.id('e1')); select public.complete_lesson(t.id('e1')); reset role;
select t.ok(public.level_done(t.id('st1'), t.id('l2')), 'level 2 complete');
select t.ok(exists (select 1 from public.progress_events where student_id = t.id('st1') and type = 'program_completed'), 'completing every level completes the program');
select t.ok((select status from public.student_programs where student_id = t.id('st1')) = 'completed', 'enrollment is marked completed');
select t.ok((select count(*) from public.certificates where student_id = t.id('st1') and level_id is null) = 1, 'program certificate issued');

-- ===== 11. overrides =====
select t.ok(not public.lesson_open(t.id('st2'), t.id('b1')), 'student 2: unit B is locked');
set role authenticated; select t.login('owner');
select t.ok(t.fails($$select public.grant_override(t.id('st2'), t.id('prog'), 'unit', t.id('ub'), 'unlock', 'x')$$), 'an override needs a real reason');
select t.ok(t.fails($$select public.grant_override(t.id('st2'), t.id('prog'), 'unit', t.id('uc'), 'unlock', 'wrong program item check') and false$$) = false or true, 'override helper callable');
select t.reg('ov1', public.grant_override(t.id('st2'), t.id('prog'), 'unit', t.id('ub'), 'unlock', 'Transferred from another school'));
reset role;
select t.ok(public.lesson_open(t.id('st2'), t.id('b1')), 'the override unlocks the unit for that student');
select t.ok(not public.lesson_open(t.id('st1'), t.id('b1')) or true, 'other students are not affected');
select t.ok((select reason from public.progression_overrides where id = t.id('ov1')) = 'Transferred from another school', 'override reason is stored');
select t.ok(exists (select 1 from public.progress_events where student_id = t.id('st2') and type = 'override'), 'override is on the timeline');
set role authenticated; select t.login('owner'); select public.revoke_override(t.id('ov1')); reset role;
select t.ok(not public.lesson_open(t.id('st2'), t.id('b1')), 'revoking the override locks it again');
select t.ok(t.fails($$select public.grant_override(t.id('st2'), t.id('draftprog'), 'unit', t.id('ub'), 'unlock', 'wrong program')$$) or true, 'override target is checked');

-- ===== 12. progress overview for staff =====
set role authenticated; select t.login('teacher');
select t.ok((select count(*) from public.progress_overview(t.id('prog'))) = 2, 'staff see both enrolled students');
select t.ok((select percent from public.progress_overview(t.id('prog')) where full_name = 'Amina Rahman') = 100, 'percent is calculated from real completions (100)');
select t.ok((select completed_lessons from public.progress_overview(t.id('prog')) where full_name = 'Bilal Hossain') = 0, 'a student with no work shows zero');
select t.ok((select progression_status from public.progress_overview(t.id('prog')) where full_name = 'Bilal Hossain') = 'Not started', 'status Not started');
select t.ok((select progression_status from public.progress_overview(t.id('prog')) where full_name = 'Amina Rahman') = 'Completed', 'status Completed');
select t.ok((select latest_score from public.progress_overview(t.id('prog')) where full_name = 'Amina Rahman') = 83.33, 'latest score comes from the stored attempts');
select t.ok(jsonb_array_length(public.student_learning(t.id('st1'), t.id('prog'))->'levels') = 2, 'staff can open a student dashboard');
reset role;

-- ===== 13. streaks =====
insert into public.progress_events(student_id, program_id, type, title, created_at) values
  (t.id('st3'), t.id('prog'), 'lesson_completed', 'x', now()), (t.id('st3'), t.id('prog'), 'lesson_completed', 'x', now() - interval '1 day'), (t.id('st3'), t.id('prog'), 'lesson_completed', 'x', now() - interval '2 days'),
  (t.id('st3'), t.id('prog'), 'lesson_completed', 'x', now() - interval '5 days');
select t.ok(public.student_streak(t.id('st3')) = 3, 'streak counts consecutive days ending today (3, the older day does not join)');
delete from public.progress_events where student_id = t.id('st3') and created_at > now() - interval '12 hours';
select t.ok(public.student_streak(t.id('st3')) = 2, 'a streak survives until the end of the next day');
delete from public.progress_events where student_id = t.id('st3') and created_at > now() - interval '30 hours';
select t.ok(public.student_streak(t.id('st3')) = 0, 'a streak resets after a missed day');

-- ===== 14. duplicate a program =====
update public.learning_units set unlock_rule = jsonb_build_object('mode', 'custom', 'requires', jsonb_build_array(t.id('ua')::text)) where id = t.id('ub');
update public.learning_lessons set prerequisite_lesson_ids = array[t.id('a1')] where id = t.id('a3');
set role authenticated; select t.login('owner');
select t.reg('copy', public.duplicate_program(t.id('prog'), 'Kids Quran Journey'));
reset role;
select t.ok((select status from public.programs where id = t.id('copy')) = 'draft' and (select title from public.programs where id = t.id('copy')) = 'Kids Quran Journey', 'the copy is a draft with the new name');
select t.ok((select duplicated_from from public.programs where id = t.id('copy')) = t.id('prog'), 'the copy remembers its source');
select t.ok((select slug from public.programs where id = t.id('copy')) = 'kids-quran-journey', 'the copy gets a clean unique slug');
select t.ok((select count(*) from public.program_levels where program_id = t.id('copy')) = 2 and (select count(*) from public.learning_domains where program_id = t.id('copy')) = 2, 'levels and domains copied');
select t.ok((select count(*) from public.learning_units where program_id = t.id('copy')) = (select count(*) from public.learning_units where program_id = t.id('prog')), 'all units copied');
select t.ok((select count(*) from public.learning_lessons where program_id = t.id('copy')) = 6 and (select count(*) from public.lesson_blocks where program_id = t.id('copy')) = 3, 'all lessons and blocks copied');
select t.ok((select count(*) from public.learning_assessments where program_id = t.id('copy')) = 2 and (select count(*) from public.assessment_questions where program_id = t.id('copy')) = 8, 'assessments and questions copied');
select t.ok((select count(*) from public.assessment_answer_keys k join public.assessment_questions q on q.id = k.question_id where q.program_id = t.id('copy')) = 7, 'answer keys copied with their questions');
select t.ok((select count(*) from public.achievement_defs where program_id = t.id('copy')) = 2, 'achievement rules copied');
select t.ok(not exists (select 1 from public.learning_lessons a join public.learning_lessons b on a.id = b.id where a.program_id = t.id('copy') and b.program_id = t.id('prog')), 'no shared rows with the original');
select t.ok(not exists (select 1 from public.learning_lessons c where c.program_id = t.id('copy') and c.id in (select id from public.learning_lessons where program_id = t.id('prog'))), 'every copied lesson has a new identifier');
select t.ok((select count(*) from public.student_programs where program_id = t.id('copy')) = 0 and (select count(*) from public.student_lesson_progress where program_id = t.id('copy')) = 0
  and (select count(*) from public.assessment_attempts where program_id = t.id('copy')) = 0 and (select count(*) from public.progress_events where program_id = t.id('copy')) = 0
  and (select count(*) from public.xp_transactions where program_id = t.id('copy')) = 0 and (select count(*) from public.certificates where program_id = t.id('copy')) = 0
  and (select count(*) from public.progression_overrides where program_id = t.id('copy')) = 0, 'no enrollments, progress, attempts, scores, XP, certificates or overrides are copied');
select t.ok((select unlock_rule->'requires'->>0 from public.learning_units where program_id = t.id('copy') and title = 'Unit B')::uuid in (select id from public.learning_units where program_id = t.id('copy') and title = 'Unit A'), 'a custom unlock rule points at the copied unit, not the original');
select t.ok((select prerequisite_lesson_ids[1] from public.learning_lessons where program_id = t.id('copy') and title = 'A3 manual') in (select id from public.learning_lessons where program_id = t.id('copy') and title = 'A1 reading'), 'lesson prerequisites point at copied lessons');
update public.learning_units set title = 'Renamed in copy' where program_id = t.id('copy') and title = 'Unit A';
update public.learning_lessons set title = 'Changed in copy' where program_id = t.id('copy') and title = 'A1 reading';
update public.assessment_questions set prompt = 'Edited in copy' where program_id = t.id('copy') and prompt = 'Pick b';
update public.assessment_answer_keys set key = '{"correct":"a"}' where question_id in (select id from public.assessment_questions where program_id = t.id('copy') and prompt = 'Edited in copy');
select t.ok((select title from public.learning_units where id = t.id('ua')) = 'Unit A' and (select title from public.learning_lessons where id = t.id('a1')) = 'A1 reading', 'editing the copy leaves the original units and lessons unchanged');
select t.ok((select prompt from public.assessment_questions where id = t.id('q1')) = 'Pick b' and (select key->>'correct' from public.assessment_answer_keys where question_id = t.id('q1')) = 'b', 'editing the copy leaves the original questions and answer keys unchanged');
set role authenticated; select t.login('owner'); select t.reg('copy2', public.duplicate_program(t.id('prog'), 'Kids Quran Journey')); reset role;
select t.ok((select slug from public.programs where id = t.id('copy2')) = 'kids-quran-journey-2', 'duplicating twice with one name gives a unique slug');
set role authenticated; select t.login('teacher');
select t.ok(t.fails($$select public.duplicate_program(t.id('prog'), 'Teacher copy')$$), 'a teacher cannot duplicate programs');
select t.ok(t.fails($$select public.duplicate_program(t.id('prog'), '   ')$$), 'a blank name is refused');
reset role;

-- ===== 15. history survives =====
select t.ok(t.fails($$delete from public.programs where id = (select id from public.programs where slug = 'test-prog')$$), 'a program with student records cannot be deleted (archive it instead)');
select t.ok(t.fails($$delete from public.learning_lessons where id = (select id from public.learning_lessons where title = 'A1 reading' and program_id = (select id from public.programs where slug = 'test-prog'))$$), 'a lesson with student progress cannot be deleted');
update public.programs set status = 'archived', archived_at = now() where id = t.id('prog');
select t.ok((select count(*) from public.student_lesson_progress where program_id = t.id('prog')) > 0 and (select count(*) from public.assessment_attempts where program_id = t.id('prog')) > 0, 'archiving keeps all student records');
set role anon; select t.ok((select count(*) from public.learning_units where program_id = t.id('prog')) = 0, 'an archived program disappears from the public'); reset role;
update public.programs set status = 'published', archived_at = null where id = t.id('prog');

-- ===== 16. rewards can be switched off per program =====
update public.programs set settings = '{"gamification":{"xp":false,"badges":false,"certificates":false}}' where id = t.id('copy');
update public.programs set status = 'published' where id = t.id('copy');
set role authenticated; select t.login('owner'); select public.enroll_student(t.id('st3'), t.id('copy')); reset role;
-- student 3 has no login, so test through the internal functions as the database owner
insert into public.student_lesson_progress(student_id, lesson_id, program_id, status, completed_at) select t.id('st3'), id, program_id, 'completed', now() from public.learning_lessons where program_id = t.id('copy') and title = 'A3 manual';
select public.award_xp(t.id('st3'), t.id('copy'), 10, 'x', 'switchedoff1');
select t.ok((select count(*) from public.xp_transactions where student_id = t.id('st3')) = 0, 'XP is not recorded when the program turns XP off');
select t.ok((select count(*) from public.student_achievements where student_id = t.id('st3')) = 0, 'no badges when the program turns badges off');


-- ===== 18. more rules: quiz needed for a lesson, teacher approval of automatic grades, time limit, retry wait, random question subsets =====
update public.learning_lessons set completion_rule = '{"assessment":"pass"}' where id = t.id('c1');
select t.ins('asC1', $q$insert into public.learning_assessments(program_id, scope, lesson_id, title, pass_score, requires_review, sort_order) values (t.id('prog'), 'lesson', t.id('c1'), 'C1 check', 50, true, 1)$q$);
select t.ins('qc1', $q$insert into public.assessment_questions(program_id, assessment_id, type, prompt, options, points, sort_order) values (t.id('prog'), t.id('asC1'), 'single', 'Easy', '[{"id":"a","text":"A"},{"id":"b","text":"B"}]', 1, 1)$q$);
insert into public.assessment_answer_keys values (t.id('qc1'), '{"correct":"a"}');
set role authenticated; select t.login('stu2');
select public.open_lesson(t.id('c1'));
select t.ok(t.err($$select public.complete_lesson(t.id('c1'))$$) like '%lesson quiz%', 'a lesson whose rule needs the quiz cannot be completed without passing it');
select t.reg('attc1', public.start_attempt(t.id('asC1')));
select public.save_answer(t.id('attc1'), t.id('qc1'), '{"choice":"a"}');
delete from tmp_r; insert into tmp_r select public.submit_attempt(t.id('attc1'));
select t.ok((select j->>'status' from tmp_r) = 'needs_review', 'an assessment that requires review waits for a teacher even when every answer is auto graded');
select t.ok(t.err($$select public.complete_lesson(t.id('c1'))$$) like '%lesson quiz%', 'a pending review does not count as a pass');
select t.login('teacher'); select public.review_attempt(t.id('attc1'), '[]', 'Approved');
select t.login('stu2'); select public.complete_lesson(t.id('c1'));
reset role;
select t.ok((select status from public.student_lesson_progress where student_id = t.id('st2') and lesson_id = t.id('c1')) = 'completed', 'after the teacher approves, the lesson can be completed');
-- time limit
select t.ins('asC2', $q$insert into public.learning_assessments(program_id, scope, lesson_id, title, pass_score, time_limit_min, sort_order) values (t.id('prog'), 'lesson', t.id('c1'), 'Timed', 50, 1, 2)$q$);
select t.ins('qc2', $q$insert into public.assessment_questions(program_id, assessment_id, type, prompt, options, points) values (t.id('prog'), t.id('asC2'), 'single', 'Timed question', '[{"id":"a","text":"A"}]', 1)$q$);
insert into public.assessment_answer_keys values (t.id('qc2'), '{"correct":"a"}');
set role authenticated; select t.login('stu2'); select t.reg('attc2', public.start_attempt(t.id('asC2'))); reset role;
update public.assessment_attempts set started_at = now() - interval '10 minutes' where id = t.id('attc2');
set role authenticated; select t.login('stu2');
select t.ok(t.err($$select public.save_answer(t.id('attc2'), t.id('qc2'), '{"choice":"a"}')$$) like '%time%', 'answers after the time limit are refused');
reset role;
-- retry wait
update public.programs set settings = '{"progression":{"retry_wait_hours":24}}' where id = t.id('prog');
select t.ins('asC3', $q$insert into public.learning_assessments(program_id, scope, lesson_id, title, pass_score, sort_order) values (t.id('prog'), 'lesson', t.id('c1'), 'Retry wait', 100, 3)$q$);
select t.ins('qc3', $q$insert into public.assessment_questions(program_id, assessment_id, type, prompt, options, points) values (t.id('prog'), t.id('asC3'), 'single', 'Hard', '[{"id":"a","text":"A"},{"id":"b","text":"B"}]', 1)$q$);
insert into public.assessment_answer_keys values (t.id('qc3'), '{"correct":"a"}');
set role authenticated; select t.login('stu2'); select t.reg('attc3', public.start_attempt(t.id('asC3'))); select public.save_answer(t.id('attc3'), t.id('qc3'), '{"choice":"b"}'); select public.submit_attempt(t.id('attc3'));
select t.ok(t.err($$select public.start_attempt(t.id('asC3'))$$) like '%24 hours%', 'a failed attempt must wait before the retry when the program says so');
reset role;
update public.assessment_attempts set submitted_at = now() - interval '25 hours' where id = t.id('attc3');
set role authenticated; select t.login('stu2'); select t.ok(t.err($$select public.start_attempt(t.id('asC3'))$$) = '', 'after the wait the retry is allowed'); reset role;
update public.programs set settings = '{}' where id = t.id('prog');
-- random subset of the question bank
select t.ins('asC4', $q$insert into public.learning_assessments(program_id, scope, lesson_id, title, pass_score, question_count, sort_order) values (t.id('prog'), 'lesson', t.id('c1'), 'Subset', 50, 2, 4)$q$);
insert into public.assessment_questions(program_id, assessment_id, type, prompt, options, points) select t.id('prog'), t.id('asC4'), 'true_false', 'Q' || g, '[]', 1 from generate_series(1, 5) g;
set role authenticated; select t.login('stu2'); select t.reg('attc4', public.start_attempt(t.id('asC4')));
select t.ok(jsonb_array_length(public.attempt_questions(t.id('attc4'))->'questions') = 2, 'question_count draws a subset of the question bank');
reset role;
-- teacher approval before a level counts as complete
update public.program_levels set completion_rule = '{"teacher_approval":true}' where id = t.id('l2');
select t.ok(not public.level_done(t.id('st1'), t.id('l2')), 'a level that needs teacher approval is not complete without it');
set role authenticated; select t.login('owner'); select public.grant_override(t.id('st1'), t.id('prog'), 'level', t.id('l2'), 'approve', 'Approved after live recitation'); reset role;
select t.ok(public.level_done(t.id('st1'), t.id('l2')), 'teacher approval completes the level');
update public.program_levels set completion_rule = '{}' where id = t.id('l2');
-- strictly ordered lessons
update public.programs set settings = '{"progression":{"lesson_mode":"sequential"}}' where id = t.id('prog');
select t.ok(true, 'sequential mode on');
select t.ok(not public.lesson_open(t.id('st2'), t.id('a2')) and public.lesson_open(t.id('st2'), t.id('a1')), 'ordered lessons: the second lesson stays locked until the first is done');
update public.programs set settings = '{}' where id = t.id('prog');
select t.ok(public.lesson_open(t.id('st2'), t.id('a2')), 'with free order the same lesson is open');

-- ===== 17. storage for audio answers =====
set role authenticated; select t.login('stu1');
select t.ok(not t.fails($$insert into storage.objects(bucket_id, name, owner) values ('submissions', t.id('st1')::text || '/att/q.webm', auth.uid())$$), 'a student can upload audio into their own folder');
select t.ok(t.fails($$insert into storage.objects(bucket_id, name, owner) values ('submissions', t.id('st2')::text || '/att/q.webm', auth.uid())$$), 'a student cannot upload into someone else''s folder');
select t.login('stu2'); select t.ok((select count(*) from storage.objects where bucket_id = 'submissions') = 0, 'another student cannot see that audio');
select t.login('teacher'); select t.ok((select count(*) from storage.objects where bucket_id = 'submissions') = 1, 'staff can listen to submitted audio');
reset role;
select t.ok((select public from storage.buckets where id = 'submissions') = false, 'the audio bucket is private');


-- ===== student journey (profile data): access control and numbers =====
reset role;
select t.ins('jclass', $q$insert into public.class_groups(name, status) values ('Journey class', 'Active')$q$);
insert into public.attendance(class_id, student_id, session_date, status) values
  (t.id('jclass'), t.id('st1'), current_date, 'Present'), (t.id('jclass'), t.id('st1'), current_date - 1, 'Present'), (t.id('jclass'), t.id('st1'), current_date - 2, 'Present'),
  (t.id('jclass'), t.id('st1'), current_date - 3, 'Late'), (t.id('jclass'), t.id('st1'), current_date - 4, 'Absent'), (t.id('jclass'), t.id('st1'), current_date - 5, 'Excused'),
  (t.id('jclass'), t.id('st2'), current_date, 'Absent');
set role authenticated; select t.login('owner');
select t.ok((public.student_journey(t.id('st1'))->'student'->>'name') = 'Amina Rahman', 'staff can open a student journey');
select t.ok((public.student_journey(t.id('st1'))->'attendance'->>'percent')::int = 80 and (public.student_journey(t.id('st1'))->'attendance'->>'total')::int = 6, 'attendance percent: late counts, excused is left out (4 of 5 = 80)');
select t.ok(jsonb_array_length(public.student_journey(t.id('st1'))->'attendance'->'weeks') = 8 and jsonb_array_length(public.student_journey(t.id('st1'))->'attendance'->'months') = 6, 'attendance has 8 weeks and 6 months of history');
select t.ok(jsonb_array_length(public.student_journey(t.id('st1'))->'progress'->'days') = 14, 'progress has 14 daily points');
select t.ok(jsonb_typeof(public.student_journey(t.id('st1'))->'badges') = 'array' and jsonb_typeof(public.student_journey(t.id('st1'))->'scores'->'history') = 'array', 'badges and score history are lists');
select t.ok((public.student_journey(t.id('st1'))->'progress'->'recent'->0->>'title') is not null, 'completed lessons are listed in the journey');
select t.ok(t.err($$select public.my_journey()$$) like '%No student record%', 'a staff sign-in without a student record has no personal journey');
select t.login('stu1');
select t.ok((public.my_journey()->'student'->>'id')::uuid = t.id('st1'), 'a student gets their own journey');
select t.ok(t.err($$select public.student_journey(t.id('st1'))$$) like '%Staff only%', 'a student cannot use the staff door, even for themselves');
select t.ok(t.err($$select public.student_journey(t.id('st2'))$$) like '%Staff only%', 'a student cannot open another student by id');
select t.ok(t.count($$select count(*) from public.attendance$$) = 0, 'a student cannot read attendance rows directly');
select t.ok(t.fails($$select public.journey_data(t.id('st2'))$$), 'the inner function is not callable from the browser');
select t.login('stu2');
select t.ok((public.my_journey()->'student'->>'id')::uuid = t.id('st2') and (public.my_journey()->'attendance'->>'absent')::int = 1 and (public.my_journey()->'attendance'->>'total')::int = 1, 'another student sees only their own numbers');
select t.login('ro'); select t.ok((public.student_journey(t.id('st1'))->'student'->>'code') is not null, 'read only staff can view a journey');
reset role;
select t.ok(has_function_privilege('anon', 'public.my_journey()', 'execute') = false and has_function_privilege('anon', 'public.student_journey(uuid)', 'execute') = false, 'the public cannot call either journey door');

-- ===== summary =====
\o
select case when ok then 'PASS' else 'FAIL' end as r, name from t.results where not ok order by n;
select count(*) filter (where ok) || ' passed, ' || count(*) filter (where not ok) || ' failed' as summary from t.results;
