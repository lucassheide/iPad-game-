// Entrada: teclado, controles de toque e gamepad, para até 2 jogadores.
const Input = (() => {
  const mk = () => ({ left: false, right: false, up: false, down: false, jump: false, jumpQ: false });
  const touch = [mk(), mk()];
  const keyQ = [false, false];
  const prevJump = [false, false];
  const keys = new Set();
  let duel = false;

  const SOLO = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'KeyZ', 'KeyX', 'KeyK', 'KeyJ'],
  };
  const DUEL = [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['Space', 'KeyF', 'KeyG'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['Enter', 'NumpadEnter', 'KeyL', 'Slash', 'ShiftRight'] },
  ];

  function mapFor(i) {
    return duel ? DUEL[i] : i === 0 ? SOLO : null;
  }

  const isTyping = (e) => {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  };

  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    if (!keys.has(e.code)) {
      for (let i = 0; i < 2; i++) {
        const m = mapFor(i);
        if (m && m.jump.includes(e.code)) keyQ[i] = true;
      }
    }
    keys.add(e.code);
    if (Input.captureKeys && /^(Arrow|Space)/.test(e.code)) e.preventDefault();
    if (Input.onKey) Input.onKey(e);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    touch.forEach((t) => Object.assign(t, mk()));
  });

  const anyKey = (list) => list.some((c) => keys.has(c));

  function readPad(i) {
    const out = mk();
    if (!navigator.getGamepads) return out;
    let pads;
    try { pads = navigator.getGamepads(); } catch (e) { return out; }
    const gp = pads && pads[i];
    if (!gp || !gp.connected) return out;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const b = (n) => gp.buttons[n] && gp.buttons[n].pressed;
    out.left = ax < -0.4 || b(14);
    out.right = ax > 0.4 || b(15);
    out.up = ay < -0.5 || b(12);
    out.down = ay > 0.5 || b(13);
    out.jump = b(0) || b(1) || b(2) || b(3);
    return out;
  }

  // Estado do jogador i neste quadro (jumpPressed = acabou de apertar).
  function poll(i) {
    const m = mapFor(i);
    const t = touch[i];
    const g = readPad(i);
    const s = {
      left: t.left || g.left || (m ? anyKey(m.left) : false),
      right: t.right || g.right || (m ? anyKey(m.right) : false),
      up: t.up || g.up || (m ? anyKey(m.up) : false),
      down: t.down || g.down || (m ? anyKey(m.down) : false),
      jump: t.jump || g.jump || (m ? anyKey(m.jump) : false),
    };
    s.jumpPressed = t.jumpQ || keyQ[i] || (g.jump && !prevJump[i]);
    prevJump[i] = g.jump;
    t.jumpQ = false;
    keyQ[i] = false;
    return s;
  }

  // Direcional virtual: aceita diagonais (útil para segurar direita + cima perto da escada).
  function bindPad(el, i) {
    const active = new Map();
    const update = () => {
      const t = touch[i];
      t.left = t.right = t.up = t.down = false;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const rad = r.width / 2;
      for (const p of active.values()) {
        const dx = (p.x - cx) / rad, dy = (p.y - cy) / rad;
        const dead = 0.2;
        if (dx < -dead && Math.abs(dx) > Math.abs(dy) * 0.45) t.left = true;
        if (dx > dead && Math.abs(dx) > Math.abs(dy) * 0.45) t.right = true;
        if (dy < -dead && Math.abs(dy) > Math.abs(dx) * 0.45) t.up = true;
        if (dy > dead && Math.abs(dy) > Math.abs(dx) * 0.45) t.down = true;
      }
      el.dataset.dir = (t.up ? 'u' : '') + (t.down ? 'd' : '') + (t.left ? 'l' : '') + (t.right ? 'r' : '');
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      update();
    });
    el.addEventListener('pointermove', (e) => {
      if (!active.has(e.pointerId)) return;
      e.preventDefault();
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      update();
    });
    const end = (e) => {
      active.delete(e.pointerId);
      update();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  function bindJump(el, i) {
    const active = new Set();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      active.add(e.pointerId);
      touch[i].jump = true;
      touch[i].jumpQ = true;
      el.classList.add('down');
    });
    const end = (e) => {
      active.delete(e.pointerId);
      if (!active.size) {
        touch[i].jump = false;
        el.classList.remove('down');
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  function reset() {
    touch.forEach((t) => Object.assign(t, mk()));
    keyQ[0] = keyQ[1] = false;
  }

  return {
    poll,
    bindPad,
    bindJump,
    reset,
    setDuel(v) { duel = v; },
    captureKeys: false,
    onKey: null,
  };
})();
