// Armazenamento de contas, pontuações e duelos.
// Online (banco compartilhado do claude.ai, mesmo ranking no iPad e no celular) quando disponível,
// senão neste aparelho (localStorage).
const Store = (() => {
  const K = { profiles: 'lk.profiles', scores: 'lk.scores', duels: 'lk.duels' };
  let mode = 'local';
  let db = null;
  let profilesCache = null;

  async function init() {
    const c = window.claude;
    if (c && typeof c.use === 'function') {
      try {
        const got = await Promise.race([
          c.use('db'),
          new Promise((r) => setTimeout(() => r(null), 7000)),
        ]);
        if (got) {
          db = got;
          mode = 'online';
        }
      } catch (e) {
        mode = 'local';
      }
    }
    return mode;
  }

  // Se uma escrita online falhar (sem permissão, por exemplo), continua salvando neste aparelho.
  function fallbackToLocal(err) {
    console.warn('Banco online indisponível, usando armazenamento local.', err);
    mode = 'local';
    db = null;
    profilesCache = null;
  }

  async function retry(fn) {
    try {
      return await fn();
    } catch (e) {
      if (e && e.code === 'unavailable') {
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
        return fn();
      }
      throw e;
    }
  }

  async function sha(text) {
    try {
      if (window.crypto && crypto.subtle && window.TextEncoder) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* cai no hash simples abaixo */ }
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return 'f' + h.toString(16);
  }

  const hashPin = (pin, salt) => sha(salt + ':' + pin + ':lucas-kong');
  const nameKey = (name) => name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function docsData(snap) {
    return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }

  async function listProfiles(force) {
    if (profilesCache && !force) return profilesCache;
    let list;
    if (mode === 'online') {
      try {
        list = docsData(await retry(() => db.collection('profiles').limit(500).get()));
      } catch (e) {
        fallbackToLocal(e);
        list = LS.get(K.profiles, []);
      }
    } else {
      list = LS.get(K.profiles, []);
    }
    list = list.filter((p) => p && p.name).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    profilesCache = list;
    return list;
  }

  async function createProfile({ name, color, pin }) {
    name = name.trim().replace(/\s+/g, ' ').slice(0, 14);
    const key = nameKey(name);
    const existing = await listProfiles(true);
    if (existing.some((p) => p.key === key)) {
      const err = new Error('Já existe uma conta com esse nome. Escolha outro.');
      err.code = 'name_taken';
      throw err;
    }
    const salt = uid();
    const profile = {
      id: 'p' + uid(),
      name,
      key,
      color,
      salt,
      pin: pin ? await hashPin(pin, salt) : '',
      createdAt: Date.now(),
    };
    const body = Object.assign({}, profile);
    delete body.id;
    if (mode === 'online') {
      try {
        await retry(() => db.collection('profiles').doc(profile.id).set(body));
      } catch (e) {
        fallbackToLocal(e);
      }
    }
    if (mode === 'local') {
      const list = LS.get(K.profiles, []);
      list.push(profile);
      LS.set(K.profiles, list);
    }
    profilesCache = null;
    return profile;
  }

  async function verifyPin(profile, pin) {
    if (!profile.pin) return true;
    return (await hashPin(pin, profile.salt)) === profile.pin;
  }

  async function deleteProfile(id) {
    if (mode === 'online') {
      try {
        await retry(() => db.collection('profiles').doc(id).delete());
        const snap = await retry(() => db.collection('scores').where('pid', '==', id).limit(1000).get());
        for (const d of snap.docs) {
          await retry(() => db.collection('scores').doc(d.id).delete());
        }
      } catch (e) {
        fallbackToLocal(e);
      }
    }
    if (mode === 'local') {
      LS.set(K.profiles, LS.get(K.profiles, []).filter((p) => p.id !== id));
      LS.set(K.scores, LS.get(K.scores, []).filter((s) => s.pid !== id));
    }
    profilesCache = null;
  }

  async function addScore(rec) {
    const body = Object.assign({ at: Date.now() }, rec);
    if (mode === 'online') {
      try {
        await retry(() => db.collection('scores').doc('s' + uid()).set(body));
        return;
      } catch (e) {
        if (e && e.code === 'quota_exceeded') throw e;
        fallbackToLocal(e);
      }
    }
    const list = LS.get(K.scores, []);
    list.push(Object.assign({ id: 's' + uid() }, body));
    // Mantém o arquivo local enxuto: as 300 melhores + as 200 mais recentes.
    if (list.length > 600) {
      const best = list.slice().sort((a, b) => b.score - a.score).slice(0, 300);
      const recent = list.slice().sort((a, b) => b.at - a.at).slice(0, 200);
      const keep = new Map();
      best.concat(recent).forEach((s) => keep.set(s.id, s));
      LS.set(K.scores, Array.from(keep.values()));
    } else {
      LS.set(K.scores, list);
    }
  }

  async function allScores() {
    if (mode === 'online') {
      try {
        return docsData(await retry(() => db.collection('scores').orderBy('at', 'desc').limit(1000).get()));
      } catch (e) {
        fallbackToLocal(e);
      }
    }
    return LS.get(K.scores, []).slice().sort((a, b) => b.at - a.at);
  }

  async function addDuel(rec) {
    const body = Object.assign({ at: Date.now() }, rec);
    if (mode === 'online') {
      try {
        await retry(() => db.collection('duels').doc('d' + uid()).set(body));
        return;
      } catch (e) {
        fallbackToLocal(e);
      }
    }
    const list = LS.get(K.duels, []);
    list.push(Object.assign({ id: 'd' + uid() }, body));
    LS.set(K.duels, list.slice(-400));
  }

  async function listDuels() {
    if (mode === 'online') {
      try {
        return docsData(await retry(() => db.collection('duels').orderBy('at', 'desc').limit(300).get()));
      } catch (e) {
        fallbackToLocal(e);
      }
    }
    return LS.get(K.duels, []).slice().sort((a, b) => b.at - a.at);
  }

  return {
    init,
    get mode() { return mode; },
    listProfiles,
    createProfile,
    verifyPin,
    deleteProfile,
    addScore,
    allScores,
    addDuel,
    listDuels,
  };
})();
