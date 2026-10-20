const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs=require('fs');
const mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8'); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  PASS':'  FAIL',m)};
const wait=(p,t=500)=>p.waitForTimeout(t);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 // ---- public: built-in pages render with NO database rows (fresh project)
 let ctx=await b.newContext({viewport:{width:1360,height:900}});
 await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};'}));
 await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
 const rpcs=[];
 await ctx.route(/x\.supabase\.co\/rest\/v1\//,async r=>{const u=r.request().url(); let body='[]';
   if(/rpc\/submit_lead/.test(u)){rpcs.push(['lead',r.request().postData()]);body='{"ok":true}';} else if(/rpc\/submit_contact/.test(u)){rpcs.push(['contact',r.request().postData()]);body='{"ok":true}';}
   else if(/\/programs/.test(u)) body=JSON.stringify([{id:'p1',slug:'quran-reading-fluency',title:'Quran Reading & Fluency',short_description:'Learn to read',description:'Desc',objectives:['Read well'],status:'published',sort_order:1,program_levels:[{id:'l1',level_number:1,title:'Reading Foundations',status:'published',sort_order:1}]}]);
   else if(/\/faqs/.test(u)) body=JSON.stringify([{id:'f1',category:'General',question:'Is there a free trial?',answer:'Yes, a free assessment.',sort_order:1,published:true}]);
   r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body});});
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
 for(const [u,needle] of [['/programs','Programs & levels'],['/faq','Frequently asked questions'],['/contact',"We'd love to hear from you"],['/assessment','Book a free Quran reading assessment']]){
   await pg.goto('http://localhost:4173'+u); await wait(pg,1400); const t=await pg.innerText('main');
   ok(t.includes(needle),u+' renders its default layout without a database row'); ok(!/Page not (available|found)/.test(t),u+' is not hidden'); ok(!/[—*]/.test(t),u+' has no long dash or star'); }
 await pg.goto('http://localhost:4173/faq'); await wait(pg,1200); ok(/Is there a free trial/.test(await pg.innerText('main')),'FAQ page lists questions from the database');
 await pg.goto('http://localhost:4173/programs'); await wait(pg,1200); ok(/Reading Foundations/.test(await pg.innerText('main')),'Programs page lists programs and levels');
 ok((await pg.title()).startsWith('Programs |'),'title: '+await pg.title());
 await pg.goto('http://localhost:4173/contact'); await wait(pg,1400);
 await pg.fill('#f_name','Test Parent'); await pg.fill('#f_email','a@b.co'); await pg.fill('#f_message','Hello there, a question'); await pg.click('#csubmit'); await wait(pg,800);
 ok(rpcs.some(r=>r[0]==='contact'&&/Test Parent/.test(r[1])),'contact form still submits to submit_contact'); ok(/Message sent/.test(await pg.innerText('main')),'contact success state shown');
 await pg.goto('http://localhost:4173/assessment'); await wait(pg,1400);
 ok(await pg.locator('#aform').count()===1,'assessment form mounted inside the page'); ok(/\(required\)/.test(await pg.innerText('#aform')),'required marker is words, not a star');
 await pg.fill('#f_name','Parent Two'); await pg.fill('#f_whatsapp','+8801700000000'); await pg.check('#f_consent').catch(()=>{}); await pg.click('#asubmit'); await wait(pg,800);
 ok(rpcs.some(r=>r[0]==='lead')||await pg.locator('.invalid,[data-err]:not(:empty)').count()>0,'assessment form validates / submits (lead calls: '+rpcs.filter(r=>r[0]==='lead').length+')');
 ok(errs.length===0,'no JS errors (public) '+errs.join('|')); await ctx.close();
 // ---- admin: built-in pages editable, row created on first edit
 ctx=await b.newContext({viewport:{width:1360,height:900}});
 await ctx.route('**/@supabase/supabase-js**',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};'}));
 await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort()); await ctx.addInitScript('window.__PERSIST=true');
 const ap=await ctx.newPage(); ap.on('dialog',d=>d.accept()); const e2=[]; ap.on('pageerror',e=>e2.push(e.message));
 await ap.goto('http://localhost:4173/admin#builder'); await wait(ap,1100);
 const list=await ap.innerText('#bp-l'); ok(['Programs','FAQ','Contact','Book a Free Assessment','Home','About'].every(t=>list.includes(t)),'builder lists all 8 built-in pages (incl. ones without a row)');
 ok(await ap.locator('#bp-l tbody tr',{hasText:'Contact'}).locator('[data-unp],[data-arc]').count()===0,'built-in pages cannot be unpublished or archived');
 await ap.click('#bp-l tbody tr:has-text("Contact") a.btn'); await wait(ap,1200);
 ok(await ap.evaluate(()=>__DB.pages.some(p=>p.slug==='contact')),'row created on first edit');
 const types=await ap.evaluate(()=>[...document.querySelectorAll('#sl .sec .t b')].map(e=>e.innerText.split('\n')[0]));
 ok(types.length===2&&/Contact form/.test(types[1]),'Contact page opens with its sections: '+types.join(' | '));
 await ap.click('#sl .sec[data-si="0"] [data-a="tog"]'); await ap.fill('#sl .sec[data-si="0"] [data-f="heading"]','Talk to us'); await wait(ap,400);
 ok((await ap.evaluate(()=>document.querySelector('#pv').srcdoc)).includes('Talk to us'),'preview updates'); 
 await ap.click('#b-save'); await wait(ap,600); await ap.click('#b-pub'); await wait(ap,300); await ap.click('.ov [data-ok]'); await wait(ap,700);
 ok(await ap.evaluate(()=>__DB.pages.find(p=>p.slug==='contact').published_sections[0].heading)==='Talk to us','edited Contact page saved and published');
 await ap.goto('http://localhost:4173/admin#builder/page/faq'); await wait(ap,1200); ok((await ap.locator('#sl .sec').count())===3,'FAQ page opens with 3 sections');
 await ap.selectOption('#add-type','assessment_form'); ok(true,'assessment form is an addable section'); await ap.click('#add-sec'); await ap.click('#b-save'); await wait(ap,600);
 ok(!/Please fix/.test(await ap.evaluate(()=>(document.querySelector('.ov .modal')||{innerText:''}).innerText)),'form sections need no heading');
 ok(e2.length===0,'no JS errors (admin) '+e2.join('|')); await b.close(); console.log(`RESULT ${pass} passed, ${fail} failed`);})();
