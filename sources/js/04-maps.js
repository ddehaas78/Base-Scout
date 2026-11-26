// ---------- maps ----------
// Each map loads in layers: every pan or zoom asks for the area on screen at a detail level that fits,
// so zooming out shows more world instead of black edges. One request at a time per map.
const SCALES = [4, 16, 64, 256];
const maps = {};
function MapView(o) {
  const cv = o.canvas, ctx = cv.getContext('2d');
  const M = { name: o.name, cv, ctx, layers: [], structs: {}, view: { s: 0.25, ox: 0, oy: 0 }, gen: 0, busy: 0, again: false, n: 0, req: 0 };
  maps[o.name] = M;
  M.reset = () => { M.layers = []; M.structs = {}; M.gen++; M.busy = 0; M.again = false; };
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
  M.request = force => {
    const seed = o.seed();
    if (seed == null || !o.active() || cv.width < 4 || !ready) return;
    if (M.busy) { M.again = true; return; }
    const v = M.view, x0 = v.ox, z0 = v.oy, x1 = v.ox + cv.width / v.s, z1 = v.oy + cv.height / v.s;
    const span = Math.max(x1 - x0, z1 - z0);
    let S = SCALES.find(q => span * 1.3 / q <= 700) || 256;
    if (!M.layers.length) {   // empty map (new seed): a rough pass first so something shows at once, the detailed one follows
      const rough = SCALES[Math.min(SCALES.indexOf(S) + 1, SCALES.length - 1)];
      if (rough > S) { S = rough; M.again = true; }
    }
    const keys = o.keys(S, span), sig = keys.join(',') + '|' + JSON.stringify(o.ver());
    if (!force && M.layers.some(L => L.scale <= S && L.sig === sig && L.bx0 <= x0 && L.bz0 <= z0 && L.bx1 >= x1 && L.bz1 >= z1)) return;
    M.busy = ++M.req;
    (mapReady ? mapWorker : worker).postMessage({ type: 'area', seed, ver: o.ver(), dim: o.dim ? o.dim() : 0, tag: M.name + ':' + M.gen + ':' + M.req, x: Math.round((x0 + x1) / 2), z: Math.round((z0 + z1) / 2),
      scale: S, halfX: Math.round((x1 - x0) * 0.65), halfZ: Math.round((z1 - z0) * 0.65), keys, sig });
  };
  M.onArea = m => {
    const [, gen, req] = String(m.tag).split(':').map(Number);
    if (req === M.busy) M.busy = 0;
    if (gen === M.gen) {
      const c = document.createElement('canvas'); c.width = m.W; c.height = m.H;
      const g = c.getContext('2d'), d = g.createImageData(m.W, m.H);
      const lut = paletteFor32(m.dim || 0), px = new Uint32Array(d.data.buffer), grid = m.grid;
      for (let k = 0, n = m.W * m.H; k < n; k++) { const b = grid[k]; px[k] = lut[b < 0 ? 256 : b]; }
      g.putImageData(d, 0, 0);
      M.layers.push({ scale: m.scale, cx0: m.cx0, cz0: m.cz0, W: m.W, H: m.H, grid: m.grid, img: c, sig: m.sig, n: ++M.n,
        bx0: m.cx0 * m.scale, bz0: m.cz0 * m.scale, bx1: (m.cx0 + m.W) * m.scale, bz1: (m.cz0 + m.H) * m.scale });
      if (M.layers.length > 12) {   // forget the oldest detailed layer first
        const old = M.layers.filter(L => L.scale <= 16).sort((a, b) => a.n - b.n)[0] || M.layers.slice().sort((a, b) => a.n - b.n)[0];
        M.layers.splice(M.layers.indexOf(old), 1);
      }
      M.layers.sort((a, b) => b.scale - a.scale || a.n - b.n);   // coarse first, fine on top
      for (const [k, list] of Object.entries(m.structs)) {
        const have = M.structs[k] || (M.structs[k] = new Map());
        for (const q of list) have.set(q.x + ',' + q.z, q);
      }
      M.draw();
      if (o.loaded) o.loaded(M);
    }
    if (!M.busy && M.again) { M.again = false; M.request(false); }
  };
  M.draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0a0d0b'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    for (const L of M.layers) { const [ix, iy] = M.scr(L.bx0, L.bz0); ctx.drawImage(L.img, ix, iy, (L.bx1 - L.bx0) * M.view.s, (L.bz1 - L.bz0) * M.view.s); }
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
  M.changed = () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; M.draw(); });
    clearTimeout(viewT); viewT = setTimeout(() => M.request(false), 200);
  };
  M.zoomAt = (sx, sy, f) => {
    const ns = Math.max(Math.max(cv.width, cv.height) / (typeof o.maxSpan === 'function' ? o.maxSpan() : o.maxSpan), Math.min(12, M.view.s * f)), [wx, wz] = M.toWorld(sx, sy);
    M.view.s = ns; M.view.ox = wx - sx / ns; M.view.oy = wz - sy / ns; M.changed();
  };
  // pan, pinch, wheel, click, hover
  const pts = new Map(); let downAt = null;
  const local = e => { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d]; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); downAt = [e.clientX, e.clientY]; });
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
function drawIcons(M, keys, sizeFor, tile) {
  const { ctx, cv } = M, d = drawScale();
  const order = ICON_ORDER || (ICON_ORDER = ALL_STRUCTS.slice().sort((a, b) => DRAW_ORDER.indexOf(a.key) - DRAW_ORDER.indexOf(b.key)));
  for (const s of order) {
    if (!keys.has(s.key) || !M.structs[s.key]) continue;
    const sz = sizeFor(s.key) * d, ic = ICONS[s.key];
    for (const q of M.structs[s.key].values()) {
      const [x, y] = M.scr(q.x, q.z);
      if (x < -30 || y < -30 || x > cv.width + 30 || y > cv.height + 30) continue;
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
    }
  }
}
function structAt(M, keys, sx, sy, radius) {
  const d = drawScale(); let best = null, bd = radius * d;
  for (const s of ALL_STRUCTS) {
    if (!keys.has(s.key) || !M.structs[s.key]) continue;
    for (const q of M.structs[s.key].values()) {
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

