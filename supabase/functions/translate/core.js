// Translation engine used by the Supabase Edge Function "translate".
// Plain JavaScript with injected dependencies (env, fetch), so it can be tested in Node without Supabase.
//
// Rules this file enforces:
//  - only text that really exists on the site (database content or built-in interface text) can be translated,
//    so the function cannot be used as a free general translator;
//  - translations are stored under a hash of the exact English text, so a changed English text never reuses an old translation;
//  - administrator overrides are never overwritten by machine output;
//  - Arabic script (Quran verses, names) and a religious glossary are protected before the text reaches the provider;
//  - provider errors never touch the English source, they only leave a "failed" note that can be retried.

import { UI_STRINGS } from "./ui_strings.js";

export const LANGS = {
  bn: "Bengali", ar: "Arabic", ur: "Urdu", hi: "Hindi", tr: "Turkish", id: "Indonesian", ms: "Malay", fr: "French", es: "Spanish",
  de: "German", ru: "Russian", pt: "Portuguese", it: "Italian", nl: "Dutch", fa: "Persian", so: "Somali", sw: "Swahili", ta: "Tamil",
  ne: "Nepali", "zh-CN": "Chinese (Simplified)", ja: "Japanese", ko: "Korean", th: "Thai", vi: "Vietnamese", he: "Hebrew", ps: "Pashto"
};
const ALWAYS = ["bn", "ar"];

