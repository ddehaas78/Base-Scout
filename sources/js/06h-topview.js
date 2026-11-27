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
const hasTop = S => S.pieces.some(p => p.top && p.top.length);
// draw the plan's pieces into the canvas #ptop (the plan view: pv, js/06c-plan.js)
async function topDraw(S) {
  const cv = $('ptop'); if (!cv || !pv) return;
  const data = await topData(), V = pv;
  let s = 16; while (s > 2 && (V.W * s > 8192 || V.H * s > 8192 || V.W * V.H * s * s > 24e6)) s /= 2;   // pixels per block: as sharp as the browser allows
  const list = [];
  for (const p of S.pieces) for (const t of p.top || []) list.push([p.b0[1], t]);
  list.sort((a, b) => a[0] - b[0]);   // lower pieces first
  const used = new Set();
  for (const [, [i]] of list) { const at = TOP_AT[i]; if (at < 0) continue; const [sx, , sz] = JIG.temps[i].size; for (let c = 0; c < sx * sz; c++) { const v = data[at + 2 * c] | data[at + 2 * c + 1] << 8; if (v) used.add(v >> 1); } }
  const tex = new Map(await Promise.all([...used].map(async n => [n, await topTexture(TOP_TEX[n - 1])]))), ground = S.ground && await topTexture(S.ground);
  if (pv !== V || $('ptop') !== cv) return;   // another plan was opened meanwhile
  cv.width = V.W * s; cv.height = V.H * s;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  if (ground) {   // villages and camps stand on grass, sand or snow
    for (let z = 0; z < V.H; z++) for (let x = 0; x < V.W; x++) g.drawImage(ground, x * s, z * s, s, s);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, cv.width, cv.height);
  }
  const walls = [];
  for (const [, [i, rot, pos]] of list) {
    const at = TOP_AT[i]; if (at < 0) continue;
    const [sx, , sz] = JIG.temps[i].size;
    for (let z = 0, c = 0; z < sz; z++) for (let x = 0; x < sx; x++, c++) {
      const v = data[at + 2 * c] | data[at + 2 * c + 1] << 8; if (!v) continue;
      const w = turnPos([x, 0, z], rot), px = (w[0] + pos[0] - V.x0) * s, pz = (w[2] + pos[2] - V.z0) * s, im = tex.get(v >> 1);
      if (im) g.drawImage(im, px, pz, s, s); else { g.fillStyle = '#777'; g.fillRect(px, pz, s, s); }
      if (v & 1) walls.push(px, pz);
    }
  }
  g.fillStyle = 'rgba(0,0,0,.45)';
  for (let k = 0; k < walls.length; k += 2) g.fillRect(walls[k], walls[k + 1], s, s);
  cv.classList.add('on');
}
