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
- RESEND_FROM: the sender, for example "A-Tech Labs <orders@atech-labs.com>". In Resend, add and verify the domain atech-labs.com first (Domains, then follow the DNS steps), or emails will not send
- OWNER_EMAIL: contact@atech-labs.com (where order invoices and message alerts are sent)
- SITE_NAME: optional, used in emails

After adding them, press Deploy, then Trigger deploy so they are picked up.

## 6. Sign in
Open your-site.netlify.app/admin/ and sign in with the login from step 2.

## 7. Fill in the site settings
In the admin:
- Orders and contact details: the order email (contact@atech-labs.com) and the WhatsApp number.
- Payment instructions (Site): your Bitcoin address, Apple Pay number and Chime tag. Customers see the one for their method after ordering and in their invoice email.
- Shipping and discounts (Site): shipping by country (USA $18 free from $150, Canada $40 free from $200, Europe and Australia $50 free from $300; Europe means Belgium, Denmark, France, Germany and the United Kingdom), minimum order $100 (products after discounts plus shipping), and the bulk discount tiers (3-5 items 5%, 6-9 items 7%, 10+ items 10%). Each box can be changed; an empty box uses the standard value.
- Welcome popup (Site): turn it on or off, set the code (STRONG26) and the percent (10). Signups are listed under Customers, Subscribers. Each email can use the code once.
- Hours and social links (Site): shown in the footer.
- Promo codes (under Customers): add other codes, for example SAVE10 as 10 percent off. The cart checks them in the database.
- Tracking and chat: paste your Smartsupp key to turn on live chat.
- Products: add prices for products that show "Contact for price" (for example GHRP-2 and GHRP-6).

## How it works in one minute
- Anything you change in the admin stays unsaved until you press Save and publish at the bottom.
- If the database is ever unreachable, the site still shows its original text.
- Every order is saved in the admin, and an invoice is emailed to contact@atech-labs.com and to the customer. The cart asks for payment method (Bitcoin, Apple Pay or Chime), how to contact them (text message or WhatsApp) and an optional promo code. Shipping, bulk discount and the minimum order are worked out by the database, so the browser cannot change them.
- Contact messages arrive in the admin and also as an email alert.
- Backup and restore is under Site, then Backup. Every change is listed under History and can be restored.

## Not built yet
- Receiving customer emails inside the admin (Resend inbound). You can send replies from the admin.
- The anti-spam check on the contact form is unchanged from the original site.
- Product prices in the cart are still read from the site files and the admin, not re-checked by the database.
- Product order on the shop pages cannot be changed from the admin.
- Payment is not taken on the site. After the order, you contact the customer to arrange Bitcoin, Apple Pay or Chime payment.
- Not yet tried against a real Supabase, Netlify or Resend account. It was tested with a copy of the database and a real browser.
