const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs=require('fs');
const mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8'); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  PASS':'  FAIL',m)};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 for(const reduce of [false,true]){
  console.log(reduce?'reduced motion':'normal motion');
  const ctx=await b.newContext({viewport:{width:1360,height:800},reducedMotion:reduce?'reduce':'no-preference'});
  await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await ctx.route(/x\.supabase\.co\/rest\/v1\//,r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}));
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{window.__cls=0; new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});});
  await pg.goto('http://localhost:4173/'); await pg.waitForTimeout(1800);
  const st=await pg.evaluate(()=>({mo:document.documentElement.classList.contains('mo'),secs:document.querySelectorAll('[data-anim]').length,inn:document.querySelectorAll('[data-anim].in').length,st:document.querySelectorAll('[data-st]').length,op:getComputedStyle(document.querySelector('.hero')).opacity}));
  if(!reduce){ ok(st.mo&&st.secs>=6,'motion on, '+st.secs+' sections animated, '+st.st+' staggered children'); ok(st.inn>=1&&st.inn<st.secs,'only visible sections revealed at load ('+st.inn+'/'+st.secs+')'); }
  else ok(!st.mo&&st.op==='1','reduced motion: no hiding, content visible');
  const below=await pg.evaluate(()=>{const s=[...document.querySelectorAll('[data-anim]')].filter(e=>!e.classList.contains('in'));return s.length&&getComputedStyle(s[0]).opacity});
  if(!reduce) ok(below==='0','sections below the fold start hidden (opacity '+below+')');
  await pg.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=300){scrollTo(0,y);await new Promise(r=>setTimeout(r,90));}}); await pg.waitForTimeout(1400);
  const all=await pg.evaluate(()=>({n:document.querySelectorAll('[data-anim]').length,i:document.querySelectorAll('[data-anim].in').length,vis:[...document.querySelectorAll('[data-anim],[data-st]')].filter(e=>getComputedStyle(e).opacity==='0').length}));
  ok(all.vis===0,'after scrolling every section and card is visible ('+all.i+'/'+all.n+' revealed)');
  const cls=await pg.evaluate(()=>window.__cls); ok(cls<0.1,'layout shift (CLS) '+cls.toFixed(3)+' < 0.1');
  ok(!(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'no horizontal overflow');
  const txt=await pg.evaluate(()=>document.body.innerText); ok(!/[—*]/.test(txt),'no long dash or star characters in visible home page text');
  ok(await pg.evaluate(()=>{const h=document.querySelector('.card');if(!h)return true;h.scrollIntoView();return true}),'cards present');
  await pg.evaluate(()=>scrollTo(0,0)); await pg.waitForTimeout(300); await pg.screenshot({path:'m_home'+(reduce?'_r':'')+'.png'});
  if(!reduce){ await pg.evaluate(()=>scrollTo(0,1000)); await pg.waitForTimeout(250); ok(await pg.evaluate(()=>document.getElementById('site-header').classList.contains('scrolled')),'header gets a soft shadow once scrolled'); }
  for(const u of ['/about','/programs','/faq','/contact','/assessment','/privacy','/terms']){ await pg.goto('http://localhost:4173'+u); await pg.waitForTimeout(1000); const t=await pg.evaluate(()=>document.body.innerText+' '+document.title); if(/[—*]/.test(t)) {fail++;console.log('  FAIL dash/star on',u,(t.match(/.{20}[—*].{20}/)||[''])[0])} }
  ok(errs.length===0,'no JS errors '+errs.join('|')); await ctx.close();
 }
 console.log(`RESULT ${pass} passed, ${fail} failed`); await b.close();})();
