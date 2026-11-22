import { PACKS, DEFAULT_PACKS } from './words.js';
import { connect } from './net.js';

const $ = s => document.querySelector(s);
const W = 800, H = 600, GRACE = 60000;
const COLORS = ['#000000','#ffffff','#7a7a7a','#c9c9c9','#e53935','#ff7a1a','#ffd23f','#fff3a6','#2fbf7f','#0f7a45','#2fb3ff','#2347c6','#7b3fe4','#ff4f7b','#8d5524','#f5c19a'];
const SIZES = [4, 10, 20, 36];
const AV = ['#ff4f7b','#ff7a1a','#ffd23f','#2fbf7f','#2fb3ff','#7b3fe4','#e53935','#8d5524'];
const rnd = n => Math.floor(Math.random() * n);
const rid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okCol = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#9aa0c0';
const arr = v => Array.isArray(v) ? v.filter(x => x != null) : v && typeof v === 'object' ? Object.values(v) : [];
const lget = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lset = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const normG = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{M}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graph = s => SEG ? [...SEG.segment(s)].map(x => x.segment) : Array.from(s);
const isLetter = g => /[\p{L}\p{N}]/u.test(g);
function lev(a, b) { a = [...a]; b = [...b]; if (Math.abs(a.length - b.length) > 2) return 9; const d = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; }
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 24); }
const guessHash = (w, tid) => sha(normG(w) + '|' + tid + '|' + code);
const mask = (w, rev) => graph(w).map((g, i) => g === ' ' ? ' ' : (!isLetter(g) || rev.includes(i)) ? g : '_');
const av = (c, big) => `<svg class="av" ${big ? 'style="width:72px;height:72px;margin:auto"' : ''} viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3c10 0 17 6 17 17s-7 17-17 17S3 31 3 20 10 3 20 3z" fill="${okCol(c)}"/><circle cx="14" cy="18" r="4.5" fill="#fff"/><circle cx="26" cy="18" r="4.5" fill="#fff"/><circle cx="15" cy="19" r="2.2" fill="#1b1f3b"/><circle cx="27" cy="19" r="2.2" fill="#1b1f3b"/><path d="M14 27q6 5 12 0" stroke="#1b1f3b" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
const PEN = '<svg class="pen" viewBox="0 0 24 24" aria-label="drawing"><path d="M4 20l1-5L16 4l4 4L9 19z" fill="#ffd23f" stroke="#1b1f3b" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 20l1-5 4 4z" fill="#f5c19a" stroke="#1b1f3b" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const THUMB = up => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="${up ? '' : 'transform:rotate(180deg)'}"><path d="M7 10v10H3V10zm2 10h8.5a2 2 0 0 0 2-1.6l1.3-6.5A2 2 0 0 0 18.8 9.5H14l.8-4a1.8 1.8 0 0 0-3.3-1.3L9 9z" fill="currentColor"/></svg>`;

let net = null, code = '', base = '', S = null, P = {}, SEC = {}, RATE = {}, KICK = {};
let unsubs = [], tidSubs = [], secUn = null, secKey = '', subTid = -1, joinedAt = 0;
let myKeys = new Set(), strokes = [], cur = null, sent = 0;
let hostBusy = false, pendingG = [], pendingPick = null, pendingStart = false, pendingSet = null, pendingKick = [];
let tool = 'brush', color = '#000000', size = 10, myCol = lget('dd-col') || AV[rnd(AV.length)];
let ovKey = '', prevPh = '', prevTid = -1, lastSecs = -1, wasOnline = {}, muted = lget('dd-mute') === '1';

const defState = () => ({ host: null, ph: 'lobby', set: { rounds: 3, time: 80, hints: 2, max: 12, packs: DEFAULT_PACKS, custom: '', only: false }, sc: {}, order: [], drawn: [], round: 0, dr: null, tid: 0, endAt: 0, g: {}, gp: {}, rev: [], hint: [], h: '', word: '', ban: {} });
function normState(v) {
  const d = defState(), s = { ...d, ...v, set: { ...d.set, ...((v && v.set) || {}) } };
  s.order = arr(s.order); s.drawn = arr(s.drawn); s.rev = arr(s.rev).map(Number); s.hint = arr(s.hint); s.set.packs = arr(s.set.packs);
  for (const k of ['sc', 'g', 'gp', 'ban']) s[k] = s[k] || {};
  return s;
}

/* ---------- sound ---------- */
let AC = null;
function initAudio() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} }
function tone(f, d, t = 0, type = 'sine', v = .15) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain(), s = AC.currentTime + t;
  o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, s); g.gain.exponentialRampToValueAtTime(.001, s + d);
  o.connect(g).connect(AC.destination); o.start(s); o.stop(s + d + .02);
}
const SFX = {
  ok: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, i * .08, 'triangle')),
  pop: () => tone(880, .1, 0, 'triangle', .1),
  tick: () => tone(1250, .05, 0, 'square', .04),
  turn: () => { tone(660, .15); tone(990, .22, .15); },
  end: () => [784, 659, 523].forEach((f, i) => tone(f, .2, i * .12, 'triangle')),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, .22, i * .12, 'triangle')),
  close: () => tone(440, .12, 0, 'sawtooth', .05)
};
const sfx = n => { try { SFX[n] && SFX[n](); } catch (e) {} };
function drawMute() { $('#mute').innerHTML = muted ? 'Sound off' : 'Sound on'; $('#mute').setAttribute('aria-pressed', !muted); }
$('#mute').addEventListener('click', () => { muted = !muted; lset('dd-mute', muted ? '1' : '0'); drawMute(); initAudio(); });
drawMute();

