'use strict';

// ---------- Küçük yardımcılar ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- Dünya ölçüleri ----------
const TILE = 40;   // bir karo kaç piksel
const LH = 15;     // bölüm yüksekliği (karo) -> 600 piksel, ekranın tamamı
const SOLID = { '#': true, 'C': true, '*': true };

// Karo harfleri:
//  .  boş          #  zemin         =  tek yönlü platform (alttan geçilir)
//  ^  diken        W  su            L  lav
//  V  sarmaşık     C  çatlak taş    *  zıplama mantarı
//  p  gizli oyuk (boş ama karanlık çizilir)

// ---------- Karakterler ----------
const LAND_FORMS = ['goril', 'maymun', 'panter', 'kurbaga', 'insan', 'inek'];
const WATER_FORMS = ['yunus', 'balik', 'ahtapot', 'kopekbaligi', 'orka'];
const FORM_NAMES = {
  goril: 'Goril', maymun: 'Maymun', panter: 'Panter', kurbaga: 'Kurbağa', insan: 'İnsan', inek: 'İnek',
  yunus: 'Yunus', balik: 'Balık', ahtapot: 'Ahtapot', kopekbaligi: 'Köpekbalığı', orka: 'Orka',
};
const isWaterForm = (f) => WATER_FORMS.includes(f);

// ---------- Güçler: her tema bir tane verir ----------
const POWERS = {
  climb:  { icon: '🌿', name: 'Tırmanma',        help: 'Sarmaşığa gel, ↑ ile tırman' },
  dash:   { icon: '💨', name: 'Atılma',          help: 'Güç tuşu (⚡) ile ileri fırla' },
  bubble: { icon: '🫧', name: 'Kabarcık Atışı',  help: 'Suda yumruk tuşu kabarcık fırlatır' },
  pound:  { icon: '💥', name: 'Yere Çakılma',    help: 'Havada ↓ bas, çatlak taşları kır' },
  glide:  { icon: '🪂', name: 'Süzülme',         help: 'Düşerken zıplamayı basılı tut' },
  wall:   { icon: '🧗', name: 'Duvar Zıplaması', help: 'Duvara değerken tekrar zıpla' },
  double: { icon: '⏫', name: 'Çift Zıplama',    help: 'Havadayken bir kez daha zıpla' },
  heart:  { icon: '❤️', name: 'Ekstra Kalp',     help: 'Artık 4 kalbin var' },
  magnet: { icon: '🧲', name: 'Muz Mıknatısı',   help: 'Yakındaki muzlar sana uçar' },
  speed:  { icon: '⚡', name: 'Süper Hız',       help: 'Daha hızlı koşarsın' },
};

