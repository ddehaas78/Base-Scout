// ---- Base Scout background search (runs in a Web Worker; also loadable in node for tests) ----
const CELL = 16, SAMPLE_Y = 80, TILE = 2048;
const SIM = 1.6;                  // close matches: every item within 1.6x its zone
const SEP = 300;                  // results at least this far apart

const STRUCT_IDS = { village: 5, trial: 24, ancient: 13, stronghold: -1, monument: 8, mansion: 9, outpost: 10, pyramid: 1,
  hut: 3,
  // the smaller ones, listed after the main structures
  treasure: 14, portal: 11, shipwreck: 7, trail: 23, jungle: 2, igloo: 4, ruins: 6, mineshaft: 15, well: 16, fossil: 40,
  geode: 17, camp: 41 };
const FOSSIL_DEEP = 42;
const BIOME_IDS = {
  plains: [1, 129], meadow: [177], cherry: [185], flower: [132], forest: [4], birch: [27, 155], dark: [29], pale: [186],
  taiga: [5, 32, 160], jungle: [21, 23], bamboo: [168], savanna: [35, 36, 163], desert: [2], badlands: [37, 38, 165],
  swamp: [6], mangrove: [184], mushroom: [14], snowy: [12, 30], icespikes: [140], peaks: [180, 181, 182],
  slopes: [178, 179], windswept: [3, 131, 34], ocean: [0, 24, 10, 44, 45, 46, 47, 48, 49, 50], warmocean: [44, 47],
  river: [7, 11], beach: [16, 26], dappled: [187],
  dripstone: [174], lush: [175], deepdark: [183], sulfur: [188],
  sunflower: [129], snowytaiga: [30], oldbirch: [155], oldpine: [32], oldspruce: [160], sparsejungle: [23], savplateau: [36], wsavanna: [163], woodbad: [38], eroded: [165], grove: [178], jagged: [180], frozenpeaks: [181], stonypeaks: [182], wforest: [34], gravelly: [131], stonyshore: [25], snowybeach: [26], frozenriver: [11], deepocean: [24, 48, 49, 50], lukewarm: [45, 48], coldocean: [46, 49], frozenocean: [10, 50],
  nwastes: [8], soulsand: [170], crimson: [171], warped: [172], basalt: [173],
};
const WATER = new Set([0, 24, 10, 44, 45, 46, 47, 48, 49, 50, 7, 11]);

let E = null, curSeed = null, curVer = null, curMc = 28, strongholds = null, jobId = 0;
// ver: { mc, ext } = the cubiomes version and the changes after 1.21.4 (see wrap.c / biomes.h)
const verKey = v => v ? v.mc + '.' + v.ext : '28.4';

const WASI = () => ({ fd_close: () => 0, fd_fdstat_get: () => 0, fd_prestat_get: () => 8, fd_prestat_dir_name: () => 28,
  fd_seek: () => 0, fd_write: () => 0, proc_exit: () => {} });
async function load(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, { wasi_snapshot_preview1: WASI() });
  E = instance.exports; E._initialize();
  const sbuf = E.alloc(4096); E.colors(sbuf);
  const colors = Array.from(new Uint8Array(E.memory.buffer, sbuf, 768));
  const names = [];
  for (let i = 0; i < 256; i++) { const p = E.biome_name(i), u = new Uint8Array(E.memory.buffer); let s = ''; for (let k = p; u[k]; k++) s += String.fromCharCode(u[k]); names.push(s.replace(/_/g, ' ')); }
  E.dealloc(sbuf);
  return { colors, names };
}
function useSeed(seed, ver) {
  const vk = verKey(ver);
  if (curVer !== vk) { const v = ver || { mc: 28, ext: 4 }; E.set_version(v.mc, v.ext); curVer = vk; curMc = v.mc; curSeed = null; island = null; gateCache = null; }
  if (curSeed === seed) return;
  E.set_seed(BigInt(seed)); curSeed = seed; strongholds = null;
}
function spawnPos() { const b = E.alloc(8); E.spawn(b); const a = new Int32Array(E.memory.buffer, b, 2); const p = { x: a[0], z: a[1] }; E.dealloc(b); return p; }
// Strongholds sit in 8 rings around 0, 0 (3, 6, 10, 15, 21, 28, 36 and 9 of them). Working out all 128 takes
// about 1.6 s, so only the rings that can reach the area asked for are worked out, more when a farther area needs them.
const SH_TOTAL = [3, 9, 19, 34, 55, 83, 119, 128];
const shInner = r => 16 * (88 + 192 * r) - 300;   // closest a stronghold of ring r can be to 0, 0 (with room for the biome nudge)
// Cheap pre-check (1.19.3+, cubiomes version above 23): are there n rough stronghold spots within reach of x, z?
// The real stronghold is at most 112 blocks (biome nudge) plus a few (chunk corner) from its rough spot.
function strongholdsMaybe(x, z, reach, n) {
  if (curMc <= 23) return true;
  const rings = (() => { let r = 0; while (r < 8 && shInner(r) <= Math.hypot(x, z) + reach) r++; return r; })();
  if (!rings) return false;
  const max = SH_TOTAL[rings - 1], b = E.alloc(8 * max), got = E.strongholds_rough(b, max), a = new Int32Array(E.memory.buffer, b, 2 * got);
  let k = 0; const R = reach + 140;
  for (let i = 0; i < got; i++) if ((a[2*i] - x) ** 2 + (a[2*i+1] - z) ** 2 <= R * R) k++;
  E.dealloc(b); return k >= n;
}
function strongholdsNear(x, z, R) {   // only the strongholds within R of x, z (cheaper than the full list)
  if (curMc <= 23) return getStrongholds(Math.hypot(x, z) + R).filter(p => Math.hypot(p.x - x, p.z - z) <= R);
  const b = E.alloc(8 * 16), n = E.strongholds_near(x, z, R, b, 16), a = new Int32Array(E.memory.buffer, b, 2 * n), out = [];
  for (let i = 0; i < n; i++) out.push({ x: a[2*i], z: a[2*i+1] });
  E.dealloc(b); return out;
}
function getStrongholds(dmax) {
  let rings = 0;
  while (rings < 8 && shInner(rings) <= dmax) rings++;
  if (strongholds && strongholds.rings >= rings) return strongholds.list;
  const max = rings ? SH_TOTAL[rings - 1] : 0;
  const b = E.alloc(8 * 200), n = max ? E.find_strongholds(2e9, b, max) : 0, a = new Int32Array(E.memory.buffer, b, 2 * n);
  const seen = new Set(), list = [];
  for (let i = 0; i < n; i++) { const k = a[2*i] + ',' + a[2*i+1]; if (!seen.has(k)) { seen.add(k); list.push({ x: a[2*i], z: a[2*i+1] }); } }
  E.dealloc(b); strongholds = { rings, list }; return list;
}
let sbuf = 0, curDim = 0;   // curDim: which dimension the search is in
const BAS_TYPES = { bas_units: 0, bas_hoglin: 1, bas_treasure: 2, bas_bridge: 3 };
function structsIn(key, x0, z0, x1, z1) {
  if (curDim === -1) {   // Nether: fortresses, and bastions split by type
    if (!sbuf) sbuf = E.alloc(20000 * 8);
    const isBas = key in BAS_TYPES, n = E.find_structs_dim(-1, isBas ? 19 : key === 'nportal' ? 12 : 18, x0, z0, x1 - 1, z1 - 1, sbuf, 20000);
    const a = new Int32Array(E.memory.buffer, sbuf, 2 * Math.max(0, n)).slice(), out = [];
    for (let i = 0; i < n; i++) { const x = a[2*i], z = a[2*i+1]; if (!isBas || (E.bastion_type(x, z) & 3) === BAS_TYPES[key]) out.push({ x, z }); }
    return out;
  }
  if (key === 'stronghold') return getStrongholds(Math.hypot(Math.max(Math.abs(x0), Math.abs(x1)), Math.max(Math.abs(z0), Math.abs(z1)))).filter(p => p.x >= x0 && p.x < x1 && p.z >= z0 && p.z < z1);
  if (!sbuf) sbuf = E.alloc(20000 * 8);
  const grab = (id, extra) => {
    const n = E.find_structs(id, x0, z0, x1 - 1, z1 - 1, sbuf, 20000);
    const a = new Int32Array(E.memory.buffer, sbuf, 2 * Math.max(0, n)), out = [];
    for (let i = 0; i < n; i++) out.push(extra ? { x: a[2*i], z: a[2*i+1], ...extra } : { x: a[2*i], z: a[2*i+1] });
    return out;
  };
  if (key === 'fossil') return grab(STRUCT_IDS.fossil).concat(grab(FOSSIL_DEEP, { deep: 1 }));
  return grab(STRUCT_IDS[key]);
}
// Biome grid at a scale; cell (0,0) has its north-west corner at block (cx0*scale, cz0*scale).
function biomes(scale, cx0, cz0, w, h, y = SAMPLE_Y) {
  const p = E.alloc(w * h * 4);
  if (curDim === -1) E.gen_rows_dim(-1, scale, cx0, cz0, w, 0, h, 16, p);   // Nether sampled at y 64
  else E.gen_rows(scale, cx0, cz0, w, 0, h, y, p);
  const g = new Int32Array(E.memory.buffer, p, w * h).slice();
  E.dealloc(p); return g;
}

