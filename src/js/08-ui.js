// Interface: telas, contas, ranking e controles de toque.
const COLORS = ['#ff5470', '#ff8fc7', '#c77dff', '#5e8bff', '#5ee7ff', '#22c7b8', '#80e05e', '#ffd166', '#ff9a3c', '#f4f1ff'];
const GUEST = { pid: null, name: 'Convidado', color: '#9aa3c7', guest: true };

const ICON = {
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.2 4.6l1.6 1.2-1.8 3.2-1.9-.7a7.6 7.6 0 0 1-1.7 1l-.3 2h-3.6l-.3-2a7.6 7.6 0 0 1-1.7-1l-1.9.7-1.8-3.2 1.6-1.2a7.4 7.4 0 0 1 0-2l-1.6-1.2 1.8-3.2 1.9.7a7.6 7.6 0 0 1 1.7-1l.3-2h3.6l.3 2a7.6 7.6 0 0 1 1.7 1l1.9-.7 1.8 3.2-1.6 1.2a7.4 7.4 0 0 1 0 2z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 9H5z"/></svg>',
};

const UI = (() => {
  let app, play, cv, screens;
  let current = null; // conta deste aparelho
  let session = null; // configuração da partida atual
  let scoresCache = null;
  let duelsCache = null;
  let pendingResults = null;
  const settings = Object.assign({ touch: 'auto', padRight: false, random: true }, LS.get('lk.settings', {}));

  // ------------------------------------------------------------ montagem
  function build() {
    app = document.getElementById('app');
    app.innerHTML = `
      <div id="play">
        <canvas id="cv" aria-label="Tela do jogo"></canvas>
        <div class="pad ctl" id="pad0" data-dir=""><span class="ar u">${ICON.arrow}</span><span class="ar r">${ICON.arrow}</span><span class="ar d">${ICON.arrow}</span><span class="ar l">${ICON.arrow}</span><span class="knob"></span></div>
        <button class="jump ctl" id="jump0" type="button">PULAR</button>
        <div class="pad ctl" id="pad1" data-dir=""><span class="ar u">${ICON.arrow}</span><span class="ar r">${ICON.arrow}</span><span class="ar d">${ICON.arrow}</span><span class="ar l">${ICON.arrow}</span><span class="knob"></span></div>
        <button class="jump ctl" id="jump1" type="button">PULAR</button>
        <button class="iconbtn" id="btnPause" type="button" aria-label="Pausar">${ICON.pause}</button>
        <button class="iconbtn" id="btnSound" type="button" aria-label="Som">${ICON.soundOn}</button>
      </div>
      <div id="screens"></div>
      <div id="toast" role="status" aria-live="polite" hidden></div>`;
    play = $('#play');
    cv = $('#cv');
    screens = $('#screens');
    Render.init(cv);
    Input.bindPad($('#pad0'), 0);
    Input.bindPad($('#pad1'), 1);
    Input.bindJump($('#jump0'), 0);
    Input.bindJump($('#jump1'), 1);
    // no modo solo/revezamento, os dois conjuntos controlam o jogador da vez
    $('#btnPause').addEventListener('click', () => pause(true));
    const paintSound = () => ($('#btnSound').innerHTML = Sound.sfxOn || Sound.musicOn ? ICON.soundOn : ICON.soundOff);
    paintSound();
    $('#btnSound').addEventListener('click', () => {
      Sound.unlock();
      const on = !(Sound.sfxOn || Sound.musicOn);
      Sound.setSfx(on);
      Sound.setMusic(on);
      paintSound();
      toast(on ? 'Som ligado' : 'Som desligado');
      if (on) Sound.play('item');
    });
    ['pointerdown', 'touchstart'].forEach((ev) => play.addEventListener(ev, () => Sound.unlock(), { passive: true }));
    play.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    Input.onKey = (e) => {
      if (!session || !inGame()) return;
      if (e.code === 'Escape' || e.code === 'KeyP') pause(!Game.G.paused);
    };
    window.addEventListener('resize', layout);
    ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => setTimeout(layout, 120)));
    window.addEventListener('orientationchange', () => setTimeout(layout, 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (inGame() && !Game.G.paused) pause(true);
        Sound.suspend();
      } else {
        Sound.resume();
      }
    });
    Game.on('over', onGameOver);
    Game.on('progress', onProgress);
    layout();
  }

  const inGame = () => session && Game.G.mode !== 'attract' && Game.G.state !== 'over';

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.h);
    toast.h = setTimeout(() => (t.hidden = true), 2600);
  }

  // ------------------------------------------------------------ layout da tela de jogo
  function hasTouch() {
    if (settings.touch === 'on') return true;
    if (settings.touch === 'off') return false;
    return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  }

  function layout() {
    if (!play) return;
    const vw = play.clientWidth, vh = play.clientHeight;
    const ar = W / H;
    const duel = session && session.mode === 'duelo';
    const touch = hasTouch() && session && Game.G.mode !== 'attract';
    const portrait = vh > vw * 1.05;
    let cw, ch, cx, cy;
    const pads = [$('#pad0'), $('#pad1')], jumps = [$('#jump0'), $('#jump1')];
    const place = (el, x, y, s) => {
      el.hidden = false;
      el.style.width = el.style.height = Math.round(s) + 'px';
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(y) + 'px';
    };
    pads.concat(jumps).forEach((el) => (el.hidden = true));
    const pb = $('#btnPause');
    let pauseX, pauseY;

    if (!touch) {
      ch = vh;
      cw = ch * ar;
      if (cw > vw) {
        cw = vw;
        ch = cw / ar;
      }
      cx = (vw - cw) / 2;
      cy = (vh - ch) / 2;
      pauseX = cx + cw + 10 + 44 < vw ? cx + cw + 10 : cx + cw - 48;
      pauseY = cx + cw + 10 + 44 < vw ? cy + 10 : cy + ch * 0.1;
    } else if (portrait) {
      const ctlH = clamp(vh * 0.28, 150, 250);
      cw = Math.min(vw, (vh - ctlH) * ar);
      ch = cw / ar;
      cx = (vw - cw) / 2;
      cy = 0;
      const top = ch, areaH = vh - ch;
      if (!duel) {
        const s = clamp(Math.min(areaH * 0.78, vw * 0.42), 110, 200);
        const js = s * 0.64;
        const gut = 18;
        // padrão: direcional à esquerda e PULAR à direita
        const padX = settings.padRight ? vw - gut - s : gut;
        const jumpX = settings.padRight ? gut + 6 : vw - gut - js - 6;
        place(pads[0], padX, top + (areaH - s) / 2, s);
        place(jumps[0], jumpX, top + (areaH - js) / 2 + s * 0.08, js);
      } else {
        const s = clamp(Math.min(areaH * 0.62, vw * 0.25), 84, 150);
        const js = s * 0.62;
        const y = top + (areaH - s) / 2 + 10;
        place(pads[0], 10, y, s);
        place(jumps[0], 10 + s + 8, y + s - js, js);
        place(pads[1], vw - 10 - s, y, s);
        place(jumps[1], vw - 10 - s - 8 - js, y + s - js, js);
      }
      pauseX = vw / 2 - 22;
      pauseY = top + 8;
    } else {
      ch = vh;
      cw = ch * ar;
      let side = (vw - cw) / 2;
      const need = duel ? 150 : 128;
      if (side < need) {
        cw = Math.max(vw - need * 2, vw * 0.48);
        ch = Math.min(vh, cw / ar);
        cw = ch * ar;
        side = (vw - cw) / 2;
      }
      cx = side;
      cy = (vh - ch) / 2;
      let s = clamp(Math.min(side * 0.86, vh * 0.42), 96, 200);
      // no duelo deitado, o PULAR fica acima do direcional e abaixo dos botões do topo
      if (duel) s = Math.max(70, Math.min(s, (vh - 92) / 1.66));
      const js = s * 0.66;
      if (!duel) {
        const leftX = (side - s) / 2, rightX = vw - side + (side - js) / 2;
        const padX = settings.padRight ? vw - side + (side - s) / 2 : leftX;
        const jumpX = settings.padRight ? (side - js) / 2 : rightX;
        place(pads[0], padX, vh - s - 26, s);
        place(jumps[0], jumpX, vh - js - 40, js);
      } else {
        place(pads[0], (side - s) / 2, vh - s - 20, s);
        place(jumps[0], (side - js) / 2, Math.max(66, vh - s - 20 - js - 18), js);
        place(pads[1], vw - side + (side - s) / 2, vh - s - 20, s);
        place(jumps[1], vw - side + (side - js) / 2, Math.max(66, vh - s - 20 - js - 18), js);
      }
      pauseX = side > 70 ? vw - side / 2 - (duel ? 49 : 22) : cx + cw - 48;
      pauseY = side > 70 ? (duel ? 10 : 14) : cy + ch * 0.1;
    }
    cv.style.left = Math.round(cx) + 'px';
    cv.style.top = Math.round(cy) + 'px';
    Render.resize(Math.round(cw), Math.round(cw / ar));
    pb.style.left = Math.round(pauseX) + 'px';
    pb.style.top = Math.round(pauseY) + 'px';
    pb.hidden = !inGame();
    // botão de som logo abaixo (ou ao lado, no celular em pé) do pause
    const sb = $('#btnSound');
    const sideBySide = touch && (portrait || duel);
    sb.style.left = Math.round(sideBySide ? pauseX + 54 : pauseX) + 'px';
    sb.style.top = Math.round(sideBySide ? pauseY : pauseY + 54) + 'px';
    sb.hidden = !inGame();
    // cores dos controles no duelo
    if (session && duel) {
      pads[0].style.setProperty('--c', session.players[0].color);
      jumps[0].style.setProperty('--c', session.players[0].color);
      pads[1].style.setProperty('--c', session.players[1].color);
      jumps[1].style.setProperty('--c', session.players[1].color);
    } else {
      pads.concat(jumps).forEach((el) => el.style.removeProperty('--c'));
    }
  }

  // ------------------------------------------------------------ telas
  function show(html, cls) {
    screens.innerHTML = `<section class="screen ${cls || ''}">${html}</section>`;
    screens.hidden = false;
    screens.scrollTop = 0;
    const s = screens.firstElementChild;
    s.scrollTop = 0;
    $$('[data-go]', s).forEach((b) => b.addEventListener('click', () => {
      Sound.unlock();
      Sound.play('click');
      go(b.dataset.go);
    }));
    return s;
  }

  function hideScreens() {
    screens.innerHTML = '';
    screens.hidden = true;
  }

  const header = (title, back) => `
    <header class="bar">
      ${back ? `<button class="iconbtn ghost" type="button" data-go="${back}" aria-label="Voltar">${ICON.back}</button>` : '<span></span>'}
      <h2>${title}</h2>
      <span></span>
    </header>`;

  function go(name, arg) {
    const fn = SCREENS[name];
    if (fn) fn(arg);
  }

  function chip(p) {
    return `<span class="dot" style="--c:${p.color}"></span>`;
  }

  // ------------------------------------------------------------ tela cheia
  const APP_URL = 'https://lucassheide.github.io/iPad-game-/';
  const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
  const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const fsEnabled = () => {
    const el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled);
  };

  async function toggleFullscreen(back) {
    Sound.unlock();
    if (fsActive()) {
      try { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* ok */ }
      return;
    }
    if (fsEnabled()) {
      const el = document.documentElement;
      try {
        const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        if (r && r.then) await r;
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('any').catch(() => {});
        setTimeout(layout, 300);
        return;
      } catch (e) { /* cai nas instruções abaixo */ }
    }
    go('install', back);
  }

  const SCREENS = {
    home() {
      Game.G.mode !== 'attract' && Game.startAttract();
      session = null;
      layout();
      const online = Store.mode === 'online';
      const s = show(`
        <div class="home">
          <div class="brand">
            <div class="portraits">
              <canvas width="160" height="160" id="pLucas" aria-hidden="true"></canvas>
              <canvas width="160" height="160" id="pLara" aria-hidden="true"></canvas>
            </div>
            <h1 class="logo"><span>LUCAS</span><span>KONG</span></h1>
            <p class="tag">O Lucas levou a Lara para o alto da obra. Suba as vigas, desvie dos barris e resgate a princesa.</p>
          </div>
          <div class="who">
            ${current
              ? `${chip(current)}<span class="who-name">Jogando como <b>${esc(current.name)}</b></span><button class="link" data-go="accounts" type="button">Trocar</button>`
              : `<span class="who-name">Nenhuma conta neste aparelho</span><button class="link" data-go="accounts" type="button">Entrar ou criar</button>`}
          </div>
          <div class="menu">
            <button class="btn primary big" data-go="mode" type="button">Jogar</button>
            <div class="row2">
              <button class="btn" data-go="rank" type="button">Ranking</button>
              <button class="btn" data-go="accounts" type="button">Contas</button>
            </div>
            <div class="row2">
              <button class="btn ghost" data-go="help" type="button">Como jogar</button>
              <button class="btn ghost" data-go="settings" type="button">Ajustes</button>
            </div>
            ${isStandalone() ? '' : '<button class="btn ghost" type="button" id="hFull">Tela cheia / instalar no iPad</button>'}
          </div>
          <p class="storage ${online ? 'on' : ''}">${online ? 'Ranking online: as contas e os pontos aparecem no iPad e no celular.' : 'Ranking salvo neste aparelho.'}</p>
        </div>`, 'home-screen');
      const hf = $('#hFull', s);
      if (hf) hf.addEventListener('click', () => toggleFullscreen('home'));
      Render.portrait($('#pLucas', s), 'lucas');
      Render.portrait($('#pLara', s), 'lara');
      Sound.music('menu');
      refreshScores();
    },

    async accounts(msg) {
      const s = show(`${header('Contas', 'home')}
        <div class="sheet">
          ${msg ? `<p class="note">${esc(msg)}</p>` : ''}
          <div class="list" id="plist"><p class="muted">Carregando contas…</p></div>
          <button class="btn primary" data-go="newAccount" type="button">Criar conta</button>
          ${typeof msg === 'string' ? '<button class="btn ghost" type="button" id="asGuest">Jogar como convidado (sem salvar pontos)</button>' : ''}
        </div>`);
      const g = $('#asGuest', s);
      if (g) g.addEventListener('click', () => go('mode', { guest: true }));
      const [list, scores] = await Promise.all([Store.listProfiles(true), getScores()]);
      const best = bestByProfile(scores);
      const box = $('#plist', s);
      if (!box) return;
      if (!list.length) {
        box.innerHTML = '<div class="empty"><b>Nenhuma conta ainda.</b><span>Crie a sua primeira conta para guardar pontos e disputar o ranking.</span></div>';
        return;
      }
      box.innerHTML = list.map((p) => `
        <div class="prow ${current && current.id === p.id ? 'sel' : ''}">
          <button class="pmain" type="button" data-id="${p.id}">
            ${chip(p)}<span class="pname">${esc(p.name)}</span>
            ${p.pin ? `<span class="lock" title="Protegida por PIN">${ICON.lock}</span>` : ''}
            <span class="pbest">${best[p.id] ? fmtNum(best[p.id].best) + ' pts' : 'sem pontos'}</span>
          </button>
          <button class="iconbtn ghost small" type="button" data-del="${p.id}" aria-label="Apagar conta de ${esc(p.name)}">${ICON.trash}</button>
        </div>`).join('');
      $$('[data-id]', box).forEach((b) => b.addEventListener('click', () => {
        const p = list.find((q) => q.id === b.dataset.id);
        withPin(p, 'Entrar como ' + p.name, () => {
          current = p;
          LS.set('lk.current', p.id);
          toast('Olá, ' + p.name + '!');
          go(typeof msg === 'string' ? 'mode' : 'home');
        }, 'accounts');
      }));
      $$('[data-del]', box).forEach((b) => b.addEventListener('click', () => {
        const p = list.find((q) => q.id === b.dataset.del);
        withPin(p, 'Apagar a conta de ' + p.name, () => go('confirmDelete', p), 'accounts');
      }));
    },

    confirmDelete(p) {
      const s = show(`${header('Apagar conta', 'accounts')}
        <div class="sheet">
          <p class="lead">Apagar a conta <b>${esc(p.name)}</b> e todas as pontuações dela? Isso não pode ser desfeito.</p>
          <button class="btn danger" type="button" id="doDel">Apagar ${esc(p.name)}</button>
          <button class="btn ghost" type="button" data-go="accounts">Manter a conta</button>
        </div>`);
      $('#doDel', s).addEventListener('click', async () => {
        $('#doDel', s).disabled = true;
        await Store.deleteProfile(p.id);
        if (current && current.id === p.id) {
          current = null;
          LS.del('lk.current');
        }
        scoresCache = null;
        toast('Conta apagada.');
        go('accounts');
      });
    },

    newAccount() {
      let color = COLORS[Math.floor(Math.random() * 6)];
      const s = show(`${header('Criar conta', 'accounts')}
        <form class="sheet" id="fNew" autocomplete="off" novalidate>
          <div class="newtop">
            <canvas width="120" height="120" id="pPrev" aria-hidden="true"></canvas>
            <label class="field">
              <span>Seu nome</span>
              <input id="inName" maxlength="14" placeholder="Ex.: Lara" autocomplete="off" autocapitalize="words" spellcheck="false">
            </label>
          </div>
          <div class="field">
            <span>Cor do seu herói</span>
            <div class="swatches" id="sw">${COLORS.map((c) => `<button type="button" class="sw" style="--c:${c}" data-c="${c}" aria-label="Cor ${c}"></button>`).join('')}</div>
          </div>
          <label class="field">
            <span>PIN de 4 números <em>(opcional, para ninguém jogar com a sua conta)</em></span>
            <input id="inPin" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" autocomplete="off">
          </label>
          <p class="err" id="err" hidden></p>
          <button class="btn primary" type="submit" id="btnCreate">Criar conta</button>
        </form>`);
      const prev = $('#pPrev', s);
      const paint = () => {
        Render.portrait(prev, 'hero', color);
        $$('.sw', s).forEach((b) => b.classList.toggle('on', b.dataset.c === color));
      };
      paint();
      $$('.sw', s).forEach((b) => b.addEventListener('click', () => {
        color = b.dataset.c;
        Sound.play('click');
        paint();
      }));
      const pin = $('#inPin', s);
      pin.addEventListener('input', () => (pin.value = pin.value.replace(/\D/g, '').slice(0, 4)));
      $('#fNew', s).addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('#inName', s).value.trim();
        const err = $('#err', s);
        err.hidden = true;
        if (name.length < 2) {
          err.textContent = 'Escreva um nome com pelo menos 2 letras.';
          err.hidden = false;
          return;
        }
        if (pin.value && pin.value.length !== 4) {
          err.textContent = 'O PIN precisa ter 4 números, ou deixe em branco.';
          err.hidden = false;
          return;
        }
        const btn = $('#btnCreate', s);
        btn.disabled = true;
        btn.textContent = 'Criando…';
        try {
          const p = await Store.createProfile({ name, color, pin: pin.value });
          current = p;
          LS.set('lk.current', p.id);
          toast('Conta criada. Bem-vindo(a), ' + p.name + '!');
          go('home');
        } catch (ex) {
          err.textContent = ex.message || 'Não foi possível criar a conta. Tente de novo.';
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Criar conta';
        }
      });
    },

    pin(o) {
      let val = '';
      const s = show(`${header(esc(o.title), o.back)}
        <div class="sheet pinpad">
          <div class="pinwho">${chip(o.profile)}<b>${esc(o.profile.name)}</b></div>
          <p class="muted">Digite o PIN de 4 números</p>
          <div class="dots" id="dots">${'<i></i>'.repeat(4)}</div>
          <p class="err" id="err" hidden>PIN incorreto. Tente de novo.</p>
          <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => k === '' ? '<span></span>' : `<button type="button" class="key" data-k="${k}">${k}</button>`).join('')}</div>
        </div>`);
      const dots = $$('#dots i', s);
      const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < val.length));
      const press = async (k) => {
        $('#err', s).hidden = true;
        if (k === '⌫') val = val.slice(0, -1);
        else if (val.length < 4) val += k;
        paint();
        if (val.length === 4) {
          const ok = await Store.verifyPin(o.profile, val);
          if (ok) {
            o.onOk();
          } else {
            val = '';
            paint();
            $('#err', s).hidden = false;
            s.querySelector('.dots').classList.add('shake');
            setTimeout(() => s.querySelector('.dots') && s.querySelector('.dots').classList.remove('shake'), 400);
          }
        }
      };
      $$('.key', s).forEach((b) => b.addEventListener('click', () => {
        Sound.play('click');
        press(b.dataset.k);
      }));
      const onKey = (e) => {
        if (!screens.contains(s)) return window.removeEventListener('keydown', onKey);
        if (/^[0-9]$/.test(e.key)) press(e.key);
        if (e.key === 'Backspace') press('⌫');
      };
      window.addEventListener('keydown', onKey);
    },

    async mode(arg) {
      if (arg && arg.guest) {
        current = null;
      } else if (!current) {
        return go('accounts', 'Escolha ou crie a sua conta para guardar seus pontos.');
      }
      const p1 = current || GUEST;
      const s = show(`${header('Escolha o modo', 'home')}
        <div class="sheet">
          <div class="pinwho">${chip(p1)}<b>${esc(p1.name)}</b>${current ? '' : '<span class="muted">· pontos não são salvos</span>'}</div>
          <button class="mode" type="button" data-m="solo">
            <b>Solo</b><span>Suba todas as fases sozinho e tente bater o recorde.</span>
          </button>
          <button class="mode" type="button" data-m="revez">
            <b>Revezamento</b><span>2 jogadores, um de cada vez. Quem perde uma vida passa a vez. Ótimo no celular.</span>
          </button>
          <button class="mode" type="button" data-m="duelo">
            <b>Duelo</b><span>2 jogadores ao mesmo tempo na mesma tela, cada um com seus controles. Ideal no iPad ou no computador.</span>
          </button>
        </div>`);
      $$('[data-m]', s).forEach((b) => b.addEventListener('click', () => {
        Sound.play('click');
        const m = b.dataset.m;
        if (m === 'solo') go('fase', { mode: m, players: [p1] });
        else go('pick2', { mode: m, p1 });
      }));
    },

    async pick2(o) {
      const s = show(`${header('Segundo jogador', 'mode')}
        <div class="sheet">
          <p class="lead">Quem vai disputar com <b>${esc(o.p1.name)}</b>?</p>
          <div class="list" id="p2list"><p class="muted">Carregando contas…</p></div>
          <button class="btn" type="button" id="g2">Convidado (sem salvar pontos)</button>
          <button class="btn ghost" type="button" data-go="newAccount">Criar outra conta</button>
        </div>`);
      $('#g2', s).addEventListener('click', () => go('fase', { mode: o.mode, players: [o.p1, Object.assign({}, GUEST, { name: 'Convidado 2', color: o.p1.color === '#5ee7ff' ? '#ffd166' : '#5ee7ff' })] }));
      const list = (await Store.listProfiles(true)).filter((p) => !o.p1.id || p.id !== o.p1.id);
      const box = $('#p2list', s);
      if (!box) return;
      if (!list.length) {
        box.innerHTML = '<div class="empty"><b>Ainda não há outra conta.</b><span>Crie a conta do segundo jogador ou jogue com um convidado.</span></div>';
        return;
      }
      box.innerHTML = list.map((p) => `
        <div class="prow"><button class="pmain" type="button" data-id="${p.id}">${chip(p)}<span class="pname">${esc(p.name)}</span>${p.pin ? `<span class="lock">${ICON.lock}</span>` : ''}</button></div>`).join('');
      $$('[data-id]', box).forEach((b) => b.addEventListener('click', () => {
        const p = list.find((q) => q.id === b.dataset.id);
        withPin(p, p.name + ' entra no jogo', () => go('fase', { mode: o.mode, players: [o.p1, p] }), 'mode');
      }));
    },

    async fase(cfg) {
      const scores = await getScores();
      const unlocked = Math.max(1, ...cfg.players.map((p) => unlockedFor(p, scores)));
      const maxShow = Math.max(8, Math.ceil((unlocked + 1) / 4) * 4);
      const tiles = [];
      for (let f = 1; f <= maxShow; f++) {
        const info = faseInfo(f);
        if (settings.random && f > 1) info.name = 'Surpresa';
        const open = f <= unlocked;
        tiles.push(`<button class="tile ${open ? '' : 'locked'}" type="button" data-f="${f}" ${open ? '' : 'disabled'} style="--c:${info.theme.girder}">
          <b>${f}</b><span>${info.name}</span><em>${info.meters} m</em>${open ? '' : `<i class="lk">${ICON.lock}</i>`}</button>`);
      }
      const back = cfg.mode === 'solo' ? 'mode' : 'mode';
      const s = show(`${header('Onde começar?', back)}
        <div class="sheet">
          <button class="btn primary big" type="button" data-f="1">Começar da Fase 1</button>
          <p class="muted center">Partidas que começam na Fase 1 valem para o ranking.</p>
          <h3 class="sub">Treinar uma fase</h3>
          <div class="tiles">${tiles.join('')}</div>
          <p class="muted center">Novas fases são liberadas conforme você chega nelas.</p>
        </div>`);
      $$('[data-f]', s).forEach((b) => b.addEventListener('click', () => {
        Sound.unlock();
        startGame(Object.assign({}, cfg, { startFase: +b.dataset.f }));
      }));
    },

    async rank(tab) {
      tab = tab || 'scores';
      const s = show(`${header('Ranking', 'home')}
        <div class="sheet wide">
          <div class="tabs" role="tablist">
            <button type="button" role="tab" data-t="scores" class="${tab === 'scores' ? 'on' : ''}">Pontuações</button>
            <button type="button" role="tab" data-t="players" class="${tab === 'players' ? 'on' : ''}">Jogadores</button>
            <button type="button" role="tab" data-t="duels" class="${tab === 'duels' ? 'on' : ''}">Duelos</button>
          </div>
          <div id="rbody"><p class="muted">Carregando…</p></div>
          <p class="muted center small">${Store.mode === 'online' ? 'Ranking online, o mesmo em todos os seus aparelhos.' : 'Ranking salvo neste aparelho.'}</p>
        </div>`);
      $$('[data-t]', s).forEach((b) => b.addEventListener('click', () => {
        Sound.play('click');
        go('rank', b.dataset.t);
      }));
      const body = $('#rbody', s);
      scoresCache = null;
      const scores = await getScores();
      if (!body.isConnected) return;
      if (tab === 'scores') {
        const ranked = scores.filter((x) => x.ranked).sort((a, b) => b.score - a.score).slice(0, 25);
        body.innerHTML = ranked.length
          ? `<ol class="rank">${ranked.map((x, i) => `
              <li class="${current && x.pid === current.id ? 'me' : ''}">
                <span class="pos">${i + 1}</span>${chip(x)}
                <span class="rname">${esc(x.name)}<small>${modeLabel(x.mode)} · fase ${x.fase} · ${fmtDate(x.at)}</small></span>
                <span class="rscore">${fmtNum(x.score)}</span>
              </li>`).join('')}</ol>`
          : '<div class="empty"><b>Nenhuma pontuação ainda.</b><span>Jogue uma partida começando na Fase 1 para entrar no ranking.</span></div>';
      } else if (tab === 'players') {
        const [profiles] = await Promise.all([Store.listProfiles(true)]);
        const stats = bestByProfile(scores);
        const rows = profiles.map((p) => Object.assign({ p }, stats[p.id] || { best: 0, games: 0, fase: 0, total: 0 })).sort((a, b) => b.best - a.best);
        body.innerHTML = rows.length
          ? `<div class="ptable">${rows.map((r) => `
              <div class="pcard ${current && r.p.id === current.id ? 'me' : ''}">
                <div class="pc-top">${chip(r.p)}<b>${esc(r.p.name)}</b></div>
                <dl>
                  <div><dt>Recorde</dt><dd>${fmtNum(r.best)}</dd></div>
                  <div><dt>Maior fase</dt><dd>${r.fase || '–'}</dd></div>
                  <div><dt>Partidas</dt><dd>${r.games}</dd></div>
                  <div><dt>Pontos somados</dt><dd>${fmtNum(r.total)}</dd></div>
                </dl>
              </div>`).join('')}</div>`
          : '<div class="empty"><b>Nenhuma conta ainda.</b><span>Crie contas em Contas para ver as estatísticas de cada jogador.</span></div>';
      } else {
        const duels = await getDuels();
        if (!body.isConnected) return;
        if (!duels.length) {
          body.innerHTML = '<div class="empty"><b>Nenhum duelo ainda.</b><span>Escolha Duelo ou Revezamento com duas contas para começar a disputa.</span></div>';
          return;
        }
        const pairs = {};
        duels.forEach((d) => {
          const key = [d.a, d.b].sort().join('|');
          const pr = pairs[key] || (pairs[key] = { a: d.a, b: d.b, an: d.an, bn: d.bn, ac: d.ac, bc: d.bc, wa: 0, wb: 0, draws: 0, n: 0 });
          const winA = d.winner === pr.a, winB = d.winner === pr.b;
          if (winA) pr.wa++;
          else if (winB) pr.wb++;
          else pr.draws++;
          pr.n++;
        });
        body.innerHTML = `
          <h3 class="sub">Placar geral</h3>
          <div class="h2h">${Object.values(pairs).map((pr) => `
            <div class="vs">
              <div class="side"><span class="dot" style="--c:${pr.ac}"></span><b>${esc(pr.an)}</b><span class="big">${pr.wa}</span></div>
              <div class="mid">×<small>${pr.n} ${pr.n === 1 ? 'disputa' : 'disputas'}${pr.draws ? ' · ' + pr.draws + ' empate(s)' : ''}</small></div>
              <div class="side r"><span class="big">${pr.wb}</span><b>${esc(pr.bn)}</b><span class="dot" style="--c:${pr.bc}"></span></div>
            </div>`).join('')}</div>
          <h3 class="sub">Últimas disputas</h3>
          <ol class="rank duels">${duels.slice(0, 15).map((d) => `
            <li><span class="rname">${esc(d.an)} <b>${fmtNum(d.as)}</b> × <b>${fmtNum(d.bs)}</b> ${esc(d.bn)}<small>${modeLabel(d.mode)} · ${fmtDate(d.at)} · ${d.winner ? 'venceu ' + esc(d.winner === d.a ? d.an : d.bn) : 'empate'}</small></span></li>`).join('')}</ol>`;
      }
    },

    help() {
      show(`${header('Como jogar', 'home')}
        <div class="sheet wide help">
          <section>
            <h3 class="sub">O objetivo</h3>
            <p>O Lucas pegou a Lara e subiu na obra. Chegue até ela no topo de cada fase. Na fase dos rebites, passe por cima dos 8 rebites amarelos para o Lucas despencar.</p>
          </section>
          <section>
            <h3 class="sub">Controles</h3>
            <ul class="keys-list">
              <li><b>Toque</b><span>Direcional à esquerda para andar e subir escadas. Botão PULAR à direita. Segure direita + cima perto da escada para subir direto.</span></li>
              <li><b>Teclado</b><span>Setas ou WASD para andar, Espaço para pular, Esc para pausar.</span></li>
              <li><b>Duelo no teclado</b><span>Jogador 1: WASD + Espaço. Jogador 2: setas + Enter.</span></li>
              <li><b>Controle</b><span>Gamepads também funcionam (um por jogador no duelo).</span></li>
            </ul>
          </section>
          <section>
            <h3 class="sub">As 4 fases</h3>
            <ul class="keys-list">
              <li><b>25 m · Barris</b><span>O Lucas rola barris pelas vigas. Os azuis acendem o tambor de óleo e soltam bolas de fogo.</span></li>
              <li><b>50 m · Esteiras</b><span>Esteiras empurram você e carregam bandejas de cimento. Algumas escadas recolhem.</span></li>
              <li><b>75 m · Elevadores</b><span>Pegue os elevadores, mas pule antes de chegar ao topo. Desvie das molas.</span></li>
              <li><b>100 m · Rebites</b><span>Passe pelos 8 rebites. Depois disso, as fases voltam mais rápidas, espelhadas e com outras cores.</span></li>
            </ul>
          </section>
          <section>
            <h3 class="sub">Pontos</h3>
            <table class="pts">
              <tr><td>Pular 1 obstáculo</td><td>100</td></tr>
              <tr><td>Pular 2 de uma vez</td><td>300</td></tr>
              <tr><td>Pular 3 ou mais</td><td>500+</td></tr>
              <tr><td>Quebrar com o martelo</td><td>300 a 800</td></tr>
              <tr><td>Itens da Lara (bolsa, chapéu, guarda-chuva)</td><td>300 a 800</td></tr>
              <tr><td>Cada rebite</td><td>100</td></tr>
              <tr><td>Bônus que sobrar no relógio</td><td>até 8.000</td></tr>
            </table>
            <p class="muted">Vida extra aos 10.000 e 30.000 pontos. Cair de muito alto também tira uma vida.</p>
          </section>
          <button class="btn primary" type="button" data-go="home">Entendi</button>
        </div>`);
    },

    install(back) {
      const ua = navigator.userAgent;
      const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const android = /Android/.test(ua);
      const steps = android
        ? ['Copie o endereço abaixo e abra no <b>Chrome</b>.', 'Toque no menu <b>⋮</b> no canto de cima.', 'Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.', 'Abra o Lucas Kong pelo ícone: ele abre em tela cheia.']
        : ['Copie o endereço abaixo e abra no <b>Safari</b>. No app do Claude essa opção não existe.', 'Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima).', 'Role a lista e toque em <b>Adicionar à Tela de Início</b>, depois em <b>Adicionar</b>.', 'Abra o Lucas Kong pelo ícone: ele abre em tela cheia, sem barras do navegador.'];
      const s = show(`${header('Tela cheia', back || 'home')}
        <div class="sheet">
          <p class="lead">${ios || android ? 'Para jogar em tela cheia, instale o Lucas Kong na tela de início:' : 'Para jogar em tela cheia no iPad ou no celular, instale o Lucas Kong na tela de início:'}</p>
          <ol class="steps">${steps.map((t) => `<li>${t}</li>`).join('')}</ol>
          <div class="urlbox"><input id="appUrl" readonly value="${APP_URL}" aria-label="Endereço do jogo"><button class="btn primary" type="button" id="copyUrl">Copiar</button></div>
          <p class="muted small">No app instalado, as contas e o ranking ficam salvos naquele aparelho. Nesta página do Claude, o ranking é compartilhado entre os seus aparelhos.</p>
          <button class="btn ghost" type="button" data-go="${back || 'home'}">Voltar</button>
        </div>`);
      const inp = $('#appUrl', s);
      $('#copyUrl', s).addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(APP_URL);
          toast('Endereço copiado. Cole no Safari.');
        } catch (e) {
          inp.focus();
          inp.select();
          toast('Selecione e copie o endereço.');
        }
      });
    },

    settings() {
      const s = show(`${header('Ajustes', 'home')}
        <div class="sheet">
          <label class="toggle"><span>Efeitos sonoros</span><input type="checkbox" id="tSfx" ${Sound.sfxOn ? 'checked' : ''}></label>
          <label class="toggle"><span>Música</span><input type="checkbox" id="tMus" ${Sound.musicOn ? 'checked' : ''}></label>
          <div class="field">
            <span>Controles na tela</span>
            <div class="seg" id="segTouch">
              ${[['auto', 'Automático'], ['on', 'Sempre'], ['off', 'Nunca']].map(([v, l]) => `<button type="button" data-v="${v}" class="${settings.touch === v ? 'on' : ''}">${l}</button>`).join('')}
            </div>
          </div>
          <label class="toggle"><span>Direcional à direita (PULAR à esquerda)</span><input type="checkbox" id="tLefty" ${settings.padRight ? 'checked' : ''}></label>
          <label class="toggle"><span>Fases em ordem aleatória</span><input type="checkbox" id="tRandom" ${settings.random ? 'checked' : ''}></label>
          <button class="btn" type="button" id="tTest">Testar som</button>
          <button class="btn primary" type="button" data-go="home">Pronto</button>
        </div>`);
      $('#tSfx', s).addEventListener('change', (e) => { Sound.unlock(); Sound.setSfx(e.target.checked); });
      $('#tMus', s).addEventListener('change', (e) => { Sound.unlock(); Sound.setMusic(e.target.checked); });
      $('#tLefty', s).addEventListener('change', (e) => { settings.padRight = e.target.checked; LS.set('lk.settings', settings); });
      $('#tRandom', s).addEventListener('change', (e) => { settings.random = e.target.checked; LS.set('lk.settings', settings); });
      $('#tTest', s).addEventListener('click', () => { Sound.unlock(); Sound.setSfx(true); Sound.play('item'); $('#tSfx', s).checked = true; });
      $$('#segTouch button', s).forEach((b) => b.addEventListener('click', () => {
        settings.touch = b.dataset.v;
        LS.set('lk.settings', settings);
        $$('#segTouch button', s).forEach((x) => x.classList.toggle('on', x === b));
      }));
    },

    pause() {
      const s = show(`
        <div class="sheet narrow pause">
          <h2 class="ptitle">Pausa</h2>
          <button class="btn primary big" type="button" id="pCont">Continuar</button>
          <div class="row2">
            <button class="btn" type="button" id="pSfx">${Sound.sfxOn ? 'Som: ligado' : 'Som: desligado'}</button>
            <button class="btn" type="button" id="pMus">${Sound.musicOn ? 'Música: ligada' : 'Música: desligada'}</button>
          </div>
          ${isStandalone() || !fsEnabled() ? '' : `<button class="btn" type="button" id="pFull">${fsActive() ? 'Sair da tela cheia' : 'Tela cheia'}</button>`}
          <button class="btn" type="button" id="pRestart">Recomeçar partida</button>
          <button class="btn ghost" type="button" id="pQuit">Sair para o menu</button>
          <p class="muted center small" id="pNote">Ao sair, os pontos desta partida são salvos.</p>
        </div>`, 'dim');
      $('#pCont', s).addEventListener('click', () => pause(false));
      $('#pSfx', s).addEventListener('click', (e) => { Sound.setSfx(!Sound.sfxOn); e.target.textContent = Sound.sfxOn ? 'Som: ligado' : 'Som: desligado'; });
      $('#pMus', s).addEventListener('click', (e) => { Sound.setMusic(!Sound.musicOn); e.target.textContent = Sound.musicOn ? 'Música: ligada' : 'Música: desligada'; });
      const pf = $('#pFull', s);
      if (pf) pf.addEventListener('click', async () => {
        await toggleFullscreen('home');
        pf.textContent = fsActive() ? 'Sair da tela cheia' : 'Tela cheia';
      });
      $('#pRestart', s).addEventListener('click', () => {
        const cfg = session;
        startGame(cfg);
      });
      $('#pQuit', s).addEventListener('click', async () => {
        const r = Game.quit();
        session = null;
        await saveResults(r, true);
        go('home');
      });
    },

    over(data) {
      const { r, saved } = data;
      const sorted = r.players.slice().sort((a, b) => b.score - a.score);
      const multi = r.players.length > 1;
      const tie = multi && sorted[0].score === sorted[1].score;
      const s = show(`
        <div class="sheet narrow over">
          <h2 class="ptitle">Fim de jogo</h2>
          ${multi ? `<p class="winner">${tie ? 'Empate!' : `<span class="dot" style="--c:${sorted[0].color}"></span><b>${esc(sorted[0].name)}</b> venceu a disputa!`}</p>` : ''}
          <div class="results">${sorted.map((p) => {
            const sv = saved[p.name] || {};
            return `<div class="res">
              <div class="res-top">${chip(p)}<b>${esc(p.name)}</b></div>
              <div class="res-score">${fmtNum(p.score)}</div>
              <div class="res-meta">Chegou à fase ${p.fase} · ${faseInfo(p.fase).meters} m</div>
              ${sv.record ? '<div class="badge">Novo recorde pessoal!</div>' : ''}
              ${sv.pos ? `<div class="res-meta">${sv.pos}º lugar no ranking</div>` : ''}
              ${!p.pid ? '<div class="res-meta muted">Convidado: pontos não salvos</div>' : ''}
            </div>`;
          }).join('')}</div>
          ${!r.ranked ? '<p class="muted center small">Partida de treino: não entra no ranking.</p>' : ''}
          <button class="btn primary big" type="button" id="oAgain">Jogar de novo</button>
          <div class="row2">
            <button class="btn" type="button" data-go="rank">Ranking</button>
            <button class="btn ghost" type="button" data-go="home">Menu</button>
          </div>
        </div>`, 'dim');
      $('#oAgain', s).addEventListener('click', () => startGame(Object.assign({}, data.cfg)));
    },
  };

  function modeLabel(m) {
    return m === 'duelo' ? 'Duelo' : m === 'revez' ? 'Revezamento' : 'Solo';
  }

  function withPin(p, title, onOk, back) {
    if (!p.pin) return onOk();
    go('pin', { profile: p, title, onOk, back });
  }

  // ------------------------------------------------------------ dados
  async function getScores() {
    if (!scoresCache) scoresCache = await Store.allScores();
    return scoresCache;
  }

  async function getDuels() {
    duelsCache = await Store.listDuels();
    return duelsCache;
  }

  async function refreshScores() {
    scoresCache = null;
    await getScores();
  }

  function bestByProfile(scores) {
    const m = {};
    scores.forEach((x) => {
      if (!x.pid) return;
      const r = m[x.pid] || (m[x.pid] = { best: 0, games: 0, fase: 0, total: 0 });
      r.games++;
      r.total += x.score || 0;
      r.fase = Math.max(r.fase, x.fase || 0);
      if (x.ranked) r.best = Math.max(r.best, x.score || 0);
    });
    return m;
  }

  function unlockedFor(p, scores) {
    if (!p.id && !p.pid) return LS.get('lk.unlock.guest', 1);
    const id = p.id || p.pid;
    const fromScores = scores.filter((x) => x.pid === id).reduce((m, x) => Math.max(m, x.fase || 1), 1);
    return Math.max(fromScores, LS.get('lk.unlock.' + id, 1));
  }

  function topScore(scores) {
    return scores.filter((x) => x.ranked).reduce((m, x) => Math.max(m, x.score || 0), 0);
  }

  // ------------------------------------------------------------ partida
  async function startGame(cfg) {
    const scores = await getScores();
    session = cfg;
    hideScreens();
    Sound.unlock();
    Game.start({
      mode: cfg.mode,
      random: settings.random,
      startFase: cfg.startFase || 1,
      hiscore: topScore(scores),
      players: cfg.players.map((p) => ({ pid: p.id || null, name: p.name, color: p.color })),
    });
    layout();
  }

  function pause(v) {
    if (!inGame()) return;
    Game.setPaused(v);
    if (v) go('pause');
    else hideScreens();
    $('#btnPause').hidden = v;
    $('#btnSound').hidden = v;
  }

  function onProgress(data) {
    data.players.forEach((p) => {
      const key = p.pid ? 'lk.unlock.' + p.pid : 'lk.unlock.guest';
      const f = Math.max(p.maxFase || 1, p.fase || 1);
      if (f > LS.get(key, 1)) LS.set(key, f);
    });
  }

  async function saveResults(r, quitting) {
    const saved = {};
    if (pendingResults === r) return saved;
    pendingResults = r;
    const before = await getScores();
    const bests = bestByProfile(before);
    onProgress({ players: r.players.map((p) => ({ pid: p.pid, maxFase: p.fase })) });
    try {
      for (const p of r.players) {
        if (!p.pid || p.score <= 0) continue;
        await Store.addScore({ pid: p.pid, name: p.name, color: p.color, score: p.score, fase: p.fase, mode: r.mode, ranked: r.ranked });
        const prevBest = bests[p.pid] ? bests[p.pid].best : 0;
        saved[p.name] = { record: r.ranked && p.score > prevBest };
      }
      if (r.players.length === 2 && r.players[0].pid && r.players[1].pid && !quitting && r.ranked) {
        const [a, b] = r.players;
        await Store.addDuel({
          a: a.pid, b: b.pid, an: a.name, bn: b.name, ac: a.color, bc: b.color,
          as: a.score, bs: b.score, mode: r.mode,
          winner: a.score === b.score ? '' : a.score > b.score ? a.pid : b.pid,
        });
      }
    } catch (e) {
      toast(e && e.code === 'quota_exceeded' ? 'O ranking está cheio. Apague contas antigas para liberar espaço.' : 'Não foi possível salvar os pontos agora.');
    }
    scoresCache = null;
    const after = await getScores();
    const ranked = after.filter((x) => x.ranked).sort((a, b) => b.score - a.score);
    r.players.forEach((p) => {
      if (!p.pid || !r.ranked || p.score <= 0) return;
      const idx = ranked.findIndex((x) => x.pid === p.pid && x.score === p.score);
      if (idx >= 0) saved[p.name] = Object.assign(saved[p.name] || {}, { pos: idx + 1 });
    });
    if (Store.mode !== 'online' && quitting) toast('Pontos salvos neste aparelho.');
    return saved;
  }

  async function onGameOver(r) {
    const cfg = session;
    $('#btnPause').hidden = true;
    $('#btnSound').hidden = true;
    const saved = await saveResults(r, false);
    setTimeout(() => {
      if (session !== cfg) return;
      go('over', { r, saved, cfg });
    }, 1400);
  }

  // ------------------------------------------------------------ início
  async function boot() {
    build();
    show('<div class="loading"><h1 class="logo"><span>LUCAS</span><span>KONG</span></h1><p class="muted">Carregando…</p></div>');
    Game.startAttract();
    await Store.init();
    const id = LS.get('lk.current', null);
    if (id) {
      const list = await Store.listProfiles(true);
      current = list.find((p) => p.id === id) || null;
    }
    go('home');
  }

  return { boot, layout, go, startGame };
})();
