# Phase 0 — Discovery, Baseline Audit & Project Inventory

**Inaya Quran Academy Management System · Audit date: 2026-10-19**
**Mode: read-only.** No code, database, policy, user, auth setting or production data was changed during this audit. (Test runs wrote only screenshots/CSV files in a private scratch folder.)

---

## 0. Read this first — what this audit could and could NOT verify

| Area | Verified? | How / why not |
|---|---|---|
| Project files (HTML/JS/CSS/SQL) | **Yes** | Read and analysed directly. |
| Database design, relationships, RLS policies, functions, storage rules | **Partly — from the SQL files only** | I have **no access to your live Supabase project** (no credentials, and none should be shared). What the live database really contains is **Not Verified**. |
| Whether `002`–`006` SQL files were ever run on your Supabase | **Not Verified** | I cannot see it. The SQL itself was **never executed on a real Postgres by me** (the sandbox cannot install Postgres). It was reviewed by reading only. |
| Real login, real data, real uploads, real e-mail | **Not Verified** | All behaviour tests used a **mock Supabase client** in a headless browser, not your real backend. |
| Live public site | **Partly** | `https://www.inayaquran.com/` responds; page title and metadata are correct. Visible content is built by JavaScript, so I could not read it as text. `/admin` could not be fetched (robots-blocked for my fetch tool, as intended). |
| Git history / baseline checkpoint | **No** | The project folder is **not a Git repository**. |
| Backups / recovery | **Not Verified** | Cannot see your Supabase backup settings. |

Also stated plainly: **I built most of this application myself earlier in this conversation**, so this is not an audit of someone else's code; it is an honest self-audit, and it is deliberately critical.

---

## 1. Phase Submission Report (required format)

### 1. Phase name and objective
Phase 0 — read-only discovery of the existing application and its Supabase design; produce inventories, a security/UX/data risk register and a prioritised plan.

### 2. Status
**Partially completed.** Everything that can be audited from the project files and a mock browser is done. Everything that needs your live Supabase project is **Blocked** (no access) and is listed in §0 and in the "Needs your input" list (§12).

### 3. What was implemented
Nothing was implemented (read-only phase). Produced: this report (`docs/PHASE0_AUDIT_REPORT.md`).

### 4. Files changed
Only this new file: `docs/PHASE0_AUDIT_REPORT.md` (documentation). No application file was edited in this phase.

### 5. Database changes
**None.**

### 6. Existing functionality preserved
No change was made, so nothing could regress. The baseline regression runs in §7 confirm the current state.

### 7. Tests executed (all run against a mock backend — see §0)

| Test | Result | Status |
|---|---|---|
| `admintest` — loads 14 admin views, editor edit/save/publish, validation modal, lead status change | No JS errors; all assertions as expected | **Passed (mock)** |
| `studtest` — student list, convert-from-lead, duplicate convert blocked, profile save, guardian add/validate, notes, archive, manual add | No JS errors; all assertions as expected | **Passed (mock)** |
| `classtest` — teacher create/validation, class create, schedule slot, roster, capacity warning, teacher-clash warning, timetable | No JS errors; all assertions as expected | **Passed (mock)** |
| `fintest` — fee plan, invoice, overpayment blocked, card-like reference blocked, payment/void, per-currency overview, teacher pay | No JS errors; all assertions as expected | **Passed (mock)** |
| `atttest` — attendance entry, no duplicate on re-save, past-date roster, student summary | No JS errors; all assertions as expected | **Passed (mock)** |
| `systest` — reminders, CSV downloads, users & access (grant/change/remove, bad e-mail, unknown e-mail), activity log, mobile overflow | All assertions as expected (one expected error toast was logged to the console) | **Passed (mock)** |
| `roletest` / `navrole` — finance and users pages blocked for assessor/teacher/readonly; nav hides them | Blocked as designed | **Passed (mock) — UI level only; database enforcement Not Tested** |
| `logintest` — login failure messages (bad credentials, unconfirmed, network, bad key) | 4/4 specific messages shown; show-password works | **Passed (mock)** |
| Accessibility/layout heuristic scan — 23 routes × 3 widths (1360/820/390 px) = 69 page loads | No JS errors, no horizontal overflow, exactly one `<h1>` per page, no unnamed buttons, no images without `alt`. **Findings:** unlabeled filter controls on 10 routes; 45 small touch targets (<32 px high) per screen width (135 counted across the three widths) | **Partly failed** (see UX register) |
| Public link check (internal `href`s vs existing pages) | No broken internal links found; `sitemap.xml` lists 11 URLs that match existing pages | **Passed** |
| Secret scan of project | No `service_role` key or JWT in code; `config.js` has empty placeholders | **Passed** |
| Real Supabase: schema, RLS, policies, storage, backups, real login | — | **Blocked** |
| RLS cross-role attack tests (direct API calls as teacher/assessor/etc.) | — | **Not Tested** (needs real database) |
| Real-data persistence after refresh | — | **Not Tested** |
| Public site rendered content | Page loads, title/metadata correct; body requires JavaScript | **Partly verified** |

