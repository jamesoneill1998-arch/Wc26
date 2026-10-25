# Erlang Desk

Forecasting, staffing and capacity planning for contact centres, back offices and branch networks. It runs in the browser, so customer data never leaves the device.

## What it does

| Area | Detail |
|---|---|
| **Channels** | Voice (Erlang A with abandonment, or Erlang C), chat (Erlang A × concurrency), back office (workload ÷ utilisation, smoothed over a turnaround SLA, with weekend work rolled forward) and branch (Erlang C per branch × number of branches, with minimum cover). |
| **Sites** | Each site has itemised shrinkage (leave, sickness, breaks, training, meetings, other), contracted hours and attrition. Defaults are UK 35% / 37.5h and offshore 20% / 40h, all editable. |
| **Forecast** | Contacts-by-interval heatmap for any forecast week. Trend + weekly + annual regression, damped Holt-Winters, weekday average and same-day-last-week are backtested on recent history. The most accurate is chosen automatically and its accuracy and bias are shown. Planners can add a % overlay. |
| **Intraday** | Staff needed per 15/30/60-minute interval, with service level, abandonment, occupancy and rostered numbers. Back office gets a daily workload view instead. |
| **Schedule & coverage** | Shift patterns (people per shift per weekday) or an imported roster CSV are turned into staff on duty per interval, after breaks and in-day shrinkage. Heatmaps show short/over, required, rostered and projected service level per interval, with figures for projected weekly service level, short and over hours, and rostered FTE. "Suggest shifts" builds a first-draft roster from the requirement. |
| **Capacity** | 13–52 weeks of required FTE against available FTE, through attrition, training and nesting. Suggests hiring classes and flags shortfalls that hiring can't reach in time. |
| **Impact assessment** | For change delivery. An aggregate monthly plan per business area (forecast volume, AHT, operational and MTP FTE, pasted from Excel or filled from a service) converts to required FTE and headroom. A change register then converts each change into contacts, workload and FTE by month. Drivers: new-business volumes (e.g. 25,000 acquisitions × contacts each, spread over the following months), volume % or contacts, AHT change on a share of calls, and training/abstraction. Each change is assessed after committed changes not already in the MTP, giving a verdict: absorbable, absorbable with overtime, not absorbable, or releases capacity. It also gives the shortfall, recruitment start date, cost and unmitigated service level, plus a copyable summary for the change board. |
| **Overview** | A "Needs attention" list (hiring deadlines, shortfalls hiring can't reach, changes over capacity), required vs available FTE by channel, and per-service trend sparklines. |
| **Overview (detail)** | Every service rolled up by channel and by site. |
| **Calculator** | Free Erlang A vs C for a single interval, rostered for each site. |
| **Accounts** | Passwordless sign-in, Stripe subscriptions (Pro and Team), and Team seat management. See [SECURITY.md](SECURITY.md). |

## Printing

Capacity plans and impact assessments have a Print button and a print layout (organisation name and date at the top, no navigation, panels kept whole), so they can go straight into a change-board or finance pack, or be saved as PDF.

## Run it locally

```bash
cd erlang-desk
npm install
npm run dev        # UI only, all features unlocked: http://localhost:5173
npm test           # engine, Erlang A simulation check, API security and billing tests
npm run build
```

Then click **Load the sample operation**: four services across a UK and an offshore site.

To run the API locally as well, use `npx vercel dev` with a `.env.local` copied from `.env.example`. Without `RESEND_API_KEY`, sign-in links are printed to the terminal (development only).

## Deploy (Vercel)

1. Vercel → **Add New Project** → import this repository and set **Root Directory** to `erlang-desk`.
2. Add the environment variables from `.env.example`. With `VITE_BILLING` left unset, the site runs as an open preview with no paywall.
3. **Stripe**: create a product with two recurring monthly prices (Pro £59, Team £199), put their IDs in `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM`, and turn on the customer portal (Settings → Billing → Customer portal) with cancellation allowed.
4. **Resend**: verify your sending domain and set `RESEND_API_KEY` and `EMAIL_FROM`.
5. **Upstash Redis** (free tier is enough) for shared rate limiting: set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
6. Add your domain in Vercel, set `APP_URL` to it, and redeploy.

Security headers (CSP, HSTS and the rest) are set in `vercel.json`.

## CSV format

```csv
date,time,volume,aht
2026-01-05,08:00,42,315
2026-01-05,08:30,61,298
```

`time` and `aht` (seconds) are optional. Dates can be `YYYY-MM-DD`, `DD/MM/YYYY` or `MM/DD/YYYY`. Common ACD headings such as "Calls Offered" are recognised. Comma, semicolon and tab delimiters all work.

## Schedule CSV format

```csv
agent,date,start,end,lunch_start,lunch_end
A123,2026-11-02,08:00,16:30,12:00,12:30
A124,2026-11-02,22:00,06:00,02:00,02:30
```

One row per shift. Overnight shifts are fine. Optional columns: `break_start`/`break_end`, `lunch_start`/`lunch_end`, `break_minutes` (staggered mid-shift when no times are given) and `headcount` (for aggregated rosters). Agent names and IDs are discarded on import; only times and counts are kept. Imported dates replace the shift patterns for those days.

## Code map

```
api/                Vercel serverless functions (no npm dependencies)
  _lib/             env, signed tokens, HTTP/cookie/CSRF helpers, rate limit, Stripe, email, sessions
  auth/             request (send link), verify (open link), logout
  billing/          checkout, portal
  me.js, team.js
src/engine/         pure maths, unit-tested, runs in a Web Worker
  erlang.js         Erlang B/C
  erlangA.js        Erlang A (M/M/N+M), validated against simulation
  channels.js       channel models, sites, shrinkage
  forecast.js       methods, backtest, prediction band
  capacity.js       interval/back-office requirements, weekly FTE, supply simulation, hiring
  schedule.js       rosters to interval coverage, projected service level, shift suggestions
  impact.js         aggregate FTE conversion, change drivers, absorbability, board summary
  compute.js        whole-workspace run with stage caching
src/state/          workspace store (validated and migrated), worker hook, account, sample data
src/pages/          one file per screen
test/               node:test suites
```

## Model notes

- Aggregate FTE = workload hours ÷ occupancy ÷ (1 − shrinkage) ÷ paid hours per FTE-month (weekly hours × 52 ÷ 12). Occupancy is a planning assumption, or comes from Erlang at the month's typical interval load × an intraday peak factor. Training and abstraction hours count as paid time, with no shrinkage gross-up.
- A change is absorbable when its incremental FTE fits inside operational FTE minus required FTE (after committed changes) minus the buffer, in every affected month. Overtime already used to cover committed work isn't counted again.

- Erlang A service level is "answered within threshold ÷ (offered − abandoned within threshold)", the usual reporting convention.
- Chat concurrency treats each agent as *k* servers.
- The forecast's 80% band comes from backtest error and widens with the horizon. Treat it as an indication.
- Attrition is applied evenly every week, to new starters as well as tenured staff.
