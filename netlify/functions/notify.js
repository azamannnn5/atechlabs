// Called by the website right after an order or contact message is saved.
// Reads the saved row by id (never trusts the browser's text) and emails the owner via Resend.
const { json, esc, isUuid, sb, sendMail, ownerEmail, siteName } = require("./_shared");

const money = (n) => "$" + Number(n || 0).toFixed(2);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "bad json" }); }
  const { type, id } = body;
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
      const lines = items.map((i) => `<li>${esc(i.qty)} x ${esc(i.name)}${i.pack ? " (" + esc(i.pack) + ")" : ""} - ${money(i.line_total)}</li>`).join("");
      await sendMail({
        to,
        replyTo: row.email || undefined,
        subject: `New order #${row.order_no} from ${row.customer_name}`,
        html: `<h2>New order #${esc(row.order_no)}</h2><ul>${lines}</ul><p><b>Subtotal:</b> ${money(row.subtotal)} (shipping not included)</p>` +
          `<p><b>Name:</b> ${esc(row.customer_name)}<br><b>Phone:</b> ${esc(row.phone)}<br><b>Email:</b> ${esc(row.email || "-")}<br><b>Address:</b> ${esc(row.address)}<br><b>Notes:</b> ${esc(row.notes || "-")}<br><b>Sent via:</b> ${esc(row.channel || "-")}</p>`,
      });
      if (row.email) {
        try {
          await sendMail({
            to: row.email,
            replyTo: to,
            subject: `We received your order #${row.order_no}`,
            html: `<p>Hi ${esc(row.customer_name)},</p><p>Thank you. We received your order #${esc(row.order_no)} and will contact you shortly to confirm shipping and payment.</p><ul>${lines}</ul><p>Subtotal: ${money(row.subtotal)} (shipping not included)</p><p>${esc(name)}</p>`,
          });
        } catch (e) { /* customer copy is a bonus */ }
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
