/*
 * A-Tech Labs public loader.
 * Reads the small public "snapshot" from Supabase and applies the admin's edits.
 * If Supabase is not configured or cannot be reached, it changes nothing and the
 * site shows its original content.
 */
(function () {
  "use strict";
  var CFG = window.CMS_CONFIG || {};
  var CACHE_KEY = "atl_cms_snapshot_v1";
  var me = document.currentScript;
  var mySrc = (me && me.getAttribute("src")) || "static/js/cms-loader.js";
  var ROOT = mySrc.replace(/static\/js\/cms-loader\.js.*$/, ""); // "" or "../" or "../../"

  var api = { root: ROOT, snap: null, configured: !!(CFG.url && CFG.anonKey), config: CFG };
  window.CMS = api;
  api.settings = function (g) { return (api.snap && api.snap.settings && api.snap.settings[g]) || {}; };
  api.product = function (slug) { return (api.snap && api.snap.products && api.snap.products[slug]) || null; };
  if (!api.configured) return;

  function lsGet() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) { return null; } }
  function lsSet(v) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  var REST = CFG.url.replace(/\/$/, "") + "/rest/v1/snapshot?id=eq.1&select=data";
  var HEAD = { apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey };

  api.snap = lsGet();
  if (!api.snap) {
    // very first visit: one quick blocking fetch so the first view is already correct
    try {
      var x = new XMLHttpRequest();
      x.open("GET", REST, false);
      x.setRequestHeader("apikey", HEAD.apikey);
      x.setRequestHeader("Authorization", HEAD.Authorization);
      x.send(null);
      if (x.status === 200) {
        var rows = JSON.parse(x.responseText);
        if (rows && rows[0] && rows[0].data) { api.snap = rows[0].data; lsSet(api.snap); }
      }
    } catch (e) {}
  }

  // ---------- helpers ----------
  var ABS = /^(https?:|\/\/|mailto:|tel:|#|data:|javascript:|blob:)/i;
  function resolve(v) { return v && !ABS.test(v) ? ROOT + v.replace(/^\/+/, "") : v; }

  function pageKey() {
    var rootPath = new URL(ROOT || "./", location.href).pathname;
    var p = location.pathname;
    if (p.indexOf(rootPath) === 0) p = p.slice(rootPath.length);
    p = p.replace(/^\/+/, "");
    if (!p || /\/$/.test(p)) p += "index.html";
    if (!/\.html?$/i.test(p)) p += ".html";
    return p;
  }
  api.pageKey = pageKey;

  function fixHtmlLinks(el) {
    var a = el.querySelectorAll("a[href]");
    for (var i = 0; i < a.length; i++) a[i].setAttribute("href", resolve(a[i].getAttribute("href")));
    var m = el.querySelectorAll("img[src]");
    for (var j = 0; j < m.length; j++) m[j].setAttribute("src", resolve(m[j].getAttribute("src")));
  }

  // ---------- apply content ----------
  function applyContent(snap) {
    var c = (snap && snap.content) || {};
    var keys = Object.keys(c);
    if (!keys.length) return;
    var els = document.querySelectorAll("[data-cms],[data-cms-href],[data-cms-src],[data-cms-srcset],[data-cms-alt]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], k;
      if ((k = el.getAttribute("data-cms")) && k in c) {
        if (el.hasAttribute("data-cms-html")) { el.innerHTML = c[k]; fixHtmlLinks(el); }
        else el.textContent = c[k];
      }
      if ((k = el.getAttribute("data-cms-href")) && k in c) el.setAttribute("href", resolve(c[k]));
      if ((k = el.getAttribute("data-cms-src")) && k in c) { el.setAttribute("src", resolve(c[k])); el.removeAttribute("srcset"); }
      if ((k = el.getAttribute("data-cms-srcset")) && k in c) el.setAttribute("srcset", resolve(c[k]));
      if ((k = el.getAttribute("data-cms-alt")) && k in c) el.setAttribute("alt", c[k]);
    }
  }

  // ---------- products ----------
  function applyProducts(snap) {
    var P = (snap && snap.products) || {};
    var slugs = Object.keys(P);
    if (!slugs.length) return;
    var els = document.querySelectorAll("[data-pslug]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], slug = el.getAttribute("data-pslug"), p = P[slug];
      if (!p) continue;
      if (p.hidden) {
        if (el.tagName === "MAIN") { location.replace(ROOT + "catalog.html"); return; }
        if (el.parentNode) el.parentNode.removeChild(el);
        continue;
      }
      var set = function (field, val, isImg) {
        if (val == null || val === "") return;
        var t = el.querySelector('[data-pf="' + field + '"]') || (el.tagName === "MAIN" ? document.querySelector('[data-pf="' + field + '"]') : null);
        if (!t) return;
        if (isImg) { t.setAttribute("src", resolve(val)); t.removeAttribute("srcset"); } else t.textContent = val;
      };
      set("name", p.name); set("sub", p.sub); set("full", p.full); set("pack", p.pack); set("image", p.image, true);
      if (el.tagName === "A" && p.name) { var im = el.querySelector("img"); if (im) im.setAttribute("alt", p.name); }
    }
  }

  // ---------- settings ----------
  function metaTag(attr, name, val) {
    var m = document.head.querySelector("meta[" + attr + '="' + name + '"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, name); document.head.appendChild(m); }
    m.setAttribute("content", val);
  }
  function addScript(src, attrs) {
    var s = document.createElement("script"); s.src = src; s.async = true;
    if (attrs) for (var k in attrs) s.setAttribute(k, attrs[k]);
    document.head.appendChild(s);
  }
  function runHtml(target, html) {
    var box = document.createElement("div"); box.innerHTML = html;
    var nodes = Array.prototype.slice.call(box.childNodes);
    nodes.forEach(function (n) {
      if (n.nodeName === "SCRIPT") {
        var s = document.createElement("script");
        for (var i = 0; i < n.attributes.length; i++) s.setAttribute(n.attributes[i].name, n.attributes[i].value);
        s.text = n.textContent; target.appendChild(s);
      } else target.appendChild(n);
    });
  }

  function applySeo(S) {
    var site = S.site || {}, pages = S.seo_pages || {}, pg = pages[pageKey()] || {};
    var title = pg.title || "";
    if (!title && site.name && !document.title.trim()) title = site.name;
    if (title) document.title = title;
    var desc = pg.description || site.description;
    if (desc) { metaTag("name", "description", desc); metaTag("property", "og:description", desc); }
    if (title || site.name) metaTag("property", "og:title", title || site.name);
    if (site.name) metaTag("property", "og:site_name", site.name);
    if (site.ogImage) metaTag("property", "og:image", /^https?:/.test(site.ogImage) ? site.ogImage : new URL(resolve(site.ogImage), location.href).href);
    if (site.favicon) { var l = document.head.querySelector('link[rel="icon"]'); if (l) l.setAttribute("href", resolve(site.favicon)); }
    if (site.noindex || pg.noindex) metaTag("name", "robots", "noindex, nofollow");
  }

  function applyBanner(S) {
    var b = S.banner || {};
    if (b.hideImage) { var old = document.querySelector("body > .alert"); if (old) old.style.display = "none"; }
    if (b.on && b.text) {
      var bar = document.createElement("div");
      bar.setAttribute("data-cms-bar", "1");
      bar.style.cssText = "text-align:center;padding:10px 16px;font-size:14px;line-height:1.4;background:" + (b.bg || "#111") + ";color:" + (b.color || "#fff");
      if (b.link) { var a = document.createElement("a"); a.href = resolve(b.link); a.textContent = b.text; a.style.cssText = "color:inherit;text-decoration:underline"; bar.appendChild(a); }
      else bar.textContent = b.text;
      document.body.insertBefore(bar, document.body.firstChild);
    }
  }

  function maintenance(S) {
    var m = S.maintenance || {};
    if (!m.on) return false;
    var q = location.search.match(/[?&]preview=([^&]+)/);
    if (q && m.bypass && decodeURIComponent(q[1]) === m.bypass) ssSet("atl_preview", "1");
    if (ssGet("atl_preview") === "1" || /\/admin\//.test(location.pathname)) return false;
    var ov = document.createElement("div"); ov.id = "cms-maint";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#fff;overflow:auto";
    ov.innerHTML = '<div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,sans-serif"><div style="max-width:520px"><h1 style="font-size:28px;margin:0 0 12px;color:#111">We will be back soon</h1><p style="font-size:16px;color:#444;white-space:pre-line"></p></div></div>';
    document.body.appendChild(ov); document.documentElement.style.overflow = "hidden";
    ov.querySelector("p").textContent = m.message || "The site is down for maintenance. Please check back shortly.";
    return true;
  }

  function redirects(S) {
    var list = S.redirects && S.redirects.items ? S.redirects.items : (Array.isArray(S.redirects) ? S.redirects : []);
    var here = pageKey().replace(/\.html$/, "");
    for (var i = 0; i < list.length; i++) {
      var r = list[i]; if (!r || !r.from || !r.to) continue;
      var from = String(r.from).replace(/^\/+/, "").replace(/\.html$/, "").replace(/\/$/, "");
      if (from === here || from + "/index" === here) { location.replace(resolve(r.to)); return true; }
    }
    return false;
  }

  function tracking(S) {
    var t = S.tracking || {};
    if (t.gaId && /^[A-Za-z0-9-]+$/.test(t.gaId)) {
      addScript("https://www.googletagmanager.com/gtag/js?id=" + t.gaId);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date()); window.gtag("config", t.gaId);
    }
    if (t.pixelId && /^[0-9]+$/.test(t.pixelId)) {
      !function (f, b, e, v, n, t2, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t2 = b.createElement(e); t2.async = !0; t2.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t2, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", t.pixelId); window.fbq("track", "PageView");
    }
    if (t.smartsupp && /^[A-Za-z0-9]+$/.test(t.smartsupp)) {
      window._smartsupp = window._smartsupp || {}; window._smartsupp.key = t.smartsupp;
      window.smartsupp || (function (d) { var s, c, o = window.smartsupp = function () { o._.push(arguments); }; o._ = []; s = d.getElementsByTagName("script")[0]; c = d.createElement("script"); c.type = "text/javascript"; c.charset = "utf-8"; c.async = true; c.src = "https://www.smartsuppchat.com/loader.js?"; s.parentNode.insertBefore(c, s); })(document);
    }
    if (t.headCode) runHtml(document.head, t.headCode);
    if (t.bodyCode) runHtml(document.body, t.bodyCode);
  }

  function lookAndFeel(S) {
    var l = S.look || {};
    if (l.css) { var st = document.createElement("style"); st.setAttribute("data-cms-css", "1"); st.textContent = l.css; document.head.appendChild(st); }
  }

  // ---------- contact form -> inbox ----------
  function contactForms(S) {
    var c = S.contact || {};
    if (c.off) return;
    var forms = document.querySelectorAll(".contacts-form");
    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault(); ev.stopImmediatePropagation();
        var q = function (n) { return form.querySelector('[name="' + n + '"]'); };
        var name = q("name"), email = q("email"), msg = q("message");
        var ok = true;
        function mark(el, good) { if (!el) return; el.classList.toggle("is-invalid", !good); el.classList.toggle("is-valid", good); if (!good) ok = false; }
        mark(name, name.value.trim().length >= 3);
        mark(email, email.value.trim().length >= 5 && email.value.indexOf("@") > 0);
        mark(msg, msg.value.trim().length >= 3);
        if (!ok) return;
        var btn = form.querySelector("button[type=submit],button:not([data-bs-dismiss])");
        if (btn) { btn.style.pointerEvents = "none"; btn.style.opacity = ".6"; }
        fetch(CFG.url.replace(/\/$/, "") + "/rest/v1/rpc/submit_message", {
          method: "POST",
          headers: { apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ p_name: name.value, p_email: email.value, p_message: msg.value, p_page: pageKey() })
        }).then(function (r) { if (!r.ok) throw new Error("fail"); return r.json(); }).then(function (id) {
          try { fetch("/.netlify/functions/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "message", id: id }) }).catch(function () {}); } catch (e) {}
          Array.prototype.forEach.call(form.querySelectorAll("input:not([type=hidden]),textarea"), function (f) { f.value = ""; f.classList.remove("is-valid", "is-invalid"); });
          var ok2 = form.querySelector(".form-sent-message");
          if (ok2) { ok2.style.display = "block"; setTimeout(function () { ok2.style.display = ""; }, 6000); }
        }).catch(function () {
          mark(email, false);
        }).then(function () { if (btn) { btn.style.pointerEvents = ""; btn.style.opacity = ""; } });
      }, true);
    });
  }

  function applyAll(snap, first) {
    if (!snap) return;
    var S = snap.settings || {};
    if (first) {
      if (redirects(S)) return;
      if (maintenance(S)) return;
    }
    applyContent(snap);
    applyProducts(snap);
    if (first) { applySeo(S); applyBanner(S); lookAndFeel(S); tracking(S); contactForms(S); }
  }

  function boot() {
    applyAll(api.snap, true);
    // refresh quietly
    fetch(REST, { headers: HEAD }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rows) {
      var fresh = rows && rows[0] && rows[0].data;
      if (!fresh) return;
      var old = api.snap;
      if (old && old.v === fresh.v) return;
      lsSet(fresh);
      if (!old) return;
      var changedStructure = JSON.stringify(old.settings) !== JSON.stringify(fresh.settings) || JSON.stringify(old.products) !== JSON.stringify(fresh.products);
      if (changedStructure && ssGet("atl_reloaded") !== String(fresh.v)) { ssSet("atl_reloaded", String(fresh.v)); location.reload(); return; }
      api.snap = fresh; applyContent(fresh);
    }).catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