// Cave biomes are underground: look at 4 depths (blocks 16, -8, -32, -56) and count the biome if it is at any of them.
const CAVE_KEYS = new Set(['dripstone', 'lush', 'deepdark', 'sulfur']), CAVE_Y = [4, -2, -8, -14];   // y in quarter blocks
function caveGrids(scale, cx0, cz0, w, h) { return CAVE_Y.map(y => biomes(scale, cx0, cz0, w, h, y)); }
function biomeMask(key, grid, caves) {   // caves: () => the cave grids, made only when a cave biome is asked for
  const ids = new Set(BIOME_IDS[key]), mask = new Uint8Array(grid.length);
  if (CAVE_KEYS.has(key)) { for (const g of caves()) for (let k = 0; k < mask.length; k++) if (ids.has(g[k])) mask[k] = 1; }
  else for (let k = 0; k < mask.length; k++) if (ids.has(grid[k])) mask[k] = 1;
  return mask;
}
const lazy = f => { let v; return () => v || (v = f()); };

function edt(mask, W, H) {
  const INF = 1e20, n = Math.max(W, H), out = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = mask[i] ? 0 : INF;
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const pass = (len, off, stride) => {
    for (let q = 0; q < len; q++) f[q] = out[off + q * stride];
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    for (let q = 0; q < len; q++) out[off + q * stride] = d[q];
  };
  for (let x = 0; x < W; x++) pass(H, x, W);
  for (let y = 0; y < H; y++) pass(W, y * W, 1);
  return out;
}

// Spiral of tile offsets, ring by ring, nearest first within each ring.
function* tileOrder() {
  yield [0, 0];
  for (let r = 1; ; r++) {
    const ring = [];
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r) ring.push([i, j]);
    ring.sort((a, b) => (a[0]**2 + a[1]**2) - (b[0]**2 + b[1]**2));
    yield* ring;
  }
}

