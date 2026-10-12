-- ════════════════════════════════════════════════════════════════════
-- Dashboard settings, daily capacity, blocked periods, service icons
--
-- Run once in Supabase → SQL Editor (after 20261008_packages.sql).
--
--   app_settings      key/value settings edited in Dashboard → Settings
--                     key 'booking' = {
--                       max_per_day: int | null        (null = no limit)
--                       show_capacity_to_customers: bool
--                       periods: [{ key, start, end, enabled }]
--                     }
--                     Apps fall back to defaults when a key is missing.
--   booking_blocks    a period (or whole day) closed on a given date
--   packs.icon        icon name for the mobile service cards (null = default)
--   booking_availability(from, to)   per-day load for the app + dashboard
--
-- bookings.booking_time now holds a period key: 'morning' | 'afternoon' |
-- 'evening' | null (no preference). Old rows with clock times stay as-is.
-- ════════════════════════════════════════════════════════════════════

-- ── settings ─────────────────────────────────────────────────────────
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "Anyone can read settings" on public.app_settings for select using (true);
create policy "Managers manage settings" on public.app_settings for all
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

insert into public.app_settings (key, value) values (
  'booking',
  '{
    "max_per_day": null,
    "show_capacity_to_customers": false,
    "periods": [
      { "key": "morning",   "start": "09:00", "end": "12:00", "enabled": true },
      { "key": "afternoon", "start": "12:00", "end": "17:00", "enabled": true },
      { "key": "evening",   "start": "17:00", "end": "00:00", "enabled": true }
    ]
  }'::jsonb
);

-- ── blocked periods ──────────────────────────────────────────────────
create table public.booking_blocks (
  id uuid primary key default gen_random_uuid(),
  block_date date not null,
  period text check (period in ('morning', 'afternoon', 'evening')), -- null = whole day
  reason text,
  created_at timestamptz not null default now()
);

create unique index booking_blocks_date_period_idx
  on public.booking_blocks (block_date, coalesce(period, 'all'));

alter table public.booking_blocks enable row level security;

create policy "Anyone can read blocks" on public.booking_blocks for select using (true);
create policy "Managers manage blocks" on public.booking_blocks for all
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

-- ── service icons ────────────────────────────────────────────────────
alter table public.packs add column icon text;

-- ── availability ─────────────────────────────────────────────────────
-- Bookings in these statuses occupy a place in the day.
create function public.booking_status_takes_capacity(s public.booking_status)
returns boolean
language sql
immutable
as $$
  select s in ('confirmed', 'arrived', 'in_progress', 'completed');
$$;

-- One row per day in [p_from, p_to]. Customers only see counts / is_full
-- when the owner enabled show_capacity_to_customers; staff always see them.
create function public.booking_availability(p_from date, p_to date)
returns table (
  day date,
  booked integer,
  max_per_day integer,
  is_full boolean,
  blocked_periods text[],
  whole_day_blocked boolean
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_settings jsonb := coalesce((select value from public.app_settings where key = 'booking'), '{}'::jsonb);
  v_max integer := nullif(v_settings ->> 'max_per_day', '')::integer;
  v_visible boolean := coalesce((v_settings ->> 'show_capacity_to_customers')::boolean, false)
                       or public.is_staff_or_manager(auth.uid());
begin
  return query
  select
    d::date,
    case when v_visible then (
      select count(*)::integer from public.bookings b
      where b.booking_date = d::date and public.booking_status_takes_capacity(b.status)
    ) end,
    case when v_visible then v_max end,
    case when v_visible and v_max is not null then (
      select count(*) from public.bookings b
      where b.booking_date = d::date and public.booking_status_takes_capacity(b.status)
    ) >= v_max else false end,
    coalesce((
      select array_agg(bb.period) from public.booking_blocks bb
      where bb.block_date = d::date and bb.period is not null
    ), '{}'),
    exists (
      select 1 from public.booking_blocks bb
      where bb.block_date = d::date and bb.period is null
    )
  from generate_series(p_from, p_to, interval '1 day') as d;
end;
$$;

-- ── guard customer bookings ──────────────────────────────────────────
-- Customers can't book in the past or into a blocked period/day.
-- Managers/staff (and the service role) can still do anything.
create function public.bookings_check_schedule()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_staff_or_manager(auth.uid()) then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.booking_date is not distinct from old.booking_date
     and new.booking_time is not distinct from old.booking_time then
    return new;
  end if;
  if new.booking_date is null then
    return new;
  end if;

  if new.booking_date < (now() at time zone 'Africa/Cairo')::date then
    raise exception 'BOOKING_DATE_IN_PAST: this date has already passed';
  end if;
  if exists (
    select 1 from public.booking_blocks bb
    where bb.block_date = new.booking_date
      and (bb.period is null or bb.period = new.booking_time)
  ) then
    raise exception 'BOOKING_PERIOD_BLOCKED: this time is closed for booking';
  end if;
  return new;
end;
$$;

create trigger bookings_check_schedule
  before insert or update on public.bookings
  for each row execute procedure public.bookings_check_schedule();
