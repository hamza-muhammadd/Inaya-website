/* Renders CMS-managed pages (home, about, privacy, terms) from the published
   sections in the database, or from the built-in defaults when none are saved. */
Inaya.boot(async function (s) {
  var main = document.getElementById("main"), slug = main.getAttribute("data-page");
  var r = await Promise.all([Inaya.loadPage(slug), Inaya.loadPrograms(), Inaya.loadFaqs()]);
  var page = r[0], ctx = { settings: s, programs: r[1], faqs: r[2] };
  if (page.hidden && slug !== "home") {
    main.innerHTML = '<section class="section"><div class="container center"><h1>Page not available</h1><p class="lead" style="margin:0 auto 1.4rem">This page is not published right now.</p><a class="btn" href="/">Go to home</a></div></section>';
    var m = document.createElement("meta"); m.name = "robots"; m.content = "noindex"; document.head.appendChild(m);
    return;
  }
  var sections = (page.sections && page.sections.length) ? page.sections : InayaSections.defaults(slug);
  main.innerHTML = InayaSections.render(sections, ctx);
  var path = slug === "home" ? "/" : "/" + slug;
  Inaya.setMeta({
    title: page.seo_title || (slug === "home" ? s.seo_title : (page.title || slug) + " — " + s.academy_name),
    description: page.seo_description || s.seo_description,
    image: page.og_image || s.og_image, siteUrl: s.site_url,
    canonical: s.site_url.replace(/\/+$/, "") + (path === "/" ? "/" : path)
  });
});
