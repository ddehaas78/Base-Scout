// ---------- Find seeds: try many random seeds, keep those whose rings are filled ----------
// Same rings, Dimension, Start from and Base on land as "This seed", but the point is fixed (spawn, 0, 0 or
// custom) and the seed changes. The search runs in a few extra workers (one per spare CPU core).
let findMode = 'seed';   // 'seed' = search one seed for spots, 'seeds' = search many seeds
const SF_MAX = 200;
const sf = { running: false, found: [], starred: [], tested: 0, base: 0, ms: 0, msBase: 0, t0: 0, perWorker: [], job: null, token: 0 };
const modeState = { seed: { job: null, sel: null }, seeds: { job: null, sel: null } };
let seedPool = null, wasmCopy = null;   // wasmCopy: the unzipped generator, kept to start the extra workers
const maxCores = () => Math.max(1, navigator.hardwareConcurrency || 2);
let coresWanted = 4;
try { const c = +localStorage.getItem('basescout.cores'); if (c >= 1) coresWanted = c; } catch {}
const poolSize = () => Math.max(1, Math.min(coresWanted, maxCores()));
$('cores').innerHTML = Array.from({ length: maxCores() }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
$('cores').value = String(poolSize());
$('cores').onchange = () => {   // a new pool of that size next time a search starts
  coresWanted = +$('cores').value; try { localStorage.setItem('basescout.cores', coresWanted); } catch {}
  const was = sf.running;
  if (was) stopSeeds();
  if (seedPool) { seedPool.forEach(e => e.w.terminate()); seedPool = null; }
  if (was) startSeeds(true); else status();
};
let seedsSub = 'fixed';   // Find seeds: 'fixed' (Fixed spots / Crack) or 'rings' (things in rings around a point)
function setSeedsSub(v) {
  if (sf.running && v !== seedsSub) stopSeeds();
  seedsSub = v;
  document.querySelectorAll('#ssubseg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.ssub === v));
  $('paneFind').classList.toggle('ringsub', v === 'rings');
  renderTarget(); renderPalette(); renderFixed(); setRunning(false);
  if (findMode === 'seeds' && !sf.job) $('stext').textContent = seedsHint();
}
const seedsHint = () => seedsSub === 'rings' ? 'Find seeds: drag what you want into the rings, then press Search.' : 'Find seeds: drag structures into Fixed spots, say where they are, then press Search.';
document.querySelectorAll('#ssubseg button').forEach(b => b.onclick = () => setSeedsSub(b.dataset.ssub));
function getPool() {
  if (seedPool) return seedPool;
  const url = URL.createObjectURL(new Blob([$('wsrc').textContent], { type: 'text/javascript' }));
  seedPool = Array.from({ length: poolSize() }, (_, i) => {
    const entry = { w: new Worker(url), ready: false, queue: null };
    entry.w.onmessage = ev => onSeedMsg(i, ev.data, entry);
    const buf = wasmCopy.slice(0); entry.w.postMessage({ type: 'init', wasm: buf }, [buf]);
    return entry;
  });
  return seedPool;
}
function onSeedMsg(i, m, entry) {
  if (m.type === 'ready') { entry.ready = true; if (entry.queue) { entry.w.postMessage(entry.queue); entry.queue = null; } return; }
  if (m.type === 'error') { toast('Seed search hit a problem: ' + m.message); return; }
  if (m.token !== sf.token) return;   // from an earlier search
  if (m.type === 'crackprog' || m.type === 'crack2done' || m.type === 'crackdone') { onCrackMsg(i, m); return; }
  if (m.type === 'seedprog') {
    sf.perWorker[i] = m.tested; sf.tested = sf.base + sf.perWorker.reduce((a, b) => a + (b || 0), 0);
    if (sf.running) sf.ms = sf.msBase + (Date.now() - sf.t0);
    if (findMode === 'seeds') status();
    return;
  }
  if (m.type === 'seedfound') {
    if (sf.found.length >= SF_MAX || sf.found.some(f => f.seed === m.seed)) return;
    sf.found.push({ seed: m.seed, ...m.spot });
    if (sf.found.length >= SF_MAX && !(sf.job && sf.job.mode === 'crack')) stopSeeds();
    if (findMode === 'seeds') {
      if (!renderT) renderT = setTimeout(() => { renderT = null; if (!overResults) renderResults(); else pendingRender = true; if (!sel && sf.found[0] && findMode === 'seeds') select(sf.found[0]); }, 250);
      status();
    }
  }
}
function startSeeds(more) {
  if (!wasmCopy) { toast('The search engine is still loading.'); return; }
  const rings = seedsSub === 'rings';
  let usable = [], pins = [], missing = [];
  if (rings) {   // things in rings around spawn, 0, 0 or a point
    if (!placed.length) { toast('Drag at least one thing into a ring.'); return; }
    usable = placed.filter(p => inVer(p.key)); missing = [...new Set(placed.filter(p => !inVer(p.key)).map(p => meta(p).name))];
    if (!usable.length) { toast(`None of these exist in ${VER}. Pick a newer version.`); return; }
  } else {       // fixed spots
    if (!fixed().length) { toast('Drag at least one structure into Fixed spots.'); return; }
    if (fixedMissingXZ()) { toast('Type the X and Z of every fixed spot first.'); return; }
    pins = usablePins();
    missing = [...new Set(fixed().filter(p => !inVer(p.key) || (fbiomes(p).length && !fbiomes(p).some(k => inVer(k)))).map(p => meta({ kind: 'structure', key: p.key }).name))];
    if (!pins.length) { toast(`None of these exist in ${VER}. Pick a newer version.`); return; }
  }
  if (missing.length && !more) toast(`Left out, not in ${VER}: ${missing.join(', ')}`);
  if (!more) { sf.found = []; sf.tested = 0; sf.ms = 0; sel = null; findMap.reset(); findMap.draw(); shown = { exact: 12, close: 6 }; }
  sf.job = { mode: 'seeds', ver: curVer(), verLabel: VER, items: usable.map(p => ({ ...p })), radii: RADII.slice(), dim: findDim,
    start: $('start').value, custom: { x: +$('cx').value || 0, z: +$('cz').value || 0 }, landOnly: findDim === 0 && $('land').checked, pins };
  job = sf.job;
  sf.base = sf.tested; sf.msBase = sf.ms; sf.perWorker = []; sf.t0 = Date.now(); sf.token++; sf.running = true;
  const msg = { type: 'seeds', ...sf.job, token: sf.token };
  for (const e of getPool()) { if (e.ready) e.w.postMessage(msg); else e.queue = msg; }
  setRunning(true); status(); renderResults();
}
function stopSeeds() {
  if (seedPool) for (const e of seedPool) { e.queue = null; e.w.postMessage({ type: 'seedstop' }); }
  if (crack && crack.running) crack.running = false;
  if (sf.running) sf.ms = sf.msBase + (Date.now() - sf.t0);
  sf.running = false; setRunning(false); status(); renderResults();
}
// the same rings and settings as when the seeds were found: "Search more" carries on
const usablePins = () => fixed().filter(f => inVer(f.key) && (isBioSpot(f) || !fbiomes(f).length || fbiomes(f).some(k => inVer(k))))
  .map(f => {
    if (isBioSpot(f)) return { kind: 'biome', key: f.key, x: f.x, z: f.z, r: 0 };
    const b = fbiomes(f).filter(k => inVer(k)); return { key: f.key, x: f.x, z: f.z, r: f.r, ...(b.length ? { biomes: b } : {}) };
  });
const sameSeedJob = () => sf.job && sf.job.mode === 'seeds' && sf.found.length && sf.found.length < SF_MAX
  && (seedsSub === 'rings'
    ? !(sf.job.pins || []).length && JSON.stringify(sf.job.items) === JSON.stringify(placed.filter(p => inVer(p.key)))
      && sf.job.radii.join() === RADII.join() && sf.job.start === $('start').value && sf.job.landOnly === (findDim === 0 && $('land').checked)
    : JSON.stringify(sf.job.pins || []) === JSON.stringify(usablePins()))
  && sf.job.dim === findDim && sf.job.verLabel === VER;
function seedStatus() {
  if (sf.job && sf.job.mode === 'crack' && crack) { crackStatus(); return; }
  const st = (l, v, c) => `<div class="st${c ? ' ' + c : ''}"><span>${l}</span><b>${v}</b></div>`, j = sf.job;
  const from = !j ? '' : j.start === 'spawn' ? 'World spawn' : j.start === 'custom' ? `${fmt(j.custom.x)}, ${fmt(j.custom.z)}` : '0, 0';
  const rate = sf.ms > 500 ? Math.round(sf.tested / sf.ms * 1000) : 0;
  const n = sf.found.length, every = n ? `<small> · 1 in ${short(sf.tested / n)}</small>` : '';
  $('stext').innerHTML = st('Status', sf.running ? 'Searching' : 'Stopped') + st('Seeds tested', fmt(sf.tested))
    + st('Speed', `${fmt(rate)}<small>/s</small>`) + st('Found', n + (n >= SF_MAX ? '+' : '') + every, 'ok')
    + st('Next seed', seedEta(rate)) + st('Cores', seedPool ? seedPool.length : poolSize());
  fitStatus();
}
// About how long until the next seed: how often one has matched so far, at the current speed. It grows while
// nothing new turns up, since that means the seeds you asked for are rarer than they looked.
const short = v => v >= 1e9 ? (v / 1e9).toFixed(v < 1e10 ? 1 : 0) + ' B' : v >= 1e6 ? (v / 1e6).toFixed(v < 1e7 ? 1 : 0) + ' M' : v >= 1e4 ? Math.round(v / 1e3) + ' k' : fmt(v);
function seedEta(rate) {
  const n = sf.found.length;
  if (n >= SF_MAX) return 'Done';
  if (!sf.running) return '–';
  if (!n) return sf.tested >= 300 ? 'rare<small> none yet</small>' : '<small>measuring…</small>';
  if (!rate) return '–';
  const t = sf.tested / n / rate;
  const dur = t < 60 ? `${Math.max(1, Math.round(t))} s` : t < 3600 ? `${Math.round(t / 60)} min` : t < 86400 * 2 ? `${Math.floor(t / 3600)} h ${Math.round(t % 3600 / 60)} min` : `${Math.round(t / 86400)} days`;
  return `~${dur}`;
}
function renderSeedResults() {
  const card = (s, n) => {
    const hits = s.hits.slice().sort((a, b) => (b.pin || 0) - (a.pin || 0) || a.r - b.r).map(h => {
      const m = meta(h), zi = Math.max(0, (sf.job ? sf.job.radii : RADII).indexOf(h.r));
      if (h.pin) return `<li><i class="fxdot"></i><span>${m.name} <small style="color:var(--muted);font-weight:400">${h.biome != null && names ? escH(names[h.biome] || '') : 'fixed'}</small></span><span class="d">${h.x}, ${h.z}</span></li>`;
      const nm = h.kind === 'biome' && h.size ? `${m.name} <small style="color:var(--muted);font-weight:400">${h.size}+ wide</small>` : m.name;
      return `<li><i style="background:var(${ZCOL[zi]})"></i><span>${nm}</span><span class="d">${fmt(h.d)} ${dir(h.x - s.x, h.z - s.z)}</span></li>`;
    }).join('');
    const starred = sf.starred.some(q => q.seed === s.seed), j = sf.job;
    const at = s.pinsOnly ? 'near' : j && j.start === 'spawn' ? 'spawn' : 'at';
    const el = document.createElement('div');
    el.className = 'spot' + (sel && sel.seed === s.seed ? ' sel' : ''); el.tabIndex = 0;
    el.innerHTML = `<div class="row1"><div class="rank">${n + 1}</div><div style="min-width:0;flex:1"><div class="coords">${s.seed}</div>
      <div class="sub">${at} ${s.x}, ${s.z} · ${names ? escH(names[s.biome] || '') : ''}</div></div>
      <div class="sfb"><button type="button" data-a="copy" title="Copy the seed">Copy</button><button type="button" data-a="star" class="${starred ? 'on' : ''}" title="${starred ? 'Unstar' : 'Star'}">${starred ? '★' : '☆'}</button><button type="button" data-a="use" title="Make it your seed (top of the page)">Use</button></div></div>
      <ul class="hits">${hits}</ul>`;
    el.onclick = ev => {
      const a = ev.target.closest('[data-a]');
      if (!a) { select(s); return; }
      if (a.dataset.a === 'copy') copy(s.seed);
      if (a.dataset.a === 'star') { const i = sf.starred.findIndex(q => q.seed === s.seed); if (i >= 0) sf.starred.splice(i, 1); else sf.starred.push(s); renderResults(); status(); }
      if (a.dataset.a === 'use') {
        $('seed').value = s.seed; seedChanged();
        if (sf.job && sf.job.verLabel !== VER) setVersion(sf.job.verLabel);
        toast(`${s.seed} is now your seed. Search it in "This seed", or look at it in Seed map.`);
      }
    };
    el.onkeydown = ev => { if (ev.key === 'Enter') select(s); };
    return el;
  };
  const fill = (box, list, kind, emptyMsg) => {
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
    list.slice(0, shown[kind]).forEach((s, n) => box.appendChild(card(s, n)));
    if (list.length > shown[kind]) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = `Show ${Math.min(6, list.length - shown[kind])} more`;
      b.onclick = () => { shown[kind] += 6; renderResults(); }; box.appendChild(b);
    }
  };
  fill($('lex'), sf.found, 'exact', sf.running ? 'Trying seeds. Matching seeds show up here.' : 'Drag what you want into the rings, choose Start from, then press Search. Random seeds are tried until 200 match.');
  fill($('lcl'), sf.starred, 'close', 'Star a seed (☆) to keep it here.');
  $('nex').textContent = sf.found.length + (sf.found.length >= SF_MAX ? '+' : ''); $('ncl').textContent = sf.starred.length;
}
// switch between the two kinds of search; each keeps its own results and selection
function setFindMode(m) {
  if (m === findMode) return;
  if (running && findMode === 'seed') stopSearch();
  if (sf.running) stopSeeds();
  modeState[findMode] = { job, sel };
  findMode = m; job = modeState[m].job; sel = modeState[m].sel;
  if (m === 'seeds') job = sf.job;
  document.querySelectorAll('#fmodeseg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.fmode === m));
  $('hex').textContent = m === 'seeds' ? 'Seeds found' : 'Exact matches';
  $('hcl').textContent = m === 'seeds' ? 'Starred' : 'Close matches';
  $('paneFind').classList.toggle('seedsmode', m === 'seeds');
  renderPalette();
  renderFixed();
  setRunning(false);
  findMap.reset(); findMap.draw(); fPick = null;
  $('mempty').hidden = false; $('mempty').textContent = m === 'seeds' ? 'Pick a seed to see the area around it.' : 'Pick a result to see the area around it.';
  if (sel) select(sel);
  renderResults();
  if (m === 'seeds') { if (sf.job) status(); else $('stext').textContent = seedsHint(); }
  else if (job) status(); else $('stext').textContent = 'Enter your seed and drag what you want into the rings.';
}
document.querySelectorAll('#fmodeseg button').forEach(b => b.onclick = () => setFindMode(b.dataset.fmode));
