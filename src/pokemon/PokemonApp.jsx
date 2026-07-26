import { useCallback, useEffect, useState } from "react";
import "./styles.css";
import { useBinder } from "./store.js";
import { CardDetail } from "./components.jsx";
import { fmtMoney } from "./catalog.js";
import Dashboard from "./views/Dashboard.jsx";
import Market from "./views/Market.jsx";
import Collection from "./views/Collection.jsx";
import Wishlist from "./views/Wishlist.jsx";
import Sets from "./views/Sets.jsx";
import Packs from "./views/Packs.jsx";

const TABS = [
  { id: "dashboard",  label: "Dashboard",  view: Dashboard },
  { id: "market",     label: "Market",     view: Market },
  { id: "collection", label: "Collection", view: Collection },
  { id: "wishlist",   label: "Wishlist",   view: Wishlist },
  { id: "sets",       label: "Sets",       view: Sets },
  { id: "packs",      label: "Packs",      view: Packs },
];

const tabFromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, "");
  return TABS.some((t) => t.id === id) ? id : "dashboard";
};

export default function PokemonApp() {
  const binder = useBinder();
  const [tab, setTab] = useState(tabFromHash);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    document.title = "Binder – Pokémon card collection tracker";
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((id) => {
    window.location.hash = `#/${id}`;
    setTab(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openCard = useCallback((card) => setDetail(card), []);
  const View = TABS.find((t) => t.id === tab).view;

  const up = binder.stats.gain >= 0;

  return (
    <div className="binder-app">
      <header className="app-bar">
        <a className="brand" href="#/dashboard" onClick={(e) => { e.preventDefault(); go("dashboard"); }}>
          <span className="brand-mark" aria-hidden="true">◓</span>
          <span className="brand-text">
            <strong>Binder</strong>
            <span>Pokémon card collecting &amp; buying</span>
          </span>
        </a>

        <div className="app-bar-stat" title="Estimated value of everything you have logged">
          <span className="cell-sub">Collection</span>
          <strong>{fmtMoney(binder.stats.value, { compact: true, cents: 0 })}</strong>
          <span className={up ? "tone-good" : "tone-bad"}>
            <span aria-hidden="true">{up ? "▲" : "▼"}</span> {fmtMoney(Math.abs(binder.stats.gain), { cents: 0 })}
          </span>
        </div>

        <button
          type="button"
          className="ghost-btn sm theme-toggle"
          onClick={() => binder.setTheme(binder.theme === "dark" ? "light" : "dark")}
          aria-label={`Switch to ${binder.theme === "dark" ? "light" : "dark"} theme`}
        >
          {binder.theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      </header>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? "tab active" : "tab"}
            aria-current={t.id === tab ? "page" : undefined}
            onClick={() => go(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        <View binder={binder} onOpen={openCard} />
      </main>

      <footer className="app-foot">
        <p>
          Data is stored only in this browser — export from the Collection tab to keep a copy.
          Card prices are built-in samples unless you sync live prices from the{" "}
          <a href="https://pokemontcg.io/" target="_blank" rel="noopener noreferrer">Pokémon TCG API</a>.
        </p>
        <p className="fine">
          Fan-made collection tracker. Pokémon and all card names are trademarks of Nintendo,
          Creatures Inc. and GAME FREAK inc. Not affiliated with, endorsed by, or a store for any of them.
        </p>
      </footer>

      {detail && (
        <CardDetail
          card={binder.cardsById[detail.id] ?? detail}
          binder={binder}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
