# Black Bubble Wash — Project Notes

Single source of truth for what exists, how it fits together, and what is
left to do. **Update the "Work log" and "Open items" sections every time
something is built or changed.**

---

## 1. The system at a glance

| Part | Path | Stack | Who uses it |
|---|---|---|---|
| Manager dashboard | `~/bubble-car-dashboard` | Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui | Managers / staff (web) |
| Customer app | `~/bubble-car` | Expo 57, React Native 0.86, i18next | Customers (iOS / Android) |
| Backend | Supabase (Postgres + Auth + RLS) | — | Both apps talk to it directly |

- Both apps are bilingual **English / Arabic** (RTL supported).
  - Dashboard strings: `src/i18n/en.ts`, `src/i18n/ar.ts`
  - Mobile strings: `src/i18n/en.json`, `src/i18n/ar.json`
- Currency is **EGP**.
- Roles live on `profiles.role`: `customer` | `staff` | `manager`.
  SQL helpers `is_manager(uid)` and `is_staff_or_manager(uid)` are used in RLS policies.
- The dashboard has server API routes (in `src/app/api/admin/...`) that use the
  **service role key** for actions RLS cannot allow (delete user, create user,
  update a booking). They accept either the dashboard cookie session or a
  mobile `Authorization: Bearer <token>` (see `src/lib/supabase/authenticate-manager.ts`).

### Environment
Dashboard `.env.local` (see `.env.example`):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only).

---

## 2. Data model (Supabase `public` schema)

> `bubble-car/supabase/schema.sql` is the **original** schema and is out of
> date. The live database has evolved beyond it. New changes go in
> `bubble-car-dashboard/supabase/migrations/` (one dated file per change,
> run manually in Supabase → SQL Editor).

| Table | Purpose / key columns |
|---|---|
| `profiles` | One per auth user. `full_name`, `phone`, `address`, `role`, `phone_verified` |
| `cars` | Customer vehicles. `owner_id`, `plate`, `make_id`, `model_id`, `car_type`, `custom_label`, `year` |
| `car_makes`, `car_models` | Catalog managed in dashboard. A model has a `car_type` |
| `packs` | A single wash service (e.g. Exterior, Full Detail). `name_en/ar`, `description_en/ar`, `active`, `icon` (mobile card icon, null = default) |
| `pack_prices` | Price of a pack per `car_type` (`sedan`, `hatchback`, `suv`, `pickup`, `van`, `other`) |
| `payment_methods` | Cash / Vodafone Cash / InstaPay … `account_info` set ⇒ customer must enter a transaction reference |
| `bookings` | One wash. Snapshots pack name, car type, price, payment method label. `status`, `booking_date`, `booking_time` (period key `morning`/`afternoon`/`evening` or null = any time; old rows have clock times), `payment_reference`, `expires_at`, **`user_package_id`** |
| `otp_codes` | Phone verification codes |
| `message_broadcasts` | Queue of bulk messages sent from Users page |
| **`packages`** | Monthly package offer. `name_en/ar`, `description_en/ar`, `active` |
| **`package_items`** | Packs inside a package + `quantity` (can mix packs) |
| **`package_prices`** | Fixed package price per `car_type` (set by manager) |
| **`user_packages`** | A customer's purchase, for **one car**. `status`, `price`, payment fields, `starts_at`, `expires_at` |
| **`user_package_items`** | Snapshot of items at purchase time (editing a package never changes past purchases) |
| **`user_package_balances`** (view) | Per purchase × pack: `quantity`, `used`, `remaining` |
| **`app_settings`** | Key/value settings from Dashboard → Settings. Key `booking` = `{ max_per_day, show_capacity_to_customers, periods[] }`. Apps fall back to defaults if missing |
| **`booking_blocks`** | Closure from `start_date` to `end_date`: whole day, one `period`, or a `start_time`–`end_time` range (end `24:00` = midnight) |
| `booking_availability(from, to)` (RPC) | Per day: booked count, max, `is_full`, blocked periods. Customers only see counts/full when the owner allows it |

### Booking statuses
`draft → awaiting_payment_proof → pending_review → confirmed → arrived → in_progress → completed`
Side exits: `cancelled`, `rejected`, `no_show`, `expired`.
The customer app creates a `draft`, then walks it to `pending_review`; staff
take it from there in the dashboard (Overview → manage reservation).

---

## 3. Feature: Monthly packages (added 2026-10-08)

**Idea:** sell a bundle of washes (e.g. *4× Exterior + 1× Full Detail*) at a
discounted fixed price, valid for one car for one month.

**Decisions taken with the owner**
1. Price is a **fixed price per car type**, set by the manager (not a % discount).
   The dashboard shows the "regular" price next to it so the discount is visible.
2. A purchase is tied to **one car**.
3. Unused washes **expire** — validity is **1 month after the manager activates it**.
   (To change to calendar-month end, edit `interval '1 month'` in the two
   `user_packages_*` trigger functions.)
4. Payment uses the **same flow as bookings**: customer picks a payment method,
   enters a transaction code, manager reviews and activates.
5. A package can **mix several packs**, each with its own quantity.

**Flow**
1. Manager creates package — Dashboard → *Monthly Packages*.
2. Customer buys — App → Home → *Monthly packages* → choose car, package, payment → `user_packages` row with status `pending_review`.
3. Manager activates — Dashboard → *Customer Packages* → **Activate** (sets `starts_at`, `expires_at`). Or **Reject**.
4. Customer books — App → *Book a wash*: if the car has an active package with washes left for the chosen pack, a **"Use my package"** option appears (on by default). Price = 0, payment section hidden. Booking carries `user_package_id`.
5. Booking goes through the normal review flow. A booking that ends `cancelled`, `rejected` or `expired` **gives the wash back**; `no_show` consumes it.

