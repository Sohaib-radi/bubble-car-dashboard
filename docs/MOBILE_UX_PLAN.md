# Mobile App — UX Redesign Plan

Status: **implemented 2026-10-09** (proposal 2026-10-08)

**Owner decisions (replace section 7 questions):** open all days · periods Morning / Afternoon / Evening until midnight, optional, hours editable in Dashboard → Settings · no booking-ahead limit, same-day allowed · daily max set in Settings, owner decides if customers see "full" (warning, not blocking) · owner can block a period/day · service icons default + editable in Settings · tab name **Packages**.
Applies to: `~/bubble-car` (customer app). Related: [PROJECT.md](PROJECT.md).

---

## 1. What is wrong today

| Problem | Where | Why it hurts |
|---|---|---|
| Booking is **one long screen with 6 decisions** (car, add car, service, payment, day, exact time) | `BookScreen` | Users scroll up and down, miss fields, don't know what is left to do |
| Exact time slots (09:00, 10:30…) | `BookScreen` | False precision: the shop doesn't work to the minute; users hesitate |
| Only Mon–Fri of *this* week can be picked | `BookScreen` | Can't book next week; weekday labels without month are confusing |
| Services shown as a thin list with 11px descriptions | `BookScreen`, `HomeScreen` | Hard to read, hard to tap, everything looks the same |
| "Our services" on Home duplicates the booking screen | `HomeScreen` | Noise; pushes the important things (subscription, upcoming wash) down |
| VIP card with **fake points** (1,240 pts) | `HomeScreen` | Looks broken once users notice it never changes |
| Subscription option is a small checkbox under the services | `BookScreen` | Users don't notice they have free washes, or use one by accident |
| Packages screen mixes "my packages", car, plans, payment in one scroll | `PackagesScreen` | Same overload problem as booking |
| Confirmation screen shows **hard-coded data** (Tue 1 Jul, 14:30, #BB2471) | `ConfirmedScreen` | Wrong information right after paying = loss of trust |
| Raw server errors (`{"status":500,…}`) | `RegisterScreen` | Scary and meaningless for customers |

---

## 2. Principles

1. **One decision per screen.** Booking becomes 3 short steps with a progress bar.
2. **Big tappable cards** (min 48px touch target), body text ≥ 14px, captions ≥ 12px.
3. **Show money and remaining washes clearly** — numbers are the hero, not the labels.
4. **Subscription first.** If the user has free washes, the app says so before asking for money.
5. **Confirm before spending a credit** (bottom-sheet dialog, friendly wording).
6. **Never show raw errors.** Every failure has a human message + what to do next.
7. **Same look in Arabic** — every layout mirrored, no hard-coded left/right.

---

## 3. New navigation

```
┌───────────────────────────────────────────────┐
│  Home    Bookings    [ + Book ]    Plans   Me │   ← 5 tabs, "Book" is a raised gold button
└───────────────────────────────────────────────┘
```

| Tab | Screen | Replaces |
|---|---|---|
| Home | Dashboard of *my* stuff | HomeScreen |
| Bookings | Upcoming + past bookings | HistoryScreen |
| **+ Book** | 3-step booking flow | BookScreen |
| Plans | My subscription + buy a plan | PackagesScreen (new tab, was hidden behind Home) |
| Me | Profile, cars, language, logout | ProfileScreen |

---

## 4. Screens

### 4.1 Home — "what matters to me now"

```
┌─────────────────────────────────┐
│ Good evening,              (SR) │
│ Sohaib                     🌐   │
├─────────────────────────────────┤
│ ╔═════════════════════════════╗ │  ← A) has active subscription
│ ║ MONTHLY 5 WASHES     ACTIVE ║ │
│ ║ Mercedes C300 · 234 ABC     ║ │
│ ║                             ║ │
│ ║   3            1            ║ │
│ ║ Exterior     Full detail    ║ │  ← big numbers = washes left
│ ║ left         left           ║ │
│ ║ ▓▓▓▓▓▓▓▓░░░  valid to 8 Nov ║ │
│ ║ [ Use a free wash → ]       ║ │
│ ╚═════════════════════════════╝ │
│                                 │
│ ┌─ or ── B) no subscription ──┐ │
│ │ Save up to 25% every month  │ │
│ │ 5 washes from EGP 900       │ │
│ │ [ See plans ]               │ │
│ └─────────────────────────────┘ │
│                                 │
│ UPCOMING                See all │
│ ┌─────────────────────────────┐ │
│ │ 12 │ Exterior Wash          │ │
│ │ OCT│ Sun · Morning · C300   │ │
│ │    │ ● Confirmed            │ │
│ └─────────────────────────────┘ │
│  (empty: "No wash planned —     │
│   [Book a wash]")               │
└─────────────────────────────────┘
```

- **Removed:** "Our services" grid and the fake VIP points card.
- Subscription card replaces the VIP card (same gold style, but real data).
- Pending subscription shows: *"Plan requested — we'll activate it after confirming your payment."*

### 4.2 Booking — 3 steps

Progress bar on top: `● Service ── ○ Date ── ○ Confirm`
Sticky bottom bar on every step: summary on the left, **Continue** on the right.

#### Step 1 — Car & service

```
┌─────────────────────────────────┐
│ ←  Book a wash          1 of 3  │
│ ▓▓▓▓▓▓░░░░░░░░░░░░              │
│                                 │
│ YOUR CAR                        │
│ ┌──────────────┐ ┌────┐         │  ← horizontal chips, scroll sideways
│ │🚗 C300 234ABC│ │ +  │         │
│ └──────────────┘ └────┘         │
│                                 │
│ ╔═════════════════════════════╗ │  ← only if this car has a plan
│ ║ 🎟  Your plan: Monthly 5    ║ │
│ ║ Exterior 3 left · Full 1    ║ │
│ ║ Valid until 8 Nov           ║ │
│ ║ Tap a service marked FREE   ║ │
│ ╚═════════════════════════════╝ │
│                                 │
│ CHOOSE A SERVICE                │
│ ┌─────────────┐ ┌─────────────┐ │  ← 2 per row, 4 visible,
│ │   (icon)    │ │   (icon)    │ │     page scrolls for more
│ │ Exterior    │ │ Full detail │ │
│ │ Foam, rinse │ │ In + out    │ │
│ │ ┌─FREE ×3─┐ │ │  EGP 450    │ │  ← FREE badge when plan covers it
│ └─────────────┘ └─────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ │
│ │ Interior    │ │ Engine      │ │
│ │  EGP 200    │ │  EGP 300    │ │
│ └─────────────┘ └─────────────┘ │
│            ⋮ (scroll)           │
├─────────────────────────────────┤
│ Exterior · FREE   [ Continue ]  │
└─────────────────────────────────┘
```

**Service card** (2 columns, ~160×150): icon on top, name (15px bold),
1-line description (13px), price at the bottom (gold).
Selected = gold border + check badge in the corner.
If the car's plan covers it: price replaced by a green **FREE · 3 left** badge.

**Using the subscription — confirmation dialog** (bottom sheet, opens when
the user taps a FREE service):

```
┌─────────────────────────────────┐
│            ───                  │
│        🎟  (gold circle)        │
│                                 │
│   Use 1 wash from your plan?    │
│                                 │
│  Service     Exterior Wash      │
│  Car         C300 · 234 ABC     │
│  Plan        Monthly 5 Washes   │
│                                 │
│  ┌───────────────────────────┐  │
│  │ After this: 2 of 4         │ │
│  │ Exterior washes left       │ │
│  └───────────────────────────┘  │
│                                 │
│ [   Yes, use my plan  (FREE)  ] │  ← gold
│ [   No, pay EGP 250 instead   ] │  ← outline
└─────────────────────────────────┘
```

Message tone: *"Good choice! This wash is covered by your plan — nothing to pay."*
If the user chooses "pay instead", the service stays selected as a paid wash.

#### Step 2 — Date & preferred time (time optional)

```
┌─────────────────────────────────┐
│ ←  When?                2 of 3  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░              │
│                                 │
│ DATE                   October  │
│ ┌───┐┌───┐┌───┐┌───┐┌───┐┌───┐  │  ← next 14 days, scroll sideways
│ │SUN││MON││TUE││WED││THU││FRI│  │     closed days greyed out
│ │ 12││ 13││ 14││ 15││ 16││ 17│  │     "Today" / "Tomorrow" labels
│ └───┘└───┘└───┘└───┘└───┘└───┘  │
│                                 │
│ PREFERRED TIME  (optional)      │
│ ┌───────────┐┌───────────┐┌───┐ │
│ │ ☀ Morning ││ 🌤 Afternoon││🌙 │ │  ← 3 big cards, tap again to clear
│ │ 9 – 12    ││ 12 – 5     ││5–9│ │
│ └───────────┘└───────────┘└───┘ │
│ "No preference — we'll call     │
│  you to agree on a time."       │
├─────────────────────────────────┤
│ Sun 12 Oct · Any time [Continue]│
└─────────────────────────────────┘
```

Stored in the existing `bookings.booking_time` column as
`morning` | `afternoon` | `evening` | `null` (no DB change needed).

#### Step 3 — Review & pay

```
┌─────────────────────────────────┐
│ ←  Confirm              3 of 3  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓              │
│ ┌─────────────────────────────┐ │
│ │ Exterior Wash        Edit   │ │  ← each row jumps back to its step
│ │ C300 · 234 ABC       Edit   │ │
│ │ Sun 12 Oct · Morning Edit   │ │
│ └─────────────────────────────┘ │
│                                 │
│ PAYMENT                         │  ← hidden when paid by plan:
│ ○ Cash on arrival               │     shows "🎟 Covered by your plan"
│ ● Vodafone Cash                 │
│   Send to 010xxxxxxx then       │
│   enter the transaction code    │
│   [ Transaction code       ]    │
├─────────────────────────────────┤
│ Total EGP 250  [Confirm booking]│
└─────────────────────────────────┘
```

#### Done screen (real data)

```
        ✓  (animated gold check)
   Booking received!
   We'll confirm it shortly.

   Exterior Wash · C300
   Sun 12 Oct · Morning
   Ref #A3F9   ·   FREE with your plan
   (2 Exterior washes left)

   [ View booking ]   [ Back home ]
```

### 4.3 Plans tab (subscriptions)

**Top: my plan** (same card as Home) or the pending notice.
**Below: available plans** as large cards, one per row:

```
┌─────────────────────────────────┐
│ MONTHLY 5 WASHES     SAVE 25% ✦ │
│ 4× Exterior  ·  1× Full detail  │
│                                 │
│ EGP 900 / month                 │
│ instead of EGP 1,200 (struck)   │
│ ✓ For one car  ✓ Valid 1 month  │
│ [ Choose this plan ]            │
└─────────────────────────────────┘
```

**Buy flow** = bottom sheet with 2 short steps:
1. Which car? (car chips — price updates for the car type)
2. Payment method + transaction code → **Request plan**

Success message: *"Request sent! We'll activate your plan as soon as we confirm
your payment — usually within a few hours."*

### 4.4 Bookings tab

- Segments: **Upcoming** | **Past**
- Each row: date tile, service, car, period, status pill, and a 🎟 *Plan* tag when paid by subscription.
- Booking details: add "Paid with: Monthly 5 Washes" and a **Cancel booking** button while pending.

### 4.5 Errors, loading, empty states

- Loading: grey skeleton cards (not blank screens).
- Every list has an empty state with one clear action.
- Errors: translated sentence + retry button. Map server/auth errors
  (500 on signup, network down) to friendly messages, never show JSON.

---

## 5. Visual rules (keep current black + gold identity)

| Token | Value |
|---|---|
| Screen padding | 20 |
| Gap between sections | 24 |
| Card radius | 18 |
| Title | 22 bold |
| Section label | 12 bold, uppercase, letter-spacing 1.5 |
| Body | 15 semibold |
| Caption | 13 medium (never below 12) |
| Touch target | ≥ 48 high |
| "Free / success" color | `colors.success` (green) |
| Money | gold, bold |

---

## 6. Implementation phases

| # | Work | Files |
|---|---|---|
| 1 | Shared UI pieces: `ServiceCard`, `PlanCard`, `BottomSheet`, `StepHeader`, `StickyFooter`, `EmptyState`, `Skeleton` | `src/components/` |
| 2 | New 3-step booking + subscription confirm sheet + real Done screen | `src/screens/book/*`, `ConfirmedScreen` |
| 3 | New Home (plan card, upcoming, no services/VIP) | `HomeScreen` |
| 4 | Plans tab + buy sheet; 5-tab nav with raised Book button | `PackagesScreen`, `BottomNav`, `App.tsx` |
| 5 | Bookings tab segments, plan tag, details "paid with" | `HistoryScreen`, `BookingDetailsScreen` |
| 6 | Friendly errors everywhere | `authErrors.ts`, Register/Login |
| 7 | Dashboard: show period (Morning/Afternoon/Evening) in bookings | dashboard Overview + manage dialog |

---

## 7. Questions for the owner

1. **Opening days:** which days is the shop open? (Today the app allows Mon–Fri only.)
2. **Time periods:** OK with Morning 9–12, Afternoon 12–5, Evening 5–9? Correct hours?
3. **How far ahead** can customers book? (Proposal: 14 days, same-day allowed.)
4. **Service images/icons:** do you have photos per pack, or should we use icons?
5. **Tab name:** "Plans", "Subscriptions" or "Packages"? (Arabic proposal: «اشتراكاتي»)
