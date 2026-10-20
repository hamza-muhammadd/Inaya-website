// Tiny local stand-in for Vercel: cleanUrls + /programs/:slug rewrite
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/inaya-quran-academy';
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.xml':'application/xml','.txt':'text/plain'};
http.createServer((req,res)=>{
  let u=decodeURIComponent(req.url.split('?')[0]);
  if(/^\/programs\/[^/]+$/.test(u)) u='/program.html';
  else if(u==='/') u='/index.html';
  else if(!path.extname(u)){ if(fs.existsSync(path.join(ROOT,u+'.html'))) u+='.html'; else if(/^\/[a-z0-9-]+$/.test(u)) u='/page.html'; }
  const f=path.join(ROOT,u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)){res.writeHead(404,{'Content-Type':'text/html'});return res.end(fs.readFileSync(path.join(ROOT,'404.html')));}
  res.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
}).listen(4173,()=>console.log('up'));
