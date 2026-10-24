/* Public curriculum view for a program page: levels, domains and units. Shows titles only, never lesson content or answers. */
window.InayaCurriculum = (function () {
  var h = Inaya.esc;
  async function render(p, mountAfter) {
    var id = encodeURIComponent(p.id), f = "&status=eq.published&order=sort_order";
    var rs = await Promise.all([Inaya.get("program_levels?select=id,title,level_number,description,objectives,color&program_id=eq." + id + f + ",level_number"), Inaya.get("learning_domains?select=id,title,description&program_id=eq." + id + f),
      Inaya.get("learning_units?select=id,title,description,level_id,domain_id,est_minutes&program_id=eq." + id + f), Inaya.get("learning_lessons?select=id,title,unit_id&program_id=eq." + id + f)]);
    var lv = rs[0], dm = rs[1], un = rs[2], ls = rs[3];
    if (!lv || !dm || !un || !un.length) return;
    var sec = document.createElement("section"); sec.className = "section cur"; sec.id = "curriculum";
    var active = 0;
    function draw() {
      var l = lv[active], units = un.filter(function (u) { return u.level_id === l.id; }), lessons = units.reduce(function (n, u) { return n + ls.filter(function (x) { return x.unit_id === u.id; }).length; }, 0);
      sec.innerHTML = '<div class="container"><h2>Curriculum</h2><p class="lead">' + lv.length + " levels, " + dm.length + ' areas of study. Every level builds on the one before it.</p>' +
        '<div class="cur-tabs" role="group" aria-label="Levels">' + lv.map(function (x, i) { return '<button type="button" aria-pressed="' + (i === active) + '" data-i="' + i + '">Level ' + x.level_number + ": " + h(x.title) + "</button>"; }).join("") + "</div>" +
        '<div class="lp-card"><p style="margin-top:0">' + h(l.description || "") + "</p>" + ((l.objectives || []).length ? "<ul>" + l.objectives.map(function (o) { return "<li>" + h(o) + "</li>"; }).join("") + "</ul>" : "") +
        '<p class="lp-mut">' + units.length + " units and " + lessons + " lessons in this level.</p></div>" +
        dm.map(function (d) { var us = units.filter(function (u) { return u.domain_id === d.id; }); if (!us.length) return ""; return '<div class="lp-card"><h3>' + h(d.title) + "</h3>" + (d.description ? '<p class="lp-mut" style="margin-top:-.4rem">' + h(d.description) + "</p>" : "") +
          us.map(function (u) { var ll = ls.filter(function (x) { return x.unit_id === u.id; }); return '<details style="padding:6px 0;border-top:1px solid var(--border)"><summary style="cursor:pointer;font-weight:600">' + h(u.title) + ' <span class="lp-mut" style="font-weight:400">(' + ll.length + " lessons)</span></summary>" + (u.description ? '<p class="lp-mut" style="margin:.4em 0">' + h(u.description) + "</p>" : "") + "<ul>" + ll.map(function (x) { return "<li>" + h(x.title) + "</li>"; }).join("") + "</ul></details>"; }).join("") + "</div>"; }).join("") +
        '<div class="btn-row"><a class="btn" href="/assessment">' + h(p.cta_label || "Book a Free Assessment") + '</a><a class="btn ghost" href="/learn">Student sign in</a></div></div>';
      Array.prototype.forEach.call(sec.querySelectorAll(".cur-tabs button"), function (b) { b.onclick = function () { active = Number(b.getAttribute("data-i")); draw(); var t = sec.querySelector('.cur-tabs button[aria-pressed="true"]'); if (t) t.focus(); }; });
    }
    draw();
    var main = document.getElementById("main"); (mountAfter || main).appendChild(sec);
  }
  return { render: render };
})();
