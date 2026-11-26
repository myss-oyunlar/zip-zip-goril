'use strict';

// Tüm giriş türlerini (klavye, fare, oyun kolu, dokunmatik) tek bir eylem listesinde birleştirir.
// Oyun sadece Input.held / Input.pressed / Input.released'a bakar.
const Input = (() => {
  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'power', 'pause', 'prevTheme', 'nextTheme', 'confirm', 'mute', 'character'];
  const held = {}, pressed = {}, released = {}, prev = {};
  const kb = {}, pad = {}, touch = {}, mouse = {};
  // Aynı kare içinde basılıp bırakılan tuşlar da en az bir kare "basılı" sayılsın.
  const tapped = {};
  const clicks = [];
  let touchMode = false;
  let padWasActive = false;

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump',
    KeyX: 'attack', KeyJ: 'attack', ControlLeft: 'attack',
    KeyC: 'power', KeyK: 'power', ShiftLeft: 'power', ShiftRight: 'power',
    Escape: 'pause', KeyP: 'pause',
    KeyQ: 'prevTheme', PageUp: 'prevTheme',
    KeyE: 'nextTheme', PageDown: 'nextTheme',
    Enter: 'confirm', NumpadEnter: 'confirm',
    KeyM: 'mute',
    KeyT: 'character',
  };

  function setTouchMode(on) {
    if (touchMode === on) return;
    touchMode = on;
    document.body.classList.toggle('touch', on);
  }

  addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (a) { kb[a] = true; tapped[a] = true; e.preventDefault(); }
    setTouchMode(false);
    Sound.unlock();
  });
  addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) kb[a] = false;
  });
  addEventListener('blur', () => {
    for (const k in kb) kb[k] = false;
    for (const k in mouse) mouse[k] = false;
    for (const k in touch) touch[k] = false;
  });

  // ---------- Oyun kolu (PS5 DualSense, Xbox vb. - tarayıcının "standart" eşlemesi) ----------
  //  ✕ (0) zıpla   ○ (1) güç   □ (2) yumruk   △ (3) güç
  //  L1/R1 (4/5) tema değiştir (haritada)   L2 (6) yumruk  R2 (7) güç
  //  Create (8) karakter seçimi   Options (9) duraklat   Yön tuşları (12-15) ve sol çubuk hareket
  function pollPad() {
    for (const k in pad) pad[k] = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let active = false;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (ax < -0.35 || b(14)) pad.left = true;
      if (ax > 0.35 || b(15)) pad.right = true;
      if (ay < -0.5 || b(12)) pad.up = true;
      if (ay > 0.5 || b(13)) pad.down = true;
      if (b(0)) pad.jump = true;
      if (b(2) || b(6)) pad.attack = true;
      if (b(1) || b(3) || b(7)) pad.power = true;
      if (b(8)) pad.character = true;
      if (b(9)) pad.pause = true;
      if (b(4)) pad.prevTheme = true;
      if (b(5)) pad.nextTheme = true;
      for (const btn of gp.buttons) if (btn.pressed) active = true;
      if (Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5) active = true;
    }
    if (active) {
      setTouchMode(false);
      if (!padWasActive) Sound.unlock();
    }
    padWasActive = active;
  }

  addEventListener('gamepadconnected', (e) => {
    if (Input.onGamepad) Input.onGamepad(e.gamepad.id);
  });

  // ---------- Fare ve dokunma (canvas üstü) ----------
  function setupPointer(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      Sound.unlock();
      if (e.pointerType === 'touch') setTouchMode(true);
      else if (e.pointerType === 'mouse') setTouchMode(false);
      clicks.push({ x: e.clientX, y: e.clientY });
      if (e.pointerType === 'mouse') {
        if (e.button === 0) mouse.attack = true;
        if (e.button === 2) mouse.jump = true;
        if (Input.allowMouse) { if (e.button === 0) tapped.attack = true; if (e.button === 2) tapped.jump = true; }
      }
      if (Input.onPointerDown) Input.onPointerDown(e.clientX, e.clientY);
    });
    addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) mouse.attack = false;
        if (e.button === 2) mouse.jump = false;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- Dokunmatik kontroller (sol: sanal çubuk, sağ: tuşlar) ----------
  function setupTouch() {
    if (matchMedia('(pointer: coarse)').matches) setTouchMode(true);
    addEventListener('touchstart', () => setTouchMode(true), { passive: true });

    const stick = document.getElementById('stick');
    const base = document.getElementById('stick-base');
    const knob = document.getElementById('stick-knob');
    const R = 55;
    let sid = null, ox = 0, oy = 0;

    // Taban, parmağın ilk değdiği yere gelir (ox/oy ekran koordinatı); taban #stick kutusunun içinde konumlanır.
    function placeBase() {
      const r = stick.getBoundingClientRect();
      base.style.left = (ox - r.left) + 'px';
      base.style.top = (oy - r.top) + 'px';
    }
    function follow(t) {
      let dx = t.clientX - ox, dy = t.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { // parmak uzaklaşınca taban da peşinden gelsin
        ox += dx * (1 - R / d); oy += dy * (1 - R / d);
        dx = t.clientX - ox; dy = t.clientY - oy;
        placeBase();
      }
      touch.left = dx < -14; touch.right = dx > 14;
      touch.up = dy < -26; touch.down = dy > 26;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    function release() {
      sid = null;
      touch.left = touch.right = touch.up = touch.down = false;
      knob.style.transform = '';
      base.style.left = ''; base.style.top = '';
    }
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      Sound.unlock();
      if (sid !== null) return;
      const t = e.changedTouches[0];
      sid = t.identifier;
      ox = t.clientX; oy = t.clientY;
      placeBase();
      follow(t);
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === sid) follow(t);
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) release(); };
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);

    for (const btn of document.querySelectorAll('.tbtn[data-act]')) {
      const act = btn.dataset.act;
      const ids = new Set();
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        Sound.unlock();
        for (const t of e.changedTouches) ids.add(t.identifier);
        touch[act] = true; tapped[act] = true; btn.classList.add('on');
      }, { passive: false });
      const up = (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) ids.delete(t.identifier);
        if (ids.size === 0) { touch[act] = false; btn.classList.remove('on'); }
      };
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('touchcancel', up, { passive: false });
    }
  }

  // Her karede bir kez çağrılır.
  function update() {
    pollPad();
    for (const a of ACTIONS) {
      const v = !!(kb[a] || tapped[a] || pad[a] || touch[a] || (Input.allowMouse && mouse[a]));
      tapped[a] = false;
      pressed[a] = v && !prev[a];
      released[a] = !v && prev[a];
      held[a] = v;
      prev[a] = v;
    }
  }

  // Fizik bir karede birkaç alt adım çalışır; "basıldı" olayları sadece ilk adımda görülsün.
  function clearEdges() {
    for (const a of ACTIONS) { pressed[a] = false; released[a] = false; }
  }

  function takeClicks() { return clicks.splice(0); }

  return {
    held, pressed, released, update, clearEdges, takeClicks, setupPointer, setupTouch,
    allowMouse: false, onPointerDown: null, onGamepad: null,
    get touchMode() { return touchMode; },
  };
})();
