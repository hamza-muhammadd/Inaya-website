/* Admin: Learning programs (builder) and Student progress. Loaded by admin.html, which passes in its helpers (K). */
window.InayaLearningAdmin = function (K) {
  "use strict";
  var h = K.h, q = K.q, F = K.F, val = K.val, modal = K.modal, confirmBox = K.confirmBox, toast = K.toast, fail = K.fail, badge = K.badge, pageHead = K.pageHead,
      fmtDT = K.fmtDT, slugify = K.slugify, $ = K.$, $$ = K.$$, needWrite = K.needWrite, VIEWS = K.VIEWS;
  function sb() { return K.sb(); }
  function T(t) { return sb().from(t); }
  async function rpc(name, args) { return (await q(sb().rpc(name, args || {}))).data; }
  function lines(t) { return String(t || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function unlines(a) { return (a || []).join("\n"); }
  function num(v) { v = String(v).trim(); return v === "" ? null : Number(v); }
  function friendly(e) {
    var m = (e && e.message) || String(e);
    if (/violates foreign key|restrict|still referenced/i.test(m)) return "Students already have history on this item, so it cannot be deleted. Archive it instead.";
    return m;
  }
  function fl(e) { toast(friendly(e), true); }
  var NEW_UUID = function () { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }); };

  /* sorting helper: swap two neighbours and renumber only what changed */
  async function move(table, list, i, d) {
    var j = i + d; if (j < 0 || j >= list.length) return false;
    var t = list.slice(); var a = t[i]; t[i] = t[j]; t[j] = a;
    var jobs = [];
    t.forEach(function (r, k) { if (Number(r.sort_order) !== k + 1) jobs.push(q(T(table).update({ sort_order: k + 1 }).eq("id", r.id))); });
    await Promise.all(jobs); return true;
  }
  var SAMPLE = '<span class="badge b-draft" title="Sample content, review before publishing">sample</span>';

  /* ===================================================== PROGRAM LIST */
  var LS = { q: "", status: "", archived: false, tpl: false };
  VIEWS.learning = async function (el, args) {
    if (args[0] === "lesson") return lessonEditor(el, args[1]);
    if (args[0] === "assess") return assessmentEditor(el, args[1]);
    if (args[0]) return programDetail(el, args[0], args[1]);
    var progs = (await q(T("programs").select("id,slug,title,tagline,status,is_template,learning_enabled,archived_at,duplicated_from,sort_order,updated_at").order("sort_order"))).data || [];
    var lv = (await q(T("program_levels").select("id,program_id").limit(5000))).data || [];
    var un = (await q(T("learning_units").select("id,program_id,is_sample").limit(5000))).data || [];
    var ls = (await q(T("learning_lessons").select("id,program_id").limit(10000))).data || [];
    var en = (await q(T("student_programs").select("id,program_id,status").limit(10000))).data || [];
    function cnt(a, id) { return a.filter(function (x) { return x.program_id === id; }).length; }
    el.innerHTML = pageHead("Learning programs", "Build programs with levels, domains, units, lessons and assessments. Duplicate a program to reuse it as a template.",
      '<button class="btn ghost wbtn" id="lp-new">+ New program</button>') +
      '<div class="panel"><div class="row" style="gap:10px;margin-bottom:12px"><input id="lp-q" type="search" placeholder="Search programs…" style="max-width:260px" value="' + h(LS.q) + '">' +
      '<select id="lp-s" style="width:auto"><option value="">All statuses</option><option value="published"' + (LS.status === "published" ? " selected" : "") + '>Published</option><option value="draft"' + (LS.status === "draft" ? " selected" : "") + '>Draft</option></select>' +
      '<label class="row small" style="gap:6px"><input id="lp-t" type="checkbox"' + (LS.tpl ? " checked" : "") + '> Templates only</label>' +
      '<label class="row small" style="gap:6px"><input id="lp-a" type="checkbox"' + (LS.archived ? " checked" : "") + '> Show archived</label></div><div id="lp-list"></div></div>';
    function draw() {
      var t = LS.q.toLowerCase();
      var r = progs.filter(function (p) {
        var arch = p.status === "archived" || !!p.archived_at;
        return (LS.archived ? arch : !arch) && (!LS.status || p.status === LS.status) && (!LS.tpl || p.is_template) && (!t || (p.title + " " + p.tagline).toLowerCase().indexOf(t) > -1);
      });
      $("#lp-list").innerHTML = r.length ? '<div class="tw"><table class="tbl"><thead><tr><th>Program</th><th>Status</th><th>Structure</th><th>Students</th><th></th></tr></thead><tbody>' + r.map(function (p) {
        var sample = un.some(function (u) { return u.program_id === p.id && u.is_sample; });
        return '<tr class="click" data-id="' + p.id + '"><td><b>' + h(p.title) + '</b>' + (p.is_template ? ' <span class="badge">template</span>' : "") + (sample ? " " + SAMPLE : "") + '<br><span class="muted small">' + h(p.tagline || "") + "</span></td><td>" + badge(p.status) + "</td><td class=\"small\">" +
          cnt(lv, p.id) + " levels, " + cnt(un, p.id) + " units, " + cnt(ls, p.id) + " lessons</td><td>" + en.filter(function (x) { return x.program_id === p.id && x.status === "active"; }).length + ' active</td><td class="right nowrap">' +
          '<button class="btn ghost sm" data-dup="' + p.id + '">Duplicate</button></td></tr>';
      }).join("") + "</tbody></table></div>" : '<div class="empty">' + (progs.length ? "No programs match." : "No programs yet. Create one to begin.") + "</div>";
      $$("tr[data-id]", $("#lp-list")).forEach(function (tr) { tr.onclick = function (e) { if (e.target.closest("button")) return; location.hash = "#learning/" + tr.getAttribute("data-id"); }; });
      $$("[data-dup]", $("#lp-list")).forEach(function (b) { b.onclick = function () { duplicate(b.getAttribute("data-dup"), progs); }; });
    }
    $("#lp-q").oninput = function () { LS.q = this.value; draw(); };
    $("#lp-s").onchange = function () { LS.status = this.value; draw(); };
    $("#lp-t").onchange = function () { LS.tpl = this.checked; draw(); };
    $("#lp-a").onchange = function () { LS.archived = this.checked; draw(); };
    draw();
    $("#lp-new").onclick = function () {
      if (!needWrite()) return;
      var tpls = progs.filter(function (p) { return p.is_template && p.status !== "archived"; });
      modal({ title: "New program", okLabel: "Create", body: F("np-t", "Program name", "", { req: true, max: 80 }) + F("np-g", "Tagline (optional)", "", { max: 120 }) +
        F("np-from", "Start from", "", { type: "select", options: [["", "Empty program"]].concat(tpls.map(function (p) { return [p.id, "Copy of template: " + p.title]; })), hint: "A copy never carries student data and stays independent of the original." }),
        onOk: async function () {
          var t = val("np-t"); if (!t) { toast("Give the program a name.", true); return false; }
          var slug = slugify(t) || "program", from = val("np-from");
          var ex = (await q(T("programs").select("slug").like("slug", slug + "%"))).data || []; if (ex.some(function (x) { return x.slug === slug; })) slug += "-" + (ex.length + 1);
          var id;
          if (from) { id = await rpc("duplicate_program", { p_source: from, p_title: t, p_slug: slug }); }
          else {
            var r = await q(T("programs").insert({ slug: slug, title: t, tagline: val("np-g"), status: "draft", learning_enabled: true, short_description: "", description: "", sort_order: progs.length + 1,
              settings: { progression: { unit_mode: "sequential", level_mode: "sequential", lesson_mode: "free" }, gamification: { xp: true, streaks: true, badges: true, certificates: true } } }).select("id").single());
            id = r.data.id;
          }
          location.hash = "#learning/" + id;
        } });
    };
  };
  function duplicate(id, progs) {
    if (!needWrite()) return;
    var p = progs.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    modal({ title: "Duplicate program", okLabel: "Duplicate", body: '<p class="small muted" style="margin-top:0">Copies levels, domains, units, lessons, content, assessments and badges. No students, progress or certificates are copied. The copy starts as a draft.</p>' + F("dp-t", "Name of the copy", p.title + " (copy)", { req: true }),
      onOk: async function () { var t = val("dp-t"); if (!t) return false; var nid = await rpc("duplicate_program", { p_source: id, p_title: t, p_slug: slugify(t) + "-" + Math.random().toString(36).slice(2, 6) }); toast("Copy created"); location.hash = "#learning/" + nid; } });
  }

  /* ===================================================== PROGRAM DETAIL */
  var PTAB = "structure";
  async function programDetail(el, id, tab) {
    if (tab) PTAB = tab;
    var p = (await q(T("programs").select("*").eq("id", id).maybeSingle())).data;
    if (!p) { el.innerHTML = '<div class="alert bad">Program not found.</div>'; return; }
    var samples = (await q(T("learning_units").select("id", { count: "exact", head: true }).eq("program_id", id).eq("is_sample", true))).count || 0;
    var arch = p.status === "archived" || !!p.archived_at;
    el.innerHTML = '<p class="small"><a href="#learning">&larr; All programs</a></p>' +
      pageHead(h(p.title) + " " + badge(p.status) + (p.is_template ? ' <span class="badge">template</span>' : ""), h(p.tagline || "") + (p.alt_name ? ' <span class="muted">(also: ' + h(p.alt_name) + ")</span>" : ""),
        '<a class="btn ghost wbtn" href="/learn#preview/' + p.id + '" target="_blank">Preview as student</a>' +
        '<button class="btn ghost wbtn" id="pd-pub">' + (p.status === "published" ? "Unpublish" : "Publish") + "</button>" +
        '<button class="btn ghost wbtn" id="pd-dup">Duplicate</button>' +
        '<button class="btn ghost wbtn" id="pd-tpl">' + (p.is_template ? "Remove template mark" : "Save as template") + "</button>" +
        '<button class="btn danger wbtn" id="pd-arch">' + (arch ? "Restore" : "Archive") + "</button>") +
      (samples ? '<div class="alert warn"><b>This program has sample content.</b> Every unit, lesson and question was written as an example. Read and edit it, check each Arabic text against your approved source, then confirm. <button class="btn sm" id="pd-clear" style="margin-left:8px">I have reviewed it</button></div>' : "") +
      (p.status !== "published" ? '<div class="alert info">This program is not published. Students cannot see it or be enrolled until you publish it.</div>' : "") +
      '<div class="tabs" id="pd-tabs">' + [["structure", "Structure"], ["rules", "Rules and rewards"], ["students", "Students"], ["badges", "Badges"], ["info", "Details"]].map(function (t) { return '<button data-t="' + t[0] + '" class="' + (PTAB === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + '</div><div id="pd-body"></div>';
    $$("#pd-tabs button").forEach(function (b) { b.onclick = function () { PTAB = b.getAttribute("data-t"); programDetail(el, id); history.replaceState(null, "", "#learning/" + id + "/" + PTAB); }; });
    var again = function () { programDetail(el, id); };
    $("#pd-pub").onclick = async function () { if (!needWrite()) return; try { await q(T("programs").update({ status: p.status === "published" ? "draft" : "published" }).eq("id", id)); toast(p.status === "published" ? "Unpublished. Students keep their history." : "Published"); again(); } catch (e) { fl(e); } };
    $("#pd-dup").onclick = function () { duplicate(id, [p]); };
    $("#pd-tpl").onclick = async function () { if (!needWrite()) return; try { await q(T("programs").update({ is_template: !p.is_template }).eq("id", id)); again(); } catch (e) { fl(e); } };
    $("#pd-arch").onclick = async function () {
      if (!needWrite()) return;
      if (!arch && !(await confirmBox("Archive this program? It disappears from the website and new enrolment stops. Students keep all their progress and history, and you can restore it any time."))) return;
      try { await q(T("programs").update(arch ? { status: "draft", archived_at: null } : { status: "archived", archived_at: new Date().toISOString() }).eq("id", id)); toast(arch ? "Restored as draft" : "Archived"); again(); } catch (e) { fl(e); }
    };
    if ($("#pd-clear")) $("#pd-clear").onclick = async function () { if (!needWrite()) return; if (!(await confirmBox("Confirm that you have read and approved this content? The sample marks will be removed."))) return; try { await rpc("clear_sample_flags", { p_program: id }); toast("Sample marks removed"); again(); } catch (e) { fl(e); } };
    var body = $("#pd-body");
    if (PTAB === "structure") return structureTab(body, p);
    if (PTAB === "rules") return rulesTab(body, p, again);
    if (PTAB === "students") return enrolTab(body, p);
    if (PTAB === "badges") return badgesTab(body, p);
    return infoTab(body, p, again);
  }

  /* ---------- structure ---------- */
  async function structureTab(body, p) {
    var id = p.id;
    var d = {};
    var rs = await Promise.all([T("program_levels").select("*").eq("program_id", id).order("sort_order").order("level_number"), T("learning_domains").select("*").eq("program_id", id).order("sort_order"),
      T("learning_units").select("*").eq("program_id", id).order("sort_order").order("created_at"), T("learning_lessons").select("id,unit_id,title,status,sort_order,est_minutes,is_sample,created_at").eq("program_id", id).order("sort_order").order("created_at"),
      T("learning_assessments").select("id,scope,unit_id,level_id,lesson_id,title,status,sort_order").eq("program_id", id).order("sort_order")]);
    rs.forEach(function (r) { if (r.error) throw r.error; });
    d.levels = rs[0].data; d.domains = rs[1].data; d.units = rs[2].data; d.lessons = rs[3].data; d.assess = rs[4].data;
    var refresh = function () { structureTab(body, p); };
    function st(x) { return x.status === "published" ? "" : " " + badge(x.status); }
    var html = '<div class="card"><div class="row sb"><h3 style="margin:0">Domains</h3><button class="btn ghost sm wbtn" id="sd-add">+ Add domain</button></div><div class="muted small" style="margin:4px 0 10px">Subject areas that repeat inside every level. You can have any number of them.</div>';
    html += d.domains.length ? d.domains.map(function (x, i) { return '<div class="row" style="padding:6px 0;border-top:1px solid #F0ECDF"><span style="flex:1"><b>' + h(x.title) + "</b>" + st(x) + (x.is_sample ? " " + SAMPLE : "") + '<br><span class="muted small">' + h(x.description) + '</span></span>' +
      '<button class="btn ghost sm" data-dm="' + i + '" data-d="-1" title="Move up">&uarr;</button><button class="btn ghost sm" data-dm="' + i + '" data-d="1" title="Move down">&darr;</button><button class="btn ghost sm" data-de="' + x.id + '">Edit</button></div>'; }).join("") : '<div class="empty">No domains yet.</div>';
    html += "</div>";
    html += '<div class="row sb" style="margin:18px 0 8px"><h3 style="margin:0">Levels</h3><button class="btn sm wbtn" id="sl-add">+ Add level</button></div>';
    d.levels.forEach(function (lv, li) {
      var lvAs = d.assess.filter(function (a) { return a.scope === "level" && a.level_id === lv.id; });
      html += '<div class="card"><div class="row" style="gap:10px"><span style="width:12px;height:36px;border-radius:6px;background:' + h(lv.color || "#B8975A") + '"></span><div style="flex:1"><b style="font-size:1.05rem">Level ' + lv.level_number + ": " + h(lv.title) + "</b>" + st(lv) + '<br><span class="muted small">' + h(lv.description) + "</span></div>" +
        '<button class="btn ghost sm" data-lm="' + li + '" data-d="-1">&uarr;</button><button class="btn ghost sm" data-lm="' + li + '" data-d="1">&darr;</button><button class="btn ghost sm" data-le="' + lv.id + '">Edit</button><button class="btn ghost sm" data-ua="' + lv.id + '">+ Unit</button><button class="btn ghost sm" data-aa="level:' + lv.id + '">+ Level assessment</button></div>';
      if (lvAs.length) html += '<div class="small" style="margin:8px 0 0 22px">Level assessments: ' + lvAs.map(function (a) { return '<a href="#learning/assess/' + a.id + '">' + h(a.title) + "</a>" + st(a); }).join(", ") + "</div>";
      var units = d.units.filter(function (u) { return u.level_id === lv.id; });
      if (!units.length) html += '<div class="muted small" style="margin:10px 0 0 22px">No units in this level yet.</div>';
      d.domains.forEach(function (dm) {
        var du = units.filter(function (u) { return u.domain_id === dm.id; }); if (!du.length) return;
        html += '<div style="margin:12px 0 0 22px"><div class="muted small" style="text-transform:uppercase;letter-spacing:.06em;font-weight:700">' + h(dm.title) + "</div>";
        du.forEach(function (u, ui) {
          var uLs = d.lessons.filter(function (l) { return l.unit_id === u.id; }), uAs = d.assess.filter(function (a) { return a.scope === "unit" && a.unit_id === u.id; });
          html += '<div style="border:1px solid var(--bd);border-radius:12px;padding:10px 12px;margin-top:8px;background:#fff"><div class="row" style="gap:8px"><b style="flex:1">' + h(u.title) + st(u) + (u.is_sample ? " " + SAMPLE : "") + '</b>' +
            '<button class="btn ghost sm" data-um="' + u.id + '" data-d="-1">&uarr;</button><button class="btn ghost sm" data-um="' + u.id + '" data-d="1">&darr;</button><button class="btn ghost sm" data-ue="' + u.id + '">Edit</button><button class="btn ghost sm" data-la="' + u.id + '">+ Lesson</button><button class="btn ghost sm" data-aa="unit:' + u.id + '">+ Assessment</button></div>';
          uLs.forEach(function (l, i) { html += '<div class="row small" style="gap:8px;padding:4px 0 4px 12px;border-top:1px dashed #EFEAD9"><a href="#learning/lesson/' + l.id + '" style="flex:1">' + h(l.title) + "</a>" + st(l) + (l.est_minutes ? ' <span class="muted">' + l.est_minutes + " min</span>" : "") +
            '<button class="btn ghost sm" data-lsm="' + l.id + '" data-d="-1">&uarr;</button><button class="btn ghost sm" data-lsm="' + l.id + '" data-d="1">&darr;</button></div>'; });
          if (!uLs.length) html += '<div class="muted small" style="padding:4px 0 0 12px">No lessons yet.</div>';
          if (uAs.length) html += '<div class="small" style="padding:6px 0 0 12px">Assessments: ' + uAs.map(function (a) { return '<a href="#learning/assess/' + a.id + '">' + h(a.title) + "</a>" + st(a); }).join(", ") + "</div>";
          html += "</div>";
        });
        html += "</div>";
      });
      html += "</div>";
    });
    if (!d.levels.length) html += '<div class="empty">No levels yet. Add your first level.</div>';
    body.innerHTML = html;

    function sibs(list, pred) { return list.filter(pred); }
    function bindMove(attr, table, getList) {
      $$("[" + attr + "]", body).forEach(function (b) { b.onclick = async function () {
        if (!needWrite()) return; var key = b.getAttribute(attr), dir = Number(b.getAttribute("data-d")), list = getList(key), i = isNaN(Number(key)) ? list.findIndex(function (r) { return r.id === key; }) : Number(key);
        try { if (await move(table, list, i, dir)) refresh(); } catch (e) { fl(e); } }; });
    }
    bindMove("data-dm", "learning_domains", function () { return d.domains; });
    bindMove("data-lm", "program_levels", function () { return d.levels; });
    bindMove("data-um", "learning_units", function (k) { var u = d.units.filter(function (x) { return x.id === k; })[0]; return d.units.filter(function (x) { return x.level_id === u.level_id && x.domain_id === u.domain_id; }); });
    bindMove("data-lsm", "learning_lessons", function (k) { var l = d.lessons.filter(function (x) { return x.id === k; })[0]; return d.lessons.filter(function (x) { return x.unit_id === l.unit_id; }); });
    $("#sd-add").onclick = function () { domainModal(p, null, d, refresh); };
    $$("[data-de]", body).forEach(function (b) { b.onclick = function () { domainModal(p, d.domains.filter(function (x) { return x.id === b.getAttribute("data-de"); })[0], d, refresh); }; });
    $("#sl-add").onclick = function () { levelModal(p, null, d, refresh); };
    $$("[data-le]", body).forEach(function (b) { b.onclick = function () { levelModal(p, d.levels.filter(function (x) { return x.id === b.getAttribute("data-le"); })[0], d, refresh); }; });
    $$("[data-ua]", body).forEach(function (b) { b.onclick = function () { unitModal(p, null, d, refresh, b.getAttribute("data-ua")); }; });
    $$("[data-ue]", body).forEach(function (b) { b.onclick = function () { unitModal(p, d.units.filter(function (x) { return x.id === b.getAttribute("data-ue"); })[0], d, refresh); }; });
    $$("[data-la]", body).forEach(function (b) { b.onclick = function () { newLesson(p, b.getAttribute("data-la"), d); }; });
    $$("[data-aa]", body).forEach(function (b) { b.onclick = function () { var s = b.getAttribute("data-aa").split(":"); newAssessment(p, s[0], s[1], d); }; });
  }

  function statusSel(id, v) { return F(id, "Status", v || "published", { type: "select", options: [["published", "Published (visible to students)"], ["draft", "Draft (hidden)"], ["archived", "Archived (hidden, history kept)"]] }); }
  async function delRow(table, id, label, done) {
    if (!(await confirmBox("Delete " + label + " for good? If students already have history on it, you will be asked to archive it instead.", { danger: true, okLabel: "Delete" }))) return false;
    try { await q(T(table).delete().eq("id", id)); toast("Deleted"); done(); return true; } catch (e) { fl(e); return false; }
  }
  function domainModal(p, x, d, done) {
    if (!needWrite()) return; x = x || {};
    var m = modal({ title: x.id ? "Edit domain" : "Add domain", body: F("dm-t", "Name", x.title, { req: true }) + F("dm-d", "Description", x.description, { type: "textarea", rows: 2 }) + F("dm-i", "Icon word (optional)", x.icon) + F("dm-c", "Colour (optional, like #2F7D5B)", x.color) + statusSel("dm-s", x.status) +
      (x.id ? '<button class="btn danger sm" id="dm-del" type="button">Delete domain</button>' : ""),
      onOk: async function () { var t = val("dm-t"); if (!t) { toast("Name is required.", true); return false; }
        var row = { title: t, description: val("dm-d"), icon: val("dm-i"), color: val("dm-c"), status: val("dm-s"), slug: slugify(t) };
        try { if (x.id) await q(T("learning_domains").update(row).eq("id", x.id)); else await q(T("learning_domains").insert(Object.assign(row, { program_id: p.id, sort_order: d.domains.length + 1 }))); done(); } catch (e) { fl(e); return false; } } });
    if (x.id) $("#dm-del", m.el).onclick = async function () { if (await delRow("learning_domains", x.id, "this domain and its units", done)) m.close(); };
  }
  function ruleSelect(id, label, v, cur) {
    return F(id, label, v || "", { type: "select", options: [["", "Use the program rule"], ["free", "Always open"], ["sequential", "Opens after the previous one is finished"]], hint: cur });
  }
  function levelModal(p, x, d, done) {
    if (!needWrite()) return; x = x || {}; var rule = x.completion_rule || {}, ul = x.unlock_rule || {};
    var m = modal({ title: x.id ? "Edit level" : "Add level", wide: true, body: '<div class="row" style="gap:10px;align-items:flex-start"><div style="flex:3">' + F("lv-t", "Name", x.title, { req: true }) + '</div><div style="flex:1">' + F("lv-n", "Number", x.level_number || d.levels.length + 1, { type: "number", attrs: 'min="1"' }) + "</div></div>" +
      F("lv-d", "Description", x.description, { type: "textarea", rows: 2 }) + F("lv-o", "Learning objectives (one per line)", unlines(x.objectives), { type: "textarea", rows: 3 }) + F("lv-c", "Colour (optional)", x.color) +
      ruleSelect("lv-u", "When does this level open?", ul.mode === "custom" ? "" : ul.mode) +
      '<label class="row small" style="gap:6px;margin:6px 0"><input id="lv-ta" type="checkbox"' + (rule.teacher_approval ? " checked" : "") + '> A teacher must approve before this level counts as finished</label>' + statusSel("lv-s", x.status) +
      (x.id ? '<button class="btn danger sm" id="lv-del" type="button">Delete level</button>' : ""),
      onOk: async function () { var t = val("lv-t"); if (!t) { toast("Name is required.", true); return false; }
        var row = { title: t, level_number: Number(val("lv-n")) || 1, description: val("lv-d"), objectives: lines(val("lv-o")), color: val("lv-c"), status: val("lv-s"),
          unlock_rule: val("lv-u") ? { mode: val("lv-u") } : {}, completion_rule: Object.assign({}, rule, { teacher_approval: val("lv-ta") }) };
        try { if (x.id) await q(T("program_levels").update(row).eq("id", x.id)); else await q(T("program_levels").insert(Object.assign(row, { program_id: p.id, sort_order: d.levels.length + 1 }))); done(); } catch (e) { fl(e); return false; } } });
    if (x.id) $("#lv-del", m.el).onclick = async function () { if (await delRow("program_levels", x.id, "this level and everything in it", done)) m.close(); };
  }
  function unitModal(p, x, d, done, levelId) {
    if (!needWrite()) return; x = x || {}; var ul = x.unlock_rule || {};
    if (!d.domains.length) { toast("Add a domain first.", true); return; }
    var m = modal({ title: x.id ? "Edit unit" : "Add unit", wide: true, body: F("un-t", "Name", x.title, { req: true }) +
      '<div class="row" style="gap:10px"><div style="flex:1">' + F("un-l", "Level", x.level_id || levelId, { type: "select", options: d.levels.map(function (l) { return [l.id, "Level " + l.level_number + ": " + l.title]; }) }) + '</div><div style="flex:1">' + F("un-dm", "Domain", x.domain_id || d.domains[0].id, { type: "select", options: d.domains.map(function (l) { return [l.id, l.title]; }) }) + "</div></div>" +
      F("un-d", "Description", x.description, { type: "textarea", rows: 2 }) + F("un-o", "Learning objectives (one per line)", unlines(x.objectives), { type: "textarea", rows: 3 }) + F("un-e", "Estimated minutes", x.est_minutes == null ? "" : x.est_minutes, { type: "number", attrs: 'min="0"' }) +
      ruleSelect("un-u", "When does this unit open?", ul.mode === "custom" ? "" : ul.mode) +
      F("un-a", "To finish the unit", (x.completion_rule || {}).assessment === "none" ? "none" : "pass", { type: "select", options: [["pass", "Finish lessons and pass the unit assessment"], ["none", "Finish the lessons only"]] }) + statusSel("un-s", x.status) +
      (x.id ? '<button class="btn danger sm" id="un-del" type="button">Delete unit</button>' : ""),
      onOk: async function () { var t = val("un-t"); if (!t) { toast("Name is required.", true); return false; }
        var row = { title: t, level_id: val("un-l"), domain_id: val("un-dm"), description: val("un-d"), objectives: lines(val("un-o")), est_minutes: num(val("un-e")), status: val("un-s"),
          unlock_rule: val("un-u") ? { mode: val("un-u") } : {}, completion_rule: { assessment: val("un-a") } };
        try { if (x.id) await q(T("learning_units").update(row).eq("id", x.id)); else await q(T("learning_units").insert(Object.assign(row, { program_id: p.id, sort_order: d.units.filter(function (u) { return u.level_id === row.level_id && u.domain_id === row.domain_id; }).length + 1 }))); done(); } catch (e) { fl(e); return false; } } });
    if (x.id) $("#un-del", m.el).onclick = async function () { if (await delRow("learning_units", x.id, "this unit with its lessons", done)) m.close(); };
  }
  function newLesson(p, unitId, d) {
    if (!needWrite()) return;
    modal({ title: "Add lesson", okLabel: "Create and open", body: F("nl-t", "Lesson title", "", { req: true }) + '<div class="muted small">You add the content (text, Arabic, audio, practice) on the next page.</div>',
      onOk: async function () { var t = val("nl-t"); if (!t) return false; try {
        var r = await q(T("learning_lessons").insert({ program_id: p.id, unit_id: unitId, title: t, status: "draft", sort_order: d.lessons.filter(function (l) { return l.unit_id === unitId; }).length + 1, completion_rule: { type: "manual" } }).select("id").single());
        location.hash = "#learning/lesson/" + r.data.id; } catch (e) { fl(e); return false; } } });
  }
  function newAssessment(p, scope, target, d) {
    if (!needWrite()) return;
    modal({ title: scope === "level" ? "Add level assessment" : "Add unit assessment", okLabel: "Create and open", body: F("na-t", "Title", "", { req: true }),
      onOk: async function () { var t = val("na-t"); if (!t) return false; try {
        var row = { program_id: p.id, scope: scope, title: t, status: "draft", sort_order: d.assess.length + 1 }; row[scope + "_id"] = target;
        var r = await q(T("learning_assessments").insert(row).select("id").single()); location.hash = "#learning/assess/" + r.data.id; } catch (e) { fl(e); return false; } } });
  }

  /* ---------- rules and rewards ---------- */
  async function rulesTab(body, p, again) {
    var s = p.settings || {}, pg = s.progression || {}, gm = s.gamification || {};
    function sel(id, label, v, hint) { return F(id, label, v, { type: "select", options: [["sequential", "One after another"], ["free", "All open at once"]], hint: hint }); }
    function chk(id, label, on) { return '<label class="row small" style="gap:6px;margin:4px 0"><input id="' + id + '" type="checkbox"' + (on !== false ? " checked" : "") + "> " + label + "</label>"; }
    body.innerHTML = '<div class="card"><h3 style="margin-top:0">How students move through the program</h3><div class="muted small" style="margin-bottom:10px">These are program-wide defaults. A single level, unit or lesson can use its own rule, and a teacher can override any step for one student with a reason.</div>' +
      '<div class="row" style="gap:12px;align-items:flex-start"><div style="flex:1;min-width:200px">' + sel("rl-lv", "Levels", pg.level_mode || "sequential", "One after another means Level 2 opens when Level 1 is finished.") + '</div><div style="flex:1;min-width:200px">' + sel("rl-un", "Units (inside one level and domain)", pg.unit_mode || "sequential") + '</div>' +
      '<div style="flex:1;min-width:200px">' + sel("rl-ls", "Lessons (inside a unit)", pg.lesson_mode || "free", "All open at once lets students pick the order.") + "</div></div>" +
      '<div class="row" style="gap:12px"><div style="flex:1;min-width:200px">' + F("rl-ma", "Attempts allowed per assessment", pg.max_attempts == null ? "" : pg.max_attempts, { type: "number", attrs: 'min="1"', hint: "Leave empty for unlimited." }) + '</div><div style="flex:1;min-width:200px">' + F("rl-rw", "Hours to wait before a retry", pg.retry_wait_hours || 0, { type: "number", attrs: 'min="0"' }) + "</div></div></div>" +
      '<div class="card"><h3 style="margin-top:0">Rewards (all optional)</h3>' + chk("gm-xp", "Experience points (XP)", gm.xp) + chk("gm-bd", "Badges", gm.badges) + chk("gm-ce", "Certificates", gm.certificates) +
      '<div class="row" style="gap:12px;margin-top:10px">' + [["xp_lesson", "XP per lesson", 10], ["xp_unit", "per unit", 50], ["xp_level", "per level", 150], ["xp_assessment", "per passed assessment", 25], ["xp_program", "program finished", 300]].map(function (x) { return '<div style="flex:1;min-width:120px">' + F("gx-" + x[0], x[1], gm[x[0]] == null ? x[2] : gm[x[0]], { type: "number", attrs: 'min="0"' }) + "</div>"; }).join("") + "</div></div>" +
      '<div class="row"><button class="btn wbtn" id="rl-save">Save rules</button></div>';
    $("#rl-save").onclick = async function () {
      if (!needWrite()) return;
      var next = Object.assign({}, s, { progression: { level_mode: val("rl-lv"), unit_mode: val("rl-un"), lesson_mode: val("rl-ls"), max_attempts: num(val("rl-ma")), retry_wait_hours: Number(val("rl-rw")) || 0 },
        gamification: { xp: val("gm-xp"), badges: val("gm-bd"), certificates: val("gm-ce"), xp_lesson: Number(val("gx-xp_lesson")) || 0, xp_unit: Number(val("gx-xp_unit")) || 0, xp_level: Number(val("gx-xp_level")) || 0, xp_assessment: Number(val("gx-xp_assessment")) || 0, xp_program: Number(val("gx-xp_program")) || 0 } });
      try { await q(T("programs").update({ settings: next }).eq("id", p.id)); toast("Rules saved"); again(); } catch (e) { fl(e); }
    };
  }

  /* ---------- enrolment ---------- */
  async function enrolTab(body, p) {
    var rows = (await q(T("student_programs").select("id,status,enrolled_at,teacher_id,student_id,students(full_name,student_code),teachers(full_name)").eq("program_id", p.id).order("enrolled_at", { ascending: false }))).data || [];
    var teachers = (await q(T("teachers").select("id,full_name").order("full_name"))).data || [];
    body.innerHTML = '<div class="card"><div class="row sb"><h3 style="margin:0">Enrolled students</h3><button class="btn sm wbtn" id="en-add">+ Enrol a student</button></div>' +
      (p.status !== "published" ? '<div class="alert warn" style="margin-top:10px">Publish the program first, then enrol students.</div>' : "") +
      (rows.length ? '<div class="tw" style="margin-top:10px"><table class="tbl"><thead><tr><th>Student</th><th>Teacher</th><th>Status</th><th>Since</th><th></th></tr></thead><tbody>' + rows.map(function (r) {
        return "<tr><td><a href=\"#progress/" + r.student_id + "/" + p.id + '"><b>' + h(r.students ? r.students.full_name : "") + "</b></a><br><span class=\"muted small\">" + h(r.students ? r.students.student_code : "") + "</span></td><td>" + h(r.teachers ? r.teachers.full_name : "Not assigned") + "</td><td>" + badge(r.status) + "</td><td>" + K.fmtD(r.enrolled_at) + '</td><td class="right"><button class="btn ghost sm" data-ee="' + r.id + '">Change</button></td></tr>'; }).join("") + "</tbody></table></div>" : '<div class="empty" style="margin-top:10px">Nobody is enrolled yet.</div>') + "</div>";
    $("#en-add").onclick = async function () {
      if (!needWrite()) return;
      var studs = (await q(T("students").select("id,full_name,student_code,status").is("deleted_at", null).order("full_name").limit(1000))).data || [];
      var have = {}; rows.forEach(function (r) { have[r.student_id] = 1; });
      var free = studs.filter(function (s) { return !have[s.id]; });
      if (!free.length) { toast("Every student is already enrolled, or you have no students yet.", true); return; }
      modal({ title: "Enrol a student", okLabel: "Enrol", body: F("ne-s", "Student", "", { type: "select", options: free.map(function (s) { return [s.id, s.full_name + " (" + s.student_code + ")"]; }) }) + F("ne-t", "Teacher (optional)", "", { type: "select", options: [["", "Not assigned"]].concat(teachers.map(function (t) { return [t.id, t.full_name]; })) }),
        onOk: async function () { try { await rpc("enroll_student", { p_student: val("ne-s"), p_program: p.id, p_teacher: val("ne-t") || null }); toast("Enrolled"); enrolTab(body, p); } catch (e) { fl(e); return false; } } });
    };
    $$("[data-ee]", body).forEach(function (b) { b.onclick = function () {
      if (!needWrite()) return; var r = rows.filter(function (x) { return x.id === b.getAttribute("data-ee"); })[0];
      modal({ title: "Change enrolment", body: F("ce-s", "Status", r.status, { type: "select", options: [["active", "Active"], ["paused", "Paused (access stops, progress kept)"], ["completed", "Completed"], ["withdrawn", "Withdrawn (progress kept)"]] }) + F("ce-t", "Teacher", r.teacher_id || "", { type: "select", options: [["", "Not assigned"]].concat(teachers.map(function (t) { return [t.id, t.full_name]; })) }),
        onOk: async function () { try { await rpc("set_enrollment", { p_id: r.id, p_status: val("ce-s"), p_teacher: val("ce-t") || null }); toast("Saved"); enrolTab(body, p); } catch (e) { fl(e); return false; } } });
    }; });
  }

  /* ---------- badges ---------- */
  var RULES = [["lessons_completed", "Lessons completed", true], ["units_completed", "Units completed", true], ["levels_completed", "Levels completed", true], ["streak_days", "Days in a row", true], ["perfect_score", "Perfect score on an assessment", false], ["program_completed", "Whole program completed", false]];
  async function badgesTab(body, p) {
    var rows = (await q(T("achievement_defs").select("*").eq("program_id", p.id).order("title"))).data || [];
    body.innerHTML = '<div class="card"><div class="row sb"><h3 style="margin:0">Badges</h3><button class="btn sm wbtn" id="bd-add">+ Add badge</button></div><div class="muted small" style="margin:4px 0 10px">Students earn a badge automatically when its rule is met. Turn badges off for the whole program under Rules and rewards.</div>' +
      (rows.length ? '<div class="tw"><table class="tbl"><thead><tr><th>Badge</th><th>Rule</th><th>XP</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(function (r) {
        var rl = RULES.filter(function (x) { return x[0] === (r.rule || {}).type; })[0];
        return "<tr><td><b>" + h(r.title) + "</b>" + (r.is_sample ? " " + SAMPLE : "") + '<br><span class="muted small">' + h(r.description) + "</span></td><td>" + h(rl ? rl[1] + (r.rule.n ? ": " + r.rule.n : "") : "-") + "</td><td>" + r.xp + "</td><td>" + badge(r.status) + '</td><td class="right"><button class="btn ghost sm" data-be="' + r.id + '">Edit</button></td></tr>'; }).join("") + "</tbody></table></div>" : '<div class="empty">No badges yet.</div>') + "</div>";
    function edit(x) {
      if (!needWrite()) return; x = x || {}; var rl = x.rule || { type: "lessons_completed", n: 1 };
      var m = modal({ title: x.id ? "Edit badge" : "Add badge", body: F("bd-t", "Name", x.title, { req: true }) + F("bd-d", "Description", x.description, { type: "textarea", rows: 2 }) +
        '<div class="row" style="gap:10px"><div style="flex:2">' + F("bd-r", "Earned when", rl.type, { type: "select", options: RULES.map(function (r) { return [r[0], r[1]]; }) }) + '</div><div style="flex:1">' + F("bd-n", "Number", rl.n || 1, { type: "number", attrs: 'min="1"' }) + "</div></div>" +
        F("bd-x", "Bonus XP", x.xp || 0, { type: "number", attrs: 'min="0"' }) + F("bd-i", "Icon word (optional)", x.icon) + statusSel("bd-s", x.status) + (x.id ? '<button class="btn danger sm" id="bd-del" type="button">Delete badge</button>' : ""),
        onOk: async function () { var t = val("bd-t"); if (!t) { toast("Name is required.", true); return false; }
          var ty = val("bd-r"), needs = RULES.filter(function (r) { return r[0] === ty; })[0][2], row = { title: t, description: val("bd-d"), rule: needs ? { type: ty, n: Number(val("bd-n")) || 1 } : { type: ty }, xp: Number(val("bd-x")) || 0, icon: val("bd-i"), status: val("bd-s") };
          try { if (x.id) await q(T("achievement_defs").update(row).eq("id", x.id)); else await q(T("achievement_defs").insert(Object.assign(row, { program_id: p.id, code: slugify(t) + "-" + Math.random().toString(36).slice(2, 5) }))); badgesTab(body, p); } catch (e) { fl(e); return false; } } });
      if (x.id) $("#bd-del", m.el).onclick = async function () { if (await delRow("achievement_defs", x.id, "this badge", function () { badgesTab(body, p); })) m.close(); };
    }
    $("#bd-add").onclick = function () { edit(null); };
    $$("[data-be]", body).forEach(function (b) { b.onclick = function () { edit(rows.filter(function (x) { return x.id === b.getAttribute("data-be"); })[0]); }; });
  }

  /* ---------- program details (public text) ---------- */
  function infoTab(body, p, again) {
    body.innerHTML = '<div class="card">' + F("pi-t", "Program name", p.title, { req: true }) + F("pi-a", "Alternative name", p.alt_name) + F("pi-g", "Tagline", p.tagline) + F("pi-sd", "Short description", p.short_description, { type: "textarea", rows: 2 }) + F("pi-d", "Full description", p.description, { type: "textarea", rows: 5 }) +
      F("pi-o", "Program objectives (one per line)", unlines(p.objectives), { type: "textarea", rows: 4 }) + F("pi-sp", "Who is it for", p.student_profile, { type: "textarea", rows: 2 }) + F("pi-du", "Estimated duration (optional)", p.estimated_duration) + F("pi-cta", "Button text", p.cta_label) +
      F("pi-am", "Who can join", p.access_mode || "invite", { type: "select", options: [["invite", "Only students the academy enrols"], ["open", "Open for self-enrolment (not built yet)"], ["closed", "Closed to new students"]] }) +
      '<div class="alert info">The website translation system covers this text. Open Programs & Curriculum to review the Bangla and Arabic versions.</div><button class="btn wbtn" id="pi-save">Save details</button></div>';
    $("#pi-save").onclick = async function () {
      if (!needWrite()) return; var t = val("pi-t"); if (!t) { toast("Name is required.", true); return; }
      try { await q(T("programs").update({ title: t, alt_name: val("pi-a"), tagline: val("pi-g"), short_description: val("pi-sd"), description: val("pi-d"), objectives: lines(val("pi-o")), student_profile: val("pi-sp"), estimated_duration: val("pi-du"), cta_label: val("pi-cta"), access_mode: val("pi-am") }).eq("id", p.id)); toast("Saved"); again(); } catch (e) { fl(e); }
    };
  }

  /* ===================================================== LESSON EDITOR */
  var BT = {
    rich_text: { name: "Text", f: [["text", "Text", "area", 6]], sum: function (d) { return d.text; } },
    arabic_text: { name: "Arabic text", f: [["arabic", "Arabic", "area", 3, "rtl"], ["transliteration", "Transliteration (optional)", "text"], ["translation", "Meaning (optional)", "text"]], sum: function (d) { return d.arabic; } },
    quran_verse: { name: "Quran verse", f: [["arabic", "Arabic text", "area", 3, "rtl"], ["reference", "Reference (for example Surah Al-Ikhlas 112:1-4)", "text"], ["translation", "Translation (optional)", "area", 2], ["note", "Note for staff (not shown to students)", "text"]], sum: function (d) { return d.reference; } },
    image: { name: "Image", f: [["url", "Image link", "media"], ["alt", "Describe the picture", "text"], ["caption", "Caption (optional)", "text"]], sum: function (d) { return d.alt || d.url; } },
    audio: { name: "Audio", f: [["url", "Audio link", "text"], ["title", "Title", "text"]], sum: function (d) { return d.title || d.url; } },
    video: { name: "Video", f: [["url", "Video link (a direct link or YouTube address)", "text"], ["title", "Title", "text"]], sum: function (d) { return d.title || d.url; } },
    pdf: { name: "PDF or worksheet", f: [["url", "PDF link", "text"], ["title", "Title", "text"]], sum: function (d) { return d.title || d.url; } },
    vocabulary: { name: "Vocabulary list", f: [["items", "One word per line, written as: word | meaning | Arabic (Arabic is optional)", "vocab", 6]], sum: function (d) { return (d.items || []).length + " words"; } },
    exercise: { name: "Practice activity", f: [["kind", "Type", "select", [["checklist", "Checklist (tick each step)"], ["cards", "Question cards (tap to reveal the answer)"]]], ["title", "Title", "text"], ["instructions", "Instructions", "text"], ["items", "Checklist: one step per line. Cards: question | answer", "exitems", 6]], sum: function (d) { return d.title; } },
    teacher_note: { name: "Teacher note (hidden from students)", f: [["text", "Note", "area", 4]], sum: function (d) { return d.text; } },
    resource: { name: "Extra resource link", f: [["url", "Link", "text"], ["title", "Title", "text"], ["description", "Short description", "text"]], sum: function (d) { return d.title || d.url; } }
  };
  function plain(s) { return String(s || "").replace(/\s+/g, " ").slice(0, 110); }
  async function lessonEditor(el, id) {
    var l = (await q(T("learning_lessons").select("*").eq("id", id).maybeSingle())).data;
    if (!l) { el.innerHTML = '<div class="alert bad">Lesson not found.</div>'; return; }
    var u = (await q(T("learning_units").select("id,title,level_id,domain_id").eq("id", l.unit_id).single())).data;
    var blocks = (await q(T("lesson_blocks").select("*").eq("lesson_id", id).order("sort_order").order("created_at"))).data || [];
    var others = (await q(T("learning_lessons").select("id,title,unit_id").eq("program_id", l.program_id).neq("id", id).order("sort_order"))).data || [];
    var quizzes = (await q(T("learning_assessments").select("id,title,status").eq("lesson_id", id))).data || [];
    var cr = l.completion_rule || {}, dirty = false;
    el.innerHTML = '<p class="small"><a href="#learning/' + l.program_id + '">&larr; Back to the program</a> <span class="muted">/ ' + h(u.title) + "</span></p>" + pageHead(h(l.title) + " " + badge(l.status) + (l.is_sample ? " " + SAMPLE : ""), "Lesson editor") +
      '<div class="card"><h3 style="margin-top:0">Lesson settings</h3>' + F("ls-t", "Title", l.title, { req: true }) + F("ls-d", "Short description", l.description, { type: "textarea", rows: 2 }) + F("ls-o", "Learning objectives (one per line)", unlines(l.objectives), { type: "textarea", rows: 3 }) +
      '<div class="row" style="gap:12px;align-items:flex-start"><div style="flex:1;min-width:160px">' + F("ls-e", "Estimated minutes", l.est_minutes == null ? "" : l.est_minutes, { type: "number", attrs: 'min="0"' }) + '</div><div style="flex:2;min-width:220px">' + statusSel("ls-s", l.status) + "</div></div>" +
      '<div class="row" style="gap:12px;align-items:flex-start"><div style="flex:2;min-width:220px">' + F("ls-c", "How is this lesson completed?", cr.type || "manual", { type: "select", options: [["manual", "The student presses Mark as complete"], ["blocks", "After every required activity is done"], ["timed", "After a minimum time spent"], ["open", "As soon as it is opened"]] }) + '</div><div style="flex:1;min-width:140px">' + F("ls-ms", "Minimum seconds (timed)", cr.min_seconds || "", { type: "number", attrs: 'min="0"' }) + "</div></div>" +
      '<label class="row small" style="gap:6px;margin:4px 0"><input id="ls-op" type="checkbox"' + (cr.optional ? " checked" : "") + '> Optional lesson (not needed to finish the unit)</label>' +
      '<label class="row small" style="gap:6px;margin:4px 0"><input id="ls-ap" type="checkbox"' + (cr.assessment === "pass" ? " checked" : "") + '> The student must pass the lesson quiz before completing it</label>' +
      F("ls-af", "Opens on (optional)", l.available_from ? new Date(new Date(l.available_from) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "", { type: "datetime-local" }) +
      '<div class="fld"><label class="l">Must finish these lessons first (optional)</label><div style="max-height:150px;overflow:auto;border:1px solid var(--bd);border-radius:10px;padding:6px 10px">' +
      (others.length ? others.map(function (o) { return '<label class="row small" style="gap:6px"><input type="checkbox" data-pre="' + o.id + '"' + ((l.prerequisite_lesson_ids || []).indexOf(o.id) > -1 ? " checked" : "") + "> " + h(o.title) + "</label>"; }).join("") : '<span class="muted small">No other lessons yet.</span>') + "</div></div>" +
      '<div class="row"><button class="btn wbtn" id="ls-save">Save lesson</button><button class="btn danger wbtn" id="ls-del">Delete lesson</button></div></div>' +
      '<div class="card"><div class="row sb"><h3 style="margin:0">Lesson content</h3><button class="btn sm wbtn" id="bl-add">+ Add content</button></div><div class="muted small" style="margin:4px 0 10px">Content shows to students in this order. Mark an item required if the lesson only completes after it is done.</div><div id="bl-list"></div></div>' +
      '<div class="card"><div class="row sb"><h3 style="margin:0">Lesson quiz</h3><button class="btn sm ghost wbtn" id="lq-add">+ Add quiz</button></div>' +
      (quizzes.length ? quizzes.map(function (a) { return '<div class="row" style="padding:6px 0"><a href="#learning/assess/' + a.id + '">' + h(a.title) + "</a>" + badge(a.status) + "</div>"; }).join("") : '<div class="muted small" style="margin-top:6px">Optional. Unit and level assessments are added from the program structure.</div>') + "</div>";
    function drawBlocks() {
      $("#bl-list").innerHTML = blocks.length ? blocks.map(function (b, i) {
        var t = BT[b.type] || { name: b.type, sum: function () { return ""; } };
        return '<div class="row" style="gap:8px;padding:8px 0;border-top:1px solid #F0ECDF"><span class="badge">' + h(t.name) + "</span>" + (b.required ? '<span class="badge b-draft">required</span>' : "") + '<span style="flex:1" class="small">' + h(plain(t.sum(b.data || {}))) + "</span>" +
          '<button class="btn ghost sm" data-bm="' + i + '" data-d="-1">&uarr;</button><button class="btn ghost sm" data-bm="' + i + '" data-d="1">&darr;</button><button class="btn ghost sm" data-be="' + i + '">Edit</button></div>'; }).join("") : '<div class="empty">No content yet. Add text, Arabic, a verse, audio or a practice activity.</div>';
      $$("[data-bm]", el).forEach(function (b) { b.onclick = async function () { if (!needWrite()) return; try { if (await move("lesson_blocks", blocks, Number(b.getAttribute("data-bm")), Number(b.getAttribute("data-d")))) lessonEditor(el, id); } catch (e) { fl(e); } }; });
      $$("[data-be]", el).forEach(function (b) { b.onclick = function () { blockModal(l, blocks[Number(b.getAttribute("data-be"))], blocks, function () { lessonEditor(el, id); }); }; });
    }
    drawBlocks();
    $("#bl-add").onclick = function () {
      if (!needWrite()) return;
      modal({ title: "Add content", okLabel: "Next", body: F("bk-t", "What do you want to add?", "rich_text", { type: "select", options: Object.keys(BT).map(function (k) { return [k, BT[k].name]; }) }),
        onOk: function () { var t = val("bk-t"); setTimeout(function () { blockModal(l, { type: t, data: {}, required: false }, blocks, function () { lessonEditor(el, id); }); }, 0); } });
    };
    $("#lq-add").onclick = function () {
      if (!needWrite()) return;
      modal({ title: "Add lesson quiz", okLabel: "Create and open", body: F("lq-t", "Title", l.title + " quiz", { req: true }), onOk: async function () { var t = val("lq-t"); if (!t) return false; try { var r = await q(T("learning_assessments").insert({ program_id: l.program_id, scope: "lesson", lesson_id: id, title: t, status: "draft" }).select("id").single()); location.hash = "#learning/assess/" + r.data.id; } catch (e) { fl(e); return false; } } });
    };
    $("#ls-save").onclick = async function () {
      if (!needWrite()) return; var t = val("ls-t"); if (!t) { toast("Title is required.", true); return; }
      var ty = val("ls-c"), rule = { type: ty, optional: val("ls-op"), assessment: val("ls-ap") ? "pass" : "none" }; if (ty === "timed") rule.min_seconds = Number(val("ls-ms")) || 0;
      var pre = $$("[data-pre]", el).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-pre"); }), af = val("ls-af");
      try { await q(T("learning_lessons").update({ title: t, description: val("ls-d"), objectives: lines(val("ls-o")), est_minutes: num(val("ls-e")), status: val("ls-s"), completion_rule: rule, prerequisite_lesson_ids: pre, available_from: af ? new Date(af).toISOString() : null }).eq("id", id)); toast("Lesson saved"); lessonEditor(el, id); } catch (e) { fl(e); }
    };
    $("#ls-del").onclick = async function () { if (!needWrite()) return; if (await delRow("learning_lessons", id, "this lesson", function () { location.hash = "#learning/" + l.program_id; })) { /* navigated */ } };
  }

  function blockModal(lesson, b, blocks, done) {
    if (!needWrite()) return; var def = BT[b.type], d = b.data || {};
    var body = def.f.map(function (f, i) {
      var id = "bf-" + f[0], k = f[2], v = d[f[0]];
      if (k === "area") return F(id, f[1], v, { type: "textarea", rows: f[3] || 4, attrs: f[4] ? 'dir="rtl" lang="ar" style="font-size:1.3rem"' : "" });
      if (k === "select") return F(id, f[1], v || f[3][0][0], { type: "select", options: f[3] });
      if (k === "vocab") return F(id, f[1], (v || []).map(function (x) { return [x.term, x.meaning, x.arabic || ""].join(" | ").replace(/( \| )+$/, ""); }).join("\n"), { type: "textarea", rows: f[3] });
      if (k === "exitems") return F(id, f[1], (v || []).map(function (x) { return typeof x === "string" ? x : x.q + " | " + x.a; }).join("\n"), { type: "textarea", rows: f[3] });
      if (k === "media") return F(id, f[1], v, {}) + '<button class="btn ghost sm" type="button" id="bf-pick">Choose from Media Library</button>';
      return F(id, f[1], v, {});
    }).join("") + '<label class="row small" style="gap:6px;margin:6px 0"><input id="bf-req" type="checkbox"' + (b.required ? " checked" : "") + "> Required for lesson completion</label>" + (b.id ? '<button class="btn danger sm" id="bf-del" type="button">Delete this content</button>' : "");
    var m = modal({ title: (b.id ? "Edit " : "Add ") + def.name.toLowerCase(), wide: true, body: body,
      onOk: async function () {
        var data = {};
        def.f.forEach(function (f) {
          var v = val("bf-" + f[0]);
          if (f[2] === "vocab") data.items = lines(v).map(function (s) { var p = s.split("|").map(function (x) { return x.trim(); }); return { term: p[0] || "", meaning: p[1] || "", arabic: p[2] || "" }; }).filter(function (x) { return x.term; });
          else if (f[2] === "exitems") data.items = (val("bf-kind") === "cards") ? lines(v).map(function (s) { var p = s.split("|"); return { q: (p[0] || "").trim(), a: (p[1] || "").trim() }; }) : lines(v);
          else data[f[0]] = v;
        });
        if (b.type === "quran_verse" && !data.note) data.note = "";
        var row = { data: data, required: val("bf-req") };
        try { if (b.id) await q(T("lesson_blocks").update(row).eq("id", b.id)); else await q(T("lesson_blocks").insert(Object.assign(row, { program_id: lesson.program_id, lesson_id: lesson.id, type: b.type, sort_order: blocks.length + 1 }))); done(); } catch (e) { fl(e); return false; } } });
    if (b.id) $("#bf-del", m.el).onclick = async function () { if (await delRow("lesson_blocks", b.id, "this content", done)) m.close(); };
    if ($("#bf-pick", m.el)) $("#bf-pick", m.el).onclick = async function () {
      var rows = (await q(T("media_assets").select("title,url,alt_text").order("created_at", { ascending: false }).limit(60))).data || [];
      var pm = modal({ title: "Media Library", ok: false, cancelLabel: "Close", wide: true, body: rows.length ? '<div class="mgrid">' + rows.map(function (r, i) { return '<div class="mcard" style="cursor:pointer" data-mp="' + i + '"><div class="th"><img src="' + h(r.url) + '" alt="" loading="lazy"></div><div class="bd"><b>' + h(r.title) + "</b></div></div>"; }).join("") + "</div>" : '<div class="empty">No images uploaded yet. Add some in Media Library.</div>' });
      $$("[data-mp]", pm.el).forEach(function (c) { c.onclick = function () { var r = rows[Number(c.getAttribute("data-mp"))]; $("#bf-url", m.el).value = r.url; if (!$("#bf-alt", m.el).value) $("#bf-alt", m.el).value = r.alt_text || ""; pm.close(); }; });
    };
  }

  /* ===================================================== ASSESSMENT EDITOR */
  var QT = { single: "Single choice", multiple: "Multiple choice", true_false: "True or false", short_answer: "Short answer", matching: "Matching", ordering: "Put in order", written: "Written answer (teacher marks)", audio: "Audio answer (teacher marks)" };
  var AUTO = { written: 1, audio: 1 };
  async function assessmentEditor(el, id) {
    var a = (await q(T("learning_assessments").select("*").eq("id", id).maybeSingle())).data;
    if (!a) { el.innerHTML = '<div class="alert bad">Assessment not found.</div>'; return; }
    var qs = (await q(T("assessment_questions").select("*").eq("assessment_id", id).order("sort_order").order("created_at"))).data || [];
    var keys = {};
    if (qs.length) ((await q(T("assessment_answer_keys").select("question_id,key").in("question_id", qs.map(function (x) { return x.id; })))).data || []).forEach(function (k) { keys[k.question_id] = k.key; });
    var total = qs.reduce(function (n, x) { return n + Number(x.points); }, 0);
    function iso(t) { return t ? new Date(new Date(t) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ""; }
    var manual = qs.some(function (x) { return AUTO[x.type]; });
    el.innerHTML = '<p class="small"><a href="#learning/' + a.program_id + '">&larr; Back to the program</a></p>' + pageHead(h(a.title) + " " + badge(a.status) + (a.is_sample ? " " + SAMPLE : ""), "Assessment editor. " + qs.length + " questions, " + total + " points" + (manual ? ". Written and audio answers wait for a teacher." : ".")) +
      '<div class="card"><h3 style="margin-top:0">Settings</h3>' + F("as-t", "Title", a.title, { req: true }) + F("as-i", "Instructions for students", a.instructions, { type: "textarea", rows: 2 }) +
      '<div class="row" style="gap:12px;align-items:flex-start">' + [["as-p", "Pass mark (%)", a.pass_score, "0", "100"], ["as-a", "Attempts allowed", a.max_attempts == null ? "" : a.max_attempts, "1", ""], ["as-tm", "Time limit (minutes)", a.time_limit_min == null ? "" : a.time_limit_min, "1", ""], ["as-qc", "Questions per attempt", a.question_count == null ? "" : a.question_count, "1", ""]].map(function (x) { return '<div style="flex:1;min-width:140px">' + F(x[0], x[1], x[2], { type: "number", attrs: 'min="' + x[3] + '"' + (x[4] ? ' max="' + x[4] + '"' : "") }) + "</div>"; }).join("") + "</div>" +
      '<div class="muted small" style="margin:-4px 0 10px">Leave attempts, time and question count empty for no limit and every question. Fewer questions per attempt picks a random set from the bank.</div>' +
      F("as-f", "What students see after submitting", a.feedback_mode, { type: "select", options: [["full", "Score, their answers and the explanations"], ["score", "Score only"], ["none", "Only passed or not yet"]] }) +
      '<div class="row" style="gap:12px"><div style="flex:1;min-width:200px">' + F("as-af", "Opens on (optional)", iso(a.available_from), { type: "datetime-local" }) + '</div><div style="flex:1;min-width:200px">' + F("as-au", "Closes on (optional)", iso(a.available_until), { type: "datetime-local" }) + "</div></div>" + statusSel("as-s", a.status) +
      '<div class="row"><button class="btn wbtn" id="as-save">Save settings</button><button class="btn danger wbtn" id="as-del">Delete assessment</button></div></div>' +
      '<div class="card"><div class="row sb"><h3 style="margin:0">Questions</h3><button class="btn sm wbtn" id="qs-add">+ Add question</button></div><div id="qs-list" style="margin-top:8px"></div></div>';
    $("#qs-list").innerHTML = qs.length ? qs.map(function (x, i) {
      return '<div class="row" style="gap:8px;padding:8px 0;border-top:1px solid #F0ECDF"><span class="muted small" style="width:22px">' + (i + 1) + '</span><span class="badge">' + h(QT[x.type]) + '</span><span style="flex:1" class="small">' + h(plain(x.prompt)) + "</span>" + (x.status !== "published" ? badge(x.status) : "") + '<span class="muted small">' + x.points + ' pt</span>' +
        '<button class="btn ghost sm" data-qm="' + i + '" data-d="-1">&uarr;</button><button class="btn ghost sm" data-qm="' + i + '" data-d="1">&darr;</button><button class="btn ghost sm" data-qe="' + i + '">Edit</button></div>'; }).join("") : '<div class="empty">No questions yet.</div>';
    var again = function () { assessmentEditor(el, id); };
    $$("[data-qm]", el).forEach(function (b) { b.onclick = async function () { if (!needWrite()) return; try { if (await move("assessment_questions", qs, Number(b.getAttribute("data-qm")), Number(b.getAttribute("data-d")))) again(); } catch (e) { fl(e); } }; });
    $$("[data-qe]", el).forEach(function (b) { b.onclick = function () { var x = qs[Number(b.getAttribute("data-qe"))]; questionModal(a, x, keys[x.id] || {}, qs, again); }; });
    $("#qs-add").onclick = function () {
      if (!needWrite()) return;
      modal({ title: "Add question", okLabel: "Next", body: F("qa-t", "Question type", "single", { type: "select", options: Object.keys(QT).map(function (k) { return [k, QT[k]]; }) }), onOk: function () { var t = val("qa-t"); setTimeout(function () { questionModal(a, { type: t, options: [], points: AUTO[t] ? 4 : 1, status: "published" }, {}, qs, again); }, 0); } });
    };
    $("#as-save").onclick = async function () {
      if (!needWrite()) return; var t = val("as-t"); if (!t) { toast("Title is required.", true); return; }
      var ps = Number(val("as-p")); if (isNaN(ps) || ps < 0 || ps > 100) { toast("The pass mark must be between 0 and 100.", true); return; }
      if (a.status !== "published" && val("as-s") === "published" && !qs.length) { toast("Add at least one question before publishing.", true); return; }
      var af = val("as-af"), au = val("as-au"); if (af && au && new Date(au) <= new Date(af)) { toast("The closing time must be after the opening time.", true); return; }
      try { await q(T("learning_assessments").update({ title: t, instructions: val("as-i"), pass_score: ps, max_attempts: num(val("as-a")), time_limit_min: num(val("as-tm")), question_count: num(val("as-qc")), feedback_mode: val("as-f"), status: val("as-s"), available_from: af ? new Date(af).toISOString() : null, available_until: au ? new Date(au).toISOString() : null }).eq("id", id)); toast("Saved"); again(); } catch (e) { fl(e); }
    };
    $("#as-del").onclick = async function () { if (!needWrite()) return; await delRow("learning_assessments", id, "this assessment and its questions", function () { location.hash = "#learning/" + a.program_id; }); };
  }

  function optRows(prefix, opts, correct, multi) {
    return '<div id="' + prefix + '-rows">' + opts.map(function (o, i) { return optRow(prefix, o.text, correct.indexOf(o.id) > -1, multi, i); }).join("") + '</div><button class="btn ghost sm" type="button" id="' + prefix + '-more">+ Add option</button>';
  }
  function optRow(prefix, text, on, multi, i) {
    return '<div class="row orow" style="gap:6px;margin-bottom:6px">' + (prefix === "qr" ? "" : '<input type="' + (multi ? "checkbox" : "radio") + '" name="' + prefix + '-c" class="oc"' + (on ? " checked" : "") + ' title="Correct answer">') + '<input class="ot" value="' + h(text || "") + '" style="flex:1" placeholder="Option ' + (i + 1) + '"><button class="btn ghost sm" type="button" data-orm>Remove</button></div>';
  }
  function bindRows(root, prefix, multi) {
    var rows = $("#" + prefix + "-rows", root);
    function wire() { $$("[data-orm]", rows).forEach(function (b) { b.onclick = function () { b.closest(".orow").remove(); }; }); }
    wire(); $("#" + prefix + "-more", root).onclick = function () { var d = document.createElement("div"); d.innerHTML = optRow(prefix, "", false, multi, rows.children.length); rows.appendChild(d.firstChild); wire(); };
  }
  function pairRows(pairs) { return '<div id="mt-rows">' + pairs.map(pairRow).join("") + '</div><button class="btn ghost sm" type="button" id="mt-more">+ Add pair</button>'; }
  function pairRow(p) { return '<div class="row prow" style="gap:6px;margin-bottom:6px"><input class="pl" value="' + h(p[0] || "") + '" style="flex:1" placeholder="Left"><span>=</span><input class="pr" value="' + h(p[1] || "") + '" style="flex:1" placeholder="Matches with"><button class="btn ghost sm" type="button" data-prm>Remove</button></div>'; }

  function questionModal(a, x, key, qs, done) {
    if (!needWrite()) return; var t = x.type, opts = Array.isArray(x.options) ? x.options : [];
    var body = F("qf-p", "Question", x.prompt, { type: "textarea", rows: 2 }) + F("qf-ar", "Arabic text to show with the question (optional)", x.arabic_text, { type: "textarea", rows: 2, attrs: 'dir="rtl" lang="ar" style="font-size:1.2rem"' });
    if (t === "single" || t === "multiple") { if (!opts.length) opts = [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }]; var cor = t === "single" ? [key.correct] : (key.correct || []); body += '<div class="fld"><label class="l">Options. Tick the correct ' + (t === "single" ? "one" : "ones") + ".</label>" + optRows("qo", opts, cor, t === "multiple") + "</div>"; }
    else if (t === "true_false") body += F("qf-tf", "Correct answer", key.correct === false ? "false" : "true", { type: "select", options: [["true", "True"], ["false", "False"]] });
    else if (t === "short_answer") body += F("qf-ac", "Accepted answers (one per line)", unlines(key.accepted), { type: "textarea", rows: 3, hint: "Capitals and extra spaces are ignored unless you tick the box." }) + '<label class="row small" style="gap:6px"><input id="qf-cs" type="checkbox"' + (key.case_sensitive ? " checked" : "") + "> Capitals must match</label>";
    else if (t === "matching") { var pr = (opts.left || []).map(function (l, i) { var rid = (key.pairs || {})[l.id], r = ((opts.right || []).filter(function (z) { return z.id === rid; })[0] || {}); return [l.text, r.text]; }); if (!pr.length) pr = [["", ""], ["", ""]]; body += '<div class="fld"><label class="l">Pairs. Students see the right side shuffled.</label>' + pairRows(pr) + "</div>"; }
    else if (t === "ordering") { if (!opts.length) opts = [{ id: "o1", text: "" }, { id: "o2", text: "" }, { id: "o3", text: "" }]; var ord = (key.order || []).map(function (id) { return opts.filter(function (o) { return o.id === id; })[0] || { text: "" }; }); if (!ord.length) ord = opts; body += '<div class="fld"><label class="l">Items in the CORRECT order. Students see them shuffled.</label>' + optRows("qr", ord.map(function (o) { return { id: "", text: o.text }; }), [], false) + "</div>"; }
    else body += '<div class="alert info">A teacher reads and marks this answer. There is no answer key.</div>';
    body += '<div class="row" style="gap:12px"><div style="flex:1">' + F("qf-pt", "Points", x.points == null ? 1 : x.points, { type: "number", attrs: 'min="0" step="0.5"' }) + "</div><div style=\"flex:2\">" + F("qf-s", "Status", x.status || "published", { type: "select", options: [["published", "Published"], ["draft", "Draft"], ["archived", "Archived"]] }) + "</div></div>" +
      F("qf-ex", AUTO[t] ? "Guidance for the marker or model answer (shown to the student after marking)" : "Explanation (shown after the quiz)", x.explanation, { type: "textarea", rows: 2 }) + (x.id ? '<button class="btn danger sm" id="qf-del" type="button">Delete question</button>' : "");
    var m = modal({ title: (x.id ? "Edit " : "Add ") + QT[t].toLowerCase(), wide: true, body: body, onOpen: function (api) {
      if (t === "single" || t === "multiple") bindRows(api.el, "qo", t === "multiple"); if (t === "ordering") bindRows(api.el, "qr", false);
      if (t === "matching") { var rows = $("#mt-rows", api.el); var wire = function () { $$("[data-prm]", rows).forEach(function (b) { b.onclick = function () { b.closest(".prow").remove(); }; }); }; wire(); $("#mt-more", api.el).onclick = function () { var d = document.createElement("div"); d.innerHTML = pairRow(["", ""]); rows.appendChild(d.firstChild); wire(); }; } },
      onOk: async function (api) {
        var prompt = val("qf-p"); if (!prompt) { toast("Write the question.", true); return false; }
        var pts = Number(val("qf-pt")); if (isNaN(pts) || pts < 0) { toast("Points must be zero or more.", true); return false; }
        var options = [], k = {}, root = api.el;
        if (t === "single" || t === "multiple") {
          var rs = $$(".orow", root).map(function (r, i) { return { id: "abcdefghij"[i], text: $(".ot", r).value.trim(), on: $(".oc", r).checked }; }).filter(function (r) { return r.text; });
          if (rs.length < 2) { toast("Give at least two options.", true); return false; }
          var ok = rs.filter(function (r) { return r.on; }); if (!ok.length) { toast("Tick the correct answer.", true); return false; } if (t === "single" && ok.length > 1) { toast("Only one option can be correct.", true); return false; }
          options = rs.map(function (r) { return { id: r.id, text: r.text }; }); k = { correct: t === "single" ? ok[0].id : ok.map(function (r) { return r.id; }) };
        } else if (t === "true_false") k = { correct: val("qf-tf") === "true" };
        else if (t === "short_answer") { var ac = lines(val("qf-ac")); if (!ac.length) { toast("Add at least one accepted answer.", true); return false; } k = { accepted: ac, case_sensitive: val("qf-cs") }; }
        else if (t === "matching") {
          var ps2 = $$(".prow", root).map(function (r) { return [$(".pl", r).value.trim(), $(".pr", r).value.trim()]; }).filter(function (r) { return r[0] && r[1]; });
          if (ps2.length < 2) { toast("Give at least two pairs.", true); return false; }
          options = { left: ps2.map(function (p, i) { return { id: "l" + (i + 1), text: p[0] }; }), right: ps2.map(function (p, i) { return { id: "r" + (i + 1), text: p[1] }; }) }; k = { pairs: {} }; ps2.forEach(function (p, i) { k.pairs["l" + (i + 1)] = "r" + (i + 1); });
        } else if (t === "ordering") {
          var it = $$(".orow .ot", root).map(function (i) { return i.value.trim(); }).filter(Boolean); if (it.length < 2) { toast("Give at least two items.", true); return false; }
          options = it.map(function (s, i) { return { id: "o" + (i + 1), text: s }; }); k = { order: options.map(function (o) { return o.id; }) };
        }
        var row = { prompt: prompt, arabic_text: val("qf-ar"), options: options, points: pts, status: val("qf-s"), explanation: val("qf-ex"), type: t };
        try {
          var qid = x.id;
          if (qid) await q(T("assessment_questions").update(row).eq("id", qid));
          else qid = (await q(T("assessment_questions").insert(Object.assign(row, { program_id: a.program_id, assessment_id: a.id, sort_order: qs.length + 1 })).select("id").single())).data.id;
          await q(T("assessment_answer_keys").upsert({ question_id: qid, key: k }));
          done();
        } catch (e) { fl(e); return false; } } });
    if (x.id) $("#qf-del", m.el).onclick = async function () { if (await delRow("assessment_questions", x.id, "this question", done)) m.close(); };
  }

  /* ===================================================== STUDENT PROGRESS */
  var PS = { q: "", program: "", status: "", teacher: "" };
  function bar(pc) { pc = Math.max(0, Math.min(100, Number(pc) || 0)); return '<div style="display:flex;align-items:center;gap:8px;min-width:120px"><div style="flex:1;height:8px;border-radius:99px;background:#EDE8D8;overflow:hidden"><div style="width:' + pc + '%;height:100%;background:var(--g)"></div></div><span class="small">' + pc + "%</span></div>"; }
  var PSTAT = { "Not started": "b-draft", "In progress": "b-published", "Awaiting review": "b-Needs-Support", "Completed": "b-Strong", "Paused": "b-archived", "Withdrawn": "b-archived" };
  function pbadge(v) { return '<span class="badge ' + (PSTAT[v] || "") + '">' + h(v) + "</span>"; }
  VIEWS.progress = async function (el, args) {
    if (args[0] === "review") return args[1] ? reviewAttempt(el, args[1]) : reviewQueue(el);
    if (args[0]) return studentProfile(el, args[0], args[1]);
    var progs = (await q(T("programs").select("id,title").eq("learning_enabled", true).order("sort_order"))).data || [];
    var rows = await rpc("progress_overview", { p_program: PS.program || null });
    var teachers = {}; rows.forEach(function (r) { if (r.teacher_id) teachers[r.teacher_id] = r.teacher_name; });
    var pending = (await rpc("review_queue")).length;
    el.innerHTML = pageHead("Student progress", "Where every enrolled student is, what is waiting for review, and who needs a nudge.",
      '<a class="btn ghost" href="#progress/review">Review queue' + (pending ? " (" + pending + ")" : "") + "</a>" + '<button class="btn ghost wbtn" id="pg-csv">Export CSV</button>') +
      '<div class="panel"><div class="row" style="gap:10px;margin-bottom:12px"><input id="pg-q" type="search" placeholder="Search name or code…" style="max-width:240px" value="' + h(PS.q) + '">' +
      '<select id="pg-p" style="width:auto"><option value="">All programs</option>' + progs.map(function (p) { return '<option value="' + p.id + '"' + (PS.program === p.id ? " selected" : "") + ">" + h(p.title) + "</option>"; }).join("") + "</select>" +
      '<select id="pg-s" style="width:auto"><option value="">All statuses</option>' + Object.keys(PSTAT).map(function (s) { return "<option" + (PS.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select>" +
      '<select id="pg-t" style="width:auto"><option value="">All teachers</option>' + Object.keys(teachers).map(function (id) { return '<option value="' + id + '"' + (PS.teacher === id ? " selected" : "") + ">" + h(teachers[id]) + "</option>"; }).join("") + '</select></div><div id="pg-list"></div></div>';
    function filt() { var t = PS.q.toLowerCase(); return rows.filter(function (r) { return (!PS.status || r.progression_status === PS.status) && (!PS.teacher || r.teacher_id === PS.teacher) && (!t || (r.full_name + " " + r.student_code).toLowerCase().indexOf(t) > -1); }); }
    function draw() {
      var r = filt();
      $("#pg-list").innerHTML = r.length ? '<div class="tw"><table class="tbl"><thead><tr><th>Student</th><th>Program</th><th>Teacher</th><th>Now at</th><th>Progress</th><th>Last score</th><th>Reviews</th><th>Last active</th><th>Status</th></tr></thead><tbody>' + r.map(function (x) {
        return '<tr class="click" data-k="' + x.student_id + "/" + x.program_id + '"><td><b>' + h(x.full_name) + '</b><br><span class="muted small">' + h(x.student_code) + "</span></td><td>" + h(x.program_title) + "</td><td>" + h(x.teacher_name || "-") + "</td><td class=\"small\">" +
          (x.level_title ? h(x.level_title) + (x.unit_title ? "<br>" + h(x.unit_title) : "") : "-") + "</td><td>" + bar(x.percent) + '<span class="muted small">' + x.completed_lessons + " of " + x.total_lessons + " lessons</span></td><td>" + (x.latest_score == null ? "-" : Math.round(x.latest_score) + "%") + "</td><td>" + (x.pending_reviews ? '<span class="badge b-Needs-Support">' + x.pending_reviews + "</span>" : "-") + "</td><td class=\"small\">" + (x.last_activity ? fmtDT(x.last_activity) : "Never") + "</td><td>" + pbadge(x.progression_status) + "</td></tr>"; }).join("") + "</tbody></table></div>" :
        '<div class="empty">' + (rows.length ? "No students match." : "No one is enrolled in a learning program yet. Open a program and use the Students tab.") + "</div>";
      $$("tr[data-k]", $("#pg-list")).forEach(function (tr) { tr.onclick = function () { location.hash = "#progress/" + tr.getAttribute("data-k"); }; });
    }
    $("#pg-q").oninput = function () { PS.q = this.value; draw(); };
    $("#pg-p").onchange = function () { PS.program = this.value; VIEWS.progress(el, []); };
    $("#pg-s").onchange = function () { PS.status = this.value; draw(); };
    $("#pg-t").onchange = function () { PS.teacher = this.value; draw(); };
    $("#pg-csv").onclick = function () {
      var hd = ["Student", "Code", "Program", "Teacher", "Level", "Unit", "Lessons done", "Lessons total", "Percent", "Last score", "Pending reviews", "Last activity", "Status"];
      K.download("student-progress.csv", [hd].concat(filt().map(function (x) { return [x.full_name, x.student_code, x.program_title, x.teacher_name, x.level_title, x.unit_title, x.completed_lessons, x.total_lessons, x.percent, x.latest_score, x.pending_reviews, x.last_activity, x.progression_status]; })).map(function (r) { return r.map(K.csvCell).join(","); }).join("\n"));
    };
    draw();
  };

  /* ---------- review queue and grading ---------- */
  async function reviewQueue(el) {
    var rows = await rpc("review_queue");
    el.innerHTML = '<p class="small"><a href="#progress">&larr; Student progress</a></p>' + pageHead("Review queue", "Written and audio answers waiting for a teacher.") +
      (rows.length ? '<div class="tw"><table class="tbl"><thead><tr><th>Student</th><th>Assessment</th><th>Program</th><th>Attempt</th><th>Submitted</th><th>To mark</th><th></th></tr></thead><tbody>' + rows.map(function (r) { return "<tr><td><b>" + h(r.student_name) + "</b></td><td>" + h(r.assessment_title) + "</td><td>" + h(r.program_title) + "</td><td>" + r.attempt_no + "</td><td>" + fmtDT(r.submitted_at) + "</td><td>" + r.pending_answers + '</td><td class="right"><a class="btn sm" href="#progress/review/' + r.attempt_id + '">Review</a></td></tr>'; }).join("") + "</tbody></table></div>" : '<div class="empty">Nothing is waiting. Well done.</div>');
  }
  async function signedAudio(path) { try { var r = await sb().storage.from("submissions").createSignedUrl(path, 3600); return r.data ? r.data.signedUrl : ""; } catch (e) { return ""; } }
  async function reviewAttempt(el, id) {
    var res = await rpc("attempt_result", { p_attempt: id });
    var meta = (await q(T("assessment_attempts").select("student_id,program_id,assessment_id,students(full_name),learning_assessments(title)").eq("id", id).single())).data;
    var ans = res.answers || [];
    var blocks = await Promise.all(ans.map(async function (a, i) {
      var v = a.answer || {}, shown;
      if (a.type === "audio") { var url = v.path ? await signedAudio(v.path) : ""; shown = url ? '<audio controls src="' + h(url) + '" style="width:100%"></audio>' : '<span class="muted">No recording was submitted.</span>'; }
      else if (a.type === "written") shown = '<div style="white-space:pre-wrap;background:#FAF7EE;border-radius:10px;padding:10px">' + h(v.text || "") + "</div>";
      else shown = '<div class="small muted">Answered automatically: ' + (a.points == null ? "-" : a.points + " of " + a.out_of) + "</div>";
      var mark = a.needs_review ? '<div class="row" style="gap:10px;margin-top:8px"><div style="width:120px">' + F("rv-p" + i, "Points (0 to " + a.out_of + ")", "", { type: "number", attrs: 'min="0" max="' + a.out_of + '" step="0.5"' }) + '</div><div style="flex:1">' + F("rv-f" + i, "Feedback to the student", "", { type: "textarea", rows: 2 }) + "</div></div>" : "";
      return '<div class="card"><div class="muted small">' + h(QT[a.type] || a.type) + " &middot; " + a.out_of + ' points</div><b>' + h(a.prompt) + "</b><div style=\"margin-top:8px\">" + shown + "</div>" + (a.explanation && a.needs_review ? '<div class="small muted" style="margin-top:6px">Marking guidance: ' + h(a.explanation) + "</div>" : "") + mark + "</div>";
    }));
    el.innerHTML = '<p class="small"><a href="#progress/review">&larr; Review queue</a></p>' + pageHead("Review: " + h(meta.learning_assessments.title), h(meta.students.full_name) + ", attempt " + res.attempt_no) + (res.status !== "needs_review" ? '<div class="alert info">This attempt is already marked. Score: ' + (res.score == null ? "-" : Math.round(res.score) + "%") + ".</div>" : "") + blocks.join("") +
      (res.status === "needs_review" ? '<div class="card">' + F("rv-c", "Overall comment (optional)", "", { type: "textarea", rows: 2 }) + '<button class="btn" id="rv-done">Finish review</button></div>' : "");
    if (res.status !== "needs_review") return;
    $("#rv-done").onclick = async function () {
      if (["owner", "administrator", "assessor", "teacher"].indexOf(K.role()) < 0) { toast("Your role cannot mark answers.", true); return; }
      var grades = [];
      for (var i = 0; i < ans.length; i++) { if (!ans[i].needs_review) continue; var p = val("rv-p" + i); if (p === "" || isNaN(Number(p)) || Number(p) < 0 || Number(p) > Number(ans[i].out_of)) { toast("Enter points between 0 and " + ans[i].out_of + " for every answer.", true); K.mark("rv-p" + i, null, true); return; } grades.push({ question_id: ans[i].question_id, points: Number(p), feedback: val("rv-f" + i) }); }
      try { var r = await rpc("review_attempt", { p_attempt: id, p_grades: grades, p_comment: val("rv-c") }); toast("Review saved. Score " + Math.round(r.score) + "%, " + (r.passed ? "passed" : "not passed yet") + "."); location.hash = "#progress/review"; } catch (e) { fl(e); }
    };
  }

  /* ---------- student profile (shared journey component + the staff-only tabs) ---------- */
  var SPTAB = "overview";
  async function studentProfile(el, sid, pid) {
    var data = await rpc("student_journey", { p_student: sid });
    if (!data) { el.innerHTML = '<div class="alert bad">Student not found.</div>'; return; }
    var st = data.student;
    var enr = (await q(T("student_programs").select("id,status,program_id,teacher_id,programs(title)").eq("student_id", sid))).data || [];
    if (enr.length && (!pid || !enr.some(function (e) { return e.program_id === pid; }))) pid = enr[0].program_id;
    var pr = enr.filter(function (e) { return e.program_id === pid; })[0] || null;
    var teachers = (await q(T("teachers").select("id,full_name").order("full_name"))).data || [];
    var refresh = function () { studentProfile(el, sid, pid); };
    var S = null, getS = async function () { return S || (S = await rpc("student_learning", { p_student: sid, p_program: pid })); };
    var noEnr = function (body) { body.innerHTML = '<div class="empty">Enrol ' + h(st.name) + " in a learning program first (use the Enrolment button above).</div>"; };
    var waiting = data.scores.waiting;
    el.innerHTML = '<p class="small"><a href="#progress">&larr; Student progress</a> &middot; <a href="#students/' + sid + '">Student record</a></p>' +
      (enr.length > 1 ? '<div class="row" style="margin-bottom:10px"><span class="muted small">Program for map, overrides and certificates:</span><select id="sp-prog" style="width:auto">' + enr.map(function (e) { return '<option value="' + e.program_id + '"' + (e.program_id === pid ? " selected" : "") + ">" + h(e.programs.title) + "</option>"; }).join("") + "</select></div>" : "") +
      (waiting ? '<div class="alert warn">' + waiting + ' attempt(s) are waiting for review. <a href="#progress/review">Open the review queue</a></div>' : "") +
      (st.has_login ? "" : '<div class="alert info">This student has no sign-in yet, so they cannot open lessons. Use the Student sign-in button below to create one.</div>') +
      '<div id="sp-host"></div>';
    if ($("#sp-prog")) $("#sp-prog").onchange = function () { location.hash = "#progress/" + sid + "/" + this.value; };
    var mapTab = async function (body) {
      if (!pr) return noEnr(body);
      var S2 = await getS();
      body.innerHTML = S2.levels.map(function (lv) { return '<div class="card"><div class="row sb"><b>Level ' + lv.number + ": " + h(lv.title) + "</b><span>" + (lv.done ? badge("Completed") : lv.open ? badge("Open") : badge("Locked")) + (lv.needs_approval && !lv.done ? ' <span class="badge b-Needs-Support">needs teacher approval</span>' : "") + "</span></div>" + bar(lv.percent) +
        lv.domains.map(function (d) { return '<div style="margin-top:10px"><div class="muted small" style="text-transform:uppercase;letter-spacing:.06em;font-weight:700">' + h(d.title) + "</div>" + d.units.map(function (u) { return '<div class="row small" style="gap:8px;padding:3px 0"><span style="flex:1">' + h(u.title) + "</span>" + (u.done ? badge("Completed") : u.open ? '<span class="muted">' + u.percent + "%</span>" : badge("Locked")) + "</div>"; }).join("") + "</div>"; }).join("") + "</div>"; }).join("") +
        (S2.feedback.length ? '<div class="card"><b>Teacher feedback</b>' + S2.feedback.map(function (f) { return '<div class="small" style="margin-top:6px"><b>' + h(f.assessment) + ":</b> " + h(f.text) + "</div>"; }).join("") + "</div>" : "");
    };
    var attTab = async function (body) {
      if (!pr) return noEnr(body);
      var at = (await q(T("assessment_attempts").select("id,attempt_no,status,score,passed,submitted_at,learning_assessments(title)").eq("student_id", sid).eq("program_id", pid).order("started_at", { ascending: false }))).data || [];
      body.innerHTML = at.length ? '<div class="tw"><table class="tbl"><thead><tr><th>Assessment</th><th>Attempt</th><th>Submitted</th><th>Score</th><th>Result</th><th></th></tr></thead><tbody>' + at.map(function (a) { return "<tr><td>" + h(a.learning_assessments.title) + "</td><td>" + a.attempt_no + "</td><td>" + (a.submitted_at ? fmtDT(a.submitted_at) : "In progress") + "</td><td>" + (a.score == null ? "-" : Math.round(a.score) + "%") + "</td><td>" + (a.status === "needs_review" ? badge("Awaiting review") : a.status === "graded" ? (a.passed ? badge("Passed") : badge("Not yet")) : "-") + '</td><td class="right">' + (a.status !== "in_progress" ? '<a class="btn ghost sm" href="#progress/review/' + a.id + '">' + (a.status === "needs_review" ? "Review" : "View") + "</a>" : "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">No attempts yet.</div>';
    };
    var acts = '<button class="btn ghost wbtn" id="sp-acc">Student sign-in</button>' + (pr ? '<button class="btn ghost wbtn" id="sp-enr">Enrolment</button>' : "") + '<button class="btn ghost wbtn" id="sp-photo">Photo</button>';
    var J = window.InayaJourney.mount($("#sp-host"), data, {
      admin: true, tab: SPTAB, actions: acts, certHref: function (id) { return "/learn#cert/" + id; }, onTab: function (k) { SPTAB = k; },
      tabs: [{ key: "map", label: "Course map", render: mapTab }, { key: "attempts", label: "Assessments", render: attTab },
        { key: "overrides", label: "Overrides", render: async function (body) { if (!pr) return noEnr(body); overridesTab(body, await getS(), sid, pid, refresh); } },
        { key: "certs", label: "Certificates", render: async function (body) { if (!pr) return noEnr(body); certsTab(body, await getS(), sid, pid, refresh); } }]
    });
    $("#sp-acc").onclick = function () { accountModal({ id: st.id, full_name: st.name, student_code: st.code, user_id: st.has_login ? "x" : null }, refresh); };
    if ($("#sp-enr")) $("#sp-enr").onclick = function () {
      if (!needWrite()) return;
      modal({ title: "Change enrolment", body: F("ce-s", "Status", pr.status, { type: "select", options: [["active", "Active"], ["paused", "Paused (access stops, progress kept)"], ["completed", "Completed"], ["withdrawn", "Withdrawn (progress kept)"]] }) + F("ce-t", "Teacher", pr.teacher_id || "", { type: "select", options: [["", "Not assigned"]].concat(teachers.map(function (t) { return [t.id, t.full_name]; })) }),
        onOk: async function () { try { await rpc("set_enrollment", { p_id: pr.id, p_status: val("ce-s"), p_teacher: val("ce-t") || null }); toast("Saved"); refresh(); } catch (e) { fl(e); return false; } } });
    };
    $("#sp-photo").onclick = function () {
      if (!needWrite()) return;
      modal({ title: "Student photo", okLabel: "Save", body: F("ph-u", "Picture link", st.photo_url || "", { hint: "Paste the link of an image from the Media Library (starts with https:// or /). Leave empty to remove the photo." }),
        onOk: async function () { var v = (val("ph-u") || "").trim(); if (v && !/^(https:\/\/|\/)/.test(v)) { fl(new Error("The link must start with https:// or /")); return false; }
          try { await q(T("students").update({ photo_url: v || null }).eq("id", sid)); toast("Saved"); refresh(); } catch (e) { fl(e); return false; } } });
    };
  }

  async function accountFn(body) {
    var ses = (await sb().auth.getSession()).data.session, cfg = window.INAYA_CONFIG || {};
    var r = await fetch(String(cfg.SUPABASE_URL || "").replace(/\/+$/, "") + "/functions/v1/student-account", { method: "POST", headers: { "content-type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + (ses ? ses.access_token : "") }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || "The sign-in service did not answer. Is the student-account function deployed?");
    return j;
  }
  function linkBox(j) { return j.setup_link ? '<div class="alert ok" style="margin-top:10px">Send this one-time link to the student so they can choose a password:<br><input readonly value="' + h(j.setup_link) + '" onclick="this.select()" style="width:100%;margin-top:6px"></div>' : ""; }
  function accountModal(st, refresh) {
    if (!needWrite()) return;
    if (st.user_id) {
      var m = modal({ title: "Student sign-in", ok: false, cancelLabel: "Close", body: '<p style="margin-top:0">' + h(st.full_name) + ' can sign in at <b>/learn</b>.</p><div class="row"><button class="btn ghost" id="ac-reset">Make a password link</button><button class="btn danger" id="ac-off">Block sign-in</button><button class="btn ghost" id="ac-on">Allow sign-in again</button></div><div id="ac-out"></div>' });
      $("#ac-reset", m.el).onclick = async function () { try { var j = await accountFn({ action: "reset_link", student_id: st.id }); $("#ac-out", m.el).innerHTML = linkBox(j); } catch (e) { fl(e); } };
      $("#ac-off", m.el).onclick = async function () { if (!(await confirmBox("Block this student from signing in? Their progress is kept."))) return; try { await accountFn({ action: "disable", student_id: st.id }); toast("Sign-in blocked"); } catch (e) { fl(e); } };
      $("#ac-on", m.el).onclick = async function () { try { await accountFn({ action: "enable", student_id: st.id }); toast("Sign-in allowed again"); } catch (e) { fl(e); } };
      return;
    }
    var out = null;
    var m2 = modal({ title: "Create student sign-in", okLabel: "Create sign-in", body: '<p class="small muted" style="margin-top:0">Give the student an email address. Either set a first password yourself, or leave it empty to get a one-time link to send them.</p>' + F("ac-e", "Student or parent email", "", { type: "email", req: true }) + F("ac-p", "First password (optional, 10+ characters)", "", { type: "text", attrs: 'autocomplete="off"' }) + '<div id="ac-out"></div>',
      onOk: async function () { var e = val("ac-e"); if (!e) { toast("Enter an email.", true); return false; } try { var j = await accountFn({ action: "create", student_id: st.id, email: e, password: val("ac-p") }); toast("Sign-in created"); if (j.setup_link) { $("#ac-out", m2.el).innerHTML = linkBox(j); $("[data-ok]", m2.el).style.display = "none"; $("[data-x]", m2.el).textContent = "Done"; var x = $("[data-x]", m2.el); x.onclick = function () { m2.close(); refresh(); }; return false; } refresh(); } catch (er) { fl(er); return false; } } });
  }

  async function overridesTab(body, S, sid, pid, refresh) {
    var ov = (await q(T("progression_overrides").select("id,target_type,target_id,action,reason,created_at,revoked_at").eq("student_id", sid).eq("program_id", pid).order("created_at", { ascending: false }))).data || [];
    var names = {}; S.levels.forEach(function (lv) { names[lv.id] = "Level " + lv.number + ": " + lv.title; lv.domains.forEach(function (d) { d.units.forEach(function (u) { names[u.id] = u.title; u.lessons.forEach(function (l) { names[l.id] = l.title; }); }); }); });
    body.innerHTML = '<div class="card"><div class="row sb"><b>Overrides</b><button class="btn sm wbtn" id="ov-add">+ New override</button></div><div class="muted small" style="margin:4px 0 8px">Open a locked step, mark something complete, or approve a level for this student only. A reason is required and is kept in their history.</div>' +
      (ov.length ? ov.map(function (o) { return '<div class="row small" style="gap:8px;padding:6px 0;border-top:1px solid #F0ECDF"><span style="flex:1"><b>' + h(o.action) + " " + h(o.target_type) + ":</b> " + h(names[o.target_id] || "(removed)") + '<br><span class="muted">' + h(o.reason) + " &middot; " + fmtDT(o.created_at) + "</span></span>" + (o.revoked_at ? badge("archived") : '<button class="btn ghost sm" data-rv="' + o.id + '">Remove</button>') + "</div>"; }).join("") : '<div class="muted small">No overrides.</div>') + "</div>";
    $$("[data-rv]", body).forEach(function (b) { b.onclick = async function () { if (!needWrite()) return; try { await rpc("revoke_override", { p_id: b.getAttribute("data-rv") }); toast("Removed"); refresh(); } catch (e) { fl(e); } }; });
    $("#ov-add").onclick = function () {
      if (!needWrite()) return;
      var all = { level: S.levels.map(function (lv) { return [lv.id, names[lv.id]]; }), unit: [], lesson: [] };
      S.levels.forEach(function (lv) { lv.domains.forEach(function (d) { d.units.forEach(function (u) { all.unit.push([u.id, lv.title + " / " + u.title]); u.lessons.forEach(function (l) { all.lesson.push([l.id, u.title + " / " + l.title]); }); }); }); });
      var m = modal({ title: "New override", okLabel: "Apply", body: F("ov-ty", "What to change", "lesson", { type: "select", options: [["lesson", "A lesson"], ["unit", "A unit"], ["level", "A level"]] }) + '<div id="ov-tg"></div>' +
        F("ov-ac", "Action", "unlock", { type: "select", options: [["unlock", "Unlock it"], ["complete", "Mark it complete"], ["approve", "Approve it (levels that need a teacher)"]] }) + F("ov-re", "Reason (required)", "", { type: "textarea", rows: 2 }),
        onOpen: function (api) { function draw() { $("#ov-tg", api.el).innerHTML = F("ov-t", "Which one", "", { type: "select", options: all[$("#ov-ty", api.el).value] }); } $("#ov-ty", api.el).onchange = draw; draw(); },
        onOk: async function () { var r = val("ov-re"); if (r.length < 5) { toast("Write a short reason.", true); return false; } try { await rpc("grant_override", { p_student: sid, p_program: pid, p_type: val("ov-ty"), p_target: val("ov-t"), p_action: val("ov-ac"), p_reason: r }); toast("Override applied"); refresh(); } catch (e) { fl(e); return false; } } });
    };
  }

  async function certsTab(body, S, sid, pid, refresh) {
    var cs = (await q(T("certificates").select("id,code,title,issued_at,revoked_at").eq("student_id", sid).eq("program_id", pid).order("issued_at", { ascending: false }))).data || [];
    body.innerHTML = '<div class="card"><div class="row sb"><b>Certificates</b><button class="btn sm wbtn" id="ce-add">+ Issue certificate</button></div><div class="muted small" style="margin:4px 0 8px">Certificates are issued automatically when a level or the program is finished, if you left that switched on. You can also issue or revoke one by hand. Anyone can check a code on the public certificate check page.</div>' +
      (cs.length ? cs.map(function (c) { return '<div class="row small" style="gap:8px;padding:6px 0;border-top:1px solid #F0ECDF"><span style="flex:1"><b>' + h(c.title) + "</b><br><span class=\"muted\">Code " + h(c.code) + " &middot; " + fmtDT(c.issued_at) + "</span></span>" + '<a class="btn ghost sm" target="_blank" rel="noopener" href="/learn#cert/' + c.id + '">View</a>' + (c.revoked_at ? badge("archived") : '<button class="btn ghost sm" data-cr="' + c.id + '">Revoke</button>') + "</div>"; }).join("") : '<div class="muted small">None yet.</div>') + "</div>";
    $$("[data-cr]", body).forEach(function (b) { b.onclick = async function () { if (!needWrite()) return; if (!(await confirmBox("Revoke this certificate? The code will show as no longer valid.", { danger: true, okLabel: "Revoke" }))) return; try { await rpc("revoke_certificate", { p_id: b.getAttribute("data-cr") }); refresh(); } catch (e) { fl(e); } }; });
    $("#ce-add").onclick = function () {
      if (!needWrite()) return;
      modal({ title: "Issue certificate", okLabel: "Issue", body: F("ci-l", "For", "", { type: "select", options: [["", "The whole program"]].concat(S.levels.map(function (lv) { return [lv.id, "Level " + lv.number + ": " + lv.title]; })) }) + F("ci-t", "Certificate title", S.program.title + " completion", { req: true }),
        onOk: async function () { try { await rpc("issue_certificate", { p_student: sid, p_program: pid, p_level: val("ci-l") || null, p_title: val("ci-t") }); toast("Issued"); refresh(); } catch (e) { fl(e); return false; } } });
    };
  }

  /* ===================================================== NAV */
  var ac = K.NAV.filter(function (g) { return g[0] === "Academy"; })[0];
  if (ac) { ac[1].unshift(["learning", "Learning Programs", "cap"], ["progress", "Student Progress", "chart"]); }
};