**Rules enforced by the database** (`supabase/migrations/20261008_packages.sql`)
- Purchase price/names/car type are copied from the server, never trusted from the app.
- Customers can only create `pending_review` purchases and only cancel while pending.
- Package booking is rejected unless: same customer, same car, package active and
  not expired, booking date ≤ expiry, and that pack still has washes left
  (row lock prevents double-spending the last wash).
- Error codes raised (`PACKAGE_NO_WASHES_LEFT`, `PACKAGE_NOT_ACTIVE`, …) are
  translated in the app by `src/lib/authErrors.ts`.
- `expire_stale_user_packages()` flips old `active` rows to `expired`
  (called when the Customer Packages page loads).

**Files**
- Dashboard: `src/app/(dashboard)/packages/page.tsx`, `src/app/(dashboard)/customer-packages/page.tsx`,
  package badge on Overview, nav in `src/app/(dashboard)/layout.tsx` + `src/components/dashboard-header.tsx`.
- Mobile: `src/screens/PackagesScreen.tsx`, package option in `src/screens/BookScreen.tsx`,
  helpers in `src/lib/catalog.ts` (`fetchPackages`, `fetchMyPackages`, `usablePackage`),
  Home entry row, route in `App.tsx`.

---

## 3b. Feature: Settings, daily capacity, periods (added 2026-10-09)

**Decisions taken with the owner**
- Open **every day**; same-day booking allowed; no limit on how far ahead.
- Customers pick a **period, not a time**: Morning 9–12, Afternoon 12–17, Evening 17–00 — optional ("any time"). Hours and on/off per period are editable in Settings.
- **Max bookings per day** (counts confirmed / arrived / in progress / completed). Owner chooses whether customers see "day is full". When shown, customers are **warned but can still request**.
- Owner can **block** a date range (one or more days): the whole day, one period, or a **time range** (e.g. 14:00→16:00). A time range closes the periods it fully covers; a partly covered period stays bookable and the app shows the closed hours. Customers can't book a closed period/day; staff still can. (Migration `20261010_block_ranges.sql`.)
- Staff get a warning when confirming a booking on a full day; Overview shows today's load.
- Service icons per pack, editable in Settings (defaults built in).

**Files**: migration `supabase/migrations/20261009_settings_capacity.sql`; dashboard `src/app/(dashboard)/settings/page.tsx`, `src/lib/booking-settings.ts`; mobile `src/lib/settings.ts`. Defaults live in both `booking-settings.ts` (dashboard) and `settings.ts` (mobile) — keep them in sync.

## 3c. Mobile UX redesign (2026-10-09)
Implemented from [MOBILE_UX_PLAN.md](MOBILE_UX_PLAN.md): 5-tab nav (Home · Bookings · **+Book** · Packages · Me), 3-step booking with 2-column service cards and a "use 1 wash from your package?" bottom sheet, real confirmation screen, Home with package card instead of services/VIP, Packages tab with buy sheet, Upcoming/Past bookings with package tag, friendly errors.

## 4. Work log

| Date | Change |
|---|---|
| 2026-07-12 | Dashboard initial commit: overview, users (filters, bulk actions, history, broadcast), packs & pricing, payment methods, car catalog, EN/AR, admin delete-user API |
| ≤ 2026-10-08 | Manage-booking dialog + `PATCH /api/admin/bookings/[id]`; add-user dialog + `POST /api/admin/users` (create user works) |
| ≤ 2026-10-08 | Mobile: catalog-driven booking (makes/models, packs with per-car-type prices, payment methods, transaction reference) |
| 2026-10-08 | **Monthly packages** feature (DB migration, 2 dashboard pages, mobile Packages screen, "use my package" in booking) + this document |
| 2026-10-08 | Mobile UX redesign proposal written: [MOBILE_UX_PLAN.md](MOBILE_UX_PLAN.md) |
| 2026-10-10 | Blocked periods support **date ranges** and **time ranges**; app shows closed hours |
| 2026-10-09 | Dashboard **Settings** page (booking rules, blocked periods, service icons), daily capacity + today's load on Overview; mobile **UX redesign** implemented |
| 2026-10-12 | **Payment proof**: customer app sends a transaction number and/or receipt screenshot (bucket `payment-proofs`, path `<user id>/<file>`); Overview → manage reservation shows method, copyable number and the receipt image; receipt icon in the bookings table |

---

## 5. Open items / ideas

- [x] Ran `supabase/migrations/20261008_packages.sql` in Supabase (2026-10-08, verified).
- [ ] Overview "Revenue this month" counts only completed bookings — package sales are not included yet.
- [x] Ran `20261009_settings_capacity.sql` (verified 2026-10-09).
- [x] Ran `20261010_block_ranges.sql` (verified 2026-10-10).
- [x] Mobile History / Booking details show "paid by package".
- [ ] Schedule `expire_stale_user_packages()` with pg_cron (today it runs when the dashboard page opens; the app and DB checks already treat expired rows correctly).
- [ ] Run `20261012_payment_proofs.sql` (adds `bookings.payment_proof_path` + private `payment-proofs` storage bucket and policies).
- [ ] Package purchases (`user_packages`) still only take a transaction reference, no receipt image.
- [ ] Bring `bubble-car/supabase/schema.sql` up to date with the live schema (or dump it into a baseline migration).
- [ ] VIP points card on mobile Home is still placeholder data.
- [ ] Lint: `src/app/(dashboard)/page.tsx` `loadData()` in `useEffect` trips `react-hooks/set-state-in-effect`.
