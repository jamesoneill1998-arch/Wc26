/* Brand Wars — match engine.
   A fixed-step simulation of a wrestling match: wrestlers, referee, moves,
   reversals, pins, submissions, tag rules, CPU opponents and the HUD. */
(function () {
  const BW = (window.BW = window.BW || {});
  const RING = BW.RING;
  const POSES = BW.POSES;
  const KEYS = BW.POSE_KEYS;

  const rand = Math.random;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (arr) => arr[(rand() * arr.length) | 0];
  const lastName = (n) => { const p = n.split(' '); return p.length > 1 && p[0] !== 'The' ? p[p.length - 1] : n; };

  const DIFF = {
    easy: { rev: 0.1, react: 0.6, aggr: 0.6, getup: 0.75, kick: 0.8, sub: 0.75, save: 0.35 },
    normal: { rev: 0.22, react: 0.4, aggr: 0.8, getup: 1.0, kick: 1.0, sub: 1.0, save: 0.6 },
    hard: { rev: 0.35, react: 0.26, aggr: 0.95, getup: 1.2, kick: 1.12, sub: 1.18, save: 0.8 },
    legend: { rev: 0.5, react: 0.16, aggr: 1.0, getup: 1.35, kick: 1.25, sub: 1.3, save: 0.95 },
  };
  BW.DIFFICULTY = DIFF;

  const KIND = {
    slam: 'grapple', suplex: 'grapple', powerbomb: 'grapple', driver: 'grapple', ddt: 'grapple', toss: 'grapple',
    stagger: 'grapple', chokeslam: 'grapple', cutter: 'grapple', press: 'grapple', german: 'grapple',
    neckbreaker: 'grapple', backbreaker: 'grapple', bearhug: 'standsub',
    superkick: 'strike', roundhouse: 'strike', knee: 'strike',
    spear: 'running', lariat: 'running', clothesline: 'running', tackle: 'running', dropkick: 'running',
    splash: 'dive', elbow: 'dive', moonsault: 'dive', headbutt: 'dive', legdrop: 'dive',
    stomp: 'ground', elbowdrop: 'ground', kneedrop: 'ground', gpunch: 'ground',
    sub_leg: 'sub', sub_neck: 'sub', sub_arm: 'sub', sub_back: 'sub',
  };
  BW.ANIM_KIND = KIND;

  /* Grapple animation tracks. d = defender [t, dx, dz, ang], a = attacker poses [t, pose],
     ad = attacker offset [t, dx, dz, ang]. dx is measured along the attacker's facing. */
  const G = {
    slam: { T: 1.1, hit: 0.68, d: [[0, .75, 0, 0], [.28, .4, .7, -60], [.5, .28, 1.3, -90], [.68, .95, 0, -90], [1, 1, 0, -90]], a: [[0, 'lockup'], [.22, 'lift'], [.64, 'slamdown'], [.92, 'idle']] },
    suplex: { T: 1.4, hit: 0.64, d: [[0, .75, 0, 0], [.22, .55, .25, 30], [.42, .15, 1.35, 180], [.64, -1.0, 0, 270], [1, -1.05, 0, 270]], a: [[0, 'lockup'], [.2, 'lift'], [.55, 'lying'], [.95, 'lying']], ad: [[0, 0, 0, 0], [.42, 0, 0, 0], [.62, -.2, 0, -80], [1, -.2, 0, -80]], aDown: 0.2 },
    german: { T: 1.4, hit: 0.64, rear: true, d: [[0, .6, 0, 0], [.22, .45, .3, -30], [.42, .1, 1.35, -180], [.64, -1.0, 0, -270], [1, -1.05, 0, -270]], a: [[0, 'lockup'], [.2, 'lift'], [.55, 'lying'], [.95, 'lying']], ad: [[0, 0, 0, 0], [.42, 0, 0, 0], [.62, -.2, 0, -80], [1, -.2, 0, -80]], aDown: 0.2 },
    powerbomb: { T: 1.35, hit: 0.7, d: [[0, .75, 0, 0], [.18, .5, .05, 100], [.42, .3, 1.3, -10], [.56, .35, 1.4, -20], [.7, .95, 0, -90], [1, 1, 0, -90]], a: [[0, 'lockup'], [.12, 'slamdown'], [.35, 'lift'], [.66, 'slamdown'], [.92, 'idle']] },
    driver: { T: 1.35, hit: 0.72, d: [[0, .75, 0, 0], [.2, .5, .1, 100], [.42, .4, .9, 180], [.6, .42, 1.0, 180], [.72, .5, 0, 180], [.84, .75, 0, 240], [1, .95, 0, 270]], a: [[0, 'lockup'], [.15, 'slamdown'], [.38, 'lift'], [.7, 'sit'], [.96, 'idle']] },
    ddt: { T: 0.95, hit: 0.5, d: [[0, .75, 0, 0], [.25, .55, 0, 40], [.5, .5, 0, 92], [1, .55, 0, 90]], a: [[0, 'lockup'], [.4, 'lying']], ad: [[0, 0, 0, 0], [.25, 0, 0, 0], [.5, -.1, 0, -85], [1, -.1, 0, -85]], aDown: 0.25 },
    cutter: { T: 0.9, hit: 0.45, d: [[0, .75, 0, 0], [.25, .65, .25, 25], [.45, .6, 0, 92], [1, .62, 0, 90]], a: [[0, 'lockup'], [.35, 'lying']], ad: [[0, 0, 0, 0], [.2, 0, .2, 0], [.45, 0, 0, -90], [1, 0, 0, -90]], aDown: 0.2 },
    neckbreaker: { T: 0.95, hit: 0.5, d: [[0, .75, 0, 0], [.3, .5, .1, -30], [.5, .4, 0, -92], [1, .45, 0, -90]], a: [[0, 'lockup'], [.4, 'lying']], ad: [[0, 0, 0, 0], [.25, 0, 0, 0], [.5, -.1, 0, -85], [1, -.1, 0, -85]], aDown: 0.25 },
    toss: { T: 1.0, hit: 0.62, d: [[0, .75, 0, 0], [.25, .4, .5, 80], [.45, .5, .8, 170], [.62, 1.25, 0, 270], [1, 1.3, 0, 270]], a: [[0, 'lockup'], [.25, 'lift'], [.5, 'clothesline'], [.85, 'idle']] },
    stagger: { T: 0.7, hit: 0.38, d: [[0, .75, 0, 0], [.32, .75, 0, 0], [.45, 1.15, 0, -15], [1, 1.4, 0, 0]], a: [[0, 'lockup'], [.15, 'windup'], [.32, 'kneeup'], [.7, 'idle']], dEnd: 'stun' },
    chokeslam: { T: 1.3, hit: 0.72, d: [[0, .75, 0, 0], [.25, .7, .8, 0], [.5, .75, 1.35, -8], [.62, .8, 1.4, -20], [.72, .95, 0, -90], [1, 1, 0, -90]], a: [[0, 'lockup'], [.2, 'chokelift'], [.7, 'slamdown'], [.95, 'idle']] },
    press: { T: 1.6, hit: 0.8, d: [[0, .75, 0, 0], [.25, .25, 1.1, -90], [.4, .05, 2.05, -90], [.65, .05, 2.1, -90], [.8, 1.3, 0, -90], [1, 1.35, 0, -90]], a: [[0, 'lockup'], [.22, 'lift'], [.78, 'slamdown'], [.96, 'idle']] },
    backbreaker: { T: 1.1, hit: 0.55, d: [[0, .75, 0, 0], [.3, .3, .9, -90], [.55, .15, .55, -90], [.75, .6, 0, -90], [1, .7, 0, -90]], a: [[0, 'lockup'], [.25, 'lift'], [.5, 'kneel'], [.85, 'idle']] },
    bearhug: { T: 0.45, hit: 1.0, d: [[0, .75, 0, 0], [1, .5, .25, 0]], a: [[0, 'lockup'], [.5, 'hug']], toSub: true },
  };
  BW.GRAPPLE_ANIMS = G;

  const DIVE = {
    splash: { end: 90, pose: 'fly' }, elbow: { end: 90, pose: 'fly' }, headbutt: { end: 90, pose: 'fly' },
    moonsault: { end: -270, pose: 'tuck' }, legdrop: { end: -90, pose: 'sit' },
  };

  /* ---------------- input ---------------- */
  class Input {
    constructor() { this.held = { left: false, right: false, up: false, down: false, run: false }; this.pressed = new Set(); this.mash = 0; }
    press(a) { this.pressed.add(a); if (a !== 'pause' && a !== 'taunt') this.mash++; }
    has(a) { return this.pressed.has(a); }
    endFrame() { this.pressed.clear(); this.mash = 0; }
  }
  BW.Input = Input;

  /* ---------------- wrestler ---------------- */
  class Wr {
    constructor(spec, o) {
      this.spec = spec; this.id = spec.id; this.name = spec.name; this.short = lastName(spec.name);
      this.team = o.team; this.human = o.human || 0; this.input = o.input || null;
      this.ms = BW.MOVESETS[spec.style] || BW.MOVESETS.brawler;
      this.stat = BW.STYLE_STATS[spec.style] || BW.STYLE_STATS.brawler;
      this.skill = (spec.ovr || 75) / 100;
      this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vy = 0; this.facing = 1; this.ang = 0;
      this.pose = Object.assign({}, POSES.idle); this.poseName = 'idle';
      this.state = 'idle'; this.st = 0; this.dur = 0;
      this.dmg = { head: 0, arms: 0, body: 0, legs: 0 };
      this.mom = 15; this.fin = 0; this.active = true;
      this.revWin = 0; this.revBy = null; this.revLock = 0; this.revReady = false;
      this.combo = 0; this.lastStrike = -9; this.downT = 0; this.lastBig = null;
      this.ai = { think: 0, wait: 0, target: null, plan: null, lockT: 0, tagCooldown: 6 };
      this.walkPhase = 0; this.flash = 0; this.autoRun = 0;
      this.partner = null; this.atk = null; this.mv = null; this.hold = null;
      this.tagT = 0; this.wasHuman = !!this.human;
    }
    hurt() { const d = this.dmg; return clamp((d.head * 1.25 + d.body * 1.1 + d.legs * 0.8 + d.arms * 0.6) / 3.75, 0, 100); }
    standing() { return ['idle', 'walk', 'run', 'stun', 'hit', 'taunt', 'atk'].includes(this.state); }
    isDown() { return this.state === 'down' || this.state === 'fall' || this.state === 'getup'; }
    headDir() { return this.facing * (Math.sin(this.ang * Math.PI / 180) >= 0 ? 1 : -1); }
    set(state, dur) { this.state = state; this.st = 0; this.dur = dur || 0; }
  }

  /* ---------------- match ---------------- */
  class Match {
    /**
     * opts: { type, brand, difficulty, title, participants: [{spec, team, human, input}], onEnd }
     */
    constructor(opts) {
      this.opts = opts;
      this.type = opts.type || 'singles';
      this.brand = opts.brand || 'exhibition';
      this.diff = DIFF[opts.difficulty || 'normal'];
      this.isTag = this.type === 'tag';
      this.subOnly = this.type === 'submission';
      this.ws = opts.participants.map((p, i) => new Wr(p.spec, { team: p.team != null ? p.team : i, human: p.human, input: p.input }));
      this.ref = { x: 0, y: -1.4, z: 0, facing: 1, pose: Object.assign({}, POSES.stand), poseName: 'stand', count: 0, countT: 0, state: 'roam', st: 0, spec: { ref: true, name: 'Referee', skin: '#e2b48e', hairColor: '#333', hair: 'short', height: 0.98, build: 0.95 } };
      this.t = 0; this.phase = 'intro'; this.phaseT = 0;
      this.fx = []; this.texts = []; this.feed = []; this.banner = null;
      this.shake = 0; this.flashes = [];
      this.pin = null; this.sub = null; this.result = null;
      this.paused = false;
      this.stats = { moves: new Set(), reversals: 0, nearfalls: 0, finKickouts: 0, finishers: 0, signatures: 0, swings: 0, leader: null, bigMoves: 0 };
      this.arena = BW.buildArena(this.brand);
      this.setupPositions();
    }

    get actives() { return this.ws.filter((w) => w.active); }

    setupPositions() {
      const ws = this.ws;
      if (this.isTag) {
        const byTeam = [ws.filter((w) => w.team === 0), ws.filter((w) => w.team === 1)];
        byTeam.forEach((tm, ti) => {
          tm.forEach((w, i) => {
            w.partner = tm[1 - i] || null;
            if (i === 0) { w.x = ti === 0 ? -2 : 2; w.y = 0.2; w.facing = ti === 0 ? 1 : -1; } else this.toApron(w);
          });
        });
      } else {
        const spots = ws.length === 2 ? [[-2, 0.2], [2, 0.2]] : ws.length === 3 ? [[-2.4, 0.6], [2.4, 0.6], [0, -1.4]] : [[-2.4, 1], [2.4, 1], [-2.4, -1.2], [2.4, -1.2]];
        ws.forEach((w, i) => { w.x = spots[i][0]; w.y = spots[i][1]; w.facing = w.x < 0 ? 1 : -1; });
      }
    }

    toApron(w) {
      w.active = false; w.set('apron');
      w.x = w.team === 0 ? -(RING.W + 0.55) : RING.W + 0.55; w.y = -RING.D + 0.35; w.z = 0.35;
      w.facing = w.team === 0 ? 1 : -1; w.ang = 0;
    }
    cornerOf(team) { return { x: team === 0 ? -RING.W + 0.4 : RING.W - 0.4, y: -RING.D + 0.35 }; }

    opponents(w) { return this.actives.filter((o) => o !== w && (this.isTag ? o.team !== w.team : true)); }

    say(text, cls) { this.feed.unshift({ text, t: 0, cls: cls || '' }); if (this.feed.length > 4) this.feed.pop(); }
    pop(x, y, z, text, color) { this.texts.push({ x, y, z, text, color: color || '#fff', t: 0 }); }
    showBanner(text, color) { this.banner = { text, color, t: 0 }; }

    /* ---------- main loop ---------- */
    update(dt) {
      if (this.paused) return;
      this.phaseT += dt;
      if (this.phase === 'intro') {
        if (this.phaseT > 2.6) { this.phase = 'live'; this.phaseT = 0; BW.Audio.bell(1); BW.Audio.crowd(0.05); this.say('The bell rings and we are underway!'); }
        this.ws.forEach((w) => this.animate(w, dt));
        this.ws.forEach((w) => w.input && w.input.endFrame());
        return;
      }
      if (this.phase === 'live') this.t += dt;
      for (const w of this.ws) {
        w.st += dt;
        if (w.revLock > 0) w.revLock -= dt;
        if (w.revWin > 0) w.revWin -= dt;
        if (w.flash > 0) w.flash -= dt * 3;
        if (this.phase === 'live') {
          if (w.human && w.input) this.humanControl(w, dt); else this.aiControl(w, dt);
        }
        this.step(w, dt);
      }
      this.updatePin(dt);
      this.updateSub(dt);
      this.separate();
      this.updateRef(dt);
      for (const w of this.ws) this.animate(w, dt);
      this.updateFx(dt);
      this.trackMomentum();
      if (this.phase === 'over') {
        if (this.phaseT > 3.2 && !this.result.shown) { this.result.shown = true; if (this.opts.onEnd) this.opts.onEnd(this.result); }
      }
      this.ws.forEach((w) => w.input && w.input.endFrame());
    }

    trackMomentum() {
      if (this.ws.length < 2) return;
      const sorted = this.actives.slice().sort((a, b) => a.hurt() - b.hurt());
      if (!sorted.length) return;
      const lead = sorted[0];
      if (sorted[1] && Math.abs(sorted[0].hurt() - sorted[1].hurt()) > 12 && this.stats.leader !== lead.id) {
        if (this.stats.leader) this.stats.swings++;
        this.stats.leader = lead.id;
      }
    }

    /* ---------- human control ---------- */
    humanControl(w, dt) {
      const inp = w.input;
      const h = inp.held;
      let ix = (h.right ? 1 : 0) - (h.left ? 1 : 0), iy = (h.down ? 1 : 0) - (h.up ? 1 : 0);
      if (inp.has('reverse')) this.tryReverse(w);
      if (inp.has('pause')) return;
      const mash = inp.mash;
      switch (w.state) {
        case 'down': if (mash) w.downT -= 0.14 * mash; return;
        case 'pinD': case 'subD': case 'subA': return; // handled in pin/sub
        case 'lockA': return this.lockupChoice(w, inp, ix, iy);
        case 'perch':
          if (inp.has('special')) return this.special(w);
          if (inp.has('strike') || inp.has('grapple') || inp.has('kick')) return this.startDive(w, w.ms.top, false);
          if (inp.has('act') || (ix && Math.sign(ix) !== Math.sign(-w.x))) { w.set('climbdown', 0.35); }
          return;
        case 'whipA': case 'idle': case 'walk': case 'run': break;
        default: return;
      }
      if (w.state === 'apron') return;
      // movement intent
      w.ix = ix; w.iy = iy;
      const running = h.run && (ix || iy);
      if (inp.has('taunt')) {
        if (this.isTag && this.nearOwnCorner(w)) return this.tryTag(w);
        return this.taunt(w);
      }
      if (inp.has('special')) return this.special(w);
      const tgt = this.nearestOpp(w, 1.9);
      if (inp.has('pin')) {
        const d = this.nearestDowned(w, 1.6);
        if (d) return this.startPin(w, d);
        if (tgt && tgt.standing() && w.state !== 'run') return this.startAttack(w, tgt, 'standsub');
      }
      if (inp.has('act')) {
        const d = this.nearestDowned(w, 1.4);
        if (d) return this.pickUp(w, d);
        const c = this.nearCorner(w);
        if (c) return this.climb(w, c);
      }
      if (inp.has('strike') || inp.has('kick')) {
        const kick = inp.has('kick');
        if (w.state === 'whipA' && w.whipTarget) return this.reboundAttack(w, w.whipTarget, 'strike');
        if (w.state === 'run') return this.runAttack(w, 'strike');
        const d = this.nearestDowned(w, 1.5);
        if (d && (!tgt || !tgt.standing() || this.dist(w, d) < this.dist(w, tgt))) return this.groundAttack(w, d);
        if (tgt) this.faceTo(w, tgt);
        return this.startAttack(w, tgt, kick ? 'kick' : 'strike');
      }
      if (inp.has('grapple')) {
        if (w.state === 'whipA' && w.whipTarget) return this.reboundAttack(w, w.whipTarget, 'grapple');
        if (w.state === 'run') return this.runAttack(w, 'grapple');
        const d = this.nearestDowned(w, 1.5);
        if (d && (!tgt || !tgt.standing())) return this.groundSub(w, d);
        if (tgt) { this.faceTo(w, tgt); return this.startAttack(w, tgt, 'grapple'); }
        return this.startAttack(w, null, 'grapple');
      }
      if (w.state === 'whipA') { if (w.st > 2.2) w.set('idle'); return; }
      if (w.autoRun > 0) return;
      if (running) { if (w.state !== 'run') w.set('run'); }
      else if (ix || iy) { if (w.state !== 'walk') w.set('walk'); }
      else if (w.state !== 'idle') w.set('idle');
      if (ix) w.facing = ix > 0 ? 1 : -1;
    }

    lockupChoice(w, inp, ix, iy) {
      const d = w.lock && w.lock.def;
      if (!d || w.pendingMove) return;
      let dirn = 'neutral';
      if (ix && Math.sign(ix) === w.facing) dirn = 'fwd'; else if (ix) dirn = 'back'; else if (iy) dirn = 'side';
      if (inp.has('special')) return this.special(w);
      if (inp.has('strike')) return this.lockMove(w, d, w.ms.quick[dirn], 'quick');
      if (inp.has('grapple') || inp.has('kick')) return this.lockMove(w, d, w.ms.strong[dirn], 'strong');
      if (inp.has('pin')) return this.lockMove(w, d, w.ms.sub, 'sub');
      if (inp.held.run && inp.has('act')) return this.whip(w, d);
      if (inp.has('act')) return this.whip(w, d);
    }

    /* ---------- helpers ---------- */
    dist(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) * 1.6); }
    faceTo(w, o) { if (Math.abs(o.x - w.x) > 0.05) w.facing = o.x > w.x ? 1 : -1; }
    nearestOpp(w, range) {
      let best = null, bd = range;
      for (const o of this.opponents(w)) { if (!o.standing() && o.state !== 'perch' && o.state !== 'whipped') continue; const d = this.dist(w, o); if (d < bd) { bd = d; best = o; } }
      return best;
    }
    nearestDowned(w, range) {
      let best = null, bd = range;
      for (const o of this.opponents(w)) { if (o.state !== 'down') continue; const d = this.dist(w, o); if (d < bd) { bd = d; best = o; } }
      return best;
    }
    inFront(a, b, reach, depth) {
      const f = (b.x - a.x) * a.facing;
      return f > -0.1 && f < reach && Math.abs(b.y - a.y) < (depth || 0.45);
    }
    corners() { const x = RING.W - 0.32, y = RING.D - 0.26; return [[-x, -y], [x, -y], [-x, y], [x, y]]; }
    nearCorner(w) {
      for (const c of this.corners()) if (Math.hypot(w.x - c[0], (w.y - c[1]) * 1.4) < 1.0) return c;
      return null;
    }
    nearOwnCorner(w) {
      if (!this.isTag || !w.partner || w.partner.state !== 'apron') return false;
      const c = this.cornerOf(w.team);
      return Math.hypot(w.x - c.x, (w.y - c.y) * 1.4) < 1.1;
    }
    nearRopes(w) { return Math.abs(w.x) > RING.W - 0.75 || Math.abs(w.y) > RING.D - 0.45; }
    canAct(w) { return ['idle', 'walk', 'run'].includes(w.state); }
    hittable(o) { return ['idle', 'walk', 'run', 'stun', 'hit', 'taunt', 'atk', 'whipped', 'climb', 'climbdown'].includes(o.state); }
    strikeable(o) { return this.hittable(o) || ['pinA', 'subA', 'perch'].includes(o.state); }

    /* ---------- damage & momentum ---------- */
    damage(a, d, amt, part, opts) {
      opts = opts || {};
      const pow = a ? a.stat.power * (0.8 + a.skill * 0.35) : 1;
      const v = amt * pow * (0.85 + rand() * 0.3);
      d.dmg[part || 'body'] = clamp(d.dmg[part || 'body'] + v, 0, 100);
      if (part !== 'body') d.dmg.body = clamp(d.dmg.body + v * 0.25, 0, 100);
      d.flash = 1;
      if (a) this.gainMom(a, opts.mom != null ? opts.mom : amt * 1.5);
      d.mom = clamp(d.mom - v * 0.25, 0, 100);
      if (a) a.lastHit = this.t;
      return v;
    }
    gainMom(w, v) {
      if (w.fin >= 1) { w.mom = clamp(w.mom + v * 0.5, 0, 100); return; }
      w.mom += v;
      if (w.mom >= 100) {
        w.mom = 0; w.fin = 1;
        this.pop(w.x, w.y, 2.3, 'FINISHER READY', '#ffd34a');
        this.say(`${w.short} has a finisher stored!`, 'gold');
        BW.Audio.pop(0.5);
      }
    }
    downTime(d, extra) { return (0.9 + d.hurt() / 100 * 2.3 + (extra || 0)) * (d.human ? 1 : 1 / this.diff.getup) * (0.9 + rand() * 0.25); }

    knockdown(a, d, faceUp, extra) {
      if (a) d.facing = a.x < d.x ? -1 : 1; // face the attacker, fall away
      d.atk = null; d.lock = null; d.mv = null; d.getFrom = null; d.pickedBy = null;
      d.set('fall', 0.4);
      d.fallFrom = d.ang; d.fallTo = faceUp === false ? 90 : -90;
      if (faceUp === false) d.facing *= -1;
      d.vx = -d.facing * 2.4 * (faceUp === false ? -1 : 1);
      d.downT = this.downTime(d, extra);
    }

    /* ---------- attacks ---------- */
    startAttack(w, d, kind) {
      if (!this.canAct(w) && w.state !== 'whipA') return;
      const spec = {
        strike: { wind: 0.14, total: 0.36, rev: 0.22 },
        kick: { wind: 0.22, total: 0.5, rev: 0.24 },
        grapple: { wind: 0.2, total: 0.4, rev: 0.26 },
        standsub: { wind: 0.22, total: 0.42, rev: 0.26 },
      }[kind];
      if (kind === 'strike') {
        if (this.t - w.lastStrike < 0.55) w.combo = (w.combo + 1) % 3; else w.combo = 0;
        w.lastStrike = this.t;
      }
      w.atk = { kind, def: d, wind: spec.wind, resolved: false, reversed: false };
      w.set('atk', spec.total);
      w.vx = 0; w.vy = 0;
      if (d && this.inFront(w, d, kind === 'kick' ? 1.35 : 1.15) && this.hittable(d)) this.openReversal(w, d, spec.rev);
      if (kind !== 'grapple' && kind !== 'standsub') BW.Audio.whoosh();
    }

    openReversal(a, d, win, mult) {
      if (d.human) { d.revWin = win + (this.opts.assist ? 0.12 : 0); d.revBy = a; d.revReady = d.revLock <= 0; }
      else {
        const p = this.cpuRevChance(d, mult || 1);
        if (rand() < p && d.state !== 'down') { a.atk ? (a.atk.reversed = true) : null; if (a.pendingMove) a.pendingMove.reversed = true; }
      }
    }
    cpuRevChance(d, mult) {
      if (['down', 'fall', 'getup', 'pinD', 'subD', 'moveD', 'perch', 'climb', 'pinA', 'subA'].includes(d.state)) return 0;
      const base = this.diff.rev * (0.6 + d.skill * 0.5) * (1 - d.hurt() / 160) * (d.state === 'stun' ? 0.35 : 1);
      return clamp(base * mult, 0, 0.75);
    }
    tryReverse(w) {
      if (w.revWin > 0 && w.revReady && w.revBy) {
        const a = w.revBy;
        if (a.atk && !a.atk.resolved) a.atk.reversed = true;
        if (a.pendingMove) a.pendingMove.reversed = true;
        w.revWin = 0;
      } else if (w.revLock <= 0) {
        w.revLock = 0.4; w.revReady = false;
      }
    }

    resolveAttack(w) {
      const k = w.atk; if (!k || k.resolved) return;
      k.resolved = true;
      const d = k.def;
      if (d) d.revWin = 0;
      if (k.reversed && d && this.hittable(d) && d.state !== 'down') return this.doReversal(d, w, k.kind);
      if (k.kind === 'strike' || k.kind === 'kick') {
        const tgt = d && this.inFront(w, d, k.kind === 'kick' ? 1.35 : 1.15) && this.strikeable(d) ? d : this.opponents(w).find((o) => this.inFront(w, o, 1.15) && this.strikeable(o));
        if (!tgt) return;
        const kick = k.kind === 'kick';
        const part = kick ? (rand() < 0.5 ? 'body' : 'head') : (w.combo === 2 ? 'head' : pick(['head', 'body', 'arms']));
        this.damage(w, tgt, kick ? 5.5 : 3.2, part, { mom: kick ? 7 : 4.5 });
        this.stats.moves.add(kick ? w.ms.kick : w.ms.strike);
        BW.Audio.hit(kick ? 1.1 : 0.8);
        this.spark(tgt, 1.35);
        const kd = kick ? 0.32 + tgt.hurt() / 200 : (w.combo === 2 ? 0.45 + tgt.hurt() / 180 : 0);
        if (tgt.state === 'pinA') { this.breakPin('save'); this.say(`${w.short} breaks up the pin!`, 'gold'); this.stats.nearfalls++; }
        if (tgt.state === 'subA') { this.endSub(false); this.say(`${w.short} breaks the hold!`); }
        if (tgt.state === 'perch' || tgt.state === 'climb') { this.say(`${w.short} knocks ${tgt.short} off the top!`); this.knockdown(w, tgt, true, 0.8); tgt.z = 0; return; }
        if (rand() < kd) { this.knockdown(w, tgt, true); this.say(`${w.short} drops ${tgt.short} with a ${kick ? w.ms.kick : w.ms.strike}!`); }
        else { tgt.atk = null; tgt.set('hit', 0.3); tgt.vx = w.facing * 1.4; this.faceTo(tgt, w); }
      } else if (k.kind === 'grapple' || k.kind === 'standsub') {
        if (!d || !this.inFront(w, d, 1.2, 0.5) || !this.hittable(d)) return;
        if (k.kind === 'standsub') return this.startSub(w, d, w.ms.sub, false, null, true);
        const rear = d.facing === w.facing;
        if (rear) return this.beginMove(w, d, w.ms.rear, { rear: true });
        this.faceTo(d, w); d.facing = -w.facing;
        d.x = w.x + w.facing * 0.75; d.y = w.y;
        w.lock = { def: d }; d.lock = { by: w };
        w.set('lockA', 1.5); d.set('lockD', 1.5); d.atk = null;
        w.ai.lockT = (0.25 + rand() * 0.45) * (this.diff.react / 0.4);
        BW.Audio.hit(0.4);
      }
    }

    doReversal(d, a, kind) {
      this.stats.reversals++;
      this.gainMom(d, 8);
      a.mom = clamp(a.mom - 4, 0, 100);
      this.faceTo(d, a);
      a.atk = null; a.pendingMove = null;
      this.pop(d.x, d.y, 2.1, 'REVERSAL', '#7fe3ff');
      BW.Audio.pop(0.25);
      if (kind === 'grapple' || kind === 'standsub') {
        if (rand() < 0.5) { a.set('stun', 0.7); d.set('idle'); a.vx = d.facing * 2; this.say(`${d.short} breaks the hold and shoves ${a.short} away.`); }
        else { this.beginMove(d, a, d.ms.reversal, { reversal: true }); this.say(`${d.short} reverses into a ${d.ms.reversal.name}!`); }
      } else if (kind === 'run' || kind === 'rebound') {
        this.beginMove(d, a, d.ms.reversal, { reversal: true }); this.say(`${d.short} counters with a ${d.ms.reversal.name}!`);
      } else if (kind === 'move' || kind === 'special') {
        this.beginMove(d, a, d.ms.reversal, { reversal: true });
        this.say(kind === 'special' ? `${d.short} escapes the finisher and hits a ${d.ms.reversal.name}!` : `${d.short} reverses it!`, kind === 'special' ? 'gold' : '');
        if (kind === 'special') this.stats.bigMoves++;
      } else {
        // strike/kick: block and counter punch
        d.set('counter', 0.32); d.atk = null;
        BW.Audio.hit(0.7);
        this.damage(d, a, 3.5, 'head', { mom: 2 });
        if (kind === 'kick' && rand() < 0.5) { this.knockdown(d, a, true); this.say(`${d.short} catches the kick and sweeps ${a.short} down!`); }
        else { a.set('hit', 0.35); a.vx = d.facing * 1.5; this.say(`${d.short} blocks and fires back.`); }
      }
    }

    lockMove(w, d, move, tier, direct) {
      if (!move) return;
      w.pendingMove = { move, tier, reversed: false, t: 0, wind: tier === 'strong' ? 0.32 : 0.22, def: d };
      if (!direct) { w.set('lockA', 2); }
      this.openReversal(w, d, tier === 'strong' ? 0.3 : 0.24, tier === 'strong' ? 1.2 : 0.8);
      w.lockCommit = true;
    }

    whip(w, d, noRev) {
      w.lock = null; d.lock = null; w.pendingMove = null;
      if (!noRev && !d.human && rand() < this.cpuRevChance(d, 0.5)) {
        this.say(`${d.short} reverses the Irish whip!`);
        this.stats.reversals++;
        return this.whip(d, w, true);
      }
      d.set('whipped'); d.whip = { phase: 'out', dir: w.facing, t: 0 };
      d.facing = w.facing; d.ang = 0;
      w.set('whipA'); w.whipTarget = d;
      BW.Audio.whoosh();
      this.say(`${w.short} sends ${d.short} into the ropes.`);
    }

    reboundAttack(w, d, kind) {
      w.whipTarget = null;
      this.faceTo(w, d);
      if (kind === 'grapple' && this.dist(w, d) < 1.7) {
        w.pendingMove = null;
        const rev = !d.human && rand() < this.cpuRevChance(d, 0.6);
        if (rev) return this.doReversal(d, w, 'rebound');
        return this.beginMove(w, d, w.ms.catch, {});
      }
      w.atk = { kind: 'rebound', def: d, wind: 0.12, resolved: false, reversed: false };
      w.set('rebound', 0.5);
      this.openReversal(w, d, 0.22, 0.6);
    }

    runAttack(w, kind) {
      const move = kind === 'grapple' ? w.ms.catch : w.ms.run;
      w.atk = { kind: 'run', grapple: kind === 'grapple', move, resolved: false, reversed: false, hitDone: false };
      w.set('runatk', 0.6);
      const d = this.nearestOpp(w, 3);
      if (d && this.inFront(w, d, 3, 0.5)) this.openReversal(w, d, 0.24, 0.7);
      w.atk.def = d;
    }

    groundAttack(w, d) {
      const hd = d.headDir();
      const nearHead = Math.abs(w.x - (d.x + hd * 0.7)) < Math.abs(w.x - (d.x - hd * 0.7));
      const move = nearHead ? w.ms.ground.head : w.ms.ground.legs;
      w.gatk = { def: d, move, hit: false };
      this.faceTo(w, d);
      const T = { stomp: 0.55, gpunch: 0.8, elbowdrop: 0.85, kneedrop: 0.85 }[move.anim] || 0.6;
      w.set('gatk', T);
    }

    groundSub(w, d) {
      if (d.state !== 'down') return;
      this.startSub(w, d, w.ms.groundSub, false);
    }

    pickUp(w, d) {
      this.faceTo(w, d);
      w.set('pickup', 0.45);
      d.set('getup', 0.45); d.pickedBy = w; d.downT = 0; d.getFrom = d.ang;
      this.say(`${w.short} drags ${d.short} to their feet.`);
    }

    climb(w, c) {
      const others = this.opponents(w).filter((o) => o.state !== 'down');
      if (others.some((o) => this.dist(o, w) < 0.9)) return;
      w.corner = c;
      w.set('climb', 0.7);
      w.x = c[0]; w.y = c[1];
      w.facing = c[0] > 0 ? -1 : 1;
    }

    taunt(w) {
      w.set('taunt', 1.3);
      BW.Audio.pop(0.3);
      w.tauntGain = true;
    }

    tryTag(w) {
      const p = w.partner;
      if (!p || p.state !== 'apron' || w.tagT > 0) return;
      w.set('exitRing', 0.6); w.active = false;
      p.active = true; p.set('enterRing', 0.6);
      const c = this.cornerOf(w.team);
      p.enterFrom = { x: p.x, y: p.y }; p.enterTo = { x: c.x + (w.team === 0 ? 0.6 : -0.6), y: c.y + 0.4 };
      w.exitFrom = { x: w.x, y: w.y };
      p.human = w.human; p.input = w.input; w.human = 0; w.input = null;
      p.tagT = 4;
      this.say(`${w.short} makes the tag to ${p.short}!`, 'gold');
      BW.Audio.slap(); BW.Audio.pop(0.6);
      this.stats.moves.add('Tag');
    }

    /* ---------- specials ---------- */
    special(w) {
      const choice = this.pickSpecial(w);
      if (!choice) { if (w.human) this.pop(w.x, w.y, 2.2, w.fin ? 'NOT HERE' : 'NEED MOMENTUM', '#aab'); return false; }
      const { move, isFin, ctx, target } = choice;
      if (isFin) w.fin = 0; else w.mom -= 50;
      const tag = { special: true, isFin, isSig: !isFin };
      if (ctx === 'dive') { this.startDive(w, move, true, target, tag); return true; }
      if (ctx === 'sub') { this.startSub(w, target, move, true, tag); return true; }
      if (ctx === 'strike' || ctx === 'running') {
        this.faceTo(w, target);
        w.atk = { kind: 'specialStrike', def: target, move, running: ctx === 'running', resolved: false, reversed: false, tag };
        w.set('specialStrike', ctx === 'running' ? 0.75 : 0.6);
        this.openReversal(w, target, 0.2, 0.55);
        this.showBanner(move.name, isFin ? '#ffd34a' : '#7fe3ff');
        return true;
      }
      // grapple finisher
      this.faceTo(w, target);
      if (w.state !== 'lockA') { target.facing = -w.facing; target.x = w.x + w.facing * 0.75; target.y = w.y; target.atk = null; target.set('lockD', 2); target.lock = { by: w }; w.lock = { def: target }; }
      w.pendingMove = { move, tier: 'special', reversed: false, t: 0, wind: 0.34, def: target, tag };
      w.set('lockA', 2);
      this.openReversal(w, target, 0.2, 0.55);
      return true;
    }

    pickSpecial(w) {
      const opts = [];
      if (w.fin > 0) opts.push({ m: w.spec.finisher, isFin: true });
      if (w.mom >= 50) opts.push({ m: w.spec.signature, isFin: false });
      for (const o of opts) {
        const m = o.m; if (!m) continue;
        const kind = KIND[m.anim];
        const move = { name: m.name, anim: m.anim, dmg: o.isFin ? 24 : 15, part: kind === 'sub' ? ({ sub_leg: 'legs', sub_arm: 'arms', sub_neck: 'head', sub_back: 'body' })[m.anim] : 'head' };
        if (w.state === 'perch') { if (kind === 'dive') return { move, isFin: o.isFin, ctx: 'dive', target: this.nearestOppAny(w, 4.5) }; continue; }
        if (kind === 'dive' || kind === 'sub' || kind === 'ground') {
          const d = this.nearestDowned(w, kind === 'dive' ? 2.8 : 1.6);
          if (d) return { move, isFin: o.isFin, ctx: kind === 'dive' ? 'dive' : 'sub', target: d };
          continue;
        }
        const t = this.nearestOpp(w, kind === 'running' ? 3.6 : kind === 'strike' ? 1.7 : 1.4);
        if (!t || !t.standing()) continue;
        if (kind === 'strike' || kind === 'running') return { move, isFin: o.isFin, ctx: kind, target: t };
        if (kind === 'grapple' || kind === 'standsub') {
          if (w.state === 'lockA' && w.lock && w.lock.def) return { move, isFin: o.isFin, ctx: 'grapple', target: w.lock.def };
          return { move, isFin: o.isFin, ctx: 'grapple', target: t };
        }
      }
      return null;
    }
    nearestOppAny(w, range) {
      let best = null, bd = range;
      for (const o of this.opponents(w)) { const d = this.dist(w, o); if (d < bd) { bd = d; best = o; } }
      return best;
    }

    /* ---------- keyframed grapple moves ---------- */
    beginMove(a, d, move, o) {
      o = o || {};
      const anim = G[move.anim] ? move.anim : 'slam';
      const A = G[anim];
      if (A.toSub) { return this.startSub(a, d, move, false, o.tag, true); }
      a.lock = null; d.lock = null; a.atk = null; d.atk = null; a.pendingMove = null; d.pendingMove = null;
      const rear = o.rear || A.rear;
      d.facing = rear ? a.facing : -a.facing;
      a.mv = { move, anim, A, t: 0, def: d, x0: a.x, y0: a.y, f: a.facing, hit: false, tag: o.tag || {}, reversal: o.reversal };
      d.mv = { by: a };
      a.set('moveA', A.T); d.set('moveD', A.T);
      if (o.tag && o.tag.special) this.showBanner(move.name, o.tag.isFin ? '#ffd34a' : '#7fe3ff');
      this.stats.moves.add(move.name);
    }

    stepMove(a, dt) {
      const mv = a.mv; if (!mv) return a.set('idle');
      const d = mv.def;
      const A = mv.A;
      const sp = mv.tag.isFin ? 0.85 : 1;
      mv.t += dt * sp;
      const f = clamp(mv.t / A.T, 0, 1);
      const dk = sample(A.d, f);
      const ak = A.ad ? sample(A.ad, f) : [0, 0, 0];
      a.x = mv.x0 + mv.f * ak[0]; a.y = mv.y0; a.z = ak[1]; a.ang = ak[2];
      d.x = mv.x0 + mv.f * dk[0]; d.y = mv.y0 + 0.02; d.z = dk[1]; d.ang = dk[2];
      a.poseName = samplePose(A.a, f);
      d.poseName = d.ang === 0 ? 'stun' : 'lying';
      if (!mv.hit && f >= A.hit) {
        mv.hit = true;
        const big = mv.tag.special;
        const amt = mv.move.dmg || 8;
        this.damage(a, d, amt, mv.move.part, { mom: big ? 0 : amt * 1.6 });
        const pow = big ? 1.5 : amt > 11 ? 1.1 : 0.85;
        BW.Audio.slam(pow);
        this.shake = big ? 14 : amt > 11 ? 8 : 5;
        this.dust(d, big ? 22 : 12);
        if (big) {
          this.stats[mv.tag.isFin ? 'finishers' : 'signatures']++;
          BW.Audio.pop(mv.tag.isFin ? 1 : 0.7);
          d.lastBig = { t: this.t, fin: !!mv.tag.isFin };
          this.say(`${a.short} hits the ${mv.move.name}!`, 'gold');
        } else {
          if (amt >= 12) BW.Audio.pop(0.4);
          this.say(`${a.short} with a ${mv.move.name}${mv.reversal ? ' out of nowhere' : ''}.`);
        }
      }
      if (f >= 1) {
        const endAng = norm(dk[2]);
        a.mv = null; d.mv = null;
        if (A.dEnd === 'stun') { d.ang = 0; d.z = 0; d.set('stun', 0.7 + rand() * 0.4); }
        else {
          d.ang = endAng; d.z = 0; d.set('down');
          d.downT = this.downTime(d, mv.tag.isFin ? 2.6 : mv.tag.special ? 1.4 : 0.3);
        }
        if (A.aDown) { a.ang = norm(ak[2]); a.set('down'); a.downT = A.aDown; }
        else { a.ang = 0; a.z = 0; a.set('idle'); }
      }
    }

    /* ---------- dives ---------- */
    startDive(w, move, special, target, tag) {
      const t = target || this.nearestOppAny(w, 4.5);
      let lx = w.x + w.facing * 2.2, ly = w.y;
      if (t && t.state !== 'apron') { lx = t.x; ly = t.y; this.faceTo(w, t); }
      lx = clamp(lx, -RING.W + 0.4, RING.W - 0.4); ly = clamp(ly, -RING.D + 0.3, RING.D - 0.3);
      const anim = DIVE[move.anim] ? move.anim : 'splash';
      w.dive = { move, anim, x0: w.x, y0: w.y, z0: w.z, x1: lx, y1: ly, target: t, tag: tag || {}, T: special ? 0.85 : 0.72 };
      w.set('dive', w.dive.T);
      if (tag && tag.special) this.showBanner(move.name, tag.isFin ? '#ffd34a' : '#7fe3ff');
      BW.Audio.whoosh(); BW.Audio.pop(0.35);
    }
    stepDive(w) {
      const dv = w.dive, f = clamp(w.st / dv.T, 0, 1);
      w.x = lerp(dv.x0, dv.x1, f); w.y = lerp(dv.y0, dv.y1, f);
      w.z = lerp(dv.z0, 0.12, f) + Math.sin(f * Math.PI) * 1.1;
      const D = DIVE[dv.anim];
      w.ang = D.end * clamp((f - 0.15) / 0.75, 0, 1);
      w.poseName = f < 0.15 ? 'perch' : D.pose;
      if (f >= 1) {
        w.z = 0; w.ang = norm(D.end);
        const t = dv.target;
        const hitIt = t && t.active && Math.abs(t.x - w.x) < 1.0 && Math.abs(t.y - w.y) < 0.55 && (t.state === 'down' || this.hittable(t));
        if (hitIt) {
          const big = dv.tag.special;
          this.damage(w, t, big ? dv.move.dmg : dv.move.dmg || 10, 'body', { mom: big ? 0 : 10 });
          BW.Audio.slam(big ? 1.4 : 1);
          this.shake = big ? 14 : 7; this.dust(t, 16);
          this.stats.moves.add(dv.move.name);
          if (big) { this.stats[dv.tag.isFin ? 'finishers' : 'signatures']++; BW.Audio.pop(1); t.lastBig = { t: this.t, fin: !!dv.tag.isFin }; this.say(`${w.short} connects with the ${dv.move.name}!`, 'gold'); }
          else { BW.Audio.pop(0.6); this.say(`${w.short} flies off the top with a ${dv.move.name}!`); }
          if (t.state !== 'down') { this.knockdown(w, t, true, big ? 2 : 0.6); }
          else t.downT = Math.max(t.downT, this.downTime(t, big ? 2.4 : 0.6));
          w.set('down'); w.downT = 0.45;
        } else {
          this.damage(null, w, 8, 'body');
          BW.Audio.slam(0.9); this.shake = 6; this.dust(w, 10);
          this.say(`${w.short} crashes and burns!`);
          BW.Audio.pop(0.4);
          w.set('down'); w.downT = this.downTime(w, 0.8);
        }
        w.dive = null;
      }
    }

    /* ---------- submissions ---------- */
    startSub(a, d, move, special, tag, standing) {
      a.lock = null; d.lock = null; a.pendingMove = null; a.atk = null; d.atk = null; d.mv = null; a.mv = null;
      const anim = move.anim;
      const part = move.part || ({ sub_leg: 'legs', sub_arm: 'arms', sub_neck: 'head', sub_back: 'body', bearhug: 'body' })[anim] || 'body';
      this.sub = { a, d, move, part, bar: 50, t: 0, standing: !!standing || anim === 'bearhug', tag: tag || {}, ropeT: 0 };
      if (anim === 'sub_back') { d.ang = 90; }
      a.set('subA'); d.set('subD');
      this.stats.moves.add(move.name);
      if (tag && tag.special) this.showBanner(move.name, tag.isFin ? '#ffd34a' : '#7fe3ff');
      this.say(`${a.short} locks in the ${move.name}!`, tag && tag.special ? 'gold' : '');
      BW.Audio.pop(tag && tag.special ? 0.8 : 0.3);
    }
    updateSub(dt) {
      const s = this.sub; if (!s) return;
      const { a, d } = s;
      if (a.state !== 'subA' || d.state !== 'subD') { this.endSub(false); return; }
      s.t += dt;
      // position the hold
      const hd = d.headDir();
      const anim = s.move.anim;
      if (s.standing) {
        d.x = a.x + a.facing * 0.5; d.y = a.y + 0.02; d.z = 0.25; d.ang = 0; d.facing = -a.facing;
        a.poseName = 'hug'; d.poseName = 'stun';
      } else {
        a.z = 0; d.z = 0;
        if (anim === 'sub_leg') { a.x = d.x - hd * 1.05; a.y = d.y + 0.03; a.facing = hd; a.poseName = 'sit'; a.ang = 0; }
        else if (anim === 'sub_neck') { a.x = d.x + hd * 0.9; a.y = d.y - 0.03; a.facing = -hd; a.poseName = 'hold'; }
        else if (anim === 'sub_arm') { a.x = d.x + hd * 0.25; a.y = d.y - 0.12; a.facing = hd; a.poseName = 'hold'; }
        else { a.x = d.x + hd * 0.1; a.y = d.y + 0.04; a.z = 0.18; a.facing = hd; a.poseName = 'hold'; }
        d.poseName = 'lyingHurt';
      }
      const special = s.tag.special;
      const partDmg = d.dmg[s.part] || 0;
      let push = (3 + partDmg * 0.11 + a.skill * 3) * (special ? (s.tag.isFin ? 2.2 : 1.6) : 1) * (this.subOnly ? 1.25 : 1);
      let resist = 5 + (100 - d.hurt()) * 0.1 + d.skill * 3;
      if (!a.human) push *= this.diff.sub;
      if (!d.human) resist *= this.diff.sub * (0.85 + rand() * 0.3);
      if (a.human) push *= 0.35; // humans earn it by mashing
      if (d.human) resist *= 0.35;
      s.bar += (push - resist) * dt;
      if (a.human && a.input) s.bar += a.input.mash * 2.6;
      if (d.human && d.input) s.bar -= d.input.mash * 2.6;
      d.dmg[s.part] = clamp(d.dmg[s.part] + dt * 2.5, 0, 100);
      if (s.t % 0.9 < dt) BW.Audio.pop(0.15);
      if (this.nearRopes(d) && !this.subOnly) {
        s.ropeT += dt;
        if (s.ropeT > 1.0) { this.say(`${d.short} gets to the ropes. The hold is broken!`); this.pop(d.x, d.y, 1.5, 'ROPE BREAK', '#fff'); return this.endSub(false); }
      }
      if (s.bar >= 100) {
        this.say(`${d.short} taps out!`, 'gold');
        this.endSub(true);
        return this.finish(a, 'submission');
      }
      if (s.bar <= 0 || s.t > 12) { this.say(`${d.short} fights out of the ${s.move.name}!`); this.stats.nearfalls += 0.5; return this.endSub(false); }
    }
    endSub(tapped) {
      const s = this.sub; if (!s) return;
      this.sub = null;
      const { a, d } = s;
      if (tapped) return;
      if (s.standing) { d.z = 0; d.set('stun', 0.5); a.set('stun', 0.6); a.vx = -a.facing * 1.4; }
      else {
        if (a.state === 'subA') { a.z = 0; a.ang = -80; a.set('down'); a.downT = 0.35; }
        if (d.state === 'subD') { d.set('down'); d.downT = 0.8 + d.hurt() / 100; }
      }
    }

    /* ---------- pins ---------- */
    startPin(a, d) {
      if (this.subOnly) { if (a.human) this.pop(a.x, a.y, 2.1, 'SUBMISSION ONLY', '#aab'); return; }
      if (d.state !== 'down' || this.pin) return;
      a.set('pinA'); d.set('pinD');
      const hd = d.headDir();
      a.x = d.x; a.y = d.y + 0.06; a.z = 0.16; a.facing = hd; a.ang = 90;
      this.pin = { a, d, count: 0, countT: 0, t: 0, refReady: false, kickAt: this.kickoutPlan(d, a), mini: d.human ? { pos: 0, dir: 1, zone: this.kickZone(d), lock: 0, tries: 0 } : null };
      this.say(`${a.short} goes for the cover!`);
    }
    kickZone(d) {
      const h = d.hurt() / 100;
      let z = 0.44 - h * 0.3;
      if (d.lastBig && this.t - d.lastBig.t < 6) z -= d.lastBig.fin ? 0.14 : 0.07;
      if (this.t < 45) z += 0.12;
      return clamp(z, 0.06, 0.5);
    }
    kickoutPlan(d, a) {
      if (d.human) return -1;
      const h = d.hurt() / 100;
      let p = 1.12 - h * 1.05 + d.mom / 1000;
      if (d.lastBig && this.t - d.lastBig.t < 6) p -= d.lastBig.fin ? 0.42 : 0.2;
      if (this.t < 45) p += 0.35;
      p = clamp(p * this.diff.kick, 0.03, 0.985);
      if (rand() >= p) return 0; // stays down
      return rand() < clamp(p - 0.25, 0.1, 0.8) ? 1 : 2;
    }
    updatePin(dt) {
      const p = this.pin; if (!p) return;
      const { a, d } = p;
      if (a.state !== 'pinA' || d.state !== 'pinD') return this.breakPin('broken');
      p.t += dt;
      a.poseName = 'cover'; d.poseName = 'lying';
      if (!p.refReady) {
        const tx = d.x - d.headDir() * 0.1, ty = d.y + 0.45;
        if (Math.hypot(this.ref.x - tx, this.ref.y - ty) < 0.25 || p.t > 1.4) { p.refReady = true; p.countT = 0; this.ref.x = tx; this.ref.y = ty; }
        return;
      }
      p.countT += dt;
      if (p.mini) {
        const m = p.mini;
        m.pos += m.dir * dt * 1.35;
        if (m.pos > 1) { m.pos = 1; m.dir = -1; } if (m.pos < 0) { m.pos = 0; m.dir = 1; }
        if (m.lock > 0) m.lock -= dt;
        if (d.input && d.input.mash && m.lock <= 0) {
          const zc = 0.5;
          if (Math.abs(m.pos - zc) < m.zone / 2) { return this.kickout(p); }
          m.lock = 0.35; m.tries++;
        }
      }
      const interval = 0.72;
      if (p.countT >= interval) {
        p.countT = 0; p.count++;
        BW.Audio.slap();
        this.ref.slap = 0.18;
        this.pop(this.ref.x, this.ref.y, 1.2, String(p.count), '#ffffff');
        if (p.count === 2 && this.nearRopes(d)) { this.say(`${d.short} gets a foot on the rope!`); this.pop(d.x, d.y, 1.6, 'ROPE BREAK', '#fff'); this.stats.nearfalls += 0.5; return this.breakPin('rope'); }
        if (p.kickAt === p.count) return this.kickout(p);
        if (p.count >= 3) { BW.Audio.pop(1); this.say(`ONE! TWO! THREE! ${a.short} gets the win!`, 'gold'); this.breakPin('done'); return this.finish(a, 'pinfall'); }
      }
      // tag partner save
      if (this.isTag && d.partner && d.partner.state === 'apron' && !d.partner.human && p.count >= 1 && !p.saveTried) {
        p.saveTried = true;
        if (rand() < this.diff.save * (d.partner.human ? 0 : 1)) { d.partner.set('save'); d.partner.saveTarget = a; d.partner.active = true; d.partner.z = 0; }
      }
    }
    kickout(p) {
      const { a, d } = p;
      if (p.count >= 2) { this.stats.nearfalls++; this.pop(d.x, d.y, 1.7, 'KICK OUT AT 2!', '#ffd34a'); BW.Audio.pop(0.9); if (d.lastBig && this.t - d.lastBig.t < 6 && d.lastBig.fin) this.stats.finKickouts++; }
      else { BW.Audio.pop(0.4); this.pop(d.x, d.y, 1.6, 'KICK OUT', '#fff'); }
      this.say(p.count >= 2 ? `${d.short} kicks out at two!` : `${d.short} kicks out at one.`);
      this.breakPin('kickout');
    }
    breakPin(why) {
      const p = this.pin; if (!p) return;
      this.pin = null;
      const { a, d } = p;
      if (why === 'done') return;
      if (a.state === 'pinA') { a.z = 0; a.ang = 0; a.set('stun', 0.35); a.vx = -a.facing * 1.4; }
      if (d.state === 'pinD') { d.set('down'); d.downT = why === 'kickout' ? 0.6 + d.hurt() / 120 : 0.6; }
      this.ref.state = 'roam';
    }

    finish(winner, method) {
      if (this.phase === 'over') return;
      this.phase = 'over'; this.phaseT = 0;
      BW.Audio.bell(3); BW.Audio.pop(1.2);
      const loserTeam = this.ws.filter((w) => (this.isTag ? w.team !== winner.team : w !== winner));
      this.result = {
        winner: winner.id, winnerName: winner.name, winners: this.ws.filter((w) => (this.isTag ? w.team === winner.team : w === winner)).map((w) => w.id),
        losers: loserTeam.map((w) => w.id), method, time: this.t, stars: 0, shown: false,
        humanWon: this.ws.some((w) => w.wasHuman && (this.isTag ? w.team === winner.team : w === winner)),
        humanInvolved: this.ws.some((w) => w.wasHuman),
      };
      this.result.stars = this.rateMatch();
      this.winnerW = winner;
      for (const w of this.ws) {
        if (w.state === 'apron') continue;
        const won = this.result.winners.includes(w.id);
        if (won && w.active) { w.z = 0; w.ang = 0; w.set('celebrate'); }
        else if (!won && ['pinD', 'subD', 'down', 'moveD'].includes(w.state)) { w.set('down'); w.downT = 99; }
        else if (!won && ['subA', 'pinA'].includes(w.state)) { w.z = 0; w.ang = 0; w.set('idle'); }
      }
    }

    rateMatch() {
      const s = this.stats, t = this.t;
      let r = 0.9;
      r += Math.min(1.1, s.moves.size * 0.07);
      r += Math.min(0.6, s.reversals * 0.05);
      r += Math.min(1.0, s.nearfalls * 0.3);
      r += Math.min(0.6, s.finKickouts * 0.35);
      r += Math.min(0.5, (s.finishers + s.signatures) * 0.12);
      r += Math.min(0.5, s.swings * 0.12);
      if (t < 60) r -= 1.2; else if (t < 120) r -= 0.4; else if (t > 240) r += 0.2;
      const winners = this.ws.filter((w) => this.result && this.result.winners.includes(w.id));
      const avgWin = winners.reduce((a, w) => a + w.hurt(), 0) / Math.max(1, winners.length);
      if (avgWin < 10) r -= 0.5; // a squash
      return clamp(Math.round(r * 4) / 4, 0.25, 5);
    }

    /* ---------- per-state stepping ---------- */
    step(w, dt) {
      const sp = w.stat.speed * (1 - w.dmg.legs * 0.003);
      switch (w.state) {
        case 'idle': w.vx *= 0.7; w.vy *= 0.7; break;
        case 'walk': w.vx = (w.ix || 0) * 2.3 * sp; w.vy = (w.iy || 0) * 1.5 * sp; w.walkPhase += dt * 9; break;
        case 'run': {
          const dx = w.autoRun > 0 ? w.facing : (w.ix || 0);
          w.vx = (dx || w.facing) * 4.8 * sp; w.vy = (w.iy || 0) * 1.6 * sp; w.walkPhase += dt * 13;
          if (w.ix && w.autoRun <= 0) w.facing = w.ix > 0 ? 1 : -1;
          if (Math.abs(w.x) > RING.W - 0.45 && Math.sign(w.vx) === Math.sign(w.x)) { w.facing = -Math.sign(w.x); w.autoRun = 0.6; BW.Audio.rope(); }
          if (w.autoRun > 0) w.autoRun -= dt;
          break;
        }
        case 'atk':
          w.vx *= 0.7; w.vy *= 0.7;
          if (w.atk && !w.atk.resolved && w.st >= w.atk.wind) this.resolveAttack(w);
          if (w.st >= w.dur && w.state === 'atk') { w.atk = null; w.set('idle'); }
          break;
        case 'counter': case 'pickup': case 'hit':
          w.vx *= 0.85;
          if (w.st >= w.dur) w.set(w.state === 'hit' && w.hurt() > 70 && rand() < 0.3 ? 'stun' : 'idle', 0.6);
          break;
        case 'stun': w.vx *= 0.85; w.vy = 0; if (w.st >= w.dur) w.set('idle'); break;
        case 'taunt':
          w.vx = 0; w.vy = 0;
          if (w.st >= w.dur) { if (w.tauntGain) { this.gainMom(w, 16); w.tauntGain = false; } w.set('idle'); }
          break;
        case 'lockA': {
          w.vx = 0; w.vy = 0;
          const d = w.lock ? w.lock.def : w.pendingMove ? w.pendingMove.def : null;
          if (!d || (d.state !== 'lockD' && d.state !== 'moveD')) { w.lock = null; w.pendingMove = null; w.set('idle'); break; }
          d.x = w.x + w.facing * 0.75; d.y = w.y + 0.01; d.facing = -w.facing;
          const pm = w.pendingMove;
          if (pm) {
            pm.t += dt;
            if (pm.t >= pm.wind) {
              d.revWin = 0;
              w.pendingMove = null;
              if (pm.reversed) { this.doReversal(d, w, pm.tier === 'special' ? 'special' : 'move'); break; }
              if (pm.tier === 'sub') { this.startSub(w, d, pm.move, false, null, true); break; }
              this.beginMove(w, d, pm.move, { tag: pm.tag });
            }
          } else if (w.st >= w.dur) {
            // the defender breaks free
            w.lock = null; d.lock = null;
            w.set('stun', 0.35); d.set('idle'); w.vx = -w.facing * 1.6;
          }
          break;
        }
        case 'lockD': if (!w.lock || !w.lock.by || w.lock.by.state !== 'lockA') { w.lock = null; w.set('idle'); } break;
        case 'moveA': this.stepMove(w, dt); break;
        case 'moveD': if (!w.mv || !w.mv.by || w.mv.by.state !== 'moveA') { w.mv = null; w.z = 0; w.set('down'); w.downT = 0.6; } break;
        case 'fall': {
          const f = clamp(w.st / w.dur, 0, 1);
          w.ang = lerp(w.fallFrom || 0, w.fallTo, easeOut(f));
          w.z = Math.max(0, w.z - dt * 3);
          w.vx *= 0.9;
          if (f >= 1) { w.ang = w.fallTo; w.z = 0; w.set('down'); BW.Audio.slam(0.6); this.dust(w, 6); }
          break;
        }
        case 'down':
          w.vx = 0; w.vy = 0; w.z = 0;
          w.downT -= dt;
          if (w.downT <= 0) { w.set('getup', 0.65); w.getFrom = w.ang; }
          break;
        case 'getup': {
          const f = clamp(w.st / w.dur, 0, 1);
          if (w.getFrom == null) w.getFrom = w.ang;
          w.ang = lerp(w.getFrom, 0, easeInOut(f));
          if (f >= 1) {
            w.ang = 0; w.getFrom = null;
            if (w.pickedBy) { w.pickedBy = null; w.set('stun', 0.8 + w.hurt() / 120); }
            else w.set('idle');
          }
          break;
        }
        case 'whipped': {
          const wp = w.whip; wp.t += dt;
          w.vx = w.facing * 5.6; w.vy = -w.y * 1.5;
          if (wp.phase === 'out' && Math.abs(w.x) > RING.W - 0.5 && Math.sign(w.x) === w.facing) { wp.phase = 'back'; wp.t = 0; w.facing = -w.facing; BW.Audio.rope(); }
          if (wp.phase === 'back' && (wp.t > 1.1 || Math.abs(w.x) > RING.W - 0.4 && Math.sign(w.x) === w.facing)) { w.whip = null; w.set('stun', 0.4); }
          break;
        }
        case 'whipA': w.vx = 0; w.vy = 0; if (w.st > 2.4 || !w.whipTarget || w.whipTarget.state !== 'whipped') { if (w.st > 0.3) { w.whipTarget = null; w.set('idle'); } } break;
        case 'rebound':
          if (w.atk && !w.atk.resolved && w.st >= w.atk.wind) {
            const d = w.atk.def;
            w.atk.resolved = true;
            if (d) d.revWin = 0;
            if (w.atk.reversed && d && d.state === 'whipped') { d.whip = null; d.set('idle'); this.doReversal(d, w, 'rebound'); break; }
            if (d && d.state === 'whipped' && this.inFront(w, d, 1.5, 0.6)) {
              const m = w.ms.rebound;
              this.damage(w, d, m.dmg, m.part); BW.Audio.hit(1.3); BW.Audio.pop(0.5); this.shake = 5;
              d.whip = null; this.knockdown(w, d, true, 0.4); this.stats.moves.add(m.name);
              this.say(`${w.short} levels ${d.short} with a ${m.name}!`);
            }
          }
          if (w.st >= w.dur && w.state === 'rebound') { w.atk = null; w.set('idle'); }
          break;
        case 'runatk': {
          const k = w.atk;
          w.vx = w.facing * (w.st < 0.4 ? 5.6 : 1) * w.stat.speed; w.vy = 0;
          if (k && !k.hitDone && w.st > 0.08 && w.st < 0.5) {
            const d = this.opponents(w).find((o) => this.inFront(w, o, 0.85, 0.5) && this.hittable(o));
            if (d) {
              k.hitDone = true; d.revWin = 0;
              if (k.reversed && d === k.def) { this.doReversal(d, w, 'run'); break; }
              if (k.grapple) { this.faceTo(d, w); this.beginMove(w, d, k.move, {}); break; }
              this.damage(w, d, k.move.dmg, k.move.part); BW.Audio.hit(1.2); this.shake = 5; this.stats.moves.add(k.move.name);
              this.knockdown(w, d, true, 0.3);
              this.say(`${w.short} connects with a ${k.move.name}.`);
              if (k.move.anim === 'dropkick') { w.set('down'); w.ang = -90; w.downT = 0.3; break; }
            }
          }
          if (w.st >= w.dur && w.state === 'runatk') {
            if (k && !k.hitDone && k.move.anim === 'dropkick') { w.ang = -90; w.set('down'); w.downT = 0.5; }
            else w.set('idle');
            w.atk = null;
          }
          break;
        }
        case 'specialStrike': {
          const k = w.atk;
          if (k.running) { w.vx = w.facing * (w.st < 0.45 ? 6.4 : 0.6); }
          else w.vx = 0;
          const reach = k.running ? 0.9 : 1.45;
          const ready = k.running ? w.st > 0.1 && w.st < 0.55 : w.st >= 0.26;
          if (!k.resolved && ready) {
            const d = k.def;
            const inR = d && this.inFront(w, d, reach, 0.55) && (this.hittable(d) || d.state === 'down');
            if (inR || (!k.running && w.st >= 0.26)) {
              k.resolved = true; if (d) d.revWin = 0;
              if (k.reversed && d && this.hittable(d)) { this.doReversal(d, w, 'special'); break; }
              if (inR) {
                this.damage(w, d, k.move.dmg, 'head', { mom: 0 });
                this.stats[k.tag.isFin ? 'finishers' : 'signatures']++; this.stats.moves.add(k.move.name);
                d.lastBig = { t: this.t, fin: !!k.tag.isFin };
                BW.Audio.hit(1.6); BW.Audio.slam(1.1); BW.Audio.pop(1); this.shake = 13; this.spark(d, 1.4); this.dust(d, 14);
                this.knockdown(w, d, true, k.tag.isFin ? 2.6 : 1.4);
                this.say(`${w.short} nails the ${k.move.name}!`, 'gold');
                if (k.move.anim === 'spear') { w.set('down'); w.ang = 90; w.downT = 0.35; break; }
              } else { this.say(`${w.short} misses the ${k.move.name}!`); }
            }
          }
          if (w.st >= w.dur && w.state === 'specialStrike') { if (!k.resolved) this.say(`${w.short} misses the ${k.move.name}!`); w.atk = null; w.set('idle'); }
          break;
        }
        case 'gatk': {
          const g = w.gatk, d = g.def;
          const hitAt = { stomp: 0.28, gpunch: 0.32, elbowdrop: 0.5, kneedrop: 0.5 }[g.move.anim] || 0.3;
          if (g.move.anim === 'elbowdrop' || g.move.anim === 'kneedrop') {
            const f = clamp(w.st / hitAt, 0, 1);
            if (!g.hit) { w.z = Math.sin(f * Math.PI * 0.9) * 0.55; w.ang = f > 0.5 ? (f - 0.5) * 2 * 90 : 0; w.x = lerp(w.x, d.x, 0.15); w.y = lerp(w.y, d.y + 0.03, 0.15); }
          }
          if (!g.hit && w.st >= hitAt) {
            g.hit = true;
            if (d.state === 'down') {
              this.damage(w, d, g.move.dmg, g.move.part); BW.Audio.hit(1); this.shake = 3; this.stats.moves.add(g.move.name);
              d.downT += 0.35; d.flash = 1;
              if (g.move.anim === 'gpunch') this.say(`${w.short} rains down punches.`);
            }
          }
          if (w.st >= w.dur) {
            if (g.move.anim === 'elbowdrop' || g.move.anim === 'kneedrop') { w.z = 0; w.set('down'); w.ang = 90; w.downT = 0.15; }
            else w.set('idle');
            w.gatk = null;
          }
          break;
        }
        case 'climb': w.z = clamp(w.st / w.dur, 0, 1) * 1.18; if (w.st >= w.dur) { w.set('perch'); w.z = 1.18; this.say(`${w.short} heads up top!`); BW.Audio.pop(0.4); } break;
        case 'perch': w.z = 1.18; if (w.st > 4 && !w.human) w.set('climbdown', 0.35); break;
        case 'climbdown': w.z = (1 - clamp(w.st / w.dur, 0, 1)) * 1.18; if (w.st >= w.dur) { w.z = 0; w.x *= 0.9; w.set('idle'); } break;
        case 'dive': this.stepDive(w); break;
        case 'exitRing': {
          const f = clamp(w.st / w.dur, 0, 1);
          const sp2 = { x: w.team === 0 ? -(RING.W + 0.55) : RING.W + 0.55, y: -RING.D + 0.35 };
          w.x = lerp(w.exitFrom.x, sp2.x, f); w.y = lerp(w.exitFrom.y, sp2.y, f); w.z = Math.sin(f * Math.PI) * 0.6 + f * 0.35;
          if (f >= 1) { this.toApron(w); w.tagT = 4; }
          break;
        }
        case 'enterRing': {
          const f = clamp(w.st / w.dur, 0, 1);
          w.x = lerp(w.enterFrom.x, w.enterTo.x, f); w.y = lerp(w.enterFrom.y, w.enterTo.y, f); w.z = Math.sin(f * Math.PI) * 0.6 + (1 - f) * 0.35;
          if (f >= 1) { w.z = 0; w.set('idle'); }
          break;
        }
        case 'apron': w.tagT -= dt; w.z = 0.35; break;
        case 'save': {
          const t = w.saveTarget;
          if (!t || this.phase !== 'live') { w.set('returnApron'); break; }
          const dx = t.x - w.x, dy = t.y - w.y;
          w.facing = dx > 0 ? 1 : -1; w.z = Math.max(0, w.z - dt * 2);
          w.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 6); w.y += Math.sign(dy) * Math.min(Math.abs(dy), dt * 3);
          if (Math.abs(dx) < 0.8 && Math.abs(dy) < 0.4) {
            if (t.state === 'pinA') { this.breakPin('save'); this.damage(w, t, 4, 'head'); this.knockdown(w, t, true, 0.2); this.say(`${w.short} breaks up the pin!`, 'gold'); BW.Audio.pop(0.8); this.stats.nearfalls++; }
            w.set('returnApron');
          }
          if (w.st > 2.5) w.set('returnApron');
          break;
        }
        case 'returnApron': {
          const sx = w.team === 0 ? -(RING.W + 0.55) : RING.W + 0.55, sy = -RING.D + 0.35;
          const dx = sx - w.x, dy = sy - w.y;
          w.facing = dx > 0 ? 1 : -1;
          w.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 5); w.y += Math.sign(dy) * Math.min(Math.abs(dy), dt * 3);
          if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) this.toApron(w);
          break;
        }
        case 'celebrate': w.vx = 0; w.vy = 0; break;
        default: break;
      }
      if (w.tagT > 0 && w.state !== 'apron') w.tagT -= dt;
      // integrate free movement
      const free = ['idle', 'walk', 'run', 'hit', 'stun', 'atk', 'fall', 'counter', 'whipped', 'runatk', 'specialStrike', 'rebound', 'taunt'].includes(w.state);
      if (free) {
        w.x += w.vx * dt; w.y += w.vy * dt;
        const mx = RING.W - 0.38, my = RING.D - 0.28;
        if (w.active) { w.x = clamp(w.x, -mx, mx); w.y = clamp(w.y, -my, my); }
      }
    }

    separate() {
      const solid = (w) => w.active && ['idle', 'walk', 'run', 'hit', 'stun', 'atk', 'taunt', 'counter', 'rebound', 'whipA'].includes(w.state);
      const list = this.ws.filter(solid);
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = (b.y - a.y) * 1.8;
        const d = Math.hypot(dx, dy);
        if (d < 0.55 && d > 0.0001) {
          const push = (0.55 - d) / 2;
          a.x -= dx / d * push; b.x += dx / d * push;
          a.y -= dy / d * push * 0.3; b.y += dy / d * push * 0.3;
        } else if (d <= 0.0001) { a.x -= 0.1; b.x += 0.1; }
      }
    }

    /* ---------- referee ---------- */
    updateRef(dt) {
      const r = this.ref;
      if (r.slap > 0) r.slap -= dt;
      let tx, ty;
      if (this.pin) {
        const d = this.pin.d;
        tx = d.x - d.headDir() * 0.1; ty = d.y + 0.45;
        r.poseName = this.pin.refReady ? (r.slap > 0 ? 'refSlap' : 'refCount') : 'stand';
        r.facing = -d.headDir();
        const sp = 7;
        r.x += clamp(tx - r.x, -sp * dt, sp * dt); r.y += clamp(ty - r.y, -sp * dt * 0.6, sp * dt * 0.6);
        return;
      }
      if (this.phase === 'over' && this.winnerW) {
        const w = this.winnerW;
        tx = w.x - w.facing * 0.7; ty = w.y + 0.12;
        r.poseName = this.phaseT > 0.8 ? 'refRaise' : 'stand'; r.facing = w.facing;
      } else if (this.sub) {
        tx = this.sub.d.x + 0.9; ty = this.sub.d.y + 0.35; r.poseName = 'refPoint'; r.facing = -1;
      } else {
        const act = this.actives;
        const cx = act.reduce((s, w) => s + w.x, 0) / Math.max(1, act.length);
        const cy = act.reduce((s, w) => s + w.y, 0) / Math.max(1, act.length);
        tx = clamp(cx + (cx > 0 ? -1.9 : 1.9), -RING.W + 0.6, RING.W - 0.6);
        ty = clamp(cy - 1.0, -RING.D + 0.4, RING.D - 0.4);
        if (Math.abs(tx - r.x) < 0.6 && Math.abs(ty - r.y) < 0.4) { tx = r.x; ty = r.y; }
        r.poseName = 'stand'; r.facing = cx > r.x ? 1 : -1;
      }
      const sp = 2.2;
      const dx = tx - r.x, dy = ty - r.y;
      r.x += clamp(dx, -sp * dt, sp * dt); r.y += clamp(dy, -sp * dt * 0.7, sp * dt * 0.7);
      r.moving = Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05;
      if (r.moving && r.poseName === 'stand') { r.walkPhase = (r.walkPhase || 0) + dt * 8; }
    }

    /* ---------- pose animation ---------- */
    animate(w, dt) {
      let target = null;
      switch (w.state) {
        case 'walk': target = BW.walkPose(w.walkPhase, false); break;
        case 'run': target = BW.walkPose(w.walkPhase, true); break;
        case 'idle': target = POSES.idle; break;
        case 'atk': {
          const k = w.atk; if (!k) { target = POSES.idle; break; }
          if (k.kind === 'strike') target = w.st < k.wind * 0.8 ? POSES.windup : POSES.punch;
          else if (k.kind === 'kick') target = w.st < k.wind * 0.7 ? POSES.idle : POSES.kick;
          else target = POSES.lockup;
          break;
        }
        case 'counter': target = w.st < 0.12 ? POSES.block : POSES.punch; break;
        case 'hit': target = POSES.hit; break;
        case 'stun': target = POSES.stun; w.ang = Math.sin(this.t * 4) * 3; break;
        case 'taunt': target = (this.t % 1.2) < 0.6 ? POSES.taunt : POSES.flex; break;
        case 'celebrate': target = (this.t % 1.4) < 0.7 ? POSES.taunt : POSES.flex; break;
        case 'lockA': target = w.pendingMove && w.pendingMove.tier === 'special' ? POSES.lockup : POSES.lockup; break;
        case 'lockD': target = POSES.lockup; break;
        case 'moveA': case 'moveD': case 'subA': case 'subD': case 'pinA': case 'pinD': target = POSES[w.poseName] || POSES.lying; break;
        case 'fall': case 'down': target = POSES.lying; break;
        case 'getup': target = w.st / w.dur < 0.6 ? POSES.kneel : POSES.stun; break;
        case 'whipped': target = BW.walkPose(this.t * 13, true); break;
        case 'whipA': target = POSES.idle; break;
        case 'rebound': target = w.st < 0.12 ? POSES.windup : (w.ms.rebound.anim === 'clothesline' ? POSES.clothesline : POSES.kick); break;
        case 'runatk': {
          const a = w.atk && w.atk.move.anim;
          target = a === 'dropkick' ? POSES.dropkick : a === 'tackle' ? POSES.spear : POSES.clothesline;
          if (a === 'dropkick' && w.st > 0.1) { w.ang = Math.min(-0, -60 * clamp((w.st - 0.1) / 0.2, 0, 1)); w.z = Math.sin(clamp(w.st / 0.5, 0, 1) * Math.PI) * 0.5; }
          break;
        }
        case 'specialStrike': {
          const a = w.atk && w.atk.move.anim;
          const pre = w.st < 0.2;
          target = a === 'superkick' ? (pre ? POSES.idle : POSES.highkick) : a === 'roundhouse' ? (pre ? POSES.windup : POSES.highkick) : a === 'knee' ? (pre ? POSES.idle : POSES.kneeup) : a === 'spear' ? POSES.spear : POSES.clothesline;
          if (a === 'knee' && !pre) w.z = Math.sin(clamp((w.st - 0.2) / 0.35, 0, 1) * Math.PI) * 0.35;
          break;
        }
        case 'gatk': {
          const a = w.gatk && w.gatk.move.anim;
          if (a === 'stomp') target = w.st < 0.2 ? POSES.stompUp : POSES.stomp;
          else if (a === 'gpunch') target = (w.st % 0.32) < 0.16 ? POSES.gpunch : POSES.hold;
          else target = POSES.fly;
          break;
        }
        case 'pickup': target = POSES.slamdown; break;
        case 'climb': target = POSES.climb; break;
        case 'perch': target = POSES.perch; break;
        case 'climbdown': target = POSES.climb; break;
        case 'dive': target = POSES[w.poseName] || POSES.fly; break;
        case 'apron': target = POSES.apron; break;
        case 'exitRing': case 'enterRing': target = POSES.climb; break;
        case 'save': case 'returnApron': target = BW.walkPose(this.t * 13, true); break;
        default: target = POSES.idle;
      }
      const k = clamp(dt * 16, 0, 1);
      for (const key of KEYS) w.pose[key] = lerp(w.pose[key], target[key], k);
      if (!['stun', 'moveA', 'moveD', 'fall', 'down', 'getup', 'pinA', 'pinD', 'subA', 'subD', 'dive', 'gatk', 'runatk', 'specialStrike'].includes(w.state)) {
        w.ang = lerp(w.ang, 0, k); if (!['climb', 'perch', 'climbdown', 'apron', 'exitRing', 'enterRing'].includes(w.state)) w.z = lerp(w.z, 0, k);
      }
      // referee
      const r = this.ref;
      const rt = r.moving && r.poseName === 'stand' ? BW.walkPose(r.walkPhase, false) : POSES[r.poseName] || POSES.stand;
      for (const key of KEYS) r.pose[key] = lerp(r.pose[key], rt[key], k);
    }

    /* ---------- effects ---------- */
    spark(d, z) {
      for (let i = 0; i < 7; i++) this.fx.push({ x: d.x, y: d.y + 0.01, z: z + rand() * 0.2, vx: (rand() - 0.5) * 3, vz: rand() * 2, t: 0, life: 0.25, kind: 'spark' });
    }
    dust(d, n) {
      for (let i = 0; i < n; i++) this.fx.push({ x: d.x + (rand() - 0.5) * 1.4, y: d.y + (rand() - 0.5) * 0.2, z: 0.05, vx: (rand() - 0.5) * 2.4, vz: rand() * 1.2, t: 0, life: 0.5 + rand() * 0.3, kind: 'dust' });
      for (let i = 0; i < n / 2; i++) this.flashes.push({ x: rand() * BW.VIEW.w, y: 120 + rand() * 180, t: 0 });
    }
    updateFx(dt) {
      for (const f of this.fx) { f.t += dt; f.x += f.vx * dt; f.z += f.vz * dt; f.vz -= 6 * dt; if (f.z < 0) f.z = 0; }
      this.fx = this.fx.filter((f) => f.t < f.life);
      for (const t of this.texts) { t.t += dt; t.z += dt * 0.5; }
      this.texts = this.texts.filter((t) => t.t < 1.3);
      for (const f of this.feed) f.t += dt;
      this.feed = this.feed.filter((f) => f.t < 7);
      if (this.banner) { this.banner.t += dt; if (this.banner.t > 1.8) this.banner = null; }
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 40);
      for (const f of this.flashes) f.t += dt;
      this.flashes = this.flashes.filter((f) => f.t < 0.12);
      if (rand() < dt * 3) this.flashes.push({ x: rand() * BW.VIEW.w, y: 120 + rand() * 180, t: 0 });
    }

    /* ---------- AI ---------- */
    // CPU saves momentum for the finisher; a signature only comes out once the opponent is worn down.
    aiWantsSpecial(w, d) {
      if (w.fin > 0) return d.hurt() > 25 || this.t > 90;
      return w.mom >= 50 && d.hurt() > 40 && rand() < 0.5;
    }
    aiControl(w, dt) {
      const ai = w.ai;
      if (w.state === 'apron') return;
      if (w.state === 'down') { w.downT -= dt * 0.15 * this.diff.getup; return; }
      if (w.state === 'run' && w.aiRun) return this.aiMove(w, dt);
      if (w.state === 'lockA') {
        if (w.pendingMove) return;
        ai.lockT -= dt;
        if (ai.lockT > 0) return;
        const d = w.lock && w.lock.def; if (!d) return;
        if (rand() < 0.08 * this.diff.aggr) return;
        if (this.aiWantsSpecial(w, d) && rand() < 0.8) { if (this.special(w)) return; }
        const r = rand();
        const dirs = ['neutral', 'fwd', 'back', 'side'];
        const tech = w.spec.style === 'technician' ? 1.6 : 1;
        if (r < (this.subOnly ? 0.25 : 0.06) * tech) return this.lockMove(w, d, w.ms.sub, 'sub');
        if (r < 0.2) return this.whip(w, d);
        if (r < 0.2 + 0.35 + d.hurt() / 300) return this.lockMove(w, d, w.ms.strong[pick(dirs)], 'strong');
        return this.lockMove(w, d, w.ms.quick[pick(dirs)], 'quick');
      }
      if (w.state === 'whipA') {
        const d = w.whipTarget;
        if (d && d.whip && d.whip.phase === 'back' && this.dist(w, d) < 1.9) {
          this.faceTo(w, d);
          return this.reboundAttack(w, d, rand() < 0.5 ? 'strike' : 'grapple');
        }
        return;
      }
      if (w.state === 'perch') {
        const t = this.nearestOppAny(w, 4.6);
        if (t && (t.state === 'down' || (t.standing() && rand() < 0.02))) {
          if (rand() < 0.6 && this.aiWantsSpecial(w, t) && this.special(w)) return;
          return this.startDive(w, w.ms.top, false);
        }
        return;
      }
      if (!this.canAct(w)) return;
      ai.think -= dt;
      if (ai.think > 0) { this.aiMove(w, dt); return; }
      ai.think = this.diff.react * (0.6 + rand() * 0.8);
      // tag out when hurting
      if (this.isTag && w.partner && w.partner.state === 'apron' && w.tagT <= 0 && w.hurt() > 40 && w.partner.hurt() + 12 < w.hurt() && rand() < 0.35) { ai.plan = { kind: 'tag' }; }
      if (ai.plan && ai.plan.kind === 'tag') {
        if (this.nearOwnCorner(w)) { ai.plan = null; return this.tryTag(w); }
        return this.aiMove(w, dt);
      }
      // break up pins in multi-man
      if (!this.isTag && this.pin && this.pin.a !== w && this.pin.d !== w) {
        ai.target = this.pin.a; ai.plan = { kind: 'break' };
        if (this.dist(w, this.pin.a) < 1.2) { this.faceTo(w, this.pin.a); this.pin.a.set('stun', 0.6); this.damage(w, this.pin.a, 3, 'head'); this.breakPin('save'); this.say(`${w.short} breaks up the pin!`, 'gold'); this.stats.nearfalls++; BW.Audio.hit(1); return; }
        return this.aiMove(w, dt);
      }
      const t = this.aiTarget(w); ai.target = t;
      if (!t) return;
      const dist = this.dist(w, t);
      ai.plan = null;
      if (t.state === 'down') {
        if (dist < 1.6) {
          const r = rand();
          if (this.aiWantsSpecial(w, t) && r < 0.6) { if (this.special(w)) return; }
          const pinChance = this.subOnly ? 0 : clamp(t.hurt() / 100 * 0.75 + (t.lastBig && this.t - t.lastBig.t < 4 ? 0.7 : 0) - 0.18, 0.04, 0.9);
          if (rand() < pinChance) return this.startPin(w, t);
          if (w.fin > 0 && KIND[w.spec.finisher.anim] !== 'dive' && rand() < 0.5) return this.pickUp(w, t);
          if (rand() < (this.subOnly ? 0.5 : 0.12)) return this.groundSub(w, t);
          if (rand() < 0.6) return this.groundAttack(w, t);
          if (rand() < 0.3) return this.taunt(w);
          return;
        }
        // go up top?
        const c = this.nearCorner(w);
        if (c && (w.spec.style === 'highflyer' || rand() < 0.15) && rand() < 0.5) return this.climb(w, c);
        if (rand() < 0.12 && dist > 2.5) return this.taunt(w);
        ai.plan = { kind: 'approach' };
        return;
      }
      if (t.state === 'perch' || t.state === 'climb') {
        if (dist < 1.2) { this.faceTo(w, t); return this.startAttack(w, t, 'strike'); }
        ai.plan = { kind: 'approach' }; return;
      }
      if (!t.standing()) { ai.plan = { kind: 'approach' }; return; }
      // standing opponent
      if (dist < 1.25 && Math.abs(t.y - w.y) < 0.4) {
        this.faceTo(w, t);
        if (this.aiWantsSpecial(w, t) && rand() < 0.45 && this.special(w)) return;
        const r = rand() * this.diff.aggr;
        if (r < 0.08) { ai.plan = { kind: 'backoff', t: 0.5 }; return; }
        if (r < 0.38) return this.startAttack(w, t, rand() < 0.3 ? 'kick' : 'strike');
        return this.startAttack(w, t, 'grapple');
      }
      if (dist > 2.6 && dist < 4.5 && Math.abs(t.y - w.y) < 0.35 && rand() < 0.22) {
        this.faceTo(w, t);
        const fk = KIND[(w.fin > 0 ? w.spec.finisher : w.spec.signature).anim];
        if (this.aiWantsSpecial(w, t) && fk === 'running' && this.special(w)) return;
        w.set('run'); w.ix = w.facing; w.iy = 0; w.aiRun = true;
        return;
      }
      if (rand() < 0.04 && dist > 2.5) return this.taunt(w);
      ai.plan = { kind: 'approach' };
      this.aiMove(w, dt);
    }

    aiTarget(w) {
      const opps = this.opponents(w).filter((o) => o.state !== 'apron');
      if (!opps.length) return null;
      if (opps.length === 1) return opps[0];
      let best = null, bs = -1e9;
      for (const o of opps) {
        let s = -this.dist(w, o) * 1.2 + o.hurt() * 0.03;
        if (o === w.ai.target) s += 1.5;
        if (o.human) s += 0.6;
        if (s > bs) { bs = s; best = o; }
      }
      return best;
    }

    aiMove(w, dt) {
      const ai = w.ai;
      if (w.state === 'run' && w.aiRun) {
        const t = ai.target;
        if (t && this.inFront(w, t, 1.1, 0.5) && this.hittable(t)) { w.aiRun = false; return this.runAttack(w, rand() < 0.5 ? 'strike' : 'grapple'); }
        if (w.st > 1.2) { w.aiRun = false; w.set('idle'); }
        return;
      }
      let tx, ty;
      if (ai.plan && ai.plan.kind === 'tag') { const c = this.cornerOf(w.team); tx = c.x; ty = c.y; }
      else if (ai.plan && ai.plan.kind === 'backoff') {
        ai.plan.t -= dt; if (ai.plan.t <= 0) ai.plan = null;
        const t = ai.target; if (!t) return;
        tx = w.x - Math.sign(t.x - w.x) * 2; ty = w.y;
      } else {
        const t = ai.target; if (!t) { w.set('idle'); return; }
        const side = w.x < t.x ? -1 : 1;
        tx = t.x + side * (t.state === 'down' ? 0.6 : 0.85); ty = t.y + (t.state === 'down' ? 0.02 : 0);
        if (t.state === 'perch') { tx = t.x - (t.x > 0 ? 0.7 : -0.7); ty = t.y; }
      }
      const dx = tx - w.x, dy = ty - w.y;
      const ix = Math.abs(dx) > 0.12 ? Math.sign(dx) : 0, iy = Math.abs(dy) > 0.08 ? Math.sign(dy) : 0;
      w.ix = ix; w.iy = iy;
      if (ix || iy) { if (w.state !== 'walk') w.set('walk'); }
      else if (w.state !== 'idle') w.set('idle');
      if (ai.target && (!ai.plan || ai.plan.kind !== 'tag')) this.faceTo(w, ai.target); else if (ix) w.facing = ix;
    }

    /* ---------- rendering ---------- */
    render(g) {
      const V = BW.VIEW;
      g.save();
      if (this.shake > 0) g.translate((rand() - 0.5) * this.shake, (rand() - 0.5) * this.shake * 0.6);
      g.drawImage(this.arena, 0, 0);
      for (const f of this.flashes) {
        g.fillStyle = `rgba(255,255,255,${0.9 - f.t * 7})`;
        g.beginPath(); g.arc(f.x, f.y, 2.2, 0, Math.PI * 2); g.fill();
      }
      // apron partners first (outside ropes)
      const apron = this.ws.filter((w) => w.state === 'apron');
      for (const w of apron) this.drawW(g, w);
      BW.drawRopes(g, this.brand, 'back');
      // shadows
      const ents = this.ws.filter((w) => w.state !== 'apron').map((w) => ({ w, y: w.y + (w.state === 'perch' ? -0.1 : 0) }));
      ents.push({ ref: true, y: this.ref.y });
      for (const e of ents) { const o = e.ref ? this.ref : e.w; BW.drawShadow(g, o.x, o.y, o.z || 0, Math.abs(Math.sin((o.ang || 0) * Math.PI / 180))); }
      ents.sort((a, b) => a.y - b.y);
      for (const e of ents) { if (e.ref) this.drawRef(g); else this.drawW(g, e.w); }
      // fx
      for (const f of this.fx) {
        const p = BW.project(f.x, f.y, f.z);
        const a = 1 - f.t / f.life;
        if (f.kind === 'spark') { g.fillStyle = `rgba(255,236,150,${a})`; g.beginPath(); g.arc(p.x, p.y, 3, 0, Math.PI * 2); g.fill(); }
        else { g.fillStyle = `rgba(220,225,235,${a * 0.5})`; g.beginPath(); g.arc(p.x, p.y, 4 + f.t * 14, 0, Math.PI * 2); g.fill(); }
      }
      BW.drawRopes(g, this.brand, 'front');
      for (const t of this.texts) {
        const p = BW.project(t.x, t.y, t.z + 0.6);
        g.globalAlpha = clamp(1.3 - t.t, 0, 1);
        g.font = '800 18px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif'; g.textAlign = 'center';
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(t.text, p.x, p.y); g.fillStyle = t.color; g.fillText(t.text, p.x, p.y);
        g.globalAlpha = 1;
      }
      g.restore();
      if (!this.opts.noHud) this.drawHUD(g, V);
    }

    drawW(g, w) {
      const p = BW.project(w.x, w.y, w.z);
      BW.drawFigure(g, w.spec, { pose: w.pose, facing: w.facing, ang: w.ang, sx: p.x, sy: p.y, scale: p.s, flash: Math.max(0, w.flash) * 0.25, alpha: 1 });
      if (w.human && this.phase !== 'over' && w.state !== 'apron') {
        const hp = BW.project(w.x, w.y, w.z + (Math.abs(Math.sin(w.ang * Math.PI / 180)) > 0.5 ? 0.55 : 2.08 * (w.spec.height || 1)));
        g.fillStyle = w.human === 1 ? '#ffd34a' : '#7fe3ff';
        g.beginPath(); g.moveTo(hp.x - 7, hp.y - 10); g.lineTo(hp.x + 7, hp.y - 10); g.lineTo(hp.x, hp.y - 2); g.closePath(); g.fill();
        g.font = '700 11px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center';
        g.fillText(w.human === 1 ? 'P1' : 'P2', hp.x, hp.y - 14);
        if (w.revWin > 0 && w.revReady) {
          g.fillStyle = '#ffffff'; g.strokeStyle = '#2f7cff'; g.lineWidth = 3;
          g.beginPath(); g.arc(hp.x + 26, hp.y - 18, 13, 0, Math.PI * 2); g.fill(); g.stroke();
          g.fillStyle = '#0b0f1a'; g.font = '800 14px "Barlow Condensed", sans-serif'; g.textBaseline = 'middle';
          g.fillText(this.opts.touch ? 'R' : (w.human === 2 ? '3' : 'L'), hp.x + 26, hp.y - 17);
          g.textBaseline = 'alphabetic';
        }
      }
    }
    drawRef(g) {
      const r = this.ref, p = BW.project(r.x, r.y, 0);
      BW.drawFigure(g, r.spec, { pose: r.pose, facing: r.facing, ang: 0, sx: p.x, sy: p.y, scale: p.s, alpha: 1 });
    }

    drawHUD(g, V) {
      const ws = this.ws;
      const n = ws.length;
      const cardW = n > 2 ? 228 : 300;
      ws.forEach((w, i) => {
        let x, y = 10;
        const leftSide = this.isTag ? w.team === 0 : n === 2 ? i === 0 : i % 2 === 0;
        const slot = this.isTag ? (w.partner && ws.indexOf(w) > ws.indexOf(w.partner) ? 1 : 0) : n > 2 ? Math.floor(i / 2) : 0;
        x = leftSide ? 10 + slot * (cardW + 6) : V.w - 10 - cardW - slot * (cardW + 6);
        if (n > 2) { y = 8; }
        this.drawCard(g, w, x, y, cardW, leftSide);
      });
      // clock
      const mm = Math.floor(this.t / 60), ss = Math.floor(this.t % 60);
      g.font = '700 15px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center';
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillText(`${mm}:${String(ss).padStart(2, '0')}`, V.cx, 132);
      if (this.opts.title) { g.fillStyle = '#e8b83a'; g.font = '700 12px "Barlow Condensed", sans-serif'; g.fillText(this.opts.title.toUpperCase(), V.cx, 148); }
      // feed
      g.textAlign = 'left';
      this.feed.forEach((f, i) => {
        const a = clamp(1 - (f.t - 5) / 2, 0, 1) * (1 - i * 0.2);
        g.globalAlpha = a;
        g.font = `${i === 0 ? 600 : 500} ${i === 0 ? 16 : 14}px "Barlow", "Segoe UI", sans-serif`;
        g.fillStyle = 'rgba(5,7,13,0.7)';
        const tw = g.measureText(f.text).width;
        g.fillRect(14, V.h - 34 - i * 22, tw + 16, 20);
        g.fillStyle = f.cls === 'gold' ? '#ffd34a' : '#e8ecf4';
        g.fillText(f.text, 22, V.h - 19 - i * 22);
      });
      g.globalAlpha = 1;
      // banner for signatures/finishers
      if (this.banner) {
        const b = this.banner, t = b.t;
        const a = t < 0.15 ? t / 0.15 : t > 1.4 ? (1.8 - t) / 0.4 : 1;
        g.globalAlpha = clamp(a, 0, 1);
        const s = 1 + Math.max(0, 0.15 - t) * 2;
        g.save(); g.translate(V.cx, 205); g.scale(s, s);
        g.font = '900 44px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif'; g.textAlign = 'center';
        g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(b.text.toUpperCase(), 0, 0);
        g.fillStyle = b.color; g.fillText(b.text.toUpperCase(), 0, 0);
        g.restore(); g.globalAlpha = 1;
      }
      // pin count + kickout meter
      if (this.pin && this.pin.refReady) {
        const p = this.pin;
        g.font = '900 72px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif'; g.textAlign = 'center';
        g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.7)';
        const txt = p.count ? String(p.count) : '';
        g.strokeText(txt, V.cx, 300); g.fillStyle = '#fff'; g.fillText(txt, V.cx, 300);
        if (p.mini) this.drawMeter(g, V, 'KICK OUT', p.mini.pos, p.mini.zone, p.mini.lock > 0);
      }
      if (this.sub) {
        const s = this.sub;
        const humanSide = s.a.human ? 'a' : s.d.human ? 'd' : null;
        const bx = V.cx - 160, by = 330, bw = 320;
        g.fillStyle = 'rgba(5,7,13,0.75)'; g.fillRect(bx - 6, by - 24, bw + 12, 46);
        g.fillStyle = '#2b3245'; g.fillRect(bx, by, bw, 12);
        g.fillStyle = '#e8361c'; g.fillRect(bx, by, bw * clamp(s.bar / 100, 0, 1), 12);
        g.fillStyle = '#fff'; g.fillRect(bx + bw - 2, by - 3, 2, 18);
        g.font = '700 13px "Barlow Condensed", sans-serif'; g.textAlign = 'left'; g.fillStyle = '#e8ecf4';
        g.fillText(`${s.move.name.toUpperCase()}${humanSide ? (humanSide === 'a' ? ' — MASH TO MAKE THEM TAP' : ' — MASH TO ESCAPE') : ''}`, bx, by - 8);
      }
      if (this.phase === 'intro') this.drawIntro(g, V);
      if (this.phase === 'over' && this.result) {
        const a = clamp(this.phaseT / 0.4, 0, 1);
        g.globalAlpha = a;
        g.fillStyle = 'rgba(5,7,13,0.65)'; g.fillRect(0, 170, V.w, 90);
        g.font = '900 52px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif'; g.textAlign = 'center';
        g.fillStyle = '#ffd34a';
        const names = this.isTag ? this.ws.filter((w) => this.result.winners.includes(w.id)).map((w) => w.short).join(' & ') : this.result.winnerName;
        g.fillText(`${names.toUpperCase()} WINS`, V.cx, 228);
        g.font = '600 15px "Barlow Condensed", sans-serif'; g.fillStyle = '#e8ecf4';
        g.fillText(`by ${this.result.method} at ${Math.floor(this.t / 60)}:${String(Math.floor(this.t % 60)).padStart(2, '0')}`, V.cx, 250);
        g.globalAlpha = 1;
      }
    }

    drawMeter(g, V, label, pos, zone, locked) {
      const bx = V.cx - 150, by = 320, bw = 300;
      g.fillStyle = 'rgba(5,7,13,0.75)'; g.fillRect(bx - 8, by - 26, bw + 16, 50);
      g.fillStyle = '#2b3245'; g.fillRect(bx, by, bw, 14);
      g.fillStyle = locked ? '#8a2a1a' : '#2fbf71'; g.fillRect(bx + bw * (0.5 - zone / 2), by, bw * zone, 14);
      g.fillStyle = '#fff'; g.fillRect(bx + bw * pos - 2, by - 5, 4, 24);
      g.font = '700 13px "Barlow Condensed", sans-serif'; g.textAlign = 'left'; g.fillStyle = '#e8ecf4';
      g.fillText(`${label} — PRESS ANY BUTTON IN THE GREEN`, bx, by - 9);
    }

    drawCard(g, w, x, y, cw, left) {
      const ch = 56;
      const brand = BW.BRANDS[this.brand] || BW.BRANDS.exhibition;
      g.fillStyle = w.active ? 'rgba(8,10,18,0.82)' : 'rgba(8,10,18,0.5)';
      g.fillRect(x, y, cw, ch);
      g.fillStyle = w.spec.colors ? w.spec.colors[0] : brand.color;
      g.fillRect(left ? x : x + cw - 4, y, 4, ch);
      // body damage figure
      const bx = left ? x + 12 : x + cw - 34, by = y + 7;
      const col = (v) => v < 25 ? '#3fcf6a' : v < 50 ? '#e7d23a' : v < 75 ? '#ef8a23' : '#e3342f';
      g.fillStyle = col(w.dmg.head); g.beginPath(); g.arc(bx + 11, by + 6, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = col(w.dmg.body); g.fillRect(bx + 6, by + 12, 10, 15);
      g.fillStyle = col(w.dmg.arms); g.fillRect(bx + 1, by + 12, 4, 13); g.fillRect(bx + 17, by + 12, 4, 13);
      g.fillStyle = col(w.dmg.legs); g.fillRect(bx + 6, by + 28, 4, 14); g.fillRect(bx + 12, by + 28, 4, 14);
      // name
      const nx = left ? x + 42 : x + cw - 42;
      g.textAlign = left ? 'left' : 'right';
      g.font = '800 17px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
      g.fillStyle = '#f2f4f8';
      g.fillText(w.name.toUpperCase(), nx, y + 22);
      g.font = '600 10px "Barlow Condensed", sans-serif';
      g.fillStyle = 'rgba(232,236,244,0.6)';
      const tag = w.human ? (w.human === 1 ? 'P1' : 'P2') : 'CPU';
      g.fillText(`${tag}${this.isTag && !w.active ? ' · APRON' : ''}`, nx, y + 34);
      // momentum bar
      const mw = cw - 62, mx = left ? x + 42 : x + cw - 42 - mw, my = y + 40;
      g.fillStyle = '#20263a'; g.fillRect(mx, my, mw, 7);
      g.fillStyle = w.fin ? '#ffd34a' : '#2f7cff';
      const fillW = w.fin ? mw : mw * w.mom / 100;
      g.fillRect(left ? mx : mx + mw - fillW, my, fillW, 7);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(mx + mw / 2, my - 1, 1, 9);
      if (w.fin) {
        g.font = '800 11px "Barlow Condensed", sans-serif'; g.fillStyle = '#ffd34a';
        g.textAlign = left ? 'right' : 'left';
        g.fillText('FINISHER', left ? x + cw - 6 : x + 6, y + 34);
      } else if (w.mom >= 50) {
        g.font = '700 10px "Barlow Condensed", sans-serif'; g.fillStyle = '#7fe3ff';
        g.textAlign = left ? 'right' : 'left';
        g.fillText('SIGNATURE', left ? x + cw - 6 : x + 6, y + 34);
      }
    }

    drawIntro(g, V) {
      const t = this.phaseT;
      const a = clamp(t < 0.3 ? t / 0.3 : t > 2.2 ? (2.6 - t) / 0.4 : 1, 0, 1);
      g.globalAlpha = a;
      g.fillStyle = 'rgba(5,7,13,0.7)'; g.fillRect(0, 175, V.w, 120);
      const teams = this.isTag ? [this.ws.filter((w) => w.team === 0), this.ws.filter((w) => w.team === 1)] : this.ws.map((w) => [w]);
      const label = (BW.MATCH_TYPES[this.type] || {}).label || 'Match';
      g.textAlign = 'center';
      g.font = '600 13px "Barlow Condensed", sans-serif'; g.fillStyle = '#e8b83a';
      g.fillText(((this.opts.title ? this.opts.title + ' · ' : '') + label).toUpperCase(), V.cx, 198);
      g.font = '900 34px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif'; g.fillStyle = '#fff';
      const names = teams.map((tm) => tm.map((w) => w.name.toUpperCase()).join(' & '));
      if (names.length === 2) {
        g.fillText(names[0], V.cx - 0, 236);
        g.font = '600 14px "Barlow Condensed", sans-serif'; g.fillStyle = '#e8b83a'; g.fillText('VS', V.cx, 256);
        g.font = '900 34px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif'; g.fillStyle = '#fff';
        g.fillText(names[1], V.cx, 286);
      } else {
        g.font = '900 26px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
        g.fillText(names.join('  ·  '), V.cx, 250);
      }
      g.globalAlpha = 1;
    }
  }

  function sample(keys, f) {
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1][0] <= f) i++;
    const k0 = keys[i], k1 = keys[Math.min(i + 1, keys.length - 1)];
    if (k0 === k1 || k1[0] === k0[0]) return [k0[1], k0[2], k0[3]];
    const t = easeInOut((f - k0[0]) / (k1[0] - k0[0]));
    return [lerp(k0[1], k1[1], t), lerp(k0[2], k1[2], t), lerp(k0[3], k1[3], t)];
  }
  function samplePose(keys, f) { let p = keys[0][1]; for (const k of keys) if (k[0] <= f) p = k[1]; return p; }
  function norm(a) { a = ((a % 360) + 360) % 360; if (a > 180) a -= 360; return a; }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  BW.Match = Match;
  BW.lastName = lastName;
})();
