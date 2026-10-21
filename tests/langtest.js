const { chromium } = require('/opt/npm-tools/node_modules/playwright'); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  PASS':'  FAIL',m)};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1360,height:800}});
await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};'}));
await ctx.route(/fonts\.(googleapis|gstatic)|translate\.google/,r=>r.abort()); await ctx.route(/x\.supabase\.co\/rest\/v1\//,r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}));
const pg=await ctx.newPage(); const U='http://localhost:4173';
const leftovers=async()=>pg.evaluate(()=>{const out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();const p=n.parentElement;if(t&&/[A-Za-z]{3}/.test(t)&&!p.closest('[data-noi18n],script,style,noscript')&&!/^(WhatsApp|Facebook|Instagram|Telegram|YouTube|IQA)/.test(t))out.push(t.slice(0,50))}return out});
for (const page of ['/','/about','/programs','/faq','/contact','/assessment','/privacy','/terms','/programs/quran-reading-fluency','/nothing-here']) {
  await pg.goto(U+'/?lang=en'); await pg.evaluate(()=>localStorage.setItem('iqa_lang','bn'));
  await pg.goto(U+page); await pg.waitForTimeout(1500);
  const lo=await leftovers(); ok(lo.length===0,'bn '+page+' no English left '+JSON.stringify(lo.slice(0,4)));
  ok(await pg.evaluate(()=>document.documentElement.lang==='bn'&&document.documentElement.dir==='ltr'),'bn html lang');
}
for (const page of ['/','/programs','/faq','/contact','/assessment','/privacy']) {
  await pg.goto(U+'/?lang=ar'); await pg.goto(U+page); await pg.waitForTimeout(1500);
  const lo=await leftovers(); ok(lo.length===0,'ar '+page+' no English left '+JSON.stringify(lo.slice(0,4)));
  ok(await pg.evaluate(()=>document.documentElement.dir==='rtl'),'ar rtl');
}
await pg.goto(U+'/?lang=ar'); await pg.waitForTimeout(1200);
ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'ar no horizontal scroll');
await pg.screenshot({path:process.env.OUT+'/ar_home.png'});
// switcher
await pg.goto(U+'/?lang=en'); await pg.waitForTimeout(1000);
await pg.click('.lang-btn'); ok(await pg.isVisible('.lang-menu'),'menu opens');
await pg.click('.lang-menu button[data-l=bn]'); await pg.waitForTimeout(1500);
ok(await pg.evaluate(()=>document.documentElement.lang==='bn'&&/হোম/.test(document.querySelector('.nav').textContent)),'switch to Bangla');
await pg.goto(U+'/contact'); await pg.waitForTimeout(1200);
ok(await pg.evaluate(()=>document.documentElement.lang==='bn'),'language persists across pages');
await pg.screenshot({path:process.env.OUT+'/bn_contact.png'});
// form errors translate
await pg.goto(U+'/assessment'); await pg.waitForTimeout(1500); await pg.click('#asubmit'); await pg.waitForTimeout(400);
ok(await pg.evaluate(()=>/অনুগ্রহ/.test(document.querySelector('[data-err=name]').textContent)),'form error in Bangla');
// google option
await pg.click('.lang-btn'); await pg.selectOption('.lang-menu select','g:fr'); await pg.waitForTimeout(1200);
ok(await pg.evaluate(()=>document.documentElement.lang==='fr'&&/googtrans=\/en\/fr/.test(document.cookie)),'More languages sets Google Translate cookie');
// mobile
const m=await ctx.newPage(); await m.setViewportSize({width:390,height:800}); await m.goto(U+'/?lang=bn'); await m.waitForTimeout(1500);
ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile bn no horizontal scroll');
await m.screenshot({path:process.env.OUT+'/bn_m.png'});
await b.close(); console.log(`RESULT ${pass} passed, ${fail} failed`)})();
