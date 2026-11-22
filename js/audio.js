'use strict';

// Basit ses: dosya yok, tüm sesler tarayıcıda sentezleniyor.
const Sound = (() => {
  let ac = null, master = null, musicBus = null, muted = false;
  let seqTimer = null;

  function unlock() {
    try {
      if (!ac) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        ac = new C();
        master = ac.createGain();
        master.gain.value = muted ? 0 : 0.6;
        master.connect(ac.destination);
        musicBus = ac.createGain();
        musicBus.gain.value = 0.2;
        musicBus.connect(master);
        if (pendingTheme !== null) startMusic(pendingTheme);
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { /* ses yoksa oyun yine çalışır */ }
  }

  function tone(f, d, type, v, f2, delay, bus) {
    if (!ac) return;
    const t0 = ac.currentTime + Math.max(0, delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + d);
    g.gain.setValueAtTime(v || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    o.connect(g); g.connect(bus || master);
    o.start(t0); o.stop(t0 + d + 0.02);
  }

  function noise(d, v) {
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * d);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ac.createBufferSource(); s.buffer = buf;
    const g = ac.createGain(); g.gain.value = v || 0.2;
    s.connect(g); g.connect(master); s.start();
  }

  const sfx = {
    jump: () => tone(330, 0.15, 'square', 0.1, 660),
    double: () => tone(520, 0.15, 'square', 0.1, 1040),
    banana: () => { tone(988, 0.08, 'triangle', 0.16); tone(1319, 0.12, 'triangle', 0.16, 0, 0.06); },
    punch: () => noise(0.07, 0.2),
    stomp: () => tone(240, 0.15, 'square', 0.16, 80),
    hurt: () => tone(320, 0.35, 'sawtooth', 0.16, 90),
    die: () => tone(420, 0.6, 'triangle', 0.2, 60),
    spring: () => tone(200, 0.3, 'sine', 0.25, 900),
    splash: () => noise(0.25, 0.15),
    checkpoint: () => [523, 659, 784].forEach((f, i) => tone(f, 0.15, 'square', 0.1, 0, i * 0.08)),
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.11, 0, i * 0.12)),
    power: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, 0, i * 0.09)),
    select: () => tone(660, 0.08, 'square', 0.08),
    morph: () => tone(300, 0.25, 'sine', 0.18, 1200),
    dash: () => noise(0.15, 0.14),
    pound: () => { tone(150, 0.3, 'square', 0.18, 40); noise(0.2, 0.22); },
    bubble: () => tone(600, 0.12, 'sine', 0.14, 1200),
    break: () => noise(0.3, 0.28),
  };

  // ---------- Müzik: her temaya kendi küçük melodisi ----------
  const SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 3, 7, 8]];
  let pendingTheme = null;

  function startMusic(themeIdx) {
    stopMusic();
    pendingTheme = themeIdx;
    if (!ac) return;
    const rnd = mulberry32(themeIdx * 31 + 7);
    const root = 196 * Math.pow(2, ((themeIdx * 5) % 12) / 12);
    const scale = SCALES[themeIdx % 3];
    const bpm = [116, 120, 104, 110, 96, 112, 100, 128, 92, 90, 108][themeIdx] || 110;
    const steps = 32;
    const mel = [];
    for (let i = 0; i < steps; i++) mel.push(rnd() < 0.6 ? scale[Math.floor(rnd() * 5)] + (rnd() < 0.3 ? 12 : 0) : null);
    const bass = [0, 0, 7, 5];
    const stepDur = 60 / bpm / 2;
    let step = 0, next = ac.currentTime + 0.1;
    seqTimer = setInterval(() => {
      if (next < ac.currentTime - 0.3) next = ac.currentTime + 0.05;
      while (next < ac.currentTime + 0.25) {
        const m = mel[step % steps];
        const delay = next - ac.currentTime;
        if (m !== null) tone(root * 2 * Math.pow(2, m / 12), stepDur * 0.9, 'triangle', 0.22, 0, delay, musicBus);
        if (step % 2 === 0) {
          const b = bass[Math.floor(step / 8) % 4];
          tone((root / 2) * Math.pow(2, b / 12), stepDur * 1.6, 'square', 0.12, 0, delay, musicBus);
        }
        step++;
        next += stepDur;
      }
    }, 60);
  }

  function stopMusic() {
    if (seqTimer) clearInterval(seqTimer);
    seqTimer = null;
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.6;
  }

  return { unlock, sfx, startMusic, stopMusic, setMuted, get muted() { return muted; } };
})();