/* ---------- hashing and normalising (identical copy lives in js/i18n.js) ---------- */
export function norm(s) { return String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim(); }
function cyrb53(str, seed) {
  var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (var i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
export function hashText(s) { var n = norm(s); return cyrb53(n, 0).toString(16).padStart(14, "0") + cyrb53(n, 7).toString(16).padStart(14, "0"); }

/* ---------- protection of Arabic script and religious terms ---------- */
const AR = "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF";
const ARABIC_RE = new RegExp("[" + AR + "]+(?:[\\s\\u200c\\u200d]+[" + AR + "]+)*", "g");
export const GLOSSARY = [
  ["Inaya Quran Academy", { bn: "ইনায়া কুরআন একাডেমি", ar: "أكاديمية عناية للقرآن" }],
  ["JazakAllahu khairan", { bn: "জাযাকাল্লাহু খাইরান", ar: "جزاك الله خيرًا" }],
  ["Assalamu Alaikum", { bn: "আসসালামু আলাইকুম", ar: "السلام عليكم" }],
  ["InshaAllah", { bn: "ইনশাআল্লাহ", ar: "إن شاء الله" }],
  ["Quran", { bn: "কুরআন", ar: "القرآن" }], ["Qur'an", { bn: "কুরআন", ar: "القرآن" }],
  ["Tajweed", { bn: "তাজবিদ", ar: "التجويد" }], ["Sunnah", { bn: "সুন্নাহ", ar: "السنة" }],
  ["Hadith", { bn: "হাদিস", ar: "الحديث" }], ["Surah", { bn: "সূরা", ar: "سورة" }], ["Ayah", { bn: "আয়াত", ar: "آية" }],
  ["Salah", { bn: "সালাত", ar: "الصلاة" }], ["Wudu", { bn: "ওযু", ar: "الوضوء" }], ["Dua", { bn: "দোয়া", ar: "الدعاء" }],
  ["WhatsApp", { bn: "হোয়াটসঅ্যাপ", ar: "واتساب" }]
];
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
const GLOSS_RE = new RegExp("(?<![\\p{L}\\p{N}])(" + GLOSSARY.map(function (g) { return esc(g[0]); }).sort(function (a, b) { return b.length - a.length; }).join("|") + ")(?![\\p{L}\\p{N}])", "giu");
export function protect(text, lang) {
  var keep = [];
  function tok(v) { keep.push(v); return "⟦" + (keep.length - 1) + "⟧"; }
  var t = text.replace(ARABIC_RE, function (m) { return tok(m); });
  t = t.replace(GLOSS_RE, function (m) {
    var g = GLOSSARY.filter(function (x) { return x[0].toLowerCase() === m.toLowerCase(); })[0];
    return tok(g && g[1][lang] ? g[1][lang] : m);
  });
  return { text: t, keep: keep };
}
export function restore(text, keep) {
  var ok = true;
  var out = text.replace(/⟦\s*(\d+)\s*⟧/g, function (m, n) { if (keep[+n] === undefined) { ok = false; return ""; } return keep[+n]; });
  for (var i = 0; i < keep.length; i++) if (text.indexOf("⟦" + i + "⟧") < 0 && !new RegExp("\\u27E6\\s*" + i + "\\s*\\u27E7").test(text)) ok = false;
  return ok ? out : null;
}

/* ---------- output safety ---------- */
const TAGS = /<\/?(em|strong|b|i)>/gi;
export function cleanOut(src, out) {
  if (typeof out !== "string") return null;
  var o = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!o) return null;
  var allowTags = /<\/?(em|strong|b|i)>/i.test(src);
  o = allowTags ? o.replace(/<(?!\/?(?:em|strong|b|i)>)[^>]*>/gi, "") : o.replace(/<[^>]*>/g, "");
  if (allowTags) { var a = (src.match(TAGS) || []).length, b = (o.match(TAGS) || []).length; if (a !== b) return null; }
  var r = o.length / Math.max(1, src.length);
  if (r > 8 || r < 0.12) return null;
  return o;
}

/* ---------- content that is allowed to be translated ---------- */
function looseStrip(s) {
  return norm(String(s).replace(/<[^>]*>/g, "").replace(/\[\[|\]\]/g, "").replace(/\*\*|\*/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"));
}
function leaves(v, out) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach(function (x) { leaves(x, out); });
  else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { if (k !== "i18n") leaves(v[k], out); });
  return out;
}
const SKIP_LEAF = /^(\/|#|https?:|mailto:|tel:|\{|data:)|^[a-z0-9_.\-]+$|^[#0-9a-f]{3,8}$|^\d+(\.\d+)?$|^[0-9a-f]{8}-[0-9a-f]{4}-/;
export function unitsOf(str) {
  var res = [];
  String(str).split(/\n+/).forEach(function (line) {
    var l = line.replace(/^(#{1,6}\s+|[-*]\s+)/, "").trim();
    l = l.replace(/\[\[([^\]]+)\]\]/g, "<em>$1</em>").replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>").replace(/\*\*/g, "");
    if (l.length < 2 || /\]\(/.test(l) || SKIP_LEAF.test(l) || !/\p{L}{2}/u.test(l)) return;
    res.push(norm(l));
  });
  return res;
}
let corpusCache = { t: 0, text: "", units: [] };
async function loadCorpus(env, db, maxAge) {
  if (Date.now() - corpusCache.t < (maxAge == null ? 60000 : maxAge)) return corpusCache;
  var rows = [], t = ["programs?select=*", "program_levels?select=*", "faqs?select=*", "public_pages?select=title,seo_title,seo_description,sections", "site_settings?select=data"];
  for (var i = 0; i < t.length; i++) { var r = await db.get(t[i]); if (Array.isArray(r)) rows.push(r); }
  var all = leaves(rows, []).concat(UI_STRINGS), seen = {}, units = [];
  all.forEach(function (s) { unitsOf(s).forEach(function (u) { if (!seen[u]) { seen[u] = 1; units.push(u); } }); });
  corpusCache = { t: Date.now(), text: "\u0001" + all.map(looseStrip).join("\u0001") + "\u0001", units: units, ui: new Set(UI_STRINGS.map(function (s) { return looseStrip(s); })) };
  return corpusCache;
}
export function resetCorpusCache() { corpusCache = { t: 0, text: "", units: [] }; }
function allowedText(c, text) {
  var l = looseStrip(text);
  if (l.length < 2 || l.length > 1500) return false;
  if (/^(Level|Program) \d+$/.test(l)) return true;
  return c.text.indexOf(l) > -1;
}

/* ---------- providers ---------- */
async function withTimeout(fetchFn, url, opts, ms) {
  var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, ms);
  try { return await fetchFn(url, Object.assign({}, opts, { signal: ctl.signal })); } finally { clearTimeout(t); }
}
function sysPrompt(lang) {
  var name = LANGS[lang] || lang;
  return "You translate website text for an online Quran academy from English into " + name + ". Rules: keep the meaning exact and the tone warm, plain and respectful, like a careful human translator. " +
    "Never translate or change tokens like ⟦0⟧ and copy them unchanged into the output. Keep <em>, </em>, <strong>, </strong> tags in the same places. Do not add explanations, quotes, notes or Quranic verses. " +
    "Do not invent religious rulings or interpretations. Use established religious vocabulary used by Muslims who speak " + name + ". Return ONLY a JSON array of strings with exactly the same number of items in the same order.";
}
function parseArr(txt, n) {
  var a = txt.indexOf("["), b = txt.lastIndexOf("]");
  var arr = JSON.parse(txt.slice(a, b + 1));
  if (!Array.isArray(arr) || arr.length !== n) throw new Error("provider returned an unexpected shape");
  return arr;
}
async function viaGemini(env, fetchFn, lang, items) {
  var model = env.GEMINI_MODEL || "gemini-2.5-flash";
  var res = await withTimeout(fetchFn, "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sysPrompt(lang) }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(items.map(function (i) { return i.text; })) }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } })
  }, 25000);
  if (!res.ok) { var e = new Error("provider " + res.status); e.status = res.status; throw e; }
  var j = await res.json(), c = (j.candidates || [])[0], parts = (c && c.content && c.content.parts) || [];
  return parseArr(parts.map(function (x) { return x.text || ""; }).join(""), items.length);
}
async function viaAnthropic(env, fetchFn, lang, items) {
  var system = sysPrompt(lang);
  var res = await withTimeout(fetchFn, "https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: env.ANTHROPIC_MODEL || "claude-haiku-5-5", max_tokens: 4096, temperature: 0, system: system, messages: [{ role: "user", content: JSON.stringify(items.map(function (i) { return i.text; })) }] })
  }, 25000);
  if (!res.ok) { var e = new Error("provider " + res.status); e.status = res.status; throw e; }
  var j = await res.json(), txt = (j.content || []).map(function (c) { return c.text || ""; }).join("");
  return parseArr(txt, items.length);
}
async function viaGoogle(env, fetchFn, lang, items) {
  var res = await withTimeout(fetchFn, "https://translation.googleapis.com/language/translate/v2?key=" + encodeURIComponent(env.GOOGLE_TRANSLATE_API_KEY), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: items.map(function (i) { return i.text.replace(/⟦(\d+)⟧/g, '<span translate="no">⟦$1⟧</span>'); }), source: "en", target: lang, format: "html" })
  }, 25000);
  if (!res.ok) { var e = new Error("provider " + res.status); e.status = res.status; throw e; }
  var j = await res.json(), tr = (j.data && j.data.translations) || [];
  if (tr.length !== items.length) throw new Error("provider returned an unexpected shape");
  return tr.map(function (x) {
    return String(x.translatedText).replace(/<span[^>]*translate="no"[^>]*>(.*?)<\/span>/g, "$1").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  });
}
export function providerName(env) { return (env.TRANSLATE_PROVIDER || (env.ANTHROPIC_API_KEY ? "anthropic" : env.GEMINI_API_KEY ? "gemini" : env.GOOGLE_TRANSLATE_API_KEY ? "google" : "")).toLowerCase(); }
async function callProvider(env, fetchFn, lang, items) {
  var p = providerName(env);
  var run = p === "google" ? viaGoogle : p === "anthropic" ? viaAnthropic : p === "gemini" ? viaGemini : null;
  if (!run) { var e = new Error("no provider configured"); e.status = 0; e.config = true; throw e; }
  var tries = 0;
  for (;;) {
    try { return await run(env, fetchFn, lang, items); }
    catch (err) {
      tries++;
      var retry = (err.status === 429 || err.status >= 500 || err.name === "AbortError") && tries < 2;
      if (!retry) throw err;
      await new Promise(function (r) { setTimeout(r, 400); });
    }
  }
}

