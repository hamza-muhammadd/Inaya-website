/* Student learning area. Every change a student causes goes through a database function that checks enrolment and rules first. */
(function () {
  "use strict";
  var CFG = window.INAYA_CONFIG || {}, h = Inaya.esc, sb = null, profile = null, staff = null, main = null, timers = [];
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  async function q(p) { var r = await p; if (r.error) throw r.error; return r.data; }
  function rpc(n, a) { return q(sb.rpc(n, a || {})); }
  function say(msg, kind) { return '<div class="lp-msg ' + (kind || "bad") + '" role="' + (kind === "ok" ? "status" : "alert") + '">' + h(msg) + "</div>"; }
  function clean(e) { var m = (e && e.message) || String(e || "Something went wrong."); if (/Failed to fetch|NetworkError|network/i.test(m)) return "No connection. Check your internet and try again."; return m; }
  function stopTimers() { timers.forEach(clearInterval); timers = []; }
  function page(html) { stopTimers(); main.innerHTML = '<div class="lp">' + html + "</div>"; try { main.focus({ preventScroll: true }); } catch (e) {} window.scrollTo(0, 0); }
  function bar(p) { p = Math.max(0, Math.min(100, Number(p) || 0)); return '<div class="lp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '"><i style="width:' + p + '%"></i></div>'; }
  function first(n) { return String(n || "").split(" ")[0]; }
  function ar(t) { return '<div class="lp-ar" lang="ar" dir="rtl" data-noi18n>' + h(t) + "</div>"; }

  /* ---------------- start ---------------- */
  Inaya.boot(async function () {
    main = $("#main");
    if (!Inaya.configured || !window.supabase) { main.innerHTML = '<div class="lp">' + say("The learning area is not connected yet. Please check back soon.", "info") + "</div>"; return; }
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    sb.auth.onAuthStateChange(function (ev) {
      if (ev === "PASSWORD_RECOVERY") { setPassword(); }
      else if (ev === "SIGNED_OUT") { profile = null; staff = null; login(); }
    });
    window.addEventListener("hashchange", route);
    if (/type=recovery/.test(location.hash)) return;   // onAuthStateChange shows the new-password form
    await start();
  });
  async function start() {
    if (/^#verify/.test(location.hash)) return verify();
    var ses = (await sb.auth.getSession()).data.session;
    if (!ses) return login();
    try {
      profile = await rpc("my_profile");
      staff = null;
      if (!profile) { var a = await sb.from("admin_users").select("role").eq("user_id", ses.user.id).maybeSingle(); staff = a.data ? a.data.role : null; }
    } catch (e) { return page(say(clean(e))); }
    route();
  }

  /* ---------------- sign in ---------------- */
  function login(note) {
    $("#prev").innerHTML = "";
    page('<div class="lp-login lp-card"><h1>Student sign in</h1><p class="sub">Use the email and password the academy gave you.</p><div id="lg-msg">' + (note ? say(note, "ok") : "") + '</div>' +
      '<form id="lg" novalidate><div class="lp-fld"><label for="lg-e">Email</label><input class="lp-input" id="lg-e" type="email" autocomplete="username" required></div>' +
      '<div class="lp-fld"><label for="lg-p">Password</label><input class="lp-input" id="lg-p" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn" id="lg-go" type="submit">Sign in</button> <button class="btn ghost" id="lg-fp" type="button">Forgot password</button></form>' +
      '<p class="lp-mut" style="margin-top:14px">New here? The academy creates your sign-in after enrolment. <a href="/assessment">Book a free assessment</a>. <a href="#verify">Check a certificate</a></p></div>');
    $("#lg").onsubmit = async function (e) {
      e.preventDefault(); var em = $("#lg-e").value.trim(), pw = $("#lg-p").value, b = $("#lg-go");
      if (!em || !pw) { $("#lg-msg").innerHTML = say("Enter your email and password."); return; }
      b.disabled = true;
      try { var r = await sb.auth.signInWithPassword({ email: em, password: pw }); if (r.error) throw new Error(/invalid|credentials/i.test(r.error.message) ? "That email or password is not right." : r.error.message); history.replaceState(null, "", location.pathname); await start(); }
      catch (er) { $("#lg-msg").innerHTML = say(clean(er)); b.disabled = false; }
    };
    $("#lg-fp").onclick = async function () {
      var em = $("#lg-e").value.trim(); if (!em) { $("#lg-msg").innerHTML = say("Type your email first, then press Forgot password.", "info"); return; }
      var r = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + "/learn" });
      $("#lg-msg").innerHTML = r.error ? say(clean(r.error)) : say("If that email has an account, a message with a link is on its way.", "ok");
    };
  }
  function setPassword() {
    page('<div class="lp-login lp-card"><h1>Choose a new password</h1><div id="np-msg"></div><form id="np"><div class="lp-fld"><label for="np-1">New password (10 or more characters)</label><input class="lp-input" id="np-1" type="password" autocomplete="new-password"></div>' +
      '<div class="lp-fld"><label for="np-2">Repeat it</label><input class="lp-input" id="np-2" type="password" autocomplete="new-password"></div><button class="btn" type="submit">Save password</button></form></div>');
    $("#np").onsubmit = async function (e) {
      e.preventDefault(); var a = $("#np-1").value;
      if (a.length < 10) { $("#np-msg").innerHTML = say("Use at least 10 characters."); return; }
      if (a !== $("#np-2").value) { $("#np-msg").innerHTML = say("The two passwords do not match."); return; }
      var r = await sb.auth.updateUser({ password: a });
      if (r.error) { $("#np-msg").innerHTML = say(clean(r.error)); return; }
      history.replaceState(null, "", location.pathname); await start();
    };
  }

  /* ---------------- shell and router ---------------- */
  function top(extra) {
    var who = profile ? profile.full_name : "Staff preview";
    return '<div class="lp-top"><div class="lp-row"><a href="#home" style="text-decoration:none"><b>My learning</b></a>' + (profile ? '<a href="#me" class="lp-pill ok" style="text-decoration:none">My profile</a>' : "") + (profile ? '<span class="lp-pill">' + profile.xp + ' XP</span><span class="lp-pill">' + profile.streak + " day streak</span>" : "") + '</div><div class="lp-row"><span class="lp-mut">' + h(who) + '</span><button class="btn ghost sm" id="lo">Sign out</button></div></div>' + (extra || "");
  }
  function wire() { var b = $("#lo"); if (b) b.onclick = function () { sb.auth.signOut(); }; }
  async function route() {
    var seg = (location.hash.slice(1) || "home").split("/"), v = seg[0], id = seg[1];
    $("#prev").innerHTML = "";
    try {
      if (v === "verify") return verify();
      var ses = (await sb.auth.getSession()).data.session; if (!ses) return login();
      if (!profile && !staff) { return page(top() + say("This account is not linked to a student record. If you are a student, ask the academy to check your sign-in.", "warn")), wire(); }
      if (v === "cert" && (staff || profile)) return certificate(id);
      if (v === "preview" && staff) return preview(id);
      if (v === "plesson" && staff) return previewLesson(id);
      if (!profile) return page(top() + say("You are signed in as staff. Open a program in the admin area and press Preview as student.", "info") + '<p><a class="btn" href="/admin">Open admin</a></p>'), wire();
      if (v === "me") return me();
      if (v === "program") return programMap(id);
      if (v === "lesson") return lesson(id);
      if (v === "quiz") return quiz(id);
      if (v === "result") return resultPage(id);
      if (v === "cert") return certificate(id);
      return home();
    } catch (e) { page((profile ? top() : "") + say(clean(e))); wire(); }
  }

  /* ---------------- home ---------------- */
  async function home() {
    profile = await rpc("my_profile");
    if (!profile.programs.length) { page(top() + '<div class="lp-card"><h1>Welcome, ' + h(first(profile.full_name)) + '</h1><p>You are not enrolled in a program yet. The academy will add you soon.</p></div>'); return wire(); }
    var states = await Promise.all(profile.programs.map(function (p) { return rpc("my_learning", { p_program: p.program_id }).catch(function () { return null; }); }));
    var out = top() + "<h1>Assalamu alaikum, " + h(first(profile.full_name)) + '</h1><p class="sub">Little steps every day build a lifetime of Iman.</p>';
    states.forEach(function (S, i) {
      var p = profile.programs[i]; if (!S) { out += '<div class="lp-card"><h2>' + h(p.title) + "</h2>" + say("This program is not open right now (" + p.status + ").", "info") + "</div>"; return; }
      var t = S.totals, nl = S.next_lesson, name = nl ? lessonName(S, nl) : "";
      out += '<div class="lp-card"><div class="lp-row sb"><div><h2 style="margin-bottom:.1em">' + h(S.program.title) + '</h2><div class="lp-mut">' + h(S.program.tagline || "") + (S.enrollment && S.enrollment.teacher ? " &middot; Teacher: " + h(S.enrollment.teacher) : "") + "</div></div>" +
        '<a class="btn ghost sm" href="#program/' + S.program.id + '">Open the full map</a></div><div style="margin:14px 0 6px">' + bar(t.percent) + '</div><div class="lp-mut">' + t.completed + " of " + t.lessons + " lessons done (" + t.percent + "%)</div>" +
        (nl ? '<div class="lp-row" style="margin-top:14px"><a class="btn" href="#lesson/' + nl + '">' + (S.recent.some(function (r) { return r.type === "lesson_started"; }) ? "Continue" : "Start") + ": " + h(name) + "</a></div>" : (t.percent >= 100 ? say("You have finished every lesson. Masha Allah!", "ok") : say("Nothing is open right now. Finish the quizzes or ask your teacher.", "info"))) + "</div>";
      var pos = S.position && S.position.unit_id ? unitName(S, S.position.unit_id) : null;
      var lv = S.levels.map(function (l) { return '<div class="lp-row sb" style="padding:5px 0"><span>' + h(l.title) + '</span><span class="lp-row">' + (l.done ? '<span class="lp-pill ok">Done</span>' : l.open ? '<span class="lp-pill">' + l.percent + "%</span>" : '<span class="lp-pill lock">Locked</span>') + (l.needs_approval && !l.done && l.percent >= 100 ? '<span class="lp-pill warn">Waiting for teacher approval</span>' : "") + "</span></div>"; }).join("");
      out += '<div class="lp-grid"><div class="lp-card"><h3>Levels</h3>' + lv + (pos ? '<div class="lp-mut" style="margin-top:8px">Now at: ' + h(pos) + "</div>" : "") + "</div>" +
        '<div class="lp-card"><h3>Recent</h3>' + (S.recent.length ? S.recent.slice(0, 5).map(function (r) { return '<div class="lp-mut" style="padding:3px 0">' + h(r.title) + "</div>"; }).join("") : '<div class="lp-mut">Nothing yet. Start your first lesson.</div>') + "</div>";
      var got = S.achievements.filter(function (a) { return a.awarded_at; });
      if (S.achievements.length) out += '<div class="lp-card"><h3>Badges (' + got.length + " of " + S.achievements.length + ')</h3><div class="lp-row">' + S.achievements.map(function (a) { return '<span class="lp-pill ' + (a.awarded_at ? "ok" : "lock") + '" title="' + h(a.description) + '">' + h(a.title) + "</span>"; }).join("") + "</div></div>";
      if (S.certificates.length) out += '<div class="lp-card"><h3>Certificates</h3>' + S.certificates.map(function (c) { return '<div class="lp-row sb" style="padding:4px 0"><span>' + h(c.title) + '</span><a class="btn ghost sm" href="#cert/' + c.id + '">View</a></div>'; }).join("") + "</div>";
      if (S.feedback.length) out += '<div class="lp-card"><h3>Teacher feedback</h3>' + S.feedback.slice(0, 4).map(function (f) { return '<p style="margin:.3em 0"><b>' + h(f.assessment) + ":</b> " + h(f.text) + "</p>"; }).join("") + "</div>";
      if (S.awaiting_review) out += '<div class="lp-card">' + say(S.awaiting_review + " of your answers are with your teacher for marking.", "info") + "</div>";
      out += "</div>";
    });
    page(out); wire();
  }
  function lessonName(S, id) { var n = ""; S.levels.forEach(function (l) { l.domains.forEach(function (d) { d.units.forEach(function (u) { u.lessons.forEach(function (x) { if (x.id === id) n = x.title; }); }); }); }); return n; }
  function unitName(S, id) { var n = ""; S.levels.forEach(function (l) { l.domains.forEach(function (d) { d.units.forEach(function (u) { if (u.id === id) n = l.title + ": " + u.title; }); }); }); return n; }

  /* ---------------- program map ---------------- */
  function asBtn(a, S) {
    if (a.passed) return '<span class="lp-pill ok">Passed' + (a.best_score != null ? " " + Math.round(a.best_score) + "%" : "") + '</span> <a class="btn ghost sm" href="#quiz/' + a.id + '">Try again</a>';
    if (a.pending_review) return '<span class="lp-pill warn">Waiting for your teacher</span>';
    if (!a.available) return '<span class="lp-pill lock">Locked</span>';
    if (a.max_attempts && a.attempts >= a.max_attempts) return '<span class="lp-pill lock">No attempts left</span>';
    return '<a class="btn sm" href="#quiz/' + a.id + '">' + (a.in_progress_attempt ? "Continue the quiz" : a.attempts ? "Try again" : "Start the quiz") + "</a>" + (a.best_score != null ? ' <span class="lp-mut">Best ' + Math.round(a.best_score) + "%</span>" : "");
  }
  function assessRow(a, S) { return '<div class="lp-row sb" style="margin-top:8px"><span>Quiz: <b>' + h(a.title) + "</b> <span class=\"lp-mut\">(pass mark " + a.pass_score + "%)</span></span><span>" + asBtn(a, S) + "</span></div>"; }
  async function programMap(pid) {
    var S = await rpc("my_learning", { p_program: pid }), out = top('<div class="lp-crumb"><a href="#home">&larr; Back to my learning</a></div>') + "<h1>" + h(S.program.title) + '</h1><p class="sub">' + h(S.program.tagline || "") + "</p>";
    S.levels.forEach(function (lv) {
      out += '<section class="lp-card lp-lvl' + (lv.open ? "" : " locked") + '" style="border-left-color:' + h(lv.color || "var(--accent)") + '"><div class="lp-row sb"><h2 style="margin:0">Level ' + lv.number + ": " + h(lv.title) + "</h2><span>" + (lv.done ? '<span class="lp-pill ok">Completed</span>' : lv.open ? '<span class="lp-pill">' + lv.percent + "%</span>" : '<span class="lp-pill lock">Finish the level before to unlock</span>') + "</span></div>" +
        '<p class="lp-mut" style="margin:.3em 0 .8em">' + h(lv.description || "") + "</p>" + bar(lv.percent);
      lv.domains.forEach(function (d) {
        out += '<div class="lp-dom"><h4>' + h(d.title) + "</h4>";
        d.units.forEach(function (u) {
          out += '<div class="lp-unit' + (u.open ? "" : " locked") + '"><div class="lp-row sb"><b>' + h(u.title) + "</b><span>" + (u.done ? '<span class="lp-pill ok">Done</span>' : u.open ? '<span class="lp-pill">' + u.percent + "%</span>" : '<span class="lp-pill lock">Locked</span>') + "</span></div>" + (u.description ? '<div class="lp-mut" style="margin:2px 0 6px">' + h(u.description) + "</div>" : "");
          u.lessons.forEach(function (l) {
            var dot = l.status === "completed" ? '<span class="lp-dot done" aria-label="Completed">&#10003;</span>' : l.status === "in_progress" ? '<span class="lp-dot prog" aria-label="In progress"></span>' : l.status === "available" ? '<span class="lp-dot" aria-label="Not started"></span>' : '<span class="lp-dot lock" aria-label="Locked"></span>';
            out += '<div class="lp-les">' + dot + (l.open ? '<a href="#lesson/' + l.id + '">' + h(l.title) + "</a>" : '<span class="t lp-mut">' + h(l.title) + "</span>") + (l.est_minutes ? '<span class="lp-mut">' + l.est_minutes + " min</span>" : "") + "</div>";
          });
          u.assessments.forEach(function (a) { out += assessRow(a, S); });
          out += "</div>";
        });
        out += "</div>";
      });
      lv.assessments.forEach(function (a) { out += assessRow(a, S); });
      out += "</section>";
    });
    page(out); wire();
  }

  /* ---------------- lesson player ---------------- */
  function embed(u) {
    var m = /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,15})/.exec(u || "");
    if (m) return '<div style="position:relative;padding-top:56.25%"><iframe src="https://www.youtube-nocookie.com/embed/' + m[1] + '" title="Video" loading="lazy" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:14px"></iframe></div>';
    var s = Inaya.safeHref(u || ""); return s && s !== "#" ? '<video controls preload="metadata" src="' + h(s) + '" style="width:100%;border-radius:14px"></video>' : "";
  }
  function renderBlock(b, done, preview) {
    var d = b.data || {}, req = b.required && !preview ? ' <span class="lp-req">Required</span>' : "", out = "";
    if (b.type === "rich_text") out = '<div class="lp-blk">' + Inaya.md(d.text || "") + "</div>";
    else if (b.type === "arabic_text") out = '<div class="lp-blk">' + ar(d.arabic) + (d.transliteration ? '<div class="lp-ref">' + h(d.transliteration) + "</div>" : "") + (d.translation ? '<div class="lp-tr">' + h(d.translation) + "</div>" : "") + "</div>";
    else if (b.type === "quran_verse") out = '<div class="lp-blk">' + ar(d.arabic) + '<div class="lp-ref">' + h(d.reference || "") + "</div>" + (d.translation ? '<div class="lp-tr">' + h(d.translation) + "</div>" : "") + "</div>";
    else if (b.type === "image") { var src = Inaya.safeImg(d.url); out = src ? '<figure class="lp-blk lp-img"><img src="' + h(src) + '" alt="' + h(d.alt || "") + '" loading="lazy">' + (d.caption ? "<figcaption>" + h(d.caption) + "</figcaption>" : "") + "</figure>" : ""; }
    else if (b.type === "audio") { var au = Inaya.safeHref(d.url || ""); out = '<div class="lp-blk"><b>' + h(d.title || "Listen") + '</b><audio controls preload="none" src="' + h(au) + '" style="width:100%;margin-top:6px"></audio></div>'; }
    else if (b.type === "video") out = '<div class="lp-blk"><b>' + h(d.title || "") + "</b>" + embed(d.url) + "</div>";
    else if (b.type === "pdf" || b.type === "resource") out = '<div class="lp-blk"><a class="btn ghost sm" target="_blank" rel="noopener" href="' + h(Inaya.safeHref(d.url || "")) + '">' + h(d.title || "Open") + "</a>" + (d.description ? '<div class="lp-mut">' + h(d.description) + "</div>" : "") + "</div>";
    else if (b.type === "vocabulary") out = '<div class="lp-blk"><table class="lp-vocab"><tbody>' + (d.items || []).map(function (i) { return "<tr><td><b>" + h(i.term) + "</b></td><td>" + h(i.meaning) + '</td><td class="ar" lang="ar" data-noi18n>' + h(i.arabic || "") + "</td></tr>"; }).join("") + "</tbody></table></div>";
    else if (b.type === "exercise") {
      var items = d.items || [], on = done[b.id];
      out = '<div class="lp-blk lp-ex" data-ex="' + h(b.id) + '" data-kind="' + h(d.kind || "checklist") + '"><b>' + h(d.title || "Practice") + "</b>" + req + (d.instructions ? '<div class="lp-mut">' + h(d.instructions) + "</div>" : "");
      if (d.kind === "cards") out += items.map(function (c) { return '<button type="button" class="lp-flash' + (on ? " open" : "") + '">' + h(c.q) + '<span class="a">' + h(c.a) + "</span></button>"; }).join("");
      else out += items.map(function (t) { return '<label><input type="checkbox"' + (on ? " checked" : "") + "> <span>" + h(t) + "</span></label>"; }).join("");
      out += "</div>";
    }
    else if (b.type === "teacher_note") out = preview ? '<div class="lp-msg info"><b>Teacher note (students do not see this):</b> ' + h(d.text) + "</div>" : "";
    if (b.required && !preview && b.type !== "exercise") out += '<div class="lp-blk" data-read="' + h(b.id) + '">' + (done[b.id] ? '<span class="lp-pill ok">Done</span>' : '<button class="btn ghost sm" type="button">I have read this</button>') + "</div>";
    return out;
  }
  async function lesson(id) {
    var pr = await rpc("open_lesson", { p_lesson: id });
    var L = (await q(sb.from("learning_lessons").select("id,title,description,objectives,program_id,unit_id,est_minutes,completion_rule").eq("id", id).single()));
    var U = await q(sb.from("learning_units").select("title").eq("id", L.unit_id).single());
    var blocks = await q(sb.from("lesson_blocks").select("id,type,data,required,sort_order").eq("lesson_id", id).order("sort_order").order("created_at"));
    var quizzes = await q(sb.from("learning_assessments").select("id,title,pass_score").eq("lesson_id", id).eq("status", "published"));
    var passed = {};
    if (quizzes.length) (await q(sb.from("assessment_attempts").select("assessment_id,passed,status").eq("status", "graded").in("assessment_id", quizzes.map(function (x) { return x.id; })))).forEach(function (a) { if (a.passed) passed[a.assessment_id] = 1; });
    var done = {}; (pr.blocks_done || []).forEach(function (x) { done[x] = 1; });
    var completed = pr.status === "completed";
    page(top('<div class="lp-crumb"><a href="#program/' + L.program_id + '">&larr; ' + h(U.title) + "</a></div>") + "<h1>" + h(L.title) + "</h1>" + (L.description ? '<p class="sub">' + h(L.description) + "</p>" : "") +
      ((L.objectives || []).length ? '<div class="lp-card"><b>By the end you can</b><ul style="margin:.4em 0 0">' + L.objectives.map(function (o) { return "<li>" + h(o) + "</li>"; }).join("") + "</ul></div>" : "") +
      '<div id="lb">' + blocks.map(function (b) { return renderBlock(b, done); }).join("") + "</div>" +
      quizzes.map(function (a) { return '<div class="lp-card lp-row sb"><span>Lesson quiz: <b>' + h(a.title) + "</b></span>" + (passed[a.id] ? '<span class="lp-pill ok">Passed</span>' : '<a class="btn sm" href="#quiz/' + a.id + '">Start the quiz</a>') + "</span></div>"; }).join("") +
      '<div class="lp-card" id="lc">' + (completed ? say("You completed this lesson. Masha Allah!", "ok") : "") + '<div id="lc-msg"></div><div class="lp-row"><button class="btn" id="lc-go"' + (completed ? " hidden" : "") + '>Mark lesson as complete</button><a class="btn ghost" href="#program/' + L.program_id + '">Back to the map</a></div></div>');
    wire();
    $$("[data-ex]").forEach(function (box) {
      var bid = box.getAttribute("data-ex"), kind = box.getAttribute("data-kind");
      function finish() { if (done[bid]) return; done[bid] = 1; rpc("mark_block", { p_lesson: id, p_block: bid }).catch(function () { delete done[bid]; }); }
      if (kind === "cards") { var seen = 0, cards = $$(".lp-flash", box); cards.forEach(function (c) { c.onclick = function () { if (!c.classList.contains("open")) { c.classList.add("open"); seen++; if (seen >= cards.length) finish(); } }; if (c.classList.contains("open")) seen++; }); }
      else { var cbs = $$("input", box); cbs.forEach(function (c) { c.onchange = function () { if (cbs.every(function (x) { return x.checked; })) finish(); }; }); }
    });
    $$("[data-read]").forEach(function (box) { var b = $("button", box); if (b) b.onclick = async function () { try { await rpc("mark_block", { p_lesson: id, p_block: box.getAttribute("data-read") }); box.innerHTML = '<span class="lp-pill ok">Done</span>'; } catch (e) { $("#lc-msg").innerHTML = say(clean(e)); } }; });
    if (!completed) timers.push(setInterval(function () { if (document.visibilityState === "visible") sb.rpc("track_time", { p_lesson: id, p_seconds: 20 }); }, 20000));
    $("#lc-go").onclick = async function () {
      var b = this; b.disabled = true; $("#lc-msg").innerHTML = "";
      try {
        var before = profile ? profile.xp : 0, S0 = await rpc("my_learning", { p_program: L.program_id }), had = {}; S0.achievements.forEach(function (a) { if (a.awarded_at) had[a.id] = 1; });
        await rpc("complete_lesson", { p_lesson: id });
        profile = await rpc("my_profile"); var S = await rpc("my_learning", { p_program: L.program_id });
        var gained = profile.xp - before, newB = S.achievements.filter(function (a) { return a.awarded_at && !had[a.id]; });
        var nxt = S.next_lesson;
        $("#lc").innerHTML = say("Lesson complete" + (gained > 0 ? ". You earned " + gained + " XP" : "") + ".", "ok") + (newB.length ? say("New badge: " + newB.map(function (a) { return a.title; }).join(", "), "ok") : "") + (S.certificates.length ? say("A certificate is waiting for you on the home page.", "ok") : "") +
          '<div class="lp-row">' + (nxt ? '<a class="btn" href="#lesson/' + nxt + '">Next: ' + h(lessonName(S, nxt)) + "</a>" : "") + '<a class="btn ghost" href="#program/' + L.program_id + '">Back to the map</a><a class="btn ghost" href="#home">Home</a></div>';
        var t = $(".lp-top .lp-pill"); if (t) t.textContent = profile.xp + " XP";
      } catch (e) { $("#lc-msg").innerHTML = say(clean(e)); b.disabled = false; }
    };
  }

  /* ---------------- quiz ---------------- */
  function shuffle(a, seed) { a = a.slice(); var s = 0; String(seed).split("").forEach(function (c) { s = (s * 31 + c.charCodeAt(0)) >>> 0; }); for (var i = a.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; var j = s % (i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  async function quiz(aid) {
    var attempt = await rpc("start_attempt", { p_assessment: aid }), D = await rpc("attempt_questions", { p_attempt: attempt });
    var qs = D.questions, A = D.assessment, ans = {}, idx = 0, over = false, endAt = A.time_limit_min ? new Date(D.attempt.started_at).getTime() + A.time_limit_min * 60000 : null;
    qs.forEach(function (x) { if (x.answer && Object.keys(x.answer).length) ans[x.id] = x.answer; });
    var saveT = {};
    function save(qid) { clearTimeout(saveT[qid]); saveT[qid] = setTimeout(function () { sb.rpc("save_answer", { p_attempt: attempt, p_question: qid, p_answer: ans[qid] || {} }); }, 350); }
    async function flush() { for (var k in saveT) clearTimeout(saveT[k]); for (var i = 0; i < qs.length; i++) if (ans[qs[i].id]) await rpc("save_answer", { p_attempt: attempt, p_question: qs[i].id, p_answer: ans[qs[i].id] }); }
    async function submit() { if (over) return; over = true; try { await flush(); var r = await rpc("submit_attempt", { p_attempt: attempt }); stopTimers(); showResult(r, A.title, aid); } catch (e) { over = false; var m = $("#qz-msg"); if (m) m.innerHTML = say(clean(e)); } }
    function draw() {
      var x = qs[idx], a = ans[x.id] || {}, body = "";
      if (x.type === "single") body = shuffle(x.options, x.id).map(function (o) { return '<label class="lp-opt' + (a.choice === o.id ? " on" : "") + '"><input type="radio" name="o" value="' + h(o.id) + '"' + (a.choice === o.id ? " checked" : "") + "> <span>" + h(o.text) + "</span></label>"; }).join("");
      else if (x.type === "multiple") body = '<div class="lp-mut">Choose all that are correct.</div>' + shuffle(x.options, x.id).map(function (o) { var on = (a.choices || []).indexOf(o.id) > -1; return '<label class="lp-opt' + (on ? " on" : "") + '"><input type="checkbox" value="' + h(o.id) + '"' + (on ? " checked" : "") + "> <span>" + h(o.text) + "</span></label>"; }).join("");
      else if (x.type === "true_false") body = [[true, "True"], [false, "False"]].map(function (o) { var on = a.value === o[0]; return '<label class="lp-opt' + (on ? " on" : "") + '"><input type="radio" name="o" value="' + o[0] + '"' + (on ? " checked" : "") + "> <span>" + o[1] + "</span></label>"; }).join("");
      else if (x.type === "short_answer") body = '<input class="lp-input" id="qa" autocomplete="off" value="' + h(a.text || "") + '" aria-label="Your answer">';
      else if (x.type === "written") body = '<textarea class="lp-ta" id="qa" rows="6" aria-label="Your answer">' + h(a.text || "") + '</textarea><div class="lp-mut">A teacher will read and mark this.</div>';
      else if (x.type === "matching") { var rs = shuffle(x.options.right, x.id); body = x.options.left.map(function (l) { return '<div class="lp-match"><span>' + h(l.text) + '</span><select class="lp-sel" data-l="' + h(l.id) + '"><option value="">Choose…</option>' + rs.map(function (r) { return '<option value="' + h(r.id) + '"' + ((a.pairs || {})[l.id] === r.id ? " selected" : "") + ">" + h(r.text) + "</option>"; }).join("") + "</select></div>"; }).join(""); }
      else if (x.type === "ordering") { var cur = a.order || shuffle(x.options, x.id).map(function (o) { return o.id; }); body = '<div class="lp-mut">Use the arrows to put these in the right order.</div>' + cur.map(function (id, i) { var o = x.options.filter(function (z) { return z.id === id; })[0]; return '<div class="lp-ord"><span>' + (i + 1) + ". " + h(o ? o.text : "") + '</span><button class="btn ghost sm" data-mv="' + i + '" data-d="-1" aria-label="Move up">&uarr;</button><button class="btn ghost sm" data-mv="' + i + '" data-d="1" aria-label="Move down">&darr;</button></div>'; }).join(""); ans[x.id] = ans[x.id] || { order: cur }; }
      else if (x.type === "audio") body = '<div id="au"></div><div class="lp-mut">Record your voice, or choose an audio file. A teacher will listen and mark it.</div>';
      $("#qz").innerHTML = '<div class="lp-row sb"><span class="lp-mut">Question ' + (idx + 1) + " of " + qs.length + "</span>" + (endAt ? '<span class="lp-timer" id="tm"></span>' : "") + "</div>" + bar(100 * idx / qs.length) +
        '<div style="margin-top:16px">' + (x.arabic_text ? ar(x.arabic_text) : "") + '<p class="lp-q">' + h(x.prompt) + "</p>" + body + '</div><div id="qz-msg"></div><div class="lp-row" style="margin-top:16px">' + (idx > 0 ? '<button class="btn ghost" id="pv">Back</button>' : "") +
        (idx < qs.length - 1 ? '<button class="btn" id="nx">Next</button>' : '<button class="btn" id="sm">Submit my answers</button>') + "</div>";
      $$("#qz input[type=radio]").forEach(function (r) { r.onchange = function () { ans[x.id] = x.type === "true_false" ? { value: r.value === "true" } : { choice: r.value }; $$("#qz .lp-opt").forEach(function (l) { l.classList.toggle("on", l.contains(r) && r.checked); }); save(x.id); }; });
      if (x.type === "multiple") $$("#qz input[type=checkbox]").forEach(function (c) { c.onchange = function () { ans[x.id] = { choices: $$("#qz input[type=checkbox]").filter(function (z) { return z.checked; }).map(function (z) { return z.value; }) }; c.closest(".lp-opt").classList.toggle("on", c.checked); save(x.id); }; });
      var qa = $("#qa"); if (qa) qa.oninput = function () { ans[x.id] = { text: qa.value }; save(x.id); };
      if (x.type === "matching") $$("#qz select").forEach(function (s) { s.onchange = function () { var p = Object.assign({}, (ans[x.id] || {}).pairs); if (s.value) p[s.getAttribute("data-l")] = s.value; else delete p[s.getAttribute("data-l")]; ans[x.id] = { pairs: p }; save(x.id); }; });
      if (x.type === "ordering") $$("[data-mv]").forEach(function (b) { b.onclick = function () { var o = ans[x.id].order.slice(), i = Number(b.getAttribute("data-mv")), j = i + Number(b.getAttribute("data-d")); if (j < 0 || j >= o.length) return; var t = o[i]; o[i] = o[j]; o[j] = t; ans[x.id] = { order: o }; save(x.id); draw(); }; });
      if (x.type === "audio") audioUi(x, attempt, ans, function () { save(x.id); });
      var pv = $("#pv"); if (pv) pv.onclick = function () { idx--; draw(); };
      var nx = $("#nx"); if (nx) nx.onclick = function () { idx++; draw(); };
      var sm = $("#sm"); if (sm) sm.onclick = async function () {
        var left = qs.filter(function (z) { return !ans[z.id] || !Object.keys(ans[z.id]).length; }).length;
        if (left && !confirm(left + " question" + (left > 1 ? "s are" : " is") + " not answered. Submit anyway?")) return;
        sm.disabled = true; await submit(); if (!over) sm.disabled = false;
      };
      tick();
    }
    function tick() { var t = $("#tm"); if (!t || !endAt) return; var s = Math.max(0, Math.round((endAt - Date.now()) / 1000)); t.textContent = "Time left " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); if (s === 0) submit(); }
    page(top('<div class="lp-crumb"><a href="#program/' + D.program_id + '" id="bk">&larr; Back</a></div>') + "<h1>" + h(A.title) + "</h1>" + (A.instructions ? '<p class="sub">' + h(A.instructions) + "</p>" : "") + '<div class="lp-card" id="qz"></div>');
    wire();
    if (endAt) timers.push(setInterval(tick, 1000));
    draw();
  }
  function audioUi(x, attempt, ans, saved) {
    var box = $("#au"), have = ans[x.id] && ans[x.id].path, rec = null, chunks = [];
    function show(msg) { box.innerHTML = (have ? '<div class="lp-msg ok">Your recording is saved. You can record again to replace it.</div>' : "") + (msg || "") + '<div class="lp-row"><button class="btn ghost" id="rc">Start recording</button><label class="btn ghost" style="cursor:pointer">Choose a file<input id="fl" type="file" accept="audio/*" hidden></label></div><div id="rc-s" class="lp-mut"></div>'; wireUp(); }
    async function upload(blob, type) {
      var ext = /ogg/.test(type) ? "ogg" : /mp4|aac/.test(type) ? "m4a" : /mpeg/.test(type) ? "mp3" : /wav/.test(type) ? "wav" : "webm";
      if (blob.size > 10 * 1048576) { $("#rc-s").textContent = "That file is too large (10 MB limit)."; return; }
      $("#rc-s").textContent = "Saving…";
      var path = profile.id + "/" + attempt + "/" + x.id + "." + ext, r = await sb.storage.from("submissions").upload(path, blob, { contentType: type || "audio/webm", upsert: true });
      if (r.error) { $("#rc-s").textContent = "Could not save: " + r.error.message; return; }
      ans[x.id] = { path: path }; have = true; saved(); show();
    }
    function wireUp() {
      $("#fl").onchange = function () { var f = this.files[0]; if (f) upload(f, f.type); };
      $("#rc").onclick = async function () {
        var b = this;
        if (rec) { rec.stop(); return; }
        if (!navigator.mediaDevices || !window.MediaRecorder) { $("#rc-s").textContent = "Recording is not available in this browser. Choose a file instead."; return; }
        try {
          var st = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = []; rec = new MediaRecorder(st);
          rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
          rec.onstop = function () { st.getTracks().forEach(function (t) { t.stop(); }); var type = rec.mimeType || "audio/webm"; rec = null; upload(new Blob(chunks, { type: type }), type.split(";")[0]); };
          rec.start(); b.textContent = "Stop recording"; $("#rc-s").textContent = "Recording…";
        } catch (e) { $("#rc-s").textContent = "We could not use the microphone. Allow it in your browser, or choose a file."; }
      };
    }
    show();
  }

  /* ---------------- results ---------------- */
  function showResult(r, title, aid) {
    var pend = r.status === "needs_review", out = top('<div class="lp-crumb"><a href="#home">&larr; Back to my learning</a></div>') + "<h1>" + h(title) + "</h1>";
    out += '<div class="lp-card" style="text-align:center">';
    if (pend) out += '<h2>Submitted</h2><p>Some answers need your teacher to read them. Your result will appear here after marking.</p>' + (r.score != null ? '<div class="lp-score">' + Math.round(r.score) + "%</div>" : "");
    else out += (r.score != null ? '<div class="lp-score">' + Math.round(r.score) + "%</div>" : "") + "<h2>" + (r.passed ? "You passed. Masha Allah!" : "Not there yet") + '</h2><p class="lp-mut">Pass mark ' + r.pass_score + "%." + (r.passed ? "" : " Review the lesson and try again.") + "</p>";
    if (r.review_comment) out += '<div class="lp-msg info">Teacher: ' + h(r.review_comment) + "</div>";
    out += "</div>";
    if (r.answers) out += '<div class="lp-card"><h3>Your answers</h3>' + r.answers.map(function (a, i) { return '<div style="padding:8px 0;border-top:1px solid var(--border)"><b>' + (i + 1) + ". " + h(a.prompt) + "</b><div class=\"lp-mut\">" + (a.needs_review ? "Waiting for marking" : (a.points == null ? "" : a.points + " of " + a.out_of + " points")) + "</div>" + (a.feedback ? '<div class="lp-msg info">' + h(a.feedback) + "</div>" : "") + (a.explanation && !a.needs_review ? '<div class="lp-mut">' + h(a.explanation) + "</div>" : "") + "</div>"; }).join("") + "</div>";
    out += '<div class="lp-row"><a class="btn" href="#home">Back to my learning</a>' + (!r.passed && !pend ? '<button class="btn ghost" id="rt">Try again</button>' : "") + "</div>";
    page(out); wire();
    var rt = $("#rt"); if (rt) rt.onclick = function () { quiz(aid).catch(function (e) { page(top() + say(clean(e))); wire(); }); };
  }
  async function resultPage(attemptId) { var r = await rpc("attempt_result", { p_attempt: attemptId }); var a = await q(sb.from("assessment_attempts").select("assessment_id,learning_assessments(title)").eq("id", attemptId).single()); showResult(r, a.learning_assessments.title, a.assessment_id); }

  /* ---------------- my profile (attendance, scores, progress, badges, history) ---------------- */
  async function me() {
    var d = await rpc("my_journey");
    page(top('<div class="lp-crumb lp-noprint"><a href="#home">&larr; Back to my lessons</a></div>') + '<div id="jr-host"></div>');
    window.InayaJourney.mount($("#jr-host"), d, { admin: false, tab: ME_TAB, onTab: function (k) { ME_TAB = k; } });
    wire();
  }
  var ME_TAB = "overview";

  /* ---------------- certificate and check ---------------- */
  async function certificate(id) {
    var c = await q(sb.from("certificates").select("id,code,title,issued_at,revoked_at,student_id,programs(title),program_levels(title,level_number)").eq("id", id).single());
    var name = profile ? profile.full_name : null;
    if (!name) { var st = await q(sb.from("students").select("full_name").eq("id", c.student_id).single()); name = st.full_name; }
    var lv = c.program_levels ? "Level " + c.program_levels.level_number + ": " + c.program_levels.title : "";
    var date = new Date(c.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    page(top('<div class="lp-crumb lp-noprint"><a href="' + (profile ? "#home" : "/admin#progress") + '">&larr; Back</a></div>') +
      window.InayaCert.html({ name: name, title: c.title, program: c.programs ? c.programs.title : "", level: lv, date: date, code: c.code, revoked: !!c.revoked_at }) +
      '<div class="ct-actions lp-noprint"><button class="btn" id="ct-pdf">Download PDF</button><button class="btn ghost" id="ct-print">Print</button></div>' +
      '<p class="ct-hint lp-noprint">In the window that opens, choose Save as PDF as the printer. Turn off headers and footers for a clean page.</p>');
    var old = document.title, doPrint = function () { document.title = "Certificate - " + name; window.print(); setTimeout(function () { document.title = old; }, 1500); };
    $("#ct-pdf").onclick = doPrint; $("#ct-print").onclick = doPrint;
    wire();
  }
  async function verify() {
    var code = (location.hash.split("/")[1] || "").trim();
    page('<div class="lp-login lp-card"><h1>Check a certificate</h1><p class="sub">Type the code printed on the certificate.</p><form id="vf"><div class="lp-fld"><label for="vc">Certificate code</label><input class="lp-input" id="vc" value="' + h(code) + '" autocomplete="off"></div><button class="btn" type="submit">Check</button></form><div id="vr"></div><p class="lp-mut" style="margin-top:12px"><a href="#home">Back to sign in</a></p></div>');
    async function go() {
      var c = $("#vc").value.trim(); if (!c) return;
      var anon = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      var r = await anon.rpc("verify_certificate", { p_code: c });
      $("#vr").innerHTML = r.error ? say(clean(r.error)) : (r.data && r.data.valid) ? say("Genuine. " + r.data.title + " (" + r.data.program + "), issued to " + r.data.holder + " on " + new Date(r.data.issued_at).toLocaleDateString([], { dateStyle: "long" }) + ".", "ok") : say("No valid certificate was found with that code.");
    }
    $("#vf").onsubmit = function (e) { e.preventDefault(); go(); }; if (code) go();
  }

  /* ---------------- staff preview (read only, nothing is saved) ---------------- */
  async function preview(pid) {
    var P = await q(sb.from("programs").select("title,tagline,status").eq("id", pid).single());
    var lv = await q(sb.from("program_levels").select("id,title,level_number,description,sort_order").eq("program_id", pid).order("sort_order").order("level_number"));
    var dm = await q(sb.from("learning_domains").select("id,title,sort_order").eq("program_id", pid).order("sort_order"));
    var un = await q(sb.from("learning_units").select("id,title,description,level_id,domain_id,sort_order").eq("program_id", pid).order("sort_order"));
    var ls = await q(sb.from("learning_lessons").select("id,title,unit_id,sort_order,status").eq("program_id", pid).order("sort_order"));
    $("#prev").innerHTML = '<div class="lp-prev">Staff preview. This is the structure students see once the program is published. Nothing here is saved.</div>';
    page(top('<div class="lp-crumb"><a href="/admin#learning/' + h(pid) + '">&larr; Back to the program builder</a></div>') + "<h1>" + h(P.title) + '</h1><p class="sub">' + h(P.tagline || "") + (P.status !== "published" ? " (not published)" : "") + "</p>" +
      lv.map(function (l) { return '<section class="lp-card lp-lvl"><h2>Level ' + l.level_number + ": " + h(l.title) + '</h2><p class="lp-mut">' + h(l.description || "") + "</p>" + dm.map(function (d) { var us = un.filter(function (u) { return u.level_id === l.id && u.domain_id === d.id; }); if (!us.length) return ""; return '<div class="lp-dom"><h4>' + h(d.title) + "</h4>" + us.map(function (u) { return '<div class="lp-unit"><b>' + h(u.title) + "</b>" + ls.filter(function (x) { return x.unit_id === u.id; }).map(function (x) { return '<div class="lp-les"><span class="lp-dot"></span><a href="#plesson/' + x.id + '">' + h(x.title) + "</a>" + (x.status !== "published" ? ' <span class="lp-pill warn">' + h(x.status) + "</span>" : "") + "</div>"; }).join("") + "</div>"; }).join("") + "</div>"; }).join("") + "</section>"; }).join(""));
    wire();
  }
  async function previewLesson(id) {
    var L = await q(sb.from("learning_lessons").select("title,description,program_id").eq("id", id).single());
    var blocks = await q(sb.from("lesson_blocks").select("id,type,data,required").eq("lesson_id", id).order("sort_order"));
    $("#prev").innerHTML = '<div class="lp-prev">Staff preview of a lesson. Teacher notes are shown here and are hidden from students. Nothing is saved.</div>';
    page(top('<div class="lp-crumb"><a href="#preview/' + h(L.program_id) + '">&larr; Back to the preview</a></div>') + "<h1>" + h(L.title) + "</h1>" + (L.description ? '<p class="sub">' + h(L.description) + "</p>" : "") + blocks.map(function (b) { return renderBlock(b, {}, true); }).join(""));
    wire();
    $$("[data-ex] .lp-flash").forEach(function (c) { c.onclick = function () { c.classList.toggle("open"); }; });
  }
})();
