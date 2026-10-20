const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const fs=require('fs');
const mock=fs.readFileSync(__dirname+'/mock_supabase.js','utf8'); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  PASS':'  FAIL',m)};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1360,height:800}});
 await ctx.route('**/@supabase/supabase-js**',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};'}));
 await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
 const pg=await ctx.newPage(); pg.on('dialog',d=>d.accept()); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('http://localhost:4173/admin#overview'); await pg.waitForTimeout(1200);
 const m=()=>pg.evaluate(()=>({doc:document.documentElement.scrollHeight-innerHeight,y:scrollY,side:document.querySelector('#side').scrollTop,sideMax:document.querySelector('#side').scrollHeight-document.querySelector('#side').clientHeight,view:document.querySelector('#view').scrollTop,viewMax:document.querySelector('#view').scrollHeight-document.querySelector('#view').clientHeight,top:document.querySelector('.topbar').getBoundingClientRect().top}));
 let s=await m(); ok(s.doc<=1,'page itself does not scroll (doc overflow '+s.doc+'px)');
 ok(s.sideMax>0,'sidebar content taller than viewport ('+s.sideMax+'px) → needs its own scroll');
 await pg.mouse.move(100,400); await pg.mouse.wheel(0,300); await pg.waitForTimeout(250); let t=await m();
 ok(t.side>0&&t.view===0&&t.y===0&&t.top===s.top,'wheel over sidebar scrolls ONLY the sidebar (side='+t.side+', view='+t.view+')');
 await pg.mouse.move(700,400); await pg.mouse.wheel(0,500); await pg.waitForTimeout(250); t=await m();
 ok(t.viewMax>0?(t.view>0&&t.y===0&&t.top===s.top):true,'wheel over content scrolls ONLY the content; topbar stays (view='+t.view+'/'+t.viewMax+')');
 await pg.screenshot({path:'s_overview.png'});
 // editor
 await pg.evaluate(()=>{location.hash='builder/page/home'}); await pg.waitForTimeout(1200);
 const e=()=>pg.evaluate(()=>{const l=document.querySelector('.ed>div:first-child'),pv=document.querySelector('.pv');return{y:scrollY,doc:document.documentElement.scrollHeight-innerHeight,left:l.scrollTop,leftMax:l.scrollHeight-l.clientHeight,pvTop:Math.round(pv.getBoundingClientRect().top),hdr:Math.round(document.querySelector('#view .page-h').getBoundingClientRect().top),view:document.querySelector('#view').scrollTop,ifh:document.querySelector('#pv').getBoundingClientRect().height}});
 let a=await e(); ok(a.doc<=1,'editor: page does not scroll'); ok(a.leftMax>0,'editor: section list is longer than the viewport ('+a.leftMax+'px)');
 await pg.mouse.move(420,450); await pg.mouse.wheel(0,600); await pg.waitForTimeout(300); let c=await e();
 ok(c.left>0&&c.pvTop===a.pvTop&&c.hdr===a.hdr&&c.y===0&&c.view===0,'editor: scrolling the section list leaves header + preview in place (left='+c.left+')');
 ok(c.ifh>300,'editor: preview is visible full-height ('+c.ifh+'px)');
 await pg.mouse.move(1000,450); await pg.mouse.wheel(0,400); await pg.waitForTimeout(250); const d=await e(); ok(d.left===c.left,'editor: scrolling the preview does not move the section list');
 await pg.screenshot({path:'s_editor.png'});
 // all views: no document scroll, view scrolls
 for(const v of ['leads','students','finance','settings','media','builder','classes','reports','users']){ await pg.evaluate(h=>{location.hash=h},v); await pg.waitForTimeout(600); const z=await m(); ok(z.doc<=1&&z.top>=0,'#'+v+' no page scroll; content scrollable '+z.viewMax+'px'); }
 // modal on top of scrolled view not clipped
 await pg.evaluate(()=>{location.hash='builder'}); await pg.waitForTimeout(600); await pg.click('#bp-new'); await pg.waitForTimeout(300); const mb=await pg.evaluate(()=>{const r=document.querySelector('.ov .modal').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1}); ok(mb,'modal fully visible (not clipped)'); await pg.click('.ov [data-x]');
 // popups not clipped
 await pg.click('#uchip'); await pg.waitForTimeout(200); ok(await pg.evaluate(()=>{const r=document.querySelector('#u-pop').getBoundingClientRect();return r.height>20&&r.bottom<innerHeight}),'user menu popup visible'); await pg.keyboard.press('Escape');
 // mobile keeps normal page scroll
 await pg.setViewportSize({width:390,height:800}); await pg.evaluate(()=>{location.hash='settings'}); await pg.waitForTimeout(800);
 const mo=await pg.evaluate(()=>({scrolls:document.documentElement.scrollHeight>innerHeight,ox:document.documentElement.scrollWidth>innerWidth+1,ov:getComputedStyle(document.body).overflow}));
 ok(mo.scrolls&&!mo.ox&&mo.ov!=='hidden','mobile: normal page scroll, no horizontal overflow');
 ok(errs.length===0,'no JS errors '+errs.join('|')); console.log(`RESULT ${pass} passed, ${fail} failed`); await b.close();})();
