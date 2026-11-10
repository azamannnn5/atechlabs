/* Admin boot: login, access checks, then the app. */
(function () {
  "use strict";
  var h = A.h, $ = A.$;
  var app = $("#app");

  function box(title, text, kids) {
    A.clear(app);
    app.appendChild(h("div", { class: "center" }, h("div", { class: "box" }, h("h1", null, title), text ? h("p", null, text) : null, kids)));
  }
  function problem(title, text, extra) { box(title, text, [extra || null, h("div", { class: "row", style: { marginTop: "12px" } }, h("button", { class: "btn", onclick: function () { location.reload(); } }, "Try again"), A.session ? h("button", { class: "btn", onclick: A.signOut }, "Sign out") : null)]); }

  function loginView(msg) {
    var email = h("input", { type: "email", id: "email", autocomplete: "username" }), pw = h("input", { type: "password", id: "password", autocomplete: "current-password" });
    var err = h("div", { class: "msg err", style: { display: msg ? "" : "none" } }, msg || "");
    var go = async function () {
      err.style.display = "none"; btn.disabled = true;
      try { await A.signIn(email.value.trim(), pw.value); await start(); }
      catch (e) { err.textContent = e.status === 400 || e.status === 401 || /invalid/i.test(e.message) ? "Wrong email or password." : e.message; err.style.display = ""; btn.disabled = false; }
    };
    var btn = h("button", { class: "btn pri", id: "login", style: { marginTop: "16px", width: "100%", justifyContent: "center" }, onclick: go }, "Sign in");
    [email, pw].forEach(function (i) { i.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); }); });
    var forgot = h("button", { class: "link", style: { marginTop: "12px" }, onclick: async function () {
      if (!email.value.trim()) { err.textContent = "Type your email first, then press Forgot password."; err.style.display = ""; return; }
      try { await A.recover(email.value.trim()); err.className = "msg ok"; err.textContent = "If that email has an account, a reset link is on its way."; err.style.display = ""; } catch (e) { err.className = "msg err"; err.textContent = e.message; err.style.display = ""; }
    } }, "Forgot password?");
    box("Sign in", "A-Tech Labs admin", [err, h("label", { class: "lbl" }, "Email"), email, h("label", { class: "lbl" }, "Password"), pw, btn, forgot]);
  }

  function newPasswordView(token) {
    var pw = h("input", { type: "password", id: "newpw" }), err = h("div", { class: "msg err", style: { display: "none" } });
    box("Choose a new password", "Enter a new password for your admin login.", [err, h("label", { class: "lbl" }, "New password"), pw,
      h("button", { class: "btn pri", style: { marginTop: "16px" }, onclick: async function () {
        if (pw.value.length < 8) { err.textContent = "Use at least 8 characters."; err.style.display = ""; return; }
        try { await A.setPassword(pw.value, token); box("Password changed", "You can now sign in with the new password.", h("button", { class: "btn pri", onclick: function () { loginView(); } }, "Go to sign in")); } catch (e) { err.textContent = e.message; err.style.display = ""; }
      } }, "Save password")]);
  }

  async function start() {
    box("Loading", "Checking your access...");
    var rows;
    try { rows = await A.rest("GET", "admins?user_id=eq." + A.session.user.id + "&select=role,email"); }
    catch (e) {
      if (e.status === 401 || /JWT|expired/i.test(e.message)) { A.session = null; try { localStorage.removeItem("atl_admin_session"); } catch (x) {} return loginView("Your session ended. Please sign in again."); }
      if (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache|Could not find the table/i.test(e.message))
        return problem("The database is not set up yet", "The tables are missing. Open Supabase > SQL editor, paste the contents of supabase/schema.sql and press Run, then try again.");
      return problem("Could not reach the database", e.message);
    }
    if (!rows || !rows.length) return problem("No admin access", "You are signed in as " + A.session.user.email + " but this account has not been added as an admin. Run the first owner line from the setup guide, or ask the owner to add you under Team.");
    A.role = rows[0].role; A.user = { id: A.session.user.id, email: A.session.user.email };
    try { await A.loadDefaults(); await A.loadDb(); } catch (e) { return problem("Could not load the site data", e.message); }
    A.mount();
    A.render();
  }

  (async function () {
    if (!A.configured) return box("Not connected yet", "This admin needs the Supabase URL and anon key. They come from the SUPABASE_URL and SUPABASE_ANON_KEY environment variables on Netlify (set them, then redeploy). See the setup guide.");
    var rec = A.adoptRecoveryHash();
    if (rec) return newPasswordView(rec);
    if (!A.session) return loginView();
    start();
  })();
})();
