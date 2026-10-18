# Inaya Quran Academy — website + admin

Plain HTML site (no build step) for Vercel, with Supabase (Postgres + Auth + Storage) as the backend.

```
index.html, programs.html, program.html, assessment.html, about.html,
contact.html, faq.html, privacy.html, terms.html, 404.html   ← public pages
admin.html                                                    ← the whole admin panel (one page)
config.js                                                     ← put your Supabase URL + anon key here
css/site.css   js/site.js  js/sections.js  js/page.js  js/forms.js
sql/schema.sql                                                ← run once in Supabase SQL Editor
vercel.json                                                   ← clean URLs, /programs/:slug rewrite, security headers
docs/GUIDE_BN.md                                              ← full step-by-step guide (Bangla)
```

**Setup in short:** run `sql/schema.sql` → create your admin user → fill `config.js` → deploy to Vercel → open `/admin`.
Details: `docs/GUIDE_BN.md`.

Never put the Supabase `service_role` key anywhere in this project. The `anon` key in `config.js` is public by design; security comes from the Row-Level Security rules in `schema.sql`.
