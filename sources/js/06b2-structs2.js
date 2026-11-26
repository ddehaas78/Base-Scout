// ---------- more structures with chests: jungle temple, igloo, shipwreck, ruined portal, nether fortress, abandoned camp ----------
// (after xpple/cubiomes, MIT). Each returns a plan like js/06b-structs.js; lootStructure() hands these keys to LOOT_MORE.
Object.assign(LOOT_SALT, {
  jungle: [['1.19.4', 4, 4], ['26.3', 4, 22]],
  igloo: [['1.19.4', 4, 3], ['26.3', 4, 21]],
  shipwreck: [['1.19.4', 4, 17], ['26.3', 4, 35]],
  shipwreck_beached: [['1.19.4', 4, 18], ['26.3', 4, 36]],
  portal: [['1.19.4', 4, 10], ['26.3', 4, 28]],   // the standard ruined portal; the others below
  portal_desert: [['1.19.4', 4, 11], ['26.3', 4, 29]],
  portal_jungle: [['1.19.4', 4, 12], ['26.3', 4, 30]],
  portal_mountain: [['1.19.4', 4, 13], ['26.3', 4, 31]],
  portal_nether: [['1.19.4', 4, 14], ['26.3', 4, 32]],
  portal_ocean: [['1.19.4', 4, 15], ['26.3', 4, 33]],
  portal_swamp: [['1.19.4', 4, 16], ['26.3', 4, 34]],
  fortress: [['1.19.4', 7, 1]],
  camp: [['26.3', 4, 0]],   // the index depends on the biome: CAMP_BIOMES
});
const LOOT_MORE = {};
// a piece box from a corner and a size, turned like the game turns single-piece structures (pivot at the corner)
const turnBox = (x, z, sx, sz, rot) => { const c = [[0, 0], [-(sz - 1), 0], [-(sx - 1), -(sz - 1)], [0, -(sx - 1)]][rot], w = rot % 2 ? sz : sx, d = rot % 2 ? sx : sz; return { b0: [x + c[0], 0, z + c[1]], b1: [x + c[0] + w - 1, 0, z + c[1] + d - 1] }; };
// seeds for chests placed by "data markers" (shipwreck, end city): in each chunk, one number per chest is used first, then each chest's seed
function markerSeeds(ws, chests, salt, pre) {
  const byChunk = new Map();
  chests.forEach((c, i) => { const k = (c.x >> 4) + ',' + (c.z >> 4); if (!byChunk.has(k)) byChunk.set(k, []); byChunk.get(k).push(i); });
  for (const idx of byChunk.values()) {
    const c0 = chests[idx[0]], r = chunkXoro(ws, c0.x, c0.z, salt);
    if (pre) pre(r);
    for (let i = 0; i < idx.length; i++) r.nextLongJ();
    for (const i of idx) chests[i].seed = r.nextLongJ();
  }
}

// ---- jungle temple: 2 arrow dispensers on the traps, 2 chests ----
LOOT_MORE.jungle = (ws, x, z, ver) => {
  const salt = lootSalt('jungle', ver); if (!salt) return null;
  const minX = x & ~15, minZ = z & ~15, facing = lootFacing(ws, minX >> 4, minZ >> 4);
  const world = (lx, lz) => facing === 'north' ? [minX + lx, minZ + 14 - lz] : facing === 'south' ? [minX + lx, minZ + lz] : facing === 'west' ? [minX + 14 - lz, minZ + lx] : [minX + lz, minZ + lx];
  const r = chunkXoro(ws, minX, minZ, salt), seeds = [];
  r.skip(1511); seeds.push(r.nextLongJ()); seeds.push(r.nextLongJ()); seeds.push(r.nextLongJ()); r.skip(11); seeds.push(r.nextLongJ());   // after the temple's blocks
  const spots = [[3, 1, 'chests/jungle_temple_dispenser', 1], [9, 3, 'chests/jungle_temple_dispenser', 1], [8, 3, 'chests/jungle_temple'], [7, 10, 'chests/jungle_temple']];
  const chests = spots.map(([lx, lz, table, disp], i) => { const [cx, cz] = world(lx, lz); return { x: cx, z: cz, table, seed: seeds[i], disp: !!disp }; });
  const b = facing === 'east' || facing === 'west' ? { b0: [minX, 0, minZ], b1: [minX + 14, 0, minZ + 11] } : { b0: [minX, 0, minZ], b1: [minX + 11, 0, minZ + 14] };
  return { facing, chests, pieces: [{ t: 0, ...b }] };
};

