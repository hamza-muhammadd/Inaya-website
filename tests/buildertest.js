const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs=require('fs');
const mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  PASS',m)}else{fail++;console.log('  FAIL',m)} };
async function mk(b,w,extraInit){ const ctx=await b.newContext({viewport:{width:w,height:900}});
  await ctx.route('**/@supabase/supabase-js**',r=>r.fulfill({contentType:'text/javascript',body:mock}));
  await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  if(extraInit) await ctx.addInitScript(extraInit);
  const pg=await ctx.newPage(); pg.errs=[]; pg.on('pageerror',e=>pg.errs.push('PAGEERROR '+e.message)); pg.on('dialog',d=>d.accept()); return {ctx,pg}; }
const wait=(p,t=400)=>p.waitForTimeout(t);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  // ================= A. migration 007 applied =================
  let {ctx,pg}=await mk(b,1360,'window.__PERSIST=true');
  await pg.goto('http://localhost:4173/admin'); await wait(pg,900);
  console.log('A1 nav');
  ok(await pg.locator('#nav a[data-v="builder"]').count()===1,'Website Builder is in the admin nav');
  await pg.click('#nav a[data-v="builder"]'); await wait(pg,700);
  ok(/Website Builder/.test(await pg.innerText('#view h1')),'Builder opens');
  ok((await pg.locator('#bp-l tbody tr').count())===2,'existing pages listed (mock seeds 2)');
  ok(!(await pg.locator('#bp-mig').count()),'no migration warning when 007 applied');
  console.log('A2 create page');
  await pg.click('#bp-new'); await wait(pg);
  await pg.fill('#cp-t','Summer Camp'); await wait(pg,100);
  ok(await pg.inputValue('#cp-s')==='summer-camp','slug auto-generated');
  await pg.fill('#cp-s','about'); await wait(pg,100);
  ok(/reserved|exists/.test(await pg.innerText('#cp-se')),'reserved/duplicate slug rejected: '+(await pg.innerText('#cp-se')));
  await pg.fill('#cp-s','Bad Slug!'); await wait(pg,100);
  ok((await pg.innerText('#cp-se')).length>5,'invalid characters rejected');
  await pg.fill('#cp-s','summer-camp'); await pg.selectOption('#cp-tpl','b-landing'); await pg.check('#cp-nav');
  await pg.click('.ov [data-ok]'); await wait(pg,900);
  ok(pg.url().endsWith('#builder/page/summer-camp'),'lands in editor at #builder/page/summer-camp');
  let row=await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='summer-camp'));
  ok(row&&row.status==='draft'&&row.draft_sections.length===5&&row.show_in_nav===true,'row inserted as draft with 5 template sections');
  console.log('A3 sections');
  await pg.selectOption('#add-type','text_image'); await pg.click('#add-sec'); await wait(pg,300);
  ok((await pg.locator('#sl .sec').count())===6,'section added (6)');
  await pg.fill('#sl .sec[data-si="5"] [data-f="heading"]','Camp story'); await wait(pg,400);
  await pg.click('#sl .sec[data-si="5"] [data-pick="image"]'); await wait(pg,500);
  await pg.click('.ov .pick >> nth=0'); await wait(pg,400);
  const img=await pg.inputValue('#sl .sec[data-si="5"] [data-f="image"]');
  ok(!!img,'asset picked from Media Library → '+img);
  ok(await pg.locator('#sl .sec[data-si="5"] .imgprev img').count()===1,'image preview thumbnail shown');
  await pg.click('#sl .sec[data-si="5"] [data-a="dup"]'); await wait(pg,200);
  ok((await pg.locator('#sl .sec').count())===7,'section duplicated (7)');
  await pg.click('#sl .sec[data-si="6"] [data-a="up"]'); await wait(pg,200);
  await pg.click('#sl .sec[data-si="0"] [data-a="down"]'); await wait(pg,200);
  const types=await pg.evaluate(()=>[...document.querySelectorAll('#sl .sec .t b')].map(e=>e.innerText.replace(/^\d+\.\s*/,'').split('\n')[0]));
  ok(types[0]==='Benefits / points'&&types[1]==='Hero','reordered: '+types.slice(0,2).join(', '));
  await pg.click('#sl .sec[data-si="6"] [data-a="del"]'); await wait(pg,300); await pg.click('.ov [data-ok]'); await wait(pg,300);
  ok((await pg.locator('#sl .sec').count())===6,'section deleted (6)');
  const pv=await pg.evaluate(()=>document.querySelector('#pv').srcdoc); ok(pv.includes('Camp story'),'live preview shows the edit');
  console.log('A4 settings + save');
  await pg.click('#seo-tog'); await pg.fill('#m-seot','Summer Camp — Inaya'); await pg.fill('#m-navl','Camp'); await pg.fill('#m-navo','5'); await wait(pg,200);
  await pg.click('#b-save'); await wait(pg,700);
  row=await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='summer-camp'));
  ok(row.draft_sections.length===6&&row.draft_meta&&row.draft_meta.seo_title==='Summer Camp — Inaya'&&row.has_unpublished===true,'draft saved incl. draft_meta; page still unpublished');
  ok(row.seo_title==null&&row.status==='draft','settings NOT live before publish');
  await pg.reload(); await wait(pg,1200);
  ok((await pg.locator('#sl .sec').count())===6,'sections survive reload');
  await pg.click('#seo-tog'); ok(await pg.inputValue('#m-seot')==='Summer Camp — Inaya','draft settings survive reload');
  const imgSaved=await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='summer-camp').draft_sections.find(s=>s.heading==='Camp story').image);
  ok(imgSaved===img,'image URL (not binary) stored in section JSON; ref preserved');
  ok(JSON.stringify(row.draft_sections).length<20000,'JSON small (no binaries)');
  console.log('A5 publish');
  await pg.click('#b-pub'); await wait(pg,300); await pg.click('.ov [data-ok]'); await wait(pg,800);
  row=await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='summer-camp'));
  ok(row.status==='published'&&row.published_sections.length===6&&row.seo_title==='Summer Camp — Inaya'&&row.nav_label==='Camp'&&row.nav_order===5&&row.draft_meta===null,'published: sections + settings live');
  const snap=await pg.evaluate(()=>JSON.stringify({pages:__DB.pages,settings:__DB.site_settings}));
  // ---- list actions
  console.log('A6 list actions');
  await pg.goto('http://localhost:4173/admin#builder'); await wait(pg,900);
  ok((await pg.locator('#bp-l tbody tr').count())===3,'3 pages listed');
  const rowOf=async t=>pg.locator('#bp-l tbody tr',{hasText:t}).first();
  await (await rowOf('Summer Camp')).locator('[data-dup]').click(); await wait(pg); 
  ok(await pg.inputValue('#cp-s')==='summer-camp-copy','duplicate proposes slug summer-camp-copy');
  await pg.click('.ov [data-ok]'); await wait(pg,900);
  const dup=await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='summer-camp-copy'));
  ok(dup&&dup.status==='draft'&&dup.draft_sections.length===6&&dup.draft_sections[0].id!==JSON.parse(snap).pages.find(p=>p.slug==='summer-camp').draft_sections[0].id,'duplicate is a draft with fresh section ids');
  await pg.goto('http://localhost:4173/admin#builder'); await wait(pg,800);
  await (await rowOf('Summer Camp (copy)')).locator('[data-arc]').click(); await wait(pg); await pg.click('.ov [data-ok]'); await wait(pg,700);
  ok((await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='summer-camp-copy').archived))===true,'archive works (row kept)');
  await pg.click('#bp-f [data-f="archived"]'); await wait(pg); ok((await pg.locator('#bp-l tbody tr').count())===1,'archived filter shows it');
  await pg.locator('[data-res]').click(); await wait(pg); await pg.click('.ov [data-ok]'); await wait(pg,700);
  ok((await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='summer-camp-copy').archived))===false,'restore works');
  await pg.goto('http://localhost:4173/admin#builder'); await wait(pg,800);
  ok(await (await rowOf('Home')).locator('[data-unp],[data-arc]').count()===0,'home cannot be unpublished/archived');
  // template save + reuse
  await pg.goto('http://localhost:4173/admin#builder/page/summer-camp'); await wait(pg,900);
  await pg.click('#b-more'); await wait(pg); await pg.click('[data-x5]'); await wait(pg); await pg.fill('#tp-n','Camp layout'); await pg.click('.ov [data-ok]'); await wait(pg,600);
  ok((await pg.evaluate(()=>__DB.page_templates.length))===1,'saved as template');
  await pg.goto('http://localhost:4173/admin#builder/templates'); await wait(pg,800);
  ok(/Camp layout/.test(await pg.innerText('#bt')),'template listed in Templates tab');
  await pg.click('#bp-new'); await wait(pg); ok((await pg.locator('#cp-tpl option').allInnerTexts()).some(t=>/Camp layout/.test(t)),'saved template offered in Create page');
  await pg.fill('#cp-t','Camp two'); await pg.selectOption('#cp-tpl',{label:'Camp layout (saved)'}); await pg.click('.ov [data-ok]'); await wait(pg,900);
  ok((await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='camp-two').draft_sections.length))===6,'page created from saved template');
  // change URL
  await pg.click('#seo-tog'); await pg.click('#m-url'); await wait(pg); await pg.fill('#cu-s','camp-2'); await pg.click('.ov [data-ok]'); await wait(pg,800);
  ok(pg.url().endsWith('#builder/page/camp-2'),'URL changed and editor re-opened at the new slug');
  // unpublish
  await pg.goto('http://localhost:4173/admin#builder'); await wait(pg,800); await pg.click('#bp-f [data-f="all"]'); await wait(pg,200);
  await (await rowOf('Summer Camp')).first().locator('[data-unp]').click(); await wait(pg); await pg.click('.ov [data-ok]'); await wait(pg,600);
  ok((await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='summer-camp').status))==='draft','unpublish works');
  await pg.locator('tr',{hasText:'Summer Camp'}).first().locator('[data-rep]').click(); await wait(pg); await pg.click('.ov [data-ok]'); await wait(pg,600);
  ok((await pg.evaluate(()=>__DB.pages.find(p=>p.slug==='summer-camp').status))==='published','republish works');
  const snap2=await pg.evaluate(()=>JSON.stringify({pages:__DB.pages,settings:__DB.site_settings}));
  // ---- content redirect
  await pg.goto('http://localhost:4173/admin#content/page/about'); await wait(pg,900); ok(pg.url().endsWith('#builder/page/about'),'old Website Content page URLs redirect to the builder');
  await pg.goto('http://localhost:4173/admin#content'); await wait(pg,600); ok(/Open Website Builder/.test(await pg.innerText('#view')),'Website Content → Pages points to the builder');
  ok(pg.errs.length===0,'no JS errors (admin) '+pg.errs.join('|')); await ctx.close();

  // ================= B. public site =================
  console.log('B public');
  const S=JSON.parse(snap2);
  const pub=await mk(b,1360); const pp=pub.pg;
  await pub.ctx.route(/x\.supabase\.co\/rest\/v1\//,r=>{ const u=decodeURIComponent(r.request().url()); let body=[];
    if(/site_settings/.test(u)) body=S.settings;
    else if(/public_pages\?show_in_nav/.test(u)) body=S.pages.filter(p=>p.status==='published'&&!p.archived&&p.show_in_nav).map(p=>({slug:p.slug,title:p.title,nav_label:p.nav_label,nav_order:p.nav_order}));
    else if(/public_pages\?slug=eq\.([^&]+)/.test(u)){ const sl=u.match(/slug=eq\.([^&]+)/)[1]; body=S.pages.filter(p=>p.slug===sl&&p.status==='published'&&!p.archived).map(p=>({...p,sections:p.published_sections})); }
    r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)}); });
  await pp.goto('http://localhost:4173/summer-camp'); await wait(pp,1500);
  let txt=await pp.innerText('main'); ok(/Camp story/.test(txt)&&/Your headline here/.test(txt),'published custom page renders saved sections at /summer-camp');
  ok((await pp.title()).includes('Summer Camp'),'SEO title applied: '+await pp.title());
  ok(await pp.evaluate(()=>!document.querySelector('meta[name=robots][content=noindex]')),'published page is indexable');
  ok(await pp.evaluate(()=>[...document.querySelectorAll('#nav a.nav-link')].some(a=>a.textContent==='Camp'&&a.getAttribute('href')==='/summer-camp')),'page appears in public menu as “Camp”');
  const hasImg=await pp.evaluate(img=>!!document.querySelector('main img[src*="'+img.replace(/.*\//,'')+'"]'),img); ok(hasImg,'selected asset renders on the public page');
  await pp.goto('http://localhost:4173/camp-2'); await wait(pp,1200); ok(/Page not found/.test(await pp.innerText('main')),'unpublished page → “Page not found”, noindex');
  await pp.goto('http://localhost:4173/nope-nothing'); await wait(pp,1000); ok(/Page not found/.test(await pp.innerText('main')),'unknown slug → Page not found');
  await pp.goto('http://localhost:4173/summer-camp'); await wait(pp,800);
  const hdr1=await pp.evaluate(()=>document.querySelector('#nav')?.innerText||'');
  await pp.goto('http://localhost:4173/about'); // repeat visit: instant chrome from cache
  await pp.waitForFunction(()=>document.querySelector('#nav'),null,{timeout:3000}); ok(true,'header present on next page'); 
  ok(await pp.evaluate(()=>localStorage.getItem('inaya_site_v1')!==null),'settings cached for instant repeat paint');
  // internal navigation
  await pp.goto('http://localhost:4173/summer-camp'); await wait(pp,900); await pp.click('#nav a.nav-link:has-text("FAQ")'); await wait(pp,900); ok(/\/faq$/.test(pp.url()),'internal nav → /faq');
  ok(pp.errs.length===0,'no JS errors (public) '+pp.errs.join('|')); await pub.ctx.close();

  // ================= C. mobile =================
  console.log('C mobile');
  const mob=await mk(b,390); const mp=mob.pg;
  await mob.ctx.route(/x\.supabase\.co\/rest\/v1\//,r=>{ const u=decodeURIComponent(r.request().url()); let body=[]; if(/site_settings/.test(u)) body=S.settings; else if(/public_pages\?slug/.test(u)) body=S.pages.filter(p=>p.slug==='summer-camp').map(p=>({...p,sections:p.published_sections})); r.fulfill({contentType:'application/json',body:JSON.stringify(body)}); });
  await mp.goto('http://localhost:4173/summer-camp'); await wait(mp,1200);
  ok(await mp.locator('.menu-btn').isVisible(),'public menu button visible on mobile');
  await mp.click('.menu-btn'); ok(await mp.locator('#nav.open').count()===1,'menu opens'); await mp.screenshot({path:'b_mobile_menu.png'});
  await mp.click('#nav a.nav-link >> nth=1'); await wait(mp,900); ok(await mp.locator('#nav.open').count()===0,'menu closes after tapping a link');
  ok(!(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'public page has no horizontal scroll at 390px');
  await mp.goto('http://localhost:4173/admin#builder'); await wait(mp,1000);
  ok(!(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'admin builder list: no page-level horizontal scroll at 390px');
  await mp.screenshot({path:'b_mobile_admin.png'});
  await mp.goto('http://localhost:4173/admin#builder/page/about'); await wait(mp,1500);
  ok(!(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'admin editor: no page-level horizontal scroll at 390px'); await mp.screenshot({path:'b_mobile_editor.png'});
  await mob.ctx.close();

  // ================= D. migration 007 NOT applied =================
  console.log('D legacy mode (no migration)');
  const L=await mk(b,1360,'window.__NO007=true'); const lp=L.pg;
  await lp.goto('http://localhost:4173/admin#builder'); await wait(lp,1000);
  ok(await lp.locator('#bp-mig').count()===1,'clear “one-time database update” notice shown');
  await lp.click('#bp-new'); await wait(lp); await lp.fill('#cp-t','Legacy page'); await lp.click('.ov [data-ok]'); await wait(lp,900);
  ok(lp.url().endsWith('#builder/page/legacy-page'),'create page still works without 007');
  await lp.click('#b-save'); await wait(lp,600); await lp.click('#b-pub'); await wait(lp,300); await lp.click('.ov [data-ok]'); await wait(lp,700);
  ok((await lp.evaluate(()=>__DB.pages.find(p=>p.slug==='legacy-page').status))==='published','save + publish work without 007');
  ok(lp.errs.length===0,'no JS errors (legacy) '+lp.errs.join('|')); await L.ctx.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); await b.close(); process.exit(fail?1:0);
})();
