// Motor do jogo: física, inimigos, pontuação e fluxo das fases.
const PHYS = { WALK: 50, CLIMB: 34, JUMP_V: 100, GRAV: 360, MAXFALL: 230, FALL_LIMIT: 30 };
const STEP = 1 / 120;
const BONUS_TICK = 1.6;
const HAMMER_TIME = 9.5;
const EXTRA_LIVES = [10000, 30000, 60000, 100000, 150000];

const Game = (() => {
  const G = {
    mode: 'attract',
    players: [],
    field: [],
    turn: 0,
    level: null,
    fase: 1,
    startFase: 1,
    ranked: true,
    state: 'idle',
    stateT: 0,
    stateDur: 0,
    t: 0,
    bonus: 0,
    bonusT: 0,
    barrels: [],
    fires: [],
    pans: [],
    springs: [],
    fx: [],
    floaters: [],
    lucas: null,
    hiscore: 0,
    rivetsRemoved: new Set(),
    barrelCount: 0,
    msg: '',
    winner: null,
    staticDirty: true,
    paused: false,
    shake: 0,
    acc: 0,
    tally: 0,
  };
  const handlers = {};
  const emit = (name, data) => (handlers[name] || []).forEach((fn) => fn(data));
  const on = (name, fn) => ((handlers[name] = handlers[name] || []).push(fn));

  // ------------------------------------------------------------ utilidades
  function supportAt(x, y, tol = 3.5) {
    let best = null, bd = tol;
    for (const p of G.level.platforms) {
      if (x < p.x1 - 0.01 || x > p.x2 + 0.01) continue;
      const d = Math.abs(surfY(p, x) - y);
      if (d <= bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  function landingAt(x, prevY, newY, skip) {
    let best = null, by = Infinity;
    for (const p of G.level.platforms) {
      if (p === skip) continue;
      if (x < p.x1 - 0.5 || x > p.x2 + 0.5) continue;
      const sy = surfY(p, x);
      const syPrev = sy - (p.dy || 0);
      if (prevY <= syPrev + 1 && newY >= sy - 0.01 && sy < by) {
        by = sy;
        best = p;
      }
    }
    return best;
  }

  function hitCircleBox(cx, cy, r, bx, by, hw, hh) {
    const dx = Math.max(Math.abs(cx - bx) - hw, 0);
    const dy = Math.max(Math.abs(cy - by) - hh, 0);
    return dx * dx + dy * dy < r * r;
  }

  const alive = () => G.field.filter((p) => !p.dead);

  function nearestPlayer(x, y, filter) {
    let best = null, bd = Infinity;
    for (const p of alive()) {
      if (filter && !filter(p)) continue;
      const d = Math.abs(p.x - x) + Math.abs(p.y - y) * 1.5;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  // ------------------------------------------------------------ efeitos
  function floater(x, y, text, color) {
    G.floaters.push({ x, y, text, color: color || '#ffd166', t: 0 });
  }

  function burst(x, y, n, colors, speed, life, size, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.4 + Math.random() * 0.8);
      G.fx.push({
        kind: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3,
        life: life * (0.6 + Math.random() * 0.6), t: 0,
        color: pick(colors), size: size * (0.6 + Math.random() * 0.7), grav: grav == null ? 120 : grav,
      });
    }
  }

  function puff(x, y, color) {
    G.fx.push({ kind: 'puff', x, y, t: 0, life: 0.45, color: color || '#ffffff' });
  }

  function dust(x, y) {
    for (let i = 0; i < 5; i++) {
      G.fx.push({ kind: 'dust', x: x + rand(-3, 3), y: y - 0.5, vx: rand(-14, 14), vy: rand(-10, -2), t: 0, life: 0.4, size: rand(1, 1.8) });
    }
  }

  function confetti(n) {
    const cols = ['#ff5470', '#ffd166', '#5ee7ff', '#ff8fc7', '#80ffdb', '#c77dff'];
    for (let i = 0; i < n; i++) {
      G.fx.push({
        kind: 'confetti', x: rand(0, W), y: rand(-40, 0), vx: rand(-12, 12), vy: rand(20, 50),
        t: 0, life: rand(2.5, 4), color: pick(cols), rot: rand(0, TAU), vr: rand(-8, 8), size: rand(1.4, 2.4),
      });
    }
  }

  function addScore(p, pts, x, y, color) {
    if (!p) return;
    p.score += pts;
    if (x != null) floater(x, y, String(pts), color);
    while (p.extraIdx < EXTRA_LIVES.length && p.score >= EXTRA_LIVES[p.extraIdx]) {
      p.extraIdx++;
      p.lives++;
      Sound.play('oneup');
      floater(p.x, p.y - 26, '+1 VIDA', '#80ffdb');
    }
    if (p.score > G.hiscore) G.hiscore = p.score;
  }

  // ------------------------------------------------------------ jogadores
  function newPlayer(slot, info) {
    return {
      slot,
      pid: info.pid || null,
      name: info.name || 'Jogador',
      color: info.color || '#ff5470',
      score: 0,
      lives: 3,
      extraIdx: 0,
      out: false,
      fase: G.startFase,
      maxFase: G.startFase,
      rivets: [],
      ctrl: 0,
    };
  }

  function placePlayer(p, spot) {
    Object.assign(p, {
      x: spot.x, y: spot.y, vx: 0, vy: 0,
      facing: spot.x < W / 2 ? 1 : -1,
      state: 'ground', support: spot.plat, ladder: null, climbFrom: 'bottom',
      jumping: false, apexY: spot.y, hammer: 0, swingT: 0, hammerUp: false,
      dead: false, deadT: 0, deadWhy: '', inv: 0, anim: 0, stepT: 0, jumpBuf: 0, credits: [], moving: false,
    });
  }

  function kill(p, why) {
    if (p.dead || G.state !== 'play') return;
    p.dead = true;
    p.deadT = 0;
    p.deadWhy = why;
    p.hammer = 0;
    p.state = 'dead';
    Sound.play('die');
    G.shake = 0.25;
    if (G.mode !== 'duelo') {
      Sound.music(null);
      setState('dying', 2.4);
    }
  }

  function ladderAt(p, end) {
    for (const ld of G.level.ladders) {
      if (Math.abs(p.x - ld.x) > 4.5 || ld.ext < 1) continue;
      if (end === 'bottom') {
        if (Math.abs(p.y - ld.bottom) <= 3) return ld;
      } else if (!ld.broken && Math.abs(p.y - ld.top) <= 3) {
        return ld;
      }
    }
    return null;
  }

  function startClimb(p, ld, from) {
    p.state = 'climb';
    p.ladder = ld;
    p.climbFrom = from;
    p.x = ld.x;
    p.y = from === 'bottom' ? ld.bottom : ld.top;
    p.support = null;
  }

  function finishClimb(p, plat) {
    p.state = 'ground';
    p.support = plat;
    p.y = surfY(plat, p.x);
    p.ladder = null;
  }

  function doJump(p, mv) {
    const lift = p.support && p.support.kind === 'lift' ? p.support.dy / STEP : 0;
    p.state = 'air';
    p.vy = -PHYS.JUMP_V + Math.min(0, lift) * 0.5;
    p.vx = mv * PHYS.WALK;
    if (mv) p.facing = mv;
    p.jumping = true;
    p.apexY = p.y;
    p.support = null;
    p.credits = [];
    p.jumpBuf = 0;
    Sound.play('jump');
  }

  function land(p, s) {
    p.y = surfY(s, p.x);
    const fall = p.y - p.apexY;
    p.state = 'ground';
    p.support = s;
    p.vy = 0;
    if (fall > PHYS.FALL_LIMIT) {
      kill(p, 'queda');
      return;
    }
    Sound.play('land');
    dust(p.x, p.y);
    if (p.jumping && p.credits.length) {
      const n = p.credits.length;
      const pts = n === 1 ? 100 : n === 2 ? 300 : 500 + (n - 3) * 300;
      addScore(p, pts, p.x, p.y - 22);
      Sound.play('score');
    }
    p.jumping = false;
    p.credits = [];
  }

  function updatePlayer(p, dt) {
    if (p.dead) {
      p.deadT += dt;
      return;
    }
    const inp = Input.poll(p.ctrl);
    const mv = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (p.inv > 0) p.inv -= dt;
    if (inp.jumpPressed) p.jumpBuf = 0.14;
    else if (p.jumpBuf > 0) p.jumpBuf -= dt;

    if (p.hammer > 0) {
      p.hammer -= dt;
      p.swingT += dt;
      if (p.swingT > 0.13) {
        p.swingT = 0;
        p.hammerUp = !p.hammerUp;
      }
      if (p.hammer <= 0) {
        p.hammer = 0;
        floater(p.x, p.y - 24, 'FIM DO MARTELO', '#ffffff');
      }
    }

    p.moving = false;
    if (p.state === 'climb') {
      const ld = p.ladder;
      const dir = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      const minY = ld.broken ? ld.gapBot : ld.top;
      p.y = clamp(p.y + dir * PHYS.CLIMB * dt, minY, ld.bottom);
      if (dir) {
        p.anim += dt;
        p.moving = true;
        p.stepT += dt;
        if (p.stepT > 0.17) {
          p.stepT = 0;
          p.stepI = !p.stepI;
          Sound.play('climb', p.stepI);
        }
      }
      if (dir < 0 && !ld.broken && p.y <= ld.top + 0.001) finishClimb(p, ld.upper);
      else if (dir > 0 && p.y >= ld.bottom - 0.001) finishClimb(p, ld.lower);
      else if (!dir && mv) {
        if (!ld.broken && p.y <= ld.top + 0.6) finishClimb(p, ld.upper);
        else if (p.y >= ld.bottom - 0.6) finishClimb(p, ld.lower);
      }
      return;
    }

    if (p.state === 'ground') {
      const s0 = p.support;
      if (s0 && s0.dy) p.y += s0.dy;
      if (p.hammer <= 0) {
        if (inp.up) {
          const ld = ladderAt(p, 'bottom');
          if (ld) return startClimb(p, ld, 'bottom');
        }
        if (inp.down) {
          const ld = ladderAt(p, 'top');
          if (ld) return startClimb(p, ld, 'top');
        }
        if (p.jumpBuf > 0) return doJump(p, mv);
      }
      if (mv) {
        p.facing = mv;
        p.moving = true;
        p.anim += dt;
        p.stepT += dt;
        if (p.stepT > 0.16) {
          p.stepT = 0;
          p.stepI = !p.stepI;
          Sound.play('step', p.stepI);
        }
      }
      const belt = s0 ? s0.belt || 0 : 0;
      const nx = clamp(p.x + mv * PHYS.WALK * dt + belt * dt, 4, W - 4);
      let s = s0 && nx >= s0.x1 && nx <= s0.x2 && Math.abs(surfY(s0, nx) - p.y) < 3.5 ? s0 : supportAt(nx, p.y);
      p.x = nx;
      if (s) {
        p.support = s;
        p.y = surfY(s, nx);
      } else {
        p.state = 'air';
        p.vy = 0;
        p.vx = mv * PHYS.WALK * 0.6;
        p.jumping = false;
        p.apexY = p.y;
        p.support = null;
      }
      return;
    }

    // no ar
    if (inp.jumpPressed) p.jumpBuf = 0.14;
    p.vy = Math.min(p.vy + PHYS.GRAV * dt, PHYS.MAXFALL);
    const prevY = p.y;
    let nx = p.x + p.vx * dt;
    if (nx < 4 || nx > W - 4) {
      nx = clamp(nx, 4, W - 4);
      p.vx = -p.vx * 0.3;
    }
    p.x = nx;
    p.y += p.vy * dt;
    p.apexY = Math.min(p.apexY, p.y);
    if (p.vy >= 0) {
      const s = landingAt(p.x, prevY, p.y);
      if (s) land(p, s);
    }
    if (p.y > H + 20) kill(p, 'queda');
  }

  // ------------------------------------------------------------ fase
  function initShafts() {
    const lv = G.level;
    lv.shafts.forEach((s) => {
      s.speed = lv.diff.liftSpeed;
      s.plats = [];
      const off = rand(0, s.spacing);
      for (let y = s.top + 6 + off; y < s.bottom; y += s.spacing) addLift(s, y);
    });
  }

  function addLift(s, y) {
    const p = { kind: 'lift', x1: s.x - s.w / 2, x2: s.x + s.w / 2, y1: y, y2: y, belt: 0, dir: 1, dy: 0, shaft: s };
    s.plats.push(p);
    G.level.platforms.push(p);
  }

  function removeLift(s, p) {
    s.plats.splice(s.plats.indexOf(p), 1);
    const i = G.level.platforms.indexOf(p);
    if (i >= 0) G.level.platforms.splice(i, 1);
    for (const pl of G.field) {
      if (pl.support === p && !pl.dead) {
        pl.state = 'air';
        pl.support = null;
        pl.vy = 0;
        pl.vx = 0;
        pl.apexY = pl.y;
      }
    }
  }

  function loadLevel(fase) {
    G.level = buildLevel(fase, G.seed);
    G.fase = fase;
    const lv = G.level;
    G.barrels = [];
    G.fires = [];
    G.pans = [];
    G.springs = [];
    G.bonus = lv.diff.bonus;
    G.bonusT = 0;
    G.barrelCount = 0;
    G.fireT = 3;
    G.foxT = 2.5;
    G.t = 0;
    G.lucas = {
      x: lv.lucas.x, y: lv.lucas.y, dir: lv.lucas.dir, minX: lv.lucas.minX, maxX: lv.lucas.maxX,
      state: 'idle', mode: 'idle', timer: 1.4, t: 0, vx: 0, vy: 0, look: 0, hold: null,
    };
    G.laraCarried = false;
    lv.platforms.forEach((p) => {
      if (p.pans) p.panT = rand(0.5, 2.5);
      if (p.flip) p.flipT = p.flip;
    });
    // rebites removidos continuam removidos depois de perder uma vida
    lv.rivets.forEach((r, i) => {
      if (G.rivetsRemoved.has(i)) {
        r.removed = true;
        lv.platforms.splice(lv.platforms.indexOf(r.plat), 1);
      }
    });
    initShafts();
    if (lv.type === 'elevator') {
      const n = lv.diff.loop >= 2 ? 3 : 2;
      lv.fireStarts.slice(0, n).forEach((s) => spawnFire(s.x, s.y, s.plat, 'fire'));
    }
    G.field.forEach((p, i) => placePlayer(p, i === 1 && G.mode === 'duelo' ? lv.start2 : lv.start));
    G.staticDirty = true;
  }

  function setState(s, dur) {
    G.state = s;
    G.stateT = 0;
    G.stateDur = dur || 0;
    emit('state', s);
  }

  function stageMusic() {
    return G.level ? G.level.type : 'menu';
  }

  // ------------------------------------------------------------ inimigos
  function spawnBarrel(kind, blue) {
    const lv = G.level, lu = G.lucas;
    G.barrelCount++;
    if (kind === 'drop') {
      G.barrels.push({ x: lv.dropX, y: lu.y - 26, vx: 0, vy: 10, state: 'drop', dir: 1, rot: 0, blue: true, decided: new Set() });
    } else if (kind === 'wild') {
      G.barrels.push({ x: lu.x + lu.dir * 20, y: lu.y - 8, vx: lu.dir * 26, vy: -30, state: 'wild', dir: lu.dir, rot: 0, blue, decided: new Set(), last: null });
    } else {
      const s = lv.barrelSpawn;
      G.barrels.push({ x: s.x, y: s.y, vx: 0, vy: 0, state: 'roll', dir: s.plat.dir, plat: s.plat, rot: 0, blue, decided: new Set() });
    }
  }

  function barrelTakesLadder(b, ld) {
    let p = G.level.diff.ladderChance;
    const tgt = nearestPlayer(b.x, b.y, (pl) => pl.y > b.y + 8);
    if (tgt) {
      if (Math.abs(tgt.x - ld.x) < 36) p += 0.3;
      if (tgt.state === 'climb' && tgt.ladder === ld) p += 0.12;
    }
    return chance(Math.min(p, 0.85));
  }

  function absorbAtDrum(b) {
    const lv = G.level;
    b.dead = true;
    puff(lv.oil.x, lv.oil.y - 16, '#ffd9a0');
    if (b.blue || b.state === 'drop') {
      if (!lv.oil.lit) {
        lv.oil.lit = true;
        Sound.play('fire');
      }
      if (G.fires.length < lv.diff.fireMax) {
        const f = spawnFire(lv.oil.x, lv.oil.y - 16, null, 'fire');
        f.state = 'air';
        f.vx = G.level.md(30);
        f.vy = -70;
      }
    }
  }

  function updateBarrel(b, dt) {
    const lv = G.level, d = lv.diff;
    if (b.state === 'roll') {
      const sp = d.barrelSpeed;
      b.x += b.dir * sp * dt;
      b.rot += (b.dir * sp * dt) / 5;
      const s = b.x >= b.plat.x1 && b.x <= b.plat.x2 ? b.plat : supportAt(b.x, b.y, 3);
      if (!s) {
        b.state = 'fall';
        b.vx = b.dir * 30;
        b.vy = 0;
        b.bounced = false;
        return;
      }
      b.plat = s;
      b.y = surfY(s, b.x);
      for (const ld of lv.ladders) {
        if (ld.upper !== s || b.decided.has(ld) || Math.abs(b.x - ld.x) > 1) continue;
        b.decided.add(ld);
        if (barrelTakesLadder(b, ld)) {
          b.state = 'ladder';
          b.ladder = ld;
          b.x = ld.x;
          return;
        }
      }
      if (lv.oil && s === lv.bottom && lv.type === 'barrels' && Math.abs(b.x - lv.oil.x) < 9) absorbAtDrum(b);
      if (b.x < 2 || b.x > W - 2) {
        b.x = clamp(b.x, 2, W - 2);
        b.dir = -b.dir;
      }
    } else if (b.state === 'fall') {
      b.vy += PHYS.GRAV * dt;
      b.x += b.vx * dt;
      // paredes invisíveis: o barril nunca sai pela lateral
      if (b.x < 5 || b.x > W - 5) {
        b.x = clamp(b.x, 5, W - 5);
        b.vx = -b.vx * 0.5;
      }
      b.rot += (b.vx * dt) / 5;
      const prevY = b.y;
      b.y += b.vy * dt;
      if (b.vy > 0) {
        const s = landingAt(b.x, prevY, b.y);
        if (s) {
          b.y = surfY(s, b.x);
          b.plat = s;
          if (!b.bounced && b.vy > 80) {
            b.vy = -b.vy * 0.32;
            b.vx = s.dir * 18;
            b.bounced = true;
          } else {
            b.state = 'roll';
            b.dir = s.dir;
            b.vy = 0;
          }
        }
      }
      if (b.y > H + 20) b.dead = true;
    } else if (b.state === 'ladder') {
      const ld = b.ladder;
      b.y += d.barrelSpeed * 0.72 * dt;
      if (b.y >= ld.bottom) {
        b.y = ld.bottom;
        b.state = 'roll';
        b.plat = ld.lower;
        b.dir = ld.lower.dir;
      }
    } else if (b.state === 'wild' || b.state === 'drop') {
      b.vy = Math.min(b.vy + PHYS.GRAV * 0.75 * dt, 170);
      b.x += b.vx * dt;
      b.rot += 0.2;
      if (b.x < 6 || b.x > W - 6) {
        b.vx = -b.vx;
        b.x = clamp(b.x, 6, W - 6);
      }
      const prevY = b.y;
      b.y += b.vy * dt;
      if (b.vy > 0) {
        for (const p of lv.platforms) {
          if (p === b.last || b.x < p.x1 || b.x > p.x2) continue;
          const sy = surfY(p, b.x);
          if (prevY <= sy && b.y >= sy) {
            if (p === lv.bottom) {
              b.y = sy;
              b.plat = p;
              if (b.state === 'drop' && lv.oil && Math.abs(b.x - lv.oil.x) < 10) {
                absorbAtDrum(b);
              } else {
                b.state = 'roll';
                b.dir = p.dir;
              }
            } else if (b.state === 'wild') {
              b.last = p;
              b.vy = -58;
              const tgt = nearestPlayer(b.x, b.y);
              const toward = tgt ? sign(tgt.x - b.x) || 1 : pick([-1, 1]);
              b.vx = (chance(0.7) ? toward : -toward) * rand(18, 46);
            }
            break;
          }
        }
      }
      if (b.y > H + 20) b.dead = true;
    }
  }

  function spawnFire(x, y, plat, kind) {
    const f = {
      x, y, plat, kind, state: plat ? 'ground' : 'air', vx: 0, vy: 0,
      dir: pick([-1, 1]), think: rand(0.5, 1.5), ladderCd: 0.6, t: rand(0, 5), ladder: null, climbDir: 0,
    };
    G.fires.push(f);
    return f;
  }

  function updateFire(f, dt) {
    const lv = G.level, d = lv.diff;
    f.t += dt;
    const scaredBy = alive().find((p) => p.hammer > 0 && Math.abs(p.x - f.x) < 90 && Math.abs(p.y - f.y) < 40);
    f.scared = !!alive().find((p) => p.hammer > 0);
    if (f.state === 'air') {
      f.vy += PHYS.GRAV * dt;
      f.x = clamp(f.x + f.vx * dt, 4, W - 4);
      const prevY = f.y;
      f.y += f.vy * dt;
      if (f.vy > 0) {
        const s = landingAt(f.x, prevY, f.y);
        if (s && s.kind !== 'lift') {
          f.y = surfY(s, f.x);
          f.plat = s;
          f.state = 'ground';
          f.dir = sign(f.vx) || f.dir;
        }
      }
      if (f.y > H + 20) f.dead = true;
      return;
    }
    if (f.state === 'climb') {
      const ld = f.ladder;
      f.y += f.climbDir * d.fireClimb * dt;
      if (f.climbDir < 0 && f.y <= ld.top) {
        f.y = ld.top;
        f.plat = ld.upper;
        f.state = 'ground';
        f.ladderCd = 0.8;
      } else if (f.climbDir > 0 && f.y >= ld.bottom) {
        f.y = ld.bottom;
        f.plat = ld.lower;
        f.state = 'ground';
        f.ladderCd = 0.8;
      }
      return;
    }
    if (lv.platforms.indexOf(f.plat) < 0) {
      f.dead = true;
      puff(f.x, f.y - 5);
      return;
    }
    const sp = d.fireSpeed * (f.scared ? 0.7 : 1) * (lv.type === 'rivets' ? 1.1 : 1);
    f.think -= dt;
    f.ladderCd -= dt;
    if (f.think <= 0) {
      f.think = rand(0.7, 2);
      const tgt = nearestPlayer(f.x, f.y);
      if (scaredBy) f.dir = sign(f.x - scaredBy.x) || 1;
      else if (tgt && Math.abs(tgt.y - f.y) < 14 && chance(0.7)) f.dir = sign(tgt.x - f.x) || f.dir;
      else if (chance(0.35)) f.dir = -f.dir;
    }
    const nx = f.x + f.dir * sp * dt;
    const s = nx >= f.plat.x1 && nx <= f.plat.x2 ? f.plat : supportAt(nx, f.y, 3);
    if (!s || s.kind === 'lift' || nx < 4 || nx > W - 4) {
      f.dir = -f.dir;
    } else {
      f.x = nx;
      f.plat = s;
      f.y = surfY(s, nx);
    }
    if (f.ladderCd <= 0) {
      for (const ld of lv.ladders) {
        if (ld.broken || ld.ext < 1 || Math.abs(f.x - ld.x) > 1.2) continue;
        const canUp = ld.lower === f.plat, canDown = ld.upper === f.plat;
        if (!canUp && !canDown) continue;
        f.ladderCd = 0.6;
        const tgt = nearestPlayer(f.x, f.y);
        let goUp = canUp && chance(0.15), goDown = canDown && chance(0.12);
        if (tgt && !f.scared) {
          if (canUp && tgt.y < f.y - 10) goUp = chance(0.6);
          if (canDown && tgt.y > f.y + 10) goDown = chance(0.5);
        } else if (tgt && f.scared) {
          if (canUp && tgt.y > f.y) goUp = chance(0.5);
          if (canDown && tgt.y < f.y) goDown = chance(0.5);
        }
        if (goUp || goDown) {
          f.state = 'climb';
          f.ladder = ld;
          f.climbDir = goUp ? -1 : 1;
          f.x = ld.x;
        }
        break;
      }
    }
  }

  function updatePans(dt) {
    const lv = G.level, d = lv.diff;
    lv.platforms.forEach((p) => {
      if (!p.pans) return;
      p.panT -= dt;
      if (p.panT <= 0) {
        p.panT = rand(d.panMin, d.panMax);
        const x = p.belt > 0 ? p.x1 + 5 : p.x2 - 5;
        const crowded = G.pans.some((pn) => pn.plat === p && Math.abs(pn.x - x) < 18);
        if (!crowded && G.pans.length < 10) G.pans.push({ x, y: p.y1, plat: p, falling: false, vy: 0 });
      }
    });
    for (const pn of G.pans) {
      if (!pn.falling) {
        pn.x += pn.plat.belt * dt;
        if (pn.x < pn.plat.x1 - 1 || pn.x > pn.plat.x2 + 1) pn.falling = true;
      } else {
        pn.vy += PHYS.GRAV * dt;
        pn.y += pn.vy * dt;
        if (pn.y > pn.plat.y1 + 16) pn.dead = true;
      }
    }
  }

  function updateSprings(dt) {
    const line = G.level.springLine;
    const dir = sign(line.endX - line.x0);
    const ground = line.plat.y1;
    for (const s of G.springs) {
      s.squash = Math.max(0, (s.squash || 0) - dt * 6);
      s.vy += 380 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.state === 'hop') {
        if ((dir > 0 && s.x > line.endX + 3) || (dir < 0 && s.x < line.endX - 3)) {
          s.state = 'drop';
          s.vx = 0;
        } else if (s.vy > 0 && s.y >= ground) {
          s.y = ground;
          s.vy = -140;
          s.squash = 1;
          Sound.play('spring');
        }
      }
      if (s.y > H + 24) s.dead = true;
    }
  }

  function updateLucas(dt) {
    const lu = G.lucas, lv = G.level, d = lv.diff;
    lu.t += dt;
    const tgt = nearestPlayer(lu.x, lu.y);
    lu.look = tgt ? sign(tgt.x - lu.x) * lu.dir : 0;
    if (lv.type === 'barrels' || lv.type === 'elevator') {
      lu.timer -= dt;
      if (lu.mode === 'idle') {
        lu.state = lu.t % 6 < 1.1 ? 'beat' : 'idle';
        if (lu.timer <= 0) {
          lu.mode = 'grab';
          lu.timer = 0.32;
          lu.state = 'grab';
        }
      } else if (lu.mode === 'grab') {
        if (lu.timer <= 0) {
          lu.mode = 'hold';
          lu.timer = 0.34;
          lu.state = 'hold';
          if (lv.type === 'barrels') {
            const first = G.barrelCount === 0;
            const wild = !first && G.barrelCount > 2 && chance(d.wildChance);
            const blue = first || (G.fires.length < d.fireMax && chance(d.blueChance));
            lu.hold = { kind: first ? 'drop' : wild ? 'wild' : 'roll', blue };
          } else {
            lu.hold = { kind: 'spring' };
          }
        }
      } else if (lu.mode === 'hold') {
        if (lu.timer <= 0) {
          if (lu.hold.kind === 'spring') {
            G.springs.push({ x: lv.springLine.x0, y: lv.springLine.plat.y1 - 4, vx: sign(lv.springLine.endX - lv.springLine.x0) * d.springSpeed, vy: -110, state: 'hop', squash: 0 });
          } else {
            spawnBarrel(lu.hold.kind, lu.hold.blue);
          }
          lu.hold = null;
          lu.mode = 'release';
          lu.timer = 0.3;
          lu.state = 'throw';
        }
      } else if (lu.mode === 'release' && lu.timer <= 0) {
        lu.mode = 'idle';
        lu.state = 'idle';
        lu.timer = lv.type === 'barrels' ? rand(d.throwMin, d.throwMax) : rand(d.springMin, d.springMax);
      }
    } else {
      lu.timer -= dt;
      if (lu.mode !== 'walk') {
        lu.state = 'beat';
        if (lu.timer <= 0) {
          lu.mode = 'walk';
          lu.timer = rand(1.6, 4);
          let dir = chance(0.5) ? 1 : -1;
          if (tgt && chance(0.5)) dir = sign(tgt.x - lu.x) || dir;
          lu.vx = dir * d.lucasSpeed;
        }
      } else {
        lu.state = 'walk';
        lu.x += lu.vx * dt;
        if (lu.x < lu.minX) { lu.x = lu.minX; lu.vx = Math.abs(lu.vx); }
        if (lu.x > lu.maxX) { lu.x = lu.maxX; lu.vx = -Math.abs(lu.vx); }
        lu.dir = sign(lu.vx) || lu.dir;
        if (lu.timer <= 0) {
          lu.mode = 'pause';
          lu.timer = rand(0.8, 1.6);
        }
      }
    }
  }

  function updateLevelMachines(dt) {
    const lv = G.level;
    lv.shafts.forEach((s) => {
      for (const p of s.plats.slice()) {
        const prev = p.y1;
        p.y1 = p.y2 = p.y1 + s.dir * s.speed * dt;
        p.dy = p.y1 - prev;
        if (s.dir < 0) {
          for (const pl of G.field) {
            if (pl.support === p && !pl.dead && p.y1 - 17 < s.top) kill(pl, 'esmagado');
          }
          if (p.y1 <= s.top + 2) removeLift(s, p);
        } else if (p.y1 > s.bottom) {
          removeLift(s, p);
        }
      }
      if (s.dir < 0) {
        const low = s.plats.reduce((m, p) => Math.max(m, p.y1), -Infinity);
        if (!s.plats.length || low < s.bottom - s.spacing) addLift(s, s.plats.length ? low + s.spacing : s.bottom);
      } else {
        const high = s.plats.reduce((m, p) => Math.min(m, p.y1), Infinity);
        if (!s.plats.length || high > s.top + 6 + s.spacing) addLift(s, s.plats.length ? high - s.spacing : s.top + 6);
      }
    });
    lv.ladders.forEach((ld) => (ld.busy = false));
    G.field.forEach((p) => {
      if (p.state === 'climb' && p.ladder) p.ladder.busy = true;
    });
    lv.ladders.forEach((ld) => {
      const r = ld.retract;
      if (!r) return;
      if (ld.busy && ld.ext === 1) return;
      r.time = (r.time == null ? r.phase : r.time) + dt;
      const cycle = r.on + r.move + r.off + r.move;
      const c = r.time % cycle;
      let ext;
      if (c < r.on) ext = 1;
      else if (c < r.on + r.move) ext = 1 - (c - r.on) / r.move;
      else if (c < r.on + r.move + r.off) ext = 0;
      else ext = (c - r.on - r.move - r.off) / r.move;
      ld.ext = ext;
      const full = ld.bottom - ld.top, min = 7;
      ld.bottomEff = ld.top + min + (full - min) * ext;
    });
    lv.platforms.forEach((p) => {
      if (!p.flip) return;
      p.flipT -= dt;
      if (p.flipT <= 0) {
        p.flipT = p.flip;
        p.belt = -p.belt;
      }
    });
  }

  function hazardShape(kind, h) {
    if (kind === 'barrel') return h.state === 'ladder' ? [h.x, h.y - 4.5, 4.6, 9] : [h.x, h.y - 4.6, 3.9, 8.5];
    if (kind === 'fire') return [h.x, h.y - 5, 3.9, 9];
    if (kind === 'pan') return [h.x, h.y - 3.2, 4.4, 7.6];
    return [h.x, h.y - 5, 4.4, 9.4];
  }

  function smash(h, p, kind) {
    h.dead = true;
    const [hx, hy] = hazardShape(kind, h);
    let pts = kind === 'fire' ? (chance(0.3) ? 800 : 500) : chance(0.25) ? 500 : 300;
    addScore(p, pts, hx, hy - 8);
    burst(hx, hy, 14, ['#ffffff', '#ffd166', '#ff9a3c', '#5ee7ff'], 60, 0.5, 1.4, 60);
    puff(hx, hy, '#ffffff');
    Sound.play('smash');
  }

  function checkCollisions() {
    const lv = G.level;
    const lists = [['barrel', G.barrels], ['fire', G.fires], ['pan', G.pans], ['spring', G.springs]];
    for (const p of alive()) {
      const bx = p.x, by = p.y - 6.5, hw = 3.1;
      for (const [kind, list] of lists) {
        for (const h of list) {
          if (h.dead || (kind === 'pan' && h.falling)) continue;
          const [hx, hy, r, hh] = hazardShape(kind, h);
          if (p.hammer > 0) {
            const zx = p.hammerUp ? p.x + p.facing * 2 : p.x + p.facing * 9;
            const zy = p.hammerUp ? p.y - 24 : p.y - 8;
            const zr = p.hammerUp ? 7 : 7.5;
            if (Math.hypot(hx - zx, hy - zy) < zr + r) {
              smash(h, p, kind);
              continue;
            }
          }
          if (hitCircleBox(hx, hy, r, bx, by, hw, 6)) {
            if (p.hammer > 0 && sign(hx - p.x) === p.facing) {
              smash(h, p, kind);
              continue;
            }
            if (p.inv <= 0) kill(p, 'acerto');
            if (p.dead) break;
          }
          // pulou por cima?
          if (p.jumping && !p.dead && p.credits.indexOf(h) < 0 && Math.abs(hx - p.x) < 5) {
            const top = hy + r - hh;
            if (p.y <= top + 1.5 && top - p.y < 30) p.credits.push(h);
          }
        }
        if (p.dead) break;
      }
      if (p.dead) continue;

      // tambor em chamas
      if (lv.oil && lv.oil.lit && hitCircleBox(lv.oil.x, lv.oil.y - 9, 7.5, bx, by, hw, 6)) {
        if (p.inv <= 0) kill(p, 'fogo');
        if (p.dead) continue;
      }
      // Lucas
      const lu = G.lucas;
      if (Math.abs(p.x - lu.x) < 12 + 3.4 && p.y > lu.y - 27 && p.y - 12 < lu.y) {
        if (p.inv <= 0) kill(p, 'lucas');
        if (p.dead) continue;
      }
      // martelos
      for (const hm of lv.hammers) {
        if (hm.taken || p.state === 'climb') continue;
        if (Math.abs(hm.x - p.x) < 7 && p.y - 20 < hm.y + 4 && p.y > hm.y - 6) {
          hm.taken = true;
          p.hammer = HAMMER_TIME;
          p.swingT = 0;
          Sound.play('hammer');
          burst(hm.x, hm.y, 10, ['#ffd166', '#ffffff'], 40, 0.4, 1.2, 40);
        }
      }
      // itens da Lara
      for (const it of lv.items) {
        if (it.taken) continue;
        if (Math.abs(it.x - p.x) < 7 && Math.abs(it.y - 6 - (p.y - 7)) < 11) {
          it.taken = true;
          addScore(p, lv.diff.itemPts, it.x, it.y - 14, '#ff8fc7');
          Sound.play('item');
          burst(it.x, it.y - 6, 12, ['#ff8fc7', '#ffd166', '#ffffff'], 45, 0.6, 1.3, 30);
        }
      }
    }
  }

  function checkRivets() {
    const lv = G.level;
    lv.rivets.forEach((r, idx) => {
      if (r.removed) return;
      for (const p of alive()) {
        const near = p.state !== 'climb' && p.y <= r.y + 1 && p.y >= r.y - 26 && Math.abs(p.x - r.x) < 18;
        if (!near) {
          r.side[p.slot] = 0;
          continue;
        }
        const s = p.x < r.x - 4 ? -1 : p.x > r.x + 4 ? 1 : 0;
        if (!s) continue;
        if (r.side[p.slot] && s !== r.side[p.slot]) {
          r.removed = true;
          G.rivetsRemoved.add(idx);
          lv.platforms.splice(lv.platforms.indexOf(r.plat), 1);
          G.field.forEach((q) => {
            if (q.support === r.plat && !q.dead) {
              q.state = 'air';
              q.support = null;
              q.vy = 0;
              q.apexY = q.y;
            }
          });
          addScore(p, 100, r.x, r.y - 6);
          Sound.play('rivet');
          burst(r.x, r.y + 3, 12, ['#ffd166', '#fff0a8', '#ffffff'], 50, 0.5, 1.2);
          G.staticDirty = true;
          if (lv.rivets.every((q) => q.removed)) stageClear(p);
          break;
        }
        r.side[p.slot] = s;
      }
    });
  }

  function stageClear(p) {
    if (G.state !== 'play') return;
    G.winner = p;
    G.clearFinal = G.level.type === 'rivets';
    setState('clear');
    Sound.music(null);
    Sound.play(G.clearFinal ? 'rescue' : 'clear');
    G.field.forEach((q) => {
      q.hammer = 0;
      if (q.state === 'air') q.vy = Math.max(q.vy, 0);
    });
    [G.barrels, G.fires, G.pans, G.springs].forEach((list) => {
      list.forEach((h) => puff(h.x, h.y - 5, '#ffffff'));
      list.length = 0;
    });
    G.tally = G.bonus;
    G.tallyT = 0;
    G.heartT = 0;
    G.lucas.startX = G.lucas.x;
    G.lucas.startY = G.lucas.y;
    G.lucas.vy = 0;
    if (G.clearFinal) confetti(70);
  }

  function updateClear(dt) {
    const lv = G.level, lu = G.lucas, p = G.winner;
    const t = G.stateT;
    lu.t += dt;
    if (p && !p.dead && p.state === 'air') {
      // termina o pulo antes da comemoração
      p.vy = Math.min(p.vy + PHYS.GRAV * dt, PHYS.MAXFALL);
      const prevY = p.y;
      p.y += p.vy * dt;
      const s = landingAt(p.x, prevY, p.y);
      if (s) {
        p.y = surfY(s, p.x);
        p.state = 'ground';
        p.support = s;
      }
    }
    if (!G.clearFinal) {
      lu.state = t < 0.9 ? 'beat' : 'climb';
      if (t >= 0.9 && t < 1.5) {
        const k = (t - 0.9) / 0.6;
        const tx = lv.lara.x - lv.lara.dir * 13;
        lu.x = lerp(lu.startX, tx, k);
        lu.y = lerp(lu.startY, lv.lara.y, k) - Math.sin(k * Math.PI) * 14;
      } else if (t >= 1.5) {
        G.laraCarried = true;
        lu.y -= 46 * dt;
      }
    } else {
      if (t > 0.5 && !lu.fallen) {
        lu.state = 'fall';
        lu.vy += 260 * dt;
        lu.y += lu.vy * dt;
        if (lu.y >= 248) {
          lu.y = 248;
          lu.fallen = true;
          G.shake = 0.5;
          Sound.play('thud');
          burst(lu.x, 246, 20, ['#c9b79c', '#8d7b63', '#ffffff'], 70, 0.7, 1.6);
        }
      }
      if (t > 1.6 && p && !p.reunited) {
        p.reunited = true;
        puff(p.x, p.y - 8, '#ffffff');
        p.x = lv.lara.x - 12;
        p.y = lv.lara.y;
        p.facing = 1;
        p.state = 'ground';
        p.support = null;
        burst(p.x, p.y - 8, 16, ['#ff8fc7', '#ffd166', '#ffffff'], 50, 0.7, 1.3, 20);
      }
    }
    const tallyStart = G.clearFinal ? 3.4 : 2.6;
    if (t > tallyStart && G.tally > 0) {
      G.tallyT += dt;
      while (G.tallyT > 0.022 && G.tally > 0) {
        G.tallyT -= 0.022;
        G.tally -= 100;
        addScore(p, 100);
        if ((G.tally / 100) % 2 === 0) Sound.play('tick');
      }
      G.bonus = G.tally;
      if (G.tally <= 0) G.tallyDone = t;
    }
    if (t > tallyStart && G.tally <= 0 && t > (G.tallyDone || 0) + 1.1 && t > (G.clearFinal ? 5.8 : 4)) nextStage();
  }

  function nextStage() {
    const p = G.winner;
    if (p) p.reunited = false;
    G.rivetsRemoved = new Set();
    if (G.mode === 'revez') {
      const cur = G.field[0];
      cur.fase += 1;
      cur.rivets = [];
      cur.maxFase = Math.max(cur.maxFase, cur.fase);
      loadLevel(cur.fase);
    } else {
      G.players.forEach((q) => (q.maxFase = Math.max(q.maxFase, G.fase + 1)));
      loadLevel(G.fase + 1);
    }
    G.msg = G.clearFinal ? 'O Lucas voltou! Volta ' + G.level.loop : '';
    emit('progress', { fase: G.fase, players: G.players });
    setState('intro', G.clearFinal ? 2.8 : 2.2);
  }

  function afterDeath() {
    const p = G.field[0];
    p.lives--;
    if (G.mode === 'solo') {
      if (p.lives > 0) {
        loadLevel(G.fase);
        G.msg = '';
        setState('intro', 1.4);
      } else {
        gameOver();
      }
      return;
    }
    // revezamento: passa a vez
    p.fase = G.fase;
    p.rivets = Array.from(G.rivetsRemoved);
    if (p.lives <= 0) p.out = true;
    const n = G.players.length;
    let next = -1;
    for (let k = 1; k <= n; k++) {
      const idx = (G.turn + k) % n;
      if (!G.players[idx].out) {
        next = idx;
        break;
      }
    }
    if (next < 0) return gameOver();
    G.turn = next;
    const q = G.players[next];
    G.field = [q];
    G.rivetsRemoved = new Set(q.rivets);
    loadLevel(q.fase);
    G.msg = n > 1 ? 'Vez de ' + q.name : '';
    setState('intro', n > 1 ? 2.2 : 1.4);
  }

  function updateDuelDeaths(dt) {
    for (const p of G.field.slice()) {
      if (!p.dead) continue;
      if (p.deadT > 2.2) {
        p.lives--;
        if (p.lives > 0) {
          placePlayer(p, p.slot === 1 ? G.level.start2 : G.level.start);
          p.inv = 2.5;
          puff(p.x, p.y - 8);
        } else {
          p.out = true;
          G.field = G.field.filter((q) => q !== p);
          floater(W / 2, 120, p.name + ' saiu!', '#ffffff');
        }
      }
    }
    if (!G.field.length) gameOver();
  }

  function gameOver() {
    setState('over');
    Sound.music(null);
    emit('over', results());
  }

  function results() {
    return {
      mode: G.mode,
      ranked: G.ranked,
      startFase: G.startFase,
      players: G.players.map((p) => ({ pid: p.pid, name: p.name, color: p.color, score: p.score, fase: Math.max(p.maxFase, G.mode === 'revez' ? p.fase : G.fase) })),
    };
  }

  // ------------------------------------------------------------ passo principal
  function updatePlay(dt) {
    const lv = G.level;
    G.t += dt;
    updateLevelMachines(dt);
    G.field.forEach((p) => updatePlayer(p, dt));
    if (G.state !== 'play' && G.state !== 'clear') return;
    updateLucas(dt);
    G.barrels.forEach((b) => updateBarrel(b, dt));
    G.fires.forEach((f) => updateFire(f, dt));
    if (lv.type === 'conveyor') {
      updatePans(dt);
      G.fireT -= dt;
      if (G.fireT <= 0) {
        G.fireT = rand(4, 7);
        if (G.fires.length < lv.diff.fireMax && G.mode !== 'attract') {
          const f = spawnFire(lv.oil.x, lv.oil.y - 16, null, 'fire');
          f.state = 'air';
          f.vx = pick([-1, 1]) * 26;
          f.vy = -80;
        }
      }
    }
    if (lv.type === 'elevator') updateSprings(dt);
    if (lv.type === 'rivets' && G.mode !== 'attract') {
      G.foxT -= dt;
      if (G.foxT <= 0) {
        G.foxT = lv.diff.foxEvery * rand(0.8, 1.2);
        if (G.fires.length < lv.diff.foxMax) {
          for (let tries = 0; tries < 12; tries++) {
            const pl = pick(lv.foxFloors);
            const x = rand(pl.x1 + 6, pl.x2 - 6);
            if (alive().every((p) => Math.abs(p.x - x) + Math.abs(p.y - pl.y1) > 60)) {
              spawnFire(x, pl.y1, pl, 'spark');
              puff(x, pl.y1 - 6, '#ff86cf');
              break;
            }
          }
        }
      }
    }
    G.barrels = G.barrels.filter((b) => !b.dead);
    G.fires = G.fires.filter((f) => !f.dead);
    G.pans = G.pans.filter((p) => !p.dead);
    G.springs = G.springs.filter((s) => !s.dead);
    if (G.mode === 'attract') return;

    checkCollisions();
    if (G.state !== 'play') return;
    checkRivets();
    if (G.state !== 'play') return;
    for (const p of alive()) {
      if (lv.goal && p.state === 'ground' && p.support === lv.goal) {
        stageClear(p);
        return;
      }
    }
    G.bonusT += dt;
    if (G.bonusT >= BONUS_TICK) {
      G.bonusT -= BONUS_TICK;
      G.bonus = Math.max(0, G.bonus - 100);
      if (G.bonus === 0) {
        alive().forEach((p) => kill(p, 'tempo'));
        if (G.mode === 'duelo') G.bonus = lv.diff.bonus;
      }
    }
    if (G.mode === 'duelo') updateDuelDeaths(dt);
    if (G.state === 'play') Sound.music(alive().some((p) => p.hammer > 0) ? 'hammer' : stageMusic());
  }

  function updateFx(dt) {
    G.fx = G.fx.filter((f) => {
      f.t += dt;
      if (f.kind === 'spark' || f.kind === 'dust') {
        f.vy += (f.grav || 30) * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      } else if (f.kind === 'confetti') {
        f.x += (f.vx + Math.sin(f.t * 3 + f.rot) * 10) * dt;
        f.y += f.vy * dt;
        f.rot += f.vr * dt;
      }
      return f.t < f.life;
    });
    G.floaters = G.floaters.filter((f) => {
      f.t += dt;
      f.y -= 16 * dt;
      return f.t < 1.1;
    });
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
  }

  function step(dt) {
    G.stateT += dt;
    switch (G.state) {
      case 'intro':
        G.lucas.t += dt;
        G.lucas.state = 'beat';
        G.t += dt;
        if (G.stateT >= G.stateDur) {
          setState('play');
          Sound.music(stageMusic());
        }
        break;
      case 'play':
        updatePlay(dt);
        break;
      case 'dying':
        G.field.forEach((p) => {
          if (p.dead) p.deadT += dt;
        });
        if (G.stateT >= G.stateDur) afterDeath();
        break;
      case 'clear':
        updateClear(dt);
        break;
      default:
        break;
    }
    updateFx(dt);
  }

  function tick(realDt) {
    if (!G.level || G.paused) return;
    G.acc = Math.min(G.acc + realDt, 0.25);
    while (G.acc >= STEP) {
      step(STEP);
      G.acc -= STEP;
    }
  }

  // ------------------------------------------------------------ API
  function startAttract() {
    G.mode = 'attract';
    G.players = [];
    G.field = [];
    G.rivetsRemoved = new Set();
    G.paused = false;
    G.startFase = 1;
    G.seed = null;
    loadLevel(1);
    G.level.oil.lit = false;
    setState('play');
    G.fx = [];
    G.floaters = [];
  }

  function start(cfg) {
    G.mode = cfg.mode;
    G.startFase = cfg.startFase || 1;
    G.seed = cfg.random ? Math.floor(Math.random() * 1e9) : null;
    G.ranked = G.startFase === 1;
    G.hiscore = cfg.hiscore || 0;
    G.players = cfg.players.map((info, i) => newPlayer(i, info));
    G.players.forEach((p, i) => {
      p.ctrl = G.mode === 'duelo' ? i : 0;
      if (G.mode === 'duelo') p.lives = 3;
    });
    G.turn = 0;
    G.field = G.mode === 'revez' ? [G.players[0]] : G.players.slice();
    G.rivetsRemoved = new Set();
    G.fx = [];
    G.floaters = [];
    G.paused = false;
    G.acc = 0;
    Input.setDuel(G.mode === 'duelo');
    Input.reset();
    loadLevel(G.startFase);
    G.msg = G.mode === 'revez' && G.players.length > 1 ? 'Vez de ' + G.players[0].name : '';
    setState('intro', 2.4);
    Sound.play('start');
    Sound.music(null);
  }

  function setPaused(v) {
    if (G.mode === 'attract' || G.state === 'over') return;
    G.paused = v;
    Input.reset();
    if (v) Sound.music(null);
    else if (G.state === 'play') Sound.music(stageMusic());
  }

  function quit() {
    const r = results();
    G.paused = false;
    return r;
  }

  return { G, on, tick, start, startAttract, setPaused, quit, results, supportAt };
})();
