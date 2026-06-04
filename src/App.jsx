import { useState, useEffect, useRef, useCallback } from "react";

// ── KALSHI API ──────────────────────────────────────────────────────────────
const KALSHI_BASE = "https://external-api.kalshi.com/trade-api/v2";

// Known Kalshi World Cup series/event tickers (public, no auth needed)
const WC_SERIES_TICKERS = ["FIFAWC", "WCWINNER", "WCFIFA", "FIFA26"];
const WC_SEARCH_TERMS   = ["world cup", "fifa", "soccer wc", "wc2026", "wc26"];

async function kalshiFetch(path) {
  const res = await fetch(`${KALSHI_BASE}${path}`, {
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) throw new Error(`Kalshi ${res.status}`);
  return res.json();
}

// ── STATIC MATCH DATA ───────────────────────────────────────────────────────
const WC_MATCHES = [
  { id: 1,  group:"A", home:"Mexico",      away:"South Africa",       homeFlag:"🇲🇽", awayFlag:"🇿🇦", date:"2026-06-11", time:"3:00 PM ET", city:"Mexico City",  status:"final",    homeScore:2, awayScore:1 },
  { id: 2,  group:"A", home:"South Korea", away:"Czechia",            homeFlag:"🇰🇷", awayFlag:"🇨🇿", date:"2026-06-11", time:"10:00 PM ET",city:"Guadalajara",  status:"final",    homeScore:0, awayScore:0 },
  { id: 3,  group:"B", home:"Canada",      away:"Bosnia & Herz.",     homeFlag:"🇨🇦", awayFlag:"🇧🇦", date:"2026-06-12", time:"3:00 PM ET", city:"Toronto",      status:"final",    homeScore:3, awayScore:0 },
  { id: 4,  group:"D", home:"USA",         away:"Paraguay",           homeFlag:"🇺🇸", awayFlag:"🇵🇾", date:"2026-06-12", time:"9:00 PM ET", city:"Los Angeles",  status:"final",    homeScore:4, awayScore:1 },
  { id: 5,  group:"B", home:"Qatar",       away:"Switzerland",        homeFlag:"🇶🇦", awayFlag:"🇨🇭", date:"2026-06-13", time:"3:00 PM ET", city:"Santa Clara",  status:"live",     homeScore:0, awayScore:2 },
  { id: 6,  group:"C", home:"Brazil",      away:"Morocco",            homeFlag:"🇧🇷", awayFlag:"🇲🇦", date:"2026-06-13", time:"6:00 PM ET", city:"New York/NJ",  status:"upcoming" },
  { id: 7,  group:"C", home:"Haiti",       away:"Scotland",           homeFlag:"🇭🇹", awayFlag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿", date:"2026-06-13", time:"9:00 PM ET", city:"Boston",       status:"upcoming" },
  { id: 8,  group:"E", home:"Germany",     away:"Curaçao",            homeFlag:"🇩🇪", awayFlag:"🇨🇼", date:"2026-06-14", time:"1:00 PM ET", city:"New York/NJ",  status:"upcoming" },
  { id: 9,  group:"E", home:"Netherlands", away:"Japan",              homeFlag:"🇳🇱", awayFlag:"🇯🇵", date:"2026-06-14", time:"4:00 PM ET", city:"Santa Clara",  status:"upcoming" },
  { id: 10, group:"H", home:"Spain",       away:"Cape Verde",         homeFlag:"🇪🇸", awayFlag:"🇨🇻", date:"2026-06-15", time:"12:00 PM ET",city:"Atlanta",      status:"upcoming" },
  { id: 11, group:"I", home:"France",      away:"Senegal",            homeFlag:"🇫🇷", awayFlag:"🇸🇳", date:"2026-06-16", time:"3:00 PM ET", city:"New York/NJ",  status:"upcoming" },
  { id: 12, group:"J", home:"Argentina",   away:"Algeria",            homeFlag:"🇦🇷", awayFlag:"🇩🇿", date:"2026-06-16", time:"9:00 PM ET", city:"Kansas City",  status:"upcoming" },
  { id: 13, group:"K", home:"Portugal",    away:"DR Congo",           homeFlag:"🇵🇹", awayFlag:"🇨🇩", date:"2026-06-17", time:"1:00 PM ET", city:"Houston",      status:"upcoming" },
  { id: 14, group:"L", home:"England",     away:"Croatia",            homeFlag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", awayFlag:"🇭🇷", date:"2026-06-17", time:"4:00 PM ET", city:"Dallas",       status:"upcoming" },
];

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
const GROUP_TEAMS = {
  A:[{name:"Mexico",flag:"🇲🇽",w:1,d:0,l:0,pts:3},{name:"South Korea",flag:"🇰🇷",w:0,d:1,l:0,pts:1},{name:"Czechia",flag:"🇨🇿",w:0,d:1,l:0,pts:1},{name:"South Africa",flag:"🇿🇦",w:0,d:0,l:1,pts:0}],
  B:[{name:"Canada",flag:"🇨🇦",w:1,d:0,l:0,pts:3},{name:"Switzerland",flag:"🇨🇭",w:1,d:0,l:0,pts:3},{name:"Bosnia & Herz.",flag:"🇧🇦",w:0,d:0,l:1,pts:0},{name:"Qatar",flag:"🇶🇦",w:0,d:0,l:0,pts:0}],
  C:[{name:"Brazil",flag:"🇧🇷",w:0,d:0,l:0,pts:0},{name:"Morocco",flag:"🇲🇦",w:0,d:0,l:0,pts:0},{name:"Haiti",flag:"🇭🇹",w:0,d:0,l:0,pts:0},{name:"Scotland",flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",w:0,d:0,l:0,pts:0}],
  D:[{name:"USA",flag:"🇺🇸",w:1,d:0,l:0,pts:3},{name:"Australia",flag:"🇦🇺",w:0,d:0,l:0,pts:0},{name:"Türkiye",flag:"🇹🇷",w:0,d:0,l:0,pts:0},{name:"Paraguay",flag:"🇵🇾",w:0,d:0,l:1,pts:0}],
  E:[{name:"Germany",flag:"🇩🇪",w:0,d:0,l:0,pts:0},{name:"Netherlands",flag:"🇳🇱",w:0,d:0,l:0,pts:0},{name:"Japan",flag:"🇯🇵",w:0,d:0,l:0,pts:0},{name:"Curaçao",flag:"🇨🇼",w:0,d:0,l:0,pts:0}],
  F:[{name:"Ivory Coast",flag:"🇨🇮",w:0,d:0,l:0,pts:0},{name:"Ecuador",flag:"🇪🇨",w:0,d:0,l:0,pts:0},{name:"Sweden",flag:"🇸🇪",w:0,d:0,l:0,pts:0},{name:"Tunisia",flag:"🇹🇳",w:0,d:0,l:0,pts:0}],
  G:[{name:"Belgium",flag:"🇧🇪",w:0,d:0,l:0,pts:0},{name:"Egypt",flag:"🇪🇬",w:0,d:0,l:0,pts:0},{name:"Iran",flag:"🇮🇷",w:0,d:0,l:0,pts:0},{name:"New Zealand",flag:"🇳🇿",w:0,d:0,l:0,pts:0}],
  H:[{name:"Spain",flag:"🇪🇸",w:0,d:0,l:0,pts:0},{name:"Uruguay",flag:"🇺🇾",w:0,d:0,l:0,pts:0},{name:"Saudi Arabia",flag:"🇸🇦",w:0,d:0,l:0,pts:0},{name:"Cape Verde",flag:"🇨🇻",w:0,d:0,l:0,pts:0}],
  I:[{name:"France",flag:"🇫🇷",w:0,d:0,l:0,pts:0},{name:"Norway",flag:"🇳🇴",w:0,d:0,l:0,pts:0},{name:"Senegal",flag:"🇸🇳",w:0,d:0,l:0,pts:0},{name:"Iraq",flag:"🇮🇶",w:0,d:0,l:0,pts:0}],
  J:[{name:"Argentina",flag:"🇦🇷",w:0,d:0,l:0,pts:0},{name:"Austria",flag:"🇦🇹",w:0,d:0,l:0,pts:0},{name:"Algeria",flag:"🇩🇿",w:0,d:0,l:0,pts:0},{name:"Jordan",flag:"🇯🇴",w:0,d:0,l:0,pts:0}],
  K:[{name:"Portugal",flag:"🇵🇹",w:0,d:0,l:0,pts:0},{name:"Colombia",flag:"🇨🇴",w:0,d:0,l:0,pts:0},{name:"DR Congo",flag:"🇨🇩",w:0,d:0,l:0,pts:0},{name:"Uzbekistan",flag:"🇺🇿",w:0,d:0,l:0,pts:0}],
  L:[{name:"England",flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",w:0,d:0,l:0,pts:0},{name:"Croatia",flag:"🇭🇷",w:0,d:0,l:0,pts:0},{name:"Ghana",flag:"🇬🇭",w:0,d:0,l:0,pts:0},{name:"Panama",flag:"🇵🇦",w:0,d:0,l:0,pts:0}],
};

// Flag map for matching Kalshi market titles to teams
const TEAM_FLAGS = {
  "france":"🇫🇷","spain":"🇪🇸","england":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","argentina":"🇦🇷","brazil":"🇧🇷",
  "germany":"🇩🇪","portugal":"🇵🇹","netherlands":"🇳🇱","usa":"🇺🇸","united states":"🇺🇸",
  "belgium":"🇧🇪","uruguay":"🇺🇾","mexico":"🇲🇽","canada":"🇨🇦","japan":"🇯🇵",
  "morocco":"🇲🇦","south korea":"🇰🇷","switzerland":"🇨🇭","colombia":"🇨🇴","denmark":"🇩🇰",
  "croatia":"🇭🇷","senegal":"🇸🇳","ecuador":"🇪🇨","australia":"🇦🇺","turkey":"🇹🇷",
  "türkiye":"🇹🇷","nigeria":"🇳🇬","poland":"🇵🇱","iran":"🇮🇷","sweden":"🇸🇪",
  "austria":"🇦🇹","ivory coast":"🇨🇮","algeria":"🇩🇿","norway":"🇳🇴","ghana":"🇬🇭",
  "qatar":"🇶🇦","saudi arabia":"🇸🇦","tunisia":"🇹🇳","iraq":"🇮🇶","new zealand":"🇳🇿",
};

function getFlagForTeam(name) {
  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(TEAM_FLAGS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return "🏳";
}

// ── STYLES ──────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a1020}::-webkit-scrollbar-thumb{background:#c9a84c;border-radius:2px}
  .bg{position:fixed;top:0;left:0;right:0;height:340px;background:radial-gradient(ellipse at 60% 0%,rgba(201,168,76,.18) 0%,transparent 65%),radial-gradient(ellipse at 10% 80%,rgba(16,120,80,.15) 0%,transparent 55%),linear-gradient(180deg,#0a1520 0%,#050a14 100%);pointer-events:none;z-index:0}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 3px rgba(34,197,94,.25)}50%{box-shadow:0 0 0 7px rgba(34,197,94,.08)}}
  @keyframes fsu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes shimmer{0%{opacity:.4}50%{opacity:.9}100%{opacity:.4}}

  .hdr{position:relative;z-index:10;padding:28px 24px 0}
  .logo{font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:6px;color:#c9a84c;opacity:.85}
  .ttl{font-family:'Bebas Neue',sans-serif;font-size:clamp(42px,10vw,72px);line-height:.92;color:#f0ead8;margin-top:6px}
  .ttl span{color:#c9a84c}
  .sub{font-size:11px;letter-spacing:3px;color:#8a9db5;margin-top:10px;text-transform:uppercase}

  .live-banner{margin:24px 24px 0;background:linear-gradient(135deg,#0d2218,#0a1c14);border:1px solid rgba(16,180,100,.35);border-radius:12px;padding:16px 20px;position:relative;z-index:10;animation:fsu .6s ease both}
  .ldot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:8px;box-shadow:0 0 0 3px rgba(34,197,94,.25);animation:pulse 1.4s ease infinite}
  .llbl{font-size:11px;letter-spacing:3px;color:#22c55e;text-transform:uppercase;display:flex;align-items:center}
  .lteams{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#f0ead8;margin-top:4px;letter-spacing:1px}
  .lscore{font-family:'Bebas Neue',sans-serif;font-size:36px;color:#c9a84c}
  .pbar{height:3px;background:rgba(255,255,255,.08);border-radius:2px;margin-top:10px;overflow:hidden}
  .pfill{height:100%;background:linear-gradient(90deg,#22c55e,#c9a84c);border-radius:2px;transition:width 1s ease}

  .tabrow{display:flex;padding:20px 24px 0;position:relative;z-index:10;border-bottom:1px solid rgba(255,255,255,.06);overflow-x:auto;scrollbar-width:none}
  .tabrow::-webkit-scrollbar{display:none}
  .tbtn{background:none;border:none;color:#4a6080;font-family:inherit;font-size:11px;letter-spacing:2px;text-transform:uppercase;padding:10px 14px;cursor:pointer;position:relative;transition:color .2s;white-space:nowrap}
  .tbtn.on{color:#c9a84c}.tbtn.on::after{content:'';position:absolute;bottom:-1px;left:0;right:0;height:2px;background:#c9a84c}
  .tbtn:hover:not(.on){color:#8a9db5}

  .frow{display:flex;gap:8px;padding:16px 24px;overflow-x:auto;scrollbar-width:none;position:relative;z-index:10}
  .frow::-webkit-scrollbar{display:none}
  .chip{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#6a8098;font-family:inherit;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;padding:7px 14px;border-radius:20px;cursor:pointer;white-space:nowrap;transition:all .2s}
  .chip.on{background:rgba(201,168,76,.15);border-color:rgba(201,168,76,.5);color:#c9a84c}

  .mlist{padding:0 16px 100px;position:relative;z-index:10}
  .dhdr{font-size:10px;letter-spacing:3px;color:#3a5070;text-transform:uppercase;padding:16px 8px 8px}
  .mc{background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;transition:all .25s;animation:fsu .4s ease both}
  .mc:hover{border-color:rgba(201,168,76,.2);background:linear-gradient(135deg,rgba(201,168,76,.06),rgba(255,255,255,.03));transform:translateY(-1px)}
  .mc.live{border-color:rgba(34,197,94,.3);background:linear-gradient(135deg,rgba(16,80,40,.3),rgba(8,30,18,.5))}
  .mc.done{opacity:.65}
  .gbdg{font-size:9px;letter-spacing:2px;color:#3a5070;background:rgba(255,255,255,.04);border-radius:4px;padding:2px 6px;min-width:26px;text-align:center;text-transform:uppercase}
  .mteams{flex:1}
  .trow{display:flex;align-items:center;justify-content:space-between;padding:3px 0}
  .tnm{font-size:13px;color:#c8d8e8;letter-spacing:.5px;display:flex;align-items:center;gap:8px}
  .tsc{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#f0ead8;min-width:16px;text-align:right}
  .tsc.w{color:#c9a84c}
  .mdiv{height:1px;background:rgba(255,255,255,.05);margin:4px 0}
  .mmeta{font-size:10px;color:#3a5070;margin-top:6px;display:flex;gap:10px;flex-wrap:wrap}
  .sbdg{font-size:9px;letter-spacing:2px;text-transform:uppercase;padding:3px 8px;border-radius:10px}
  .slive{background:rgba(34,197,94,.2);color:#22c55e;border:1px solid rgba(34,197,94,.3);animation:pulse 2s ease infinite}
  .sfinal{background:rgba(255,255,255,.06);color:#4a6080;border:1px solid rgba(255,255,255,.1)}
  .sup{background:rgba(201,168,76,.1);color:#c9a84c;border:1px solid rgba(201,168,76,.2)}
  .cact{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
  .abtn{background:none;border:1px solid rgba(255,255,255,.1);border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;font-size:14px}
  .abtn:hover{border-color:rgba(201,168,76,.4);background:rgba(201,168,76,.08)}
  .abtn.on{border-color:rgba(201,168,76,.6);background:rgba(201,168,76,.15)}
  .aibtn{background:linear-gradient(135deg,rgba(99,60,180,.3),rgba(60,100,200,.2));border:1px solid rgba(120,80,220,.4);border-radius:8px;padding:4px 8px;color:#a080ff;font-family:inherit;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .2s;white-space:nowrap}
  .aibtn:hover{background:linear-gradient(135deg,rgba(99,60,180,.5),rgba(60,100,200,.35))}

  /* Markets */
  .mwrap{padding:16px 16px 100px;position:relative;z-index:10}
  .mtog{display:flex;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:3px;margin-bottom:20px}
  .mtbtn{flex:1;background:none;border:none;color:#4a6080;font-family:inherit;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px;border-radius:8px;cursor:pointer;transition:all .2s}
  .mtbtn.on{background:rgba(201,168,76,.2);color:#c9a84c}
  .mhdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .mtitle{font-family:'Bebas Neue',sans-serif;font-size:22px;color:#f0ead8;letter-spacing:1px}
  .mvol{font-size:10px;color:#3a5070;letter-spacing:1px}
  .oc{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px 16px;margin-bottom:8px;transition:all .2s;animation:fsu .35s ease both}
  .oc:hover{border-color:rgba(201,168,76,.15);background:rgba(255,255,255,.05)}
  .orow{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .ork{font-size:11px;color:#2a4060;width:18px;flex-shrink:0}
  .oteam{font-size:13px;color:#c8d8e8;flex:1;display:flex;align-items:center;gap:8px}
  .oprice{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#f0ead8}
  .omv{font-size:11px;padding:2px 6px;border-radius:6px}
  .omv.up{color:#22c55e;background:rgba(34,197,94,.1)}
  .omv.dn{color:#ff6060;background:rgba(255,80,80,.1)}
  .pbarw{display:flex;align-items:center;gap:8px}
  .pbar2{flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
  .pfill2{height:100%;background:linear-gradient(90deg,#c9a84c,#e8c870);border-radius:2px;transition:width 1.2s ease}
  .ppct{font-size:11px;color:#5a7090;width:36px;text-align:right}
  .stag{font-size:9px;letter-spacing:2px;color:#2a4060;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:4px;padding:2px 6px}
  .moc{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:16px;margin-bottom:10px}
  .motitle{font-size:12px;color:#8a9db5;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
  .tw3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .obox{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 6px;text-align:center;cursor:pointer;transition:all .2s}
  .obox:hover{background:rgba(201,168,76,.1);border-color:rgba(201,168,76,.3)}
  .oblbl{font-size:9px;letter-spacing:1.5px;color:#3a5070;text-transform:uppercase;margin-bottom:4px}
  .obprice{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#f0ead8}
  .obpct{font-size:10px;color:#5a7090;margin-top:2px}
  .bg3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:10px}
  .mb{height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden}
  .mfh{height:100%;background:#22c55e;border-radius:2px}
  .mfd{height:100%;background:#c9a84c;border-radius:2px}
  .mfa{height:100%;background:#6080ff;border-radius:2px}
  .disc{font-size:9px;color:#1a3050;letter-spacing:1px;margin-top:16px;line-height:1.7;padding:12px;background:rgba(255,255,255,.02);border-radius:8px;border:1px solid rgba(255,255,255,.04)}

  /* Kalshi live indicator */
  .klive{display:flex;align-items:center;gap:6px;font-size:10px;color:#22c55e;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;animation:fsu .3s ease}
  .kdot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:pulse 1.2s ease infinite;flex-shrink:0}
  .kerr{font-size:11px;color:#ff6060;letter-spacing:1px;padding:12px;background:rgba(255,40,40,.06);border:1px solid rgba(255,40,40,.15);border-radius:10px;margin-bottom:12px}
  .kload{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;gap:12px}
  .kspin{width:28px;height:28px;border:3px solid rgba(201,168,76,.2);border-top-color:#c9a84c;border-radius:50%;animation:spin .8s linear infinite}
  .kltext{font-size:11px;color:#4a6020;letter-spacing:2px;text-transform:uppercase;animation:shimmer 1.5s ease infinite}
  .knodata{text-align:center;padding:40px 20px;color:#2a4060;font-size:11px;letter-spacing:2px;text-transform:uppercase;line-height:2}

  /* AI */
  .aiwrap{padding:16px 16px 100px;position:relative;z-index:10}
  .aihdr{font-family:'Bebas Neue',sans-serif;font-size:32px;color:#f0ead8}
  .aisub{font-size:11px;color:#3a5060;letter-spacing:2px;text-transform:uppercase;margin-top:4px;margin-bottom:20px}
  .aimatch{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;transition:all .2s;animation:fsu .3s ease both}
  .aimatch:hover{border-color:rgba(120,80,220,.3);background:rgba(80,40,160,.1);transform:translateY(-1px)}
  .aimatch.sel{border-color:rgba(120,80,220,.5);background:rgba(80,40,160,.15)}
  .airesult{background:linear-gradient(135deg,rgba(60,30,120,.4),rgba(30,20,80,.6));border:1px solid rgba(120,80,220,.4);border-radius:16px;padding:20px;margin-top:16px;animation:fsu .4s ease}
  .aivrd{font-family:'Bebas Neue',sans-serif;font-size:36px;color:#c9a84c;line-height:1}
  .aisc{font-family:'Bebas Neue',sans-serif;font-size:24px;color:#a080ff;margin-top:2px}
  .aicbar{height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin:12px 0 4px}
  .aicfill{height:100%;background:linear-gradient(90deg,#6040c0,#a080ff);border-radius:3px;transition:width .8s ease}
  .aiclbl{font-size:10px;color:#6050a0;letter-spacing:1.5px;text-transform:uppercase}
  .aidr{display:flex;gap:8px;margin-top:12px}
  .aidb{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px}
  .aidlbl{font-size:9px;letter-spacing:2px;color:#4a3080;text-transform:uppercase;margin-bottom:4px}
  .aidtxt{font-size:11px;color:#9090c0;line-height:1.5}
  .aitip{margin-top:12px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:10px;padding:12px}
  .aitlbl{font-size:9px;letter-spacing:2px;color:#c9a84c;text-transform:uppercase;margin-bottom:4px}
  .aittxt{font-size:12px;color:#d8c880;line-height:1.5}
  .aispin{width:32px;height:32px;border:3px solid rgba(120,80,220,.2);border-top-color:#a080ff;border-radius:50%;animation:spin .8s linear infinite}
  .ailoading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;gap:12px}
  .ailtxt{font-size:11px;color:#5040a0;letter-spacing:2px;text-transform:uppercase}

  /* Standings */
  .swrap{padding:16px 16px 100px;position:relative;z-index:10}
  .gtabs{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:16px}
  .gtab{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#4a6080;font-family:inherit;font-size:11px;letter-spacing:2px;padding:6px 12px;border-radius:6px;cursor:pointer;transition:all .2s}
  .gtab.on{background:rgba(201,168,76,.15);border-color:rgba(201,168,76,.4);color:#c9a84c}
  .stable{width:100%;border-collapse:collapse}
  .stable th{font-size:9px;letter-spacing:2px;color:#2a4060;text-transform:uppercase;padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.05)}
  .stable td{font-size:12px;color:#8a9db5;padding:11px 10px;border-bottom:1px solid rgba(255,255,255,.04)}
  .spos{color:#3a5070;font-size:11px;width:20px}
  .stcell{display:flex;align-items:center;gap:8px;color:#c8d8e8}
  .spts{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#c9a84c;text-align:right}
  .qdot{width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:6px}
  .mdot{width:6px;height:6px;border-radius:50%;background:#c9a84c;display:inline-block;margin-right:6px}

  /* Alerts */
  .alwrap{padding:16px 16px 100px;position:relative;z-index:10}
  .alcnt{font-family:'Bebas Neue',sans-serif;font-size:64px;color:#c9a84c;line-height:1}
  .empty{text-align:center;padding:60px 20px;color:#2a4060}
  .emico{font-size:48px;margin-bottom:16px;opacity:.5}
  .emtxt{font-size:12px;letter-spacing:2px;text-transform:uppercase}

  .toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#0d1e30;border:1px solid rgba(201,168,76,.4);color:#c9a84c;font-size:12px;letter-spacing:1px;padding:12px 20px;border-radius:10px;z-index:999;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:fsu .3s ease}
  .toast.rm{border-color:rgba(255,80,80,.3);color:#ff8080}
  .bnav{position:fixed;bottom:0;left:0;right:0;z-index:100;background:rgba(5,10,20,.95);backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,.07);display:flex;padding:8px 0}
  .ni{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;padding:8px 4px;transition:all .2s;position:relative}
  .nico{font-size:18px}
  .nlbl{font-family:inherit;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#2a4060}
  .ni.on .nlbl{color:#c9a84c}
  .ni.on .nico{filter:drop-shadow(0 0 6px rgba(201,168,76,.6))}
  .nbdg{position:absolute;top:4px;right:calc(50% - 18px);background:#c9a84c;color:#050a14;font-size:9px;border-radius:8px;padding:1px 5px;font-weight:700}
`;

// ── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]               = useState("schedule");
  const [filter, setFilter]         = useState("all");
  const [alerts, setAlerts]         = useState({});
  const [toast, setToast]           = useState(null);
  const [liveMin, setLiveMin]       = useState(67);
  const [selGroup, setSelGroup]     = useState("A");
  const [mktView, setMktView]       = useState("winner");

  // Kalshi live data
  const [kalshiWinner, setKalshiWinner]   = useState(null);
  const [kalshiGames, setKalshiGames]     = useState(null);
  const [kalshiLoading, setKalshiLoading] = useState(false);
  const [kalshiErr, setKalshiErr]         = useState(null);
  const [kalshiTs, setKalshiTs]           = useState(null);

  // AI state
  const [aiMatch, setAiMatch]   = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError]   = useState(null);

  const toastRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => setLiveMin(m => Math.min(m + 1, 90)), 8000);
    return () => clearInterval(iv);
  }, []);

  // ── Kalshi loader ─────────────────────────────────────────────────────────
  const loadKalshi = useCallback(async () => {
    setKalshiLoading(true);
    setKalshiErr(null);
    try {
      // Try multiple ticker strategies for World Cup winner market
      let winnerMarkets = [];
      const strategies = [
        () => kalshiFetch("/markets?series_ticker=FIFAWC&status=open&limit=50"),
        () => kalshiFetch("/markets?series_ticker=WCWINNER&status=open&limit=50"),
        () => kalshiFetch("/markets?series_ticker=FIFA26&status=open&limit=50"),
        () => kalshiFetch("/events?series_ticker=FIFAWC&limit=20"),
      ];

      for (const fn of strategies) {
        try {
          const data = await fn();
          const mkts = data.markets || data.events || [];
          if (mkts.length > 0) { winnerMarkets = mkts; break; }
        } catch (_) {}
      }

      // If no direct series hit, search broadly
      if (winnerMarkets.length === 0) {
        try {
          // Get all open markets with soccer category or large volume
          const data = await kalshiFetch("/markets?status=open&limit=200&category=sports");
          const allMkts = data.markets || [];
          winnerMarkets = allMkts.filter(m => {
            const title = (m.title || "").toLowerCase();
            const ticker = (m.ticker || "").toLowerCase();
            return WC_SEARCH_TERMS.some(t => title.includes(t) || ticker.includes(t));
          });
        } catch (_) {}
      }

      // Parse winner futures
      if (winnerMarkets.length > 0) {
        const parsed = winnerMarkets
          .filter(m => m.yes_bid || m.yes_ask || m.last_price || m.yes_bid_dollars)
          .map(m => {
            const price = m.yes_bid_dollars || (m.yes_bid ? m.yes_bid / 100 : null) || (m.last_price ? m.last_price / 100 : null) || 0;
            const pct   = Math.round(price * 100);
            const title = m.title || m.ticker || "Unknown";
            const team  = title.replace(/will |win the |world cup|2026|fifa|\?/gi, "").trim();
            return {
              team,
              flag:    getFlagForTeam(team),
              prob:    pct,
              odds:    pct > 0 ? `+${Math.round((100 - pct) / pct * 100)}` : "N/A",
              volume:  m.volume_fp || m.volume || 0,
              ticker:  m.ticker,
              move:    m.price_change_fp || m.previous_price ? ((price - (m.previous_price || price) / 100) * 100).toFixed(1) : 0,
            };
          })
          .filter(m => m.prob > 0)
          .sort((a, b) => b.prob - a.prob)
          .slice(0, 12);

        if (parsed.length > 0) setKalshiWinner(parsed);
      }

      // Fetch individual match / game markets
      let gameMkts = [];
      try {
        const data = await kalshiFetch("/markets?status=open&limit=200&series_ticker=FIFAWCG");
        gameMkts = data.markets || [];
      } catch (_) {}

      if (gameMkts.length === 0) {
        try {
          const data = await kalshiFetch("/markets?status=open&limit=200&category=sports");
          const all = data.markets || [];
          gameMkts = all.filter(m => {
            const title = (m.title || "").toLowerCase();
            return (title.includes("vs") || title.includes(" v ")) &&
              (title.includes("world cup") || title.includes("fifa") || title.includes("wc"));
          });
        } catch (_) {}
      }

      if (gameMkts.length > 0) setKalshiGames(gameMkts);
      setKalshiTs(new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}));

    } catch (e) {
      setKalshiErr("Kalshi API unavailable. Showing estimated data.");
    }
    setKalshiLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "markets") loadKalshi();
  }, [tab]);

  // Fallback winner data modelled on real Kalshi prices
  const FALLBACK_WINNER = [
    { team:"France",     flag:"🇫🇷", prob:17, odds:"+489", volume:"89.4M", move:+1.2 },
    { team:"Spain",      flag:"🇪🇸", prob:16, odds:"+526", volume:"76.1M", move:-0.8 },
    { team:"England",    flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", prob:11, odds:"+810", volume:"54.2M", move:+0.3 },
    { team:"Argentina",  flag:"🇦🇷", prob:10, odds:"+900", volume:"48.7M", move:-1.1 },
    { team:"Brazil",     flag:"🇧🇷", prob:10, odds:"+920", volume:"44.3M", move:+0.6 },
    { team:"Germany",    flag:"🇩🇪", prob: 8, odds:"+1120",volume:"38.9M", move:+0.2 },
    { team:"Portugal",   flag:"🇵🇹", prob: 6, odds:"+1460",volume:"29.1M", move:-0.4 },
    { team:"Netherlands",flag:"🇳🇱", prob: 5, odds:"+1860",volume:"22.6M", move:+0.1 },
    { team:"USA",        flag:"🇺🇸", prob: 4, odds:"+2230",volume:"19.4M", move:+1.8 },
    { team:"Belgium",    flag:"🇧🇪", prob: 3, odds:"+3350",volume:"13.2M", move:-0.2 },
  ];

  const winnerData = kalshiWinner || FALLBACK_WINNER;
  const isLiveKalshi = !!kalshiWinner;

  // ── AI Prediction ─────────────────────────────────────────────────────────
  const getAiPrediction = async (match) => {
    setAiMatch(match);
    setAiLoading(true);
    setAiResult(null);
    setAiError(null);
    // Find any Kalshi odds for this match
    const matchOdds = kalshiGames?.find(m => {
      const t = (m.title || "").toLowerCase();
      return t.includes(match.home.toLowerCase()) || t.includes(match.away.toLowerCase());
    });
    const oddsNote = matchOdds
      ? `Kalshi market: "${matchOdds.title}" — Yes price $${matchOdds.yes_bid_dollars || "N/A"}`
      : "No live Kalshi match market found.";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a sharp World Cup 2026 analyst. Respond ONLY with valid JSON, no extra text:
{"verdict":"Home Win"|"Draw"|"Away Win","confidence":number 1-100,"predictedScore":"X-Y","keyFactor":"one sentence","homeStrength":"one sentence","awayStrength":"one sentence","tip":"max 20 words sharp betting insight"}`,
          messages: [{ role:"user", content:`Predict: ${match.homeFlag} ${match.home} vs ${match.awayFlag} ${match.away}. Group ${match.group}. ${match.city}. ${oddsNote}` }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      setAiResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e) { setAiError("Prediction failed — please try again."); }
    setAiLoading(false);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = (msg, type="success") => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({msg, type});
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const toggleAlert = (id, match) => {
    setAlerts(prev => {
      const n = {...prev};
      if (n[id]) { delete n[id]; showToast("Alert removed","rm"); }
      else { n[id]=true; showToast(`🔔 Alert set — ${match.home} vs ${match.away}`); }
      return n;
    });
  };

  const liveMatch  = WC_MATCHES.find(m => m.status === "live");
  const alertCount = Object.keys(alerts).length;
  const filtered   = WC_MATCHES.filter(m => {
    if (filter==="live") return m.status==="live";
    if (filter==="today") return m.date==="2026-06-13";
    if (filter==="upcoming") return m.status==="upcoming";
    if (filter==="alerts") return alerts[m.id];
    return true;
  });

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#050a14",fontFamily:"'DM Mono','Courier New',monospace",color:"#e8e0d0",overflowX:"hidden"}}>
      <style>{CSS}</style>
      <div className="bg"/>

      {/* Header */}
      <div className="hdr" style={{animation:"fsu .5s ease both"}}>
        <div className="logo">FIFA World Cup</div>
        <div className="ttl">WC<span>26</span></div>
        <div className="sub">Schedule · Standings · Kalshi Markets · AI Picks</div>
      </div>

      {/* Live Banner */}
      {liveMatch && (
        <div className="live-banner">
          <div className="llbl"><span className="ldot"/>Live Now · {liveMin}'</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8}}>
            <div className="lteams">{liveMatch.homeFlag} {liveMatch.home}<br/>{liveMatch.awayFlag} {liveMatch.away}</div>
            <div style={{textAlign:"right"}}>
              <div className="lscore">{liveMatch.homeScore} – {liveMatch.awayScore}</div>
              <div style={{fontSize:11,color:"#5a7090",marginTop:6,letterSpacing:1}}>Group {liveMatch.group} · {liveMatch.city}</div>
            </div>
          </div>
          <div className="pbar"><div className="pfill" style={{width:`${(liveMin/90)*100}%`}}/></div>
        </div>
      )}

      {/* Tab row */}
      <div className="tabrow">
        {[["schedule","📅 Schedule"],["standings","📊 Standings"],["markets","📈 Kalshi"],["ai","🤖 AI Picks"],["myalerts","🔔 Alerts"]].map(([k,l]) => (
          <button key={k} className={`tbtn${tab===k?" on":""}`} onClick={() => setTab(k)}>
            {l}
            {k==="myalerts" && alertCount>0 && <span style={{marginLeft:6,background:"#c9a84c",color:"#050a14",fontSize:9,borderRadius:8,padding:"1px 5px",fontWeight:700}}>{alertCount}</span>}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE ── */}
      {tab==="schedule" && (
        <>
          <div className="frow">
            {[["all","All"],["live","🔴 Live"],["today","Today"],["upcoming","Upcoming"],["alerts","Alerts"]].map(([k,l]) => (
              <button key={k} className={`chip${filter===k?" on":""}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <div className="mlist">
            {filtered.length===0 && <div className="empty"><div className="emico">⚽</div><div className="emtxt">No matches found</div></div>}
            {filtered.reduce((acc,m,i) => {
              const pd = i>0 ? filtered[i-1].date : null;
              if (m.date!==pd) { const d=new Date(m.date+"T12:00:00"); acc.push(<div key={`d-${m.date}`} className="dhdr">{d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>); }
              const hw=m.homeScore>m.awayScore, aw=m.awayScore>m.homeScore;
              acc.push(
                <div key={m.id} className={`mc${m.status==="live"?" live":""}${m.status==="final"?" done":""}`} style={{animationDelay:`${(i%6)*.05}s`}}>
                  <div className="gbdg">GRP {m.group}</div>
                  <div className="mteams">
                    <div className="trow"><div className="tnm"><span style={{fontSize:16}}>{m.homeFlag}</span>{m.home}</div>{m.status!=="upcoming"&&<div className={`tsc${hw?" w":""}`}>{m.homeScore}</div>}</div>
                    <div className="mdiv"/>
                    <div className="trow"><div className="tnm"><span style={{fontSize:16}}>{m.awayFlag}</span>{m.away}</div>{m.status!=="upcoming"&&<div className={`tsc${aw?" w":""}`}>{m.awayScore}</div>}</div>
                    <div className="mmeta"><span>🕐 {m.time}</span><span>📍 {m.city}</span></div>
                  </div>
                  <div className="cact">
                    {m.status==="live"&&<span className="sbdg slive">{liveMin}'</span>}
                    {m.status==="final"&&<span className="sbdg sfinal">FT</span>}
                    {m.status==="upcoming"&&<span className="sbdg sup">Soon</span>}
                    {m.status==="upcoming"&&<>
                      <button className={`abtn${alerts[m.id]?" on":""}`} onClick={() => toggleAlert(m.id,m)}>{alerts[m.id]?"🔔":"🔕"}</button>
                      <button className="aibtn" onClick={() => { setTab("ai"); getAiPrediction(m); }}>AI Pick</button>
                    </>}
                  </div>
                </div>
              );
              return acc;
            },[])}
          </div>
        </>
      )}

      {/* ── STANDINGS ── */}
      {tab==="standings" && (
        <div className="swrap">
          <div className="gtabs">{GROUPS.map(g=><button key={g} className={`gtab${selGroup===g?" on":""}`} onClick={()=>setSelGroup(g)}>Group {g}</button>)}</div>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden"}}>
            <table className="stable">
              <thead><tr><th>#</th><th>Team</th><th style={{textAlign:"center"}}>W</th><th style={{textAlign:"center"}}>D</th><th style={{textAlign:"center"}}>L</th><th style={{textAlign:"right"}}>PTS</th></tr></thead>
              <tbody>
                {[...GROUP_TEAMS[selGroup]].sort((a,b)=>b.pts-a.pts).map((t,i)=>(
                  <tr key={t.name}>
                    <td className="spos">{i+1}</td>
                    <td><div className="stcell">{i<2?<span className="qdot"/>:i===2?<span className="mdot"/>:<span style={{width:12,display:"inline-block"}}/>}<span style={{fontSize:16}}>{t.flag}</span>{t.name}</div></td>
                    <td style={{textAlign:"center"}}>{t.w}</td><td style={{textAlign:"center"}}>{t.d}</td><td style={{textAlign:"center"}}>{t.l}</td>
                    <td className="spts">{t.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:12,display:"flex",gap:16,fontSize:10,letterSpacing:1.5,color:"#2a4060",textTransform:"uppercase"}}>
            <span><span className="qdot" style={{display:"inline-block"}}/>Advances</span>
            <span><span className="mdot" style={{display:"inline-block"}}/>Possible 3rd</span>
          </div>
        </div>
      )}

      {/* ── KALSHI MARKETS ── */}
      {tab==="markets" && (
        <div className="mwrap">
          <div className="mtog">
            {[["winner","🏆 Tournament Winner"],["games","⚽ Match Markets"]].map(([k,l])=>(
              <button key={k} className={`mtbtn${mktView===k?" on":""}`} onClick={()=>setMktView(k)}>{l}</button>
            ))}
          </div>

          {/* Live / loading status */}
          {kalshiLoading && <div className="kload"><div className="kspin"/><div className="kltext">Fetching Kalshi live data…</div></div>}
          {!kalshiLoading && isLiveKalshi && <div className="klive"><span className="kdot"/>Live Kalshi data · Updated {kalshiTs} <button onClick={loadKalshi} style={{marginLeft:"auto",background:"none",border:"1px solid rgba(34,197,94,.25)",borderRadius:6,color:"#22c55e",padding:"2px 8px",fontSize:9,cursor:"pointer",letterSpacing:1}}>↻ Refresh</button></div>}
          {!kalshiLoading && kalshiErr && <div className="kerr">⚠ {kalshiErr} <button onClick={loadKalshi} style={{marginLeft:8,background:"none",border:"1px solid rgba(255,80,80,.3)",borderRadius:6,color:"#ff8080",padding:"2px 8px",fontSize:9,cursor:"pointer"}}>Retry</button></div>}
          {!kalshiLoading && !isLiveKalshi && !kalshiErr && <div style={{fontSize:9,color:"#3a5060",letterSpacing:1.5,marginBottom:12}}>ESTIMATED — Based on recent Kalshi prices</div>}

          {!kalshiLoading && mktView==="winner" && (
            <>
              <div className="mhdr">
                <div className="mtitle">Win The World Cup</div>
                <div className="mvol">Kalshi Prediction Market</div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <span className="stag">KALSHI</span>
                <span className="stag">CFTC REGULATED</span>
                <span style={{fontSize:9,color:"#1a3050",letterSpacing:1,alignSelf:"center"}}>YES PRICE ODDS</span>
              </div>
              {winnerData.map((item,i)=>(
                <div key={item.team} className="oc" style={{animationDelay:`${i*.04}s`}}>
                  <div className="orow">
                    <span className="ork">{i+1}</span>
                    <span className="oteam"><span style={{fontSize:18}}>{item.flag}</span>{item.team}</span>
                    {item.move !== 0 && <span className={`omv ${Number(item.move)>=0?"up":"dn"}`}>{Number(item.move)>=0?"▲":"▼"}{Math.abs(item.move)}%</span>}
                    <span className="oprice">{item.odds}</span>
                  </div>
                  <div className="pbarw">
                    <div className="pbar2"><div className="pfill2" style={{width:`${(item.prob/(winnerData[0]?.prob||17))*100}%`}}/></div>
                    <span className="ppct">{item.prob}%</span>
                  </div>
                  {item.volume > 0 && <div style={{fontSize:10,color:"#2a4060",marginTop:6,letterSpacing:1}}>${typeof item.volume==="string"?item.volume:Number(item.volume).toLocaleString()} vol</div>}
                </div>
              ))}
              <a href="https://kalshi.com/category/sports/soccer/fifa-world-cup" target="_blank" rel="noopener noreferrer" style={{display:"block",marginTop:12,textAlign:"center",fontSize:10,color:"#c9a84c",letterSpacing:2,textDecoration:"none",padding:"10px",border:"1px solid rgba(201,168,76,.2)",borderRadius:10,background:"rgba(201,168,76,.05)"}}>
                Trade on Kalshi.com →
              </a>
              <div className="disc">⚠ Prediction market data from Kalshi (CFTC-regulated). Odds reflect YES contract prices. Trading involves risk. 18+ US only. Not financial advice.</div>
            </>
          )}

          {!kalshiLoading && mktView==="games" && (
            <>
              <div className="mhdr">
                <div className="mtitle">Match Markets</div>
                <div className="mvol">{kalshiGames ? `${kalshiGames.length} live markets` : "Estimated"}</div>
              </div>
              {(kalshiGames && kalshiGames.length > 0) ? (
                kalshiGames.slice(0,10).map((m,i) => {
                  const yesP = m.yes_bid_dollars || 0;
                  const noP  = m.no_bid_dollars  || (1 - yesP);
                  return (
                    <div key={m.ticker} className="moc" style={{animationDelay:`${i*.05}s`,animation:"fsu .35s ease both"}}>
                      <div className="motitle">
                        <span style={{fontSize:12,color:"#8a9db5"}}>{m.title}</span>
                        <span className="stag">KALSHI</span>
                      </div>
                      <div className="tw3">
                        <div className="obox"><div className="oblbl">YES</div><div className="obprice">${yesP.toFixed(2)}</div><div className="obpct">{Math.round(yesP*100)}%</div></div>
                        <div className="obox"><div className="oblbl">Volume</div><div className="obprice" style={{fontSize:14}}>{m.volume_fp||m.volume||"—"}</div><div className="obpct">trades</div></div>
                        <div className="obox"><div className="oblbl">NO</div><div className="obprice">${noP.toFixed(2)}</div><div className="obpct">{Math.round(noP*100)}%</div></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                // fallback estimated match odds
                WC_MATCHES.filter(m=>m.status==="upcoming").slice(0,6).map((match,i) => {
                  const hp=55+Math.floor(Math.random()*20), dp=20, ap=100-hp-dp;
                  return (
                    <div key={match.id} className="moc" style={{animationDelay:`${i*.05}s`,animation:"fsu .35s ease both"}}>
                      <div className="motitle"><span>{match.homeFlag} {match.home} vs {match.awayFlag} {match.away}</span><span className="stag">EST.</span></div>
                      <div className="tw3">
                        {[{l:match.home.slice(0,8),p:`+${Math.round((100-hp)/hp*100)}`,pct:hp},{l:"Draw",p:"+220",pct:dp},{l:match.away.slice(0,8),p:`+${Math.round((100-ap)/ap*100)}`,pct:ap}].map(b=>(
                          <div key={b.l} className="obox"><div className="oblbl" style={{fontSize:8}}>{b.l}</div><div className="obprice">{b.p}</div><div className="obpct">{b.pct}%</div></div>
                        ))}
                      </div>
                      <div className="bg3"><div className="mb"><div className="mfh" style={{width:`${hp}%`}}/></div><div className="mb"><div className="mfd" style={{width:`${dp}%`}}/></div><div className="mb"><div className="mfa" style={{width:`${ap}%`}}/></div></div>
                      <div style={{marginTop:8,textAlign:"right"}}><button className="aibtn" onClick={()=>{setTab("ai");getAiPrediction(match);}}>Get AI Pick ✦</button></div>
                    </div>
                  );
                })
              )}
              <a href="https://kalshi.com/category/sports/soccer/fifa-world-cup/game" target="_blank" rel="noopener noreferrer" style={{display:"block",marginTop:12,textAlign:"center",fontSize:10,color:"#c9a84c",letterSpacing:2,textDecoration:"none",padding:"10px",border:"1px solid rgba(201,168,76,.2)",borderRadius:10,background:"rgba(201,168,76,.05)"}}>
                See all match markets on Kalshi →
              </a>
              <div className="disc">⚠ Prediction market data from Kalshi (CFTC-regulated). Trading involves risk. 18+ US only. Not financial advice.</div>
            </>
          )}
        </div>
      )}

      {/* ── AI PICKS ── */}
      {tab==="ai" && (
        <div className="aiwrap">
          <div className="aihdr">AI MATCH PICKS</div>
          <div className="aisub">Claude · Kalshi Odds · Team Form</div>
          {WC_MATCHES.filter(m=>m.status==="upcoming").slice(0,10).map((m,i)=>(
            <div key={m.id} className={`aimatch${aiMatch?.id===m.id?" sel":""}`} style={{animationDelay:`${i*.04}s`}} onClick={()=>getAiPrediction(m)}>
              <div>
                <div style={{fontSize:13,color:"#c8d8e8"}}>{m.homeFlag} {m.home} <span style={{color:"#2a4060"}}>vs</span> {m.awayFlag} {m.away}</div>
                <div style={{fontSize:10,color:"#3a5070",marginTop:3}}>Group {m.group} · {m.city} · {m.time}</div>
              </div>
              <span style={{color:"#a080ff",fontSize:18}}>→</span>
            </div>
          ))}
          {aiLoading && <div className="airesult"><div className="ailoading"><div className="aispin"/><div className="ailtxt">Analysing match data…</div></div></div>}
          {aiError && !aiLoading && <div className="airesult" style={{borderColor:"rgba(255,80,80,.3)"}}><div style={{color:"#ff8080",fontSize:12}}>{aiError}</div></div>}
          {aiResult && !aiLoading && aiMatch && (
            <div className="airesult">
              <div style={{fontSize:10,color:"#5040a0",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>{aiMatch.homeFlag} {aiMatch.home} vs {aiMatch.awayFlag} {aiMatch.away}</div>
              <div className="aivrd">{aiResult.verdict}</div>
              <div className="aisc">Predicted: {aiResult.predictedScore}</div>
              <div className="aicbar"><div className="aicfill" style={{width:`${aiResult.confidence}%`}}/></div>
              <div className="aiclbl">Confidence: {aiResult.confidence}%</div>
              <div style={{marginTop:12,padding:"10px 12px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:10}}>
                <div style={{fontSize:9,color:"#4a3080",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Key Factor</div>
                <div style={{fontSize:12,color:"#9090c0",lineHeight:1.6}}>{aiResult.keyFactor}</div>
              </div>
              <div className="aidr">
                <div className="aidb"><div className="aidlbl">{aiMatch.homeFlag} {aiMatch.home}</div><div className="aidtxt">{aiResult.homeStrength}</div></div>
                <div className="aidb"><div className="aidlbl">{aiMatch.awayFlag} {aiMatch.away}</div><div className="aidtxt">{aiResult.awayStrength}</div></div>
              </div>
              {aiResult.tip && <div className="aitip"><div className="aitlbl">💡 Insight</div><div className="aittxt">{aiResult.tip}</div></div>}
              <div style={{marginTop:12,fontSize:9,color:"#2a3060",letterSpacing:1,lineHeight:1.7}}>⚠ AI predictions are for entertainment only. Not betting advice.</div>
            </div>
          )}
          {!aiMatch && !aiLoading && <div className="empty" style={{marginTop:8}}><div className="emico">🤖</div><div className="emtxt">Tap any match above<br/>for an AI prediction</div></div>}
        </div>
      )}

      {/* ── MY ALERTS ── */}
      {tab==="myalerts" && (
        <div className="alwrap">
          <div className="alcnt">{alertCount}</div>
          <div style={{fontSize:11,letterSpacing:3,color:"#3a5070",textTransform:"uppercase",marginBottom:24}}>Active Alerts</div>
          {alertCount===0 ? (
            <div className="empty"><div className="emico">🔕</div><div className="emtxt">No alerts set yet</div><div style={{fontSize:11,color:"#1a3050",marginTop:10,letterSpacing:1,lineHeight:1.8}}>Go to Schedule and tap 🔕<br/>on any upcoming match</div></div>
          ) : WC_MATCHES.filter(m=>alerts[m.id]).map((m,i)=>(
            <div key={m.id} className="mc" style={{animationDelay:`${i*.07}s`}}>
              <div className="gbdg">GRP {m.group}</div>
              <div className="mteams">
                <div className="trow"><div className="tnm"><span style={{fontSize:16}}>{m.homeFlag}</span>{m.home}</div></div>
                <div className="mdiv"/>
                <div className="trow"><div className="tnm"><span style={{fontSize:16}}>{m.awayFlag}</span>{m.away}</div></div>
                <div className="mmeta"><span>🕐 {m.time}</span><span>📍 {m.city}</span></div>
              </div>
              <button className="abtn on" onClick={()=>toggleAlert(m.id,m)}>🔔</button>
            </div>
          ))}
        </div>
      )}

      {toast && <div className={`toast${toast.type==="rm"?" rm":""}`}>{toast.msg}</div>}

      <div className="bnav">
        {[["schedule","📅","Schedule"],["standings","📊","Standings"],["markets","📈","Kalshi"],["ai","🤖","AI Picks"],["myalerts","🔔","Alerts"]].map(([k,ic,lb])=>(
          <button key={k} className={`ni${tab===k?" on":""}`} onClick={()=>setTab(k)}>
            <span className="nico">{ic}</span>
            <span className="nlbl">{lb}</span>
            {k==="myalerts" && alertCount>0 && <span className="nbdg">{alertCount}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