// Score one tile. Returns local exact and close candidates with real distances.
// Several copies of one structure are matched to its nearest distinct structures:
// the closest copy goes to the smallest ring, the next to the next ring, and so on.
function searchTile(items, x0, z0, landOnly, RADII) {
  const bItems = items.filter(i => i.kind === 'biome');
  const groups = new Map();
  for (const it of items) if (it.kind === 'structure') {
    if (!groups.has(it.key)) groups.set(it.key, []);
    groups.get(it.key).push(RADII[it.zone]);
  }
  for (const g of groups.values()) g.sort((a, b) => a - b);
  const keys = [...groups.keys()];
  const padB = Math.max(0, ...bItems.map(i => RADII[i.zone] * SIM + (i.size || 0)));
  const x1 = x0 + TILE, z1 = z0 + TILE, TC = TILE / CELL, tc0x = Math.floor(x0 / CELL), tc0z = Math.floor(z0 / CELL);

  // 1. structures: cheap, rules out most tiles
  const slists = {};
  for (const k of keys) {
    const rs = groups.get(k), reach = rs[rs.length - 1] * SIM;
    slists[k] = structsIn(k, x0 - reach, z0 - reach, x1 + reach, z1 + reach);
    if (slists[k].length < rs.length) return { exact: [], close: [], stage: 1 };
  }
  // per cell: the k nearest distances for each structure kind
  const sd = keys.map(k => new Float32Array(TC * TC * groups.get(k).length));
  const cand = new Uint8Array(TC * TC);
  const near = new Float64Array(16);
  let mi = TC, ma = -1, mj = TC, mb = -1;
  for (let j = 0; j < TC; j++) for (let i = 0; i < TC; i++) {
    const bx = x0 + i * CELL + 8, bz = z0 + j * CELL + 8, c = j * TC + i;
    let ok = true;
    for (let a = 0; a < keys.length && ok; a++) {
      const rs = groups.get(keys[a]), K = rs.length, reach2 = (rs[K - 1] * SIM) ** 2;
      let n = 0;
      for (const p of slists[keys[a]]) {
        const d2 = (p.x - bx) ** 2 + (p.z - bz) ** 2;
        if (d2 > reach2) continue;
        if (n < K) { let q = n++; while (q > 0 && near[q - 1] > d2) { near[q] = near[q - 1]; q--; } near[q] = d2; }
        else if (d2 < near[K - 1]) { let q = K - 1; while (q > 0 && near[q - 1] > d2) { near[q] = near[q - 1]; q--; } near[q] = d2; }
      }
      if (n < K) { ok = false; break; }
      for (let q = 0; q < K; q++) {
        const d = Math.sqrt(near[q]);
        if (d > rs[q] * SIM) { ok = false; break; }
        sd[a][c * K + q] = d;
      }
    }
    if (!ok) continue;
    cand[c] = 1;
    if (i < mi) mi = i; if (i > ma) ma = i; if (j < mj) mj = j; if (j > mb) mb = j;
  }
  if (ma < 0) return { exact: [], close: [], stage: 2 };

  // 2. the biome grid around the candidates (no coarse pre-check: sampling every 64 blocks missed small patches)
  const padC = Math.ceil(padB / CELL);
  const gx0 = tc0x + mi - padC, gz0 = tc0z + mj - padC, GW = (ma - mi + 1) + 2 * padC, GH = (mb - mj + 1) + 2 * padC;

  const grid = biomes(CELL, gx0, gz0, GW, GH);
  // A sized biome only counts where a disc of that size fits inside it ("core" cells);
  // its distance is then measured to the edge of that disc.
  const bcores = [];
  const caves = lazy(() => caveGrids(CELL, gx0, gz0, GW, GH));
  const bfields = bItems.map(it => {
    const mask = biomeMask(it.key, grid, caves);
    const half = (it.size || 0) / 2;
    if (!half) { bcores.push(mask); return edt(mask, GW, GH); }
    const outside = new Uint8Array(GW * GH);   // not this biome, or the unknown edge of the grid
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      if (!mask[k] || i === 0 || j === 0 || i === GW - 1 || j === GH - 1) outside[k] = 1;
    }
    const inner = edt(outside, GW, GH), core = new Uint8Array(GW * GH), need = (half / CELL) ** 2;
    for (let k = 0; k < core.length; k++) if (mask[k] && inner[k] >= need) core[k] = 1;
    bcores.push(core);
    return edt(core, GW, GH);
  });
  const bdist = (b, gk) => {
    const f = bfields[b][gk]; if (f >= 1e19) return Infinity;
    return Math.max(0, Math.sqrt(f) * CELL - (bItems[b].size || 0) / 2);
  };

  const exact = [], close = [];
  for (let j = mj; j <= mb; j++) for (let i = mi; i <= ma; i++) {
    const c = j * TC + i;
    if (!cand[c]) continue;
    const gi = i - mi + padC, gj = j - mj + padC, gk = gj * GW + gi;
    if (landOnly && WATER.has(grid[gk])) continue;
    let pen = 0, compact = 0, ok = true;
    for (let a = 0; a < keys.length; a++) {
      const rs = groups.get(keys[a]), K = rs.length;
      for (let q = 0; q < K; q++) { const d = sd[a][c * K + q], r = rs[q]; if (d > r) pen += (d - r) / r; compact += d / r; }
    }
    for (let b = 0; b < bItems.length && ok; b++) {
      const r = RADII[bItems[b].zone], d = bdist(b, gk);
      if (d > r * SIM) { ok = false; break; }
      if (d > r) pen += (d - r) / r;
      compact += d / r;
    }
    if (!ok) continue;
    (pen === 0 ? exact : close).push({ gi, gj, gk, pen, compact });
  }
  const pick = (list, key, n) => {
    list.sort((a, b) => a[key] - b[key] || a.compact - b.compact);
    const out = [];
    for (const c of list) {
      if (out.some(o => (o.gi - c.gi) ** 2 + (o.gj - c.gj) ** 2 < (SEP / CELL) ** 2)) continue;
      out.push(c); if (out.length >= n) break;
    }
    return out;
  };
  const detail = c => {
    const x = (gx0 + c.gi) * CELL + 8, z = (gz0 + c.gj) * CELL + 8;
    let pen = 0, compact = 0;
    const hits = [];
    for (const k of keys) {
      const rs = groups.get(k);
      const sorted = slists[k].map(p => ({ x: p.x, z: p.z, d: Math.hypot(p.x - x, p.z - z) })).sort((a, b) => a.d - b.d);
      rs.forEach((r, q) => {
        const s = sorted[q], d = s ? s.d : Infinity;
        if (d > r) pen += Math.min(SIM, d / r) - 1;
        compact += Math.min(SIM, d / r);
        hits.push({ kind: 'structure', key: k, r, ...(s || { d: null }) });
      });
    }
    bItems.forEach((it, b) => {
      const core = bcores[b], half = (it.size || 0) / 2, r = RADII[it.zone], rr = Math.ceil((r * SIM + half) / CELL) + 1;
      let best = null;
      for (let j = Math.max(0, c.gj - rr); j <= Math.min(GH - 1, c.gj + rr); j++)
        for (let i = Math.max(0, c.gi - rr); i <= Math.min(GW - 1, c.gi + rr); i++) {
          if (!core[j * GW + i]) continue;
          const bx = (gx0 + i) * CELL + 8, bz = (gz0 + j) * CELL + 8, d = Math.max(0, Math.hypot(bx - x, bz - z) - half);
          if (!best || d < best.d) best = { x: bx, z: bz, d };
        }
      const d = best ? best.d : Infinity;
      if (d > r) pen += Math.min(SIM, d / r) - 1;
      compact += Math.min(SIM, d / r);
      hits.push({ kind: 'biome', key: it.key, r, size: it.size || 0, ...(best || { d: null }) });
    });
    return { x, z, biome: grid[c.gk], pen: +pen.toFixed(4), compact, hits };
  };
  const ex = pick(exact, 'compact', 4).map(detail), cl = pick(close, 'pen', 4).map(detail);
  return { exact: ex.filter(s => s.pen === 0), close: cl.concat(ex.filter(s => s.pen > 0)).filter(s => s.pen > 0), stage: 4 };
}