/* ---------- home ---------- */
const notice = t => { const n = $('#notice'); n.hidden = !t; n.textContent = t || ''; };
$('#nick').value = lget('dd-nick') || '';
const params = new URLSearchParams(location.search);
const pathCode = (location.pathname.match(/^\/r\/([a-z0-9]{1,12})\/?$/i) || [])[1] || params.get('r') || '';
let last = null; try { last = JSON.parse(lget('dd-last') || 'null'); } catch (e) {}
if (pathCode) $('#code').value = pathCode.toLowerCase();
else if (last && Date.now() - last.at < 30 * 60000) { $('#code').value = last.code; $('#join-hint').textContent = 'You were in room ' + last.code + ' recently. Press Play to rejoin.'; }
function drawSw() { $('#sws').innerHTML = AV.map(c => `<button class="sw" data-c="${c}" aria-label="Colour ${c}" aria-pressed="${c === myCol}">${av(c)}</button>`).join(''); }
drawSw();
$('#sws').addEventListener('click', e => { const b = e.target.closest('.sw'); if (b) { myCol = b.dataset.c; lset('dd-col', myCol); drawSw(); } });
$('#join').addEventListener('click', join);
for (const id of ['#code', '#nick']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') join(); });

(async () => {
  try { net = await connect(); }
  catch (e) { notice('Could not connect to the game server: ' + (e && e.message || e) + '. Check the Firebase setup in the README.'); $('#join').textContent = 'Offline'; return; }
  $('#join').disabled = false; $('#join').textContent = 'Play!';
  if (net.demo) $('#demo').hidden = false;
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();

async function join() {
  if (!net) return;
  initAudio();
  const b = $('#join'); b.disabled = true; b.textContent = 'Joining…'; notice('');
  const nick = ($('#nick').value.trim() || 'Player' + rnd(100)).slice(0, 16); lset('dd-nick', nick);
  const c = ($('#code').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || rid().slice(0, 5)).slice(0, 12);
  try {
    const bp = 'rooms/' + c, me = net.uid;
    const st = await net.get(bp + '/state'), pl = (await net.get(bp + '/players')) || {};
    if (st && st.ban && st.ban[me]) throw new Error('You were removed from this room by the host.');
    const max = (st && st.set && st.set.max) || 12, on = Object.keys(pl).filter(k => k !== me && pl[k] && pl[k].online).length;
    if (st && on >= max) throw new Error('This room is full (' + max + ' players). Try another code.');
    await net.tx(bp + '/state', cur => cur ? undefined : { ...defState(), host: me });
    code = c; base = bp; S = normState(st || { ...defState(), host: me }); P = pl;
    await net.update(bp + '/players/' + me, { nick, col: myCol, t: (pl[me] && pl[me].t) || net.now(), online: true, seen: net.ts() });
    joinedAt = net.now(); wasOnline = {}; ovKey = ''; prevPh = ''; prevTid = -1; subTid = -1; $('#log').innerHTML = '';
    unsubs.push(net.presence(bp + '/players/' + me, () => ({ online: true, seen: net.ts() }), () => ({ online: false, seen: net.ts() })));
    unsubs.push(net.onValue(bp + '/state', v => { if (v) { S = normState(v); onState(); } }));
    unsubs.push(net.onValue(bp + '/players', v => { P = v || {}; onPlayers(); render(); }));
    unsubs.push(net.onValue(bp + '/kick', v => { KICK = v || {}; render(); }));
    unsubs.push(net.onChild(bp + '/chat', (k, m) => onChat(m), 60));
    lset('dd-last', JSON.stringify({ code: c, at: Date.now() }));
    try { history.replaceState(null, '', net.demo ? '?r=' + c : '/r/' + c); } catch (e) {}
    $('#home').style.display = 'none'; $('#game').style.display = 'grid';
    addMsg(net.demo ? 'Demo mode: open more tabs of this page to add players.' : 'You joined room ' + c + '. Invite friends with the link.', 'info');
    onState();
  } catch (e) { notice(e && e.message || String(e)); }
  b.disabled = false; b.textContent = 'Play!';
}
function leave(msg) {
  unsubs.forEach(u => { try { u(); } catch (e) {} }); tidSubs.forEach(u => u()); if (secUn) secUn();
  unsubs = []; tidSubs = []; secUn = null; secKey = '';
  if (base && net) net.update(base + '/players/' + net.uid, { online: false, seen: net.ts() }).catch(() => {});
  base = ''; code = ''; S = null; lset('dd-last', 'null');
  try { history.replaceState(null, '', '/'); } catch (e) {}
  $('#game').style.display = 'none'; $('#home').style.display = 'grid'; notice(msg || '');
}
$('#leave').addEventListener('click', () => leave());

/* ---------- listeners ---------- */
const me = () => net.uid;
const nameOf = id => (P[id] && String(P[id].nick || '').slice(0, 16)) || 'Someone';
const colOf = id => okCol(P[id] && P[id].col);
const onlineIds = () => Object.keys(P).filter(k => P[k] && P[k].online && !(S && S.ban[k]));
const byT = (a, b) => ((+P[a].t || 0) - (+P[b].t || 0)) || (a < b ? -1 : 1);
const canReadSecret = () => S && (S.dr === me() || S.host === me() || !!S.g[me()]);

function onState() {
  if (!S) return;
  if (S.ban[me()]) return leave('You were removed from the room.');
  if (S.tid !== subTid) resubTid();
  resubSecret();
  if (S.tid !== prevTid && S.ph === 'choose') { addMsg(S.dr === me() ? 'Your turn! Pick a word to draw.' : nameOf(S.dr) + ' is choosing a word', 'info'); if (S.dr === me()) sfx('turn'); }
  if (prevPh === 'draw' && S.ph === 'reveal') sfx('end');
  if (S.ph === 'over' && prevPh && prevPh !== 'over') sfx('win');
  prevPh = S.ph; prevTid = S.tid;
  render();
}
function onPlayers() {
  const on = new Set(onlineIds());
  for (const id of on) if (!wasOnline[id]) { if (id !== me() && Object.keys(wasOnline).length) addMsg(nameOf(id) + ' joined', 'info'); }
  for (const id in wasOnline) if (!on.has(id) && id !== me() && P[id] && !(S && S.ban[id])) addMsg(nameOf(id) + (S && S.ph !== 'lobby' ? ' disconnected. Their spot is held for 60 seconds.' : ' left'), 'bad');
  wasOnline = {}; on.forEach(id => wasOnline[id] = 1); if (!on.size) wasOnline.__ = 1;
}
function resubTid() {
  tidSubs.forEach(u => u()); tidSubs = []; subTid = S.tid; strokes = []; cur = null; myKeys = new Set(); RATE = {}; pendingPick = null; redraw();
  const t = S.tid, p = base;
  tidSubs.push(net.onChild(`${p}/draw/${t}`, (k, v) => { if (!myKeys.has(k)) applyChunk(v); }));
  tidSubs.push(net.onValue(`${p}/rate/${t}`, v => { RATE = v || {}; render(); }));
  tidSubs.push(net.onChild(`${p}/guesses/${t}`, (k, v) => { if (S && S.host === me()) pendingG.push([k, v, t]); }));
  tidSubs.push(net.onValue(`${p}/pick/${t}`, v => { if (v != null) pendingPick = [+v, t]; }));
}
function resubSecret() {
  const k = [S.tid, canReadSecret()].join('|');
  if (k === secKey) return; secKey = k;
  if (secUn) secUn(); secUn = null; SEC = {};
  if (canReadSecret()) secUn = net.onValue(`${base}/secret/${S.tid}`, v => { SEC = v || {}; render(); }, () => {});
}

/* ---------- host ---------- */
setInterval(async () => {
  if (!S || !base) return; clockTick();
  if (hostBusy) return; hostBusy = true;
  try { await hostTick(); } catch (e) { console.error(e); }
  hostBusy = false;
}, 250);
function sys(type, p, extra) { return net.push(base + '/chat', { u: me(), sys: type, p: p || null, at: net.ts(), ...(extra || {}) }); }
function pool(set) {
  const cu = String(set.custom || '').split(',').map(s => s.trim()).filter(s => s && s.length <= 30);
  if (set.only && cu.length >= 3) return cu;
  let p = []; for (const k of set.packs) if (PACKS[k]) p = p.concat(PACKS[k][1].split(','));
  p = p.concat(cu, cu, cu); return p.length >= 3 ? p : PACKS.classic[1].split(',');
}
function pickN(set) { const p = pool(set), o = []; let n = 0; while (o.length < 3 && n++ < 400) { const w = p[rnd(p.length)]; if (!o.includes(w)) o.push(w); } return o; }
const hostWord = X => (SEC && SEC.w && subTid === X.tid ? SEC.w : '') || '';

async function hostTick() {
  const id = me(), now = net.now();
  if (S.host !== id) {
    const h = P[S.host];
    if (!S.host || !h || !h.online) {
      const c = onlineIds().sort(byT)[0];
      if (c === id) { const old = S.host || null; await net.tx(base + '/state/host', cur => (cur || null) === old ? id : undefined); }
    }
    pendingG = []; return;
  }
  const X = JSON.parse(JSON.stringify(S)); X.ban = X.ban || {};
  let ch = false; const on = onlineIds();
  if (pendingSet) { X.set = { ...X.set, ...pendingSet }; pendingSet = null; ch = true; }
  const ban = t => {
    if (X.ban[t]) return; X.ban[t] = true; X.order = X.order.filter(x => x !== t); ch = true;
    net.remove(base + '/kick/' + t); sys('k', t);
    if (X.dr === t && (X.ph === 'choose' || X.ph === 'draw')) toReveal(X, now);
  };
  while (pendingKick.length) { const t = pendingKick.shift(); if (t !== id) ban(t); }
  for (const t in KICK) {
    const voters = Object.keys(KICK[t] || {}).filter(v => v !== t && on.includes(v));
    if (voters.length >= Math.max(2, Math.floor((on.length - 1) / 2) + 1)) ban(t);
  }
  if (X.ph === 'lobby' && pendingStart) {
    pendingStart = false; X.sc = {}; on.forEach(p => X.sc[p] = 0); X.order = on.slice().sort(() => Math.random() - .5);
    X.drawn = []; X.round = 1; await nextTurn(X, now); ch = true;
  }
  if (X.ph !== 'lobby') {
    for (const p of on) { if (!X.order.includes(p)) { X.order.push(p); ch = true; } if (X.sc[p] == null) { X.sc[p] = 0; ch = true; } }
    for (const p of [...X.order]) { const pl = P[p]; if (!pl || !pl.online) { if (now - (+(pl && pl.seen) || 0) > GRACE) { X.order = X.order.filter(x => x !== p); ch = true; sys('l', p); } } }
  }
  while (pendingG.length) {
    const [u, h, t] = pendingG.shift();
    if (t !== X.tid || X.ph !== 'draw' || u === X.dr || X.g[u] || h !== X.h || !X.order.includes(u)) continue;
    const first = !Object.keys(X.g).length, frac = Math.max(0, (X.endAt - now) / (X.set.time * 1000));
    const pts = Math.round(50 + 450 * frac) + (first ? 50 : 0), dp = Math.round(pts / 4);
    X.g[u] = true; X.gp[u] = pts; X.sc[u] = (X.sc[u] || 0) + pts; X.gp[X.dr] = (X.gp[X.dr] || 0) + dp; X.sc[X.dr] = (X.sc[X.dr] || 0) + dp;
    ch = true; sys('g', u);
  }
  if (X.ph === 'choose') {
    if (!X.order.includes(X.dr)) { toReveal(X, now); ch = true; }
    else if (pendingPick && pendingPick[1] === X.tid) { await startDraw(X, pendingPick[0], now); pendingPick = null; ch = true; }
    else if (now > X.endAt) { await startDraw(X, rnd(3), now); ch = true; }
  } else if (X.ph === 'draw') {
    const w = hostWord(X);
    if (!X.order.includes(X.dr)) { toReveal(X, now); ch = true; }
    else {
      if (w) {
        const gs = graph(w), L = gs.map((g, i) => isLetter(g) ? i : -1).filter(i => i >= 0);
        const max = Math.min(X.set.hints, Math.max(0, L.length - 1)), frac = 1 - (X.endAt - now) / (X.set.time * 1000);
        const tgt = [...Array(max).keys()].map(i => .3 + .55 * (i + 1) / (max + 1)).filter(f => frac >= f).length;
        if (X.rev.length < tgt) { const c = L.filter(i => !X.rev.includes(i)); if (c.length) { X.rev.push(c[rnd(c.length)]); X.hint = mask(w, X.rev); ch = true; } }
      }
      const gs = on.filter(p => p !== X.dr && X.order.includes(p));
      if (now > X.endAt || (gs.length && gs.every(p => X.g[p]))) { toReveal(X, now); ch = true; }
    }
  } else if (X.ph === 'reveal' && now > X.endAt) { await nextTurn(X, now); ch = true; }
  else if (X.ph === 'over' && now > X.endAt) { X.ph = 'lobby'; X.order = []; X.drawn = []; X.dr = null; X.round = 0; ch = true; }
  if (ch) await net.set(base + '/state', X);
}
function toReveal(X, now) { X.ph = 'reveal'; X.endAt = now + 7000; X.word = hostWord(X); }
async function startDraw(X, i, now) {
  const chs = arr(SEC.ch).length ? arr(SEC.ch) : (await net.get(`${base}/secret/${X.tid}/ch`) || []);
  const list = arr(chs), w = list[Math.max(0, Math.min(list.length - 1, i | 0))] || pickN(X.set)[0];
  await net.update(`${base}/secret/${X.tid}`, { w }); SEC = { ...SEC, w };
  X.ph = 'draw'; X.endAt = now + X.set.time * 1000; X.h = await guessHash(w, X.tid); X.rev = []; X.hint = mask(w, []); X.word = '';
}
async function nextTurn(X, now) {
  const on = onlineIds(), old = X.tid;
  let c = X.order.find(p => on.includes(p) && !X.drawn.includes(p));
  if (!c) {
    X.round++; X.drawn = [];
    if (X.round > X.set.rounds) { X.ph = 'over'; X.dr = null; X.endAt = now + 10000; return; }
    c = X.order.find(p => on.includes(p));
  }
  if (!c) { X.ph = 'lobby'; X.dr = null; return; }
  X.drawn.push(c); X.tid = old + 1; X.dr = c;
  await net.set(`${base}/secret/${X.tid}`, { ch: pickN(X.set) });
  for (const k of ['draw', 'secret', 'guesses', 'pick', 'rate']) net.remove(`${base}/${k}/${old}`).catch(() => {});
  X.ph = 'choose'; X.endAt = now + 15000; X.g = {}; X.gp = {}; X.rev = []; X.hint = []; X.h = ''; X.word = '';
}

/* ---------- drawing ---------- */
const cv = $('#cv'), cx = cv.getContext('2d', { willReadFrequently: true });
const clearCv = () => { cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); }; clearCv();
function seg(st, from) {
  if (st.f) return fill(st.p[0], st.p[1], st.c);
  const p = st.p; cx.strokeStyle = cx.fillStyle = st.c; cx.lineWidth = st.w; cx.lineCap = 'round'; cx.lineJoin = 'round';
  if (p.length < 4) { cx.beginPath(); cx.arc(p[0], p[1], st.w / 2, 0, 7); cx.fill(); return; }
  const s = Math.max(0, from - 2); cx.beginPath(); cx.moveTo(p[s], p[s + 1]); for (let i = s + 2; i < p.length; i += 2) cx.lineTo(p[i], p[i + 1]); cx.stroke();
}
const redraw = () => { clearCv(); strokes.forEach(s => seg(s, 0)); };
function fill(x, y, hex) {
  x = x | 0; y = y | 0; if (x < 0 || y < 0 || x >= W || y >= H) return;
  const im = cx.getImageData(0, 0, W, H), d = im.data, k0 = (y * W + x) * 4, tr = d[k0], tg = d[k0 + 1], tb = d[k0 + 2];
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
  if (Math.abs(tr - r) + Math.abs(tg - g) + Math.abs(tb - b) < 12) return;
  const seen = new Uint8Array(W * H), st = [y * W + x]; seen[y * W + x] = 1;
  const tryP = q => { if (seen[q]) return; const k = q * 4; if (Math.abs(d[k] - tr) + Math.abs(d[k + 1] - tg) + Math.abs(d[k + 2] - tb) < 110) { seen[q] = 1; st.push(q); } };
  while (st.length) { const j = st.pop(), k = j * 4, px = j % W; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; if (px > 0) tryP(j - 1); if (px < W - 1) tryP(j + 1); if (j >= W) tryP(j - W); if (j < W * (H - 1)) tryP(j + W); }
  cx.putImageData(im, 0, 0);
}
const canDraw = () => !!S && S.ph === 'draw' && S.dr === me();
function out(d) { const path = `${base}/draw/${S.tid}`, k = net.newKey(path); myKeys.add(k); net.set(path + '/' + k, { ...d, by: me() }).catch(() => {}); }
const pos = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * W), Math.round((e.clientY - r.top) / r.height * H)]; };
cv.addEventListener('pointerdown', e => {
  if (!canDraw()) return; e.preventDefault(); const [x, y] = pos(e);
  if (tool === 'fill') { const st = { id: rid(), f: 1, c: color, p: [x, y] }; strokes.push(st); seg(st, 0); out({ s: st.id, f: 1, c: color, p: [x, y] }); return; }
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  cur = { id: rid(), c: tool === 'erase' ? '#ffffff' : color, w: tool === 'erase' ? Math.max(size, 20) : size, p: [x, y] }; sent = 0; strokes.push(cur); seg(cur, 0);
});
cv.addEventListener('pointermove', e => { if (!cur) return; const [x, y] = pos(e), p = cur.p; if (Math.abs(p[p.length - 2] - x) + Math.abs(p[p.length - 1] - y) < 2) return; const f = p.length; p.push(x, y); seg(cur, f); });
const up = () => { if (cur) { flush(); cur = null; } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
function flush() { if (!cur || cur.p.length === sent || !canDraw()) return; out({ s: cur.id, c: cur.c, w: cur.w, p: cur.p.slice(Math.max(0, sent - 2)) }); sent = cur.p.length; }
setInterval(flush, 70);
function applyChunk(d) {
  if (!d || !S || d.by !== S.dr) return;
  if (d.x) { strokes = []; redraw(); return; }
  if (d.u) { strokes = strokes.filter(s => s.id !== d.u); redraw(); return; }
  const p = arr(d.p).slice(0, 4000).map(v => +v || 0), c = okCol(d.c);
  if (!p.length) return;
  if (d.f) { const st = { id: d.s, f: 1, c, p }; strokes.push(st); seg(st, 0); return; }
  let st = strokes.find(s => s.id === d.s);
  if (!st) { st = { id: d.s, c, w: Math.min(60, Math.max(1, +d.w || 4)), p }; strokes.push(st); seg(st, 0); }
  else { const f = st.p.length; st.p.push(...p.slice(2)); seg(st, f); }
}
$('#pal').innerHTML = COLORS.map(c => `<button data-c="${c}" style="background:${c}" aria-label="Colour ${c}" aria-pressed="${c === color}"></button>`).join('');
$('#sizes').innerHTML = SIZES.map(s => `<button data-s="${s}" aria-label="Brush size ${s}" aria-pressed="${s === size}"><span class="dot" style="width:${Math.min(22, s / 1.5 + 4)}px;height:${Math.min(22, s / 1.5 + 4)}px"></span></button>`).join('');
$('#tools').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.c) { color = b.dataset.c; if (tool === 'erase') tool = 'brush'; }
  if (b.dataset.s) size = +b.dataset.s;
  if (b.dataset.t) tool = b.dataset.t;
  if (b.id === 'undo' && canDraw()) { const s = strokes.pop(); if (s) { redraw(); out({ u: s.id }); } }
  if (b.id === 'clr' && canDraw()) { strokes = []; redraw(); out({ x: 1 }); }
  document.querySelectorAll('#pal button').forEach(x => x.setAttribute('aria-pressed', x.dataset.c === color && tool !== 'erase'));
  document.querySelectorAll('#sizes button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.s === size));
  document.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', x.dataset.t === tool));
});

