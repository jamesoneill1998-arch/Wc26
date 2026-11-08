/* Brand Wars — running a match on screen: game loop, keyboard, gamepads and touch controls. */
(function () {
  const BW = (window.BW = window.BW || {});
  const STEP = 1 / 60;

  const P1_KEYS = {
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', ShiftLeft: 'run', ShiftRight: 'run',
    KeyJ: 'strike', KeyI: 'kick', KeyK: 'grapple', KeyL: 'reverse', KeyU: 'special', KeyP: 'pin', KeyE: 'act', KeyT: 'taunt',
  };
  const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const P2_KEYS = {
    Numpad1: 'strike', Numpad2: 'grapple', Numpad3: 'reverse', Numpad4: 'kick', Numpad5: 'special', Numpad6: 'pin',
    Numpad0: 'run', Numpad7: 'act', Numpad8: 'taunt', NumpadDecimal: 'run',
  };
  const HELD = new Set(['up', 'down', 'left', 'right', 'run']);
  // standard gamepad mapping
  const PAD = { 0: 'grapple', 1: 'pin', 2: 'strike', 3: 'kick', 4: 'special', 5: 'reverse', 7: 'reverse', 8: 'taunt', 9: 'pause', 10: 'act', 11: 'act' };

  const Play = { active: null };
  BW.Play = Play;

  function route(code) {
    const a = Play.active; if (!a) return null;
    if (P1_KEYS[code]) return [a.inputs[1], P1_KEYS[code]];
    if (ARROWS[code]) return [a.inputs[2] && a.twoPlayer ? a.inputs[2] : a.inputs[1], ARROWS[code]];
    if (P2_KEYS[code] && a.inputs[2]) return [a.inputs[2], P2_KEYS[code]];
    return null;
  }

  window.addEventListener('keydown', (e) => {
    const a = Play.active; if (!a) return;
    if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); if (!a.ended) a.togglePause(); return; }
    const r = route(e.code); if (!r || !r[0]) return;
    e.preventDefault();
    const [inp, act] = r;
    if (HELD.has(act)) inp.held[act] = true;
    if (!e.repeat && !HELD.has(act)) inp.press(act);
    if (!e.repeat && act === 'run') inp.press('runTap');
  });
  window.addEventListener('keyup', (e) => {
    const r = route(e.code); if (!r || !r[0]) return;
    if (HELD.has(r[1])) r[0].held[r[1]] = false;
  });
  window.addEventListener('blur', () => { const a = Play.active; if (!a) return; for (const k of [1, 2]) if (a.inputs[k]) for (const h of HELD) a.inputs[k].held[h] = false; });

  function pollPads(a) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let n = 0;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      n++;
      const inp = a.inputs[n]; if (!inp || n > 2) continue;
      const prev = a.padPrev[n] || {};
      const now = {};
      gp.buttons.forEach((b, i) => { now[i] = b.pressed || b.value > 0.5; });
      for (const i in PAD) if (now[i] && !prev[i]) { if (PAD[i] === 'pause') { if (!a.ended) a.togglePause(); } else inp.press(PAD[i]); }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const any = Object.keys(now).some((i) => now[i]) || Math.abs(ax) > 0.35 || Math.abs(ay) > 0.35;
      if (any || a.padOwned[n]) {
        a.padOwned[n] = true;
        inp.held.left = ax < -0.35 || !!now[14]; inp.held.right = ax > 0.35 || !!now[15];
        inp.held.up = ay < -0.35 || !!now[12]; inp.held.down = ay > 0.35 || !!now[13];
        inp.held.run = !!now[6] || Math.hypot(ax, ay) > 0.95;
      }
      a.padPrev[n] = now;
    }
  }

  const isTouch = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  /**
   * Starts a match on screen.
   * o: { type, brand, difficulty, title, participants: [{spec, team, control:'p1'|'p2'|'cpu'}], onQuit, actions: [{label, primary, fn(result)}] }
   */
  Play.start = function (o) {
    Play.stop();
    BW.Audio.silent = false;
    BW.Audio.unlock();
    const app = document.getElementById('app');
    const touch = o.touch != null ? o.touch : isTouch();
    app.innerHTML = `
      <div class="match-screen">
        <canvas width="960" height="540" aria-label="Wrestling match"></canvas>
        <div class="match-hud-btns">
          <button class="btn" data-a="sound" type="button">${BW.Audio.muted ? 'Sound off' : 'Sound on'}</button>
          <button class="btn" data-a="pause" type="button">Pause</button>
        </div>
        <div class="touch" ${touch ? '' : 'hidden'}>
          <div class="stick"><div class="knob"></div></div>
          <div class="pad">
            <button data-k="taunt" type="button">Taunt</button><button data-k="special" class="hot" type="button">Special</button><button data-k="pin" type="button">Pin</button>
            <button data-k="kick" type="button">Kick</button><button data-k="grapple" type="button">Grapple</button><button data-k="act" type="button">Climb/Lift</button>
            <button data-k="strike" type="button">Strike</button><button data-k="reverse" class="rev" type="button">Reverse</button><button data-k="run" type="button">Run</button>
          </div>
        </div>
        <div class="overlay" data-o="pause" hidden><div class="box">
          <h2 class="display">Paused</h2>
          ${BW.UI ? BW.UI.controlsHTML(true) : ''}
          <div class="row"><button class="btn primary" data-a="resume" type="button">Resume</button><button class="btn" data-a="touch" type="button">${touch ? 'Hide' : 'Show'} touch controls</button><button class="btn danger" data-a="quit" type="button">${o.quitLabel || 'Quit match'}</button></div>
        </div></div>
        <div class="overlay" data-o="end" hidden><div class="box" data-end></div></div>
      </div>`;
    const canvas = app.querySelector('canvas');
    const g = canvas.getContext('2d');
    const inputs = { 1: new BW.Input(), 2: null };
    const twoPlayer = o.participants.some((p) => p.control === 'p2');
    if (twoPlayer) inputs[2] = new BW.Input();
    const parts = o.participants.map((p) => ({
      spec: p.spec, team: p.team, human: p.control === 'p1' ? 1 : p.control === 'p2' ? 2 : 0,
      input: p.control === 'p1' ? inputs[1] : p.control === 'p2' ? inputs[2] : null,
    }));
    const a = {
      inputs, twoPlayer, padPrev: {}, padOwned: {}, ended: false, raf: 0, last: 0, acc: 0, o,
      match: null,
      togglePause() {
        this.match.paused = !this.match.paused;
        app.querySelector('[data-o=pause]').hidden = !this.match.paused;
        app.querySelector('[data-a=pause]').textContent = this.match.paused ? 'Resume' : 'Pause';
      },
    };
    a.match = new BW.Match({
      type: o.type, brand: o.brand, difficulty: o.difficulty, title: o.title, participants: parts, touch,
      onEnd: (res) => { a.ended = true; showEnd(res); },
    });
    Play.active = a;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      const w = Math.max(320, Math.round(r.width * dpr)), h = Math.round(w * 9 / 16);
      if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
    };
    resize();
    a.onResize = resize;
    window.addEventListener('resize', resize);

    const frame = (ts) => {
      if (Play.active !== a) return;
      a.raf = requestAnimationFrame(frame);
      if (!a.last) a.last = ts;
      let dt = (ts - a.last) / 1000; a.last = ts;
      if (dt > 0.1) dt = 0.1;
      pollPads(a);
      a.acc += dt;
      let n = 0;
      while (a.acc >= STEP && n < 6) { a.match.update(STEP); a.acc -= STEP; n++; }
      const k = canvas.width / 960;
      g.setTransform(k, 0, 0, k, 0, 0);
      a.match.render(g);
    };
    a.raf = requestAnimationFrame(frame);

    // buttons
    app.querySelector('.match-screen').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const act = b.dataset.a;
      if (act === 'pause' || act === 'resume') a.togglePause();
      if (act === 'sound') { const m = BW.Audio.toggleMute(); b.textContent = m ? 'Sound off' : 'Sound on'; }
      if (act === 'touch') { const t = app.querySelector('.touch'); t.hidden = !t.hidden; b.textContent = t.hidden ? 'Show touch controls' : 'Hide touch controls'; a.match.opts.touch = !t.hidden; }
      if (act === 'quit') { Play.stop(); if (o.onQuit) o.onQuit(); }
    });
    bindTouch(app, inputs[1]);

    function showEnd(res) {
      const ov = app.querySelector('[data-o=end]');
      const box = ov.querySelector('[data-end]');
      const m = a.match;
      const names = res.winners.map((id) => m.ws.find((w) => w.id === id).name).join(' & ');
      const mm = Math.floor(res.time / 60), ss = String(Math.floor(res.time % 60)).padStart(2, '0');
      box.innerHTML = `
        <div class="label">${res.humanInvolved ? (res.humanWon ? 'Victory' : 'Defeat') : 'Result'}</div>
        <h2 class="display" style="font-size:44px">${BW.UI.esc(names)}</h2>
        <p class="muted">Won by ${res.method} in ${mm}:${ss}${o.title ? ` · ${BW.UI.esc(o.title)}` : ''}</p>
        <div><div class="label">Match rating</div><div class="stars">${BW.UI.starsHTML(res.stars)}</div></div>
        <p class="muted" style="font-size:14px">${m.stats.moves.size} different moves · ${m.stats.reversals} reversals · ${Math.floor(m.stats.nearfalls)} near falls · ${m.stats.finishers} finishers</p>
        <div class="row">${(o.actions || []).map((x, i) => `<button class="btn ${x.primary ? 'primary' : ''}" data-x="${i}" type="button">${x.label}</button>`).join('')}</div>`;
      ov.hidden = false;
      box.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => { const x = o.actions[+b.dataset.x]; Play.stop(); x.fn(res); }));
      const first = box.querySelector('.btn.primary') || box.querySelector('.btn');
      if (first) first.focus();
    }
    return a;
  };

  Play.stop = function () {
    const a = Play.active;
    if (!a) return;
    cancelAnimationFrame(a.raf);
    window.removeEventListener('resize', a.onResize);
    Play.active = null;
    BW.Audio.crowd(0);
  };

  function bindTouch(app, inp) {
    const stick = app.querySelector('.stick'), knob = stick.querySelector('.knob');
    let id = null;
    const set = (dx, dy) => {
      const m = Math.hypot(dx, dy);
      inp.held.left = dx < -0.35; inp.held.right = dx > 0.35; inp.held.up = dy < -0.35; inp.held.down = dy > 0.35;
      if (!runLatch) inp.held.run = m > 0.92;
      const k = Math.min(1, m);
      const ang = Math.atan2(dy, dx);
      knob.style.left = `${46 + Math.cos(ang) * k * 46}px`; knob.style.top = `${46 + Math.sin(ang) * k * 46}px`;
    };
    const move = (e) => {
      const r = stick.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    };
    stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); move(e); BW.Audio.unlock(); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; set(0, 0); knob.style.left = '46px'; knob.style.top = '46px'; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    let runLatch = false;
    app.querySelectorAll('.pad button').forEach((b) => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (k === 'run') { runLatch = !runLatch; inp.held.run = runLatch; b.classList.toggle('on', runLatch); return; }
        inp.press(k);
      });
    });
  }

  /* ---------- attract mode (CPU match behind the title screen) ---------- */
  Play.attract = function (canvas) {
    const g = canvas.getContext('2d');
    const roster = BW.Roster.get().filter((r) => r.gender === 'm');
    let m = null, raf = 0, last = 0, acc = 0, stopped = false;
    const brands = ['ignite', 'uprising'];
    let bi = Math.random() < 0.5 ? 0 : 1;
    const fresh = () => {
      BW.Audio.silent = true;
      const a = roster[(Math.random() * roster.length) | 0];
      let b = roster[(Math.random() * roster.length) | 0];
      if (b === a) b = roster[(roster.indexOf(a) + 1) % roster.length];
      bi = 1 - bi;
      m = new BW.Match({ type: 'singles', brand: brands[bi], difficulty: 'hard', noHud: true, participants: [{ spec: a, team: 0 }, { spec: b, team: 1 }], onEnd: () => setTimeout(() => { if (!stopped) fresh(); }, 1500) });
      m.phase = 'live';
    };
    fresh();
    const frame = (ts) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (!last) last = ts;
      let dt = Math.min(0.1, (ts - last) / 1000); last = ts; acc += dt;
      BW.Audio.silent = true;
      let n = 0;
      while (acc >= STEP && n < 4) { m.update(STEP); acc -= STEP; n++; }
      const k = canvas.width / 960;
      g.setTransform(k, 0, 0, k, 0, 0);
      m.render(g);
    };
    raf = requestAnimationFrame(frame);
    return () => { stopped = true; cancelAnimationFrame(raf); BW.Audio.silent = false; };
  };
})();
