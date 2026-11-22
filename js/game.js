'use strict';

// ======================================================================
//  Zıpzıp Goril - ana oyun
// ======================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VH = 600;          // mantıksal ekran yüksekliği = bir bölümün tam yüksekliği
let DPR = 1, SCALE = 1, VW = 1000;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * DPR);
  canvas.height = Math.round(innerHeight * DPR);
  SCALE = canvas.height / VH;
  VW = canvas.width / SCALE;
}
addEventListener('resize', resize);
resize();

const toLogical = (cx, cy) => ({ x: (cx * DPR) / SCALE, y: (cy * DPR) / SCALE });

// ---------- Kayıt (tarayıcıda saklanır) ----------
const SAVE_KEY = 'zipzip-goril-v1';
function defaultSave() {
  return { done: {}, best: {}, powers: [], land: 'goril', water: 'yunus', node: 0, muted: false };
}
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s) return Object.assign(defaultSave(), s);
  } catch (e) { /* kayıt okunamazsa baştan başla */ }
  return defaultSave();
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* gizli pencere vb. */ }
}

const G = {
  state: 'title',
  time: 0,
  save: loadSave(),
  level: null, lv: null, p: null,
  camX: 0, parts: [], projs: [], shake: 0, fade: 0,
  banner: null, toast: null,
  map: { node: 0, anim: null, camX: 0 },
  pauseSel: 0, cmp: null, hubForm: 'goril', musicTheme: -1,
};
Sound.setMuted(G.save.muted);

const has = (pw) => G.save.powers.includes(pw);
const maxHearts = () => (has('heart') ? 4 : 3);

function setState(s) {
  G.state = s;
  document.body.classList.toggle('st-level', s === 'level');
  Input.allowMouse = s === 'level';
}

function playMusic(t) {
  if (G.musicTheme === t) return;
  G.musicTheme = t;
  Sound.startMusic(t);
}

function showBanner(title, sub, dur) { G.banner = { title, sub: sub || '', t: dur || 3.5 }; }
function showToast(text) { G.toast = { text, t: 2.5 }; }

function toggleMute() {
  G.save.muted = !G.save.muted;
  Sound.setMuted(G.save.muted);
  persist();
}

function toggleFullscreen() {
  const d = document, el = d.documentElement;
  try {
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) return;
      const pr = req.call(el);
      if (pr && pr.then) pr.then(() => {
        try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* desteklenmiyor */ }
      }).catch(() => {});
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    }
  } catch (e) { /* tam ekran desteklenmiyor */ }
}

// ======================================================================
//  Dünya haritası
// ======================================================================
const nodeIndex = (t, i) => (t === 0 ? 0 : 1 + (t - 1) * 10 + i);
const MAP_NODES = [];
const ZONE_EDGES = [];
let MAP_W = 0;
(function buildMap() {
  let x = 220;
  MAP_NODES.push({ t: 0, i: 0, x, y: 330 });
  x += 240;
  for (let t = 1; t <= 10; t++) {
    for (let i = 0; i < 10; i++) {
      MAP_NODES.push({ t, i, x, y: 330 + Math.sin(i * 0.75 + t * 1.7) * 100 });
      x += 115;
    }
    x += 160;
  }
  MAP_W = x + 40;
  ZONE_EDGES.push(0);
  for (let t = 1; t <= 10; t++) {
    const prev = MAP_NODES[t === 1 ? 0 : nodeIndex(t - 1, 9)], first = MAP_NODES[nodeIndex(t, 0)];
    ZONE_EDGES.push((prev.x + first.x) / 2);
  }
  ZONE_EDGES.push(MAP_W);
})();

const levelKey = (t, i) => t + '-' + i;
function isUnlocked(n) {
  const nd = MAP_NODES[n];
  if (!nd) return false;
  if (nd.t === 0 || nd.i === 0) return true;
  return !!G.save.done[levelKey(nd.t, nd.i - 1)];
}
const isDone = (n) => { const nd = MAP_NODES[n]; return nd.t > 0 && !!G.save.done[levelKey(nd.t, nd.i)]; };

function mapPlayerPos() {
  const M = G.map;
  if (!M.anim) { const nd = MAP_NODES[M.node]; return { x: nd.x, y: nd.y }; }
  const a = MAP_NODES[M.anim.from], b = MAP_NODES[M.anim.to], k = M.anim.k;
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) - Math.sin(Math.PI * k) * M.anim.hop };
}

function mapMoveTo(n, dur, hop) {
  const M = G.map;
  if (n === M.node || !isUnlocked(n)) return;
  M.anim = { from: M.node, to: n, k: 0, dur, hop };
  M.facing = MAP_NODES[n].x >= MAP_NODES[M.node].x ? 1 : -1;
}

function mapJumpTheme(d) {
  const cur = MAP_NODES[G.map.node].t;
  const nt = clamp(cur + d, 0, 10);
  if (nt === cur) return;
  let target = 0;
  if (nt > 0) {
    target = nodeIndex(nt, 0);
    for (let i = 9; i >= 0; i--) if (isUnlocked(nodeIndex(nt, i))) { target = nodeIndex(nt, i); break; }
  }
  mapMoveTo(target, 0.55, 140);
  Sound.sfx.select();
}

function enterNode(n) {
  if (!isUnlocked(n)) return;
  const nd = MAP_NODES[n];
  G.save.node = n;
  persist();
  startLevel(nd.t, nd.i);
}

function goToMap() {
  G.map.node = G.save.node;
  G.map.anim = null;
  G.map.camX = clamp(MAP_NODES[G.map.node].x - VW / 2, 0, Math.max(0, MAP_W - VW));
  G.fade = 0.6;
  setState('map');
  playMusic(MAP_NODES[G.map.node].t);
}

function updateMap(dt) {
  const M = G.map, I = Input;
  if (M.anim) {
    M.anim.k += dt / M.anim.dur;
    if (M.anim.k >= 1) {
      M.node = M.anim.to; M.anim = null;
      G.save.node = M.node; persist();
      playMusic(MAP_NODES[M.node].t);
    }
  }
  if (!M.anim) {
    if (I.held.right) mapMoveTo(M.node + 1, 0.22, 14);
    else if (I.held.left) mapMoveTo(M.node - 1, 0.22, 14);
    else if (I.pressed.up || I.pressed.nextTheme) mapJumpTheme(1);
    else if (I.pressed.down || I.pressed.prevTheme) mapJumpTheme(-1);
    else if (I.pressed.jump || I.pressed.confirm || I.pressed.attack) enterNode(M.node);
    else if (I.pressed.pause) { setState('title'); }
  }
  const pos = mapPlayerPos();
  const target = clamp(pos.x - VW / 2, 0, Math.max(0, MAP_W - VW));
  M.camX += (target - M.camX) * Math.min(1, dt * 6);
}

