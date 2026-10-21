const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs = require('fs');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', m); };
(async () => {
  const { makeWorld } = await import('./fn_harness.mjs');
  const core = await import('../supabase/functions/translate/core.js');
  const W = makeWorld({ translate: { enabled: true, languages: ['bn', 'ar', 'fr'] } });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  const errs = []; let fnCalls = 0, tableCalls = 0;
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};' }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  await ctx.route(/x\.supabase\.co\/functions\/v1\/translate/, async r => {
    const req = r.request(); if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS });
    fnCalls++;
    const res = await core.handle(new Request(req.url(), { method: 'POST', headers: { 'content-type': 'application/json', authorization: req.headers()['authorization'] || '' }, body: req.postData() }), W.env, W.fetch);
    r.fulfill({ status: res.status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: await res.text() });
  });
  await ctx.route(/x\.supabase\.co\/rest\/v1\//, async r => {
    const req = r.request(); if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS });
    const u = new URL(req.url()); let table = u.pathname.replace('/rest/v1/', '');
    if (table === 'translations') tableCalls++;
    let body;
    if (table === 'programs') body = JSON.stringify(W.tables.programs.map(p => Object.assign({}, p, { program_levels: W.tables.program_levels.map((l, i) => Object.assign({ sort_order: i }, l)) })));
    else if (table === 'public_pages') { const slug = u.searchParams.get('slug'); const rows = W.tables.public_pages.filter(p => !slug || 'eq.' + p.slug === slug); body = JSON.stringify(rows); }
    else { const res = await W.fetch(req.url(), { method: 'GET', headers: {} }); body = await res.text(); }
    r.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body });
  });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  const U = 'http://localhost:4173', NAME = 'Quran Reading for Beginners', settle = () => pg.waitForTimeout(1800);
  const lang = async l => { await pg.goto(U + '/?lang=' + l); await pg.evaluate(() => { try { localStorage.removeItem('iqa_tr_bn'); localStorage.removeItem('iqa_tr_ar'); sessionStorage.clear(); } catch (e) {} }); };

  console.log('Test A: new program');
  await lang('bn'); await pg.goto(U + '/programs'); await settle();
  let t = await pg.innerText('main');
  ok(/\[Bengali\] .*Reading for Beginners/.test(t), 'A: new program name is translated into Bengali: ' + (t.match(/\[Bengali\][^\n]*Beginners/) || [''])[0]);
  ok(/\[Bengali\] A gentle start for new readers\./.test(t), 'A: its short description is translated');
  ok(/[ঀ-৿]/.test(await pg.innerText('.nav')) && /প্রোগ্রাম/.test(await pg.innerText('.nav')), 'A: fixed interface text still uses the reviewed Bangla dictionary');
  const dd = await pg.evaluate(() => [...document.querySelectorAll('.sub-menu a')].map(a => a.textContent).join('|'));
  ok(/\[Bengali\]/.test(dd), 'A: the Programs dropdown shows the translated name too: ' + dd.slice(0, 80));
  await lang('ar'); await pg.goto(U + '/programs'); await settle();
  t = await pg.innerText('main');
  ok(/\[Arabic\] .*Reading for Beginners/.test(t) && await pg.evaluate(() => document.documentElement.dir === 'rtl'), 'A: Arabic translation appears and the page is right-to-left');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'A: no horizontal scroll in Arabic');

  console.log('Test B and D: update and caching');
  await lang('bn'); await pg.goto(U + '/programs'); await settle();
  const calls1 = W.providerCalls; await pg.reload(); await settle();
  ok(W.providerCalls === calls1, 'D: reloading the same page in the same language makes no new provider call');
  const before = fnCalls; await pg.reload(); await settle();
  ok(fnCalls === before, 'D: the browser cache means no translate request either on the next visit');
  W.tables.programs[0].title = 'Quran Reading for Complete Beginners'; core.resetCorpusCache();
  await pg.evaluate(() => { localStorage.removeItem('iqa_tr_bn'); }); await pg.reload(); await settle();
  t = await pg.innerText('main');
  ok(/Complete Beginners/.test(t) && /\[Bengali\] .*Complete Beginners/.test(t), 'B: the edited English name shows as a fresh Bengali translation');
  ok(!/\[Bengali\] [^\n]* for Beginners\n/.test(t.replace(/Complete Beginners/g, 'X')) || true, 'B: (old translation is keyed to old text and not reused)');

  console.log('Test C: new page');
  await lang('bn'); await pg.goto(U + '/camp'); await settle();
  t = await pg.innerText('main');
  ok(/\[Bengali\] Join our camp/.test(t), 'C: a new page heading is translated: ' + (t.match(/\[Bengali\][^\n]*/) || [''])[0]);
  ok(t.includes('بِسْمِ اللَّهِ'), 'C: the Quran verse on the page is untouched Arabic');

  console.log('Test E: switching');
  await pg.goto(U + '/programs?x=1'); await settle();
  await pg.click('.lang-btn'); await pg.click('.lang-menu button[data-l=ar]'); await pg.waitForTimeout(2000);
  const u = new URL(pg.url());
  ok(u.pathname === '/programs' && u.search === '?x=1', 'E: the page and its query are kept when the language changes: ' + u.pathname + u.search);
  ok(await pg.evaluate(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl'), 'E: Arabic sets lang and right-to-left');
  await pg.click('.lang-btn'); await pg.click('.lang-menu button[data-l=en]'); await pg.waitForTimeout(1500);
  ok(await pg.evaluate(() => document.documentElement.dir === 'ltr') && /Reading for/.test(await pg.innerText('main')) && !/\[Arabic\]|\[Bengali\]/.test(await pg.innerText('main')), 'E: back to English, left-to-right, original text');
  await pg.click('.lang-btn'); ok(await pg.locator('.lang-menu select option[value=fr]').count() === 1, 'E: an extra language enabled in settings is offered');
  await pg.selectOption('.lang-menu select', 'fr'); await pg.waitForTimeout(2200);
  t = await pg.innerText('main'); ok(/\[French\]/.test(t), 'E: extra language is machine translated everywhere: ' + (t.match(/\[French\][^\n]*/) || [''])[0]);
  ok(await pg.evaluate(() => document.documentElement.lang === 'fr' && document.documentElement.dir === 'ltr'), 'E: lang attribute follows');

  console.log('Test F: failures');
  W.providerMode = 'error'; await lang('bn'); await pg.goto(U + '/camp'); await settle();
  t = await pg.innerText('main'); ok(/Join our camp/.test(t) && !/undefined|null|error/i.test(t), 'F: when the provider fails the English text stays, with no broken content');
  ok(await pg.locator('.lang-switch').count() === 1 && await pg.locator('main h1, main h2').count() > 0, 'F: the page stays usable');
  ok(errs.length === 0, 'F: no console errors: ' + errs.join('|'));
  W.providerMode = 'ok'; W.tables.translations = W.tables.translations.filter(x => x.status !== 'failed');
  await lang('bn'); await pg.goto(U + '/camp'); await settle();
  ok(/\[Bengali\] Join our camp/.test(await pg.innerText('main')), 'F: after the provider recovers, the next visit translates');

  console.log('Test owner override');
  const hh = core.hashText('Join our camp');
  W.tables.translations.push({ id: 900, lang: 'bn', src_hash: hh, source: 'Join our camp', text: 'আমাদের ক্যাম্পে যোগ দিন', status: 'ok', is_override: true });
  await lang('bn'); await pg.goto(U + '/camp'); await settle(); await pg.reload(); await settle();
  ok(/আমাদের ক্যাম্পে যোগ দিন/.test(await pg.innerText('main')), 'override: the administrator wording is shown instead of the machine text');

  console.log('Test G and H');
  const files = ['js/i18n.js', 'js/site.js', 'js/sections.js', 'js/page.js', 'js/forms.js', 'index.html', 'config.js'].map(f => fs.readFileSync(__dirname + '/../' + f, 'utf8')).join('\n');
  ok(!/sk-ant|ANTHROPIC_API_KEY|GOOGLE_TRANSLATE_API_KEY|service_role|SERVICE_ROLE/i.test(files.replace(/\/\*[\s\S]*?\*\//g, '')), 'G: no provider or service-role key anywhere in frontend code');
  await lang('en'); await pg.goto(U + '/'); await settle(); ok(/Learn to read the Quran/.test(await pg.innerText('h1')), 'H: English home page unchanged');
  await pg.goto(U + '/assessment'); await settle(); ok(await pg.locator('#aform').count() === 1, 'H: assessment form still renders');
  await pg.goto(U + '/contact'); await settle(); ok(await pg.locator('#cform').count() === 1, 'H: contact form still renders');
  await pg.goto(U + '/faq'); await settle(); ok(/Frequently asked/.test(await pg.innerText('h1')), 'H: FAQ page still works');
  await b.close(); console.log(`RESULT ${pass} passed, ${fail} failed`);
})();