// ---- igloo: the chest is in the basement, which only some igloos have ----
LOOT_MORE.igloo = (ws, x, z, ver) => {
  const salt = lootSalt('igloo', ver); if (!salt) return null;
  const minX = x & ~15, minZ = z & ~15, r = chunkRand(ws, minX >> 4, minZ >> 4);
  const o = r.nextInt(4), basement = r.nextDouble() < 0.5, size = r.nextInt(8) + 4, rot = o & 1, mirror = o >> 1;
  const top = rot ? { b0: [minX, 0, minZ], b1: [minX + 7, 0, minZ + 6] } : { b0: [minX, 0, minZ], b1: [minX + 6, 0, minZ + 7] };
  if (!basement) return { chests: [], pieces: [{ t: 0, ...top }], note: 'This igloo has no basement, so no chest.' };
  const [dx, dz] = [[1, 4], [5, 6], [4, 3], [2, 7]][(rot << 1) | mirror];
  const xr = chunkXoro(ws, minX, minZ, salt); xr.nextLongJ();
  return { chests: [{ x: minX + dx, z: minZ + dz, table: 'chests/igloo_chest', seed: xr.nextLongJ() }], pieces: [{ t: 1, b0: [minX - 1, 0, minZ - 2], b1: [minX + 8, 0, minZ + 7] }, { t: 0, ...top }], depth: 3 + size * 3 };
};

// ---- shipwreck: 20 kinds of wreck (11 on beaches), each with its own chests ----
const SW = [   // [name, size x, y, z, chests [table, x, z]]
  ['with_mast', 9, 21, 28, [['supply', 4, 9], ['map', 5, 18], ['treasure', 6, 24]]], ['upsidedown_full', 9, 9, 28, [['treasure', 2, 24], ['map', 3, 17], ['supply', 4, 8]]],
  ['upsidedown_fronthalf', 9, 9, 22, [['map', 3, 17], ['supply', 4, 8]]], ['upsidedown_backhalf', 9, 9, 16, [['treasure', 2, 12], ['map', 3, 5]]],
  ['sideways_full', 9, 9, 28, [['treasure', 3, 24], ['supply', 5, 8], ['map', 6, 19]]], ['sideways_fronthalf', 9, 9, 24, [['supply', 5, 8]]],
  ['sideways_backhalf', 9, 9, 17, [['treasure', 3, 13], ['map', 6, 8]]], ['rightsideup_full', 9, 9, 28, [['supply', 4, 8], ['map', 5, 18], ['treasure', 6, 24]]],
  ['rightsideup_fronthalf', 9, 9, 24, [['supply', 4, 8]]], ['rightsideup_backhalf', 9, 9, 16, [['map', 5, 6], ['treasure', 6, 12]]]];
const SW_BEACHED = [0, 4, 5, 6, 7, 8, 9, 10, 17, 18, 19];   // the kinds a beached wreck picks from (10 and up: the same, degraded)
const isOcean = b => /ocean/.test(b || '');
LOOT_MORE.shipwreck = (ws, x, z, ver, biome) => {
  const beached = !isOcean(biome), salt = lootSalt(beached ? 'shipwreck_beached' : 'shipwreck', ver); if (!salt) return null;
  const minX = x & ~15, minZ = z & ~15, r = chunkRand(ws, minX >> 4, minZ >> 4), rot = r.nextInt(4);
  const kind = beached ? SW_BEACHED[r.nextInt(11)] : r.nextInt(20), [name, sx, , sz, list] = SW[kind % 10];
  const [ox, oz] = [[0, 0], [19, 11], [8, 30], [-11, 19]][rot], px = minX + ox, pz = minZ + oz;   // the corner, turned around (4, 15)
  const turn = (a, b) => [[a, b], [-b, a], [-a, -b], [b, -a]][rot];
  const chests = list.map(([t, a, b]) => { const [dx, dz] = turn(a, b); return { x: px + dx, z: pz + dz, table: 'chests/shipwreck_' + t }; });
  markerSeeds(ws, chests, salt, beached ? xr => xr.nextIntJ(3) : null);   // a beached wreck first sinks 0 to 2 blocks into the sand
  const [ex, ez] = turn(sx, sz), box = { b0: [Math.min(px, px + ex), 0, Math.min(pz, pz + ez)], b1: [Math.max(px, px + ex) - 1, 0, Math.max(pz, pz + ez) - 1] };
  return { chests, pieces: [{ t: kind >= 10 ? 1 : 0, ...box }], beached, kindName: name };
};

