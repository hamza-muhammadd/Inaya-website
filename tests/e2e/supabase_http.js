// A small supabase-js look-alike that talks to a REAL PostgREST over HTTP. Used only by the end to end tests,
// because the real library cannot be downloaded in the test sandbox. It implements just what the site calls.
(function () {
  function createClient(url, anon) {
    url = url.replace(/\/+$/, "");
    var KEY = "sb-test-session", listeners = [];
    function sess() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
    function token() { var s = sess(); return s ? s.access_token : anon; }
    function emit(ev, s) { listeners.forEach(function (f) { try { f(ev, s); } catch (e) {} }); }
    function hdr(extra) { return Object.assign({ apikey: anon, Authorization: "Bearer " + token() }, extra || {}); }
    function qv(v) { return /[,()"]/.test(String(v)) ? '"' + String(v).replace(/"/g, '\\"') + '"' : String(v); }
    function QB(table) { this.t = table; this.p = []; this.m = "GET"; this.h = {}; this.cols = null; this.ord = []; this.rng = null; this.one = null; this.cnt = null; this.head = false; this.body = null; }
    var P = QB.prototype;
    P.select = function (c, o) { this.cols = c || "*"; if (this.m !== "GET") this.h.Prefer = (this.h.Prefer || "").replace(/return=\w+/, "") + ",return=representation"; if (o && o.count) this.cnt = o.count; if (o && o.head) this.head = true; return this; };
    ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike"].forEach(function (op) { P[op] = function (c, v) { this.p.push([c, op + "." + v]); return this; }; });
    P.is = function (c, v) { this.p.push([c, "is." + v]); return this; };
    P.in = function (c, a) { this.p.push([c, "in.(" + a.map(qv).join(",") + ")"]); return this; };
    P.not = function (c, op, v) { this.p.push([c, "not." + op + "." + (Array.isArray(v) ? "(" + v.join(",") + ")" : v)]); return this; };
    P.or = function (s) { this.p.push(["or", "(" + s + ")"]); return this; };
    P.order = function (c, o) { this.ord.push(c + "." + (o && o.ascending === false ? "desc" : "asc")); return this; };
    P.limit = function (n) { this.p.push(["limit", n]); return this; };
    P.range = function (a, b) { this.rng = [a, b]; return this; };
    P.single = function () { this.one = "single"; return this; };
    P.maybeSingle = function () { this.one = "maybe"; return this; };
    P.insert = function (r) { this.m = "POST"; this.body = r; this.h.Prefer = "return=minimal"; return this; };
    P.update = function (r) { this.m = "PATCH"; this.body = r; this.h.Prefer = "return=minimal"; return this; };
    P.delete = function () { this.m = "DELETE"; this.h.Prefer = "return=minimal"; return this; };
    P.upsert = function (r, o) { this.m = "POST"; this.body = r; this.h.Prefer = "resolution=merge-duplicates,return=minimal"; if (o && o.onConflict) this.p.push(["on_conflict", o.onConflict]); return this; };
    P.then = function (res, rej) { return this.run().then(res, rej); };
    P.run = async function () {
      var qs = this.p.slice(); if (this.cols) qs.push(["select", this.cols.replace(/\s+/g, "")]); if (this.ord.length) qs.push(["order", this.ord.join(",")]);
      var u = url + "/rest/v1/" + this.t + (qs.length ? "?" + qs.map(function (x) { return encodeURIComponent(x[0]) + "=" + encodeURIComponent(x[1]).replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")").replace(/%2A/g, "*"); }).join("&") : "");
      var h = hdr(Object.assign({ "Content-Type": "application/json" }, this.h));
      if (this.one === "single") h.Accept = "application/vnd.pgrst.object+json";
      if (this.cnt) h.Prefer = (h.Prefer ? h.Prefer + "," : "") + "count=" + this.cnt;
      if (this.rng) { h["Range-Unit"] = "items"; h.Range = this.rng[0] + "-" + this.rng[1]; }
      var r;
      try { r = await fetch(u, { method: this.head ? "HEAD" : this.m, headers: h, body: this.body != null ? JSON.stringify(this.body) : undefined }); } catch (e) { return { data: null, error: { message: "Failed to fetch" }, count: null }; }
      var cr = r.headers.get("content-range"), count = cr && /\/(\d+)$/.test(cr) ? Number(/\/(\d+)$/.exec(cr)[1]) : null;
      var txt = this.head ? "" : await r.text(), j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
      if (!r.ok) return { data: null, error: { message: (j && j.message) || r.statusText, code: j && j.code, details: j && j.details, hint: j && j.hint }, count: null, status: r.status };
      if (this.one === "maybe" && Array.isArray(j)) j = j[0] || null;
      return { data: this.head ? null : j, error: null, count: count, status: r.status };
    };
    async function rpc(name, args) {
      var r = await fetch(url + "/rest/v1/rpc/" + name, { method: "POST", headers: hdr({ "Content-Type": "application/json" }), body: JSON.stringify(args || {}) }), t = await r.text(), j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
      return r.ok ? { data: j, error: null } : { data: null, error: { message: (j && j.message) || r.statusText, code: j && j.code } };
    }
    var auth = {
      getSession: async function () { return { data: { session: sess() }, error: null }; },
      getUser: async function () { var s = sess(); return { data: { user: s ? s.user : null }, error: null }; },
      onAuthStateChange: function (cb) { listeners.push(cb); return { data: { subscription: { unsubscribe: function () { listeners = listeners.filter(function (f) { return f !== cb; }); } } } }; },
      signInWithPassword: async function (c) {
        var r = await fetch(url + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify(c) }), j = await r.json();
        if (!r.ok) return { data: null, error: { message: j.error_description || j.msg || "Invalid login credentials" } };
        localStorage.setItem(KEY, JSON.stringify(j)); emit("SIGNED_IN", j); return { data: { session: j, user: j.user }, error: null };
      },
      signOut: async function () { localStorage.removeItem(KEY); emit("SIGNED_OUT", null); return { error: null }; },
      updateUser: async function (a) { var r = await fetch(url + "/auth/v1/user", { method: "PUT", headers: hdr({ "Content-Type": "application/json" }), body: JSON.stringify(a) }); return r.ok ? { data: {}, error: null } : { data: null, error: { message: "Could not update" } }; },
      resetPasswordForEmail: async function (e) { window.__resetFor = e; return { data: {}, error: null }; },
      setSession: async function () { return { data: {}, error: null }; }
    };
    var storage = { from: function (b) { return {
      upload: async function (path, blob, o) { var r = await fetch(url + "/storage/v1/object/" + b + "/" + path, { method: "POST", headers: hdr({ "Content-Type": (o && o.contentType) || "application/octet-stream" }), body: blob }); return r.ok ? { data: { path: path }, error: null } : { data: null, error: { message: (await r.json().catch(function () { return {}; })).message || "Upload failed" } }; },
      createSignedUrl: async function (path) { var r = await fetch(url + "/storage/v1/object/sign/" + b + "/" + path, { method: "POST", headers: hdr({ "Content-Type": "application/json" }), body: "{}" }); var j = await r.json(); return r.ok ? { data: { signedUrl: url + j.signedURL }, error: null } : { data: null, error: { message: j.message || "failed" } }; },
      getPublicUrl: function (path) { return { data: { publicUrl: url + "/storage/v1/object/public/" + b + "/" + path } }; },
      remove: async function () { return { data: [], error: null }; } }; } };
    return { from: function (t) { return new QB(t); }, rpc: rpc, auth: auth, storage: storage };
  }
  window.supabase = { createClient: createClient };
})();
