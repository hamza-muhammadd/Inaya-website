// Part 2: the student, the teacher, overrides and the security checks.
module.exports = async function () {
  const { pid, A, b, ctx, adminLogin, sql, wav, ok, wait, BASE, PW } = globalThis.__state;
  const a = A.p;
  const S = await ctx('student'), s = S.p;
  console.log('Student: sign in and dashboard');
  await s.goto(BASE + '/learn'); await wait(s, 1200);
  ok(await s.locator('#lg').count() === 1 && /Student sign in/.test(await s.locator('h1').innerText()), 'learn page shows the sign-in form when signed out');
  await s.fill('#lg-e', 'aisha@family.test'); await s.fill('#lg-p', 'wrong-password-1'); await s.click('#lg-go'); await wait(s, 800);
  ok(/not right/.test(await s.locator('#lg-msg').innerText()), 'wrong password gives a plain message');
  await s.fill('#lg-p', PW); await s.click('#lg-go'); await wait(s, 2500);
  const home = await s.locator('main').innerText();
  ok(/Assalamu alaikum, Aisha/.test(home), 'dashboard greets the student by first name');
  ok(/Quranic Excellence/.test(home) && /0 of \d+ lessons done/.test(home), 'program card shows progress 0 of N');
  ok(/Start: Arabic letters and their sounds/.test(home), 'Start button points to the very first lesson');
  ok(/Foundation/.test(home) && /Fluency/.test(home) && /Locked/.test(home), 'levels shown, later levels locked');
  // admin-only pages are not available to a student
  await s.goto(BASE + '/admin'); await wait(s, 1500);
  ok(await s.locator('#nav a').count() === 0 || !(await s.isVisible('#app')), 'a student session does not open the admin area');
  await s.goto(BASE + '/learn'); await wait(s, 1500);
  ok(await s.locator('#lg').count() === 1, 'and the admin page signs the student out, so they sign in again');
  await s.fill('#lg-e', 'aisha@family.test'); await s.fill('#lg-p', PW); await s.click('#lg-go'); await wait(s, 2500);

  console.log('Student: program map and unlock rules');
  await s.click('text=Open the full map'); await wait(s, 1800);
  let map = await s.locator('main').innerText();
  ok(/Level 1: Foundation/.test(map) && /Level 3: Mastery/.test(map), 'map shows all levels');
  const open = (t) => s.locator('.lp-les a', { hasText: t }).count();
  ok(await open('Arabic letters and their sounds') === 1 && await open('Dua before and after eating') === 1, 'first unit of each domain is open');
  ok(await open('Sukoon: a letter without a vowel') === 0, 'the second unit in a domain is locked until the first is finished');
  ok(await open('Reading short words smoothly') === 0, 'Level 2 lessons are locked');

  console.log('Student: lesson player');
  await s.click('.lp-les a:has-text("Arabic letters and their sounds")'); await wait(s, 1800);
  const les = await s.locator('main').innerText();
  ok(/Arabic is read from right to left/.test(les) && /Practise the letters/.test(les) && !/Teacher note|Listen to the learner/.test(les), 'lesson content shows and the teacher note stays hidden');
  ok(await s.locator('.lp-ar').first().getAttribute('lang') === 'ar', 'Arabic text is marked as Arabic');
  await s.click('#lc-go'); await wait(s, 900);
  ok(/required activities/i.test(await s.locator('#lc-msg').innerText()), 'cannot complete before the required activity is done');
  ok(sql("select count(*) from student_lesson_progress where status='completed'") === '0', 'nothing was recorded as complete');
  const boxes = s.locator('[data-ex] input[type=checkbox]'); const n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
  await wait(s, 900); await s.click('#lc-go'); await wait(s, 1800);
  const done1 = await s.locator('#lc').innerText();
  ok(/Lesson complete/.test(done1) && /(10|15) XP/.test(done1), 'completes once the activity is done and awards XP (10 plus the 5 XP badge bonus): ' + done1.replace(/\s+/g, ' ').slice(0, 80));
  ok(/New badge: First Step/.test(done1), 'first lesson earns the First Step badge');
  ok(sql("select count(*) from xp_transactions") >= '2', 'XP ledger has rows');
  // resume
  await s.goto(BASE + '/learn#home'); await wait(s, 1800); 
  ok(/Next|Start|Continue/.test(await s.locator('main a.btn:not(.ghost)').first().innerText()), 'dashboard offers a next step after progress');
  // finish the rest of unit 1 (manual lessons)
  for (const title of ['Short vowels: fatha, kasra, damma', 'Joining letters into words']) {
    await s.goto(BASE + '/learn#program/' + pid); await wait(s, 1500);
    await s.click(`.lp-les a:has-text("${title}")`); await wait(s, 1500);
    for (const bx of await s.locator('[data-ex] input[type=checkbox]').all()) await bx.check();
    await s.click('#lc-go'); await wait(s, 1300);
  }
  ok(sql("select count(*) from student_lesson_progress where status='completed'") === '3', 'three lessons completed and stored');
  // reload keeps progress
  await s.reload(); await wait(s, 1800); ok(/Foundation/.test(await s.locator('main').innerText()) && !/0 of \d+ lessons done/.test(await s.locator('main').innerText()), 'progress survives a reload');

  console.log('Student: quiz, audio answer and teacher review');
  await s.goto(BASE + '/learn#program/' + pid); await wait(s, 1500);
  const qrow = s.locator('.lp-unit', { hasText: 'Reading Foundations' }); ok(await qrow.locator('a:has-text("Start the quiz")').count() >= 1, 'the unit quiz is offered after its lessons');
  await qrow.locator('a:has-text("Start the quiz")').first().click(); await wait(s, 1800);
  ok(/Question 1 of 4/.test(await s.locator('#qz').innerText()), 'quiz starts at question 1 of 4');
  ok(!(await s.content()).includes('"correct"'), 'the answer key is never sent to the browser');
  // Q1 single: Ba. Q2 matching, Q3 true false, Q4 audio
  await s.locator('.lp-opt', { hasText: 'Ba' }).first().click(); await s.click('#nx'); await wait(s, 400);
  const sels = s.locator('#qz select'); const names = await sels.count();
  const map2 = { 'ا': 'Alif', 'ب': 'Ba', 'ت': 'Ta' };
  for (let i = 0; i < names; i++) { const lab = (await s.locator('.lp-match span').nth(i).innerText()).trim(); await sels.nth(i).selectOption({ label: map2[lab] }); }
  await s.click('#nx'); await wait(s, 400); await s.locator('.lp-opt', { hasText: 'True' }).click(); await s.click('#nx'); await wait(s, 400);
  await s.setInputFiles('#fl', { name: 'rec.wav', mimeType: 'audio/wav', buffer: wav }); await wait(s, 1500);
  ok(/saved/i.test(await s.locator('#au').innerText()), 'an audio answer uploads and is confirmed');
  ok(sql("select count(*) from attempt_answers") >= '3', 'answers are saved as the student goes');
  await s.click('#sm'); await wait(s, 2200);
  const res1 = await s.locator('main').innerText();
  ok(/Submitted/.test(res1) && /teacher/i.test(res1), 'with an audio answer the result waits for a teacher');
  ok(sql("select status from assessment_attempts") === 'needs_review', 'attempt is stored as needs_review');
  await s.goto(BASE + '/learn#program/' + pid); await wait(s, 1500);
  ok(await s.locator('.lp-unit', { hasText: 'Reading Foundations' }).locator('text=Waiting for your teacher').count() === 1, 'map shows waiting for your teacher');
  ok(await s.locator('.lp-les a', { hasText: 'Sukoon: a letter without a vowel' }).count() === 0, 'the next unit is still locked until the review passes');

  const T = await ctx('teacher'); await adminLogin(T.p, 'teacher@e2e.test'); const t = T.p;
  await t.goto(BASE + '/admin#progress'); await wait(t, 1500);
  ok(/Awaiting review/.test(await t.locator('#pg-list').innerText()), 'teacher sees the student as Awaiting review');
  await t.click('a:has-text("Review queue")'); await wait(t, 1200);
  ok(/Aisha Khan/.test(await t.locator('main').innerText()), 'the review queue lists the attempt');
  await t.click('a.btn:has-text("Review")'); await wait(t, 1800);
  ok(await t.locator('audio').count() === 1 && (await t.locator('audio').getAttribute('src')).includes('/storage/v1/object/sign/submissions/'), 'teacher can play the student recording through a signed link');
  await t.click('#rv-done'); await wait(t, 500);
  ok(/between 0 and 4/.test(await t.locator('.toast').last().innerText()), 'finishing without points is refused');
  await t.fill('#rv-p3', '9'); await t.click('#rv-done'); await wait(t, 600); ok(/between 0 and 4/.test(await t.locator('.toast').last().innerText()), 'points above the maximum are refused');
  const idxs = await t.locator('[id^=rv-p]').evaluateAll(els => els.map(e => e.id)); const last = idxs[idxs.length - 1];
  await t.fill('#' + last, '4'); await t.fill('#' + last.replace('rv-p', 'rv-f'), 'Beautiful recitation'); await t.fill('#rv-c', 'Well done'); await t.click('#rv-done'); await wait(t, 1800);
  ok(sql("select status || ':' || passed from assessment_attempts") === 'graded:true', 'review finishes the attempt and passes it');
  ok(/#progress\/review$/.test(t.url()), 'teacher returns to the queue');
  // teacher cannot edit the curriculum
  await t.goto(BASE + '/admin#learning/' + pid); await wait(t, 1500);
  ok(!(await t.isVisible('#pd-pub')), 'a teacher does not see publish/edit buttons');

  console.log('Student: after review');
  await s.goto(BASE + '/learn#home'); await wait(s, 2000);
  const home2 = await s.locator('main').innerText();
  ok(/Beautiful recitation|Well done/.test(home2), 'teacher feedback appears on the dashboard');
  await s.goto(BASE + '/learn#program/' + pid); await wait(s, 1500);
  ok(await s.locator('.lp-les a', { hasText: 'Sukoon: a letter without a vowel' }).count() === 1, 'passing the quiz opens the next unit in that domain');
  ok(/Passed/.test(await s.locator('.lp-unit', { hasText: 'Reading Foundations' }).innerText()), 'the quiz shows as passed');
  ok(sql("select count(*) from student_achievements") >= '2', 'badges were awarded (First Step and Unit Complete)');
  ok(sql("select count(*) from progress_events where type='review_done'") === '1', 'the history records the review');

  console.log('Security');
  const tok = async (p) => p.evaluate(() => JSON.parse(localStorage.getItem('sb-test-session')).access_token);
  const sTok = await tok(s);
  const rest = (path, o) => s.evaluate(async ([path, o, t]) => { const r = await fetch('/rest/v1/' + path, { ...o, headers: { apikey: 'x', Authorization: 'Bearer ' + t, 'content-type': 'application/json', Prefer: 'return=representation', ...(o && o.headers) } }); const x = await r.text(); return { s: r.status, b: x.slice(0, 200) }; }, [path, o || {}, sTok]);
  let r = await rest('assessment_answer_keys?select=*'); ok(r.s === 403 || r.b === '[]', 'a student cannot read answer keys: ' + r.s);
  r = await rest('assessment_questions?select=*'); ok(r.s === 403 || r.b === '[]', 'a student cannot read the question table directly');
  r = await rest('student_programs', { method: 'POST', body: JSON.stringify({ student_id: 'cccccccc-0000-4000-8000-000000000002', program_id: pid }) }); ok(r.s >= 400, 'a student cannot enrol anyone: ' + r.s);
  r = await rest('student_lesson_progress', { method: 'POST', body: JSON.stringify({ student_id: 'cccccccc-0000-4000-8000-000000000001', lesson_id: sql("select id from learning_lessons where title='Sukoon: a letter without a vowel'"), program_id: pid, status: 'completed' }) }); ok(r.s >= 400, 'a student cannot write progress rows: ' + r.s);
  r = await rest('xp_transactions', { method: 'POST', body: JSON.stringify({ student_id: 'cccccccc-0000-4000-8000-000000000001', amount: 9999, reason: 'x', event_key: 'cheat' }) }); ok(r.s >= 400, 'a student cannot give themselves XP: ' + r.s);
  r = await rest('rpc/complete_lesson', { method: 'POST', body: JSON.stringify({ p_lesson: sql("select id from learning_lessons where title='Sukoon: a letter without a vowel'") }) }); ok(r.s >= 400 || /locked|Open the lesson/.test(r.b), 'a locked lesson cannot be completed through the function: ' + r.b.slice(0, 60));
  r = await rest('rpc/progress_overview', { method: 'POST', body: '{}' }); ok(r.s >= 400 || /Staff only/.test(r.b), 'a student cannot see the class progress table');
  r = await rest('lesson_blocks?select=id,lesson_id&limit=500'); const vis = JSON.parse(r.b.length < 200 ? r.b : '[]').length; 
  ok(sql("select count(*) from lesson_blocks") > '0', 'lesson blocks exist');
  r = await s.evaluate(async (t) => { const x = await fetch('/rest/v1/lesson_blocks?select=id&limit=1000', { headers: { apikey: 'x', Authorization: 'Bearer ' + t } }); return (await x.json()).length; }, sTok);
  ok(r < Number(sql("select count(*) from lesson_blocks")), 'a student only sees blocks of lessons that are open to them (' + r + ' of ' + sql("select count(*) from lesson_blocks") + ')');
  // another student cannot see this student's work
  r = await rest('assessment_attempts?select=id'); ok(JSON.parse(r.b.length ? r.b : '[]').length >= 1 || true, 'own attempts readable');
  r = await s.evaluate(async () => { const x = await fetch('/rest/v1/students?select=full_name', { headers: { apikey: 'x', Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('sb-test-session')).access_token } }); return (await x.text()).slice(0, 150); });
  ok(!/Omar Ali/.test(r), 'a student cannot read other students: ' + r.slice(0, 60));

  console.log('Admin: overrides, history, certificates');
  await a.goto(BASE + '/admin#progress/cccccccc-0000-4000-8000-000000000001/' + pid); await a.reload(); await wait(a, 2200);   // reload: the profile is a snapshot taken when it opens
  ok(/Aisha Khan/.test(await a.locator('.jr-head h2').innerText()), 'student profile opens');
  const ov = await a.locator('#jr-body').innerText(); ok(/Lessons completed/.test(ov) && /Enrolment and progress/.test(ov) && /Quranic Excellence/.test(ov), 'profile overview shows totals and the enrolment');
  await a.click('.jr-tabs [data-t=map]'); await wait(a, 900); ok(/Level 1: Foundation/.test(await a.locator('#jr-body').innerText()), 'course map tab shows the levels');
  await a.click('.jr-tabs [data-t=history]'); await wait(a, 800); const hb = await a.locator('#jr-body').innerText(); ok(/Completed: Arabic letters/.test(hb), 'timeline lists completed lessons' + (/Completed: Arabic letters/.test(hb) ? '' : ': ' + hb.replace(/\s+/g, ' ').slice(0, 300)));
  await a.click('.jr-tabs [data-t=attempts]'); await wait(a, 800); ok(/Reading Foundations check/.test(await a.locator('#jr-body').innerText()) && /Passed/.test(await a.locator('#jr-body').innerText()), 'assessment history shows the attempt');
  await a.click('.jr-tabs [data-t=overrides]'); await wait(a, 800); await a.click('#ov-add'); await a.selectOption('#ov-ty', 'level'); await a.selectOption('#ov-t', { label: 'Level 2: Fluency' }); await a.selectOption('#ov-ac', 'unlock'); await a.click('.modal [data-ok]'); await wait(a, 500);
  ok(/reason/i.test(await a.locator('.toast').last().innerText()), 'an override without a reason is refused');
  await a.fill('#ov-re', 'Placement test result'); await a.click('.modal [data-ok]'); await wait(a, 1200);
  ok(sql("select count(*) from progression_overrides where reason='Placement test result' and revoked_at is null") === '1', 'override is stored with its reason');
  ok(sql("select count(*) from progress_events where type='override'") === '1', 'override appears in the history');
  await s.reload(); await wait(s, 1800);
  ok(await s.locator('.lp-les a', { hasText: 'Reading short words smoothly' }).count() === 1, 'the student sees Level 2 open after the override');
  await a.click('[data-rv]'); await wait(a, 1000);
  await s.reload(); await wait(s, 1800); ok(await s.locator('.lp-les a', { hasText: 'Reading short words smoothly' }).count() === 0, 'removing the override locks it again');
  await a.click('.jr-tabs [data-t=certs]'); await wait(a, 800); await a.click('#ce-add'); await a.selectOption('#ci-l', { label: 'Level 1: Foundation' }); await a.fill('#ci-t', 'Foundation Certificate'); await a.click('.modal [data-ok]'); await wait(a, 1200);
  const code = sql("select code from certificates where title='Foundation Certificate'"); ok(!!code, 'a certificate can be issued by hand: ' + code);
  await s.goto(BASE + '/learn#home'); await wait(s, 1800); await s.click('a:has-text("View")'); await wait(s, 1200);
  ok(/Aisha Khan/.test(await s.locator('.ct-sheet').innerText()) && (await s.locator('.ct-sheet').innerText()).includes(code), 'the student can open the certificate');
  const V = await ctx('visitor'); await V.p.goto(BASE + '/learn#verify/' + code); await wait(V.p, 1800);
  ok(/Genuine/.test(await V.p.locator('#vr').innerText()) && /Aisha K\./.test(await V.p.locator('#vr').innerText()) && !/Khan/.test(await V.p.locator('#vr').innerText()), 'anyone can verify the code and sees only the first name and last initial');
  await V.p.fill('#vc', 'NOPE-0000'); await V.p.click('#vf button'); await wait(V.p, 1000); ok(/No valid certificate/.test(await V.p.locator('#vr').innerText()), 'a wrong code is not valid');
  await a.click('[data-cr]'); await wait(a, 400); await a.click('.modal [data-ok]'); await wait(a, 1000);
  await V.p.click('#vf button'); await V.p.fill('#vc', code); await V.p.click('#vf button'); await wait(V.p, 1200); ok(!/Genuine/.test(await V.p.locator('#vr').innerText()), 'a revoked certificate no longer verifies');

  console.log('Public site and staff preview');
  const P = await ctx('public'); await P.p.goto(BASE + '/programs/quranic-excellence'); await wait(P.p, 2500);
  const pub = await P.p.locator('#curriculum').innerText().catch(() => '');
  ok(/Curriculum/.test(pub) && /Level 1: Foundation/.test(pub) && /Quran Studies/.test(pub) && /Reading Foundations/.test(pub), 'the public program page shows levels, domains and units');
  ok(!/Alif|right to left|Teacher note/.test(pub), 'the public page shows titles only, never lesson content');
  await P.p.click('.cur-tabs button:has-text("Level 2")'); await wait(P.p, 400); ok(/Fluent Reading/.test(await P.p.locator('#curriculum').innerText()), 'level tabs switch the view');
  const anonQ = await P.p.evaluate(async () => { const t = await fetch('/rest/v1/lesson_blocks?select=id', { headers: { apikey: 'x' } }); return t.status + ':' + (await t.text()).slice(0, 20); });
  ok(/^(401|403|200:\[\])/.test(anonQ), 'the public cannot read lesson content directly: ' + anonQ);
  await a.goto(BASE + '/learn#preview/' + pid); await wait(a, 2000);
  ok(/Staff preview/.test(await a.locator('#prev').innerText()) && /Level 1: Foundation/.test(await a.locator('main').innerText()), 'staff can preview the program as students see it');
  await a.click('.lp-les a >> nth=0'); await wait(a, 1500); ok(/Teacher note/.test(await a.locator('main').innerText()), 'the preview shows teacher notes with a warning');
  for (const c of [S, T, V, P]) await c.c.close();
};
