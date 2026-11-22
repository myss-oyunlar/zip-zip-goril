'use strict';

// Bütün görseller kodla çiziliyor (resim dosyası yok).

// ---------- Temel şekiller ----------
function ell(ctx, x, y, rx, ry, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
  ctx.fill();
}
function circ(ctx, x, y, r, col) { ell(ctx, x, y, r, r, col); }
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
function tri(ctx, x1, y1, x2, y2, x3, y3, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
}
function eye(ctx, x, y, r, pupil, look) {
  circ(ctx, x, y, r, '#fff');
  circ(ctx, x + (look || 1) * r * 0.3, y, r * 0.55, pupil || '#1a1a1a');
  circ(ctx, x + (look || 1) * r * 0.3 - r * 0.2, y - r * 0.25, r * 0.2, '#fff');
}

// ---------- Oyuncu karakterleri ----------
const FORM_STYLE = {
  goril:   { body: '#3d3a45', belly: '#625c6b', face: '#a08e84', limb: '#2c2a33', ear: 'small', brow: true, wide: 1.25 },
  maymun:  { body: '#8a5427', belly: '#d8a874', face: '#f2d1a2', limb: '#6e421d', ear: 'big', tail: 'curl' },
  panter:  { body: '#24232c', belly: '#34333f', face: '#34333f', limb: '#18171e', ear: 'pointy', tail: 'long', pupil: '#e8c000', eyeCol: '#ffe45a' },
  kurbaga: { body: '#46b836', belly: '#c6ef86', face: '#46b836', limb: '#358f28', ear: 'none', frog: true },
  insan:   { body: '#e0403a', belly: '#e0403a', face: '#f3c58f', limb: '#f3c58f', foot: '#3646a8', ear: 'none', human: true },
  inek:    { body: '#fafafa', belly: '#f0f0f0', face: '#fafafa', limb: '#3a3a3a', ear: 'side', cow: true },
};

// (x, y) = ayakların ortası. o: { facing, t, run(0..1), air, s(ölçek), attack, climb, squash, vy, alpha }
function drawCreature(ctx, form, x, y, o) {
  ctx.save();
  ctx.translate(x, y);
  const s = o.s || 1;
  ctx.scale((o.facing || 1) * s, s);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (isWaterForm(form)) drawSwimmer(ctx, form, o);
  else drawLandCreature(ctx, form, o);
  ctx.restore();
}