function mapClick(l) {
  const wx = l.x + G.map.camX;
  for (let n = 0; n < MAP_NODES.length; n++) {
    const nd = MAP_NODES[n];
    if (Math.hypot(nd.x - wx, nd.y - l.y) < 34) {
      if (n === G.map.node && !G.map.anim) enterNode(n);
      else if (isUnlocked(n)) {
        const dist = Math.abs(nd.x - MAP_NODES[G.map.node].x);
        mapMoveTo(n, Math.min(0.9, 0.2 + dist / 2500), Math.min(160, 14 + dist / 10));
      } else showToast('🔒 Önce önceki bölümü bitir');
      return;
    }
  }
}

// ======================================================================
//  Bölüm
// ======================================================================
function makePlayer(x, y) {
  return {
    x, y, w: 28, h: 36, vx: 0, vy: 0, prevY: y, facing: 1, onGround: false, coyote: 0, jumpBuf: 0,
    airJumps: 0, airDash: true, dashT: 0, dashCD: 0, pound: false, attackT: 0, attackCD: 0,
    inv: 0, hearts: maxHearts(), climbing: false, inWater: false, form: G.save.land,
    ctrlLock: 0, plat: null, squash: 0, gliding: false, isPlayer: true,
  };
}

function startLevel(t, i) {
  const L = generateLevel(t, i);
  G.level = L;
  G.lv = { t, i, bananas: 0, total: L.ents.filter((e) => e.type === 'banana').length, respawn: { x: L.start.x, y: L.start.y }, dead: 0, near: null };
  G.p = makePlayer(L.start.x, L.start.y);
  G.parts = []; G.projs = []; G.shake = 0; G.fade = 1;
  if (L.hub) G.hubForm = G.save.land;
  G.p.inWater = isWaterAt(G.p.x, G.p.y - G.p.h / 2);
  G.p.form = L.hub ? G.hubForm : (G.p.inWater ? G.save.water : G.save.land);
  G.camX = camTarget();

  const pw = THEMES[t].power;
  if (pw && !has(pw)) {
    G.save.powers.push(pw);
    persist();
    G.p.hearts = maxHearts();
    showBanner('YENİ GÜÇ: ' + POWERS[pw].icon + ' ' + POWERS[pw].name, POWERS[pw].help, 5);
    setTimeout(() => Sound.sfx.power(), 300);
  } else if (L.hub) {
    showBanner('🎭 Karakter Dünyası', 'Bir hayvana yaklaş, ↑ ya da 👊 ile seç', 4);
  } else {
    showBanner(`${t}-${i + 1}  ${THEMES[t].icon} ${THEMES[t].name}`, '', 2);
  }
  playMusic(t);
  setState('level');
}

function tileAt(tx, ty) {
  const L = G.level;
  if (tx < 0 || tx >= L.w) return '#';
  if (ty < 0 || ty >= L.h) return '.';
  return L.g[ty][tx];
}

function isWaterAt(x, y) {
  const L = G.level;
  if (y >= L.waterY) return true;
  return tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 'W';
}

function overlapsTile(e, c) {
  const tx0 = Math.floor((e.x - e.w / 2) / TILE), tx1 = Math.floor((e.x + e.w / 2 - 0.01) / TILE);
  const ty0 = Math.floor((e.y - e.h) / TILE), ty1 = Math.floor((e.y - 0.01) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (tileAt(tx, ty) === c) return { tx, ty };
  return null;
}

// Kutu ile karo dünyası arası çarpışma. e.x = orta, e.y = ayak hizası.
function moveEntity(e, dx, dy) {
  if (dx !== 0) {
    e.x += dx;
    e.hitWall = 0;
    const ty0 = Math.floor((e.y - e.h + 1) / TILE), ty1 = Math.floor((e.y - 1) / TILE);
    if (dx > 0) {
      const tx = Math.floor((e.x + e.w / 2) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) if (SOLID[tileAt(tx, ty)]) { e.x = tx * TILE - e.w / 2 - 0.01; e.vx = 0; e.hitWall = 1; break; }
    } else {
      const tx = Math.floor((e.x - e.w / 2) / TILE);
      for (let ty = ty0; ty <= ty1; ty++) if (SOLID[tileAt(tx, ty)]) { e.x = (tx + 1) * TILE + e.w / 2 + 0.01; e.vx = 0; e.hitWall = -1; break; }
    }
  }
  if (dy !== 0) {
    const prevB = e.y;
    e.y += dy;
    e.onGround = false; e.groundTile = null; e.plat = null;
    const tx0 = Math.floor((e.x - e.w / 2 + 1) / TILE), tx1 = Math.floor((e.x + e.w / 2 - 1) / TILE);
    if (dy > 0) {
      const ty = Math.floor(e.y / TILE);
      for (let tx = tx0; tx <= tx1; tx++) {
        const c = tileAt(tx, ty);
        if (SOLID[c] || (c === '=' && prevB <= ty * TILE + 0.5 && !e.dropping)) {
          e.y = ty * TILE; e.vy = 0; e.onGround = true; e.groundTile = c; break;
        }
      }
      if (!e.onGround && e.isPlayer) {
        const l = e.x - e.w / 2, r = e.x + e.w / 2;
        for (const pl of G.level.plats) {
          if (prevB <= pl.y + 0.5 && e.y >= pl.y && r > pl.x && l < pl.x + pl.w) {
            e.y = pl.y; e.vy = 0; e.onGround = true; e.plat = pl; break;
          }
        }
      }
    } else {
      const ty = Math.floor((e.y - e.h) / TILE);
      for (let tx = tx0; tx <= tx1; tx++) if (SOLID[tileAt(tx, ty)]) { e.y = (ty + 1) * TILE + e.h; e.vy = 0; break; }
    }
  }
}

function wallContact(p) {
  const ty0 = Math.floor((p.y - p.h + 4) / TILE), ty1 = Math.floor((p.y - 4) / TILE);
  const txR = Math.floor((p.x + p.w / 2 + 2) / TILE), txL = Math.floor((p.x - p.w / 2 - 2) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    if (SOLID[tileAt(txR, ty)]) return 1;
    if (SOLID[tileAt(txL, ty)]) return -1;
  }
  return 0;
}

const rectHit = (a, b, shrink) => {
  const s = shrink || 0;
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - s && a.y - a.h + s < b.y && b.y - b.h + s < a.y;
};

function burst(x, y, col, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (speed || 200) * (0.4 + Math.random() * 0.8);
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, max: 0.9, col, r: 3 + Math.random() * 3 });
  }
}