async function runSearch(msg, post) {
  const id = ++jobId;
  useSeed(msg.seed, msg.ver);
  const dim = msg.dim || 0, spawn = spawnPos();
  const spawnHere = dim === -1 ? { x: Math.floor(spawn.x / 8), z: Math.floor(spawn.z / 8) } : spawn;
  const start = msg.start === 'spawn' ? spawnHere : msg.start === 'custom' ? msg.custom : { x: 0, z: 0 };
  const border = dim === -1 ? 3_740_000 : 29_990_000;
  post({ type: 'begin', id, token: msg.token, spawn, start });
  if (!msg.items.length) { post({ type: 'done', id, token: msg.token, reason: 'empty' }); return; }
  const t0 = Date.now(); let tiles = 0, exactCount = 0;
  for (const [ti, tj] of tileOrder()) {
    if (id !== jobId) return;
    if (tiles < (msg.skipTiles || 0)) { tiles++; continue; }
    const x0 = Math.round(start.x - TILE / 2 + ti * TILE), z0 = Math.round(start.z - TILE / 2 + tj * TILE);
    if (Math.abs(x0) > border || Math.abs(z0) > border) continue;
    useSeed(msg.seed, msg.ver); curDim = dim;
    if (dim === -1) E.set_seed_dim(-1, BigInt(msg.seed));
    const r = searchTile(msg.items, x0, z0, msg.landOnly, msg.radii);
    tiles++; exactCount += r.exact.length;
    const reach = Math.max(Math.abs(ti), Math.abs(tj)) * TILE + TILE / 2;
    post({ type: 'tile', id, token: msg.token, tiles, reach, exact: r.exact, close: r.close, ms: Date.now() - t0 });
    if (msg.maxTiles && tiles >= (msg.skipTiles || 0) + msg.maxTiles) { post({ type: 'done', id, token: msg.token, reason: 'paused', tiles }); return; }
    await new Promise(res => setTimeout(res, 0));   // let a stop message in
  }
}

function area(msg) {
  const keepDim = curDim; curDim = 0;
  try { return areaOverworld(msg); } finally { curDim = keepDim; }
}
function areaOverworld(msg) {
  useSeed(msg.seed, msg.ver);
  const S = msg.scale || 4, hx = msg.halfX, hz = msg.halfZ;
  const cx0 = Math.floor((msg.x - hx) / S), cz0 = Math.floor((msg.z - hz) / S), W = Math.ceil(2 * hx / S), H = Math.ceil(2 * hz / S);
  const grid = biomes(S, cx0, cz0, W, H, msg.y);
  const bx0 = cx0 * S, bz0 = cz0 * S, bx1 = bx0 + W * S, bz1 = bz0 + H * S;
  const structs = {};
  for (const k of (msg.keys || Object.keys(STRUCT_IDS))) structs[k] = structsIn(k, bx0, bz0, bx1, bz1);
  return { type: 'area', dim: 0, tag: msg.tag, sig: msg.sig, x: msg.x, z: msg.z, scale: S, cx0, cz0, W, H, grid, structs };
}

// ---- Nether and End maps (separate generators in the wasm, so a running search is never disturbed) ----
const DIM_STRUCTS = { '-1': { fortress: 18, nportal: 12 }, '1': { endcity: 20, endship: 20 } };
let island = null;   // the End's main island, measured once per seed: { seed, x0, n, unit, h }
function mainIsland(seed) {
  if (island && island.seed === seed) return island;
  const unit = 4, n = 160, x0 = -n / 2, p = E.alloc(n * n * 4);   // 640 x 640 blocks around 0, 0
  E.end_height(x0, x0, n, n, unit, p);
  island = { seed, x0, n, unit, h: new Float32Array(E.memory.buffer, p, n * n).slice() };
  E.dealloc(p);
  return island;
}
let gateCache = null;   // the 20 gateways around the main island, per seed
function gateways(seed) {
  if (gateCache && gateCache.seed === seed) return gateCache.list;
  const o = E.alloc(80 * 4); E.end_gateways(o);
  const a = new Int32Array(E.memory.buffer, o, 80), list = [];
  for (let i = 0; i < 20; i++) list.push({ n: i + 1, sx: a[4*i], sz: a[4*i+1], dx: a[4*i+2], dz: a[4*i+3] });
  E.dealloc(o); gateCache = { seed, list };
  return list;
}
function areaDim(msg) {
  useSeed(msg.seed, msg.ver);
  const dim = msg.dim, seedBig = BigInt(msg.seed);
  E.set_seed_dim(dim, seedBig);
  let S = msg.scale || 4;
  if (dim === 1 && S > 16) S = 16;   // End biomes change per chunk; coarser looks like noise
  const hx = msg.halfX, hz = msg.halfZ;
  const cx0 = Math.floor((msg.x - hx) / S), cz0 = Math.floor((msg.z - hz) / S), W = Math.ceil(2 * hx / S), H = Math.ceil(2 * hz / S);
  const p = E.alloc(W * H * 4);
  E.gen_rows_dim(dim, S, cx0, cz0, W, 0, H, 16, p);   // Nether sampled at y 64
  const grid = new Int32Array(E.memory.buffer, p, W * H).slice();
  E.dealloc(p);
  if (dim === 1) {   // dark void: small-islands biome, and the central biome outside the main island
    const isl = mainIsland(msg.seed);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, b = grid[k];
      if (b === 40) { grid[k] = -1; continue; }
      if (b !== 9) continue;
      const bx = (cx0 + i) * S + S / 2, bz = (cz0 + j) * S + S / 2;
      const u = Math.floor(bx / isl.unit) - isl.x0, v = Math.floor(bz / isl.unit) - isl.x0;
      grid[k] = (u >= 0 && v >= 0 && u < isl.n && v < isl.n && isl.h[v * isl.n + u] > 0) ? 9 : -1;
    }
  }
  const bx0 = cx0 * S, bz0 = cz0 * S, bx1 = bx0 + W * S, bz1 = bz0 + H * S, structs = {};
  if (!sbuf) sbuf = E.alloc(20000 * 8);
  const keys = msg.keys || [];
  if (dim === 1 && (keys.includes('endcity') || keys.includes('endship'))) {
    // End cities, split by whether they have a ship; a ship is drawn where the ship itself is
    const n = E.find_structs_dim(1, 20, bx0, bz0, bx1 - 1, bz1 - 1, sbuf, 20000), a = new Int32Array(E.memory.buffer, sbuf, 2 * Math.max(0, n)).slice();
    const o = E.alloc(12), cities = [], ships = [];
    for (let i = 0; i < n; i++) {
      const x = a[2*i], z = a[2*i+1];
      if (E.end_city_ship(x, z, o)) { const s = new Int32Array(E.memory.buffer, o, 3); ships.push({ x: s[0], z: s[2], cx: x, cz: z }); }
      else cities.push({ x, z });
    }
    E.dealloc(o);
    if (keys.includes('endcity')) structs.endcity = cities;
    if (keys.includes('endship')) structs.endship = ships;
  }
  if (dim === 1 && (keys.includes('gateway') || keys.includes('gatexit'))) {
    const g = gateways(msg.seed);
    if (keys.includes('gateway')) structs.gateway = g.map(q => ({ x: q.sx, z: q.sz, n: q.n, dx: q.dx, dz: q.dz }));
    if (keys.includes('gatexit')) structs.gatexit = g.map(q => ({ x: q.dx, z: q.dz, n: q.n, sx: q.sx, sz: q.sz }));
  }
  const basKeys = ['bas_units', 'bas_hoglin', 'bas_treasure', 'bas_bridge'];   // bastion start piece 0..3
  if (dim === -1 && keys.some(k => basKeys.includes(k))) {
    const n = E.find_structs_dim(-1, 19, bx0, bz0, bx1 - 1, bz1 - 1, sbuf, 20000), a = new Int32Array(E.memory.buffer, sbuf, 2 * Math.max(0, n)).slice();
    const lists = basKeys.map(() => []);
    for (let i = 0; i < n; i++) { const x = a[2*i], z = a[2*i+1]; lists[E.bastion_type(x, z) & 3].push({ x, z }); }
    basKeys.forEach((k, t) => { if (keys.includes(k)) structs[k] = lists[t]; });
  }
  if (dim === 1 && keys.includes('retgate')) {   // natural gateways in the highlands, back to the main island
    const n = E.find_structs_dim(1, 21, bx0, bz0, bx1 - 1, bz1 - 1, sbuf, 20000), a = new Int32Array(E.memory.buffer, sbuf, 2 * Math.max(0, n)), out = [];
    for (let i = 0; i < n; i++) out.push({ x: a[2*i], z: a[2*i+1] });
    structs.retgate = out;
  }
  for (const k of keys) {
    if (dim === 1) continue;
    const id = DIM_STRUCTS[dim] && DIM_STRUCTS[dim][k]; if (!id) continue;
    const n = E.find_structs_dim(dim, id, bx0, bz0, bx1 - 1, bz1 - 1, sbuf, 20000), a = new Int32Array(E.memory.buffer, sbuf, 2 * Math.max(0, n)), out = [];
    for (let i = 0; i < n; i++) out.push({ x: a[2*i], z: a[2*i+1] });
    structs[k] = out;
  }
  return { type: 'area', dim, tag: msg.tag, sig: msg.sig, x: msg.x, z: msg.z, scale: S, cx0, cz0, W, H, grid, structs };
}


