// ---------- saved seeds ----------
// Two places a list can live:
//  * seeds.txt on the computer, once linked (Chrome/Edge opening the html file directly). Read every time the
//    list opens, written on every Save/Delete. One seed per line:  Name: seed | rings 500/1000/1500 | village=1 trial=2
//  * this browser's storage, when no file is linked or the browser can't link files (e.g. inside Claude).
// saved: [{ name, seed, rings?: { radii, placed } }] plus, from a file, { raw } for lines kept as they are.
const STORE = 'basescout.saved.v1';
const FS_OK = 'showOpenFilePicker' in window && window.self === window.top;
let saved = [], seedFile = null, fileOK = false, fileErr = '';
const named = () => saved.filter(e => e.name);

function loadSaved() { try { const v = JSON.parse(localStorage.getItem(STORE) || '[]'); saved = Array.isArray(v) ? v.filter(e => e && e.name && e.seed) : []; } catch { saved = []; } }
function storeSaved() {
  try { localStorage.setItem(STORE, JSON.stringify(named())); }
  catch { toast("This browser won't keep saved seeds after you close the page."); }
}
// --- the seeds.txt format ---
function parseSeedsText(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) { out.push({ raw }); continue; }
    const parts = line.split('|').map(s => s.trim()), head = parts[0], i = head.lastIndexOf(':');
    const name = i > 0 ? head.slice(0, i).trim() : `Seed ${head}`, seed = (i > 0 ? head.slice(i + 1) : head).trim();
    if (!seed || parseSeed(seed) === null) { out.push({ raw }); continue; }
    const e = { name, seed };
    const vp = parts.slice(1).find(x => /^v\d/i.test(x)); if (vp && vAge(vp.slice(1)) > 0) e.ver = vp.slice(1);
    const lp = parts.slice(1).find(x => /^librarian=\d+$/i.test(x)); if (lp) e.lib = +lp.split('=')[1];
    const rp = parts.find(x => /^rings\s/i.test(x)), ip = parts.slice(1).find(x => /\w=\d/.test(x) && !/^librarian=/i.test(x));
    if (rp && ip) {
      const d = rp.replace(/^rings\s+/i, '').split('/').map(Number);
      const pl = ip.split(/\s+/).map(t => {
        const [k, zs] = t.split('='), [z, sz] = (zs || '').split('@'), zone = +z - 1, size = [64, 128, 256, 512].includes(+sz) ? +sz : 0;
        const kind = STRUCTURES.concat(NETHER_STRUCTS).some(s => s.key === k) ? 'structure' : BIOMES.concat(NETHER_BIOMES).some(bb => bb.key === k) ? 'biome' : null;
        return kind && zone >= 0 && zone <= 2 ? { kind, key: k, zone, ...(kind === 'biome' ? { size } : {}) } : null;
      }).filter(Boolean);
      if (d.length === 3 && d.every(n => n >= 50) && d[0] < d[1] && d[1] < d[2] && pl.length) e.rings = { radii: d.map(n => Math.round(n / 2)), placed: pl };
    }
    out.push(e);
  }
  return out;
}
function seedLine(e) {
  let l = `${e.name}: ${e.seed}`;
  if (e.ver) l += ` | v${e.ver}`;
  if (e.rings && e.rings.placed && e.rings.placed.length)
    l += ` | rings ${e.rings.radii.map(x => x * 2).join('/')} | ${e.rings.placed.map(q => `${q.key}=${q.zone + 1}${q.size ? '@' + q.size : ''}`).join(' ')}`;
  if (Number.isInteger(e.lib)) l += ` | librarian=${e.lib}`;
  return l;
}
const serializeSeeds = () => saved.map(e => e.name ? seedLine(e) : e.raw).join('\r\n') + '\r\n';

// --- remembering the linked file between visits (IndexedDB can hold a file handle) ---
function kv(mode, fn) {
  return new Promise((res, rej) => {
    let rq; try { rq = indexedDB.open('basescout', 1); } catch (e) { rej(e); return; }
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => {
      try { const tx = rq.result.transaction('kv', mode), q = fn(tx.objectStore('kv')); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); }
      catch (e) { rej(e); }
    };
  });
}
const kvGet = k => kv('readonly', s => s.get(k)).catch(() => null);
const kvSet = (k, v) => kv('readwrite', s => s.put(v, k)).catch(() => null);
const kvDel = k => kv('readwrite', s => s.delete(k)).catch(() => null);

