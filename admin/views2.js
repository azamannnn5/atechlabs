/* Admin: orders, messages, site settings, redirects, maintenance, history, backup, team, help. */
(function () {
  "use strict";
  var h = A.h;
  A.changed = A.changed || function () {};

  /* ---------- orders and messages (save right away) ---------- */
  var ORDER_STATUS = ["new", "confirmed", "shipped", "done", "cancelled"], MSG_STATUS = ["new", "read", "done", "spam"];

  async function sendReply(type, id, subject, message) {
    var s = A.session.access_token;
    var res = await fetch("/.netlify/functions/reply", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + s }, body: JSON.stringify({ type: type, id: id, subject: subject, message: message }) });
    var d = null; try { d = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((d && d.error) || "Could not send");
  }

  function replyBox(type, row, defSubject) {
    if (!row.email) return h("p", { class: "orig" }, "No email address for this customer.");
    var subj = h("input", { type: "text", value: defSubject }), body = h("textarea", { rows: 5, placeholder: "Write your reply" });
    var send = h("button", { class: "btn pri sm", disabled: !A.can("editor"), onclick: async function () {
      if (!body.value.trim()) return;
      send.disabled = true;
      try { await sendReply(type, row.id, subj.value, body.value); A.toast("Email sent"); body.value = ""; } catch (e) { A.toast(e.message); }
      send.disabled = false;
    } }, "Send reply from the admin");
    return h("details", { style: { marginTop: "8px" } }, h("summary", null, "Reply by email"), h("label", { class: "lbl" }, "Subject"), subj, h("label", { class: "lbl" }, "Message"), body, h("div", { class: "row", style: { marginTop: "8px" } }, send, h("a", { class: "btn sm", href: "mailto:" + row.email + "?subject=" + encodeURIComponent(defSubject) }, "Open in my email app")));
  }

  function statusTabs(statuses, cur, onPick) {
    var t = h("div", { class: "tabs" });
    ["all"].concat(statuses).forEach(function (s) { t.appendChild(h("button", { class: s === cur ? "on" : "", onclick: function () { onPick(s); } }, s)); });
    return t;
  }

  A.route("/orders", async function () {
    var rows = await A.rest("GET", "orders?select=*&order=created_at.desc&limit=300"), filter = "all", wrap = h("div"), list = h("div", { class: "list" });
    var tabsBox = h("div");
    function draw() {
      A.clear(tabsBox); tabsBox.appendChild(statusTabs(ORDER_STATUS, filter, function (s) { filter = s; draw(); }));
      A.clear(list);
      var shown = rows.filter(function (r) { return filter === "all" || r.status === filter; });
      if (!shown.length) list.appendChild(h("p", { class: "orig" }, "No orders here."));
      shown.forEach(function (o) {
        var items = (o.items || []).map(function (i) { return h("div", null, i.qty + " x " + i.name + (i.pack ? " (" + i.pack + ")" : "") + " - " + A.money(i.line_total)); });
        var sel = h("select", { disabled: !A.can("editor"), style: { width: "auto" }, onchange: async function () {
          try { await A.rest("PATCH", "orders?id=eq." + o.id, { body: { status: sel.value }, headers: { Prefer: "return=minimal" } }); o.status = sel.value; A.toast("Status saved"); A.refreshBadges(); } catch (e) { A.toast(e.message); sel.value = o.status; }
        } }, ORDER_STATUS.map(function (s) { return h("option", { value: s, selected: s === o.status }, s); }));
        var note = h("textarea", { rows: 2, placeholder: "Private note (customers never see it)", disabled: !A.can("editor"), onchange: async function () { try { await A.rest("PATCH", "orders?id=eq." + o.id, { body: { admin_note: note.value }, headers: { Prefer: "return=minimal" } }); A.toast("Note saved"); } catch (e) { A.toast(e.message); } } });
        note.value = o.admin_note || "";
        var wa = (o.phone || "").replace(/\D/g, "");
        list.appendChild(h("details", { class: "card", style: { margin: "6px 0" } },
          h("summary", null, "#" + o.order_no + "  " + o.customer_name + "  " + A.money(o.subtotal) + "  ", h("span", { class: "chip" + (o.status === "new" ? " warn" : o.status === "cancelled" ? " bad" : " on") }, o.status), h("span", { class: "orig" }, "  " + A.date(o.created_at))),
          h("div", { style: { marginTop: "8px" } }, items),
          h("p", null, h("b", null, "Phone: "), o.phone, h("br"), h("b", null, "Email: "), o.email || "-", h("br"), h("b", null, "Address: "), o.address, h("br"), h("b", null, "Notes: "), o.notes || "-", h("br"), h("b", null, "Sent via: "), o.channel || "-"),
          h("div", { class: "row" }, h("label", null, "Status ", sel), wa ? h("a", { class: "btn sm", target: "_blank", href: "https://wa.me/" + wa }, "Message on WhatsApp") : null,
            A.can("admin") ? h("button", { class: "btn sm bad", onclick: async function () { if (!confirm("Delete this order for good?")) return; try { await A.rest("DELETE", "orders?id=eq." + o.id); rows = rows.filter(function (x) { return x.id !== o.id; }); draw(); A.refreshBadges(); } catch (e) { A.toast(e.message); } } }, "Delete") : null),
          h("label", { class: "lbl" }, "Private note"), note, replyBox("order", o, "Your order #" + o.order_no)));
      });
    }
    draw();
    wrap.appendChild(A.lockNote("editor", "orders"));
    wrap.appendChild(h("div", { class: "msg info" }, "Orders save right away. Changing a status does not need the Save button."));
    wrap.appendChild(tabsBox); wrap.appendChild(list);
    return A.pageShell("Orders", [["Customers"], ["Orders"]], "Orders sent from the cart on the site. Open one to see the items and contact details, change its status or reply to the customer.", wrap);
  });

  A.route("/messages", async function () {
    var rows = await A.rest("GET", "messages?select=*&order=created_at.desc&limit=300"), filter = "all", wrap = h("div"), list = h("div", { class: "list" }), tabsBox = h("div");
    function draw() {
      A.clear(tabsBox); tabsBox.appendChild(statusTabs(MSG_STATUS, filter, function (s) { filter = s; draw(); }));
      A.clear(list);
      var shown = rows.filter(function (r) { return filter === "all" || r.status === filter; });
      if (!shown.length) list.appendChild(h("p", { class: "orig" }, "No messages here."));
      shown.forEach(function (m) {
        var sel = h("select", { disabled: !A.can("editor"), style: { width: "auto" }, onchange: async function () {
          try { await A.rest("PATCH", "messages?id=eq." + m.id, { body: { status: sel.value }, headers: { Prefer: "return=minimal" } }); m.status = sel.value; A.toast("Status saved"); A.refreshBadges(); } catch (e) { A.toast(e.message); sel.value = m.status; }
        } }, MSG_STATUS.map(function (s) { return h("option", { value: s, selected: s === m.status }, s); }));
        list.appendChild(h("details", { class: "card", style: { margin: "6px 0" }, onclick: function () {} },
          h("summary", null, m.name + "  ", h("span", { class: "chip" + (m.status === "new" ? " warn" : "") }, m.status), h("span", { class: "orig" }, "  " + A.date(m.created_at))),
          h("p", { class: "orig" }, m.email + (m.page ? " - sent from " + m.page : "")),
          h("p", { style: { whiteSpace: "pre-wrap" } }, m.message),
          h("div", { class: "row" }, h("label", null, "Status ", sel),
            A.can("editor") ? h("button", { class: "btn sm bad", onclick: async function () { if (!confirm("Delete this message?")) return; try { await A.rest("DELETE", "messages?id=eq." + m.id); rows = rows.filter(function (x) { return x.id !== m.id; }); draw(); A.refreshBadges(); } catch (e) { A.toast(e.message); } } }, "Delete") : null),
          replyBox("message", m, "Re: your message")));
      });
    }
    draw();
    wrap.appendChild(A.lockNote("editor", "messages"));
    wrap.appendChild(h("div", { class: "msg info" }, "Messages save right away. Changing a status does not need the Save button."));
    wrap.appendChild(tabsBox); wrap.appendChild(list);
    return A.pageShell("Messages", [["Customers"], ["Messages"]], "Messages sent from the Contact us form. Mark them read, done or spam, or reply by email.", wrap);
  });

  /* ---------- settings screens ---------- */
  var SCREENS = {
    seo: { title: "Search and sharing", grp: "site", note: "How the site appears in Google and when a link is shared. Per-page titles and descriptions are below. Turn on Hide from search engines while you are still testing.", fields: [
      { k: "name", label: "Site name", type: "text", help: "Used as the page title when a page has none." },
      { k: "description", label: "Default description", type: "textarea", help: "Shown in search results when a page has no description of its own." },
      { k: "ogImage", label: "Sharing image", type: "image", help: "The picture shown when a link is shared." },
      { k: "favicon", label: "Favicon (small tab icon)", type: "image" },
      { k: "noindex", label: "Hide the whole site from search engines", type: "check" }] },
    banner: { title: "Announcement bar", grp: "banner", note: "A thin bar of text above the header on every page, for example a shipping notice. To change the picture banner use Content > Top banner image.", fields: [
      { k: "on", label: "Show the bar", type: "check" }, { k: "text", label: "Text", type: "text" }, { k: "link", label: "Link (optional)", type: "text", help: "For example cart.html or https://..." },
      { k: "bg", label: "Background colour", type: "color" }, { k: "color", label: "Text colour", type: "color" },
      { k: "hideImage", label: "Hide the existing picture banner", type: "check" }] },
    look: { title: "Look and feel", grp: "look", note: "Advanced. Custom CSS is added to every page. Leave it empty if you are not sure. Wrong CSS can break the layout; empty the box to go back to the original look.", fields: [
      { k: "css", label: "Custom CSS", type: "code", help: "Example: .btn-dark { background: #0a5; }" }] },
    tracking: { title: "Tracking and chat", grp: "tracking", note: "Connect analytics and the Smartsupp live chat. Paste only the ID or key. Head and body code is added to every page, so only paste code you trust.", fields: [
      { k: "smartsupp", label: "Smartsupp chat key", type: "text", help: "From Smartsupp > Settings > Chat code. Letters and numbers only." },
      { k: "gaId", label: "Google Analytics ID", type: "text", help: "Looks like G-XXXXXXXXXX" },
      { k: "pixelId", label: "Meta (Facebook) pixel ID", type: "text", help: "Numbers only" },
      { k: "headCode", label: "Custom code for the head", type: "code" }, { k: "bodyCode", label: "Custom code for the end of the page", type: "code" }] },
    orders: { title: "Orders and contact details", grp: "orders", note: "Where orders go. The email also receives the order alerts from Resend. The WhatsApp number is used by the Order on WhatsApp button in the cart.", fields: [
      { k: "email", label: "Orders email address", type: "text", help: "For example orders@yourdomain.com" },
      { k: "whatsapp", label: "WhatsApp number", type: "text", help: "Digits only with country code, for example 237600000000" }] },
    contact: { title: "Contact form", grp: "contact", note: "The Contact us form saves messages to Customers > Messages. The wording of the form and its thank-you message is under Content > Contact popup.", fields: [
      { k: "off", label: "Turn off saving messages to the inbox (the form then behaves as before)", type: "check" }] },
    maintenance: { title: "Maintenance mode", grp: "maintenance", note: "Shows visitors a message instead of the site. Add your preview key, then open the site with ?preview=YOURKEY to still see it yourself. Pages under /admin are never blocked.", fields: [
      { k: "on", label: "Maintenance mode on", type: "check" }, { k: "message", label: "Message for visitors", type: "textarea" },
      { k: "bypass", label: "Preview key", type: "text", help: "Letters and numbers. Then visit ../index.html?preview=KEY" }] }
  };
  A.settingIndex = [];
  Object.keys(SCREENS).forEach(function (id) { SCREENS[id].fields.forEach(function (f) { A.settingIndex.push({ label: f.label, screen: SCREENS[id].title, path: "/site/" + id }); }); });
  A.settingIndex.push({ label: "Redirects", screen: "Site", path: "/site/redirects" });

  function settingField(grp, obj, f, locked) {
    var save = function () { A.setSetting(grp, obj); mk(); };
    var edited = h("span", { class: "edited", style: { display: "none" } }, "Edited");
    function mk() { edited.style.display = (grp in A.staged.settings) ? "" : "none"; }
    var ctl;
    if (f.type === "check") { ctl = h("label", null, h("input", { type: "checkbox", checked: !!obj[f.k], disabled: locked, onchange: function (e) { obj[f.k] = e.target.checked; save(); } }), " ", f.label); }
    else if (f.type === "textarea" || f.type === "code") { ctl = h("textarea", { rows: f.type === "code" ? 8 : 4, disabled: locked, style: f.type === "code" ? { fontFamily: "monospace" } : null, oninput: function (e) { obj[f.k] = e.target.value; save(); } }); ctl.value = obj[f.k] || ""; }
    else if (f.type === "color") { ctl = h("input", { type: "color", value: obj[f.k] || (f.k === "bg" ? "#111111" : "#ffffff"), disabled: locked, style: { width: "80px", padding: "2px" }, oninput: function (e) { obj[f.k] = e.target.value; save(); } }); }
    else if (f.type === "image") {
      var inp = h("input", { type: "text", value: obj[f.k] || "", disabled: locked, oninput: function (e) { obj[f.k] = e.target.value; save(); } });
      ctl = h("div", { class: "row" }, h("div", { style: { flex: 1, minWidth: "200px" } }, inp), h("button", { type: "button", class: "btn sm", disabled: locked, onclick: function () { A.pickImage(function (u) { inp.value = u; obj[f.k] = u; save(); }); } }, "Choose image"));
    }
    else { ctl = h("input", { type: "text", value: obj[f.k] || "", disabled: locked, oninput: function (e) { obj[f.k] = e.target.value.trim() === e.target.value ? e.target.value : e.target.value; save(); } }); }
    mk();
    return h("div", { class: "fld", "data-key": grp + "." + f.k }, f.type === "check" ? null : h("div", { class: "top2" }, h("span", { class: "pill Setting" }, "Setting"), h("span", null, f.label), edited), ctl, f.help ? h("div", { class: "orig" }, f.help) : null);
  }

  A.route("/site/:id", function (m) {
    var id = m[0];
    if (id === "redirects") return redirectsView();
    var sc = SCREENS[id]; if (!sc) return h("p", null, "Not found");
    var locked = !A.can("admin"), obj = A.getSetting(sc.grp);
    var card = h("div", { class: "card" });
    sc.fields.forEach(function (f) { card.appendChild(settingField(sc.grp, obj, f, locked)); });
    var wrap = h("div", null, A.lockNote("admin", "this setting"), card);
    if (id === "maintenance") wrap.appendChild(h("div", { class: "card" }, h("p", null, "Preview link for you: "), h("code", null, (location.origin + location.pathname.replace(/admin\/.*$/, "")) + "index.html?preview=" + (obj.bypass || "YOURKEY"))));
    if (id === "seo") wrap.appendChild(seoPages(locked));
    return A.pageShell(sc.title, [["Site"], [sc.title]], sc.note + " Changes go live when you press Save and publish.", wrap);
  });

  function seoPages(locked) {
    var obj = A.getSetting("seo_pages"), P = A.defaults.pages, wrap = h("div", { class: "card" }, h("h2", null, "Title and description for each page"));
    var q = h("input", { type: "text", placeholder: "Filter pages", oninput: function () { A.$$("details.pg", wrap).forEach(function (d) { d.style.display = d.getAttribute("data-t").indexOf(q.value.toLowerCase()) >= 0 ? "" : "none"; }); } });
    wrap.appendChild(q);
    Object.keys(P).forEach(function (p) {
      var cur = obj[p] || {};
      var save = function () { var o = A.getSetting("seo_pages"); o[p] = Object.assign({}, cur); Object.keys(o[p]).forEach(function (k) { if (!o[p][k]) delete o[p][k]; }); if (!Object.keys(o[p]).length) delete o[p]; A.setSetting("seo_pages", o); };
      var t = h("input", { type: "text", value: cur.title || "", disabled: locked, placeholder: "Page title", oninput: function () { cur.title = t.value; save(); } });
      var d = h("textarea", { rows: 2, disabled: locked, placeholder: "Page description", oninput: function () { cur.description = d.value; save(); } }); d.value = cur.description || "";
      var n = h("label", null, h("input", { type: "checkbox", checked: !!cur.noindex, disabled: locked, onchange: function (e) { cur.noindex = e.target.checked; save(); } }), " Hide this page from search engines");
      wrap.appendChild(h("details", { class: "pg", "data-t": (P[p].title + " " + p).toLowerCase(), style: { borderTop: "1px solid var(--line)", padding: "6px 0" } }, h("summary", null, P[p].title, h("span", { class: "orig" }, "  " + p)), t, d, n));
    });
    return wrap;
  }

  function redirectsView() {
    var locked = !A.can("admin"), list = A.getSetting("redirects");
    var arr = Array.isArray(list.items) ? list.items : [];
    var box = h("div");
    var save = function () { A.setSetting("redirects", { items: arr.filter(function (r) { return r.from && r.to; }) }); };
    function draw() {
      A.clear(box);
      arr.forEach(function (r, i) {
        box.appendChild(h("div", { class: "row", style: { marginBottom: "8px" } },
          h("input", { type: "text", placeholder: "From page, e.g. lab-tests.html", value: r.from, disabled: locked, style: { flex: 1, minWidth: "180px" }, oninput: function (e) { r.from = e.target.value; save(); } }),
          h("span", null, "goes to"),
          h("input", { type: "text", placeholder: "To, e.g. catalog.html or https://...", value: r.to, disabled: locked, style: { flex: 1, minWidth: "180px" }, oninput: function (e) { r.to = e.target.value; save(); } }),
          h("button", { class: "btn sm bad", disabled: locked, onclick: function () { arr.splice(i, 1); save(); draw(); } }, "Remove")));
      });
      box.appendChild(h("button", { class: "btn sm", disabled: locked, onclick: function () { arr.push({ from: "", to: "" }); draw(); } }, "Add a redirect"));
    }
    draw();
    return A.pageShell("Redirects", [["Site"], ["Redirects"]], "Send visitors from one page to another. This is also the way to hide a page: redirect it to the catalog. Changes go live when you press Save and publish.", h("div", null, A.lockNote("admin", "redirects"), h("div", { class: "card" }, box)));
  }

  /* ---------- history ---------- */
  A.route("/admin/history", async function () {
    var rows = await A.rest("GET", "history?select=*&order=at.desc&limit=200"), list = h("div");
    var show = function (v) { return v == null ? "(nothing)" : typeof v === "string" ? v : JSON.stringify(v, null, 1); };
    rows.forEach(function (x) {
      var canRestore = A.can("editor") && x.tbl !== "settings" || A.can("admin");
      list.appendChild(h("details", { class: "card", style: { margin: "6px 0" } },
        h("summary", null, x.tbl + ": " + x.key + "  ", h("span", { class: "chip" }, x.action), h("span", { class: "orig" }, "  " + (x.by_email || "unknown") + ", " + A.date(x.at))),
        h("div", { class: "diff", style: { marginTop: "8px" } }, h("div", null, h("b", null, "Before"), h("br"), show(x.old_val)), h("div", null, h("b", null, "After"), h("br"), show(x.new_val))),
        h("div", { class: "row", style: { marginTop: "8px" } }, h("button", { class: "btn sm", disabled: !canRestore, onclick: function () {
          if (x.tbl === "content") { if (x.old_val == null) A.resetContent(x.key); else A.setContent(x.key, x.old_val); }
          else if (x.tbl === "settings") A.setSetting(x.key, x.old_val || {});
          else if (x.tbl === "products") { var o = x.old_val; if (o && Object.keys(o).length) A.staged.products[x.key] = o; else if (x.key in A.db.products) A.staged.products[x.key] = null; else delete A.staged.products[x.key]; A.changed(); }
          A.toast("Restored as an unsaved change. Press Save to make it live.");
        } }, "Restore the before version (unsaved until you Save)"))));
    });
    return A.pageShell("Activity and undo", [["Admin"], ["Activity and undo"]], "Every saved change, with who made it and when. Restoring puts the older version back as an unsaved change so you can check it first.", rows.length ? list : h("p", { class: "orig" }, "No changes yet."));
  });

  /* ---------- backup ---------- */
  A.route("/admin/backup", function () {
    var file = h("input", { type: "file", accept: "application/json", onchange: function () {
      var f = file.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var b = JSON.parse(r.result);
          if (!b || !b.content || !b.settings || !b.products) throw new Error("This is not a backup from this admin.");
          Object.keys(b.content).forEach(function (k) { if (A.defaults.fields[k]) A.setContent(k, b.content[k]); });
          Object.keys(A.db.content).forEach(function (k) { if (!(k in b.content)) A.resetContent(k); });
          Object.keys(b.settings).forEach(function (g) { A.setSetting(g, b.settings[g]); });
          Object.keys(A.db.settings).forEach(function (g) { if (!(g in b.settings)) A.setSetting(g, {}); });
          Object.keys(b.products).forEach(function (s) { A.staged.products[s] = b.products[s]; });
          Object.keys(A.db.products).forEach(function (s) { if (!(s in b.products)) A.staged.products[s] = null; });
          A.changed(); A.toast("Backup loaded as unsaved changes. Check them, then press Save.");
        } catch (e) { A.toast(e.message); }
      };
      r.readAsText(f);
    } });
    return A.pageShell("Backup and restore", [["Admin"], ["Backup and restore"]], "Download everything you have changed as one file, or load a backup file back in. Loading a backup makes unsaved changes first, so nothing goes live until you press Save.",
      h("div", null, h("div", { class: "card" }, h("h2", null, "Download a backup"), h("p", { class: "orig" }, "Contains your edited texts, links, images, settings and product changes. It does not contain orders or messages."),
        h("button", { class: "btn pri", onclick: function () {
          var blob = new Blob([JSON.stringify({ app: "atechlab-admin", exportedAt: new Date().toISOString(), content: A.db.content, settings: A.db.settings, products: A.db.products }, null, 2)], { type: "application/json" });
          var a = h("a", { href: URL.createObjectURL(blob), download: "atechlab-backup-" + new Date().toISOString().slice(0, 10) + ".json" }); document.body.appendChild(a); a.click(); a.remove();
        } }, "Download backup")),
        h("div", { class: "card" }, h("h2", null, "Load a backup"), h("p", { class: "orig" }, "Anything not in the backup file is reset to the original."), file)));
  });

  /* ---------- team ---------- */
  A.route("/admin/team", async function () {
    var rows = [];
    try { rows = await A.rest("GET", "admins?select=*&order=created_at.asc"); } catch (e) {}
    var owner = A.can("owner"), list = h("div", { class: "list" });
    rows.forEach(function (r) {
      var self = r.user_id === A.user.id;
      var sel = h("select", { disabled: !owner || self, style: { width: "auto" }, onchange: async function () { try { await A.rest("PATCH", "admins?user_id=eq." + r.user_id, { body: { role: sel.value }, headers: { Prefer: "return=minimal" } }); A.toast("Role saved"); } catch (e) { A.toast(e.message); sel.value = r.role; } } }, ["owner", "admin", "editor", "viewer"].map(function (x) { return h("option", { value: x, selected: x === r.role }, x); }));
      list.appendChild(h("div", { class: "li" }, h("div", { class: "grow" }, r.email, self ? " (you)" : ""), sel,
        owner && !self ? h("button", { class: "btn sm bad", onclick: async function () { if (!confirm("Remove " + r.email + " from the team?")) return; try { await A.rest("DELETE", "admins?user_id=eq." + r.user_id); A.render(); } catch (e) { A.toast(e.message); } } }, "Remove") : null));
    });
    var email = h("input", { type: "email", placeholder: "Email of an existing login" }), role = h("select", { style: { width: "auto" } }, ["viewer", "editor", "admin", "owner"].map(function (x) { return h("option", { value: x }, x); }));
    var addCard = owner ? h("div", { class: "card" }, h("h2", null, "Add a team member"), h("p", { class: "orig" }, "First create their login in Supabase: Authentication > Users > Add user. Then enter the same email here."), h("div", { class: "row" }, email, role, h("button", { class: "btn pri", onclick: async function () {
      try { await A.rpc("add_admin", { p_email: email.value, p_role: role.value }); A.toast("Added"); A.render(); } catch (e) { A.toast(e.message); }
    } }, "Add"))) : h("div", { class: "msg warn" }, "Only the owner can change the team.");
    return A.pageShell("Team", [["Admin"], ["Team"]], "Owner: everything including the team. Admin: everything except the team. Editor: content, products, files and inbox. Viewer: look only. Team changes save right away.", h("div", null, h("div", { class: "card" }, list), addCard));
  });

  /* ---------- help ---------- */
  A.route("/admin/help", function () {
    var p = function (t) { return h("p", null, t); };
    return A.pageShell("Help and guide", [["Admin"], ["Help and guide"]], "The basics in plain words.", h("div", null,
      h("div", { class: "card" }, h("h2", null, "How saving works"),
        p("Text, links, images, products and settings are staged. You can change many things, then press Save and publish in the bar at the bottom. Nothing is live until then. Discard throws the changes away."),
        p("Orders, messages, uploads, team changes and status changes save right away. The screen says so.")),
      h("div", { class: "card" }, h("h2", null, "What the coloured labels mean"),
        h("div", { class: "row" }, h("span", { class: "pill Text" }, "Text"), "words on the page", h("span", { class: "pill Link" }, "Link"), "where something goes when clicked", h("span", { class: "pill Image" }, "Image"), "a picture", h("span", { class: "pill Alt" }, "Alt text"), "a picture description for search engines and screen readers", h("span", { class: "pill Setting" }, "Setting"), "a switch or value for the whole site")),
      h("div", { class: "card" }, h("h2", null, "Where things live"),
        h("ul", null, h("li", null, "Words on a page: Content > Pages."), h("li", null, "Menu, footer, contact popup: Content menu. One edit changes every page."), h("li", null, "Prices, names, stock, hide a product: Shop > Products."), h("li", null, "Order alert email and WhatsApp number: Site > Orders and contact details."), h("li", null, "Live chat key: Site > Tracking and chat."), h("li", null, "Hide the site from Google while testing: Site > Search and sharing."))),
      h("div", { class: "card" }, h("h2", null, "Good to know"),
        h("ul", null, h("li", null, "Every field shows the original in grey and has Reset to original."), h("li", null, "If the database cannot be reached, visitors see the original site."), h("li", null, "After a product or setting change, visitors may need one page refresh to see it; text changes appear on their next visit."), h("li", null, "Never paste secret keys into any admin field. Secret keys belong only in Netlify environment variables."), h("li", null, "Press / to jump to the search box.")))));
  });
})();