// ---- Seed finder: try random seeds, keep those whose rings are filled around a fixed point ----
// (spawn, 0, 0 or custom). Cheap checks first: where structures could be (no biomes), then the
// real structures, then biomes on a coarse grid, then the exact biome check.
let seedJob = 0;
function rawCount(key, x0, z0, x1, z1) {   // structures that could be here, before biome checks; -1 = unknown
  if (curDim === -1 || key === 'stronghold' || !(key in STRUCT_IDS)) return -1;
  if (!sbuf) sbuf = E.alloc(20000 * 8);
  const id = key === 'fossil' ? -1 : STRUCT_IDS[key];
  return id < 0 ? -1 : E.find_raw(id, x0, z0, x1, z1, sbuf, 20000);
}
function rawList(key, x0, z0, x1, z1) {
  const n = rawCount(key, x0, z0, x1, z1); if (n < 0) return null;
  const a = new Int32Array(E.memory.buffer, sbuf, 2 * n), out = [];
  for (let i = 0; i < n; i++) out.push({ x: a[2*i], z: a[2*i+1] });
  return out;
}
function groupsOf(items, RADII) {
  const groups = new Map();
  for (const it of items) if (it.kind === 'structure') { if (!groups.has(it.key)) groups.set(it.key, []); groups.get(it.key).push(RADII[it.zone]); }
  for (const g of groups.values()) g.sort((a, b) => a - b);
  return groups;
}
// Are the rings filled around (x, z)? Returns the details, or null.
function checkSpot(items, x, z, RADII, landOnly, quick) {
  const groups = groupsOf(items, RADII), hits = [];
  // 1. where structures could be, before any biome work (each ring needs a candidate close enough)
  if (quick) for (const [k, rs] of groups) {
    const R = rs[rs.length - 1], raw = rawList(k, x - R, z - R, x + R, z + R);
    if (!raw) continue;
    const d = raw.map(p => Math.hypot(p.x - x, p.z - z)).sort((a, b) => a - b);
    if (rs.some((r, q) => !(d[q] <= r))) return null;
  }
  // 2. the real structures (strongholds: rough spots first, the real ones cost about 12 ms each)
  const sh = groups.get('stronghold');
  if (sh && !strongholdsMaybe(x, z, sh[sh.length - 1], sh.length)) return null;
  for (const [k, rs] of groups) {
    const R = rs[rs.length - 1];
    const list = (k === 'stronghold' ? strongholdsNear(x, z, R) : structsIn(k, x - R, z - R, x + R + 1, z + R + 1)).map(p => ({ ...p, d: Math.hypot(p.x - x, p.z - z) })).sort((a, b) => a.d - b.d);
    for (let q = 0; q < rs.length; q++) {
      const p = list[q]; if (!p || p.d > rs[q]) return null;
      hits.push({ kind: 'structure', key: k, r: rs[q], x: p.x, z: p.z, d: p.d, ...(p.deep ? { deep: 1 } : {}) });
    }
  }
  // 3. biomes
  const bItems = items.filter(i => i.kind === 'biome');
  let here = null;
  if (bItems.length || landOnly) {
    const pad = Math.max(16, ...bItems.map(i => RADII[i.zone] + (i.size || 0) / 2));
    const c0x = Math.floor((x - pad) / 64), c0z = Math.floor((z - pad) / 64), cw = Math.ceil(2 * pad / 64) + 2;
    if (bItems.length) {   // coarse look (every 64 blocks): drop seeds where a biome is nowhere near
      const coarse = new Set(biomes(64, c0x, c0z, cw, cw));
      const coarseCave = lazy(() => new Set(caveGrids(64, c0x, c0z, cw, cw).flatMap(g => [...g])));
      if (bItems.some(it => !BIOME_IDS[it.key].some(b => (CAVE_KEYS.has(it.key) ? coarseCave() : coarse).has(b)))) return null;
    }
    const gx0 = Math.floor((x - pad) / CELL) - 1, gz0 = Math.floor((z - pad) / CELL) - 1, G = Math.ceil(2 * pad / CELL) + 3;
    const grid = biomes(CELL, gx0, gz0, G, G), ci = Math.floor(x / CELL) - gx0, cj = Math.floor(z / CELL) - gz0;
    here = grid[cj * G + ci];
    if (landOnly && WATER.has(here)) return null;
    const caves = lazy(() => caveGrids(CELL, gx0, gz0, G, G));
    for (const it of bItems) {
      const mask = biomeMask(it.key, grid, caves), half = (it.size || 0) / 2, r = RADII[it.zone];
      let core = mask;
      if (half) {   // only where a disc of that size fits inside the biome
        const outside = new Uint8Array(G * G);
        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const k = j * G + i; if (!mask[k] || !i || !j || i === G - 1 || j === G - 1) outside[k] = 1; }
        const inner = edt(outside, G, G), need = (half / CELL) ** 2;
        core = new Uint8Array(G * G); for (let k = 0; k < core.length; k++) if (mask[k] && inner[k] >= need) core[k] = 1;
      }
      let best = null;
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        if (!core[j * G + i]) continue;
        const bx = (gx0 + i) * CELL + 8, bz = (gz0 + j) * CELL + 8, d = Math.max(0, Math.hypot(bx - x, bz - z) - half);
        if (!best || d < best.d) best = { x: bx, z: bz, d };
      }
      if (!best || best.d > r) return null;
      hits.push({ kind: 'biome', key: it.key, r, size: it.size || 0, ...best });
    }
  }
  if (here === null) here = biomes(4, Math.floor(x / 4), Math.floor(z / 4), 1, 1)[0];
  return { x, z, biome: here, hits };
}
// Fixed spots: each pin is a structure that must be within pin.r blocks of pin.x, pin.z. Cheap looks first
// (where it could be, rough strongholds), then the real structures. Returns their hits, or null.
// The biome at a structure (surface; a cave biome: any of the depths searched). Returns the biome id when it is
// in one of the biomes asked for (or any biome when none was asked), else null.
function pinBiome(q, wants) {
  const cx = Math.floor(q.x / 4), cz = Math.floor(q.z / 4), here = biomes(4, cx, cz, 1, 1)[0];
  if (!wants || !wants.length) return here;
  const surf = new Set(wants.filter(k => !CAVE_KEYS.has(k)).flatMap(k => BIOME_IDS[k] || []));
  if (surf.has(here)) return here;
  const cave = new Set(wants.filter(k => CAVE_KEYS.has(k)).flatMap(k => BIOME_IDS[k] || []));
  if (cave.size) for (const g of caveGrids(4, cx, cz, 1, 1)) if (cave.has(g[0])) return g[0];
  return null;
}
// a biome spot: is that biome at x, z (or within 4 blocks, for edges)? Cave biomes: at any of the depths.
function biomeSpotOK(p) {
  const ids = new Set(BIOME_IDS[p.key] || []), cx = Math.floor(p.x / 4) - 1, cz = Math.floor(p.z / 4) - 1;
  const grids = CAVE_KEYS.has(p.key) ? caveGrids(4, cx, cz, 3, 3) : [biomes(4, cx, cz, 3, 3)];
  return grids.some(g => g.some(b => ids.has(b)));
}
function checkPins(pins) {
  for (const p of pins) if (p.kind === 'biome' && !biomeSpotOK(p)) return null;
  pins = pins.filter(p => p.kind !== 'biome');
  for (const p of pins) {
    const R = p.r || 24;
    if (p.key === 'stronghold') { if (!strongholdsMaybe(p.x, p.z, R, 1)) return null; continue; }
    const raw = rawList(p.key, p.x - R, p.z - R, p.x + R, p.z + R);
    if (raw && !raw.some(q => Math.hypot(q.x - p.x, q.z - p.z) <= R)) return null;
  }
  const hits = [];
  for (const p of pins) {
    let best = null;
    // r 0: "same chunk", the structure starts in the chunk typed (its position is that chunk's corner or middle)
    const R = p.r || 24, inChunk = q => Math.floor(q.x / 16) === Math.floor(p.x / 16) && Math.floor(q.z / 16) === Math.floor(p.z / 16);
    const cands = (p.key === 'stronghold' ? strongholdsNear(p.x, p.z, R) : structsIn(p.key, p.x - R, p.z - R, p.x + R + 1, p.z + R + 1))
      .map(q => ({ ...q, d: Math.hypot(q.x - p.x, q.z - p.z) })).filter(q => p.r ? q.d <= p.r : inChunk(q)).sort((a, b) => a.d - b.d);
    for (const q of cands) {   // the closest one in the biome asked for (if any)
      const b = pinBiome(q, p.biomes || (p.biome ? [p.biome] : null));
      if (b != null) { best = { ...q, biome: b }; break; }
    }
    if (!best) return null;
    hits.push({ kind: 'structure', key: p.key, pin: 1, r: p.r, x: best.x, z: best.z, d: best.d, biome: best.biome, ...(best.deep ? { deep: 1 } : {}) });
  }
  return hits;
}
const randomSeed = () => { const a = new BigUint64Array(1); crypto.getRandomValues(a); return BigInt.asIntN(64, a[0]).toString(); };
// One world seed against the fixed spots and the rings; returns the spot to show, or null.
function trySeed(seed, msg) {
  const dim = msg.dim || 0;
  useSeed(seed, msg.ver); curDim = dim;
  if (dim === -1) E.set_seed_dim(-1, BigInt(seed));
  const pins = msg.pins || [];
  const pinHits = pins.length ? checkPins(pins) : [];
  if (!pinHits) return null;
  if (!msg.items.length) {   // fixed spots only: shown at the first one
    const p = pinHits[0] || pins[0];
    return { x: p.x, z: p.z, biome: biomes(4, Math.floor(p.x / 4), Math.floor(p.z / 4), 1, 1)[0], hits: pinHits, pinsOnly: 1 };
  }
  let x = 0, z = 0;
  if (msg.start === 'custom') { x = msg.custom.x; z = msg.custom.z; }
  else if (msg.start === 'spawn') {
    if (dim === 0 && !checkSpotRawAround(msg, 2600)) return null;   // spawn is within ~2,600 of 0, 0
    const s = spawnPos(); x = dim === -1 ? Math.floor(s.x / 8) : s.x; z = dim === -1 ? Math.floor(s.z / 8) : s.z;
  }
  const spot = checkSpot(msg.items, x, z, msg.radii, msg.landOnly, true);
  if (spot) spot.hits = pinHits.concat(spot.hits);
  return spot;
}
// Fixed spots, step 1 in wasm: structure seeds (lower 48 bits) whose placement fits every pin.
function pinSpec(pins) {
  const spec = pins.map(p => p.kind === 'biome' ? -1 : p.key === 'stronghold' ? -2
    : (p.key in STRUCT_IDS && p.key !== 'fossil' && STRUCT_IDS[p.key] >= 0 && rawCount(p.key, 0, 0, 0, 0) >= 0) ? STRUCT_IDS[p.key] : -1);
  return spec.some(v => v !== -1) ? spec : null;
}
// ---- Crack a seed: find the exact seed of an existing world from structures seen in it ----
// Placement (1.18+): region size and how many chunks of it a structure can start in. Monument and mansion use a
// triangle spread (two rolls averaged); the others one roll per axis.
const CRACK_CFG = { village: [34, 26], trial: [34, 22], ancient: [24, 16], monument: [32, 27, 1], mansion: [80, 60, 1],
  outpost: [32, 24], pyramid: [32, 24], hut: [32, 24], shipwreck: [24, 20], trail: [34, 26], jungle: [32, 24],
  igloo: [32, 24], ruins: [20, 12], portal: [40, 25] };