### 8. Security verification
Done: code and SQL review for exposed secrets, RLS coverage, function grants, anon-exposed surface, XSS-escaping pattern. **Not done (blocked):** any test against live RLS. Findings are in §6.

### 9. Known issues and limitations
See the full register in §6–§9. The most important ones: (1) Teacher/read-only accounts can read **all** personal data; (2) no link between logins and teacher/guardian records, so scoped portals are impossible yet; (3) two overlapping "enrollment" systems; (4) not a Git repo; (5) SQL `002`–`006` never executed on a real database.

### 10. How you can review this
1. Open this report and read §3–§5 (what exists and what does not).
2. Check §6 "Security risk register" and tell me which items worry you most.
3. Answer the questions in §12.
4. If you can, tell me whether you ran `002`–`006` in Supabase and whether they succeeded (copy any red error text).

### 11. Acceptance criteria

| Criterion | Result |
|---|---|
| Existing system documented well enough to plan safe changes | **Passed for the code and SQL**; **Blocked** for the live database |
| No code or database writes made | **Passed** (only this document was added) |
| Navigation & Functionality Audit Matrix produced | **Passed** (§4) |
| Security risk report produced | **Passed** (§6) |
| UX/UI issue register produced | **Passed** (§8) |
| Prioritised implementation plan | **Passed** (§10) |
| Recommended backup and recovery strategy | **Passed** (§11) |

### 12. Recovery instructions
Nothing to recover: no application or database change was made. To remove this audit, delete `docs/PHASE0_AUDIT_REPORT.md`.

### 13. Next phase proposal
**Phase 1 — Recovery baseline, architecture & quality standards**: put the project under Git with a named baseline commit, move the test scripts into the repository, add a migration folder convention, document environments and recovery, verify your Supabase backup options. No feature work.

### 14. Approval request
**Please review this report and reply "Approved — start Phase 1"** (or tell me what to change). I will not start Phase 1 until you do.

---

## 2. Architecture report (verified from files)

| Item | Finding |
|---|---|
| Framework | **None.** Plain HTML pages + vanilla JavaScript (no React/Vue, no build step, no `package.json`). |
| Hosting | Vercel static hosting (`vercel.json`: clean URLs, `/programs/:slug` rewrite, security headers, `/admin` no-index + no-store). Live site responds at inayaquran.com. |
| Backend | Supabase (Postgres, Auth, Storage). Browser talks to it with the **anon key** via supabase-js 2.45.4 loaded from jsdelivr CDN (no integrity/SRI hash). |
| Admin app | One file, `admin.html` (≈2,000 lines): hash router, 18 view functions, shared helpers, all CSS and JS inline. |
| Public site | 11 HTML pages; content rendered by `js/site.js`, `js/sections.js`, `js/page.js`, `js/forms.js`. **Page body needs JavaScript** (a `<noscript>` message exists). |
| Edge Functions | **None exist.** No server-side code other than Postgres functions. |
| Tests / lint / types / CI | **None in the repository.** My test scripts exist only in a scratch folder. |
| Version control | **Not a Git repository.** |
| Environments | Only production is known. No staging documented. |
| Secrets | No `service_role` key in code (verified by scan). `config.js` in the project has empty values; your deployed copy holds the real URL/anon key (not seen). |

