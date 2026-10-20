/* Assessment inquiry + contact forms.
   Client-side validation is for convenience only. the same rules are
   enforced again inside the database functions submit_lead / submit_contact. */
(function () {
  "use strict";
  var I = window.Inaya, esc = I.esc;

  var ERRORS = {
    invalid_name: "Please enter your name.",
    contact_required: "Please give an email address or a WhatsApp number so we can reach you.",
    invalid_email: "That email address does not look right.",
    invalid_whatsapp: "That WhatsApp number looks too short. Include the country code, e.g. +880…",
    consent_required: "Please tick the box so we are allowed to contact you.",
    invalid_input: "Please check the highlighted fields.",
    rate_limited: "We are receiving many requests right now. Please try again in a minute.",
    not_configured: "This form is not available right now. Please contact us on WhatsApp or by email.",
    network: "We could not reach the server. Please check your connection and try again."
  };
  function friendly(code) { return ERRORS[code] || "Something went wrong. Please try again, or contact us on WhatsApp."; }

  function opts(list, placeholder) {
    return '<option value="">' + esc(placeholder || "Select…") + "</option>" + list.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + "</option>"; }).join("");
  }
  function validEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }
  function showErr(form, name, msg) {
    var el = form.querySelector('[data-err="' + name + '"]'), inp = form.querySelector('[name="' + name + '"]');
    if (el) el.textContent = msg || "";
    if (inp) inp.classList.toggle("invalid", !!msg);
  }
  function clearErrs(form) { form.querySelectorAll("[data-err]").forEach(function (e) { e.textContent = ""; }); form.querySelectorAll(".invalid").forEach(function (e) { e.classList.remove("invalid"); }); }
  function uuid() { try { return crypto.randomUUID(); } catch (e) { return String(Date.now()) + Math.random().toString(16).slice(2); } }
  function data(form) {
    var o = {}; new FormData(form).forEach(function (v, k) { o[k] = typeof v === "string" ? v.trim() : v; });
    o.consent = !!form.querySelector('[name="consent"]:checked');
    return o;
  }
  function field(name, label, control, hint, required) {
    return '<div class="field"><label for="f_' + name + '">' + esc(label) + (required ? ' <span class="req">(required)</span>' : "") + "</label>" + control +
      (hint ? '<div class="hint">' + esc(hint) + "</div>" : "") + '<div class="err" data-err="' + name + '" role="alert"></div></div>';
  }
  function input(name, type, extra) { return '<input id="f_' + name + '" name="' + name + '" type="' + type + '" ' + (extra || "") + ">"; }

  /* ================= assessment ================= */
  function assessment(s) {
    var main = document.getElementById("main"), ff = s.form_fields || {};
    return I.loadPrograms().then(function (programs) {
      var titles = programs.map(function (p) { return p.title; });
      var wa = I.waLink(s);
      var notConf = !I.configured;
      var h = '<section class="page-hero"><div class="container"><div class="eyebrow">Free assessment</div><h1>Book a free Quran reading assessment</h1>' +
        '<p class="lead">Tell us a little about the learner. Our team will contact you to arrange a short reading assessment and recommend a starting level.</p></div></section>' +
        '<section class="section"><div class="container"><div class="form-wrap" id="formwrap">' +
        (notConf ? '<div class="alert bad">This form is not connected yet. Please contact us' + (wa ? ' on <a class="js-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : "") + ".</div>" : "") +
        '<form class="form-card" id="aform" novalidate><div id="aform-msg" aria-live="polite"></div>' +
        field("name", "Your name (parent or adult learner)", input("name", "text", 'autocomplete="name" required maxlength="120"'), "", true) +
        (ff.student_name !== false ? field("student_name", "Student's name (if different)", input("student_name", "text", 'maxlength="120"'), "Only if the learner is a child or someone else.") : "") +
        '<div class="row2">' + field("email", "Email", input("email", "email", 'autocomplete="email" maxlength="200"')) + field("whatsapp", "WhatsApp number", input("whatsapp", "tel", 'autocomplete="tel" maxlength="24" placeholder="+880…"'), "Include the country code.") + "</div>" +
        '<div class="hint" style="margin:-8px 0 18px">Please give at least one: email or WhatsApp.</div>' +
        '<div class="row2">' +
        (ff.age_group !== false ? field("age_group", "Learner's age group", '<select id="f_age_group" name="age_group">' + opts(["Under 6", "6–8", "9–12", "13–17", "Adult (18+)"], "Select age group") + "</select>") : "") +
        (ff.country !== false ? field("country", "Country / time zone", input("country", "text", 'maxlength="80" placeholder="e.g. UK, GMT"')) : "") + "</div>" +
        field("program_interest", "Program of interest", '<select id="f_program_interest" name="program_interest">' + opts(titles.concat(["Not sure yet"]), "Select a program") + "</select>") +
        (ff.reading_level !== false ? field("reading_level", "Current Quran reading level", '<select id="f_reading_level" name="reading_level">' + opts(["Beginner (not yet reading Arabic letters)", "Reads letters, but slowly", "Reads with some mistakes", "Reads fluently - wants Tajweed / recitation help", "Not sure"], "Select the closest option") + "</select>", "A rough idea is fine - the assessor will check the real level.") : "") +
        field("goal", "Learning goals / main difficulty", '<textarea id="f_goal" name="goal" maxlength="1500" placeholder="What would you like the learner to achieve?"></textarea>') +
        '<div class="row2">' + field("contact_method", "Preferred contact method", '<select id="f_contact_method" name="contact_method">' + opts(["WhatsApp", "Email"], "No preference") + "</select>") +
        (ff.preferred_time !== false ? field("preferred_time", "Preferred time to be contacted", input("preferred_time", "text", 'maxlength="120" placeholder="e.g. evenings, weekends")')) : "") + "</div>" +
        '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<div class="field"><label class="check"><input type="checkbox" name="consent" id="f_consent"><span>I agree that Inaya Quran Academy may contact me about this inquiry. <a href="/privacy" target="_blank">Privacy Policy</a></span></label><div class="err" data-err="consent" role="alert"></div></div>' +
        '<button class="btn" type="submit" id="asubmit"' + (notConf ? " disabled" : "") + ">Request my free assessment</button>" +
        '<p class="hint" style="margin-top:12px">This form is an inquiry only. It is not an enrollment or a payment.</p></form></div></div></section>';
      main.innerHTML = h;

      var form = document.getElementById("aform"), key = uuid(), started = false, busy = false;
      // pre-select program from ?program=slug
      var q = new URLSearchParams(location.search).get("program");
      if (q) { var pm = programs.filter(function (p) { return p.slug === q; })[0]; if (pm) form.elements.program_interest.value = pm.title; }
      form.addEventListener("focusin", function () { if (!started) { started = true; I.track("assessment_form_start"); } });

      form.addEventListener("submit", function (e) {
        e.preventDefault(); if (busy) return;
        clearErrs(form); var d = data(form), bad = false;
        if (d.name.length < 2) { showErr(form, "name", "Please enter your name."); bad = true; }
        if (!d.email && !d.whatsapp) { showErr(form, "email", "Give an email or a WhatsApp number."); showErr(form, "whatsapp", " "); bad = true; }
        if (d.email && !validEmail(d.email)) { showErr(form, "email", "That email address does not look right."); bad = true; }
        if (d.whatsapp && I.digits(d.whatsapp).length < 7) { showErr(form, "whatsapp", "That number looks too short."); bad = true; }
        if (!d.consent) { showErr(form, "consent", "Please tick the box so we may contact you."); bad = true; }
        if (bad) { var f = form.querySelector(".invalid, [data-err]:not(:empty)"); if (f && f.scrollIntoView) f.scrollIntoView({ block: "center", behavior: "smooth" }); return; }

        var a = I.attribution();
        var payload = Object.assign({}, d, {
          submission_key: key, source: a.utm_source || a.referrer_host || "website",
          utm_source: a.utm_source || "", utm_medium: a.utm_medium || "", utm_campaign: a.utm_campaign || "", utm_content: a.utm_content || "", landing_page: a.landing_page || ""
        });
        busy = true; var btn = document.getElementById("asubmit"), old = btn.textContent; btn.disabled = true; btn.textContent = "Sending…";
        I.rpc("submit_lead", { payload: payload }).then(function (r) {
          busy = false; btn.disabled = false; btn.textContent = old;
          if (!r.ok) { document.getElementById("aform-msg").innerHTML = '<div class="alert bad">' + esc(friendly(r.error)) + "</div>"; form.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
          if (!(r.data && r.data.duplicate)) I.track("assessment_submitted");
          var code = r.data && r.data.lead_code && r.data.lead_code !== "IQA-0" ? r.data.lead_code : "";
          document.getElementById("formwrap").innerHTML = '<div class="form-card success-card"><div class="tick" aria-hidden="true">✓</div><h2>Request received</h2><p>' + esc(s.assessment_success) + "</p>" +
            (code ? '<p>Your reference: <span class="code-badge">' + esc(code) + "</span></p>" : "") +
            '<div class="btn-row" style="justify-content:center"><a class="btn" href="/">Back to home</a><a class="btn ghost" href="/programs">View programs</a></div></div>';
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });
    });
  }

  /* ================= contact ================= */
  function contact(s) {
    var main = document.getElementById("main"), wa = I.waLink(s), notConf = !I.configured;
    var rows = "";
    if (s.contact_email) rows += '<li><span class="k">Email</span><a href="mailto:' + esc(s.contact_email) + '">' + esc(s.contact_email) + "</a></li>";
    if (wa) rows += '<li><span class="k">WhatsApp</span><a class="js-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">Message us on WhatsApp</a></li>';
    var so = s.social || {};
    ["facebook", "instagram", "telegram", "youtube"].forEach(function (k) {
      if (/^https?:\/\//i.test(so[k] || "")) rows += '<li><span class="k">' + k[0].toUpperCase() + k.slice(1) + '</span><a href="' + esc(so[k]) + '" target="_blank" rel="noopener">' + esc(so[k].replace(/^https?:\/\/(www\.)?/, "")) + "</a></li>";
    });
    if (s.response_time) rows += '<li><span class="k">Response</span><span>' + esc(s.response_time) + "</span></li>";
    if (!rows) rows = '<li class="muted">Our contact details will be added soon. Please use the message form.</li>';

    main.innerHTML = '<section class="page-hero"><div class="container"><div class="eyebrow">Contact</div><h1>We\'d love to hear from you</h1><p class="lead">Questions about programs, the free assessment or enrollment? Send us a message.</p></div></section>' +
      '<section class="section"><div class="container detail-grid"><div id="cwrap">' +
      (notConf ? '<div class="alert bad">This form is not connected yet. Please use the contact details on this page.</div>' : "") +
      '<form class="form-card" id="cform" novalidate><div id="cform-msg" aria-live="polite"></div>' +
      field("name", "Your name", input("name", "text", 'autocomplete="name" required maxlength="120"'), "", true) +
      '<div class="row2">' + field("email", "Email", input("email", "email", 'autocomplete="email" maxlength="200"')) + field("whatsapp", "WhatsApp number", input("whatsapp", "tel", 'autocomplete="tel" maxlength="24" placeholder="+880…"')) + "</div>" +
      '<div class="hint" style="margin:-8px 0 18px">Please give at least one: email or WhatsApp.</div>' +
      field("message", "Message", '<textarea id="f_message" name="message" maxlength="3000" required></textarea>', "", true) +
      '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<button class="btn" type="submit" id="csubmit"' + (notConf ? " disabled" : "") + ">Send message</button></form></div>" +
      '<aside><div class="card"><h3>Contact details</h3><ul class="contact-list">' + rows + "</ul>" +
      '<hr style="border:0;border-top:1px solid var(--border);margin:20px 0"><p class="muted" style="margin:0">Prefer to start with a reading check? <a href="' + esc(I.safeHref(s.cta_primary_href)) + '">' + esc(s.cta_primary_label) + "</a>.</p></div></aside></div></section>";

    var form = document.getElementById("cform"), busy = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault(); if (busy) return;
      clearErrs(form); var d = data(form), bad = false;
      if (d.name.length < 2) { showErr(form, "name", "Please enter your name."); bad = true; }
      if (!d.email && !d.whatsapp) { showErr(form, "email", "Give an email or a WhatsApp number."); showErr(form, "whatsapp", " "); bad = true; }
      if (d.email && !validEmail(d.email)) { showErr(form, "email", "That email address does not look right."); bad = true; }
      if (d.whatsapp && I.digits(d.whatsapp).length < 7) { showErr(form, "whatsapp", "That number looks too short."); bad = true; }
      if (d.message.length < 5) { showErr(form, "message", "Please write a short message."); bad = true; }
      if (bad) return;
      busy = true; var btn = document.getElementById("csubmit"), old = btn.textContent; btn.disabled = true; btn.textContent = "Sending…";
      I.rpc("submit_contact", { payload: d }).then(function (r) {
        busy = false; btn.disabled = false; btn.textContent = old;
        if (!r.ok) { document.getElementById("cform-msg").innerHTML = '<div class="alert bad">' + esc(friendly(r.error)) + "</div>"; return; }
        I.track("contact_submitted");
        document.getElementById("cwrap").innerHTML = '<div class="form-card success-card"><div class="tick" aria-hidden="true">✓</div><h2>Message sent</h2><p>' + esc(s.contact_success) + "</p></div>";
      });
    });
    return Promise.resolve();
  }

  window.InayaForms = { assessment: assessment, contact: contact };
})();