// the chunks a structure typed at x, z (within r blocks) could start in, as region + chunk inside the region
function crackEntries(p) {
  const [rs, range] = CRACK_CFG[p.key], out = [];
  const c0x = Math.floor((p.x - p.r) / 16), c1x = Math.floor((p.x + p.r) / 16), c0z = Math.floor((p.z - p.r) / 16), c1z = Math.floor((p.z + p.r) / 16);
  for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
    const dx = Math.max(cx * 16 - p.x, 0, p.x - (cx * 16 + 15)), dz = Math.max(cz * 16 - p.z, 0, p.z - (cz * 16 + 15));
    if (dx * dx + dz * dz > p.r * p.r) continue;
    const rx = Math.floor(cx / rs), rz = Math.floor(cz / rs), ox = cx - rx * rs, oz = cz - rz * rs;
    if (ox < range && oz < range) out.push([rx, rz, ox, oz]);
  }
  return out;
}
let crackJob = 0;
async function runCrack(msg, post) {
  const id = ++crackJob, pins = msg.pins.filter(p => p.kind !== 'biome' && CRACK_CFG[p.key]), bioSpots = msg.pins.filter(p => p.kind === 'biome');
  useSeed('0', msg.ver); curDim = 0;
  const sid = { village: 5, trial: 24, ancient: 13, monument: 8, mansion: 9, outpost: 10, pyramid: 1, hut: 3, shipwreck: 7, trail: 23, jungle: 2, igloo: 4, ruins: 6, portal: 11 };
  const lists = pins.map(crackEntries);
  if (lists.some(l => !l.length)) { post({ type: 'crackdone', token: msg.token, error: 'One of the spots can never hold that structure (between two regions). Check its coordinates.' }); return; }
  // most telling first: fewest possible chunks
  const order = pins.map((p, i) => i).sort((a, b) => lists[a].length - lists[b].length);
  const n = order.length, hdr = E.alloc(12 * n), tot = order.reduce((a, i) => a + lists[i].length, 0), ent = E.alloc(16 * tot);
  const H = new Int32Array(E.memory.buffer, hdr, 3 * n), EN = new Int32Array(E.memory.buffer, ent, 4 * tot);
  let at = 0;
  order.forEach((i, j) => { H[3*j] = sid[pins[i].key]; H[3*j+1] = at; H[3*j+2] = lists[i].length; for (const e of lists[i]) { EN.set(e, 4 * at); at++; } });
  const MAXL = 4096, lo = E.alloc(4 * MAXL), hi = E.alloc(8 * 1024);
  const nL = E.crack_low(n, hdr, ent, lo, MAXL);
  const free = () => { E.dealloc(hdr); E.dealloc(ent); E.dealloc(lo); E.dealloc(hi); };
  if (nL < 0 || nL > MAXL) { free(); post({ type: 'crackdone', token: msg.token, error: 'Not enough structures that pin down the low bits: add temples, huts, igloos, outposts or shipwrecks.' }); return; }
  const Ls = Array.from(new Uint32Array(E.memory.buffer, lo, nL));
  // step 2: this worker's share of the 2^28 upper parts, for every low part
  const SPAN = 1 << 28, share = Math.ceil(SPAN / msg.of), H0 = msg.idx * share, H1 = Math.min(SPAN, H0 + share), STEP = 1 << 21;
  const total = nL * (H1 - H0); let done = 0, last = 0;
  const structSeeds = [];
  for (const L of Ls) {
    for (let h = H0; h < H1 && id === crackJob; h += STEP) {
      const cnt = Math.min(STEP, H1 - h), k = E.crack_high(L, h, cnt, n, hdr, ent, hi, 1024);
      for (const v of new BigUint64Array(E.memory.buffer, hi, Math.min(k, 1024))) structSeeds.push(v);
      done += cnt;
      if (Date.now() - last > 300) { post({ type: 'crackprog', token: msg.token, stage: 2, done, total, structs: structSeeds.length, lows: nL }); last = Date.now(); await new Promise(r => setTimeout(r, 0)); }
    }
  }
  free();
  post({ type: 'crack2done', token: msg.token, structs: structSeeds.map(String), lows: nL, stopped: id !== crackJob });
}
// step 3: the top 16 bits only change biomes. This worker takes every of-th value of them, for every structure
// seed found, and keeps the seeds where every biome spot and every structure (biome included) really fits.
async function runCrack3(msg, post) {
  const id = ++crackJob, pins = msg.pins.filter(p => p.kind !== 'biome' && CRACK_CFG[p.key]), bioSpots = msg.pins.filter(p => p.kind === 'biome');
  const list = msg.structs.map(v => BigInt(v)), per = Math.ceil(65536 / msg.of), total = list.length * per;
  let done = 0, last = 0;
  for (const s48 of list) {
    for (let t = msg.idx; t < 65536 && id === crackJob; t += msg.of) {
      const seed = BigInt.asIntN(64, (BigInt(t) << 48n) | s48).toString();
      useSeed(seed, msg.ver); curDim = 0; done++;
      let ok = bioSpots.every(biomeSpotOK), hits = [];   // biome spots first: cheap and very telling
      for (const p of ok ? pins : []) {
        const q = structsIn(p.key, p.x - p.r - 16, p.z - p.r - 16, p.x + p.r + 17, p.z + p.r + 17)
          .map(q => ({ ...q, d: Math.hypot(q.x - p.x, q.z - p.z) })).sort((a, b) => a.d - b.d)[0];
        if (!q || q.d > p.r + 24) { ok = false; break; }
        const b = pinBiome(q, p.biomes || (p.biome ? [p.biome] : null));
        if (b == null) { ok = false; break; }
        hits.push({ kind: 'structure', key: p.key, pin: 1, r: p.r, x: q.x, z: q.z, d: q.d, biome: b });
      }
      if (ok) post({ type: 'seedfound', token: msg.token, seed, spot: { x: hits[0] ? hits[0].x : 0, z: hits[0] ? hits[0].z : 0, biome: hits[0] ? hits[0].biome : 0, hits, pinsOnly: 1, cracked: 1 } });
      if (Date.now() - last > 300) { post({ type: 'crackprog', token: msg.token, stage: 3, done, total }); last = Date.now(); await new Promise(r => setTimeout(r, 0)); }
    }
  }
  post({ type: 'crackdone', token: msg.token, stopped: id !== crackJob });
}
const BATCH = 20000, PER_STRUCT = 2;   // tries per structure seed: fewer with a stronghold (each try costs ~12 ms)
async function runSeeds(msg, post) {
  const id = ++seedJob, t0 = Date.now(), pins = msg.pins || [];
  let tested = 0, lastPost = 0;
  const spec = pins.length && (msg.dim || 0) === 0 && E.pin_scan ? (useSeed('0', msg.ver), pinSpec(pins)) : null;
  let specPtr = 0, outPtr = 0, state = 0n; const queue = [], hiTries = pins.some(p => p.key === 'stronghold') ? 8 : 32;
  if (spec) {
    specPtr = E.alloc(4 * 4 * pins.length); outPtr = E.alloc(8 * 80);
    new Int32Array(E.memory.buffer, specPtr, 4 * pins.length).set(pins.flatMap((p, k) => [spec[k], p.x, p.z, p.r || 24]));
    state = BigInt.asUintN(48, BigInt(randomSeed()));
  }
  const found = (seed, spot) => post({ type: 'seedfound', token: msg.token, seed, spot });
  while (id === seedJob) {
    const end = Date.now() + 120;   // work in short slices so a stop message gets in
    while (Date.now() < end) {
      if (spec) {
        if (!queue.length) {
          // step 1: a batch of structure seeds, placement only
          const r = E.pin_scan(state, BATCH, pins.length, specPtr, outPtr, 64);
          const n = Math.abs(r), out = new BigUint64Array(E.memory.buffer, outPtr, n + 1);
          for (const lo of out.subarray(0, n)) queue.push({ lo, t: 0, got: 0 });
          state = out[n];
          tested += BATCH;   // each structure seed stands for 65,536 world seeds; counted once
          continue;
        }
        // step 2: the 16 upper bits decide the biomes, so the structures may or may not spawn there
        const q = queue[0];
        const seed = BigInt.asIntN(64, (BigInt(Math.floor(Math.random() * 65536)) << 48n) | q.lo).toString();
        q.t++;
        const spot = trySeed(seed, msg);
        if (spot) { found(seed, spot); q.got++; }
        if (q.t >= hiTries || q.got >= PER_STRUCT) queue.shift();
      } else {
        const seed = randomSeed(); tested++;
        const spot = trySeed(seed, msg);
        if (spot) found(seed, spot);
      }
      if (Date.now() >= end) break;
    }
    if (Date.now() - lastPost > 400) { post({ type: 'seedprog', token: msg.token, tested, ms: Date.now() - t0 }); lastPost = Date.now(); }
    await new Promise(r => setTimeout(r, 0));
  }
  if (spec) { E.dealloc(specPtr); E.dealloc(outPtr); }
  post({ type: 'seedprog', token: msg.token, tested, ms: Date.now() - t0, done: true });
}
// spawn mode pre-check around 0, 0: enough candidates within (ring + extra) of the origin?
function checkSpotRawAround(msg, extra) {
  for (const [k, rs] of groupsOf(msg.items, msg.radii)) {
    const R = rs[rs.length - 1] + extra, raw = rawList(k, -R, -R, R, R);
    if (raw && raw.length < rs.length) return false;
  }
  return true;
}

