// ---------- structure plans in 3D: the "3D" button of the plan view ----------
// Loaded only when asked: the renderer is misode's deepslate (MIT), and the game's own files come from misode/mcmeta
// (block models, textures, and each piece's structure file). The pieces are put where the plan has them (js/06h-topview.js).

const D3_LIB = ['https://cdn.jsdelivr.net/npm/deepslate@0.27.3/dist/deepslate.umd.cjs', 'https://unpkg.com/deepslate@0.27.3/dist/deepslate.umd.cjs'];
const MCMETA = 'https://raw.githubusercontent.com/misode/mcmeta/';
const D3_SKIP = new Set(['minecraft:air', 'minecraft:structure_void', 'minecraft:jigsaw', 'minecraft:structure_block', 'minecraft:cave_air']);
const D3_LIMITS = '3D view: villages, camps and outposts stand on flat ground (the real hills are not known here). Big structures, like ancient cities, can be slow on a weak computer. The first time, about 4 MB of game files are downloaded.';

function d3Script(urls) {
  return new Promise((ok, bad) => {
    if (window.deepslate) return ok();
    const s = document.createElement('script'); s.src = urls[0];
    s.onload = () => ok(); s.onerror = () => urls.length > 1 ? d3Script(urls.slice(1)).then(ok, bad) : bad(new Error('3D library'));
    document.head.append(s);
  });
}
let D3_RES = null;   // the game's block models and textures, once
function d3Resources() {
  if (!D3_RES) D3_RES = (async () => {
    await d3Script(D3_LIB);
    const ds = window.deepslate, json = u => fetch(MCMETA + u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
    const [states, models, uv, atlas] = await Promise.all([json('26.3-summary/assets/block_definition/data.min.json'), json('26.3-summary/assets/model/data.min.json'),
      json('26.3-atlas/all/data.min.json'), new Promise((ok, bad) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = bad; i.src = MCMETA + '26.3-atlas/all/atlas.png'; })]);
    const defs = {}, mods = {};
    for (const id in states) defs['minecraft:' + id] = ds.BlockDefinition.fromJson(states[id]);
    for (const id in models) mods['minecraft:' + id] = ds.BlockModel.fromJson(models[id]);
    Object.values(mods).forEach(m => m.flatten({ getBlockModel: id => mods[id] }));
    let n = 1; while (n < Math.max(atlas.width, atlas.height)) n *= 2;
    const c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'); g.drawImage(atlas, 0, 0);
    const map = {};
    for (const id in uv) { const [u, v, du, dv] = uv[id], dv2 = du !== dv && id.startsWith('block/') ? du : dv; map[ds.Identifier.create(id).toString()] = [u / n, v / n, (u + du) / n, (v + dv2) / n]; }
    const tex = new ds.TextureAtlas(g.getImageData(0, 0, n, n), map);
    return {
      getBlockDefinition: id => defs[id.toString()], getBlockModel: id => mods[id.toString()],
      getTextureUV: id => tex.getTextureUV(id), getTextureAtlas: () => tex.getTextureAtlas(), getPixelSize: () => tex.getPixelSize(),
      getBlockFlags: () => ({ opaque: false }), getBlockProperties: () => null, getDefaultBlockProperties: () => null,
    };
  })().catch(e => { D3_RES = null; throw e; });
  return D3_RES;
}
const D3_PIECES = new Map();   // a structure file → its blocks [[x, y, z, name, properties]]
function d3Piece(name) {
  if (!D3_PIECES.has(name)) D3_PIECES.set(name, fetch(MCMETA + '26.3-data/data/minecraft/structure/' + name + '.nbt').then(r => r.arrayBuffer()).then(b => {
    const ds = window.deepslate, root = ds.NbtFile.read(new Uint8Array(b)).root;
    if (!root.has('palette') && root.has('palettes')) root.set('palette', root.getList('palettes').get(0));
    return ds.Structure.fromNbt(root).getBlocks().filter(b => !D3_SKIP.has(b.state.getName().toString()))
      .map(b => [b.pos[0], b.pos[1], b.pos[2], b.state.getName().toString(), b.state.getProperties()]);
  }).catch(() => []));
  return D3_PIECES.get(name);
}
// a block's own turn (stairs, doors, logs...): the piece's mirror (x flipped) then its quarter turns
const D3_CW = { north: 'east', east: 'south', south: 'west', west: 'north' };
function d3Turn(props, rot, mir) {
  const p = { ...props };
  if (mir) {
    if (p.facing === 'east' || p.facing === 'west') p.facing = p.facing === 'east' ? 'west' : 'east';
    if ('east' in p && 'west' in p) [p.east, p.west] = [p.west, p.east];
    if (p.rotation !== undefined) p.rotation = String((16 - +p.rotation) % 16);
    if (p.hinge) p.hinge = p.hinge === 'left' ? 'right' : 'left';
  }
  for (let i = 0; i < rot; i++) {
    if (D3_CW[p.facing]) p.facing = D3_CW[p.facing];
    if (D3_CW[p.horizontal_facing]) p.horizontal_facing = D3_CW[p.horizontal_facing];
    if (p.axis === 'x' || p.axis === 'z') p.axis = p.axis === 'x' ? 'z' : 'x';
    if ('north' in p && 'east' in p && 'south' in p && 'west' in p) [p.north, p.east, p.south, p.west] = [p.west, p.north, p.east, p.south];
    if (p.rotation !== undefined) p.rotation = String((+p.rotation + 4) % 16);
  }
  return p;
}
// every block of the plan, in the world: [[x, y, z, name, properties]]
async function d3Blocks(S) {
  const out = [], jobs = [];
  for (const p of S.pieces) {
    for (const [i, rot, pos] of p.top || []) jobs.push(d3Piece(JIG.names[i]).then(bs => { for (const [x, y, z, n, pr] of bs) { const w = turnPos([x, y, z], rot); out.push([w[0] + pos[0], w[1] + pos[1], w[2] + pos[2], n, d3Turn(pr, rot, 0)]); } }));
    if (p.topx) {
      const [name, rot, mir, px, pz, vx, vz, py = 0] = p.topx;
      jobs.push(d3Piece(name).then(bs => { for (const [x, y, z, n, pr] of bs) { const w = turnPos([(mir ? -x : x) - vx, 0, z - vz], rot); out.push([px + vx + w[0], py + y, pz + vz + w[2], n, d3Turn(pr, rot, mir)]); } }));
    }
  }
  await Promise.all(jobs);
  return out;
}
// column-major 4 × 4 matrices, like the renderer's
const m4mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const m4t = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
const m4rx = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const m4ry = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };

