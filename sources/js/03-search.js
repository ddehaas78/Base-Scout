// ---------- search ----------
function parseSeed(raw) {
  const s = String(raw).trim(); if (!s) return null;
  if (/^[-+]?\d+$/.test(s)) { const v = BigInt(s); if (v >= -(1n << 63n) && v < (1n << 63n)) return v.toString(); }
  let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}
let restartT;
let holdRestart = false;   // true while the page reopens: don't start a search on its own
function restartSoon() {
  clearTimeout(restartT);
  if (holdRestart) return;
  if (findMode === 'seeds') { if (sf.running) stopSeeds(); return; }   // seed searches only start with the button
  if (!placed.length) { if (running) stopSearch(); return; }
  if (job || parseSeed($('seed').value) !== null) restartT = setTimeout(() => startSearch(), 350);
}

function startSearch(resume = false) {
  if (findMode === 'seeds') { startSeeds(resume); return; }
  const seed = parseSeed($('seed').value);
  if (seed === null) { toast('Enter your seed first. In game, type /seed.'); return; }
  if (!placed.length) { toast('Drag at least one thing into a ring.'); return; }
  const usable = placed.filter(p => inVer(p.key)), missing = [...new Set(placed.filter(p => !inVer(p.key)).map(p => meta(p).name))];
  if (!usable.length) { toast(`None of these exist in ${VER}. Pick a newer version.`); return; }
  if (missing.length && !resume) toast(`Left out, not in ${VER}: ${missing.join(', ')}`);
  if (!resume) { exact = []; close = []; shown = { exact: 6, close: 6 }; sel = null; findMap.reset(); findMap.draw(); tilesDone = 0; renderResults(); }
  job = { seed, ver: curVer(), verLabel: VER, items: usable.map(p => ({ ...p })), start: $('start').value, custom: { x: +$('cx').value || 0, z: +$('cz').value || 0 }, landOnly: findDim === 0 && $('land').checked, radii: RADII.slice(), dim: findDim };
  token++;
  worker.postMessage({ type: 'search', ...job, token, skipTiles: resume ? tilesDone : 0, maxTiles: 1500 });
  setRunning(true);
}
function stopSearch() { worker.postMessage({ type: 'stop' }); setRunning(false); status(); }
function setRunning(on) {
  running = on; $('pulse').classList.toggle('on', on);
  $('go').textContent = on ? 'Stop' : findMode === 'seeds' ? (sameSeedJob() ? 'Search more' : 'Search') : (tilesDone && job ? 'Search further' : 'Search');
  $('go').classList.toggle('stop', on);
}
let token = 0, reach = 0, spawn = null, startPos = { x: 0, z: 0 }, pausedAt = false;
function status() {
  if (findMode === 'seeds') { seedStatus(); return; }
  if (!job) return;
  const area = (reach * 2 / 1000) ** 2;
  const st = (l, v, c) => `<div class="st${c ? ' ' + c : ''}"><span>${l}</span><b>${v}</b></div>`;
  $('stext').innerHTML = st('Status', running ? 'Searching' : pausedAt ? 'Paused' : 'Stopped')
    + st('Blocks out', fmt(reach)) + st('From', `${fmt(startPos.x)}, ${fmt(startPos.z)}`)
    + st('Area', `${fmt(area)}<small>km²</small>`) + st('Exact', exact.length, 'ok') + st('Close', close.length, 'warn')
    + (spawn ? st('Spawn', `${spawn.x}, ${spawn.z}`) : '');
  fitStatus();
}
// When the settings leave too little room, the status bar gets its own line instead of breaking in two.
function fitStatus() {
  const p = $('paneFind'), sts = [...$('stext').children];
  p.classList.remove('stwide');
  if (sts.length > 1 && sts.some(e => e.offsetTop !== sts[0].offsetTop)) p.classList.add('stwide');
}
addEventListener('resize', () => { if ($('stext').children.length) fitStatus(); });

const MAX_RESULTS = 200;   // per list; Search further keeps adding until then
function merge(list, add, better) {
  for (const s of add) {
    const i = list.findIndex(o => Math.hypot(o.x - s.x, o.z - s.z) < 300);
    if (i >= 0) { if (s.pen < list[i].pen || (s.pen === list[i].pen && s.compact < list[i].compact)) list[i] = s; continue; }
    list.push(s);
  }
  list.sort(better); if (list.length > MAX_RESULTS) list.length = MAX_RESULTS;
}
// closest to where the search started (Start from), not to 0, 0
const fromStart = s => Math.hypot(s.x - startPos.x, s.z - startPos.z);
const originOrder = (a, b) => fromStart(a) - fromStart(b);
const startLabel = () => startPos.x === 0 && startPos.z === 0 ? '0, 0' : `${startPos.x}, ${startPos.z}`;