if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof module === 'undefined') {
  self.onmessage = async ev => {
    const m = ev.data;
    try {
      if (m.type === 'init') self.postMessage({ type: 'ready', ...(await load(m.wasm)) });
      else if (m.type === 'search') runSearch(m, d => self.postMessage(d));
      else if (m.type === 'stop') jobId++;
      else if (m.type === 'seeds') runSeeds(m, d => self.postMessage(d));
      else if (m.type === 'seedstop') { seedJob++; crackJob++; }
      else if (m.type === 'crack') runCrack(m, d => self.postMessage(d));
      else if (m.type === 'crack3') runCrack3(m, d => self.postMessage(d));
      else if (m.type === 'info') { useSeed(m.seed, m.ver); self.postMessage({ type: 'info', seed: m.seed, ver: verKey(m.ver), spawn: spawnPos() }); }
      else if (m.type === 'area') { const a = m.dim ? areaDim(m) : area(m); self.postMessage(a, [a.grid.buffer]); }
    } catch (err) { self.postMessage({ type: 'error', message: String(err && err.message || err) }); }
  };
}
if (typeof module !== 'undefined') module.exports = { _E: () => E, BIOME_IDS, checkPins, trySeed, areaDim, runCrack, crackEntries, CRACK_CFG, load, runSearch, area, searchTile, useSeed, checkSpot, runSeeds, seedStop: () => seedJob++ };
