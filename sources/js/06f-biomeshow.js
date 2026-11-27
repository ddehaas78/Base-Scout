// ---------- Seed map, "Show on map" > Biomes: outline the biomes you pick ----------
// the biome ids behind each chip (same groups as the Spot finder; copied from worker.js)
const MAP_BIOME_IDS = {
  plains: [1, 129], meadow: [177], cherry: [185], flower: [132], forest: [4], birch: [27, 155], dark: [29], pale: [186],
  taiga: [5, 32, 160], jungle: [21, 23], bamboo: [168], savanna: [35, 36, 163], desert: [2], badlands: [37, 38, 165],
  swamp: [6], mangrove: [184], mushroom: [14], snowy: [12, 30], icespikes: [140], peaks: [180, 181, 182],
  slopes: [178, 179], windswept: [3, 131, 34], ocean: [0, 24, 10, 44, 45, 46, 47, 48, 49, 50], warmocean: [44, 47],
  river: [7, 11], beach: [16, 26], dappled: [187],
  dripstone: [174], lush: [175], deepdark: [183], sulfur: [188],
  sunflower: [129], snowytaiga: [30], oldbirch: [155], oldpine: [32], oldspruce: [160], sparsejungle: [23], savplateau: [36], wsavanna: [163], woodbad: [38], eroded: [165], grove: [178], jagged: [180], frozenpeaks: [181], stonypeaks: [182], wforest: [34], gravelly: [131], stonyshore: [25], snowybeach: [26], frozenriver: [11], deepocean: [24, 48, 49, 50], lukewarm: [45, 48], coldocean: [46, 49], frozenocean: [10, 50],
  nwastes: [8], soulsand: [170], crimson: [171], warped: [172], basalt: [173],
};
let showTab = 'structure', shownBiomes = new Set();
try { shownBiomes = new Set(JSON.parse(localStorage.getItem('basescout.shownBiomes') || '[]')); } catch {}
const mapBiomes = () => (xDim === -1 ? NETHER_BIOMES : xDim === 0 ? BIOMES.filter(b => !b.cave) : []).filter(b => inVer(b.key));
function renderShowTab() {
  const bio = showTab === 'biome' && xDim !== 1;
  $('showS').setAttribute('aria-selected', !bio); $('showB').setAttribute('aria-selected', bio);
  $('showB').hidden = xDim === 1;   // the End has one biome look
  $('toggles').hidden = bio; document.querySelector('.showall').hidden = bio; $('btoggles').hidden = !bio; $('bHint').hidden = !bio;
  if ($('doneHide')) $('doneHide').closest('.donebar').hidden = bio;
  if (!bio) return;
  const box = $('btoggles'); box.innerHTML = '';
  let divided = false;
  for (const b of mapBiomes()) {
    if (b.minor && !divided) { divided = true; const d = document.createElement('div'); d.className = 'pdiv'; d.textContent = 'More biomes'; box.appendChild(d); }
    const t = document.createElement('button'); t.type = 'button'; t.className = 'tog';
    t.setAttribute('aria-pressed', shownBiomes.has(b.key));
    t.innerHTML = chipHTML({ kind: 'biome', key: b.key });
    t.onclick = () => { shownBiomes.has(b.key) ? shownBiomes.delete(b.key) : shownBiomes.add(b.key); try { localStorage.setItem('basescout.shownBiomes', JSON.stringify([...shownBiomes])); } catch {} renderShowTab(); xMap.draw(); };
    box.appendChild(t);
  }
}
$('showS').onclick = () => { showTab = 'structure'; renderShowTab(); };
$('showB').onclick = () => { showTab = 'biome'; renderShowTab(); };
// the outline: on the finest map tiles on screen, every cell edge between a picked biome and anything else
function drawBiomeOutlines(M) {
  if (!shownBiomes.size || xDim === 1 || !M.layers.length) return;
  const want = new Set([...shownBiomes].filter(k => mapBiomes().some(b => b.key === k)).flatMap(k => MAP_BIOME_IDS[k] || []));
  if (!want.size) return;
  const [ax, az] = M.toWorld(0, 0), [bx, bz] = M.toWorld(M.cv.width, M.cv.height);
  const seen = M.layers.filter(L => L.bx1 > ax && L.bx0 < bx && L.bz1 > az && L.bz0 < bz);
  if (!seen.length) return;
  const k = Math.min(...seen.map(L => L.scale)), tiles = seen.filter(L => L.scale === k);
  const idAt = (cx, cz) => {   // a cell of this scale, in whichever tile has it (null: not loaded, so no edge drawn)
    for (const L of tiles) { const i = cx - L.cx0, j = cz - L.cz0; if (i >= 0 && j >= 0 && i < L.W && j < L.grid.length / L.W) return L.grid[j * L.W + i]; }
    return null;
  };
  const { ctx } = M, d = drawScale(), fill = new Path2D(), edge = new Path2D();
  for (const L of tiles) {
    const H = L.grid.length / L.W;
    for (let j = 0; j < H; j++) for (let i = 0; i < L.W; i++) {
      if (!want.has(L.grid[j * L.W + i])) continue;
      const cx = L.cx0 + i, cz = L.cz0 + j, [x0, y0] = M.scr(cx * k, cz * k), [x1, y1] = M.scr((cx + 1) * k, (cz + 1) * k);
      if (x1 < 0 || y1 < 0 || x0 > M.cv.width || y0 > M.cv.height) continue;
      fill.rect(x0, y0, x1 - x0, y1 - y0);
      const out = (a, b) => { const v = idAt(a, b); return v !== null && !want.has(v); };
      if (out(cx, cz - 1)) { edge.moveTo(x0, y0); edge.lineTo(x1, y0); }
      if (out(cx, cz + 1)) { edge.moveTo(x0, y1); edge.lineTo(x1, y1); }
      if (out(cx - 1, cz)) { edge.moveTo(x0, y0); edge.lineTo(x0, y1); }
      if (out(cx + 1, cz)) { edge.moveTo(x1, y0); edge.lineTo(x1, y1); }
    }
  }
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,85,.16)'; ctx.fill(fill);
  ctx.lineJoin = 'round'; ctx.lineWidth = 3.5 * d; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.stroke(edge);
  ctx.lineWidth = 1.8 * d; ctx.strokeStyle = '#ffff55'; ctx.stroke(edge);
  ctx.restore();
}
renderShowTab();
