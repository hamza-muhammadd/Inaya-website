// Edge Function logic: staff create a sign-in for a student, or make a fresh password link.
// Pure JS with injected fetch so it can be tested without Supabase. The browser never sees the service key.
const ROLES = ["owner", "administrator", "assessor"];   // same people who can write student records (can_write)
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
function json(status, body) { return new Response(JSON.stringify(body), { status: status, headers: Object.assign({ "content-type": "application/json" }, CORS) }); }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handle(req, env, fetchFn) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  var base = String(env.SUPABASE_URL || "").replace(/\/+$/, ""), svc = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !svc) return json(500, { error: "The function is missing its Supabase settings." });
  var auth = req.headers.get("authorization") || "", token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in first." });
  var H = { apikey: svc, authorization: "Bearer " + svc, "content-type": "application/json" };
  async function call(path, opts) { var r = await fetchFn(base + path, opts); var t = await r.text(); var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {} return { ok: r.ok, status: r.status, body: j }; }

  // who is calling, and are they allowed
  var u = await call("/auth/v1/user", { headers: { apikey: svc, authorization: "Bearer " + token } });
  if (!u.ok || !u.body || !u.body.id) return json(401, { error: "Your session has expired. Sign in again." });
  var a = await call("/rest/v1/admin_users?select=role&user_id=eq." + encodeURIComponent(u.body.id), { headers: H });
  var role = a.ok && Array.isArray(a.body) && a.body[0] ? a.body[0].role : null;
  if (ROLES.indexOf(role) < 0) return json(403, { error: "Only owners, administrators and assessors can create student sign-ins." });

  var b; try { b = await req.json(); } catch (e) { return json(400, { error: "Send JSON." }); }
  var action = b.action || "create", sid = String(b.student_id || "");
  if (!UUID.test(sid)) return json(400, { error: "Missing student." });
  var s = await call("/rest/v1/students?select=id,full_name,user_id,deleted_at&id=eq." + sid, { headers: H });
  var stu = s.ok && Array.isArray(s.body) ? s.body[0] : null;
  if (!stu || stu.deleted_at) return json(404, { error: "Student not found." });
  var redirect = String(env.SITE_URL || "").replace(/\/+$/, "");
  var out = {};

  if (action === "create") {
    if (stu.user_id) return json(409, { error: "This student already has a sign-in." });
    var email = String(b.email || "").trim().toLowerCase();
    if (!EMAIL.test(email)) return json(400, { error: "Enter a valid email address." });
    var pw = b.password ? String(b.password) : "";
    if (pw && pw.length < 10) return json(400, { error: "A password needs at least 10 characters." });
    // the email must not belong to a staff member
    var cr = await call("/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify(Object.assign({ email: email, email_confirm: true, user_metadata: { student_id: sid, full_name: stu.full_name, kind: "student" } }, pw ? { password: pw } : {})) });
    if (!cr.ok || !cr.body || !cr.body.id) {
      var m = (cr.body && (cr.body.msg || cr.body.message || cr.body.error_description)) || "Could not create the account.";
      return json(/already|registered|exists/i.test(m) ? 409 : 400, { error: /already|registered|exists/i.test(m) ? "That email already has an account." : m });
    }
    var adm = await call("/rest/v1/admin_users?select=user_id&user_id=eq." + cr.body.id, { headers: H });
    if (adm.ok && Array.isArray(adm.body) && adm.body.length) return json(409, { error: "That email belongs to a staff account." });
    var lk = await call("/rest/v1/students?id=eq." + sid + "&user_id=is.null", { method: "PATCH", headers: Object.assign({ prefer: "return=representation" }, H), body: JSON.stringify({ user_id: cr.body.id }) });
    if (!lk.ok || !Array.isArray(lk.body) || !lk.body.length) { await call("/auth/v1/admin/users/" + cr.body.id, { method: "DELETE", headers: H }); return json(409, { error: "Could not link the account. Nothing was created." }); }
    out = { ok: true, email: email, created: true };
    if (!pw) { var gl = await call("/auth/v1/admin/generate_link", { method: "POST", headers: H, body: JSON.stringify({ type: "recovery", email: email, redirect_to: redirect ? redirect + "/learn" : undefined }) }); if (gl.ok && gl.body && gl.body.action_link) out.setup_link = gl.body.action_link; }
    return json(200, out);
  }
  if (action === "reset_link") {
    if (!stu.user_id) return json(400, { error: "This student has no sign-in yet." });
    var em = await call("/auth/v1/admin/users/" + stu.user_id, { headers: H });
    if (!em.ok || !em.body || !em.body.email) return json(404, { error: "The account was not found." });
    var g2 = await call("/auth/v1/admin/generate_link", { method: "POST", headers: H, body: JSON.stringify({ type: "recovery", email: em.body.email, redirect_to: redirect ? redirect + "/learn" : undefined }) });
    if (!g2.ok || !g2.body || !g2.body.action_link) return json(400, { error: "Could not make a link." });
    return json(200, { ok: true, email: em.body.email, setup_link: g2.body.action_link });
  }
  if (action === "disable" || action === "enable") {
    if (!stu.user_id) return json(400, { error: "This student has no sign-in yet." });
    var d = await call("/auth/v1/admin/users/" + stu.user_id, { method: "PUT", headers: H, body: JSON.stringify({ ban_duration: action === "disable" ? "876000h" : "none" }) });
    return d.ok ? json(200, { ok: true }) : json(400, { error: "Could not change the account." });
  }
  return json(400, { error: "Unknown action." });
}