function drawLandCreature(ctx, f, o) {
  const S = FORM_STYLE[f];
  const t = o.t || 0, run = o.run || 0;
  const step = Math.sin(t * 15);
  const bob = o.air ? -2 : Math.abs(step) * 3 * run + Math.sin(t * 3) * 0.8;
  const sq = o.squash || 0;
  ctx.save();
  ctx.scale(1 + sq * 0.25, 1 - sq * 0.25);

  // kuyruk
  ctx.lineCap = 'round';
  if (S.tail === 'curl') {
    ctx.strokeStyle = S.body; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10, -16 - bob);
    ctx.quadraticCurveTo(-28, -14 + Math.sin(t * 4) * 3, -24, -32);
    ctx.quadraticCurveTo(-21, -40, -15, -34);
    ctx.stroke();
  } else if (S.tail === 'long') {
    ctx.strokeStyle = S.body; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10, -14 - bob);
    ctx.quadraticCurveTo(-30, -8, -36, -22 + Math.sin(t * 5) * 5);
    ctx.stroke();
  } else if (S.cow) {
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-12, -20 - bob); ctx.quadraticCurveTo(-22, -16, -20, -6 + Math.sin(t * 4) * 2); ctx.stroke();
    circ(ctx, -20, -6 + Math.sin(t * 4) * 2, 3, '#333');
  }

  // arka el
  const handSwing = Math.sin(t * 15 + 1) * 6 * run;
  if (o.climb) circ(ctx, -6, -58 + Math.sin(t * 10) * 3, 5.5, S.limb);
  else circ(ctx, -13 - handSwing, -20 - bob, 5.5, S.limb);

  // ayaklar (gövdeye bağlı değil, havada süzülüyor)
  const footCol = S.foot || S.limb;
  const fw = S.frog ? 10 : 8;
  const l1 = o.air ? 2 : Math.max(0, step) * 5 * run;
  const l2 = o.air ? 0 : Math.max(0, -step) * 5 * run;
  const f1 = o.air ? -7 : -6 + step * 8 * run;
  const f2 = o.air ? 6 : 8 - step * 8 * run;
  ell(ctx, f1, -4 - l1, fw, 5, footCol);
  ell(ctx, f2, -4 - l2, fw, 5, footCol);

  // gövde
  const by = -21 - bob;
  const bw = 13 * (S.wide || 1);
  ell(ctx, 0, by, bw, 14, S.body);
  ell(ctx, 3, by + 2, bw * 0.6, 10, S.belly);
  if (S.cow) { circ(ctx, -5, by - 4, 4, '#2a2a2a'); circ(ctx, 4, by + 6, 3, '#2a2a2a'); }
  if (S.human) { ctx.fillStyle = '#3646a8'; ctx.fillRect(-10, by + 6, 20, 7); }

  // kafa
  const hy = -41 - bob;
  if (S.ear === 'small') { circ(ctx, -9, hy - 2, 4, S.body); }
  if (S.ear === 'big') { circ(ctx, -10, hy - 1, 7, S.body); circ(ctx, -10, hy - 1, 4, S.face); }
  if (S.ear === 'pointy') { tri(ctx, -10, hy - 6, -4, hy - 20, 2, hy - 9, S.body); tri(ctx, 2, hy - 9, 9, hy - 20, 12, hy - 7, S.body); }
  if (S.ear === 'side') { ell(ctx, -11, hy - 2, 7, 4, '#f2b8c6'); }
  if (S.cow) {
    tri(ctx, -6, hy - 10, -10, hy - 20, -1, hy - 12, '#e8dcb0');
    tri(ctx, 6, hy - 11, 10, hy - 21, 12, hy - 9, '#e8dcb0');
  }
  circ(ctx, 3, hy, 13, S.human ? S.face : S.body);
  if (S.human) {
    ctx.fillStyle = '#5a3414';
    ctx.beginPath(); ctx.arc(2, hy - 2, 14, Math.PI, Math.PI * 2.05); ctx.fill();
    ctx.fillRect(-12, hy - 4, 6, 10);
  } else if (!S.frog) {
    ell(ctx, 7, hy + 3, 9, 8, S.face);
  }
  if (S.frog) {
    ell(ctx, 4, hy + 4, 12, 7, S.belly);
    circ(ctx, -2, hy - 11, 6.5, S.body); circ(ctx, 10, hy - 11, 6.5, S.body);
    eye(ctx, -1, hy - 12, 4.5); eye(ctx, 11, hy - 12, 4.5);
    ctx.strokeStyle = '#1e5a17'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(5, hy + 1, 9, 0.3, Math.PI - 0.3); ctx.stroke();
  } else {
    eye(ctx, 5, hy - 3, 4, S.pupil, 1);
    eye(ctx, 13, hy - 3, 4, S.pupil, 1);
    if (S.eyeCol) { circ(ctx, 5, hy - 3, 4, S.eyeCol); circ(ctx, 13, hy - 3, 4, S.eyeCol); circ(ctx, 6, hy - 3, 1.6, '#111'); circ(ctx, 14, hy - 3, 1.6, '#111'); }
    if (S.brow) { ctx.fillStyle = '#25232b'; ctx.fillRect(0, hy - 9, 18, 4); }
    if (S.cow) { ell(ctx, 13, hy + 6, 7, 5, '#f7a8b8'); circ(ctx, 11, hy + 6, 1.4, '#a05060'); circ(ctx, 15, hy + 6, 1.4, '#a05060'); }
    else {
      ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(10, hy + 4, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    if (f === 'panter') {
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(14, hy + 3); ctx.lineTo(22, hy + 1); ctx.moveTo(14, hy + 5); ctx.lineTo(22, hy + 6); ctx.stroke();
    }
  }

  // ön el
  if (o.climb) circ(ctx, 10, -56 + Math.cos(t * 10) * 3, 5.5, S.limb);
  else if (o.attack) {
    circ(ctx, 28, -24 - bob, 8.5, S.limb);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(28, -24 - bob, 13, -0.8, 0.8); ctx.stroke();
  } else circ(ctx, 13 + handSwing, -19 - bob + Math.cos(t * 3) * 1.5, 5.5, S.limb);

  ctx.restore();
}

function drawSwimmer(ctx, f, o) {
  const t = o.t || 0;
  ctx.save();
  ctx.translate(0, -17);
  ctx.rotate(clamp((o.vy || 0) / 700, -0.5, 0.5)); // yukarı yüzerken burun yukarı
  const wig = Math.sin(t * 9);
  switch (f) {
    case 'yunus': {
      ctx.save(); ctx.translate(-24, 0); ctx.rotate(wig * 0.35);
      tri(ctx, 0, 0, -12, -9, -12, 9, '#4a86bd'); ctx.restore();
      tri(ctx, -4, -9, 6, -9, -6, -20, '#4a86bd');
      ell(ctx, 0, 0, 25, 11, '#5e9fd6');
      ell(ctx, 3, 4, 18, 5, '#d8ecfa');
      ell(ctx, 25, 3, 8, 3.5, '#5e9fd6');
      eye(ctx, 13, -3, 3.2);
      ctx.strokeStyle = '#2d5a85'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(22, 1, 5, 0.3, 1.4); ctx.stroke();
      break;
    }
    case 'balik': {
      ctx.save(); ctx.translate(-15, 0); ctx.rotate(wig * 0.4);
      tri(ctx, 0, 0, -12, -10, -12, 10, '#ff7a10'); ctx.restore();
      ell(ctx, 0, 0, 17, 13, '#ff8c1a');
      ctx.fillStyle = '#fff'; ctx.fillRect(-6, -12, 4, 24); ctx.fillRect(6, -11, 4, 22);
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
      ctx.strokeRect(-6, -12, 4, 24); ctx.strokeRect(6, -11, 4, 22);
      tri(ctx, -2, 8, 6, 8, 0, 16 + wig * 2, '#ff7a10');
      eye(ctx, 11, -3, 3.5);
      break;
    }
    case 'ahtapot': {
      ctx.strokeStyle = '#9a45c0'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const sx = -8 + i * 4;
        ctx.beginPath(); ctx.moveTo(sx, 6);
        ctx.quadraticCurveTo(sx - 10, 14 + Math.sin(t * 7 + i) * 5, sx - 18, 10 + Math.sin(t * 7 + i + 1) * 6);
        ctx.stroke();
      }
      ell(ctx, 2, -4, 15, 13, '#b35ad8');
      circ(ctx, -4, -9, 2.5, '#d48af0'); circ(ctx, 1, -13, 2, '#d48af0');
      eye(ctx, 6, -2, 4); eye(ctx, 14, -2, 3.5);
      break;
    }
    case 'kopekbaligi': {
      ctx.save(); ctx.translate(-24, 0); ctx.rotate(wig * 0.3);
      tri(ctx, 0, 0, -10, -14, -6, 0, '#6a7b91'); tri(ctx, 0, 0, -8, 10, -5, 0, '#6a7b91'); ctx.restore();
      tri(ctx, -6, -9, 6, -9, -10, -24, '#6a7b91');
      ell(ctx, 0, 0, 27, 11, '#7f90a6');
      ell(ctx, 4, 5, 20, 5, '#eef2f6');
      eye(ctx, 15, -3, 3);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(14, 5);
      for (let i = 0; i < 4; i++) { ctx.lineTo(16 + i * 3, 8); ctx.lineTo(17.5 + i * 3, 5); }
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ---------- Düşmanlar ----------
function drawEnemy(ctx, e, th, t) {
  const st = e.kind === 'flyer' ? th.flyer : e.kind === 'floater' ? { style: 'jelly', color: '#ff8ad8', color2: '#ffd0f0' } : th.walker;
  if (!st) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (!e.alive) { ctx.translate(0, -15); ctx.rotate(Math.PI); ctx.translate(0, 15); ctx.globalAlpha = Math.max(0, e.deadT * 2); }
  ctx.scale(e.dir || 1, 1);
  const c = st.color, c2 = st.color2;
  const leg = Math.sin(t * 14 + e.x);
  switch (st.style) {
    case 'beetle':
      for (let i = -1; i <= 1; i++) { ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(i * 8, -8); ctx.lineTo(i * 8 + leg * 3, 0); ctx.stroke(); }
      ell(ctx, 0, -14, 17, 12, c); ctx.fillStyle = c2; ctx.fillRect(-1, -26, 2, 22);
      circ(ctx, -6, -16, 3, c2); circ(ctx, 6, -12, 3, c2);
      circ(ctx, 16, -12, 7, c2); eye(ctx, 18, -14, 3, '#000');
      break;
    case 'scorpion':
      ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-12, -10); ctx.quadraticCurveTo(-26, -30, -6, -36 + leg * 2); ctx.stroke();
      tri(ctx, -6, -40, 0, -34, -8, -30, c2);
      ell(ctx, 0, -9, 16, 8, c);
      circ(ctx, 18, -12, 5, c2); circ(ctx, 18, -4, 5, c2);
      eye(ctx, 8, -14, 3, '#000');
      break;
    case 'crab':
      for (let i = -1; i <= 1; i += 2) { ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(i * 10, -6); ctx.lineTo(i * 16 + leg * 2, 0); ctx.stroke(); }
      ell(ctx, 0, -12, 17, 11, c);
      circ(ctx, -20, -20 + leg * 2, 6, c); circ(ctx, 20, -20 - leg * 2, 6, c);
      ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -20); ctx.lineTo(-5, -28); ctx.moveTo(6, -20); ctx.lineTo(7, -28); ctx.stroke();
      eye(ctx, -5, -29, 3.5, '#000'); eye(ctx, 7, -29, 3.5, '#000');
      break;
    case 'slime': {
      const sq = Math.sin(t * 8 + e.x) * 2;
      ell(ctx, 0, -12 - sq / 2, 17 + sq, 12 - sq, c);
      ell(ctx, -4, -18, 6, 3, c2);
      eye(ctx, 4, -14, 4, '#000'); eye(ctx, 13, -14, 3.5, '#000');
      break;
    }
    case 'puff':
      circ(ctx, -8, -12, 10, c); circ(ctx, 8, -12, 10, c); circ(ctx, 0, -20, 11, c);
      tri(ctx, -4, -4, 2, -4, -2, 6 + leg * 2, c2);
      eye(ctx, 4, -16, 3.5, '#000'); eye(ctx, 12, -16, 3, '#000');
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(8, -20); ctx.moveTo(10, -21); ctx.lineTo(16, -23); ctx.stroke();
      break;
    case 'robot':
      ctx.fillStyle = '#444'; ctx.fillRect(-10, -6, 6, 6 + leg); ctx.fillRect(4, -6, 6, 6 - leg);
      ctx.fillStyle = c; rrect(ctx, -15, -30, 30, 26, 5); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(0, -24, 13, 8);
      circ(ctx, 4, -20, 2.5, c2); circ(ctx, 10, -20, 2.5, c2);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -38); ctx.stroke();
      circ(ctx, 0, -39, 3, c2);
      break;
    case 'penguin':
      ell(ctx, -6 + leg * 2, -2, 6, 3, '#f5a623'); ell(ctx, 6 - leg * 2, -2, 6, 3, '#f5a623');
      ell(ctx, 0, -18, 13, 17, c); ell(ctx, 3, -15, 9, 13, c2);
      eye(ctx, 4, -27, 3, '#000'); eye(ctx, 10, -27, 3, '#000');
      tri(ctx, 9, -23, 18, -21, 9, -19, '#f5a623');
      break;
    case 'croc':
      ctx.fillStyle = c; ctx.fillRect(-12 + leg * 2, -6, 5, 6); ctx.fillRect(6 - leg * 2, -6, 5, 6);
      ell(ctx, -4, -12, 18, 9, c);
      ell(ctx, 16, -12, 12, 6, c);
      ctx.fillStyle = c2; for (let i = 0; i < 4; i++) tri(ctx, 9 + i * 5, -9, 11 + i * 5, -5, 13 + i * 5, -9, c2);
      circ(ctx, 6, -20, 5, c); eye(ctx, 7, -21, 3, '#000');
      for (let i = 0; i < 3; i++) tri(ctx, -16 + i * 7, -20, -13 + i * 7, -26, -10 + i * 7, -20, '#2d5e29');
      break;
    case 'alien':
      ell(ctx, -6 + leg * 3, -3, 5, 3, c2); ell(ctx, 6 - leg * 3, -3, 5, 3, c2);
      ell(ctx, 0, -16, 13, 14, c);
      ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -29); ctx.lineTo(4, -38); ctx.stroke();
      circ(ctx, 4, -39, 3, '#ff4ad8');
      eye(ctx, 3, -18, 7, '#000');
      break;
    // --- uçanlar ---
    case 'bee': case 'vulture': case 'bird': case 'pigeon': case 'mosquito': case 'bat': case 'firebat': {
      const flap = Math.sin(t * (st.style === 'bee' || st.style === 'mosquito' ? 40 : 14) + e.x);
      const wingCol = st.style === 'bee' || st.style === 'mosquito' ? 'rgba(220,240,255,0.8)' : (st.style === 'bat' || st.style === 'firebat') ? c : c2;
      ctx.save(); ctx.translate(-2, -18); ctx.scale(1, flap);
      if (st.style === 'bat' || st.style === 'firebat') { tri(ctx, -4, 0, -24, -14, -18, 4, wingCol); tri(ctx, 4, 0, 24, -14, 18, 4, wingCol); }
      else { ell(ctx, -6, -10, 7, 12, wingCol); ell(ctx, 6, -10, 7, 12, wingCol); }
      ctx.restore();
      ell(ctx, 0, -14, 14, 11, c);
      if (st.style === 'bee') { ctx.fillStyle = c2; ctx.fillRect(-6, -24, 4, 20); ctx.fillRect(2, -24, 4, 20); }
      if (st.style === 'mosquito') { ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, -12); ctx.lineTo(26, -8); ctx.stroke(); }
      if (st.style === 'vulture' || st.style === 'bird' || st.style === 'pigeon') tri(ctx, 12, -16, 22, -13, 12, -10, '#f5a623');
      if (st.style === 'firebat') { circ(ctx, -12, -6, 4 + Math.sin(t * 20) * 1.5, 'rgba(255,170,40,0.7)'); }
      eye(ctx, 7, -17, 3.5, '#000');
      break;
    }
    case 'puffer': {
      const pf = 1 + Math.sin(t * 2 + e.x) * 0.12;
      ctx.save(); ctx.scale(pf, pf);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; tri(ctx, Math.cos(a) * 13, -16 + Math.sin(a) * 13, Math.cos(a + 0.15) * 20, -16 + Math.sin(a + 0.15) * 20, Math.cos(a + 0.3) * 13, -16 + Math.sin(a + 0.3) * 13, c2); }
      circ(ctx, 0, -16, 14, c);
      eye(ctx, 6, -19, 4, '#000');
      ctx.restore();
      break;
    }
    case 'ufo':
      ell(ctx, 0, -18, 11, 10, 'rgba(160,240,255,0.7)');
      circ(ctx, 0, -18, 5, '#6ee05a'); circ(ctx, 2, -19, 1.8, '#000');
      ell(ctx, 0, -12, 20, 6, c);
      for (let i = -1; i <= 1; i++) circ(ctx, i * 11, -11, 2.5, Math.sin(t * 8 + i) > 0 ? c2 : '#ffef6a');
      break;
    case 'jelly': {
      ctx.strokeStyle = c; ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 5, -16); ctx.quadraticCurveTo(i * 5 + Math.sin(t * 5 + i) * 6, -6, i * 5, 2); ctx.stroke(); }
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -16, 15, Math.PI, 0); ctx.closePath(); ctx.fill();
      ell(ctx, -4, -22, 5, 3, c2);
      eye(ctx, -4, -18, 2.5, '#000'); eye(ctx, 5, -18, 2.5, '#000');
      break;
    }
  }
  ctx.restore();
}

