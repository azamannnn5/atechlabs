/* Field editors: text, rich text, link, image, alt text. */
(function () {
  "use strict";
  var h = A.h;
  var KIND = { text: ["Text", "Text"], html: ["Text", "Text"], href: ["Link", "Link"], src: ["Image", "Image"], srcset: ["Image", "Image"], alt: ["Alt", "Alt text"] };
  A.kindName = function (k) { return (KIND[k] || ["Text", "Text"])[1]; };
  var normHtml = function (s) { return String(s).replace(/<br\s*\/?>/gi, "<br/>").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); };
  A.locked = function () { return !A.can("editor"); };

  /* ---------- media ---------- */
  A.media = [];
  A.loadMedia = async function () {
    try { A.media = await A.listAll("media", "select=*&order=created_at.desc"); } catch (e) { A.media = []; }
    return A.media;
  };

  A.modal = function (title, body, onClose) {
    var m = h("div", { class: "modal" });
    var close = function () { m.remove(); if (onClose) onClose(); };
    m.addEventListener("click", function (e) { if (e.target === m) close(); });
    m.appendChild(h("div", { class: "in" }, h("div", { class: "spread" }, h("h2", { style: { margin: 0 } }, title), h("button", { class: "btn sm", onclick: close }, "Close")), body));
    document.body.appendChild(m);
    return { close: close, el: m };
  };

  A.uploadFiles = async function (files) {
    var done = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var safe = f.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      var path = "uploads/" + Date.now() + "-" + safe;
      var url = await A.upload(path, f);
      await A.rest("POST", "media", { body: { name: f.name, path: path, url: url, size: f.size }, headers: { Prefer: "return=minimal" } });
      done.push(url);
    }
    return done;
  };

  A.pickImage = async function (cb) {
    await A.loadMedia();
    var tab = "up", box = h("div"), list = h("div"), modal;
    var siteImgs = {}; Object.keys(A.defaults.fields).forEach(function (k) { var f = A.defaults.fields[k]; if ((f.kind === "src" || f.kind === "srcset") && f.value) siteImgs[f.value] = 1; });
    Object.keys(A.pdef).forEach(function (s) { if (A.pdef[s].image) siteImgs[A.pdef[s].image] = 1; });
    function draw() {
      A.clear(list);
      var items = tab === "up" ? A.media.map(function (m) { return { url: m.url, label: m.name }; }) : Object.keys(siteImgs).map(function (v) { return { url: v, label: v.split("/").pop() }; });
      if (!items.length) list.appendChild(h("p", { class: "orig" }, tab === "up" ? "No uploads yet. Use Upload above." : "No images found."));
      var grid = h("div", { class: "picker" });
      items.slice(0, 400).forEach(function (it) {
        grid.appendChild(h("button", { type: "button", title: it.label, onclick: function () { modal.close(); cb(it.url); } }, h("img", { src: A.rootUrl(it.url), loading: "lazy", alt: "" }), h("div", { class: "orig" }, it.label.slice(0, 22))));
      });
      list.appendChild(grid);
    }
    var tabs = h("div", { class: "tabs" },
      h("button", { type: "button", class: "on", onclick: function (e) { tab = "up"; setOn(e); draw(); } }, "Uploaded"),
      h("button", { type: "button", onclick: function (e) { tab = "site"; setOn(e); draw(); } }, "Already on the site"));
    function setOn(e) { A.$$("button", tabs).forEach(function (b) { b.classList.remove("on"); }); e.target.classList.add("on"); }
    var file = h("input", { type: "file", accept: "image/*", multiple: true, style: { display: "none" }, onchange: async function () {
      try { var urls = await A.uploadFiles(file.files); A.toast("Uploaded"); await A.loadMedia(); tab = "up"; draw(); if (urls.length === 1) { modal.close(); cb(urls[0]); } } catch (e) { A.toast(e.message); }
    } });
    box.appendChild(h("div", { class: "row" }, A.can("editor") ? h("button", { class: "btn pri sm", type: "button", onclick: function () { file.click(); } }, "Upload new image") : null, file));
    box.appendChild(tabs); box.appendChild(list);
    modal = A.modal("Choose an image", box);
    draw();
  };

  /* ---------- controls ---------- */
  function rte(key, locked) {
    var ed = h("div", { class: "ed", contentEditable: !locked });
    ed.innerHTML = A.val(key);
    var raw = h("textarea", { style: { display: "none" }, rows: 6 });
    raw.value = A.val(key);
    var htmlMode = false;
    var push = function () { A.setContent(key, normHtml(htmlMode ? raw.value : ed.innerHTML)); };
    ed.addEventListener("input", function () { push(); A.touchField(key); });
    raw.addEventListener("input", function () { push(); A.touchField(key); });
    var cmd = function (c, v) { return function () { ed.focus(); document.execCommand(c, false, v || null); push(); A.touchField(key); }; };
    var tb = h("div", { class: "tb" },
      h("button", { type: "button", class: "btn sm", title: "Bold", onclick: cmd("bold"), disabled: locked }, h("b", null, "B")),
      h("button", { type: "button", class: "btn sm", title: "Italic", onclick: cmd("italic"), disabled: locked }, h("i", null, "I")),
      h("button", { type: "button", class: "btn sm", disabled: locked, onclick: function () { var u = prompt("Link address (for example catalog.html or https://...)"); if (u) cmd("createLink", u)(); } }, "Link"),
      h("button", { type: "button", class: "btn sm", disabled: locked, onclick: function () { ed.focus(); document.execCommand("removeFormat"); document.execCommand("unlink"); push(); A.touchField(key); } }, "Clear"),
      h("button", { type: "button", class: "btn sm", style: { marginLeft: "auto" }, onclick: function () {
        htmlMode = !htmlMode;
        if (htmlMode) { raw.value = normHtml(ed.innerHTML); ed.style.display = "none"; raw.style.display = ""; }
        else { ed.innerHTML = raw.value; raw.style.display = "none"; ed.style.display = ""; }
      } }, "HTML"));
    return h("div", { class: "rte" }, tb, ed, raw);
  }

  function control(key, f, locked) {
    var v = A.val(key);
    var set = function (x) { A.setContent(key, x); A.touchField(key); };
    if (f.kind === "html") return rte(key, locked);
    if (f.kind === "src" || f.kind === "srcset") {
      var img = h("img", { src: A.rootUrl(v), alt: "" });
      var inp = h("input", { type: "text", value: v, disabled: locked, oninput: function () { set(inp.value); img.src = A.rootUrl(inp.value); } });
      return h("div", { class: "imgf" }, img, h("div", { style: { flex: 1 } }, inp,
        h("div", { class: "row", style: { marginTop: "6px" } }, h("button", { type: "button", class: "btn sm", disabled: locked, onclick: function () { A.pickImage(function (u) { inp.value = u; set(u); img.src = A.rootUrl(u); }); } }, "Choose image"))));
    }
    if (f.kind === "href") {
      var li = "pages-list";
      var hin = h("input", { type: "text", value: v, list: li, disabled: locked, oninput: function () { set(hin.value); } });
      return hin;
    }
    var long = f.kind === "text" && (f.value.length > 80 || A.val(key).length > 80);
    if (long) {
      var ta = h("textarea", { rows: Math.min(10, Math.max(3, Math.ceil(v.length / 90))), disabled: locked, oninput: function () { set(ta.value); } });
      ta.value = v; return ta;
    }
    var inp2 = h("input", { type: "text", value: v, disabled: locked, oninput: function () { set(inp2.value); } });
    return inp2;
  }

  A.touchField = function (key) {
    A.$$('.fld[data-key="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]').forEach(function (row) {
      var e = A.$(".edited", row), r = A.$(".reset", row);
      if (e) e.style.display = A.isEdited(key) ? "" : "none";
      if (r) r.style.display = A.isEdited(key) ? "" : "none";
    });
  };

  A.fieldRow = function (key) {
    var f = A.defaults.fields[key]; if (!f) return h("div");
    var locked = A.locked();
    var row = h("div", { class: "fld", "data-key": key });
    var edited = h("span", { class: "edited", style: { display: A.isEdited(key) ? "" : "none" } }, "Edited");
    var reset = h("button", { type: "button", class: "link reset", style: { display: A.isEdited(key) ? "" : "none" }, onclick: function () {
      A.resetContent(key); var fresh = A.fieldRow(key); row.replaceWith(fresh);
    } }, "Reset to original");
    row.appendChild(h("div", { class: "top2" }, h("span", { class: "pill " + KIND[f.kind][0] }, A.kindName(f.kind)), h("span", null, f.label.replace(/^[A-Za-z ]+: /, "") || f.label), edited, reset));
    row.appendChild(control(key, f, locked));
    var orig = f.kind === "html" ? f.value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : f.value;
    row.appendChild(h("div", { class: "orig" }, "Original: ", orig ? orig.slice(0, 160) : "(empty)"));
    return row;
  };

  A.pagesDatalist = function () {
    var dl = h("datalist", { id: "pages-list" });
    Object.keys(A.defaults.pages).forEach(function (p) { dl.appendChild(h("option", { value: p })); });
    return dl;
  };

  // Groups keys by section, in order, collapsible. opts.filter(key) optional.
  A.fieldList = function (keys, opts) {
    opts = opts || {};
    var wrap = h("div"), order = [], by = {};
    keys.forEach(function (k) { var f = A.defaults.fields[k]; if (!f) return; var s = f.section || "Content"; if (!by[s]) { by[s] = []; order.push(s); } by[s].push(k); });
    wrap.appendChild(A.pagesDatalist());
    order.forEach(function (s) {
      var det = h("details", { class: "sec", open: opts.open !== false });
      det.appendChild(h("summary", null, s, h("span", { class: "cnt" }, by[s].length + " items")));
      var body = h("div", { class: "body" });
      var rendered = false;
      var render = function () { if (rendered) return; rendered = true; by[s].forEach(function (k) { body.appendChild(A.fieldRow(k)); }); };
      if (det.open) render();
      det.addEventListener("toggle", function () { if (det.open) render(); });
      det.appendChild(body); det.__render = render; det.__keys = by[s];
      wrap.appendChild(det);
    });
    return wrap;
  };

  A.keyHome = function (key) { // where a field is edited
    if (key.indexOf("g.header") === 0) return "/shared/header";
    if (key.indexOf("g.footer") === 0) return "/shared/footer";
    if (key.indexOf("g.contact") === 0) return "/shared/contact";
    if (key.indexOf("product.") === 0) return "/shared/product";
    var f = A.defaults.fields[key];
    return "/page/" + (f && f.pages[0] || "index.html");
  };
})();