// ---------- Oyuncu fiziği ----------
function stepPlayer(h) {
  const p = G.p, L = G.level, th = THEMES[L.t], I = Input;
  const ix = (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0);
  const iy = (I.held.down ? 1 : 0) - (I.held.up ? 1 : 0);

  const wasInWater = p.inWater;
  p.inWater = isWaterAt(p.x, p.y - p.h / 2);
  if (p.inWater && !wasInWater) {
    p.vy *= 0.35; p.pound = false; p.dashT = 0; p.climbing = false;
    burst(p.x, p.y - p.h / 2, 'rgba(200,235,255,0.9)', 10, 160);
    Sound.sfx.splash();
  }

  // Suya girince son seçilen su hayvanına, çıkınca son kara hayvanına dönüş
  const want = L.hub ? G.hubForm : (p.inWater ? G.save.water : G.save.land);
  if (want !== p.form) {
    p.form = want;
    burst(p.x, p.y - p.h / 2, '#ffffff', 14, 180);
    Sound.sfx.morph();
  }
  const fish = isWaterForm(p.form);

  p.inv -= h; p.dashCD -= h; p.attackCD -= h; p.attackT -= h; p.ctrlLock -= h;
  p.squash = Math.max(0, p.squash - h * 5);
  if (I.pressed.jump) p.jumpBuf = 0.13; else p.jumpBuf -= h;
  if (ix && p.ctrlLock <= 0 && p.dashT <= 0) p.facing = ix;

  // yumruk / kabarcık
  if (I.pressed.attack && p.attackCD <= 0 && !(L.hub && G.lv.near)) {
    if (p.inWater && has('bubble')) {
      G.projs.push({ x: p.x + p.facing * 22, y: p.y - p.h / 2, vx: p.facing * 520, life: 1.1 });
      p.attackCD = 0.3;
      Sound.sfx.bubble();
    } else {
      p.attackT = 0.22; p.attackCD = 0.32;
      Sound.sfx.punch();
    }
  }

  if (p.climbing) {
    if (!overlapsTile(p, 'V')) {
      p.climbing = false;
      if (iy < 0) p.vy = -520; // sarmaşığın tepesinden platforma hop
    } else {
      p.vx = ix * 170; p.vy = iy * 170;
      if (p.jumpBuf > 0) { p.jumpBuf = 0; p.climbing = false; p.vy = -650; p.vx = ix * 260; Sound.sfx.jump(); }
    }
  } else if (p.inWater) {
    p.onGround = false;
    const headClear = !isWaterAt(p.x, p.y - p.h - 4);
    if (fish) {
      const max = 300, acc = 1500;
      const uy = I.held.jump ? -1 : iy;
      p.vx = approach(p.vx, ix * max, acc * h);
      p.vy = approach(p.vy, uy * max, acc * h);
      if (headClear && p.vy < 0) { // su hayvanı karaya çıkamaz; yukarı basılıyken yüzeye gelince yunus gibi fırlar
        if (uy < 0) {
          p.vy = -760; p.jumpBuf = 0;
          burst(p.x, p.y - p.h / 2, 'rgba(200,235,255,0.9)', 10, 160);
          Sound.sfx.splash();
        } else p.vy = 0;
      }
    } else {
      // kara hayvanları suda hantal
      p.vx = approach(p.vx, ix * 140, 700 * h);
      p.vy = Math.min(p.vy + 500 * h, 160);
      if (iy < 0) p.vy = approach(p.vy, -130, 900 * h);
      if (p.jumpBuf > 0) {
        p.jumpBuf = 0;
        if (headClear) { p.vy = -640; Sound.sfx.splash(); } else { p.vy = -260; Sound.sfx.bubble(); }
      }
    }
    if (Math.random() < h * 4) G.parts.push({ x: p.x + p.facing * 12, y: p.y - p.h, vx: 0, vy: -60, life: 1, max: 1, col: 'rgba(255,255,255,0.6)', r: 3, bubble: true });
  } else {
    const grav = 2200 * (th.grav || 1);
    const jv = 780 * ((th.grav || 1) < 1 ? 0.85 : 1);
    if (p.onGround) { p.coyote = 0.1; p.airJumps = has('double') ? 1 : 0; p.airDash = true; } else p.coyote -= h;

    if (p.dashT > 0) {
      p.dashT -= h; p.vx = p.facing * 720; p.vy = 0;
      if (Math.random() < 0.5) G.parts.push({ x: p.x - p.facing * 14, y: p.y - 18, vx: -p.facing * 60, vy: 0, life: 0.3, max: 0.3, col: 'rgba(255,255,255,0.7)', r: 6 });
      if (p.dashT <= 0) p.vx = p.facing * 300;
    } else if (p.pound) {
      p.vx = 0; p.vy = 1100;
    } else {
      const maxS = 280 * (has('speed') ? 1.3 : 1);
      const ice = th.ice && p.onGround;
      if (p.ctrlLock <= 0) {
        if (ix) p.vx = approach(p.vx, ix * maxS, (p.onGround ? (ice ? 900 : 3200) : 2000) * h);
        else p.vx = approach(p.vx, 0, (p.onGround ? (ice ? 450 : 3000) : 700) * h);
      }
      p.vy += grav * h;
      p.gliding = has('glide') && I.held.jump && p.vy > 0 && !p.onGround;
      if (p.gliding) p.vy = Math.min(p.vy, 110);
      const wall = has('wall') && !p.onGround ? wallContact(p) : 0;
      if (wall && ix === wall && p.vy > 140) p.vy = 140;
      p.vy = Math.min(p.vy, 950);

      if (p.jumpBuf > 0) {
        if (p.coyote > 0) {
          p.vy = -jv; p.coyote = 0; p.jumpBuf = 0; p.onGround = false; p.plat = null;
          Sound.sfx.jump();
        } else if (wall) {
          p.vy = -jv * 0.92; p.vx = -wall * 380; p.facing = -wall; p.ctrlLock = 0.17; p.jumpBuf = 0;
          Sound.sfx.jump();
        } else if (p.airJumps > 0) {
          p.airJumps--; p.vy = -jv * 0.88; p.jumpBuf = 0;
          burst(p.x, p.y, '#ffffff', 8, 120);
          Sound.sfx.double();
        }
      }
      if (I.released.jump && p.vy < -250) p.vy *= 0.5;
      if (has('dash') && I.pressed.power && p.dashCD <= 0 && (p.onGround || p.airDash)) {
        p.dashT = 0.17; p.dashCD = 0.5;
        if (!p.onGround) p.airDash = false;
        Sound.sfx.dash();
      }
      if (has('pound') && I.pressed.down && !p.onGround && p.coyote <= 0) { p.pound = true; p.vy = 0; }
    }
  }

  if (has('climb') && !p.climbing && !p.inWater && (iy < 0 || (iy > 0 && !p.onGround)) && overlapsTile(p, 'V')) {
    p.climbing = true; p.pound = false; p.dashT = 0; p.vx = 0; p.vy = 0;
  }

  // hareket
  const wasGround = p.onGround;
  p.prevY = p.y;
  moveEntity(p, p.vx * h, p.vy * h);
  if (p.climbing || p.inWater) p.onGround = false;

  if (p.onGround && !wasGround) {
    p.squash = 1;
    if (p.pound) doPound();
  }
  if (p.onGround && p.groundTile === '*') {
    p.vy = -1150 * ((th.grav || 1) < 1 ? 0.8 : 1);
    p.onGround = false; p.squash = 1; p.airJumps = has('double') ? 1 : 0;
    Sound.sfx.spring();
    burst(p.x, p.y, '#ff6b6b', 8, 150);
  }

  // tehlikeler
  if (overlapsTile(p, 'L')) { killPlayer(); return; }
  if (p.y - p.h > LH * TILE + 40) { killPlayer(); return; }
  const sp = overlapsTile(p, '^');
  if (sp) {
    const sx = sp.tx * TILE + 4, sy = sp.ty * TILE + 16;
    if (p.x + p.w / 2 > sx && p.x - p.w / 2 < sx + TILE - 8 && p.y > sy) hurt(sx + TILE / 2);
  }
}

