import { handle } from "../supabase/functions/student-account/core.js";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const SID = "11111111-1111-4111-8111-111111111111", env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc", SITE_URL: "https://site.test" };
function world(o) {
  const st = { created: [], patched: [], deleted: [], links: 0, users: { "tok-admin": { id: "A1" }, "tok-teacher": { id: "T1" } }, role: { A1: "administrator", T1: "teacher" }, student: { id: SID, full_name: "Aisha K", user_id: o && o.linked ? "U0" : null, deleted_at: null }, exists: o && o.exists, staffEmail: o && o.staffEmail, linkFail: o && o.linkFail };
  const f = async (url, opts = {}) => {
    const u = new URL(url), p = u.pathname + u.search, R = (s, b) => new Response(b == null ? "" : JSON.stringify(b), { status: s });
    if (p === "/auth/v1/user") { const t = (opts.headers.authorization || "").replace("Bearer ", ""); return st.users[t] ? R(200, st.users[t]) : R(401, { msg: "bad" }); }
    if (p.startsWith("/rest/v1/admin_users")) { const id = u.searchParams.get("user_id").replace("eq.", ""); if (id === "NEW" && st.staffEmail) return R(200, [{ user_id: "NEW" }]); return R(200, st.role[id] ? [{ role: st.role[id], user_id: id }] : []); }
    if (p.startsWith("/rest/v1/students") && (!opts.method || opts.method === "GET")) return R(200, [st.student]);
    if (p.startsWith("/rest/v1/students") && opts.method === "PATCH") { if (st.linkFail) return R(200, []); st.patched.push(JSON.parse(opts.body)); return R(200, [{ id: SID }]); }
    if (p === "/auth/v1/admin/users" && opts.method === "POST") { if (st.exists) return R(422, { msg: "A user with this email address has already been registered" }); st.created.push(JSON.parse(opts.body)); return R(200, { id: "NEW", email: JSON.parse(opts.body).email }); }
    if (p === "/auth/v1/admin/generate_link") { st.links++; return R(200, { action_link: "https://x.supabase.co/verify?token=abc" }); }
    if (p.startsWith("/auth/v1/admin/users/") && opts.method === "DELETE") { st.deleted.push(p); return R(200, {}); }
    if (p.startsWith("/auth/v1/admin/users/") && opts.method === "PUT") return R(200, {});
    if (p.startsWith("/auth/v1/admin/users/")) return R(200, { id: "U0", email: "a@b.co" });
    return R(404, {});
  };
  return { st, f };
}
const req = (tok, body, method = "POST") => new Request("https://f/x", { method, headers: tok ? { authorization: "Bearer " + tok } : {}, body: method === "POST" ? JSON.stringify(body) : undefined });
let w = world(); let r = await handle(req(null, {}), env, w.f); ok(r.status === 401, "no token");
r = await handle(req("tok-bad", { student_id: SID }), env, w.f); ok(r.status === 401, "bad token");
r = await handle(req("tok-teacher", { student_id: SID, email: "a@b.co" }), env, w.f); ok(r.status === 403, "teacher blocked");
r = await handle(req("tok-admin", { student_id: "nope", email: "a@b.co" }), env, w.f); ok(r.status === 400, "bad student id");
r = await handle(req("tok-admin", { student_id: SID, email: "not-an-email" }), env, w.f); ok(r.status === 400, "bad email");
r = await handle(req("tok-admin", { student_id: SID, email: "a@b.co", password: "short" }), env, w.f); ok(r.status === 400 && !w.st.created.length, "short password");
r = await handle(req("tok-admin", { student_id: SID, email: " A@B.co ", password: "longenough123" }), env, w.f); let j = await r.json();
ok(r.status === 200 && j.ok && !j.setup_link && w.st.created[0].email === "a@b.co" && w.st.created[0].password === "longenough123" && w.st.patched[0].user_id === "NEW", "create with password and link");
ok(w.st.created[0].user_metadata.kind === "student", "metadata");
w = world(); r = await handle(req("tok-admin", { student_id: SID, email: "a@b.co" }), env, w.f); j = await r.json(); ok(r.status === 200 && j.setup_link && !w.st.created[0].password, "create with setup link");
w = world({ linked: true }); r = await handle(req("tok-admin", { student_id: SID, email: "a@b.co" }), env, w.f); ok(r.status === 409, "already linked");
w = world({ exists: true }); r = await handle(req("tok-admin", { student_id: SID, email: "a@b.co" }), env, w.f); j = await r.json(); ok(r.status === 409 && /already has an account/.test(j.error), "email taken");
w = world({ linkFail: true }); r = await handle(req("tok-admin", { student_id: SID, email: "a@b.co" }), env, w.f); ok(r.status === 409 && w.st.deleted.length === 1, "link failure rolls back the new account");
w = world({ staffEmail: true }); r = await handle(req("tok-admin", { student_id: SID, email: "a@b.co" }), env, w.f); ok(r.status === 409 && !w.st.patched.length, "staff email refused");
w = world({ linked: true }); r = await handle(req("tok-admin", { action: "reset_link", student_id: SID }), env, w.f); j = await r.json(); ok(r.status === 200 && j.setup_link, "reset link");
w = world(); r = await handle(req("tok-admin", { action: "reset_link", student_id: SID }), env, w.f); ok(r.status === 400, "reset without account");
w = world({ linked: true }); r = await handle(req("tok-admin", { action: "disable", student_id: SID }), env, w.f); ok(r.status === 200, "disable");
r = await handle(req("tok-admin", { action: "wat", student_id: SID }), env, w.f); ok(r.status === 400, "unknown action");
r = await handle(new Request("https://f/x", { method: "GET" }), env, w.f); ok(r.status === 405, "get refused");
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