## 3. Database & relationship inventory (from SQL files; live DB unverified)

27 tables, **all with RLS enabled** in the SQL. Files: `schema.sql` (original), `002_students`, `003_classes`, `004_finance`, `005_attendance`, `006_users` (functions only).

| Area | Tables | Key relationships |
|---|---|---|
| Access | `admin_users` (roles: owner, administrator, assessor, teacher, readonly) | `user_id → auth.users` |
| Website | `site_settings`, `pages`, `faqs`, `media_assets` (+ storage bucket `media`, public read) | pages/sections draft vs published |
| Academics | `programs → program_levels → curriculum_modules` | cascade deletes down the chain |
| Funnel | `leads → lead_events`, `assessments`, `enrollments`, `contact_messages`, `cta_events` | `assessments/enrollments/lead_events → leads` **ON DELETE CASCADE** |
| Students | `students (lead_id unique)`, `guardians`, `student_notes`, `student_events` | `students.lead_id → leads` (SET NULL) |
| Operations | `teachers`, `class_groups (teacher_id, program_id, level_id)`, `class_slots`, `class_students`, `attendance` | `attendance` unique per class+student+date |
| Finance | `fee_plans`, `invoices → payments`, `teacher_pay_records` | `invoices.student_id`, `payments.invoice_id`, `teacher_pay_records.teacher_id` are **RESTRICT** (cannot delete) |

Database functions: `is_admin`, `admin_role`, `can_write`, `is_finance`, `is_owner`; RPCs `submit_lead`, `submit_contact`, `track_event` (callable by **anon**), `dashboard_metrics`, `analytics_summary`, `convert_lead_to_student`, `list_admins`, `add_admin_by_email`, `set_admin_role`, `remove_admin` (authenticated; owner-only inside the function where relevant). Audit triggers exist for leads and students only.

**Not present at all:** semesters, curriculum versions, books/materials, learning objectives, weekly plans, daily progress, achievement levels, badges/rewards/certificates, class *sessions* (only date-based attendance), HR/recruitment/contracts, guardian or teacher login links, notifications/queue, expenses/income ledger.

## 4. Navigation & Functionality Audit Matrix

Status key: **Implemented (mock-tested)** = works against the mock backend, never tested on your real Supabase.