// Şehirde dolaşan insanlar (zararsız)
function drawNPC(ctx, n, t) {
  const shirts = ['#3a7bd5', '#e25d5d', '#3fbf7f', '#f2b134', '#9b59b6', '#ff7aa8'];
  const skins = ['#f3c58f', '#c68a5a', '#8d5a3b', '#ffdbb5'];
  const hairs = ['#2b1a0e', '#d9a441', '#6b3b1a', '#111', '#b0b0b0'];
  const sh = shirts[n.look % shirts.length], sk = skins[(n.look >> 3) % skins.length], hr = hairs[(n.look >> 5) % hairs.length];
  const step = Math.sin(t * 8 + n.look);
  ctx.save(); ctx.translate(n.x, n.y); ctx.scale(n.dir, 1);
  ctx.fillStyle = '#334'; ctx.fillRect(-6 + step * 3, -16, 5, 16); ctx.fillRect(1 - step * 3, -16, 5, 16);
  ctx.fillStyle = sh; rrect(ctx, -9, -36, 18, 22, 5); ctx.fill();
  circ(ctx, 0, -44, 9, sk);
  ctx.fillStyle = hr; ctx.beginPath(); ctx.arc(0, -46, 9.5, Math.PI, Math.PI * 2); ctx.fill();
  circ(ctx, 4, -45, 1.6, '#111');
  ctx.restore();
  if (n.sayT > 0 && n.say) speech(ctx, n.x, n.y - 62, n.say);
}

