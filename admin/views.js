/* Admin shell, navigation, search, dashboard, pages, shared parts, products, media. */
(function () {
  "use strict";
  var h = A.h, $ = A.$;

  var NAV = [
    ["", [["/dashboard", "Dashboard"]]],
    ["Content", [["/pages", "Pages"], ["/shared/header", "Header and menu"], ["/shared/footer", "Footer"], ["/shared/contact", "Contact popup"], ["/media", "Images and files"]]],
    ["Shop", [["/products", "Products"], ["/shared/product", "Text shared by all product pages"]]],
    ["Customers", [["/orders", "Orders", "orders"], ["/promos", "Promo codes"], ["/subscribers", "Subscribers"], ["/messages", "Messages", "messages"], ["/site/contact", "Contact form"]]],
    ["Site", [["/site/seo", "Search and sharing"], ["/site/banner", "Announcement bar"], ["/site/look", "Look and feel"], ["/site/tracking", "Tracking and chat"], ["/site/orders", "Orders and contact details"], ["/site/shop", "Shipping and discounts"], ["/site/payments", "Payment instructions"], ["/site/welcome", "Welcome popup"], ["/site/contactinfo", "Hours and social links"], ["/site/redirects", "Redirects"], ["/site/maintenance", "Maintenance mode"]]],
    ["Admin", [["/admin/history", "Activity and undo"], ["/admin/backup", "Backup and restore"], ["/admin/team", "Team"], ["/admin/help", "Help and guide"]]]
  ];
  A.NAV = NAV;
  A.badges = { orders: 0, messages: 0 };

  A.pageShell = function (title, crumbs, note, content) {
    var c = h("div", { class: "crumbs" });
    (crumbs || []).forEach(function (x, i) {
      if (i) c.appendChild(document.createTextNode(" / "));
      c.appendChild(x[1] ? h("a", { href: "#" + x[1] }, x[0]) : document.createTextNode(x[0]));
    });
    return h("div", { class: "page" }, c, h("h1", { class: "t" }, title), note ? h("div", { class: "note" }, note) : null, content);
  };
  A.lockNote = function (min, what) {
    return A.can(min) ? document.createComment("ok") : h("div", { class: "msg warn" }, "Your role (" + A.role + ") can look at " + what + " but not change it.");
  };

  /* ---------- shell ---------- */
  A.mount = function () {
    var app = A.clear($("#app"));
    var side = h("aside", { class: "side", id: "side" });
    side.appendChild(h("div", { class: "brand" }, "A-Tech Labs Admin"));
    var nav = h("nav", { class: "nav" });
    NAV.forEach(function (g) {
      if (g[0]) nav.appendChild(h("div", { class: "grp" }, g[0]));
      g[1].forEach(function (it) {
        var a = h("a", { href: "#" + it[0], "data-path": it[0] }, h("span", null, it[1]), it[2] ? h("span", { class: "badge", id: "badge-" + it[2], style: { display: "none" } }, "0") : null);
        nav.appendChild(a);
      });
    });
    side.appendChild(nav);

    var sInput = h("input", { type: "text", id: "gsearch", placeholder: "Search the admin and the site text (press /)", autocomplete: "off" });
    var results = h("div", { class: "results", style: { display: "none" } });
    var search = h("div", { class: "search" }, sInput, results);
    var top = h("div", { class: "top" },
      h("button", { class: "btn sm menu", onclick: function () { side.classList.toggle("open"); } }, "Menu"),
      search,
      h("div", { class: "who" }, h("span", null, A.user.email + " (" + A.role + ")"), h("a", { class: "btn sm", href: "../index.html", target: "_blank" }, "View site"), h("button", { class: "btn sm", onclick: A.signOut }, "Sign out")));
    var view = h("div", { id: "view" });
    var bar = h("div", { class: "savebar hide", id: "savebar" });
    app.appendChild(h("div", { class: "shell" }, side, h("div", { class: "main" }, top, view)));
    app.appendChild(bar);
    bindSearch(sInput, results);
    A.onDirty(drawBar);
    drawBar();
    window.addEventListener("beforeunload", function (e) { if (A.dirtyCount()) { e.preventDefault(); e.returnValue = ""; } });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { e.preventDefault(); sInput.focus(); }
    });
    window.addEventListener("hashchange", A.render);
    A.refreshBadges();
  };

  function drawBar() {
    var bar = $("#savebar"); if (!bar) return;
    var n = A.dirtyCount();
    bar.classList.toggle("hide", n === 0);
    A.clear(bar);
    if (!n) return;
    var canSave = A.can("editor");
    bar.appendChild(h("div", null, n + " unsaved change" + (n === 1 ? "" : "s") + ". Nothing is live until you press Save."));
    bar.appendChild(h("div", { class: "row" },
      h("button", { class: "btn", id: "discard", onclick: function () { if (confirm("Discard all unsaved changes?")) { A.discard(); A.render(); } } }, "Discard"),
      h("button", { class: "btn pri", id: "savebtn", disabled: !canSave, onclick: async function (e) {
        e.target.disabled = true; e.target.textContent = "Saving...";
        try { await A.save(); A.toast("Saved. The site is updated."); A.render(); } catch (err) { A.toast("Could not save: " + err.message); e.target.disabled = false; e.target.textContent = "Save and publish"; }
      } }, "Save and publish")));
  }

  A.refreshBadges = async function () {
    try {
      var o = await A.rest("GET", "orders?status=eq.new&select=id"), m = await A.rest("GET", "messages?status=eq.new&select=id");
      A.badges.orders = o.length; A.badges.messages = m.length;
      ["orders", "messages"].forEach(function (k) { var b = $("#badge-" + k); if (b) { b.textContent = A.badges[k]; b.style.display = A.badges[k] ? "" : "none"; } });
    } catch (e) {}
  };

  A.render = function () {
    var view = $("#view"); if (!view) return;
    var r = A.parseHash();
    $("#side").classList.remove("open");
    A.$$(".nav a").forEach(function (a) { var p = a.getAttribute("data-path"); a.classList.toggle("on", r.path === p || (p !== "/pages" && p !== "/products" && false) || (p === "/pages" && /^\/page\//.test(r.path)) || (p === "/products" && /^\/product\//.test(r.path))); });
    A.clear(view);
    for (var i = 0; i < A.routes.length; i++) {
      var m = r.path.match(A.routes[i].re);
      if (m) {
        try { var out = A.routes[i].fn(m.slice(1).map(decodeURIComponent), r.q); if (out && out.then) out.then(function (n) { if (n) view.appendChild(n); }).catch(showErr); else if (out) view.appendChild(out); }
        catch (e) { showErr(e); }
        window.scrollTo(0, 0);
        return;
      }
    }
    view.appendChild(A.pageShell("Not found", [["Dashboard", "/dashboard"]], null, h("p", null, "That screen does not exist.")));
    function showErr(e) { console.error(e); A.clear(view); view.appendChild(A.pageShell("Something went wrong", [["Dashboard", "/dashboard"]], null, h("div", { class: "msg err" }, e.message))); }
  };

  /* ---------- global search ---------- */
  var index = null;
  function buildIndex() {
    index = [];
    NAV.forEach(function (g) { g[1].forEach(function (it) { index.push({ g: "Menu", t: it[1], s: g[0], href: it[0], q: it[1].toLowerCase() }); }); });
    (A.settingIndex || []).forEach(function (s) { index.push({ g: "Settings", t: s.label, s: s.screen, href: s.path, q: (s.label + " " + s.screen).toLowerCase() }); });
    Object.keys(A.defaults.pages).forEach(function (p) { var pg = A.defaults.pages[p]; index.push({ g: "Pages", t: pg.title, s: p, href: "/page/" + p, q: (pg.title + " " + p).toLowerCase() }); });
    Object.keys(A.pdef).forEach(function (s) { var d = A.pdef[s]; index.push({ g: "Products", t: d.name || s, s: (d.full || "") + " / " + s, href: "/product/" + s, q: (d.name + " " + d.full + " " + s + " " + (d.cartName || "")).toLowerCase() }); });
  }
  function bindSearch(input, box) {
    var act = -1, shown = [];
    function run() {
      var q = input.value.trim().toLowerCase();
      A.clear(box);
      if (q.length < 2) { box.style.display = "none"; return; }
      if (!index) buildIndex();
      var groups = {}, order = ["Menu", "Settings", "Pages", "Products", "Page text"];
      index.forEach(function (it) { if (it.q.indexOf(q) >= 0) (groups[it.g] = groups[it.g] || []).push(it); });
      var fields = [];
      for (var k in A.defaults.fields) {
        var f = A.defaults.fields[k], txt = (A.val(k) + " " + f.label).toLowerCase();
        if (f.region !== "main" && k.indexOf("g.") !== 0 && false) continue;
        if (txt.indexOf(q) >= 0) { fields.push({ g: "Page text", t: (f.kind === "html" ? A.val(k).replace(/<[^>]+>/g, " ") : A.val(k)).slice(0, 90) || f.label, s: A.kindName(f.kind) + " in " + (k.indexOf("g.") === 0 ? f.section : (f.pages[0] || "")), href: A.keyHome(k) + "?f=" + encodeURIComponent(k) }); if (fields.length >= 12) break; }
      }
      groups["Page text"] = fields;
      shown = []; act = -1;
      order.forEach(function (g) {
        var arr = (groups[g] || []).slice(0, g === "Page text" ? 12 : 6);
        if (!arr.length) return;
        box.appendChild(h("div", { class: "g" }, g));
        arr.forEach(function (it) {
          var a = h("a", { href: "#" + it.href, onclick: function () { box.style.display = "none"; input.value = ""; } }, it.t, h("small", null, it.s));
          shown.push(a); box.appendChild(a);
        });
      });
      if (!shown.length) box.appendChild(h("div", { class: "g" }, "No results"));
      box.style.display = "";
    }
    input.addEventListener("input", A.debounce(run, 120));
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (!shown.length) return;
        act = (act + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
        shown.forEach(function (a, i) { a.classList.toggle("act", i === act); });
      } else if (e.key === "Enter") { var t = shown[act >= 0 ? act : 0]; if (t) { t.click(); location.hash = t.getAttribute("href"); } }
      else if (e.key === "Escape") { box.style.display = "none"; input.blur(); }
    });
    document.addEventListener("click", function (e) { if (!box.contains(e.target) && e.target !== input) box.style.display = "none"; });
  }

  /* ---------- dashboard ---------- */
  A.route("/dashboard", async function () {
    await A.refreshBadges();
    var s = function (label, n, href) { return h("a", { class: "stat", href: "#" + href, style: { textDecoration: "none", color: "inherit" } }, h("b", null, n), label); };
    var hidden = Object.keys(A.db.products).filter(function (k) { return A.db.products[k].hidden; }).length;
    var soldout = Object.keys(A.db.products).filter(function (k) { return A.db.products[k].soldout; }).length;
    var set = function (g) { return A.getSetting(g); };
    var chip = function (label, on, warn) { return h("span", { class: "chip " + (on ? (warn ? "warn" : "on") : ""), style: { marginRight: "6px" } }, label + ": " + (on ? "on" : "off")); };
    var hist = [];
    try { hist = await A.rest("GET", "history?select=*&order=at.desc&limit=8"); } catch (e) {}
    var content = h("div", null,
      h("div", { class: "grid" },
        s("New orders", A.badges.orders, "/orders"), s("New messages", A.badges.messages, "/messages"),
        s("Edited texts, links, images", Object.keys(A.db.content).length, "/pages"),
        s("Products with changes", Object.keys(A.db.products).length, "/products"),
        s("Hidden products", hidden, "/products"), s("Sold out", soldout, "/products")),
      h("div", { class: "card" }, h("h2", null, "Site status"),
        chip("Announcement bar", set("banner").on), chip("Maintenance mode", set("maintenance").on, true), chip("Hidden from search engines", set("site").noindex, true),
        chip("Live chat", !!set("tracking").smartsupp), chip("Analytics", !!set("tracking").gaId), chip("Order email set", !!set("orders").email), chip("Order WhatsApp set", !!set("orders").whatsapp)),
      h("div", { class: "card" }, h("h2", null, "Recent activity"),
        hist.length ? h("div", { class: "list" }, hist.map(function (x) { return h("div", { class: "li" }, h("div", { class: "grow" }, x.tbl + ": " + x.key, h("div", { class: "sub" }, (x.by_email || "someone") + " " + ({insert:"added",update:"changed",delete:"removed"}[x.action] || x.action) + ", " + A.date(x.at)))); })) : h("p", { class: "orig" }, "No changes yet."),
        h("a", { href: "#/admin/history" }, "See all activity")),
      h("div", { class: "card" }, h("h2", null, "Quick links"),
        h("div", { class: "row" }, [["/pages", "Edit pages"], ["/products", "Products and prices"], ["/orders", "Orders"], ["/site/maintenance", "Maintenance mode"], ["/admin/help", "Help and guide"]].map(function (l) { return h("a", { class: "btn sm", href: "#" + l[0] }, l[1]); }))));
    return A.pageShell("Dashboard", null, "A quick look at the shop. Edits you make in the admin stay unsaved until you press Save and publish.", content);
  });

  /* ---------- pages list + editor ---------- */
  var isSharedKey = function (k) { return k.indexOf("g.") === 0 || k.indexOf("product.") === 0; };
  A.route("/pages", function () {
    var groups = ["Main pages", "Category pages", "Product pages", "Cart page"], P = A.defaults.pages, wrap = h("div");
    var q = h("input", { type: "text", placeholder: "Filter pages", oninput: function () { A.$$(".li[data-t]", wrap).forEach(function (l) { l.style.display = l.getAttribute("data-t").indexOf(q.value.toLowerCase()) >= 0 ? "" : "none"; }); } });
    wrap.appendChild(h("div", { class: "card" }, q));
    groups.forEach(function (g) {
      var paths = Object.keys(P).filter(function (p) { return P[p].group === g; });
      if (!paths.length) return;
      var list = h("div", { class: "list" });
      paths.forEach(function (p) {
        var keys = P[p].keys.filter(function (k) { return !isSharedKey(k); });
        var edited = keys.filter(function (k) { return A.isEdited(k); }).length;
        list.appendChild(h("div", { class: "li", "data-t": (P[p].title + " " + p).toLowerCase() }, h("div", { class: "grow" }, h("a", { href: "#/page/" + p }, P[p].title), h("div", { class: "sub" }, p + " - " + keys.length + " items")), edited ? h("span", { class: "chip warn" }, edited + " edited") : null));
      });
      wrap.appendChild(h("div", { class: "card" }, h("h2", null, g + " (" + paths.length + ")"), list));
    });
    return A.pageShell("Pages", [["Dashboard", "/dashboard"], ["Pages"]], "Pick a page to change its text, links and pictures. Header, footer and contact popup are shared by every page, so they have their own screens in the Content menu. After you press Save, the change goes live on the real site.", wrap);
  });

  A.route("/page/:p*", function (m, q) {
    var p = m[0], pg = A.defaults.pages[p];
    if (!pg) return A.pageShell("Page not found", [["Pages", "/pages"]], null, h("p", null, p));
    var keys = pg.keys.filter(function (k) { return !isSharedKey(k); });
    var lockMsg = A.lockNote("editor", "this page");
    var list = A.fieldList(keys);
    var countEl = h("span", { class: "orig" }, keys.length + " editable items");
    var matchMap = {}; keys.forEach(function (k) { matchMap[k] = (A.def(k) + " " + A.defaults.fields[k].label).toLowerCase(); });
    var search = h("input", { type: "text", placeholder: "Search inside this page", style: { maxWidth: "320px" }, oninput: function () {
      var s = search.value.toLowerCase();
      A.$$("details.sec", list).forEach(function (d) {
        if (s) { d.__render(); d.open = true; }
        var any = false;
        A.$$(".fld", d).forEach(function (r) { var k = r.getAttribute("data-key"); var hit = !s || (matchMap[k] + " " + A.val(k).toLowerCase()).indexOf(s) >= 0; r.style.display = hit ? "" : "none"; any = any || hit; });
        d.style.display = any || !s ? "" : "none";
      });
    } });
    var tools = h("div", { class: "card row" }, search, countEl,
      h("a", { class: "btn sm", href: "../" + p, target: "_blank" }, "View live page"),
      h("button", { class: "btn sm bad", disabled: !A.can("editor"), onclick: function () { if (confirm("Reset every edit on this page back to the original?")) { keys.forEach(function (k) { A.resetContent(k); }); A.render(); } } }, "Reset page"));
    var note = "Text, links and images on this page, in the same order as the live page. Edited fields are marked. Nothing goes live until you press Save and publish." + (p.indexOf("product/") === 0 ? " Name, price and picture of this product are in Products." : "");
    var out = A.pageShell(pg.title, [["Pages", "/pages"], [pg.title]], note, h("div", null, lockMsg, tools, list));
    if (p.indexOf("product/") === 0) out.insertBefore(h("div", { class: "row", style: { marginBottom: "8px" } }, h("a", { class: "btn sm", href: "#/product/" + p.replace(/^product\//, "").replace(/\.html$/, "") }, "Edit name, price and stock")), out.children[2]);
    setTimeout(function () { A.focusField(q.f); }, 0);
    return out;
  });

  A.focusField = function (key) {
    if (!key) return;
    var dets = A.$$("details.sec").filter(function (d) { return d.__keys && d.__keys.indexOf(key) >= 0; });
    if (!dets.length) return;
    dets[0].open = true; dets[0].__render();
    var row = A.$('.fld[data-key="' + (CSS.escape ? CSS.escape(key) : key) + '"]');
    if (row) { row.classList.add("hl"); row.scrollIntoView({ block: "center" }); }
  };

  var SHARED = {
    header: ["Header and menu", "g.header", "The logo link, menu and the Contact button at the top of every page. One edit here changes every page."],
    footer: ["Footer", "g.footer", "The footer text and link columns shown on every page."],
    contact: ["Contact popup", "g.contact", "Wording of the Contact us popup that opens from the header. Messages sent from it go to Customers > Messages."],
    product: ["Text shared by all product pages", "product.", "Headings and labels that are the same on every product page (for example Key product parameters, Benefits, FAQ). One edit changes all product pages."]
  };
  A.route("/shared/:name", function (m, q) {
    var s = SHARED[m[0]]; if (!s) return h("p", null, "Not found");
    var keys = Object.keys(A.defaults.fields).filter(function (k) { return k.indexOf(s[1]) === 0; });
    var list = A.fieldList(keys);
    var out = A.pageShell(s[0], [["Content"], [s[0]]], s[2] + " Nothing goes live until you press Save and publish.", h("div", null, A.lockNote("editor", "this section"), h("div", { class: "card row" }, h("span", { class: "orig" }, keys.length + " editable items")), list));
    setTimeout(function () { A.focusField(q.f); }, 0);
    return out;
  });

  /* ---------- products ---------- */
  function slugs() { return Object.keys(A.pdef).sort(function (a, b) { return (A.pdef[a].category || "").localeCompare(A.pdef[b].category || "") || a.localeCompare(b); }); }
  var CAT = { "injectable-anabolic-steroids": "Injectable Anabolic Steroids", "oral-anabolic-steroids": "Oral Anabolic Steroids", "post-cycle-therapy": "Post Cycle Therapy", "hgh-and-peptides": "HGH and Peptides", "weight-management": "Weight Management", "others": "Other" };

  A.route("/products", function () {
    var locked = !A.can("editor"), wrap = h("div"), rows = [];
    var q = h("input", { type: "text", placeholder: "Search products", oninput: filter });
    var cat = h("select", { onchange: filter }, h("option", { value: "" }, "All categories"), Object.keys(CAT).map(function (c) { return h("option", { value: c }, CAT[c]); }));
    function filter() { rows.forEach(function (r) { var d = A.pdef[r.slug], ok = (!q.value || (r.slug + " " + A.pValue(r.slug, "name") + " " + A.pValue(r.slug, "full")).toLowerCase().indexOf(q.value.toLowerCase()) >= 0) && (!cat.value || d.category === cat.value); r.el.style.display = ok ? "" : "none"; }); }
    var list = h("div", { class: "list" });
    slugs().forEach(function (slug) {
      var price = h("input", { type: "number", step: "0.01", min: "0", placeholder: "Contact", style: { width: "110px" }, disabled: locked, value: A.pValue(slug, "price") == null ? "" : A.pValue(slug, "price"), oninput: function () { A.setProduct(slug, "price", price.value); mark(); } });
      var so = h("input", { type: "checkbox", disabled: locked, checked: !!A.pValue(slug, "soldout"), onchange: function () { A.setProduct(slug, "soldout", so.checked); mark(); } });
      var hi = h("input", { type: "checkbox", disabled: locked, checked: !!A.pValue(slug, "hidden"), onchange: function () { A.setProduct(slug, "hidden", hi.checked); mark(); } });
      var chip = h("span", { class: "chip warn", style: { display: A.productEdited(slug) ? "" : "none" } }, "edited");
      function mark() { chip.style.display = A.productEdited(slug) ? "" : "none"; }
      var el = h("div", { class: "li" },
        h("img", { class: "thumb", src: A.rootUrl(A.pValue(slug, "image")), alt: "", loading: "lazy" }),
        h("div", { class: "grow" }, h("a", { href: "#/product/" + slug }, A.pValue(slug, "name") || slug), " ", chip, h("div", { class: "sub" }, (A.pValue(slug, "full") || "") + " - " + (CAT[A.pdef[slug].category] || ""))),
        h("label", { class: "sub" }, "Price USD ", price), h("label", { class: "sub" }, so, " Sold out"), h("label", { class: "sub" }, hi, " Hidden"));
      rows.push({ slug: slug, el: el }); list.appendChild(el);
    });
    wrap.appendChild(A.lockNote("editor", "products"));
    wrap.appendChild(h("div", { class: "card row" }, q, cat));
    wrap.appendChild(h("div", { class: "card" }, list));
    return A.pageShell("Products", [["Shop"], ["Products"]], "Quick price and stock list. Leave Price empty to show Contact for price. Hidden products disappear from the shop and their page redirects to the catalog. Open a product to change its name, picture and cart wording. Changes go live when you press Save and publish.", wrap);
  });

  A.route("/product/:slug", function (m) {
    var slug = m[0], d = A.pdef[slug]; if (!d) return h("p", null, "Product not found");
    var locked = !A.can("editor");
    var card = h("div", { class: "card" });
    function txt(field, label, help) {
      var i = h("input", { type: "text", disabled: locked, value: A.pValue(slug, field), oninput: function () { A.setProduct(slug, field, i.value); mk(); } });
      var o = h("div", { class: "orig" }, "Original: ", d[field] || "(empty)", help ? " - " + help : "");
      var ed = h("span", { class: "edited", style: { display: "none" } }, "Edited");
      function mk() { ed.style.display = (A.pOverride(slug)[field] !== undefined) ? "" : "none"; }
      mk();
      return h("div", { class: "fld" }, h("div", { class: "top2" }, h("span", { class: "pill Text" }, "Text"), h("span", null, label), ed, h("button", { type: "button", class: "link", onclick: function () { A.setProduct(slug, field, d[field] == null ? "" : d[field]); i.value = A.pValue(slug, field); mk(); } }, "Reset to original")), i, o);
    }
    var img = h("img", { src: A.rootUrl(A.pValue(slug, "image")), alt: "" }), iin = h("input", { type: "text", disabled: locked, value: A.pValue(slug, "image"), oninput: function () { A.setProduct(slug, "image", iin.value); img.src = A.rootUrl(iin.value); } });
    var price = h("input", { type: "number", step: "0.01", min: "0", disabled: locked, placeholder: "Empty = Contact for price", value: A.pValue(slug, "price") == null ? "" : A.pValue(slug, "price"), oninput: function () { A.setProduct(slug, "price", price.value); } });
    var so = h("input", { type: "checkbox", disabled: locked, checked: !!A.pValue(slug, "soldout"), onchange: function () { A.setProduct(slug, "soldout", so.checked); } });
    var hi = h("input", { type: "checkbox", disabled: locked, checked: !!A.pValue(slug, "hidden"), onchange: function () { A.setProduct(slug, "hidden", hi.checked); } });
    card.appendChild(txt("name", "Product name (cards and page heading)"));
    card.appendChild(txt("sub", "Line above the name on product cards"));
    card.appendChild(txt("full", "Subtitle on the product page"));
    card.appendChild(txt("pack", "Pack size on the product page"));
    card.appendChild(h("div", { class: "fld" }, h("div", { class: "top2" }, h("span", { class: "pill Image" }, "Image"), h("span", null, "Product picture")), h("div", { class: "imgf" }, img, h("div", { style: { flex: 1 } }, iin, h("div", { style: { marginTop: "6px" } }, h("button", { type: "button", class: "btn sm", disabled: locked, onclick: function () { A.pickImage(function (u) { iin.value = u; A.setProduct(slug, "image", u); img.src = A.rootUrl(u); }); } }, "Choose image"))))));
    card.appendChild(h("div", { class: "fld" }, h("div", { class: "top2" }, h("span", { class: "pill Setting" }, "Setting"), h("span", null, "Price in USD")), price, h("div", { class: "orig" }, "Original: " + (d.price == null ? "Contact for price" : "$" + d.price))));
    if (d.kitPrice !== undefined) {
      var kp = h("input", { type: "number", step: "0.01", min: "0", disabled: locked, placeholder: "Empty = Contact for price", value: A.pValue(slug, "kitPrice") == null ? "" : A.pValue(slug, "kitPrice"), oninput: function () { A.setProduct(slug, "kitPrice", kp.value); } });
      card.appendChild(h("div", { class: "fld" }, h("div", { class: "top2" }, h("span", { class: "pill Setting" }, "Setting"), h("span", null, "Kit price in USD (" + (d.kitPack || "kit") + ")")), kp, h("div", { class: "orig" }, "Original: $" + d.kitPrice + ". The Price above is for one vial.")));
    }
    card.appendChild(txt("cartName", "Name shown in the cart"));
    card.appendChild(txt("cartPack", "Pack text shown in the cart"));
    card.appendChild(h("div", { class: "fld" }, h("label", null, so, " Sold out (shows Out of stock, cannot be added to the cart)")));
    card.appendChild(h("div", { class: "fld" }, h("label", null, hi, " Hidden (removed from the shop; the product page redirects to the catalog)")));
    return A.pageShell(A.pValue(slug, "name") || slug, [["Products", "/products"], [slug]], "Change how this product appears and what it costs. Changes go live when you press Save and publish.",
      h("div", null, A.lockNote("editor", "products"), h("div", { class: "row" }, h("a", { class: "btn sm", href: "#/page/" + d.page }, "Edit the text on this product's page"), h("a", { class: "btn sm", href: "../" + d.page, target: "_blank" }, "View live page")), card));
  });

  /* ---------- media ---------- */
  A.route("/media", async function () {
    await A.loadMedia();
    var wrap = h("div"), grid = h("div", { class: "grid" });
    var file = h("input", { type: "file", accept: "image/*,.pdf", multiple: true, style: { display: "none" }, onchange: async function () {
      try { await A.uploadFiles(file.files); A.toast("Uploaded. Saved right away."); A.render(); } catch (e) { A.toast(e.message); }
    } });
    function draw() {
      A.clear(grid);
      if (!A.media.length) grid.appendChild(h("p", { class: "orig" }, "No uploads yet."));
      A.media.forEach(function (m) {
        var alt = h("input", { type: "text", placeholder: "Alt text", value: m.alt || "", disabled: !A.can("editor"), onchange: async function () { try { await A.rest("PATCH", "media?id=eq." + m.id, { body: { alt: alt.value }, headers: { Prefer: "return=minimal" } }); A.toast("Saved"); } catch (e) { A.toast(e.message); } } });
        grid.appendChild(h("div", { class: "card", style: { margin: 0 } },
          h("img", { src: m.url, alt: m.alt || "", style: { width: "100%", height: "120px", objectFit: "contain", background: "#f3f4f6", borderRadius: "8px" } }),
          h("div", { class: "orig" }, m.name), alt,
          h("div", { class: "row", style: { marginTop: "8px" } },
            h("button", { class: "btn sm", onclick: function () { navigator.clipboard && navigator.clipboard.writeText(m.url); A.toast("Address copied"); } }, "Copy address"),
            h("button", { class: "btn sm bad", disabled: !A.can("editor"), onclick: async function () {
              if (!confirm("Delete this file? Pages using it will show a broken picture.")) return;
              try { await A.removeObjects([m.path]); await A.rest("DELETE", "media?id=eq." + m.id); A.render(); } catch (e) { A.toast(e.message); }
            } }, "Delete"))));
      });
    }
    draw();
    wrap.appendChild(A.lockNote("editor", "files"));
    wrap.appendChild(h("div", { class: "msg info" }, "Uploads, alt text and deletes save right away (no need to press Save)."));
    wrap.appendChild(h("div", { class: "card row" }, h("button", { class: "btn pri", disabled: !A.can("editor"), onclick: function () { file.click(); } }, "Upload files"), file));
    wrap.appendChild(grid);
    return A.pageShell("Images and files", [["Content"], ["Images and files"]], "Upload pictures here, then pick them when editing a page or product. Copy address gives the web address of the file.", wrap);
  });
})();