/* ---------- chat ---------- */
function addMsg(t, cls, pid) {
  const p = document.createElement('p'); if (cls) p.className = cls;
  if (pid) { const b = document.createElement('b'); b.textContent = nameOf(pid) + ':'; p.append(b); }
  p.append(document.createTextNode(t));
  const l = $('#log'), stick = l.scrollTop + l.clientHeight >= l.scrollHeight - 30;
  l.append(p); while (l.children.length > 150) l.firstChild.remove(); if (stick) l.scrollTop = l.scrollHeight;
}
function onChat(m) {
  if (!m || !S || typeof m.u !== 'string') return;
  const fresh = (+m.at || 0) >= joinedAt - 3000;
  if (m.sys) {
    if (m.sys === 'g') { addMsg(nameOf(m.p) + ' guessed the word!', 'good'); if (fresh) sfx(m.p === me() ? 'ok' : 'pop'); }
    else if (m.sys === 'l') addMsg(nameOf(m.p) + ' was away too long and left the game', 'bad');
    else if (m.sys === 'k') addMsg(nameOf(m.p) + ' was removed from the room', 'bad');
    else if (m.sys === 'close') {
      const who = m.p || m.to;
      if (who === me()) { addMsg('“' + String(m.txt || '').slice(0, 120) + '” is very close!', 'close'); if (fresh) sfx('close'); }
      else addMsg(nameOf(who) + ' is very close!', 'close-all');
    }
    return;
  }
  const t = String(m.txt || '').slice(0, 120); if (!t) return;
  if (m.priv) { if (m.u === me() || me() === S.dr || S.g[me()]) addMsg(t, 'priv', m.u); }
  else addMsg(t, '', m.u);
  if (fresh && !m.priv && S.host === me() && S.ph === 'draw' && m.u !== S.dr && !S.g[m.u]) {
    const w = hostWord(S);
    if (w) { const a = normG(t), b = normG(w), d = lev(a, b), lim = [...b].length >= 5 ? 2 : 1; if (d > 0 && d <= lim) sys('close', m.u, { to: m.u, txt: t }); }
  }
}
$('#cf').addEventListener('submit', async e => {
  e.preventDefault(); const i = $('#msg'), t = i.value.trim().slice(0, 120); if (!t || !S) return; i.value = '';
  const id = me();
  if (S.ph === 'draw' && id !== S.dr && !S.g[id] && S.h) {
    const tid = S.tid, h = await guessHash(t, tid);
    if (h === S.h) { net.set(`${base}/guesses/${tid}/${id}`, h).catch(() => {}); return; }
  }
  net.push(base + '/chat', { u: id, txt: t, priv: S.ph === 'draw' && (id === S.dr || !!S.g[id]), at: net.ts() });
});

