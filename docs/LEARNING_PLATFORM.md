# Learning platform: programs, lessons, quizzes and student progress

This guide explains what was added, how to switch it on, and how to use it day to day. Everything here is built into the same admin panel and website you already have.

## What you get

1. Admin, Academy, Learning Programs: build programs with levels, domains, units, lessons, content and assessments. Nothing is fixed. You can have two levels or ten, three domains or twelve.
2. Admin, Academy, Student Progress: a table of every enrolled student, a profile for each one, a review queue for written and audio answers, overrides with a reason, and certificates.
3. The learning area at /learn: students sign in, see their dashboard, open lessons, take quizzes, record audio answers and see teacher feedback.
4. A public curriculum section on each program page, showing levels, areas and unit titles only.
5. One ready sample program, Quranic Excellence ("Little Steps, Build a Lifetime of Iman."), with three levels and five domains.

## Switching it on (once)

1. Supabase, SQL Editor: run sql/010_learning_platform.sql, then sql/011_seed_quranic_excellence.sql. Both are safe to run twice.
2. Deploy the sign-in function: `npx supabase functions deploy student-account --use-api --project-ref YOUR_PROJECT_REF`
3. Optional but useful: `npx supabase secrets set SITE_URL=https://www.inayaquran.com --project-ref YOUR_PROJECT_REF` so password links return to /learn.
4. If you use automatic translation, replace supabase/functions/translate/core.js and deploy translate again. It now also knows the curriculum text.
5. Upload the whole website folder to Vercel again.

## The sample program is a draft with sample content

The Quranic Excellence program loads as a draft and every unit, lesson, quiz and badge carries a sample mark. The wording is a starting point written for review. Please read it, check every Arabic text against your approved source, edit what you want, then press "I have reviewed it" and "Publish". Level 2 and Level 3 have one representative unit per domain so you can see how they work.

## Building a program

Open Learning Programs, then a program. The Structure tab shows domains and levels. Use the plus buttons to add a unit, a lesson or an assessment, and the arrows to reorder.

A lesson holds content blocks: text, Arabic, a Quran verse, an image, audio, video, PDF, a vocabulary list, a practice activity (checklist or question cards), a teacher note that students never see, and a resource link. Mark a block required if the lesson should only complete after it is done.

How a lesson completes is your choice: the student presses a button, all required activities are done, a minimum time has passed, or simply opening it. You can also require a passed lesson quiz.

Assessments support eight question types: single choice, multiple choice, true or false, short answer, matching, put in order, written answer and audio answer. The first six are marked by the system. Written and audio answers wait for a teacher. Answer keys are stored apart and are never sent to a student's browser.

## Rules and rewards

On the Rules and rewards tab choose how students move: levels one after another or all open, units one after another or all open, lessons free or in order, how many quiz attempts are allowed, and how long to wait before a retry. A level can also need a teacher's approval. A single level or unit can use its own rule. Experience points, badges and certificates can each be switched off.

## Enrolling a student and creating a sign-in

1. Publish the program.
2. Program, Students tab, Enrol a student (pick a teacher if you like).
3. Student Progress, open the student, Student sign-in. Enter an email and either a first password or leave it empty to get a one-time link to send to the student.

A student cannot create an account alone. Only owners, administrators and assessors can create sign-ins.

## Student Progress

The table shows each student's level and unit, progress, last score, waiting reviews, last activity and status. Open a profile for the overview, a timeline of everything they did, their quiz attempts, overrides and certificates. Teachers can review and mark answers but cannot edit programs.

An override opens a locked step, marks something complete or approves a level for one student. A reason is required and stays in their history.

Archiving a program or pausing an enrolment never deletes history. Items that students already have history on cannot be deleted, only archived.

## Duplicating a program as a template

Use Duplicate on the list or inside a program. The copy gets all levels, domains, units, lessons, content, quizzes and badges as new, independent rows. No students, progress or certificates are copied. Use "Save as template" to mark a program you want to reuse.

## What was tested

SQL level, on real PostgreSQL with row level security on: 177 checks. Browser level, on real PostgreSQL through PostgREST: 122 checks covering the builder, all question types, duplication, publishing, enrolling, creating a sign-in, the student lessons and quiz, an audio answer, teacher review, overrides, certificates, the public page and permission checks. Sign-in function: 18 checks.

## Honest limits

1. The browser tests used a local stand-in for Supabase Auth and Storage. The real Supabase project, your real Vercel site and a real translation provider have not been tested by me. Please try the steps above and tell me what you see.
2. Students sign in with an email and password. Self sign-up, social sign-in and payments are not part of this.
3. Audio recording needs microphone permission. If it is not allowed, the student can upload an audio file instead.
4. Staff preview shows the structure and lessons. Quizzes are best checked with a test student.
5. Bangla and Arabic versions of curriculum text come from the existing translation system. You can review and override them in the translation review.