/* ---------- database access through PostgREST ---------- */
function makeDb(env, fetchFn) {
  var base = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/", key = env.SUPABASE_SERVICE_ROLE_KEY;
  var H = { apikey: key, Authorization: "Bearer " + key, "content-type": "application/json" };
  return {
    async get(path) { var r = await fetchFn(base + path, { headers: H }); if (!r.ok) return null; return r.json(); },
    async upsert(table, rows, conflict, ignore) {
      if (!rows.length) return true;
      var r = await fetchFn(base + table + "?on_conflict=" + conflict, { method: "POST", headers: Object.assign({}, H, { Prefer: "resolution=" + (ignore ? "ignore" : "merge") + "-duplicates,return=minimal" }), body: JSON.stringify(rows) });
      return r.ok;
    },
    async del(path) { var r = await fetchFn(base + path, { method: "DELETE", headers: Object.assign({}, H, { Prefer: "return=minimal" }) }); return r.ok; }
  };
}
async function rpcBool(env, fetchFn, name, authHeader) {
  if (!authHeader) return false;
  try {
    var r = await fetchFn(env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: authHeader, "content-type": "application/json" }, body: "{}" });
    return r.ok && (await r.json()) === true;
  } catch (e) { return false; }
}

/* ---------- translation of a batch ---------- */
const inflight = new Map();
const buckets = new Map();
function rateOk(ip, cost) {
  var now = Date.now(), b = buckets.get(ip) || { t: now, n: 0 };
  if (now - b.t > 60000) { b.t = now; b.n = 0; }
  b.n += cost; buckets.set(ip, b);
  return b.n <= 400;
}
const LIVE_IN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
function chunk(a, n) { var o = []; for (var i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

async function translateMissing(env, fetchFn, db, lang, texts) {
  // texts: [{hash, text}] that have no stored translation. Returns {done:{hash:text}, failed:[hash]}
  var done = {}, failed = [], prov = providerName(env), chars = 0, errs = 0, reqs = 0, lastErr = "";
  var work = texts.filter(function (t) { var k = lang + "|" + t.hash; if (inflight.has(k)) return false; return true; });
  var waiting = texts.filter(function (t) { return inflight.has(lang + "|" + t.hash); });
  var resolvers = {};
  work.forEach(function (t) { var k = lang + "|" + t.hash; inflight.set(k, new Promise(function (res) { resolvers[k] = res; })); });
  try {
    for (const group of chunk(work, 20)) {
      var prot = group.map(function (t) { var p = protect(t.text, lang); return { t: t, p: p }; });
      var rows = [];
      try {
        reqs++; chars += group.reduce(function (n, t) { return n + t.text.length; }, 0);
        var out = await callProvider(env, fetchFn, lang, prot.map(function (x) { return { text: x.p.text }; }));
        prot.forEach(function (x, i) {
          var restored = restore(String(out[i] == null ? "" : out[i]), x.p.keep), clean = restored == null ? null : cleanOut(x.t.text, restored);
          if (clean) { done[x.t.hash] = clean; rows.push({ lang: lang, src_hash: x.t.hash, source: x.t.text.slice(0, 4000), text: clean, status: "ok", is_override: false, provider: prov, error: null, attempts: 0, updated_at: new Date().toISOString() }); }
          else { failed.push(x.t.hash); errs++; rows.push({ lang: lang, src_hash: x.t.hash, source: x.t.text.slice(0, 4000), text: null, status: "failed", is_override: false, provider: prov, error: "output did not pass checks", attempts: 1, updated_at: new Date().toISOString() }); }
        });
      } catch (err) {
        errs += group.length; lastErr = String(err.message || err).slice(0, 200);
        group.forEach(function (t) { failed.push(t.hash); });
        if (!err.config) rows = group.map(function (t) { return { lang: lang, src_hash: t.hash, source: t.text.slice(0, 4000), text: null, status: "failed", is_override: false, provider: prov, error: lastErr, attempts: 1, updated_at: new Date().toISOString() }; });
      }
      // never replace an override or an existing good translation
      if (rows.length) {
        var ok = rows.filter(function (r) { return r.status === "ok"; }), bad = rows.filter(function (r) { return r.status !== "ok"; });
        await db.upsert("translations", ok, "lang,src_hash", false).catch(function () {});
        await db.upsert("translations", bad, "lang,src_hash", true).catch(function () {});
      }
    }
    if (reqs) await recordUsage(db, prov || "none", lang, reqs, chars, errs).catch(function () {});
  } finally {
    work.forEach(function (t) { var k = lang + "|" + t.hash; var r = resolvers[k]; inflight.delete(k); if (r) r(); });
  }
  for (const t of waiting) { await inflight.get(lang + "|" + t.hash); }
  if (waiting.length) {
    var again = await db.get("translations?lang=eq." + encodeURIComponent(lang) + "&src_hash=in.(" + waiting.map(function (t) { return t.hash; }).join(",") + ")&status=eq.ok&select=src_hash,text");
    (again || []).forEach(function (r) { done[r.src_hash] = r.text; });
    waiting.forEach(function (t) { if (!done[t.hash]) failed.push(t.hash); });
  }
  return { done: done, failed: failed, error: lastErr };
}
async function recordUsage(db, provider, lang, reqs, chars, errs) {
  var day = new Date().toISOString().slice(0, 10);
  var cur = await db.get("translation_usage?day=eq." + day + "&provider=eq." + encodeURIComponent(provider) + "&lang=eq." + encodeURIComponent(lang) + "&select=requests,chars,errors");
  var c = (cur && cur[0]) || { requests: 0, chars: 0, errors: 0 };
  await db.upsert("translation_usage", [{ day: day, provider: provider, lang: lang, requests: c.requests + reqs, chars: c.chars + chars, errors: c.errors + errs }], "day,provider,lang", false);
}

async function settingsOf(db) {
  var r = await db.get("site_settings?id=eq.1&select=data"), d = (r && r[0] && r[0].data) || {}, t = d.translate || {};
  var langs = ALWAYS.concat((t.languages || []).filter(function (l) { return LANGS[l] && ALWAYS.indexOf(l) < 0; }));
  return { enabled: t.enabled !== false, languages: langs };
}

/* ---------- request handler ---------- */
export async function handle(req, env, fetchFn) {
  var cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
  var reply = function (o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: cors }); };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ ok: false, error: "method" }, 405);
  var body; try { body = await req.json(); } catch (e) { return reply({ ok: false, error: "bad_json" }, 400); }
  var db = makeDb(env, fetchFn), action = body && body.action || "translate";
  var auth = req.headers.get("authorization") || "";
  try {
    var st = await settingsOf(db);

    if (action === "health") return reply({ ok: true, enabled: st.enabled, languages: st.languages, provider: providerName(env) || null });

    if (action === "translate") {
      var lang = String(body.lang || "");
      if (!LIVE_IN.test(lang) || lang === "en") return reply({ ok: false, error: "bad_lang" }, 400);
      if (!st.enabled) return reply({ ok: true, disabled: true, t: {}, failed: [] });
      if (st.languages.indexOf(lang) < 0) return reply({ ok: false, error: "language_not_enabled" }, 403);
      var texts = Array.isArray(body.texts) ? body.texts : [];
      if (!texts.length || texts.length > 60 || texts.some(function (x) { return typeof x !== "string" || x.length > 1600; })) return reply({ ok: false, error: "bad_texts" }, 400);
      var ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
      var corpus = await loadCorpus(env, db);
      var uniq = {}, list = [];
      texts.forEach(function (t) { var n = norm(t), h = hashText(n); if (!uniq[h]) { uniq[h] = 1; list.push({ hash: h, text: n }); } });
      var good = list.filter(function (x) { return allowedText(corpus, x.text); });
      if (good.length < list.length) {   // maybe the page was just published: look again, at most every 5 seconds
        corpus = await loadCorpus(env, db, 5000);
        good = list.filter(function (x) { return allowedText(corpus, x.text); });
      }
      var refused = list.length - good.length, skipped = list.filter(function (x) { return good.indexOf(x) < 0; }).map(function (x) { return x.hash; });
      var have = {};
      for (const g of chunk(good, 40)) {
        var rows = await db.get("translations?lang=eq." + encodeURIComponent(lang) + "&src_hash=in.(" + g.map(function (x) { return x.hash; }).join(",") + ")&select=src_hash,text,status,attempts,updated_at,is_override");
        (rows || []).forEach(function (r) { have[r.src_hash] = r; });
      }
      var t = {}, missing = [];
      good.forEach(function (x) {
        var r = have[x.hash];
        if (r && r.status === "ok" && r.text) t[x.hash] = r.text;
        else if (!r || r.is_override !== true) {
          var recentFail = r && r.status === "failed" && r.attempts >= 3 && Date.now() - Date.parse(r.updated_at) < 10 * 60000;
          if (!recentFail) missing.push(x);
        }
      });
      var failed = [], err = "";
      if (missing.length) {
        if (!rateOk(ip, missing.length)) return reply({ ok: true, t: t, failed: missing.map(function (x) { return x.hash; }), rate_limited: true });
        var r2 = await translateMissing(env, fetchFn, db, lang, missing);
        Object.assign(t, r2.done); failed = r2.failed; err = r2.error;
      }
      return reply({ ok: true, t: t, failed: failed, refused: refused, skipped: skipped });
    }

    // ----- everything below is staff only -----
    var staff = await rpcBool(env, fetchFn, "can_write", auth);
    if (!staff) return reply({ ok: false, error: "forbidden" }, 403);

    if (action === "status") {
      var all = await db.get("translations?select=lang,status,is_override&limit=20000") || [];
      var by = {};
      all.forEach(function (r) { var o = by[r.lang] = by[r.lang] || { ok: 0, failed: 0, override: 0 }; if (r.is_override) o.override++; else if (r.status === "ok") o.ok++; else o.failed++; });
      var usage = await db.get("translation_usage?select=*&order=day.desc&limit=60") || [];
      var c = await loadCorpus(env, db);
      return reply({ ok: true, provider: providerName(env) || null, enabled: st.enabled, languages: st.languages, per_language: by, usage: usage, source_units: c.units.length });
    }

    if (action === "prewarm" || action === "retry") {
      var targets = (Array.isArray(body.languages) && body.languages.length ? body.languages : st.languages).filter(function (l) { return st.languages.indexOf(l) > -1; });
      var cap = Math.min(Math.max(parseInt(body.limit, 10) || 60, 1), 100), report = {}, remaining = 0;
      var c2 = await loadCorpus(env, db, 0);
      for (const l of targets) {
        var units = c2.units.map(function (u) { return { hash: hashText(u), text: u }; }), ex = {};
        var rowsAll = await db.get("translations?lang=eq." + encodeURIComponent(l) + "&select=src_hash,status,is_override&limit=20000") || [];
        rowsAll.forEach(function (r) { ex[r.src_hash] = r; });
        var todo = units.filter(function (u) { var r = ex[u.hash]; if (!r) return action === "prewarm"; if (r.is_override) return false; return r.status === "failed"; });
        remaining += Math.max(0, todo.length - cap);
        var r3 = await translateMissing(env, fetchFn, db, l, todo.slice(0, cap));
        report[l] = { translated: Object.keys(r3.done).length, failed: r3.failed.length, error: r3.error || "" };
      }
      return reply({ ok: true, report: report, remaining: remaining });
    }

    if (action === "purge") {
      if (!(await rpcBool(env, fetchFn, "is_admin", auth))) return reply({ ok: false, error: "forbidden" }, 403);
      var c3 = await loadCorpus(env, db), live = new Set(c3.units.map(hashText));
      var every = await db.get("translations?is_override=eq.false&select=id,src_hash,source&limit=20000") || [], dead = every.filter(function (r) { return !live.has(r.src_hash) && !allowedText(c3, r.source); });
      for (const part of chunk(dead.map(function (r) { return r.id; }), 100)) await db.del("translations?id=in.(" + part.join(",") + ")");
      return reply({ ok: true, removed: dead.length });
    }

    return reply({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return reply({ ok: false, error: "server", detail: String(e.message || e).slice(0, 120) }, 500);
  }
}