let renderT;
function onMsg(m) {
  if (m.type === 'ready') {
    colors = m.colors; names = m.names; renderPalette(); renderTarget();
    $('stext').textContent = 'Enter your seed and drag what you want into the rings.';
    const keepPin = pin;   // loading the seed clears the picked point; keep the one from before the refresh
    holdRestart = true; ready = true; seedChanged(); holdRestart = false;
    if (keepPin && !pin) { pin = keepPin; renderPin(); xMap.draw(); }
    applyRestoredResults(); return;
  }
  if (m.type === 'error') { toast('Search hit a problem: ' + m.message); setRunning(false); return; }
  if (m.type === 'area') { const M = maps[String(m.tag).split(':')[0]]; if (M) M.onArea(m); return; }
  if (m.type === 'info') { if (m.seed === parseSeed($('seed').value)) { xSpawn = m.spawn; xMap.draw(); } return; }
  if (m.token !== undefined && m.token !== token) return;   // left over from an earlier search
  if (m.type === 'begin') {
    spawn = m.spawn; startPos = m.start; pausedAt = false; status();
    document.querySelectorAll('.startnote').forEach(n => n.textContent = `Closest to ${startLabel()} first.`);
    return;
  }
  if (findMode === 'seeds' && (m.type === 'tile' || m.type === 'done' || m.type === 'begin')) return;   // a "This seed" search still finishing
  if (m.type === 'tile') {
    tilesDone = m.tiles; reach = m.reach;
    merge(exact, m.exact, originOrder);
    merge(close, m.close, originOrder);
    status();
    if (!renderT) renderT = setTimeout(() => {   // refresh at most ~4 times a second while searching
      renderT = null;
      if (!overResults) renderResults(); else pendingRender = true;
      if (!sel && exact[0] && findMode === 'seed') select(exact[0]);   // the mode may have changed meanwhile
    }, 250);
    return;
  }
  if (m.type === 'done') { pausedAt = m.reason === 'paused'; setRunning(false); status(); renderResults(); if (!sel && (exact[0] || close[0])) select(exact[0] || close[0]); }
}

// ---------- results ----------
// Hold the lists still while the pointer is over them, so buttons don't move under a click.
let overResults = false, pendingRender = false;
document.querySelector('.cols').addEventListener('pointerenter', () => { overResults = true; });
document.querySelector('.cols').addEventListener('pointerleave', () => { overResults = false; if (pendingRender) { pendingRender = false; renderResults(); } });
function renderResults() {
  if (findMode === 'seeds') { renderSeedResults(); return; }
  const card = (s, n, kind) => {
    const fromOrigin = fromStart(s);
    const hits = s.hits.slice().sort((a, b) => a.r - b.r).map(h => {
      const m = meta(h), r = h.r, zi = Math.max(0, RADII.indexOf(r)), miss = h.d == null || h.d > r;
      const val = h.d == null ? 'not found' : miss ? `${fmt(Math.ceil(h.d))} · want ≤ ${r}` : `${fmt(h.d)} ${dir(h.x - s.x, h.z - s.z)}`;
      const nm = h.kind === 'biome' && h.size ? `${m.name} <small style="color:var(--muted);font-weight:400">${h.size}+ wide</small>` : m.name;
      return `<li class="${miss ? 'miss' : ''}"><i style="background:var(${ZCOL[zi]})"></i><span>${nm}</span><span class="d">${val}</span></li>`;
    }).join('');
    const el = document.createElement('div');
    el.className = 'spot' + (sel && sel.x === s.x && sel.z === s.z ? ' sel' : ''); el.tabIndex = 0;
    el.innerHTML = `<div class="row1"><div class="rank">${n + 1}</div><div style="min-width:0"><div class="coords">X ${s.x} · Z ${s.z}</div>
      <div class="sub">${names ? names[s.biome] : ''} · ${fmt(fromOrigin)} from ${startLabel()}</div></div></div>
      <ul class="hits">${hits}</ul>`;
    el.onclick = () => select(s);
    el.onkeydown = ev => { if (ev.key === 'Enter') select(s); };
    return el;
  };
  const fill = (box, list, kind, emptyMsg) => {
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
    const lim = shown[kind];
    list.slice(0, lim).forEach((s, n) => box.appendChild(card(s, n, kind)));
    if (list.length > lim) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = `Show ${Math.min(6, list.length - lim)} more`;
      b.onclick = () => { shown[kind] += 6; renderResults(); }; box.appendChild(b);
    }
  };
  const searching = running ? 'Still searching. Matches show up here as they are found.' : !job ? 'Enter your seed, drag structures or biomes into the rings, then press Search.' : '';
  fill($('lex'), exact, 'exact', searching || 'None found yet. Search further, widen a ring by moving an item outward, or check the close matches.');
  fill($('lcl'), close, 'close', searching || 'None found yet.');
  $('nex').textContent = exact.length + (exact.length >= MAX_RESULTS ? '+' : '');
  $('ncl').textContent = close.length + (close.length >= MAX_RESULTS ? '+' : '');
}
function dir(dx, dz) {
  if (Math.hypot(dx, dz) < 24) return 'here';
  return ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][(Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) + 8) % 8];
}
function select(s) {
  sel = s; fPick = null; fHover = null; renderResults();
  findMap.reset();
  $('mempty').hidden = false; $('mempty').textContent = 'Loading map…';
  findMap.size();
  findMap.fitTo(s.x, s.z, job.radii[2] * 1.1 + 20);
  findMap.request(true);
}

