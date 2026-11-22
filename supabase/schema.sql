-- =====================================================================
-- A-Tech Labs admin database
-- Paste this whole file into the Supabase SQL editor and press Run.
-- It is safe to run again at any time.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key,
  email      text not null,
  role       text not null check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.content (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.settings (
  grp        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.products (
  slug       text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  message     text not null,
  page        text,
  status      text not null default 'new' check (status in ('new','read','done','spam')),
  notified_at timestamptz,
  replied_at  timestamptz
);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_no      bigint generated always as identity,
  created_at    timestamptz not null default now(),
  customer_name text not null,
  phone         text not null,
  email         text,
  address       text not null,
  notes         text,
  items         jsonb not null,
  subtotal      numeric not null default 0,
  channel       text,
  status        text not null default 'new' check (status in ('new','confirmed','shipped','done','cancelled')),
  admin_note    text,
  notified_at   timestamptz,
  payment_method text,
  contact_method text,
  promo_code    text,
  discount      numeric not null default 0,
  total         numeric
);
-- for databases created before these columns existed
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists contact_method text;
alter table public.orders add column if not exists promo_code text;
alter table public.orders add column if not exists discount numeric not null default 0;
alter table public.orders add column if not exists total numeric;
alter table public.orders add column if not exists shipping numeric not null default 0;
alter table public.orders add column if not exists discount_note text;
alter table public.orders add column if not exists country text;

-- people who signed up through the welcome popup (admin only)
create table if not exists public.subscribers (
  email           text primary key,
  created_at      timestamptz not null default now(),
  welcome_sent_at timestamptz,
  discount_used   boolean not null default false,
  discount_used_at timestamptz
);

-- promo codes: only the admin can read them. The shop checks a code through check_promo().
create table if not exists public.promo_codes (
  code        text primary key check (code = upper(code) and length(code) between 2 and 40),
  kind        text not null check (kind in ('percent','fixed')),
  value       numeric not null check (value > 0),
  active      boolean not null default true,
  expires_at  timestamptz,
  max_uses    integer,
  uses        integer not null default 0,
  note        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  path        text not null unique,
  url         text not null,
  alt         text,
  size        bigint,
  uploaded_by uuid
);

create table if not exists public.history (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  by_user  uuid,
  by_email text,
  tbl      text not null,
  key      text not null,
  action   text not null,
  old_val  jsonb,
  new_val  jsonb
);
create index if not exists history_at_idx on public.history (at desc);

create table if not exists public.snapshot (
  id         int primary key check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admins where user_id = auth.uid()
$$;

-- true when the signed in person has at least the given role
create or replace function public.has_role(min_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (case (select role from public.admins where user_id = auth.uid())
       when 'owner' then 4 when 'admin' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end)
    >=
    (case min_role when 'owner' then 4 when 'admin' then 3 when 'editor' then 2 when 'viewer' then 1 else 99 end),
    false)
$$;

create or replace function public.touch_row()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Public snapshot: rebuilt after every change, visitors read only this
-- ---------------------------------------------------------------------
create or replace function public.rebuild_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
declare snap jsonb;
begin
  snap := jsonb_build_object(
    'v', extract(epoch from clock_timestamp())::bigint,
    'content',  coalesce((select jsonb_object_agg(key, value) from public.content), '{}'::jsonb),
    'settings', coalesce((select jsonb_object_agg(grp, case when grp = 'welcome' then data - 'code' else data end)
                from public.settings where grp <> 'payments'), '{}'::jsonb),
    'products', coalesce((select jsonb_object_agg(slug, data) from public.products), '{}'::jsonb)
  );
  insert into public.snapshot (id, data, updated_at) values (1, snap, now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Change history
-- ---------------------------------------------------------------------
create or replace function public.log_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text; o jsonb; n jsonb; em text;
begin
  select email into em from public.admins where user_id = auth.uid();
  if TG_OP = 'DELETE' then
    o := to_jsonb(old); n := null;
  elsif TG_OP = 'INSERT' then
    o := null; n := to_jsonb(new);
  else
    o := to_jsonb(old); n := to_jsonb(new);
  end if;
  k := coalesce(n ->> TG_ARGV[0], o ->> TG_ARGV[0]);
  insert into public.history (by_user, by_email, tbl, key, action, old_val, new_val)
  values (auth.uid(), em, TG_TABLE_NAME, k, lower(TG_OP),
          case TG_ARGV[1] when 'value' then to_jsonb(o ->> 'value') else o -> TG_ARGV[1] end,
          case TG_ARGV[1] when 'value' then to_jsonb(n ->> 'value') else n -> TG_ARGV[1] end);
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
drop trigger if exists content_touch on public.content;
create trigger content_touch before insert or update on public.content for each row execute function public.touch_row();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before insert or update on public.settings for each row execute function public.touch_row();
drop trigger if exists products_touch on public.products;
create trigger products_touch before insert or update on public.products for each row execute function public.touch_row();

drop trigger if exists content_snap on public.content;
create trigger content_snap after insert or update or delete on public.content for each statement execute function public.rebuild_snapshot();
drop trigger if exists settings_snap on public.settings;
create trigger settings_snap after insert or update or delete on public.settings for each statement execute function public.rebuild_snapshot();
drop trigger if exists products_snap on public.products;
create trigger products_snap after insert or update or delete on public.products for each statement execute function public.rebuild_snapshot();

drop trigger if exists content_log on public.content;
create trigger content_log after insert or update or delete on public.content for each row execute function public.log_change('key', 'value');
drop trigger if exists settings_log on public.settings;
create trigger settings_log after insert or update or delete on public.settings for each row execute function public.log_change('grp', 'data');
drop trigger if exists promo_log on public.promo_codes;
create trigger promo_log after insert or update or delete on public.promo_codes for each row execute function public.log_change('code', 'kind');
drop trigger if exists products_log on public.products;
create trigger products_log after insert or update or delete on public.products for each row execute function public.log_change('slug', 'data');

-- ---------------------------------------------------------------------
-- Functions visitors may call (nothing else is open to them)
-- ---------------------------------------------------------------------
create or replace function public.submit_message(p_name text, p_email text, p_message text, p_page text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if length(trim(coalesce(p_name,''))) < 2 or length(p_name) > 120 then raise exception 'invalid name'; end if;
  if position('@' in coalesce(p_email,'')) < 2 or length(p_email) > 200 then raise exception 'invalid email'; end if;
  if length(trim(coalesce(p_message,''))) < 3 or length(p_message) > 5000 then raise exception 'invalid message'; end if;
  if (select count(*) from public.messages where email = p_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many messages';
  end if;
  insert into public.messages (name, email, message, page)
  values (trim(p_name), trim(p_email), trim(p_message), left(p_page, 200)) returning id into new_id;
  return new_id;
end $$;

-- old helpers, replaced by quote_order()
drop function if exists public.check_promo(text,numeric);
drop function if exists public.promo_discount(text,numeric);

create or replace function public.num_or(t text, d numeric)
returns numeric language sql immutable as $$
  select case when t ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then t::numeric else d end
$$;

-- One price for a cart: bulk discount, promo or welcome code, shipping, total.
-- The cart shows this and place_order() saves it, so both always agree.
-- Shipping rule for a country: USA, Canada, Australia, and Europe (Belgium, Denmark, France, Germany, United Kingdom).
-- Each fee and free-shipping amount can be changed in the admin (Site, Shipping and discounts).
create or replace function public.ship_rule(p_country text, sh jsonb, out fee numeric, out free_at numeric)
language plpgsql immutable as $$
begin
  case p_country
    when 'Canada' then
      fee := public.num_or(sh->>'caFee', 40); free_at := public.num_or(sh->>'caFreeAt', 200);
    when 'Australia' then
      fee := public.num_or(sh->>'auFee', 50); free_at := public.num_or(sh->>'auFreeAt', 300);
    when 'Belgium', 'Denmark', 'France', 'Germany', 'United Kingdom' then
      fee := public.num_or(sh->>'euFee', 50); free_at := public.num_or(sh->>'euFreeAt', 300);
    else
      fee := public.num_or(sh->>'fee', 18); free_at := public.num_or(sh->>'freeAt', 150);
  end case;
end $$;

drop function if exists public.quote_order(jsonb,numeric,text,text);
create or replace function public.quote_order(p_items jsonb, p_subtotal numeric, p_code text, p_email text, p_country text default 'USA')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  sh jsonb := coalesce((select data from public.settings where grp = 'shop'), '{}'::jsonb);
  wl jsonb := coalesce((select data from public.settings where grp = 'welcome'), '{}'::jsonb);
  sub numeric := greatest(coalesce(p_subtotal, 0), 0);
  cnt numeric := 0; bpct numeric := 0; bdisc numeric; pdisc numeric := 0; raw numeric; disc numeric; after numeric; ship numeric;
  fee numeric; free_at numeric; min_o numeric; cap numeric;
  ccode text := upper(trim(coalesce(p_code, '')));
  pc public.promo_codes; applied text := null; msg text := null; is_welcome boolean := false;
  wcode text; wpct numeric; em text := lower(trim(coalesce(p_email, '')));
  dmin numeric[] := array[3, 6, 10]; dmax numeric[] := array[5, 9, null]; dpct numeric[] := array[5, 7, 10];
  k int; mn numeric; mx numeric; pc2 numeric; note text := '';
begin
  select r.fee, r.free_at into fee, free_at from public.ship_rule(trim(coalesce(p_country, '')), sh) r;
  min_o := public.num_or(sh->>'minOrder', 100);
  cap := public.num_or(sh->>'cap', 30);
  if jsonb_typeof(p_items) = 'array' then
    select coalesce(sum(least(public.num_or(e->>'qty', 0), 99)), 0) into cnt from jsonb_array_elements(p_items) e;
  end if;
  for k in 1..3 loop
    mn := public.num_or(sh->>('b' || k || 'min'), dmin[k]);
    mx := case when sh ? ('b' || k || 'max') then public.num_or(sh->>('b' || k || 'max'), null) else dmax[k] end;
    pc2 := public.num_or(sh->>('b' || k || 'pct'), dpct[k]);
    if cnt >= mn and (mx is null or cnt <= mx) then bpct := pc2; end if;
  end loop;
  bdisc := round(sub * bpct / 100, 2);
  if bpct > 0 then note := 'Bulk ' || trim_scale(bpct)::text || '%'; end if;

  if ccode <> '' then
    wcode := upper(trim(coalesce(nullif(trim(wl->>'code'), ''), 'STRONG26')));
    wpct := public.num_or(wl->>'pct', 10);
    if ccode = wcode then
      is_welcome := true;
      if em <> '' and exists (select 1 from public.subscribers where email = em and discount_used) then
        msg := 'This code was already used.';
      else
        pdisc := round(sub * least(wpct, 100) / 100, 2); applied := ccode;
      end if;
    else
      select * into pc from public.promo_codes where promo_codes.code = ccode;
      if not found or not pc.active or (pc.expires_at is not null and pc.expires_at < now())
         or (pc.max_uses is not null and pc.uses >= pc.max_uses) then
        msg := 'This promo code is not valid.';
      else
        if pc.kind = 'percent' then pdisc := round(sub * least(pc.value, 100) / 100, 2);
        else pdisc := least(pc.value, sub); end if;
        applied := pc.code;
      end if;
    end if;
    if applied is not null then
      note := trim(both ' +' from note || ' + code ' || applied);
    end if;
  end if;

  raw := bdisc + pdisc;
  disc := case when cap > 0 then least(raw, round(sub * cap / 100, 2)) else raw end;
  disc := least(disc, sub);
  after := sub - disc;
  ship := case when sub = 0 or after >= free_at then 0 else fee end;
  return jsonb_build_object(
    'valid', msg is null, 'message', msg, 'welcome', is_welcome and applied is not null,
    'subtotal', sub, 'count', cnt, 'bulk_pct', bpct, 'bulk_discount', bdisc,
    'code', applied, 'code_discount', pdisc, 'discount', disc, 'discount_note', note,
    'shipping', ship, 'free_at', free_at, 'fee', fee, 'min_order', min_o, 'min_ok', (after + ship) >= min_o,
    'total', after + ship);
end $$;

drop function if exists public.place_order(text,text,text,text,text,jsonb,numeric,text,text,text,text);
drop function if exists public.place_order(text,text,text,text,text,jsonb,numeric,text,text,text,text,text);
create or replace function public.place_order(
  p_name text, p_phone text, p_email text, p_address text, p_notes text,
  p_items jsonb, p_subtotal numeric, p_channel text,
  p_payment text, p_contact_method text, p_promo text, p_country text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare new_id uuid; new_no bigint; q jsonb; n int; pay_key text; instr text;
begin
  if length(trim(coalesce(p_name,''))) < 2 or length(p_name) > 120 then raise exception 'invalid name'; end if;
  if length(trim(coalesce(p_phone,''))) < 4 or length(p_phone) > 60 then raise exception 'invalid phone'; end if;
  if length(trim(coalesce(p_address,''))) < 4 or length(p_address) > 600 then raise exception 'invalid address'; end if;
  if coalesce(p_email,'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 200 then raise exception 'invalid email'; end if;
  if p_country not in ('USA','Australia','Belgium','Canada','Denmark','France','Germany','United Kingdom') then raise exception 'invalid country'; end if;
  if p_payment not in ('Bitcoin','Apple Pay','Chime') then raise exception 'invalid payment method'; end if;
  if p_contact_method not in ('Text message','WhatsApp') then raise exception 'invalid contact method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'invalid items';
  end if;
  if (select count(*) from public.orders where phone = p_phone and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many orders';
  end if;

  q := public.quote_order(p_items, p_subtotal, p_promo, p_email, p_country);
  if not (q->>'min_ok')::boolean then raise exception 'minimum order not met'; end if;

  -- use up the code atomically; if someone else just used it, price the cart without it
  if q->>'code' is not null then
    if (q->>'welcome')::boolean then
      insert into public.subscribers (email, discount_used, discount_used_at)
        values (lower(trim(p_email)), true, now())
        on conflict (email) do update set discount_used = true, discount_used_at = now()
        where public.subscribers.discount_used = false;
    else
      update public.promo_codes set uses = uses + 1
        where promo_codes.code = q->>'code' and (max_uses is null or uses < max_uses);
    end if;
    get diagnostics n = row_count;
    if n = 0 then q := public.quote_order(p_items, p_subtotal, '', p_email, p_country); end if;
  end if;

  insert into public.orders (customer_name, phone, email, address, notes, items, subtotal, channel,
                             payment_method, contact_method, promo_code, discount, shipping, discount_note, total, country)
  values (trim(p_name), trim(p_phone), trim(p_email), trim(p_address),
          left(p_notes, 2000), p_items, (q->>'subtotal')::numeric, left(p_channel, 30),
          p_payment, p_contact_method, q->>'code', (q->>'discount')::numeric, (q->>'shipping')::numeric,
          nullif(q->>'discount_note', ''), (q->>'total')::numeric, p_country)
  returning id, order_no into new_id, new_no;

  pay_key := case p_payment when 'Bitcoin' then 'bitcoin' when 'Apple Pay' then 'applepay' else 'chime' end;
  instr := coalesce((select data->>pay_key from public.settings where grp = 'payments'), '');
  return jsonb_build_object('id', new_id, 'order_no', new_no, 'discount', q->'discount', 'shipping', q->'shipping',
                            'total', q->'total', 'instructions', instr);
end $$;

-- welcome popup signup: saves the address once, the email with the code is sent by the notify function
create or replace function public.subscribe(p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(coalesce(p_email, ''))); n int;
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(e) > 200 then raise exception 'invalid email'; end if;
  if (select count(*) from public.subscribers where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'too many signups';
  end if;
  insert into public.subscribers (email) values (e) on conflict (email) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('new', n = 1);
end $$;

grant execute on function public.submit_message(text,text,text,text) to anon, authenticated;
grant execute on function public.place_order(text,text,text,text,text,jsonb,numeric,text,text,text,text,text) to anon, authenticated;
grant execute on function public.quote_order(jsonb,numeric,text,text,text) to anon, authenticated;
grant execute on function public.subscribe(text) to anon, authenticated;

-- Owner adds a team member AFTER creating their login in Authentication > Users
create or replace function public.add_admin(p_email text, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.has_role('owner') then raise exception 'only the owner can manage the team'; end if;
  if p_role not in ('owner','admin','editor','viewer') then raise exception 'invalid role'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No login with that email. Create it first in Authentication > Users.'; end if;
  insert into public.admins (user_id, email, role) values (uid, lower(trim(p_email)), p_role)
  on conflict (user_id) do update set role = excluded.role;
  return jsonb_build_object('user_id', uid, 'email', lower(trim(p_email)), 'role', p_role);
end $$;
grant execute on function public.add_admin(text,text) to authenticated;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.admins   enable row level security;
alter table public.content  enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.messages enable row level security;
alter table public.orders   enable row level security;
alter table public.promo_codes enable row level security;
alter table public.subscribers enable row level security;
alter table public.media    enable row level security;
alter table public.history  enable row level security;
alter table public.snapshot enable row level security;

revoke all on public.admins, public.content, public.settings, public.products, public.messages,
              public.orders, public.media, public.history, public.snapshot, public.promo_codes, public.subscribers from anon;
revoke all on public.admins, public.content, public.settings, public.products, public.messages,
              public.orders, public.media, public.history, public.snapshot, public.promo_codes, public.subscribers from authenticated;
grant select on public.snapshot to anon, authenticated;
grant select on public.admins, public.history to authenticated;
grant select, insert, update, delete on public.content, public.settings, public.products,
      public.messages, public.orders, public.media, public.promo_codes to authenticated;
grant update, delete on public.admins to authenticated;
grant select, delete on public.subscribers to authenticated;

-- snapshot: everyone reads, nobody writes (only the trigger)
drop policy if exists snapshot_read on public.snapshot;
create policy snapshot_read on public.snapshot for select to anon, authenticated using (true);

-- team
drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select to authenticated
  using (user_id = auth.uid() or public.has_role('admin'));
drop policy if exists admins_update on public.admins;
create policy admins_update on public.admins for update to authenticated
  using (public.has_role('owner') and user_id <> auth.uid()) with check (public.has_role('owner'));
drop policy if exists admins_delete on public.admins;
create policy admins_delete on public.admins for delete to authenticated
  using (public.has_role('owner') and user_id <> auth.uid());

-- content and products: viewers read, editors write
drop policy if exists content_read on public.content;
create policy content_read on public.content for select to authenticated using (public.has_role('viewer'));
drop policy if exists content_write on public.content;
create policy content_write on public.content for all to authenticated
  using (public.has_role('editor')) with check (public.has_role('editor'));

drop policy if exists products_read on public.products;
create policy products_read on public.products for select to authenticated using (public.has_role('viewer'));
drop policy if exists products_write on public.products;
create policy products_write on public.products for all to authenticated
  using (public.has_role('editor')) with check (public.has_role('editor'));

-- settings: admins write
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (public.has_role('viewer'));
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- promo codes: only admins see and change them
drop policy if exists promo_read on public.promo_codes;
create policy promo_read on public.promo_codes for select to authenticated using (public.has_role('admin'));
drop policy if exists promo_write on public.promo_codes;
create policy promo_write on public.promo_codes for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- welcome popup signups
drop policy if exists subscribers_read on public.subscribers;
create policy subscribers_read on public.subscribers for select to authenticated using (public.has_role('admin'));
drop policy if exists subscribers_delete on public.subscribers;
create policy subscribers_delete on public.subscribers for delete to authenticated using (public.has_role('admin'));

-- inbox and orders
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (public.has_role('viewer'));
drop policy if exists messages_write on public.messages;
create policy messages_write on public.messages for update to authenticated
  using (public.has_role('editor')) with check (public.has_role('editor'));
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated using (public.has_role('editor'));

drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated using (public.has_role('viewer'));
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (public.has_role('editor')) with check (public.has_role('editor'));
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders for delete to authenticated using (public.has_role('admin'));

-- media records
drop policy if exists media_read on public.media;
create policy media_read on public.media for select to authenticated using (public.has_role('viewer'));
drop policy if exists media_write on public.media;
create policy media_write on public.media for all to authenticated
  using (public.has_role('editor')) with check (public.has_role('editor'));

-- history: read only
drop policy if exists history_read on public.history;
create policy history_read on public.history for select to authenticated using (public.has_role('viewer'));

-- ---------------------------------------------------------------------
-- Storage bucket for uploads: public read, editors write
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    insert into storage.buckets (id, name, public) values ('media', 'media', true)
    on conflict (id) do update set public = true;

    drop policy if exists "media public read" on storage.objects;
    create policy "media public read" on storage.objects for select to anon, authenticated
      using (bucket_id = 'media');
    drop policy if exists "media editors insert" on storage.objects;
    create policy "media editors insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'media' and public.has_role('editor'));
    drop policy if exists "media editors update" on storage.objects;
    create policy "media editors update" on storage.objects for update to authenticated
      using (bucket_id = 'media' and public.has_role('editor'));
    drop policy if exists "media editors delete" on storage.objects;
    create policy "media editors delete" on storage.objects for delete to authenticated
      using (bucket_id = 'media' and public.has_role('editor'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- First snapshot (empty overrides: the site shows its original content)
-- ---------------------------------------------------------------------
insert into public.snapshot (id, data)
values (1, jsonb_build_object('v', 0, 'content', '{}'::jsonb, 'settings', '{}'::jsonb, 'products', '{}'::jsonb))
on conflict (id) do nothing;

-- =====================================================================
-- STEP 2: create the first owner.
-- 1) In Supabase go to Authentication > Users > Add user, create your login.
-- 2) Change the email below to that login email, select this block and Run.
-- =====================================================================
-- insert into public.admins (user_id, email, role)
-- select id, lower(email), 'owner' from auth.users where lower(email) = lower('YOUR_EMAIL_HERE')
-- on conflict (user_id) do update set role = 'owner';


-- Order numbers start at 10001 (shown on the site as ATLABS10001). Safe to run again.
do $$ begin
  if coalesce((select max(order_no) from public.orders), 0) < 10001 then
    perform setval(pg_get_serial_sequence('public.orders', 'order_no'), 10000, true);
  end if;
end $$;


-- The Netlify functions (order emails, password sign in) use the service_role key. Give it access to the tables. Safe to run again.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
