// Fases: Barris (25m), Esteiras (50m), Elevadores (75m) e Rebites (100m).
// A cada volta as fases ficam mais rápidas, espelhadas e com outro tema de cores.
const STAGE_TYPES = ['barrels', 'conveyor', 'elevator', 'rivets'];
const STAGE_INFO = {
  barrels: { name: 'Barris', hint: 'Pule os barris (+100) e pegue o martelo para quebrá-los!' },
  conveyor: { name: 'Esteiras', hint: 'As esteiras empurram você. Cuidado com as escadas que recolhem!' },
  elevator: { name: 'Elevadores', hint: 'Use os elevadores e desvie das molas que o Lucas joga.' },
  rivets: { name: 'Rebites', hint: 'Passe pelos 8 rebites amarelos para derrubar o Lucas!' },
};

function surfY(p, x) {
  if (p.x2 === p.x1) return p.y1;
  return p.y1 + ((p.y2 - p.y1) * (x - p.x1)) / (p.x2 - p.x1);
}

// seed = null: ordem clássica. Com seed: ordem, espelho e cores sorteados por partida
// (a Fase 1 é sempre Barris).
function faseInfo(fase, seed) {
  const loop = Math.floor((fase - 1) / 4) + 1;
  let type = STAGE_TYPES[(fase - 1) % 4];
  let mirror = loop % 2 === 0;
  let theme = THEMES[(loop - 1) % THEMES.length];
  if (seed != null) {
    const r = seeded(seed * 7919 + loop * 104729);
    const order = STAGE_TYPES.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (loop === 1) order.splice(0, 0, order.splice(order.indexOf('barrels'), 1)[0]);
    type = order[(fase - 1) % 4];
    const r2 = seeded(seed * 31 + fase * 977);
    r2();
    mirror = fase === 1 ? false : r2() < 0.5;
    theme = fase === 1 ? THEMES[0] : THEMES[Math.floor(r2() * THEMES.length)];
  }
  return {
    fase,
    type,
    loop,
    mirror,
    theme,
    meters: fase * 25,
    name: STAGE_INFO[type].name,
    hint: STAGE_INFO[type].hint,
  };
}

function difficulty(loop) {
  const k = Math.min(loop - 1, 6);
  return {
    loop,
    barrelSpeed: 52 + 7 * k,
    throwMin: Math.max(0.9, 1.9 - 0.17 * k),
    throwMax: Math.max(1.5, 3.1 - 0.25 * k),
    ladderChance: 0.22 + 0.05 * k,
    wildChance: Math.min(0.3, 0.05 + 0.045 * k),
    blueChance: 0.2,
    fireMax: Math.min(5, 2 + Math.floor(k / 1.5)),
    fireSpeed: 22 + 3 * k,
    fireClimb: 15 + 2 * k,
    beltSpeed: 17 + 3 * k,
    panMin: Math.max(1.5, 2.8 - 0.22 * k),
    panMax: Math.max(2.6, 4.4 - 0.3 * k),
    liftSpeed: 19 + 2.5 * k,
    springMin: Math.max(1.3, 2.3 - 0.15 * k),
    springMax: Math.max(2.1, 3.5 - 0.22 * k),
    springSpeed: 48 + 4 * k,
    foxMax: Math.min(5, 2 + Math.floor(k / 2)),
    foxEvery: Math.max(2.6, 5 - 0.4 * k),
    bonus: Math.min(8000, 5000 + 1000 * k),
    itemPts: loop === 1 ? 300 : loop === 2 ? 500 : 800,
    lucasSpeed: 18 + 3 * k,
  };
}