// ---- ruined portal: the chest is near the portal; only its chunk is known for sure ----
const PORTAL_TYPE = b => {
  if (!b) return 'portal';
  if (b === 'desert') return 'portal_desert';
  if (/jungle/.test(b)) return 'portal_jungle';
  if (b === 'swamp' || b === 'mangrove_swamp') return 'portal_swamp';
  if (/ocean/.test(b)) return 'portal_ocean';
  if (/badlands|windswept|savanna_plateau|stony_shore|meadow|peaks|snowy_slopes|cherry_grove/.test(b)) return 'portal_mountain';
  return 'portal';
};
const PORTAL_SIZE = [[6, 6], [9, 9], [8, 9], [8, 9], [10, 7], [5, 7], [9, 9], [14, 9], [10, 9], [12, 10]], GIANT_SIZE = [[11, 16], [11, 16], [16, 16]];
function portalPlan(ws, x, z, ver, type) {
  const salt = lootSalt(type, ver); if (!salt) return null;
  const minX = x & ~15, minZ = z & ~15, r = chunkRand(ws, minX >> 4, minZ >> 4), old = !verAtLeast(ver, '26.3');
  if (type === 'portal' || type === 'portal_mountain') { const under = r.nextFloat() < 0.5; if (!under && old) r.nextFloat(); }
  else if (type === 'portal_jungle' && old) r.nextFloat();
  const giant = r.nextFloat() < 0.05, start = giant ? 1 + r.nextInt(3) : 1 + r.nextInt(10), rot = r.nextInt(4), mirror = r.nextFloat() >= 0.5;
  const [sx, sz] = (giant ? GIANT_SIZE : PORTAL_SIZE)[start - 1], hx = Math.trunc(sx / 2), hz = Math.trunc(sz / 2);
  const s0 = [[0, 0], [hx + hz, hz - hx], [hx + hx, hz + hz], [hx - hz, hx + hz]][rot], mx = mirror ? -sx : sx;
  const e = [[mx, sz], [s0[0] - sz, s0[1] + mx], [s0[0] - mx, s0[1] - sz], [s0[0] + sz, s0[1] - mx]][rot];
  const ox = s0[0], oz = s0[1], wx = e[0] - s0[0], wz = e[1] - s0[1];
  const ccx = (minX + ox + Math.trunc(wx / 2)) & ~15, ccz = (minZ + oz + Math.trunc(wz / 2)) & ~15;   // the chunk of the portal's middle
  const box = { b0: [minX + Math.min(ox, ox + wx), 0, minZ + Math.min(oz, oz + wz)], b1: [minX + Math.max(ox, ox + wx) - 1, 0, minZ + Math.max(oz, oz + wz) - 1] };
  const cxm = (box.b0[0] + box.b1[0]) >> 1, czm = (box.b0[2] + box.b1[2]) >> 1;
  return { chests: [{ x: cxm, z: czm, table: 'chests/ruined_portal', seed: chunkXoro(ws, ccx, ccz, salt).nextLongJ(), near: true }], pieces: [{ t: giant ? 1 : 0, ...box }], giant };
}
LOOT_MORE.portal = (ws, x, z, ver, biome) => portalPlan(ws, x, z, ver, PORTAL_TYPE(biome));
LOOT_MORE.nportal = (ws, x, z, ver) => portalPlan(ws, x, z, ver, 'portal_nether');

