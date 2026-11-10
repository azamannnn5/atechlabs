# A-Tech Labs: setup guide

Follow these steps in order. Each one is short.

## 1. Create the database tables
1. Open your Supabase project.
2. Click SQL editor, then New query.
3. Open the file supabase/schema.sql from this folder, copy everything, paste it in, and press Run.
4. It is safe to run twice.

## 2. Create your admin login
1. In Supabase, go to Authentication, then Users, then Add user.
2. Type your email and a password. Tick "Auto confirm user".
3. Go back to the SQL editor. Run this one line, with your own email:

   insert into public.admins (user_id, email, role)
   select id, lower(email), 'owner' from auth.users where lower(email) = lower('YOUR_EMAIL_HERE')
   on conflict (user_id) do update set role = 'owner';

   (The same lines are at the bottom of supabase/schema.sql, commented out.)

## 3. Get your Supabase keys
In Supabase, open Project Settings, then API. You need three things: the Project URL, the anon public key, and the service role key (secret).

## 4. Put the project on Netlify
1. Put this folder in a GitHub repository, or drag it into Netlify.
2. Netlify reads netlify.toml and builds it by itself. Nothing to type for the build.

## 5. Add the environment variables in Netlify
Site configuration, then Environment variables. Add these:

- SUPABASE_URL: the Project URL
- SUPABASE_ANON_KEY: the anon public key
- SUPABASE_SERVICE_ROLE_KEY: the secret service role key
- RESEND_API_KEY: from your Resend account
- RESEND_FROM: the sender, for example "A-Tech Labs <orders@yourdomain.com>" (the domain must be verified in Resend)
- OWNER_EMAIL: where order and message alerts are sent
- SITE_NAME: optional, used in emails

After adding them, press Deploy, then Trigger deploy so they are picked up.

## 6. Sign in
Open your-site.netlify.app/admin/ and sign in with the login from step 2.

## 7. Fill in the site settings
In the admin:
- Orders and contact details: the order email and the WhatsApp number.
- Tracking and chat: paste your Smartsupp key to turn on live chat.
- Products: add prices for products that show "Contact for price" (for example GHRP-2 and GHRP-6).

## How it works in one minute
- Anything you change in the admin stays unsaved until you press Save and publish at the bottom.
- If the database is ever unreachable, the site still shows its original text.
- Orders and contact messages arrive in the admin and also as an email alert.
- Backup and restore is under Site, then Backup. Every change is listed under History and can be restored.

## Not built yet
- Receiving customer emails inside the admin (Resend inbound). You can send replies from the admin.
- The anti-spam check on the contact form is unchanged from the original site.
- No shipping fee, promo codes or bulk discounts, because the site has none.
- Product order on the shop pages cannot be changed from the admin.
- Not yet tried against a real Supabase, Netlify or Resend account. It was tested with a copy of the database and a real browser.
