/* Brand Wars — drawing: projection, the arena, the ring and articulated wrestlers. */
(function () {
  const BW = (window.BW = window.BW || {});

  const RING = { W: 4.0, D: 2.3, post: 1.3, ropes: [0.42, 0.78, 1.12] };
  const VIEW = { w: 960, h: 540, cx: 480, floorY: 352, S: 92, depth: 0.4 };
  BW.RING = RING;
  BW.VIEW = VIEW;

  function persp(y) { return 0.84 + 0.16 * (y + RING.D) / (2 * RING.D); }
  function project(x, y, z) {
    const s = persp(y);
    return { x: VIEW.cx + x * VIEW.S * s, y: VIEW.floorY + y * VIEW.S * VIEW.depth - (z || 0) * VIEW.S * s, s: s * VIEW.S };
  }
  BW.project = project;

  function shade(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  BW.shade = shade;

  /* ---------------- poses ---------------- */
  // Angles in degrees. Limbs: 0 = hanging straight down, +90 = pointing forward.
  const P = (o) => Object.assign({ lean: 4, hipF: 6, kneeF: -6, hipB: -6, kneeB: -6, shF: 18, elF: 30, shB: 12, elB: 30 }, o);
  const POSES = {
    idle: P({ lean: 8, hipF: 16, kneeF: -20, hipB: -10, kneeB: -14, shF: 42, elF: 78, shB: 30, elB: 84 }),
    stand: P({}),
    punch: P({ lean: 14, hipF: 24, kneeF: -12, hipB: -18, kneeB: -6, shF: 92, elF: 0, shB: 32, elB: 92 }),
    windup: P({ lean: -6, hipF: 14, kneeF: -14, hipB: -14, kneeB: -10, shF: -30, elF: 80, shB: 40, elB: 90 }),
    kick: P({ lean: -16, hipF: 100, kneeF: -4, hipB: -6, kneeB: -8, shF: 30, elF: 60, shB: -24, elB: 40 }),
    highkick: P({ lean: -34, hipF: 140, kneeF: 0, hipB: -4, kneeB: -6, shF: 40, elF: 30, shB: -40, elB: 30 }),
    kneeup: P({ lean: -8, hipF: 105, kneeF: -125, hipB: -10, kneeB: -6, shF: 130, elF: 20, shB: 120, elB: 20 }),
    lockup: P({ lean: 24, hipF: 22, kneeF: -22, hipB: -24, kneeB: -10, shF: 78, elF: 38, shB: 72, elB: 44 }),
    lift: P({ lean: -4, hipF: 14, kneeF: -18, hipB: -12, kneeB: -14, shF: 168, elF: 10, shB: 164, elB: 12 }),
    chokelift: P({ lean: -2, hipF: 14, kneeF: -10, hipB: -14, kneeB: -8, shF: 150, elF: 8, shB: 30, elB: 60 }),
    slamdown: P({ lean: 36, hipF: 50, kneeF: -70, hipB: -14, kneeB: -50, shF: 100, elF: 8, shB: 95, elB: 10 }),
    kneel: P({ lean: 14, hipF: 85, kneeF: -95, hipB: -5, kneeB: -100, shF: 60, elF: 40, shB: 50, elB: 40 }),
    hold: P({ lean: 32, hipF: 70, kneeF: -100, hipB: -25, kneeB: -95, shF: 70, elF: 30, shB: 62, elB: 34 }),
    hug: P({ lean: 10, hipF: 18, kneeF: -16, hipB: -16, kneeB: -10, shF: 70, elF: 80, shB: 66, elB: 84 }),
    taunt: P({ lean: -10, hipF: 12, kneeF: -4, hipB: -12, kneeB: -4, shF: 166, elF: 18, shB: 160, elB: 22 }),
    flex: P({ lean: -4, hipF: 16, kneeF: -10, hipB: -16, kneeB: -10, shF: 92, elF: 125, shB: 88, elB: 125 }),
    stun: P({ lean: 26, hipF: 4, kneeF: -24, hipB: -6, kneeB: -22, shF: 8, elF: 8, shB: 4, elB: 10 }),
    hit: P({ lean: -20, hipF: 10, kneeF: -14, hipB: -18, kneeB: -8, shF: 30, elF: 40, shB: -30, elB: 30 }),
    block: P({ lean: -6, hipF: 18, kneeF: -18, hipB: -14, kneeB: -12, shF: 104, elF: 112, shB: 96, elB: 118 }),
    lying: P({ lean: 0, hipF: 4, kneeF: -2, hipB: -4, kneeB: -4, shF: 16, elF: 4, shB: -10, elB: 6 }),
    lyingHurt: P({ lean: 0, hipF: 30, kneeF: -50, hipB: -2, kneeB: -4, shF: 40, elF: 70, shB: -4, elB: 10 }),
    cover: P({ lean: 0, hipF: 10, kneeF: -40, hipB: -10, kneeB: -30, shF: 90, elF: 20, shB: 70, elB: 30 }),
    stomp: P({ lean: -6, hipF: 30, kneeF: -4, hipB: -6, kneeB: -6, shF: 40, elF: 50, shB: 20, elB: 50 }),
    stompUp: P({ lean: -6, hipF: 75, kneeF: -70, hipB: -6, kneeB: -6, shF: 50, elF: 50, shB: 10, elB: 50 }),
    gpunch: P({ lean: 55, hipF: 80, kneeF: -100, hipB: -20, kneeB: -100, shF: 55, elF: 10, shB: 120, elB: 40 }),
    climb: P({ lean: 8, hipF: 75, kneeF: -85, hipB: 10, kneeB: -30, shF: 150, elF: 20, shB: 140, elB: 24 }),
    perch: P({ lean: 22, hipF: 85, kneeF: -115, hipB: 75, kneeB: -110, shF: 40, elF: 40, shB: 30, elB: 46 }),
    fly: P({ lean: 0, hipF: -6, kneeF: -10, hipB: -18, kneeB: -14, shF: 115, elF: 0, shB: 100, elB: 0 }),
    tuck: P({ lean: 30, hipF: 110, kneeF: -120, hipB: 100, kneeB: -120, shF: 80, elF: 60, shB: 70, elB: 60 }),
    spear: P({ lean: 62, hipF: 40, kneeF: -40, hipB: -40, kneeB: -20, shF: 92, elF: 22, shB: 86, elB: 24 }),
    clothesline: P({ lean: 10, hipF: 34, kneeF: -16, hipB: -24, kneeB: -14, shF: 92, elF: 0, shB: 20, elB: 40 }),
    dropkick: P({ lean: -30, hipF: 95, kneeF: 0, hipB: 88, kneeB: 0, shF: 60, elF: 20, shB: 40, elB: 20 }),
    sit: P({ lean: 6, hipF: 90, kneeF: -10, hipB: 85, kneeB: -14, shF: 20, elF: 20, shB: -20, elB: 30 }),
    apron: P({ lean: 4, hipF: 6, kneeF: -6, hipB: -6, kneeB: -6, shF: 125, elF: 0, shB: 10, elB: 30 }),
    refCount: P({ lean: 70, hipF: 85, kneeF: -100, hipB: -10, kneeB: -100, shF: 120, elF: 0, shB: 40, elB: 40 }),
    refSlap: P({ lean: 72, hipF: 85, kneeF: -100, hipB: -10, kneeB: -100, shF: 40, elF: 0, shB: 40, elB: 40 }),
    refPoint: P({ lean: 0, shF: 92, elF: 0, shB: 10, elB: 20 }),
    refRaise: P({ lean: -4, shF: 165, elF: 4, shB: 10, elB: 20 }),
  };
  BW.POSES = POSES;
  const POSE_KEYS = ['lean', 'hipF', 'kneeF', 'hipB', 'kneeB', 'shF', 'elF', 'shB', 'elB'];
  BW.POSE_KEYS = POSE_KEYS;

  BW.walkPose = function (phase, run) {
    const s = Math.sin(phase), c = Math.cos(phase);
    const amp = run ? 42 : 24;
    return {
      lean: run ? 20 : 8,
      hipF: 8 + amp * s, kneeF: -14 - Math.max(0, -c) * (run ? 70 : 34),
      hipB: 8 - amp * s, kneeB: -14 - Math.max(0, c) * (run ? 70 : 34),
      shF: run ? 30 - 50 * s : 40 - 10 * s, elF: run ? 90 : 76,
      shB: run ? 30 + 50 * s : 30 + 10 * s, elB: run ? 90 : 82,
    };
  };

  /* ---------------- figure ---------------- */
  function dir(a) { const r = a * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; }

  function limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  // Computes joint positions in local units (hip at 0,0; y down; facing +x).
  function skeleton(pose, h, build) {
    const thigh = 0.47 * h, shin = 0.46 * h, upper = 0.31 * h, fore = 0.29 * h;
    const leg = (hip, knee) => {
      const d1 = dir(hip), kx = d1[0] * thigh, ky = d1[1] * thigh;
      const d2 = dir(hip + knee), fx = kx + d2[0] * shin, fy = ky + d2[1] * shin;
      return { kx, ky, fx, fy };
    };
    const lf = leg(pose.hipF, pose.kneeF), lb = leg(pose.hipB, pose.kneeB);
    const ground = Math.max(lf.fy, lb.fy, 0.25 * h);
    const torso = 0.55 * h;
    const shoulder = { x: Math.sin(pose.lean * Math.PI / 180) * torso, y: -Math.cos(pose.lean * Math.PI / 180) * torso };
    const arm = (sh, el) => {
      const a = sh + pose.lean * 0.3;
      const d1 = dir(a), ex = shoulder.x + d1[0] * upper, ey = shoulder.y + d1[1] * upper;
      const d2 = dir(a + el), hx = ex + d2[0] * fore, hy = ey + d2[1] * fore;
      return { ex, ey, hx, hy };
    };
    const af = arm(pose.shF, pose.elF), ab = arm(pose.shB, pose.elB);
    const neckLen = 0.1 * h;
    const nl = { x: shoulder.x + Math.sin(pose.lean * Math.PI / 180) * neckLen, y: shoulder.y - Math.cos(pose.lean * Math.PI / 180) * neckLen };
    const headR = 0.115 * h * (0.92 + 0.08 * build);
    const head = { x: nl.x + Math.sin(pose.lean * Math.PI / 180) * headR * 0.9, y: nl.y - Math.cos(pose.lean * Math.PI / 180) * headR * 0.9, r: headR };
    return { lf, lb, ground, shoulder, af, ab, head, nl };
  }

  /**
   * Draws one wrestler.
   * spec: roster entry (colors, skin, hair...), st: {pose, facing, ang, sx, sy, scale, alpha, flash}
   */
  BW.drawFigure = function (ctx, spec, st) {
    const h = (spec.height || 1) * (spec.gender === 'f' ? 0.95 : 1);
    const build = (spec.build || 1) * (spec.gender === 'f' ? 0.92 : 1);
    const pose = st.pose;
    const sk = skeleton(pose, h, build);
    const ang = st.ang || 0;
    const ra = ang * Math.PI / 180;
    const lying = Math.abs(Math.sin(ra));
    const hipH = sk.ground * Math.abs(Math.cos(ra)) * (Math.cos(ra) < 0 ? 0.95 : 1) + 0.13 * build * lying;
    const k = st.scale; // px per unit

    ctx.save();
    ctx.globalAlpha = st.alpha == null ? 1 : st.alpha;
    ctx.translate(st.sx, st.sy - hipH * k);
    ctx.scale(st.facing * k, k);
    ctx.rotate(ra);

    const skin = spec.skin || '#d9a77f';
    const skinB = shade(skin, -0.22);
    const c0 = spec.colors ? spec.colors[0] : '#333';
    const c1 = spec.colors ? spec.colors[1] : '#ccc';
    const c2 = spec.colors ? spec.colors[2] : '#111';
    const legs = spec.legs || 'trunks';
    const isRef = spec.ref;
    const thighW = 0.135 * build, shinW = 0.115 * build, armW = 0.105 * build, foreW = 0.088 * build;

    const drawLeg = (L, back) => {
      const d = back ? -0.2 : 0;
      const legColor = isRef ? '#151515' : (legs === 'trunks' ? skin : c0);
      const bootColor = isRef ? '#0c0c0c' : c2;
      // thigh
      limb(ctx, 0, 0, L.kx, L.ky, thighW, shade(legColor === skin ? skin : legColor, d));
      if (legs === 'trunks' && !isRef) limb(ctx, 0, 0, L.kx * 0.38, L.ky * 0.38, thighW * 1.08, shade(c0, d));
      // shin + boot
      const bx = L.kx + (L.fx - L.kx) * 0.35, by = L.ky + (L.fy - L.ky) * 0.35;
      limb(ctx, L.kx, L.ky, bx, by, shinW, shade(legColor === skin ? skin : legColor, d));
      limb(ctx, bx, by, L.fx, L.fy, shinW * 1.08, shade(bootColor, d));
      // foot
      limb(ctx, L.fx, L.fy, L.fx + 0.09, L.fy + 0.005, shinW * 0.85, shade(bootColor, d));
      if (!isRef) { // knee pad
        ctx.fillStyle = shade(c1, d - 0.05);
        ctx.beginPath(); ctx.arc(L.kx, L.ky, shinW * 0.62, 0, Math.PI * 2); ctx.fill();
      }
    };
    const drawArm = (A, back) => {
      const d = back ? -0.2 : 0;
      const sh = sk.shoulder;
      const sleeve = isRef ? '#f2f2f2' : null;
      limb(ctx, sh.x, sh.y, A.ex, A.ey, armW, sleeve || shade(skin, d));
      limb(ctx, A.ex, A.ey, A.hx, A.hy, foreW, shade(skin, d));
      if (!isRef) limb(ctx, A.ex + (A.hx - A.ex) * 0.75, A.ey + (A.hy - A.ey) * 0.75, A.hx, A.hy, foreW * 1.12, shade('#f4f1ea', d - 0.05));
      ctx.fillStyle = shade(skin, d);
      ctx.beginPath(); ctx.arc(A.hx, A.hy, foreW * 0.7, 0, Math.PI * 2); ctx.fill();
    };

    drawArm(sk.ab, true);
    drawLeg(sk.lb, true);

    // torso polygon
    const hw = 0.15 * build, sw = 0.235 * build;
    const sh = sk.shoulder;
    const la = pose.lean * Math.PI / 180;
    const px = Math.cos(la), py = Math.sin(la); // perpendicular to torso
    const torsoPath = () => {
      ctx.beginPath();
      ctx.moveTo(-hw * px, -hw * py);
      ctx.lineTo(hw * px, hw * py);
      ctx.lineTo(sh.x + sw * px * 0.95, sh.y + sw * py * 0.95);
      ctx.quadraticCurveTo(sh.x, sh.y - 0.04, sh.x - sw * px, sh.y - sw * py);
      ctx.closePath();
    };
    torsoPath();
    ctx.fillStyle = isRef ? '#f2f2f2' : skin; ctx.fill();
    if (isRef) {
      ctx.save(); torsoPath(); ctx.clip();
      ctx.strokeStyle = '#121212'; ctx.lineWidth = 0.05;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.09, 0.05); ctx.lineTo(sh.x + i * 0.09, sh.y - 0.05); ctx.stroke(); }
      ctx.restore();
    } else {
      // muscle shading
      ctx.save(); torsoPath(); ctx.clip();
      ctx.fillStyle = skinB; ctx.globalAlpha *= 0.35;
      ctx.fillRect(-0.4, -1.2, 0.18, 1.3);
      ctx.restore();
      const top = spec.top || 'none';
      if (top === 'singlet' || legs === 'singlet') {
        ctx.save(); torsoPath(); ctx.clip(); ctx.fillStyle = c0;
        ctx.beginPath();
        ctx.moveTo(-0.5, 0.1); ctx.lineTo(0.5, 0.1); ctx.lineTo(sh.x + 0.08, sh.y + 0.02); ctx.lineTo(sh.x - 0.12, sh.y + 0.02);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (top === 'crop') {
        ctx.save(); torsoPath(); ctx.clip(); ctx.fillStyle = c0;
        const cy = sh.y * 0.62;
        ctx.fillRect(-0.5, sh.y - 0.1, 1, (cy - sh.y) + 0.12);
        ctx.restore();
      }
      if (top === 'vest') {
        ctx.save(); torsoPath(); ctx.clip(); ctx.fillStyle = c2;
        ctx.fillRect(-0.5, sh.y - 0.1, 0.32, 1.2);
        ctx.fillRect(sh.x + 0.06, sh.y - 0.1, 0.4, 1.2);
        ctx.restore();
      }
      // trunks waistband
      ctx.save(); torsoPath(); ctx.clip();
      ctx.fillStyle = c0; ctx.fillRect(-0.5, -0.12, 1, 0.2);
      ctx.fillStyle = c1; ctx.fillRect(-0.5, -0.13, 1, 0.035);
      ctx.restore();
      if (spec.belt) { // title belt around waist
        ctx.fillStyle = '#d9a920'; ctx.fillRect(-0.18, -0.12, 0.38, 0.07);
        ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.ellipse(0.02, -0.085, 0.08, 0.06, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // hips block so legs join cleanly
    ctx.fillStyle = isRef ? '#151515' : c0;
    ctx.beginPath(); ctx.ellipse(0, 0.0, hw * 1.05, 0.09, la, 0, Math.PI * 2); ctx.fill();

    drawLeg(sk.lf, false);

    // neck + head
    limb(ctx, sh.x, sh.y, sk.nl.x, sk.nl.y, 0.1 * build, skin);
    const hd = sk.head;
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(hd.x, hd.y, hd.r, 0, Math.PI * 2); ctx.fill();
    // face details
    ctx.fillStyle = shade(skin, -0.45);
    ctx.beginPath(); ctx.arc(hd.x + hd.r * 0.55, hd.y - hd.r * 0.12, hd.r * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(skin, -0.12);
    ctx.beginPath(); ctx.arc(hd.x + hd.r * 0.96, hd.y + hd.r * 0.12, hd.r * 0.16, 0, Math.PI * 2); ctx.fill();
    drawHair(ctx, spec, hd);

    drawArm(sk.af, false);

    if (st.flash) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = st.flash;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(hd.x, hd.y + 0.4, 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  function drawHair(ctx, spec, hd) {
    const col = spec.hairColor || '#222';
    const r = hd.r;
    const style = spec.hair || 'short';
    ctx.fillStyle = col;
    if (style === 'mask') {
      ctx.fillStyle = spec.maskColor || '#111';
      ctx.beginPath(); ctx.arc(hd.x, hd.y, r * 1.04, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(hd.x + r * 0.5, hd.y - r * 0.15, r * 0.26, r * 0.16, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(hd.x + r * 0.58, hd.y - r * 0.14, r * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = spec.colors ? spec.colors[1] : '#fff'; ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.arc(hd.x, hd.y, r * 0.8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      return;
    }
    if (style === 'bald') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(hd.x - r * 0.2, hd.y - r * 0.5, r * 0.25, 0, Math.PI * 2); ctx.fill();
    } else if (style === 'buzz') {
      ctx.beginPath(); ctx.arc(hd.x, hd.y, r * 1.02, Math.PI * 0.95, Math.PI * 1.95); ctx.fill();
    } else if (style === 'mohawk') {
      ctx.beginPath(); ctx.arc(hd.x, hd.y, r * 1.0, Math.PI * 1.0, Math.PI * 1.9); ctx.lineTo(hd.x, hd.y); ctx.fill();
      ctx.fillStyle = shade(col, 0.25);
      ctx.fillRect(hd.x - r * 0.9, hd.y - r * 1.45, r * 1.4, r * 0.5);
    } else if (style === 'spiky') {
      ctx.beginPath();
      ctx.moveTo(hd.x - r, hd.y);
      for (let i = 0; i <= 5; i++) {
        const a = Math.PI * (1 + i / 5.6);
        ctx.lineTo(hd.x + Math.cos(a) * r * 1.45, hd.y + Math.sin(a) * r * 1.45);
        ctx.lineTo(hd.x + Math.cos(a + 0.28) * r * 0.95, hd.y + Math.sin(a + 0.28) * r * 0.95);
      }
      ctx.closePath(); ctx.fill();
    } else {
      // short, slick, long, ponytail share a cap
      ctx.beginPath(); ctx.arc(hd.x - r * 0.05, hd.y - r * 0.05, r * 1.08, Math.PI * 0.92, Math.PI * 1.92); ctx.lineTo(hd.x - r * 0.1, hd.y); ctx.fill();
      if (style === 'slick') { ctx.beginPath(); ctx.ellipse(hd.x - r * 0.6, hd.y - r * 0.1, r * 0.5, r * 0.7, 0.3, 0, Math.PI * 2); ctx.fill(); }
      if (style === 'long') {
        ctx.beginPath();
        ctx.moveTo(hd.x - r * 1.05, hd.y - r * 0.2);
        ctx.quadraticCurveTo(hd.x - r * 1.5, hd.y + r * 1.5, hd.x - r * 0.9, hd.y + r * 2.6);
        ctx.lineTo(hd.x - r * 0.1, hd.y + r * 2.2);
        ctx.quadraticCurveTo(hd.x - r * 0.4, hd.y + r, hd.x, hd.y - r * 0.6);
        ctx.closePath(); ctx.fill();
      }
      if (style === 'ponytail') {
        ctx.beginPath(); ctx.ellipse(hd.x - r * 1.3, hd.y + r * 0.6, r * 0.32, r * 0.95, 0.35, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (spec.beard) {
      ctx.fillStyle = spec.beard;
      ctx.beginPath(); ctx.arc(hd.x + r * 0.25, hd.y + r * 0.35, r * 0.72, Math.PI * -0.1, Math.PI * 0.95); ctx.fill();
    }
  }

  /* ---------------- arena ---------------- */
  BW.buildArena = function (brand) {
    const c = document.createElement('canvas');
    c.width = VIEW.w; c.height = VIEW.h;
    const g = c.getContext('2d');
    const B = BW.BRANDS[brand] || BW.BRANDS.exhibition;
    // backdrop
    const bg = g.createLinearGradient(0, 0, 0, VIEW.h);
    bg.addColorStop(0, '#05070d'); bg.addColorStop(0.55, '#0b0f1a'); bg.addColorStop(1, '#06080e');
    g.fillStyle = bg; g.fillRect(0, 0, VIEW.w, VIEW.h);
    // stage glow + titantron
    const glow = g.createRadialGradient(VIEW.cx, 70, 10, VIEW.cx, 70, 420);
    glow.addColorStop(0, hexA(B.color, 0.45)); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, VIEW.w, 300);
    g.fillStyle = '#0a0c12'; g.fillRect(VIEW.cx - 170, 18, 340, 96);
    const tg = g.createLinearGradient(0, 22, 0, 110);
    tg.addColorStop(0, shade(B.color, -0.35)); tg.addColorStop(1, shade(B.color, -0.75));
    g.fillStyle = tg; g.fillRect(VIEW.cx - 164, 24, 328, 84);
    g.font = '900 46px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = B.color2; g.fillText(B.name, VIEW.cx, 64);
    g.font = '600 12px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText(B.night.toUpperCase(), VIEW.cx, 96);
    // crowd tiers
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let row = 0; row < 15; row++) {
      const y = 112 + row * 13;
      const size = 3.4 + row * 0.38;
      const lum = 0.10 + row * 0.018;
      for (let x = -10; x < VIEW.w + 10; x += size * 2.1) {
        if (y < 118 && Math.abs(x - VIEW.cx) < 180) continue;
        const v = rnd();
        const shirt = v < 0.12 ? B.color : v < 0.18 ? B.color2 : `hsl(${(rnd() * 360) | 0},25%,${(lum * 100 + rnd() * 10) | 0}%)`;
        g.fillStyle = shirt; g.globalAlpha = 0.75;
        g.fillRect(x - size * 0.8, y + size * 0.5, size * 1.6, size * 1.6);
        g.fillStyle = `hsl(25,30%,${(lum * 100 + 8 + rnd() * 10) | 0}%)`;
        g.beginPath(); g.arc(x + (rnd() - 0.5) * 2, y, size * 0.62, 0, Math.PI * 2); g.fill();
        if (rnd() < 0.015 && row > 3) { // a sign
          g.globalAlpha = 0.9; g.fillStyle = rnd() < 0.5 ? '#f3f3f3' : B.color2;
          g.fillRect(x - 9, y - 12, 18 + size, 10);
        }
      }
    }
    g.globalAlpha = 1;
    // barricade + floor
    const fy = project(0, -RING.D, 0).y - 30;
    g.fillStyle = '#121620'; g.fillRect(0, fy, VIEW.w, VIEW.h - fy);
    g.fillStyle = '#1b2130'; g.fillRect(0, fy, VIEW.w, 8);
    g.fillStyle = hexA(B.color, 0.6); g.fillRect(0, fy + 8, VIEW.w, 2);
    drawRingBase(g, B);
    return c;
  };

  function hexA(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  BW.hexA = hexA;

  function drawRingBase(g, B) {
    const W = RING.W, D = RING.D;
    const a = project(-W, -D, 0), b = project(W, -D, 0), c = project(W, D, 0), d = project(-W, D, 0);
    // apron skirt (front)
    const skirtH = 0.78 * VIEW.S;
    g.fillStyle = '#0d1018';
    g.beginPath(); g.moveTo(d.x - 6, d.y); g.lineTo(c.x + 6, c.y); g.lineTo(c.x + 6, c.y + skirtH); g.lineTo(d.x - 6, d.y + skirtH); g.closePath(); g.fill();
    g.fillStyle = hexA(B.color, 0.85); g.fillRect(d.x - 6, d.y + 4, c.x - d.x + 12, 5);
    g.font = '900 34px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = B.color2; g.fillText(B.name, VIEW.cx, d.y + skirtH * 0.55);
    g.font = '600 12px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText(B.night.toUpperCase(), VIEW.cx - 260, d.y + skirtH * 0.55);
    g.fillText(B.night.toUpperCase(), VIEW.cx + 260, d.y + skirtH * 0.55);
    // apron edge around mat
    const pad = 0.28;
    const a2 = project(-W - pad, -D - pad * 0.6, 0), b2 = project(W + pad, -D - pad * 0.6, 0), c2 = project(W + pad, D + pad * 0.3, 0), d2 = project(-W - pad, D + pad * 0.3, 0);
    g.fillStyle = '#20242e';
    g.beginPath(); g.moveTo(a2.x, a2.y); g.lineTo(b2.x, b2.y); g.lineTo(c2.x, c2.y); g.lineTo(d2.x, d2.y); g.closePath(); g.fill();
    // mat
    const mg = g.createLinearGradient(0, a.y, 0, d.y);
    mg.addColorStop(0, shade(B.mat, -0.18)); mg.addColorStop(1, B.mat);
    g.fillStyle = mg;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill();
    // center logo squashed onto the mat
    g.save();
    g.translate(VIEW.cx, project(0, 0, 0).y);
    g.scale(1, 0.42);
    g.globalAlpha = 0.22;
    g.fillStyle = B.color;
    g.beginPath(); g.arc(0, 0, 120, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.5;
    g.font = '900 64px "Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
    g.fillStyle = shade(B.color, -0.2);
    g.fillText(B.name, 0, 4);
    g.restore();
    g.globalAlpha = 1;
    // mat edge line
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.stroke();
  }

  // posts + ropes; layer 'back' = back & side ropes, 'front' = front ropes + front posts
  BW.drawRopes = function (g, brand, layer) {
    const B = BW.BRANDS[brand] || BW.BRANDS.exhibition;
    const W = RING.W, D = RING.D;
    const post = (x, y) => {
      const p0 = project(x, y, 0), p1 = project(x, y, RING.post);
      g.strokeStyle = '#9aa3b2'; g.lineWidth = 0.09 * p0.s; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(p0.x, p0.y + 0.5 * p0.s * 0.6); g.lineTo(p1.x, p1.y); g.stroke();
      g.strokeStyle = '#5c6472'; g.lineWidth = 0.03 * p0.s;
      g.beginPath(); g.moveTo(p0.x + 0.03 * p0.s, p0.y); g.lineTo(p1.x + 0.03 * p0.s, p1.y); g.stroke();
      // turnbuckle pads
      for (const rh of RING.ropes) {
        const p = project(x, y, rh);
        g.fillStyle = B.color;
        g.fillRect(p.x - 0.07 * p.s, p.y - 0.08 * p.s, 0.14 * p.s, 0.16 * p.s);
      }
    };
    const rope = (x1, y1, x2, y2, alpha) => {
      for (let i = 0; i < RING.ropes.length; i++) {
        const rh = RING.ropes[i];
        const p1 = project(x1, y1, rh), p2 = project(x2, y2, rh);
        g.strokeStyle = hexA(i === 1 ? '#f1f1f1' : B.rope, alpha);
        g.lineWidth = Math.max(2, 0.045 * (p1.s + p2.s) / 2);
        g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
      }
    };
    if (layer === 'back') {
      rope(-W, -D, W, -D, 1);
      post(-W, -D); post(W, -D);
      rope(-W, -D, -W, D, 0.95); rope(W, -D, W, D, 0.95);
    } else {
      rope(-W, D, W, D, 0.82);
      post(-W, D); post(W, D);
    }
  };

  BW.drawShadow = function (g, x, y, z, w) {
    const p = project(x, y, 0);
    const r = (0.34 + 0.25 * (w || 0)) * p.s;
    g.fillStyle = `rgba(0,0,0,${Math.max(0.08, 0.32 - z * 0.12)})`;
    g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI * 2); g.fill();
  };
})();