function speech(ctx, x, y, text) {
  ctx.save();
  ctx.font = 'bold 15px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  rrect(ctx, x - w / 2, y - 26, w, 26, 8); ctx.fill(); ctx.stroke();
  tri(ctx, x - 5, y, x + 5, y, x, y + 7, '#fff');
  ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 13);
  ctx.restore();
}

// ---------- Eşyalar ----------
function drawBanana(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 3 + x * 0.05) * 3);
  ctx.rotate(Math.sin(t * 2 + x) * 0.2);
  if (s) ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(0, -8, 11, 0.35, Math.PI - 0.35); ctx.stroke();
  ctx.strokeStyle = '#ffd83a'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, -8, 11, 0.4, Math.PI - 0.4); ctx.stroke();
  ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -8, 9, 1.0, Math.PI - 1.0); ctx.stroke();
  circ(ctx, 10, -4, 2, '#5a3a10');
  ctx.restore();
}

function drawGoal(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.save(); ctx.translate(0, -60); ctx.rotate(t * 0.5);
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); tri(ctx, 0, 0, -10, -70, 10, -70, 'rgba(255,230,100,0.25)'); }
  ctx.restore();
  ctx.fillStyle = '#8a6a3a'; rrect(ctx, -26, -18, 52, 18, 4); ctx.fill();
  ctx.fillStyle = '#a8844a'; ctx.fillRect(-22, -18, 44, 4);
  ctx.translate(0, -60 + Math.sin(t * 3) * 5);
  ctx.scale(2.4, 2.4);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#b07800'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(0, -4, 11, 0.35, Math.PI - 0.35); ctx.stroke();
  ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, -4, 11, 0.4, Math.PI - 0.4); ctx.stroke();
  ctx.strokeStyle = '#fff8c0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -4, 9, 1.0, Math.PI - 1.0); ctx.stroke();
  ctx.restore();
}

function drawCheckpoint(ctx, cp, t) {
  ctx.save(); ctx.translate(cp.x, cp.y);
  ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-3, -70, 6, 70);
  circ(ctx, 0, -72, 5, '#ffd83a');
  const col = cp.on ? '#3fd16a' : '#c9c9c9';
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(3, -68);
  const wave = cp.on ? Math.sin(t * 8) * 4 : 0;
  ctx.quadraticCurveTo(18, -64 + wave, 34, -60); ctx.lineTo(3, -48); ctx.closePath(); ctx.fill();
  if (cp.on) { ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🍌', 15, -55); }
  ctx.restore();
}

