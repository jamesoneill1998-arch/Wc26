# Binder — Pokémon card collecting & buying

An interactive dashboard for tracking what you own, what it's worth, and what
you want to buy next. It lives at **`/pokemon`** (hash routes per tab, e.g.
`/pokemon#/collection`). The WC26 app at `/` is untouched; `src/main.jsx`
picks one at load time and Vite code-splits them, so each visitor downloads
only the app they opened.

## The tabs

| Tab | What it does |
|---|---|
| **Dashboard** | Collection value, invested, unrealized gain/loss, money-invested-over-time chart, value by set and rarity, top holdings |
| **Market** | Search / filter the catalog by set, rarity, type and price; open a card for prices, buy links and a purchase form |
| **Collection** | Every purchase lot — sortable, editable in place, with JSON export / import |
| **Wishlist** | Target prices, a monthly budget, and a "what fits this month" buy plan |
| **Sets** | Per-set completion meters and a drill-down grid of what's still missing |
| **Packs** | A booster-pack simulator; pulls can be logged with the pack price split across them |

## Data

- **Catalog** (`catalog.js`) — ~60 cards across 11 sets, shipped with the app so
  everything works offline. Its prices are **sample guide prices**, labelled as
  such in the UI.
- **Live prices** (`api.js`) — "Sync live prices" in the Market tab pulls real
  TCGplayer/Cardmarket figures from the [Pokémon TCG API](https://pokemontcg.io/)
  and stamps them "live". Failure is non-fatal: the app falls back to the sample
  prices and says so. Set `VITE_POKEMONTCG_KEY` to raise the rate limit.
- **Card art** loads from `images.pokemontcg.io`. Anything that fails to load
  falls back to a CSS card face, so a blocked or offline request never shows a
  broken image.
- **Your data** lives in `localStorage` under `pkmn-binder-v1` — nothing is sent
  anywhere. First run seeds a sample collection; the Collection tab can clear it.

## Valuation model

A copy is worth its card's near-mint price × a condition factor (`CONDITIONS`
in `catalog.js`): LP ×0.8, MP ×0.6, HP ×0.4, damaged ×0.25, PSA 8 ×1.6,
PSA 9 ×2.6, PSA 10 ×7.5. These are rules of thumb for tracking a collection,
not appraisals, and the dashboard says so.

## Charts

`charts.jsx` holds the primitives (stat tile, bar chart, line chart, meter).
They follow one house style: one series per chart unless a legend is present,
thin marks, hairline solid grid, values direct-labelled at bar tips, and a
table-view twin on every chart so no number is reachable only by hover. Colors
come from CSS custom properties in `styles.css`, with light and dark each a
selected set of steps rather than an automatic inversion.

## Files

```
PokemonApp.jsx   app shell, tab nav, theme toggle
store.js         useBinder() — localStorage state + derived portfolio maths
catalog.js       card catalog, sets, conditions, formatting, buy links
api.js           optional Pokémon TCG API client (prices + search)
charts.jsx       chart primitives
components.jsx   card art, tiles, modal, card detail + purchase form
styles.css       tokens and all app styling
views/           one file per tab
```
