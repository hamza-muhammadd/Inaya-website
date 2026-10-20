-- 008 · Copy cleanup (safe to re-run). Replaces the long dash in the seeded page titles and the
-- default site title with a plain "|" separator. Each statement only touches a row that still holds the
-- ORIGINAL seeded text, so anything you have edited yourself is left alone.
update public.pages set seo_title = 'Inaya Quran Academy | Quran Learning Made Simple'
  where slug = 'home' and seo_title = 'Inaya Quran Academy — Quran Learning Made Simple';
update public.pages set seo_title = 'About Inaya Quran Academy'
  where slug = 'about' and seo_title like '%—%';
update public.pages set seo_title = 'Privacy Policy | Inaya Quran Academy'
  where slug = 'privacy' and seo_title = 'Privacy Policy — Inaya Quran Academy';
update public.pages set seo_title = 'Terms of Use | Inaya Quran Academy'
  where slug = 'terms' and seo_title = 'Terms of Use — Inaya Quran Academy';
update public.site_settings
  set data = jsonb_set(data, '{seo_title}', to_jsonb('Inaya Quran Academy | Online Quran Learning'::text))
  where id = 1 and data->>'seo_title' = 'Inaya Quran Academy — Online Quran Learning';
update public.programs
  set student_profile = 'Beginners and learners who want to strengthen their Quran reading, for children and adults.'
  where student_profile = 'Beginners and learners who want to strengthen their Quran reading — children and adults.';
