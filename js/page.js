/* Renders CMS-managed pages (home, about, privacy, terms) from the published
   sections in the database, or from the built-in defaults when none are saved. */
Inaya.boot(async function (s) {
  var main = document.getElementById("main"), slug = main.getAttribute("data-page");
  if (!slug) { slug = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, "").toLowerCase(); }   // generic page.html: slug comes from the URL
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) slug = "";
  var r = await Promise.all([Inaya.loadPage(slug), Inaya.loadPrograms(), Inaya.loadFaqs()]);
  var page = r[0], ctx = { settings: s, programs: r[1], faqs: r[2] };
  var BUILTIN = InayaSections.META[slug];   // built-in pages fall back to their default layout when no row exists yet
  if (!slug || (page.hidden && !(slug === "home" || BUILTIN))) {
    main.innerHTML = '<section class="section"><div class="container center"><h1>Page not found</h1><p class="lead" style="margin:0 auto 1.4rem">This page does not exist or is not published right now.</p><a class="btn" href="/">Go to home</a></div></section>';
    var m = document.createElement("meta"); m.name = "robots"; m.content = "noindex"; document.head.appendChild(m);
    return;
  }
  var sections = (page.sections && page.sections.length) ? page.sections : InayaSections.defaults(slug);
  if (!sections.length) sections = [InayaSections.newSection("page_head", { heading: page.title || slug })];
  if (page.noindex) { var ni = document.createElement("meta"); ni.name = "robots"; ni.content = "noindex"; document.head.appendChild(ni); }
  else { var ex = document.querySelector('meta[name="robots"]'); if (ex && !page.hidden) ex.remove(); }
  main.innerHTML = InayaSections.render(sections, ctx);
  var mounts = main.querySelectorAll("[data-mount]");
  if (mounts.length) {
    var go = function () { mounts.forEach(function (m) { InayaForms.mount(m, s); }); };
    if (window.InayaForms) go(); else { var sc = document.createElement("script"); sc.src = "/js/forms.js"; sc.onload = go; document.head.appendChild(sc); await new Promise(function (r) { sc.onload = function () { go(); r(); }; sc.onerror = r; }); }
  }
  var path = slug === "home" ? "/" : "/" + slug;
  Inaya.setMeta({
    title: page.seo_title || (slug === "home" ? s.seo_title : ((BUILTIN && BUILTIN.title) || page.title || slug) + " | " + s.academy_name),
    description: page.seo_description || (BUILTIN && BUILTIN.description) || s.seo_description,
    image: page.og_image || s.og_image, siteUrl: s.site_url,
    canonical: s.site_url.replace(/\/+$/, "") + (path === "/" ? "/" : path)
  });
});
