/* Brand Wars — synthesized sound: bell, impacts, mat slaps and a crowd bed.
   Everything is generated with WebAudio, so there are no audio files. */
(function () {
  const BW = (window.BW = window.BW || {});
  let ctx = null, master = null, crowdGain = null, crowdFilter = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('bw.muted') === '1'; } catch (e) { /* storage blocked */ }

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // crowd bed: looping filtered noise, swelled by pop()
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    crowdFilter = ctx.createBiquadFilter();
    crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 900; crowdFilter.Q.value = 0.6;
    crowdGain = ctx.createGain(); crowdGain.gain.value = 0;
    src.connect(crowdFilter); crowdFilter.connect(crowdGain); crowdGain.connect(master);
    src.start();
    return ctx;
  }

  function noise(dur, freq, gain, type) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  function tone(freq, dur, gain, type, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  const ok = () => !BW.Audio.silent && init();

  BW.Audio = {
    silent: false,
    unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('bw.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    bell(times) {
      if (!ok()) return;
      for (let i = 0; i < (times || 3); i++) {
        setTimeout(() => { tone(1250, 1.1, 0.25); tone(2510, 0.7, 0.08); tone(3770, 0.4, 0.04); }, i * 170);
      }
    },
    hit(power) { if (!ok()) return; const p = power || 1; noise(0.12, 1400, 0.35 * p, 'lowpass'); tone(140, 0.12, 0.25 * p, 'sine', 60); },
    slam(power) { if (!ok()) return; const p = power || 1; noise(0.35, 600, 0.6 * p); tone(90, 0.35, 0.5 * p, 'sine', 38); noise(0.5, 3000, 0.06 * p, 'highpass'); },
    slap() { if (!ok()) return; noise(0.08, 2500, 0.45, 'bandpass'); },
    whoosh() { if (!ok()) return; noise(0.25, 1800, 0.12, 'bandpass'); },
    rope() { if (!ok()) return; tone(70, 0.3, 0.3, 'triangle', 50); noise(0.2, 400, 0.15); },
    blip() { if (!ok()) return; tone(880, 0.08, 0.08, 'square'); },
    crowd(level) {
      if (!ok() || !crowdGain) return;
      const t = ctx.currentTime;
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setTargetAtTime(level, t, 0.4);
    },
    pop(amount) {
      if (!ok() || !crowdGain) return;
      const t = ctx.currentTime, base = 0.05;
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setTargetAtTime(base + 0.25 * amount, t, 0.05);
      crowdGain.gain.setTargetAtTime(base, t + 0.6 + amount, 0.8);
      crowdFilter.frequency.setTargetAtTime(900 + 500 * amount, t, 0.1);
      crowdFilter.frequency.setTargetAtTime(900, t + 1, 0.6);
    },
  };
})();
