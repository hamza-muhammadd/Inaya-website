/* Student journey profile: one component for the admin panel and the student's own dashboard.
   Data comes from the database function student_journey (staff) or my_journey (the student). Nothing here is sample data.
   window.InayaJourney.mount(host, data, { admin, tab, tabs:[{key,label,render(body)}], actions, certHref, onPhoto }) */
(function () {
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var num = function (n) { return Number(n) || 0; };
  var D = function (d, o) { return d ? new Date(String(d).length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-GB", o || { day: "numeric", month: "short", year: "numeric" }) : "-"; };
  var DT = function (d) { return d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"; };
  var initials = function (n) { return String(n || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(""); };
  var UNIT = { lessons_completed: "lesson", units_completed: "unit", levels_completed: "level", streak_days: "day" };

  /* ---------- small visual pieces ---------- */
  function ring(pct, label, sub, tone) {
    var p = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    return '<div class="jr-ring ' + (tone || "") + '"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="bg" cx="22" cy="22" r="18" pathLength="100"/><circle class="fg" cx="22" cy="22" r="18" pathLength="100" style="--p:' + p + '"/></svg>' +
      '<div class="in"><b>' + (pct == null ? "-" : Math.round(pct) + "%") + "</b>" + (label ? "<span>" + esc(label) + "</span>" : "") + "</div></div>" + (sub ? '<div class="jr-ring-sub">' + sub + "</div>" : "");
  }
  function bar(pct, tone) { return '<div class="jr-bar ' + (tone || "") + '"><i style="--w:' + Math.max(0, Math.min(100, num(pct))) + '%"></i></div>'; }
  function stat(ic, val, label, tone) { return '<div class="jr-stat ' + (tone || "") + '"><span class="ic">' + ic + '</span><div><b>' + val + "</b><span>" + esc(label) + "</span></div></div>"; }
  function seg(id, items, cur) { return '<div class="jr-seg" data-seg="' + id + '">' + items.map(function (x) { return '<button type="button" data-v="' + x[0] + '" class="' + (x[0] === cur ? "on" : "") + '">' + esc(x[1]) + "</button>"; }).join("") + "</div>"; }
  function empty(t) { return '<div class="jr-empty">' + esc(t) + "</div>"; }
  function card(title, inner, extra, cls) { return '<section class="jr-card ' + (cls || "") + '">' + (title ? '<div class="jr-ch"><h3>' + esc(title) + "</h3>" + (extra || "") + "</div>" : "") + inner + "</section>"; }

  /* vertical bars. parts = [{k, name, color}] stacked; for single series pass one part */
  function bars(items, parts, opts) {
    opts = opts || {}; var mx = Math.max.apply(null, items.map(function (i) { return parts.reduce(function (a, p) { return a + num(i[p.k]); }, 0); }).concat([opts.min || 1]));
    return '<div class="jr-chart" style="--h:' + (opts.h || 170) + 'px">' + items.map(function (i, ix) {
      var tot = parts.reduce(function (a, p) { return a + num(i[p.k]); }, 0), tip = i.label + ": " + parts.map(function (p) { return num(i[p.k]) + " " + p.name.toLowerCase(); }).join(", ") + (i.extra ? " (" + i.extra + ")" : "");
      return '<div class="jr-col" title="' + esc(tip) + '"><div class="v">' + (opts.val ? opts.val(i) : tot || "") + '</div><div class="jstack" style="height:' + (tot ? Math.max(tot / mx * 100, 4) : 0) + '%">' +
        parts.map(function (p) { var n = num(i[p.k]); return n ? '<i style="flex:' + n + ';background:' + p.color + ';animation-delay:' + ix * 35 + 'ms"></i>' : ""; }).join("") + '</div><div class="x">' + esc(i.label) + "</div></div>";
    }).join("") + "</div>" + (parts.length > 1 ? '<div class="jr-legend">' + parts.map(function (p) { return '<span><b style="background:' + p.color + '"></b>' + esc(p.name) + "</span>"; }).join("") + "</div>" : "");
  }

  var ICON = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/>', cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    flame: '<path d="M12 3c1 3-2 4-2 7a3 3 0 0 0 6 0c0-1-.5-2-1-3 3 2 4 5 4 7a7 7 0 0 1-14 0c0-4 4-6 7-11z"/>', cert: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21l4-3 4 3V17"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  var svg = function (n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + "</svg>"; };

  /* ---------- derived numbers ---------- */
  function totals(d) {
    var tot = 0, dn = 0; d.programs.forEach(function (p) { tot += num(p.lessons); dn += num(p.done); });
    var earned = d.badges.filter(function (b) { return b.earned; }).length;
    return { lessons: tot, done: dn, left: Math.max(tot - dn, 0), pct: tot ? Math.round(100 * dn / tot) : 0, badges: earned, badgeTotal: d.badges.length };
  }
  function nextBadge(d) {
    var l = d.badges.filter(function (b) { return !b.earned; }).sort(function (a, b) { return (a.need - a.got) / a.need - (b.need - b.got) / b.need || a.need - b.need; });
    return l[0] || null;
  }
  function remain(b) {
    var left = Math.max(num(b.need) - num(b.got), 0);
    if (b.type === "perfect_score") return "Score 100% on an assessment";
    if (b.type === "program_completed") return "Finish the whole program";
    var u = UNIT[b.type] || "step"; return left + " more " + u + (left === 1 ? "" : "s") + (b.type === "streak_days" ? " in a row" : "") + " to unlock";
  }
  function dayStatus(list) { var s = {}; list.forEach(function (r) { s[r.status] = 1; }); return s.Present ? "p" : s.Late ? "l" : s.Absent ? "a" : "e"; }

  /* ---------- tabs ---------- */
  function tabOverview(d, o) {
    var t = totals(d), a = d.attendance, sc = d.scores, nb = nextBadge(d);
    var kp = '<div class="jr-stats">' +
      stat(svg("book"), t.done + " / " + t.lessons, "Lessons completed") + stat(svg("cal"), a.percent == null ? "-" : a.percent + "%", "Attendance", "gold") +
      stat(svg("chart"), sc.percent == null ? "-" : sc.percent + "%", "Overall score", "blue") + stat(svg("star"), num(d.progress.xp), "XP earned", "gold") +
      stat(svg("flame"), num(d.progress.streak), "Day streak", "rose") + stat(svg("cert"), t.badges + " / " + t.badgeTotal, "Badges earned") + "</div>";
    var enr = d.programs.length ? d.programs.map(function (p) {
      return '<div class="jr-enr"><div class="top"><div><b>' + esc(p.title) + '</b><span>' + (p.teacher ? "Teacher: " + esc(p.teacher) + " · " : "") + "Enrolled " + D(p.enrolled_at) + '</span></div><span class="jr-pill ' + (p.status === "active" ? "ok" : p.status === "completed" ? "gold" : "lock") + '">' + esc(p.status) + "</span></div>" + bar(p.percent) +
        '<div class="sub"><span>' + num(p.done) + " of " + num(p.lessons) + " lessons</span><span>" + num(p.percent) + "%</span></div></div>";
    }).join("") : empty("Not enrolled in a learning program yet.");
    var goal = nb ? '<div class="jr-goal"><div class="medal">' + svg("star") + '</div><div class="grow"><b>Next badge: ' + esc(nb.title) + "</b><span>" + esc(remain(nb)) + "</span>" + bar(100 * nb.got / nb.need, "gold") + "</div></div>" : empty(d.badges.length ? "Every badge is earned. Masha Allah." : "No badges are set up for this program yet.");
    var rec = d.history.slice(0, 6).map(function (e) { return '<li><i class="dot ' + esc(e.type) + '"></i><div><b>' + esc(e.title) + "</b><span>" + DT(e.at) + "</span></div></li>"; }).join("");
    var cs = d.certificates.length ? d.certificates.map(function (c) { return '<a class="jr-cert" href="' + esc(o.certHref(c.id)) + '"' + (o.admin ? ' target="_blank" rel="noopener"' : "") + ">" + svg("cert") + '<span><b>' + esc(c.title) + "</b><small>" + D(c.issued_at) + "</small></span></a>"; }).join("") : empty("No certificates yet.");
    return kp + '<div class="jr-grid2">' + card("Enrolment and progress", enr) + card("Next achievement", goal) + "</div>" +
      '<div class="jr-grid2">' + card("Recent activity", rec ? '<ul class="jr-tl">' + rec + "</ul>" : empty("No activity yet.")) + card("Certificates", cs) + "</div>";
  }

  function tabAttendance(d, o, S) {
    var a = d.attendance, attended = num(a.present) + num(a.late);
    var view = S.att || "monthly";
    var head = '<div class="jr-stats">' + stat(svg("check"), attended, "Classes attended", "ok") + stat(svg("lock"), num(a.absent), "Classes missed", "rose") + stat(svg("cal"), num(a.excused), "Excused") + stat(svg("chart"), a.percent == null ? "-" : a.percent + "%", "Attendance rate", "gold") + "</div>";
    var parts = [{ k: "present", name: "Present", color: "var(--jr-ok)" }, { k: "late", name: "Late", color: "var(--jr-gold)" }, { k: "absent", name: "Absent", color: "var(--jr-rose)" }, { k: "excused", name: "Excused", color: "#9AA8B8" }];
    var chart;
    if (view === "daily") {
      chart = a.recent.length ? '<div class="jr-list">' + a.recent.slice(0, 30).map(function (r) { return '<div class="row"><span class="d">' + D(r.date, { weekday: "short", day: "numeric", month: "short" }) + '</span><span class="grow">' + esc(r["class"] || "Class") + (r.note ? ' <em>' + esc(r.note) + "</em>" : "") + '</span><span class="jr-pill ' + ({ Present: "ok", Late: "gold", Absent: "bad", Excused: "lock" }[r.status] || "") + '">' + esc(r.status) + "</span></div>"; }).join("") + "</div>" : empty("No attendance recorded yet.");
    } else chart = bars(view === "weekly" ? a.weeks : a.months, parts);
    // month calendar
    var byDay = {}; a.recent.forEach(function (r) { (byDay[r.date] = byDay[r.date] || []).push(r); });
    var ref = S.month ? new Date(S.month + "-01T00:00:00") : new Date(); ref.setDate(1);
    var key = ref.getFullYear() + "-" + String(ref.getMonth() + 1).padStart(2, "0"), first = (ref.getDay() + 6) % 7, days = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate(), cells = "", i, cnt = { p: 0, l: 0, a: 0, e: 0 };
    for (i = 0; i < first; i++) cells += "<i></i>";
    for (i = 1; i <= days; i++) { var iso = key + "-" + String(i).padStart(2, "0"), l = byDay[iso], st = l ? dayStatus(l) : ""; if (st) cnt[st]++; cells += '<b class="' + st + '" title="' + (l ? esc(l.map(function (r) { return (r["class"] || "Class") + ": " + r.status; }).join("\n")) : "No class recorded") + '">' + i + "</b>"; }
    var cal = '<div class="jr-calh"><button type="button" data-cal="-1" aria-label="Previous month">&lsaquo;</button><b>' + ref.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) + '</b><button type="button" data-cal="1" aria-label="Next month">&rsaquo;</button></div>' +
      '<div class="jr-cal"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>' + cells + "</div>" +
      '<div class="jr-legend"><span><b style="background:var(--jr-ok)"></b>Present (' + cnt.p + ')</span><span><b style="background:var(--jr-gold)"></b>Late (' + cnt.l + ')</span><span><b style="background:var(--jr-rose)"></b>Absent (' + cnt.a + ')</span><span><b style="background:#9AA8B8"></b>Excused (' + cnt.e + ")</span></div>";
    return head + '<div class="jr-grid2 wide">' + card("Attendance history", chart, seg("att", [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]], view)) + card("Calendar", cal) + "</div>" +
      '<p class="jr-note">Late counts as attended. Excused days are left out of the rate. Total recorded sessions: ' + num(a.total) + ".</p>";
  }

  function tabScores(d, o, S) {
    var sc = d.scores, view = S.sc || "monthly", nb = nextBadge(d);
    var head = '<div class="jr-stats">' + stat(svg("chart"), num(sc.earned) + " / " + num(sc.possible), "Points earned") + stat(svg("check"), num(sc.passed) + " / " + num(sc.assessments), "Assessments passed", "ok") + stat(svg("book"), num(sc.attempts), "Graded attempts", "blue") + stat(svg("lock"), num(sc.waiting), "Waiting for marking", "gold") + "</div>";
    var ringCard = card("Overall score", '<div class="jr-center">' + ring(sc.percent, "", "Best attempt of each assessment counts") + "</div>" + (nb ? '<div class="jr-goal sm"><div class="medal">' + svg("star") + '</div><div class="grow"><b>' + esc(nb.title) + "</b><span>" + esc(remain(nb)) + "</span></div></div>" : ""));
    var series = (view === "weekly" ? sc.weeks : sc.months).map(function (x) { return { label: x.label, avg: x.avg == null ? 0 : x.avg, extra: x.n + " graded" }; });
    var chart = card("Average score by " + (view === "weekly" ? "week" : "month"), bars(series, [{ k: "avg", name: "%", color: "var(--jr-p)" }], { min: 100, val: function (i) { return i.avg ? i.avg + "%" : ""; } }), seg("sc", [["weekly", "Weekly"], ["monthly", "Monthly"]], view));
    var rows = sc.history.length ? '<div class="jr-tw"><table><thead><tr><th>Assessment</th><th>Try</th><th>Score</th><th>Result</th><th>Date</th></tr></thead><tbody>' + sc.history.map(function (h) {
      return "<tr><td><b>" + esc(h.title) + '</b><small>' + esc(h.scope) + "</small></td><td>" + h.attempt_no + '</td><td><div class="sc">' + bar(h.score, h.passed ? "" : "rose") + "<span>" + (h.score == null ? "-" : Math.round(h.score) + "%") + " <small>" + num(h.earned) + "/" + num(h.possible) + "</small></span></div></td><td>" + (h.passed ? '<span class="jr-pill ok">Passed</span>' : '<span class="jr-pill bad">Not yet</span>') + "</td><td>" + D(h.at) + "</td></tr>";
    }).join("") + "</tbody></table></div>" : empty("No graded assessments yet.");
    return head + '<div class="jr-grid2 wide">' + chart + ringCard + "</div>" + card("Assessment results", rows);
  }

  function tabProgress(d, o, S) {
    var t = totals(d), p = d.progress, view = S.pr || "weekly";
    var src = view === "daily" ? p.days : view === "weekly" ? p.weeks : p.months;
    var sum = src.reduce(function (a, x) { a.l += num(x.lessons); a.m += num(x.minutes); return a; }, { l: 0, m: 0 });
    var head = '<div class="jr-stats">' + stat(svg("check"), t.done, "Lessons completed", "ok") + stat(svg("book"), t.left, "Lessons remaining") + stat(svg("chart"), t.pct + "%", "Course completion", "gold") + stat(svg("flame"), num(p.lessons_in_progress), "In progress", "blue") + "</div>";
    var chart = card("Lessons completed " + (view === "daily" ? "per day (14 days)" : view === "weekly" ? "per week (8 weeks)" : "per month (6 months)"),
      bars(src.map(function (x) { return { label: view === "daily" ? x.label.split(" ")[0] : x.label, lessons: x.lessons, extra: x.minutes + " min" }; }), [{ k: "lessons", name: "Lessons", color: "var(--jr-p)" }]) +
      '<p class="jr-note">In this period: <b>' + sum.l + "</b> lesson" + (sum.l === 1 ? "" : "s") + " and about <b>" + sum.m + "</b> minutes of study.</p>", seg("pr", [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]], view));
    var progs = d.programs.length ? d.programs.map(function (x) { return '<div class="jr-enr"><div class="top"><div><b>' + esc(x.title) + "</b><span>" + num(x.done) + " done, " + Math.max(num(x.lessons) - num(x.done), 0) + " to go</span></div>" + ring(x.percent, "", "").replace('class="jr-ring ', 'class="jr-ring mini ') + "</div>" + bar(x.percent) + "</div>"; }).join("") : empty("Not enrolled in a learning program yet.");
    var rec = p.recent.length ? '<ul class="jr-tl">' + p.recent.map(function (r) { return '<li><i class="dot lesson_completed"></i><div><b>' + esc(r.title) + "</b><span>" + DT(r.at) + (r.minutes ? " · " + r.minutes + " min" : "") + "</span></div></li>"; }).join("") + "</ul>" : empty("No completed lessons yet.");
    return head + '<div class="jr-grid2 wide">' + chart + card("Courses", progs) + "</div>" + card("Recently completed lessons", rec);
  }

  function tabBadges(d) {
    var earned = d.badges.filter(function (b) { return b.earned; }), locked = d.badges.filter(function (b) { return !b.earned; }), nb = nextBadge(d);
    var medal = function (b, lock) { var ic = lock ? svg("lock") : (b.icon && /[^\x00-\x7F]/.test(b.icon) ? esc(b.icon) : svg(ICON[b.icon] ? b.icon : "star")); return '<div class="jr-badge ' + (lock ? "lock" : "on") + '"><div class="m">' + ic + "</div><b>" + esc(b.title) + "</b><span>" + esc(b.description || "") + "</span>" +
      (lock ? bar(100 * b.got / b.need, "gold") + "<small>" + b.got + " of " + b.need + " · " + esc(remain(b)) + "</small>" : "<small>Earned " + D(b.awarded_at) + (b.xp ? " · +" + b.xp + " XP" : "") + "</small>") + "</div>"; };
    return '<div class="jr-stats">' + stat(svg("star"), earned.length, "Badges earned", "gold") + stat(svg("lock"), locked.length, "Still to unlock") + stat(svg("chart"), num(d.progress.xp), "XP total", "blue") + stat(svg("flame"), num(d.progress.streak), "Day streak", "rose") + "</div>" +
      (nb ? card("Closest to unlock", '<div class="jr-goal"><div class="medal">' + svg("star") + '</div><div class="grow"><b>' + esc(nb.title) + "</b><span>" + esc(nb.description || "") + "</span>" + bar(100 * nb.got / nb.need, "gold") + "<small>" + esc(remain(nb)) + "</small></div></div>") : "") +
      card("Earned (" + earned.length + ")", earned.length ? '<div class="jr-badges">' + earned.map(function (b) { return medal(b, false); }).join("") + "</div>" : empty("No badges yet. The first one is closer than it looks.")) +
      card("Coming up (" + locked.length + ")", locked.length ? '<div class="jr-badges">' + locked.map(function (b) { return medal(b, true); }).join("") + "</div>" : empty("Everything is unlocked. Masha Allah."));
  }

  function tabHistory(d) {
    if (!d.history.length) return card("Learning activity", empty("No activity yet."));
    var out = "", day = "";
    d.history.forEach(function (e) { var k = D(e.at, { weekday: "long", day: "numeric", month: "long", year: "numeric" }); if (k !== day) { out += (day ? "</ul>" : "") + '<div class="jr-day">' + k + '</div><ul class="jr-tl">'; day = k; }
      out += '<li><i class="dot ' + esc(e.type) + '"></i><div><b>' + esc(e.title) + "</b><span>" + new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + (e.program ? " · " + esc(e.program) : "") + "</span></div></li>"; });
    return card("Learning activity", out + "</ul>");
  }

  var BASE = [["overview", "Overview", tabOverview], ["attendance", "Attendance", tabAttendance], ["scores", "Scores", tabScores], ["progress", "Progress", tabProgress], ["badges", "Badges", tabBadges], ["history", "History", tabHistory]];

  function header(d, o) {
    var s = d.student, t = totals(d), enrolled = d.programs.length ? d.programs.map(function (p) { return esc(p.title); }).join(", ") : "Not enrolled yet";
    var since = d.programs.length ? D(d.programs.map(function (p) { return p.enrolled_at; }).sort()[0]) : (s.start_date ? D(s.start_date) : "-");
    var photo = s.photo_url ? '<img src="' + esc(s.photo_url) + '" alt="" onerror="this.remove()">' : "";
    return '<div class="jr-head"><div class="av">' + esc(initials(s.name)) + photo + '</div><div class="who"><h2>' + esc(s.name) + '</h2><div class="meta"><span class="jr-pill light">' + esc(s.code) + '</span><span class="jr-pill light">' + esc(s.status) + "</span>" + (s.country ? "<span>" + esc(s.country) + "</span>" : "") + "</div>" +
      '<div class="line"><span>' + (s.email ? esc(s.email) : (o.admin ? "No sign-in yet" : "")) + "</span><span>Program: " + enrolled + "</span><span>Since " + since + "</span></div></div>" +
      '<div class="jside">' + ring(t.pct, "complete", "", "light") + "</div>" + (o.actions ? '<div class="acts">' + o.actions + "</div>" : "") + "</div>";
  }

  function mount(host, data, o) {
    o = o || {}; o.certHref = o.certHref || function (id) { return "#cert/" + id; };
    var S = { tab: o.tab || "overview" }, tabs = BASE.map(function (b) { return { key: b[0], label: b[1], fn: b[2] }; }).concat((o.tabs || []).map(function (x) { return { key: x.key, label: x.label, extra: x }; }));
    host.innerHTML = '<div class="jr">' + header(data, o) + '<div class="jr-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-t="' + t.key + '">' + esc(t.label) + "</button>"; }).join("") + '</div><div class="jr-body" id="jr-body"></div></div>';
    var body = host.querySelector("#jr-body");
    function draw() {
      Array.prototype.forEach.call(host.querySelectorAll(".jr-tabs button"), function (b) { b.classList.toggle("on", b.getAttribute("data-t") === S.tab); b.setAttribute("aria-selected", b.getAttribute("data-t") === S.tab); });
      var t = tabs.filter(function (x) { return x.key === S.tab; })[0] || tabs[0];
      if (t.extra) { var box = document.createElement("div"); body.innerHTML = ""; body.appendChild(box); t.extra.render(box); return; }   // a slow tab writes into its own box, so it cannot overwrite the tab opened after it
      body.innerHTML = '<div class="jr-in">' + t.fn(data, o, S) + "</div>";
      Array.prototype.forEach.call(body.querySelectorAll(".jr-seg"), function (g) { var id = g.getAttribute("data-seg"); Array.prototype.forEach.call(g.querySelectorAll("button"), function (b) { b.onclick = function () { S[{ att: "att", sc: "sc", pr: "pr" }[id]] = b.getAttribute("data-v"); draw(); }; }); });
      Array.prototype.forEach.call(body.querySelectorAll("[data-cal]"), function (b) { b.onclick = function () { var r = S.month ? new Date(S.month + "-01T00:00:00") : new Date(); r.setDate(1); r.setMonth(r.getMonth() + Number(b.getAttribute("data-cal"))); S.month = r.getFullYear() + "-" + String(r.getMonth() + 1).padStart(2, "0"); draw(); }; });
    }
    Array.prototype.forEach.call(host.querySelectorAll(".jr-tabs button"), function (b) { b.onclick = function () { S.tab = b.getAttribute("data-t"); if (o.onTab) o.onTab(S.tab); draw(); }; });
    draw();
    return { setTab: function (k) { S.tab = k; draw(); } };
  }
  window.InayaJourney = { mount: mount };
})();
