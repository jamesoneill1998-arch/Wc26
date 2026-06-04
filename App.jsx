import { useState, useEffect, useRef, useCallback } from "react";

// ════════════════════════════════════════════════════════════════════════════
//  LIVE DATA — real fixtures, scores, standings, lineups & stats come from
//  API-Football via the secure /api/football proxy (key stays server-side).
//  Falls back to sample/preview data until the key is set or data exists.
// ════════════════════════════════════════════════════════════════════════════
const KICKOFF = new Date("2026-06-11T15:00:00-05:00");

async function api(type, fixture) {
  const qs = new URLSearchParams({ type, ...(fixture ? { fixture } : {}) });
  const res = await fetch(`/api/football?${qs}`);
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  return res.json();
}
async function kalshiFetch(path) {
  const res = await fetch(`https://external-api.kalshi.com/trade-api/v2${path}`, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Kalshi ${res.status}`);
  return res.json();
}

const TEAMS = {
  "Mexico":["🇲🇽","A"],"South Korea":["🇰🇷","A"],"Czechia":["🇨🇿","A"],"South Africa":["🇿🇦","A"],
  "Canada":["🇨🇦","B"],"Switzerland":["🇨🇭","B"],"Qatar":["🇶🇦","B"],"Bosnia & Herz.":["🇧🇦","B"],
  "Brazil":["🇧🇷","C"],"Morocco":["🇲🇦","C"],"Scotland":["🏴󠁧󠁢󠁳󠁣󠁴󠁿","C"],"Haiti":["🇭🇹","C"],
  "USA":["🇺🇸","D"],"Australia":["🇦🇺","D"],"Paraguay":["🇵🇾","D"],"Türkiye":["🇹🇷","D"],
  "Germany":["🇩🇪","E"],"Ecuador":["🇪🇨","E"],"Ivory Coast":["🇨🇮","E"],"Curaçao":["🇨🇼","E"],
  "Netherlands":["🇳🇱","F"],"Japan":["🇯🇵","F"],"Tunisia":["🇹🇳","F"],"Sweden":["🇸🇪","F"],
  "Belgium":["🇧🇪","G"],"Iran":["🇮🇷","G"],"Egypt":["🇪🇬","G"],"New Zealand":["🇳🇿","G"],
  "Spain":["🇪🇸","H"],"Uruguay":["🇺🇾","H"],"Saudi Arabia":["🇸🇦","H"],"Cape Verde":["🇨🇻","H"],
  "France":["🇫🇷","I"],"Senegal":["🇸🇳","I"],"Norway":["🇳🇴","I"],"Iraq":["🇮🇶","I"],
  "Argentina":["🇦🇷","J"],"Austria":["🇦🇹","J"],"Algeria":["🇩🇿","J"],"Jordan":["🇯🇴","J"],
  "Portugal":["🇵🇹","K"],"Colombia":["🇨🇴","K"],"DR Congo":["🇨🇩","K"],"Uzbekistan":["🇺🇿","K"],
  "England":["🏴󠁧󠁢󠁥󠁮󠁧󠁿","L"],"Croatia":["🇭🇷","L"],"Ghana":["🇬🇭","L"],"Panama":["🇵🇦","L"],
};
const ALIASES = {"united states":"USA","korea republic":"South Korea","ir iran":"Iran","czech republic":"Czechia","turkey":"Türkiye","cote d'ivoire":"Ivory Coast","bosnia and herzegovina":"Bosnia & Herz.","cabo verde":"Cape Verde","congo dr":"DR Congo","curacao":"Curaçao"};
function resolveTeam(name=""){ if(TEAMS[name])return name; const k=name.toLowerCase().trim(); if(ALIASES[k])return ALIASES[k]; for(const t of Object.keys(TEAMS)){const tl=t.toLowerCase();if(tl.includes(k)||k.includes(tl))return t;} return null; }
const flagOf = n => { const t=resolveTeam(n); return t?TEAMS[t][0]:"🏳"; };
const groupOf = n => { const t=resolveTeam(n); return t?TEAMS[t][1]:"?"; };

const FALLBACK_MATCHES = [
  { id:1,group:"A",home:"Mexico",away:"South Africa",date:"2026-06-11",time:"3:00 PM ET",city:"Mexico City",venue:"Estadio Azteca",status:"upcoming" },
  { id:2,group:"A",home:"South Korea",away:"Czechia",date:"2026-06-11",time:"10:00 PM ET",city:"Guadalajara",venue:"Estadio Akron",status:"upcoming" },
  { id:3,group:"B",home:"Canada",away:"Bosnia & Herz.",date:"2026-06-12",time:"3:00 PM ET",city:"Toronto",venue:"BMO Field",status:"upcoming" },
  { id:4,group:"D",home:"USA",away:"Paraguay",date:"2026-06-12",time:"9:00 PM ET",city:"Los Angeles",venue:"SoFi Stadium",status:"upcoming" },
  { id:5,group:"B",home:"Qatar",away:"Switzerland",date:"2026-06-13",time:"3:00 PM ET",city:"Santa Clara",venue:"Levi's Stadium",status:"upcoming" },
  { id:6,group:"C",home:"Brazil",away:"Morocco",date:"2026-06-13",time:"6:00 PM ET",city:"New York/NJ",venue:"MetLife Stadium",status:"upcoming" },
  { id:7,group:"C",home:"Haiti",away:"Scotland",date:"2026-06-13",time:"9:00 PM ET",city:"Boston",venue:"Gillette Stadium",status:"upcoming" },
  { id:8,group:"E",home:"Germany",away:"Curaçao",date:"2026-06-14",time:"1:00 PM ET",city:"New York/NJ",venue:"MetLife Stadium",status:"upcoming" },
  { id:9,group:"F",home:"Netherlands",away:"Japan",date:"2026-06-14",time:"4:00 PM ET",city:"Santa Clara",venue:"Levi's Stadium",status:"upcoming" },
  { id:10,group:"H",home:"Spain",away:"Cape Verde",date:"2026-06-15",time:"12:00 PM ET",city:"Atlanta",venue:"Mercedes-Benz Stadium",status:"upcoming" },
  { id:11,group:"I",home:"France",away:"Senegal",date:"2026-06-16",time:"3:00 PM ET",city:"New York/NJ",venue:"MetLife Stadium",status:"upcoming" },
  { id:12,group:"J",home:"Argentina",away:"Algeria",date:"2026-06-16",time:"9:00 PM ET",city:"Kansas City",venue:"Arrowhead Stadium",status:"upcoming" },
  { id:13,group:"K",home:"Portugal",away:"DR Congo",date:"2026-06-17",time:"1:00 PM ET",city:"Houston",venue:"NRG Stadium",status:"upcoming" },
  { id:14,group:"L",home:"England",away:"Croatia",date:"2026-06-17",time:"4:00 PM ET",city:"Dallas",venue:"AT&T Stadium",status:"upcoming" },
].map(m => ({ ...m, homeFlag:flagOf(m.home), awayFlag:flagOf(m.away) }));

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
const FALLBACK_STANDINGS = {};
GROUPS.forEach(g => { FALLBACK_STANDINGS[g] = Object.entries(TEAMS).filter(([,v])=>v[1]===g).map(([name,v])=>({name,flag:v[0],played:0,w:0,d:0,l:0,pts:0})); });

const SAMPLE_DETAIL = {
  homeFormation:"4-3-3", awayFormation:"4-2-3-1",
  homeXI:[{n:1,name:"Goalkeeper",pos:"GK"},{n:2,name:"Right Back",pos:"RB"},{n:5,name:"Centre Back",pos:"CB"},{n:4,name:"Centre Back",pos:"CB"},{n:3,name:"Left Back",pos:"LB"},{n:6,name:"Midfielder",pos:"CM"},{n:8,name:"Midfielder",pos:"CM"},{n:10,name:"Playmaker",pos:"AM"},{n:7,name:"Winger",pos:"RW"},{n:9,name:"Striker",pos:"ST"},{n:11,name:"Winger",pos:"LW"}],
  awayXI:[{n:1,name:"Goalkeeper",pos:"GK"},{n:2,name:"Right Back",pos:"RB"},{n:5,name:"Centre Back",pos:"CB"},{n:4,name:"Centre Back",pos:"CB"},{n:3,name:"Left Back",pos:"LB"},{n:6,name:"Holding Mid",pos:"DM"},{n:8,name:"Holding Mid",pos:"DM"},{n:10,name:"Playmaker",pos:"AM"},{n:7,name:"Winger",pos:"RW"},{n:9,name:"Striker",pos:"ST"},{n:11,name:"Winger",pos:"LW"}],
  stats:[{label:"Possession",home:55,away:45,unit:"%"},{label:"Shots",home:12,away:8,unit:""},{label:"Shots on Target",home:5,away:3,unit:""},{label:"Corners",home:6,away:3,unit:""},{label:"Fouls",home:10,away:12,unit:""},{label:"Yellow Cards",home:1,away:2,unit:""},{label:"Red Cards",home:0,away:0,unit:""},{label:"Offsides",home:2,away:1,unit:""}],
  events:[{min:"—",type:"info",player:"Lineups and stats appear here",detail:"once the match kicks off"}],
};

function getCountdown(){ const diff=KICKOFF-new Date(); if(diff<=0)return null; return {d:Math.floor(diff/86400000),h:Math.floor(diff%86400000/3600000),m:Math.floor(diff%3600000/60000),s:Math.floor(diff%60000/1000)}; }

function mapFixtures(resp){
  if(!Array.isArray(resp))return null;
  const out=resp.map(item=>{
    const f=item.fixture||{},t=item.teams||{},g=item.goals||{};
    const short=f.status?.short||"NS";
    const status=["NS","TBD"].includes(short)?"upcoming":["FT","AET","PEN"].includes(short)?"final":"live";
    const hN=t.home?.name||"",aN=t.away?.name||"";
    const d=f.date?new Date(f.date):null;
    return {id:f.id,apiId:f.id,group:groupOf(hN),home:resolveTeam(hN)||hN,away:resolveTeam(aN)||aN,homeFlag:flagOf(hN),awayFlag:flagOf(aN),date:d?d.toISOString().slice(0,10):"",time:d?d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):"",city:f.venue?.city||"",venue:f.venue?.name||"",status,homeScore:g.home,awayScore:g.away,liveMin:f.status?.elapsed};
  }).filter(m=>m.id&&m.home&&m.away).sort((a,b)=>a.date.localeCompare(b.date));
  return out.length?out:null;
}
function mapStandings(resp){
  try{ const tables=resp?.[0]?.league?.standings; if(!Array.isArray(tables))return null;
    const byGroup={};
    tables.flat().forEach(row=>{const name=row.team?.name||"";const g=(row.group||"").replace(/group\s*/i,"").trim()||groupOf(name);if(!byGroup[g])byGroup[g]=[];byGroup[g].push({name:resolveTeam(name)||name,flag:flagOf(name),played:row.all?.played||0,w:row.all?.win||0,d:row.all?.draw||0,l:row.all?.lose||0,pts:row.points||0});});
    return Object.keys(byGroup).length?byGroup:null;
  }catch{return null;}
}
function mapDetail(lineups,events,stats){
  const d={...SAMPLE_DETAIL};
  try{
    if(Array.isArray(lineups)&&lineups.length>=2){const toXI=s=>(s.startXI||[]).map(p=>({n:p.player?.number||"-",name:p.player?.name||"?",pos:p.player?.pos||""}));d.homeXI=toXI(lineups[0]);d.awayXI=toXI(lineups[1]);d.homeFormation=lineups[0].formation||"";d.awayFormation=lineups[1].formation||"";}
    if(Array.isArray(stats)&&stats.length>=2){const grab=(s,t)=>{const x=(s.statistics||[]).find(y=>y.type===t);return x?.value??0;};const num=v=>typeof v==="string"?parseInt(v)||0:(v||0);d.stats=[{label:"Possession",home:num(grab(stats[0],"Ball Possession")),away:num(grab(stats[1],"Ball Possession")),unit:"%"},{label:"Shots",home:num(grab(stats[0],"Total Shots")),away:num(grab(stats[1],"Total Shots")),unit:""},{label:"Shots on Target",home:num(grab(stats[0],"Shots on Goal")),away:num(grab(stats[1],"Shots on Goal")),unit:""},{label:"Corners",home:num(grab(stats[0],"Corner Kicks")),away:num(grab(stats[1],"Corner Kicks")),unit:""},{label:"Fouls",home:num(grab(stats[0],"Fouls")),away:num(grab(stats[1],"Fouls")),unit:""},{label:"Yellow Cards",home:num(grab(stats[0],"Yellow Cards")),away:num(grab(stats[1],"Yellow Cards")),unit:""},{label:"Red Cards",home:num(grab(stats[0],"Red Cards")),away:num(grab(stats[1],"Red Cards")),unit:""},{label:"Offsides",home:num(grab(stats[0],"Offsides")),away:num(grab(stats[1],"Offsides")),unit:""}];}
    if(Array.isArray(events)&&events.length){d.events=events.map(e=>{const type=e.type==="Goal"?"goal":e.type==="Card"&&/yellow/i.test(e.detail)?"yellow":e.type==="Card"&&/red/i.test(e.detail)?"red":e.type==="subst"?"subst":"info";return{min:e.time?.elapsed??"—",type,player:e.player?.name||"",detail:e.detail||"",teamName:e.team?.name||""};});}
  }catch{}
  return d;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#eaf0ff;--mut:#7e89b0;--dim:#4a5680;--c1:#1fe0ff;--c2:#ff2e7e;--c3:#b6ff3a;--card:rgba(255,255,255,.04);--line:rgba(255,255,255,.09)}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0a0e1a}::-webkit-scrollbar-thumb{background:linear-gradient(#1fe0ff,#ff2e7e);border-radius:3px}
.bg{position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(circle at 80% -5%,rgba(31,224,255,.22),transparent 45%),radial-gradient(circle at 0% 25%,rgba(255,46,126,.18),transparent 45%),radial-gradient(circle at 50% 120%,rgba(182,255,58,.10),transparent 50%),#0a0e1a}
.grid{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.4;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(180deg,#000,transparent 70%)}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(182,255,58,.5)}50%{box-shadow:0 0 0 7px rgba(182,255,58,0)}}
@keyframes fsu{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slide{to{background-position:200% 0}}
.wrap{position:relative;z-index:10;font-family:'Archivo',sans-serif}

.hdr{padding:30px 22px 0;animation:fsu .5s ease both}
.kick{display:inline-block;font-size:11px;font-weight:800;letter-spacing:3px;color:var(--c1);text-transform:uppercase;border:1px solid rgba(31,224,255,.35);border-radius:100px;padding:5px 12px}
.ttl{font-family:'Anton',sans-serif;font-size:clamp(64px,21vw,118px);line-height:.82;letter-spacing:-1px;margin-top:14px;text-transform:uppercase;background:linear-gradient(100deg,#fff 10%,var(--c1) 45%,var(--c2) 90%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.sub{font-size:12px;font-weight:600;letter-spacing:1px;color:var(--mut);margin-top:8px}
.livestrip{display:inline-flex;align-items:center;gap:7px;margin-top:14px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--c3);text-transform:uppercase}
.ldot{width:8px;height:8px;border-radius:50%;background:var(--c3);animation:pulse 1.3s infinite}

.cd{margin:22px 22px 0;background:linear-gradient(135deg,rgba(31,224,255,.14),rgba(255,46,126,.10));border:1px solid var(--line);border-radius:22px;padding:22px;animation:fsu .6s ease both;position:relative;overflow:hidden}
.cd::before{content:"";position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:conic-gradient(from 0deg,transparent,rgba(31,224,255,.06),transparent 30%);animation:spin 12s linear infinite}
.cd>*{position:relative}
.cd-l{font-size:11px;font-weight:800;letter-spacing:3px;color:var(--c1);text-transform:uppercase;text-align:center}
.cd-m{font-family:'Anton',sans-serif;font-size:26px;color:var(--ink);text-align:center;margin-top:6px;letter-spacing:.5px}
.cd-row{display:flex;justify-content:center;gap:8px;margin-top:18px}
.cd-c{flex:1;max-width:78px;background:rgba(8,12,24,.55);border:1px solid var(--line);border-radius:16px;padding:14px 0;text-align:center}
.cd-n{font-family:'Anton',sans-serif;font-size:38px;color:var(--c1);line-height:1}
.cd-u{font-size:9px;font-weight:700;letter-spacing:2px;color:var(--mut);text-transform:uppercase;margin-top:5px}
.cd-v{font-size:11px;color:var(--mut);text-align:center;margin-top:16px;font-weight:500}

.tabrow{display:flex;gap:4px;padding:22px 16px 0;overflow-x:auto;scrollbar-width:none}
.tabrow::-webkit-scrollbar{display:none}
.tb{flex-shrink:0;background:none;border:none;color:var(--dim);font-family:'Archivo';font-size:12px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:11px 14px;cursor:pointer;border-radius:12px;transition:.2s}
.tb.on{color:#06101e;background:linear-gradient(120deg,var(--c1),#56ecff)}
.tb:hover:not(.on){color:var(--ink)}

.frow{display:flex;gap:8px;padding:18px 22px;overflow-x:auto;scrollbar-width:none}
.frow::-webkit-scrollbar{display:none}
.chip{flex-shrink:0;background:var(--card);border:1px solid var(--line);color:var(--mut);font-family:'Archivo';font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:9px 16px;border-radius:100px;cursor:pointer;transition:.2s}
.chip.on{background:var(--c2);border-color:var(--c2);color:#fff}

.list{padding:0 16px 110px}
.dh{font-size:12px;font-weight:800;letter-spacing:2px;color:var(--c1);text-transform:uppercase;padding:18px 6px 10px;display:flex;align-items:center;gap:8px}
.dh::after{content:"";flex:1;height:1px;background:var(--line)}
.mc{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px;margin-bottom:12px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:.22s;animation:fsu .4s ease both}
.mc:hover{border-color:rgba(31,224,255,.4);transform:translateY(-2px);box-shadow:0 10px 30px -12px rgba(31,224,255,.3)}
.mc.live{border-color:rgba(182,255,58,.4);background:linear-gradient(135deg,rgba(182,255,58,.08),var(--card))}
.mc.done{opacity:.65}
.gb{font-family:'Anton',sans-serif;font-size:13px;color:#06101e;background:linear-gradient(135deg,var(--c1),#56ecff);border-radius:10px;padding:7px 5px;min-width:42px;text-align:center;letter-spacing:.5px;line-height:1}
.gb small{display:block;font-size:7px;font-family:'Archivo';font-weight:800;letter-spacing:1px;opacity:.7}
.tms{flex:1;min-width:0}
.tr{display:flex;align-items:center;justify-content:space-between;padding:4px 0}
.tn{font-size:16px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:10px;min-width:0}
.tn span{font-size:20px;flex-shrink:0}
.sc{font-family:'Anton',sans-serif;font-size:26px;color:var(--ink);min-width:18px;text-align:right}
.sc.w{color:var(--c1)}
.md{height:1px;background:var(--line);margin:5px 0}
.meta{font-size:11px;color:var(--mut);margin-top:9px;display:flex;gap:12px;flex-wrap:wrap;font-weight:500}
.act{display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0}
.bdg{font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 9px;border-radius:8px}
.b-live{background:var(--c3);color:#06101e;animation:pulse 2s infinite}
.b-fin{background:rgba(255,255,255,.08);color:var(--dim)}
.b-up{background:rgba(31,224,255,.12);color:var(--c1);border:1px solid rgba(31,224,255,.3)}
.ab{background:none;border:1px solid var(--line);border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;transition:.2s}
.ab.on{border-color:var(--c3);background:rgba(182,255,58,.15)}
.vb{background:rgba(31,224,255,.1);border:1px solid rgba(31,224,255,.3);border-radius:10px;padding:5px 10px;color:var(--c1);font-family:'Archivo';font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;cursor:pointer;white-space:nowrap}

.mbg{position:fixed;inset:0;z-index:500;background:rgba(4,7,14,.78);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;animation:fsu .25s ease}
.mod{background:#0c1222;border:1px solid var(--line);border-top:3px solid var(--c1);border-radius:26px 26px 0 0;width:100%;max-width:480px;max-height:92vh;overflow-y:auto;padding:0 0 44px;animation:fsu .3s ease}
.mh{position:sticky;top:0;background:linear-gradient(180deg,#101830,#0c1222);border-bottom:1px solid var(--line);padding:20px;z-index:2}
.mx{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.07);border:none;color:var(--mut);width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer}
.mvs{display:flex;align-items:center;justify-content:space-around;gap:10px}
.mt{text-align:center;flex:1}
.mf{font-size:40px}
.mtn{font-size:14px;font-weight:700;color:var(--ink);margin-top:6px}
.mfm{font-size:11px;color:var(--mut);margin-top:3px;font-weight:600;letter-spacing:1px}
.mmid{font-size:12px;color:var(--mut);text-align:center;font-weight:600}
.msc{font-family:'Anton',sans-serif;font-size:38px;color:var(--c1)}
.stag{display:inline-block;margin:16px 20px 0;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--c3);background:rgba(182,255,58,.1);border:1px solid rgba(182,255,58,.3);border-radius:8px;padding:5px 10px;text-transform:uppercase}
.sec{padding:20px 20px 0}
.st{font-size:11px;font-weight:800;letter-spacing:2.5px;color:var(--c1);text-transform:uppercase;margin-bottom:15px}
.stat{margin-bottom:15px}
.statt{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.statt b{font-family:'Anton',sans-serif;font-size:18px;font-weight:400}
.statl{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--mut);text-transform:uppercase}
.sbar{display:flex;height:7px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.06);gap:3px}
.sbh{background:linear-gradient(90deg,#0e9fb8,var(--c1));transition:width 1s ease}
.sba{background:linear-gradient(90deg,var(--c2),#ff77a8);transition:width 1s ease}
.lu{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.lct{font-size:12px;font-weight:700;color:var(--ink);margin-bottom:10px;display:flex;align-items:center;gap:7px}
.pl{display:flex;align-items:center;gap:9px;padding:8px 10px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:11px;margin-bottom:6px}
.pln{font-family:'Anton',sans-serif;font-size:15px;color:var(--c1);width:24px;text-align:center;flex-shrink:0}
.plnm{font-size:12px;font-weight:600;color:var(--ink);flex:1;line-height:1.2}
.plp{font-size:8px;font-weight:800;letter-spacing:1px;color:var(--dim);background:rgba(255,255,255,.05);padding:2px 5px;border-radius:4px}
.ev{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--line)}
.evm{font-family:'Anton',sans-serif;font-size:16px;color:var(--mut);width:36px;flex-shrink:0}
.evi{font-size:15px;width:22px;text-align:center}
.evt{font-size:13px;font-weight:600;color:var(--ink)}
.evd{font-size:11px;color:var(--mut)}

.pad{padding:18px 16px 110px}
.note{font-size:11px;font-weight:600;color:var(--mut);letter-spacing:.5px;margin-bottom:16px;text-transform:uppercase}
.gtabs{display:flex;flex-wrap:wrap;gap:7px;padding-bottom:18px}
.gt{background:var(--card);border:1px solid var(--line);color:var(--mut);font-family:'Archivo';font-size:12px;font-weight:700;letter-spacing:1px;padding:8px 14px;border-radius:10px;cursor:pointer;transition:.2s}
.gt.on{background:linear-gradient(120deg,var(--c1),#56ecff);border-color:transparent;color:#06101e}
.tbl{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.tbl th{font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--dim);text-transform:uppercase;padding:12px;text-align:left;border-bottom:1px solid var(--line)}
.tbl td{font-size:14px;color:var(--mut);padding:14px 12px;border-bottom:1px solid var(--line);font-weight:600}
.tc{display:flex;align-items:center;gap:10px;color:var(--ink);font-weight:700}
.tc span{font-size:19px}

.mtitle{font-family:'Anton',sans-serif;font-size:30px;color:var(--ink);letter-spacing:.5px;text-transform:uppercase}
.mhd{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px}
.mvol{font-size:11px;color:var(--mut);font-weight:600}
.oc{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:10px;animation:fsu .35s ease both}
.or{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.ork{font-family:'Anton',sans-serif;font-size:18px;color:var(--dim);width:24px}
.ot{font-size:15px;font-weight:700;color:var(--ink);flex:1;display:flex;align-items:center;gap:10px}
.ot span{font-size:20px}
.op{font-family:'Anton',sans-serif;font-size:24px;color:var(--ink)}
.pbw{display:flex;align-items:center;gap:10px}
.pb{flex:1;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden}
.pf{height:100%;background:linear-gradient(90deg,var(--c1),var(--c2));transition:width 1.2s ease}
.pp{font-size:13px;font-weight:700;color:var(--ink);width:40px;text-align:right}
.tag{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--dim);background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:6px;padding:3px 8px}
.disc{font-size:10px;color:var(--dim);letter-spacing:.3px;margin-top:18px;line-height:1.7;padding:14px;background:rgba(255,255,255,.02);border-radius:12px;border:1px solid var(--line)}
.cta{display:block;margin-top:14px;text-align:center;font-size:12px;font-weight:800;letter-spacing:1.5px;color:#06101e;text-decoration:none;padding:14px;border-radius:14px;background:linear-gradient(120deg,var(--c1),#56ecff);text-transform:uppercase}

.aih{font-family:'Anton',sans-serif;font-size:42px;color:var(--ink);text-transform:uppercase;letter-spacing:.5px}
.ais{font-size:12px;color:var(--c2);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px;margin-bottom:20px}
.aim{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:9px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;transition:.2s;animation:fsu .3s ease both}
.aim:hover{border-color:rgba(255,46,126,.4);transform:translateY(-1px)}
.aim.sel{border-color:var(--c2);background:rgba(255,46,126,.08)}
.air{background:linear-gradient(140deg,rgba(255,46,126,.14),rgba(31,224,255,.08));border:1px solid rgba(255,46,126,.35);border-radius:20px;padding:22px;margin-top:18px;animation:fsu .4s ease}
.aiv{font-family:'Anton',sans-serif;font-size:42px;color:var(--c3);line-height:.95;text-transform:uppercase}
.aip{font-family:'Anton',sans-serif;font-size:26px;color:var(--c1);margin-top:4px}
.aicb{height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;margin:14px 0 5px}
.aicf{height:100%;background:linear-gradient(90deg,var(--c2),#ff77a8);transition:width .8s ease}
.aicl{font-size:11px;color:var(--mut);font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.aidr{display:flex;gap:9px;margin-top:14px}
.aidb{flex:1;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:12px;padding:12px}
.aidl{font-size:9px;font-weight:800;letter-spacing:1.5px;color:var(--c1);text-transform:uppercase;margin-bottom:5px}
.aidt{font-size:12px;color:var(--mut);line-height:1.5;font-weight:500}
.ait{margin-top:14px;background:rgba(182,255,58,.08);border:1px solid rgba(182,255,58,.3);border-radius:12px;padding:14px}
.aitl{font-size:9px;font-weight:800;letter-spacing:1.5px;color:var(--c3);text-transform:uppercase;margin-bottom:5px}
.aitt{font-size:13px;color:#dcefb0;line-height:1.5;font-weight:500}
.spin{width:34px;height:34px;border:3px solid rgba(255,46,126,.2);border-top-color:var(--c2);border-radius:50%;animation:spin .8s linear infinite}
.aild{display:flex;flex-direction:column;align-items:center;padding:44px;gap:14px}
.aildt{font-size:12px;color:var(--c2);font-weight:700;letter-spacing:2px;text-transform:uppercase}
.kspin{width:28px;height:28px;border:3px solid rgba(31,224,255,.2);border-top-color:var(--c1);border-radius:50%;animation:spin .8s linear infinite;margin:34px auto}

.bigc{font-family:'Anton',sans-serif;font-size:80px;color:var(--c3);line-height:1}
.empty{text-align:center;padding:64px 20px;color:var(--dim)}
.emi{font-size:52px;margin-bottom:18px;opacity:.6}
.emt{font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}

.toast{position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:#0e1830;border:1px solid var(--c1);color:var(--c1);font-size:13px;font-weight:600;padding:13px 22px;border-radius:14px;z-index:999;white-space:nowrap;box-shadow:0 10px 40px rgba(0,0,0,.5);animation:fsu .3s ease}
.toast.rm{border-color:var(--c2);color:var(--c2)}
.nav{position:fixed;bottom:0;left:0;right:0;z-index:100;background:rgba(8,12,22,.92);backdrop-filter:blur(22px);border-top:1px solid var(--line);display:flex;padding:10px 0 max(10px,env(safe-area-inset-bottom))}
.ni{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;cursor:pointer;padding:6px 4px;position:relative}
.nico{font-size:20px;transition:.2s}
.nl{font-family:'Archivo';font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--dim)}
.ni.on .nl{color:var(--c1)}
.ni.on .nico{transform:scale(1.15);filter:drop-shadow(0 0 8px rgba(31,224,255,.7))}
.nb{position:absolute;top:0;right:calc(50% - 20px);background:var(--c2);color:#fff;font-size:9px;font-weight:800;border-radius:8px;padding:1px 5px}
`;

export default function App(){
  const [tab,setTab]=useState("schedule");
  const [filter,setFilter]=useState("all");
  const [alerts,setAlerts]=useState({});
  const [toast,setToast]=useState(null);
  const [selGroup,setSelGroup]=useState("A");
  const [detail,setDetail]=useState(null);
  const [detailData,setDetailData]=useState(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [cd,setCd]=useState(getCountdown());
  const [matches,setMatches]=useState(FALLBACK_MATCHES);
  const [standings,setStandings]=useState(FALLBACK_STANDINGS);
  const [isLive,setIsLive]=useState(false);
  const [kWinner,setKWinner]=useState(null);
  const [aiMatch,setAiMatch]=useState(null);
  const [aiLoading,setAiLoading]=useState(false);
  const [aiResult,setAiResult]=useState(null);
  const [aiError,setAiError]=useState(null);
  const toastRef=useRef(null);

  useEffect(()=>{const iv=setInterval(()=>setCd(getCountdown()),1000);return()=>clearInterval(iv);},[]);

  const loadLive=useCallback(async()=>{
    try{const fx=await api("fixtures");if(fx?.configured&&fx.response){const m=mapFixtures(fx.response);if(m){setMatches(m);setIsLive(true);}}}catch{}
    try{const st=await api("standings");if(st?.configured&&st.response){const m=mapStandings(st.response);if(m)setStandings(m);}}catch{}
  },[]);
  useEffect(()=>{loadLive();const iv=setInterval(loadLive,60000);return()=>clearInterval(iv);},[loadLive]);

  useEffect(()=>{
    if(!detail){setDetailData(null);return;}
    if(!detail.apiId){setDetailData(SAMPLE_DETAIL);return;}
    let cancelled=false;setDetailLoading(true);setDetailData(null);
    (async()=>{
      try{
        const [lu,ev,stx]=await Promise.all([api("lineups",detail.apiId).catch(()=>null),api("events",detail.apiId).catch(()=>null),api("statistics",detail.apiId).catch(()=>null)]);
        if(cancelled)return;
        const has=lu?.response?.length>=2;
        setDetailData(has||ev?.response?.length||stx?.response?.length?mapDetail(lu?.response,ev?.response,stx?.response):SAMPLE_DETAIL);
      }catch{if(!cancelled)setDetailData(SAMPLE_DETAIL);}
      if(!cancelled)setDetailLoading(false);
    })();
    return()=>{cancelled=true;};
  },[detail]);

  const showToast=(msg,type="ok")=>{if(toastRef.current)clearTimeout(toastRef.current);setToast({msg,type});toastRef.current=setTimeout(()=>setToast(null),3000);};
  const toggleAlert=(id,m,e)=>{e?.stopPropagation();setAlerts(p=>{const n={...p};if(n[id]){delete n[id];showToast("Alert removed","rm");}else{n[id]=true;showToast(`🔔 Alert set — ${m.home} v ${m.away}`);}return n;});};

  const FW=[{team:"France",flag:"🇫🇷",prob:17,odds:"+489"},{team:"Spain",flag:"🇪🇸",prob:16,odds:"+526"},{team:"England",flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",prob:11,odds:"+810"},{team:"Argentina",flag:"🇦🇷",prob:10,odds:"+900"},{team:"Brazil",flag:"🇧🇷",prob:10,odds:"+920"},{team:"Germany",flag:"🇩🇪",prob:8,odds:"+1120"},{team:"Portugal",flag:"🇵🇹",prob:6,odds:"+1460"},{team:"Netherlands",flag:"🇳🇱",prob:5,odds:"+1860"},{team:"USA",flag:"🇺🇸",prob:4,odds:"+2230"},{team:"Belgium",flag:"🇧🇪",prob:3,odds:"+3350"}];
  const loadKalshi=useCallback(async()=>{try{for(const t of["FIFAWC","WCWINNER","FIFA26"]){try{const d=await kalshiFetch(`/markets?series_ticker=${t}&status=open&limit=50`);const mk=d.markets||[];if(mk.length){const p=mk.filter(m=>m.yes_bid_dollars||m.last_price).map(m=>{const pr=m.yes_bid_dollars||(m.last_price?m.last_price/100:0);const pc=Math.round(pr*100);const tm=(m.title||"").replace(/will |win the |world cup|2026|fifa|\?/gi,"").trim();return{team:tm,flag:flagOf(tm),prob:pc,odds:pc>0?`+${Math.round((100-pc)/pc*100)}`:"N/A"};}).filter(m=>m.prob>0).sort((a,b)=>b.prob-a.prob).slice(0,12);if(p.length){setKWinner(p);break;}}}catch(_){}}}catch(_){}},[]);
  useEffect(()=>{if(tab==="markets")loadKalshi();},[tab]);
  const winnerData=kWinner||FW;

  const getAi=async(m)=>{setAiMatch(m);setAiLoading(true);setAiResult(null);setAiError(null);try{const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`World Cup 2026 analyst. Respond ONLY valid JSON:{"verdict":"Home Win"|"Draw"|"Away Win","confidence":1-100,"predictedScore":"X-Y","keyFactor":"sentence","homeStrength":"sentence","awayStrength":"sentence","tip":"max 20 words"}`,messages:[{role:"user",content:`Predict ${m.home} vs ${m.away}, Group ${m.group}.`}]})});const data=await res.json();const txt=data.content?.find(b=>b.type==="text")?.text||"";setAiResult(JSON.parse(txt.replace(/```json|```/g,"").trim()));}catch{setAiError("Prediction failed — try again.");}setAiLoading(false);};

  const alertCount=Object.keys(alerts).length;
  const upcoming=matches.filter(m=>m.status==="upcoming");
  const filtered=matches.filter(m=>filter==="alerts"?alerts[m.id]:filter==="live"?m.status==="live":filter==="upcoming"?m.status==="upcoming":true);
  const dd=detailData;

  return (
    <div style={{minHeight:"100vh",background:"#0a0e1a",color:"var(--ink)",overflowX:"hidden"}}>
      <style>{CSS}</style>
      <div className="bg"/><div className="grid"/>
      <div className="wrap">

        <div className="hdr">
          <div className="kick">⚽ June 11 – July 19, 2026</div>
          <div className="ttl">WC26</div>
          <div className="sub">SCHEDULE · LINEUPS · STATS · KALSHI · AI PICKS</div>
          {isLive && <div className="livestrip"><span className="ldot"/>Live data connected</div>}
        </div>

        {cd && (
          <div className="cd">
            <div className="cd-l">⚡ Kick-off in</div>
            <div className="cd-m">🇲🇽 MEXICO vs SOUTH AFRICA 🇿🇦</div>
            <div className="cd-row">{[["d",cd.d,"Days"],["h",cd.h,"Hrs"],["m",cd.m,"Min"],["s",cd.s,"Sec"]].map(([k,v,u])=>(<div key={k} className="cd-c"><div className="cd-n">{String(v).padStart(2,"0")}</div><div className="cd-u">{u}</div></div>))}</div>
            <div className="cd-v">📍 Estadio Azteca, Mexico City</div>
          </div>
        )}

        <div className="tabrow">{[["schedule","Schedule"],["standings","Standings"],["markets","Kalshi"],["ai","AI Picks"],["myalerts","Alerts"]].map(([k,l])=>(<button key={k} className={`tb${tab===k?" on":""}`} onClick={()=>setTab(k)}>{l}{k==="myalerts"&&alertCount>0?` ${alertCount}`:""}</button>))}</div>

        {tab==="schedule" && (<>
          <div className="frow">{[["all","All"],["live","🔴 Live"],["upcoming","Upcoming"],["alerts","Alerts"]].map(([k,l])=>(<button key={k} className={`chip${filter===k?" on":""}`} onClick={()=>setFilter(k)}>{l}</button>))}</div>
          <div className="list">
            {filtered.length===0&&<div className="empty"><div className="emi">⚽</div><div className="emt">No matches</div></div>}
            {filtered.reduce((acc,m,i)=>{
              const pd=i>0?filtered[i-1].date:null;
              if(m.date!==pd&&m.date){const d=new Date(m.date+"T12:00:00");acc.push(<div key={`d${m.date}${i}`} className="dh">{d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>);}
              const hw=m.homeScore>m.awayScore,aw=m.awayScore>m.homeScore,played=m.status!=="upcoming";
              acc.push(
                <div key={m.id} className={`mc${m.status==="live"?" live":""}${m.status==="final"?" done":""}`} style={{animationDelay:`${(i%6)*.05}s`}} onClick={()=>setDetail(m)}>
                  <div className="gb">{m.group}<small>GRP</small></div>
                  <div className="tms">
                    <div className="tr"><div className="tn"><span>{m.homeFlag}</span>{m.home}</div>{played&&<div className={`sc${hw?" w":""}`}>{m.homeScore}</div>}</div>
                    <div className="md"/>
                    <div className="tr"><div className="tn"><span>{m.awayFlag}</span>{m.away}</div>{played&&<div className={`sc${aw?" w":""}`}>{m.awayScore}</div>}</div>
                    <div className="meta"><span>🕐 {m.time}</span>{m.city&&<span>📍 {m.city}</span>}</div>
                  </div>
                  <div className="act">
                    {m.status==="live"&&<span className="bdg b-live">{m.liveMin?`${m.liveMin}'`:"LIVE"}</span>}
                    {m.status==="final"&&<span className="bdg b-fin">FT</span>}
                    {m.status==="upcoming"&&<span className="bdg b-up">Soon</span>}
                    <button className={`ab${alerts[m.id]?" on":""}`} onClick={(e)=>toggleAlert(m.id,m,e)}>{alerts[m.id]?"🔔":"🔕"}</button>
                    <button className="vb" onClick={(e)=>{e.stopPropagation();setDetail(m);}}>Details</button>
                  </div>
                </div>
              );
              return acc;
            },[])}
          </div>
        </>)}

        {tab==="standings" && (
          <div className="pad">
            {!isLive&&<div className="note">Group stage begins June 11 — updates live once games start</div>}
            <div className="gtabs">{GROUPS.map(g=><button key={g} className={`gt${selGroup===g?" on":""}`} onClick={()=>setSelGroup(g)}>{g}</button>)}</div>
            <table className="tbl">
              <thead><tr><th>#</th><th>Team</th><th style={{textAlign:"center"}}>P</th><th style={{textAlign:"center"}}>W</th><th style={{textAlign:"center"}}>D</th><th style={{textAlign:"center"}}>L</th><th style={{textAlign:"right"}}>PTS</th></tr></thead>
              <tbody>{(standings[selGroup]||[]).map((t,i)=>(<tr key={t.name}><td style={{color:"var(--dim)"}}>{i+1}</td><td><div className="tc"><span>{t.flag}</span>{t.name}</div></td><td style={{textAlign:"center"}}>{t.played}</td><td style={{textAlign:"center"}}>{t.w}</td><td style={{textAlign:"center"}}>{t.d}</td><td style={{textAlign:"center"}}>{t.l}</td><td style={{textAlign:"right",fontFamily:"'Anton',sans-serif",fontSize:20,color:"var(--c1)"}}>{t.pts}</td></tr>))}</tbody>
            </table>
          </div>
        )}

        {tab==="markets" && (
          <div className="pad">
            <div className="note" style={{color:kWinner?"var(--c3)":"var(--mut)"}}>{kWinner?"● Live Kalshi data":"Estimated — recent Kalshi prices"}</div>
            <div className="mhd"><div className="mtitle">Win The Cup</div><div className="mvol">Kalshi Market</div></div>
            <div style={{display:"flex",gap:8,marginBottom:16}}><span className="tag">KALSHI</span><span className="tag">CFTC REGULATED</span></div>
            {winnerData.map((it,i)=>(<div key={it.team+i} className="oc" style={{animationDelay:`${i*.04}s`}}><div className="or"><span className="ork">{i+1}</span><span className="ot"><span>{it.flag}</span>{it.team}</span><span className="op">{it.odds}</span></div><div className="pbw"><div className="pb"><div className="pf" style={{width:`${(it.prob/(winnerData[0]?.prob||17))*100}%`}}/></div><span className="pp">{it.prob}%</span></div></div>))}
            <a className="cta" href="https://kalshi.com/category/sports/soccer/fifa-world-cup" target="_blank" rel="noopener noreferrer">Trade on Kalshi →</a>
            <div className="disc">⚠ Prediction-market data from Kalshi (CFTC-regulated). Trading involves risk. 18+ US only. Not financial advice.</div>
          </div>
        )}

        {tab==="ai" && (
          <div className="pad">
            <div className="aih">AI Picks</div>
            <div className="ais">Claude · Form & Matchup Analysis</div>
            {(upcoming.length?upcoming:matches).slice(0,10).map((m,i)=>(<div key={m.id} className={`aim${aiMatch?.id===m.id?" sel":""}`} style={{animationDelay:`${i*.04}s`}} onClick={()=>getAi(m)}><div><div style={{fontSize:15,fontWeight:700,color:"var(--ink)"}}>{m.homeFlag} {m.home} <span style={{color:"var(--dim)"}}>v</span> {m.awayFlag} {m.away}</div><div style={{fontSize:11,color:"var(--mut)",marginTop:3,fontWeight:600}}>Group {m.group} · {m.time}</div></div><span style={{color:"var(--c2)",fontSize:20}}>→</span></div>))}
            {aiLoading&&<div className="air"><div className="aild"><div className="spin"/><div className="aildt">Analysing…</div></div></div>}
            {aiError&&!aiLoading&&<div className="air" style={{borderColor:"rgba(255,80,80,.4)"}}><div style={{color:"#ff8080",fontSize:13}}>{aiError}</div></div>}
            {aiResult&&!aiLoading&&aiMatch&&(<div className="air"><div style={{fontSize:11,color:"var(--c1)",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>{aiMatch.homeFlag} {aiMatch.home} v {aiMatch.awayFlag} {aiMatch.away}</div><div className="aiv">{aiResult.verdict}</div><div className="aip">Predicted {aiResult.predictedScore}</div><div className="aicb"><div className="aicf" style={{width:`${aiResult.confidence}%`}}/></div><div className="aicl">Confidence {aiResult.confidence}%</div><div style={{marginTop:14,padding:"12px 14px",background:"rgba(255,255,255,.04)",border:"1px solid var(--line)",borderRadius:12}}><div style={{fontSize:9,fontWeight:800,color:"var(--c1)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:5}}>Key Factor</div><div style={{fontSize:13,color:"var(--mut)",lineHeight:1.6,fontWeight:500}}>{aiResult.keyFactor}</div></div><div className="aidr"><div className="aidb"><div className="aidl">{aiMatch.homeFlag} {aiMatch.home}</div><div className="aidt">{aiResult.homeStrength}</div></div><div className="aidb"><div className="aidl">{aiMatch.awayFlag} {aiMatch.away}</div><div className="aidt">{aiResult.awayStrength}</div></div></div>{aiResult.tip&&<div className="ait"><div className="aitl">💡 Insight</div><div className="aitt">{aiResult.tip}</div></div>}<div style={{marginTop:14,fontSize:10,color:"var(--dim)",letterSpacing:.5}}>⚠ For entertainment only. Not betting advice.</div></div>)}
            {!aiMatch&&!aiLoading&&<div className="empty" style={{marginTop:8}}><div className="emi">🤖</div><div className="emt">Tap a match for a prediction</div></div>}
          </div>
        )}

        {tab==="myalerts" && (
          <div className="pad">
            <div className="bigc">{alertCount}</div>
            <div className="note" style={{marginTop:8}}>Active Alerts</div>
            {alertCount===0?<div className="empty"><div className="emi">🔕</div><div className="emt">No alerts yet</div><div style={{fontSize:12,color:"var(--dim)",marginTop:12,fontWeight:600}}>Tap 🔕 on any fixture</div></div>
            :matches.filter(m=>alerts[m.id]).map((m,i)=>(<div key={m.id} className="mc" style={{animationDelay:`${i*.07}s`}} onClick={()=>setDetail(m)}><div className="gb">{m.group}<small>GRP</small></div><div className="tms"><div className="tr"><div className="tn"><span>{m.homeFlag}</span>{m.home}</div></div><div className="md"/><div className="tr"><div className="tn"><span>{m.awayFlag}</span>{m.away}</div></div><div className="meta"><span>🕐 {m.time}</span>{m.city&&<span>📍 {m.city}</span>}</div></div><button className="ab on" onClick={(e)=>toggleAlert(m.id,m,e)}>🔔</button></div>))}
          </div>
        )}

        {detail && (
          <div className="mbg" onClick={()=>setDetail(null)}>
            <div className="mod" onClick={e=>e.stopPropagation()}>
              <div className="mh">
                <button className="mx" onClick={()=>setDetail(null)}>✕</button>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:"var(--dim)",textTransform:"uppercase",textAlign:"center",marginBottom:14}}>Group {detail.group}{detail.venue?` · ${detail.venue}`:""}</div>
                <div className="mvs">
                  <div className="mt"><div className="mf">{detail.homeFlag}</div><div className="mtn">{detail.home}</div><div className="mfm">{dd?.homeFormation}</div></div>
                  <div className="mmid">{detail.status!=="upcoming"?<div className="msc">{detail.homeScore} – {detail.awayScore}</div>:<>{detail.time}<br/>{detail.date&&new Date(detail.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</>}</div>
                  <div className="mt"><div className="mf">{detail.awayFlag}</div><div className="mtn">{detail.away}</div><div className="mfm">{dd?.awayFormation}</div></div>
                </div>
              </div>
              {detailLoading&&<div className="kspin"/>}
              {!detailLoading&&dd&&(<>
                {dd===SAMPLE_DETAIL&&<div className="stag">⚠ Sample preview — live data appears at kickoff</div>}
                <div className="sec"><div className="st">Starting XI</div><div className="lu"><div><div className="lct">{detail.homeFlag} {detail.home}</div>{dd.homeXI.map((p,i)=>(<div key={i} className="pl"><span className="pln">{p.n}</span><span className="plnm">{p.name}</span>{p.pos&&<span className="plp">{p.pos}</span>}</div>))}</div><div><div className="lct">{detail.awayFlag} {detail.away}</div>{dd.awayXI.map((p,i)=>(<div key={i} className="pl"><span className="pln">{p.n}</span><span className="plnm">{p.name}</span>{p.pos&&<span className="plp">{p.pos}</span>}</div>))}</div></div></div>
                <div className="sec"><div className="st">Match Stats</div>{dd.stats.map(s=>{const tot=s.home+s.away||1;return(<div key={s.label} className="stat"><div className="statt"><b style={{color:"var(--c1)"}}>{s.home}{s.unit}</b><span className="statl">{s.label}</span><b style={{color:"var(--c2)"}}>{s.away}{s.unit}</b></div><div className="sbar"><div className="sbh" style={{width:`${s.home/tot*100}%`}}/><div className="sba" style={{width:`${s.away/tot*100}%`}}/></div></div>);})}</div>
                <div className="sec"><div className="st">Match Events</div>{dd.events.map((ev,i)=>{const ico=ev.type==="goal"?"⚽":ev.type==="yellow"?"🟨":ev.type==="red"?"🟥":ev.type==="subst"?"🔁":"ℹ️";return(<div key={i} className="ev"><span className="evm">{ev.min}{typeof ev.min==="number"?"'":""}</span><span className="evi">{ico}</span><div><div className="evt">{ev.player}{ev.teamName?` (${ev.teamName})`:""}</div><div className="evd">{ev.detail}</div></div></div>);})}</div>
                <div className="sec"><button onClick={(e)=>toggleAlert(detail.id,detail,e)} style={{width:"100%",padding:14,background:alerts[detail.id]?"rgba(182,255,58,.15)":"rgba(255,255,255,.04)",border:`1px solid ${alerts[detail.id]?"var(--c3)":"var(--line)"}`,borderRadius:14,color:alerts[detail.id]?"var(--c3)":"var(--ink)",fontFamily:"'Archivo'",fontSize:12,fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer"}}>{alerts[detail.id]?"🔔 Alert Set — Tap to Remove":"🔕 Set Kickoff Alert"}</button></div>
              </>)}
            </div>
          </div>
        )}

        {toast&&<div className={`toast${toast.type==="rm"?" rm":""}`}>{toast.msg}</div>}

        <div className="nav">{[["schedule","📅","Schedule"],["standings","📊","Table"],["markets","📈","Kalshi"],["ai","🤖","AI"],["myalerts","🔔","Alerts"]].map(([k,ic,l])=>(<button key={k} className={`ni${tab===k?" on":""}`} onClick={()=>setTab(k)}><span className="nico">{ic}</span><span className="nl">{l}</span>{k==="myalerts"&&alertCount>0&&<span className="nb">{alertCount}</span>}</button>))}</div>
      </div>
    </div>
  );
}