function doPound() {
  const p = G.p, L = G.level;
  p.pound = false;
  G.shake = 12;
  Sound.sfx.pound();
  burst(p.x, p.y, '#ffe9a0', 16, 260);
  const ty = Math.floor(p.y / TILE);
  const tx0 = Math.floor((p.x - p.w / 2) / TILE) - 1, tx1 = Math.floor((p.x + p.w / 2) / TILE) + 1;
  let broke = false;
  for (let tx = tx0; tx <= tx1; tx++) {
    if (tileAt(tx, ty) === 'C') {
      L.g[ty][tx] = '.';
      burst(tx * TILE + 20, ty * TILE + 20, THEMES[L.t].dark, 12, 220);
      broke = true;
    }
  }
  if (broke) { Sound.sfx.break(); p.onGround = false; }
  for (const e of L.ents) if (e.type === 'enemy' && e.alive && Math.abs(e.x - p.x) < 110 && Math.abs(e.y - p.y) < 30) killEnemy(e);
}

function hurt(fromX) {
  const p = G.p;
  if (p.inv > 0 || p.dashT > 0 || G.lv.dead > 0) return;
  p.hearts--;
  p.inv = 1.6;
  p.vy = -450;
  p.vx = (p.x < fromX ? -1 : 1) * 240;
  p.ctrlLock = 0.2;
  p.pound = false; p.climbing = false;
  G.shake = 8;
  Sound.sfx.hurt();
  if (p.hearts <= 0) { G.lv.dead = 1.0; burst(p.x, p.y - 18, '#ffffff', 20, 260); }
}

function killPlayer() {
  const p = G.p;
  if (G.lv.dead > 0) return;
  p.hearts--;
  G.lv.dead = 0.9;
  G.shake = 10;
  Sound.sfx.die();
  burst(p.x, Math.min(p.y, LH * TILE) - 18, '#ffffff', 20, 260);
}

function respawn() {
  const p = G.p, r = G.lv.respawn;
  p.x = r.x; p.y = r.y; p.vx = 0; p.vy = 0;
  p.inv = 1.5; p.climbing = false; p.pound = false; p.dashT = 0;
  if (p.hearts <= 0) p.hearts = maxHearts();
  G.fade = 0.7;
  G.camX = camTarget();
}

function killEnemy(e) {
  if (!e.alive) return;
  e.alive = false; e.deadT = 0.6; e.vy = -350;
  burst(e.x, e.y - 15, '#ffffff', 10, 200);
  Sound.sfx.stomp();
}

const NPC_LINES = ['Merhaba!', 'Vay, bir goril!', 'Ne güzel zıplıyorsun!', 'Muz ister misin?', 'Dikkat et!', 'Selam!', 'Bugün hava güzel!'];
const NPC_FORM_LINES = { inek: 'Bir inek mi?!', kurbaga: 'Vırak vırak!', insan: 'Selam komşu!', panter: 'Aa, panter!', maymun: 'Maymun!' };

