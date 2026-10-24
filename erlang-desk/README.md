# Erlang Desk

Forecasting and capacity planning for contact centres, in the browser.

- **Forecast**: four methods (trend + weekly + annual seasonality regression, damped Holt-Winters, 6-week weekday average and same-day-last-week) are backtested on the last 28 days of your history. The most accurate one is picked automatically, and its accuracy (WAPE) and bias are shown.
- **Intraday staffing**: each forecast day is spread across 15, 30 or 60-minute intervals using the arrival pattern learnt from your data. Erlang C then gives the agents each interval needs, with service level, ASA ceiling, occupancy cap, chat concurrency and minimum cover.
- **Capacity plan**: 13 to 52 weeks of required FTE (after shrinkage) against available FTE (after attrition, training and nesting). It suggests hiring classes and flags any shortfall that falls inside the hiring lead time.
- **Erlang C calculator**: a free single-interval calculator. It brings in search traffic and acts as the free tier.
- **Private by design**: all maths runs client-side. Workspaces live in the browser's `localStorage` and can be exported or imported as JSON.

## Run it

```bash
cd erlang-desk
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit tests (node --test, no extra deps)
npm run build    # production build in dist/
```

Click **Try it with sample data** to load two years of realistic 30-minute history.

## Deploy (Vercel)

This app lives in a subfolder of the `Wc26` repo, so give it its own Vercel project:

1. Vercel → **Add New Project** → import this repo.
2. Set **Root Directory** to `erlang-desk`. The framework is detected as Vite.
3. Optional environment variables:

| Variable | Purpose |
|---|---|
| `VITE_STRIPE_PRO_URL` | Stripe Payment Link for the Pro plan's button |
| `VITE_STRIPE_TEAM_URL` | Stripe Payment Link for the Team plan's button |
| `VITE_CONTACT_EMAIL` | Shows a Contact link in the footer |
| `VITE_CURRENCY_SYMBOL` | Defaults to `$`; set `£` or `€` to suit your market |

Prices and plan copy are in `src/config.js`.

## Data format

CSV with a header row. Column names are matched loosely (`calls`, `offered` and `contacts` are all read as volume).

```csv
date,time,volume,aht
2026-01-05,08:00,42,315
2026-01-05,08:30,61,298
```

- `time` is optional. Without it the file is read as daily totals and a default intraday curve is shaped from your opening hours.
- `aht` is optional, in seconds. Without it the default AHT from Settings is used.
- Dates can be `YYYY-MM-DD`, `DD/MM/YYYY` or `MM/DD/YYYY`; the order is detected from the data. Comma, semicolon and tab delimiters all work.

## Code map

```
src/engine/      pure, tested maths: no React, reusable server-side later
  erlang.js      Erlang B/C, service level, ASA, required agents
  forecast.js    forecasting methods, backtest, prediction band
  profiles.js    intraday arrival and AHT profiles
  capacity.js    interval -> weekly FTE, supply simulation, hiring recommender
  csv.js         import/export
  sample.js      deterministic demo data
src/state/       workspace persistence and the derived planning model
src/pages/       one file per screen
src/components/  charts (SVG, no chart library) and form widgets
test/            node:test suites for the engine
```

## Model notes and limits

- Erlang C assumes nobody abandons. When abandonment is high it slightly overstates the agents needed. Erlang A (with patience) is on the roadmap.
- Chat concurrency is approximated by treating each agent as *k* servers.
- The 80% forecast band comes from the spread of backtest errors and widens with the horizon. Treat it as an indication, not a statistical guarantee.
- Attrition is applied evenly every week, to new starters as well as tenured staff.
