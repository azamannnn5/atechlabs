/* Simple cart for the A-Tech Labs site. Stores the cart in the browser (localStorage). */
(function () {
  // Order contact details now come from the admin panel (Site > Orders and contact).
  // These two are only a fallback when the database is not connected.
  var ORDER_EMAIL = "";      // example: "orders@yourdomain.com"
  var ORDER_WHATSAPP = "";   // digits only with country code, example: "237600000000"

  // Prices in USD. null = contact for price.
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
    "atechghrp2":       { name: "Atech GHRP-2", pack: "1 vial x 5 mg", price: 55, kit: { pack: "10 vials x 5 mg", price: 250 } },
    "atechghrp6":       { name: "Atech GHRP-6", pack: "1 vial x 5 mg", price: 50, kit: { pack: "10 vials x 5 mg", price: 230 } },
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
    "test-c250": { name: "TEST C250", pack: "1 vial x 10 ml x 250 mg/ml", price: 94 },
    "test-e250": { name: "TEST E250", pack: "1 vial x 10 ml x 250 mg/ml", price: 94 }
  };

  // Products sold as a single vial or as a kit: the kit gets its own cart entry, "<slug>-kit".
  Object.keys(PRODUCTS).forEach(function (slug) {
    var p = PRODUCTS[slug];
    if (p.kit) PRODUCTS[slug + "-kit"] = { name: p.name + " (Kit)", pack: p.kit.pack, price: p.kit.price, page: slug, kitOf: slug };
  });

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
      var k = PRODUCTS[slug + "-kit"];
      if (k) {
        k.name = p.name + " (Kit)";
        if (Object.prototype.hasOwnProperty.call(o, "kitPrice")) k.price = (o.kitPrice === null || o.kitPrice === "") ? null : Number(o.kitPrice);
        if (o.kitPack) k.pack = o.kitPack;
        if (o.soldout) k.soldout = true;
        if (o.hidden) k.hidden = true;
      }
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
      var variants = PRODUCTS[slug + "-kit"] ? [slug, slug + "-kit"] : [slug], html = "";
      variants.forEach(function (s, n) {
        var v = PRODUCTS[s], label = variants.length > 1 ? '<div class="fw-semibold mb-1">' + (n ? "Kit: " : "Single: ") + esc(v.pack) + '</div>' : "";
        html += '<div class="mb-4" data-variant="' + s + '">' + label;
        if (v.soldout) html += '<div class="fw-bold fs-24 mb-2">' + (v.price == null ? "" : money(v.price) + ' <span class="fw-light fs-14">USD</span> ') + '</div><div class="fw-bold">Out of stock</div>';
        else if (v.price == null) html += '<div class="fw-bold fs-24 mb-2">Contact for price</div>';
        else html += '<div class="fw-bold fs-24 mb-2">' + money(v.price) + ' <span class="fw-light fs-14">USD</span></div>' +
          '<div class="d-flex align-items-center gap-3 flex-wrap"><input type="number" min="1" max="99" value="1" class="form-control" style="width:80px" aria-label="Quantity">' +
          '<button type="button" class="btn btn-dark">Add to cart</button></div><div class="small mt-2" data-buy-msg></div>';
        html += '</div>';
      });
      html += '<a class="btn btn-outline-dark" href="' + ROOT + 'cart.html">View cart</a>';
      b.innerHTML = html;
      variants.forEach(function (s) {
        var row = b.querySelector('[data-variant="' + s + '"]'), btn = row && row.querySelector("button");
        if (!btn) return;
        btn.addEventListener("click", function () {
          var q = parseInt(row.querySelector("input").value, 10);
          if (!(q > 0)) q = 1;
          add(s, q);
          row.querySelector("[data-buy-msg]").textContent = "Added to cart.";
        });
      });
    }
  }

  // ---------- Catalog and category cards: show price ----------
  function renderCardPrices() {
    var cards = document.querySelectorAll('a.card[href*="product/"]');
    for (var i = 0; i < cards.length; i++) {
      var a = cards[i], m = a.getAttribute("href").match(/product\/([^\/]+)\.html/);
      if (!m || !PRODUCTS[m[1]] || a.parentNode.hasAttribute("data-card-wrap")) continue;
      var slug = m[1], p = PRODUCTS[slug], hasKit = !!PRODUCTS[slug + "-kit"];
      var el = document.createElement("p");
      el.className = "fw-bold mb-0";
      el.textContent = p.soldout ? "Out of stock" : (p.price == null ? "Contact for price" : (hasKit ? "From " : "") + money(p.price));
      a.appendChild(el);
      // View product and Add to cart buttons under the card (outside the link, so each button works on its own)
      var wrap = document.createElement("div"); wrap.setAttribute("data-card-wrap", "1"); wrap.className = "d-flex flex-column h-100";
      a.parentNode.insertBefore(wrap, a); wrap.appendChild(a); a.style.flex = "1 1 auto";
      var row = document.createElement("div"); row.className = "d-flex flex-wrap gap-2 mt-2";
      var view = document.createElement("a"); view.className = "btn btn-outline-dark btn-sm flex-fill"; view.href = a.getAttribute("href"); view.textContent = "View product"; row.appendChild(view);
      if (!p.soldout && p.price != null) {
        if (hasKit) {
          var opt = document.createElement("a"); opt.className = "btn btn-dark btn-sm flex-fill"; opt.href = a.getAttribute("href"); opt.textContent = "Choose option"; row.appendChild(opt);
        } else {
          var btn = document.createElement("button"); btn.type = "button"; btn.className = "btn btn-dark btn-sm flex-fill"; btn.textContent = "Add to cart";
          (function (bt, sl) {
            bt.addEventListener("click", function () {
              add(sl, 1); bt.textContent = "Added";
              setTimeout(function () { bt.textContent = "Add to cart"; }, 1500);
            });
          })(btn, slug);
          row.appendChild(btn);
        }
      }
      wrap.appendChild(row);
    }
  }

  // ---------- Cart page ----------
  var PAYMENTS = ["Bitcoin", "Apple Pay", "Chime"], CONTACTS = ["Text message", "WhatsApp"];
  var form = { name: "", phone: "", email: "", addr: "", note: "", promo: "", pay: "", contact: "" }, quote = null, promoMsg = null;
  function numOr(v, d) { var n = parseFloat(v); return isFinite(n) && v !== "" && v != null ? n : d; }
  // Same rules as the database function quote_order(). Used only when the database is not connected.
  function localQuote(sub, cnt) {
    var sh = ((CMS.snap || {}).settings || {}).shop || {}, dmin = [3, 6, 10], dmax = [5, 9, null], dpct = [5, 7, 10], bpct = 0, i;
    for (i = 1; i <= 3; i++) {
      var mn = numOr(sh["b" + i + "min"], dmin[i - 1]), mx = ("b" + i + "max") in sh ? (sh["b" + i + "max"] === "" ? null : numOr(sh["b" + i + "max"], null)) : dmax[i - 1], pc = numOr(sh["b" + i + "pct"], dpct[i - 1]);
      if (cnt >= mn && (mx == null || cnt <= mx)) bpct = pc;
    }
    var fee = numOr(sh.fee, 18), freeAt = numOr(sh.freeAt, 150), minO = numOr(sh.minOrder, 100), cap = numOr(sh.cap, 30);
    var bd = Math.round(sub * bpct) / 100, disc = cap > 0 ? Math.min(bd, Math.round(sub * cap) / 100) : bd, after = sub - disc;
    return { valid: true, message: null, subtotal: sub, count: cnt, bulk_pct: bpct, bulk_discount: bd, code: null, code_discount: 0, discount: disc,
      shipping: (sub === 0 || after >= freeAt) ? 0 : fee, free_at: freeAt, fee: fee, min_order: minO, min_ok: sub >= minO, total: after + ((sub === 0 || after >= freeAt) ? 0 : fee) };
  }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function attr(x) { return esc(x); }

  function renderCart() {
    var root = document.getElementById("cart-root");
    if (!root) return;
    if (!document.getElementById("atl-cart-css")) {
      var st = document.createElement("style"); st.id = "atl-cart-css";
      st.textContent = "#cart-root .form-check-input{border:1px solid #111;background-color:#fff}#cart-root .form-check-input:checked{background-color:#111;border-color:#111}" +
        "@media (max-width:640px){" +
        ".atl-cart thead{display:none}.atl-cart,.atl-cart tbody{display:block;width:100%}" +
        ".atl-cart tr{display:grid;grid-template-columns:1fr auto;grid-template-areas:'name name' 'price qty' 'total rm';gap:8px 12px;align-items:center;padding:14px 0;border-bottom:1px solid rgba(0,0,0,.2)}" +
        ".atl-cart td{display:block;padding:0!important;border:0!important;min-width:0}" +
        ".atl-cart td:nth-child(1){grid-area:name}.atl-cart td:nth-child(2){grid-area:price}.atl-cart td:nth-child(3){grid-area:qty;justify-self:end}" +
        ".atl-cart td:nth-child(4){grid-area:total}.atl-cart td:nth-child(5){grid-area:rm;justify-self:end}}";
      document.head.appendChild(st);
    }
    var c = load(), slugs = Object.keys(c).filter(function (s) { return PRODUCTS[s] && PRODUCTS[s].price != null && !PRODUCTS[s].hidden && !PRODUCTS[s].soldout && c[s] > 0; });
    if (!slugs.length) {
      root.innerHTML = '<p class="fs-20">Your cart is empty.</p><a class="btn btn-dark" href="' + ROOT + 'catalog.html">Browse products</a>';
      return;
    }
    quote = null;
    var total = 0, qtyAll = 0, rows = "";
    slugs.forEach(function (s) {
      var p = PRODUCTS[s], line = p.price * c[s]; total += line; qtyAll += c[s];
      rows += '<tr data-slug="' + s + '">' +
        '<td><a class="link-dark fw-semibold text-decoration-none" href="' + ROOT + 'product/' + (p.page || s) + '.html">' + esc(p.name) + '</a>' +
        '<div class="small text-secondary">' + p.pack + '</div></td>' +
        '<td class="text-nowrap">' + money(p.price) + '</td>' +
        '<td class="text-nowrap"><button type="button" class="btn btn-outline-dark btn-sm" data-act="dec">-</button> ' +
        '<span class="px-2">' + c[s] + '</span> ' +
        '<button type="button" class="btn btn-outline-dark btn-sm" data-act="inc">+</button></td>' +
        '<td class="text-nowrap fw-semibold">' + money(line) + '</td>' +
        '<td><button type="button" class="btn btn-link link-dark btn-sm" data-act="rm">Remove</button></td></tr>';
    });
    var live = !!(CFG.url && CFG.anonKey);
    function radios(name, list) {
      return list.map(function (o, i) {
        return '<div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="' + name + '" id="' + name + '-' + i + '" value="' + o + '"' + (form[name] === o ? " checked" : "") + '>' +
          '<label class="form-check-label" for="' + name + '-' + i + '">' + o + '</label></div>';
      }).join("");
    }
    root.innerHTML =
      '<div class="table-responsive"><table class="table align-middle atl-cart"><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div id="cart-summary" class="d-flex flex-column align-items-end mb-1"></div>' +
      '<div id="cart-notes" class="d-flex flex-column align-items-end small mb-5"></div>' +
      '<h5 class="mb-3">Your details</h5>' +
      '<div class="row g-3 mb-4">' +
      '<div class="col-md-6"><input id="f-name" class="form-control" placeholder="Full name *" value="' + attr(form.name) + '"></div>' +
      '<div class="col-md-6"><input id="f-phone" class="form-control" placeholder="Phone number *" value="' + attr(form.phone) + '"></div>' +
      '<div class="col-12"><input id="f-email" type="email" class="form-control" placeholder="Email * (your invoice is sent here)" value="' + attr(form.email) + '"></div>' +
      '<div class="col-12"><input id="f-addr" class="form-control" placeholder="Delivery address and country *" value="' + attr(form.addr) + '"></div>' +
      '<div class="col-12"><div class="fw-semibold mb-1">Payment Method *</div>' + radios("pay", PAYMENTS) + '</div>' +
      '<div class="col-12"><div class="fw-semibold">How should we contact you about your order? *</div>' +
      '<div class="small text-secondary mb-1">Pick the one you\'re most active on.</div>' + radios("contact", CONTACTS) + '</div>' +
      '<div class="col-12"><div class="fw-semibold mb-1">Promo code</div>' +
      '<div class="d-flex gap-2"><input id="f-promo" class="form-control" style="max-width:260px" placeholder="Enter code" value="' + attr(form.promo) + '" autocapitalize="characters">' +
      '<button type="button" class="btn btn-outline-dark" id="promo-apply">Apply</button></div>' +
      '<div class="small mt-1" id="promo-msg"></div></div>' +
      '<div class="col-12"><textarea id="f-note" class="form-control" rows="2" placeholder="Notes (optional)">' + esc(form.note) + '</textarea></div></div>' +
      '<div class="d-flex flex-wrap gap-3">' +
      '<button type="button" class="btn btn-dark" id="order-mail">Place order</button>' +
      '<button type="button" class="btn btn-outline-dark" id="order-wa">Order on WhatsApp</button>' +
      '<button type="button" class="btn btn-link link-dark" id="clear-cart">Clear cart</button></div>' +
      '<div class="small text-danger mt-3" id="order-warn"></div>';

    function cur() { return quote || localQuote(total, qtyAll); }
    function summary() {
      var el = document.getElementById("cart-summary"); if (!el) return;
      var q = cur(), html = '<div>Subtotal: ' + money(total) + '</div>';
      if (q.bulk_discount > 0) html += '<div class="text-success">Bulk discount (' + q.bulk_pct + '% off): -' + money(q.bulk_discount) + '</div>';
      if (q.code && q.code_discount > 0) html += '<div class="text-success">Code ' + esc(q.code) + ': -' + money(q.code_discount) + '</div>';
      if (q.discount < q.bulk_discount + (q.code_discount || 0) - 0.005) html += '<div class="small text-secondary">Discounts are capped, you save ' + money(q.discount) + ' in total.</div>';
      html += '<div>Shipping: ' + (q.shipping > 0 ? money(q.shipping) : "Free") + '</div>';
      html += '<div class="fs-20 fw-bold">Total: ' + money(q.total) + ' USD</div>';
      el.innerHTML = html;
      var n = document.getElementById("cart-notes"), t = "";
      if (q.min_ok === false) t += '<div class="text-danger fw-semibold">Minimum order is ' + money(q.min_order) + '. Add ' + money(q.min_order - total) + ' more to place your order.</div>';
      else if (q.shipping > 0) t += '<div class="text-secondary">Add ' + money(Math.max(q.free_at - (total - q.discount), 0)) + ' more for free shipping.</div>';
      else t += '<div class="text-success">Free shipping on this order.</div>';
      if (qtyAll < 3) t += '<div class="text-secondary">Buy 3 or more items and save automatically: 3-5 items 5%, 6-9 items 7%, 10+ items 10%.</div>';
      if (n) n.innerHTML = t;
      var m = document.getElementById("promo-msg");
      if (m && promoMsg) { m.className = "small mt-1 " + (promoMsg.ok ? "text-success" : "text-danger"); m.textContent = promoMsg.text; }
    }
    // asks the database for the real price (bulk discount, code, shipping, total)
    function refresh() {
      var code = (document.getElementById("f-promo").value || "").trim(); form.promo = code;
      if (!live) { quote = null; promoMsg = code ? { ok: false, text: "Promo codes are not available right now." } : null; summary(); return; }
      var items = cartItems();
      fetch(CFG.url.replace(/\/$/, "") + "/rest/v1/rpc/quote_order", {
        method: "POST", headers: { "apikey": CFG.anonKey, "Authorization": "Bearer " + CFG.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_items: items.list, p_subtotal: items.total, p_code: code, p_email: form.email })
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (res) {
        if (!res) throw new Error("no quote");
        quote = res;
        promoMsg = !code ? null : (res.valid && res.code ? { ok: true, text: "Code applied." } : { ok: false, text: res.message || "This promo code is not valid." });
        summary();
      }).catch(function () { if (code) promoMsg = { ok: false, text: "Could not check the code. Try again." }; summary(); });
    }
    function cartItems() {
      var cc = load(), t = 0, list = [];
      slugs.forEach(function (s) {
        if (!cc[s]) return;
        var p = PRODUCTS[s], l = (p.price || 0) * cc[s]; t += l;
        list.push({ slug: s, name: p.name, pack: p.pack, qty: cc[s], price: p.price, line_total: l });
      });
      return { list: list, total: t };
    }
    summary();
    if (live) refresh();
    document.getElementById("promo-apply").addEventListener("click", refresh);
    root.addEventListener("input", function (e) {
      var m = { "f-name": "name", "f-phone": "phone", "f-email": "email", "f-addr": "addr", "f-note": "note", "f-promo": "promo" }[e.target.id];
      if (m) form[m] = e.target.value;
    });
    root.addEventListener("change", function (e) {
      if (e.target.name === "pay" || e.target.name === "contact") form[e.target.name] = e.target.value;
      if (e.target.id === "f-email" && form.promo) refresh();
    });

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
      var ci = cartItems(), lines = ci.list.map(function (i) { return i.qty + " x " + i.name + (i.pack ? " (" + i.pack + ")" : "") + " - " + money(i.line_total); });
      var v = function (id) { return (document.getElementById(id).value || "").trim(); }, q = cur();
      return "New order\n\n" + lines.join("\n") + "\n\nSubtotal: " + money(ci.total) +
        (q.bulk_discount > 0 ? "\nBulk discount (" + q.bulk_pct + "%): -" + money(q.bulk_discount) : "") +
        (q.code && q.code_discount > 0 ? "\nCode " + q.code + ": -" + money(q.code_discount) : "") +
        "\nShipping: " + (q.shipping > 0 ? money(q.shipping) : "Free") + "\nTotal: " + money(q.total) + " USD\n\n" +
        "Name: " + v("f-name") + "\nPhone: " + v("f-phone") + "\nEmail: " + v("f-email") + "\nAddress: " + v("f-addr") +
        "\nPayment method: " + form.pay + "\nContact me by: " + form.contact + "\nNotes: " + v("f-note");
    }
    function needDetails() {
      var v = function (id) { return document.getElementById(id).value.trim(); }, msg = "";
      if (!v("f-name") || !v("f-phone") || !v("f-addr")) msg = "Please fill in your name, phone and address first.";
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("f-email"))) msg = "Please enter a valid email. Your invoice is sent there.";
      else if (!form.pay) msg = "Please choose a payment method.";
      else if (!form.contact) msg = "Please choose how we should contact you.";
      else if (cur().min_ok === false) msg = "The minimum order is " + money(cur().min_order) + ".";
      document.getElementById("order-warn").textContent = msg;
      return !msg;
    }
    function saveOrder(channel) {
      var ci = cartItems(), t = ci.total, items = ci.list;
      var v = function (id) { return (document.getElementById(id).value || "").trim(); };
      return fetch(CFG.url.replace(/\/$/, "") + "/rest/v1/rpc/place_order", {
        method: "POST",
        keepalive: true,
        headers: { "apikey": CFG.anonKey, "Authorization": "Bearer " + CFG.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_name: v("f-name"), p_phone: v("f-phone"), p_email: v("f-email"),
          p_address: v("f-addr"), p_notes: v("f-note"), p_items: items, p_subtotal: t, p_channel: channel,
          p_payment: form.pay, p_contact_method: form.contact, p_promo: form.promo
        })
      }).then(function (r) { if (!r.ok) throw new Error("save failed"); return r.json(); }).then(function (res) {
        if (res && res.id) {
          fetch("/.netlify/functions/notify", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "order", id: res.id }) }).catch(function () {});
        }
        return res;
      });
    }
    function done(res) {
      var email = form.email, contact = form.contact, pay = form.pay;
      save({}); quote = null;
      root.innerHTML = '<div class="py-4"><h4 class="mb-3">Thank you, your order is placed.</h4>' +
        '<p class="fs-20">Order #' + esc(res && res.order_no) + (res && res.total != null ? " - total " + money(Number(res.total)) + " USD" : "") + '</p>' +
        (res && res.instructions ? '<div class="border border-2 border-dark p-3 mb-3"><div class="fw-bold mb-1">How to pay with ' + esc(pay) + '</div><div style="white-space:pre-wrap">' + esc(res.instructions) + '</div></div>' : '') +
        '<p>An invoice was sent to ' + esc(email) + '. Check your spam folder if you do not see it. We will contact you by ' + esc(contact.toLowerCase()) + ' to confirm your order.</p>' +
        '<a class="btn btn-dark" href="' + ROOT + 'catalog.html">Keep browsing</a></div>';
      updateBadge();
    }
    function busy(on) { ["order-wa", "order-mail"].forEach(function (id) { var b = document.getElementById(id); if (b) b.disabled = on; }); }
    function fail() { busy(false); document.getElementById("order-warn").textContent = "We could not place the order. Please try again, or contact us at the email in the footer."; }
    document.getElementById("order-wa").addEventListener("click", function () {
      if (!needDetails()) return;
      var url = "https://wa.me/" + ORDER_WHATSAPP.replace(/\D/g, "") + "?text=" + encodeURIComponent(message());
      if (!live) { window.open(url, "_blank"); return; }
      var w = window.open("", "_blank"); busy(true);
      saveOrder("whatsapp").then(function (res) { if (w) w.location.href = url; done(res); }).catch(function () { if (w) w.close(); fail(); });
    });
    document.getElementById("order-mail").addEventListener("click", function () {
      if (!needDetails()) return;
      if (!live) { window.location.href = "mailto:" + ORDER_EMAIL + "?subject=" + encodeURIComponent("New order") + "&body=" + encodeURIComponent(message()); return; }
      busy(true);
      saveOrder("email").then(done).catch(fail);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateBadge(); renderBuyBlocks(); renderCardPrices(); renderCart();
  });
})();