// ---------- Temalar (0 = karakter dünyası) ----------
const THEMES = [
  { name: 'Karakter Dünyası', icon: '🎭', sky: ['#ff9fd8', '#ffe9a8'], ground: '#a0683a', dark: '#7c4f2a', top: '#ff6fb5', topHi: '#ffb3dc',
    tile: 'dirt', plat: 'wood', bg: 'hub', water: 'rgba(40,150,255,0.45)', mapDeco: ['🎈', '🎪', '🌈'] },

  { name: 'Orman', icon: '🌳', sky: ['#45a8ff', '#d2f2ff'], ground: '#7b4b26', dark: '#5c381b', top: '#43b23a', topHi: '#7fdc5c',
    tile: 'dirt', plat: 'wood', bg: 'forest', power: 'climb',
    walker: { style: 'beetle', color: '#d8352a', color2: '#2b1a12' }, flyer: { style: 'bee', color: '#ffd21f', color2: '#2b2b2b' },
    seg: { flat: 3, step: 2, gap: 2, plats: 1, spikes: 0.5, pond: 1, vine: 1.6, spring: 0.7 },
    spike: '#a7a7a7', water: 'rgba(40,150,255,0.45)', mapDeco: ['🌳', '🌲', '🍄'] },

  { name: 'Çöl', icon: '🌵', sky: ['#ffb347', '#fff1c1'], ground: '#d9a45b', dark: '#b8843f', top: '#f3cf7a', topHi: '#fff0b0',
    tile: 'dirt', plat: 'wood', bg: 'desert', power: 'dash',
    walker: { style: 'scorpion', color: '#a0522d', color2: '#5a2a12' }, flyer: { style: 'vulture', color: '#6b4a2e', color2: '#e8d2b0' },
    seg: { flat: 3, step: 2, gap: 2.5, plats: 1, spikes: 1.5, pond: 0.25, spring: 0.5, mplat: 0.6 },
    spike: '#3f9b3a', water: 'rgba(40,190,220,0.5)', mapDeco: ['🌵', '🐪', '🏜️'] },

  { name: 'Deniz', icon: '🌊', sky: ['#0b4f8a', '#2aa7d8'], ground: '#c9a86a', dark: '#9c7f48', top: '#ff7f8a', topHi: '#ffb0b8',
    tile: 'dirt', plat: 'coral', bg: 'sea', power: 'bubble', underwater: true,
    walker: { style: 'crab', color: '#ff5a3c', color2: '#b53220' }, flyer: { style: 'puffer', color: '#ffd84a', color2: '#c99a20' },
    spike: '#4a2a7a', water: 'rgba(20,110,200,0.16)', mapDeco: ['🌊', '🐠', '🐚'] },

  { name: 'Lav Mağarası', icon: '🌋', sky: ['#1c0606', '#5e1608'], ground: '#4a3a38', dark: '#2e2322', top: '#6b5552', topHi: '#ff7a2e',
    tile: 'dirt', plat: 'stone', bg: 'lava', power: 'pound', cave: true, lava: true,
    walker: { style: 'slime', color: '#ff6a1a', color2: '#ffd23a' }, flyer: { style: 'firebat', color: '#c8281e', color2: '#ff9a3a' },
    seg: { flat: 3, step: 2, gap: 3, plats: 1.5, spikes: 1, spring: 0.3, cracked: 1.2, mplat: 0.6 },
    spike: '#8a8a8a', mapDeco: ['🌋', '🔥', '🪨'] },

  { name: 'Gökyüzü', icon: '☁️', sky: ['#2f8ff0', '#9fd6ff'], ground: '#ffffff', dark: '#dce9f7', top: '#ffffff', topHi: '#ffffff',
    tile: 'cloud', plat: 'cloud', bg: 'sky', power: 'glide',
    walker: { style: 'puff', color: '#9aa9c9', color2: '#ffe14a' }, flyer: { style: 'bird', color: '#ff8a3d', color2: '#ffd2a8' },
    seg: { flat: 2, step: 1.5, gap: 2, plats: 3, mplat: 2, spring: 1 },
    spike: '#ffd23a', mapDeco: ['☁️', '🎈', '🌈'] },

  { name: 'Şehir', icon: '🏙️', sky: ['#ff8a65', '#ffe0b2'], ground: '#8d8fa0', dark: '#6c6e80', top: '#55576a', topHi: '#a9abbd',
    tile: 'building', plat: 'metal', bg: 'city', power: 'wall', npc: true,
    walker: { style: 'robot', color: '#7a8aa0', color2: '#ff3b3b' }, flyer: { style: 'pigeon', color: '#8a8f99', color2: '#5fbf9a' },
    seg: { flat: 3, step: 3, gap: 2.2, plats: 1.5, spikes: 0.3, mplat: 0.5, cracked: 0.3 },
    spike: '#c0c0c0', mapDeco: ['🏢', '🏙️', '🚕'] },

  { name: 'Karlı Dağ', icon: '🏔️', sky: ['#8ec5ff', '#f0f8ff'], ground: '#9fc4e0', dark: '#7aa3c4', top: '#ffffff', topHi: '#ffffff',
    tile: 'dirt', plat: 'ice', bg: 'snow', power: 'double', ice: true,
    walker: { style: 'penguin', color: '#23262e', color2: '#ffffff' }, flyer: { style: 'bird', color: '#6ab0ff', color2: '#e6f3ff' },
    seg: { flat: 3, step: 2, gap: 2, plats: 1.2, spikes: 1, pond: 0.4, spring: 0.5 },
    spike: '#bfe6ff', water: 'rgba(120,200,255,0.5)', mapDeco: ['🏔️', '⛄', '🌲'] },

  { name: 'Bataklık', icon: '🐸', sky: ['#4f6b3a', '#b9c98f'], ground: '#4b3b26', dark: '#33281a', top: '#5f7d2e', topHi: '#89a84a',
    tile: 'dirt', plat: 'wood', bg: 'swamp', power: 'heart',
    walker: { style: 'croc', color: '#3f7d3a', color2: '#e8f0c0' }, flyer: { style: 'mosquito', color: '#4a4a4a', color2: '#c8e8ff' },
    seg: { flat: 2, step: 1.5, gap: 1.5, plats: 1.5, pond: 3, vine: 1, spring: 1 },
    spike: '#7a6a4a', water: 'rgba(60,110,50,0.6)', mapDeco: ['🐸', '🪵', '🍄'] },

  { name: 'Kristal Mağara', icon: '💎', sky: ['#160a2e', '#3c1a6b'], ground: '#3d2f5c', dark: '#281e40', top: '#5a4790', topHi: '#c89bff',
    tile: 'crystal', plat: 'crystal', bg: 'crystal', power: 'magnet', cave: true,
    walker: { style: 'crab', color: '#56e0ff', color2: '#2a8ab0' }, flyer: { style: 'bat', color: '#7a3ab0', color2: '#ff6ad5' },
    seg: { flat: 3, step: 2, gap: 2, plats: 2, spikes: 2, spring: 0.5, cracked: 1 },
    spike: '#7af0ff', mapDeco: ['💎', '🔮', '🦇'] },

  { name: 'Uzay', icon: '🪐', sky: ['#05051a', '#1a1050'], ground: '#6b7080', dark: '#4a4e5c', top: '#9aa0b2', topHi: '#d8dce8',
    tile: 'metal', plat: 'metal', bg: 'space', power: 'speed', grav: 0.5,
    walker: { style: 'alien', color: '#6ee05a', color2: '#2a8a20' }, flyer: { style: 'ufo', color: '#b8c0d0', color2: '#6ae0ff' },
    seg: { flat: 2, step: 1.5, gap: 2, plats: 2, mplat: 2.5, spikes: 0.5, spring: 1 },
    spike: '#ff4a6a', mapDeco: ['🪐', '🚀', '⭐'] },
];
