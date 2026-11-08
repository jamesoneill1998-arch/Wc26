/* Brand Wars — General Manager mode (pure game logic, no DOM).
   Two brands share one roster pool. You run one; a CPU general manager runs the other.
   Each week both brands put on a show, TV ratings decide the weekly ratings war,
   and every fourth week is a pay-per-view. */
(function () {
  const BW = (window.BW = window.BW || {});
  const rand = Math.random;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (a) => a[(rand() * a.length) | 0];
  const round = (v, s) => Math.round(v / s) * s;
  const SAVE_KEY = 'bw.gm.v1';

  const AI_SKILL = { easy: 0.93, normal: 1.0, hard: 1.05, legend: 1.09 };
  const SALARY_CAP = 1000; // $k per week, enforced during the draft
  const ROSTER_SIZE = 14;
  const MIN_WOMEN = 3;

  const GM = {};
  BW.GM = GM;
  GM.SALARY_CAP = SALARY_CAP;
  GM.ROSTER_SIZE = ROSTER_SIZE;

  /* ---------------- setup ---------------- */
  GM.newGame = function (o) {
    const roster = {};
    for (const r of o.roster) {
      roster[r.id] = Object.assign(JSON.parse(JSON.stringify(r)), {
        brand: 'fa', morale: 70, fatigue: 0, injury: 0, wins: 0, losses: 0, lastBooked: 0, streak: 0, turnedWeek: -99,
      });
    }
    const player = o.brand;
    const rival = player === 'ignite' ? 'uprising' : 'ignite';
    const s = {
      v: 1, created: Date.now(), week: 1, weeks: o.weeks || 24, difficulty: o.difficulty || 'normal',
      player, rival, phase: 'draft', roster,
      titles: { ignite: {}, uprising: {} }, titleHistory: [],
      feuds: {},
      brands: {
        ignite: { cash: 2000, fans: 1000, ratings: [], warWins: 0, bestStars: 0, wentBroke: false },
        uprising: { cash: 2000, fans: 1000, ratings: [], warWins: 0, bestStars: 0, wentBroke: false },
      },
      inbox: [], history: [], card: null, show: null, lastSummary: null,
      draft: { turn: rand() < 0.5 ? player : rival, picks: [], round: 1 },
      matchDifficulty: o.matchDifficulty || o.difficulty || 'normal',
    };
    s.goals = [
      { id: 'war', text: 'Win the ratings war in at least 55% of weeks' },
      { id: 'fans', text: `Finish the season with more fans than ${BW.BRANDS[rival].name}` },
      { id: 'cash', text: 'Never let the bank balance drop below $0' },
      { id: 'stars', text: 'Put on a match rated 4.5 stars or better' },
    ];
    mail(s, 'Board of Directors', `Welcome to ${BW.BRANDS[player].name}`,
      `You are the new General Manager of ${BW.BRANDS[player].night} ${BW.BRANDS[player].name}. ` +
      `The season runs ${s.weeks} weeks with a pay-per-view every fourth week. Draft a roster under the $${SALARY_CAP}k weekly salary cap, ` +
      `then win the ratings war against ${BW.BRANDS[rival].name}. Your goals are on the Season tab.`);
    mail(s, `${BW.BRANDS[rival].name} GM`, 'Good luck. You will need it.',
      `Enjoy the draft. I already know who I'm taking first, and when the ratings come in on Saturday, I'll be the one smiling.`);
    if (s.draft.turn === rival) GM.aiDraftPick(s);
    return s;
  };

  function mail(s, from, subject, body) {
    s.inbox.unshift({ id: Math.random().toString(36).slice(2), week: s.week, from, subject, body, read: false });
    if (s.inbox.length > 80) s.inbox.length = 80;
  }
  GM.mail = mail;

  GM.isPPV = (s, week) => { const w = week || s.week; return w % 4 === 0 || w === s.weeks; };
  GM.showName = function (s, brand, week) {
    const w = week || s.week;
    if (w === s.weeks) return 'Brand Wars';
    if (GM.isPPV(s, w)) return BW.PPVS[((w / 4) - 1 + (brand === 'uprising' ? 6 : 0)) % BW.PPVS.length];
    return `${BW.BRANDS[brand].night} ${BW.BRANDS[brand].name}`;
  };

  GM.list = (s, brand) => Object.values(s.roster).filter((r) => r.brand === brand);
  GM.value = (r) => r.pop * 0.6 + r.ovr * 0.4;
  GM.payroll = (s, brand) => GM.list(s, brand).reduce((a, r) => a + r.salary, 0);

  /* ---------------- draft ---------------- */
  GM.draftPool = (s) => GM.list(s, 'fa').sort((a, b) => GM.value(b) - GM.value(a));
  // Roster-shape rules: size and the women's division. These are never relaxed.
  function shapeBlock(s, brand, r) {
    const mine = GM.list(s, brand);
    if (mine.length >= ROSTER_SIZE) return 'Roster is full';
    const remaining = ROSTER_SIZE - mine.length - 1;
    const women = mine.filter((x) => x.gender === 'f').length + (r.gender === 'f' ? 1 : 0);
    const needWomen = Math.max(0, MIN_WOMEN - women);
    const womenLeft = GM.draftPool(s).filter((x) => x.id !== r.id && x.gender === 'f').length;
    if (needWomen > remaining) return `Save room for ${MIN_WOMEN} women`;
    const other = brand === 'ignite' ? 'uprising' : 'ignite';
    const otherList = GM.list(s, other);
    const otherNeed = Math.max(0, MIN_WOMEN - otherList.filter((x) => x.gender === 'f').length);
    if (needWomen + otherNeed > womenLeft) return r.gender === 'f' ? 'The other brand needs these women' : 'Not enough women left';
    // keep enough men in the pool for both rosters to fill up
    const menLeft = GM.draftPool(s).filter((x) => x.id !== r.id && x.gender === 'm').length;
    const menNeed = (remaining - needWomen) + Math.max(0, ROSTER_SIZE - otherList.length - otherNeed);
    if (r.gender === 'f' && menLeft < menNeed) return 'Save room for men';
    return null;
  }
  function capBlock(s, brand, r) {
    const remaining = ROSTER_SIZE - GM.list(s, brand).length - 1;
    const pool = GM.draftPool(s).filter((x) => x.id !== r.id).map((x) => x.salary).sort((a, b) => a - b);
    const cheapest = pool.slice(0, remaining).reduce((a, v) => a + v, 0);
    return GM.payroll(s, brand) + r.salary + cheapest > SALARY_CAP ? 'Over the salary cap' : null;
  }
  // If no pick fits under the cap, the cap gives way so the draft can always finish,
  // but only the cheapest pick that keeps the roster legal is allowed.
  GM.canDraft = function (s, brand, r) {
    const shape = shapeBlock(s, brand, r);
    if (shape) return shape;
    if (!capBlock(s, brand, r)) return null;
    const pool = GM.draftPool(s);
    if (pool.some((x) => !shapeBlock(s, brand, x) && !capBlock(s, brand, x))) return 'Over the salary cap';
    const cheapest = pool.filter((x) => !shapeBlock(s, brand, x)).sort((a, b) => a.salary - b.salary)[0];
    return cheapest && cheapest.salary === r.salary ? null : 'Over the salary cap';
  };
  GM.draftPick = function (s, brand, id) {
    const r = s.roster[id];
    if (!r || r.brand !== 'fa' || s.draft.turn !== brand) return false;
    if (GM.canDraft(s, brand, r)) return false;
    r.brand = brand;
    s.draft.picks.push({ brand, id, n: s.draft.picks.length + 1 });
    const other = brand === 'ignite' ? 'uprising' : 'ignite';
    s.draft.turn = GM.list(s, other).length < ROSTER_SIZE ? other : brand;
    if (GM.draftDone(s)) { s.phase = 'champions'; GM.autoChampions(s); }
    return true;
  };
  GM.draftDone = (s) => GM.list(s, 'ignite').length >= ROSTER_SIZE && GM.list(s, 'uprising').length >= ROSTER_SIZE;
  GM.aiDraftChoice = function (s, brand) {
    const mine = GM.list(s, brand);
    let best = null, bs = -1e9;
    for (const r of GM.draftPool(s)) {
      if (GM.canDraft(s, brand, r)) continue;
      let v = GM.value(r) - r.salary * 0.12;
      if (r.team && mine.some((m) => m.team === r.team)) v += 9;
      const women = mine.filter((m) => m.gender === 'f').length;
      if (r.gender === 'f' && women < MIN_WOMEN) v += 6;
      if (r.gender === 'f' && women >= MIN_WOMEN + 1) v -= 12;
      v += rand() * 6;
      if (v > bs) { bs = v; best = r; }
    }
    return best;
  };
  GM.aiDraftPick = function (s) {
    let guard = 0;
    while (s.phase === 'draft' && s.draft.turn === s.rival && guard++ < 40) {
      const r = GM.aiDraftChoice(s, s.rival);
      if (!r) break;
      GM.draftPick(s, s.rival, r.id);
    }
  };
  GM.autoDraftPlayer = function (s) {
    let guard = 0;
    while (s.phase === 'draft' && guard++ < 80) {
      if (s.draft.turn === s.player) { const r = GM.aiDraftChoice(s, s.player); if (!r) break; GM.draftPick(s, s.player, r.id); }
      else GM.aiDraftPick(s);
    }
  };

  /* ---------------- titles ---------------- */
  GM.titleName = (brand, key) => `${BW.BRANDS[brand].name} ${BW.TITLES.find((t) => t.key === key).name}`;
  GM.championOf = (s, brand, key) => s.titles[brand][key] || null;
  GM.titlesHeld = function (s, id) {
    const r = s.roster[id]; if (!r || r.brand === 'fa') return [];
    const t = s.titles[r.brand]; const out = [];
    for (const k in t) { const v = t[k]; if (Array.isArray(v) ? v.includes(id) : v === id) out.push(k); }
    return out;
  };
  GM.autoChampions = function (s) {
    for (const brand of ['ignite', 'uprising']) {
      const men = GM.list(s, brand).filter((r) => r.gender === 'm').sort((a, b) => GM.value(b) - GM.value(a));
      const women = GM.list(s, brand).filter((r) => r.gender === 'f').sort((a, b) => GM.value(b) - GM.value(a));
      const t = s.titles[brand];
      t.world = men[0] ? men[0].id : null;
      t.national = men.find((m) => m.id !== t.world && m.style !== 'giant') ? men.find((m) => m.id !== t.world && m.style !== 'giant').id : (men[1] ? men[1].id : null);
      t.women = women[0] ? women[0].id : null;
      const used = new Set([t.world, t.national]);
      const teams = {};
      for (const m of men) if (m.team && !used.has(m.id)) (teams[m.team] = teams[m.team] || []).push(m);
      const full = Object.values(teams).filter((x) => x.length >= 2).sort((a, b) => (GM.value(b[0]) + GM.value(b[1])) - (GM.value(a[0]) + GM.value(a[1])));
      if (full.length) t.tag = [full[0][0].id, full[0][1].id];
      else { const rest = men.filter((m) => !used.has(m.id)); t.tag = rest.length >= 2 ? [rest[0].id, rest[1].id] : null; }
    }
  };
  GM.setChampion = function (s, brand, key, val) { s.titles[brand][key] = val; };
  GM.confirmChampions = function (s) {
    s.phase = 'booking';
    for (const brand of ['ignite', 'uprising']) for (const k in s.titles[brand]) {
      const v = s.titles[brand][k]; if (!v) continue;
      s.titleHistory.push({ week: 0, brand, title: k, champ: v, prev: null });
    }
    const wc = s.roster[s.titles[s.player].world];
    mail(s, 'Creative Team', 'Champions crowned',
      `${wc ? wc.name : 'Nobody'} opens the season as ${GM.titleName(s.player, 'world')}. Book your first show from the Book Show tab. ` +
      'Tip: matches between a face and a heel rate higher, and feuds heat up the more often two wrestlers meet.');
  };

  /* ---------------- booking ---------------- */
  GM.sides = function (seg) {
    if (seg.type === 'tag') return [seg.slots.slice(0, 2), seg.slots.slice(2, 4)];
    return seg.slots.map((id) => [id]);
  };
  GM.size = (type) => BW.MATCH_TYPES[type].size;
  GM.segCount = (s) => (GM.isPPV(s) ? 6 : 5);
  GM.emptyCard = function (s) { const n = GM.segCount(s); const c = []; for (let i = 0; i < n; i++) c.push({ type: 'singles', slots: [null, null], title: null, winner: null }); return c; };
  GM.available = (s, brand) => GM.list(s, brand).filter((r) => r.injury <= 0);

  GM.titleOptions = function (s, brand, seg) {
    const ids = seg.slots.filter(Boolean);
    if (seg.type === 'promo' || ids.length < GM.size(seg.type)) return [];
    const t = s.titles[brand]; const out = [];
    const genders = new Set(ids.map((id) => s.roster[id].gender));
    if (seg.type === 'tag') {
      if (t.tag && genders.has('m') && genders.size === 1) {
        const sides = GM.sides(seg);
        if (sides.some((sd) => t.tag.every((c) => sd.includes(c)))) out.push('tag');
      }
      return out;
    }
    for (const k of ['world', 'national', 'women']) if (t[k] && ids.includes(t[k])) out.push(k);
    return out;
  };

  GM.validate = function (s, brand, card) {
    const errs = []; const used = new Map();
    card.forEach((seg, i) => {
      const need = GM.size(seg.type);
      const ids = seg.slots.slice(0, need);
      if (ids.some((x) => !x)) { errs.push(`Segment ${i + 1}: pick ${need === 1 ? 'a wrestler' : 'all ' + need + ' wrestlers'}.`); return; }
      for (const id of ids) {
        const r = s.roster[id];
        if (!r || r.brand !== brand) errs.push(`Segment ${i + 1}: ${r ? r.name : id} is not on your roster.`);
        else if (r.injury > 0) errs.push(`Segment ${i + 1}: ${r.name} is injured.`);
        if (used.has(id)) errs.push(`${s.roster[id].name} is booked twice (segments ${used.get(id) + 1} and ${i + 1}).`);
        used.set(id, i);
      }
      if (seg.type !== 'promo') {
        const g = new Set(ids.map((id) => s.roster[id] && s.roster[id].gender));
        if (g.size > 1) errs.push(`Segment ${i + 1}: men and women are in separate divisions.`);
      }
      if (seg.title && !GM.titleOptions(s, brand, seg).includes(seg.title)) errs.push(`Segment ${i + 1}: that title can't be defended in this match.`);
    });
    return errs;
  };

  GM.autoBook = function (s, brand) {
    const ppv = GM.isPPV(s);
    const t = s.titles[brand];
    let pool = GM.available(s, brand).slice().sort((a, b) => (GM.value(b) - b.fatigue * 0.25) - (GM.value(a) - a.fatigue * 0.25));
    const used = new Set();
    const take = (filter, n) => {
      const got = [];
      for (const r of pool) { if (got.length >= n) break; if (used.has(r.id) || !filter(r)) continue; got.push(r); }
      if (got.length < n) return null;
      got.forEach((r) => used.add(r.id));
      return got.map((r) => r.id);
    };
    const free = (id) => id && !used.has(id) && s.roster[id] && s.roster[id].injury <= 0 && s.roster[id].brand === brand;
    const rivalFor = (champ, gender) => {
      // prefer an existing feud partner, else the most valuable available contender
      const c = s.roster[champ];
      let best = null, bs = -1e9;
      for (const r of pool) {
        if (used.has(r.id) || r.id === champ || r.gender !== gender) continue;
        let v = GM.value(r) + GM.heat(s, champ, r.id) * 0.3 + (c && r.align !== c.align ? 6 : 0) - r.fatigue * 0.3;
        if (v > bs) { bs = v; best = r; }
      }
      if (best) used.add(best.id);
      return best ? best.id : null;
    };
    const card = [];
    const men = (r) => r.gender === 'm', women = (r) => r.gender === 'f';
    // World title / main event
    let main = null;
    if (free(t.world) && (ppv || rand() < 0.3)) { used.add(t.world); const c = rivalFor(t.world, 'm'); if (c) main = { type: 'singles', slots: [t.world, c], title: 'world' }; else used.delete(t.world); }
    if (!main) {
      const top = take(men, rand() < 0.35 ? 3 : 2);
      if (top) main = { type: top.length === 3 ? 'triple' : 'singles', slots: top, title: null };
    }
    // secondary title
    if (free(t.national) && (ppv || rand() < 0.35)) { used.add(t.national); const c = rivalFor(t.national, 'm'); if (c) card.push({ type: 'singles', slots: [t.national, c], title: 'national' }); else used.delete(t.national); }
    // tag
    const tagChamps = t.tag && t.tag.every(free) ? t.tag : null;
    if (tagChamps && (ppv || rand() < 0.4)) {
      tagChamps.forEach((id) => used.add(id));
      const pair = findTeam(s, pool, used) || take(men, 2);
      if (pair) card.push({ type: 'tag', slots: [...tagChamps, ...pair], title: 'tag' });
    } else {
      const a = findTeam(s, pool, used) || take(men, 2); const b = a && (findTeam(s, pool, used) || take(men, 2));
      if (a && b) card.push({ type: 'tag', slots: [...a, ...b], title: null });
    }
    // women
    if (free(t.women) && (ppv || rand() < 0.4)) { used.add(t.women); const c = rivalFor(t.women, 'f'); if (c) card.push({ type: 'singles', slots: [t.women, c], title: 'women' }); else used.delete(t.women); }
    else { const w = take(women, 2); if (w) card.push({ type: 'singles', slots: w, title: null }); }
    // fill
    const n = GM.segCount(s);
    let promoDone = false;
    while (card.length < n - 1) {
      if (!promoDone && !ppv && rand() < 0.6) {
        const p = pool.filter((r) => !used.has(r.id)).sort((a, b) => b.mic - a.mic)[0];
        if (p) { used.add(p.id); card.push({ type: 'promo', slots: [p.id], title: null }); promoDone = true; continue; }
      }
      const kind = rand() < 0.25 ? 'triple' : rand() < 0.15 ? 'submission' : 'singles';
      const ids = (kind === 'triple' && take(men, 3)) || take(men, 2) || take(women, 2);
      if (!ids) {
        const p = pool.filter((r) => !used.has(r.id)).sort((a, b) => b.mic - a.mic)[0];
        if (!p) break;
        used.add(p.id); card.push({ type: 'promo', slots: [p.id], title: null }); continue;
      }
      card.push({ type: ids.length === 3 ? 'triple' : (kind === 'submission' ? 'submission' : 'singles'), slots: ids, title: null });
    }
    // opener should be a lively mid-card match, main event goes last
    card.sort((a, b) => segWeight(s, b) - segWeight(s, a));
    const opener = card.findIndex((c) => c.type !== 'promo' && !c.title);
    if (opener > 0) { const [o] = card.splice(opener, 1); card.push(o); }
    card.reverse();
    if (main) card.push(main);
    card.forEach((c) => { c.winner = null; });
    while (card.length > n) card.splice(1, 1);
    return card;
  };
  function segWeight(s, c) { return c.slots.reduce((a, id) => a + (id ? GM.value(s.roster[id]) : 0), 0) / c.slots.length + (c.title ? 15 : 0); }
  function findTeam(s, pool, used) {
    const teams = {};
    for (const r of pool) if (r.team && !used.has(r.id) && r.gender === 'm') (teams[r.team] = teams[r.team] || []).push(r);
    const full = Object.values(teams).filter((x) => x.length >= 2);
    if (!full.length) return null;
    const t = pick(full).slice(0, 2);
    t.forEach((r) => used.add(r.id));
    return t.map((r) => r.id);
  }

  /* ---------------- feuds ---------------- */
  const fkey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  GM.heat = (s, a, b) => (s.feuds[fkey(a, b)] ? s.feuds[fkey(a, b)].heat : 0);
  GM.topFeuds = function (s, brand) {
    return Object.entries(s.feuds).map(([k, f]) => ({ ids: k.split('|'), ...f }))
      .filter((f) => f.ids.every((id) => s.roster[id] && s.roster[id].brand === brand) && f.heat >= 20)
      .sort((a, b) => b.heat - a.heat).slice(0, 6);
  };

  /* ---------------- simulation ---------------- */
  GM.simMatch = function (s, brand, seg) {
    const sides = GM.sides(seg);
    const R = (id) => s.roster[id];
    const ppv = GM.isPPV(s);
    if (seg.type === 'promo') return null;
    const scores = sides.map((sd, i) => {
      let v = sd.reduce((a, id) => { const r = R(id); return a + r.ovr * 0.5 + r.pop * 0.35 + r.streak * 0.8 - r.fatigue * 0.08 + (GM.titlesHeld(s, id).length ? 3 : 0); }, 0) / sd.length;
      v += (rand() + rand() + rand()) * 11;
      if (seg.winner != null) v += seg.winner === i ? 1000 : 0;
      return v;
    });
    let wi = 0; scores.forEach((v, i) => { if (v > scores[wi]) wi = i; });
    const all = seg.slots.slice(0, GM.size(seg.type));
    const avgOvr = all.reduce((a, id) => a + R(id).ovr, 0) / all.length;
    const avgFat = all.reduce((a, id) => a + R(id).fatigue, 0) / all.length;
    const lowMorale = all.filter((id) => R(id).morale < 30).length;
    let heat = 0, pairs = 0;
    for (let i = 0; i < sides.length; i++) for (let j = i + 1; j < sides.length; j++) for (const a of sides[i]) for (const b of sides[j]) { heat += GM.heat(s, a, b); pairs++; }
    heat = pairs ? heat / pairs : 0;
    const aligns = sides.map((sd) => R(sd[0]).align);
    let stars = 1.0 + (avgOvr - 60) / 40 * 2.6;
    if (aligns.includes('face') && aligns.includes('heel')) stars += 0.3; else stars -= 0.15;
    stars += heat / 100 * 0.8 + (ppv ? 0.25 : 0) + (seg.title ? 0.2 : 0) + (sides.length > 2 ? 0.2 : 0);
    stars += rand() * 1.1 - 0.5 - avgFat / 100 * 0.8 - lowMorale * 0.2;
    if (seg.winner != null) stars -= 0.1;
    stars = clamp(round(stars, 0.25), 0.5, 5);
    const methods = seg.type === 'submission' ? ['submission'] : ['pinfall', 'pinfall', 'pinfall', 'pinfall', 'submission'];
    const winners = sides[wi];
    const losers = all.filter((id) => !winners.includes(id));
    return { winners, losers, stars, method: pick(methods), played: false };
  };

  GM.rateSegment = function (s, brand, seg, res, index, total) {
    const R = (id) => s.roster[id];
    const ppv = GM.isPPV(s);
    const ids = seg.slots.slice(0, GM.size(seg.type));
    if (seg.type === 'promo') {
      const r = R(ids[0]);
      const champ = GM.titlesHeld(s, r.id).length ? 6 : 0;
      const feud = Object.entries(s.feuds).filter(([k]) => k.split('|').includes(r.id)).reduce((a, [, f]) => Math.max(a, f.heat), 0);
      return clamp(0.55 * r.mic + 0.35 * r.pop + champ + feud * 0.1 + (rand() * 12 - 6), 5, 100);
    }
    const sides = GM.sides(seg);
    const pop = ids.reduce((a, id) => a + R(id).pop, 0) / ids.length;
    let heat = 0, pairs = 0;
    for (let i = 0; i < sides.length; i++) for (let j = i + 1; j < sides.length; j++) for (const a of sides[i]) for (const b of sides[j]) { heat += GM.heat(s, a, b); pairs++; }
    heat = pairs ? heat / pairs : 0;
    const aligns = sides.map((sd) => R(sd[0]).align);
    let v = 0.5 * res.stars * 20 + 0.4 * pop + heat * 0.15;
    v += aligns.includes('face') && aligns.includes('heel') ? 5 : -4;
    if (seg.title) v += BW.TITLES.find((t) => t.key === seg.title).prestige * 0.8 * (ppv ? 1.5 : 1);
    else if (ids.some((id) => GM.titlesHeld(s, id).length)) v += 2;
    const fat = ids.reduce((a, id) => a + R(id).fatigue, 0) / ids.length;
    if (fat > 60) v -= (fat - 60) * 0.15;
    v -= ids.filter((id) => R(id).morale < 30).length * 3;
    if (res.played) v += 2; // the crowd loves a match you fought for
    void index; void total;
    return clamp(v, 5, 100);
  };

  GM.rateShow = function (s, brand, card, results) {
    const ppv = GM.isPPV(s);
    let sum = 0, wsum = 0;
    const segScores = [];
    let promos = 0;
    card.forEach((seg, i) => {
      let sc = GM.rateSegment(s, brand, seg, results[i], i, card.length);
      if (seg.type === 'promo') { promos++; if (promos >= 2) sc -= 8 * (promos - 1); }
      const w = i === card.length - 1 ? (ppv ? 2.2 : 1.8) : i === 0 ? 1.1 : 1;
      segScores.push(Math.round(sc));
      sum += sc * w; wsum += w;
    });
    let score = sum / wsum;
    const notes = [];
    const ids = new Set(card.flatMap((c) => c.slots));
    if (!card.some((c) => c.slots.some((id) => s.roster[id] && s.roster[id].gender === 'f'))) { score -= 2; notes.push("No women's division segment (-2)"); }
    if (ppv && !card.some((c) => c.title)) { score -= 5; notes.push('Pay-per-view without a title match (-5)'); }
    const wc = s.titles[brand].world;
    if (wc && s.roster[wc] && s.roster[wc].injury <= 0 && !ids.has(wc)) { score -= 3; notes.push('World champion left off the show (-3)'); }
    const types = {}; card.forEach((c) => { if (!c.title) types[c.type] = (types[c.type] || 0) + 1; });
    if (Object.values(types).some((n) => n >= 3)) { score -= 3; notes.push('Three or more non-title matches of the same type (-3)'); }
    if (card.length && card[card.length - 1].type === 'promo') { score -= 6; notes.push('Ended the show on a promo (-6)'); }
    const missing = GM.segCount(s) - card.length;
    if (missing > 0) { score -= missing * 4; notes.push(`Short card: ${missing} segment${missing > 1 ? 's' : ''} missing (-${missing * 4})`); }
    if (brand === s.rival) score *= AI_SKILL[s.difficulty] || 1;
    score = clamp(score, 0, 100);
    const rating = clamp(1.2 + score / 100 * 5.2 + (rand() * 0.4 - 0.2), 0.8, 9.9);
    return { score, rating: Math.round(rating * 100) / 100, segScores, notes };
  };

  /* ---------------- the week ---------------- */
  GM.startShow = function (s) {
    s.show = { card: s.card, results: s.card.map(() => null), idx: 0 };
  };
  GM.recordResult = function (s, i, res) { s.show.results[i] = res; };
  GM.simRemaining = function (s) {
    s.show.card.forEach((seg, i) => { if (!s.show.results[i]) s.show.results[i] = seg.type === 'promo' ? { promo: true, stars: 0 } : GM.simMatch(s, s.player, seg); });
  };

  GM.finishWeek = function (s) {
    const P = s.player, Rv = s.rival;
    const ppv = GM.isPPV(s);
    const pCard = s.show.card, pRes = s.show.results;
    const rCard = GM.autoBook(s, Rv);
    const rRes = rCard.map((seg) => (seg.type === 'promo' ? { promo: true, stars: 0 } : GM.simMatch(s, Rv, seg)));
    const pShow = GM.rateShow(s, P, pCard, pRes);
    const rShow = GM.rateShow(s, Rv, rCard, rRes);
    const summary = { week: s.week, ppv, name: { [P]: GM.showName(s, P), [Rv]: GM.showName(s, Rv) }, shows: {}, events: [] };
    for (const [brand, card, res, show] of [[P, pCard, pRes, pShow], [Rv, rCard, rRes, rShow]]) {
      const b = s.brands[brand];
      const other = brand === P ? rShow : pShow;
      const viewers = show.rating * 1.12;
      let revenue = 150 + show.rating * 130;
      let buys = 0;
      if (ppv) { buys = Math.round(b.fans * 0.08 * show.rating / 4); revenue += buys * 15; }
      const payroll = GM.payroll(s, brand);
      const fansDelta = Math.round((show.rating - other.rating) * 12 + (show.rating - 4.0) * 8 + (ppv ? (show.rating - 4.5) * 10 : 0));
      b.cash = Math.round(b.cash + revenue - payroll);
      if (b.cash < 0) b.wentBroke = true;
      b.fans = Math.max(100, b.fans + fansDelta);
      b.ratings.push(show.rating);
      const won = show.rating > other.rating;
      if (won) b.warWins++;
      const bestStars = Math.max(0, ...res.map((r) => (r && r.stars) || 0));
      b.bestStars = Math.max(b.bestStars, bestStars);
      summary.shows[brand] = {
        rating: show.rating, score: Math.round(show.score), viewers: Math.round(viewers * 100) / 100, revenue: Math.round(revenue), payroll, fansDelta, buys, won, notes: show.notes,
        segments: card.map((seg, i) => ({ seg: JSON.parse(JSON.stringify(seg)), res: res[i], score: show.segScores[i] })),
      };
      applyResults(s, brand, card, res, summary);
    }
    // wrestlers who sat out
    for (const r of Object.values(s.roster)) {
      if (r.brand === 'fa') continue;
      if (r.lastBooked !== s.week) {
        r.fatigue = clamp(r.fatigue - 22, 0, 100);
        if (r.injury <= 0) { r.morale = clamp(r.morale - 8, 0, 100); if (s.week - r.lastBooked > 2) r.pop = clamp(r.pop - 1, 20, 100); }
      } else r.fatigue = clamp(r.fatigue - 6, 0, 100);
      if (r.injury > 0) { r.injury--; if (r.injury === 0 && r.brand === P) mail(s, 'Medical Staff', `${r.name} is cleared to compete`, `${r.name} has been medically cleared and is available for next week's show.`); }
      if (GM.titlesHeld(s, r.id).length) r.pop = clamp(r.pop + 0.5, 20, 100);
      if (r.brand === P && r.morale < 30 && r.injury <= 0 && (!r.complainedWeek || s.week - r.complainedWeek >= 4)) {
        r.complainedWeek = s.week;
        mail(s, r.name, 'I want TV time', `I haven't been used properly. If I don't get on the card soon my performances are going to suffer. Book me. (Morale: ${Math.round(r.morale)})`);
      }
    }
    // feud decay
    for (const k of Object.keys(s.feuds)) {
      const f = s.feuds[k];
      if (f.lastWeek !== s.week) f.heat -= 4;
      if (f.heat <= 0) delete s.feuds[k];
    }
    // rival GM business
    rivalBusiness(s);
    // inbox
    const ps = summary.shows[P], rs = summary.shows[Rv];
    const pn = BW.BRANDS[P].name, rn = BW.BRANDS[Rv].name;
    mail(s, 'Ratings Department', `Week ${s.week}: ${ps.won ? 'You won the ratings war' : `${rn} won the ratings war`}`,
      `${summary.name[P]} drew a ${ps.rating.toFixed(2)} (${ps.viewers.toFixed(2)}M viewers) against ${summary.name[Rv]}'s ${rs.rating.toFixed(2)}. ` +
      `Fans ${ps.fansDelta >= 0 ? '+' : ''}${ps.fansDelta}k. Revenue $${ps.revenue}k, payroll $${ps.payroll}k.` + (ps.buys ? ` Pay-per-view buys: ${ps.buys}k.` : ''));
    if (!ps.won && rand() < 0.5) mail(s, `${rn} GM`, pick(['Read it and weep', 'Another week, another win', 'Check the numbers']), pick([
      `${rs.rating.toFixed(2)}. That's what a real show looks like. Maybe try booking your main event like you mean it.`,
      `The fans have spoken again. ${rn} is the place to be.`,
      `I'd say better luck next week, but we both know how that goes.`]));
    if (ps.won && rand() < 0.35) mail(s, `${rn} GM`, 'Enjoy it while it lasts', `One good week doesn't win a war. ${rn} will be back on top next week.`);
    if (s.brands[P].cash < 0 && !s.warnedBroke) { s.warnedBroke = true; mail(s, 'Board of Directors', 'You are in the red', 'Your bank balance is below zero. Cut payroll or draw bigger ratings. A pay-per-view is the fastest way to recover.'); }
    summary.events.forEach((e) => { if (e.brand === P && e.mail) mail(s, e.from, e.subject, e.body); });
    s.history.push({ week: s.week, ppv, [P]: ps.rating, [Rv]: rs.rating });
    s.lastSummary = summary;
    s.show = null; s.card = null;
    if (s.week >= s.weeks) { s.phase = 'seasonEnd'; s.final = GM.seasonReport(s); }
    else { s.week++; s.phase = 'booking'; }
    void pn;
    return summary;
  };

  function applyResults(s, brand, card, res, summary) {
    const ppv = GM.isPPV(s);
    card.forEach((seg, i) => {
      const r = res[i]; const ids = seg.slots.slice(0, GM.size(seg.type));
      const main = i === card.length - 1;
      for (const id of ids) {
        const w = s.roster[id];
        w.lastBooked = s.week;
        w.morale = clamp(w.morale + 6 + (main ? 4 : 0), 0, 100);
        w.fatigue = clamp(w.fatigue + (seg.type === 'promo' ? 3 : 16 + (main ? 6 : 0) + (ids.length > 2 ? 4 : 0)), 0, 100);
      }
      if (seg.type === 'promo') {
        const w = s.roster[ids[0]];
        const gain = (summary.shows[brand].segments[i].score - 50) / 15;
        w.pop = clamp(w.pop + clamp(gain, -1, 3), 20, 100);
        return;
      }
      for (const id of r.winners) { const w = s.roster[id]; w.wins++; w.streak = Math.max(0, w.streak) + 1; w.pop = clamp(w.pop + 2 + (r.stars >= 4 ? 1 : 0), 20, 100); w.morale = clamp(w.morale + 4, 0, 100); }
      for (const id of r.losers) { const w = s.roster[id]; w.losses++; w.streak = Math.min(0, w.streak) - 1; w.pop = clamp(w.pop + (r.stars >= 4 ? 1 : -1), 20, 100); w.morale = clamp(w.morale - 2, 0, 100); }
      // feuds
      const sides = GM.sides(seg);
      for (let a = 0; a < sides.length; a++) for (let b = a + 1; b < sides.length; b++) for (const x of sides[a]) for (const y of sides[b]) {
        const k = fkey(x, y);
        const f = s.feuds[k] || (s.feuds[k] = { heat: 0, meetings: 0, lastWeek: 0, streak: 0 });
        f.streak = f.lastWeek === s.week - 1 ? f.streak + 1 : 1;
        f.heat += 14 + (ppv ? 8 : 0) + (seg.title ? 6 : 0);
        if (f.streak >= 4) f.heat -= 22;
        f.heat = clamp(f.heat, 0, 100);
        f.meetings++; f.lastWeek = s.week;
        if (f.heat >= 60 && !f.announced && brand === s.player) {
          f.announced = true;
          summary.events.push({ brand, mail: true, from: 'Creative Team', subject: 'A rivalry is catching fire', body: `${s.roster[x].name} vs ${s.roster[y].name} is getting a big reaction. Keep booking it and the crowd will stay hot, but run it every single week and they'll tire of it.` });
        }
      }
      // injuries
      for (const id of ids) {
        const w = s.roster[id];
        const chance = 0.02 + Math.max(0, w.fatigue - 55) / 100 * 0.4;
        if (rand() < chance) {
          w.injury = 1 + ((rand() * 4) | 0);
          summary.events.push({ brand, mail: true, from: 'Medical Staff', subject: `${w.name} injured`, body: `${w.name} picked up an injury and will be out for ${w.injury} week${w.injury > 1 ? 's' : ''}. Tired wrestlers get hurt more often; rest your busiest stars.` });
        }
      }
      // titles
      if (seg.title) {
        const t = s.titles[brand];
        const cur = t[seg.title];
        const holders = Array.isArray(cur) ? cur : [cur];
        const retained = holders.every((h) => r.winners.includes(h));
        if (!retained) {
          const nu = seg.title === 'tag' ? r.winners.slice(0, 2) : r.winners[0];
          t[seg.title] = nu;
          s.titleHistory.push({ week: s.week, brand, title: seg.title, champ: nu, prev: cur });
          (Array.isArray(nu) ? nu : [nu]).forEach((id) => { s.roster[id].pop = clamp(s.roster[id].pop + 4, 20, 100); });
          const names = (Array.isArray(nu) ? nu : [nu]).map((id) => s.roster[id].name).join(' & ');
          summary.events.push({ brand, mail: true, from: 'Creative Team', subject: `NEW ${GM.titleName(brand, seg.title).toUpperCase()} CHAMPION`, body: `${names} won the ${GM.titleName(brand, seg.title)}.` });
          summary.events.push({ brand, titleChange: true, title: seg.title, champ: nu });
          if (brand === s.rival) mail(s, 'Ratings Department', `Title change on ${BW.BRANDS[brand].name}`, `${names} won the ${GM.titleName(brand, seg.title)} over on ${BW.BRANDS[brand].name}.`);
        }
      }
    });
  }

  function rivalBusiness(s) {
    const Rv = s.rival;
    const mine = GM.list(s, Rv);
    if (mine.length < ROSTER_SIZE && s.brands[Rv].cash > 1200) {
      const fa = GM.list(s, 'fa').sort((a, b) => GM.value(b) - GM.value(a))[0];
      if (fa) { GM.sign(s, Rv, fa.id); mail(s, 'Ratings Department', `${BW.BRANDS[Rv].name} signs ${fa.name}`, `${fa.name} has signed with ${BW.BRANDS[Rv].name}.`); }
    } else if (rand() < 0.05 && s.brands[Rv].cash > 2500) {
      const fa = GM.list(s, 'fa').filter((r) => GM.value(r) > 72).sort((a, b) => GM.value(b) - GM.value(a))[0];
      if (fa) { GM.sign(s, Rv, fa.id); mail(s, 'Ratings Department', `${BW.BRANDS[Rv].name} signs ${fa.name}`, `${fa.name} has signed with ${BW.BRANDS[Rv].name}. They now carry ${GM.list(s, Rv).length} wrestlers.`); }
    }
  }

  /* ---------------- roster management ---------------- */
  GM.signingBonus = (r) => r.salary * 4;
  GM.sign = function (s, brand, id) {
    const r = s.roster[id]; if (!r || r.brand !== 'fa') return 'Not a free agent';
    if (GM.list(s, brand).length >= ROSTER_SIZE + 2) return 'Roster is full (16 max)';
    const bonus = GM.signingBonus(r);
    if (s.brands[brand].cash < bonus) return `Signing bonus is $${bonus}k`;
    s.brands[brand].cash -= bonus; r.brand = brand; r.morale = 80; r.lastBooked = s.week;
    return null;
  };
  GM.release = function (s, brand, id) {
    const r = s.roster[id]; if (!r || r.brand !== brand) return 'Not on your roster';
    if (GM.titlesHeld(s, id).length) return 'Champions cannot be released';
    if (GM.list(s, brand).length <= 10) return 'You need at least 10 wrestlers';
    r.brand = 'fa';
    return null;
  };
  GM.tradeValue = (s, r) => GM.value(r) - r.salary * 0.08 + (GM.titlesHeld(s, r.id).length ? 100 : 0);
  GM.proposeTrade = function (s, giveId, getId) {
    const give = s.roster[giveId], get = s.roster[getId];
    if (!give || !get || give.brand !== s.player || get.brand !== s.rival) return { ok: false, msg: 'Pick one wrestler from each roster.' };
    if (GM.titlesHeld(s, giveId).length || GM.titlesHeld(s, getId).length) return { ok: false, msg: 'Champions are not available for trade.' };
    if (give.gender !== get.gender) {
      const w = (b) => GM.list(s, b).filter((r) => r.gender === 'f').length;
      if ((get.gender === 'f' && w(s.rival) <= MIN_WOMEN) || (give.gender === 'f' && w(s.player) <= MIN_WOMEN)) return { ok: false, msg: `Both brands need at least ${MIN_WOMEN} women.` };
    }
    const vGive = GM.tradeValue(s, give), vGet = GM.tradeValue(s, get);
    if (vGive >= vGet * 1.04) {
      give.brand = s.rival; get.brand = s.player; give.lastBooked = s.week; get.lastBooked = s.week;
      mail(s, `${BW.BRANDS[s.rival].name} GM`, 'Trade accepted', `Fine. ${get.name} is yours, ${give.name} is mine. Pleasure doing business.`);
      return { ok: true, msg: `Trade accepted: ${get.name} joins ${BW.BRANDS[s.player].name}.` };
    }
    return { ok: false, msg: `${BW.BRANDS[s.rival].name} turned it down. They value ${get.name} more than ${give.name}.` };
  };
  GM.canTurn = (s, r) => s.week - r.turnedWeek >= 4;
  GM.turn = function (s, id) {
    const r = s.roster[id]; if (!r || !GM.canTurn(s, r)) return false;
    r.align = r.align === 'face' ? 'heel' : 'face';
    r.turnedWeek = s.week; r.pop = clamp(r.pop - 3, 20, 100);
    for (const k of Object.keys(s.feuds)) if (k.split('|').includes(id)) s.feuds[k].heat = clamp(s.feuds[k].heat + 15, 0, 100);
    mail(s, 'Creative Team', `${r.name} turns ${r.align}`, `${r.name} is now a ${r.align}. Expect a small dip in popularity while fans adjust, and a jolt of heat in any rivalry they're part of.`);
    return true;
  };

  /* ---------------- season report ---------------- */
  GM.seasonReport = function (s) {
    const P = s.player, Rv = s.rival;
    const b = s.brands[P], r = s.brands[Rv];
    const weeks = b.ratings.length || 1;
    const results = {
      war: b.warWins / weeks >= 0.55,
      fans: b.fans > r.fans,
      cash: !b.wentBroke,
      stars: b.bestStars >= 4.5,
    };
    const met = Object.values(results).filter(Boolean).length;
    const grade = ['F', 'D', 'C', 'B', 'A'][met];
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    return {
      results, grade, met,
      gmOfYear: b.fans > r.fans,
      avg: { [P]: Math.round(avg(b.ratings) * 100) / 100, [Rv]: Math.round(avg(r.ratings) * 100) / 100 },
      warWins: b.warWins, weeks,
    };
  };
  GM.newSeason = function (s) {
    s.week = 1; s.phase = 'booking'; s.history = []; s.final = null; s.warnedBroke = false;
    for (const k of ['ignite', 'uprising']) Object.assign(s.brands[k], { ratings: [], warWins: 0, bestStars: 0, wentBroke: false });
    for (const r of Object.values(s.roster)) { r.wins = 0; r.losses = 0; r.streak = 0; r.lastBooked = 0; r.turnedWeek = -99; }
    mail(s, 'Board of Directors', 'A new season begins', 'Rosters and champions carry over. The ratings war resets to zero. Same goals as last year.');
  };

  /* ---------------- persistence ---------------- */
  GM.save = function (s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } };
  GM.load = function () { try { const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  GM.clear = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } };
})();
