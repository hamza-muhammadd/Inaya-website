// Static host WITHOUT the vercel.json rewrites: models a deployment where the rewrite rules were not applied.
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
http.createServer((req,res)=>{
  let u=decodeURIComponent(req.url.split('?')[0]);
  if(u==='/') u='/index.html'; else if(!path.extname(u)&&fs.existsSync(path.join(ROOT,u+'.html'))) u+='.html';
  const f=path.join(ROOT,u);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404,{'Content-Type':'text/html'});return res.end(fs.readFileSync(path.join(ROOT,'404.html')));}
  res.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
}).listen(4175,()=>console.log('up'));
