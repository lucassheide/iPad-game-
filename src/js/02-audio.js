// Sons sintetizados com WebAudio (sem arquivos externos).
const Sound = (() => {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musBus = null;
  let sfxOn = LS.get('lk.sfx', true);
  let musOn = LS.get('lk.music', true);
  let song = null;
  let step = 0;
  let nextTime = 0;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
      } catch (e) {
        return;
      }
      master = ctx.createGain();
      master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = sfxOn ? 0.55 : 0;
      sfxBus.connect(master);
      musBus = ctx.createGain();
      musBus.gain.value = musOn ? 0.22 : 0;
      musBus.connect(master);
      setInterval(schedule, 40);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  const mfreq = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function tone(o) {
    if (!ctx) return;
    const t0 = (o.at || ctx.currentTime) + (o.delay || 0);
    const dur = o.dur || 0.1;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    const vol = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.bus || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  let noiseBuf = null;
  function noise(o) {
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = (o.at || ctx.currentTime) + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.ftype || 'bandpass';
    f.frequency.value = o.freq || 1200;
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.15));
    src.connect(f);
    f.connect(g);
    g.connect(o.bus || sfxBus);
    src.start(t0);
    src.stop(t0 + (o.dur || 0.15) + 0.05);
  }

  const sfx = {
    jump() { tone({ freq: 330, to: 820, dur: 0.14, type: 'square', vol: 0.12, lp: 2600 }); },
    land() { tone({ freq: 140, to: 60, dur: 0.08, type: 'triangle', vol: 0.18 }); },
    step(i) { tone({ freq: i ? 210 : 165, to: i ? 150 : 120, dur: 0.05, type: 'triangle', vol: 0.07 }); },
    climb(i) { tone({ freq: i ? 520 : 440, dur: 0.035, type: 'triangle', vol: 0.05 }); },
    score() {
      tone({ freq: 988, dur: 0.07, type: 'square', vol: 0.09, lp: 4000 });
      tone({ freq: 1319, dur: 0.12, type: 'square', vol: 0.09, lp: 4000, delay: 0.07 });
    },
    hammer() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.09, vol: 0.1, delay: i * 0.05, lp: 3500 }));
    },
    smash() {
      noise({ dur: 0.22, vol: 0.45, freq: 900, q: 0.7 });
      tone({ freq: 300, to: 70, dur: 0.2, type: 'sawtooth', vol: 0.12, lp: 1400 });
    },
    die() {
      [784, 740, 659, 587, 523, 440, 392, 330].forEach((f, i) =>
        tone({ freq: f, to: f * 0.94, dur: 0.11, type: 'square', vol: 0.12, delay: i * 0.1, lp: 3000 }));
      noise({ dur: 0.35, vol: 0.2, freq: 300, delay: 0.85, ftype: 'lowpass' });
    },
    clear() {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
        tone({ freq: f, dur: i === 6 ? 0.5 : 0.13, type: 'square', vol: 0.11, delay: i * 0.11, lp: 4200 }));
    },
    rescue() {
      const mel = [659, 784, 880, 1047, 880, 1047, 1175, 1319, 1568];
      mel.forEach((f, i) => tone({ freq: f, dur: i === mel.length - 1 ? 0.8 : 0.16, type: 'triangle', vol: 0.16, delay: i * 0.14 }));
      mel.forEach((f, i) => tone({ freq: f / 2, dur: 0.16, type: 'square', vol: 0.05, delay: i * 0.14, lp: 1500 }));
    },
    rivet() {
      tone({ freq: 1760, to: 1200, dur: 0.12, type: 'triangle', vol: 0.14 });
      noise({ dur: 0.06, vol: 0.12, freq: 5000 });
    },
    item() {
      [880, 1109, 1319, 1760].forEach((f, i) => tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.14, delay: i * 0.06 }));
    },
    spring() { tone({ freq: 180, to: 520, dur: 0.12, type: 'sine', vol: 0.12 }); },
    oneup() {
      [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.09, vol: 0.1, delay: i * 0.08, lp: 4000 }));
    },
    tick() { tone({ freq: 1400, dur: 0.03, type: 'square', vol: 0.05, lp: 5000 }); },
    fire() { noise({ dur: 0.4, vol: 0.18, freq: 500, q: 0.5 }); },
    thud() {
      tone({ freq: 90, to: 40, dur: 0.35, type: 'sine', vol: 0.35 });
      noise({ dur: 0.3, vol: 0.25, freq: 200, ftype: 'lowpass' });
    },
    roar() { tone({ freq: 110, to: 70, dur: 0.4, type: 'sawtooth', vol: 0.12, lp: 600 }); },
    click() { tone({ freq: 660, dur: 0.04, type: 'triangle', vol: 0.08 }); },
    start() {
      [392, 523, 659, 784, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.12, vol: 0.1, delay: i * 0.1, lp: 3800 }));
    },
  };

  // Trilhas curtas em loop (passos de colcheia). n = nota MIDI, null = pausa.
  const _ = null;
  const SONGS = {
    barrels: {
      bpm: 138,
      bass: [36, _, 43, _, 36, _, 43, _, 32, _, 39, _, 34, _, 41, _],
      lead: [72, _, 75, 79, _, 77, 75, _, 74, _, 70, _, 72, _, _, _, 72, _, 75, 79, _, 80, 79, _, 77, _, 75, _, 74, _, _, _],
    },
    conveyor: {
      bpm: 146,
      bass: [38, 50, 38, 50, 41, 53, 41, 53, 36, 48, 36, 48, 43, 55, 43, 55],
      lead: [74, _, 77, _, 81, _, 79, 77, _, _, 76, _, 74, _, _, _, 72, _, 76, _, 79, _, 81, 79, _, _, 77, _, 76, _, 74, _],
    },
    elevator: {
      bpm: 120,
      bass: [41, _, 48, _, 45, _, 48, _, 43, _, 50, _, 46, _, 50, _],
      lead: [77, _, _, 81, _, 84, _, 81, 79, _, _, 82, _, 86, _, 82, 77, _, 81, _, 84, _, 89, _, 88, _, 86, _, 84, _, _, _],
    },
    rivets: {
      bpm: 152,
      bass: [33, 45, 33, 45, 36, 48, 36, 48, 31, 43, 31, 43, 32, 44, 34, 46],
      lead: [69, 72, 76, 72, 69, _, 81, _, 79, 76, 72, _, 74, _, _, _, 69, 72, 76, 79, 81, _, 84, _, 83, 79, 76, _, 77, _, 76, _],
    },
    hammer: {
      bpm: 176,
      bass: [36, 48, 36, 48, 41, 53, 41, 53, 43, 55, 43, 55, 41, 53, 43, 55],
      lead: [72, 76, 79, 84, 79, 76, 77, 81, 84, 89, 84, 81, 79, 83, 86, 91, 86, 83, 77, 81, 84, 89, 84, 81, 79, 83, 86, 83, 79, 76, 79, 83],
    },
    menu: {
      bpm: 112,
      bass: [36, _, _, 43, _, _, 41, _, 39, _, _, 43, _, _, 38, _],
      lead: [72, _, 74, 75, _, 79, _, 77, 75, _, 74, _, 72, _, _, _, 70, _, 72, 74, _, 77, _, 75, 74, _, 72, _, 74, _, _, _],
    },
  };

  function schedule() {
    if (!ctx || !song || !musOn) return;
    const s = SONGS[song];
    if (!s) return;
    const dur = 60 / s.bpm / 2;
    if (nextTime < ctx.currentTime - 0.1) nextTime = ctx.currentTime + 0.03;
    while (nextTime < ctx.currentTime + 0.18) {
      const b = s.bass[step % s.bass.length];
      const l = s.lead[step % s.lead.length];
      if (b != null) tone({ at: nextTime, freq: mfreq(b), dur: dur * 0.9, type: 'triangle', vol: 0.5, bus: musBus });
      if (l != null) tone({ at: nextTime, freq: mfreq(l), dur: dur * 0.8, type: 'square', vol: 0.16, lp: 2200, bus: musBus });
      if (step % 4 === 0) noise({ at: nextTime, dur: 0.05, vol: 0.12, freq: 6000, ftype: 'highpass', bus: musBus });
      step++;
      nextTime += dur;
    }
  }

  function music(name) {
    if (song === name) return;
    song = name;
    step = 0;
    if (ctx) nextTime = ctx.currentTime + 0.06;
  }

  function setSfx(on) {
    sfxOn = on;
    LS.set('lk.sfx', on);
    if (sfxBus) sfxBus.gain.value = on ? 0.55 : 0;
  }

  function setMusic(on) {
    musOn = on;
    LS.set('lk.music', on);
    if (musBus) musBus.gain.value = on ? 0.22 : 0;
  }

  function play(name, arg) {
    if (!ctx || !sfxOn || !sfx[name]) return;
    try { sfx[name](arg); } catch (e) { /* áudio é opcional */ }
  }

  return {
    unlock,
    play,
    music,
    get sfxOn() { return sfxOn; },
    get musicOn() { return musOn; },
    setSfx,
    setMusic,
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
  };
})();
