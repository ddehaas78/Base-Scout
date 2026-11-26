// ---------- maps ----------
// Each map loads in square tiles (TILE x TILE cells) at a detail level that fits the zoom: the tiles on screen are asked
// for nearest to the middle first, from a few map engines working side by side (MAPQ), and kept, so going back is instant.
// Coarser tiles stay underneath while the finer ones arrive, so zooming never shows black.
const SCALES = [4, 16, 64, 256], TILE = 128;
const maps = {};
// the map engines: idle ones take the next tile of the map on screen
const MAPQ = { workers: [], free: [], ready: 0, main: false };
function mapPump() {
  while (MAPQ.free.length) {
    let job = null;
    for (const M of Object.values(maps)) if (M.queue.length && M.active()) { job = M.queue.shift(); break; }
    if (!job) return;
    const wi = MAPQ.free.pop();
    if (wi < 0 && MAPQ.ready) continue;   // the map engines are up: the main engine goes back to searches only
    const w = wi < 0 ? worker : MAPQ.workers[wi];
    job.msg.tag += ':' + wi; w.postMessage(job.msg);
  }
}
function MapView(o) {
  const cv = o.canvas, ctx = cv.getContext('2d');
  const M = { name: o.name, cv, ctx, layers: [], structs: {}, view: { s: 0.25, ox: 0, oy: 0 }, gen: 0, n: 0, tiles: new Map(), queue: [], active: () => o.active() };
  maps[o.name] = M;
  M.reset = () => { M.layers = []; M.structs = {}; M.gen++; M.tiles.clear(); M.queue = []; };
  M.size = () => {
    const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (w === cv.width && h === cv.height) return false;
    const [cx, cz] = M.center(); cv.width = w; cv.height = h;
    M.view.ox = cx - w / 2 / M.view.s; M.view.oy = cz - h / 2 / M.view.s;
    return true;
  };
  M.scr = (x, z) => [(x - M.view.ox) * M.view.s, (z - M.view.oy) * M.view.s];
  M.toWorld = (sx, sy) => [M.view.ox + sx / M.view.s, M.view.oy + sy / M.view.s];
  M.center = () => M.toWorld(cv.width / 2, cv.height / 2);
  M.fitTo = (x, z, half) => { const s = Math.min(cv.width, cv.height) / (2 * half); M.view = { s, ox: x - cv.width / 2 / s, oy: z - cv.height / 2 / s }; };
  M.centerOn = (x, z) => { M.view.ox = x - cv.width / 2 / M.view.s; M.view.oy = z - cv.height / 2 / M.view.s; };
  M.span = () => Math.max(cv.width, cv.height) / M.view.s;
  M.request = () => {
    const seed = o.seed();
    if (seed == null || !o.active() || cv.width < 4 || !ready) return;
    if (!MAPQ.ready && !MAPQ.main) { MAPQ.main = true; MAPQ.free.push(-1); }   // no map engine ready yet: the main one helps
    const v = M.view, x0 = v.ox, z0 = v.oy, x1 = v.ox + cv.width / v.s, z1 = v.oy + cv.height / v.s;
    const span = Math.max(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const S = SCALES.find(q => span * 1.3 / q <= 700) || 256, dim = o.dim ? o.dim() : 0;
    const keys = o.keys(S, span), sig = keys.join(',') + '|' + JSON.stringify(o.ver()) + '|' + dim, ver = o.ver();
    const jobs = [];
    const plan = (sc, pad, first) => {   // the tiles of this scale over the screen (and a margin), nearest to the middle first
      const tw = TILE * sc, list = [];
      const a0 = Math.floor((x0 - pad) / tw), a1 = Math.floor((x1 + pad) / tw), b0 = Math.floor((z0 - pad) / tw), b1 = Math.floor((z1 + pad) / tw);
      for (let tx = a0; tx <= a1; tx++) for (let tz = b0; tz <= b1; tz++) {
        const key = sc + ':' + tx + ':' + tz + ':' + sig;
        if (M.tiles.has(key)) continue;
        const cx = (tx + 0.5) * tw, cz = (tz + 0.5) * tw;
        list.push({ key, d: Math.hypot(cx - mx, cz - mz) - (first ? 1e12 : 0), msg: { type: 'area', seed, ver, dim, tag: M.name + ':' + M.gen + ':' + key,
          x: cx, z: cz, scale: sc, halfX: tw / 2, halfZ: tw / 2, keys, sig } });
      }
      return list;
    };
    // nothing at all under the middle yet (new seed, far jump): a coarse pass first, so something shows at once
    const covered = M.layers.some(L => L.bx0 <= mx && L.bz0 <= mz && L.bx1 > mx && L.bz1 > mz);
    if (!covered && S < 256) jobs.push(...plan(SCALES[SCALES.indexOf(S) + 1], 0, true));
    jobs.push(...plan(S, span * 0.15, false));
    jobs.sort((a, b) => a.d - b.d);
    for (const j of jobs) M.tiles.set(j.key, 'queued');
    for (const j of M.queue) if (!jobs.includes(j)) M.tiles.delete(j.key);   // tiles no longer wanted: dropped before they start
    M.queue = jobs;
    mapPump();
  };
  M.onArea = m => {
    const parts = String(m.tag).split(':'), gen = +parts[1], wi = +parts[parts.length - 1], key = parts.slice(2, -1).join(':');
    if (!(wi < 0 && MAPQ.ready)) MAPQ.free.push(wi);
    if (gen === M.gen) {
      const c = document.createElement('canvas'); c.width = m.W; c.height = m.H;
      const g = c.getContext('2d'), d = g.createImageData(m.W, m.H);
      const lut = paletteFor32(m.dim || 0), px = new Uint32Array(d.data.buffer), grid = m.grid;
      for (let k = 0, n = m.W * m.H; k < n; k++) { const b = grid[k]; px[k] = lut[b < 0 ? 256 : b]; }
      g.putImageData(d, 0, 0);
      const L = { scale: m.scale, cx0: m.cx0, cz0: m.cz0, W: m.W, H: m.H, grid: m.grid, img: c, sig: m.sig, n: ++M.n, key,
        bx0: m.cx0 * m.scale, bz0: m.cz0 * m.scale, bx1: (m.cx0 + m.W) * m.scale, bz1: (m.cz0 + m.H) * m.scale };
      M.layers.push(L); M.tiles.set(key, L);
      if (M.layers.length > 250) {   // forget the tiles seen longest ago
        const old = M.layers.slice().sort((a, b) => a.n - b.n).slice(0, M.layers.length - 250);
        for (const o2 of old) { M.layers.splice(M.layers.indexOf(o2), 1); M.tiles.delete(o2.key); }
      }
      M.layers.sort((a, b) => b.scale - a.scale || a.n - b.n);   // coarse first, fine on top
      for (const [k, list] of Object.entries(m.structs)) {
        const have = M.structs[k] || (M.structs[k] = new Map());
        for (const q of list) have.set(q.x + ',' + q.z, q);
      }
      M.changedDraw();
      if (o.loaded) o.loaded(M);
    }
    mapPump();
  };
  M.draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0a0d0b'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    const [wx0, wz0] = M.toWorld(0, 0), [wx1, wz1] = M.toWorld(cv.width, cv.height);
    for (const L of M.layers) {
      if (L.bx1 < wx0 || L.bx0 > wx1 || L.bz1 < wz0 || L.bz0 > wz1) continue;   // off screen
      const [ix, iy] = M.scr(L.bx0, L.bz0); ctx.drawImage(L.img, ix, iy, (L.bx1 - L.bx0) * M.view.s, (L.bz1 - L.bz0) * M.view.s);
    }
    o.overlay(M);
  };
  M.biomeAt = (x, z) => {
    let L = null;
    for (const c of M.layers) if (x >= c.bx0 && x < c.bx1 && z >= c.bz0 && z < c.bz1 && (!L || c.scale < L.scale)) L = c;
    if (!L) return null;
    const id = L.grid[(Math.floor(z / L.scale) - L.cz0) * L.W + (Math.floor(x / L.scale) - L.cx0)];
    return id < 0 ? 'void' : names[id];
  };
  let viewT, frame = 0;   // pan and zoom events come faster than the screen: draw once per frame
  M.changedDraw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; M.draw(); }); };
  M.changed = () => {   // tiles are small: ask for them soon after the view moves, the ones no longer wanted are dropped
    M.changedDraw();
    clearTimeout(viewT); viewT = setTimeout(() => M.request(), 60);
  };
  M.zoomAt = (sx, sy, f) => {
    const ns = Math.max(Math.max(cv.width, cv.height) / (typeof o.maxSpan === 'function' ? o.maxSpan() : o.maxSpan), Math.min(12, M.view.s * f)), [wx, wz] = M.toWorld(sx, sy);
    M.view.s = ns; M.view.ox = wx - sx / ns; M.view.oy = wz - sy / ns; M.changed();
  };
  // pan, pinch, wheel, click, hover
  const pts = new Map(); let downAt = null;
  const local = e => { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d]; };
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return;   // right click: its own menu (js/06e-done.js)
    cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); downAt = [e.clientX, e.clientY]; });
  cv.addEventListener('pointermove', e => {
    if (M.layers.length && o.hover) { const [sx, sy] = local(e), [x, z] = M.toWorld(sx, sy); o.hover(M, Math.floor(x), Math.floor(z), sx, sy); }
    if (!pts.has(e.pointerId) || !M.layers.length) return;
    const d = devicePixelRatio || 1, prev = pts.get(e.pointerId);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], before = Math.hypot(a[0]-b[0], a[1]-b[1]);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const [a2, b2] = [...pts.values()], after = Math.hypot(a2[0]-b2[0], a2[1]-b2[1]), r = cv.getBoundingClientRect();
      M.zoomAt(((a2[0]+b2[0])/2 - r.left) * d, ((a2[1]+b2[1])/2 - r.top) * d, after / (before || 1)); return;
    }
    M.view.ox -= (e.clientX - prev[0]) * d / M.view.s; M.view.oy -= (e.clientY - prev[1]) * d / M.view.s;
    pts.set(e.pointerId, [e.clientX, e.clientY]); M.changed();
  });
  const lift = e => {
    pts.delete(e.pointerId);
    if (e.type === 'pointerup' && downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5 && M.layers.length && o.click) {
      const [sx, sy] = local(e), [x, z] = M.toWorld(sx, sy); o.click(M, Math.floor(x), Math.floor(z), sx, sy);
    }
    downAt = null;
  };
  cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
  cv.addEventListener('wheel', e => { if (!M.layers.length) return; e.preventDefault(); const [sx, sy] = local(e); M.zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  new ResizeObserver(() => { if (o.active() && M.size()) M.changed(); }).observe(cv);
  return M;
}

// Biome colours per dimension; slot 256 is the End's void. The End uses end-stone tones so islands read as land.
const PAL = {};
function paletteFor(dim) {
  if (PAL[dim]) return PAL[dim];
  const t = new Uint8Array(257 * 3); t.set(colors.slice(0, 768));
  const set = (id, hex) => { t[id*3] = parseInt(hex.slice(1, 3), 16); t[id*3+1] = parseInt(hex.slice(3, 5), 16); t[id*3+2] = parseInt(hex.slice(5, 7), 16); };
  set(256, '#0d0b12');
  if (dim === 1) { set(9, '#e9e5b1'); set(42, '#dcd79f'); set(41, '#cdc78f'); set(43, '#b5af78'); set(40, '#0d0b12'); }
  return (PAL[dim] = t);
}
// the same colours as one 32-bit pixel each (RGBA in memory order), to fill map images in one write per pixel
const PAL32 = {};
function paletteFor32(dim) {
  if (PAL32[dim]) return PAL32[dim];
  const t = paletteFor(dim), out = new Uint32Array(257), b = new Uint8Array(out.buffer);
  for (let i = 0; i < 257; i++) { b[i*4] = t[i*3]; b[i*4+1] = t[i*3+1]; b[i*4+2] = t[i*3+2]; b[i*4+3] = 255; }
  return (PAL32[dim] = out);
}

// Draw structure icons of the given keys. tile: light backing square behind each icon.
const RING = { bas_treasure: '#e8b628', bas_units: '#3e9ee0', bas_hoglin: '#e0773a', bas_bridge: '#8f8fa0' };
const DRAW_ORDER = ['trial', 'village', 'monument', 'outpost', 'pyramid', 'hut', 'retgate', 'endcity', 'mansion', 'ancient', 'fortress', 'bas_units', 'bas_hoglin', 'bas_bridge', 'bas_treasure', 'gatexit', 'gateway', 'endship', 'stronghold'];
let ICON_ORDER = null;
// the dark square with its soft shadow, drawn once per size (a canvas shadow is slow to draw icon by icon)
const BACKS = new Map();
function iconBack(sz, d) {
  const k = sz + '|' + d; let b = BACKS.get(k);
  if (b) return b;
  const pad = 3 * d, m = 8 * d, w = Math.ceil(sz + 2 * pad + 2 * m), c = document.createElement('canvas'); c.width = c.height = w;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 5 * d; g.shadowOffsetY = 1 * d;
  g.fillStyle = 'rgba(14,16,15,.9)'; g.beginPath(); g.roundRect(m, m, sz + 2 * pad, sz + 2 * pad, 4 * d); g.fill();
  if (BACKS.size > 40) BACKS.clear();
  BACKS.set(k, b = { c, off: sz / 2 + pad + m });
  return b;
}
// igloos with a basement (a zombie villager and a golden apple in the chest): a small golden apple on the icon
const APPLE = new Image();
APPLE.onerror = () => { if (!APPLE.dataset.f) { APPLE.dataset.f = 1; APPLE.src = TEX_SOURCES[1] + 'item/golden_apple.png'; } };
APPLE.onload = () => { if (typeof xMap !== 'undefined') xMap.draw(); if (typeof findMap !== 'undefined') findMap.draw(); };
APPLE.src = TEX_SOURCES[0] + 'item/golden_apple.png';
const BASEMENT = new Map();
function iglooBasement(q) {   // the igloo's own random numbers: turn, then basement (half of them); see js/06b2-structs2.js
  const seed = parseSeed($('seed').value); if (seed === null || typeof chunkRand === 'undefined') return false;
  const k = seed + ',' + q.x + ',' + q.z;
  if (!BASEMENT.has(k)) { if (BASEMENT.size > 5000) BASEMENT.clear(); const r = chunkRand(BigInt(seed), q.x >> 4, q.z >> 4); r.nextInt(4); BASEMENT.set(k, r.nextDouble() < 0.5); }
  return BASEMENT.get(k);
}
// abandoned camps with a secret chest: a small chest on the icon. Each camp is put together like the game does it
// (js/06d-jigsaw.js), with the exact biome at its tent asked from the engine, a batch at a time.
const SECRET = new Map(); let secretQ = [], secretT = 0;
function campSecret(M, q) {
  const seed = parseSeed($('seed').value); if (seed === null || typeof campBuild === 'undefined' || !verAtLeast(VER, '26.3')) return false;
  const k = VER + ',' + seed + ',' + q.x + ',' + q.z, v = SECRET.get(k);
  if (v !== undefined) return v === true;
  if (SECRET.size > 5000) SECRET.clear();
  SECRET.set(k, 'wait'); secretQ.push([k, seed, q.x, q.z]);
  if (!secretT) secretT = setTimeout(flushSecret, 60);
  return false;
}
async function flushSecret() {
  const list = secretQ.splice(0, 400); secretT = list.length && secretQ.length ? setTimeout(flushSecret, 60) : 0;
  const guess = list.map(([k, seed, x, z]) => campBuild(seed, x, z, 'forest'));   // the tent's middle (the same place for nearly all biomes)
  const bs = await exactBiomes(guess.map(C => [C.A.center[0], SURFACE_Y, C.A.center[2]]));
  list.forEach(([k, seed, x, z], i) => {
    const C = CAMP_BIOMES.includes(bs[i]) && campBuild(seed, x, z, bs[i]);
    SECRET.set(k, !!C && C.conts.some(c => /secret/.test(c.table)));
  });
  xMap.draw(); findMap.draw();
}
function drawIcons(M, keys, sizeFor, tile) {
  const { ctx, cv } = M, d = drawScale();
  const order = ICON_ORDER || (ICON_ORDER = ALL_STRUCTS.slice().sort((a, b) => DRAW_ORDER.indexOf(a.key) - DRAW_ORDER.indexOf(b.key)));
  for (const s of order) {
    if (!keys.has(s.key) || !M.structs[s.key]) continue;
    const sz = sizeFor(s.key) * d, ic = ICONS[s.key];
    for (const q of M.structs[s.key].values()) {
      const [x, y] = M.scr(q.x, q.z);
      if (x < -30 || y < -30 || x > cv.width + 30 || y > cv.height + 30) continue;
      const done = typeof isDone === 'function' && isDone(s.key, q);
      if (done && doneHide) continue;
      const t = tile(s.key, sz);
      if (t) {   // dark square behind the icon; its border is the bastion colour, or the colour asked for (t)
        const pad = 3 * d, back = iconBack(sz, d);
        ctx.drawImage(back.c, x - back.off, y - back.off);
        ctx.beginPath(); ctx.roundRect(x - sz/2 - pad, y - sz/2 - pad, sz + 2*pad, sz + 2*pad, 4 * d);
        const ring = RING[s.key];
        ctx.lineWidth = (ring || typeof t === 'string' ? 2.5 : 1.5) * d; ctx.strokeStyle = ring || (typeof t === 'string' ? t : 'rgba(245,247,244,.85)'); ctx.stroke();
      } else if (M === xMap) {
        const ring = RING[s.key];
        ctx.beginPath(); ctx.arc(x, y, sz / 2 + 3 * d, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(14,16,15,.88)'; ctx.fill(); ctx.lineWidth = (ring ? 2.5 : 1.5) * d; ctx.strokeStyle = ring || 'rgba(245,247,244,.9)'; ctx.stroke();
      }
      if (ic) ctx.drawImage(ic.canvas, x - sz/2, y - sz/2, sz, sz);
      if (s.key === 'igloo' && APPLE.naturalWidth && iglooBasement(q)) { ctx.imageSmoothingEnabled = false; ctx.drawImage(APPLE, x - sz * 0.05, y - sz * 0.05, sz * 0.6, sz * 0.6); }
      if (done) doneMark(ctx, x, y, sz, d);
      if (s.key === 'camp' && ICONS.bas_treasure && campSecret(M, q)) { ctx.imageSmoothingEnabled = false; ctx.drawImage(ICONS.bas_treasure.canvas, x - sz * 0.05, y - sz * 0.05, sz * 0.6, sz * 0.6); }
    }
  }
}
// a done structure: its icon dimmed, a green tick in the corner
function doneMark(g, x, y, sz, d) {
  const r = sz / 2 + 3 * d;
  g.fillStyle = 'rgba(10,12,11,.62)'; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  const cx = x + r * 0.78, cy = y - r * 0.78;
  g.beginPath(); g.arc(cx, cy, 6.5 * d, 0, Math.PI * 2); g.fillStyle = '#2e9e3e'; g.fill(); g.lineWidth = 1.5 * d; g.strokeStyle = '#000'; g.stroke();
  g.beginPath(); g.moveTo(cx - 3.2 * d, cy); g.lineTo(cx - 0.9 * d, cy + 2.4 * d); g.lineTo(cx + 3.3 * d, cy - 2.6 * d); g.strokeStyle = '#fff'; g.lineWidth = 1.8 * d; g.stroke();
}
function structAt(M, keys, sx, sy, radius) {
  const d = drawScale(); let best = null, bd = radius * d;
  for (const s of ALL_STRUCTS) {
    if (!keys.has(s.key) || !M.structs[s.key]) continue;
    for (const q of M.structs[s.key].values()) {
      if (doneHide && typeof isDone === 'function' && isDone(s.key, q)) continue;   // hidden: not clickable either
      const [x, y] = M.scr(q.x, q.z), dd = Math.hypot(x - sx, y - sy);
      if (dd < bd) { bd = dd; best = { ...q, key: s.key, name: s.name }; }
    }
  }
  return best;
}
function diamond(ctx, x, y, r, fill) {
  const d = drawScale();
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = fill; ctx.strokeStyle = '#0b1a11'; ctx.lineWidth = 2.5 * d;
  ctx.beginPath(); ctx.rect(-r * d, -r * d, 2 * r * d, 2 * r * d); ctx.fill(); ctx.stroke(); ctx.restore();
}

