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

  // ---------- Müzik ----------
  // Her tema için A-B-A-B biçiminde 32 ölçülük bir şarkı bestelenir (her ölçü 8 sekizlik).
  // Melodi akor notalarına oturur ve tekrar eden bir motiften gelişir; bas yumuşak, vuruş yok.
  // progs: akor dizileri (gamın derecesi, 0 = kök). swing: tek sekizlikleri geciktirip sallanan ritim verir.
  const MUSIC = [
    { bpm: 112, root: 60, minor: false, progs: [[0, 4, 5, 3], [3, 4, 0, 0]], lead: 'triangle', swing: 0.12 }, // karakter dünyası
    { bpm: 118, root: 62, minor: false, progs: [[0, 3, 4, 0], [5, 3, 0, 4]], lead: 'triangle', swing: 0.16 }, // orman
    { bpm: 104, root: 57, minor: true,  progs: [[0, 5, 6, 4], [3, 4, 0, 0]], lead: 'triangle', swing: 0.1 },  // çöl
    { bpm: 92,  root: 60, minor: false, progs: [[0, 5, 3, 4], [3, 0, 4, 0]], lead: 'sine',     swing: 0 },    // deniz
    { bpm: 120, root: 57, minor: true,  progs: [[0, 6, 5, 6], [3, 4, 0, 0]], lead: 'triangle', swing: 0 },    // lav
    { bpm: 100, root: 65, minor: false, progs: [[0, 3, 0, 4], [5, 3, 1, 4]], lead: 'sine',     swing: 0.1 },  // gökyüzü
    { bpm: 124, root: 60, minor: false, progs: [[0, 5, 1, 4], [3, 4, 2, 5]], lead: 'triangle', swing: 0.18 }, // şehir
    { bpm: 108, root: 64, minor: false, progs: [[0, 4, 5, 3], [0, 3, 4, 4]], lead: 'sine',     swing: 0 },    // karlı dağ
    { bpm: 96,  root: 55, minor: true,  progs: [[0, 3, 0, 4], [5, 6, 0, 0]], lead: 'triangle', swing: 0.2 },  // bataklık
    { bpm: 100, root: 61, minor: true,  progs: [[0, 5, 3, 4], [0, 6, 5, 4]], lead: 'sine',     swing: 0 },    // kristal mağara
    { bpm: 110, root: 58, minor: false, progs: [[0, 2, 3, 4], [5, 4, 3, 4]], lead: 'sine',     swing: 0 },    // uzay
  ];
  const RHYTHMS = [
    [1, 0, 1, 1, 0, 1, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0], [1, 1, 0, 1, 1, 0, 1, 0],
    [1, 0, 1, 0, 1, 1, 1, 0], [1, 0, 0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 0, 1, 0],
  ];
  const BAR = 8, SECTION = 8 * BAR, SONG = 4 * SECTION;
  let pendingTheme = null;

  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Yumuşak girişli, sönümlenen bir nota.
  function note(midi, when, dur, type, vol) {
    const t0 = Math.max(when, ac.currentTime);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(midiHz(midi), t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(musicBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  let shakerBuf = null;
  function shaker(when, vol) {
    if (!shakerBuf) {
      const len = Math.floor(ac.sampleRate * 0.05);
      shakerBuf = ac.createBuffer(1, len, ac.sampleRate);
      const d = shakerBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const s = ac.createBufferSource(); s.buffer = shakerBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = ac.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(musicBus);
    s.start(Math.max(when, ac.currentTime));
  }

  function compose(themeIdx) {
    const cfg = MUSIC[themeIdx] || MUSIC[0];
    const rnd = mulberry32(themeIdx * 977 + 31);
    const scale = cfg.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const degMidi = (d) => cfg.root + 12 * Math.floor(d / 7) + scale[((d % 7) + 7) % 7];
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const nearestChordTone = (cur, chord) => {
      let best = cur, bestDist = 99;
      for (let o = -7; o <= 14; o += 7) for (const ct of [chord, chord + 2, chord + 4]) {
        const d = ct + o, dist = Math.abs(d - cur);
        if (dist < bestDist) { best = d; bestDist = dist; }
      }
      return best;
    };

    // 8 ölçülük melodi: 4 ölçülük cümle, tekrarında sonu tonik notaya çözülür.
    function phrase(prog, lo, hi) {
      const out = new Array(SECTION).fill(null);
      const rA = pick(RHYTHMS), rB = pick(RHYTHMS);
      let cur = nearestChordTone(lo + 3, prog[0]);
      for (let bar = 0; bar < 4; bar++) {
        const r = bar % 2 ? rB : rA;
        for (let s = 0; s < BAR; s++) {
          if (!r[s]) continue;
          if (s === 0 || s === 4) cur = nearestChordTone(cur, prog[bar]);
          else cur += pick([-1, 1, 1, 2, -2, 0, -1]);
          if (cur < lo) cur += 2; if (cur > hi) cur -= 3;
          out[bar * BAR + s] = cur;
        }
      }
      for (let i = 0; i < 4 * BAR; i++) out[4 * BAR + i] = out[i];
      const idx = 4 * BAR + Math.floor(rnd() * 3 * BAR);          // tekrarında küçük bir değişiklik
      if (out[idx] !== null) out[idx] += pick([1, 2, -1]);
      for (let s = 1; s < BAR; s++) out[7 * BAR + s] = null;    // son ölçü: köke otur ve bekle
      out[7 * BAR] = nearestChordTone(out[6 * BAR] ?? lo + 3, 0);
      return out;
    }

    const melA = phrase(cfg.progs[0], 4, 12);
    const melB = phrase(cfg.progs[1], 6, 14);
    const sections = [[melA, cfg.progs[0]], [melB, cfg.progs[1]], [melA, cfg.progs[0]], [melB.map((d) => (d === null ? null : d + 2)), cfg.progs[1]]];
    const lead = [], bass = [], arp = [];
    for (const [mel, prog] of sections) {
      for (let i = 0; i < SECTION; i++) {
        const bar = Math.floor(i / BAR) % 4, s = i % BAR, chord = prog[bar];
        let len = 0;
        if (mel[i] !== null) { len = 1; while (len < 4 && i + len < SECTION && mel[i + len] === null) len++; }
        lead.push(mel[i] === null ? null : { m: degMidi(mel[i]), len });
        const root = degMidi(chord) - 24, fifth = degMidi(chord + 4) - 24;
        bass.push(s === 0 ? { m: root, len: 3 } : s === 4 ? { m: fifth, len: 2 } : s === 6 ? { m: root + 12, len: 1 } : null);
        const arpDeg = [chord + 7, chord + 9, chord + 11, chord + 9][(s >> 1) & 3];
        arp.push(s % 2 === 1 ? degMidi(arpDeg) : null);
      }
    }
    return { cfg, lead, bass, arp };
  }

  function startMusic(themeIdx) {
    stopMusic();
    pendingTheme = themeIdx;
    if (!ac) return;
    const song = compose(themeIdx);
    const stepDur = 60 / song.cfg.bpm / 2;
    let step = 0, next = ac.currentTime + 0.1;
    seqTimer = setInterval(() => {
      if (next < ac.currentTime - 0.3) next = ac.currentTime + 0.05;
      while (next < ac.currentTime + 0.25) {
        const i = step % SONG;
        const t = next + (i % 2 ? song.cfg.swing * stepDur : 0);
        const L = song.lead[i];
        if (L) {
          note(L.m, t, L.len * stepDur * 0.95 + 0.05, song.cfg.lead, 0.2);
          note(L.m + 12, t, L.len * stepDur * 0.6 + 0.05, 'sine', 0.05);
        }
        const B = song.bass[i];
        if (B) note(B.m, t, B.len * stepDur * 0.9, 'triangle', 0.22);
        if (song.arp[i] !== null) note(song.arp[i], t, 0.14, 'sine', 0.05);
        if (i % 4 === 2) shaker(t, 0.035);
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