/* ---------- render ---------- */
const left = () => Math.max(0, Math.ceil(((+S.endAt || 0) - net.now()) / 1000));
function clockTick() {
  const timed = ['choose', 'draw', 'reveal', 'over'].includes(S.ph), s = timed ? left() : -1;
  $('#secs').textContent = timed ? s : '–';
  $('#clock').classList.toggle('hurry', S.ph === 'draw' && s <= 10);
  if (S.ph === 'draw' && s <= 10 && s > 0 && s !== lastSecs) sfx('tick');
  lastSecs = s;
  document.querySelectorAll('[data-aw]').forEach(el => { const p = P[el.dataset.aw]; el.textContent = p && !p.online && S.ph !== 'lobby' ? 'away · ' + Math.max(0, Math.ceil((GRACE - (net.now() - (+p.seen || 0))) / 1000)) + 's' : ''; });
}
function wordHtml() {
  const id = me(), w = S.ph === 'reveal' ? S.word : (SEC.w || '');
  const plain = (lab, t) => `<div class="lab">${lab}</div><div class="ltr plain">${t}</div>`;
  if (S.ph === 'lobby') return plain('Lobby', 'Room <span class="code">' + esc(code) + '</span>');
  if (S.ph === 'over') return plain('Game over', 'Final scores');
  if (S.ph === 'choose') return plain('Get ready', S.dr === id ? 'Pick a word' : 'Choosing a word…');
  if (S.ph === 'reveal' && !w) return plain('Turn ended', 'Turn skipped');
  const full = S.ph === 'reveal' || (w && (S.dr === id || S.g[id]));
  const gs = full ? graph(w) : S.hint;
  const lab = S.ph === 'reveal' ? 'The word was' : S.dr === id ? 'Draw this' : S.g[id] ? 'You got it' : 'Guess this';
  const lens = gs.join('').split(' ').map(x => graph(x).length).join(' ');
  return `<div class="lab">${lab}</div><div class="ltr">${gs.map(g => g === ' ' ? '&nbsp;' : esc(g)).join('')}<span class="cnt">${lens}</span></div>`;
}
function plist() {
  const on = onlineIds(), id = me(), host = S.host === id;
  const ids = S.ph === 'lobby' ? on : [...new Set([...S.order, ...on])].filter(p => P[p] && !S.ban[p]);
  const rows = ids.map(p => ({ p, s: S.sc[p] || 0 })).sort((a, b) => b.s - a.s);
  const need = Math.max(2, Math.floor((on.length - 1) / 2) + 1);
  $('#plist').innerHTML = rows.map((r, i) => {
    const away = !on.includes(r.p), got = S.ph === 'draw' && S.g[r.p], votes = Object.keys(KICK[r.p] || {}).length, mine = KICK[r.p] && KICK[r.p][id];
    const kb = r.p === id ? '' : host ? `<button class="kick" data-kick="${r.p}" aria-label="Remove ${esc(nameOf(r.p))}">Kick</button>`
      : `<button class="kick" data-vote="${r.p}" aria-pressed="${!!mine}" aria-label="Vote to remove ${esc(nameOf(r.p))}">Vote kick${votes ? ' ' + votes + '/' + need : ''}</button>`;
    return `<li class="${got ? 'got' : ''} ${away ? 'away' : ''}"><span class="rk">#${i + 1}</span>${av(colOf(r.p))}<span><span class="nm">${esc(nameOf(r.p))}${r.p === id ? ' (you)' : ''}</span><br><span class="sub">${S.ph === 'lobby' ? (S.host === r.p ? 'host' : 'ready') : r.s + ' pts'}</span> <span class="sub" data-aw="${r.p}"></span>${kb}</span>${S.dr === r.p && S.ph !== 'lobby' ? PEN : ''}</li>`;
  }).join('');
}
$('#plist').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !S) return;
  if (b.dataset.kick && S.host === me()) { pendingKick.push(b.dataset.kick); b.disabled = true; }
  if (b.dataset.vote) { const t = b.dataset.vote, mine = KICK[t] && KICK[t][me()]; net.set(`${base}/kick/${t}/${me()}`, mine ? null : true); }
});
const shareLink = () => net.demo ? location.origin + location.pathname + '?r=' + code : location.origin + '/r/' + code;
function rateRow() {
  const vals = Object.values(RATE), up = vals.filter(v => v > 0).length, dn = vals.filter(v => v < 0).length, mine = RATE[me()];
  const can = S.dr !== me();
  return `<div class="rate">${can ? `<button data-rate="1" aria-pressed="${mine === 1}" aria-label="Like the drawing">${THUMB(1)}<span>${up}</span></button><button data-rate="-1" aria-pressed="${mine === -1}" aria-label="Dislike the drawing">${THUMB(0)}<span>${dn}</span></button>` : `<span class="muted">Your drawing: ${up} likes, ${dn} dislikes</span>`}</div>`;
}
function overlay() {
  const ov = $('#ov'), id = me(), host = S.host === id, isDr = S.dr === id;
  const key = [S.ph, S.tid, isDr, host, S.ph === 'choose' ? arr(SEC.ch).join() : '', S.ph === 'reveal' ? JSON.stringify(RATE) + S.word : '', S.ph === 'over' ? JSON.stringify(S.sc) : ''].join('|');
  if (S.ph === 'draw') { ov.className = ''; ovKey = key; return; }
  if (key !== ovKey) {
    ovKey = key; let h = '';
    if (S.ph === 'lobby') {
      const dis = host ? '' : 'disabled', sel = (id2, opts, fmt) => `<select id="${id2}" ${dis}>${opts.map(n => `<option value="${n}">${fmt ? fmt(n) : n}</option>`).join('')}</select>`;
      const pk = Object.entries(PACKS).map(([k, v]) => `<button class="chip" data-pk="${k}" aria-pressed="${S.set.packs.includes(k)}" ${dis}>${esc(v[0])}</button>`).join('');
      const link = shareLink(), wa = 'https://wa.me/?text=' + encodeURIComponent('Come play Scribe-It with me! ' + link);
      h = `<div class="card pop"><h2>Room <span class="code">${esc(code)}</span></h2>
        <div class="share"><input id="lnk" readonly value="${esc(link)}" aria-label="Room link"><button class="ghost" id="cp">Copy link</button><a class="wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>${navigator.share ? '<button class="ghost" id="nsh">Share</button>' : ''}</div>
        <div class="set">
          <label>Rounds${sel('sR', [2, 3, 4, 5, 6, 8])}</label>
          <label>Draw time${sel('sT', [40, 60, 80, 100, 120, 150], n => n + ' seconds')}</label>
          <label>Hint letters${sel('sH', [0, 1, 2, 3, 4, 5])}</label>
          <label>Max players${sel('sM', [4, 6, 8, 10, 12, 16, 20])}</label>
        </div>
        <b class="small">Word packs</b><div class="packs">${pk}</div>
        <label class="lbl">Your own words, comma separated<textarea id="sW" rows="2" maxlength="600" ${dis} placeholder="e.g. office chai, goa trip, uncle's scooter"></textarea></label>
        <label class="chk"><input type="checkbox" id="sO" ${dis}> Only use our own words (needs 3 or more)</label>
        ${host ? '<button class="big" id="go">Start game</button>' : '<p class="muted" id="wt"></p>'}</div>`;
    } else if (S.ph === 'choose') {
      h = isDr ? `<div class="card pop"><h2>Choose a word</h2><div class="choices">${arr(SEC.ch).map((c, i) => `<button data-i="${i}">${esc(c)}</button>`).join('') || '<p class="muted">Loading words…</p>'}</div></div>`
        : `<div class="card pop">${av(colOf(S.dr), 1)}<h2>${esc(nameOf(S.dr))} is choosing a word…</h2></div>`;
    } else if (S.ph === 'reveal') {
      const rs = Object.entries(S.gp).sort((a, b) => b[1] - a[1]);
      h = `<div class="card pop"><h2>${S.word ? 'The word was <span class="code">' + esc(S.word) + '</span>' : 'Turn skipped'}</h2>${rs.length ? '<ul class="res">' + rs.map(([p, v]) => `<li><span>${esc(nameOf(p))}</span><span class="plus">+${v}</span></li>`).join('') + '</ul>' : '<p class="muted">Nobody guessed it this time.</p>'}${S.word ? rateRow() : ''}</div>`;
    } else if (S.ph === 'over') {
      const t = Object.entries(S.sc).filter(([p]) => P[p]).sort((a, b) => b[1] - a[1]).slice(0, 3), ord = [t[1], t[0], t[2]], hs = [70, 110, 50];
      h = `<div class="card pop"><h2>${t[0] ? esc(nameOf(t[0][0])) + ' wins!' : 'Game over'}</h2><div class="podium">${ord.map((x, i) => x ? `<div>${av(colOf(x[0]))}<span>${esc(nameOf(x[0]))}</span><span class="muted">${x[1]} pts</span><span class="bar" style="height:${hs[i]}px">${[2, 1, 3][i]}</span></div>` : '<div></div>').join('')}</div><p class="muted">Back to the lobby in a few seconds.</p></div>`;
    }
    ov.innerHTML = h; ov.className = 'show';
  }
  if (S.ph === 'lobby') {
    const f = document.activeElement, put = (i, v) => { const el = $(i); if (el && f !== el) el.value = v; };
    put('#sR', S.set.rounds); put('#sT', S.set.time); put('#sH', S.set.hints); put('#sM', S.set.max); put('#sW', S.set.custom || '');
    const o = $('#sO'); if (o) o.checked = !!S.set.only;
    document.querySelectorAll('[data-pk]').forEach(b => b.setAttribute('aria-pressed', S.set.packs.includes(b.dataset.pk)));
    const wt = $('#wt'); if (wt) wt.textContent = 'Waiting for ' + nameOf(S.host) + ' to start the game…';
  }
}
$('#ov').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !S) return;
  if (b.id === 'cp') navigator.clipboard.writeText(shareLink()).then(() => { b.textContent = 'Copied!'; }, () => { $('#lnk').select(); });
  if (b.id === 'nsh') navigator.share({ title: 'Scribe-It', text: 'Come play Scribe-It with me!', url: shareLink() }).catch(() => {});
  if (b.id === 'go' && S.host === me()) { pendingStart = true; b.disabled = true; b.textContent = 'Starting…'; }
  if (b.dataset.pk && S.host === me()) { const k = b.dataset.pk, p = S.set.packs; pendingSet = { ...(pendingSet || {}), packs: p.includes(k) ? (p.length > 1 ? p.filter(x => x !== k) : p) : [...p, k] }; }
  if (b.dataset.i != null && S.ph === 'choose' && S.dr === me()) { net.set(`${base}/pick/${S.tid}`, +b.dataset.i); b.parentNode.querySelectorAll('button').forEach(x => x.disabled = true); }
  if (b.dataset.rate) rate(+b.dataset.rate);
});
$('#ov').addEventListener('change', e => {
  if (!S || S.host !== me()) return;
  const m = { sR: 'rounds', sT: 'time', sH: 'hints', sM: 'max' }, id = e.target.id;
  if (m[id]) pendingSet = { ...(pendingSet || {}), [m[id]]: +e.target.value };
  if (id === 'sW') pendingSet = { ...(pendingSet || {}), custom: e.target.value.slice(0, 600) };
  if (id === 'sO') pendingSet = { ...(pendingSet || {}), only: e.target.checked };
});
function rate(v) { const id = me(); if (S.dr === id) return; net.set(`${base}/rate/${S.tid}/${id}`, RATE[id] === v ? null : v); }
$('#hintbar').addEventListener('click', e => { const b = e.target.closest('[data-rate]'); if (b) rate(+b.dataset.rate); });

function render() {
  if (!S || !base) return;
  const id = me(), d = canDraw();
  $('#word').innerHTML = wordHtml();
  $('#rnd').textContent = S.ph === 'lobby' || S.ph === 'over' ? onlineIds().length + ' in room' : 'Round ' + Math.min(S.round, S.set.rounds) + ' of ' + S.set.rounds;
  $('#wrap').classList.toggle('tall', S.ph === 'lobby');
  plist(); overlay(); clockTick();
  $('#tools').hidden = !d; cv.classList.toggle('on', d);
  const hb = $('#hintbar'); hb.hidden = d;
  if (S.ph === 'draw') hb.innerHTML = `<span>${S.g[id] ? 'Nice! Chat with the others who got it.' : esc(nameOf(S.dr)) + ' is drawing. Type your guesses in the chat.'}</span>${rateRow()}`;
  else hb.textContent = S.ph === 'lobby' ? 'Waiting in the lobby. Invite at least one friend to play.' : S.ph === 'choose' ? 'A new turn is starting…' : '';
  $('#msg').placeholder = d || S.g[id] ? 'Chat with players who guessed…' : 'Type your guess here…';
}
