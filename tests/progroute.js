const { chromium } = require('/opt/npm-tools/node_modules/playwright'); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log(c?'  PASS':'  FAIL',m)};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const ctx=await b.newContext();
await ctx.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.INAYA_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"anon"};'}));
await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
const P=[{slug:'quran-reading-fluency',title:'Quran Reading & Fluency',short_description:'s',description:'d',objectives:[],sort_order:1,program_levels:[{level_number:1,title:'Reading Foundations',sort_order:1}]}];
await ctx.route(/x\.supabase\.co\/rest\/v1\/programs/,r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(P)}));
await ctx.route(/x\.supabase\.co\/rest\/v1\/(?!programs)/,r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}));
for (const base of ['http://localhost:4175','http://localhost:4174']) {
  const pg=await ctx.newPage();
  await pg.goto(base+'/programs/quran-reading-fluency'); await pg.waitForTimeout(1800);
  ok(/Quran Reading & Fluency/.test(await pg.innerText('h1')),base+' program page shows its details');
  ok(new URL(pg.url()).pathname==='/programs/quran-reading-fluency','address bar shows /programs/quran-reading-fluency');
  await pg.goto(base+'/faq'); await pg.waitForTimeout(1500); ok(/Frequently asked/.test(await pg.innerText('h1')),base+' /faq works');
  await pg.goto(base+'/programs/does-not-exist'); await pg.waitForTimeout(1500); ok(/Program not found/.test(await pg.innerText('h1')),'unknown program says so clearly');
  await pg.goto(base+'/'); await pg.waitForTimeout(1200); await pg.hover('.nav-item.has-sub'); await pg.click('.sub-menu a'); await pg.waitForTimeout(1800);
  ok(/Quran Reading & Fluency/.test(await pg.innerText('h1')),'clicking a program in the menu opens it');
}
await b.close(); console.log(`RESULT ${pass} passed, ${fail} failed`)})();