function stepEnt(e, h) {
  const p = G.p, L = G.level, lv = G.lv, th = THEMES[L.t];
  const alive = lv.dead <= 0;
  switch (e.type) {
    case 'banana': {
      if (e.got || !alive) return;
      const dx = p.x - e.x, dy = p.y - p.h / 2 - e.y;
      const d2 = dx * dx + dy * dy;
      if (has('magnet') && d2 < 170 * 170) {
        const d = Math.sqrt(d2) || 1;
        e.x += (dx / d) * 600 * h; e.y += (dy / d) * 600 * h;
      }
      if (d2 < 32 * 32) {
        e.got = true; lv.bananas++;
        burst(e.x, e.y, '#ffd83a', 6, 140);
        Sound.sfx.banana();
      }
      return;
    }
    case 'enemy': {
      if (!e.alive) {
        if (e.deadT > 0) { e.deadT -= h; e.vy += 1500 * h; e.y += e.vy * h; }
        return;
      }
      e.t = (e.t || 0) + h;
      if (e.kind === 'walker' || e.kind === 'hopper') {
        e.w = 34; e.h = 30;
        const sp = 55 + L.diff * 45;
        e.vx = e.dir * sp;
        e.vy = (e.vy || 0) + (th.underwater ? 600 : 2200 * (th.grav || 1)) * h;
        if (e.kind === 'hopper' && e.onGround) {
          e.hopT = (e.hopT === undefined ? 1.2 : e.hopT) - h;
          if (e.hopT <= 0) { e.vy = -620; e.hopT = 1.4; }
        }
        moveEntity(e, e.vx * h, e.vy * h);
        if (e.hitWall) e.dir *= -1;
        else if (e.onGround) {
          const ax = e.x + e.dir * (e.w / 2 + 3);
          const c = tileAt(Math.floor(ax / TILE), Math.floor((e.y + 4) / TILE));
          if (!SOLID[c] && c !== '=') e.dir *= -1;
        }
        if (e.y > LH * TILE + 100) e.alive = false;
      } else if (e.kind === 'flyer') {
        e.w = 34; e.h = 28;
        if (e.x0 === undefined) { e.x0 = e.x; e.y0 = e.y; }
        e.x = e.x0 + Math.sin(e.t * e.sp) * e.range;
        e.y = e.y0 + Math.sin(e.t * 3) * 14;
        e.dir = Math.cos(e.t * e.sp) >= 0 ? 1 : -1;
      } else if (e.kind === 'floater') {
        e.w = 30; e.h = 34;
        if (e.y0 === undefined) e.y0 = e.y;
        e.y = e.y0 + Math.sin(e.t * 1.4 + e.ph) * 60;
        e.dir = p.x > e.x ? 1 : -1;
      }
      if (!alive) return;
      // yumruk
      if (p.attackT > 0.03) {
        const px0 = p.facing > 0 ? p.x : p.x - 52;
        if (e.x + e.w / 2 > px0 && e.x - e.w / 2 < px0 + 52 && e.y - e.h < p.y && e.y > p.y - p.h - 6) { killEnemy(e); return; }
      }
      if (rectHit(p, e, 4)) {
        if (p.dashT > 0 || p.pound) { killEnemy(e); return; }
        if (!p.inWater && p.vy > 0 && p.prevY <= e.y - e.h * 0.45) {
          killEnemy(e);
          p.vy = Input.held.jump ? -720 : -480;
          if (has('double')) p.airJumps = 1;
          return;
        }
        hurt(e.x);
      }
      return;
    }
    case 'npc': {
      e.w = 22; e.h = 50;
      e.vy = (e.vy || 0) + 2200 * h;
      moveEntity(e, e.dir * 40 * h, e.vy * h);
      if (e.hitWall) e.dir *= -1;
      else if (e.onGround) {
        const c = tileAt(Math.floor((e.x + e.dir * 14) / TILE), Math.floor((e.y + 4) / TILE));
        if (!SOLID[c]) e.dir *= -1;
      }
      e.sayT = (e.sayT || 0) - h;
      if (alive && e.sayT < -1 && rectHit(p, e, -10)) {
        e.say = NPC_FORM_LINES[p.form] && Math.random() < 0.5 ? NPC_FORM_LINES[p.form] : NPC_LINES[Math.floor(Math.random() * NPC_LINES.length)];
        e.sayT = 2.2;
      }
      return;
    }
    case 'cp':
      if (!e.on && alive && Math.abs(p.x - e.x) < 30 && p.y > e.y - 80 && p.y < e.y + 10) {
        e.on = true;
        lv.respawn = { x: e.x, y: e.y };
        p.hearts = Math.max(p.hearts, maxHearts());
        burst(e.x, e.y - 60, '#3fd16a', 14, 200);
        Sound.sfx.checkpoint();
      }
      return;
    case 'goal':
      if (alive && Math.abs(p.x - e.x) < 36 && p.y > e.y - 120 && p.y <= e.y + 10) completeLevel();
      return;
    case 'door':
      if (alive && Math.abs(p.x - e.x) < 26 && p.y > e.y - 80) goToMap();
      return;
    case 'statue': {
      const near = Math.abs(p.x - e.x) < 36 && p.y - e.y > -110 && p.y - e.y < 20;
      if (near) lv.near = e;
      else if (lv.near === e) lv.near = null;
      if (near && alive && (Input.pressed.attack || (Input.pressed.up && !p.inWater))) {
        if (G.hubForm === e.form) return;
        G.hubForm = e.form;
        if (isWaterForm(e.form)) G.save.water = e.form; else G.save.land = e.form;
        persist();
        showToast(`${FORM_NAMES[e.form]} seçildi!`);
      }
      return;
    }
  }
}

function stepLevel(h) {
  const L = G.level, lv = G.lv;
  for (const pl of L.plats) {
    const ox = pl.x;
    pl.x += pl.dir * pl.sp * h;
    if (pl.x >= pl.x1) { pl.x = pl.x1; pl.dir = -1; } else if (pl.x <= pl.x0) { pl.x = pl.x0; pl.dir = 1; }
    pl.dx = pl.x - ox;
    if (G.p.plat === pl && lv.dead <= 0) { const keep = pl; moveEntity(G.p, pl.dx, 0); G.p.plat = keep; }
  }
  if (L.hub) {
    const target = isWaterForm(G.hubForm) ? 1.5 * TILE : LH * TILE + 200;
    L.waterY = approach(L.waterY, target, 320 * h);
  }
  if (lv.dead > 0) { lv.dead -= h; if (lv.dead <= 0) respawn(); }
  else stepPlayer(h);
  if (G.state !== 'level') return;
  for (const e of L.ents) { stepEnt(e, h); if (G.state !== 'level') return; }

  for (const b of G.projs) {
    b.x += b.vx * h; b.life -= h;
    if (SOLID[tileAt(Math.floor(b.x / TILE), Math.floor(b.y / TILE))]) b.life = 0;
    for (const e of L.ents) {
      if (e.type === 'enemy' && e.alive && Math.abs(e.x - b.x) < e.w / 2 + 8 && b.y > e.y - e.h - 8 && b.y < e.y + 8) { killEnemy(e); b.life = 0; break; }
    }
    if (b.life <= 0) burst(b.x, b.y, 'rgba(200,240,255,0.9)', 5, 100);
  }
  G.projs = G.projs.filter((b) => b.life > 0);
}

function camTarget() {
  const L = G.level, p = G.p, lw = L.w * TILE;
  if (lw <= VW) return (lw - VW) / 2;
  return clamp(p.x - VW * 0.4 + p.facing * 60, 0, lw - VW);
}

function updateLevel(dt) {
  if (Input.pressed.pause) { setState('pause'); G.pauseSel = 0; return; }
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    stepLevel(h);
    if (i === 0) Input.clearEdges();
    if (G.state !== 'level') return;
  }
  G.camX += (camTarget() - G.camX) * Math.min(1, dt * 6);
}

function completeLevel() {
  const lv = G.lv;
  const key = levelKey(lv.t, lv.i);
  G.save.done[key] = true;
  G.save.best[key] = Math.max(G.save.best[key] || 0, lv.bananas);
  if (lv.i < 9) G.save.node = nodeIndex(lv.t, lv.i + 1);
  persist();
  G.cmp = { t: 0 };
  setState('complete');
  Sound.sfx.win();
  burst(G.p.x, G.p.y - 40, '#ffd83a', 40, 380);
}

function updateComplete(dt) {
  G.cmp.t += dt;
  const I = Input;
  if (G.cmp.t > 1 && (I.pressed.jump || I.pressed.confirm || I.pressed.attack)) goToMap();
  else if (G.cmp.t > 6) goToMap();
}

// ---------- Duraklatma menüsü ----------
const PAUSE_ITEMS = [['resume', 'Devam Et'], ['restart', 'Yeniden Başlat'], ['tomap', 'Haritaya Dön'], ['mute', 'Ses']];