| # | Sidebar item | Route | Reads | Writes | Status | Gaps found |
|---|---|---|---|---|---|---|
| 1 | Dashboard | `#overview` | leads, lead_events, contact_messages | none | Implemented (mock-tested) | Shows **inquiry data only** (no students/classes/finance). Aggregated in the browser, capped at 5,000 leads / 400 days. Old RPC `dashboard_metrics` is no longer used here. KPI/pill clicks, chart range, week calendar work in mock. |
| 2 | Leads & Inquiries | `#leads`, `#leads/<id>`, `#leads/messages` | leads, lead_events, assessments, enrollments, contact_messages | update status/notes, delete lead/message | Implemented (mock-tested) | Hard delete of a lead **cascades** to assessments/enrollments/history. Delete button hidden for non-admins in UI only (see S3). |
| 3 | Assessments | `#assessments` | assessments, leads, program_levels | insert/update/delete | Implemented (mock-tested) | Separate from students; link is via lead only. |
| 4 | Enrollments | `#enrollments` | enrollments, leads, programs | insert/update/delete | Implemented (mock-tested) | **Overlaps** with Students/Classes (see D1). Teacher and schedule are free text here. |
| 5 | Students | `#students`, `#students/<id>` | students, guardians, notes, events, attendance | create/update, convert from lead, archive | Implemented (mock-tested) | Needs `002` on live DB. No auth link for guardians. No status-transition rules. |
| 6 | Website Content | `#content`, `#content/faq`, `#content/page/<slug>` | pages, faqs | draft save, publish, FAQ CRUD | Implemented (mock-tested) | Live preview and publish tested only in mock. |
| 7 | Programs & Curriculum | `#programs`, `#programs/<id>`, `…/level/<id>` | programs, levels, modules | full CRUD | Implemented (mock-tested) | **No semesters, books, objectives, weekly plans.** "Quranic Beginnings" content not present. |
| 8 | Media Library | `#media` | media_assets | upload, rename, delete | Implemented (mock-tested) | Real upload/storage **Not Tested**. Bucket is **public** (fine for website images, wrong for private documents). No folders / usage tracking. |
| 9 | Analytics | `#analytics` | RPC `analytics_summary` | none | Implemented (mock-tested) | First-party click counts only; no visitor analytics unless GA4/Plausible configured. |
| 10 | Classes & Timetable | `#classes`, `#classes/<id>`, `#classes/timetable` | class_groups, slots, class_students, students, teachers | CRUD, roster, attendance | Implemented (mock-tested) | Clash/capacity are **browser warnings only**. No sessions, cancel/reschedule, time-zone conversion. |
| 11 | Teachers | `#teachers`, `#teachers/<id>` | teachers, class_groups | create/update/archive | Implemented (mock-tested) | Teachers have **no login link**. |
| 12 | Finance | `#finance` (+ `/invoices`, `/plans`, `/teacherpay`) | fee_plans, invoices, payments, students, teacher_pay_records | CRUD, void | Implemented (mock-tested) | Overpayment check is browser-only. No expenses/income ledger. Owner/administrator only (UI **and** DB, per SQL). |
| 13 | Reminders | `#reminders` | leads, messages, classes, students, invoices | none | Implemented (mock-tested) | Computed live; **no sending** of anything. |
| 14 | Reports | `#reports` | many | none (CSV download) | Implemented (mock-tested) | CSV only. No scheduled or role-specific reports. |
| 15 | Activity log | `#activity` | lead_events, student_events | none | Implemented (mock-tested) | Covers inquiries/students only (not finance, roles, deletes, attendance). Actor names not shown. |
| 16 | Users & Access | `#users` | RPCs | grant/change/remove role | Implemented (mock-tested) | Needs `006` on live DB. Roles differ from your requested list (§5). |
| 17 | Settings & Brand | `#settings` | site_settings | save | Implemented (mock-tested) | Logo/size/footer logo, colours, menu, SEO, analytics. |

Your list shows "Reminders" twice; the application has **one** Reminders route. Quick actions on the dashboard (Open leads / Edit website / Media / View site) all point to existing routes.

Interactive-control inventory (static count): ~167 element IDs, 6 `data-a` action types, 80 `innerHTML` render sites (245 escape-function calls), 2 native `confirm()` dialogs. A control-by-control click test on the **real** system is **Not Tested** and belongs to Phases 3 and 15.

## 5. Role & portal gap analysis

| You require | Exists today | Gap |
|---|---|---|
| Owner | `owner` | Protected by `006` (cannot demote/remove last owner) — **if `006` was run**. |
| Admin | `administrator` | Name differs; finance + everything except user management. |
| Teacher | `teacher` | **Read-only access to everything except finance**, not scoped to own classes; **no portal**. |
| HR | — | **Does not exist** (no role, tables, or portal). |
| Guardian | `guardians` table (contact data only) | **No login, no link to auth, no portal.** |
| (extra) | `assessor`, `readonly` | Not in your list; decision needed (§12). |

## 6. Security risk register

