// Desenho vetorial de tudo no jogo (nítido em qualquer tela, sem pixels).
const THEMES = [
  {
    name: 'Noite na obra',
    sky: ['#070b24', '#171447', '#3b1d5e'],
    girder: '#ff5470', girderHi: '#ffb1c0', girderLo: '#7e1235',
    ladder: '#5ee7ff', city: '#120f33', city2: '#1d1850', win: '#ffd66b', moon: '#fff4d6',
  },
  {
    name: 'Pôr do sol',
    sky: ['#1a1242', '#6b2a6e', '#ff8a5b'],
    girder: '#22c7b8', girderHi: '#b5fff6', girderLo: '#0b5c56',
    ladder: '#ffd23f', city: '#2a1238', city2: '#4a1f52', win: '#ffe3a3', moon: '#ffe9c2',
  },
  {
    name: 'Madrugada',
    sky: ['#03161f', '#0b3a4a', '#1a6b6e'],
    girder: '#ffb703', girderHi: '#ffe8a3', girderLo: '#8a5200',
    ladder: '#ff6b9a', city: '#04202a', city2: '#0a3341', win: '#9ff3ff', moon: '#e6fbff',
  },
  {
    name: 'Tempestade',
    sky: ['#0e0718', '#2a1648', '#5c2a86'],
    girder: '#c77dff', girderHi: '#f0d9ff', girderLo: '#4b1a7a',
    ladder: '#80ffdb', city: '#120a22', city2: '#22123d', win: '#ffd1f7', moon: '#f7e8ff',
  },
];

