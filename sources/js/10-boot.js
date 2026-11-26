// ---------- misc ----------
function copy(text) {
  const done = () => toast(text.includes('\n') ? 'Copied the list. Paste it into seeds.txt.' : 'Copied ' + text);
  const fb = () => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch { toast(text); } t.remove(); };
  try { navigator.clipboard.writeText(text).then(done, fb); } catch { fb(); }
}
let toastT;
// a message in the corner, like the game's toasts: an icon, then the text. kind 'bad' (something can't be done) shows a barrier
function toast(msg, kind) {
  const t = $('toast'), tex = kind === 'bad' ? 'item/barrier' : 'item/writable_book';
  t.innerHTML = `<img alt="" src="${texUrl(tex)}" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${texUrl(tex, 1)}'}"><span></span>`;
  t.querySelector('span').textContent = msg;
  t.classList.toggle('bad', kind === 'bad');
  t.hidden = false; t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');   // slide in again for each message
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800);
}
$('start').onchange = () => { const c = $('start').value === 'custom'; $('cxl').hidden = !c; $('czl').hidden = !c; };
// the browser can bring back "Custom X / Z" by itself (reload, back button) without a change event
$('start').onchange();
addEventListener('pageshow', () => $('start').onchange());
$('form').onsubmit = e => {
  e.preventDefault();
  if (findMode === 'seeds') { if (sf.running) stopSeeds(); else startSeeds(sameSeedJob()); return; }
  if (running) { stopSearch(); return; }
  const sameJob = job && parseSeed($('seed').value) === job.seed && $('start').value === job.start;
  startSearch(sameJob && tilesDone > 0 && pausedAt);
};