// roofs and ceilings off: in each column, the top blocks when there is air under them (a room), like the plan from above
function d3NoCeilings(blocks) {
  const cols = new Map();
  blocks.forEach((b, i) => { const k = b[0] + ',' + b[2]; let c = cols.get(k); if (!c) cols.set(k, c = []); c.push(i); });
  const off = new Set();
  for (const c of cols.values()) {
    c.sort((a, b) => blocks[b][1] - blocks[a][1]);   // top down
    let n = 1; while (n < c.length && blocks[c[n]][1] === blocks[c[n - 1]][1] - 1) n++;   // the top run
    if (n < c.length) for (let i = 0; i < n; i++) off.add(c[i]);   // more below, past some air: that run was a roof or a ceiling
  }
  return blocks.filter((b, i) => !off.has(i));
}
let D3 = null;   // the open 3D view
const has3d = S => S.pieces.some(p => (p.top && p.top.length) || p.topx);
async function d3Open(S) {
  if (!confirm(tr(D3_LIMITS))) return;
  const v = $('pview'); if (!v) return;
  d3Close();
  const box = document.createElement('div'); box.className = 'p3d'; box.id = 'p3d';
  box.innerHTML = `<canvas id="p3dc"></canvas><p class="p3dmsg" id="p3dmsg">${escH(tr('Loading the 3D view…'))}</p>
    <div class="p3dbar"><label class="check" for="p3droof"><input type="checkbox" id="p3droof" checked> <span>${escH(tr('No ceilings'))}</span></label><label>${escH(tr('Cut above'))} <input type="range" id="p3dcut" min="0" max="1" value="1"></label><button type="button" id="p3dback">${escH(tr('Top view'))}</button></div>`;
  v.append(box);
  $('p3dback').onclick = d3Close;
  const me = D3 = { S };
  try {
    const [res, blocks] = await Promise.all([d3Resources(), d3Resources().then(() => d3Blocks(S))]);
    if (D3 !== me) return;
    if (!blocks.length) throw new Error('no blocks');
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const b of blocks) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b[i]); hi[i] = Math.max(hi[i], b[i]); }
    const size = [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1];
    const open = d3NoCeilings(blocks);
    const build = cut => { const st = new window.deepslate.Structure(size); for (const [x, y, z, n, p] of $('p3droof').checked ? open : blocks) if (y - lo[1] <= cut) st.addBlock([x - lo[0], y - lo[1], z - lo[2]], n, p); return st; };
    const cv = $('p3dc'), gl = cv.getContext('webgl');
    if (!gl) throw new Error('webgl');
    const R = new window.deepslate.StructureRenderer(gl, build(size[1]), res, { chunkSize: 16, useInvisibleBlockBuffer: false });
    Object.assign(me, { R, cv, lo, size, yaw: 0.7, pitch: 0.6, dist: Math.max(size[0], size[2]) * 0.85 + 10, center: [size[0] / 2, size[1] / 2, size[2] / 2] });
    $('p3dmsg').remove();
    const cut = $('p3dcut'); cut.max = size[1] - 1; cut.value = size[1] - 1;
    $('p3droof').onchange = () => { R.setStructure(build(+cut.value)); d3Draw(); };
    let t = 0; cut.oninput = () => { clearTimeout(t); t = setTimeout(() => { R.setStructure(build(+cut.value)); d3Draw(); }, 120); };   // rebuilt when the slider stops
    let drag = null;   // only while a button is held: left turns, right zooms (drag up / down), Shift + left moves
    cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const zoom = e.buttons & 2, pan = !zoom && (e.buttons & 1) && e.shiftKey, turn = !zoom && (e.buttons & 1) && !e.shiftKey;
      if (!zoom && !pan && !turn) { drag = null; return; }   // the button was let go outside the view
      const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; drag[0] = e.clientX; drag[1] = e.clientY;
      if (zoom) me.dist = Math.max(4, Math.min(480, me.dist * Math.exp(dy * 0.01)));   // right button: drag down to go back, up to come closer
      else if (pan) { const k = me.dist / 400, c = Math.cos(me.yaw), s = Math.sin(me.yaw); me.center[0] -= (dx * c + dy * s) * k; me.center[2] -= (dx * s - dy * c) * k; }
      else { me.yaw += dx * 0.01; me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch + dy * 0.01)); }
      d3Draw();
    });
    const stop = () => { drag = null; };
    cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop); cv.addEventListener('lostpointercapture', stop);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); me.dist = Math.max(4, Math.min(480, me.dist * Math.exp(e.deltaY * 0.001))); d3Draw(); }, { passive: false });
    me.ro = new ResizeObserver(() => d3Draw()); me.ro.observe(cv);
    d3Draw();
  } catch (e) {
    console.error(e);
    if (D3 === me && $('p3dmsg')) $('p3dmsg').textContent = tr('The 3D view could not load (no internet, or WebGL is off).');
  }
}
function d3Draw() {
  const me = D3; if (!me || !me.R) return;
  if (me.raf) return;
  me.raf = requestAnimationFrame(() => {
    me.raf = 0;
    const { cv, R } = me, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    R.setViewport(0, 0, w, h);
    const view = m4mul(m4mul(m4mul(m4t(0, 0, -me.dist), m4rx(me.pitch)), m4ry(me.yaw)), m4t(-me.center[0], -me.center[1], -me.center[2]));
    R.drawStructure(view);
    const c = planCur && planCur.chests[planSel];   // the chest picked in the list: outlined
    if (c && c.y3 != null) R.drawOutline(view, [c.x - me.lo[0], c.y3 - me.lo[1], c.z - me.lo[2]]);
  });
}
function d3Close() {
  if (D3 && D3.ro) D3.ro.disconnect();
  D3 = null; const b = $('p3d'); if (b) b.remove();
}