const Art = (() => {
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      r = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  function ellipse(ctx, x, y, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function circle(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function line(ctx, pts, color, w) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function limb(ctx, x1, y1, x2, y2, bend, color, w) {
    const mx = (x1 + x2) / 2 + bend[0], my = (y1 + y2) / 2 + bend[1];
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // ---------------------------------------------------------------- cenário
  function background(ctx, th, seed) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.sky[0]);
    g.addColorStop(0.55, th.sky[1]);
    g.addColorStop(1, th.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const rnd = seeded(seed || 7);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = 24 + rnd() * 150;
      const r = rnd() < 0.85 ? 0.35 + rnd() * 0.3 : 0.7 + rnd() * 0.3;
      ctx.globalAlpha = 0.25 + rnd() * 0.6;
      circle(ctx, x, y, r, '#ffffff');
    }
    ctx.globalAlpha = 1;

    // Lua com halo suave.
    const mx = W - 28, my = 46;
    const halo = ctx.createRadialGradient(mx, my, 4, mx, my, 34);
    halo.addColorStop(0, hexA(th.moon, 0.35));
    halo.addColorStop(1, hexA(th.moon, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 40, my - 40, 80, 80);
    circle(ctx, mx, my, 9, th.moon);
    circle(ctx, mx + 3.5, my - 2.5, 7.5, hexA(th.sky[0], 0.18));

    // Cidade ao fundo, em duas camadas.
    const layers = [
      { color: th.city2, lift: 26, hmin: 40, hmax: 110, wmin: 10, wmax: 22, winA: 0.25 },
      { color: th.city, lift: 0, hmin: 24, hmax: 80, wmin: 12, wmax: 26, winA: 0.45 },
    ];
    layers.forEach((L) => {
      let x = -4;
      while (x < W + 4) {
        const w = L.wmin + rnd() * (L.wmax - L.wmin);
        const h = L.hmin + rnd() * (L.hmax - L.hmin);
        const y = H - L.lift - h;
        ctx.fillStyle = L.color;
        ctx.fillRect(x, y, w, H - y);
        if (rnd() < 0.3) ctx.fillRect(x + w / 2 - 0.5, y - 6, 1, 6);
        for (let wy = y + 4; wy < H - 4; wy += 6) {
          for (let wx = x + 2.5; wx < x + w - 3; wx += 5) {
            if (rnd() < 0.32) {
              ctx.fillStyle = hexA(th.win, L.winA * (0.5 + rnd() * 0.5));
              ctx.fillRect(wx, wy, 2, 2.6);
            }
          }
        }
        x += w + rnd() * 3;
      }
    });

    // Névoa no chão para dar profundidade.
    const fog = ctx.createLinearGradient(0, H - 80, 0, H);
    fog.addColorStop(0, hexA(th.sky[2], 0));
    fog.addColorStop(1, hexA(th.sky[2], 0.35));
    ctx.fillStyle = fog;
    ctx.fillRect(0, H - 80, W, 80);
  }

  const GT = 7; // espessura da viga

  function girder(ctx, p, th) {
    const { x1, y1, x2, y2 } = p;
    const k = (y2 - y1) / (x2 - x1 || 1);
    const yAt = (x) => y1 + (x - x1) * k;

    // sombra
    ctx.beginPath();
    ctx.moveTo(x1 + 1, y1 + GT + 1);
    ctx.lineTo(x2 + 1, y2 + GT + 1);
    ctx.lineTo(x2 + 1, y2 + GT + 3);
    ctx.lineTo(x1 + 1, y1 + GT + 3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    // alma da viga
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 + GT);
    ctx.lineTo(x1, y1 + GT);
    ctx.closePath();
    ctx.fillStyle = th.girderLo;
    ctx.fill();

    // treliça em X
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    let up = true;
    for (let x = x1; x <= x2 + 7; x += 3.5) {
      const yy = yAt(x) + (up ? 1.8 : GT - 1.6);
      if (x === x1) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
      up = !up;
    }
    ctx.strokeStyle = th.girder;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();

    // mesas superior e inferior
    const flange = (off, h, fill) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1 + off);
      ctx.lineTo(x2, y2 + off);
      ctx.lineTo(x2, y2 + off + h);
      ctx.lineTo(x1, y1 + off + h);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    flange(0, 1.9, th.girder);
    flange(GT - 1.6, 1.6, th.girder);
    ctx.beginPath();
    ctx.moveTo(x1 + 0.5, y1 + 0.35);
    ctx.lineTo(x2 - 0.5, y2 + 0.35);
    ctx.strokeStyle = th.girderHi;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // parafusos
    for (let x = x1 + 4; x < x2 - 2; x += 16) {
      circle(ctx, x, yAt(x) + 0.95, 0.45, th.girderHi);
    }
    // pontas arredondadas
    ctx.fillStyle = th.girderLo;
    rr(ctx, x1 - 0.6, y1, 1.2, GT, 0.5);
    ctx.fill();
    rr(ctx, x2 - 0.6, y2, 1.2, GT, 0.5);
    ctx.fill();
  }

  function rivet(ctx, x, y, w) {
    const hw = (w || 8) / 2;
    const g = ctx.createLinearGradient(0, y, 0, y + GT);
    g.addColorStop(0, '#fff0a8');
    g.addColorStop(0.5, '#ffc93c');
    g.addColorStop(1, '#c98a12');
    ctx.fillStyle = g;
    rr(ctx, x - hw, y, hw * 2, GT, 1.6);
    ctx.fill();
    circle(ctx, x, y + GT / 2, 1.8, '#a96f08');
    line(ctx, [x - 1, y + GT / 2 - 1, x + 1, y + GT / 2 + 1], '#ffe48a', 0.5);
    line(ctx, [x + 1, y + GT / 2 - 1, x - 1, y + GT / 2 + 1], '#ffe48a', 0.5);
  }

  function ladder(ctx, x, top, bottom, color, opts) {
    const half = 4;
    const segs = [];
    if (opts && opts.broken) {
      segs.push([top - 1, opts.gapTop]);
      segs.push([opts.gapBot, bottom + GT - 1]);
    } else {
      segs.push([top - 1, bottom + GT - 1]);
    }
    ctx.lineCap = 'round';
    segs.forEach(([a, b]) => {
      if (b - a < 0.5) return;
      ctx.strokeStyle = hexA(color, 0.25);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(x - half, a); ctx.lineTo(x - half, b);
      ctx.moveTo(x + half, a); ctx.lineTo(x + half, b);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x - half, a); ctx.lineTo(x - half, b);
      ctx.moveTo(x + half, a); ctx.lineTo(x + half, b);
      ctx.stroke();
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      const first = Math.ceil((a + 1) / 4.5) * 4.5;
      for (let y = first; y < b - 0.5; y += 4.5) {
        ctx.moveTo(x - half, y);
        ctx.lineTo(x + half, y);
      }
      ctx.stroke();
    });
  }

  function conveyor(ctx, p, t, th) {
    const x1 = p.x1, x2 = p.x2, y = p.y1;
    const w = x2 - x1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, x1 + 1, y + 2, w, GT + 1, 3.5);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + GT);
    g.addColorStop(0, '#5a5f80');
    g.addColorStop(1, '#25273d');
    ctx.fillStyle = g;
    rr(ctx, x1, y, w, GT, 3.5);
    ctx.fill();
    // faixas em movimento
    ctx.save();
    rr(ctx, x1 + 3, y, w - 6, 2.4, 1);
    ctx.clip();
    ctx.fillStyle = '#32354f';
    ctx.fillRect(x1, y, w, 2.4);
    const off = ((t * p.belt) % 7 + 7) % 7;
    ctx.fillStyle = th.girder;
    for (let sx = x1 - 7 + off; sx < x2 + 7; sx += 7) {
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + 2.2, y);
      ctx.lineTo(sx + 3.6, y + 2.4);
      ctx.lineTo(sx + 1.4, y + 2.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // setas indicando o sentido
    const dir = sign(p.belt);
    ctx.fillStyle = hexA(th.girderHi, 0.55);
    for (let ax = x1 + 14; ax < x2 - 10; ax += 22) {
      const cy = y + 4.6;
      ctx.beginPath();
      ctx.moveTo(ax - 1.6 * dir, cy - 1.4);
      ctx.lineTo(ax + 1.6 * dir, cy);
      ctx.lineTo(ax - 1.6 * dir, cy + 1.4);
      ctx.closePath();
      ctx.fill();
    }
    // roletes nas pontas
    [x1 + 3.5, x2 - 3.5].forEach((rx) => {
      circle(ctx, rx, y + 3.5, 3.3, '#9aa3c7');
      circle(ctx, rx, y + 3.5, 2.2, '#3b3f5e');
      ctx.save();
      ctx.translate(rx, y + 3.5);
      ctx.rotate((t * p.belt) / 3.3);
      line(ctx, [-2, 0, 2, 0], '#c9d0ee', 0.7);
      line(ctx, [0, -2, 0, 2], '#c9d0ee', 0.7);
      ctx.restore();
    });
  }

  function liftPlatform(ctx, p) {
    const w = p.x2 - p.x1, y = p.y1;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(ctx, p.x1 + 1, y + 1.5, w, 5, 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + 5);
    g.addColorStop(0, '#f1f4ff');
    g.addColorStop(1, '#7e86ad');
    ctx.fillStyle = g;
    rr(ctx, p.x1, y, w, 5, 2);
    ctx.fill();
    ctx.save();
    rr(ctx, p.x1, y, w, 1.6, 0.8);
    ctx.clip();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(p.x1, y, w, 1.6);
    ctx.fillStyle = '#2b2d42';
    for (let x = p.x1 - 2; x < p.x2; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, y + 1.6);
      ctx.lineTo(x + 1.6, y);
      ctx.lineTo(x + 3.2, y);
      ctx.lineTo(x + 1.6, y + 1.6);
      ctx.fill();
    }
    ctx.restore();
    circle(ctx, p.x1 + 3, y + 3.4, 0.7, '#5ee7ff');
    circle(ctx, p.x2 - 3, y + 3.4, 0.7, '#5ee7ff');
  }

  function shaft(ctx, s, t) {
    const x = s.x;
    ctx.strokeStyle = 'rgba(200,210,255,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - s.w / 2 + 2, s.top - 6);
    ctx.lineTo(x - s.w / 2 + 2, H);
    ctx.moveTo(x + s.w / 2 - 2, s.top - 6);
    ctx.lineTo(x + s.w / 2 - 2, H);
    ctx.stroke();
    // motor no alto
    const g = ctx.createLinearGradient(0, s.top - 16, 0, s.top);
    g.addColorStop(0, '#6c7299');
    g.addColorStop(1, '#2b2e48');
    ctx.fillStyle = g;
    rr(ctx, x - s.w / 2 - 3, s.top - 16, s.w + 6, 14, 3);
    ctx.fill();
    ctx.save();
    ctx.translate(x, s.top - 9);
    ctx.rotate(t * 2 * s.dir);
    circle(ctx, 0, 0, 4.2, '#ffd166');
    circle(ctx, 0, 0, 2, '#2b2e48');
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-0.8, -5.6, 1.6, 1.8);
    }
    ctx.restore();
    // seta indicando subida/descida
    ctx.fillStyle = s.dir < 0 ? '#5effa8' : '#ff7a7a';
    const ay = s.top - 9;
    const ax = x + s.w / 2 + 6.5;
    ctx.beginPath();
    if (s.dir < 0) {
      ctx.moveTo(ax, ay - 3); ctx.lineTo(ax + 2.5, ay + 1); ctx.lineTo(ax - 2.5, ay + 1);
    } else {
      ctx.moveTo(ax, ay + 3); ctx.lineTo(ax + 2.5, ay - 1); ctx.lineTo(ax - 2.5, ay - 1);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ---------------------------------------------------------------- objetos
  const WOOD = { hi: '#f2b46d', mid: '#c0743a', lo: '#7a3e17', band: '#4a2410' };
  const BLUE = { hi: '#9fe3ff', mid: '#2f8fdc', lo: '#164f8a', band: '#0d2f57' };

  function barrelRoll(ctx, x, y, rot, blue) {
    const c = blue ? BLUE : WOOD;
    const r = 5;
    ctx.save();
    ctx.translate(x, y - r);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0.8, r - 0.2, 4.2, 1, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createRadialGradient(-1.6, -1.8, 0.5, 0, 0, r);
    g.addColorStop(0, c.hi);
    g.addColorStop(0.6, c.mid);
    g.addColorStop(1, c.lo);
    circle(ctx, 0, 0, r, g);
    ctx.strokeStyle = c.band;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.6, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.52, 0, TAU);
    ctx.stroke();
    ctx.rotate(rot);
    line(ctx, [-r * 0.5, 0, r * 0.5, 0], c.band, 0.8);
    line(ctx, [-r * 0.3, -1.6, r * 0.3, -1.6], hexA(c.band, 0.6), 0.5);
    line(ctx, [-r * 0.3, 1.6, r * 0.3, 1.6], hexA(c.band, 0.6), 0.5);
    ctx.restore();
  }

  function barrelFront(ctx, x, y, blue) {
    const c = blue ? BLUE : WOOD;
    const g = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
    g.addColorStop(0, c.lo);
    g.addColorStop(0.35, c.hi);
    g.addColorStop(1, c.lo);
    ctx.fillStyle = g;
    rr(ctx, x - 6, y - 9, 12, 9, 3);
    ctx.fill();
    line(ctx, [x - 5.6, y - 7, x + 5.6, y - 7], c.band, 1);
    line(ctx, [x - 5.6, y - 2.2, x + 5.6, y - 2.2], c.band, 1);
    line(ctx, [x - 2, y - 8.6, x - 2, y - 0.4], hexA(c.band, 0.45), 0.5);
    line(ctx, [x + 2, y - 8.6, x + 2, y - 0.4], hexA(c.band, 0.45), 0.5);
  }

  function barrelUpright(ctx, x, y, blue) {
    const c = blue ? BLUE : WOOD;
    const g = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
    g.addColorStop(0, c.lo);
    g.addColorStop(0.35, c.hi);
    g.addColorStop(1, c.lo);
    ctx.fillStyle = g;
    rr(ctx, x - 5, y - 12, 10, 12, 2.8);
    ctx.fill();
    line(ctx, [x - 4.8, y - 9.5, x + 4.8, y - 9.5], c.band, 1);
    line(ctx, [x - 4.8, y - 2.5, x + 4.8, y - 2.5], c.band, 1);
    ellipse(ctx, x, y - 11.6, 4.2, 1, hexA(c.hi, 0.7));
  }

  function oilDrum(ctx, x, y, t, lit) {
    const g = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
    g.addColorStop(0, '#173b7a');
    g.addColorStop(0.35, '#4f8cff');
    g.addColorStop(1, '#122c5e');
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 1, y, 9, 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = g;
    rr(ctx, x - 8, y - 16, 16, 16, 2.5);
    ctx.fill();
    line(ctx, [x - 7.6, y - 13, x + 7.6, y - 13], '#0b1f45', 1);
    line(ctx, [x - 7.6, y - 3, x + 7.6, y - 3], '#0b1f45', 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 4.2px "Bungee", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ÓLEO', x, y - 7.8);
    ellipse(ctx, x, y - 16, 7.6, 1.6, '#0b1f45');
    if (lit) {
      for (let i = 0; i < 3; i++) {
        const fx = x - 4.5 + i * 4.5;
        const h = 7 + Math.sin(t * 13 + i * 2.1) * 2.5 + (i === 1 ? 3 : 0);
        flameTongue(ctx, fx, y - 16, 3.2, h);
      }
    }
  }

  function flameTongue(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(0, y, 0, y - h);
    g.addColorStop(0, '#ff3d1f');
    g.addColorStop(0.5, '#ff9a1f');
    g.addColorStop(1, 'rgba(255,240,150,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.9, y - h * 0.5, x, y - h);
    ctx.quadraticCurveTo(x + w * 0.9, y - h * 0.5, x + w, y);
    ctx.closePath();
    ctx.fill();
  }

  const FLAME = {
    fire: ['#ff4d1f', '#ffa62b', '#fff3b0'],
    spark: ['#ff2e93', '#ff86cf', '#fff0fb'],
    scared: ['#2f6bff', '#7fb4ff', '#eaf2ff'],
  };

  function fireball(ctx, x, y, t, dir, kind, scared, blink) {
    const c = FLAME[scared ? (blink ? kind : 'scared') : kind] || FLAME.fire;
    ctx.save();
    ctx.translate(x, y);
    const glow = ctx.createRadialGradient(0, -5, 1, 0, -5, 11);
    glow.addColorStop(0, hexA(c[1], 0.45));
    glow.addColorStop(1, hexA(c[1], 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-11, -16, 22, 22);
    const f = Math.sin(t * 22) * 0.9, f2 = Math.cos(t * 17) * 0.9;
    ctx.beginPath();
    ctx.moveTo(-4.6, -4.4);
    ctx.quadraticCurveTo(-5.4, -9, -2.6 + f, -12.2 + f2);
    ctx.quadraticCurveTo(-1.6, -9.5, 0, -10);
    ctx.quadraticCurveTo(0.6, -13.6, 1.4 - f, -14.6 - f2);
    ctx.quadraticCurveTo(2.6, -10.6, 3.2, -10.2);
    ctx.quadraticCurveTo(4.6, -11.6, 4.4 + f2, -12.4);
    ctx.quadraticCurveTo(5.6, -8, 4.6, -4.4);
    ctx.arc(0, -4.6, 4.6, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = c[0];
    ctx.fill();
    ellipse(ctx, 0, -5, 3.4, 3.7, c[1]);
    ellipse(ctx, 0, -4.4, 2, 2.2, c[2]);
    const d = dir || 1;
    ellipse(ctx, -1.4 + d * 0.6, -6, 1.15, 1.45, '#ffffff');
    ellipse(ctx, 1.5 + d * 0.6, -6, 1.15, 1.45, '#ffffff');
    circle(ctx, -1.4 + d * 1.05, -5.9, 0.6, '#1d0f2e');
    circle(ctx, 1.5 + d * 1.05, -5.9, 0.6, '#1d0f2e');
    ctx.restore();
  }

  function pan(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 0.6, y, 7, 1.1, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y - 5, 0, y);
    g.addColorStop(0, '#c9cfe6');
    g.addColorStop(1, '#6d7493');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 4);
    ctx.lineTo(x + 7, y - 4);
    ctx.lineTo(x + 5.5, y);
    ctx.lineTo(x - 5.5, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e9e4da';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 4);
    ctx.quadraticCurveTo(x - 3, y - 8.2, x, y - 7.4);
    ctx.quadraticCurveTo(x + 3.5, y - 8.6, x + 6, y - 4);
    ctx.closePath();
    ctx.fill();
    circle(ctx, x - 2, y - 5.8, 0.5, '#b9b2a3');
    circle(ctx, x + 2.2, y - 6.2, 0.5, '#b9b2a3');
    line(ctx, [x - 7, y - 4, x + 7, y - 4], '#4a5070', 0.7);
  }

  function spring(ctx, x, y, squash) {
    const h = 10 * (1 - (squash || 0) * 0.45);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 1, 0, 0, TAU);
    ctx.fill();
    rr(ctx, x - 5.5, y - 1.6, 11, 1.6, 0.8);
    ctx.fillStyle = '#ff5d73';
    ctx.fill();
    rr(ctx, x - 5.5, y - h, 11, 1.6, 0.8);
    ctx.fill();
    ctx.beginPath();
    const n = 5;
    for (let i = 0; i <= n * 2; i++) {
      const yy = y - 1.6 - (h - 3.2) * (i / (n * 2));
      const xx = x + (i % 2 ? 4.2 : -4.2);
      if (i === 0) ctx.moveTo(x - 4.2, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function hammer(ctx, x, y, angle, glint) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    rr(ctx, -0.9, -2, 1.8, 10, 0.9);
    ctx.fillStyle = '#d9a066';
    ctx.fill();
    const g = ctx.createLinearGradient(0, -6.5, 0, -2);
    g.addColorStop(0, '#ffcf8a');
    g.addColorStop(1, '#b8692e');
    ctx.fillStyle = g;
    rr(ctx, -4.6, -6.6, 9.2, 4.8, 1.4);
    ctx.fill();
    ctx.fillStyle = '#7a3e17';
    rr(ctx, -4.6, -6.6, 1.6, 4.8, 0.7);
    ctx.fill();
    rr(ctx, 3, -6.6, 1.6, 4.8, 0.7);
    ctx.fill();
    if (glint) {
      ctx.globalAlpha = glint;
      line(ctx, [-2, -5.8, 1, -5.8], '#ffffff', 0.7);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function item(ctx, kind, x, y, t) {
    const bob = Math.sin(t * 3) * 0.8;
    y += bob;
    const glow = ctx.createRadialGradient(x, y - 5, 1, x, y - 5, 10);
    glow.addColorStop(0, 'rgba(255,170,220,0.45)');
    glow.addColorStop(1, 'rgba(255,170,220,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 10, y - 15, 20, 20);
    if (kind === 'bolsa') {
      ctx.strokeStyle = '#ffb3d9';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y - 7.5, 3.2, Math.PI, 0);
      ctx.stroke();
      const g = ctx.createLinearGradient(0, y - 8, 0, y);
      g.addColorStop(0, '#ff7dbb');
      g.addColorStop(1, '#d6337f');
      ctx.fillStyle = g;
      rr(ctx, x - 5, y - 8, 10, 7.5, 2.2);
      ctx.fill();
      rr(ctx, x - 5, y - 8, 10, 2.6, 1.2);
      ctx.fillStyle = '#ff9fcf';
      ctx.fill();
      circle(ctx, x, y - 5.4, 0.9, '#ffd166');
    } else if (kind === 'guarda-chuva') {
      line(ctx, [x, y - 10, x, y - 1.5], '#f4f1ff', 0.9);
      ctx.beginPath();
      ctx.arc(x + 1.2, y - 1.6, 1.2, 0, Math.PI);
      ctx.strokeStyle = '#f4f1ff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      const g = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
      g.addColorStop(0, '#b55cff');
      g.addColorStop(1, '#ff6fb5');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 6.5, y - 9.5);
      ctx.quadraticCurveTo(x - 6, y - 15.5, x, y - 15.5);
      ctx.quadraticCurveTo(x + 6, y - 15.5, x + 6.5, y - 9.5);
      for (let i = 0; i < 4; i++) {
        const a = x + 6.5 - i * 3.25;
        ctx.quadraticCurveTo(a - 1.6, y - 11.4, a - 3.25, y - 9.5);
      }
      ctx.closePath();
      ctx.fill();
      circle(ctx, x, y - 15.8, 0.7, '#ffd166');
    } else {
      // chapéu
      ellipse(ctx, x, y - 2.6, 7, 2.1, '#ff8fc7');
      const g = ctx.createLinearGradient(0, y - 9, 0, y - 2);
      g.addColorStop(0, '#ffb3dc');
      g.addColorStop(1, '#ff6fb0');
      ctx.fillStyle = g;
      rr(ctx, x - 4, y - 9, 8, 6.8, 3.4);
      ctx.fill();
      ctx.fillStyle = '#7b2cbf';
      ctx.fillRect(x - 4, y - 4.6, 8, 1.6);
      circle(ctx, x + 3, y - 4, 1.4, '#ffd166');
      circle(ctx, x + 3, y - 4, 0.6, '#ff5470');
    }
  }

  function heart(ctx, x, y, s, color, broken) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(0, 3.2);
      ctx.bezierCurveTo(-6.2, -0.8, -4.4, -7.4, 0, -4);
      ctx.bezierCurveTo(4.4, -7.4, 6.2, -0.8, 0, 3.2);
      ctx.closePath();
    };
    const g = ctx.createRadialGradient(-1.6, -3, 0.5, 0, -1, 6);
    g.addColorStop(0, '#ffc2d6');
    g.addColorStop(1, color || '#ff3d7f');
    if (broken) {
      [-1, 1].forEach((side) => {
        ctx.save();
        ctx.translate(side * 1.4, side * 0.6);
        ctx.rotate(side * 0.15);
        ctx.beginPath();
        ctx.rect(side < 0 ? -7 : 0, -8, 7, 12);
        ctx.clip();
        draw();
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      });
    } else {
      draw();
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  function bubble(ctx, x, y, text, size, color) {
    size = size || 5;
    ctx.font = `400 ${size}px "Bungee", "Arial Black", sans-serif`;
    const w = ctx.measureText(text).width + size * 1.4;
    const h = size * 1.9;
    const bx = clamp(x - w / 2, 2, W - w - 2);
    ctx.fillStyle = '#ffffff';
    rr(ctx, bx, y - h, w, h, h / 2.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 0.5);
    ctx.lineTo(x + 2, y - 0.5);
    ctx.lineTo(x, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color || '#e0245e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + w / 2, y - h / 2 + 0.3);
  }

  // ---------------------------------------------------------------- personagens
  const SKIN = '#f3c7a1', SKIN_DK = '#e2a47c', HAIR = '#4a2c1a', OVERALL = '#26336b', SHOE = '#4b2a17';

  function heroHead(ctx, c, front) {
    if (front) {
      circle(ctx, -0.8, -15.3, 3.4, HAIR);
    }
    circle(ctx, 0.6, -15.2, 3.6, SKIN);
    circle(ctx, -0.7, -14.9, 1, SKIN_DK);
    ellipse(ctx, 2.7, -15.2, 0.55, 0.85, '#2a1a12');
    circle(ctx, 4.1, -14.3, 1.1, SKIN_DK);
    circle(ctx, 2.1, -13.6, 0.8, 'rgba(255,120,120,0.35)');
    ctx.beginPath();
    ctx.arc(2.9, -13.6, 0.9, 0.2, Math.PI * 0.8);
    ctx.strokeStyle = '#8a3b2a';
    ctx.lineWidth = 0.45;
    ctx.stroke();
    // boné
    ctx.beginPath();
    ctx.arc(0.4, -16, 3.9, Math.PI * 1.02, Math.PI * 1.98);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
    rr(ctx, 2.2, -16.7, 4.2, 1.5, 0.7);
    ctx.fillStyle = shade(c, -0.28);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-0.3, -18.2, 1.2, Math.PI, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  }

  function heroTorso(ctx, c) {
    rr(ctx, -4, -12.6, 8, 6.6, 2.6);
    ctx.fillStyle = c;
    ctx.fill();
    rr(ctx, -3.7, -8.6, 7.4, 3.2, 1.2);
    ctx.fillStyle = OVERALL;
    ctx.fill();
    rr(ctx, -2.6, -11.2, 5.2, 3.6, 1);
    ctx.fill();
    line(ctx, [-2.1, -11, -2.9, -12.5], OVERALL, 1);
    line(ctx, [2.1, -11, 2.9, -12.5], OVERALL, 1);
    circle(ctx, -1.5, -10.3, 0.55, '#ffd166');
    circle(ctx, 1.5, -10.3, 0.55, '#ffd166');
  }

  function heroLeg(ctx, hipX, fx, fy) {
    line(ctx, [hipX, -6.2, fx, fy - 1.4], OVERALL, 3);
    ellipse(ctx, fx + 0.9, fy - 1.1, 2.5, 1.35, SHOE);
  }

  function hero(ctx, x, y, o) {
    const c = o.color || '#ff5470';
    ctx.save();
    ctx.translate(x, y);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.shadow) ellipse(ctx, 0, 0, 5.5, 1.2, 'rgba(0,0,0,0.28)');

    if (o.pose === 'climb') {
      const s = Math.sin(o.t * 11);
      heroLeg(ctx, -1.6, -2.3, -Math.max(0, s) * 2.2);
      heroLeg(ctx, 1.6, 2.3, -Math.max(0, -s) * 2.2);
      rr(ctx, -4, -12.6, 8, 6.6, 2.6);
      ctx.fillStyle = c;
      ctx.fill();
      rr(ctx, -3.7, -8.6, 7.4, 3.2, 1.2);
      ctx.fillStyle = OVERALL;
      ctx.fill();
      line(ctx, [-2.8, -12.4, 2.6, -8.6], OVERALL, 1);
      line(ctx, [2.8, -12.4, -2.6, -8.6], OVERALL, 1);
      limb(ctx, -3.3, -11.6, -3.8, -18 + s * 2, [-1.5, 0], c, 2.6);
      limb(ctx, 3.3, -11.6, 3.8, -18 - s * 2, [1.5, 0], c, 2.6);
      circle(ctx, -3.8, -18.3 + s * 2, 1.4, SKIN);
      circle(ctx, 3.8, -18.3 - s * 2, 1.4, SKIN);
      circle(ctx, 0, -15.3, 3.6, HAIR);
      ctx.beginPath();
      ctx.arc(0, -16.1, 3.9, Math.PI, TAU);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();
      return;
    }

    if (o.pose === 'dead') {
      const t = o.t;
      if (t < 1) {
        ctx.translate(0, -8);
        ctx.rotate(t * TAU * 2.5);
        ctx.translate(0, 8);
        heroTorso(ctx, c);
        heroLeg(ctx, -1.2, -1.5, 0);
        heroLeg(ctx, 1.2, 1.5, 0);
        heroHead(ctx, c, true);
      } else {
        ctx.rotate(-Math.PI / 2);
        ctx.translate(-1, 0);
        heroLeg(ctx, -1.2, -1.5, 0);
        heroLeg(ctx, 1.2, 1.5, 0);
        heroTorso(ctx, c);
        heroHead(ctx, c, true);
        ctx.rotate(Math.PI / 2);
        for (let i = 0; i < 3; i++) {
          const a = t * 4 + (i * TAU) / 3;
          star(ctx, -15 + Math.cos(a) * 5, -6 + Math.sin(a) * 2, 1.6, '#ffd166');
        }
      }
      ctx.restore();
      return;
    }

    if (o.facing < 0) ctx.scale(-1, 1);
    const walking = o.pose === 'walk';
    const s = walking ? Math.sin(o.t * 15) : 0;
    const jump = o.pose === 'jump';

    // braço de trás
    if (o.pose !== 'hammer') {
      const hx = jump ? -4.6 : -1 + 2.6 * s, hy = jump ? -9.5 : -7.6;
      limb(ctx, -1.5, -11.4, hx, hy, [-1, 0.5], shade(c, -0.2), 2.4);
      circle(ctx, hx, hy, 1.25, SKIN_DK);
    }
    if (jump) {
      heroLeg(ctx, -1.4, -4, -1.2);
      heroLeg(ctx, 1.4, 3.6, -2.8);
    } else {
      heroLeg(ctx, -1.3, -1.2 - 2.4 * s, -Math.max(0, -s) * 1.4);
      heroLeg(ctx, 1.3, 1.2 + 2.4 * s, -Math.max(0, s) * 1.4);
    }
    heroTorso(ctx, c);
    heroHead(ctx, c, true);

    if (o.pose === 'hammer') {
      if (o.hammerUp) {
        limb(ctx, 1, -11.6, 1.2, -17.4, [1.6, 0], c, 2.5);
        circle(ctx, 1.2, -17.6, 1.4, SKIN);
        hammer(ctx, 1.2, -19, 0, 0);
      } else {
        limb(ctx, 1, -11.4, 5.6, -9, [0.5, 1.5], c, 2.5);
        circle(ctx, 5.8, -9, 1.4, SKIN);
        hammer(ctx, 9.6, -9, Math.PI / 2, 0);
      }
    } else {
      const hx = jump ? 3.6 : 1 - 2.6 * s, hy = jump ? -16.4 : -7.4;
      limb(ctx, 1.5, -11.4, hx, hy, [1, 0.5], c, 2.5);
      circle(ctx, hx, hy, 1.35, SKIN);
    }
    ctx.restore();
  }

  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr2 = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  const FUR = '#7b4a2b', FUR_DK = '#4f2b16', FUR_HI = '#a3693f', APE_SKIN = '#ebbd90', APE_SKIN_DK = '#c48a5c';

  function apeArm(ctx, sx, sy, hx, hy, bend) {
    limb(ctx, sx, sy, hx, hy, bend, FUR_DK, 7.4);
    limb(ctx, sx, sy, hx, hy, bend, FUR, 6.2);
    circle(ctx, hx, hy, 3.3, FUR_DK);
    circle(ctx, hx, hy, 2.5, APE_SKIN_DK);
  }

  function lucas(ctx, x, y, o) {
    const t = o.t || 0;
    const st = o.state || 'idle';
    ctx.save();
    ctx.translate(x, y);
    if (o.dir < 0) ctx.scale(-1, 1);
    if (st === 'fall') {
      ctx.translate(0, -15);
      ctx.rotate(Math.PI + Math.sin(t * 9) * 0.15);
      ctx.translate(0, 15);
    }
    ellipse(ctx, 0, 0, 15, 2, 'rgba(0,0,0,0.25)');
    const bob = st === 'walk' ? Math.abs(Math.sin(t * 8)) * 1.2 : Math.sin(t * 3) * 0.35;
    ctx.translate(0, -bob);

    // pernas
    const step = st === 'walk' ? Math.sin(t * 8) * 2 : 0;
    apeArm(ctx, -6, -7, -9.5 - step, -2, [-1, 0]);
    apeArm(ctx, 6, -7, 9.5 - step, -2, [1, 0]);
    ellipse(ctx, -10.5 - step, -1.6, 4.4, 2.1, APE_SKIN_DK);
    ellipse(ctx, 10.5 - step, -1.6, 4.4, 2.1, APE_SKIN_DK);

    // braços (posição depende do estado)
    let L = [-15, -4, -2, -3], R = [15, -4, 2, -3];
    const beat = Math.floor(t * 7) % 2;
    if (st === 'beat') {
      L = beat ? [-4.5, -15, -5, 2] : [-16, -14, -3, -2];
      R = beat ? [16, -14, 3, -2] : [4.5, -15, 5, 2];
    } else if (st === 'grab') {
      L = [-23, -8, 0, -4];
    } else if (st === 'hold' || st === 'fall' || st === 'climb') {
      const c = st === 'climb' ? Math.sin(t * 9) * 2.5 : 0;
      L = [-6, -37 + c, -5, 0];
      R = [6, -37 - c, 5, 0];
    } else if (st === 'throw') {
      R = [23, -10, 0, -4];
    } else if (st === 'walk') {
      L = [-15, -5 + step, -2, -3];
      R = [15, -5 - step, 2, -3];
    } else if (st === 'drop') {
      L = [-17, -26, -3, -2];
    }

    // corpo
    const g = ctx.createRadialGradient(-3, -19, 2, 0, -14, 15);
    g.addColorStop(0, FUR_HI);
    g.addColorStop(1, FUR_DK);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -14, 12.6, 11.8, 0, 0, TAU);
    ctx.fill();
    const cg = ctx.createRadialGradient(-1.5, -15, 1, 0, -12.5, 8);
    cg.addColorStop(0, '#f6d3ad');
    cg.addColorStop(1, APE_SKIN);
    ellipse(ctx, 0, -12.6, 7.6, 7, cg);
    ctx.strokeStyle = hexA(APE_SKIN_DK, 0.7);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(-3, -15, 3.6, 0.3, Math.PI - 0.6);
    ctx.moveTo(6.6, -14.4);
    ctx.arc(3, -15, 3.6, 0.3 + 0.3, Math.PI - 0.3);
    ctx.stroke();

    // gravata com "L"
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(-2, -20.4); ctx.lineTo(2, -20.4); ctx.lineTo(1.2, -18.4); ctx.lineTo(-1.2, -18.4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-1.4, -18.6); ctx.lineTo(1.4, -18.6); ctx.lineTo(2.8, -9.6); ctx.lineTo(0, -7.2); ctx.lineTo(-2.8, -9.6);
    ctx.closePath();
    ctx.fill();
    const f = o.dir < 0 ? -1 : 1; // a letra L não espelha
    line(ctx, [-0.8 * f, -16, -0.8 * f, -12.4, 1.3 * f, -12.4], '#ffd166', 0.9);

    apeArm(ctx, -10, -19, L[0], L[1], [L[2], L[3]]);
    apeArm(ctx, 10, -19, R[0], R[1], [R[2], R[3]]);

    // cabeça
    const hg = ctx.createRadialGradient(-2.5, -28, 1, 0, -25, 8.5);
    hg.addColorStop(0, FUR_HI);
    hg.addColorStop(1, FUR);
    circle(ctx, -7.4, -25, 2.4, FUR);
    circle(ctx, 7.4, -25, 2.4, FUR);
    circle(ctx, -7.4, -25, 1.3, APE_SKIN_DK);
    circle(ctx, 7.4, -25, 1.3, APE_SKIN_DK);
    circle(ctx, 0, -25.2, 7.7, hg);
    // tufo
    ctx.fillStyle = FUR_HI;
    ctx.beginPath();
    ctx.moveTo(-2.5, -32.4); ctx.quadraticCurveTo(0, -35.6, 1, -32.6); ctx.quadraticCurveTo(2.6, -34.6, 3, -32);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 0, -23.6, 5.8, 5, APE_SKIN);
    ctx.fillStyle = FUR_DK;
    ctx.beginPath();
    ctx.moveTo(-6, -26.6);
    ctx.quadraticCurveTo(0, -29.8, 6, -26.6);
    ctx.quadraticCurveTo(0, -27.8, -6, -26.6);
    ctx.fill();
    const angry = st === 'beat' || st === 'throw' || st === 'fall';
    ellipse(ctx, -2.3, -25, 1.55, 1.75, '#ffffff');
    ellipse(ctx, 2.3, -25, 1.55, 1.75, '#ffffff');
    const look = o.look || 0;
    circle(ctx, -2.3 + look * 0.6, -24.8, 0.85, '#1b0d05');
    circle(ctx, 2.3 + look * 0.6, -24.8, 0.85, '#1b0d05');
    line(ctx, angry ? [-4, -27.6, -1, -26.4] : [-4, -27.2, -1, -27.2], FUR_DK, 0.9);
    line(ctx, angry ? [4, -27.6, 1, -26.4] : [4, -27.2, 1, -27.2], FUR_DK, 0.9);
    ellipse(ctx, 0, -21.3, 3.9, 2.7, '#f5d2ac');
    circle(ctx, -0.9, -22.4, 0.45, '#5a3016');
    circle(ctx, 0.9, -22.4, 0.45, '#5a3016');
    if (angry || st === 'hold') {
      rr(ctx, -2.6, -21.2, 5.2, 2.4, 1.1);
      ctx.fillStyle = '#5a1a14';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2.2, -21.2, 4.4, 0.8);
    } else {
      ctx.beginPath();
      ctx.arc(0, -21.6, 1.8, 0.25, Math.PI - 0.25);
      ctx.strokeStyle = '#5a3016';
      ctx.lineWidth = 0.55;
      ctx.stroke();
    }
    ctx.restore();
  }

  const DRESS = '#ff7ab8', DRESS_DK = '#d93d8a', DRESS_HI = '#ffc2e0', LARA_HAIR = '#5b3524';

  function lara(ctx, x, y, o) {
    const t = o.t || 0;
    const st = o.state || 'idle';
    ctx.save();
    ctx.translate(x, y);
    if (o.dir < 0) ctx.scale(-1, 1);
    ellipse(ctx, 0, 0, 7, 1.4, 'rgba(0,0,0,0.25)');
    const sway = Math.sin(t * 2.4) * 0.6;

    // cabelo comprido atrás
    ctx.fillStyle = LARA_HAIR;
    ctx.beginPath();
    ctx.moveTo(-3.4, -20.5);
    ctx.quadraticCurveTo(-5.8 + sway, -14, -4.4 + sway, -9.5);
    ctx.quadraticCurveTo(-1.5, -10.6, 0, -12);
    ctx.quadraticCurveTo(2.5, -11, 4.2 + sway, -10.2);
    ctx.quadraticCurveTo(5.4 + sway, -15, 3.4, -20.5);
    ctx.closePath();
    ctx.fill();

    // vestido
    const g = ctx.createLinearGradient(-7, 0, 7, 0);
    g.addColorStop(0, DRESS_DK);
    g.addColorStop(0.45, DRESS);
    g.addColorStop(1, DRESS_DK);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-2.6, -12.4);
    ctx.quadraticCurveTo(-4, -6, -7 - sway * 0.5, -0.4);
    ctx.quadraticCurveTo(0, 0.8, 7 + sway * 0.5, -0.4);
    ctx.quadraticCurveTo(4, -6, 2.6, -12.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = DRESS_HI;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-6.6 - sway * 0.5, -1.2);
    ctx.quadraticCurveTo(0, 0, 6.6 + sway * 0.5, -1.2);
    ctx.stroke();
    rr(ctx, -3, -16.2, 6, 4.6, 1.8);
    ctx.fillStyle = DRESS_DK;
    ctx.fill();
    circle(ctx, -3.3, -15.3, 1.8, DRESS_HI);
    circle(ctx, 3.3, -15.3, 1.8, DRESS_HI);
    circle(ctx, 0, -14.6, 0.7, '#ffd166');

    // braços
    if (st === 'help') {
      const wave = Math.sin(t * 12) * 2;
      limb(ctx, 3.3, -15, 5.6 + wave * 0.4, -21.5 + Math.abs(wave) * 0.3, [1.5, 0], SKIN, 1.5);
      circle(ctx, 5.6 + wave * 0.4, -21.8, 1, SKIN);
      limb(ctx, -3.3, -15, -2, -11.6, [-1, 0], SKIN, 1.5);
    } else if (st === 'happy') {
      limb(ctx, 3.3, -15, 5.8, -21, [1.5, 0], SKIN, 1.5);
      limb(ctx, -3.3, -15, -5.8, -21, [-1.5, 0], SKIN, 1.5);
      circle(ctx, 5.8, -21.3, 1, SKIN);
      circle(ctx, -5.8, -21.3, 1, SKIN);
    } else {
      limb(ctx, 3.3, -15, 0.6, -11.8, [1.2, 0.6], SKIN, 1.5);
      limb(ctx, -3.3, -15, -0.6, -11.8, [-1.2, 0.6], SKIN, 1.5);
    }

    // cabeça
    circle(ctx, 0, -19.4, 3.5, SKIN);
    ctx.fillStyle = LARA_HAIR;
    ctx.beginPath();
    ctx.arc(0, -19.8, 3.8, Math.PI * 1.05, Math.PI * 1.95);
    ctx.quadraticCurveTo(1.5, -20.6, 0.2, -21.4);
    ctx.quadraticCurveTo(-1.4, -20.4, -3.6, -19.4);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 1.4, -19.2, 0.5, 0.75, '#2a1410');
    ellipse(ctx, -1.2, -19.2, 0.5, 0.75, '#2a1410');
    circle(ctx, 2.2, -18, 0.7, 'rgba(255,110,140,0.45)');
    circle(ctx, -2, -18, 0.7, 'rgba(255,110,140,0.45)');
    ctx.beginPath();
    if (st === 'help') {
      ellipse(ctx, 0.2, -17.6, 0.7, 0.8, '#a3304b');
    } else {
      ctx.arc(0.1, -17.9, 0.9, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = '#a3304b';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    // coroa
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(-2.4, -22.4);
    ctx.lineTo(-2.4, -24.6);
    ctx.lineTo(-1.2, -23.4);
    ctx.lineTo(0, -25.4);
    ctx.lineTo(1.2, -23.4);
    ctx.lineTo(2.4, -24.6);
    ctx.lineTo(2.4, -22.4);
    ctx.closePath();
    ctx.fill();
    circle(ctx, 0, -23.2, 0.55, '#ff4d8d');
    ctx.restore();
  }

  return {
    rr, circle, ellipse, line, star,
    background, girder, rivet, ladder, conveyor, liftPlatform, shaft,
    barrelRoll, barrelFront, barrelUpright, oilDrum, flameTongue, fireball, pan, spring, hammer, item, heart, bubble,
    hero, lucas, lara,
    GT,
  };
})();