function updatePause() {
  const I = Input;
  if (I.pressed.pause) { setState('level'); return; }
  if (I.pressed.down) { G.pauseSel = (G.pauseSel + 1) % PAUSE_ITEMS.length; Sound.sfx.select(); }
  if (I.pressed.up) { G.pauseSel = (G.pauseSel + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length; Sound.sfx.select(); }
  if (I.pressed.jump || I.pressed.confirm || I.pressed.attack) onButton(PAUSE_ITEMS[G.pauseSel][0]);
}

function onButton(id) {
  switch (id) {
    case 'start': goToMap(); break;
    case 'pause': if (G.state === 'level') { setState('pause'); G.pauseSel = 0; } break;
    case 'resume': setState('level'); break;
    case 'restart': startLevel(G.lv.t, G.lv.i); break;
    case 'tomap': goToMap(); break;
    case 'mute': toggleMute(); break;
    case 'prevT': if (!G.map.anim) mapJumpTheme(-1); break;
    case 'nextT': if (!G.map.anim) mapJumpTheme(1); break;
    case 'play': if (!G.map.anim) enterNode(G.map.node); break;
    case 'continue': goToMap(); break;
    case 'reset':
      if (confirm('Tüm ilerleme silinsin mi?')) { G.save = defaultSave(); persist(); Sound.setMuted(false); }
      break;
  }
}

// ======================================================================
//  Ana döngü
// ======================================================================
let UI = [];
function hitUI(x, y) {
  for (let i = UI.length - 1; i >= 0; i--) {
    const b = UI[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

Input.setupPointer(canvas);
Input.setupTouch();
Input.onPointerDown = (cx, cy) => {
  const l = toLogical(cx, cy);
  const b = hitUI(l.x, l.y);
  if (b && b.id === 'fs') toggleFullscreen(); // tam ekran sadece dokunma/tıklama anında açılabilir
};
Input.onGamepad = (id) => showToast('🎮 Oyun kolu bağlandı!' + (id.toLowerCase().includes('dualsense') ? ' (PS5)' : ''));

function update(dt) {
  G.time += dt;
  for (const c of Input.takeClicks()) {
    const l = toLogical(c.x, c.y);
    const b = hitUI(l.x, l.y);
    if (b) { if (b.id !== 'fs') onButton(b.id); continue; }
    if (G.state === 'map') mapClick(l);
    else if (G.state === 'title') onButton('start');
    else if (G.state === 'complete' && G.cmp.t > 1) goToMap();
  }
  if (Input.pressed.mute) toggleMute();
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  if (G.toast) { G.toast.t -= dt; if (G.toast.t <= 0) G.toast = null; }
  G.fade = Math.max(0, G.fade - dt * 2);
  G.shake = Math.max(0, G.shake - dt * 30);

  switch (G.state) {
    case 'title':
      if (Input.pressed.jump || Input.pressed.confirm || Input.pressed.attack) onButton('start');
      break;
    case 'map': updateMap(dt); break;
    case 'level': updateLevel(dt); break;
    case 'pause': updatePause(); break;
    case 'complete': updateComplete(dt); break;
  }

  for (const q of G.parts) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (!q.bubble) q.vy += 500 * dt;
  }
  G.parts = G.parts.filter((q) => q.life > 0);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  Input.update();
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

// ======================================================================
//  Çizim
// ======================================================================
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

function text(str, x, y, size, col, align, stroke) {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  if (stroke !== false) {
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeStyle = stroke || 'rgba(0,0,0,0.6)';
    ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = col || '#fff';
  ctx.fillText(str, x, y);
}

function uiButton(id, x, y, w, h, label, opt) {
  opt = opt || {};
  UI.push({ id, x, y, w, h });
  ctx.save();
  rrect(ctx, x, y, w, h, opt.r || 14);
  ctx.fillStyle = opt.color || 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.lineWidth = opt.sel ? 4 : 2;
  ctx.strokeStyle = opt.sel ? '#ffd83a' : 'rgba(255,255,255,0.75)';
  ctx.stroke();
  ctx.restore();
  text(label, x + w / 2, y + h / 2 + 1, opt.size || 22, opt.textCol || '#fff', 'center', false);
}

function drawHeart(x, y, full) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1.3, 1.3);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-14, -4, -8, -14, 0, -7);
  ctx.bezierCurveTo(8, -14, 14, -4, 0, 6);
  ctx.fillStyle = full ? '#ff4d6d' : 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
}

function draw() {
  UI = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1b1b2f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  switch (G.state) {
    case 'title': drawTitle(); break;
    case 'map': drawMap(); break;
    case 'level': drawLevel(); drawHUD(); break;
    case 'pause': drawLevel(); drawHUD(); drawPause(); break;
    case 'complete': drawLevel(); drawComplete(); break;
  }

  if (G.banner) {
    const b = G.banner, a = Math.min(1, b.t * 2);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `bold 34px ${FONT}`;
    const w = Math.max(ctx.measureText(b.title).width, b.sub ? ctx.measureText(b.sub).width * 0.6 : 0) + 60;
    rrect(ctx, VW / 2 - w / 2, 92, w, b.sub ? 92 : 62, 18);
    ctx.fillStyle = 'rgba(20,20,40,0.72)'; ctx.fill();
    text(b.title, VW / 2, 124, 34, '#ffd83a', 'center');
    if (b.sub) text(b.sub, VW / 2, 162, 20, '#fff', 'center');
    ctx.restore();
  }
  if (G.toast) {
    ctx.save(); ctx.globalAlpha = Math.min(1, G.toast.t * 2);
    ctx.font = `bold 22px ${FONT}`;
    const w = ctx.measureText(G.toast.text).width + 40;
    rrect(ctx, VW / 2 - w / 2, VH - 90, w, 44, 14);
    ctx.fillStyle = 'rgba(20,20,40,0.8)'; ctx.fill();
    text(G.toast.text, VW / 2, VH - 68, 22, '#fff', 'center', false);
    ctx.restore();
  }
  if (G.fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, G.fade)})`;
    ctx.fillRect(0, 0, VW, VH);
  }
}

function drawLevel() {
  const L = G.level, th = THEMES[L.t], p = G.p, t = G.time, lv = G.lv;
  drawBackground(ctx, th, G.camX, VW, VH, t);
  ctx.save();
  const sx = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  const sy = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  ctx.translate(-G.camX + sx, sy);

  drawTiles(ctx, L, th, G.camX, VW, t);
  for (const pl of L.plats) for (let i = 0; i < pl.w / TILE; i++) drawPlatform(ctx, th, pl.x + i * TILE, pl.y, i);

  const vx0 = G.camX - 120, vx1 = G.camX + VW + 120;
  for (const e of L.ents) {
    if (e.x < vx0 || e.x > vx1) continue;
    switch (e.type) {
      case 'banana': if (!e.got) drawBanana(ctx, e.x, e.y, t); break;
      case 'enemy': if (e.alive || e.deadT > 0) drawEnemy(ctx, e, th, t); break;
      case 'cp': drawCheckpoint(ctx, e, t); break;
      case 'goal': drawGoal(ctx, e.x, e.y, t); break;
      case 'door': drawDoor(ctx, e); break;
      case 'npc': drawNPC(ctx, e, t); break;
      case 'statue': drawStatue(ctx, e, t, G.hubForm === e.form); break;
      case 'sign': text(e.text, e.x, e.y, 26, '#fff', 'center'); break;
    }
  }

  if (lv.dead <= 0 && !(p.inv > 0 && Math.floor(t * 20) % 2 === 0)) {
    const moving = Math.min(1, Math.abs(p.vx) / 200);
    drawCreature(ctx, p.form, p.x, p.y, {
      facing: p.facing, t, run: p.onGround ? moving : 0, air: !p.onGround && !p.inWater && !p.climbing,
      attack: p.attackT > 0, climb: p.climbing, squash: p.squash, vy: p.vy,
    });
    if (p.gliding) { // süzülürken kafada dönen yaprak pervane
      ctx.save(); ctx.translate(p.x, p.y - 62);
      ctx.scale(Math.cos(t * 30), 1);
      ell(ctx, 0, 0, 22, 5, '#7fdc5c');
      ctx.restore();
    }
  }
  if (L.hub && lv.near) {
    const hint = Input.touchMode ? '👊 Seç' : (p.inWater ? '👊 / X : Seç' : '↑ / X : Seç');
    speech(ctx, lv.near.x, lv.near.y - 100, `${FORM_NAMES[lv.near.form]} - ${hint}`);
  }

  for (const b of G.projs) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.stroke();
    circ(ctx, b.x - 3, b.y - 3, 2.5, 'rgba(255,255,255,0.9)');
  }
  for (const q of G.parts) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    if (q.bubble) { ctx.strokeStyle = q.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.stroke(); }
    else circ(ctx, q.x, q.y, q.r, q.col);
  }
  ctx.globalAlpha = 1;

  drawWater(L, th, t);
  ctx.restore();
}

function drawWater(L, th, t) {
  const col = th.water || 'rgba(40,150,255,0.45)';
  const x0 = Math.max(0, Math.floor(G.camX / TILE) - 1), x1 = Math.min(L.w - 1, Math.floor((G.camX + VW) / TILE) + 1);
  ctx.fillStyle = col;
  for (let ty = 0; ty < L.h; ty++) for (let tx = x0; tx <= x1; tx++) if (L.g[ty][tx] === 'W') ctx.fillRect(tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let ty = 1; ty < L.h; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (L.g[ty][tx] === 'W' && L.g[ty - 1][tx] !== 'W') ctx.fillRect(tx * TILE, ty * TILE + Math.sin(t * 3 + tx) * 2, TILE + 0.5, 3);
  }
  if (L.waterY < LH * TILE) {
    const y = Math.max(-50, L.waterY);
    ctx.fillStyle = col;
    ctx.fillRect(G.camX - 20, y, VW + 40, LH * TILE - y + 60);
    if (L.waterY > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let x = Math.floor(G.camX / 20) * 20; x < G.camX + VW; x += 20) ctx.fillRect(x, y + Math.sin(t * 3 + x * 0.05) * 3, 20.5, 3);
    }
  }
}

function drawHUD() {
  const p = G.p, lv = G.lv, L = G.level;
  for (let i = 0; i < maxHearts(); i++) drawHeart(30 + i * 38, 32, i < p.hearts);
  if (!L.hub) {
    drawBanana(ctx, 34, 82, 0, 1.1);
    text(`${lv.bananas} / ${lv.total}`, 56, 76, 24, '#fff');
  }
  const title = L.hub ? '🎭 Karakter Dünyası' : `${lv.t}-${lv.i + 1}  ${THEMES[lv.t].name}`;
  text(title, VW / 2, 30, 24, '#fff', 'center');

  // aktif karakter ve güçler
  ctx.save(); rrect(ctx, 14, 104, 56, 56, 12); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
  drawCreature(ctx, p.form, 42, 150, { facing: 1, t: G.time, s: 0.75 });
  ctx.font = `22px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  G.save.powers.forEach((pw, i) => ctx.fillText(POWERS[pw].icon, 80 + i * 28, 132));

  uiButton('pause', VW - 66, 12, 52, 52, 'II', { size: 24 });
  uiButton('mute', VW - 126, 12, 52, 52, Sound.muted ? '🔇' : '🔊', { size: 22 });
}