// ---- nether fortress: chests in some corridor turns ----
// [offset, size, repeatable, weight, how many at most]
const NF = [[[0, 0, 0], [18, 9, 18], 0, 0, 0], [[-1, -3, 0], [4, 9, 18], 1, 30, 0], [[-8, -3, 0], [18, 9, 18], 0, 10, 4], [[-2, 0, 0], [6, 8, 6], 0, 10, 4], [[-2, 0, 0], [6, 10, 6], 0, 10, 3],
  [[-2, 0, 0], [6, 7, 8], 0, 5, 2], [[-5, -3, 0], [12, 13, 12], 0, 5, 1], [[-1, 0, 0], [4, 6, 4], 1, 25, 0], [[-1, 0, 0], [4, 6, 4], 0, 15, 5], [[-1, 0, 0], [4, 6, 4], 0, 5, 10],
  [[-1, 0, 0], [4, 6, 4], 0, 5, 10], [[-1, -7, 0], [4, 13, 9], 1, 10, 3], [[-3, 0, 0], [8, 6, 8], 0, 7, 2], [[-5, -3, 0], [12, 13, 12], 0, 5, 2], [[-1, -3, 0], [4, 9, 7], 0, 0, 0]];
const [NF_START, NF_BRIDGE, NF_BCROSS, NF_FORT, NF_BSTAIRS, NF_SPAWNER, NF_ENTRANCE, NF_CORR, NF_CCROSS, NF_RIGHT, NF_LEFT, NF_CSTAIRS, NF_T, NF_WART, NF_END] = NF.keys();
function fortressPieces(ws, cx, cz, nmax = 2000) {
  const r = chunkRand(ws, cx, cz), list = [], queue = [], ntyp = new Array(15).fill(0);
  let last = 0;
  const add = (t, x, y, z, depth, f, pending) => {
    const [d0, d1] = NF[t], b0 = [x, y + d0[1], z], b1 = [x, y + d0[1] + d1[1], z];
    if (f === 0) { b0[0] += d0[0]; b0[2] += d0[2] - d1[2]; b1[0] += d0[0] + d1[0]; b1[2] += d0[2]; }
    else if (f === 1) { b0[0] += d0[2]; b0[2] += d0[0]; b1[0] += d0[2] + d1[2]; b1[2] += d0[0] + d1[0]; }
    else if (f === 2) { b0[0] += d0[0]; b0[2] += d0[2]; b1[0] += d0[0] + d1[0]; b1[2] += d0[2] + d1[2]; }
    else { b0[0] += d0[2] - d1[2]; b0[2] += d0[0]; b1[0] += d0[2]; b1[2] += d0[0] + d1[0]; }
    if (list.some(q => boxesHit(q.b0, q.b1, b0, b1))) return null;
    const p = { t, pos: [x, y, z], b0, b1, rot: f, depth, chest: false };
    if (t === NF_LEFT || t === NF_RIGHT) p.chest = r.nextInt(3) === 0;
    else if (t === NF_END) r.next(32);
    if (pending) { list.push(p); ntyp[t]++; if (t !== NF_END) last = t; queue.push(p); }
    return p;
  };
  const extend = (p, offh, offv, turn, corridor) => {
    const depth = p.depth + 1, t0 = corridor ? NF_CORR : NF_BRIDGE, t1 = t0 + (corridor ? 7 : 6);
    let facing = p.rot, x, z, valid = -1, total = 0;
    const y = p.b0[1] + offv;
    if (turn === 0) [x, z] = [[p.b0[0] + offh, p.b0[2] - 1], [p.b1[0] + 1, p.b0[2] + offh], [p.b0[0] + offh, p.b1[2] + 1], [p.b0[0] - 1, p.b0[2] + offh]][facing];
    else if (turn === -1) { if (facing & 1) { x = p.b0[0] + offh; z = p.b0[2] - 1; facing = 0; } else { x = p.b0[0] - 1; z = p.b0[2] + offh; facing = 3; } }
    else { if (facing & 1) { x = p.b0[0] + offh; z = p.b1[2] + 1; facing = 2; } else { x = p.b1[0] + 1; z = p.b0[2] + offh; facing = 1; } }
    if (Math.abs(x - list[0].b0[0]) <= 112 && Math.abs(z - list[0].b0[2]) <= 112) {
      valid = 0;
      for (let t = t0; t < t1; t++) { const max = NF[t][4]; if (max > 0 && ntyp[t] >= max) continue; if (max > 0) valid = 1; total += NF[t][3]; }
      if (valid !== 0 && total > 0 && depth <= 30) {
        for (let i = 0; i < 5; i++) {
          let n = r.nextInt(total);
          for (let t = t0; t < t1; t++) {
            const max = NF[t][4]; if (max > 0 && ntyp[t] >= max) continue;
            n -= NF[t][3]; if (n >= 0) continue;
            if (last === t && !NF[t][2]) break;
            if (add(t, x, y, z, depth, facing, true)) return;
          }
        }
      }
    }
    add(NF_END, x, y, z, depth, facing, valid >= 0);
  };
  const grow = p => {
    switch (p.t) {
      case NF_BRIDGE: extend(p, 1, 3, 0, 0); break;
      case NF_BCROSS: case NF_START: extend(p, 8, 3, 0, 0); extend(p, 8, 3, -1, 0); extend(p, 8, 3, 1, 0); break;
      case NF_FORT: extend(p, 2, 0, 0, 0); extend(p, 2, 0, -1, 0); extend(p, 2, 0, 1, 0); break;
      case NF_BSTAIRS: extend(p, 2, 6, 1, 0); break;
      case NF_ENTRANCE: extend(p, 5, 3, 0, 1); break;
      case NF_CORR: case NF_CSTAIRS: extend(p, 1, 0, 0, 1); break;
      case NF_CCROSS: extend(p, 1, 0, 0, 1); extend(p, 1, 0, -1, 1); extend(p, 1, 0, 1, 1); break;
      case NF_RIGHT: extend(p, 1, 0, 1, 1); break;
      case NF_LEFT: extend(p, 1, 0, -1, 1); break;
      case NF_T: { const h = p.rot === 0 || p.rot === 3 ? 5 : 1; extend(p, h, 0, -1, r.nextInt(8) !== 0); extend(p, h, 0, 1, r.nextInt(8) !== 0); break; }
      case NF_WART: extend(p, 5, 3, 0, 1); extend(p, 5, 11, 0, 1); break;
    }
  };
  const pos = [cx * 16 + 2, 64, cz * 16 + 2];
  const start = { t: NF_START, pos, b0: pos.slice(), b1: [pos[0] + 18, pos[1] + 9, pos[2] + 18], rot: r.nextInt(4), depth: 0 };
  list.push(start); ntyp[0] = 1; last = 0;
  grow(start);
  while (queue.length && list.length < nmax) grow(queue.splice(r.nextInt(queue.length), 1)[0]);
  return list;
}
LOOT_MORE.fortress = (ws, x, z, ver) => {
  const salt = lootSalt('fortress', ver); if (!salt) return null;
  const pieces = fortressPieces(ws, x >> 4, z >> 4), chests = [];
  for (const p of pieces) {
    if (!p.chest) continue;
    const [a, b] = p.t === NF_LEFT ? [3, 3] : [1, 3], bx = p.pos[0] - 1, bz = p.pos[2] - 1;
    const [cx, cz] = [[bx + a, bz + b], [bx - b, bz + a], [bx - a, bz - b], [bx + b, bz - a]][p.rot];
    chests.push({ x: cx, z: cz, table: 'chests/nether_bridge', seed: chunkXoro(ws, cx, cz, salt).nextLongJ() });
  }
  return { pieces: pieces.filter(p => p.t !== NF_END), chests };
};

