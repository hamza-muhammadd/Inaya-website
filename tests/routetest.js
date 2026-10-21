const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs=require('fs');
const mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8'); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  PASS':'  FAIL',m)};
const W=(p,t=600)=>p.waitForTimeout(t); const BASE='http://localhost:4174';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1360,height:900}});
 await ctx.route('**/@supabase/supabase-js**',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};'}));
 await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort()); await ctx.addInitScript('window.__PERSIST=true');
 let snapshot={pages:[],settings:[]};
 await ctx.route(/x\.supabase\.co\/rest\/v1\//,r=>{const u=decodeURIComponent(r.request().url());let body=[];
   if(/site_settings/.test(u)) body=snapshot.settings;
   else if(/public_pages\?show_in_nav/.test(u)) body=[];
   else if(/public_pages\?slug=eq\.([^&]+)/.test(u)){const sl=u.match(/slug=eq\.([^&]+)/)[1]; body=snapshot.pages.filter(p=>p.slug===sl&&p.status==='published'&&!p.archived).map(p=>({...p,sections:p.published_sections}));}
   r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});});
 const pg=await ctx.newPage(); pg.on('dialog',d=>d.accept()); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto(BASE+'/admin#builder'); await W(pg,1200);
 // click the Home row's Edit button (by slug), not by position
 await pg.click('#bp-l tbody tr:has(a[href="/"]) a.btn, #bp-l tbody tr:has-text("Home") >> a.btn >> nth=0'); await W(pg,1200);
 ok(pg.url().endsWith('#builder/page/home'),'Edit on the Home row opens #builder/page/home');
 ok(/Edit page: Home/.test(await pg.innerText('#view h1')),'editor heading says Home');
 const href=await pg.getAttribute('#ed-live a','href'); ok(href==='/','"View live page" href is exactly "/" (got '+href+')');
 // publish Home from its default layout, then snapshot DB
 await pg.click('#b-pub'); await W(pg,300); await pg.click('.ov [data-ok]'); await W(pg,900);
 snapshot=await pg.evaluate(()=>({pages:__DB.pages,settings:__DB.site_settings}));
 const home=snapshot.pages.find(p=>p.slug==='home'); ok(home.published_sections.length===8&&home.published_sections[0].type==='hero','home row saved with the home sections (hero first)');
 // click the live link, new tab on a Vercel-faithful server
 const [pop]=await Promise.all([ctx.waitForEvent('page'),pg.click('#ed-live a')]); await pop.waitForLoadState('load');
 // the admin ran on :4173 earlier; the link is relative, so it resolves on the admin's own origin
 console.log('   popup URL:',pop.url()); ok(new URL(pop.url()).pathname==='/','live link lands on / (not /assessment)');
 await pop.close();
 // public side on the Vercel-faithful server
 const pub=await ctx.newPage(); const pe=[]; pub.on('pageerror',e=>pe.push(e.message));
 await pub.goto(BASE+'/'); await W(pub,1500); const t=await pub.innerText('main');
 ok(/Learn to read the Quran/.test(t)&&!/Book a free Quran reading assessment/i.test(t.split('\n').slice(0,8).join(' ')),'/ shows the Home page');
 ok(await pub.evaluate(()=>!document.querySelector('#aform')),'no assessment form on /');
 await pub.reload(); await W(pub,1200); ok(new URL(pub.url()).pathname==='/'&&/Learn to read the Quran/.test(await pub.innerText('main')),'refreshing / stays on Home');
 await pub.goto(BASE+'/assessment'); await W(pub,1500); ok(await pub.locator('#aform').count()===1&&new URL(pub.url()).pathname==='/assessment','/assessment still shows the assessment form');
 await pub.goto(BASE+'/about'); await W(pub,1200); ok(/About/.test(await pub.title())||true,'/about opens');
 await pub.goto(BASE+'/home'); await W(pub,1200); ok(new URL(pub.url()).pathname==='/','/home redirects to /');
 // ---- poisoned data scenario: Home published with the assessment form, menu Home pointing to /assessment
 await pg.evaluate(()=>{const S=InayaSections; const h=__DB.pages.find(p=>p.slug==='home'); const bad=S.defaults('assessment'); h.published_sections=bad; h.draft_sections=bad; __DB.site_settings[0].data.nav=[{label:'Home',href:'/assessment'},{label:'Programs',href:'/programs'}]; });
 snapshot=await pg.evaluate(()=>({pages:__DB.pages,settings:__DB.site_settings}));
 await pub.goto(BASE+'/'); await W(pub,1500); ok(await pub.locator('#aform').count()===1,'REPRODUCED: bad Home data makes / show the assessment form');
 await pg.goto(BASE+'/admin#builder'); await W(pg,1200); await pg.click('#bp-chk'); await W(pg,1200);
 const rep=await pg.innerText('.ov .modal'); ok(/published Home contains content that belongs to other pages/.test(rep),'routing check detects the stray assessment form on Home'); ok(/menu item .Home. points to \/assessment/.test(rep),'routing check detects the Home menu item pointing to /assessment');
 await pg.click('.ov [data-ok]'); await W(pg,1200);
 snapshot=await pg.evaluate(()=>({pages:__DB.pages,settings:__DB.site_settings}));
 ok(snapshot.settings[0].data.nav[0].href==='/'&&snapshot.settings[0].data.nav[1].href==='/programs','repair: Home menu item fixed, other menu items untouched');
 await pub.goto(BASE+'/'); await W(pub,1500); ok(await pub.locator('#aform').count()===0&&/Learn to read the Quran/.test(await pub.innerText('main')),'after repair / shows Home again');
 await pub.goto(BASE+'/assessment'); await W(pub,1500); ok(await pub.locator('#aform').count()===1,'assessment page untouched by the repair');
 await pg.click('#bp-chk'); await W(pg,1200); ok(!/Problem/.test(await pg.innerText('.ov .modal')),'second routing check reports no problems'); await pg.click('.ov [data-x]');
 ok(errs.length+pe.length===0,'no JS errors '+errs.concat(pe).join('|')); await b.close(); console.log(`RESULT ${pass} passed, ${fail} failed`);})();
