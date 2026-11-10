/* Simple cart for the A-Tech Labs site. Stores the cart in the browser (localStorage). */
(function () {
  // Order contact details now come from the admin panel (Site > Orders and contact).
  // These two are only a fallback when the database is not connected.
  var ORDER_EMAIL = "";      // example: "orders@yourdomain.com"
  var ORDER_WHATSAPP = "";   // digits only with country code, example: "237600000000"

  // Prices in USD (distributor US domestic prices). null = contact for price.
  var PRODUCTS = {
    "tirzepatide":      { name: "Tirzepatide", pack: "1 vial x 10 mg + sterilized water", price: 169 },
    "semaglutide":      { name: "Semaglutide", pack: "1 vial x 5 mg + sterilized water", price: 169 },
    "retatrutide":      { name: "Retatrutide 10mg", pack: "1 vial x 10 mg", price: 169 },
    "atechtropin":      { name: "Atechtropin 100IU (Kit)", pack: "10 vials x 10 iu", price: 337 },
    "supertropin":      { name: "Supertropin 16IU", pack: "1 vial x 16 iu + bac water", price: 89 },
    "atechhigf1":       { name: "AtechIGF-1 100mcg (Kit)", pack: "10 vials x 100 mcg", price: 338 },
    "atechcjc1295dac":  { name: "AtechCJC-1295 DAC 2mg (Kit)", pack: "10 vials x 2 mg", price: 460 },
    "atechmgf":         { name: "AtechMGF 2mg (Kit)", pack: "10 vials x 2 mg + water", price: 266 },
    "atechfst344":      { name: "Atechfst-344 (Kit)", pack: "4 vials x 2 mg + water", price: 952 },
    "timbetasin":       { name: "Timbetasin (TB 500) 2mg", pack: "1 vial x 2 mg", price: 80 },
    "atechorion":       { name: "Atechorion 5000iu", pack: "1 vial x 5000 iu + water", price: 79 },
    "atechghrp2":       { name: "Atech GHRP-2", pack: "", price: null },
    "atechghrp6":       { name: "Atech GHRP-6", pack: "", price: null },
    "carn3000":         { name: "Carn 3000", pack: "1 vial x 10 ml x 300 mg/ml", price: 109 },
    "cabaser":          { name: "Cabaser", pack: "8 tabs x 0.5 mg", price: 154 },
    "letrodex":         { name: "Letrodex", pack: "50 tabs x 2.5 mg", price: 99 },
    "arimidex":         { name: "Arimidex", pack: "100 tabs x 1 mg", price: 99 },
    "aromasin":         { name: "Aromasin", pack: "50 tabs x 25 mg", price: 109 },
    "clomid":           { name: "Clomid", pack: "100 tabs x 50 mg", price: 124 },
    "novadex":          { name: "Nolvadex (Novadex)", pack: "100 tabs x 20 mg", price: 122 },
    "clenbuterol":      { name: "Clenbuterol", pack: "100 tabs x 40 mcg", price: 94 },
    "cytomel":          { name: "Cytomel", pack: "100 tabs x 25 mcg", price: 73 },
    "reductil":         { name: "Reductil", pack: "100 tabs x 15 mg", price: 99 },
    "1-test-cyp-dhb": { name: "1-TEST-CYP (DHB)", pack: "1 vial x 10 ml x 100 mg/ml", price: 105 },
    "anadrol-50": { name: "Anadrol 50", pack: "100 tabs x 50 mg/tab", price: 139 },
    "anavar10": { name: "Anavar 10", pack: "100 tabs x 10 mg/tab", price: 119 },
    "anavar50": { name: "Anavar 50", pack: "100 tabs x 50 mg/tab", price: 239 },
    "bold-u300": { name: "Bold U300", pack: "1 vial x 10ml x 300 mg/ml", price: 91 },
    "dbol-m100": { name: "Dbol 100", pack: "1 vial x 10 ml x 100 mg/ml", price: 103 },
    "dianabol": { name: "Dianabol 10", pack: "100 tabs x 10 mg/tab", price: 89 },
    "dro-e200": { name: "Dro E200", pack: "1 vial x 10 ml x 200 mg/ml", price: 116 },
    "dro-p100": { name: "Dro P100", pack: "1 vial x 10 ml x 100 mg/ml", price: 114 },
    "halotestin": { name: "Halotestin", pack: "50 tabs x 10 mg/tab", price: 82 },
    "m1t": { name: "Methyl1test", pack: "100 tabs x 10 mg", price: 149 },
    "ment100": { name: "Ment 100", pack: "1 vial x 10 ml x 100 mg/ml", price: 217 },
    "methyltren": { name: "Methyltren", pack: "100 tabs x 1 mg/tab", price: 158 },
    "nan-d300": { name: "NAN D300", pack: "1 vial x 10ml x 300 mg/ml", price: 97 },
    "nan-p100": { name: "Nan P100", pack: "1 vial x 10ml x 100 mg/ml", price: 82 },
    "NMIX300": { name: "NMIX300", pack: "1 vial x 10 ml x 300 mg/ml", price: 97 },
    "oxyme50": { name: "Oxyme 50", pack: "1 vial x 10 ml x 50 mg/ml", price: 89 },
    "prim-e100": { name: "Prim E100", pack: "1 vial x 10ml x 100 mg/ml", price: 169 },
    "prim-e200": { name: "Prim E200", pack: "1 vial x 10ml x 200 mg/ml", price: 199 },
    "primo25": { name: "Primo 25", pack: "100 tabs x 25 mg/tab", price: 139 },
    "proviron": { name: "Proviron", pack: "100 tabs x 50 mg/tab", price: 139 },
    "stan-s100": { name: "Stan S100", pack: "1 vial x 10 ml x 100 mg/ml", price: 75 },
    "stano10": { name: "Stano 10", pack: "100 tabs x 10 mg/tab", price: 89 },
    "stenbo": { name: "Stenbo", pack: "50 tabs x 10 mg/tab", price: 99 },
    "superdrol": { name: "Superdrol", pack: "100 tabs x 10 mg/tab", price: 76 },
    "test-b300": { name: "Test B300 (Sustanon)", pack: "1 vial x 10ml x 300 mg/ml", price: 89 },
    "test-c300": { name: "TEST C300", pack: "1 vial x 10 ml x 300 mg/ml", price: 94 },
    "test-e300": { name: "TEST E300", pack: "1 vial x 10 ml x 300 mg/ml", price: 94 },
    "test-p100": { name: "TEST P100", pack: "1 vial x 10 ml x 100 mg/ml", price: 67 },
    "test-s100": { name: "TEST S100", pack: "1 vial x 10 ml x 100 mg/ml", price: 81 },
    "testocream": { name: "Testocream 20%", pack: "1 bottle x 120 gms", price: 211 },
    "testos": { name: "Testos", pack: "50 tabs x 50 mg/tab", price: 89 },
    "tmix200": { name: "Tmix 200", pack: "1 vial x 10 ml x 200 mg/ml", price: 187 },
    "tren-a100": { name: "Tren A100", pack: "1 vial x 10ml x 100 mg/ml", price: 95 },
    "tren-e200": { name: "Tren E200", pack: "1 vial x 10 ml x 200 mg/ml", price: 110 },
    "tren-h-150": { name: "Tren H150", pack: "1 vial x 10ml x 150 mg/ml", price: 152 },
    "turinabol": { name: "Turinabol", pack: "100 tabs x 10 mg/tab", price: 79 },
    "test-c250": { name: "TEST C250", pack: "", price: null },
    "test-e250": { name: "TEST E250", pack: "", price: null }
  };

  // ---------- Admin overrides (price, name, stock, visibility, contact details) ----------
  var CMS = window.CMS || {};
  var CFG = CMS.config || {};
  (function applyOverrides() {
    var snap = CMS.snap || {}, po = snap.products || {}, st = snap.settings || {};
    Object.keys(po).forEach(function (slug) {
      var o = po[slug], p = PRODUCTS[slug];
      if (!p || !o) return;
      if (Object.prototype.hasOwnProperty.call(o, "price")) p.price = (o.price === null || o.price === "") ? null : Number(o.price);
      if (o.cartName) p.name = o.cartName; else if (o.name) p.name = o.name;
      if (o.cartPack != null && o.cartPack !== "") p.pack = o.cartPack;
      if (o.soldout) p.soldout = true;
      if (o.hidden) p.hidden = true;
    });
    var oc = st.orders || {};
    if (oc.email) ORDER_EMAIL = oc.email;
    if (oc.whatsapp) ORDER_WHATSAPP = oc.whatsapp;
  })();

  var KEY = "atechlab_cart_v1";
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var ROOT = scriptSrc.replace(/static\/js\/cart\.js.*$/, "");

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    updateBadge();
  }
  function money(n) { return "$" + n.toFixed(2); }
  function count(c) { var n = 0; for (var k in c) n += c[k]; return n; }

  function updateBadge() {
    var n = count(load());
    var els = document.querySelectorAll("[data-cart-count]");
    for (var i = 0; i < els.length; i++) els[i].textContent = n;
  }

  function add(slug, qty) {
    if (!PRODUCTS[slug] || PRODUCTS[slug].price == null) return;
    var c = load();
    c[slug] = Math.min(99, (c[slug] || 0) + (qty || 1));
    save(c);
  }

  // ---------- Product pages: price and add button ----------
  function renderBuyBlocks() {
    var blocks = document.querySelectorAll("[data-buy]");
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i], slug = b.getAttribute("data-buy"), p = PRODUCTS[slug];
      if (!p) continue;
      if (p.soldout) {
        b.innerHTML = '<div class="fw-bold fs-24 mb-3">' + (p.price == null ? "" : money(p.price) + ' <span class="fw-light fs-14">USD</span> ') + '</div>' +
          '<div class="fw-bold mb-3">Out of stock</div>' +
          '<a class="btn btn-outline-dark" href="' + ROOT + 'cart.html">View cart</a>';
        continue;
      }
      if (p.price == null) {
        b.innerHTML = '<div class="fw-bold fs-24 mb-3">Contact for price</div>' +
          '<a class="btn btn-dark" href="' + ROOT + 'cart.html">View cart</a>';
        continue;
      }
      b.innerHTML =
        '<div class="fw-bold fs-24 mb-3">' + money(p.price) + ' <span class="fw-light fs-14">USD</span></div>' +
        '<div class="d-flex align-items-center gap-3 flex-wrap">' +
        '<input type="number" min="1" max="99" value="1" class="form-control" style="width:80px" aria-label="Quantity">' +
        '<button type="button" class="btn btn-dark">Add to cart</button>' +
        '<a class="btn btn-outline-dark" href="' + ROOT + 'cart.html">View cart</a>' +
        '</div><div class="small mt-2" data-buy-msg></div>';
      (function (block, s) {
        block.querySelector("button").addEventListener("click", function () {
          var q = parseInt(block.querySelector("input").value, 10);
          if (!(q > 0)) q = 1;
          add(s, q);
          block.querySelector("[data-buy-msg]").textContent = "Added to cart.";
        });
      })(b, slug);
    }
  }

  // ---------- Catalog and category cards: show price ----------
  function renderCardPrices() {
    var cards = document.querySelectorAll('a.card[href*="product/"]');
    for (var i = 0; i < cards.length; i++) {
      var m = cards[i].getAttribute("href").match(/product\/([^\/]+)\.html/);
      if (!m || !PRODUCTS[m[1]]) continue;
      var p = PRODUCTS[m[1]], el = document.createElement("p");
      el.className = "fw-bold mb-0";
      el.textContent = p.soldout ? "Out of stock" : (p.price == null ? "Contact for price" : money(p.price));
      cards[i].appendChild(el);
    }
  }

  // ---------- Cart page ----------
  function renderCart() {
    var root = document.getElementById("cart-root");
    if (!root) return;
    var c = load(), slugs = Object.keys(c).filter(function (s) { return PRODUCTS[s] && PRODUCTS[s].price != null && !PRODUCTS[s].hidden && !PRODUCTS[s].soldout && c[s] > 0; });
    if (!slugs.length) {
      root.innerHTML = '<p class="fs-20">Your cart is empty.</p><a class="btn btn-dark" href="' + ROOT + 'catalog.html">Browse products</a>';
      return;
    }
    var total = 0, rows = "";
    slugs.forEach(function (s) {
      var p = PRODUCTS[s], line = p.price * c[s]; total += line;
      rows += '<tr data-slug="' + s + '">' +
        '<td><a class="link-dark fw-semibold text-decoration-none" href="' + ROOT + 'product/' + s + '.html">' + p.name + '</a>' +
        '<div class="small text-secondary">' + p.pack + '</div></td>' +
        '<td class="text-nowrap">' + money(p.price) + '</td>' +
        '<td class="text-nowrap"><button type="button" class="btn btn-outline-dark btn-sm" data-act="dec">-</button> ' +
        '<span class="px-2">' + c[s] + '</span> ' +
        '<button type="button" class="btn btn-outline-dark btn-sm" data-act="inc">+</button></td>' +
        '<td class="text-nowrap fw-semibold">' + money(line) + '</td>' +
        '<td><button type="button" class="btn btn-link link-dark btn-sm" data-act="rm">Remove</button></td></tr>';
    });
    root.innerHTML =
      '<div class="table-responsive"><table class="table align-middle"><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="d-flex justify-content-end fs-20 fw-bold mb-1">Subtotal: ' + money(total) + ' USD</div>' +
      '<div class="d-flex justify-content-end small text-secondary mb-5">Shipping is confirmed when we reply to your order.</div>' +
      '<h5 class="mb-3">Your details</h5>' +
      '<div class="row g-3 mb-4">' +
      '<div class="col-md-6"><input id="f-name" class="form-control" placeholder="Full name"></div>' +
      '<div class="col-md-6"><input id="f-phone" class="form-control" placeholder="Phone number"></div>' +
      '<div class="col-12"><input id="f-email" type="email" class="form-control" placeholder="Email (optional, for your order confirmation)"></div>' +
      '<div class="col-12"><input id="f-addr" class="form-control" placeholder="Delivery address and country"></div>' +
      '<div class="col-12"><textarea id="f-note" class="form-control" rows="2" placeholder="Notes (optional)"></textarea></div></div>' +
      '<div class="d-flex flex-wrap gap-3">' +
      '<button type="button" class="btn btn-dark" id="order-wa">Order on WhatsApp</button>' +
      '<button type="button" class="btn btn-outline-dark" id="order-mail">Order by email</button>' +
      '<button type="button" class="btn btn-link link-dark" id="clear-cart">Clear cart</button></div>' +
      '<div class="small text-danger mt-3" id="order-warn"></div>';

    root.querySelectorAll("button[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var s = btn.closest("tr").getAttribute("data-slug"), cc = load(), a = btn.getAttribute("data-act");
        if (a === "inc") cc[s] = Math.min(99, cc[s] + 1);
        if (a === "dec") cc[s] = cc[s] - 1;
        if (a === "rm" || cc[s] <= 0) delete cc[s];
        save(cc); renderCart();
      });
    });
    document.getElementById("clear-cart").addEventListener("click", function () { save({}); renderCart(); });

    function message() {
      var cc = load(), t = 0, lines = [];
      slugs.forEach(function (s) {
        if (!cc[s]) return;
        var p = PRODUCTS[s], l = p.price * cc[s]; t += l;
        lines.push(cc[s] + " x " + p.name + (p.pack ? " (" + p.pack + ")" : "") + " - " + money(l));
      });
      var v = function (id) { return (document.getElementById(id).value || "").trim(); };
      return "New order\n\n" + lines.join("\n") + "\n\nSubtotal: " + money(t) + " USD (shipping not included)\n\n" +
        "Name: " + v("f-name") + "\nPhone: " + v("f-phone") + (document.getElementById("f-email") && v("f-email") ? "\nEmail: " + v("f-email") : "") + "\nAddress: " + v("f-addr") + "\nNotes: " + v("f-note");
    }
    function needDetails() {
      var ok = document.getElementById("f-name").value.trim() && document.getElementById("f-phone").value.trim() && document.getElementById("f-addr").value.trim();
      document.getElementById("order-warn").textContent = ok ? "" : "Please fill in your name, phone and address first.";
      return ok;
    }
    function saveOrder(channel) {
      if (!CFG.url || !CFG.anonKey) return;
      var cc = load(), t = 0, items = [];
      slugs.forEach(function (s) {
        if (!cc[s]) return;
        var p = PRODUCTS[s], l = (p.price || 0) * cc[s]; t += l;
        items.push({ slug: s, name: p.name, pack: p.pack, qty: cc[s], price: p.price, line_total: l });
      });
      var v = function (id) { return (document.getElementById(id).value || "").trim(); };
      try {
        fetch(CFG.url.replace(/\/$/, "") + "/rest/v1/rpc/place_order", {
          method: "POST",
          keepalive: true,
          headers: { "apikey": CFG.anonKey, "Authorization": "Bearer " + CFG.anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            p_name: v("f-name"), p_phone: v("f-phone"), p_email: (document.getElementById("f-email") ? v("f-email") : ""),
            p_address: v("f-addr"), p_notes: v("f-note"), p_items: items, p_subtotal: t, p_channel: channel
          })
        }).then(function (r) { return r.ok ? r.json() : null; }).then(function (res) {
          if (res && res.id) {
            fetch("/.netlify/functions/notify", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "order", id: res.id }) }).catch(function () {});
          }
        }).catch(function () {});
      } catch (e) {}
    }
    document.getElementById("order-wa").addEventListener("click", function () {
      if (!needDetails()) return;
      saveOrder("whatsapp");
      window.open("https://wa.me/" + ORDER_WHATSAPP.replace(/\D/g, "") + "?text=" + encodeURIComponent(message()), "_blank");
    });
    document.getElementById("order-mail").addEventListener("click", function () {
      if (!needDetails()) return;
      saveOrder("email");
      window.location.href = "mailto:" + ORDER_EMAIL + "?subject=" + encodeURIComponent("New order") + "&body=" + encodeURIComponent(message());
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateBadge(); renderBuyBlocks(); renderCardPrices(); renderCart();
  });
})();