buildIcons();
// swap in the real item textures once they arrive, then redraw everything that shows icons
loadItemTextures(() => {
  try { renderToggles(); } catch {}
  try { renderPalette(); renderTarget(); } catch {}
  try { xMap.draw(); findMap.draw(); } catch {}
});
renderPalette(); renderTarget(); renderResults(); renderToggles(); renderPin();
bootSaved();
try { const s = localStorage.getItem('basescout.seed'); if (s) $('seed').value = s; } catch {}
try { const d = +localStorage.getItem('basescout.dim'); if (d === -1 || d === 1) { xDim = d; xFirst = false; xMap.fitTo(0, 0, d === 1 ? 1500 : 2500); } } catch {}
renderDimUI(); renderToggles();
// ---------- keep everything across a refresh ----------
// rings, start point, results, the Seed map view and the picked point, saved when the page closes or reloads
const STATE_KEY = 'basescout.state.v1';
let restoredRes = null, xRestore = null, restoredSeeds = null;
function saveState() {
  try {
    placedStore[findDim] = placed;
    const [mx, mz] = xMap.center();
    localStorage.setItem(STATE_KEY, JSON.stringify({
      findDim, placedStore, fixedStore, radii: RADII, start: $('start').value, cx: $('cx').value, cz: $('cz').value,
      xview: xMap.cv.width > 4 && !xRestore ? { x: mx, z: mz, s: xMap.view.s } : xRestore,
      pin: pin ? { x: pin.x, z: pin.z, label: pin.label, q: pin.q || null } : null,
      res: (() => {   // the "This seed" search, even while Find seeds is shown
        const j = findMode === 'seed' ? job : modeState.seed.job, s = findMode === 'seed' ? sel : modeState.seed.sel;
        return j ? { job: j, exact, close, tilesDone, reach, startPos, spawn, sel: s ? [s.x, s.z] : null } : null;
      })(),
      libBooks: $('libBooks').checked, libOnlyWant: $('libOnlyWant').checked,
      seedsSub, sf: { mode: findMode, found: sf.found, starred: sf.starred, job: sf.job, tested: sf.tested, ms: sf.ms,
        sel: findMode === 'seeds' && sel ? sel.seed : modeState.seeds.sel ? modeState.seeds.sel.seed : null },
    }));
  } catch {}
}
addEventListener('pagehide', saveState);
addEventListener('beforeunload', saveState);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
(function restoreState() {
  let st = null;
  try { st = JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch {}
  if (!st) return;
  if (st.placedStore) { placedStore['0'] = st.placedStore['0'] || []; placedStore['-1'] = st.placedStore['-1'] || []; }
  if (Array.isArray(st.radii) && st.radii.length === 3 && st.radii[0] < st.radii[1] && st.radii[1] < st.radii[2]) {
    RADII = st.radii; [0, 1, 2].forEach(z => { if ($('rs' + z)) $('rs' + z).value = RADII[z] * 2; });
  }
  if (st.fixedStore) for (const d of ['0', '-1']) fixedStore[d] = (st.fixedStore[d] || []).filter(f => f && f.key);
  if (st.seedsSub === 'rings') seedsSub = 'rings';
  findDim = st.findDim === -1 ? -1 : 0; placed = placedStore[findDim] || [];
  document.querySelectorAll('#fdimseg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.fdim === findDim));
  if (['origin', 'spawn', 'custom'].includes(st.start)) $('start').value = st.start;
  if (st.cx !== undefined) $('cx').value = st.cx;
  if (st.cz !== undefined) $('cz').value = st.cz;
  $('start').onchange();
  if (st.xview && isFinite(st.xview.s) && st.xview.s > 0) xRestore = st.xview;
  if (st.pin && isFinite(st.pin.x)) { pin = st.pin; renderPin(); }
  $('libBooks').checked = !!st.libBooks; $('libOnlyWant').checked = !!st.libOnlyWant;
  restoredRes = st.res || null;
  if (st.sf) {
    sf.found = st.sf.found || []; sf.starred = st.sf.starred || []; sf.job = st.sf.job || null; sf.tested = st.sf.tested || 0; sf.ms = st.sf.ms || 0;
    restoredSeeds = st.sf;
  }
  renderTarget(); renderPalette();
})();
// the results come back once the generator is ready, as a paused search ("Search further" carries on)
function applyRestoredResults() {
  applyRestoredThisSeed();
  const s = restoredSeeds; restoredSeeds = null;   // then the Find seeds side
  if (!s) return;
  const pick = s.sel && sf.found.concat(sf.starred).find(q => q.seed === s.sel);
  if (s.mode === 'seeds') { setFindMode('seeds'); if (pick) select(pick); }
  else modeState.seeds = { job: sf.job, sel: pick || null };
}
function applyRestoredThisSeed() {
  const r = restoredRes; restoredRes = null;
  if (!r || !r.job || r.job.seed !== parseSeed($('seed').value)) return;
  job = r.job; exact = r.exact || []; close = r.close || []; tilesDone = r.tilesDone || 0; reach = r.reach || 0;
  startPos = r.startPos || { x: 0, z: 0 }; spawn = r.spawn || null; pausedAt = tilesDone > 0;
  document.querySelectorAll('.startnote').forEach(n => n.textContent = `Closest to ${startLabel()} first.`);
  setRunning(false); status(); renderResults();
  const s = r.sel && exact.concat(close).find(q => q.x === r.sel[0] && q.z === r.sel[1]);
  if (s || exact[0] || close[0]) select(s || exact[0] || close[0]);
}
try { const t = localStorage.getItem('basescout.tab'); if (t === 'map' || t === 'lib') setTab(t); } catch {}
try {
  const src = $('wsrc').textContent;
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  worker.onmessage = ev => onMsg(ev.data);
  worker.onerror = ev => { $('stext').textContent = 'The search engine failed to start. Reload the page.'; console.error(ev); };
  // the generator is stored gzipped (then base64) to keep the file small: unzip it, then hand it to the worker
  if (typeof DecompressionStream === 'undefined') throw new Error('no DecompressionStream');
  const zipped = Uint8Array.from(atob(WASM_B64), c => c.charCodeAt(0));
  new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    .then(buf => {
      wasmCopy = buf.slice(0);
      // the maps get their own engines (a few, working side by side on tiles): drawing a map never pauses a search
      const nMap = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
      for (let i = 0; i < nMap; i++) try {
        const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        w.onmessage = ev => { const m = ev.data;
          if (m.type === 'ready') { MAPQ.ready++; MAPQ.free.push(i); if (i === 0) { mapWorker = w; mapReady = true; } mapPump(); }
          else if (m.type === 'area') onMsg(m); else if (m.type === 'pts') onPts(m); else if (m.type === 'error') console.error(m.message); };
        MAPQ.workers[i] = w;
        const mb = buf.slice(0); w.postMessage({ type: 'init', wasm: mb }, [mb]);
      } catch (err) { console.error(err); }
      worker.postMessage({ type: 'init', wasm: buf }, [buf]);
    })
    .catch(err => { console.error(err); $('stext').textContent = 'This browser could not unpack the search engine. Use a recent Chrome, Edge or Firefox.'; });
} catch (err) { console.error(err); $('stext').textContent = 'This browser blocked the search engine. Try another browser.'; }
setSeedsSub(seedsSub);   // Find seeds: the last kind of search used
