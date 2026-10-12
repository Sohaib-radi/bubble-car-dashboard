-- ════════════════════════════════════════════════════════════════════
-- Blocked periods: date ranges + time ranges
--
-- Run once in Supabase → SQL Editor (after 20261009_settings_capacity.sql).
--
-- A block now covers start_date..end_date (inclusive) and closes either:
--   * the whole day          period null, start_time null
--   * one period             period = 'morning' | 'afternoon' | 'evening'
--   * a time range           start_time..end_time (end may be 24:00 = midnight)
--
-- A time range closes a period only when it covers the period's full hours
-- (hours come from app_settings 'booking'). A partial overlap leaves the
-- period bookable; the app shows the closed hours as a notice.
-- ════════════════════════════════════════════════════════════════════

drop index if exists public.booking_blocks_date_period_idx;

alter table public.booking_blocks rename column block_date to start_date;
alter table public.booking_blocks add column end_date date;
update public.booking_blocks set end_date = start_date;
alter table public.booking_blocks alter column end_date set not null;
alter table public.booking_blocks add column start_time time;
alter table public.booking_blocks add column end_time time;

alter table public.booking_blocks
  add constraint booking_blocks_dates_check check (end_date >= start_date),
  add constraint booking_blocks_times_check check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time and period is null)
  );

create index booking_blocks_range_idx on public.booking_blocks (start_date, end_date);

-- Hours of a period from settings (defaults if missing). '00:00' as an end means midnight.
create function public.booking_period_bounds(p_key text, out p_start time, out p_end time)
language sql
stable
as $$
  with s as (
    select coalesce(
      (select p from public.app_settings, jsonb_array_elements(value -> 'periods') p
       where key = 'booking' and p ->> 'key' = p_key),
      case p_key
        when 'morning' then '{"start":"09:00","end":"12:00"}'::jsonb
        when 'afternoon' then '{"start":"12:00","end":"17:00"}'::jsonb
        when 'evening' then '{"start":"17:00","end":"00:00"}'::jsonb
      end
    ) as p
  )
  select
    (p ->> 'start')::time,
    case when (p ->> 'end') in ('00:00', '24:00') then '24:00'::time else (p ->> 'end')::time end
  from s;
$$;

-- Is this period (or the whole day when p_period is null) closed on p_day?
create function public.booking_is_blocked(p_day date, p_period text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.booking_blocks bb
    left join lateral public.booking_period_bounds(p_period) pb on p_period is not null
    where p_day between bb.start_date and bb.end_date
      and (
        (bb.period is null and bb.start_time is null)                -- whole day
        or (p_period is not null and bb.period = p_period)            -- this period
        or (p_period is not null and bb.start_time is not null        -- time range covering it
            and bb.start_time <= pb.p_start and bb.end_time >= pb.p_end)
      )
  );
$$;

-- Return shape changes (closed_hours), so drop and recreate.
drop function if exists public.booking_availability(date, date);

create function public.booking_availability(p_from date, p_to date)
returns table (
  day date,
  booked integer,
  max_per_day integer,
  is_full boolean,
  blocked_periods text[],
  whole_day_blocked boolean,
  closed_hours text[]
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
  with days as (
    select d::date as d from generate_series(p_from, p_to, interval '1 day') d
  ),
  counts as (
    select b.booking_date as d, count(*)::integer as n
    from public.bookings b
    where b.booking_date between p_from and p_to
      and public.booking_status_takes_capacity(b.status)
    group by b.booking_date
  )
  select
    days.d,
    case when v_visible then coalesce(c.n, 0) end,
    case when v_visible then v_max end,
    v_visible and v_max is not null and coalesce(c.n, 0) >= v_max,
    coalesce((
      select array_agg(k) from unnest(array['morning', 'afternoon', 'evening']) k
      where public.booking_is_blocked(days.d, k)
    ), '{}'),
    public.booking_is_blocked(days.d, null),
    coalesce((
      select array_agg(to_char(bb.start_time, 'HH24:MI') || '-' ||
                       case when bb.end_time = '24:00'::time then '24:00' else to_char(bb.end_time, 'HH24:MI') end
                       order by bb.start_time)
      from public.booking_blocks bb
      where days.d between bb.start_date and bb.end_date and bb.start_time is not null
    ), '{}')
  from days
  left join counts c on c.d = days.d
  order by days.d;
end;
$$;

-- Customer guard now uses the range-aware check.
create or replace function public.bookings_check_schedule()
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
  if public.booking_is_blocked(new.booking_date, null)
     or (new.booking_time in ('morning', 'afternoon', 'evening')
         and public.booking_is_blocked(new.booking_date, new.booking_time)) then
    raise exception 'BOOKING_PERIOD_BLOCKED: this time is closed for booking';
  end if;
  return new;
end;
$$;
