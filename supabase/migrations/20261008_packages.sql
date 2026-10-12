-- ════════════════════════════════════════════════════════════════════
-- Monthly packages ("5 washes / month" bundles sold at a fixed price)
--
-- Run once in Supabase → SQL Editor. Safe to read top-to-bottom:
--   packages            the offer the manager sets up
--   package_items       which packs it contains and how many of each
--   package_prices      fixed price per car type
--   user_packages       a package a customer bought (for ONE car)
--   user_package_items  snapshot of the items at purchase time
--   bookings.user_package_id   a wash paid for by a package credit
--   user_package_balances      view: used / remaining per pack
--
-- Rules enforced in the database (not just the apps):
--   * price, car type and item list are copied from the server, never
--     trusted from the client
--   * a purchase starts as pending_review; only a manager activates it
--   * activation sets starts_at = now(), expires_at = now() + 1 month
--   * a booking may use a package only if: same customer, same car,
--     package active and not expired, booking date before expiry, and
--     the pack still has washes left
--   * cancelled / rejected / expired bookings give the wash back
-- ════════════════════════════════════════════════════════════════════

-- ── packages (offer) ─────────────────────────────────────────────────
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  pack_id uuid not null references public.packs (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unique (package_id, pack_id)
);

create table public.package_prices (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  car_type text not null,
  price numeric(10, 2) not null check (price >= 0),
  unique (package_id, car_type)
);

alter table public.packages enable row level security;
alter table public.package_items enable row level security;
alter table public.package_prices enable row level security;

create policy "Anyone can view packages" on public.packages for select using (true);
create policy "Managers manage packages" on public.packages for all
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy "Anyone can view package items" on public.package_items for select using (true);
create policy "Managers manage package items" on public.package_items for all
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

create policy "Anyone can view package prices" on public.package_prices for select using (true);
create policy "Managers manage package prices" on public.package_prices for all
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

-- ── user_packages (purchase) ─────────────────────────────────────────
create table public.user_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  car_id uuid not null references public.cars (id) on delete cascade,
  package_id uuid not null references public.packages (id),
  car_type text not null,
  package_name_en text not null,
  package_name_ar text not null,
  price numeric(10, 2) not null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  payment_method_label_en text,
  payment_method_label_ar text,
  payment_reference text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'active', 'rejected', 'cancelled', 'expired')),
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  status_updated_at timestamptz not null default now()
);

create index user_packages_user_id_idx on public.user_packages (user_id);
create index user_packages_status_idx on public.user_packages (status);

create table public.user_package_items (
  id uuid primary key default gen_random_uuid(),
  user_package_id uuid not null references public.user_packages (id) on delete cascade,
  pack_id uuid not null references public.packs (id) on delete restrict,
  pack_name_en text not null,
  pack_name_ar text not null,
  quantity integer not null check (quantity > 0),
  unique (user_package_id, pack_id)
);

alter table public.user_packages enable row level security;
alter table public.user_package_items enable row level security;

create policy "View own or staff views all" on public.user_packages for select
  using (user_id = auth.uid() or public.is_staff_or_manager(auth.uid()));
create policy "Customers buy for themselves" on public.user_packages for insert
  with check (user_id = auth.uid() or public.is_manager(auth.uid()));
create policy "Owner or manager updates" on public.user_packages for update
  using (user_id = auth.uid() or public.is_manager(auth.uid()));
create policy "Managers delete" on public.user_packages for delete
  using (public.is_manager(auth.uid()));

-- Rows are only ever written by the snapshot trigger below.
create policy "View items of visible purchases" on public.user_package_items for select
  using (exists (
    select 1 from public.user_packages up
    where up.id = user_package_id
      and (up.user_id = auth.uid() or public.is_staff_or_manager(auth.uid()))
  ));

-- Fill price/names/car type from the server on purchase.
create function public.user_packages_before_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_car public.cars;
  v_package public.packages;
  v_method public.payment_methods;
  v_price numeric;
  -- auth.uid() is null for the service role (dashboard API routes)
  v_is_manager boolean := auth.uid() is null or public.is_manager(auth.uid());
begin
  select * into v_car from public.cars where id = new.car_id;
  if not found or v_car.owner_id <> new.user_id then
    raise exception 'PACKAGE_CAR_NOT_OWNED: this car does not belong to the customer';
  end if;

  select * into v_package from public.packages where id = new.package_id;
  if not found or (not v_package.active and not v_is_manager) then
    raise exception 'PACKAGE_UNAVAILABLE: this package is not available';
  end if;

  select price into v_price from public.package_prices
  where package_id = new.package_id and car_type = v_car.car_type;
  if v_price is null then
    raise exception 'PACKAGE_NO_PRICE: this package has no price for car type %', v_car.car_type;
  end if;

  new.car_type := v_car.car_type;
  new.package_name_en := v_package.name_en;
  new.package_name_ar := v_package.name_ar;
  new.price := v_price;

  if new.payment_method_id is not null then
    select * into v_method from public.payment_methods where id = new.payment_method_id;
    new.payment_method_label_en := v_method.label_en;
    new.payment_method_label_ar := v_method.label_ar;
  end if;

  if not v_is_manager then
    new.status := 'pending_review';
  end if;
  if new.status = 'active' then
    new.starts_at := now();
    new.expires_at := now() + interval '1 month';
  else
    new.starts_at := null;
    new.expires_at := null;
  end if;
  new.status_updated_at := now();
  return new;
end;
$$;

create trigger user_packages_before_insert
  before insert on public.user_packages
  for each row execute procedure public.user_packages_before_insert();

