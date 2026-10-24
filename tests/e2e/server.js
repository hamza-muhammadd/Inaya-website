// End to end test server: serves the site, forwards /rest/v1 to a real PostgREST, and plays the parts of Supabase Auth,
// Storage and the student-account Edge Function. Test sandbox only. Usage: node server.js  (port 4180)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '../..'), PORT = 4180, PG = 3555, SECRET = 'test-secret-test-secret-test-secret-12';
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
const b64 = b => Buffer.from(b).toString('base64url');
const sign = (claims) => { const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64(JSON.stringify(claims)); return h + '.' + p + '.' + crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url'); };
const verify = (t) => { const [h, p, s] = String(t || '').split('.'); if (!s || crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url') !== s) return null; const c = JSON.parse(Buffer.from(p, 'base64url')); return c.exp < Date.now() / 1000 ? null : c; };
const ANON = sign({ role: 'anon', exp: 4102444800 }), SERVICE = sign({ role: 'service_role', exp: 4102444800 });
const PW = 'Test-pass-12345';
const users = new Map([['owner@e2e.test', { id: 'aaaaaaaa-0000-4000-8000-000000000001', pw: PW }], ['teacher@e2e.test', { id: 'aaaaaaaa-0000-4000-8000-000000000002', pw: PW }], ['readonly@e2e.test', { id: 'aaaaaaaa-0000-4000-8000-000000000003', pw: PW }]]);
const psql = (sql) => execFileSync('psql', ['-U', 'postgres', '-h', '/tmp/pgdata', '-p', '5544', '-d', 'inaya_test', '-tA', '-c', sql], { encoding: 'utf8' });
const files = new Map(); const log = [];
const byId = id => { for (const [e, u] of users) if (u.id === id) return { email: e, ...u }; return null; };
const session = (email) => { const u = users.get(email), now = Math.floor(Date.now() / 1000); return { access_token: sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email, exp: now + 3600 }), refresh_token: 'r-' + u.id, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id: u.id, email, aud: 'authenticated', role: 'authenticated' } }; };
const body = (req) => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const J = (res, s, o) => { res.writeHead(s, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(o)); };
let fnCore; import('../../supabase/functions/student-account/core.js').then(m => fnCore = m);

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); return res.end(); }
  if (p === '/config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(`window.INAYA_CONFIG={SUPABASE_URL:"http://localhost:${PORT}",SUPABASE_ANON_KEY:"${ANON}"};`); }
  if (p === '/__log') return J(res, 200, log);
  if (p.startsWith('/rest/v1/')) {
    const buf = await body(req), headers = { ...req.headers, host: 'localhost:' + PG }; delete headers['content-length']; if (buf.length) headers['content-length'] = buf.length;
    const pr = http.request({ host: 'localhost', port: PG, path: req.url.replace('/rest/v1', ''), method: req.method, headers }, r => { const h = { ...r.headers, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }; res.writeHead(r.statusCode, h); r.pipe(res); });
    pr.on('error', e => J(res, 502, { message: String(e) })); return pr.end(buf);
  }
  if (p === '/auth/v1/token') {
    const b = JSON.parse((await body(req)).toString() || '{}'), u = users.get(String(b.email || '').toLowerCase());
    if (url.searchParams.get('grant_type') === 'password') { if (!u || u.pw !== b.password || u.banned) return J(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }); return J(res, 200, session(String(b.email).toLowerCase())); }
    return J(res, 400, { error: 'unsupported' });
  }
  if (p === '/auth/v1/user') {
    const c = verify((req.headers.authorization || '').replace('Bearer ', '')); const u = c && byId(c.sub);
    if (!u) return J(res, 401, { msg: 'invalid token' });
    if (req.method === 'PUT') { const b = JSON.parse((await body(req)).toString() || '{}'); if (b.password) users.get(u.email).pw = b.password; }
    return J(res, 200, { id: u.id, email: u.email });
  }
  if (p === '/auth/v1/admin/users' && req.method === 'POST') {
    const b = JSON.parse((await body(req)).toString()), e = String(b.email).toLowerCase();
    if (users.has(e)) return J(res, 422, { msg: 'A user with this email address has already been registered' });
    const id = crypto.randomUUID(); psql(`insert into auth.users(id,email) values ('${id}','${e.replace(/'/g, '')}')`); users.set(e, { id, pw: b.password || crypto.randomBytes(9).toString('hex') });
    return J(res, 200, { id, email: e });
  }
  let m = /^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/.exec(p);
  if (m) { const u = byId(m[1]); if (!u) return J(res, 404, {}); if (req.method === 'DELETE') { users.delete(u.email); psql(`delete from auth.users where id='${u.id}'`); return J(res, 200, {}); } if (req.method === 'PUT') { const b = JSON.parse((await body(req)).toString() || '{}'); users.get(u.email).banned = !!b.ban_duration && b.ban_duration !== 'none'; return J(res, 200, {}); } return J(res, 200, { id: u.id, email: u.email }); }
  if (p === '/auth/v1/admin/generate_link') { const b = JSON.parse((await body(req)).toString()); log.push({ link_for: b.email }); return J(res, 200, { action_link: `http://localhost:${PORT}/learn#access_token=fake&type=recovery&for=${encodeURIComponent(b.email)}` }); }
  if (p === '/functions/v1/student-account') {
    const buf = await body(req), r = await fnCore.handle(new Request('http://f' + p, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : buf }), { SUPABASE_URL: `http://localhost:${PORT}`, SUPABASE_SERVICE_ROLE_KEY: SERVICE, SITE_URL: `http://localhost:${PORT}` }, fetch);
    res.writeHead(r.status, Object.fromEntries([...r.headers.entries(), ['access-control-allow-origin', '*']])); return res.end(await r.text());
  }
  m = /^\/storage\/v1\/object\/(sign\/)?(submissions)\/(.+)$/.exec(p);
  if (m) {
    const key = m[2] + '/' + decodeURIComponent(m[3]);
    if (m[1] && req.method === 'POST') return J(res, 200, { signedURL: `/storage/v1/object/sign/${key}?token=t` });
    if (req.method === 'POST') { const c = verify((req.headers.authorization || '').replace('Bearer ', '')); const sid = psql(`select id from public.students where user_id='${c ? c.sub : '00000000-0000-0000-0000-000000000000'}'`).trim(); const folder = key.split('/')[1]; if (!sid || sid !== folder) return J(res, 403, { message: 'new row violates row-level security policy' }); files.set(key, { buf: await body(req), type: req.headers['content-type'] }); return J(res, 200, { Key: key }); }
    if (req.method === 'GET' && files.has(key)) { res.writeHead(200, { 'content-type': files.get(key).type, 'access-control-allow-origin': '*' }); return res.end(files.get(key).buf); }
    return J(res, 404, { message: 'not found' });
  }
  let u = decodeURIComponent(p);
  if (/^\/programs\/[^/]+$/.test(u)) u = '/program.html'; else if (u === '/') u = '/index.html';
  else if (!path.extname(u)) { if (fs.existsSync(path.join(ROOT, u + '.html'))) u += '.html'; else if (/^\/[a-z0-9-]+$/.test(u)) u = '/page.html'; }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('not found'); }
  res.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('e2e server on ' + PORT));
