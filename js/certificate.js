/* Certificate of achievement. Pure markup: window.InayaCert.html({ name, title, program, level, date, code, revoked }).
   The logo file is used as it is (never recoloured or resized out of proportion). Styles: /css/certificate.css */
(function () {
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* eight pointed star, the classic Islamic geometric unit */
  function star(cls, size) {
    return '<svg class="' + cls + '" viewBox="-50 -50 100 100" width="' + (size || 24) + '" height="' + (size || 24) + '" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"><rect x="-30" y="-30" width="60" height="60"/><rect x="-30" y="-30" width="60" height="60" transform="rotate(45)"/><circle r="9" fill="currentColor" stroke="none"/></g></svg>';
  }
  function corner(pos) {
    return '<svg class="ct-corner ' + pos + '" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
      '<path d="M4 116V30Q4 4 30 4H116"/><path d="M14 116V36Q14 14 36 14H116" stroke-width="1"/>' +
      '<g transform="translate(34 34)"><rect x="-13" y="-13" width="26" height="26" fill="#FFFDF7"/><rect x="-13" y="-13" width="26" height="26" transform="rotate(45)" fill="#FFFDF7"/><circle r="4" fill="currentColor" stroke="none"/></g></g></svg>';
  }
  function seal() {
    var pts = [], i; for (i = 0; i < 24; i++) { var a = i * Math.PI / 12, r = i % 2 ? 44 : 49; pts.push((50 + r * Math.cos(a)).toFixed(2) + "," + (50 + r * Math.sin(a)).toFixed(2)); }
    return '<svg class="ct-seal" viewBox="0 0 100 100" role="img" aria-label="Seal"><defs><radialGradient id="sg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#E7CF98"/><stop offset=".55" stop-color="#C9A55F"/><stop offset="1" stop-color="#9C7A36"/></radialGradient></defs>' +
      '<polygon points="' + pts.join(" ") + '" fill="url(#sg)"/><circle cx="50" cy="50" r="37" fill="none" stroke="#FFF6DC" stroke-width="1.4"/><circle cx="50" cy="50" r="33" fill="none" stroke="#FFF6DC" stroke-width=".6"/>' +
      '<g transform="translate(50 50)" fill="none" stroke="#FFF6DC" stroke-width="2.4" stroke-linejoin="round"><rect x="-17" y="-17" width="34" height="34"/><rect x="-17" y="-17" width="34" height="34" transform="rotate(45)"/><circle r="5" fill="#FFF6DC" stroke="none"/></g></svg>';
  }

  function html(o) {
    var verify = (location.host || "inayaquran.com") + "/learn#verify";
    var sub = [o.program, o.level].filter(Boolean).join("  ·  ");
    return '<div class="ct-wrap"><div class="ct-sheet" id="ct-sheet">' +
      '<div class="ct-frame"></div><div class="ct-frame2"></div>' + corner("tl") + corner("tr") + corner("bl") + corner("br") +
      (o.revoked ? '<div class="ct-void">No longer valid</div>' : "") +
      '<div class="ct-body">' +
        '<div class="ct-bism" lang="ar" dir="rtl">بسم الله الرحمن الرحيم</div>' +
        '<img class="ct-logo" src="/assets/img/logo.png" alt="Inaya Quran Academy">' +
        '<div class="ct-kicker">Certificate</div>' +
        '<h1 class="ct-title">of Achievement</h1>' +
        '<div class="ct-orn"><i></i>' + star("ct-star", 14) + "<i></i></div>" +
        '<p class="ct-small">This certificate is proudly presented to</p>' +
        '<div class="ct-name">' + esc(o.name) + "</div>" +
        '<p class="ct-small">in recognition of successfully completing</p>' +
        '<div class="ct-course">' + esc(o.title) + "</div>" +
        (sub ? '<div class="ct-sub">' + esc(sub) + "</div>" : "") +
        '<div class="ct-foot">' +
          '<div class="ct-sig"><div class="ct-val">' + esc(o.date) + '</div><div class="ct-line"></div><div class="ct-lab">Date of issue</div></div>' +
          '<div class="ct-sealbox">' + seal() + "</div>" +
          '<div class="ct-sig"><div class="ct-val ct-hand">&nbsp;</div><div class="ct-line"></div><div class="ct-lab">Director, Inaya Quran Academy</div></div>' +
        "</div>" +
        '<div class="ct-code">Certificate no. <b>' + esc(o.code) + "</b> &nbsp;·&nbsp; Check it at " + esc(verify) + "</div>" +
      "</div></div></div>";
  }
  window.InayaCert = { html: html };
})();