function drawDoor(ctx, d) {
  ctx.save(); ctx.translate(d.x, d.y);
  ctx.fillStyle = '#5a3a1e'; rrect(ctx, -22, -80, 44, 80, [22, 22, 0, 0]); ctx.fill();
  ctx.fillStyle = '#8a5a2e'; rrect(ctx, -17, -74, 34, 74, [17, 17, 0, 0]); ctx.fill();
  circ(ctx, 9, -36, 3, '#ffd83a');
  ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText('HARİTA', 0, -88);
  ctx.restore();
}

function drawStatue(ctx, s, t, active) {
  ctx.save();
  ctx.fillStyle = active ? '#ffd83a' : '#c8b8a0';
  rrect(ctx, s.x - 26, s.y - 10, 52, 10, 3); ctx.fill();
  ctx.restore();
  if (isWaterForm(s.form)) {
    ctx.save();
    ctx.fillStyle = 'rgba(160,220,255,0.35)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y - 38, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    drawCreature(ctx, s.form, s.x, s.y - 20 + Math.sin(t * 2 + s.x) * 3, { facing: 1, t, s: 0.9 });
  } else {
    drawCreature(ctx, s.form, s.x, s.y - 10, { facing: 1, t: active ? t : 0, s: 1 });
  }
  if (active) {
    ctx.save(); ctx.globalAlpha = 0.6 + Math.sin(t * 6) * 0.3;
    circ(ctx, s.x, s.y - 92, 5, '#ffd83a');
    ctx.restore();
  }
}

// ---------- Karolar ----------
function drawTiles(ctx, L, th, camX, VW, t) {
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const x1 = Math.min(L.w - 1, Math.floor((camX + VW) / TILE) + 1);
  for (let ty = 0; ty < L.h; ty++) {
    const row = L.g[ty];
    for (let tx = x0; tx <= x1; tx++) {
      const c = row[tx];
      if (c === '.' || c === 'W') continue;
      drawTile(ctx, L, th, c, tx, ty, t);
    }
  }
}

const isGroundC = (c) => c === '#' || c === 'C';

function drawTile(ctx, L, th, c, tx, ty, t) {
  const x = tx * TILE, y = ty * TILE;
  const above = ty > 0 ? L.g[ty - 1][tx] : '#';
  const below = ty < L.h - 1 ? L.g[ty + 1][tx] : '#';
  switch (c) {
    case '#': drawGround(ctx, th, x, y, tx, ty, !isGroundC(above) && above !== 'p',!isGroundC(below) && below !== 'p'); break;
    case 'C':
      ctx.fillStyle = th.topHi === '#ffffff' ? '#c9d6e6' : th.dark; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 8, y + 4); ctx.lineTo(x + 18, y + 18); ctx.lineTo(x + 12, y + 30); ctx.moveTo(x + 18, y + 18); ctx.lineTo(x + 32, y + 24); ctx.stroke();
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      break;
    case 'p':
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
      break;
    case '=': drawPlatform(ctx, th, x, y, tx); break;
    case '^': {
      for (let i = 0; i < 3; i++) {
        tri(ctx, x + 2 + i * 12, y + TILE, x + 8 + i * 12, y + 14, x + 14 + i * 12, y + TILE, th.spike);
        tri(ctx, x + 5 + i * 12, y + TILE, x + 8 + i * 12, y + 18, x + 9 + i * 12, y + TILE, 'rgba(255,255,255,0.35)');
      }
      break;
    }
    case 'L': {
      const top = above !== 'L';
      ctx.fillStyle = '#ff5a14'; ctx.fillRect(x, y + (top ? 8 : 0), TILE + 0.5, TILE - (top ? 8 : 0) + 0.5);
      if (top) {
        ctx.fillStyle = '#ffb22e';
        ctx.beginPath(); ctx.moveTo(x, y + 12);
        for (let i = 0; i <= 4; i++) ctx.lineTo(x + i * 10, y + 8 + Math.sin(t * 4 + tx + i) * 4);
        ctx.lineTo(x + TILE, y + 16); ctx.lineTo(x, y + 16); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,230,120,0.6)';
      circ(ctx, x + 10 + hash2(tx, ty) * 20, y + 26 + Math.sin(t * 3 + tx) * 4, 3, 'rgba(255,230,120,0.6)');
      break;
    }
    case 'V': {
      ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 20, y);
      ctx.quadraticCurveTo(x + 20 + Math.sin(t * 2 + ty) * 5, y + 20, x + 20, y + TILE);
      ctx.stroke();
      ell(ctx, x + 12, y + 14, 7, 4, '#4caf50');
      ell(ctx, x + 28, y + 30, 7, 4, '#66bb6a');
      break;
    }
    case '*': {
      ctx.fillStyle = '#f4e1c1'; ctx.fillRect(x + 14, y + 20, 12, 20);
      ctx.fillStyle = '#e53935';
      ctx.beginPath(); ctx.ellipse(x + 20, y + 22, 20, 15, 0, Math.PI, 0); ctx.fill();
      circ(ctx, x + 12, y + 14, 3.5, '#fff'); circ(ctx, x + 26, y + 12, 4, '#fff'); circ(ctx, x + 20, y + 19, 2.5, '#fff');
      break;
    }
  }
}