async function ensurePerm(ask) {
  if (!seedFile) return false;
  try {
    let st = await seedFile.queryPermission({ mode: 'readwrite' });
    if (st !== 'granted' && ask) st = await seedFile.requestPermission({ mode: 'readwrite' });
    fileOK = st === 'granted';
  } catch { fileOK = false; }
  return fileOK;
}
async function readFile(ask) {
  fileErr = '';
  if (!await ensurePerm(ask)) { renderFileBar(); return false; }
  try { saved = parseSeedsText(await (await seedFile.getFile()).text()); }
  catch { fileOK = false; fileErr = `Couldn't read ${seedFile.name}. It may have been moved or renamed.`; }
  renderFileBar(); renderSaved();
  return fileOK;
}
async function writeFile() {
  try { const w = await seedFile.createWritable(); await w.write(serializeSeeds()); await w.close(); return true; }
  catch { fileOK = false; fileErr = `Couldn't write to ${seedFile.name}.`; renderFileBar(); toast(fileErr); return false; }
}
// Change the list: from a file, re-read it first so hand edits are kept, then write it back.
async function changeList(fn, done) {
  if (seedFile) {
    if (!await readFile(true)) { toast('Allow access to seeds.txt first.'); return; }
    fn(); if (await writeFile()) { renderSaved(); toast(done); }
  } else { fn(); storeSaved(); renderSaved(); toast(done); }
}
async function useHandle(h, fresh) {
  const local = named();
  seedFile = h; await kvSet('seedFile', h);
  if (fresh) { fileOK = true; saved = []; }
  else if (!await readFile(true)) return;
  let added = 0;   // bring over seeds that were only saved in this browser
  for (const e of local) if (!named().some(q => q.name.toLowerCase() === e.name.toLowerCase())) { saved.push({ name: e.name, seed: e.seed, rings: e.rings }); added++; }
  if (added || fresh) await writeFile();
  renderFileBar(); renderSaved();
  toast(`Using ${h.name}` + (added ? ` · added ${added} seed${added > 1 ? 's' : ''} from this browser` : ''));
}
const PICK = { types: [{ description: 'Seed list', accept: { 'text/plain': ['.txt'] } }], excludeAcceptAllOption: false, multiple: false };
async function linkFile() {
  try { const [h] = await window.showOpenFilePicker(PICK); await useHandle(h, false); }
  catch (e) { if (e && e.name !== 'AbortError') toast("Couldn't open that file."); }
}
async function createFile() {
  try { const h = await window.showSaveFilePicker({ suggestedName: 'seeds.txt', types: PICK.types }); await useHandle(h, true); }
  catch (e) { if (e && e.name !== 'AbortError') toast("Couldn't create the file."); }
}
async function unlinkFile() {
  seedFile = null; fileOK = false; fileErr = ''; await kvDel('seedFile');
  loadSaved(); renderFileBar(); renderSaved(); toast('Seeds are now kept in this browser.');
}

function renderFileBar() {
  const bar = $('fileBar'), fileMode = !!seedFile;
  $('popFoot').hidden = fileMode; $('popHint').hidden = fileMode;
  if (!FS_OK) { bar.hidden = true; return; }
  bar.hidden = false;
  if (!seedFile) {
    bar.innerHTML = `<div class="hint" style="margin:0">Keep your list in <b>seeds.txt</b> in your folder. Saving and deleting here will change the file.</div>
      <div class="row"><button type="button" class="go" id="linkBtn" style="min-width:0">Use my seeds.txt</button><button type="button" id="newBtn">Create a new one</button></div>`;
    $('linkBtn').onclick = linkFile; $('newBtn').onclick = createFile;
  } else if (fileOK) {
    bar.innerHTML = `<div class="ok"><i></i><span></span></div>
      <div class="row"><button type="button" id="relinkBtn">Use another file</button><button type="button" id="unlinkBtn">Stop using it</button></div>`;
    bar.querySelector('.ok span').textContent = `Reading and saving to ${seedFile.name}`;
    $('relinkBtn').onclick = linkFile; $('unlinkBtn').onclick = unlinkFile;
  } else {
    bar.innerHTML = `<div class="ok wait"><i></i><span></span></div>
      <div class="row"><button type="button" class="go" id="allowBtn" style="min-width:0">Allow access</button><button type="button" id="relinkBtn">Use another file</button><button type="button" id="unlinkBtn">Stop using it</button></div>`;
    bar.querySelector('.ok span').textContent = fileErr || `${seedFile.name} needs your OK to be opened again.`;
    $('allowBtn').onclick = () => readFile(true); $('relinkBtn').onclick = linkFile; $('unlinkBtn').onclick = unlinkFile;
  }
}

