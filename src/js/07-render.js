// Renderização: cenário estático em cache + tudo que se move a cada quadro.
const Render = (() => {
  let canvas = null, ctx = null, layer = null, lctx = null;
  let scale = 1;
  let lastLevel = null;
  let clock = 0;
  const FONT_D = '"Bungee", "Arial Black", Impact, sans-serif';
  const FONT_B = '"Nunito", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif';

  const DEATH_TEXT = {
    acerto: 'Acertou você!',
    queda: 'Caiu de muito alto!',
    tempo: 'O tempo acabou!',
    lucas: 'Não encoste no Lucas!',
    fogo: 'Cuidado com o fogo!',
    esmagado: 'Esmagado no elevador!',
  };

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d');
    layer = document.createElement('canvas');
    lctx = layer.getContext('2d');
  }

  function resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    layer.width = canvas.width;
    layer.height = canvas.height;
    scale = canvas.width / W;
    Game.G.staticDirty = true;
  }

  function drawStatic(lv) {
    const c = lctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, layer.width, layer.height);
    c.setTransform(scale, 0, 0, scale, 0, 0);
    Art.background(c, lv.theme, 11 + lv.loop * 7);
    lv.ladders.forEach((ld) => {
      if (!ld.retract) Art.ladder(c, ld.x, ld.top, ld.bottom, lv.theme.ladder, ld.broken ? ld : null);
    });
    lv.platforms.forEach((p) => {
      if (p.kind === 'girder' || p.kind === 'floor') Art.girder(c, p, lv.theme);
    });
    lv.rivets.forEach((r) => {
      if (!r.removed) Art.rivet(c, r.x, r.y, r.plat.x2 - r.plat.x1);
    });
  }

  function heroPose(p) {
    if (p.dead) return { pose: 'dead', t: p.deadT };
    if (p.state === 'climb') return { pose: 'climb', t: p.anim };
    if (p.state === 'air') return { pose: 'jump', t: 0 };
    if (p.hammer > 0) return { pose: 'hammer', t: p.anim };
    if (p.moving) return { pose: 'walk', t: p.anim };
    return { pose: 'stand', t: 0 };
  }

  function text(str, x, y, size, color, align, font, stroke) {
    ctx.font = `${font === FONT_B ? 800 : 400} ${size}px ${font || FONT_D}`;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    if (stroke) {
      ctx.lineWidth = size * 0.28;
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function wrap(str, maxW, size, font) {
    ctx.font = `800 ${size}px ${font || FONT_B}`;
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    words.forEach((w) => {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // Contador de vidas: coração + "×N" (N conta a vida atual).
  function lives(p, x, y, align) {
    const n = Math.max(0, p.lives);
    const label = '×' + n;
    ctx.font = `400 4.6px ${FONT_D}`;
    const tw = ctx.measureText(label).width;
    const total = 6 + tw;
    const x0 = align === 'right' ? x - total : x;
    const low = n <= 1 && Math.floor(clock * 3) % 2 === 0;
    Art.heart(ctx, x0 + 2.4, y + 0.4, 0.62, low ? '#ffffff' : '#ff3d7f', false);
    text(label, x0 + 5.6, y + 0.2, 4.6, low ? '#ff8fa3' : '#ffffff', 'left');
  }

  function hud(G) {
    const lv = G.level;
    ctx.fillStyle = 'rgba(6,4,22,0.62)';
    ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = hexA(lv.theme.girder, 0.9);
    ctx.fillRect(0, 22, W, 0.6);

    const playerBlock = (p, x, align, active) => {
      ctx.globalAlpha = active ? 1 : 0.55;
      text(p.name.toUpperCase(), x, 5.2, 3.8, p.color, align);
      text(fmtScore(p.score), x, 11.6, 6.4, '#ffffff', align);
      if (!p.out) lives(p, x, 18, align);
      else text('FORA', x, 18, 3.2, '#a9a3cf', align);
      ctx.globalAlpha = 1;
    };

    const lowBonus = G.bonus <= 1000 && G.state === 'play' && Math.floor(clock * 4) % 2 === 0;
    if (G.mode === 'duelo') {
      playerBlock(G.players[0], 4, 'left', !G.players[0].out);
      playerBlock(G.players[1], W - 4, 'right', !G.players[1].out);
      text('BÔNUS', W / 2, 5, 3.2, '#a9a3cf', 'center');
      text(String(G.bonus), W / 2, 11.4, 6.2, lowBonus ? '#ff5470' : '#ffd166', 'center');
      text(`FASE ${lv.fase} · ${lv.meters}M`, W / 2, 17.8, 3.1, '#a9a3cf', 'center');
    } else {
      const cur = G.field[0] || G.players[0];
      playerBlock(cur, 4, 'left', true);
      if (G.mode === 'revez') {
        G.players.forEach((q, i) => {
          if (q === cur) return;
          ctx.globalAlpha = 0.6;
          text(q.name.toUpperCase() + ' ' + fmtScore(q.score), 48, 18, 2.9, q.color, 'left');
          ctx.globalAlpha = 1;
        });
      }
      text('RECORDE', W / 2 - 4, 5, 3.2, '#a9a3cf', 'center');
      text(fmtScore(Math.max(G.hiscore, cur.score)), W / 2 - 4, 11.4, 6, '#ffd166', 'center');
      // bônus
      ctx.strokeStyle = lowBonus ? '#ff5470' : hexA('#ffd166', 0.8);
      ctx.lineWidth = 0.6;
      Art.rr(ctx, W - 50, 2.4, 46, 11.4, 2.5);
      ctx.stroke();
      text('BÔNUS', W - 46.5, 8.2, 3, '#a9a3cf', 'left');
      text(String(G.bonus), W - 6.5, 8.4, 5.6, lowBonus ? '#ff5470' : '#ffd166', 'right');
      text(`FASE ${lv.fase} · ${lv.meters}M`, W - 4, 18, 3.1, '#a9a3cf', 'right');
    }
  }

  function introCard(G) {
    const lv = G.level;
    const k = Math.min(1, G.stateT / 0.25);
    ctx.fillStyle = `rgba(5,3,20,${0.62 * k})`;
    ctx.fillRect(0, 22.6, W, H);
    const cy = 112;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(W / 2, cy);
    ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
    ctx.fillStyle = 'rgba(16,12,44,0.94)';
    Art.rr(ctx, -84, -44, 168, 92, 8);
    ctx.fill();
    ctx.strokeStyle = lv.theme.girder;
    ctx.lineWidth = 1;
    ctx.stroke();
    // viga decorativa
    ctx.fillStyle = lv.theme.girder;
    ctx.fillRect(-70, -33, 140, 1.4);
    ctx.fillRect(-70, -27.4, 140, 1.4);
    ctx.strokeStyle = lv.theme.girder;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let x = -70, up = true; x <= 70; x += 3.5, up = !up) {
      if (x === -70) ctx.moveTo(x, -31.6);
      else ctx.lineTo(x, up ? -31.6 : -27.4);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = k;
    text(`FASE ${lv.fase}`, W / 2, cy - 15, 9, '#ffffff', 'center');
    text(`${lv.meters} M · ${lv.name.toUpperCase()}`, W / 2, cy - 3, 5.2, lv.theme.girder === '#ff5470' ? '#ff8fa3' : lv.theme.girderHi, 'center');
    const lines = wrap(lv.hint, 140, 5.2);
    lines.forEach((ln, i) => text(ln, W / 2, cy + 9 + i * 7, 5.2, '#d9d4ff', 'center', FONT_B));
    if (G.msg) {
      const p = G.field[0];
      text(G.msg.toUpperCase(), W / 2, cy + 38, 5.2, p && G.msg.startsWith('Vez') ? p.color : '#ffd166', 'center');
    } else {
      text('PREPARE-SE!', W / 2, cy + 38, 4.4, '#ffd166', 'center');
    }
    ctx.restore();
  }

  function drawPlayers(G) {
    const showNames = G.mode === 'duelo' || G.mode === 'revez';
    G.field.forEach((p) => {
      if (p.out) return;
      const pose = heroPose(p);
      let alpha = 1;
      if (p.inv > 0 && Math.floor(clock * 10) % 2 === 0) alpha = 0.35;
      Art.hero(ctx, p.x, p.y, Object.assign(pose, { color: p.color, facing: p.facing, hammerUp: p.hammerUp, alpha, shadow: p.state === 'ground' }));
      if (p.hammer > 0 && p.hammer < 2 && Math.floor(clock * 8) % 2 === 0) {
        Art.circle(ctx, p.x, p.y - 8, 9, 'rgba(255,255,255,0.12)');
      }
      if (showNames && !p.dead && (G.mode === 'duelo' || G.state === 'intro')) {
        ctx.font = `400 3.4px ${FONT_D}`;
        const label = p.name.toUpperCase();
        const w = ctx.measureText(label).width + 4;
        const ty = p.y - (p.state === 'climb' ? 25 : 24);
        ctx.fillStyle = hexA(p.color, 0.9);
        Art.rr(ctx, p.x - w / 2, ty - 2.6, w, 5.2, 2.6);
        ctx.fill();
        text(label, p.x, ty + 0.1, 3.4, '#ffffff', 'center');
      }
    });
  }

  function drawFx(G) {
    G.fx.forEach((f) => {
      const k = 1 - f.t / f.life;
      if (f.kind === 'spark') {
        ctx.globalAlpha = k;
        Art.circle(ctx, f.x, f.y, f.size * (0.5 + k * 0.5), f.color);
      } else if (f.kind === 'dust') {
        ctx.globalAlpha = k * 0.6;
        Art.circle(ctx, f.x, f.y, f.size, '#e8e2ff');
      } else if (f.kind === 'puff') {
        ctx.globalAlpha = k * 0.8;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 1.2 * k + 0.3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 2 + (1 - k) * 9, 0, TAU);
        ctx.stroke();
      } else if (f.kind === 'confetti') {
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.fillStyle = f.color;
        ctx.fillRect(-f.size / 2, -f.size / 4, f.size, f.size / 2);
        ctx.restore();
      }
    });
    ctx.globalAlpha = 1;
    G.floaters.forEach((f) => {
      ctx.globalAlpha = Math.min(1, (1.1 - f.t) * 3);
      text(f.text, f.x, f.y, 4.6, f.color, 'center', FONT_D, 'rgba(10,6,30,0.85)');
    });
    ctx.globalAlpha = 1;
  }

  function draw(dt) {
    const G = Game.G, lv = G.level;
    if (!lv || !ctx) return;
    clock += dt;
    if (G.staticDirty || lastLevel !== lv) {
      drawStatic(lv);
      G.staticDirty = false;
      lastLevel = lv;
    }
    const th = lv.theme;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let ox = 0, oy = 0;
    if (G.shake > 0) {
      ox = rand(-1, 1) * G.shake * 5 * scale;
      oy = rand(-1, 1) * G.shake * 5 * scale;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layer, ox, oy);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    // céu com estrelas piscando
    for (let i = 0; i < 6; i++) {
      const sx = (i * 53.7 + 17) % W, sy = 30 + ((i * 37.3) % 110);
      const a = (Math.sin(clock * 2 + i * 1.7) + 1) / 2;
      ctx.globalAlpha = a * 0.8;
      Art.star(ctx, sx, sy, 1.3, '#ffffff');
    }
    ctx.globalAlpha = 1;

    lv.ladders.forEach((ld) => {
      if (ld.retract) Art.ladder(ctx, ld.x, ld.top, ld.bottomEff - Art.GT + 1, th.ladder, null);
    });
    lv.platforms.forEach((p) => {
      if (p.kind === 'conveyor') Art.conveyor(ctx, p, clock, th);
    });
    lv.shafts.forEach((s) => {
      Art.shaft(ctx, s, clock);
      s.plats.forEach((p) => Art.liftPlatform(ctx, p));
    });
    if (lv.oil) Art.oilDrum(ctx, lv.oil.x, lv.oil.y, clock, lv.oil.lit);
    (lv.pile || []).forEach((b) => Art.barrelUpright(ctx, b.x, b.y, false));
    lv.hammers.forEach((h) => {
      if (!h.taken) Art.hammer(ctx, h.x, h.y + Math.sin(clock * 3 + h.t) * 0.8, 0, (Math.sin(clock * 4 + h.t) + 1) / 2);
    });
    lv.items.forEach((it) => {
      if (!it.taken) Art.item(ctx, it.kind, it.x, it.y, clock + it.x);
    });

    // Lara
    const lara = lv.lara;
    const lu = G.lucas;
    if (!G.laraCarried) {
      let st = 'idle';
      const helpPhase = G.t % 5 < 1.8;
      if (G.state === 'clear') st = 'happy';
      else if ((G.state === 'play' || G.state === 'intro') && helpPhase) st = 'help';
      Art.lara(ctx, lara.x, lara.y, { t: clock, state: st, dir: lara.dir });
      if (st === 'help' && G.mode !== 'attract') Art.bubble(ctx, lara.x + lara.dir * 6, lara.y - 27, 'SOCORRO!', 4.2);
      if (G.state === 'clear' && G.clearFinal && G.stateT > 2) Art.bubble(ctx, lara.x + 4, lara.y - 27, 'MEU HERÓI!', 4.2);
    }

    // Lucas e o que ele segura
    Art.lucas(ctx, lu.x, lu.y, { t: lu.t, state: lu.state, dir: lu.dir, look: lu.look });
    if (lu.state === 'hold' && lu.hold) {
      if (lu.hold.kind === 'spring') Art.spring(ctx, lu.x, lu.y - 35, 0);
      else Art.barrelFront(ctx, lu.x, lu.y - 34, lu.hold.blue);
    }
    if (G.laraCarried) {
      Art.lara(ctx, lu.x + lu.dir * 11, lu.y - 6, { t: clock, state: 'help', dir: -lu.dir });
    }
    if (lu.state === 'fall' && lu.fallen) {
      for (let i = 0; i < 4; i++) {
        const a = clock * 4 + (i * TAU) / 4;
        Art.star(ctx, lu.x + Math.cos(a) * 12, lu.y + 2 + Math.sin(a) * 3, 2, '#ffd166');
      }
    }

    // perigos
    G.barrels.forEach((b) => {
      if (b.state === 'ladder') Art.barrelFront(ctx, b.x, b.y, b.blue);
      else Art.barrelRoll(ctx, b.x, b.y, b.rot, b.blue);
    });
    G.pans.forEach((pn) => {
      if (pn.falling) ctx.globalAlpha = Math.max(0, 1 - (pn.y - pn.plat.y1) / 16);
      Art.pan(ctx, pn.x, pn.y);
      ctx.globalAlpha = 1;
    });
    G.springs.forEach((s) => Art.spring(ctx, s.x, s.y, s.squash));
    G.fires.forEach((f) => Art.fireball(ctx, f.x, f.y, f.t, f.dir, f.kind, f.scared, f.scared && Math.floor(clock * 6) % 2 === 0 && alivesHammerEnding(G)));

    drawPlayers(G);

    // corações do resgate
    if (G.state === 'clear') {
      const t = G.stateT;
      if (!G.clearFinal) {
        const s = Math.min(1, t / 0.3) * (1 + Math.sin(t * 10) * 0.05);
        if (t < 2.4) Art.heart(ctx, lara.x - lara.dir * 2, lara.y - 34 - Math.min(t, 1) * 4, 1.3 * s, '#ff3d7f', t > 1.2);
      } else if (t > 1.8) {
        const s = Math.min(1, (t - 1.8) / 0.4) * (1.6 + Math.sin(t * 6) * 0.1);
        Art.heart(ctx, lara.x - 6, lara.y - 36, s, '#ff3d7f', false);
      }
    }

    drawFx(G);

    if (G.mode !== 'attract') {
      hud(G);
      if (G.state === 'intro') introCard(G);
      if (G.state === 'dying' && G.stateT > 0.9) {
        const p = G.field.find((q) => q.dead);
        if (p) {
          ctx.fillStyle = 'rgba(5,3,20,0.5)';
          Art.rr(ctx, W / 2 - 60, 116, 120, 22, 6);
          ctx.fill();
          text(DEATH_TEXT[p.deadWhy] || 'Ops!', W / 2, 123.5, 5.6, '#ffffff', 'center');
          const left = p.lives - 1;
          text(left > 0 ? `Vidas restantes: ${left}` : 'Acabaram as vidas', W / 2, 131.5, 4.6, '#ffd166', 'center', FONT_B);
        }
      }
      if (G.state === 'clear' && G.stateT > 0.4) {
        const p = G.winner;
        const title = G.clearFinal ? 'VOCÊ SALVOU A LARA!' : 'FASE COMPLETA!';
        ctx.fillStyle = 'rgba(5,3,20,0.55)';
        Art.rr(ctx, W / 2 - 74, 116, 148, 30, 7);
        ctx.fill();
        text(title, W / 2, 124, G.clearFinal ? 6.4 : 7, '#ffffff', 'center');
        const sub = (G.mode === 'duelo' && p ? p.name + ' · ' : '') + 'BÔNUS ' + G.bonus;
        text(sub, W / 2, 136, 5, '#ffd166', 'center');
      }
      if (G.state === 'over') {
        ctx.fillStyle = 'rgba(5,3,20,0.55)';
        ctx.fillRect(0, 22.6, W, H);
        text('FIM DE JOGO', W / 2, 110, 12, '#ffffff', 'center', FONT_D, 'rgba(0,0,0,0.6)');
      }
    }
  }

  function alivesHammerEnding(G) {
    return G.field.some((p) => p.hammer > 0 && p.hammer < 2);
  }

  // Miniatura usada na tela inicial e nas contas.
  function portrait(c, who, color) {
    const k = c.width / 40;
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    x.setTransform(k, 0, 0, k, 0, 0);
    if (who === 'lucas') Art.lucas(x, 20, 38, { t: 0.5, state: 'beat', dir: 1 });
    else if (who === 'lara') {
      x.scale(1.4, 1.4);
      Art.lara(x, 14.3, 26.5, { t: 0, state: 'happy', dir: 1 });
    } else {
      x.scale(1.7, 1.7);
      Art.hero(x, 11.8, 21.6, { pose: 'stand', color, facing: 1, t: 0 });
    }
  }

  return { init, resize, draw, portrait };
})();
