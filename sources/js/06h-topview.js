// ---------- structure plans drawn block by block: every piece from above with the game's textures (data: js/06d-topdata.js) ----------
// Like a floor plan: roofs and ceilings are lifted off, so rooms show their floor and what stands on it; walls are darker.

let TOP_DATA = null;   // the cells, unzipped once
function topData() {
  if (!TOP_DATA) TOP_DATA = new Response(new Blob([Uint8Array.from(atob(TOP_GZ), c => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip')))
    .arrayBuffer().then(b => new Uint8Array(b));
  return TOP_DATA;
}
const TOP_IMG = new Map();   // texture → a 16 × 16 canvas (painted its colour when it has one), or null
function topTexture(key) {
  if (!TOP_IMG.has(key)) TOP_IMG.set(key, new Promise(done => {
    const [path, tint] = key.split('|'), img = new Image();
    let k = 0;
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, img.width, img.width, 0, 0, 16, 16);   // animated textures (water): the first frame
      if (tint) {   // grey textures the game paints (grass, leaves, water)
        g.globalCompositeOperation = 'multiply'; g.fillStyle = '#' + tint; g.fillRect(0, 0, 16, 16);
        g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0, img.width, img.width, 0, 0, 16, 16);
      }
      done(c);
    };
    img.onerror = () => { if (++k < TEX_SOURCES.length) img.src = texUrl(path, k); else done(null); };
    img.src = texUrl(path, 0);
  }));
  return TOP_IMG.get(key);
}
const hasTop = S => S.key !== 'pyramid';   // every plan but the pyramid's own (js/06c-plan.js)
// a piece's cells → where each lands: [data start, size x, size z, (x, z) → [world x, world z]]
function topPiece(p) {
  const out = [];
  for (const [i, rot, pos] of p.top || []) {
    if (TOP_AT[i] < 0) continue;
    const [sx, , sz] = JIG.temps[i].size;
    out.push([TOP_AT[i], sx, sz, (x, z) => { const w = turnPos([x, 0, z], rot); return [w[0] + pos[0], w[2] + pos[2]]; }]);
  }
  if (p.topx && TOP_EXTRA[p.topx[0]]) {   // other pieces: turned (and mirrored) around their pivot, like the game's templates
    const [name, rot, mir, px, pz, vx, vz] = p.topx, [at, sx, sz] = TOP_EXTRA[name];
    out.push([at, sx, sz, (x, z) => { const w = turnPos([(mir ? -x : x) - vx, 0, z - vz], rot); return [px + vx + w[0], pz + vz + w[2]]; }]);
  }
  return out;
}
// draw the plan into the canvas #ptop (the plan view: pv, js/06c-plan.js). Pieces without block data (strongholds,
// mineshafts, fortresses...) are filled with their look's textures (LOOK), walls darker for rooms.
async function topDraw(S) {
  const cv = $('ptop'); if (!cv || !pv) return;
  const data = await topData(), V = pv;
  let s = 16; while (s > 2 && (V.W * s > 8192 || V.H * s > 8192 || V.W * V.H * s * s > 24e6)) s /= 2;   // pixels per block: as sharp as the browser allows
  const look = LOOK[planKind(S.key)], rooms = ['stronghold', 'fortress', 'jungle'].includes(planKind(S.key));
  const list = S.pieces.filter(p => !p.only3d).map((p, n) => ({ p, n, y: p.b0[1], cells: topPiece(p) })).sort((a, b) => (a.y - b.y) || (a.n - b.n));   // lower pieces first
  const keys = new Set(S.ground ? [S.ground] : []);
  for (const e of list) {
    if (!e.cells.length) { if (look) for (const t of look(e.p)[1]) keys.add(t); continue; }
    for (const [at, sx, sz] of e.cells) for (let c = 0; c < sx * sz; c++) { const v = data[at + 2 * c] | data[at + 2 * c + 1] << 8; if (v) keys.add(TOP_TEX[(v >> 1) - 1]); }
  }
  const tex = new Map(await Promise.all([...keys].map(async k => [k, await topTexture(k)])));
  if (pv !== V || $('ptop') !== cv) return;   // another plan was opened meanwhile
  cv.width = V.W * s; cv.height = V.H * s;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  if (S.ground && tex.get(S.ground)) {   // villages, camps, igloos... stand on grass, sand or snow
    const im = tex.get(S.ground);
    for (let z = 0; z < V.H; z++) for (let x = 0; x < V.W; x++) g.drawImage(im, x * s, z * s, s, s);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, cv.width, cv.height);
  }
  const dark = [];
  for (const e of list) {
    if (!e.cells.length) {   // no block data: the piece's box, filled
      if (!look) continue;
      const [, layers, dim] = look(e.p), [x0, , z0] = e.p.b0, [x1, , z1] = e.p.b1;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const px = (x - V.x0) * s, pz = (z - V.z0) * s;
        for (let k = layers.length - 1; k >= 0; k--) { const im = tex.get(layers[k]); if (im) g.drawImage(im, px, pz, s, s); }
        if (dim) { g.fillStyle = `rgba(0,0,0,${dim})`; g.fillRect(px, pz, s, s); }
        if (rooms && (x === x0 || x === x1 || z === z0 || z === z1)) dark.push(px, pz);
      }
      continue;
    }
    for (const [at, sx, sz, place] of e.cells) for (let z = 0, c = 0; z < sz; z++) for (let x = 0; x < sx; x++, c++) {
      const v = data[at + 2 * c] | data[at + 2 * c + 1] << 8; if (!v) continue;
      const [wx, wz] = place(x, z), px = (wx - V.x0) * s, pz = (wz - V.z0) * s, im = tex.get(TOP_TEX[(v >> 1) - 1]);
      if (im) g.drawImage(im, px, pz, s, s); else { g.fillStyle = '#777'; g.fillRect(px, pz, s, s); }
      if (v & 1) dark.push(px, pz);
    }
  }
  g.fillStyle = 'rgba(0,0,0,.45)';
  for (let k = 0; k < dark.length; k += 2) g.fillRect(dark[k], dark[k + 1], s, s);
  cv.classList.add('on');
}
