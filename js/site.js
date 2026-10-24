/* Inaya Quran Academy, shared public-site runtime
   - talks to Supabase through its REST API using only the public (anon) key
   - applies Admin → Settings (logo, colours, nav, footer…) to every page
   - privacy-conscious tracking (no personal data ever leaves the browser)  */
(function () {
  "use strict";

  var CFG = window.INAYA_CONFIG || {};
  var BASE = (CFG.SUPABASE_URL || "").replace(/\/+$/, "");
  var KEY = CFG.SUPABASE_ANON_KEY || "";
  var configured = !!(BASE && KEY);

  /* ---------- defaults (used until/unless the database answers) ---------- */
  var DEFAULT_SETTINGS = {
    academy_name: "Inaya Quran Academy",
    tagline: "Learn · Practice · Grow",
    logo_url: "assets/img/logo.png",
    logo_height: 44,
    footer_logo_url: "",
    footer_logo_height: 44,
    footer_logo_mode: "white",
    favicon_url: "",
    colors: { primary: "#0F4C3A", accent: "#B8975A", background: "#FBF7EE", text: "#26312C" },
    font: "Inter",
    contact_email: "",
    whatsapp_number: "",
    whatsapp_message: "Assalamu Alaikum. I would like to know more about Inaya Quran Academy's Quran learning programs and free assessment.",
    response_time: "",
    social: { facebook: "", instagram: "", telegram: "", youtube: "" },
    nav: [
      { label: "Home", href: "/" }, { label: "Programs", href: "/programs" },
      { label: "About", href: "/about" }, { label: "FAQ", href: "/faq" }, { label: "Contact", href: "/contact" }
    ],
    cta_primary_label: "Book a Free Assessment", cta_primary_href: "/assessment",
    cta_secondary_label: "Explore Our Programs", cta_secondary_href: "/programs",
    footer_text: "Structured Quran learning with care, for every age and level.",
    copyright: "© Inaya Quran Academy. All rights reserved.",
    seo_title: "Inaya Quran Academy | Online Quran Learning",
    seo_description: "Structured online Quran programs: reading & fluency, Tajweed & recitation, and Islamic foundations. Book a free assessment.",
    og_image: "assets/img/og-default.jpg",
    site_url: "https://inayaquran.com",
    assessment_success: "JazakAllahu khairan! We have received your request. Our team will contact you soon, InshaAllah.",
    contact_success: "JazakAllahu khairan! Your message has been sent. We will reply as soon as possible.",
    form_fields: { student_name: true, age_group: true, country: true, reading_level: true, preferred_time: true },
    analytics: { provider: "none", ga4_id: "", gtm_id: "", plausible_domain: "" },
    translate: { enabled: true, languages: [] }
  };

  /* ---------- tiny helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeHref(h) {
    h = String(h || "").trim();
    if (!h) return "#";
    if (/^(\/|#)/.test(h) && !/^\/\//.test(h)) return h;
    if (/^(https?:\/\/|mailto:|tel:)/i.test(h)) return h;
    return "#";
  }
  function safeImg(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^https:\/\//i.test(u)) return u;
    if (/^\/(?!\/)/.test(u)) return u;
    if (/^[\w\-./]+$/.test(u) && !/^[a-z]+:/i.test(u)) return "/" + u.replace(/^\.?\//, "");
    return "";
  }
  /* Very small, SAFE text formatter: paragraphs, "- " lists, "## " heading, **bold**, *italic*, [text](link). Everything is escaped first. */
  function inline(t) {
    t = esc(t);
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, href) {
      var h = safeHref(href.replace(/&amp;/g, "&"));
      return h === "#" ? label : '<a href="' + esc(h) + '">' + label + "</a>";
    });
    return t.replace(/\n/g, "<br>");
  }
  function md(text) {
    var blocks = String(text || "").replace(/\r/g, "").split(/\n{2,}/), out = [];
    blocks.forEach(function (b) {
      b = b.trim(); if (!b) return;
      var lines = b.split("\n");
      if (lines.every(function (l) { return /^\s*[-•]\s+/.test(l); })) {
        out.push("<ul>" + lines.map(function (l) { return "<li>" + inline(l.replace(/^\s*[-•]\s+/, "")) + "</li>"; }).join("") + "</ul>");
      } else if (/^##\s+/.test(b)) {
        var first = lines.shift();
        out.push("<h3>" + inline(first.replace(/^##\s+/, "")) + "</h3>");
        if (lines.length) out.push("<p>" + inline(lines.join("\n")) + "</p>");
      } else out.push("<p>" + inline(b) + "</p>");
    });
    return out.join("");
  }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }

  /* ---------- Supabase REST (public) ---------- */
  function headers(extra) {
    var h = { apikey: KEY, Authorization: "Bearer " + KEY };
    for (var k in extra || {}) h[k] = extra[k];
    return h;
  }
  /** GET table query. Returns parsed JSON, or null when unconfigured / failed (caller uses fallbacks). */
  function get(path) {
    if (!configured) return Promise.resolve(null);
    return fetch(BASE + "/rest/v1/" + path, { headers: headers() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  /** Call a database function. Resolves {ok, data, error}. Error is the exception code raised by SQL. */
  function rpc(name, body, opts) {
    if (!configured) return Promise.resolve({ ok: false, error: "not_configured" });
    return fetch(BASE + "/rest/v1/rpc/" + name, {
      method: "POST", headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body || {}), keepalive: !!(opts && opts.keepalive)
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (r.ok) return { ok: true, data: j };
        return { ok: false, error: (j && (j.message || j.code)) || "request_failed" };
      });
    }).catch(function () { return { ok: false, error: "network" }; });
  }

  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in (b || {})) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) o[k] = merge(a[k], b[k]);
      else if (b[k] !== undefined && b[k] !== null) o[k] = b[k];
    }
    return o;
  }

  /* Settings + Website-Builder pages that are "shown in menu". The result is cached in
     localStorage so the next page view paints header, footer and colours instantly
     (no blank header, no colour/logo flash) and is refreshed from the database in the background. */
  var CACHE_KEY = "inaya_site_v1";
  function cachedSettings() {
    try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); return c && c.academy_name ? c : null; } catch (e) { return null; }
  }
  function loadSettings() {
    return Promise.all([
      get("site_settings?id=eq.1&select=data"),
      get("public_pages?show_in_nav=eq.true&select=slug,title,nav_label,nav_order&order=nav_order.asc,title.asc")
    ]).then(function (r) {
      var d = r[0] && r[0][0] && r[0][0].data, s = merge(DEFAULT_SETTINGS, d || {});
      var have = (s.nav || []).map(function (n) { return safeHref(n.href); });
      (r[1] || []).forEach(function (p) {
        var href = "/" + p.slug;
        if (have.indexOf(href) < 0 && /^[a-z0-9-]+$/.test(p.slug)) s.nav = (s.nav || []).concat([{ label: p.nav_label || p.title, href: href }]);
      });
      if (r[0]) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) {} }
      return s;
    });
  }

  /* ---------- theme ---------- */
  var APPROVED_FONTS = ["Inter", "Source Sans 3", "Lato", "Nunito Sans", "Open Sans"];
  function hexOk(c) { return /^#[0-9a-fA-F]{6}$/.test(c || ""); }
  function applyTheme(s) {
    var r = document.documentElement.style, c = s.colors || {};
    if (hexOk(c.primary)) { r.setProperty("--primary", c.primary); r.setProperty("--primary-ink", "color-mix(in srgb, " + c.primary + " 76%, #000)"); }
    if (hexOk(c.accent)) { r.setProperty("--accent", c.accent); }
    if (hexOk(c.background)) { r.setProperty("--bg", c.background); }
    if (hexOk(c.text)) { r.setProperty("--text", c.text); }
    r.setProperty("--accent-soft", "color-mix(in srgb, var(--accent) 17%, var(--bg))");
    r.setProperty("--surface", "color-mix(in srgb, var(--bg) 40%, #fff)");
    if (s.font && s.font !== "Inter" && APPROVED_FONTS.indexOf(s.font) > -1) {
      var l = document.createElement("link"); l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(s.font).replace(/%20/g, "+") + ":wght@400;500;600&display=swap";
      document.head.appendChild(l);
      r.setProperty("--font-body", '"' + s.font + '", "Hind Siliguri", "Noto Naskh Arabic", system-ui, sans-serif');
    }
    if (s.favicon_url && safeImg(s.favicon_url)) {
      var ic = document.querySelector('link[rel="icon"]') || document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" }));
      ic.href = safeImg(s.favicon_url);
    }
  }

  /* ---------- SEO ---------- */
  /* If the saved site address differs from the address the visitor is really on only by "www.", use the real one,
     so canonical links never point at a host that redirects somewhere else. */
  function sameSite(u) {
    try {
      var a = new URL(u), strip = function (h) { return h.replace(/^www\./, ""); };
      if (strip(a.hostname) === strip(location.hostname) && a.host !== location.host) return location.origin + a.pathname + a.search;
    } catch (e) {}
    return u;
  }
  function setMeta(m) {
    function tag(sel, attr, val, create) {
      if (!val) return;
      var el = document.head.querySelector(sel);
      if (!el && create) { el = document.createElement(create.tag); for (var k in create.attrs) el.setAttribute(k, create.attrs[k]); document.head.appendChild(el); }
      if (el) el.setAttribute(attr, val);
    }
    if (m.title) document.title = m.title;
    tag('meta[name="description"]', "content", m.description, { tag: "meta", attrs: { name: "description" } });
    tag('meta[property="og:title"]', "content", m.title, { tag: "meta", attrs: { property: "og:title" } });
    tag('meta[property="og:description"]', "content", m.description, { tag: "meta", attrs: { property: "og:description" } });
    var img = m.image ? absUrl(m.image, m.siteUrl) : "";
    tag('meta[property="og:image"]', "content", img, { tag: "meta", attrs: { property: "og:image" } });
    tag('meta[name="twitter:image"]', "content", img, { tag: "meta", attrs: { name: "twitter:image" } });
    if (m.canonical) m.canonical = sameSite(m.canonical);
    if (m.canonical) tag('link[rel="canonical"]', "href", m.canonical, { tag: "link", attrs: { rel: "canonical" } });
    if (m.canonical) tag('meta[property="og:url"]', "content", m.canonical, { tag: "meta", attrs: { property: "og:url" } });
  }
  function absUrl(u, site) {
    u = safeImg(u); if (!u) return "";
    if (/^https:/i.test(u)) return u;
    return String(site || location.origin).replace(/\/+$/, "") + u;
  }

  /* ---------- WhatsApp ---------- */
  function waLink(s, msg) {
    var n = digits(s.whatsapp_number);
    if (n.length < 7) return "";
    return "https://wa.me/" + n + "?text=" + encodeURIComponent(msg || s.whatsapp_message || "");
  }
  /** resolves special CTA destinations typed in the editor */
  function resolveHref(h, s) {
    if (h === "{whatsapp}") return waLink(s) || "/contact";
    return safeHref(h);
  }

  /* ---------- attribution (UTM), session only, no personal data ---------- */
  function captureAttribution() {
    var a = {};
    try { a = JSON.parse(sessionStorage.getItem("iqa_attr") || "{}"); } catch (e) {}
    var q = new URLSearchParams(location.search), found = false;
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(function (k) {
      var v = (q.get(k) || "").trim().slice(0, 120);
      if (v) { a[k] = v; found = true; }
    });
    if (!a.landing_page) a.landing_page = location.pathname.slice(0, 200);
    if (!a.referrer_host) { try { a.referrer_host = document.referrer ? new URL(document.referrer).hostname.slice(0, 80) : ""; } catch (e) { a.referrer_host = ""; } }
    try { sessionStorage.setItem("iqa_attr", JSON.stringify(a)); } catch (e) {}
    return a;
  }

  /* ---------- tracking ---------- */
  var settingsRef = DEFAULT_SETTINGS, attr = {}, gaReady = false;
  var dnt = (navigator.doNotTrack === "1" || window.doNotTrack === "1");
  var EVENTS = ["page_view", "program_view", "assessment_cta_click", "assessment_form_start", "assessment_submitted", "whatsapp_click", "contact_submitted"];
  function track(ev) {
    if (EVENTS.indexOf(ev) < 0 || /^\/admin/.test(location.pathname)) return;
    if (!dnt && configured) {
      rpc("track_event", { p_event: ev, p_page: location.pathname.slice(0, 120), p_source: attr.utm_source || null, p_medium: attr.utm_medium || null, p_campaign: attr.utm_campaign || null }, { keepalive: true });
    }
    try {
      var a = settingsRef.analytics || {};
      if (a.provider === "ga4" && gaReady && window.gtag) window.gtag("event", ev, { page_path: location.pathname });
      if (a.provider === "gtm") gtmEvent(ev);
      if (a.provider === "plausible" && window.plausible) window.plausible(ev);
    } catch (e) {}
  }
  /* ---------- Google Tag Manager and the GA4 data layer ----------
     Connecting a GTM container switches the data layer on by itself. Events use GA4 names and shapes.
     Nothing is pushed before the visitor accepts; events wait in a short queue and are dropped if they decline.
     No names, emails or phone numbers are ever pushed. The student area (/learn) never loads analytics. */
  var dlState = "off", dlQueue = [];   // off | waiting (for consent) | on
  function dlBase() { return { page_location: location.href.split("#")[0], page_path: location.pathname, page_title: document.title, language: (window.InayaI18n && typeof window.InayaI18n.lang === "string" && window.InayaI18n.lang) || document.documentElement.lang || "en" }; }
  function dl(name, params) {
    if (dlState === "off" || /^\/admin|^\/learn/.test(location.pathname)) return;
    var o = Object.assign({ event: name }, dlBase(), params || {});
    if (dlState === "on") { window.dataLayer = window.dataLayer || []; if (o.ecommerce) window.dataLayer.push({ ecommerce: null }); window.dataLayer.push(o); }
    else if (dlQueue.length < 40) dlQueue.push(o);
  }
  function flushDl() { var q = dlQueue; dlQueue = []; dlState = "on"; q.forEach(function (o) { window.dataLayer = window.dataLayer || []; if (o.ecommerce) window.dataLayer.push({ ecommerce: null }); window.dataLayer.push(o); }); }
  function gtmEvent(ev) {
    if (ev === "page_view") dl("page_view");
    else if (ev === "assessment_submitted" || ev === "contact_submitted") dl("generate_lead", { lead_source: ev === "assessment_submitted" ? "assessment_form" : "contact_form" });
    else if (ev === "assessment_form_start") dl("form_start", { form_id: "assessment" });
    else if (ev === "whatsapp_click") dl("whatsapp_click");
    else if (ev === "assessment_cta_click") dl("assessment_cta_click");
    // program_view is sent as view_item with the program, see Inaya.dl in program.html
  }
  function loadGTM(id) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var sc = document.createElement("script"); sc.async = true; sc.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(id);
    document.head.appendChild(sc); flushDl();
  }
  function engagement() {
    var ms = 0, last = Date.now(), sent = false;
    var t = setInterval(function () {
      var now = Date.now(); if (document.visibilityState === "visible") ms += now - last; last = now;
      if (!sent && ms >= 30000) { sent = true; clearInterval(t); dl("user_engagement", { engagement_time_msec: 30000 }); dl("engaged_30s", { engagement_time_msec: 30000 }); }
    }, 1000);
  }
  function initAnalytics(s) {
    var a = s.analytics || {};
    if (/^\/learn/.test(location.pathname) || /^\/admin/.test(location.pathname)) return;   // no analytics for students or staff
    if (a.provider === "gtm" && /^GTM-[A-Z0-9]{4,10}$/.test(a.gtm_id || "") && !dnt) {
      var ch = null; try { ch = localStorage.getItem("iqa_consent"); } catch (e) {}
      if (ch === "yes") { dlState = "on"; loadGTM(a.gtm_id); engagement(); }
      else if (ch !== "no") { dlState = "waiting"; consentBar(a.gtm_id, "gtm"); engagement(); }
      return;
    }
    if (a.provider === "plausible" && /^[a-z0-9.\-]+\.[a-z]{2,}$/i.test(a.plausible_domain || "")) {
      window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
      var sc = document.createElement("script"); sc.defer = true; sc.setAttribute("data-domain", a.plausible_domain);
      sc.src = "https://plausible.io/js/script.js"; document.head.appendChild(sc);
    } else if (a.provider === "ga4" && /^G-[A-Z0-9]{4,14}$/.test(a.ga4_id || "")) {
      var choice = null; try { choice = localStorage.getItem("iqa_consent"); } catch (e) {}
      if (choice === "yes") loadGA(a.ga4_id);
      else if (choice !== "no") consentBar(a.ga4_id);
    }
  }
  function loadGA(id) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date()); window.gtag("config", id, { anonymize_ip: true });
    var sc = document.createElement("script"); sc.async = true; sc.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(sc); gaReady = true;
  }
  function consentBar(id, kind) {
    var b = document.createElement("div"); b.className = "consent-bar"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Analytics consent");
    b.innerHTML = '<span>We use ' + (kind === "gtm" ? "analytics tools" : "Google Analytics") + ' to understand how visitors use this site. No names or contact details are shared. <a href="/privacy">Privacy</a></span><span class="btn-row"><button class="btn sm ghost" data-c="no">Decline</button><button class="btn sm" data-c="yes">Accept</button></span>';
    b.addEventListener("click", function (e) {
      var c = e.target.getAttribute && e.target.getAttribute("data-c"); if (!c) return;
      try { localStorage.setItem("iqa_consent", c); } catch (x) {}
      if (c === "yes") { if (kind === "gtm") loadGTM(id); else loadGA(id); } else if (kind === "gtm") { dlState = "off"; dlQueue = []; }
      b.remove();
    });
    document.body.appendChild(b);
  }

  /* ---------- header / footer ---------- */
  var ICON_WA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.6-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z"/></svg>';

  function cachedProgs() { try { var c = JSON.parse(localStorage.getItem("inaya_progs_v1") || "null"); return c && c.length ? c : null; } catch (e) { return null; } }
  function subLinks(ps) { return ps.map(function (p) { return '<a href="/programs/' + encodeURIComponent(p.slug) + '">' + esc(p.title) + "</a>"; }).join("") + '<a href="/programs">All programs</a>'; }
  /* Opens on hover (with a short delay so the pointer can travel into the menu), on the arrow button, and by keyboard. */
  function initDropdowns(header) {
    header.querySelectorAll(".nav-item.has-sub").forEach(function (it) {
      var btn = it.querySelector(".sub-toggle"), t = 0;
      function open() { clearTimeout(t); it.classList.add("open"); btn.setAttribute("aria-expanded", "true"); }
      function close() { clearTimeout(t); it.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
      var fine = window.matchMedia && matchMedia("(hover: hover)").matches;
      if (fine) { it.addEventListener("mouseenter", open); it.addEventListener("mouseleave", function () { clearTimeout(t); t = setTimeout(close, 220); }); }
      btn.addEventListener("click", function (e) { e.stopPropagation(); it.classList.contains("open") ? close() : open(); });
      it.addEventListener("focusout", function (e) { if (!it.contains(e.relatedTarget)) close(); });
      it.addEventListener("keydown", function (e) { if (e.key === "Escape") { close(); btn.focus(); } if (e.key === "ArrowDown" && document.activeElement === btn) { e.preventDefault(); open(); var a = it.querySelector(".sub-menu a"); if (a) a.focus(); } });
      document.addEventListener("click", function (e) { if (!it.contains(e.target)) close(); });
    });
  }
  function renderChrome(s) {
    var path = location.pathname.replace(/\/+$/, "") || "/";
    var logo = safeImg(s.logo_url), name = esc(s.academy_name);
    var lh = Math.min(160, Math.max(20, parseInt(s.logo_height, 10) || 44)), fh = Math.min(160, Math.max(20, parseInt(s.footer_logo_height, 10) || 44));
    var flogo = safeImg(s.footer_logo_url) || logo, fmode = s.footer_logo_mode === "original" ? "original" : "white";
    var brand = logo ? '<img src="' + esc(logo) + '" alt="' + name + '" style="height:' + lh + 'px;width:auto">' : '<span class="brand-text">' + name + "</span>";
    var links = (s.nav || []).map(function (n) {
      var h = safeHref(n.href), cur = (h === path || (h !== "/" && path.indexOf(h + "/") === 0)) ? ' aria-current="page"' : "";
      var a = '<a class="nav-link" href="' + esc(h) + '"' + cur + ">" + esc(n.label) + "</a>";
      if (h !== "/programs") return a;
      return '<div class="nav-item has-sub">' + a + '<button type="button" class="sub-toggle" aria-expanded="false" aria-controls="sub-programs" aria-label="Programs menu"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
        '<div class="sub-menu" id="sub-programs"><div>' + subLinks(cachedProgs() || FALLBACK_PROGRAMS) + "</div></div></div>";
    }).join("");
    var header = document.getElementById("site-header");
    if (header) {
      header.className = "site-header";
      header.innerHTML = '<div class="container header-in"><a class="brand" href="/" aria-label="' + name + ' home">' + brand + '</a>' +
        '<button class="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>' +
        '<nav id="nav" class="nav" aria-label="Main">' + links +
        '<a class="btn sm" href="' + esc(safeHref(s.cta_primary_href)) + '">' + esc(s.cta_primary_label) + "</a></nav></div>";
      var btn = header.querySelector(".menu-btn"), nav = header.querySelector(".nav");
      function shut() { nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
      btn.addEventListener("click", function (e) { e.stopPropagation(); var o = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", o); });
      nav.addEventListener("click", function (e) { if (e.target.closest("a")) shut(); });
      document.addEventListener("click", function (e) { if (!header.contains(e.target)) shut(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") shut(); });
      initDropdowns(header);
      loadPrograms().then(function (ps) { var box = header.querySelector("#sub-programs > div"); if (box && ps && ps.length) { box.innerHTML = subLinks(ps); try { localStorage.setItem("inaya_progs_v1", JSON.stringify(ps.map(function (p) { return { slug: p.slug, title: p.title }; }))); } catch (e) {} } });
      var img = header.querySelector(".brand img");
      if (img) img.addEventListener("error", function () { img.outerHTML = '<span class="brand-text">' + name + "</span>"; });
    }
    var footer = document.getElementById("site-footer");
    if (footer) {
      var so = s.social || {}, soc = [["facebook", "Facebook"], ["instagram", "Instagram"], ["telegram", "Telegram"], ["youtube", "YouTube"]]
        .filter(function (x) { return /^https?:\/\//i.test(so[x[0]] || ""); })
        .map(function (x) { return '<li><a href="' + esc(so[x[0]]) + '" rel="noopener" target="_blank">' + x[1] + "</a></li>"; }).join("");
      var wa = waLink(s);
      var contact = "";
      if (s.contact_email) contact += '<li><a href="mailto:' + esc(s.contact_email) + '">' + esc(s.contact_email) + "</a></li>";
      if (wa) contact += '<li><a class="js-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a></li>';
      if (!contact) contact = '<li><a href="/contact">Contact us</a></li>';
      footer.className = "site-footer";
      footer.innerHTML = '<div class="container"><div class="foot-grid">' +
        '<div><span class="foot-logo">' + (flogo ? '<img src="' + esc(flogo) + '" alt="' + name + '" class="' + (fmode === "white" ? "mono" : "") + '" style="height:' + fh + 'px;width:auto">' : '<strong>' + name + "</strong>") + "</span>" +
        '<p style="max-width:34ch">' + esc(s.footer_text) + "</p></div>" +
        "<div><h4>Explore</h4><ul>" + (s.nav || []).map(function (n) { return '<li><a href="' + esc(safeHref(n.href)) + '">' + esc(n.label) + "</a></li>"; }).join("") + "</ul></div>" +
        "<div><h4>Get in touch</h4><ul>" + contact + '<li><a href="' + esc(safeHref(s.cta_primary_href)) + '">' + esc(s.cta_primary_label) + "</a></li></ul></div>" +
        "<div><h4>" + (soc ? "Follow" : "Legal") + "</h4><ul>" + soc + '<li><a href="/privacy">Privacy Policy</a></li><li><a href="/terms">Terms of Use</a></li></ul></div></div>' +
        '<div class="foot-bottom"><span>' + esc(s.copyright) + "</span><span>" + esc(s.tagline) + "</span></div></div>";
      var fi = footer.querySelector(".foot-logo img");
      if (fi) fi.addEventListener("error", function () { fi.outerHTML = "<strong>" + name + "</strong>"; });
    }
    var w = waLink(s);
    if (w && !document.querySelector(".wa-float")) {
      var f = document.createElement("a"); f.className = "wa-float js-wa"; f.href = w; f.target = "_blank"; f.rel = "noopener";
      f.setAttribute("aria-label", "Chat on WhatsApp"); f.innerHTML = ICON_WA + "<span>WhatsApp</span>";
      document.body.appendChild(f);
    }
  }

  /* ---------- click tracking (delegated; no personal data) ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    if (a.classList.contains("js-wa") || /(^|\.)wa\.me$/.test(a.hostname || "")) track("whatsapp_click");
    else {
      var href = a.getAttribute("href") || "";
      if (/^\/assessment(\?|#|$)/.test(href) && location.pathname.indexOf("/assessment") !== 0) track("assessment_cta_click");
    }
  }, true);

  /* ---------- program / faq data with built-in fallbacks ---------- */
  var FALLBACK_PROGRAMS = [
    { slug: "quran-reading-fluency", title: "Quran Reading & Fluency", short_description: "From letters to fluency, one step at a time.",
      description: "A structured path that takes a learner from the Arabic letters to confident, fluent Quran reading, one clear level at a time.",
      objectives: ["Recognise and read the Arabic letters and their vowel marks", "Read connected words and verses with growing accuracy", "Build steady, fluent reading"],
      student_profile: "Beginners and learners who want to strengthen their Quran reading, for children and adults.",
      curriculum_overview: "Three levels: Reading Foundations, Connected Quran Reading and Reading Fluency. Detailed curriculum is being finalised by the academy.",
      cta_label: "Book a Free Assessment", image_url: "",
      levels: [{ level_number: 1, title: "Reading Foundations", description: "" }, { level_number: 2, title: "Connected Quran Reading", description: "" }, { level_number: 3, title: "Reading Fluency", description: "" }] },
    { slug: "quran-recitation-tajweed-sunnah", title: "Quran Recitation, Tajweed & Sunnah", short_description: "Right pronunciation. Beautiful recitation.",
      description: "Learn the essential rules of Tajweed, apply them in recitation, and grow towards confident, beautiful recitation.",
      objectives: ["Pronounce letters correctly", "Learn and apply the essential rules of Tajweed", "Recite with confidence"],
      student_profile: "Learners who can read the Quran and want to improve their pronunciation and recitation.",
      curriculum_overview: "Three levels: Essential Tajweed, Applied Tajweed and Confident Recitation. Detailed curriculum is being finalised by the academy.",
      cta_label: "Book a Free Assessment", image_url: "",
      levels: [{ level_number: 1, title: "Essential Tajweed", description: "" }, { level_number: 2, title: "Applied Tajweed", description: "" }, { level_number: 3, title: "Confident Recitation", description: "" }] },
    { slug: "islamic-foundations-daily-living", title: "Islamic Foundations & Daily Living", short_description: "Build character. Live with purpose.",
      description: "Practical Islamic learning that builds foundations, helps learners practise worship and Sunnah, and shapes character in daily life.",
      objectives: ["Understand core Islamic foundations", "Practise worship and Sunnah", "Build Islamic character for everyday life"],
      student_profile: "Children and adults who want structured, practical Islamic learning.",
      curriculum_overview: "Three levels: My Islamic Foundations, Worship & Sunnah in Practice and Islamic Character & Daily Life. Detailed curriculum is being finalised by the academy.",
      cta_label: "Book a Free Assessment", image_url: "",
      levels: [{ level_number: 1, title: "My Islamic Foundations", description: "" }, { level_number: 2, title: "Worship & Sunnah in Practice", description: "" }, { level_number: 3, title: "Islamic Character & Daily Life", description: "" }] }
  ];
  var FALLBACK_FAQS = [
    { category: "General", question: "What is the free assessment?", answer: "It is a short conversation and reading check with our assessor so we can understand your current level and recommend a suitable starting point. Request it from the Free Assessment page." },
    { category: "General", question: "Who can join?", answer: "Children and adults of every age and level. Share the learner's age group and goals in the assessment form so we can guide you properly." },
    { category: "General", question: "How do classes take place?", answer: "Classes are online. Please contact us for the current class options and availability." },
    { category: "Enrollment", question: "How does enrollment work?", answer: "1) Request a free assessment. 2) Our team contacts you. 3) The assessor evaluates the learner and recommends a level. 4) If you wish to proceed, we confirm enrollment, arrange payment, assign a teacher and schedule classes." },
    { category: "Enrollment", question: "What are the fees?", answer: "Please contact us via WhatsApp or the contact page for current fee information." }
  ];

  var progsP = null;
  function loadPrograms() { return progsP || (progsP = loadProgramsNow()); }
  function loadProgramsNow() {
    return get("programs?select=*,program_levels(*)&order=sort_order.asc").then(function (rows) {
      if (rows === null) return FALLBACK_PROGRAMS;               // not configured / error → defaults
      return rows.map(function (p) {
        p.levels = (p.program_levels || []).slice().sort(function (a, b) { return a.sort_order - b.sort_order || a.level_number - b.level_number; });
        delete p.program_levels;
        return p;
      });
    });
  }
  function loadFaqs() {
    return get("faqs?select=*&order=sort_order.asc").then(function (rows) { return rows === null ? FALLBACK_FAQS : rows; });
  }
  function loadPage(slug) {
    return get("public_pages?slug=eq." + encodeURIComponent(slug) + "&select=*").then(function (rows) {
      if (rows === null) return { fallback: true };
      return rows[0] ? rows[0] : { hidden: true };
    });
  }

  /* ---------- boot ---------- */

  /* ---------- motion: reveal on scroll, staggered cards, count-up numbers ---------- */
  function initMotion() {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var header = document.getElementById("site-header");
    if (header && !header.getAttribute("data-mo")) {
      header.setAttribute("data-mo", "1");
      var tick = false;
      window.addEventListener("scroll", function () { if (tick) return; tick = true; requestAnimationFrame(function () { header.classList.toggle("scrolled", window.scrollY > 8); tick = false; }); }, { passive: true });
    }
    if (reduce || !("IntersectionObserver" in window)) return;
    var main = document.getElementById("main"); if (!main) return;
    var CH = ".grid > *, .steps > *, .levels > *, .split > *, .detail-grid > *, .hero-grid > *, .faq-cat, .faq-item, details";
    main.querySelectorAll("[data-anim]").forEach(function (sec) {
      var kids = sec.querySelectorAll(CH), n = 0;
      kids.forEach(function (k) { if (!k.hasAttribute("data-st") && !k.closest("[data-st]")) { k.setAttribute("data-st", ""); k.style.setProperty("--d", Math.min(n, 8) * 0.07 + "s"); n++; } });
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; io.unobserve(e.target); e.target.classList.add("in");
        e.target.querySelectorAll(".stat b").forEach(countUp);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    document.documentElement.classList.add("mo");
    main.querySelectorAll("[data-anim], [data-st]").forEach(function (el) { io.observe(el); });
  }
  function countUp(el) {
    var m = /^(\D*)(\d[\d,]*)(\D*)$/.exec((el.textContent || "").trim()); if (!m) return;
    var end = parseInt(m[2].replace(/,/g, ""), 10); if (!(end > 0) || end > 1e7) return;
    var t0 = null, dur = 1100, fmt = m[2].indexOf(",") > -1;
    function step(ts) { if (t0 === null) t0 = ts; var p = Math.min(1, (ts - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
      el.textContent = m[1] + (fmt ? v.toLocaleString("en-US") : v) + m[3]; if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }

  function boot(cb) {
    var run = function () {
      attr = captureAttribution();
      var cached = cachedSettings(), shown = cached ? JSON.stringify(cached) : "";
      if (cached) { settingsRef = cached; applyTheme(cached); renderChrome(cached); }   // instant paint, no flash
      loadSettings().then(function (s) {
        settingsRef = s; applyTheme(s);
        if (JSON.stringify(s) !== shown) renderChrome(s);
        try { document.dispatchEvent(new CustomEvent("inaya:settings", { detail: s })); } catch (e) {}
        initAnalytics(s);
        var p = location.pathname.replace(/\/+$/, "") || "/";
        track("page_view");
        if (/^\/programs\/[^/]+$/.test(p)) track("program_view");
        Promise.resolve(cb && cb(s)).catch(function (e) { console.error(e); }).then(initMotion);
      });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
  }

  window.Inaya = {
    getSettings: function () { return settingsRef; },
    dl: dl,
    configured: configured, esc: esc, md: md, inline: inline, safeHref: safeHref, safeImg: safeImg, digits: digits,
    get: get, rpc: rpc, boot: boot, track: track, setMeta: setMeta, waLink: waLink, resolveHref: resolveHref,
    loadPrograms: loadPrograms, loadFaqs: loadFaqs, loadPage: loadPage, loadSettings: loadSettings,
    attribution: function () { return attr; }, DEFAULT_SETTINGS: DEFAULT_SETTINGS, merge: merge,
    APPROVED_FONTS: APPROVED_FONTS, FALLBACK_PROGRAMS: FALLBACK_PROGRAMS
  };
})();
