// Data layer: Firebase Realtime Database, or a localStorage demo when no config is set.
import { FIREBASE_CONFIG } from './config.js';

const V = '10.14.1';
const configured = !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && !/^PASTE/.test(FIREBASE_CONFIG.apiKey) && FIREBASE_CONFIG.databaseURL);

export async function connect() {
  return configured ? firebase() : demo();
}

async function firebase() {
  const B = `https://www.gstatic.com/firebasejs/${V}/`;
  const [{ initializeApp }, A, D] = await Promise.all([
    import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-database.js')
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app);
  if (auth.authStateReady) await auth.authStateReady();
  else await new Promise(r => { const u = A.onAuthStateChanged(auth, () => { u(); r(); }); });
  // If the saved guest account was cleaned up on the server, start a fresh one.
  if (auth.currentUser) {
    try { await auth.currentUser.getIdToken(true); } catch (e) { await A.signOut(auth).catch(() => {}); }
  }
  if (!auth.currentUser) await A.signInAnonymously(auth);
  const db = D.getDatabase(app);
  let off = 0;
  D.onValue(D.ref(db, '.info/serverTimeOffset'), s => { off = s.val() || 0; });
  const r = p => D.ref(db, p);
  return {
    demo: false,
    uid: auth.currentUser.uid,
    now: () => Date.now() + off,
    ts: () => D.serverTimestamp(),
    get: async p => (await D.get(r(p))).val(),
    set: (p, v) => D.set(r(p), v),
    update: (p, v) => D.update(r(p), v),
    remove: p => D.remove(r(p)),
    push: (p, v) => D.push(r(p), v),
    newKey: p => D.push(r(p)).key,
    onValue: (p, cb, err) => D.onValue(r(p), s => cb(s.val()), e => err && err(e)),
    onChild: (p, cb, limit) => D.onChildAdded(limit ? D.query(r(p), D.limitToLast(limit)) : r(p), s => cb(s.key, s.val()), () => {}),
    tx: (p, fn) => D.runTransaction(r(p), fn),
    onConn: cb => D.onValue(r('.info/connected'), x => cb(x.val() === true)),
    presence(p, online, offline) {
      const un = D.onValue(r('.info/connected'), s => {
        if (s.val() === true) D.onDisconnect(r(p)).update(offline()).then(() => D.update(r(p), online())).catch(() => {});
      });
      return () => { un(); D.onDisconnect(r(p)).cancel().catch(() => {}); };
    }
  };
}

// ---- local demo: every tab in this browser is a player; localStorage is the "server" ----
function demo() {
  const K = 'dd-demo-db', TS = '__TS__';
  const load = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } };
  const parts = p => p.split('/').filter(Boolean);
  const getAt = (d, p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), d);
  const fix = v => JSON.parse(JSON.stringify(v, (k, x) => (x === TS ? Date.now() : x)));
  const setAt = (d, p, v) => {
    const ks = parts(p); let o = d;
    for (let i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== 'object' || o[ks[i]] === null) o[ks[i]] = {}; o = o[ks[i]]; }
    const last = ks[ks.length - 1];
    if (v === null || v === undefined) delete o[last]; else o[last] = fix(v);
  };
  let uid = sessionStorage.getItem('dd-demo-uid');
  if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('dd-demo-uid', uid); }
  const vals = new Set(), kids = new Set();
  let queued = false;
  const fire = () => {
    queued = false; const d = load();
    vals.forEach(l => { const v = getAt(d, l.p), j = JSON.stringify(v === undefined ? null : v); if (j !== l.last) { l.last = j; l.cb(v === undefined ? null : JSON.parse(j)); } });
    kids.forEach(l => { const o = getAt(d, l.p) || {}; for (const k of Object.keys(o).sort()) if (!l.seen.has(k)) { l.seen.add(k); l.cb(k, JSON.parse(JSON.stringify(o[k]))); } });
  };
  const soon = () => { if (!queued) { queued = true; queueMicrotask(fire); } };
  window.addEventListener('storage', e => { if (e.key === K) soon(); });
  const write = f => { const d = load(); f(d); localStorage.setItem(K, JSON.stringify(d)); soon(); return Promise.resolve(); };
  let n = 0;
  const key = () => Date.now().toString(36).padStart(10, '0') + (n++).toString(36).padStart(4, '0') + Math.random().toString(36).slice(2, 6);
  return {
    demo: true, uid,
    now: () => Date.now(), ts: () => TS,
    get: async p => { const v = getAt(load(), p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); },
    set: (p, v) => write(d => setAt(d, p, v)),
    update: (p, o) => write(d => { for (const k in o) setAt(d, p + '/' + k, o[k]); }),
    remove: p => write(d => setAt(d, p, null)),
    push: (p, v) => { const k = key(); write(d => setAt(d, p + '/' + k, v)); return { key: k }; },
    newKey: () => key(),
    onConn: cb => { setTimeout(() => cb(true), 0); return () => {}; },
    onValue: (p, cb) => { const l = { p, cb, last: undefined }; vals.add(l); soon(); return () => vals.delete(l); },
    onChild: (p, cb, limit) => {
      const o = getAt(load(), p) || {}, ks = Object.keys(o).sort();
      const l = { p, cb, seen: new Set(limit ? ks.slice(0, Math.max(0, ks.length - limit)) : []) };
      kids.add(l); soon(); return () => kids.delete(l);
    },
    tx: (p, fn) => { const d = load(); const cur = getAt(d, p); const r = fn(cur === undefined ? null : JSON.parse(JSON.stringify(cur))); if (r !== undefined) { setAt(d, p, r); localStorage.setItem(K, JSON.stringify(d)); soon(); } return Promise.resolve({ committed: r !== undefined }); },
    presence(p, online, offline) {
      write(d => { const o = online(); for (const k in o) setAt(d, p + '/' + k, o[k]); });
      const off = () => write(d => { const o = offline(); for (const k in o) setAt(d, p + '/' + k, o[k]); });
      window.addEventListener('pagehide', off);
      return () => window.removeEventListener('pagehide', off);
    }
  };
}
