// Called by the website right after an order or contact message is saved.
// Reads the saved row by id (never trusts the browser's text) and emails the owner via Resend.
const { json, esc, isUuid, sb, sendMail, ownerEmail, siteName } = require("./_shared");

const money = (n) => "$" + Number(n || 0).toFixed(2);

// Emails the one-time welcome code to someone who signed up in the popup. Sent once per address.
async function welcome(rawEmail) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return json(400, { error: "bad email" });
  try {
    const rows = await sb("subscribers?email=eq." + encodeURIComponent(email) + "&select=*");
    const sub = rows && rows[0];
    if (!sub) return json(404, { error: "not signed up" });
    if (sub.welcome_sent_at) return json(200, { ok: true, skipped: "already sent" });
    if (Date.now() - new Date(sub.created_at).getTime() > 15 * 60 * 1000) return json(200, { ok: true, skipped: "too old" });
    const claimed = await sb("subscribers?email=eq." + encodeURIComponent(email) + "&welcome_sent_at=is.null", {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ welcome_sent_at: new Date().toISOString() }),
    });
    if (!claimed || !claimed.length) return json(200, { ok: true, skipped: "already sent" });
    let w = {};
    try { const r = await sb("settings?grp=eq.welcome&select=data"); w = (r && r[0] && r[0].data) || {}; } catch (e) {}
    const code = String(w.code || "STRONG26").trim().toUpperCase();
    const pct = Number(w.pct) > 0 ? Number(w.pct) : 10;
    const name = await siteName();
    const to = await ownerEmail();
    await sendMail({
      to: email,
      replyTo: to || undefined,
      subject: `Your ${pct}% off code - ${name}`,
      html: `<p>Thanks for signing up to ${esc(name)}.</p><p>Your one-time code for ${pct}% off your first order:</p>` +
        `<p style="font-size:24px;font-weight:bold;letter-spacing:2px;border:2px dashed #999;padding:14px;text-align:center;max-width:360px">${esc(code)}</p>` +
        `<p>Enter it in the Promo code box in your cart. One use per email address.</p><p>${esc(name)}</p>`,
    });
    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(500, { error: "could not send" });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "bad json" }); }
  const { type, id } = body;
  if (type === "welcome") return welcome(body.email);
  if (!isUuid(id) || !["order", "message"].includes(type)) return json(400, { error: "bad request" });

  try {
    const table = type === "order" ? "orders" : "messages";
    const rows = await sb(table + "?id=eq." + id + "&select=*");
    const row = rows && rows[0];
    if (!row) return json(404, { error: "not found" });
    if (row.notified_at) return json(200, { ok: true, skipped: "already sent" });
    if (Date.now() - new Date(row.created_at).getTime() > 15 * 60 * 1000) return json(200, { ok: true, skipped: "too old" });

    // claim it first so double calls cannot send twice
    const claimed = await sb(table + "?id=eq." + id + "&notified_at=is.null", {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ notified_at: new Date().toISOString() }),
    });
    if (!claimed || !claimed.length) return json(200, { ok: true, skipped: "already sent" });

    const to = await ownerEmail();
    const name = await siteName();
    if (!to) return json(200, { ok: true, skipped: "no owner email set" });

    if (type === "order") {
      const items = Array.isArray(row.items) ? row.items : [];
      const th = 'style="text-align:left;padding:6px 10px;border-bottom:1px solid #ccc"';
      const td = 'style="padding:6px 10px;border-bottom:1px solid #eee"';
      const rowsHtml = items.map((i) => `<tr><td ${td}>${esc(i.name)}${i.pack ? "<br><small>" + esc(i.pack) + "</small>" : ""}</td><td ${td}>${esc(i.qty)}</td><td ${td}>${money(i.price)}</td><td ${td}>${money(i.line_total)}</td></tr>`).join("");
      const disc = Number(row.discount || 0);
      const ship = Number(row.shipping || 0);
      const total = row.total != null ? Number(row.total) : Number(row.subtotal || 0) - disc + ship;
      let instr = "";
      try {
        const r = await sb("settings?grp=eq.payments&select=data");
        const d = (r && r[0] && r[0].data) || {};
        instr = String(d[{ "Bitcoin": "bitcoin", "Apple Pay": "applepay", "Chime": "chime" }[row.payment_method]] || "").trim();
      } catch (e) {}
      const invoice =
        `<h2 style="margin:0 0 4px">Invoice for order #${esc(row.order_no)}</h2>` +
        `<p style="margin:0 0 16px;color:#555">${esc(name)} - ${esc(new Date(row.created_at).toUTCString())}</p>` +
        `<table style="border-collapse:collapse;width:100%;max-width:640px"><thead><tr><th ${th}>Item</th><th ${th}>Qty</th><th ${th}>Price</th><th ${th}>Total</th></tr></thead><tbody>${rowsHtml}</tbody></table>` +
        `<p style="margin:12px 0 0">Subtotal: ${money(row.subtotal)}<br>` +
        (disc > 0 ? `Discount${row.discount_note ? " (" + esc(row.discount_note) + ")" : ""}: -${money(disc)}<br>` : "") +
        `Shipping: ${ship > 0 ? money(ship) : "Free"}<br>` +
        `<b style="font-size:18px">Total: ${money(total)} USD</b></p>` +
        `<p style="margin:16px 0 0"><b>Payment method:</b> ${esc(row.payment_method || "-")}<br>` +
        `<b>Contact by:</b> ${esc(row.contact_method || "-")}<br>` +
        `<b>Name:</b> ${esc(row.customer_name)}<br><b>Phone:</b> ${esc(row.phone)}<br><b>Email:</b> ${esc(row.email || "-")}<br>` +
        `<b>Address:</b> ${esc(row.address)}<br><b>Notes:</b> ${esc(row.notes || "-")}<br><b>Sent via:</b> ${esc(row.channel || "-")}</p>`;
      const payBlock = instr
        ? `<div style="border:2px solid #111;padding:12px 14px;margin:16px 0;max-width:640px"><b>How to pay with ${esc(row.payment_method)}</b><br><span style="white-space:pre-wrap">${esc(instr)}</span></div>`
        : "";
      await sendMail({
        to,
        replyTo: row.email || undefined,
        subject: `New order #${row.order_no} from ${row.customer_name}`,
        html: invoice,
      });
      if (row.email) {
        try {
          await sendMail({
            to: row.email,
            replyTo: to,
            subject: `Your invoice for order #${row.order_no}`,
            html: `<p>Hi ${esc(row.customer_name)},</p><p>Thank you for your order. This is your invoice. We will contact you by ${esc(String(row.contact_method || "").toLowerCase() || "your chosen method")} to confirm your order.</p>` + payBlock + invoice + `<p>${esc(name)}</p>`,
          });
        } catch (e) { /* the owner copy already went out */ }
      }
    } else {
      await sendMail({
        to,
        replyTo: row.email,
        subject: `New message from ${row.name}`,
        html: `<h2>New contact message</h2><p><b>From:</b> ${esc(row.name)} (${esc(row.email)})<br><b>Page:</b> ${esc(row.page || "-")}</p><p style="white-space:pre-wrap">${esc(row.message)}</p><p>Reply to this email to answer the customer, or use the Messages screen in the admin.</p>`,
      });
    }
    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(500, { error: "could not send" });
  }
};