function drawPause() {
  ctx.fillStyle = 'rgba(10,10,30,0.6)'; ctx.fillRect(0, 0, VW, VH);
  text('DURAKLATILDI', VW / 2, 140, 46, '#ffd83a', 'center');
  PAUSE_ITEMS.forEach(([id, label], i) => {
    const l = id === 'mute' ? (Sound.muted ? '🔇 Ses: Kapalı' : '🔊 Ses: Açık') : label;
    uiButton(id, VW / 2 - 160, 200 + i * 72, 320, 58, l, { sel: G.pauseSel === i, color: G.pauseSel === i ? 'rgba(80,60,160,0.85)' : 'rgba(0,0,0,0.55)' });
  });
  uiButton('fs', VW - 66, VH - 66, 52, 52, '⛶', { size: 26 });
}

function drawComplete() {
  const c = G.cmp, lv = G.lv;
  ctx.fillStyle = `rgba(10,10,30,${Math.min(0.55, c.t)})`; ctx.fillRect(0, 0, VW, VH);
  const s = Math.min(1, c.t * 3);
  ctx.save(); ctx.translate(VW / 2, 210); ctx.scale(s, s);
  text('BÖLÜM TAMAM!', 0, 0, 56, '#ffd83a', 'center');
  ctx.restore();
  if (c.t > 0.4) {
    drawBanana(ctx, VW / 2 - 70, 300, G.time, 1.6);
    text(`${lv.bananas} / ${lv.total}`, VW / 2 - 40, 290, 38, '#fff');
  }
  if (lv.total > 0 && lv.bananas === lv.total && c.t > 0.8) text('⭐ Bütün muzlar toplandı! ⭐', VW / 2, 360, 26, '#fff8a0', 'center');
  if (c.t > 1) {
    uiButton('continue', VW / 2 - 120, 410, 240, 60, 'Devam ▶', { color: 'rgba(60,160,80,0.9)' });
  }
}