// ---- abandoned camp (26.3): a tent and a campsite, with chests and barrels; where they stand is only roughly known ----
const CAMP_BIOMES = ['bamboo_jungle', 'birch_forest', 'cherry_grove', 'dappled_forest', 'flower_forest', 'forest', 'meadow', 'old_growth_birch_forest', 'old_growth_pine_taiga',
  'old_growth_spruce_taiga', 'pale_garden', 'savanna', 'snowy_taiga', 'sparse_jungle', 'swamp', 'taiga', 'windswept_forest', 'wooded_badlands'];
// what each tent (1-10, by biome) and campsite (1-45 shared, 46-49 by biome) holds: c common chest, s secret chest, b barrel
const CAMP_DATA = {"tent":{"bamboo_jungle":{"1":"b","3":"b","2":"bbb","4":"bb","10":"bb","5":"c","8":"c","9":"c","6":"cc","7":"cb"},"birch_forest":{"1":"c","2":"c","4":"c","5":"c","9":"c","3":"b","6":"b","7":"b","8":"b","10":"bb"},"cherry_grove":{"1":"c","2":"c","4":"c","5":"c","7":"c","8":"c","3":"b","6":"ccc","9":"cc","10":"bb"},"dappled_forest":{"1":"b","3":"b","2":"bbb","4":"bb","10":"bb","5":"c","7":"c","8":"c","9":"c","6":"bc"},"flower_forest":{"1":"b","2":"c","3":"c","4":"c","5":"c","6":"c","8":"c","9":"c","7":"bb","10":"bb"},"forest":{"1":"b","2":"b","3":"b","10":"b","4":"bbb","5":"c","6":"c","8":"c","9":"c","7":"bb"},"meadow":{"1":"c","3":"c","7":"c","10":"c","2":"bbbb","4":"bb","5":"b","6":"b","8":"b","9":"b"},"old_growth_birch_forest":{"1":"c","2":"c","3":"c","4":"c","5":"c","6":"b","7":"b","8":"b","9":"b","10":"b"},"old_growth_pine_taiga":{"1":"b","3":"b","2":"bb","4":"bb","5":"c","6":"c","8":"c","9":"c","10":"c","7":"cb"},"old_growth_spruce_taiga":{"1":"b","2":"b","3":"b","9":"b","4":"bb","10":"bb","5":"c","6":"c","8":"c","7":"cb"},"pale_garden":{"1":"c","5":"c","6":"c","8":"c","9":"c","2":"b","3":"b","7":"b","4":"bb","10":"bb"},"savanna":{"1":"c","2":"c","3":"c","4":"c","5":"c","6":"b","7":"b","8":"b","9":"b","10":"b"},"snowy_taiga":{"1":"c","4":"c","10":"c","2":"bbb","3":"b","5":"b","6":"b","7":"b","8":"b","9":"b"},"sparse_jungle":{"1":"b","3":"b","2":"bb","4":"bb","10":"bb","5":"c","8":"c","6":"ccc","7":"cb","9":"cc"},"swamp":{"1":"b","2":"b","3":"b","4":"b","5":"b","6":"c","8":"c","9":"c","10":"c","7":"cb"},"taiga":{"1":"c","3":"c","5":"c","6":"c","7":"c","2":"b","4":"b","8":"b","9":"b","10":"bb"},"windswept_forest":{"1":"b","4":"b","6":"b","7":"b","9":"b","2":"bb","10":"bb","3":"c","5":"c","8":"c"},"wooded_badlands":{"1":"bbbb","2":"b","3":"b","5":"b","4":"bb","10":"bb","6":"c","7":"c","8":"c","9":"cc"}},"camp":{"1":"c","2":"c","3":"c","4":"c","5":"c","6":"sc","7":"sc","8":"sc","9":"sc","10":"sc","11":"c","12":"c","13":"c","14":"c","15":"c","16":"b","17":"b","18":"b","19":"b","20":"b","21":"b","22":"b","23":"b","24":"b","25":"b","26":"sb","27":"sb","28":"sb","29":"sb","30":"sb","31":"sc","32":"c","33":"c","34":"sb","35":"b","36":"sb","37":"b","38":"sb","39":"c","40":"cc","41":"c","42":"b","43":"sc","44":"b","45":"bc"},"campBiome":{"bamboo_jungle":{"1":"c","2":"b","3":"sc","4":"b"},"birch_forest":{"1":"c","2":"c","3":"cbb","4":"c"},"cherry_grove":{"1":"c","2":"b","3":"sc","4":"sbbb"},"dappled_forest":{"1":"c","2":"b","3":"sb","4":"sc"},"flower_forest":{"1":"c","2":"sc","3":"bc","4":"sb"},"forest":{"1":"b","2":"c","3":"sc","4":"sc"},"meadow":{"1":"c","2":"c","3":"sb","4":"sb"},"old_growth_birch_forest":{"1":"c","2":"sbb","3":"c","4":"sc"},"old_growth_pine_taiga":{"1":"b","2":"sc","3":"c","4":"sc"},"old_growth_spruce_taiga":{"1":"b","2":"b","3":"c","4":"sb"},"pale_garden":{"1":"b","2":"sc","3":"c","4":"sc"},"savanna":{"1":"b","2":"sb","3":"c","4":"sb"},"snowy_taiga":{"1":"sc","2":"c","3":"b","4":"b"},"sparse_jungle":{"1":"c","2":"sbb","3":"c","4":"sbbb"},"swamp":{"1":"c","2":"sb","3":"cb","4":"sb"},"taiga":{"1":"c","2":"b","3":"b","4":"sc"},"windswept_forest":{"1":"b","2":"c","3":"sb","4":"sc"},"wooded_badlands":{"1":"bb","2":"c","3":"sb","4":"sb"}}};
const CAMP_TABLE = { c: 'chests/abandoned_camp_common_chest', s: 'chests/abandoned_camp_secret_chest', b: 'barrels/abandoned_camp_barrel' };
// which tent (1-10) and which campsite (1-49) a camp uses: the same random numbers as the game, before the pieces are placed
function campVariant(ws, x, z) {
  const r = chunkRand(BigInt(ws), x >> 4, z >> 4), rot = r.nextInt(4), tent = 1 + r.nextInt(10);
  const pos = Array.from({ length: 49 }, (_, i) => i);
  for (let i = 49; i > 1; i--) { const j = r.nextInt(i); [pos[i - 1], pos[j]] = [pos[j], pos[i - 1]]; }
  return { rot, tent, site: 1 + pos[0] };
}
// what a campsite holds ('' when its biome is needed and not known); a tent's needs the biome
const campSiteKinds = (site, biome) => site <= 45 ? CAMP_DATA.camp[site] : ((CAMP_DATA.campBiome[biome] || {})[site - 45] || '');
// a short "1 secret chest, 2 barrels" from the letters of CAMP_DATA
function campKindsText(k) {
  const n = c => [...k].filter(x => x === c).length, out = [];
  if (n('s')) out.push(`${n('s')} <span>${n('s') > 1 ? 'secret chests' : 'secret chest'}</span>`);
  if (n('c')) out.push(`${n('c')} <span>${n('c') > 1 ? 'chests' : 'chest'}</span>`);
  if (n('b')) out.push(`${n('b')} <span>${n('b') > 1 ? 'barrels' : 'barrel'}</span>`);
  return out.join(', ');
}
LOOT_MORE.camp = (ws, x, z, ver, biome) => {
  const bi = CAMP_BIOMES.indexOf(biome); if (bi < 0 || !verAtLeast(ver, '26.3')) return null;
  const salt = [, 4, bi], minX = x & ~15, minZ = z & ~15, { rot, tent, site } = campVariant(ws, minX, minZ);
  const siteKinds = campSiteKinds(site, biome), tentKinds = CAMP_DATA.tent[biome][tent];
  const [mx, mz] = [[8, 8], [-8, 8], [-8, -8], [8, -8]][rot], tx = minX + mx, tz = minZ + mz;   // tent: around here
  const [ox, oz] = [[-16, 0], [0, -16], [16, 0], [0, 16]][rot], sx = tx + ox, sz = tz + oz;   // campsite: about one chunk away
  const chests = [], take = (kinds, cx, cz, where) => { const xr = chunkXoro(ws, cx, cz, salt); for (const k of kinds) chests.push({ x: cx, z: cz, table: CAMP_TABLE[k], seed: xr.nextLongJ(), barrel: k === 'b', secret: k === 's', where, near: true }); };
  take(tentKinds, tx, tz, 'tent'); take(siteKinds, sx, sz, 'campsite');
  const bname = biome.replace(/_/g, ' ');   // as the map names it, so it gets translated the same way
  const info = `<span>Tent</span> ${tent}/10 (<span>${bname}</span>): ${campKindsText(tentKinds)} · <span>Campsite</span> ${site}/49${site > 45 ? ` (<span>${bname}</span>)` : ''}: ${campKindsText(siteKinds)}`;
  return { info, secret: siteKinds.includes('s'), chests, pieces: [{ t: 0, b0: [tx - 4, 0, tz - 4], b1: [tx + 4, 0, tz + 4] }, { t: 1, b0: [sx - 4, 0, sz - 4], b1: [sx + 4, 0, sz + 4] }] };
};