function makeBuilder(mirror) {
  const m = (x) => (mirror ? W - x : x);
  const L = {
    mirror,
    m,
    md: (d) => (mirror ? -d : d),
    platforms: [],
    ladders: [],
    hammers: [],
    items: [],
    rivets: [],
    shafts: [],
    pile: [],
  };

  L.plat = (x1, y1, x2, y2, extra = {}) => {
    let a = [m(x1), y1], b = [m(x2), y2];
    if (a[0] > b[0]) [a, b] = [b, a];
    const p = Object.assign({ kind: 'girder', belt: 0 }, extra, { x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
    if (extra.belt) p.belt = L.md(extra.belt);
    if (extra.dir !== undefined) p.dir = L.md(extra.dir);
    else p.dir = p.y2 > p.y1 ? 1 : p.y2 < p.y1 ? -1 : 1;
    p.id = L.platforms.length;
    L.platforms.push(p);
    return p;
  };

  const pickAt = (pl, x) => {
    if (!Array.isArray(pl)) return pl;
    return pl.find((p) => x >= p.x1 && x <= p.x2);
  };

  L.ladder = (x, lower, upper, opts = {}) => {
    const lx = m(x);
    const lo = pickAt(lower, lx), up = pickAt(upper, lx);
    if (!lo || !up || lx < lo.x1 || lx > lo.x2 || lx < up.x1 || lx > up.x2) {
      throw new Error('Escada fora da plataforma em x=' + x);
    }
    const top = surfY(up, lx), bottom = surfY(lo, lx);
    const ld = {
      x: lx,
      top,
      bottom,
      lower: lo,
      upper: up,
      broken: !!opts.broken,
      gapTop: top + 4.5,
      gapBot: bottom - 6,
      retract: opts.retract ? { on: opts.retract[0], move: 0.45, off: opts.retract[1], phase: opts.retract[2] || 0 } : null,
      ext: 1,
      busy: false,
    };
    ld.bottomEff = bottom;
    L.ladders.push(ld);
    return ld;
  };

  L.hammer = (x, plat) => {
    const hx = m(x);
    L.hammers.push({ x: hx, y: surfY(plat, hx) - 27, taken: false, t: Math.random() * 3 });
  };

  L.item = (x, plat, kind) => {
    const ix = m(x);
    L.items.push({ x: ix, y: surfY(plat, ix), kind, taken: false });
  };

  L.at = (x, plat) => {
    const px = m(x);
    return { x: px, y: surfY(plat, px), plat };
  };

  return L;
}

// Sorteia posições de escadas num intervalo, com distância mínima entre elas.
function pickSpots(rng, n, lo, hi, minGap, taken) {
  const out = [];
  for (let tries = 0; tries < 60 && out.length < n; tries++) {
    const x = Math.round(lo + rng() * (hi - lo));
    if (out.concat(taken || []).every((o) => Math.abs(o - x) >= minGap)) out.push(x);
  }
  return out;
}

function buildBarrels(L) {
  const lp = L.plat(88, 52, 136, 52, { dir: 1 });
  const g5a = L.plat(0, 80, 144, 80, { dir: 1 });
  const g5b = L.plat(144, 80, 208, 84);
  const g4 = L.plat(16, 117, 224, 111);
  const g3 = L.plat(0, 144, 208, 150);
  const g2 = L.plat(16, 182, 224, 176);
  const g1 = L.plat(0, 209, 208, 215);
  const g0 = L.plat(0, 247, 224, 241);
  const g5 = [g5a, g5b];

  if (!L.rng) {
    L.ladder(80, g0, g1, { broken: true });
    L.ladder(184, g0, g1);
    L.ladder(32, g1, g2);
    L.ladder(104, g1, g2);
    L.ladder(72, g2, g3, { broken: true });
    L.ladder(160, g2, g3);
    L.ladder(32, g3, g4);
    L.ladder(112, g3, g4, { broken: true });
    L.ladder(80, g4, g5, { broken: true });
    L.ladder(184, g4, g5);
    L.ladder(128, g5, lp);
    L.hammer(40, g1);
    L.hammer(168, g4);
  } else {
    // escadas sorteadas: sempre ao menos uma inteira por andar
    const r = L.rng;
    const gaps = [[g0, g1, 40, 198], [g1, g2, 24, 198], [g2, g3, 24, 198], [g3, g4, 24, 198], [g4, g5, 76, 198]];
    let prev = [];
    gaps.forEach(([lo, up, a, b]) => {
      let full = pickSpots(r, r() < 0.55 ? 2 : 1, a, b, 34, prev);
      if (!full.length) full = pickSpots(r, 1, a, b, 12, prev);
      if (!full.length) full = [Math.round((a + b) / 2)];
      const broken = pickSpots(r, Math.floor(r() * 3), a, b, 26, prev.concat(full));
      full.forEach((x) => L.ladder(x, lo, up));
      broken.forEach((x) => L.ladder(x, lo, up, { broken: true }));
      prev = full.concat(broken);
    });
    L.ladder(96 + Math.round(r() * 36), g5, lp);
    const used = L.ladders.map((ld) => (L.mirror ? W - ld.x : ld.x));
    const h1 = pickSpots(r, 1, 40, 190, 12, used)[0] || 120;
    const h2 = pickSpots(r, 1, 40, 190, 12, used)[0] || 140;
    L.hammer(h1, r() < 0.5 ? g1 : g2);
    L.hammer(h2, r() < 0.5 ? g3 : g4);
  }

  L.goal = lp;
  L.bottom = g0;
  L.start = L.at(44, g0);
  L.start2 = L.at(62, g0);
  L.lara = Object.assign(L.at(102, lp), { dir: L.md(1) });
  L.lucas = Object.assign(L.at(36, g5a), { dir: L.md(1), minX: L.m(36), maxX: L.m(36) });
  L.oil = Object.assign(L.at(16, g0), { lit: false });
  L.barrelSpawn = L.at(60, g5a);
  L.dropX = L.m(16);
  L.pile = [L.at(5, g5a), L.at(14, g5a), Object.assign(L.at(9.5, g5a), { y: 68 })];
}

function buildConveyor(L) {
  const lp = L.plat(88, 56, 136, 56);
  const r4L = L.plat(16, 88, 100, 88, { kind: 'conveyor', belt: 16, flip: 5 });
  const r4R = L.plat(124, 88, 208, 88, { kind: 'conveyor', belt: -16, flip: 5 });
  const r3 = L.plat(8, 128, 216, 128, { kind: 'conveyor', belt: -20, flip: 6.5, pans: true });
  const r2L = L.plat(8, 168, 100, 168, { kind: 'conveyor', belt: -20, pans: true });
  const r2C = L.plat(100, 168, 124, 168, { kind: 'floor' });
  const r2R = L.plat(124, 168, 216, 168, { kind: 'conveyor', belt: 20, pans: true });
  const r1 = L.plat(8, 208, 216, 208, { kind: 'conveyor', belt: 20, flip: 8.5, pans: true });
  const f0 = L.plat(0, 248, 224, 248, { kind: 'floor' });
  const r2 = [r2L, r2C, r2R];
  const r4 = [r4L, r4R];

  L.ladder(24, f0, r1);
  L.ladder(112, f0, r1);
  L.ladder(200, f0, r1);
  L.ladder(40, r1, r2);
  L.ladder(184, r1, r2);
  L.ladder(24, r2, r3, { retract: [4.2, 2.2, 0] });
  L.ladder(76, r2, r3);
  L.ladder(148, r2, r3);
  L.ladder(200, r2, r3, { retract: [4.2, 2.2, 3.1] });
  L.ladder(32, r3, r4, { retract: [3.6, 2.4, 1.2] });
  L.ladder(80, r3, r4);
  L.ladder(192, r3, r4, { retract: [3.6, 2.4, 4.3] });
  L.ladder(94, r4, lp);
  L.ladder(130, r4, lp);

  L.hammer(56, r2L);
  L.hammer(168, r3);
  L.item(112, r3, 'bolsa');
  L.item(208, r2R, 'chapéu');
  L.item(150, r1, 'guarda-chuva');

  L.goal = lp;
  L.bottom = f0;
  L.start = L.at(16, f0);
  L.start2 = L.at(34, f0);
  L.lara = Object.assign(L.at(112, lp), { dir: L.md(-1) });
  L.lucas = Object.assign(L.at(60, r4L), { dir: L.md(1), minX: Math.min(L.m(28), L.m(196)), maxX: Math.max(L.m(28), L.m(196)) });
  L.oil = Object.assign(L.at(112, r2C), { lit: true });
}

function buildElevator(L) {
  const s0 = L.plat(0, 240, 44, 240, { kind: 'floor' });
  const l1 = L.plat(0, 192, 32, 192);
  const l2 = L.plat(0, 144, 36, 144);
  const m1 = L.plat(84, 200, 120, 200);
  const m2 = L.plat(84, 152, 120, 152);
  const m3 = L.plat(84, 108, 128, 108);
  const r0 = L.plat(176, 240, 224, 240, { kind: 'floor' });
  const r1 = L.plat(170, 196, 224, 196);
  const r2 = L.plat(176, 152, 224, 152);
  const r3 = L.plat(170, 112, 224, 112);
  const t = L.plat(16, 80, 208, 80);
  const lp = L.plat(112, 48, 168, 48);

  L.ladder(16, s0, l1);
  L.ladder(24, l1, l2);
  L.ladder(100, m1, m2);
  L.ladder(112, m2, m3);
  L.ladder(208, r0, r1);
  L.ladder(188, r1, r2);
  L.ladder(212, r2, r3);
  L.ladder(184, r3, t);
  L.ladder(160, t, lp);

  L.shafts.push({ x: L.m(60), w: 20, dir: -1, top: 104, bottom: 262, spacing: 62, plats: [] });
  L.shafts.push({ x: L.m(146), w: 20, dir: 1, top: 106, bottom: 262, spacing: 62, plats: [] });

  L.item(14, l2, 'bolsa');
  L.item(214, r1, 'guarda-chuva');
  L.item(120, m3, 'chapéu');

  L.goal = lp;
  L.bottom = null;
  L.start = L.at(16, s0);
  L.start2 = L.at(30, s0);
  L.lara = Object.assign(L.at(130, lp), { dir: L.md(1) });
  L.lucas = Object.assign(L.at(38, t), { dir: L.md(1), minX: L.m(38), maxX: L.m(38) });
  L.springLine = { plat: t, x0: L.m(58), endX: L.mirror ? W - 208 : 208 };
  L.fireStarts = [L.at(96, m1), L.at(108, m2), L.at(200, r1)];
}

function buildRivets(L) {
  const f0 = L.plat(0, 248, 224, 248, { kind: 'floor' });
  const rows = [];
  const spans = [[8, 216], [16, 208], [24, 200], [32, 192]];
  const ys = [208, 168, 128, 88];
  for (let i = 0; i < 4; i++) {
    const [a, b] = spans[i];
    const y = ys[i];
    const segs = [
      L.plat(a, y, 52, y, { kind: 'floor' }),
      L.plat(52, y, 60, y, { kind: 'rivet' }),
      L.plat(60, y, 164, y, { kind: 'floor' }),
      L.plat(164, y, 172, y, { kind: 'rivet' }),
      L.plat(172, y, b, y, { kind: 'floor' }),
    ];
    segs.filter((s) => s.kind === 'rivet').forEach((s) => {
      L.rivets.push({ x: (s.x1 + s.x2) / 2, y, plat: s, removed: false, side: [0, 0] });
    });
    rows.push(segs);
  }
  const lp = L.plat(150, 56, 186, 56);
  const [F1, F2, F3, F4] = rows;

  if (!L.rng) {
    [16, 112, 208].forEach((x) => L.ladder(x, f0, F1));
    [24, 88, 136, 200].forEach((x) => L.ladder(x, F1, F2));
    [32, 112, 192].forEach((x) => L.ladder(x, F2, F3));
    [40, 80, 144, 184].forEach((x) => L.ladder(x, F3, F4));
    L.hammer(42, F2[0]);
    L.hammer(186, F3[4]);
    L.item(112, F1[2], 'bolsa');
    L.item(190, F2[4], 'guarda-chuva');
    L.item(44, F4[0], 'chapéu');
  } else {
    const r = L.rng;
    const pairs = [[f0, F1, 0], [F1, F2, 1], [F2, F3, 2], [F3, F4, 3]];
    pairs.forEach(([lo, up, i]) => {
      const a = spans[i][0] + 8, b = spans[i][1] - 8;
      const xs = pickSpots(r, 1 + Math.floor(r() * 2), 70, 154, 30, []);
      if (r() < 0.65) xs.push(Math.round(a + r() * (46 - a)));
      if (r() < 0.65) xs.push(Math.round(178 + r() * (b - 178)));
      xs.forEach((x) => L.ladder(x, lo, up));
    });
    const kinds = ['bolsa', 'guarda-chuva', 'chapéu'];
    const rows2 = [F1, F2, F3, F4];
    L.hammer(Math.round(70 + r() * 84), rows2[r() < 0.5 ? 0 : 1][2]);
    L.hammer(Math.round(70 + r() * 84), rows2[2][2]);
    kinds.forEach((k, i) => {
      const row = rows2[(i + Math.floor(r() * 4)) % 4];
      const seg = row[2];
      L.item(Math.round(70 + r() * 84), seg, k);
    });
  }

  L.goal = null;
  L.bottom = f0;
  L.start = L.at(28, f0);
  L.start2 = L.at(196, f0);
  L.lara = Object.assign(L.at(170, lp), { dir: L.md(-1) });
  L.lucas = Object.assign(L.at(112, F4[2]), { dir: 1, minX: 86, maxX: 138 });
  L.foxFloors = [f0].concat(rows.map((r) => [r[0], r[2], r[4]]).flat());
}

const BUILDERS = { barrels: buildBarrels, conveyor: buildConveyor, elevator: buildElevator, rivets: buildRivets };

function buildLevel(fase, seed) {
  const info = faseInfo(fase, seed);
  const L = makeBuilder(info.mirror);
  L.rng = seed != null ? seeded(seed * 131 + fase * 7331) : null;
  BUILDERS[info.type](L);
  Object.assign(L, info);
  L.diff = difficulty(info.loop);
  return L;
}
