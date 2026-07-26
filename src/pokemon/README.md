# Binder — Pokémon card collecting & buying

An interactive dashboard for tracking what you own, what it's worth, and what
you want to buy next. It lives at **`/pokemon`** (hash routes per tab, e.g.
`/pokemon#/collection`). The WC26 app at `/` is untouched; `src/main.jsx`
picks one at load time and Vite code-splits them, so each visitor downloads
only the app they opened.

## The tabs

| Tab | What it does |
|---|---|
| **Dashboard** | Collection value, invested, unrealized gain/loss, money-invested-over-time chart, value by set and rarity, top holdings. Empty until you log something |
| **Market** | Search every card in the database by name, set, rarity and type, paged; open a card for prices, buy links and a purchase form |
| **Collection** | Every purchase lot — sortable, editable in place, with JSON export / import |
| **Wishlist** | Target prices, a monthly budget, and a "what fits this month" buy plan |
| **Sets** | Every set with completion measured against its real printed size, and a checklist drill-down of what's still missing |
| **Packs** | A booster-pack simulator; pulls can be logged with the pack price split across them |

## Data

The card database is the [Pokémon TCG API](https://pokemontcg.io/) — every set,
every card, real scans and real TCGplayer/Cardmarket prices — fetched straight
from the browser, so there is no server of our own to run.

- **`api.js`** is the client: sets, per-set checklists, name search, price
  refresh. Sets are cached in `localStorage` for a day; card pages are cached
  in memory for the session.
- **`data.js`** (`useCatalog`) is the layer views talk to. It serves live data
  when the API answers and the built-in catalog when it doesn't, behind one
  interface, and exposes a `status` of `loading` / `live` / `offline` that the
  UI states plainly on the Market and Sets tabs.
- **`catalog.js`** is the offline fallback: ~60 notable cards across 11 sets
  with **sample guide prices**, always labelled as such — never presented as
  live market data.
- **Card art** comes from `images.pokemontcg.io`. Anything that fails to load
  falls back to a CSS card face, so a blocked or offline request never shows a
  broken image.
- **Your data** lives in `localStorage` under `pkmn-binder-v1` — nothing is sent
  anywhere. A new collection **starts empty**; the Collection tab has an
  explicit "Load demo collection" button if you want to see the dashboard with
  data in it.
- `VITE_POKEMONTCG_KEY` raises the API rate limit if you want one; it is
  optional.

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
data.js          useCatalog() — the card database, live with offline fallback
api.js           Pokémon TCG API client (sets, cards, search, prices)
catalog.js       offline fallback catalog, conditions, formatting, buy links
charts.jsx       chart primitives
components.jsx   card art, tiles, modal, card detail + purchase form
styles.css       tokens and all app styling
views/           one file per tab
```