function drawGround(ctx, th, x, y, tx, ty, isTop, isBottom) {
  const h = hash2(tx, ty);
  switch (th.tile) {
    case 'cloud': {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y + (isTop ? 12 : 0), TILE + 0.5, TILE - (isTop ? 12 : 0) + 0.5);
      if (isTop) { circ(ctx, x + 10, y + 16, 11, '#fff'); circ(ctx, x + 28, y + 13, 13, '#fff'); }
      ctx.fillStyle = '#e8f1fb'; ctx.fillRect(x, y + TILE - 6, TILE + 0.5, 6);
      if (isBottom) { ctx.fillStyle = '#b9d3ee'; ctx.fillRect(x, y + TILE - 8, TILE + 0.5, 8); }
      return;
    }
    case 'building': {
      ctx.fillStyle = th.ground; ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
      if (isTop) {
        ctx.fillStyle = th.top; ctx.fillRect(x, y, TILE + 0.5, 10);
        ctx.fillStyle = th.topHi; ctx.fillRect(x, y, TILE + 0.5, 3);
      } else {
        const lit = h < 0.4;
        ctx.fillStyle = lit ? '#ffe58a' : '#4a5470';
        ctx.fillRect(x + 10, y + 8, 20, 24);
        ctx.fillStyle = th.dark; ctx.fillRect(x + 19, y + 8, 2, 24); ctx.fillRect(x + 8, y + 32, 24, 3);
      }
      return;
    }
    case 'metal': {
      ctx.fillStyle = th.ground; ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
      ctx.strokeStyle = th.dark; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      circ(ctx, x + 7, y + 7, 2, th.topHi); circ(ctx, x + 33, y + 7, 2, th.topHi); circ(ctx, x + 7, y + 33, 2, th.topHi); circ(ctx, x + 33, y + 33, 2, th.topHi);
      if (isTop) { ctx.fillStyle = th.top; ctx.fillRect(x, y, TILE + 0.5, 6); ctx.fillStyle = h < 0.5 ? '#ffd23a' : '#222'; ctx.fillRect(x, y + 6, TILE + 0.5, 3); }
      return;
    }
  }
  ctx.fillStyle = th.ground; ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
  ctx.fillStyle = th.dark;
  if (h < 0.6) ctx.fillRect(x + 4 + h * 40, y + 8 + ((h * 997) % 1) * 22, 7, 5);
  if (h > 0.3) ctx.fillRect(x + 22 - h * 10, y + 26, 5, 4);
  if (th.tile === 'crystal' && h > 0.75) tri(ctx, x + 12, y + 30, x + 18, y + 8, x + 24, y + 30, 'rgba(180,140,255,0.6)');
  if (isTop) {
    ctx.fillStyle = th.top; ctx.fillRect(x, y, TILE + 0.5, 12);
    circ(ctx, x + 6, y + 12, 6, th.top); circ(ctx, x + 20, y + 13, 6, th.top); circ(ctx, x + 34, y + 12, 6, th.top);
    ctx.fillStyle = th.topHi; ctx.fillRect(x, y, TILE + 0.5, 3);
    if (th.bg === 'forest' && h > 0.8) { circ(ctx, x + 12, y - 2, 3, '#ff6fb5'); circ(ctx, x + 12, y - 2, 1.2, '#fff4a0'); }
  }
  if (isBottom && th.cave && ty < 4) {
    tri(ctx, x + 6, y + TILE, x + 12, y + TILE + 10 + h * 8, x + 18, y + TILE, th.dark);
    tri(ctx, x + 22, y + TILE, x + 28, y + TILE + 6 + h * 10, x + 34, y + TILE, th.dark);
  }
}

function drawPlatform(ctx, th, x, y, tx) {
  switch (th.plat) {
    case 'cloud':
      circ(ctx, x + 10, y + 14, 11, '#b9d3ee'); circ(ctx, x + 28, y + 12, 13, '#b9d3ee');
      circ(ctx, x + 10, y + 12, 11, '#fff'); circ(ctx, x + 28, y + 10, 13, '#fff');
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y + 10, TILE + 0.5, 12);
      ctx.fillStyle = '#c9ddf2'; ctx.fillRect(x, y + 18, TILE + 0.5, 5);
      return;
    case 'stone':
      ctx.fillStyle = '#5a4a48'; ctx.fillRect(x, y, TILE + 0.5, 16);
      ctx.fillStyle = '#7a6662'; ctx.fillRect(x, y, TILE + 0.5, 4);
      return;
    case 'metal':
      ctx.fillStyle = '#5b6170'; ctx.fillRect(x, y, TILE + 0.5, 12);
      ctx.fillStyle = (tx % 2) ? '#ffd23a' : '#2b2b2b'; ctx.fillRect(x, y + 12, TILE + 0.5, 4);
      return;
    case 'ice':
      ctx.fillStyle = 'rgba(200,240,255,0.95)'; ctx.fillRect(x, y, TILE + 0.5, 14);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y + 3, 14, 3);
      return;
    case 'coral':
      ctx.fillStyle = '#ff7f8a'; rrect(ctx, x, y, TILE, 14, 7); ctx.fill();
      return;
    case 'crystal':
      ctx.fillStyle = '#7a5ad0'; ctx.fillRect(x, y, TILE + 0.5, 12);
      tri(ctx, x + 6, y + 12, x + 12, y + 24, x + 18, y + 12, '#b89aff');
      tri(ctx, x + 22, y + 12, x + 28, y + 20, x + 34, y + 12, '#9a7ae8');
      return;
    default:
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x, y, TILE + 0.5, 14);
      ctx.fillStyle = '#a86f3a'; ctx.fillRect(x, y, TILE + 0.5, 4);
      ctx.fillStyle = '#5e3b1a'; ctx.fillRect(x + TILE - 2, y, 2, 14);
  }
}

// ---------- Arka planlar (paralaks katmanlar) ----------
function layer(ctx, camX, f, period, VW, fn) {
  const off = -(((camX * f) % period) + period) % period;
  for (let bx = off - period, k = Math.floor((camX * f) / period) - 1; bx < VW + period; bx += period, k++) fn(bx, k);
}

function skyGrad(ctx, th, VW, VH) {
  const gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
}

