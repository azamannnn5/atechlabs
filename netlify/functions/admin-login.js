// Password-only admin sign in. The password is the ADMIN_PASSWORD variable in Netlify.
// On a correct password this signs in the owner account (OWNER_EMAIL) and hands the browser a normal session,
// so the rest of the admin keeps working with the database rules as before.
const crypto = require("crypto");
const { SB_URL, SB_KEY, json, sb } = require("./_shared");

const same = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

async function auth(path, body) {
  const res = await fetch(SB_URL + "/auth/v1" + path, {
    method: "POST",
    headers: { apikey: SB_KEY, ...(SB_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + SB_KEY } : {}), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  const expected = process.env.ADMIN_PASSWORD;
  const email = String(process.env.OWNER_EMAIL || "").trim().toLowerCase();
  if (!expected) return json(503, { error: "ADMIN_PASSWORD is not set in Netlify." });
  if (!email) return json(503, { error: "OWNER_EMAIL is not set in Netlify." });
  if (!SB_URL || !SB_KEY) return json(503, { error: "The database keys are not set in Netlify." });
  let password;
  try { password = JSON.parse(event.body || "{}").password; } catch (e) { return json(400, { error: "bad request" }); }
  if (!password || !same(password, expected)) {
    await new Promise((r) => setTimeout(r, 800));
    return json(401, { error: "Wrong password." });
  }
  try {
    // make sure the owner account exists (a 422 means it already does)
    const made = await auth("/admin/users", { email, email_confirm: true });
    if (!made.ok && made.status !== 422) throw new Error("create user " + made.status + " " + JSON.stringify(made.data));
    const link = await auth("/admin/generate_link", { type: "magiclink", email });
    const hashed = link.data && (link.data.hashed_token || (link.data.properties && link.data.properties.hashed_token));
    if (!link.ok || !hashed) throw new Error("link " + link.status + " " + JSON.stringify(link.data));
    const ses = await auth("/verify", { type: "magiclink", token_hash: hashed });
    if (!ses.ok || !ses.data || !ses.data.access_token) throw new Error("verify " + ses.status + " " + JSON.stringify(ses.data));
    await sb("admins?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: ses.data.user.id, email, role: "owner" }),
    });
    const { access_token, refresh_token, expires_in, user } = ses.data;
    return json(200, { access_token, refresh_token, expires_in, user });
  } catch (e) {
    console.error(e);
    return json(500, { error: "Could not sign in.", detail: String(e && e.message || e).slice(0, 300) });
  }
};