create function public.user_packages_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_package_items (user_package_id, pack_id, pack_name_en, pack_name_ar, quantity)
  select new.id, pi.pack_id, p.name_en, p.name_ar, pi.quantity
  from public.package_items pi
  join public.packs p on p.id = pi.pack_id
  where pi.package_id = new.package_id;

  if not found then
    raise exception 'PACKAGE_EMPTY: this package has no washes configured';
  end if;
  return null;
end;
$$;

create trigger user_packages_after_insert
  after insert on public.user_packages
  for each row execute procedure public.user_packages_after_insert();

-- Customers may only cancel a purchase that is still pending review.
-- Activation stamps the validity window.
create function public.user_packages_before_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_manager boolean := auth.uid() is null or public.is_manager(auth.uid());
begin
  if not v_is_manager then
    if new.user_id <> old.user_id or new.car_id <> old.car_id or new.package_id <> old.package_id
       or new.price <> old.price or new.starts_at is distinct from old.starts_at
       or new.expires_at is distinct from old.expires_at then
      raise exception 'PACKAGE_READ_ONLY: only a manager can change this';
    end if;
    if new.status <> old.status and not (old.status = 'pending_review' and new.status = 'cancelled') then
      raise exception 'PACKAGE_READ_ONLY: only a manager can change this';
    end if;
  end if;

  if new.status = 'active' and old.status <> 'active' and new.starts_at is null then
    new.starts_at := now();
    new.expires_at := now() + interval '1 month';
  end if;
  if new.status <> old.status then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger user_packages_before_update
  before update on public.user_packages
  for each row execute procedure public.user_packages_before_update();

-- Marks active packages past their expiry as expired. Called by the
-- dashboard on load; also safe to schedule with pg_cron.
create function public.expire_stale_user_packages()
returns integer
language sql
security definer set search_path = public
as $$
  with updated as (
    update public.user_packages
    set status = 'expired'
    where status = 'active' and expires_at <= now()
    returning 1
  )
  select count(*)::integer from updated;
$$;

-- ── bookings paid by a package ───────────────────────────────────────
alter table public.bookings
  add column user_package_id uuid references public.user_packages (id);

create index bookings_user_package_id_idx on public.bookings (user_package_id);

-- Bookings in these statuses do not consume a wash.
create function public.booking_status_refunds_wash(s public.booking_status)
returns boolean
language sql
immutable
as $$
  select s in ('cancelled', 'rejected', 'expired');
$$;

create function public.user_package_remaining(p_user_package_id uuid, p_pack_id uuid)
returns integer
language sql
stable
security definer set search_path = public
as $$
  select coalesce((
    select upi.quantity from public.user_package_items upi
    where upi.user_package_id = p_user_package_id and upi.pack_id = p_pack_id
  ), 0) - (
    select count(*)::integer from public.bookings b
    where b.user_package_id = p_user_package_id
      and b.pack_id = p_pack_id
      and not public.booking_status_refunds_wash(b.status)
  );
$$;

create function public.bookings_check_package()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_up public.user_packages;
begin
  if new.user_package_id is null then
    if tg_op = 'UPDATE' and old.user_package_id is not null then
      raise exception 'PACKAGE_BOOKING_LOCKED: a package booking cannot be detached from its package';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_package_id is distinct from old.user_package_id
       or new.pack_id is distinct from old.pack_id
       or new.car_id is distinct from old.car_id then
      raise exception 'PACKAGE_BOOKING_LOCKED: package, pack and car cannot change on a package booking';
    end if;
    -- Re-check only when a refunded booking is brought back to life.
    if not (public.booking_status_refunds_wash(old.status)
            and not public.booking_status_refunds_wash(new.status)) then
      return new;
    end if;
  end if;

  -- Lock the purchase so two simultaneous bookings can't both take the last wash.
  select * into v_up from public.user_packages where id = new.user_package_id for update;

  if not found or v_up.user_id <> new.user_id or v_up.car_id <> new.car_id then
    raise exception 'PACKAGE_NOT_FOR_THIS_CAR: this package belongs to another car or customer';
  end if;
  if v_up.status <> 'active' or v_up.expires_at <= now() then
    raise exception 'PACKAGE_NOT_ACTIVE: this package is not active';
  end if;
  if new.booking_date is not null and new.booking_date > v_up.expires_at::date then
    raise exception 'PACKAGE_EXPIRES_BEFORE_DATE: the package expires before this date';
  end if;
  if public.user_package_remaining(new.user_package_id, new.pack_id) <= 0 then
    raise exception 'PACKAGE_NO_WASHES_LEFT: no washes left for this service in the package';
  end if;

  if tg_op = 'INSERT' then
    new.price := 0;
  end if;
  return new;
end;
$$;

create trigger bookings_check_package
  before insert or update on public.bookings
  for each row execute procedure public.bookings_check_package();

-- ── balances view ────────────────────────────────────────────────────
-- security_invoker: callers only see rows their own RLS allows.
create view public.user_package_balances
with (security_invoker = true) as
select
  upi.user_package_id,
  upi.pack_id,
  upi.pack_name_en,
  upi.pack_name_ar,
  upi.quantity,
  count(b.id) filter (where not public.booking_status_refunds_wash(b.status))::integer as used,
  upi.quantity - count(b.id) filter (where not public.booking_status_refunds_wash(b.status))::integer as remaining
from public.user_package_items upi
left join public.bookings b
  on b.user_package_id = upi.user_package_id and b.pack_id = upi.pack_id
group by upi.id;
