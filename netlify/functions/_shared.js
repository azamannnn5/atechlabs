// Shared helpers for the Netlify functions. Secrets come only from environment variables.
const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

const json = (status, obj) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));

async function sb(path, opts = {}) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, {
    ...opts,
    headers: { apikey: SB_KEY, ...(SB_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + SB_KEY } : {}), "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) throw new Error("Supabase " + res.status + ": " + (typeof data === "string" ? data : JSON.stringify(data)));
  return data;
}

async function sendMail({ to, subject, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) throw new Error("RESEND_API_KEY or RESEND_FROM is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new Error("Resend " + res.status + ": " + (await res.text()));
  return res.json();
}

async function ownerEmail() {
  try {
    const rows = await sb("settings?grp=eq.orders&select=data");
    const e = rows && rows[0] && rows[0].data && rows[0].data.email;
    if (e) return e;
  } catch (e) {}
  return process.env.OWNER_EMAIL || "";
}

async function siteName() {
  try {
    const rows = await sb("settings?grp=eq.site&select=data");
    const n = rows && rows[0] && rows[0].data && rows[0].data.name;
    if (n) return n;
  } catch (e) {}
  return process.env.SITE_NAME || "A-Tech Labs";
}

module.exports = { SB_URL, SB_KEY, json, esc, isUuid, sb, sendMail, ownerEmail, siteName };