function drawTitle() {
  const t = G.time;
  drawBackground(ctx, THEMES[1], t * 60, VW, VH, t);
  ctx.fillStyle = '#43b23a'; ctx.fillRect(0, VH - 90, VW, 90);
  ctx.fillStyle = '#7b4b26'; ctx.fillRect(0, VH - 70, VW, 70);
  const bounce = Math.abs(Math.sin(t * 4)) * 60;
  drawCreature(ctx, G.save.land, VW / 2, VH - 90 - bounce, { facing: 1, t, s: 2.4, air: bounce > 5 });
  ctx.save();
  ctx.translate(VW / 2, 120);
  ctx.rotate(Math.sin(t * 2) * 0.03);
  text('ZIPZIP GORİL', 0, 0, Math.min(84, VW / 8.5), '#ffd83a', 'center', '#5a2a00');
  ctx.restore();
  text('Muzları topla, on dünyayı gez!', VW / 2, 190, 24, '#fff', 'center');
  uiButton('start', VW / 2 - 130, 250, 260, 70, '▶  BAŞLA', { size: 32, color: 'rgba(230,80,60,0.95)' });

  const doneCount = Object.keys(G.save.done).length;
  if (doneCount) text(`⭐ ${doneCount} / 100 bölüm`, VW / 2, 345, 22, '#fff', 'center');
  const help = [
    '⌨️  ←→ yürü · Boşluk zıpla · X yumruk · C güç · Esc duraklat',
    '🎮  ✕ zıpla · □ yumruk · ○ güç · Options duraklat',
    '📱  Sol: kaydırarak yürü · Sağ: tuşlar',
  ];
  help.forEach((h, i) => text(h, 20, VH - 120 + i * 26, 17, '#fff', 'left'));
  uiButton('fs', VW - 66, 12, 52, 52, '⛶', { size: 26 });
  uiButton('mute', VW - 126, 12, 52, 52, Sound.muted ? '🔇' : '🔊', { size: 22 });
}

function drawMap() {
  const M = G.map, cam = M.camX, t = G.time;
  // tema bölgeleri
  for (let z = 0; z <= 10; z++) {
    const x0 = ZONE_EDGES[z], x1 = ZONE_EDGES[z + 1];
    if (x1 < cam || x0 > cam + VW) continue;
    const th = THEMES[z];
    const sx = x0 - cam, w = x1 - x0;
    const gr = ctx.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
    ctx.fillStyle = gr; ctx.fillRect(sx, 0, w + 1, VH);
    ctx.fillStyle = th.top;
    ctx.beginPath(); ctx.moveTo(sx, VH);
    for (let x = 0; x <= w; x += 40) ctx.lineTo(sx + x, 500 + Math.sin((x0 + x) * 0.01) * 14);
    ctx.lineTo(sx + w, VH); ctx.fill();
    ctx.fillStyle = th.ground; ctx.fillRect(sx, 530, w + 1, 70);
    ctx.font = `40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const n = Math.max(2, Math.floor(w / 160));
    for (let k = 0; k < n; k++) {
      const h = hash2(z, k);
      ctx.fillText(th.mapDeco[k % th.mapDeco.length], sx + (k + 0.5) * (w / n) + (h - 0.5) * 40, k % 2 ? 470 : 120 + h * 40);
    }
  }
  // yol
  ctx.save();
  ctx.translate(-cam, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = 18;
  ctx.beginPath(); MAP_NODES.forEach((nd, i) => (i ? ctx.lineTo(nd.x, nd.y) : ctx.moveTo(nd.x, nd.y))); ctx.stroke();
  ctx.strokeStyle = '#f5deb3'; ctx.lineWidth = 10; ctx.setLineDash([14, 10]);
  ctx.beginPath(); MAP_NODES.forEach((nd, i) => (i ? ctx.lineTo(nd.x, nd.y) : ctx.moveTo(nd.x, nd.y))); ctx.stroke();
  ctx.setLineDash([]);

  // tema tabelaları
  for (let z = 1; z <= 10; z++) {
    const nd = MAP_NODES[nodeIndex(z, 0)];
    if (nd.x < cam - 300 || nd.x > cam + VW + 300) continue;
    const th = THEMES[z], pw = POWERS[th.power];
    ctx.save();
    rrect(ctx, nd.x - 30, 24, 250, 66, 14); ctx.fillStyle = 'rgba(30,20,10,0.65)'; ctx.fill();
    text(`${z}. ${th.icon} ${th.name}`, nd.x - 16, 46, 24, '#ffd83a', 'left', false);
    text(`${pw.icon} ${pw.name}${has(th.power) ? ' ✓' : ''}`, nd.x - 16, 72, 17, '#fff', 'left', false);
    ctx.restore();
  }
  // düğümler
  MAP_NODES.forEach((nd, n) => {
    if (nd.x < cam - 40 || nd.x > cam + VW + 40) return;
    const unlocked = isUnlocked(n), done = isDone(n);
    const r = nd.t === 0 ? 30 : 22;
    circ(ctx, nd.x, nd.y + 4, r, 'rgba(0,0,0,0.3)');
    circ(ctx, nd.x, nd.y, r, done ? '#ffcc00' : unlocked ? '#ffffff' : '#9a9a9a');
    ctx.lineWidth = 3; ctx.strokeStyle = '#5a3a1a'; ctx.beginPath(); ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2); ctx.stroke();
    if (nd.t === 0) { ctx.font = `30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎭', nd.x, nd.y + 2); }
    else if (!unlocked) { ctx.font = `18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', nd.x, nd.y + 1); }
    else text(String(nd.i + 1), nd.x, nd.y + 1, 20, done ? '#7a4a00' : '#333', 'center', false);
    const best = G.save.best[levelKey(nd.t, nd.i)];
    if (done && best) text(`🍌${best}`, nd.x, nd.y + 36, 14, '#fff', 'center');
  });
  // oyuncu
  const pos = mapPlayerPos();
  drawCreature(ctx, G.save.land, pos.x, pos.y - 16, { facing: M.facing || 1, t, s: 0.95, run: M.anim ? 1 : 0, air: !!(M.anim && M.anim.hop > 20) });
  ctx.restore();

  // arayüz
  const nd = MAP_NODES[M.node];
  const label = nd.t === 0 ? '🎭 Karakter Dünyası' : `${nd.t}-${nd.i + 1}  ${THEMES[nd.t].name}`;
  ctx.save(); rrect(ctx, VW / 2 - 200, VH - 150, 400, 44, 14); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
  text(label, VW / 2, VH - 128, 24, '#fff', 'center', false);
  uiButton('prevT', 16, VH - 78, 150, 60, '◀ Tema', { size: 22 });
  uiButton('nextT', VW - 166, VH - 78, 150, 60, 'Tema ▶', { size: 22 });
  uiButton('play', VW / 2 - 100, VH - 84, 200, 70, '▶ OYNA', { size: 30, color: 'rgba(230,80,60,0.95)' });
  uiButton('fs', VW - 66, 12, 52, 52, '⛶', { size: 26 });
  uiButton('mute', VW - 126, 12, 52, 52, Sound.muted ? '🔇' : '🔊', { size: 22 });
  const doneCount = Object.keys(G.save.done).length;
  text(`⭐ ${doneCount} / 100`, 20, 36, 24, '#fff');
  if (!Input.touchMode) text('←→ yürü · ↑↓ / Q E / L1 R1 tema atla · Boşluk / ✕ gir', 20, VH - 178, 15, '#fff');
}

requestAnimationFrame(frame);
