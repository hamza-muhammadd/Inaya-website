// Browser end to end test of the learning platform against a REAL Postgres (RLS on) through a real PostgREST.
// Start the stack first: tests/e2e/run_stack.sh
const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs = require('fs'), { execFileSync } = require('child_process');
const shim = fs.readFileSync(__dirname + '/supabase_http.js', 'utf8'), BASE = 'http://localhost:4180', PW = 'Test-pass-12345';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', m); };
const sql = (q) => execFileSync('psql', ['-U', 'postgres', '-h', '/tmp/pgdata', '-p', '5544', '-d', 'inaya_test', '-tA', '-c', q], { encoding: 'utf8' }).trim();
const wav = Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=', 'base64');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const errs = [];
  async function ctx(label) {
    const c = await b.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
    await c.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'text/javascript', body: shim }));
    await c.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    await c.route(/functions\/v1\/translate/, r => r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
    const p = await c.newPage(); p.on('dialog', d => d.accept());
    p.on('pageerror', e => errs.push(label + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|favicon|Failed to load resource|translate/.test(m.text())) errs.push(label + ': ' + m.text()); });
    return { c, p };
  }
  async function adminLogin(p, email) { await p.goto(BASE + '/admin'); await p.fill('#li-email', email); await p.fill('#li-pass', PW); await p.click('#li-btn'); await p.waitForSelector('#nav a', { timeout: 8000 }); }
  const wait = (p, ms) => p.waitForTimeout(ms || 700);
  const QE = () => sql("select id from programs where slug='quranic-excellence'");

  // ================= ADMIN =================
  console.log('Admin: program builder');
  const A = await ctx('admin'), a = A.p;
  await adminLogin(a, 'owner@e2e.test');
  const nav = (await a.locator('#nav a').allInnerTexts()).join('|');
  ok(/Learning Programs/.test(nav) && /Student Progress/.test(nav), 'menu has Learning Programs and Student Progress');
  await a.goto(BASE + '/admin#learning'); await wait(a, 1200);
  let t = await a.locator('#lp-list').innerText();
  ok(/Quranic Excellence/.test(t) && /template/i.test(t) && /sample/i.test(t) && /3 levels, 20 units, 47 lessons/.test(t), 'list shows the seeded program with its counts, template and sample marks: ' + t.replace(/\s+/g, ' ').slice(0, 110));
  ok(/draft/i.test(t), 'seed program starts as a draft');
  const pid = QE(); await a.click(`tr[data-id="${pid}"]`); await wait(a, 1500);
  const hd = await a.locator('.page-h').innerText(); ok(/Quranic Excellence/.test(hd) && /Little Steps/.test(hd), 'program page shows name and tagline: ' + hd.replace(/\s+/g, ' ').slice(0, 90));
  ok(await a.locator('.alert.warn', { hasText: 'sample content' }).count() === 1, 'sample content warning is shown');
  ok(await a.locator('.alert.info', { hasText: 'not published' }).count() === 1, 'unpublished notice is shown');
  const structure = await a.locator('#pd-body').innerText();
  ok(/Level 1: Foundation/.test(structure) && /Level 2: Fluency/.test(structure) && /Level 3: Mastery/.test(structure), 'three levels shown');
  ['Quran Studies', 'Sunnah & Hadith', 'Islamic Aqidah', 'Fiqh & Worship', 'Islamic Manners & Character'].forEach(d => ok(structure.includes(d), 'domain shown: ' + d));
  ok(/Reading Foundations/.test(structure) && /Wudu Fundamentals/.test(structure), 'units shown');

  // add a level, a domain, a unit, a lesson, content (nothing hardcoded)
  await a.click('#sd-add'); await a.fill('#dm-t', 'Arabic Language'); await a.click('.modal [data-ok]'); await wait(a);
  ok(sql(`select count(*) from learning_domains where program_id='${pid}'`) === '6', 'a sixth domain can be added');
  await a.click('#sl-add'); await a.fill('#lv-t', 'Advanced'); await a.click('.modal [data-ok]'); await wait(a);
  ok(sql(`select count(*) from program_levels where program_id='${pid}'`) === '4', 'a fourth level can be added');
  await a.locator('[data-ua]').last().click(); await a.fill('#un-t', 'Extra unit'); await a.selectOption('#un-dm', { label: 'Arabic Language' }); await a.click('.modal [data-ok]'); await wait(a);
  ok(sql(`select count(*) from learning_units where program_id='${pid}'`) === '21', 'a unit can be added to the new level and domain');
  await a.locator('[data-la]').last().click(); await a.fill('#nl-t', 'Extra lesson'); await a.click('.modal [data-ok]'); await wait(a, 1200);
  ok(/#learning\/lesson\//.test(a.url()), 'new lesson opens its editor');
  await a.click('#bl-add'); await a.selectOption('#bk-t', 'rich_text'); await a.click('.modal [data-ok]'); await wait(a, 400);
  await a.fill('#bf-text', 'Hello **world**'); await a.click('.modal [data-ok]'); await wait(a, 900);
  ok(sql(`select count(*) from lesson_blocks b join learning_lessons l on l.id=b.lesson_id where l.title='Extra lesson'`) === '1', 'content block added to the lesson');
  await a.click('#bl-add'); await a.selectOption('#bk-t', 'exercise'); await a.click('.modal [data-ok]'); await wait(a, 400);
  await a.fill('#bf-title', 'Try it'); await a.fill('#bf-items', 'one\ntwo'); await a.check('#bf-req'); await a.click('.modal [data-ok]'); await wait(a, 900);
  const cl = sql(`select data::text || ':' || required from lesson_blocks where data->>'title'='Try it'`); ok(/"kind": "checklist"/.test(cl) && /true$/.test(cl) && /"items": \["one", "two"\]/.test(cl), 'a required checklist block is saved correctly: ' + cl);
  await a.fill('#ls-t', 'Extra lesson (edited)'); await a.selectOption('#ls-s', 'published'); await a.selectOption('#ls-c', 'blocks'); await a.click('#ls-save'); await wait(a, 900);
  ok(sql(`select status || ':' || (completion_rule->>'type') from learning_lessons where title='Extra lesson (edited)'`) === 'published:blocks', 'lesson settings save');

  // assessment editor: add one of every kind of question
  await a.goto(BASE + '/admin#learning/' + pid); await wait(a, 1200);
  await a.click('[data-aa^="unit:"] >> nth=0'); await a.fill('#na-t', 'Builder quiz'); await a.click('.modal [data-ok]'); await wait(a, 1200);
  ok(/#learning\/assess\//.test(a.url()), 'new assessment opens its editor');
  async function addQ(type, fill) { await a.click('#qs-add'); await a.selectOption('#qa-t', type); await a.click('.modal [data-ok]'); await wait(a, 350); await fill(); await a.click('.modal [data-ok]'); await wait(a, 800); }
  await addQ('single', async () => { await a.fill('#qf-p', 'Pick B'); const o = a.locator('.modal .ot'); await o.nth(0).fill('A'); await o.nth(1).fill('B'); await o.nth(2).fill('C'); await a.locator('.modal .oc').nth(1).check(); });
  await addQ('multiple', async () => { await a.fill('#qf-p', 'Pick A and C'); const o = a.locator('.modal .ot'); await o.nth(0).fill('A'); await o.nth(1).fill('B'); await o.nth(2).fill('C'); await a.locator('.modal .oc').nth(0).check(); await a.locator('.modal .oc').nth(2).check(); });
  await addQ('true_false', async () => { await a.fill('#qf-p', 'Water is wet'); await a.selectOption('#qf-tf', 'true'); });
  await addQ('short_answer', async () => { await a.fill('#qf-p', 'Capital of France'); await a.fill('#qf-ac', 'Paris\nparis'); });
  await addQ('matching', async () => { await a.fill('#qf-p', 'Match'); const l = a.locator('.modal .pl'), r = a.locator('.modal .pr'); await l.nth(0).fill('1'); await r.nth(0).fill('one'); await l.nth(1).fill('2'); await r.nth(1).fill('two'); });
  await addQ('ordering', async () => { await a.fill('#qf-p', 'Order'); const o = a.locator('.modal .ot'); await o.nth(0).fill('first'); await o.nth(1).fill('second'); await o.nth(2).fill('third'); });
  await addQ('written', async () => { await a.fill('#qf-p', 'Explain'); });
  await addQ('audio', async () => { await a.fill('#qf-p', 'Recite'); });
  ok(sql(`select string_agg(type, ',' order by sort_order) from assessment_questions where assessment_id=(select id from learning_assessments where title='Builder quiz')`) === 'single,multiple,true_false,short_answer,matching,ordering,written,audio', 'all eight question types can be created');
  ok(sql(`select count(*) from assessment_answer_keys k join assessment_questions q on q.id=k.question_id join learning_assessments a on a.id=q.assessment_id where a.title='Builder quiz'`) === '8', 'each question has its own answer key row');
  ok(sql(`select (k.key->>'correct') from assessment_answer_keys k join assessment_questions q on q.id=k.question_id where q.prompt='Pick B'`) === 'b', 'single choice key is the ticked option');
  ok(sql(`select k.key->'pairs'->>'l2' from assessment_answer_keys k join assessment_questions q on q.id=k.question_id where q.prompt='Match'`) === 'r2', 'matching key pairs correctly');
  // validation
  await a.click('#qs-add'); await a.selectOption('#qa-t', 'single'); await a.click('.modal [data-ok]'); await wait(a, 300); await a.click('.modal [data-ok]'); await wait(a, 400);
  ok(await a.locator('.modal').count() === 1 && /Write the question/.test(await a.locator('.toast').last().innerText()), 'empty question is refused with a clear message'); await a.click('.modal [data-x]');
  await a.fill('#as-p', '150'); await a.click('#as-save'); await wait(a, 400);
  ok(/between 0 and 100/.test(await a.locator('.toast').last().innerText()), 'pass mark above 100 is refused');
  await a.fill('#as-p', '60'); await a.selectOption('#as-s', 'published'); await a.click('#as-save'); await wait(a, 800);
  ok(sql(`select pass_score || ':' || status from learning_assessments where title='Builder quiz'`) === '60:published', 'assessment settings save');
  sql(`update learning_assessments set status='draft' where title='Builder quiz'`);   // keep the practice quiz out of the student flow below
  // reorder
  await a.click('[data-qm="1"][data-d="-1"]'); await wait(a, 900);
  ok(sql(`select prompt from assessment_questions where assessment_id=(select id from learning_assessments where title='Builder quiz') order by sort_order limit 1`) === 'Pick A and C', 'questions can be reordered');

  // duplicate as an independent template
  console.log('Admin: duplicate, publish, archive');
  await a.goto(BASE + '/admin#learning'); await wait(a, 1000);
  await a.click(`[data-dup="${pid}"]`); await a.fill('#dp-t', 'My Copy'); await a.click('.modal [data-ok]'); await wait(a, 2200);
  const cp = sql(`select id from programs where title='My Copy'`);
  ok(cp && cp !== pid, 'duplicate creates a new program');
  const cnt = (p) => sql(`select (select count(*) from program_levels where program_id='${p}') || '/' || (select count(*) from learning_domains where program_id='${p}') || '/' || (select count(*) from learning_units where program_id='${p}') || '/' || (select count(*) from learning_lessons where program_id='${p}') || '/' || (select count(*) from lesson_blocks where program_id='${p}') || '/' || (select count(*) from assessment_questions where program_id='${p}')`);
  ok(cnt(cp) === cnt(pid), 'the copy has the same levels, domains, units, lessons, blocks and questions: ' + cnt(cp));
  ok(sql(`select status || ':' || is_template from programs where id='${cp}'`) === 'draft:false', 'the copy starts as a draft and is not itself a template');
  ok(sql(`select count(*) from lesson_blocks where lesson_id in (select id from learning_lessons where program_id='${cp}') and lesson_id in (select id from learning_lessons where program_id='${pid}')`) === '0', 'copied rows are new rows, not shared');
  await a.fill('#pi-t', 'x').catch(() => {}); await a.click('#pd-tabs [data-t=info]'); await wait(a, 600); await a.fill('#pi-t', 'My Copy Renamed'); await a.click('#pi-save'); await wait(a, 800);
  ok(sql(`select title from programs where id='${cp}'`) === 'My Copy Renamed' && sql(`select title from programs where id='${pid}'`) === 'Quranic Excellence', 'renaming the copy leaves the original untouched');
  await a.click('#pd-arch'); await wait(a, 400); await a.click('.modal [data-ok]'); await wait(a, 1000);
  ok(sql(`select status from programs where id='${cp}'`) === 'archived', 'a program can be archived');
  await a.goto(BASE + '/admin#learning'); await wait(a, 900);
  ok(!/My Copy Renamed/.test(await a.locator('#lp-list').innerText()), 'archived programs are hidden from the default list');
  await a.check('#lp-a'); await wait(a, 400); ok(/My Copy Renamed/.test(await a.locator('#lp-list').innerText()), 'and shown when Show archived is ticked'); await a.uncheck('#lp-a');

  // publish, enrol, sign-in
  console.log('Admin: publish, enrol, create student sign-in');
  await a.goto(BASE + '/admin#learning/' + pid); await wait(a, 1200);
  await a.click('#pd-clear'); await wait(a, 400); await a.click('.modal [data-ok]'); await wait(a, 1000);
  ok(sql(`select count(*) from learning_units where program_id='${pid}' and is_sample`) === '0', 'I have reviewed it clears the sample marks');
  await a.click('#pd-pub'); await wait(a, 900);
  ok(sql(`select status from programs where id='${pid}'`) === 'published', 'program can be published');
  await a.click('#pd-tabs [data-t=students]'); await wait(a, 800); await a.click('#en-add'); await wait(a, 600);
  await a.selectOption('#ne-s', { label: 'Aisha Khan (' + sql(`select student_code from students where full_name='Aisha Khan'`) + ')' }); await a.selectOption('#ne-t', { label: 'Ustadh Yusuf' }); await a.click('.modal [data-ok]'); await wait(a, 1000);
  ok(sql(`select count(*) from student_programs where program_id='${pid}'`) === '1' && /Aisha Khan/.test(await a.locator('#pd-body').innerText()), 'a student can be enrolled with a teacher');
  await a.goto(BASE + '/admin#progress'); await wait(a, 1200);
  ok(/Aisha Khan/.test(await a.locator('#pg-list').innerText()) && /Not started/.test(await a.locator('#pg-list').innerText()), 'Student Progress lists the enrolled student as Not started');
  await a.click('tr[data-k]'); await wait(a, 1500);
  ok(await a.locator('.alert.info', { hasText: 'no sign-in yet' }).count() === 1, 'profile says the student has no sign-in yet');
  await a.click('#sp-acc'); await a.fill('#ac-e', 'aisha@family.test'); await a.fill('#ac-p', 'short'); await a.click('.modal [data-ok]'); await wait(a, 800);
  ok(/10 characters/.test(await a.locator('.toast').last().innerText()), 'a short password is refused');
  await a.fill('#ac-p', PW); await a.click('.modal [data-ok]'); await wait(a, 1500);
  ok(sql(`select count(*) from students where full_name='Aisha Khan' and user_id is not null`) === '1', 'sign-in created and linked to the student');
  // staff role limits
  console.log('Admin: roles');
  const R = await ctx('readonly'); await adminLogin(R.p, 'readonly@e2e.test');
  const rn = (await R.p.locator('#nav a').allInnerTexts()).join('|'); ok(/Learning Programs/.test(rn), 'read-only user sees the section');
  await R.p.goto(BASE + '/admin#learning/' + pid); await wait(R.p, 1200);
  ok(!(await R.p.isVisible('#pd-pub')) && !(await R.p.isVisible('#pd-arch')), 'read-only user does not see edit buttons');
  const rr = await R.p.evaluate(async () => { const s = JSON.parse(localStorage.getItem('sb-test-session')); const r = await fetch('/rest/v1/programs?slug=eq.quranic-excellence', { method: 'PATCH', headers: { apikey: 'x', Authorization: 'Bearer ' + s.access_token, 'content-type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status: 'draft' }) }); return (await r.json()).length; });
  ok(rr === 0 && sql(`select status from programs where id='${pid}'`) === 'published', 'and the database refuses a read-only edit even when sent directly');
  await R.c.close();

  globalThis.__state = { pid, A, b, ctx, adminLogin, sql, wav, ok, wait, BASE, PW, errs };
  await require('./lms.student.js')();
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (errs.length) { console.log('Page errors:'); errs.forEach(e => console.log('  ' + e)); }
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
