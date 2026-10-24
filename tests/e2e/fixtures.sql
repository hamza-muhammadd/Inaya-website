-- Fixtures for the browser end to end tests (run after tests/sql/reset_db.sh).
insert into auth.users(id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'owner@e2e.test'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'teacher@e2e.test'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'readonly@e2e.test');
insert into public.admin_users(user_id, email, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'owner@e2e.test', 'owner'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'teacher@e2e.test', 'teacher'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'readonly@e2e.test', 'readonly');
insert into public.teachers(id, full_name) values ('bbbbbbbb-0000-4000-8000-000000000001', 'Ustadh Yusuf');
insert into public.students(id, full_name) values
  ('cccccccc-0000-4000-8000-000000000001', 'Aisha Khan'),
  ('cccccccc-0000-4000-8000-000000000002', 'Omar Ali');