let delArmed = null;
function renderSaved() {
  const list = $('savelist'); list.innerHTML = '';
  const waiting = seedFile && !fileOK, items = named();
  $('savedN').hidden = waiting || !items.length; $('savedN').textContent = items.length;
  if (waiting) { list.innerHTML = '<p class="hint" style="margin:0">Allow access above to see the seeds in your file.</p>'; return; }
  if (!items.length) { list.innerHTML = `<p class="hint" style="margin:0">No saved seeds yet. Type a seed above, name it, and press Save.</p>`; return; }
  const cur = parseSeed($('seed').value);
  items.forEach(e => {
    const row = document.createElement('div'); row.className = 'saved' + (parseSeed(e.seed) === cur ? ' cur' : '');
    const rings = e.rings && e.rings.placed && e.rings.placed.length ? `<div class="rg">+ ${e.rings.placed.length} in rings</div>` : '';
    row.innerHTML = `<div style="min-width:0"><div class="nm"></div><div class="sd"></div>${rings}</div>
      <button type="button" class="load">Load</button><button type="button" class="del${delArmed === e.name ? ' armed' : ''}">${delArmed === e.name ? 'Delete?' : '✕'}</button>`;
    row.querySelector('.nm').textContent = e.name; row.querySelector('.sd').textContent = e.seed + (e.ver ? ` · ${e.ver}` : '');
    row.querySelector('.del').setAttribute('aria-label', 'Delete ' + e.name);
    row.querySelector('.load').onclick = () => loadEntry(e);
    row.querySelector('.del').onclick = () => {
      if (delArmed !== e.name) { delArmed = e.name; renderSaved(); return; }
      const nm = e.name; delArmed = null;
      changeList(() => { saved = saved.filter(q => !(q.name && q.name.toLowerCase() === nm.toLowerCase())); }, `Deleted ${nm}`);
    };
    list.appendChild(row);
  });
}
function upsert(entry) {
  const i = saved.findIndex(e => e.name && e.name.toLowerCase() === entry.name.toLowerCase());
  if (i >= 0) saved[i] = entry; else saved.push(entry);
}
function loadEntry(e) {
  $('seed').value = e.seed;
  if (e.ver && vAge(e.ver) > 0 && e.ver !== VER) setVersion(e.ver);
  if (Number.isInteger(e.lib)) libSetPos(parseSeed(e.seed), e.lib);
  if (e.rings && Array.isArray(e.rings.radii) && Array.isArray(e.rings.placed)) {
    RADII = e.rings.radii.slice(0, 3);
    [0, 1, 2].forEach(z => { if ($('rs' + z)) $('rs' + z).value = RADII[z] * 2; });
    const list = e.rings.placed.filter(q => q && meta(q)).map(q => ({ kind: q.kind, key: q.key, zone: q.zone, ...(q.kind === 'biome' ? { size: q.size || 0 } : {}) }));
    setFindDim(list.some(q => isNetherKey(q.key)) ? -1 : 0);
    placed = list;
    renderTarget(); renderPalette();
  }
  closePop(); toast(`Loaded ${e.name}`);
  lastSeed = undefined; seedChanged();
}
$('saveBtn').onclick = () => {
  const seedText = $('seed').value.trim(), name = $('saveName').value.replace(/[|\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  if (parseSeed(seedText) === null) { toast('Type a seed in the seed box first.'); $('seed').focus(); return; }
  if (!name) { toast('Give it a name first.'); $('saveName').focus(); return; }
  const entry = { name, seed: seedText, ver: VER };
  const lp = libGetPos(parseSeed(seedText)); if (lp !== null) entry.lib = lp;
  if ($('saveRings').checked && placed.length) entry.rings = { radii: RADII.slice(), placed: placed.map(q => ({ kind: q.kind, key: q.key, zone: q.zone, ...(q.kind === 'biome' && q.size ? { size: q.size } : {}) })) };
  $('saveName').value = '';
  changeList(() => upsert(entry), seedFile ? `Saved ${name} to ${seedFile.name}` : `Saved ${name}`);
};
$('saveName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('saveBtn').click(); } });
$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async ev => {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  const got = parseSeedsText(await f.text()).filter(e => e.name);
  ev.target.value = '';
  if (!got.length) { toast('No seeds found. Use lines like  Name: seed'); return; }
  got.forEach(upsert); storeSaved(); renderSaved(); toast(`Imported ${got.length} seed${got.length > 1 ? 's' : ''}`);
};
$('copyList').onclick = () => {
  if (!named().length) { toast('Nothing saved yet.'); return; }
  copy(named().map(seedLine).join('\n'));
};
function openPop() {
  $('savedPop').hidden = false; $('savedBtn').setAttribute('aria-expanded', 'true'); delArmed = null;
  renderFileBar(); renderSaved();
  if (seedFile) readFile(true);   // the click on Saved seeds lets the browser ask for access if it needs to
}
function closePop() { $('savedPop').hidden = true; $('savedBtn').setAttribute('aria-expanded', 'false'); delArmed = null; }
$('savedBtn').onclick = () => $('savedPop').hidden ? openPop() : closePop();
document.addEventListener('pointerdown', e => { if (!$('savedPop').hidden && !e.target.closest('.savewrap')) closePop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('savedPop').hidden) closePop(); });
async function bootSaved() {
  loadSaved();
  if (FS_OK) {
    const h = await kvGet('seedFile');
    if (h && h.queryPermission) { seedFile = h; await readFile(false); }   // no prompt on load; reads only if already allowed
  }
  renderFileBar(); renderSaved();
}


