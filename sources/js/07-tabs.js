// ---------- tabs ----------
let curTab = 'find', ready = false;
function setTab(t) {
  curTab = t;
  $('tabFind').setAttribute('aria-selected', t === 'find'); $('tabMap').setAttribute('aria-selected', t === 'map'); $('tabLib').setAttribute('aria-selected', t === 'lib');
  $('paneFind').hidden = t !== 'find'; $('paneMap').hidden = t !== 'map'; $('paneLib').hidden = t !== 'lib';
  try { localStorage.setItem('basescout.tab', t); } catch {}
  if (t === 'lib') { renderLib(); return; }
  const M = t === 'map' ? xMap : findMap;
  M.size();
  if (t === 'map' && xRestore) { xMap.view.s = xRestore.s; xMap.centerOn(xRestore.x, xRestore.z); xRestore = null; xFirst = false; }
  if (t === 'map' && xFirst) { xMap.fitTo(0, 0, 2500); xFirst = false; }
  M.draw(); M.request(false);
}
$('tabFind').onclick = () => setTab('find');
$('tabMap').onclick = () => setTab('map');
$('tabLib').onclick = () => setTab('lib');

// ---------- seed changes ----------
let lastSeed = null, seedT;
function seedChanged() {
  const s = parseSeed($('seed').value);
  try { localStorage.setItem('basescout.seed', $('seed').value.trim()); } catch {}
  renderSaved();
  if (typeof renderDone === 'function') renderDone();   // structures done: per seed (js/06e-done.js)
  if (curTab === 'lib') renderLib();
  if (!ready || s === lastSeed) return;
  lastSeed = s; xSpawn = null; pin = null; renderPin();
  xMap.reset(); xMap.draw();
  if (s !== null) { worker.postMessage({ type: 'info', seed: s, ver: curVer() }); xMap.request(true); }
  restartSoon();
}
function fillVersions() {
  const sel = $('ver'), groups = {};
  for (const [label] of VERSIONS) { const g = label.startsWith('26.') ? '26.x' : label.split('.').slice(0, 2).join('.'); (groups[g] = groups[g] || []).push(label); }
  sel.innerHTML = Object.entries(groups).map(([g, list]) => `<optgroup label="${g}">${list.map(l => `<option${l === VER ? ' selected' : ''}>${l}</option>`).join('')}</optgroup>`).join('');
}
function setVersion(label) {
  if (vAge(label) < 0 || label === VER) { $('ver').value = VER; return; }
  VER = label; $('ver').value = VER;
  try { localStorage.setItem('basescout.ver', VER); } catch {}
  if (running) stopSearch();
  token++; job = null; exact = []; close = []; sel = null; tilesDone = 0;
  findMap.reset(); findMap.draw(); $('mempty').hidden = false; $('mempty').textContent = 'Pick a result to see the area around it.';
  renderPalette(); renderTarget(); renderToggles(); renderResults();
  lastSeed = undefined; seedChanged();
  if (curTab === 'lib') renderLib();
}
fillVersions();
$('ver').onchange = () => setVersion($('ver').value);
$('seed').addEventListener('input', () => { clearTimeout(seedT); seedT = setTimeout(seedChanged, 500); });
$('seed').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault(); clearTimeout(seedT); seedChanged();
  if (curTab === 'find' && placed.length && !running) startSearch();
});

