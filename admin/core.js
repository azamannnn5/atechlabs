/* Admin core: helpers, Supabase access (plain fetch, no library), staged changes. */
(function () {
  "use strict";
  var CFG = window.CMS_CONFIG || {};
  var A = (window.A = {});
  A.cfg = CFG;
  A.configured = !!(CFG.url && CFG.anonKey);
  A.base = (CFG.url || "").replace(/\/$/, "");

  /* ---------- tiny DOM helper ---------- */
  A.h = function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (k === "checked" || k === "disabled" || k === "selected" || k === "contentEditable") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
  A.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  A.$ = function (s, r) { return (r || document).querySelector(s); };
  A.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  A.toast = function (msg) {
    var box = document.getElementById("toast");
    if (!box) { box = A.h("div", { id: "toast" }); document.body.appendChild(box); }
    var t = A.h("div", null, msg); box.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  };
  A.date = function (d) { try { return new Date(d).toLocaleString(); } catch (e) { return d; } };
  A.money = function (n) { return "$" + Number(n || 0).toFixed(2); };
  A.rootUrl = function (v) { return !v ? "" : /^(https?:|\/\/|data:|blob:)/i.test(v) ? v : "../" + v.replace(/^\/+/, ""); };
  A.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };
  A.eq = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };

  /* ---------- session + auth ---------- */
  var SKEY = "atl_admin_session";
  A.session = null;
  try { A.session = JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) {}
  function saveSession(s) {
    A.session = s;
    try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) {}
  }
  function fromToken(j) {
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: j.user };
  }
  async function authReq(method, path, body, token) {
    var res = await fetch(A.base + "/auth/v1" + path, {
      method: method,
      headers: { apikey: CFG.anonKey, "Content-Type": "application/json", Authorization: "Bearer " + (token || CFG.anonKey) },
      body: body ? JSON.stringify(body) : undefined
    });
    var data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) { var err = new Error((data && (data.error_description || data.msg || data.message)) || "Request failed"); err.status = res.status; throw err; }
    return data;
  }
  A.signIn = async function (email, pw) {
    var j = await authReq("POST", "/token?grant_type=password", { email: email, password: pw });
    saveSession(fromToken(j));
  };
  A.refresh = async function () {
    if (!A.session || !A.session.refresh_token) throw new Error("no session");
    var j = await authReq("POST", "/token?grant_type=refresh_token", { refresh_token: A.session.refresh_token });
    saveSession(fromToken(j));
  };
  A.recover = function (email) {
    return fetch(A.base + "/auth/v1/recover?redirect_to=" + encodeURIComponent(location.origin + location.pathname), {
      method: "POST", headers: { apikey: CFG.anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: email })
    }).then(function (r) { if (!r.ok) throw new Error("Could not send the reset email."); });
  };
  A.setPassword = async function (pw, token) {
    await authReq("PUT", "/user", { password: pw }, token || (A.session && A.session.access_token));
  };
  A.signOut = function () { saveSession(null); location.hash = ""; location.reload(); };
  A.adoptRecoveryHash = function () {
    var m = location.hash.match(/access_token=([^&]+).*type=recovery/);
    if (m) { history.replaceState(null, "", location.pathname); return decodeURIComponent(m[1]); }
    return null;
  };

  /* ---------- REST ---------- */
  async function token() {
    if (!A.session) throw new Error("Not signed in");
    if (A.session.expires_at - 60 < Date.now() / 1000) await A.refresh();
    return A.session.access_token;
  }
  A.rest = async function (method, path, opts) {
    opts = opts || {};
    for (var attempt = 0; attempt < 2; attempt++) {
      var t = await token();
      var headers = Object.assign({ apikey: CFG.anonKey, Authorization: "Bearer " + t, "Content-Type": "application/json" }, opts.headers || {});
      var res = await fetch(A.base + "/rest/v1/" + path, { method: method, headers: headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
      if (res.status === 401 && attempt === 0) { try { await A.refresh(); continue; } catch (e) {} }
      var text = await res.text(), data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
      if (!res.ok) {
        var err = new Error((data && (data.message || data.hint)) || ("Request failed (" + res.status + ")"));
        err.status = res.status; err.code = data && data.code; throw err;
      }
      return data;
    }
  };
  A.rpc = function (name, args) { return A.rest("POST", "rpc/" + name, { body: args || {} }); };
  A.listAll = async function (table, query) {
    var out = [], from = 0, step = 1000;
    for (;;) {
      var rows = await A.rest("GET", table + "?" + (query || "select=*") + "&limit=" + step + "&offset=" + from);
      out = out.concat(rows || []);
      if (!rows || rows.length < step) break;
      from += step;
    }
    return out;
  };
  A.upsert = function (table, rows, conflict) {
    if (!rows.length) return Promise.resolve();
    return A.rest("POST", table + "?on_conflict=" + conflict, { body: rows, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
  };
  A.inList = function (vals) { return "in.(" + vals.map(function (v) { return '"' + String(v).replace(/"/g, '\\"') + '"'; }).join(",") + ")"; };
  A.upload = async function (path, file) {
    var t = await token();
    var res = await fetch(A.base + "/storage/v1/object/media/" + path, {
      method: "POST", headers: { apikey: CFG.anonKey, Authorization: "Bearer " + t, "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" }, body: file
    });
    if (!res.ok) { var d = null; try { d = await res.json(); } catch (e) {} throw new Error((d && (d.message || d.error)) || "Upload failed"); }
    return A.base + "/storage/v1/object/public/media/" + path;
  };
  A.removeObjects = async function (paths) {
    var t = await token();
    await fetch(A.base + "/storage/v1/object/media", { method: "DELETE", headers: { apikey: CFG.anonKey, Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: paths }) });
  };

  /* ---------- roles ---------- */
  var RANK = { owner: 4, admin: 3, editor: 2, viewer: 1 };
  A.role = null;
  A.can = function (min) { return (RANK[A.role] || 0) >= (RANK[min] || 99); };

  /* ---------- data + staged changes ---------- */
  A.db = { content: {}, settings: {}, products: {} };
  A.staged = { content: {}, settings: {}, products: {} };
  A.defaults = { fields: {}, pages: {} };
  A.pdef = {};
  var dirtyFns = [];
  A.onDirty = function (fn) { dirtyFns.push(fn); };
  function changed() { dirtyFns.forEach(function (f) { f(); }); }
  A.changed = changed;

  A.loadDefaults = async function () {
    var r = await Promise.all([fetch("../cms/defaults.json"), fetch("../cms/products.json")]);
    if (!r[0].ok) throw new Error("cms/defaults.json is missing. Re-run the build.");
    A.defaults = await r[0].json();
    A.pdef = r[1].ok ? await r[1].json() : {};
  };
  A.loadDb = async function () {
    var r = await Promise.all([A.listAll("content", "select=key,value"), A.listAll("settings", "select=grp,data"), A.listAll("products", "select=slug,data")]);
    A.db.content = {}; r[0].forEach(function (x) { A.db.content[x.key] = x.value; });
    A.db.settings = {}; r[1].forEach(function (x) { A.db.settings[x.grp] = x.data; });
    A.db.products = {}; r[2].forEach(function (x) { A.db.products[x.slug] = x.data; });
  };

  // content
  A.def = function (key) { var f = A.defaults.fields[key]; return f ? f.value : ""; };
  A.cur = function (key) { // current saved or staged override, or undefined
    if (key in A.staged.content) return A.staged.content[key] === null ? undefined : A.staged.content[key];
    return A.db.content[key];
  };
  A.val = function (key) { var c = A.cur(key); return c === undefined ? A.def(key) : c; };
  A.isEdited = function (key) { return A.cur(key) !== undefined; };
  A.setContent = function (key, v) {
    var want = v === A.def(key) ? null : v, inDb = key in A.db.content;
    if (want === null) { if (inDb) A.staged.content[key] = null; else delete A.staged.content[key]; }
    else { if (inDb && A.db.content[key] === want) delete A.staged.content[key]; else A.staged.content[key] = want; }
    changed();
  };
  A.resetContent = function (key) { A.setContent(key, A.def(key)); };

  // settings
  A.getSetting = function (g) { return JSON.parse(JSON.stringify(g in A.staged.settings ? A.staged.settings[g] : (A.db.settings[g] || {}))); };
  A.setSetting = function (g, obj) {
    var clean = {}; Object.keys(obj).forEach(function (k) { var v = obj[k]; if (v !== "" && v !== false && v != null && !(Array.isArray(v) && !v.length)) clean[k] = v; });
    if (A.eq(clean, A.db.settings[g] || {})) delete A.staged.settings[g]; else A.staged.settings[g] = clean;
    changed();
  };

  // products
  A.pOverride = function (slug) { return JSON.parse(JSON.stringify(slug in A.staged.products ? (A.staged.products[slug] || {}) : (A.db.products[slug] || {}))); };
  A.pValue = function (slug, field) {
    var o = A.pOverride(slug), d = A.pdef[slug] || {};
    if (Object.prototype.hasOwnProperty.call(o, field)) return o[field];
    return d[field] == null ? ((field === "price" || field === "kitPrice") ? null : "") : d[field];
  };
  A.setProduct = function (slug, field, val) {
    var o = A.pOverride(slug), d = A.pdef[slug] || {};
    var dv = d[field] == null ? ((field === "price" || field === "kitPrice") ? null : (field === "soldout" || field === "hidden" ? false : "")) : d[field];
    if (field === "price" || field === "kitPrice") { if (val === "" || val === undefined) val = null; else if (val !== null) val = Number(val); }
    if (A.eq(val, dv)) delete o[field]; else o[field] = val;
    if (field === "soldout" || field === "hidden") { if (!val) delete o[field]; }
    var db = A.db.products[slug];
    if (!Object.keys(o).length) { if (db) A.staged.products[slug] = null; else delete A.staged.products[slug]; }
    else if (db && A.eq(o, db)) delete A.staged.products[slug];
    else A.staged.products[slug] = o;
    changed();
  };
  A.productEdited = function (slug) { var o = A.pOverride(slug); return Object.keys(o).length > 0; };

  A.dirtyCount = function () { return Object.keys(A.staged.content).length + Object.keys(A.staged.settings).length + Object.keys(A.staged.products).length; };
  A.discard = function () { A.staged = { content: {}, settings: {}, products: {} }; changed(); };
  A.save = async function () {
    var s = A.staged, up, del;
    up = []; del = [];
    Object.keys(s.content).forEach(function (k) { if (s.content[k] === null) del.push(k); else up.push({ key: k, value: s.content[k] }); });
    for (var i = 0; i < up.length; i += 200) await A.upsert("content", up.slice(i, i + 200), "key");
    for (var j = 0; j < del.length; j += 100) await A.rest("DELETE", "content?key=" + A.inList(del.slice(j, j + 100)));
    up = Object.keys(s.settings).map(function (g) { return { grp: g, data: s.settings[g] }; });
    await A.upsert("settings", up.filter(function (r) { return Object.keys(r.data).length; }), "grp");
    var delG = up.filter(function (r) { return !Object.keys(r.data).length; }).map(function (r) { return r.grp; });
    if (delG.length) await A.rest("DELETE", "settings?grp=" + A.inList(delG));
    var pu = [], pd = [];
    Object.keys(s.products).forEach(function (k) { if (s.products[k] === null) pd.push(k); else pu.push({ slug: k, data: s.products[k] }); });
    await A.upsert("products", pu, "slug");
    if (pd.length) await A.rest("DELETE", "products?slug=" + A.inList(pd));
    await A.loadDb();
    A.staged = { content: {}, settings: {}, products: {} };
    changed();
  };

  /* ---------- routing ---------- */
  A.routes = [];
  A.route = function (pattern, fn) { A.routes.push({ re: new RegExp("^" + pattern.replace(/:[a-z]+\*/g, "(.+)").replace(/:[a-z]+/g, "([^/]+)") + "$"), fn: fn }); };
  A.parseHash = function () {
    var raw = location.hash.replace(/^#/, "") || "/dashboard", q = {}, i = raw.indexOf("?");
    var path = i >= 0 ? raw.slice(0, i) : raw;
    if (i >= 0) raw.slice(i + 1).split("&").forEach(function (p) { var kv = p.split("="); q[kv[0]] = decodeURIComponent(kv[1] || ""); });
    return { path: decodeURIComponent(path), q: q };
  };
  A.go = function (path) { location.hash = "#" + path; };
})();
