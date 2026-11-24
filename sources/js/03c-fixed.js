// ---------- Find seeds: fixed spots ----------
// A structure that has to be at given coordinates (within a few blocks), or a biome that has to be at a spot.
// Find seeds keeps the seeds that have every fixed spot; Crack finds the one seed of an existing world from them.
// One list per dimension. A structure entry: { key, x, z, r, biomes? }; a biome spot: { kind: 'biome', key, x, z }.
const fixedStore = { 0: [], '-1': [] };
const FIX_WITHIN = [0, 16, 50, 100, 250];   // 0: the structure starts in the chunk you typed (for cracking)
const fixed = () => fixedStore[findDim] || (fixedStore[findDim] = []);
const fbiomes = f => f.biomes || (f.biome ? [f.biome] : []);   // older saves kept a single biome
const isBioSpot = f => f.kind === 'biome';
const hasXZ = f => f.x != null && f.z != null;   // a new spot starts empty: X and Z still to type
const fixedMissingXZ = () => fixed().some(f => !hasXZ(f));
function overFixed(cx, cy) {
  if (!$('fixsec').offsetParent) return false;
  const r = $('fixbox').getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}
// the structure row under the pointer (a biome dropped on it goes into its "in" box)
function fixedRowAt(cx, cy) {
  if (!$('fixsec').offsetParent) return -1;
  const rows = [...$('fixbox').querySelectorAll('.frow:not(.bspot)')];
  const hit = rows.find(r => { const b = r.getBoundingClientRect(); return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom; });
  return hit ? +hit.dataset.i : -1;
}
function setFixedBiome(i, key) {   // adds a biome to a structure (it can be in any of its biomes)
  const f = fixed()[i]; if (!f || isBioSpot(f)) return;
  const list = fbiomes(f); delete f.biome;
  if (!list.includes(key)) list.push(key);
  f.biomes = list; armed = null; renderPalette(); renderFixed();
}
function addFixed(src, cx, cy) {
  const key = src.ref ? src.ref.key : src.key, kind = src.ref ? src.ref.kind : src.kind;
  if (kind !== 'structure') {
    const i = cx == null ? -1 : fixedRowAt(cx, cy);
    if (i >= 0) { setFixedBiome(i, key); return; }
    fixed().push({ kind: 'biome', key, x: null, z: null });   // dropped on the box itself: "this biome is here"
  } else {
    if (src.ref) placed = placed.filter(q => q !== src.ref);   // moved out of a ring
    fixed().push({ key, x: null, z: null, r: 50 });
  }
  armed = null; renderTarget(); renderPalette(); renderFixed();
  const rows = $('fixbox').querySelectorAll('.frow'); const last = rows[rows.length - 1];
  if (last) last.querySelector('input').focus();
}
function renderFixed() {
  const box = $('fixbox'), list = fixed();
  box.classList.toggle('armed', !!armed);
  renderCrackInfo();
  if (!list.length) {
    box.innerHTML = '<div class="fempty">Drop a structure here, then type where it is. Drop a biome here to say "this biome is at this spot".</div>';
    return;
  }
  box.innerHTML = '';
  list.forEach((f, i) => {
    const row = document.createElement('div'), bio = isBioSpot(f);
    row.className = 'frow' + (bio ? ' bspot' : '') + (inVer(f.key) ? '' : ' na'); row.dataset.i = i;
    const xz = `<div class="fxz"><label>X <input type="number" value="${f.x ?? ''}"></label><label>Z <input type="number" value="${f.z ?? ''}"></label></div>`;
    row.innerHTML = bio
      ? `<div class="ftop"><span class="chip placed">${chipHTML({ kind: 'biome', key: f.key })}</span><span class="fw">is here</span>
          <button type="button" class="fx" title="Remove">×</button></div>${xz}`
      : `<div class="ftop"><span class="chip placed">${chipHTML({ kind: 'structure', key: f.key })}</span>
          <label class="fw" title="How close to these coordinates it has to be">within <select>${FIX_WITHIN.map(v => `<option value="${v}"${v === f.r ? ' selected' : ''}>${v ? v : 'same chunk'}</option>`).join('')}</select></label>
          <button type="button" class="fx" title="Remove">×</button></div>${xz}
        <div class="fbio"><span>in</span><div class="fbslot" title="Drag biomes here: the structure has to be in one of them">${
          fbiomes(f).length ? fbiomes(f).map(k => `<span class="chip placed${inVer(k) ? '' : ' na'}" data-b="${k}" tabindex="0" title="${escH(meta({ kind: 'biome', key: k }).name)}: tap to remove">${chipHTML({ kind: 'biome', key: k })}<b class="bx">×</b></span>`).join('')
          : '<span class="fbany">any biome · drag a biome here</span>'}</div></div>`;
    const [ix, iz] = row.querySelectorAll('input');
    const num = v => v.trim() === '' || isNaN(+v) ? null : Math.round(+v);
    ix.oninput = ix.onchange = () => { f.x = num(ix.value); renderCrackInfo(); };
    iz.oninput = iz.onchange = () => { f.z = num(iz.value); renderCrackInfo(); };
    if (!bio) {
      row.querySelector('.fw select').onchange = ev => { f.r = +ev.target.value; renderCrackInfo(); };
      row.querySelectorAll('.fbslot .chip').forEach(c => {
        const drop = () => { f.biomes = fbiomes(f).filter(k => k !== c.dataset.b); delete f.biome; renderFixed(); };
        c.onclick = drop; c.onkeydown = ev => { if (ev.key === 'Delete' || ev.key === 'Backspace' || ev.key === 'Enter') drop(); };
      });
    }
    row.querySelector('.fx').onclick = () => { list.splice(i, 1); renderFixed(); };
    if (!inVer(f.key)) row.title = `Not in ${VER}: left out of the search`;
    box.appendChild(row);
  });
}
$('fixbox').addEventListener('click', e => {
  if (!armed) return;
  const row = e.target.closest('.frow');
  if (armed.kind === 'biome' && !armed.ref) {
    if (row && !row.classList.contains('bspot') && !e.target.closest('select,input,button,.fbslot .chip')) setFixedBiome(+row.dataset.i, armed.key);
    else if (!row) addFixed(armed);
    return;
  }
  if (!row) addFixed(armed);
});

