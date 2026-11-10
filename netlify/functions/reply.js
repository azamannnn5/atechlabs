// Lets a signed in admin (editor or higher) email a customer from the admin panel.
const { SB_URL, SB_KEY, json, esc, isUuid, sb, sendMail, ownerEmail, siteName } = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "sign in first" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "bad json" }); }
  const { type, id, subject, message } = body;
  if (!isUuid(id) || !["order", "message"].includes(type) || !subject || !message) return json(400, { error: "bad request" });
  if (String(message).length > 8000 || String(subject).length > 200) return json(400, { error: "too long" });

  try {
    const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
    if (!u.ok) return json(401, { error: "invalid session" });
    const user = await u.json();
    const adm = await sb("admins?user_id=eq." + user.id + "&select=role");
    const role = adm && adm[0] && adm[0].role;
    if (!["owner", "admin", "editor"].includes(role)) return json(403, { error: "not allowed" });

    const table = type === "order" ? "orders" : "messages";
    const rows = await sb(table + "?id=eq." + id + "&select=*");
    const row = rows && rows[0];
    if (!row) return json(404, { error: "not found" });
    const to = row.email;
    if (!to) return json(400, { error: "this customer left no email" });

    const owner = await ownerEmail();
    const name = await siteName();
    await sendMail({
      to, replyTo: owner || undefined, subject,
      html: `<div style="white-space:pre-wrap">${esc(message)}</div><p>${esc(name)}</p>`,
    });
    if (type === "message") await sb("messages?id=eq." + id, { method: "PATCH", body: JSON.stringify({ replied_at: new Date().toISOString(), status: "done" }) });
    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(500, { error: "could not send" });
  }
};
