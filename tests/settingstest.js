const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs = require('fs');
const mock = fs.readFileSync(__dirname + '/mock_supabase.js', 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', m); };
(async () => {
  const core = await import('../supabase/functions/translate/core.js');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'text/javascript', body: mock }));
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};' }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await ctx.route(/functions\/v1\/translate/, r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, per_language: {}, usage: [], source_units: 0 }) }));
  await ctx.addInitScript('window.__PERSIST=true');
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/ERR_|favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const db = () => pg.evaluate(() => JSON.parse(sessionStorage.getItem('__mockdb')));
  const sset = async () => { const d = (await db()).site_settings; return (Array.isArray(d) ? d[0] : d).data; };

  console.log('Settings structure');
  await pg.goto('http://localhost:4173/admin#settings'); await pg.waitForTimeout(1200);
  const tabs = await pg.locator('#st-tabs button').allInnerTexts();
  ok(tabs.join('|') === 'General|Brand Identity|Language|Website|SEO and analytics|Security and access', 'six clear groups: ' + tabs.join(' | '));
  const navTxt = (await pg.locator('#nav a').allInnerTexts()).join('|');
  ok(!/Brand/i.test(navTxt) && /Settings/.test(navTxt), 'menu has Settings only, no Brand Identity item: ' + navTxt.replace(/\n/g, ' ').slice(0, 120));
  const dup = await pg.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => c[e.id] = (c[e.id] || 0) + 1); return Object.keys(c).filter(k => c[k] > 1); });
  ok(dup.length === 0, 'no duplicate ids on the page ' + dup.join(','));
  const where = await pg.evaluate(() => { const o = {}; document.querySelectorAll('[data-pane]').forEach(p => p.querySelectorAll('input,select,textarea').forEach(i => { if (i.id) o[i.id] = p.getAttribute('data-pane'); })); return o; });
  ok(where['st-name'] === 'general' && where['st-email'] === 'general' && where['st-logo'] === 'brand' && where['st-fav'] === 'brand' && where['st-c-primary'] === 'brand' && where['st-tr-on'] === 'language' && where['st-seot'] === 'seo' && where['st-an'] === 'seo' && where['st-as'] === 'website', 'each control lives in one logical group');
  ok(await pg.isVisible('#st-name') && !(await pg.isVisible('#st-logo')), 'only the chosen group is shown');
  await pg.click('[data-stab=brand]'); ok(await pg.isVisible('#st-logo') && /#settings\/brand/.test(await pg.evaluate(() => location.hash)), 'switching group is instant and keeps a shareable address');
  ok(await pg.locator('.modal').count() === 0, 'no pop-up logo editor anywhere');
  // one save keeps values from several groups
  await pg.fill('#st-fav', '/assets/img/favicon.png'); await pg.click('[data-stab=general]'); await pg.fill('#st-tag', 'Learn calmly'); await pg.click('[data-stab=seo]'); await pg.fill('#st-seot', 'Inaya Quran Academy online');
  ok(!(await pg.locator('#st-dirty2').evaluate(e => e.classList.contains('hidden'))), 'unsaved changes are shown next to the save button');
  await pg.click('#st-save2'); await pg.waitForTimeout(700);
  let d = await sset(); ok(d.favicon_url === '/assets/img/favicon.png' && d.tagline === 'Learn calmly' && d.seo_title === 'Inaya Quran Academy online', 'one save stores changes from three groups');
  ok(await pg.locator('#st-dirty2').evaluate(e => e.classList.contains('hidden')), 'saved state is clear after saving');
  // validation points at the problem
  await pg.click('[data-stab=general]'); await pg.fill('#st-email', 'not-an-email'); await pg.click('#st-save'); await pg.waitForTimeout(300);
  ok(/Contact email looks invalid/.test(await pg.innerText('.modal')), 'validation message names the problem'); await pg.click('.modal [data-cancel], .modal .btn.ghost'); await pg.waitForTimeout(200);
  await pg.fill('#st-email', 'info@example.com');
  // leaving with unsaved changes asks first
  let asked = false; pg.on('dialog', dg => { asked = true; dg.dismiss(); });
  await pg.fill('#st-tag', 'Another tagline'); await pg.evaluate(() => { location.hash = '#overview'; }); await pg.waitForTimeout(400);
  ok(asked, 'leaving with unsaved changes asks first'); pg.removeAllListeners('dialog'); pg.on('dialog', dg => dg.accept());
  // old bookmark
  await pg.goto('http://localhost:4173/admin#brand'); await pg.waitForTimeout(900);
  ok(/#settings\/brand/.test(await pg.evaluate(() => location.hash)) && await pg.isVisible('#st-logo'), 'old #brand address opens the same Brand Identity group');
  // mobile
  await pg.setViewportSize({ width: 390, height: 800 }); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'settings fit a phone screen without sideways scrolling');
  await pg.setViewportSize({ width: 1360, height: 900 });

  console.log('Program wording per language');
  const p0 = (await db()).programs[0], T = p0.title;
  await pg.goto('http://localhost:4173/admin#programs/' + p0.id); await pg.waitForTimeout(1300);
  ok(await pg.locator('textarea[data-th]').count() > 4, 'translation panel lists the program texts (title, description, levels)');
  const hT = core.hashText(T);
  const bnBox = pg.locator('details').filter({ hasText: 'Bangla' }).locator('textarea[data-th="' + hT + '"]');
  const arBox = pg.locator('details').filter({ hasText: 'Arabic' }).locator('textarea[data-th="' + hT + '"]');
  await pg.locator('details').filter({ hasText: 'Arabic' }).first().locator('summary').click();
  await bnBox.fill('কুরআন পড়া ও সাবলীলতা'); await arBox.fill('القراءة والطلاقة'); await pg.click('#trp-save'); await pg.waitForTimeout(700);
  let rows = (await db()).translations.filter(r => r.src_hash === hT);
  const bn = rows.find(r => r.lang === 'bn'), ar = rows.find(r => r.lang === 'ar');
  ok(bn && bn.is_override && bn.text === 'কুরআন পড়া ও সাবলীলতা' && ar && ar.is_override && ar.text === 'القراءة والطلاقة', 'Bangla and Arabic saved separately as your own wording');
  ok(rows.length === 2 && bn.text !== ar.text, 'editing one language did not overwrite the other');
  await bnBox.fill(''); await pg.click('#trp-save'); await pg.waitForTimeout(700);
  rows = (await db()).translations.filter(r => r.src_hash === hT); const bn2 = rows.find(r => r.lang === 'bn'), ar2 = rows.find(r => r.lang === 'ar');
  ok(bn2 && !bn2.is_override && bn2.status === 'failed' && ar2 && ar2.is_override, 'emptying a box returns that language to automatic, the other stays');
  // English changed: the old wording does not follow the new English
  await pg.fill('#pe-title', 'Quran Reading Basics'); await pg.click('#pe-save'); await pg.waitForTimeout(800);
  const hN = core.hashText('Quran Reading Basics');
  ok(await pg.locator('textarea[data-th="' + hN + '"]').count() === 2 && await pg.locator('textarea[data-th="' + hT + '"]').count() === 0, 'after the English changes the panel asks for the new text, not the old one');
  ok((await pg.locator('textarea[data-th="' + hN + '"]').first().inputValue()) === '', 'new English text starts without a stale translation');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | ').slice(0, 200));
  await b.close(); console.log(`RESULT ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
