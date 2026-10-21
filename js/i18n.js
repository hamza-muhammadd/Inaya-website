/* Language support: Bangla, Arabic and English are built in (right-to-left for Arabic).
   Any other language is offered through Google Translate. The chosen language is remembered. */
(function () {
  "use strict";
  var KEY = "iqa_lang";
  var BUILT = { en: "English", bn: "বাংলা", ar: "العربية" };
  var SHORT = { en: "EN", bn: "বাং", ar: "عربي" };
  var MORE = [["ur", "اردو"], ["hi", "हिन्दी"], ["tr", "Türkçe"], ["id", "Bahasa Indonesia"], ["ms", "Bahasa Melayu"], ["fr", "Français"], ["es", "Español"], ["de", "Deutsch"], ["ru", "Русский"], ["pt", "Português"], ["it", "Italiano"], ["nl", "Nederlands"], ["fa", "فارسی"], ["so", "Soomaali"], ["sw", "Kiswahili"], ["ta", "தமிழ்"], ["ne", "नेपाली"], ["zh-CN", "中文"], ["ja", "日本語"], ["ko", "한국어"], ["th", "ไทย"], ["vi", "Tiếng Việt"], ["he", "עברית"], ["ps", "پښتو"]];
  var RTL = { ar: 1, ur: 1, fa: 1, he: 1, ps: 1 };

  function stored() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  var q = (/[?&]lang=([\w-]+)/.exec(location.search) || [])[1];
  var cur = q || stored() || "en";
  if (q) save(q);
  var google = cur.indexOf("g:") === 0 ? cur.slice(2) : "";
  var lang = BUILT[cur] ? cur : "en";
  var col = lang === "bn" ? 1 : lang === "ar" ? 2 : 0;

  var root = document.documentElement;
  root.setAttribute("lang", google || lang);
  root.setAttribute("dir", (lang === "ar" || (google && RTL[google.split("-")[0]])) ? "rtl" : "ltr");
  root.classList.add("lang-" + (google ? "g" : lang));

  function norm(s) { return String(s).replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim(); }
  var MAP = null;
  function build() {
    MAP = {};
    (window.INAYA_DICT || []).forEach(function (r) { MAP[norm(r[0])] = r; });
  }
  var BNDIG = "০১২৩৪৫৬৭৮৯", ARDIG = "٠١٢٣٤٥٦٧٨٩";
  function digits(n) { return String(n).replace(/\d/g, function (d) { return lang === "bn" ? BNDIG[d] : lang === "ar" ? ARDIG[d] : d; }); }
  function lookup(text) {
    if (!col) return null;
    var k = norm(text); if (!k) return null;
    if (!MAP) build();
    var r = MAP[k]; if (r && r[col]) return r[col];
    var m = /^Level (\d+)$/.exec(k); if (m) return (lang === "bn" ? "স্তর " : "المستوى ") + digits(m[1]);
    m = /^Program (\d+)$/.exec(k); if (m) return (lang === "bn" ? "প্রোগ্রাম " : "البرنامج ") + digits(m[1]);
    return null;
  }
  function t(s) { return lookup(s) || s; }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1 };
  var INLINE = { EM: 1, STRONG: 1, B: 1, I: 1, BR: 1, SPAN: 1 };
  function decode(h) { return h.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"); }
  var ATTRS = ["placeholder", "aria-label", "alt", "title"];

  function doEl(el) {
    if (SKIP[el.tagName] || el.closest && el.closest("[data-noi18n]")) return;
    // elements with inline markup, such as a heading with an emphasised word
    if (el.children.length && !el.__i) {
      var all = true; for (var i = 0; i < el.children.length; i++) if (!INLINE[el.children[i].tagName] || el.children[i].children.length) { all = false; break; }
      if (all) {
        var hit = lookup(decode(el.innerHTML));
        if (hit) { el.__i = 1; el.innerHTML = hit; return; }
      }
    }
    ATTRS.forEach(function (a) { var v = el.getAttribute && el.getAttribute(a); if (v && !el["__a" + a]) { var h = lookup(v); if (h) { el["__a" + a] = 1; el.setAttribute(a, h); } } });
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        var tx = n.nodeValue;
        if (!tx.trim()) continue;
        var r = lookup(tx);
        if (r) { var lead = /^\s*/.exec(tx)[0], trail = /\s*$/.exec(tx)[0]; n.nodeValue = lead + r + trail; }
      } else if (n.nodeType === 1) doEl(n);
    }
    if (el.tagName === "OPTION" || el.tagName === "INPUT") return;
  }
  var busy = false;
  function run(node) {
    if (!col || busy) return;
    busy = true;
    try { doEl(node || document.body); titleAndMeta(); } finally { busy = false; }
  }
  function titleAndMeta() {
    if (!col) return;
    var parts = document.title.split(" | ").map(function (p) { return lookup(p) || p; }).join(" | ");
    if (parts !== document.title && !document.__tt) { document.__tt = 1; document.title = parts; document.__tt = 0; }
    ["meta[name=description]", "meta[property='og:description']", "meta[property='og:title']"].forEach(function (sel) {
      var m = document.head.querySelector(sel), v = m && m.getAttribute("content"), h = v && lookup(v);
      if (h) m.setAttribute("content", h);
    });
  }

  /* ---------- switcher ---------- */
  function setLang(v) { save(v); if (v.indexOf("g:") !== 0) clearGoogle(); else setGoogle(v.slice(2)); location.href = location.pathname + location.search.replace(/([?&])lang=[\w-]+&?/, "$1").replace(/[?&]$/, "") + location.hash; }
  function setGoogle(code) {
    var c = "googtrans=/en/" + code + "; path=/";
    document.cookie = c; try { document.cookie = c + "; domain=" + location.hostname; } catch (e) {}
  }
  function clearGoogle() {
    var c = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie = c; try { document.cookie = c + "; domain=" + location.hostname; } catch (e) {}
  }
  function mountSwitcher() {
    var h = document.querySelector("#site-header .header-in");
    if (!h || h.querySelector(".lang-switch")) return;
    var label = google ? google.toUpperCase() : SHORT[lang];
    var items = Object.keys(BUILT).map(function (k) { return '<button type="button" role="menuitemradio" data-l="' + k + '" aria-checked="' + (!google && k === lang) + '">' + BUILT[k] + "</button>"; }).join("");
    var more = '<label class="more">' + "More languages" + '<select aria-label="More languages"><option value="">Choose…</option>' +
      MORE.map(function (m) { return '<option value="g:' + m[0] + '"' + (google === m[0] ? " selected" : "") + ">" + m[1] + "</option>"; }).join("") + "</select></label>";
    var d = document.createElement("div"); d.className = "lang-switch"; d.setAttribute("data-noi18n", "");
    d.innerHTML = '<button type="button" class="lang-btn" aria-haspopup="true" aria-expanded="false" aria-label="Language"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"/></svg><span>' + label + '</span></button><div class="lang-menu" role="menu" hidden>' + items + more + "</div>";
    var mb = h.querySelector(".menu-btn");
    if (mb) h.insertBefore(d, mb); else h.appendChild(d);
    var btn = d.querySelector(".lang-btn"), menu = d.querySelector(".lang-menu");
    function shut() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); });
    document.addEventListener("click", function (e) { if (!d.contains(e.target)) shut(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") shut(); });
    menu.addEventListener("click", function (e) { var b = e.target.closest("button[data-l]"); if (b) setLang(b.getAttribute("data-l")); });
    menu.querySelector("select").addEventListener("change", function (e) { if (e.target.value) setLang(e.target.value); });
    if (lang !== "en" || google) { /* switcher itself stays in its own language names */ }
  }

  function loadGoogle() {
    if (!google) return;
    var box = document.createElement("div"); box.id = "google_translate_element"; box.setAttribute("data-noi18n", ""); box.style.display = "none"; document.body.appendChild(box);
    window.googleTranslateElementInit = function () { new google.translate.TranslateElement({ pageLanguage: "en", autoDisplay: false }, "google_translate_element"); };
    var s = document.createElement("script"); s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"; s.async = true; document.head.appendChild(s);
  }

  function start() {
    mountSwitcher(); run(); loadGoogle();
    var timer = 0;
    new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () { mountSwitcher(); run(); }, 30);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  window.InayaI18n = { lang: lang, google: google, t: t, rtl: root.getAttribute("dir") === "rtl", set: setLang, BUILT: BUILT, translate: function (n) { run(n); } };
})();