// ---------- Crack: the exact seed of an existing world ----------
// Same placement table as the worker (1.18+): region size, chunks a structure can start in, triangle spread.
const CRACK_CFG = { village: [34, 26], trial: [34, 22], ancient: [24, 16], monument: [32, 27, 1], mansion: [80, 60, 1],
  outpost: [32, 24], pyramid: [32, 24], hut: [32, 24], shipwreck: [24, 20], trail: [34, 26], jungle: [32, 24],
  igloo: [32, 24], ruins: [20, 12], portal: [40, 25] };
function crackChunks(f) {   // the chunks the structure could start in, from what was typed
  const [rs, range] = CRACK_CFG[f.key], out = [];
  for (let cx = Math.floor((f.x - f.r) / 16); cx <= Math.floor((f.x + f.r) / 16); cx++)
    for (let cz = Math.floor((f.z - f.r) / 16); cz <= Math.floor((f.z + f.r) / 16); cz++) {
      const dx = Math.max(cx * 16 - f.x, 0, f.x - (cx * 16 + 15)), dz = Math.max(cz * 16 - f.z, 0, f.z - (cz * 16 + 15));
      const ox = cx - Math.floor(cx / rs) * rs, oz = cz - Math.floor(cz / rs) * rs;
      if (dx * dx + dz * dz <= f.r * f.r && ox < range && oz < range) out.push([ox, oz]);
    }
  return out;
}
const CRACK_EXACT = new Set(['pyramid', 'jungle', 'hut', 'igloo', 'outpost', 'monument', 'mansion']);   // middle sits in the start chunk
// what the typed structures tell: bits of the 48-bit structure seed, and how long the first two steps take
function crackInfo() {
  const structs = fixed().filter(f => !isBioSpot(f) && CRACK_CFG[f.key] && inVer(f.key) && hasXZ(f));
  const bios = fixed().filter(f => isBioSpot(f) && hasXZ(f)).length;
  let bits = 0, lowBits = 0, bad = false, loose = 0;
  for (const f of structs) {
    const [, range, big] = CRACK_CFG[f.key], ch = crackChunks(f), n = ch.length;
    if (!n) { bad = true; continue; }
    if (f.r > (CRACK_EXACT.has(f.key) ? 0 : 16)) loose++;
    bits += Math.log2(range * range / n) * (big ? 0.9 : 1);
    if (!big && (range & (range - 1))) {   // low bits of each axis that only depend on the low 20 seed bits
      let k = 0; while (k < 3 && !(range & (1 << k))) k++;
      const m = 1 << k, rx = new Set(ch.map(c => c[0] % m)).size, rz = new Set(ch.map(c => c[1] % m)).size;
      lowBits += 2 * k - Math.log2(rx) - Math.log2(rz);
    }
  }
  // what is left after the low 20 bits counts about half (nearby regions overlap), so: 20 + half the rest
  const lifted = Math.min(lowBits, 20), extra = Math.max(0, bits - lifted), eff = lifted + extra / 2;
  const lows = Math.pow(2, 20 - lifted), cores = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  return { structs: structs.length, bios, bits: eff, lowBits, bad, loose, secs: lows * (1 << 28) / (cores * 2.5e7) + 30 };   // ~25 M placements a second per core, plus the biome step
}
const dur = t => t < 90 ? `${Math.max(1, Math.round(t))} s` : t < 5400 ? `${Math.round(t / 60)} min` : `${(t / 3600).toFixed(1)} h`;
function renderCrackInfo() {
  const el = $('crackinfo'); if (!el) return;
  const c = crackInfo(), enough = c.bits >= 50 && c.lowBits >= 10 && !c.bad;
  if (!c.structs) { el.innerHTML = 'Crack: add structures you have seen in the world (temples, huts, igloos, outposts, shipwrecks, monuments). Type the middle of each one.'; $('crack').classList.remove('ready'); return; }
  const tips = [];
  if (c.loose) tips.push(`<b>${c.loose} structure${c.loose > 1 ? 's are' : ' is'} too loose</b> <button type="button" class="linkbtn" id="crackfix">set "within" for cracking</button>`);
  if (c.bad) tips.push('<b>a spot can never hold its structure: check its X / Z</b>');
  if (c.lowBits < 10) tips.push('<b>needs more temples, huts, igloos, outposts or shipwrecks, with exact chunks</b>');
  else if (c.bits < 50) tips.push('<b>add more structures, in other regions (15 or so)</b>');
  el.innerHTML = `${c.structs} structure${c.structs > 1 ? 's' : ''} · ${c.bios} biome spot${c.bios === 1 ? '' : 's'}${c.bios < 3 ? ' (3–5 make the answer unique)' : ''}`
    + (enough ? ` · ready, about ${dur(c.secs)}` : '') + (tips.length ? '<br>' + tips.join('<br>') : '');
  if ($('crackfix')) $('crackfix').onclick = () => {   // same chunk where the middle is in the start chunk, 16 for the others
    for (const f of fixed()) if (!isBioSpot(f) && CRACK_CFG[f.key]) f.r = CRACK_EXACT.has(f.key) ? 0 : 16;
    renderFixed(); toast('Set: "same chunk" for temples, huts, igloos, outposts and monuments, 16 for the others.');
  };
  $('crack').classList.toggle('ready', enough);
}
let crack = null;   // { running, stage, done, total, structs, workers, t0 }
function startCrack() {
  const c = crackInfo();
  if (findDim !== 0) { toast('Cracking works from Overworld structures.'); return; }
  if (fixedMissingXZ()) { toast('Type the X and Z of every fixed spot first.'); return; }
  if (c.bad) { toast('One of the spots can never hold its structure. Check its coordinates.'); return; }
  if (c.loose && c.lowBits < 10) { toast('Set "within" to "same chunk" (16 for shipwrecks): use the button under Crack.'); return; }
  if (c.lowBits < 10) { toast('Add more temples, huts, igloos, outposts or shipwrecks, with exact chunks: they let the first step run fast.'); return; }
  if (c.bits < 42 && !confirm(`Only about ${Math.floor(c.bits)} of 48 bits: many structure seeds may fit, and the last step could stop and ask for more. Crack anyway?`)) return;
  if (!wasmCopy) { toast('The search engine is still loading.'); return; }
  if (sf.running) stopSeeds();
  const pins = usablePins();
  sf.found = []; sf.tested = 0; sf.ms = 0; sel = null; findMap.reset(); findMap.draw(); shown = { exact: 12, close: 6 };
  sf.job = { mode: 'crack', ver: curVer(), verLabel: VER, items: [], radii: RADII.slice(), dim: 0, start: 'origin', custom: { x: 0, z: 0 }, landOnly: false, pins };
  job = sf.job; sf.token++; sf.running = true;
  const pool = getPool();
  crack = { running: true, stage3: false, stage: 1, prog: pool.map(() => ({ done: 0, total: 1, stage: 1 })), structs: new Set(), left: pool.length, t0: Date.now(), error: null };
  pool.forEach((e, idx) => {
    const msg = { type: 'crack', ver: sf.job.ver, pins: pins.map(p => ({ ...p, r: p.kind === 'biome' ? 0 : p.r })), token: sf.token, idx, of: pool.length };
    if (e.ready) e.w.postMessage(msg); else e.queue = msg;
  });
  setRunning(true); crackStatus(); renderResults();
}
const CRACK_MAX = 400;   // more structure seeds than this: the last step would take too long, ask for more structures
function onCrackMsg(i, m) {
  if (!crack) return;
  if (m.type === 'crackprog') crack.prog[i] = { done: m.done, total: m.total, stage: m.stage };
  if (m.type === 'crack2done') {
    for (const v of m.structs) crack.structs.add(v);
    crack.prog[i] = { done: 1, total: 1, stage: 3 };
    if (--crack.left <= 0 && crack.running) {   // step 2 done everywhere: share step 3 out over all the workers
      const list = [...crack.structs];
      if (!list.length) finishCrack();
      else if (list.length > CRACK_MAX) finishCrack(`${list.length} structure seeds fit these structures. Add more structures (in other regions) so fewer fit, then crack again.`);
      else {
        const pool = getPool(); crack.left = pool.length; crack.stage3 = true;
        pool.forEach((e, idx) => { crack.prog[idx] = { done: 0, total: 1, stage: 3 }; e.w.postMessage({ type: 'crack3', ver: sf.job.ver, pins: sf.job.pins, structs: list, token: sf.token, idx, of: pool.length }); });
      }
    }
  }
  if (m.type === 'crackdone') {
    if (m.error) crack.error = crack.error || m.error;
    crack.prog[i] = { done: 1, total: 1, stage: 4 };
    if (--crack.left <= 0) finishCrack();
  }
  if (findMode === 'seeds') crackStatus();
}
function finishCrack(err) {
  if (err) crack.error = err;
  crack.running = false; sf.running = false; setRunning(false); renderResults();
  if (findMode === 'seeds') crackStatus();
}
function crackStatus() {
  const st = (l, v, c) => `<div class="st${c ? ' ' + c : ''}"><span>${l}</span><b>${v}</b></div>`;
  const p = crack.prog, stage = crack.stage3 ? 3 : Math.min(2, ...p.map(q => q.stage));
  const pct = p.reduce((a, q) => a + Math.min(1, q.done / q.total), 0) / p.length;
  const what = crack.error ? 'Stopped' : !crack.running ? 'Done' : stage <= 1 ? 'Low bits' : stage === 2 ? 'Structure seed' : 'Biomes';
  $('stext').innerHTML = st('Crack', what) + st('Step', crack.running ? `${Math.min(3, Math.max(1, stage))} of 3<small> ${Math.round(pct * 100)}%</small>` : '–')
    + st('Structure seeds', crack.structs.size) + st('Seeds found', sf.found.length, 'ok') + st('Time', `${Math.round((Date.now() - crack.t0) / 1000)} s`) + st('Cores', p.length);
  fitStatus();
  $('crack').textContent = crack.running ? 'Stop cracking' : 'Crack the exact seed';
  if (crack.error && !crack.shown) { crack.shown = true; toast(crack.error); }
  if (!crack.running && !crack.error && !crack.told) {
    crack.told = true;
    toast(sf.found.length === 1 ? 'One seed fits everything: that is the world.' : sf.found.length ? `${sf.found.length} seeds fit. Add biome spots (read with F3 in game) to narrow it down to one.` : 'No seed fits. Check the coordinates (and the Java version at the top).');
  }
}
$('crack').onclick = () => { if (crack && crack.running) { stopSeeds(); crack.running = false; crackStatus(); } else startCrack(); };
