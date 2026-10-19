# Inaya Academy Management System — Audit & Roadmap

Rule for this project: one module at a time, each tested before the next starts. Nothing below is claimed to work unless it says **Built**.

## 1. Audit of what exists (Phase 1 baseline)
| Area | Status |
|---|---|
| Public website (HTML, Vercel) | **Built** — home/about/programs/FAQ/assessment/contact/privacy/terms |
| Supabase schema, RLS, roles | **Built, SQL not yet run on a real database by me** |
| Admin: Website Content editor (draft/publish, live preview) | **Built** (tested with a mocked backend) |
| Admin: Programs & Curriculum | **Built** (mock-tested) |
| Admin: Leads, Assessments, Enrollments (separate stages) | **Built** (mock-tested) |
| Admin: Media Library, Analytics (first-party), Settings | **Built** (mock-tested) |
| Admin UI shell v2 (sage frame, floating sidebar, topbar search, alerts bell, user menu) | **Built this step** |
| Dashboard with real data (KPIs, inquiries chart, pipeline, follow-up week calendar) | **Built this step** |
| Students (Phase 2): list/search/filter, add manually, convert from a *Enrollment Confirmed* inquiry, profile, guardians, notes, status history, archive/restore | **Built** (mock-tested). Needs `sql/002_students.sql` run in Supabase |
| Teachers + Classes & Timetable (Phase 3): teacher profiles/status/availability, classes with teacher, program/level, capacity, weekly time slots, student roster (join/leave dates), teacher-clash and capacity warnings, weekly timetable view | **Built** (mock-tested). Needs `sql/003_classes.sql` run in Supabase |
| Finance (Phase 4): fee plans, invoices, manual payment records (void, not delete), teacher pay ledger, per-currency overview, CSV exports. Owner/administrator only | **Built** (mock-tested). Needs `sql/004_finance.sql` |
| Attendance (Phase 5): per class and date, Present/Absent/Late/Excused, student 90-day summary | **Built** (mock-tested). Needs `sql/005_attendance.sql` |
| Reminders, Reports (CSV), Activity log, Users & Access (owner only; grant/change/remove roles) | **Built** (mock-tested). Users & Access needs `sql/006_users.sql` |
| Brand & Logo | Already in **Settings & Brand** (logo, colours, fonts, live preview) |
| Automatic email/WhatsApp notifications, online payments, payroll calculation | **Not built** (need server jobs / accounts; deliberately out of scope) |
| **Not built** — shown in sidebar as "SOON" with an honest placeholder page |

Not verified against real services: Supabase SQL execution, real login, email reset, storage upload, Vercel deploy, domain.

## 2. Architecture (unchanged)
Static HTML + vanilla JS on Vercel; Supabase Postgres/Auth/Storage; all authorization enforced by RLS; no service-role key in the browser; admin is one page (`/admin`).

## 3. Planned data relationships
`leads` → (conversion, manual, confirmed) → `students` → `guardians`, `enrollments_ams` (student ↔ program level) → `class_groups` ↔ `teachers` → `sessions`/`attendance`; `fee_plans` → `invoices` → `payments` (manual records only, never card data). Every table gets `deleted_at` (soft delete) and writes to an audit log.

## 4. Roadmap (one at a time; each ends with a test and your approval)
1. **Done:** UI shell + real-data dashboard + this audit.
2. **Done (needs SQL run):** Students — `sql/002_students.sql`. Guardian contacts are hard-deleted (with confirmation); students are soft-deleted (archive).
3. **Done (needs SQL run):** Teachers + Classes & Timetable — `sql/003_classes.sql`. Clash/capacity checks are warnings in the admin page, not database rules. Times are not converted between time zones. Attendance is NOT built yet.
4. **Done (needs SQL run):** Finance — `sql/004_finance.sql`.
5. **Done (needs SQL run):** Attendance — `sql/005_attendance.sql`.
6. **Done:** Reminders, Reports, Activity log; Users & Access — `sql/006_users.sql`.
7. **Next:** gap review with the owner (media usage/folders, page-builder polish, notifications, per-teacher visibility, tests on a real Supabase project).
5. Brand & Logo editor.
6. Automation/notifications, richer roles & permissions, trash & audit viewer, reports.

## 5. Risks
- SQL untested on a real Postgres: run `sql/schema.sql` on a fresh Supabase project first and report any error.
- Each new module adds migrations: they will ship as separate, additive SQL files (no destructive changes to existing data).
- Teacher/readonly roles currently see all leads; finer scoping arrives with the roles step.

## 6. Phase 1 test criteria (met in mock browser)
Dashboard renders with live-query data; KPI/pill clicks open filtered leads; search & bell work; planned modules show "Not built yet"; no horizontal overflow at 390 px; all 14 existing admin views still load; editor save/publish and lead status change still work.
