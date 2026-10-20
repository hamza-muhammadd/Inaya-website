// Faithful local emulation of vercel.json: redirects, then filesystem (cleanUrls), then rewrites
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/inaya-quran-academy', V=JSON.parse(fs.readFileSync(ROOT+'/vercel.json','utf8'));
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.xml':'application/xml','.txt':'text/plain'};
const toRe=s=>new RegExp('^'+s.replace(/:(\w+)\(([^)]*)\)/g,'(?<$1>$2)').replace(/:(\w+)/g,'(?<$1>[^/]+)')+'$');
http.createServer((req,res)=>{
  let u=decodeURIComponent(req.url.split('?')[0]);
  for(const r of V.redirects||[]){ if(toRe(r.source).test(u)){res.writeHead(r.permanent?308:307,{Location:r.destination});return res.end();} }
  let f=null;
  const cands=[u==='/'?'/index.html':u, u+'.html'];            // cleanUrls: /about -> about.html ; /about.html redirects to /about
  if(/\.html$/.test(u)&&u!=='/index.html'&&fs.existsSync(path.join(ROOT,u))){res.writeHead(308,{Location:u.replace(/\.html$/,'')});return res.end();}
  if(u==='/index.html'){res.writeHead(308,{Location:'/'});return res.end();}
  for(const c of cands){const p=path.join(ROOT,c); if(p.startsWith(ROOT)&&fs.existsSync(p)&&fs.statSync(p).isFile()){f=p;break;}}
  if(!f) for(const r of V.rewrites||[]){const m=toRe(r.source).exec(u); if(m){f=path.join(ROOT,r.destination);break;}}
  if(!f){res.writeHead(404,{'Content-Type':'text/html'});return res.end(fs.readFileSync(path.join(ROOT,'404.html')));}
  res.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
}).listen(4174,()=>console.log('up'));
