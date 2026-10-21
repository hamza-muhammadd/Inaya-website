/* Inaya Quran Academy, controlled section library
   Used by the public pages AND by the admin live preview.
   No arbitrary HTML/JS is ever rendered: every field is escaped or passed
   through the safe formatter in site.js. */
(function () {
  "use strict";
  var I = window.Inaya, esc = I.esc, md = I.md, safeHref = I.safeHref;

  /* ---------- section type catalogue (drives the admin editor forms) ---------- */
  var TYPES = {
    page_head:     { label: "Page heading",      fields: ["eyebrow", "heading", "body"] },
    hero:          { label: "Hero",              fields: ["eyebrow", "heading", "body", "image", "image_alt", "buttons", "note", "layout"] },
    text_image:    { label: "Text and image",    fields: ["eyebrow", "heading", "body", "image", "image_alt", "buttons", "reverse"] },
    rows:          { label: "Rows (title, text, link)", fields: ["eyebrow", "heading", "body", "items"], itemFields: ["title", "text", "label", "href"], note: "A calm list: a title on one side, text and an optional link on the other." },
    program_cards: { label: "Programs",          fields: ["eyebrow", "heading", "body", "buttons", "style"], note: "Cards are filled automatically from Programs & Curriculum." },
    level_list:    { label: "Level list",        fields: ["eyebrow", "heading", "body"], note: "Lists every published program with its levels." },
    benefits:      { label: "Benefits / points", fields: ["eyebrow", "heading", "body", "items", "columns"], itemFields: ["title", "text"] },
    process:       { label: "Step-by-step process", fields: ["eyebrow", "heading", "body", "items", "plist"], itemFields: ["title", "text"] },
    stats:         { label: "Statistics",        fields: ["eyebrow", "heading", "items"], itemFields: ["value", "label"], note: "Use ONLY real, verified numbers." },
    faq:           { label: "FAQ",               fields: ["eyebrow", "heading", "body", "limit", "buttons"], note: "Questions are managed under Website Content → FAQ." },
    testimonials:  { label: "Testimonials",      fields: ["eyebrow", "heading", "items"], itemFields: ["text", "name"], note: "Only genuine, approved testimonials." },
    teachers:      { label: "Teacher profiles",  fields: ["eyebrow", "heading", "body", "items"], itemFields: ["name", "role", "text", "image"], note: "Only verified information." },
    cta:           { label: "CTA banner",        fields: ["heading", "body", "buttons"] },
    contact:       { label: "Contact details",   fields: ["eyebrow", "heading", "body"], note: "Uses the contact details from Settings." },
    gallery:       { label: "Image gallery",     fields: ["eyebrow", "heading", "items"], itemFields: ["image", "alt"] },
    programs_detail: { label: "Programs in detail", fields: [], note: "Shows every published program with its description, objectives and levels. Content comes from Programs & Curriculum." },
    faq_all:       { label: "FAQ (all, by category)", fields: ["eyebrow", "heading"], note: "Shows every published question, grouped by category. Questions are managed under Website Content, FAQ." },
    assessment_form: { label: "Assessment request form", fields: [], note: "The free assessment form. Requests arrive in Leads & Inquiries. Visitors see the live form; this is a placeholder in the preview." },
    contact_form:  { label: "Contact form + details", fields: [], note: "The message form with your contact details beside it. Messages arrive in Leads & Inquiries. Visitors see the live form; this is a placeholder in the preview." },
    rich_text:     { label: "Rich text",         fields: ["eyebrow", "heading", "body"] }
  };

  function uid() { return "s" + Math.random().toString(36).slice(2, 9); }
  function sec(type, o) { o = o || {}; o.id = o.id || uid(); o.type = type; if (o.visible === undefined) o.visible = true; return o; }

  /* ---------- default layouts (used when a page has no saved sections) ---------- */
  function defaults(slug) {
    var D = {
      home: [
        sec("hero", { eyebrow: "Online Quran classes", heading: "Learn to read the Quran well, starting from where you are",
          body: "Inaya Quran Academy teaches Quran reading, Tajweed and Islamic basics online, to children and adults. A short free assessment shows us your level, so you begin in the right place.",
          image: "assets/img/hero.jpg", image_alt: "A child reading the Quran beside a sunlit window",
          button_label: "Book a Free Assessment", button_href: "/assessment", button2_label: "See the programs", button2_href: "/programs",
          note: "Online classes · Children and adults · Free reading assessment", layout: "split" }),
        sec("rows", { eyebrow: "Find your starting point", heading: "Where would you like to begin?", items: [
          { title: "I am new to reading Arabic", text: "Start with Quran Reading & Fluency. The first level begins with the letters and their vowel marks.", label: "See Quran Reading & Fluency", href: "/programs/quran-reading-fluency" },
          { title: "I can read, and I want to recite correctly", text: "Quran Recitation, Tajweed & Sunnah covers correct pronunciation and the essential rules of Tajweed.", label: "See Recitation and Tajweed", href: "/programs/quran-recitation-tajweed-sunnah" },
          { title: "I want to learn the basics of Islam", text: "Islamic Foundations & Daily Living covers core foundations, worship, Sunnah and character in daily life.", label: "See Islamic Foundations", href: "/programs/islamic-foundations-daily-living" },
          { title: "I am looking for a class for my child", text: "Children and adults of every age can join. Share the age group in the assessment form and we will guide you.", label: "Book a free assessment", href: "/assessment" },
          { title: "I am not sure where I fit", text: "The free assessment is a short reading check. Our assessor listens to the learner read and recommends a level.", label: "Book a free assessment", href: "/assessment" }] }),
        sec("program_cards", { eyebrow: "The programs", heading: "Three programs, three levels each", style: "rows", bg: "soft",
          body: "Each level builds on the one before, so you always know where you are and what comes next.", button_label: "See all programs", button_href: "/programs" }),
        sec("process", { eyebrow: "How it works", heading: "What happens after you get in touch", plist: "list",
          body: "The assessment is free. It is not an enrollment and not a payment.", items: [
          { title: "Send a request", text: "Fill in the short assessment form, or message us on WhatsApp." },
          { title: "We contact you", text: "Our team reaches out to arrange a convenient time." },
          { title: "Reading assessment", text: "Our assessor listens to the learner read and recommends a starting level." },
          { title: "Enrollment", text: "If you wish to continue, we confirm enrollment, arrange payment, assign a teacher and schedule classes." }] }),
        sec("text_image", { eyebrow: "How we teach", heading: "Clear levels and patient practice",
          body: "We believe that clear structure, patient guidance and regular practice help learners build confidence. An assessment is used to understand where a learner is today, never to judge them. Topics a learner has not been taught yet are simply marked Not Yet Learned.",
          button_label: "About the academy", button_href: "/about", bg: "soft" }),
        sec("teachers", { visible: false, eyebrow: "Our teachers", heading: "Meet the teachers", body: "", items: [] }),
        sec("faq", { eyebrow: "Questions", heading: "Questions people ask before starting", limit: 5, button_label: "All questions", button_href: "/faq" }),
        sec("cta", { heading: "Not sure which program fits?", body: "Book a free assessment, or message us with your question.",
          button_label: "Book a Free Assessment", button_href: "/assessment", button2_label: "Chat on WhatsApp", button2_href: "{whatsapp}", bg: "green" })
      ],
      programs: [
        sec("page_head", { eyebrow: "Our 3 Core Programs", heading: "Programs & levels", body: "Structured programs for every age and level. Each program has three clear levels. Begin with a free assessment and we will recommend the right starting point." }),
        sec("programs_detail", {}),
        sec("cta", { heading: "Not sure where to start?", body: "A free reading assessment helps us recommend the right program and level.", button_label: "Book a Free Assessment", button_href: "/assessment", button2_label: "Chat on WhatsApp", button2_href: "{whatsapp}", bg: "green" })
      ],
      faq: [
        sec("page_head", { eyebrow: "FAQ", heading: "Frequently asked questions", body: "Can't find your answer? Message us and we will be happy to help." }),
        sec("faq_all", {}),
        sec("cta", { heading: "Still have a question?", body: "Send us a message or book a free assessment.", button_label: "Contact us", button_href: "/contact", button2_label: "Book a Free Assessment", button2_href: "/assessment", bg: "soft" })
      ],
      contact: [
        sec("page_head", { eyebrow: "Contact", heading: "We'd love to hear from you", body: "Questions about programs, the free assessment or enrollment? Send us a message." }),
        sec("contact_form", {})
      ],
      assessment: [
        sec("page_head", { eyebrow: "Free assessment", heading: "Book a free Quran reading assessment", body: "Tell us a little about the learner. Our team will contact you to arrange a short reading assessment and recommend a starting level." }),
        sec("assessment_form", {})
      ],
      about: [
        sec("page_head", { eyebrow: "About us", heading: "About Inaya Quran Academy",
          body: "Inaya (عناية) means care. We are an online Quran and Islamic learning academy built around structured programs and caring teaching." }),
        sec("text_image", { heading: "Our educational approach",
          body: "Learning is organised into three programs, each with three clear levels:\n\n- Quran Reading & Fluency\n- Quran Recitation, Tajweed & Sunnah\n- Islamic Foundations & Daily Living\n\nEvery learner begins with a free reading assessment so we can recommend the right starting level." }),
        sec("rows", { eyebrow: "Mission and values", heading: "What guides us", bg: "soft", items: [
          { title: "Better Quran, Better You", text: "Quran learning that shapes the learner as well as the reading." },
          { title: "Learn · Practice · Grow", text: "Understanding, steady practice and visible growth." },
          { title: "Care for every learner", text: "A safe, supportive environment for every age and level." }] }),
        sec("rich_text", { eyebrow: "Teaching philosophy", heading: "How we help learners progress",
          body: "We believe that clear structure, patient guidance and regular practice help learners build confidence. Assessments are used to understand where a learner is today, never to judge them, and topics a learner has not yet been taught are simply noted as \"Not Yet Learned\".\n\n- Strong foundations in reading\n- Accurate recitation\n- Tajweed rules learned and then applied\n- Teaching at the learner's own level\n- A clear path through three levels" }),
        sec("teachers", { visible: false, eyebrow: "The people behind the academy", heading: "Our teachers", body: "", items: [] }),
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
    return esc(t).replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/g, "<em>$1</em>").replace(/\[\[([^\]]+)\]\]/g, "<em>$1</em>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
  var ANIMS = { up: 1, fade: 1, zoom: 1, left: 1, right: 1, none: 1 };
  function anim(a) { return ANIMS[a] ? a : "up"; }
  function wrap(x, inner, extraClass) {
    var bg = x.bg === "soft" ? " soft" : x.bg === "green" ? " green" : "";
    var al = x.align === "center" ? " center" : "";
    return '<section class="section' + bg + al + (extraClass ? " " + extraClass : "") + '" data-sec="' + esc(x.id) + '" data-anim="' + anim(x.anim) + '"><div class="container">' + inner + "</div></section>";
  }
  function cols(n) { n = parseInt(n, 10); return n === 2 ? "c2" : n === 4 ? "c4" : "c3"; }

  /* Forms are mounted by forms.js after the page is drawn. The text inside is only shown in the admin preview. */
  function mountPoint(x, kind, note) {
    return '<div data-mount="' + kind + '" data-sec="' + esc(x.id) + '"><section class="section"><div class="container"><div class="card" style="text-align:center"><p class="muted" style="margin:0">' + esc(note) + "</p></div></div></section></div>";
  }
  var META = {
    home: { title: "Home", description: "" },
    programs: { title: "Programs", description: "Three structured programs, three levels each." },
    faq: { title: "FAQ", description: "Answers to common questions about programs, assessment and enrollment." },
    contact: { title: "Contact", description: "Get in touch with Inaya Quran Academy." },
    assessment: { title: "Book a Free Assessment", description: "Request a free Quran reading assessment." },
    about: { title: "About", description: "" }, privacy: { title: "Privacy Policy", description: "" }, terms: { title: "Terms of Use", description: "" }
  };
  var R = {
    page_head: function (x) {
      return '<section class="page-hero" data-sec="' + esc(x.id) + '" data-anim="' + anim(x.anim) + '"><div class="container">' +
        (x.eyebrow ? '<div class="eyebrow">' + esc(x.eyebrow) + "</div>" : "") +
        "<h1>" + inlineHead(x.heading) + "</h1>" + (x.body ? '<p class="lead">' + I.inline(x.body) + "</p>" : "") + "</div></section>";
    },
    hero: function (x, c) {
      var img = I.safeImg(x.image), center = x.layout === "center" || !img;
      var art = img ? '<div class="hero-art"><div class="arch"><img src="' + esc(img) + '" alt="' + esc(x.image_alt || "") + '" width="930" height="910" fetchpriority="high"></div></div>' : "";
      var note = x.note ? '<p class="hero-note">' + esc(x.note).split(" · ").join('<span aria-hidden="true"> · </span>') + "</p>" : "";
      return '<section class="hero' + (center ? " center" : "") + '" data-sec="' + esc(x.id) + '" data-anim="' + anim(x.anim) + '"><div class="container hero-grid"><div>' +
        (x.eyebrow ? '<div class="eyebrow">' + esc(x.eyebrow) + "</div>" : "") +
        "<h1>" + inlineHead(x.heading) + "</h1>" +
        (x.body ? '<p class="lead">' + I.inline(x.body) + "</p>" : "") + buttons(x, c.settings) + note + "</div>" + art + "</div></section>";
    },
    rows: function (x, c) {
      var items = (x.items || []).map(function (it) {
        var link = it.label && it.href ? '<a class="row-link" href="' + esc(safeHref(I.resolveHref(it.href, c.settings))) + '">' + esc(it.label) + ' <span class="arr" aria-hidden="true">→</span></a>' : "";
        return '<li class="rw"><h3>' + esc(it.title) + '</h3><div><p>' + esc(it.text) + "</p>" + link + "</div></li>";
      }).join("");
      return wrap(x, '<div class="sec-head">' + head(x) + '</div><ul class="rows">' + items + "</ul>");
    },
    text_image: function (x, c) {
      var img = I.safeImg(x.image);
      var media = img ? '<div class="split-media"><img src="' + esc(img) + '" alt="' + esc(x.image_alt || "") + '" loading="lazy"></div>' : "";
      return wrap(x, '<div class="split' + (x.reverse ? " rev" : "") + (img ? "" : " one") + '"><div>' + head(x) + buttons(x, c.settings) + "</div>" + media + "</div>");
    },
    program_cards: function (x, c) {
      if (x.style === "rows") {
        var rows = (c.programs || []).map(function (p, i) {
          var lv = (p.levels || []).map(function (l) { return '<li><span class="lv">Level ' + esc(l.level_number) + "</span> " + esc(l.title) + "</li>"; }).join("");
          return '<li class="pr"><span class="pr-n" aria-hidden="true">' + (i + 1) + '</span><div class="pr-main"><h3><a href="/programs/' + encodeURIComponent(p.slug) + '">' + esc(p.title) + "</a></h3><p>" + esc(p.short_description) + '</p><a class="row-link" href="/programs/' + encodeURIComponent(p.slug) + '">Learn more <span class="arr" aria-hidden="true">→</span></a></div><ul class="pr-levels">' + lv + "</ul></li>";
        }).join("");
        return wrap(x, '<div class="sec-head">' + head(x) + "</div>" + (rows ? '<ol class="prog-rows">' + rows + "</ol>" : '<div class="empty">Programs will appear here soon.</div>') + buttons(x, c.settings));
      }
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
    process: function (x, c) {
      var list = x.plist === "list";
      if (list) {
        var li = (x.items || []).map(function (it) { return "<li><h3>" + esc(it.title) + "</h3><p>" + esc(it.text) + "</p></li>"; }).join("");
        return wrap(x, '<div class="split top"><div>' + head(x) + buttons(x, c && c.settings) + '</div><ol class="timeline">' + li + "</ol></div>");
      }
      var items = (x.items || []).map(function (it) { return '<div class="step"><h3>' + esc(it.title) + "</h3><p>" + esc(it.text) + "</p></div>"; }).join("");
      return wrap(x, '<div class="sec-head">' + head(x) + '</div><div class="steps">' + items + "</div>");
    },
    stats: function (x) {
      var items = (x.items || []).map(function (it) { return '<div class="stat"><b>' + esc(it.value) + "</b><span class=\"muted\">" + esc(it.label) + "</span></div>"; }).join("");
      return wrap(x, '<div class="sec-head">' + head(x, false) + '</div><div class="grid c4">' + items + "</div>");
    },
    programs_detail: function (x, c) { return '<div data-sec="' + esc(x.id) + '" data-anim="' + anim(x.anim) + '">' + programsOverview(c) + "</div>"; },
    faq_all: function (x, c) {
      return wrap(x, (x.heading || x.eyebrow ? '<div class="sec-head">' + head(x) + "</div>" : "") + faqByCategory(c.faqs || []));
    },
    assessment_form: function (x) { return mountPoint(x, "assessment", "The free assessment form appears here."); },
    contact_form: function (x) { return mountPoint(x, "contact", "The contact form and your contact details appear here."); },
    faq: function (x, c) {
      var list = (c.faqs || []).slice(0, parseInt(x.limit, 10) > 0 ? parseInt(x.limit, 10) : 100);
      return wrap(x, '<div class="sec-head">' + head(x) + "</div>" + faqHtml(list) + buttons(x, c.settings));
    },
    testimonials: function (x) {
      var items = (x.items || []).map(function (it) { return '<figure class="card" style="margin:0"><blockquote class="quote" style="margin:0 0 12px">“' + esc(it.text) + "”</blockquote><figcaption class=\"muted\">" + esc(it.name) + "</figcaption></figure>"; }).join("");
      return wrap(x, '<div class="sec-head">' + head(x, false) + '</div><div class="grid c3">' + items + "</div>");
    },
    teachers: function (x) {
      if (!(x.items || []).length) return "";
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

  /* Owner-written translations live in section.i18n = { bn: {heading: "..."}, ar: {...} }.
     Text fields are replaced for the visitor's language; lists are matched by position. */
  function overlay(x) {
    var L = window.InayaI18n && window.InayaI18n.lang, o = x && x.i18n && L && x.i18n[L];
    if (!o) return x;
    var y = JSON.parse(JSON.stringify(x));
    Object.keys(o).forEach(function (k) {
      if (k === "items" && Array.isArray(o.items) && Array.isArray(y.items)) {
        o.items.forEach(function (it, i) { if (it && y.items[i]) Object.keys(it).forEach(function (f) { if (it[f]) y.items[i][f] = it[f]; }); });
      } else if (typeof o[k] === "string" && o[k].trim()) y[k] = o[k];
    });
    return y;
  }
  function render(sections, ctx) {
    return (sections || []).filter(function (x) { return x && x.visible !== false && R[x.type]; })
      .map(overlay).map(function (x) { try { return R[x.type](x, ctx); } catch (e) { console.error(e); return ""; } }).join("");
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
      '<p class="muted" style="font-size:.9rem">Start with a free reading assessment. Our assessor will recommend the right level.</p>' +
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

  /* Pages saved by the very first version still hold the old default layout. If a page has never been edited,
     show the current default design instead. A page the owner changed is never touched. */
  function isLegacySeed(slug, sections) {
    var f = function (t) { return (sections || []).filter(function (x) { return x && x.type === t; })[0]; };
    if (slug === "home") { var h = f("hero"); return !!(h && /Made Simple/.test(h.heading || "") && sections.length === 8); }
    if (slug === "about") { var t = f("text_image"), b = f("benefits"); return !!(t && b && t.heading === "Our educational approach" && sections.length === 5 && !f("rows")); }
    return false;
  }
  window.InayaSections = { isLegacySeed: isLegacySeed, META: META, TYPES: TYPES, defaults: defaults, render: render, faqHtml: faqHtml, faqByCategory: faqByCategory, programDetail: programDetail, programsOverview: programsOverview, uid: uid, newSection: sec };
})();