| ID | Severity | Finding | Evidence | Fix phase |
|---|---|---|---|---|
| S1 | **High** | Any account in `admin_users` — including `teacher` and `readonly` — can **read** leads, contact messages, assessments, enrollments, students, **guardian phone/e-mail**, teachers, attendance and notes (includes children's data). | RLS read policies use `is_admin()` for all non-finance tables. | 2, 8 |
| S2 | **High** | No relationship between a login and a teacher or guardian record, so "teachers only see their classes / guardians only see their child" **cannot be enforced yet**. | `teachers` and `guardians` have no `user_id`. | 2 |
| S3 | Medium | Delete permission is broader than the UI suggests: policies are `for all … can_write()`, so an `assessor` could delete leads, assessments, enrollments, programs, FAQs or media by calling the API directly; the delete buttons are hidden only in the browser. Hard-deleting a lead cascades. | `schema.sql` policies; `canAdmin` checks in `admin.html`. | 2, 4 |
| S4 | Medium | Audit trail is partial: only lead and student events. No audit of finance changes, role changes, deletions, settings or attendance. | triggers exist only for `leads`, `students`. | 11, 12 |
| S5 | Medium | No `Content-Security-Policy` header; supabase-js loaded from a CDN **without an integrity hash**; admin builds HTML with `innerHTML` (escaping is used consistently, but a CSP would be the safety net). | `vercel.json`, `admin.html` script tag. | 1, 3 |
| S6 | Medium | Public form rate-limit is **global** (20 inquiries/minute for everyone): a bot could block real inquiries; no CAPTCHA. Honeypot exists. | `submit_lead`. | 13/14 |
| S7 | Medium | Public storage bucket: fine for website images, **unsafe for private documents** (HR files, certificates, student documents) — a private bucket must be used for those. | `media` bucket `public = true`. | 5, 9 |
| S8 | Low | Idle sign-out (60 min) is browser-side only; session lifetime otherwise depends on Supabase JWT settings (not verified). | `admin.html`. | 2 |
| S9 | Low | Overpayment, schedule-clash and capacity rules are enforced in the browser, not the database. | `finance`, `classes` code. | 4, 6, 12 |
| S10 | Info | **Good:** no service-role key in code; every table has RLS; finance restricted to owner/administrator in SQL; owner management functions are owner-only and guarded; SVG uploads blocked; user-supplied links validated. | verified by reading. | — |

All of the above are from **reading code/SQL**; none was confirmed against the live database.

## 7. Data-integrity & workflow findings

| ID | Severity | Finding | Phase |
|---|---|---|---|
| D1 | **High** | **Two parallel enrollment models**: legacy `enrollments` (tied to a lead, free-text teacher/schedule, status "ACTIVE") versus new `students` + `class_students` + `class_groups.teacher_id`. They are not linked; converting a lead to a student does not update the enrollment record. | 4 |
| D2 | **High** | **`002`–`006` never executed on a real database** by me; syntax/logic errors are possible until you run them (or I can).| 1 |
| D3 | Medium | Status changes are free (any status → any status); no transition rules. | 4 |
| D4 | Medium | Dashboard numbers are computed in the browser from the latest ≤5,000 leads (≤400 days). Fine for now, wrong at scale; Analytics uses a different (RPC) path. | 13 |
| D5 | Medium | Attendance is keyed by date only (no class *sessions*): cannot represent cancelled/rescheduled/make-up classes; times are not converted across time zones. | 6 |
| D6 | Medium | No migration tracking: SQL is applied by hand; no record of which version the live DB is on. | 1 |
| D7 | Low | `curriculum_modules.lessons` is free JSON — fine for now, not suitable for semester/weekly planning. | 5 |

## 8. UX / UI & accessibility register

| ID | Severity | Finding | Phase |
|---|---|---|---|
| U1 | Medium | **Unlabeled filter controls** (selects/checkboxes with no label) on 10 of 23 routes (e.g. dashboard chart range, leads filters, reports date range). | 3 |
| U2 | Medium | **About 45 touch targets under 32 px** tall on the routes scanned (Settings 23, Programs 8, others fewer) — hard to tap on mobile. | 3 |
| U3 | Medium | Role-specific navigation is incomplete: teacher/readonly users still see most menu items (only Finance and Users are hidden). Hiding is not security; S1 is the real fix. | 2, 3 |
| U4 | Medium | Dashboard shows inquiries only; no student, class, attendance or finance summary. | 11 |
| U5 | Low | Keyboard focus relies on browser defaults on buttons (custom focus styles only on inputs). | 3 |
| U6 | Low | Two native browser `confirm()` pop-ups (leave page / sign out) differ from the rest of the UI. | 3 |
| U7 | Low | Admin UI is English only; you write in Bangla — decide whether the admin should be bilingual. | 3 |
| U8 | Low | Public pages depend on JavaScript for content (SEO/no-JS visitors see only a notice). | 13 |
| U9 | Info | **Good:** no horizontal overflow at 390/820/1360 px on any audited route; single `<h1>` per page; no unnamed buttons; no images without alt. | — |

## 9. Master issue register (prioritised)

| Priority | IDs | Summary |
|---|---|---|
| **P0 — before any new feature** | D2, P1 (below), S1/S2 | Run and verify the SQL on a real DB; put the project in Git; fix over-broad read access. |
| **P1** | S3, D1, S4, S5 | Delete rules, one enrollment model, audit coverage, CSP/SRI. |
| **P2** | D3–D6, S6, S7, U1–U4 | Rules in the DB, sessions, private bucket, accessibility. |
| **P3** | U5–U8, S8, D7 | Polish. |

Process issues: **P1** not a Git repo (no checkpoint) · **P2** no automated tests inside the repo (mine are scratch-only) · **P3** single 2,000-line `admin.html` (hard to maintain safely) · **P4** no staging environment · **P5** backups unverified.

## 10. Prioritised implementation plan (proposal — not started)

| Phase | Focus | Notes from this audit |
|---|---|---|
| 1 | Git baseline, tests into repo, migration folder, environments, backup verification, CSP/SRI | Also runs `002`–`006` on a **staging/new** Supabase project to prove they work. |
| 2 | Roles (Owner, Admin, Teacher, HR, Guardian), `user_id` links for teachers/guardians, scoped RLS, delete restrictions | Fixes S1–S3. Needs your role decisions (§12). |
| 3 | Navigation/UX/accessibility sweep | U1–U6. |
| 4 | Lifecycle: one enrollment model, status rules | D1, D3. |
| 5 | Semesters, books/materials (private bucket), **Quranic Beginnings** | Needs your approved curriculum documents. |
| 6 | Sessions, attendance rules, time zones | D5. |
| 7 | Progress, five achievement levels, badges, certificates | Needs approved completion criteria. |
| 8–10 | Teacher, HR, Guardian portals | After Phase 2. |
| 11–14 | Owner dashboard, finance hardening, website/media, notifications | Notifications need a provider and your approval. |
| 15–16 | End-to-end regression, deployment & handover | |

## 11. Recommended backup & recovery strategy

1. **Code:** initialise Git, make a baseline commit named `baseline-2026-10-19`, keep the zip as an off-site copy. *(Verified today: no Git exists.)*
2. **Database:** in Supabase, check **Database → Backups** for your plan (daily backups on paid plans; point-in-time recovery is an add-on). Until verified, treat as **no backup**. Before every migration, export with `pg_dump` (schema + data) or a Supabase dashboard backup, and **store it outside Supabase**.
3. **Safe migrations:** apply each phase's SQL first on a **separate staging Supabase project**, then production. Keep numbered, additive migration files; never drop tables or data without written approval.
4. **Storage:** download the `media` bucket contents periodically.
5. **Recovery drill:** restore a backup into the staging project once, to prove it works.

## 12. Needs your input before Phase 1/2

1. Did you already run `002`–`006` in Supabase? Any red errors? (If not, I will not assume they work.)
2. May I create a **separate staging Supabase project** (you create it; I never need your keys) for safe testing?
3. Which role names do you want — keep `administrator`, merge or remove `assessor` and `readonly`? Should HR see **no** student data at all?
4. Where are the **approved Quranic Beginnings curriculum documents** (needed for Phase 5/7)? I will not invent content.
5. Admin language: English only, or Bangla too?
6. Payments/notifications: any provider chosen? (None is assumed today.)
7. Is the old **Enrollments** page still used in your daily work, or may Students/Classes replace it (after migrating the data safely)?

## 13. Honest summary

- The existing application is a **real, working first version** in its design and mock tests, covering 17 modules — but it has **never been proven on your live database in my tests**.
- The **biggest risks** are not visual: broad read access for non-owner roles, no teacher/guardian identity links, overlapping enrollment models, and no Git/baseline.
- It is **not production-ready for multi-role use** (teachers, HR, guardians). It is reasonable for a single owner/admin running the website and inquiries, once `002`–`006` are verified.
- No feature from Phases 5, 7, 8, 9, 10, 14 (curriculum/semesters, progress/gamification, the four portals, notifications) **exists yet**.
