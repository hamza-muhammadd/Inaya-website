/* Language support.
   Layer 1: Bangla and Arabic interface text is reviewed and built in (js/i18n-dict.js), Arabic is right-to-left.
   Layer 2: everything else, including content written in the admin panel and any extra language, is translated
            automatically from the English source by the "translate" Edge Function and cached in the database.
   Owner overrides (Admin, Settings, Automatic translation) win over both layers.
   If the translation service is unreachable the visitor simply sees the English text. */
(function () {
  "use strict";
  var KEY = "iqa_lang";
  var BUILT = { en: "English", bn: "বাংলা", ar: "العربية" };
  var SHORT = { en: "EN", bn: "বাং", ar: "عربي" };
  var NAMES = { ur: "اردو", hi: "हिन्दी", tr: "Türkçe", id: "Bahasa Indonesia", ms: "Bahasa Melayu", fr: "Français", es: "Español", de: "Deutsch", ru: "Русский", pt: "Português", it: "Italiano", nl: "Nederlands", fa: "فارسی", so: "Soomaali", sw: "Kiswahili", ta: "தமிழ்", ne: "नेपाली", "zh-CN": "中文", ja: "日本語", ko: "한국어", th: "ไทย", vi: "Tiếng Việt", he: "עברית", ps: "پښتو" };
  var RTL = { ar: 1, ur: 1, fa: 1, he: 1, ps: 1 };

  function stored() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  var q = (/[?&]lang=([\w-]+)/.exec(location.search) || [])[1];
  var cur = (q || stored() || "en").replace(/^g:/, "");
  if (q) save(q);
  var lang = BUILT[cur] ? cur : "en";          // built-in dictionary language
  var xl = !BUILT[cur] && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(cur) ? cur : "";   // extra language, machine translated only
  var target = xl || (lang !== "en" ? lang : "");   // language the visitor sees
  var col = lang === "bn" ? 1 : lang === "ar" ? 2 : 0;

  var root = document.documentElement;
  root.setAttribute("lang", target || "en");
  root.setAttribute("dir", (target && RTL[target.split("-")[0]]) ? "rtl" : "ltr");
  root.classList.add("lang-" + (xl ? "x" : lang));
  try { document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; } catch (e) {}   // earlier versions used a Google widget

  /* ---------- hashing (identical to supabase/functions/translate/core.js) ---------- */
  function norm(s) { return String(s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim(); }
  function cyrb53(str, seed) {
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function hashText(s) { var n = norm(s); return cyrb53(n, 0).toString(16).padStart(14, "0") + cyrb53(n, 7).toString(16).padStart(14, "0"); }

  /* ---------- layer 1: built-in dictionary ---------- */
  var MAP = null;
  function build() { MAP = {}; (window.INAYA_DICT || []).forEach(function (r) { MAP[norm(r[0])] = r; }); }
  var BNDIG = "০১২৩৪৫৬৭৮৯", ARDIG = "٠١٢٣٤٥٦٧٨٩";
  function digits(n) { return String(n).replace(/\d/g, function (d) { return lang === "bn" ? BNDIG[d] : lang === "ar" ? ARDIG[d] : d; }); }
  function dict(text) {
    if (!col) return null;
    var k = norm(text); if (!k) return null;
    if (!MAP) build();
    var r = MAP[k]; if (r && r[col]) return r[col];
    var m = /^Level (\d+)$/.exec(k); if (m) return (lang === "bn" ? "স্তর " : "المستوى ") + digits(m[1]);
    m = /^Program (\d+)$/.exec(k); if (m) return (lang === "bn" ? "প্রোগ্রাম " : "البرنامج ") + digits(m[1]);
    return null;
  }

  /* ---------- owner overrides and cached machine translations ---------- */
  var CFG = window.INAYA_CONFIG || {};
  var REST = (CFG.SUPABASE_URL || "").replace(/\/+$/, "");
  function ls(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var ovr = {};      // hash -> owner text
  var memo = {};     // hash -> machine text
  var TTL = 6 * 3600e3, now = Date.now();
  if (target) {
    var o = ls("iqa_ovr_" + target); if (o && now - o.t < 600e3) ovr = o.m || {};
    var c = ls("iqa_tr_" + target); if (c && c.m) Object.keys(c.m).forEach(function (h) { if (now - c.m[h][1] < TTL) memo[h] = c.m[h][0]; });
  }
  function hdr() { return { apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY }; }
  function loadOverrides() {
    if (!target || !REST || !CFG.SUPABASE_ANON_KEY) return;
    fetch(REST + "/rest/v1/translations?lang=eq." + encodeURIComponent(target) + "&is_override=eq.true&select=src_hash,text&limit=2000", { headers: hdr() })
      .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
        var m = {}; (rows || []).forEach(function (x) { if (x.text) m[x.src_hash] = x.text; });
        lsSet("iqa_ovr_" + target, { t: Date.now(), m: m }); var changed = JSON.stringify(m) !== JSON.stringify(ovr); ovr = m; if (changed) run();
      }).catch(function () {});
  }

  /* ---------- engine settings ---------- */
  function tset() { var s = window.Inaya && window.Inaya.getSettings && window.Inaya.getSettings(); return (s && s.translate) || { enabled: true, languages: [] }; }
  function engineOn() {
    if (!target || !REST || !CFG.SUPABASE_ANON_KEY) return false;
    try { if (sessionStorage.getItem("iqa_tr_off")) return false; } catch (e) {}
    var t = tset(); if (t.enabled === false) return false;
    if (xl) return (t.languages || []).indexOf(xl) > -1;
    return true;
  }

  function sanitize(s, allowTags) {
    s = String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    if (!allowTags) return s.replace(/<[^>]*>/g, "");
    return s.replace(/<(?!\/?(?:em|strong|b|i)>)[^>]*>/gi, "");
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1 };
  var INLINE = { EM: 1, STRONG: 1, B: 1, I: 1, BR: 1, SPAN: 1 };
  var ATTRS = ["placeholder", "aria-label", "alt", "title"];
  function decode(h) { return h.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"); }
  var pending = {};       // hash -> {text, html, items:[fn(text)]}
  var skipped = {};       // hashes the service refused (not site content)
  try { skipped = JSON.parse(sessionStorage.getItem("iqa_tr_skip") || "{}"); } catch (e) {}
  var done = typeof WeakSet === "function" ? new WeakSet() : { has: function () { return false; }, add: function () {} };

  function needs(text) {
    var t = norm(text);
    if (t.length < 2 || !/[A-Za-z]{2}/.test(t) || /^(https?:|\S+@\S+$)/.test(t) || /^[A-Z]{2,4}-\d+$/.test(t)) return false;
    return true;
  }
  function want(text, html, apply) {
    var t = norm(text), h = hashText(t);
    if (ovr[h]) { apply(sanitize(ovr[h], html)); return true; }
    if (!engineOn()) return false;
    if (memo[h]) { apply(sanitize(memo[h], html)); return true; }
    if (skipped[h] || !needs(t)) return false;
    var p = pending[h] || (pending[h] = { text: t, html: html, items: [] }); p.items.push(apply);
    return true;
  }
  function lookup(text) {   // synchronous layers: owner override, then dictionary
    var h = hashText(text); if (ovr[h]) return sanitize(ovr[h], false);
    return dict(text);
  }

  function doEl(el) {
    if (SKIP[el.tagName] || el.__i || (el.closest && el.closest("[data-noi18n]"))) return;
    if (el.children.length) {
      var all = true; for (var i = 0; i < el.children.length; i++) if (!INLINE[el.children[i].tagName] || el.children[i].children.length) { all = false; break; }
      if (all) {
        var raw = decode(el.innerHTML), hit = lookupHtml(raw);
        if (hit) { el.__i = 1; el.innerHTML = hit; return; }
        if (target && !done.has(el) && /<(em|strong|b|i)>/i.test(raw) && needs(raw)) {
          var wanted = want(raw, true, function (tx) { done.add(el); el.__i = 1; el.innerHTML = tx; });
          if (wanted) return;
        }
      }
    }
    ATTRS.forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a); if (!v || el["__a" + a]) return;
      var h = lookup(v); if (h) { el["__a" + a] = 1; el.setAttribute(a, h); return; }
      if (target && needs(v)) want(v, false, function (tx) { el["__a" + a] = 1; el.setAttribute(a, tx); });
    });
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        var tx0 = n.nodeValue; if (!tx0.trim() || done.has(n)) continue;
        var r = lookup(tx0), lead = /^\s*/.exec(tx0)[0], trail = /\s*$/.exec(tx0)[0];
        if (r) { n.nodeValue = lead + r + trail; done.add(n); }
        else if (target && needs(tx0)) { (function (node, l, t) { want(tx0, false, function (tx) { done.add(node); node.nodeValue = l + tx + t; }); })(n, lead, trail); }
      } else if (n.nodeType === 1) doEl(n);
    }
  }
  function lookupHtml(raw) { return lookup(raw); }

  var busy = false;
  function run(node) {
    if (!target || busy) return;
    busy = true;
    try { doEl(node || document.body); titleAndMeta(); } finally { busy = false; }
    flushSoon();
  }
  function titleAndMeta() {
    var parts = document.title.split(" | ");
    if (!document.__tt && !document.__tw) {
      var changed = false, out = parts.map(function (p, i) {
        var r = lookup(p); if (r) { changed = true; return r; }
        if (target && needs(p) && !document["__tp" + i + p]) { document["__tp" + i + p] = 1; want(p, false, function (tx) { var cur = document.title.split(" | "); if (cur[i] === p) { cur[i] = tx; document.__tt = 1; document.title = cur.join(" | "); document.__tt = 0; } }); }
        return p;
      }).join(" | ");
      if (changed && out !== document.title) { document.__tt = 1; document.title = out; document.__tt = 0; }
    }
    ["meta[name=description]", "meta[property='og:description']", "meta[property='og:title']"].forEach(function (sel) {
      var m = document.head.querySelector(sel), v = m && m.getAttribute("content"); if (!v || m.__tm === v) return;
      var h = lookup(v); if (h) { m.setAttribute("content", h); m.__tm = h; return; }
      if (target && needs(v)) { m.__tm = v; want(v, false, function (tx) { m.setAttribute("content", tx); m.__tm = tx; }); }
    });
  }

  /* ---------- layer 2: fetch cached translations, ask the service for the rest ---------- */
  var flushT = 0, failures = 0;
  function flushSoon() { clearTimeout(flushT); flushT = setTimeout(flush, 120); }
  function applyAll(h, text) {
    var p = pending[h]; if (!p) return; delete pending[h];
    p.items.forEach(function (fn) { try { fn(sanitize(text, p.html)); } catch (e) {} });
  }
  function remember(map) {
    Object.keys(map).forEach(function (h) { memo[h] = map[h]; });
    var c = ls("iqa_tr_" + target) || { m: {} }, t = Date.now(), keys;
    Object.keys(map).forEach(function (h) { c.m[h] = [map[h], t]; });
    keys = Object.keys(c.m); if (keys.length > 500) keys.sort(function (a, b) { return c.m[a][1] - c.m[b][1]; }).slice(0, keys.length - 500).forEach(function (k) { delete c.m[k]; });
    lsSet("iqa_tr_" + target, c);
  }
  function chunks(a, n) { var o = []; for (var i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
  var inFlight = {};
  function flush() {
    if (!engineOn()) { pending = {}; return; }
    var hs = Object.keys(pending).filter(function (h) { return !inFlight[h]; });
    if (!hs.length) return;
    hs.forEach(function (h) { inFlight[h] = 1; });
    var lg = target;
    // 1) database cache (public read)
    Promise.all(chunks(hs, 40).map(function (g) {
      return fetch(REST + "/rest/v1/translations?lang=eq." + encodeURIComponent(lg) + "&src_hash=in.(" + g.join(",") + ")&status=eq.ok&select=src_hash,text", { headers: hdr() })
        .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
    })).then(function (parts) {
      var got = {}; parts.forEach(function (rows) { (rows || []).forEach(function (r) { if (r.text) got[r.src_hash] = r.text; }); });
      remember(got); Object.keys(got).forEach(function (h) { applyAll(h, got[h]); });
      var miss = hs.filter(function (h) { return !got[h] && pending[h]; });
      if (!miss.length) { hs.forEach(function (h) { delete inFlight[h]; }); return; }
      // 2) ask the translate function for anything not cached yet
      return Promise.all(chunks(miss, 30).map(function (g) {
        return fetch(REST + "/functions/v1/translate", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, hdr()), body: JSON.stringify({ action: "translate", lang: lg, texts: g.map(function (h) { return pending[h].text; }) }) })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (x) {
            if (!x.ok || !x.j || x.j.ok === false) throw new Error((x.j && x.j.error) || "http");
            failures = 0;
            if (x.j.disabled) { try { sessionStorage.setItem("iqa_tr_off", "1"); } catch (e) {} return; }
            var t = x.j.t || {}; remember(t); Object.keys(t).forEach(function (h) { applyAll(h, t[h]); });
            (x.j.skipped || []).forEach(function (h) { skipped[h] = 1; delete pending[h]; });
            try { sessionStorage.setItem("iqa_tr_skip", JSON.stringify(skipped)); } catch (e) {}
          });
      })).catch(function () {
        if (++failures >= 2) { try { sessionStorage.setItem("iqa_tr_off", "1"); } catch (e) {} pending = {}; }
      }).then(function () { hs.forEach(function (h) { delete inFlight[h]; delete pending[h]; }); });
    });
  }

  /* ---------- switcher ---------- */
  function setLang(v) {
    save(v);
    var qs = location.search.replace(/([?&])lang=[\w-]+&?/, "$1").replace(/[?&]$/, "");
    location.href = location.pathname + qs + location.hash;   // same page, same query, new language
  }
  function mountSwitcher() {
    var h = document.querySelector("#site-header .header-in");
    if (!h) return;
    var extra = engineOn() || (tset().enabled !== false) ? (tset().languages || []).filter(function (c) { return NAMES[c]; }) : [];
    var sig = extra.join(",");
    var ex = h.querySelector(".lang-switch");
    if (ex && ex.getAttribute("data-sig") === sig) return;
    if (ex) ex.remove();
    var label = xl ? xl.toUpperCase() : SHORT[lang];
    var items = Object.keys(BUILT).map(function (k) { return '<button type="button" role="menuitemradio" data-l="' + k + '" aria-checked="' + (!xl && k === lang) + '">' + BUILT[k] + "</button>"; }).join("");
    var more = extra.length ? '<label class="more">More languages<select aria-label="More languages"><option value="">Choose…</option>' +
      extra.map(function (c) { return '<option value="' + c + '"' + (xl === c ? " selected" : "") + ">" + NAMES[c] + "</option>"; }).join("") + "</select></label>" : "";
    var d = document.createElement("div"); d.className = "lang-switch"; d.setAttribute("data-noi18n", ""); d.setAttribute("data-sig", sig);
    d.innerHTML = '<button type="button" class="lang-btn" aria-haspopup="true" aria-expanded="false" aria-label="Language"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"/></svg><span>' + label + '</span></button><div class="lang-menu" role="menu" hidden>' + items + more + "</div>";
    var mb = h.querySelector(".menu-btn");
    if (mb) h.insertBefore(d, mb); else h.appendChild(d);
    var btn = d.querySelector(".lang-btn"), menu = d.querySelector(".lang-menu");
    function shut() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); });
    document.addEventListener("click", function (e) { if (!d.contains(e.target)) shut(); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") { shut(); btn.focus(); } });
    menu.addEventListener("click", function (e) { var b = e.target.closest("button[data-l]"); if (b) setLang(b.getAttribute("data-l")); });
    var sel = menu.querySelector("select"); if (sel) sel.addEventListener("change", function (e) { if (e.target.value) setLang(e.target.value); });
  }

  function start() {
    mountSwitcher(); run(); loadOverrides();
    document.addEventListener("inaya:settings", function () { mountSwitcher(); run(); });
    var timer = 0;
    new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () { mountSwitcher(); run(); }, 30);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  window.InayaI18n = {
    lang: lang, target: target, rtl: root.getAttribute("dir") === "rtl", set: setLang, BUILT: BUILT, NAMES: NAMES,
    t: function (s) { return lookup(s) || s; }, translate: function (n) { run(n); }, hash: hashText
  };
})();
