'use strict';

// Bölümler elle çizilmiyor: her (tema, bölüm) için aynı tohumdan hep aynı bölüm üretiliyor.
// Zorluk bölüm numarasıyla ve tema ilerledikçe artar.
//
// Zıplama ölçüleri (game.js ile uyumlu): normal zıplama ~3.4 karo yükseğe, koşarak ~5 karo uzağa.
// Bu yüzden: basamak en fazla 2 karo yukarı, uçurum en fazla 4 karo.

function generateLevel(t, idx) {
  if (t === 0) return makeHub();
  const th = THEMES[t];
  const rng = mulberry32(t * 7919 + idx * 104729 + 12345);
  const R = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const ch = (p) => rng() < p;
  const diff = Math.min(1, (idx / 9) * 0.75 + ((t - 1) / 9) * 0.25);
  const W = 90 + idx * 8 + R(0, 12);

  const g = [];
  for (let y = 0; y < LH; y++) g.push(new Array(W).fill('.'));
  const L = { t, idx, w: W, h: LH, g, ents: [], plats: [], waterY: Infinity, start: null, diff };
  const put = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < LH) g[y][x] = c; };
  const banana = (x, y) => L.ents.push({ type: 'banana', x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
  const walker = (kind, x, row) => L.ents.push({ type: 'enemy', kind, x: x * TILE + TILE / 2, y: row * TILE, dir: ch(0.5) ? 1 : -1, alive: true });
  const flyer = (x, row) => L.ents.push({ type: 'enemy', kind: 'flyer', x: x * TILE + TILE / 2, y: row * TILE + TILE, alive: true, range: R(70, 140), sp: 0.7 + rng() * 0.6 });
  const floater = (x, row) => L.ents.push({ type: 'enemy', kind: 'floater', x: x * TILE + TILE / 2, y: row * TILE + TILE, alive: true, ph: rng() * 6 });

  if (th.underwater) { genUnderwater(L, rng, R, ch, put, banana, walker, flyer, floater); return L; }

  const ceil = th.cave ? 2 : 0;
  for (let y = 0; y < ceil; y++) for (let x = 0; x < W; x++) g[y][x] = '#';
  const maxGh = LH - ceil - 6;
  const T = (h) => LH - h; // zemin yüksekliği h iken en üst zemin karosunun satırı

  let x = 0, gh = 3, sinceCP = 0;
  const col = (cx, h) => { for (let y = LH - h; y < LH; y++) put(cx, y, '#'); };
  const flatRun = (n) => { for (let i = 0; i < n; i++) col(x + i, gh); x += n; sinceCP += n; };
  const pit = (n) => {
    for (let i = 0; i < n; i++) if (th.lava) { put(x + i, LH - 1, 'L'); put(x + i, LH - 2, 'L'); }
    x += n; sinceCP += n;
  };

  flatRun(7);
  L.start = { x: 2.5 * TILE, y: T(gh) * TILE };

  const weights = th.seg;
  const keys = Object.keys(weights);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  const pick = () => { let r = rng() * total; for (const k of keys) { r -= weights[k]; if (r <= 0) return k; } return keys[0]; };

  while (x < W - 18) {
    if (sinceCP > 32) {
      const cx = x;
      flatRun(3);
      L.ents.push({ type: 'cp', x: (cx + 1) * TILE + TILE / 2, y: T(gh) * TILE, on: false });
      sinceCP = 0;
      continue;
    }
    switch (pick()) {
      case 'flat': {
        const n = R(3, 6), gx = x;
        flatRun(n);
        if (ch(0.55)) for (let i = 1; i < n - 1; i++) banana(gx + i, T(gh) - 2);
        if (n >= 4 && ch(0.2 + diff * 0.5)) walker(ch(t === 4 ? 0.6 : 0.15) ? 'hopper' : 'walker', gx + R(1, n - 2), T(gh));
        if (ch(diff * 0.35)) flyer(gx + R(1, n - 1), Math.max(ceil + 1, T(gh) - 4));
        if (th.npc && ch(0.6)) L.ents.push({ type: 'npc', x: (gx + R(0, n - 1)) * TILE + 20, y: T(gh) * TILE, dir: ch(0.5) ? 1 : -1, look: R(0, 999) });
        break;
      }
      case 'step': {
        const up = ch(0.5);
        gh = clamp(gh + (up ? R(1, 2) : -R(1, th.npc ? 3 : 2)), 2, maxGh);
        flatRun(R(3, 5));
        break;
      }
      case 'gap': {
        const n = R(2, 2 + Math.round(diff * 2));
        const gh2 = clamp(gh + R(-2, n >= 4 ? 0 : 1), 2, maxGh); // uzun boşluğun karşısı yüksek olmasın
        const gx = x;
        pit(n);
        const arc = Math.max(ceil + 1, T(Math.max(gh, gh2)) - 3);
        for (let i = 0; i < n; i++) banana(gx + i, arc + (i === 0 || i === n - 1 ? 1 : 0));
        gh = gh2;
        flatRun(2);
        break;
      }
      case 'plats': {
        const n = R(5, 8), gx = x;
        pit(n);
        let px = gx + R(0, 1);
        let row = T(gh) - R(1, 2);
        while (px < gx + n - 1) {
          const pw = Math.min(R(2, 3), gx + n - px);
          for (let i = 0; i < pw; i++) put(px + i, row, '=');
          if (ch(0.7)) banana(px + Math.floor(pw / 2), row - 1);
          px += pw + R(1, 2);
          row = clamp(row + R(-1, 1), Math.max(ceil + 2, T(gh) - 3), T(gh) - 1);
        }
        if (ch(diff * 0.5)) flyer(gx + Math.floor(n / 2), Math.max(ceil + 1, T(gh) - 5));
        flatRun(2);
        break;
      }
      case 'mplat': {
        const n = R(6, 9), gx = x;
        pit(n);
        L.plats.push({ x: gx * TILE, y: T(gh) * TILE, w: 3 * TILE, h: 16, x0: gx * TILE, x1: (gx + n - 3) * TILE, sp: 70 + diff * 70, dir: 1, dx: 0 });
        for (let i = 1; i < n; i += 2) banana(gx + i, T(gh) - 2);
        flatRun(2);
        break;
      }
      case 'spikes': {
        const n = R(4, 6), gx = x;
        flatRun(n);
        const k = diff > 0.5 && ch(0.5) ? 2 : 1;
        const sx = gx + R(1, n - 1 - k);
        for (let i = 0; i < k; i++) { put(sx + i, T(gh) - 1, '^'); banana(sx + i, T(gh) - 3); }
        break;
      }
      case 'pond': {
        if (gh < 3) { gh = 3; flatRun(2); }
        const n = R(4, 7), gx = x;
        for (let i = 0; i < n; i++) {
          put(gx + i, LH - 1, '#');
          for (let y = T(gh); y < LH - 1; y++) put(gx + i, y, 'W');
        }
        x += n; sinceCP += n;
        banana(gx + R(1, n - 2), LH - 2);
        banana(gx + R(1, n - 2), LH - 3);
        flatRun(2);
        break;
      }
      case 'vine': {
        const gx = x;
        flatRun(5);
        const vt = Math.max(ceil + 1, T(gh) - 7);
        const vx = gx + 2;
        for (let y = vt + 1; y < T(gh); y++) put(vx, y, 'V');
        for (let i = -1; i <= 1; i++) { put(vx + i, vt, '='); banana(vx + i, vt - 1); }
        break;
      }
      case 'spring': {
        const gx = x;
        flatRun(5);
        put(gx + 1, T(gh) - 1, '*');
        const pr = Math.max(ceil + 2, T(gh) - 7);
        for (let i = 2; i <= 4; i++) { put(gx + i, pr, '='); banana(gx + i, pr - 1); }
        break;
      }
      case 'cracked': {
        if (gh < 3) gh = 3;
        const gx = x;
        flatRun(5);
        for (let i = 1; i <= 3; i++) { put(gx + i, T(gh), 'C'); put(gx + i, T(gh) + 1, 'p'); banana(gx + i, T(gh) + 1); }
        break;
      }
    }
  }

  while (x < W) { col(x, gh); x++; }
  L.ents.push({ type: 'goal', x: (W - 6) * TILE + TILE / 2, y: T(gh) * TILE });
  return L;
}

// Deniz teması: bütün bölüm su altında, tavan ve taban arasında yüzülen bir tünel.
function genUnderwater(L, rng, R, ch, put, banana, walker, flyer, floater) {
  const W = L.w, g = L.g;
  L.waterY = -99999;
  const floorH = [], ceilH = [];
  let fl = 2, ce = 2;
  for (let x = 0; x < W; x++) {
    if (x > 8 && x < W - 12 && x % 4 === 0) {
      fl = clamp(fl + R(-1, 1), 1, 5);
      ce = clamp(ce + R(-1, 1), 1, 4);
      while (LH - fl - ce < 7) { if (fl > 1) fl--; else ce--; }
    }
    floorH.push(fl); ceilH.push(ce);
    for (let y = 0; y < ce; y++) g[y][x] = '#';
    for (let y = LH - fl; y < LH; y++) g[y][x] = '#';
  }
  L.start = { x: 3 * TILE, y: (LH - floorH[3] - 3) * TILE };

  let since = 0;
  for (let x = 12; x < W - 14; x += R(4, 7)) {
    since += 5;
    const top = ceilH[x], bot = LH - floorH[x]; // açık alan: [top, bot)
    if (since > 32) {
      L.ents.push({ type: 'cp', x: x * TILE + TILE / 2, y: bot * TILE, on: false });
      since = 0;
      continue;
    }
    const r = rng();
    if (r < 0.22 && bot - top >= 7) {           // tabandan yükselen kaya
      const h = R(2, 3);
      for (let y = bot - h; y < bot; y++) put(x, y, '#');
      banana(x, bot - h - 1);
    } else if (r < 0.4 && bot - top >= 7) {     // tavandan sarkan kaya
      const h = R(2, 3);
      for (let y = top; y < top + h; y++) put(x, y, '#');
      banana(x, top + h);
    } else if (r < 0.6) {                        // deniz kestanesi
      put(x, bot - 1, '^');
      if (ch(0.5)) put(x + 1, bot - 1, '^');
      banana(x, bot - 3);
    } else {                                     // muz dizisi
      const mid = Math.floor((top + bot) / 2);
      for (let i = 0; i < 4; i++) banana(x + i, clamp(mid + Math.round(Math.sin(i) * 2), top + 1, bot - 2));
    }
    if (ch(0.3 + L.diff * 0.45)) floater(x + 2, Math.floor((top + bot) / 2));
    else if (ch(0.3 + L.diff * 0.3)) flyer(x + 2, Math.floor((top + bot) / 2) - 1);
    if (ch(0.25)) walker('walker', x + 1, bot);
  }
  L.ents.push({ type: 'goal', x: (W - 6) * TILE + TILE / 2, y: (LH - floorH[W - 6]) * TILE });
}

// Tema 0: karakter seçme odası. Seçilen hayvan suda yaşıyorsa oda suyla dolar.
function makeHub() {
  const W = 41;
  const g = [];
  for (let y = 0; y < LH; y++) g.push(new Array(W).fill('.'));
  for (let x = 0; x < W; x++) { g[0][x] = '#'; g[LH - 1][x] = '#'; g[LH - 2][x] = '#'; }
  for (let y = 0; y < LH; y++) { g[y][0] = '#'; g[y][W - 1] = '#'; }
  // birkaç eğlence platformu
  for (let x = 8; x <= 11; x++) g[8][x] = '=';
  for (let x = 16; x <= 19; x++) g[6][x] = '=';
  for (let x = 27; x <= 30; x++) g[7][x] = '=';

  const L = { t: 0, idx: 0, w: W, h: LH, g, ents: [], plats: [], waterY: LH * TILE + 200, hub: true, diff: 0 };
  L.start = { x: 4.5 * TILE, y: (LH - 2) * TILE };
  L.ents.push({ type: 'door', x: 1.6 * TILE, y: (LH - 2) * TILE });
  const floorY = (LH - 2) * TILE;
  LAND_FORMS.forEach((f, i) => L.ents.push({ type: 'statue', form: f, x: (7 + i * 3) * TILE, y: floorY }));
  WATER_FORMS.forEach((f, i) => L.ents.push({ type: 'statue', form: f, x: (26 + i * 3) * TILE, y: floorY }));
  L.ents.push({ type: 'sign', x: 14.5 * TILE, y: 3 * TILE, text: 'KARA HAYVANLARI' });
  L.ents.push({ type: 'sign', x: 32 * TILE, y: 3 * TILE, text: 'SU HAYVANLARI' });
  return L;
}
