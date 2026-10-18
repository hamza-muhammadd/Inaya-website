/* Inaya Quran Academy — controlled section library
   Used by the public pages AND by the admin live preview.
   No arbitrary HTML/JS is ever rendered: every field is escaped or passed
   through the safe formatter in site.js. */
(function () {
  "use strict";
  var I = window.Inaya, esc = I.esc, md = I.md, safeHref = I.safeHref;

  /* ---------- section type catalogue (drives the admin editor forms) ---------- */
  var TYPES = {
    page_head:     { label: "Page heading",      fields: ["eyebrow", "heading", "body"] },
    hero:          { label: "Hero",              fields: ["eyebrow", "heading", "body", "image", "image_alt", "buttons", "layout"] },
    text_image:    { label: "Text and image",    fields: ["eyebrow", "heading", "body", "image", "image_alt", "buttons", "reverse"] },
    program_cards: { label: "Program cards",     fields: ["eyebrow", "heading", "body", "buttons"], note: "Cards are filled automatically from Programs & Curriculum." },
    level_list:    { label: "Level list",        fields: ["eyebrow", "heading", "body"], note: "Lists every published program with its levels." },
    benefits:      { label: "Benefits / points", fields: ["eyebrow", "heading", "body", "items", "columns"], itemFields: ["title", "text"] },
    process:       { label: "Step-by-step process", fields: ["eyebrow", "heading", "body", "items"], itemFields: ["title", "text"] },
    stats:         { label: "Statistics",        fields: ["eyebrow", "heading", "items"], itemFields: ["value", "label"], note: "Use ONLY real, verified numbers." },
    faq:           { label: "FAQ",               fields: ["eyebrow", "heading", "body", "limit", "buttons"], note: "Questions are managed under Website Content → FAQ." },
    testimonials:  { label: "Testimonials",      fields: ["eyebrow", "heading", "items"], itemFields: ["text", "name"], note: "Only genuine, approved testimonials." },
    teachers:      { label: "Teacher profiles",  fields: ["eyebrow", "heading", "body", "items"], itemFields: ["name", "role", "text", "image"], note: "Only verified information." },
    cta:           { label: "CTA banner",        fields: ["heading", "body", "buttons"] },
    contact:       { label: "Contact details",   fields: ["eyebrow", "heading", "body"], note: "Uses the contact details from Settings." },
    gallery:       { label: "Image gallery",     fields: ["eyebrow", "heading", "items"], itemFields: ["image", "alt"] },
    rich_text:     { label: "Rich text",         fields: ["eyebrow", "heading", "body"] }
  };

  function uid() { return "s" + Math.random().toString(36).slice(2, 9); }
  function sec(type, o) { o = o || {}; o.id = o.id || uid(); o.type = type; if (o.visible === undefined) o.visible = true; return o; }

  /* ---------- default layouts (used when a page has no saved sections) ---------- */
  function defaults(slug) {
    var D = {
      home: [
        sec("hero", { eyebrow: "Learn · Practice · Grow", heading: "Quran Learning <em>Made Simple</em>",
          body: "Structured programs, caring teachers and a supportive learning journey — for every age and level.",
          image: "assets/img/hero.jpg", image_alt: "A child reading the Quran beside a sunlit window",
          button_label: "Book a Free Assessment", button_href: "/assessment", button2_label: "Explore Our Programs", button2_href: "/programs", layout: "split" }),
        sec("program_cards", { eyebrow: "Our 3 Core Programs", heading: "A clear path, one level at a time",
          body: "Each program has three levels, so every learner knows where they are and what comes next.", button_label: "See all programs", button_href: "/programs" }),
        sec("text_image", { eyebrow: "About the academy", heading: "Quran learning with care",
          body: "Inaya Quran Academy is an online Quran and Islamic learning academy. We offer structured programs, caring teachers and a supportive environment so that learners of every age and level can learn, practice and grow.",
          button_label: "About us", button_href: "/about", image: "assets/img/flyer.jpg", image_alt: "Inaya Quran Academy programs", bg: "soft" }),
        sec("benefits", { eyebrow: "Why structure matters", heading: "Benefits of structured Quran learning", columns: 4, items: [
          { title: "Clear levels", text: "Learners and parents always know the current level and the next step." },
          { title: "Right pronunciation", text: "Step-by-step practice builds accurate reading and recitation." },
          { title: "Steady progress", text: "Small, regular steps make progress visible and motivating." },
          { title: "A supportive pace", text: "Lessons move at a pace that suits the learner, with care." }] }),
        sec("process", { eyebrow: "How it works", heading: "From first message to first class", bg: "green", items: [
          { title: "Request a free assessment", text: "Fill in a short form or message us on WhatsApp." },
          { title: "We contact you", text: "Our team reaches out to arrange a convenient time." },
          { title: "Reading assessment", text: "Our assessor listens to the learner read and recommends a starting level." },
          { title: "Enroll and begin", text: "If you wish to proceed, we confirm enrollment, arrange payment, assign a teacher and schedule classes." }] }),
        sec("benefits", { eyebrow: "What you can expect", heading: "Built around the learner", columns: 4, items: [
          { title: "Qualified & caring teachers", text: "Experienced and student-focused." },
          { title: "Structured curriculum", text: "Clear levels, real progress." },
          { title: "Flexible learning", text: "Online and one-on-one options." },
          { title: "Safe & supportive environment", text: "For every learner, with care." }] }),
        sec("faq", { eyebrow: "FAQ", heading: "Questions parents often ask", limit: 5, button_label: "More questions", button_href: "/faq" }),
        sec("cta", { heading: "Ready to begin?", body: "Book a free assessment, or message us to ask about programs and enrollment.",
          button_label: "Book a Free Assessment", button_href: "/assessment", button2_label: "Chat on WhatsApp", button2_href: "{whatsapp}", bg: "soft" })
      ],
      about: [
        sec("page_head", { eyebrow: "About us", heading: "About Inaya Quran Academy",
          body: "Inaya (عناية) means care. We are an online Quran and Islamic learning academy built around structured programs and caring teaching." }),
        sec("text_image", { heading: "Our educational approach",
          body: "Learning is organised into three programs, each with three clear levels:\n\n- **Quran Reading & Fluency**\n- **Quran Recitation, Tajweed & Sunnah**\n- **Islamic Foundations & Daily Living**\n\nEvery learner begins with a free reading assessment so we can recommend the right starting level.",
          image: "assets/img/flyer.jpg", image_alt: "Inaya Quran Academy programs" }),
        sec("benefits", { eyebrow: "Mission and values", heading: "What guides us", columns: 3, bg: "soft", items: [
          { title: "Better Quran, Better You", text: "Quran learning that shapes the learner as well as the reading." },
          { title: "Learn · Practice · Grow", text: "Understanding, steady practice and visible growth." },
          { title: "Care for every learner", text: "A safe, supportive environment for every age and level." }] }),
        sec("rich_text", { heading: "Teaching philosophy",
          body: "We believe that clear structure, patient guidance and regular practice help learners build confidence. Assessments are used to understand where a learner is today — never to judge — and topics a learner has not yet been taught are simply noted as \"Not Yet Learned\"." }),
        sec("cta", { heading: "Meet us through a free assessment", body: "A short, friendly session to understand the learner's current level.",
          button_label: "Book a Free Assessment", button_href: "/assessment" })
      ],
      privacy: [
        sec("page_head", { eyebrow: "Legal", heading: "Privacy Policy", body: "How Inaya Quran Academy handles the information you share with us." }),
        sec("rich_text", { body:
"## What we collect\nWhen you request a free assessment or send a message we collect only what is needed to respond: your name, the learner's name (if different), your email and/or WhatsApp number, age group, country, learning goals, current reading level, preferred contact method and time, and your consent to be contacted.\n\n## Why we collect it\nTo contact you about your enquiry, arrange a reading assessment, recommend a suitable level and, if you wish to proceed, handle enrollment.\n\n## Who can see it\nOnly authorised staff of the academy. We do not sell your information. We use trusted service providers to host the website and store data securely.\n\n## Children\nInquiries about a child should be made by a parent or guardian. We ask only for the information needed to arrange the assessment.\n\n## Analytics and cookies\nWe count visits and button clicks (for example, clicks on the assessment button) without recording names, contact details or learner information. If optional third-party analytics is enabled, it loads only after you accept.\n\n## How long we keep it\nWe keep inquiry information for as long as it is needed for the enquiry and enrollment process, or as required by law.\n\n## Your choices\nYou may ask us to correct or delete your information at any time. Contact us using the details on the Contact page and we will respond as soon as possible.\n\n## Changes\nWe may update this policy from time to time. The current version is always on this page." }),
        sec("contact", { heading: "Questions about your information?", bg: "soft" })
      ],
      terms: [
        sec("page_head", { eyebrow: "Legal", heading: "Terms of Use", body: "Please read these terms before using the Inaya Quran Academy website." }),
        sec("rich_text", { body:
"## Using this website\nThis website provides information about Inaya Quran Academy and lets you request a free assessment or contact us. Please provide accurate information.\n\n## Assessment and enrollment\nSubmitting a form is an enquiry only. It is not an enrollment and not a payment. Enrollment, fees, teacher assignment and class schedules are confirmed separately by the academy. The free assessment is an initial evaluation to recommend a starting level; we do not guarantee particular learning outcomes.\n\n## Content\nThe name, logo, text and images on this site belong to Inaya Quran Academy and may not be copied or reused without permission.\n\n## Links\nThis site may link to other websites (for example WhatsApp or social media). We are not responsible for their content.\n\n## Changes\nWe may update these terms and the website at any time.\n\n## Contact\nQuestions about these terms can be sent to us through the Contact page." }),
        sec("contact", { heading: "Contact us", bg: "soft" })
      ]
    };
    return JSON.parse(JSON.stringify(D[slug] || []));
  }

  /* ---------- rendering ---------- */
  function btn(label, href, cls, s) {
    if (!label) return "";
    if (href === "{whatsapp}" && !I.waLink(s)) return "";   // no WhatsApp number configured yet → hide the button
    var h = I.resolveHref(href, s);
    var external = /^https?:/i.test(h);
    return '<a class="btn ' + (cls || "") + '" href="' + esc(h) + '"' + (external ? ' target="_blank" rel="noopener"' : "") + ">" + esc(label) + "</a>";
  }
  function buttons(x, s, light) {
    var a = btn(x.button_label, x.button_href, light ? "light" : "", s);
    var b = btn(x.button2_label, x.button2_href, light ? "ghost" : "ghost", s);
    return (a || b) ? '<div class="btn-row">' + a + b + "</div>" : "";
  }
  function head(x, withBody) {
    return (x.eyebrow ? '<div class="eyebrow">' + esc(x.eyebrow) + "</div>" : "") +
      (x.heading ? "<h2>" + inlineHead(x.heading) + "</h2>" : "") +
      (withBody !== false && x.body ? '<div class="rich lead-rich muted">' + md(x.body) + "</div>" : "");
  }
  /* headings allow only <em> emphasis through *…* or the literal <em>…</em> typed by the owner */
  function inlineHead(t) {
    return esc(t).replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/g, "<em>$1</em>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
  function wrap(x, inner, extraClass) {
    var bg = x.bg === "soft" ? " soft" : x.bg === "green" ? " green" : "";
    var al = x.align === "center" ? " center" : "";
    return '<section class="section' + bg + al + (extraClass ? " " + extraClass : "") + '" data-sec="' + esc(x.id) + '"><div class="container">' + inner + "</div></section>";
  }
  function cols(n) { n = parseInt(n, 10); return n === 2 ? "c2" : n === 4 ? "c4" : "c3"; }

  var R = {
    page_head: function (x) {
      return '<section class="page-hero" data-sec="' + esc(x.id) + '"><div class="container">' +
        (x.eyebrow ? '<div class="eyebrow">' + esc(x.eyebrow) + "</div>" : "") +
        "<h1>" + inlineHead(x.heading) + "</h1>" + (x.body ? '<p class="lead">' + I.inline(x.body) + "</p>" : "") + "</div></section>";
    },
    hero: function (x, c) {
      var img = I.safeImg(x.image), center = x.layout === "center" || !img;
      var art = img ? '<div class="hero-art"><div class="arch"><img src="' + esc(img) + '" alt="' + esc(x.image_alt || "") + '" width="930" height="910" fetchpriority="high"></div>' +
        '<div class="hero-badge"><strong>3 programs · 3 levels each</strong>Online &amp; one-on-one options</div></div>' : "";
      return '<section class="hero' + (center ? " center" : "") + '" data-sec="' + esc(x.id) + '"><div class="container hero-grid"><div>' +
        (x.eyebrow ? '<div class="eyebrow">' + esc(x.eyebrow) + "</div>" : "") +
        "<h1>" + inlineHead(x.heading) + "</h1>" +
        (x.body ? '<p class="lead">' + I.inline(x.body) + "</p>" : "") + buttons(x, c.settings) + "</div>" + art + "</div></section>";
    },
    text_image: function (x, c) {
      var img = I.safeImg(x.image);
      var media = img ? '<div class="split-media"><img src="' + esc(img) + '" alt="' + esc(x.image_alt || "") + '" loading="lazy"></div>' : "";
      return wrap(x, '<div class="split' + (x.reverse ? " rev" : "") + '"><div>' + head(x) + buttons(x, c.settings) + "</div>" + media + "</div>");
    },
    program_cards: function (x, c) {
      var cards = (c.programs || []).map(function (p, i) {
        var lv = (p.levels || []).map(function (l) { return '<li><span class="pill">Level ' + esc(l.level_number) + "</span><span>" + esc(l.title) + "</span></li>"; }).join("");
        return '<article class="card"><div class="icon-dot" aria-hidden="true">' + (i + 1) + "</div><h3>" + esc(p.title) + '</h3><p class="sub">' + esc(p.short_description) + '</p><ul class="levels">' + lv +
          '</ul><a class="more" href="/programs/' + encodeURIComponent(p.slug) + '">Learn more →</a></article>';
      }).join("");
      return wrap(x, '<div class="sec-head">' + head(x) + "</div>" + (cards ? '<div class="grid c3">' + cards + "</div>" : '<div class="empty">Programs will appear here soon.</div>') + buttons(x, c.settings));
    },
    level_list: function (x, c) {
      var blocks = (c.programs || []).map(function (p) {
        var lv = (p.levels || []).map(function (l) {
          return '<div class="level-block"><h3><span class="pill">Level ' + esc(l.level_number) + "</span>" + esc(l.title) + "</h3>" + (l.description ? "<p>" + esc(l.description) + "</p>" : "") + "</div>";
        }).join("");
        return "<div><h3>" + esc(p.title) + "</h3>" + lv + "</div>";
      }).join("");
      return wrap(x, '<div class="sec-head">' + head(x) + '</div><div class="grid c3">' + blocks + "</div>");
    },
    benefits: function (x) {
      var items = (x.items || []).map(function (it) {
        return '<div class="card"><h3>' + esc(it.title) + '</h3><p class="muted" style="margin:0">' + esc(it.text) + "</p></div>";
      }).join("");
      return wrap(x, '<div class="sec-head">' + head(x) + '</div><div class="grid ' + cols(x.columns) + '">' + items + "</div>");
    },
    process: function (x) {
      var items = (x.items || []).map(function (it) { return '<div class="step"><h3>' + esc(it.title) + "</h3><p>" + esc(it.text) + "</p></div>"; }).join("");
      return wrap(x, '<div class="sec-head">' + head(x) + '</div><div class="steps">' + items + "</div>");
    },
    stats: function (x) {
      var items = (x.items || []).map(function (it) { return '<div class="stat"><b>' + esc(it.value) + "</b><span class=\"muted\">" + esc(it.label) + "</span></div>"; }).join("");
      return wrap(x, '<div class="sec-head">' + head(x, false) + '</div><div class="grid c4">' + items + "</div>");
    },
    faq: function (x, c) {
      var list = (c.faqs || []).slice(0, parseInt(x.limit, 10) > 0 ? parseInt(x.limit, 10) : 100);
      return wrap(x, '<div class="sec-head">' + head(x) + "</div>" + faqHtml(list) + buttons(x, c.settings));
    },
    testimonials: function (x) {
      var items = (x.items || []).map(function (it) { return '<figure class="card" style="margin:0"><blockquote class="quote" style="margin:0 0 12px">“' + esc(it.text) + "”</blockquote><figcaption class=\"muted\">— " + esc(it.name) + "</figcaption></figure>"; }).join("");
      return wrap(x, '<div class="sec-head">' + head(x, false) + '</div><div class="grid c3">' + items + "</div>");
    },
    teachers: function (x) {
      var items = (x.items || []).map(function (it) {
        var im = I.safeImg(it.image);
        return '<div class="card person">' + (im ? '<img src="' + esc(im) + '" alt="' + esc(it.name) + '" loading="lazy">' : "") + "<h3>" + esc(it.name) + '</h3><p class="sub">' + esc(it.role) + '</p><p style="margin:0">' + esc(it.text) + "</p></div>";
      }).join("");
      return wrap(x, '<div class="sec-head">' + head(x) + '</div><div class="grid c3">' + items + "</div>");
    },
    cta: function (x, c) {
      var green = x.bg === "green";
      return wrap(Object.assign({ align: "center" }, x), '<div class="cta-box">' + head(x) + buttons(x, c.settings, green) + "</div>");
    },
    contact: function (x, c) {
      var s = c.settings, wa = I.waLink(s), rows = "";
      if (s.contact_email) rows += '<li><span class="k">Email</span><a href="mailto:' + esc(s.contact_email) + '">' + esc(s.contact_email) + "</a></li>";
      if (wa) rows += '<li><span class="k">WhatsApp</span><a class="js-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">Message us on WhatsApp</a></li>';
      var so = s.social || {};
      ["facebook", "instagram", "telegram", "youtube"].forEach(function (k) {
        if (/^https?:\/\//i.test(so[k] || "")) rows += '<li><span class="k">' + k[0].toUpperCase() + k.slice(1) + '</span><a href="' + esc(so[k]) + '" target="_blank" rel="noopener">' + esc(so[k].replace(/^https?:\/\/(www\.)?/, "")) + "</a></li>";
      });
      if (s.response_time) rows += '<li><span class="k">Response</span><span>' + esc(s.response_time) + "</span></li>";
      if (!rows) rows = '<li><span class="muted">Contact details will be added soon. Please use the form on the Contact page.</span></li>';
      return wrap(x, '<div class="sec-head">' + head(x) + '</div><ul class="contact-list">' + rows + "</ul>");
    },
    gallery: function (x) {
      var items = (x.items || []).map(function (it) { var im = I.safeImg(it.image); return im ? '<img src="' + esc(im) + '" alt="' + esc(it.alt || "") + '" loading="lazy">' : ""; }).join("");
      return wrap(x, '<div class="sec-head">' + head(x, false) + '</div><div class="grid c3 gallery">' + items + "</div>");
    },
    rich_text: function (x) {
      return wrap(x, '<div class="rich" style="max-width:760px">' + (x.eyebrow ? '<div class="eyebrow">' + esc(x.eyebrow) + "</div>" : "") + (x.heading ? "<h2>" + inlineHead(x.heading) + "</h2>" : "") + md(x.body) + "</div>");
    }
  };

  function faqHtml(list) {
    if (!list.length) return '<div class="empty">Questions will appear here soon.</div>';
    var out = '<div class="faq">', last = null;
    list.forEach(function (f) {
      out += '<details><summary>' + esc(f.question) + '</summary><div class="ans">' + md(f.answer) + "</div></details>";
    });
    return out + "</div>";
  }
  function faqByCategory(list) {
    if (!list.length) return faqHtml(list);
    var cats = [], map = {};
    list.forEach(function (f) { var k = f.category || "General"; if (!map[k]) { map[k] = []; cats.push(k); } map[k].push(f); });
    return cats.map(function (k) { return '<h3 class="faq-cat">' + esc(k) + "</h3>" + faqHtml(map[k]); }).join("");
  }

  function render(sections, ctx) {
    return (sections || []).filter(function (x) { return x && x.visible !== false && R[x.type]; })
      .map(function (x) { try { return R[x.type](x, ctx); } catch (e) { console.error(e); return ""; } }).join("");
  }

  /* ---------- program detail ---------- */
  function programDetail(p, ctx) {
    var s = ctx.settings;
    var obj = (p.objectives || []).map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("");
    var lv = (p.levels || []).map(function (l) {
      return '<div class="level-block"><h3><span class="pill">Level ' + esc(l.level_number) + "</span>" + esc(l.title) + "</h3>" + (l.description ? "<p>" + esc(l.description) + "</p>" : "") + "</div>";
    }).join("");
    var img = I.safeImg(p.image_url);
    var ctaLabel = p.cta_label || s.cta_primary_label;
    return '<section class="page-hero"><div class="container"><div class="eyebrow"><a href="/programs" style="text-decoration:none;color:inherit">Programs</a> / Program</div><h1>' + esc(p.title) + '</h1><p class="lead">' + esc(p.short_description) + "</p></div></section>" +
      '<section class="section"><div class="container detail-grid"><div>' +
      (img ? '<img src="' + esc(img) + '" alt="' + esc(p.title) + '" style="border-radius:14px;margin-bottom:24px;border:1px solid var(--border)">' : "") +
      '<div class="rich">' + md(p.description) + "</div>" +
      (obj ? "<h2 style=\"margin-top:1.6em\">What learners work towards</h2><ul class=\"checklist\">" + obj + "</ul>" : "") +
      (lv ? '<h2 style="margin-top:1.6em">Levels</h2>' + lv : "") +
      (p.curriculum_overview ? '<h2 style="margin-top:1.6em">Curriculum overview</h2><div class="rich">' + md(p.curriculum_overview) + "</div>" : "") +
      '</div><aside><div class="card aside-card">' +
      (p.student_profile ? "<h3>Suitable for</h3><p>" + esc(p.student_profile) + "</p>" : "") +
      '<p class="muted" style="font-size:.9rem">Start with a free reading assessment — our assessor will recommend the right level.</p>' +
      '<a class="btn" href="/assessment?program=' + encodeURIComponent(p.slug) + '">' + esc(ctaLabel) + "</a>" +
      (I.waLink(s) ? '<a class="btn ghost js-wa" style="margin-top:10px" href="' + esc(I.waLink(s)) + '" target="_blank" rel="noopener">Ask on WhatsApp</a>' : "") +
      "</div></aside></div></section>";
  }

  function programsOverview(ctx) {
    var ps = ctx.programs || [];
    if (!ps.length) return '<div class="empty">Programs will appear here soon.</div>';
    return ps.map(function (p, i) {
      var lv = (p.levels || []).map(function (l) { return '<li><span class="pill">Level ' + esc(l.level_number) + "</span><span>" + esc(l.title) + "</span></li>"; }).join("");
      var obj = (p.objectives || []).slice(0, 4).map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("");
      return '<article class="section ' + (i % 2 ? "soft" : "") + '" style="padding:56px 0"><div class="container detail-grid"><div><div class="eyebrow">Program ' + (i + 1) + "</div><h2>" + esc(p.title) + "</h2>" +
        '<p class="lead">' + esc(p.short_description) + "</p><div class=\"rich\">" + md(p.description) + "</div>" +
        (obj ? '<ul class="checklist" style="margin-top:1rem">' + obj + "</ul>" : "") +
        (p.student_profile ? '<p><strong>Suitable for:</strong> ' + esc(p.student_profile) + "</p>" : "") +
        '<div class="btn-row"><a class="btn" href="/programs/' + encodeURIComponent(p.slug) + '">View program details</a><a class="btn ghost" href="/assessment?program=' + encodeURIComponent(p.slug) + '">' + esc(p.cta_label || ctx.settings.cta_primary_label) + '</a></div></div>' +
        '<div class="card"><h3>Levels</h3><ul class="levels" style="margin:0">' + lv + "</ul></div></div></article>";
    }).join("");
  }

  window.InayaSections = { TYPES: TYPES, defaults: defaults, render: render, faqHtml: faqHtml, faqByCategory: faqByCategory, programDetail: programDetail, programsOverview: programsOverview, uid: uid, newSection: sec };
})();
