// Google Tag Manager and data layer behaviour, in a real browser against the e2e stack.
const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs = require('fs'), { execFileSync } = require('child_process');
const shim = fs.readFileSync(__dirname + '/supabase_http.js', 'utf8'), BASE = 'http://localhost:4180';
const sql = (q) => execFileSync('psql', ['-U', 'postgres', '-h', '/tmp/pgdata', '-p', '5544', '-d', 'inaya_test', '-tA', '-c', q], { encoding: 'utf8' }).trim();
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', m); };
(async () => {
  sql(`insert into site_settings(id, data) values (1, '{"analytics":{"provider":"gtm","gtm_id":"GTM-ABC1234"}}') on conflict (id) do update set data = '{"analytics":{"provider":"gtm","gtm_id":"GTM-ABC1234"}}'`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  async function page(opts) {
    const c = await b.newContext(); await c.route('**/@supabase/supabase-js**', r => r.fulfill({ contentType: 'text/javascript', body: shim }));
    await c.route(/fonts\.(googleapis|gstatic)/, r => r.abort()); let gtm = 0; await c.route(/googletagmanager\.com\/gtm\.js/, r => { gtm++; r.fulfill({ contentType: 'text/javascript', body: '/*gtm*/' }); });
    const p = await c.newPage(); if (opts && opts.dnt) await p.addInitScript('Object.defineProperty(navigator,"doNotTrack",{value:"1"})');
    if (opts && opts.clock) await p.clock.install(); p.gtmCount = () => gtm; return { c, p };
  }
  const dl = (p) => p.evaluate(() => (window.dataLayer || []).filter(x => x && x.event).map(x => x.event));
  // 1. before consent nothing is sent and GTM is not loaded
  let { c, p } = await page({ clock: true }); await p.goto(BASE + '/programs/quran-reading-fluency'); await p.waitForTimeout(1500);
  ok(await p.locator('.consent-bar').count() === 1 && /analytics tools/.test(await p.locator('.consent-bar').innerText()), 'a consent bar asks first');
  ok(p.gtmCount() === 0 && (await dl(p)).length === 0, 'no GTM script and no events before consent');
  await p.click('.consent-bar [data-c=yes]'); await p.waitForTimeout(500);
  let ev = await dl(p); ok(p.gtmCount() === 1, 'GTM loads after Accept');
  ok(ev.includes('gtm.js') && ev.includes('page_view') && ev.includes('view_item'), 'queued page_view and view_item are sent after Accept: ' + ev.join(','));
  const vi = await p.evaluate(() => (window.dataLayer.filter(x => x.event === 'view_item')[0]));
  ok(vi.ecommerce && vi.ecommerce.items[0].item_id === 'quran-reading-fluency' && vi.page_path.startsWith('/programs/') && !!vi.language, 'view_item follows the GA4 shape with the program item');
  ok(await p.evaluate(() => { const i = window.dataLayer.findIndex(x => x.event === 'view_item'); return window.dataLayer[i - 1] && window.dataLayer[i - 1].ecommerce === null; }), 'ecommerce is cleared before each ecommerce push');
  await p.clock.fastForward(31000); await p.waitForTimeout(1500); ev = await dl(p);
  ok(ev.includes('engaged_30s') && ev.includes('user_engagement'), 'engaged_30s fires after 30 seconds on the page');
  ok((await p.evaluate(() => window.dataLayer.filter(x => x.event === 'engaged_30s').length)) === 1, 'and only once');
  await c.close();
  // 2. decline drops everything
  ({ c, p } = await page()); await p.goto(BASE + '/'); await p.waitForTimeout(1200); await p.click('.consent-bar [data-c=no]'); await p.waitForTimeout(400);
  ok(p.gtmCount() === 0 && (await dl(p)).length === 0, 'Decline: no GTM and nothing in the data layer');
  await p.goto(BASE + '/about'); await p.waitForTimeout(1200); ok(await p.locator('.consent-bar').count() === 0 && (await dl(p)).length === 0, 'the choice is remembered on the next page');
  await c.close();
  // 3. already accepted: loads straight away, lead events
  ({ c, p } = await page()); await p.addInitScript('localStorage.setItem("iqa_consent","yes")'); await p.goto(BASE + '/'); await p.waitForTimeout(1500);
  ok(p.gtmCount() === 1 && (await dl(p)).includes('page_view'), 'accepted visitors get GTM and page_view straight away');
  await p.evaluate(() => { Inaya.track('assessment_form_start'); Inaya.track('assessment_submitted'); Inaya.track('whatsapp_click'); Inaya.dl('add_to_cart', { ecommerce: { items: [{ item_id: 'x', item_name: 'x' }] } }); });
  ev = await dl(p); ok(ev.includes('form_start') && ev.includes('generate_lead') && ev.includes('whatsapp_click'), 'lead events use GA4 names');
  ok(ev.includes('add_to_cart'), 'Inaya.dl can push any other GA4 event such as add_to_cart');
  ok(!JSON.stringify(await p.evaluate(() => window.dataLayer)).match(/@|phone|email/i), 'no personal details in the data layer');
  await c.close();
  // 4. do not track, student area, admin
  ({ c, p } = await page({ dnt: true })); await p.addInitScript('localStorage.setItem("iqa_consent","yes")'); await p.goto(BASE + '/'); await p.waitForTimeout(1200);
  ok(p.gtmCount() === 0, 'Do Not Track is respected'); await c.close();
  ({ c, p } = await page()); await p.addInitScript('localStorage.setItem("iqa_consent","yes")'); await p.goto(BASE + '/learn'); await p.waitForTimeout(1500);
  ok(p.gtmCount() === 0 && (await dl(p)).length === 0, 'the student area never loads analytics'); await c.close();
  // 5. other providers unchanged
  sql(`update site_settings set data = '{"analytics":{"provider":"none"}}' where id=1`);
  ({ c, p } = await page()); await p.goto(BASE + '/'); await p.waitForTimeout(1200); ok(p.gtmCount() === 0 && await p.locator('.consent-bar').count() === 0, 'with no provider nothing loads and no bar shows'); await c.close();
  sql(`delete from site_settings where id=1`);
  console.log(pass + ' passed, ' + fail + ' failed'); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
