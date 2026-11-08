/* Brand Wars — screens and menus. */
(function () {
  const BW = (window.BW = window.BW || {});
  const UI = (BW.UI = {});
  const GM = BW.GM;
  const app = () => document.getElementById('app');

  /* ---------------- helpers ---------------- */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  UI.esc = esc;
  UI.starsHTML = (v) => {
    let out = '';
    for (let i = 1; i <= 5; i++) out += v >= i ? '★' : v >= i - 0.5 ? '⯪' : '<span class="off">★</span>';
    return `${out} <span class="num" style="font-size:16px;color:var(--fg)">${v.toFixed(2).replace(/0$/, '')}</span>`;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }
  UI.toast = toast;
  let cleanup = null;
  function mount(html, brand) {
    if (cleanup) { cleanup(); cleanup = null; }
    BW.Play.stop();
    document.body.className = brand ? `brand-${brand}` : '';
    app().innerHTML = html;
    window.scrollTo(0, 0);
    return app();
  }
  function paintFigs(root, lookup) {
    root.querySelectorAll('canvas[data-fig]').forEach((c) => {
      const spec = lookup(c.dataset.fig); if (!spec) return;
      const g = c.getContext('2d');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = +c.getAttribute('width'), h = +c.getAttribute('height');
      c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const scale = h / 2.25;
      BW.drawFigure(g, spec, { pose: BW.POSES[c.dataset.pose || 'idle'], facing: 1, ang: 0, sx: w * 0.46, sy: h - 3, scale });
    });
  }
  UI.paintFigs = paintFigs;
  const fig = (id, w, h, pose) => `<canvas data-fig="${esc(id)}" width="${w || 34}" height="${h || 44}" ${pose ? `data-pose="${pose}"` : ''} aria-hidden="true"></canvas>`;
  const pct = (v) => Math.round(Math.max(0, Math.min(100, v)));
  const money = (k) => (Math.abs(k) >= 1000 ? `${k < 0 ? '-' : ''}$${(Math.abs(k) / 1000).toFixed(2)}M` : `${k < 0 ? '-' : ''}$${Math.abs(Math.round(k))}k`);
  const fans = (k) => `${(k / 1000).toFixed(2)}M`;

  /* ---------------- roster store ---------------- */
  BW.Roster = {
    get() {
      const custom = store.get('bw.roster.v1', null);
      return JSON.parse(JSON.stringify(Array.isArray(custom) && custom.length >= 8 ? custom : BW.DEFAULT_ROSTER));
    },
    save(list) { store.set('bw.roster.v1', list); },
    reset() { store.del('bw.roster.v1'); },
    isCustom() { return !!store.get('bw.roster.v1', null); },
  };

  /* ---------------- controls guide ---------------- */
  UI.controlsHTML = function (compact) {
    const k = (s) => s.split('+').map((x) => `<kbd>${x}</kbd>`).join(' + ');
    const rows = [
      ['Move', k('W A S D') + ' or ' + k('Arrows')],
      ['Run', 'Hold ' + k('Shift')],
      ['Strike / Kick', k('J') + ' / ' + k('I') + ' (hit ' + k('J') + ' three times for a combo)'],
      ['Grapple', k('K') + ', then ' + k('J') + ' quick move, ' + k('K') + ' strong move, ' + k('E') + ' Irish whip, ' + k('P') + ' submission. Hold a direction for a different move.'],
      ['Reverse', k('L') + ' when the blue prompt appears over your head. Pressing early locks you out briefly.'],
      ['Signature / Finisher', k('U') + '. Signature at half momentum, finisher once the bar fills.'],
      ['Pin / Submission', k('P') + ' / ' + k('K') + ' next to a downed opponent'],
      ['Pick up / Climb', k('E') + ' near a downed opponent, or in a corner to go up top'],
      ['Taunt / Tag', k('T') + ' (tag in your partner from your corner)'],
      ['Pause', k('Esc')],
    ];
    return `<div class="keys">${rows.map(([a, b]) => `<span class="label">${a}</span><span>${b}</span>`).join('')}</div>
      ${compact ? '' : `<p class="muted">Mash any button to get up faster or escape a hold. To kick out of a pin, press any button while the white marker is in the green zone.</p>
      <h3>Player 2</h3><p><kbd>Arrows</kbd> to move, numpad <kbd>1</kbd> strike, <kbd>4</kbd> kick, <kbd>2</kbd> grapple, <kbd>3</kbd> reverse, <kbd>5</kbd> special, <kbd>6</kbd> pin, <kbd>7</kbd> climb/lift, <kbd>8</kbd> taunt, <kbd>0</kbd> run.</p>
      <h3>Gamepad</h3><p><kbd>X</kbd> strike, <kbd>Y</kbd> kick, <kbd>A</kbd> grapple, <kbd>RB</kbd>/<kbd>RT</kbd> reverse, <kbd>LB</kbd> special, <kbd>B</kbd> pin, <kbd>LT</kbd> run, <kbd>L3</kbd> climb/lift, <kbd>Back</kbd> taunt, <kbd>Start</kbd> pause.</p>
      <h3>Touch</h3><p>Drag the left stick to move (push it all the way to run). Buttons on the right do the rest.</p>`}`;
  };

  /* ================= TITLE ================= */
  UI.menu = function () {
    const save = GM.load();
    const root = mount(`
      <div class="title-screen">
        <canvas class="attract" width="960" height="540" aria-hidden="true"></canvas>
        <div class="veil"></div>
        <div class="title-inner">
          <div class="label">Wrestling · General Manager</div>
          <h1 class="wordmark">Brand<span class="w2">Wars</span></h1>
          <div class="versus"><span class="c-ignite">Ignite</span><span class="vs">vs</span><span class="c-uprising">Uprising</span></div>
          <nav class="menu" aria-label="Main menu">
            ${save ? `<button class="btn primary" data-go="continue" type="button"><span>Continue GM</span> <small>${esc(BW.BRANDS[save.player].name)} · ${save.phase === 'draft' ? 'Draft' : `Week ${save.week}`}</small></button>` : ''}
            <button class="btn ${save ? '' : 'primary'}" data-go="exhibition" type="button"><span>Exhibition</span> <small>Any match, 1 or 2 players</small></button>
            <button class="btn" data-go="gm" type="button"><span>${save ? 'New GM season' : 'General Manager'}</span> <small>Draft, book, win the ratings war</small></button>
            <button class="btn" data-go="editor" type="button"><span>Superstars</span> <small>Edit the roster</small></button>
            <button class="btn" data-go="howto" type="button"><span>How to play</span> <small>Controls and tips</small></button>
            <button class="btn ghost" data-go="sound" type="button">${BW.Audio.muted ? 'Sound: off' : 'Sound: on'}</button>
          </nav>
          <p class="foot-note">Every wrestler, brand and title is an original creation. Rename anyone you like in Superstars.</p>
        </div>
      </div>`);
    const canvas = root.querySelector('canvas.attract');
    const size = () => { const r = canvas.getBoundingClientRect(); const w = Math.round(Math.max(r.width, r.height * 16 / 9) * Math.min(2, window.devicePixelRatio || 1)); canvas.width = w; canvas.height = Math.round(w * 9 / 16); };
    size();
    const stop = BW.Play.attract(canvas);
    window.addEventListener('resize', size);
    cleanup = () => { stop(); window.removeEventListener('resize', size); };
    root.querySelector('.menu').addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      BW.Audio.unlock();
      const go = b.dataset.go;
      if (go === 'sound') { const m = BW.Audio.toggleMute(); b.textContent = m ? 'Sound: off' : 'Sound: on'; return; }
      if (go === 'continue') return UI.gm(GM.load());
      if (go === 'gm') return UI.gmNew();
      UI[go]();
    });
    const first = root.querySelector('.menu .btn'); if (first) first.focus({ preventScroll: true });
  };

  UI.howto = function () {
    mount(`<div class="page">
      <div class="topbar"><button class="btn small" data-back type="button">← Menu</button></div>
      <h2 class="display">How to play</h2>
      <div class="grid2">
        <section class="panel" style="display:grid;gap:14px"><h3>Controls</h3>${UI.controlsHTML(false)}</section>
        <section class="panel" style="display:grid;gap:12px">
          <h3>In the ring</h3>
          <p>Wear your opponent down before you go for the pin. The body figure on each name card shows damage to the head, arms, body and legs; green is fresh, red is nearly finished.</p>
          <p>Landing moves fills your momentum bar. At half, <kbd>U</kbd> performs your signature. Fill it completely and you store a finisher. Finishers are hard to kick out of.</p>
          <p>Every attack can be reversed. Watch for the blue prompt and press <kbd>L</kbd>. The CPU reverses more often on higher difficulties and less when it is hurt.</p>
          <p>A wrestler near the ropes can grab them to break a pin or a hold, except in a Submission match where only a tap-out wins.</p>
          <h3>General Manager</h3>
          <p>Draft 14 wrestlers under a $1M weekly salary cap, crown your champions, and book a show every week. TV ratings decide the weekly ratings war against the other brand.</p>
          <p>Ratings climb when popular stars meet in good matches, faces face heels, rivalries run hot, and titles are on the line. They drop when stars are exhausted, unhappy, or left off the show.</p>
          <p>Every fourth week is a pay-per-view: six segments, bigger money, and higher stakes. Play any match yourself or simulate it.</p>
        </section>
      </div>
    </div>`);
    app().querySelector('[data-back]').addEventListener('click', UI.menu);
  };

  /* ================= EXHIBITION ================= */
  UI.exhibition = function () {
    const roster = BW.Roster.get();
    const byId = (id) => roster.find((r) => r.id === id);
    const st = store.get('bw.exh', null) || { type: 'singles', brand: 'ignite', difficulty: 'normal', slots: [] };
    const fix = () => {
      const n = BW.MATCH_TYPES[st.type].size;
      const pool = roster.slice().sort(() => Math.random() - 0.5);
      st.slots = (st.slots || []).filter((s) => byId(s.id)).slice(0, n);
      while (st.slots.length < n) {
        const used = new Set(st.slots.map((s) => s.id));
        const gender = st.slots[0] ? byId(st.slots[0].id).gender : 'm';
        const r = pool.find((x) => !used.has(x.id) && x.gender === gender) || pool.find((x) => !used.has(x.id));
        st.slots.push({ id: r.id, control: st.slots.length === 0 ? 'p1' : 'cpu' });
      }
    };
    fix();
    const render = () => {
      const tag = st.type === 'tag';
      const root = mount(`<div class="page">
        <div class="topbar"><button class="btn small" data-back type="button">← Menu</button><span class="spacer"></span></div>
        <h2 class="display">Exhibition</h2>
        <section class="panel" style="display:grid;gap:16px">
          <div class="field"><span class="label">Match type</span><div class="seg-ctl" data-set="type">${Object.entries(BW.MATCH_TYPES).filter(([k]) => k !== 'promo').map(([k, v]) => `<button type="button" data-v="${k}" class="${st.type === k ? 'on' : ''}">${v.label}</button>`).join('')}</div></div>
          <div class="row" style="gap:24px">
            <div class="field"><span class="label">Arena</span><div class="seg-ctl" data-set="brand">${['ignite', 'uprising', 'exhibition'].map((b) => `<button type="button" data-v="${b}" class="${st.brand === b ? 'on' : ''}">${BW.BRANDS[b].name}</button>`).join('')}</div></div>
            <div class="field"><span class="label">CPU difficulty</span><div class="seg-ctl" data-set="difficulty">${['easy', 'normal', 'hard', 'legend'].map((d) => `<button type="button" data-v="${d}" class="${st.difficulty === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>
          </div>
        </section>
        <section class="panel" style="display:grid;gap:4px">
          ${st.slots.map((s, i) => `
            ${tag && i === 2 ? '<div class="label" style="padding:8px 0">vs</div>' : ''}
            <div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
              ${fig(s.id, 34, 44)}
              <span class="label" style="width:64px">${tag ? (i < 2 ? 'Team A' : 'Team B') : `Corner ${i + 1}`}</span>
              <select class="grow" data-slot="${i}" aria-label="Wrestler ${i + 1}">${['m', 'f'].map((gd) => `<optgroup label="${gd === 'm' ? 'Men' : 'Women'}">${roster.filter((r) => r.gender === gd).map((r) => `<option value="${esc(r.id)}" ${r.id === s.id ? 'selected' : ''}>${esc(r.name)} · ${BW.STYLE_LABELS[r.style]} · ${r.ovr}</option>`).join('')}</optgroup>`).join('')}</select>
              <div class="seg-ctl" data-ctl="${i}">${['p1', 'p2', 'cpu'].map((c) => `<button type="button" data-v="${c}" class="${s.control === c ? 'on' : ''}">${c.toUpperCase()}</button>`).join('')}</div>
            </div>`).join('')}
          <div class="row" style="padding-top:12px"><button class="btn" data-random type="button">Shuffle wrestlers</button><span class="grow"></span><button class="btn primary" data-start type="button">Ring the bell</button></div>
          <p class="muted" style="font-size:13px">Set everyone to CPU to watch. Player 2 uses the arrow keys and numpad, or a second gamepad.</p>
          <p class="errors" data-err></p>
        </section>
      </div>`, st.brand === 'exhibition' ? null : st.brand);
      paintFigs(root, byId);
      root.querySelector('[data-back]').addEventListener('click', UI.menu);
      root.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        st[el.dataset.set] = b.dataset.v; if (el.dataset.set === 'type') fix(); store.set('bw.exh', st); render();
      }));
      root.querySelectorAll('[data-slot]').forEach((el) => el.addEventListener('change', () => { st.slots[+el.dataset.slot].id = el.value; store.set('bw.exh', st); render(); }));
      root.querySelectorAll('[data-ctl]').forEach((el) => el.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const i = +el.dataset.ctl, v = b.dataset.v;
        if (v !== 'cpu') st.slots.forEach((s, j) => { if (j !== i && s.control === v) s.control = 'cpu'; });
        st.slots[i].control = v; store.set('bw.exh', st); render();
      }));
      root.querySelector('[data-random]').addEventListener('click', () => { const keep = st.slots.map((s) => s.control); st.slots = []; fix(); st.slots.forEach((s, i) => { s.control = keep[i] || 'cpu'; }); store.set('bw.exh', st); render(); });
      root.querySelector('[data-start]').addEventListener('click', () => {
        const ids = st.slots.map((s) => s.id);
        const err = root.querySelector('[data-err]');
        if (new Set(ids).size !== ids.length) { err.textContent = 'Each wrestler can only be in the match once.'; return; }
        const launch = () => BW.Play.start({
          type: st.type, brand: st.brand, difficulty: st.difficulty,
          participants: st.slots.map((s, i) => ({ spec: byId(s.id), team: tag ? (i < 2 ? 0 : 1) : i, control: s.control })),
          onQuit: render,
          actions: [{ label: 'Rematch', primary: true, fn: launch }, { label: 'Change match', fn: render }, { label: 'Main menu', fn: UI.menu }],
        });
        BW.Audio.unlock();
        launch();
      });
    };
    render();
  };

  /* ================= SUPERSTAR EDITOR ================= */
  UI.editor = function (selId) {
    let roster = BW.Roster.get();
    let sel = roster.find((r) => r.id === selId) || roster[0];
    let draft = JSON.parse(JSON.stringify(sel));
    const anims = BW.FINISHER_ANIMS;
    const animLabel = (a) => ({ driver: 'Piledriver / sit-out', powerbomb: 'Powerbomb', chokeslam: 'Chokeslam', ddt: 'DDT', cutter: 'Cutter', slam: 'Slam', suplex: 'Suplex', german: 'German suplex', press: 'Press slam', neckbreaker: 'Neckbreaker', backbreaker: 'Backbreaker', superkick: 'Superkick', roundhouse: 'Roundhouse kick', knee: 'Running knee', spear: 'Spear', lariat: 'Lariat', splash: 'Top-rope splash', elbow: 'Top-rope elbow', moonsault: 'Moonsault', legdrop: 'Leg drop', headbutt: 'Diving headbutt', sub_leg: 'Leg submission', sub_neck: 'Neck submission', sub_arm: 'Arm submission', sub_back: 'Back submission' })[a] || a;
    const render = () => {
      const d = draft;
      const sw = (key, list) => `<div class="swatches">${list.map((c) => `<button type="button" aria-label="${c}" data-sw="${key}" data-v="${c}" class="${d[key] === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>`;
      const sel2 = (key, list, label) => `<label class="field"><span class="label">${label}</span><select data-k="${key}">${list.map((v) => `<option value="${esc(v[0])}" ${String(d[key]) === String(v[0]) ? 'selected' : ''}>${esc(v[1])}</option>`).join('')}</select></label>`;
      const num = (key, label, min, max) => `<label class="field"><span class="label">${label} <span class="num" data-show="${key}">${d[key]}</span></span><input type="range" min="${min}" max="${max}" step="1" data-k="${key}" data-num value="${d[key]}"></label>`;
      const root = mount(`<div class="page">
        <div class="topbar"><button class="btn small" data-back type="button">← Menu</button><span class="spacer"></span>
          <button class="btn small" data-new type="button">New wrestler</button>
          <button class="btn small danger" data-reset type="button">Restore default roster</button></div>
        <h2 class="display">Superstars</h2>
        <p class="muted">Changes apply to Exhibition and to new GM games. A GM season in progress keeps the roster it started with.</p>
        <div class="editor">
          <nav class="panel roster-list" aria-label="Roster">${roster.map((r) => `<button type="button" data-pick="${esc(r.id)}" class="${r.id === sel.id ? 'on' : ''}"><span>${esc(r.name)}</span><span class="muted num">${r.ovr}</span></button>`).join('')}</nav>
          <section class="panel" style="display:grid;gap:16px">
            <div class="row" style="align-items:stretch">
              <div class="preview" style="width:150px;height:190px"><canvas data-prev width="150" height="190" aria-label="Preview"></canvas></div>
              <div class="grow" style="display:grid;gap:12px;min-width:220px">
                <label class="field"><span class="label">Name</span><input type="text" data-k="name" value="${esc(d.name)}" maxlength="28"></label>
                <label class="field"><span class="label">Nickname</span><input type="text" data-k="nick" value="${esc(d.nick || '')}" maxlength="32"></label>
                <label class="field"><span class="label">Tag team name (partners share it)</span><input type="text" data-k="team" value="${esc(d.team || '')}" maxlength="28"></label>
              </div>
            </div>
            <div class="form-grid">
              ${sel2('gender', [['m', 'Men'], ['f', 'Women']], 'Division')}
              ${sel2('style', Object.entries(BW.STYLE_LABELS), 'Style')}
              ${sel2('align', [['face', 'Face'], ['heel', 'Heel']], 'Alignment')}
              ${num('ovr', 'Overall', 40, 99)}${num('pop', 'Popularity', 20, 100)}${num('mic', 'Mic skills', 10, 100)}${num('salary', 'Salary ($k/week)', 10, 200)}
              <label class="field"><span class="label">Height <span class="num" data-show="height">${d.height}</span></span><input type="range" min="0.86" max="1.2" step="0.01" data-k="height" data-num value="${d.height || 1}"></label>
              <label class="field"><span class="label">Build <span class="num" data-show="build">${d.build}</span></span><input type="range" min="0.75" max="1.42" step="0.01" data-k="build" data-num value="${d.build || 1}"></label>
            </div>
            <div class="form-grid">
              <div class="field"><span class="label">Skin</span>${sw('skin', BW.SKIN_TONES)}</div>
              ${sel2('hair', BW.HAIR_STYLES.map((h) => [h, h]), 'Hair / mask')}
              <label class="field"><span class="label">Hair color</span><input type="color" data-k="hairColor" value="${d.hairColor || '#222222'}"></label>
              <label class="field"><span class="label">Mask color</span><input type="color" data-k="maskColor" value="${d.maskColor || '#111111'}"></label>
              <label class="field"><span class="label">Beard</span><select data-k="beard"><option value="">None</option><option value="${esc(d.hairColor || '#222222')}" ${d.beard ? 'selected' : ''}>Match hair</option></select></label>
              ${sel2('legs', BW.LEG_STYLES.map((h) => [h, h]), 'Lower attire')}
              ${sel2('top', BW.TOP_STYLES.map((h) => [h, h]), 'Top')}
              <div class="field"><span class="label">Attire colors</span><div class="row">${[0, 1, 2].map((i) => `<input type="color" data-color="${i}" value="${d.colors[i]}" aria-label="Attire color ${i + 1}">`).join('')}</div></div>
            </div>
            <div class="form-grid">
              <label class="field"><span class="label">Finisher name</span><input type="text" data-move="finisher" value="${esc(d.finisher.name)}" maxlength="28"></label>
              <label class="field"><span class="label">Finisher type</span><select data-anim="finisher">${anims.map((a) => `<option value="${a}" ${d.finisher.anim === a ? 'selected' : ''}>${animLabel(a)}</option>`).join('')}</select></label>
              <label class="field"><span class="label">Signature name</span><input type="text" data-move="signature" value="${esc(d.signature.name)}" maxlength="28"></label>
              <label class="field"><span class="label">Signature type</span><select data-anim="signature">${anims.map((a) => `<option value="${a}" ${d.signature.anim === a ? 'selected' : ''}>${animLabel(a)}</option>`).join('')}</select></label>
            </div>
            <div class="row"><button class="btn primary" data-save type="button">Save superstar</button><button class="btn" data-try type="button">Test in a match</button><span class="grow"></span><button class="btn danger" data-del type="button">Remove from roster</button></div>
            <div class="row" data-confirm hidden><span class="errors">Remove ${esc(d.name)} for good?</span><button class="btn small danger" data-yes type="button">Remove</button><button class="btn small" data-no type="button">Keep</button></div>
          </section>
        </div>
      </div>`);
      const prev = root.querySelector('[data-prev]');
      const paint = () => {
        const g = prev.getContext('2d'); const dpr = Math.min(2, window.devicePixelRatio || 1);
        prev.width = 150 * dpr; prev.height = 190 * dpr; prev.style.width = '150px'; prev.style.height = '190px';
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        BW.drawFigure(g, draft, { pose: BW.POSES.idle, facing: 1, ang: 0, sx: 70, sy: 180, scale: 84 });
      };
      paint();
      root.querySelector('[data-back]').addEventListener('click', UI.menu);
      root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { sel = roster.find((r) => r.id === b.dataset.pick); draft = JSON.parse(JSON.stringify(sel)); render(); }));
      root.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('input', () => {
        const k = el.dataset.k;
        draft[k] = el.hasAttribute('data-num') ? +el.value : el.value;
        if (k === 'team' && !el.value.trim()) draft.team = null;
        const s = root.querySelector(`[data-show="${k}"]`); if (s) s.textContent = el.value;
        if (k === 'hairColor' && draft.beard) draft.beard = el.value;
        paint();
      }));
      root.querySelectorAll('[data-sw]').forEach((b) => b.addEventListener('click', () => { draft[b.dataset.sw] = b.dataset.v; root.querySelectorAll(`[data-sw="${b.dataset.sw}"]`).forEach((x) => x.classList.toggle('on', x === b)); paint(); }));
      root.querySelectorAll('[data-color]').forEach((el) => el.addEventListener('input', () => { draft.colors[+el.dataset.color] = el.value; paint(); }));
      root.querySelectorAll('[data-move]').forEach((el) => el.addEventListener('input', () => { draft[el.dataset.move].name = el.value; }));
      root.querySelectorAll('[data-anim]').forEach((el) => el.addEventListener('change', () => { draft[el.dataset.anim].anim = el.value; }));
      const commit = () => {
        draft.name = (draft.name || '').trim() || 'Unnamed';
        draft.finisher.name = draft.finisher.name.trim() || 'Finisher';
        draft.signature.name = draft.signature.name.trim() || 'Signature';
        const i = roster.findIndex((r) => r.id === draft.id);
        if (i >= 0) roster[i] = draft; else roster.push(draft);
        BW.Roster.save(roster); sel = draft; draft = JSON.parse(JSON.stringify(sel));
      };
      root.querySelector('[data-save]').addEventListener('click', () => { commit(); toast(`Saved ${sel.name}`); render(); });
      root.querySelector('[data-try]').addEventListener('click', () => {
        commit();
        const foes = roster.filter((r) => r.gender === sel.gender && r.id !== sel.id);
        const foe = foes[(Math.random() * foes.length) | 0];
        const id = sel.id;
        const go = () => BW.Play.start({ type: 'singles', brand: 'exhibition', difficulty: 'normal', participants: [{ spec: sel, team: 0, control: 'p1' }, { spec: foe, team: 1, control: 'cpu' }], onQuit: () => UI.editor(id), actions: [{ label: 'Back to editor', primary: true, fn: () => UI.editor(id) }, { label: 'Again', fn: go }] });
        go();
      });
      root.querySelector('[data-del]').addEventListener('click', () => { root.querySelector('[data-confirm]').hidden = false; });
      root.querySelector('[data-no]').addEventListener('click', () => { root.querySelector('[data-confirm]').hidden = true; });
      root.querySelector('[data-yes]').addEventListener('click', () => {
        const left = roster.filter((r) => r.id !== sel.id);
        if (left.length < 30 || left.filter((r) => r.gender === 'f').length < 6) { toast('Keep at least 30 wrestlers, 6 of them women, so GM drafts work'); return; }
        roster = roster.filter((r) => r.id !== sel.id); BW.Roster.save(roster); sel = roster[0]; draft = JSON.parse(JSON.stringify(sel)); render();
      });
      root.querySelector('[data-new]').addEventListener('click', () => {
        const base = JSON.parse(JSON.stringify(BW.DEFAULT_ROSTER[(Math.random() * BW.DEFAULT_ROSTER.length) | 0]));
        draft = Object.assign(base, { id: 'c' + Date.now().toString(36), name: 'New Superstar', nick: '', team: null, ovr: 72, pop: 60, mic: 60, salary: 40 });
        draft.finisher = { name: 'New Finisher', anim: draft.finisher.anim }; draft.signature = { name: 'New Signature', anim: draft.signature.anim };
        sel = draft; render();
      });
      root.querySelector('[data-reset]').addEventListener('click', (e) => {
        const b = e.currentTarget;
        if (b.dataset.armed) { BW.Roster.reset(); toast('Default roster restored'); UI.editor(); return; }
        b.dataset.armed = '1'; b.textContent = 'Click again to restore'; setTimeout(() => { b.textContent = 'Restore default roster'; delete b.dataset.armed; }, 3000);
      });
    };
    render();
  };

  /* ================= GENERAL MANAGER ================= */
  let S = null; // current GM state
  const save = () => GM.save(S);
  const R = (id) => S.roster[id];

  UI.gm = function (state) {
    S = state || GM.load();
    if (!S) return UI.gmNew();
    if (S.phase === 'draft') return UI.gmDraft();
    if (S.phase === 'champions') return UI.gmChamps();
    if (S.phase === 'seasonEnd') return UI.gmSeasonEnd();
    if (S.show) return UI.gmShow();
    return UI.gmHub();
  };

  UI.gmNew = function () {
    const existing = GM.load();
    const o = { brand: 'ignite', weeks: 24, difficulty: 'normal', matchDifficulty: 'normal' };
    const render = () => {
      const root = mount(`<div class="page">
        <div class="topbar"><button class="btn small" data-back type="button">← Menu</button></div>
        <h2 class="display">New GM season</h2>
        <div class="brand-cards">${['ignite', 'uprising'].map((b) => `
          <button type="button" class="pick ${o.brand === b ? 'on' : ''}" data-brand="${b}" aria-pressed="${o.brand === b}">
            <span class="label">${BW.BRANDS[b].night}</span>
            <span class="display ${b === 'ignite' ? 'c-ignite' : 'c-uprising'}">${BW.BRANDS[b].name}</span>
            <span class="muted">${BW.BRANDS[b].tagline}</span>
          </button>`).join('')}</div>
        <section class="panel row" style="gap:24px;align-items:flex-start">
          <div class="field"><span class="label">Season length</span><div class="seg-ctl" data-set="weeks">${[12, 24, 52].map((w) => `<button type="button" data-v="${w}" class="${o.weeks === w ? 'on' : ''}">${w} weeks</button>`).join('')}</div></div>
          <div class="field"><span class="label">Rival GM</span><div class="seg-ctl" data-set="difficulty">${['easy', 'normal', 'hard', 'legend'].map((d) => `<button type="button" data-v="${d}" class="${o.difficulty === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>
          <div class="field"><span class="label">In-ring CPU</span><div class="seg-ctl" data-set="matchDifficulty">${['easy', 'normal', 'hard', 'legend'].map((d) => `<button type="button" data-v="${d}" class="${o.matchDifficulty === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>
        </section>
        ${existing ? `<p class="errors">Starting a new season replaces your saved ${esc(BW.BRANDS[existing.player].name)} game (week ${existing.week}).</p>` : ''}
        <div class="row"><button class="btn primary" data-go type="button">Go to the draft</button>${existing ? '<button class="btn" data-cont type="button">Continue saved game instead</button>' : ''}</div>
      </div>`, o.brand);
      root.querySelector('[data-back]').addEventListener('click', UI.menu);
      root.querySelectorAll('[data-brand]').forEach((b) => b.addEventListener('click', () => { o.brand = b.dataset.brand; render(); }));
      root.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; o[el.dataset.set] = el.dataset.set === 'weeks' ? +b.dataset.v : b.dataset.v; render(); }));
      root.querySelector('[data-go]').addEventListener('click', () => {
        const roster = BW.Roster.get();
        const women = roster.filter((r) => r.gender === 'f').length, men = roster.length - women;
        if (women < 6 || men < 22) { toast(`A GM draft needs at least 22 men and 6 women. Your roster has ${men} and ${women}.`); return; }
        S = GM.newGame(Object.assign({ roster }, o)); save(); UI.gmDraft();
      });
      const c = root.querySelector('[data-cont]'); if (c) c.addEventListener('click', () => UI.gm(existing));
    };
    render();
  };

  const who = (r, extra) => `<div class="who">${fig(r.id)}<div style="min-width:0"><div class="nm">${esc(r.name)}</div><div class="sub">${esc(r.nick || '')}${extra ? ' · ' + extra : ''}</div></div></div>`;
  const alignPill = (r) => `<span class="pill ${r.align}">${r.align}</span>`;

  UI.gmDraft = function () {
    let filter = 'all';
    const render = () => {
      const P = S.player, Rv = S.rival;
      const pool = GM.draftPool(S).filter((r) => filter === 'all' || r.gender === filter);
      const mine = GM.list(S, P), theirs = GM.list(S, Rv);
      const myTurn = S.draft.turn === P;
      const pay = GM.payroll(S, P);
      const root = mount(`<div class="page">
        <div class="topbar"><button class="btn small" data-back type="button">← Menu</button><span class="spacer"></span>
          <button class="btn small" data-auto1 type="button" ${myTurn ? '' : 'disabled'}>Auto-pick once</button>
          <button class="btn small" data-autoall type="button">Auto-draft the rest</button></div>
        <div><div class="label">${esc(BW.BRANDS[P].name)} draft · pick ${S.draft.picks.length + 1} of ${GM.ROSTER_SIZE * 2}</div>
        <h2 class="display">${myTurn ? 'You are on the clock' : `${esc(BW.BRANDS[Rv].name)} is picking`}</h2></div>
        <div class="draft-grid">
          <section class="panel" style="display:grid;gap:12px">
            <div class="row"><div class="seg-ctl" data-filter>${[['all', 'Everyone'], ['m', 'Men'], ['f', 'Women']].map(([v, l]) => `<button type="button" data-v="${v}" class="${filter === v ? 'on' : ''}">${l}</button>`).join('')}</div><span class="muted" style="font-size:13px">Sorted by value: popularity weighs more than skill.</span></div>
            <div class="scroll-x"><table><thead><tr><th>Wrestler</th><th></th><th>Style</th><th class="n">OVR</th><th class="n">POP</th><th class="n">MIC</th><th class="n">Salary</th><th></th></tr></thead><tbody>
            ${pool.map((r) => { const why = GM.canDraft(S, P, r); return `<tr><td>${who(r, r.team ? esc(r.team) : '')}</td><td>${alignPill(r)}</td><td>${BW.STYLE_LABELS[r.style]}</td><td class="n">${r.ovr}</td><td class="n">${r.pop}</td><td class="n">${r.mic}</td><td class="n">$${r.salary}k</td>
              <td><button class="btn small ${myTurn && !why ? 'primary' : ''}" data-pick="${esc(r.id)}" type="button" ${myTurn && !why ? '' : 'disabled'} title="${esc(why || '')}">Draft</button>${why && myTurn ? `<div class="muted" style="font-size:11px">${esc(why)}</div>` : ''}</td></tr>`; }).join('')}
            </tbody></table></div>
          </section>
          <div style="display:grid;gap:16px;align-content:start">
            <section class="panel" style="display:grid;gap:8px">
              <h3>${esc(BW.BRANDS[P].name)} · ${mine.length}/${GM.ROSTER_SIZE}</h3>
              <div class="row"><span class="label">Payroll</span><span class="num">${money(pay)} of ${money(GM.SALARY_CAP)}</span></div>
              <div class="bar fat"><i style="width:${pct(pay / GM.SALARY_CAP * 100)}%"></i></div>
              <div class="muted" style="font-size:13px">${mine.filter((r) => r.gender === 'f').length} of at least 3 women</div>
              ${mine.map((r) => `<div class="row" style="justify-content:space-between"><span>${esc(r.name)}</span><span class="muted num">$${r.salary}k</span></div>`).join('') || '<p class="muted">No picks yet.</p>'}
            </section>
            <section class="panel" style="display:grid;gap:6px">
              <h3>${esc(BW.BRANDS[Rv].name)} · ${theirs.length}/${GM.ROSTER_SIZE}</h3>
              ${S.draft.picks.filter((p) => p.brand === Rv).slice().reverse().map((p) => `<div class="row" style="justify-content:space-between"><span>${esc(R(p.id).name)}</span><span class="muted num">#${p.n}</span></div>`).join('') || '<p class="muted">No picks yet.</p>'}
            </section>
          </div>
        </div>
      </div>`, P);
      paintFigs(root, R);
      root.querySelector('[data-back]').addEventListener('click', UI.menu);
      root.querySelector('[data-filter]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { filter = b.dataset.v; render(); } });
      const after = () => { GM.aiDraftPick(S); save(); if (S.phase === 'champions') UI.gmChamps(); else render(); };
      root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { if (GM.draftPick(S, P, b.dataset.pick)) after(); }));
      root.querySelector('[data-auto1]').addEventListener('click', () => { const r = GM.aiDraftChoice(S, P); if (r && GM.draftPick(S, P, r.id)) after(); });
      root.querySelector('[data-autoall]').addEventListener('click', () => { GM.autoDraftPlayer(S); save(); if (S.phase === 'champions') UI.gmChamps(); else render(); });
    };
    render();
  };

  UI.gmChamps = function () {
    const P = S.player, Rv = S.rival;
    const t = S.titles[P];
    const men = GM.list(S, P).filter((r) => r.gender === 'm'), women = GM.list(S, P).filter((r) => r.gender === 'f');
    const opt = (list, cur) => list.map((r) => `<option value="${esc(r.id)}" ${r.id === cur ? 'selected' : ''}>${esc(r.name)} (POP ${r.pop})</option>`).join('');
    const root = mount(`<div class="page">
      <div><div class="label">Draft complete</div><h2 class="display">Crown your champions</h2></div>
      <div class="grid2">
        <section class="panel" style="display:grid;gap:14px">
          <h3 class="c-${P}">${esc(BW.BRANDS[P].name)}</h3>
          <label class="field"><span class="label">World Championship</span><select data-t="world">${opt(men, t.world)}</select></label>
          <label class="field"><span class="label">National Championship</span><select data-t="national">${opt(men, t.national)}</select></label>
          <div class="field"><span class="label">Tag Team Championship</span><div class="row"><select class="grow" data-t="tag0" aria-label="Tag champion 1">${opt(men, t.tag && t.tag[0])}</select><select class="grow" data-t="tag1" aria-label="Tag champion 2">${opt(men, t.tag && t.tag[1])}</select></div></div>
          <label class="field"><span class="label">Women's Championship</span><select data-t="women">${opt(women, t.women)}</select></label>
          <p class="errors" data-err></p>
          <div class="row"><button class="btn primary" data-ok type="button">Start the season</button></div>
        </section>
        <section class="panel" style="display:grid;gap:10px">
          <h3 class="c-${Rv}">${esc(BW.BRANDS[Rv].name)} champions</h3>
          ${['world', 'national', 'tag', 'women'].map((k) => { const v = S.titles[Rv][k]; return `<div><div class="label">${BW.TITLES.find((x) => x.key === k).name}</div><div>${v ? (Array.isArray(v) ? v : [v]).map((id) => esc(R(id).name)).join(' & ') : 'Vacant'}</div></div>`; }).join('')}
        </section>
      </div>
    </div>`, P);
    root.querySelector('[data-ok]').addEventListener('click', () => {
      const v = (k) => root.querySelector(`[data-t="${k}"]`).value;
      const pickd = { world: v('world'), national: v('national'), tag: [v('tag0'), v('tag1')], women: v('women') };
      const all = [pickd.world, pickd.national, ...pickd.tag];
      const err = root.querySelector('[data-err]');
      if (new Set(all).size !== all.length) { err.textContent = 'Each man can hold only one of these titles to start.'; return; }
      S.titles[P] = pickd; GM.confirmChampions(S); save(); UI.gmHub('book');
    });
  };

  /* ---------- hub ---------- */
  let hubTab = 'book';
  UI.gmHub = function (tab) {
    if (tab) hubTab = tab;
    const P = S.player, Rv = S.rival, b = S.brands[P];
    const unread = S.inbox.filter((m) => !m.read).length;
    const ppv = GM.isPPV(S);
    const tabs = [['book', 'Book show'], ['roster', 'Roster'], ['rivalries', 'Rivalries'], ['titles', 'Titles'], ['ratings', 'Ratings'], ['inbox', 'Inbox'], ['moves', 'Signings & trades'], ['season', 'Season']];
    const root = mount(`
      <header class="gm-head"><div class="inner">
        <div><div class="label">Week ${S.week} of ${S.weeks}</div><div class="gm-brand">${esc(BW.BRANDS[P].name)}</div></div>
        <div class="stat"><span class="label">Next show</span><b style="font-size:18px">${esc(GM.showName(S, P))} ${ppv ? '<span class="pill ppv">PPV</span>' : ''}</b></div>
        <div class="stat"><span class="label">Bank</span><b style="color:${b.cash < 0 ? 'var(--bad)' : 'inherit'}">${money(b.cash)}</b></div>
        <div class="stat"><span class="label">Fans</span><b>${fans(b.fans)}</b></div>
        <div class="stat"><span class="label">Ratings war</span><b>${b.warWins}–${b.ratings.length - b.warWins}</b></div>
        <span class="spacer" style="flex:1"></span>
        <button class="btn small" data-menu type="button">Menu</button>
      </div></header>
      <div class="page" style="padding-top:12px">
        <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${hubTab === k ? 'on' : ''}" role="tab" aria-selected="${hubTab === k}" data-tab="${k}" type="button">${l}${k === 'inbox' && unread ? `<span class="badge">${unread}</span>` : ''}</button>`).join('')}</nav>
        <div data-body></div>
      </div>`, P);
    root.querySelector('[data-menu]').addEventListener('click', UI.menu);
    root.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => UI.gmHub(t.dataset.tab)));
    const body = root.querySelector('[data-body]');
    ({ book: tabBook, roster: tabRoster, rivalries: tabRivalries, titles: tabTitles, ratings: tabRatings, inbox: tabInbox, moves: tabMoves, season: tabSeason })[hubTab](body);
    paintFigs(root, R);
  };

  function optList(list, cur, used) {
    return '<option value="">Choose…</option>' + list.map((r) => {
      const dis = r.injury > 0 ? ` (injured ${r.injury}w)` : '';
      const busy = used.has(r.id) && r.id !== cur ? ' · booked' : '';
      return `<option value="${esc(r.id)}" ${r.id === cur ? 'selected' : ''} ${r.injury > 0 ? 'disabled' : ''}>${esc(r.name)} · POP ${Math.round(r.pop)} · FAT ${Math.round(r.fatigue)}${dis}${busy}</option>`;
    }).join('');
  }

  function tabBook(body) {
    const P = S.player;
    if (!S.card) { S.card = GM.autoBook(S, P); save(); }
    const card = S.card;
    const max = GM.segCount(S);
    const used = new Set(card.flatMap((c) => c.slots.slice(0, GM.size(c.type)).filter(Boolean)));
    const list = GM.list(S, P).sort((a, b) => b.pop - a.pop);
    const errs = GM.validate(S, P, card);
    body.innerHTML = `<div class="book-grid">
      <section class="panel">
        <div class="row" style="justify-content:space-between"><h3>${esc(GM.showName(S, P))} · ${card.length} of ${max} segments</h3>
          <div class="row"><button class="btn small" data-autobook type="button">Auto-book</button>${card.length < max ? '<button class="btn small" data-add type="button">Add segment</button>' : ''}</div></div>
        ${card.map((seg, i) => segEditor(seg, i, card.length, list, used)).join('')}
        ${errs.length ? `<div class="errors" style="padding:8px 0">${errs.map(esc).join('<br>')}</div>` : ''}
        <div class="row" style="padding-top:12px"><button class="btn primary" data-run type="button" ${errs.length ? 'disabled' : ''}>Go to the show</button><span class="muted" style="font-size:13px">The last segment is your main event and counts the most.</span></div>
      </section>
      <aside class="panel" style="display:grid;gap:8px;align-content:start">
        <h3>Locker room</h3>
        ${list.map((r) => `<div style="display:grid;grid-template-columns:1fr 60px 60px;gap:8px;align-items:center;font-size:13px">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${used.has(r.id) ? 'color:var(--gold)' : ''}">${esc(r.name)} ${r.injury > 0 ? '<span class="pill inj">inj</span>' : ''}</span>
          <span class="bar" title="Morale ${Math.round(r.morale)}"><i style="width:${pct(r.morale)}%"></i></span>
          <span class="bar fat" title="Fatigue ${Math.round(r.fatigue)}"><i style="width:${pct(r.fatigue)}%"></i></span></div>`).join('')}
        <p class="muted" style="font-size:12px">Green bar is morale, orange is fatigue. Gold names are on this week's card.</p>
      </aside></div>`;
    const reb = () => { save(); UI.gmHub('book'); };
    body.querySelector('[data-autobook]').addEventListener('click', () => { S.card = GM.autoBook(S, P); reb(); });
    const add = body.querySelector('[data-add]'); if (add) add.addEventListener('click', () => { card.splice(card.length - 1, 0, { type: 'singles', slots: [null, null], title: null, winner: null }); reb(); });
    body.querySelectorAll('[data-type]').forEach((el) => el.addEventListener('change', () => {
      const seg = card[+el.dataset.type]; seg.type = el.value; const n = GM.size(seg.type);
      seg.slots = seg.slots.slice(0, n); while (seg.slots.length < n) seg.slots.push(null);
      seg.title = null; seg.winner = null; reb();
    }));
    body.querySelectorAll('[data-slot]').forEach((el) => el.addEventListener('change', () => {
      const [i, j] = el.dataset.slot.split(':').map(Number);
      const id = el.value || null;
      card.forEach((c, ci) => c.slots.forEach((x, xj) => { if (x === id && id && !(ci === i && xj === j)) c.slots[xj] = null; }));
      card[i].slots[j] = id;
      if (card[i].title && !GM.titleOptions(S, P, card[i]).includes(card[i].title)) card[i].title = null;
      card[i].winner = null; reb();
    }));
    body.querySelectorAll('[data-title]').forEach((el) => el.addEventListener('change', () => { card[+el.dataset.title].title = el.value || null; reb(); }));
    body.querySelectorAll('[data-winner]').forEach((el) => el.addEventListener('change', () => { card[+el.dataset.winner].winner = el.value === '' ? null : +el.value; save(); }));
    body.querySelectorAll('[data-rm]').forEach((el) => el.addEventListener('click', () => { card.splice(+el.dataset.rm, 1); reb(); }));
    body.querySelectorAll('[data-up]').forEach((el) => el.addEventListener('click', () => { const i = +el.dataset.up; if (i > 0) { [card[i - 1], card[i]] = [card[i], card[i - 1]]; reb(); } }));
    body.querySelector('[data-run]').addEventListener('click', () => { GM.startShow(S); save(); UI.gmShow(); });
  }

  function segEditor(seg, i, total, list, used) {
    const n = GM.size(seg.type);
    const main = i === total - 1;
    const sides = seg.type === 'tag' ? [[0, 1], [2, 3]] : seg.slots.map((_, j) => [j]);
    const slotSel = (j) => `<select data-slot="${i}:${j}" aria-label="Segment ${i + 1} wrestler ${j + 1}">${optList(list, seg.slots[j], used)}</select>`;
    const titles = GM.titleOptions(S, S.player, seg);
    const filled = seg.slots.slice(0, n).every(Boolean);
    const sideName = (sd) => sd.map((j) => (seg.slots[j] ? R(seg.slots[j]).name : '?')).join(' & ');
    return `<div class="seg ${main ? 'main' : ''}">
      <div class="idx">${i + 1}</div>
      <div class="body">
        <div class="row">
          <select data-type="${i}" aria-label="Segment ${i + 1} type">${Object.entries(BW.MATCH_TYPES).map(([k, v]) => `<option value="${k}" ${seg.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
          ${main ? '<span class="pill champ">Main event</span>' : ''}
          ${seg.title ? `<span class="pill champ">${esc(BW.TITLES.find((t) => t.key === seg.title).name)}</span>` : ''}
          <span class="grow"></span>
          ${i > 0 ? `<button class="btn small ghost" data-up="${i}" type="button" aria-label="Move segment ${i + 1} up">↑</button>` : ''}
          <button class="btn small ghost" data-rm="${i}" type="button" aria-label="Remove segment ${i + 1}">Remove</button>
        </div>
        <div class="slots">${sides.map((sd) => sd.map(slotSel).join('<span class="vs">&amp;</span>')).join('<span class="vs">vs</span>')}</div>
        ${seg.type !== 'promo' && filled ? `<div class="row">
          ${titles.length ? `<select data-title="${i}" aria-label="Title"><option value="">Non-title match</option>${titles.map((k) => `<option value="${k}" ${seg.title === k ? 'selected' : ''}>${esc(BW.TITLES.find((t) => t.key === k).name)} on the line</option>`).join('')}</select>` : ''}
          <select data-winner="${i}" aria-label="Finish"><option value="">Finish: let them fight it out</option>${sides.map((sd, k) => `<option value="${k}" ${seg.winner === k ? 'selected' : ''}>Book ${esc(sideName(sd))} to win</option>`).join('')}</select>
        </div>` : ''}
      </div></div>`;
  }

  function tabRoster(body) {
    const P = S.player;
    const list = GM.list(S, P).sort((a, b) => b.pop - a.pop);
    body.innerHTML = `<section class="panel scroll-x"><table><thead><tr><th>Wrestler</th><th>Side</th><th>Style</th><th class="n">OVR</th><th class="n">POP</th><th class="n">MIC</th><th>Morale</th><th>Fatigue</th><th class="n">W–L</th><th class="n">Salary</th><th></th></tr></thead><tbody>
      ${list.map((r) => { const held = GM.titlesHeld(S, r.id); return `<tr>
        <td>${who(r, held.map((k) => `<span class="pill champ">${BW.TITLES.find((t) => t.key === k).short}</span>`).join(' ') + (r.injury > 0 ? ` <span class="pill inj">out ${r.injury}w</span>` : ''))}</td>
        <td>${alignPill(r)} <button class="btn small ghost" data-turn="${esc(r.id)}" type="button" ${GM.canTurn(S, r) ? '' : 'disabled'} title="Switch face/heel (once every 4 weeks)">Turn</button></td>
        <td>${BW.STYLE_LABELS[r.style]}</td><td class="n">${r.ovr}</td><td class="n">${Math.round(r.pop)}</td><td class="n">${r.mic}</td>
        <td><div class="bar"><i style="width:${pct(r.morale)}%"></i></div></td><td><div class="bar fat"><i style="width:${pct(r.fatigue)}%"></i></div></td>
        <td class="n">${r.wins}–${r.losses}</td><td class="n">$${r.salary}k</td>
        <td><button class="btn small danger" data-rel="${esc(r.id)}" type="button">Release</button></td></tr>`; }).join('')}
    </tbody></table><p class="muted" style="font-size:13px;padding-top:10px">Payroll ${money(GM.payroll(S, P))} per week. Wrestlers left off the card lose morale; tired wrestlers get hurt more often.</p></section>`;
    body.querySelectorAll('[data-turn]').forEach((b) => b.addEventListener('click', () => { GM.turn(S, b.dataset.turn); save(); UI.gmHub('roster'); }));
    body.querySelectorAll('[data-rel]').forEach((b) => b.addEventListener('click', () => {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Confirm'; return; }
      const e = GM.release(S, P, b.dataset.rel); if (e) toast(e); else { toast('Released to free agency'); save(); UI.gmHub('roster'); }
    }));
  }

  function tabRivalries(body) {
    const feuds = GM.topFeuds(S, S.player);
    body.innerHTML = `<section class="panel" style="display:grid;gap:12px">
      <h3>Hottest rivalries</h3>
      ${feuds.length ? feuds.map((f) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 140px 60px;gap:12px;align-items:center">
        <span>${esc(R(f.ids[0]).name)} <span class="muted">vs</span> ${esc(R(f.ids[1]).name)}</span>
        <span class="bar fat"><i style="width:${pct(f.heat)}%"></i></span><span class="muted num">${f.meetings} match${f.meetings > 1 ? 'es' : ''}</span></div>`).join('') : '<p class="muted">No rivalries yet. Book the same wrestlers against each other over a few weeks and the crowd will start to care.</p>'}
      <p class="muted" style="font-size:13px">Heat adds to every match between rivals. It cools a little each week they don't meet, and drops sharply if you run the same match four weeks in a row.</p>
    </section>`;
  }

  function tabTitles(body) {
    body.innerHTML = `<div class="grid2">${[S.player, S.rival].map((br) => `<section class="panel" style="display:grid;gap:12px">
      <h3 class="c-${br}">${esc(BW.BRANDS[br].name)}</h3>
      ${BW.TITLES.map((t) => { const v = S.titles[br][t.key]; const ids = v ? (Array.isArray(v) ? v : [v]) : []; return `<div><div class="label">${t.name}</div><div style="font-weight:600">${ids.map((id) => esc(R(id).name)).join(' & ') || 'Vacant'}</div></div>`; }).join('')}
      <h3 style="padding-top:8px">History</h3>
      ${S.titleHistory.filter((h) => h.brand === br && h.week > 0).slice(-8).reverse().map((h) => `<div class="muted" style="font-size:13px">Week ${h.week}: ${(Array.isArray(h.champ) ? h.champ : [h.champ]).map((id) => esc(R(id).name)).join(' & ')} won the ${BW.TITLES.find((t) => t.key === h.title).short} title</div>`).join('') || '<p class="muted" style="font-size:13px">No title changes yet.</p>'}
    </section>`).join('')}</div>`;
  }

  function chartSVG() {
    const P = S.player, Rv = S.rival;
    const a = S.brands[P].ratings, b = S.brands[Rv].ratings;
    if (!a.length) return '<p class="muted">Ratings appear after your first show.</p>';
    const W = 640, H = 220, padL = 34, padB = 26, padT = 10, padR = 10;
    const all = a.concat(b); const lo = Math.floor(Math.min(...all) - 0.3), hi = Math.ceil(Math.max(...all) + 0.3);
    const n = Math.max(a.length, 2);
    const x = (i) => padL + (W - padL - padR) * (i / (n - 1));
    const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
    const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    let grid = '';
    for (let v = lo; v <= hi; v += 1) grid += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#273049" stroke-width="1"/><text x="${padL - 6}" y="${y(v) + 4}" fill="#8f99b0" font-size="11" text-anchor="end">${v.toFixed(1)}</text>`;
    const ticks = a.map((_, i) => (i % Math.ceil(n / 12) === 0 ? `<text x="${x(i)}" y="${H - 8}" fill="#8f99b0" font-size="11" text-anchor="middle">${i + 1}</text>` : '')).join('');
    const col = (br) => (br === 'ignite' ? '#ff4d1f' : '#4f8fff');
    const dot = (arr, br) => `<circle cx="${x(arr.length - 1)}" cy="${y(arr[arr.length - 1])}" r="4" fill="${col(br)}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly TV ratings">${grid}${ticks}
      <path d="${path(b)}" fill="none" stroke="${col(Rv)}" stroke-width="2" opacity="0.7"/>
      <path d="${path(a)}" fill="none" stroke="${col(P)}" stroke-width="3"/>${dot(b, Rv)}${dot(a, P)}</svg>
      <div class="row" style="font-size:13px"><span style="color:${col(P)}">● ${esc(BW.BRANDS[P].name)}</span><span style="color:${col(Rv)}">● ${esc(BW.BRANDS[Rv].name)}</span><span class="muted">Week number along the bottom</span></div>`;
  }

  function tabRatings(body) {
    const P = S.player, Rv = S.rival, a = S.brands[P], b = S.brands[Rv];
    const avg = (x) => (x.length ? (x.reduce((p, q) => p + q, 0) / x.length).toFixed(2) : '–');
    body.innerHTML = `<section class="panel" style="display:grid;gap:14px"><h3>Weekly TV ratings</h3>${chartSVG()}</section>
      <div class="grid2" style="margin-top:16px">${[[P, a], [Rv, b]].map(([br, x]) => `<section class="panel" style="display:grid;gap:6px">
        <h3 class="c-${br}">${esc(BW.BRANDS[br].name)}</h3>
        <div class="row" style="gap:24px"><div class="stat"><span class="label">Average</span><b>${avg(x.ratings)}</b></div><div class="stat"><span class="label">Fans</span><b>${fans(x.fans)}</b></div><div class="stat"><span class="label">Weeks won</span><b>${x.warWins}</b></div>${br === P ? `<div class="stat"><span class="label">Bank</span><b>${money(x.cash)}</b></div>` : ''}<div class="stat"><span class="label">Best match</span><b>${x.bestStars ? x.bestStars + '★' : '–'}</b></div></div>
      </section>`).join('')}</div>`;
  }

  function tabInbox(body) {
    body.innerHTML = `<section class="panel">${S.inbox.map((m, i) => `<div class="inbox-item ${m.read ? '' : 'unread'}" data-m="${i}" tabindex="0" role="button" aria-expanded="${m.read}">
      <div class="row" style="justify-content:space-between"><span class="subj">${esc(m.subject)}</span><span class="muted" style="font-size:12px">${esc(m.from)} · week ${m.week}</span></div>
      <div class="body" ${m.read ? '' : 'hidden'}>${esc(m.body)}</div></div>`).join('') || '<p class="muted">Nothing here.</p>'}</section>`;
    body.querySelectorAll('[data-m]').forEach((el) => {
      const open = () => { const m = S.inbox[+el.dataset.m]; const bd = el.querySelector('.body'); bd.hidden = !bd.hidden; el.setAttribute('aria-expanded', String(!bd.hidden)); if (!m.read) { m.read = true; el.classList.remove('unread'); save(); const badge = document.querySelector('.tab .badge'); const n = S.inbox.filter((x) => !x.read).length; if (badge) { if (n) badge.textContent = n; else badge.remove(); } } };
      el.addEventListener('click', open); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  function tabMoves(body) {
    const P = S.player, Rv = S.rival;
    const fa = GM.list(S, 'fa').sort((a, b) => GM.value(b) - GM.value(a));
    const mine = GM.list(S, P).sort((a, b) => b.pop - a.pop), theirs = GM.list(S, Rv).sort((a, b) => b.pop - a.pop);
    body.innerHTML = `<div class="grid2">
      <section class="panel" style="display:grid;gap:10px"><h3>Free agents</h3>
        ${fa.length ? `<div class="scroll-x"><table><thead><tr><th>Wrestler</th><th class="n">OVR</th><th class="n">POP</th><th class="n">Salary</th><th class="n">Bonus</th><th></th></tr></thead><tbody>
        ${fa.map((r) => `<tr><td>${who(r, BW.STYLE_LABELS[r.style])}</td><td class="n">${r.ovr}</td><td class="n">${Math.round(r.pop)}</td><td class="n">$${r.salary}k</td><td class="n">${money(GM.signingBonus(r))}</td><td><button class="btn small" data-sign="${esc(r.id)}" type="button">Sign</button></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">Nobody is available.</p>'}
        <p class="muted" style="font-size:13px">Signing costs a one-off bonus of four weeks' salary. Rosters max out at 16.</p>
      </section>
      <section class="panel" style="display:grid;gap:12px"><h3>Propose a trade</h3>
        <label class="field"><span class="label">You give</span><select data-give>${mine.map((r) => `<option value="${esc(r.id)}">${esc(r.name)} · POP ${Math.round(r.pop)} · $${r.salary}k</option>`).join('')}</select></label>
        <label class="field"><span class="label">You get from ${esc(BW.BRANDS[Rv].name)}</span><select data-get>${theirs.map((r) => `<option value="${esc(r.id)}">${esc(r.name)} · POP ${Math.round(r.pop)} · $${r.salary}k</option>`).join('')}</select></label>
        <div class="row"><button class="btn primary" data-trade type="button">Send offer</button></div>
        <p data-tmsg class="muted"></p>
        <p class="muted" style="font-size:13px">The rival GM only accepts deals where they come out slightly ahead. Champions can't be traded.</p>
      </section></div>`;
    body.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => { const e = GM.sign(S, P, b.dataset.sign); if (e) toast(e); else { toast('Signed'); save(); UI.gmHub('moves'); } }));
    body.querySelector('[data-trade]').addEventListener('click', () => {
      const r = GM.proposeTrade(S, body.querySelector('[data-give]').value, body.querySelector('[data-get]').value);
      if (r.ok) { save(); toast(r.msg); UI.gmHub('moves'); } else body.querySelector('[data-tmsg]').textContent = r.msg;
    });
  }

  function tabSeason(body) {
    const P = S.player, Rv = S.rival, b = S.brands[P], r = S.brands[Rv];
    const played = b.ratings.length;
    const prog = {
      war: played ? `${b.warWins} of ${played} weeks (${Math.round(b.warWins / played * 100)}%)` : 'No shows yet',
      fans: `${fans(b.fans)} vs ${fans(r.fans)}`,
      cash: b.wentBroke ? 'Missed: you went into the red' : `On track: ${money(b.cash)}`,
      stars: `Best so far: ${b.bestStars ? b.bestStars + ' stars' : 'none'}`,
    };
    const weeks = []; for (let w = 1; w <= S.weeks; w++) weeks.push(w);
    body.innerHTML = `<div class="grid2">
      <section class="panel" style="display:grid;gap:12px"><h3>Board goals</h3>
        ${S.goals.map((g) => `<div><div style="font-weight:600">${esc(g.text)}</div><div class="muted" style="font-size:13px">${esc(prog[g.id])}</div></div>`).join('')}
        <p class="muted" style="font-size:13px">Your season grade depends on how many goals you meet. The brand with more fans at the end wins GM of the Year.</p>
        <div class="row"><button class="btn small danger" data-quit type="button">Abandon this save</button></div>
      </section>
      <section class="panel scroll-x"><h3>Schedule</h3><table><tbody>
        ${weeks.map((w) => { const h = S.history.find((x) => x.week === w); return `<tr><td class="num">Wk ${w}</td><td>${esc(GM.showName(S, P, w))} ${GM.isPPV(S, w) ? '<span class="pill ppv">PPV</span>' : ''}</td><td class="n">${h ? `${h[P].toFixed(2)} <span class="muted">vs ${h[Rv].toFixed(2)}</span> ${h[P] > h[Rv] ? '<span class="win-tag">W</span>' : '<span class="muted">L</span>'}` : (w === S.week ? '<span class="gold">Next</span>' : '')}</td></tr>`; }).join('')}
      </tbody></table></section></div>`;
    body.querySelector('[data-quit]').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Click again to delete the save'; return; }
      GM.clear(); S = null; UI.menu();
    });
  }

  /* ---------- show night ---------- */
  UI.gmShow = function () {
    const P = S.player, sh = S.show;
    const done = sh.results.every(Boolean);
    const names = (seg) => GM.sides(seg).map((sd) => sd.map((id) => esc(R(id).name)).join(' & ')).join(' <span class="muted">vs</span> ');
    const root = mount(`<div class="page">
      <div class="topbar"><button class="btn small" data-back type="button">← Back to booking</button><span class="spacer"></span>
        ${done ? '' : '<button class="btn small" data-simall type="button">Simulate the rest</button>'}</div>
      <div><div class="label">Week ${S.week} · Live</div><h2 class="display">${esc(GM.showName(S, P))}</h2></div>
      <section class="panel">
        ${sh.card.map((seg, i) => { const r = sh.results[i]; const main = i === sh.card.length - 1; return `<div class="seg ${main ? 'main' : ''}"><div class="idx">${i + 1}</div><div class="body">
          <div class="row"><span class="label">${BW.MATCH_TYPES[seg.type].label}${seg.title ? ' · ' + esc(BW.TITLES.find((t) => t.key === seg.title).name) : ''}${main ? ' · Main event' : ''}</span></div>
          <div style="font-size:17px;font-weight:600">${seg.type === 'promo' ? `${esc(R(seg.slots[0]).name)} <span class="muted">on the microphone</span>` : names(seg)}</div>
          ${r ? (r.promo ? '<div class="muted">Promo done.</div>' : `<div><span class="gold">${r.winners.map((id) => esc(R(id).name)).join(' & ')}</span> won by ${r.method}${r.played ? ' <span class="pill">played</span>' : ''} · <span class="stars" style="font-size:16px">${UI.starsHTML(r.stars)}</span></div>`)
          : seg.type === 'promo' ? `<div class="row"><button class="btn small primary" data-promo="${i}" type="button">Run the promo</button></div>`
          : `<div class="row"><label class="row" style="gap:6px"><span class="label">Play as</span><select data-as="${i}">${seg.slots.slice(0, GM.size(seg.type)).map((id) => `<option value="${esc(id)}">${esc(R(id).name)}</option>`).join('')}</select></label>
              <button class="btn small primary" data-play="${i}" type="button">Play match</button><button class="btn small" data-sim="${i}" type="button">Simulate</button></div>`}
        </div></div>`; }).join('')}
      </section>
      ${done ? '<div class="row"><button class="btn gold" data-final type="button">Get the ratings</button></div>' : ''}
    </div>`, P);
    root.querySelector('[data-back]').addEventListener('click', () => { S.show = null; save(); UI.gmHub('book'); });
    const sa = root.querySelector('[data-simall]'); if (sa) sa.addEventListener('click', () => { GM.simRemaining(S); save(); UI.gmShow(); });
    root.querySelectorAll('[data-promo]').forEach((b) => b.addEventListener('click', () => { GM.recordResult(S, +b.dataset.promo, { promo: true, stars: 0 }); save(); UI.gmShow(); }));
    root.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.sim; GM.recordResult(S, i, GM.simMatch(S, P, sh.card[i])); save(); UI.gmShow(); }));
    root.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.play, seg = sh.card[i];
      const me = root.querySelector(`[data-as="${i}"]`).value;
      const sides = GM.sides(seg);
      const parts = [];
      sides.forEach((sd, si) => sd.forEach((id) => parts.push({ spec: R(id), team: si, control: id === me ? 'p1' : 'cpu' })));
      if (seg.type === 'tag') { const mySide = sides.findIndex((sd) => sd.includes(me)); const mine = parts.filter((p) => p.team === mySide); if (mine[0].control !== 'p1') { const j = parts.indexOf(mine[0]), k = parts.indexOf(mine[1]); [parts[j], parts[k]] = [parts[k], parts[j]]; } }
      const titleName = seg.title ? GM.titleName(P, seg.title) : null;
      BW.Play.start({
        type: seg.type, brand: P, difficulty: S.matchDifficulty || 'normal', title: titleName, participants: parts,
        quitLabel: 'Leave match (no result)',
        onQuit: () => UI.gmShow(),
        actions: [{ label: 'Back to the show', primary: true, fn: (res) => {
          const all = seg.slots.slice(0, GM.size(seg.type));
          GM.recordResult(S, i, { winners: res.winners, losers: all.filter((id) => !res.winners.includes(id)), stars: res.stars, method: res.method, played: true });
          save(); UI.gmShow();
        } }],
      });
    }));
    const fin = root.querySelector('[data-final]');
    if (fin) fin.addEventListener('click', () => { const sum = GM.finishWeek(S); save(); UI.gmResults(sum); });
  };

  UI.gmResults = function (sum) {
    const P = S.player, Rv = S.rival;
    const a = sum.shows[P], b = sum.shows[Rv];
    const segRow = (x) => {
      const seg = x.seg, r = x.res;
      const nm = seg.type === 'promo' ? `${esc(R(seg.slots[0]).name)} promo` : GM.sides(seg).map((sd) => sd.map((id) => esc(R(id).name)).join(' & ')).join(' vs ');
      return `<tr><td>${nm}${seg.title ? ` <span class="pill champ">${BW.TITLES.find((t) => t.key === seg.title).short}</span>` : ''}</td>
        <td>${r && !r.promo ? `<span class="gold">${r.winners.map((id) => esc(BW.lastName(R(id).name))).join(' & ')}</span>` : ''}</td>
        <td class="n">${r && !r.promo ? r.stars + '★' : ''}</td><td class="n">${x.score}</td></tr>`;
    };
    const titleChanges = sum.events.filter((e) => e.titleChange);
    const root = mount(`<div class="page">
      <div><div class="label">Week ${sum.week} results${sum.ppv ? ' · Pay-per-view' : ''}</div><h2 class="display">${a.won ? 'You won the ratings war' : `${esc(BW.BRANDS[Rv].name)} won the week`}</h2></div>
      <section class="panel war">
        <div><div class="label">${esc(sum.name[P])}</div><div class="rating-big c-${P}">${a.rating.toFixed(2)}</div><div class="muted">${a.viewers.toFixed(2)}M viewers</div>${a.won ? '<div class="win-tag">Winner</div>' : ''}</div>
        <div class="vs">VS</div>
        <div><div class="label">${esc(sum.name[Rv])}</div><div class="rating-big c-${Rv}">${b.rating.toFixed(2)}</div><div class="muted">${b.viewers.toFixed(2)}M viewers</div>${b.won ? '<div class="win-tag">Winner</div>' : ''}</div>
      </section>
      <div class="grid2">
        <section class="panel scroll-x" style="display:grid;gap:10px"><h3>Your show</h3>
          <table><thead><tr><th>Segment</th><th>Winner</th><th class="n">Match</th><th class="n">Crowd</th></tr></thead><tbody>${a.segments.map(segRow).join('')}</tbody></table>
          ${a.notes.length ? `<div class="errors">${a.notes.map(esc).join('<br>')}</div>` : ''}
          <div class="row" style="gap:24px"><div class="stat"><span class="label">Revenue</span><b>${money(a.revenue)}</b></div><div class="stat"><span class="label">Payroll</span><b>${money(a.payroll)}</b></div><div class="stat"><span class="label">Fans</span><b>${a.fansDelta >= 0 ? '+' : ''}${a.fansDelta}k</b></div>${a.buys ? `<div class="stat"><span class="label">PPV buys</span><b>${a.buys}k</b></div>` : ''}</div>
        </section>
        <section class="panel scroll-x" style="display:grid;gap:10px"><h3>${esc(BW.BRANDS[Rv].name)}'s show</h3>
          <table><thead><tr><th>Segment</th><th>Winner</th><th class="n">Match</th><th class="n">Crowd</th></tr></thead><tbody>${b.segments.map(segRow).join('')}</tbody></table>
        </section>
      </div>
      ${titleChanges.length ? `<section class="panel"><h3>Title changes</h3>${titleChanges.map((e) => `<p>${(Array.isArray(e.champ) ? e.champ : [e.champ]).map((id) => esc(R(id).name)).join(' & ')} won the ${esc(GM.titleName(R(Array.isArray(e.champ) ? e.champ[0] : e.champ).brand, e.title))}.</p>`).join('')}</section>` : ''}
      <div class="row"><button class="btn primary" data-next type="button">${S.phase === 'seasonEnd' ? 'Season review' : `On to week ${S.week}`}</button></div>
    </div>`, P);
    root.querySelector('[data-next]').addEventListener('click', () => (S.phase === 'seasonEnd' ? UI.gmSeasonEnd() : UI.gmHub('book')));
  };

  UI.gmSeasonEnd = function () {
    const P = S.player, Rv = S.rival, f = S.final || GM.seasonReport(S);
    const root = mount(`<div class="page">
      <div><div class="label">Season review</div><h2 class="display">${f.gmOfYear ? 'GM of the Year' : `${esc(BW.BRANDS[Rv].name)} takes GM of the Year`}</h2></div>
      <section class="panel war">
        <div><div class="label">Season grade</div><div class="rating-big gold">${f.grade}</div></div>
        <div class="vs"></div>
        <div><div class="label">Average rating</div><div class="rating-big c-${P}" style="font-size:56px">${f.avg[P].toFixed(2)}</div><div class="muted">${esc(BW.BRANDS[Rv].name)}: ${f.avg[Rv].toFixed(2)}</div></div>
      </section>
      <section class="panel" style="display:grid;gap:10px"><h3>Board goals</h3>
        ${S.goals.map((g) => `<div class="row"><span class="pill ${f.results[g.id] ? 'face' : 'heel'}">${f.results[g.id] ? 'Met' : 'Missed'}</span><span>${esc(g.text)}</span></div>`).join('')}
        <p class="muted">You won the ratings war ${f.warWins} of ${f.weeks} weeks. Fans: ${fans(S.brands[P].fans)} vs ${fans(S.brands[Rv].fans)}.</p>
      </section>
      <div class="row"><button class="btn primary" data-again type="button">Start next season</button><button class="btn" data-newgm type="button">New GM game</button><button class="btn ghost" data-menu type="button">Main menu</button></div>
    </div>`, P);
    root.querySelector('[data-again]').addEventListener('click', () => { GM.newSeason(S); save(); UI.gmHub('book'); });
    root.querySelector('[data-newgm]').addEventListener('click', UI.gmNew);
    root.querySelector('[data-menu]').addEventListener('click', UI.menu);
  };
})();