function drawBackground(ctx, th, camX, VW, VH, t) {
  skyGrad(ctx, th, VW, VH);
  switch (th.bg) {
    case 'hub':
      ctx.save(); ctx.globalAlpha = 0.35; ctx.lineWidth = 18;
      ['#ff4d4d', '#ffa64d', '#ffe14d', '#5fd35f', '#4da6ff', '#a64dff'].forEach((c, i) => {
        ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(VW / 2, VH + 40, 420 - i * 18, Math.PI, 0); ctx.stroke();
      });
      ctx.restore();
      layer(ctx, camX, 0.2, 500, VW, (bx, k) => {
        for (let i = 0; i < 3; i++) {
          const h = hash2(k, i);
          const bx2 = bx + i * 160 + h * 60, by = 120 + h * 200 + Math.sin(t + i + k) * 10;
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx2, by + 22); ctx.lineTo(bx2, by + 60); ctx.stroke();
          ell(ctx, bx2, by, 16, 21, ['#ff5e7e', '#5ec8ff', '#ffd23a', '#8aff6a'][(k + i + 8) % 4]);
        }
      });
      break;
    case 'forest':
      circ(ctx, VW - 120, 90, 45, 'rgba(255,250,200,0.9)');
      layer(ctx, camX, 0.15, 900, VW, (bx) => {
        for (let i = 0; i < 4; i++) circ(ctx, bx + i * 240 + 80, VH - 60, 200 + (i % 2) * 40, '#8fd387');
      });
      layer(ctx, camX, 0.35, 700, VW, (bx, k) => {
        for (let i = 0; i < 4; i++) {
          const h = hash2(k, i), tx = bx + i * 175 + h * 60;
          ctx.fillStyle = '#5a3a20'; ctx.fillRect(tx - 8, VH - 230, 16, 200);
          circ(ctx, tx, VH - 250, 55 + h * 20, '#3f9a3c'); circ(ctx, tx - 35, VH - 220, 40, '#4aa846'); circ(ctx, tx + 35, VH - 225, 42, '#3a9036');
        }
      });
      break;
    case 'desert':
      circ(ctx, VW - 160, 110, 60, 'rgba(255,240,180,0.95)');
      layer(ctx, camX, 0.12, 1000, VW, (bx) => {
        tri(ctx, bx + 200, VH - 120, bx + 340, VH - 300, bx + 480, VH - 120, '#e8b86a');
        tri(ctx, bx + 340, VH - 300, bx + 480, VH - 120, bx + 400, VH - 120, '#d29e52');
        tri(ctx, bx + 520, VH - 120, bx + 600, VH - 220, bx + 680, VH - 120, '#e8b86a');
      });
      layer(ctx, camX, 0.3, 800, VW, (bx, k) => {
        ctx.fillStyle = '#f0c878';
        ctx.beginPath(); ctx.moveTo(bx, VH);
        for (let i = 0; i <= 20; i++) ctx.lineTo(bx + i * 40, VH - 130 - Math.sin(i * 0.5 + k) * 40);
        ctx.lineTo(bx + 800, VH); ctx.fill();
        const cx = bx + 300 + hash2(k, 1) * 300;
        ctx.fillStyle = '#4a9a40'; rrect(ctx, cx - 10, VH - 260, 20, 110, 10); ctx.fill();
        rrect(ctx, cx - 34, VH - 230, 12, 40, 6); ctx.fill(); rrect(ctx, cx + 22, VH - 240, 12, 40, 6); ctx.fill();
        ctx.fillRect(cx - 34, VH - 196, 34, 10); ctx.fillRect(cx, VH - 206, 34, 10);
      });
      break;
    case 'sea':
      ctx.save(); ctx.globalAlpha = 0.15;
      for (let i = 0; i < 6; i++) {
        const x = ((i * 260 - camX * 0.1) % (VW + 300) + VW + 300) % (VW + 300) - 150;
        tri(ctx, x, 0, x + 60, 0, x + 160 + Math.sin(t * 0.5 + i) * 30, VH, '#fff');
      }
      ctx.restore();
      layer(ctx, camX, 0.35, 600, VW, (bx, k) => {
        for (let i = 0; i < 5; i++) {
          const sx = bx + i * 120 + hash2(k, i) * 50;
          ctx.strokeStyle = i % 2 ? '#2e8b57' : '#3cb371'; ctx.lineWidth = 8; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(sx, VH);
          for (let j = 1; j <= 5; j++) ctx.lineTo(sx + Math.sin(t * 1.5 + j + i) * 10, VH - j * 35);
          ctx.stroke();
        }
      });
      for (let i = 0; i < 20; i++) {
        const bx = (hash2(i, 3) * VW + Math.sin(t + i) * 10);
        const by = VH - ((t * 40 + hash2(i, 7) * VH) % VH);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, by, 3 + hash2(i, 9) * 4, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    case 'lava':
      layer(ctx, camX, 0.25, 600, VW, (bx, k) => {
        for (let i = 0; i < 6; i++) { const h = hash2(k, i); tri(ctx, bx + i * 100, 0, bx + i * 100 + 40, 90 + h * 120, bx + i * 100 + 80, 0, '#2a0c08'); }
        ctx.fillStyle = '#3a120a';
        ctx.beginPath(); ctx.moveTo(bx, VH);
        for (let i = 0; i <= 12; i++) ctx.lineTo(bx + i * 50, VH - 160 - hash2(k, i + 20) * 120);
        ctx.lineTo(bx + 600, VH); ctx.fill();
      });
      { const gr = ctx.createLinearGradient(0, VH - 150, 0, VH); gr.addColorStop(0, 'rgba(255,90,20,0)'); gr.addColorStop(1, 'rgba(255,120,30,0.45)'); ctx.fillStyle = gr; ctx.fillRect(0, VH - 150, VW, 150); }
      for (let i = 0; i < 14; i++) {
        const ex = hash2(i, 5) * VW, ey = VH - ((t * 30 + hash2(i, 6) * VH) % VH);
        circ(ctx, ex + Math.sin(t * 2 + i) * 8, ey, 2, 'rgba(255,180,60,0.8)');
      }
      break;
    case 'sky':
      layer(ctx, camX, 0.08, 1100, VW, (bx, k) => {
        for (let i = 0; i < 3; i++) { const h = hash2(k, i); const cx = bx + i * 360 + h * 100, cy = 380 + h * 120; circ(ctx, cx, cy, 70, 'rgba(255,255,255,0.6)'); circ(ctx, cx + 70, cy + 10, 55, 'rgba(255,255,255,0.6)'); circ(ctx, cx - 60, cy + 15, 50, 'rgba(255,255,255,0.6)'); }
      });
      layer(ctx, camX, 0.25, 800, VW, (bx, k) => {
        for (let i = 0; i < 3; i++) { const h = hash2(k, i + 9); const cx = bx + i * 270 + h * 80, cy = 90 + h * 160; const c = 'rgba(255,255,255,0.75)'; circ(ctx, cx, cy, 40, c); circ(ctx, cx + 40, cy + 6, 32, c); circ(ctx, cx - 36, cy + 8, 28, c); }
      });
      break;
    case 'city':
      circ(ctx, VW * 0.7, VH - 200, 70, 'rgba(255,220,150,0.9)');
      layer(ctx, camX, 0.15, 900, VW, (bx, k) => {
        for (let i = 0; i < 9; i++) { const h = hash2(k, i); ctx.fillStyle = '#b06a6a'; ctx.fillRect(bx + i * 100, VH - 200 - h * 200, 90, 400); }
      });
      layer(ctx, camX, 0.35, 800, VW, (bx, k) => {
        for (let i = 0; i < 6; i++) {
          const h = hash2(k, i + 3), bh = 180 + h * 180, wx = bx + i * 135;
          ctx.fillStyle = '#6a4a6a'; ctx.fillRect(wx, VH - bh, 110, bh);
          ctx.fillStyle = '#ffd98a';
          for (let wy = VH - bh + 15; wy < VH - 20; wy += 30) for (let wxx = wx + 12; wxx < wx + 100; wxx += 26) if (hash2(wxx, wy) < 0.45) ctx.fillRect(wxx, wy, 12, 16);
        }
      });
      break;
    case 'snow':
      layer(ctx, camX, 0.1, 1000, VW, (bx) => {
        tri(ctx, bx + 100, VH, bx + 350, VH - 380, bx + 600, VH, '#a8c4e0');
        tri(ctx, bx + 290, VH - 290, bx + 350, VH - 380, bx + 410, VH - 290, '#fff');
        tri(ctx, bx + 500, VH, bx + 700, VH - 300, bx + 900, VH, '#b8d2ea');
        tri(ctx, bx + 652, VH - 228, bx + 700, VH - 300, bx + 748, VH - 228, '#fff');
      });
      layer(ctx, camX, 0.3, 600, VW, (bx, k) => {
        for (let i = 0; i < 5; i++) { const px = bx + i * 120 + hash2(k, i) * 40; tri(ctx, px - 30, VH - 120, px, VH - 230, px + 30, VH - 120, '#2f6b4f'); tri(ctx, px - 22, VH - 170, px, VH - 240, px + 22, VH - 170, '#fff'); }
      });
      for (let i = 0; i < 40; i++) {
        const sx = (hash2(i, 1) * VW + Math.sin(t + i) * 20 - camX * 0.5) % VW;
        const sy = (t * 40 + hash2(i, 2) * VH) % VH;
        circ(ctx, (sx + VW) % VW, sy, 2.5, 'rgba(255,255,255,0.9)');
      }
      break;
    case 'swamp':
      layer(ctx, camX, 0.3, 700, VW, (bx, k) => {
        for (let i = 0; i < 3; i++) {
          const tx = bx + i * 230 + hash2(k, i) * 60;
          ctx.strokeStyle = '#2f3a20'; ctx.lineWidth = 14; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(tx, VH); ctx.lineTo(tx + 10, VH - 300); ctx.stroke();
          ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tx + 8, VH - 220); ctx.lineTo(tx + 60, VH - 280); ctx.moveTo(tx + 6, VH - 180); ctx.lineTo(tx - 50, VH - 230); ctx.stroke();
        }
      });
      ctx.fillStyle = 'rgba(220,240,200,0.18)';
      for (let i = 0; i < 3; i++) ctx.fillRect(0, VH - 160 + i * 40 + Math.sin(t + i) * 8, VW, 22);
      for (let i = 0; i < 16; i++) circ(ctx, (hash2(i, 4) * VW + Math.sin(t * 0.7 + i) * 30), 150 + hash2(i, 8) * 300 + Math.cos(t + i) * 20, 2.5, `rgba(230,255,120,${0.4 + 0.4 * Math.sin(t * 3 + i)})`);
      break;
    case 'crystal':
      layer(ctx, camX, 0.25, 700, VW, (bx, k) => {
        for (let i = 0; i < 6; i++) {
          const h = hash2(k, i), cx = bx + i * 115, ch = 80 + h * 140;
          tri(ctx, cx, VH, cx + 25, VH - ch, cx + 50, VH, `rgba(${150 + h * 100},120,255,0.35)`);
          tri(ctx, cx + 20, 0, cx + 35, 60 + h * 80, cx + 50, 0, 'rgba(120,80,200,0.35)');
        }
      });
      for (let i = 0; i < 25; i++) circ(ctx, hash2(i, 2) * VW, hash2(i, 3) * VH, 1.5 + Math.sin(t * 2 + i), 'rgba(220,180,255,0.7)');
      break;
    case 'space':
      for (let i = 0; i < 90; i++) {
        const sx = ((hash2(i, 1) * 2000 - camX * 0.05) % 2000 + 2000) % 2000;
        if (sx > VW) continue;
        circ(ctx, sx, hash2(i, 2) * VH, 1 + hash2(i, 3) * 1.5, `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 2 + i)})`);
      }
      layer(ctx, camX, 0.1, 1400, VW, (bx) => {
        circ(ctx, bx + 300, 160, 70, '#e2734a'); ell(ctx, bx + 300, 160, 120, 18, 'rgba(255,220,180,0.5)'); circ(ctx, bx + 280, 140, 15, 'rgba(0,0,0,0.12)');
        circ(ctx, bx + 1000, 360, 30, '#6ac0ff');
      });
      layer(ctx, camX, 0.3, 700, VW, (bx, k) => {
        for (let i = 0; i < 3; i++) circ(ctx, bx + i * 240 + hash2(k, i) * 80, 220 + hash2(k, i + 5) * 260, 12 + hash2(k, i + 7) * 16, '#4a4458');
      });
      break;
  }
}
