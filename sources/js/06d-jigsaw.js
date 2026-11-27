// ---------- jigsaw structures (bastions, ancient cities, abandoned camps): the game's JigsawPlacement, step by step ----------
// The structure is built from pieces (structure files) that hook onto each other with jigsaw blocks. Starting from one piece,
// the game goes through its jigsaw blocks in a random order, tries the pieces of the pool each one names (in a random order,
// each in 4 random turns), and keeps the first that fits in the free space. Same random numbers, same order as the game,
// so the same pieces come out; then every container (chest, barrel...) is in a known place, and its loot seed follows
// from the chunk it is in (js/06b-structs.js). Data: js/06d-jigsawdata.js (from i18n/jigsaw.py).

// structure settings, as in data/minecraft/worldgen/structure
const JIG_CONF = {
  bastion: { pool: 'bastion/starts', size: 6, dist: 80, y: 33, hack: false, anchor: null, minY: 0, maxY: 256 },
  ancient: { pool: 'ancient_city/city_center', size: 7, dist: 116, y: -27, hack: false, anchor: 'city_anchor', minY: -64, maxY: 320 },
  camp: { size: 2, dist: 80, y: 64, hack: true, anchor: null, minY: -64, maxY: 320 },   // y: the ground, only roughly (it moves everything the same)
  village: { size: 6, dist: 80, y: 64, hack: true, anchor: null, minY: -64, maxY: 320 },   // pool: village/<type>/town_centers
  outpost: { pool: 'pillager_outpost/base_plates', size: 7, dist: 80, y: 64, hack: true, anchor: null, minY: -64, maxY: 320 },
  trial: { pool: 'trial_chambers/chamber/end', size: 20, dist: 116, ySample: [-40, -20], pad: 10, hack: false, anchor: null, minY: -64, maxY: 320 },
};
const DIRS = { north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
const OPP = { north: 'south', south: 'north', west: 'east', east: 'west', up: 'down', down: 'up' };
const CW = { north: 'east', east: 'south', south: 'west', west: 'north', up: 'up', down: 'down' };
const turnDir = (d, r) => { for (let i = 0; i < r; i++) d = CW[d]; return d; };
// a piece's own position → turned by r quarter turns clockwise around its corner (0, 0, 0), like the game's Rotation
const turnPos = (p, r) => r === 0 ? [p[0], p[1], p[2]] : r === 1 ? [-p[2], p[1], p[0]] : r === 2 ? [-p[0], p[1], -p[2]] : [p[2], p[1], -p[0]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const shuffleJ = (a, r) => { for (let i = a.length; i > 1; i--) { const j = r.nextInt(i); const t = a[i - 1]; a[i - 1] = a[j]; a[j] = t; } return a; };   // Util.shuffle

// a box [x0, y0, z0, x1, y1, z1], both ends inside
const tmplBox = (t, pos, r) => {
  const a = turnPos([0, 0, 0], r), b = turnPos([t.size[0] - 1, t.size[1] - 1, t.size[2] - 1], r);
  return [Math.min(a[0], b[0]) + pos[0], Math.min(a[1], b[1]) + pos[1], Math.min(a[2], b[2]) + pos[2], Math.max(a[0], b[0]) + pos[0], Math.max(a[1], b[1]) + pos[1], Math.max(a[2], b[2]) + pos[2]];
};
const inBox = (b, p) => p[0] >= b[0] && p[0] <= b[3] && p[1] >= b[1] && p[1] <= b[4] && p[2] >= b[2] && p[2] <= b[5];
const hit = (a, b) => a[0] <= b[3] && a[3] >= b[0] && a[1] <= b[4] && a[4] >= b[1] && a[2] <= b[5] && a[5] >= b[2];

// pool elements: ['s', template] one piece, ['L', [elements]] several at once, ['f'] a feature (tree), ['e'] nothing;
// proj 'r' rigid (kept at the height the jigsaw says) or 't' terrain matching (put on the ground: village houses)
function jigElement(e) {
  if (typeof e[0] === 'number') return { t: 's', tm: JIG.temps[e[0]], name: JIG.names[e[0]], proj: e[1] || 'r' };
  if (e[0] === 'L') return { t: 'L', els: e[1].map(jigElement), proj: e[2] || 'r' };
  return { t: e[0], proj: e[1] || 'r' };
}
const POOLS = {};
function jigPool(name) {   // the pool's list, each element repeated as many times as its weight (like the game)
  if (!name || name === 'empty' || !JIG.pools[name]) return null;
  if (!POOLS[name]) { const P = JIG.pools[name], list = []; for (const [e, w] of P.els) { const el = jigElement(e); for (let i = 0; i < w; i++) list.push(el); } POOLS[name] = { list, fb: P.fb }; }
  return POOLS[name];
}
// the jigsaw blocks of an element placed at pos, turned r: { pos, front, top, name, target, pool, joint, prio, sel }
function jigBlocks(el, pos, r, rnd) {
  if (el.t === 'L') return jigBlocks(el.els[0], pos, r, rnd);
  if (el.t === 'f') return [{ pos: pos.slice(), front: 'down', top: 'south', name: 'bottom', target: 'empty', pool: 'empty', joint: 'rollable', prio: 0, sel: 0 }];
  if (el.t !== 's') return [];
  const list = el.tm.jig.map(([p, o, name, target, pool, joint, prio, sel]) => {
    const [f, t] = o.split('_');
    return { pos: add3(turnPos(p, r), pos), front: turnDir(f, r), top: turnDir(t, r), name, target, pool, joint, prio, sel };
  });
  shuffleJ(list, rnd);
  return list.map((j, i) => [j, i]).sort((a, b) => (b[0].sel - a[0].sel) || (a[1] - b[1])).map(x => x[0]);   // stable, highest selection priority first
}
function elBox(el, pos, r) {
  if (el.t === 's') return tmplBox(el.tm, pos, r);
  if (el.t === 'f') return [pos[0], pos[1], pos[2], pos[0], pos[1], pos[2]];
  if (el.t === 'L') { const bs = el.els.filter(e => e.t !== 'e').map(e => elBox(e, pos, r)); return [0, 1, 2].map(i => Math.min(...bs.map(b => b[i]))).concat([3, 4, 5].map(i => Math.max(...bs.map(b => b[i])))); }
  return [pos[0], pos[1], pos[2], pos[0], pos[1], pos[2]];
}
const poolMaxY = name => {   // the tallest piece of a pool (the "expansion hack" of villages and camps)
  const P = jigPool(name); if (!P) return 0;
  if (P.maxY === undefined) P.maxY = Math.max(0, ...P.list.filter(e => e.t !== 'e').map(e => { const b = elBox(e, [0, 0, 0], 0); return b[4] - b[1] + 1; }));
  return P.maxY;
};
const canAttach = (a, b) => a.front === OPP[b.front] && ((a.joint || (DIRS[a.front][1] === 0 ? 'aligned' : 'rollable')) === 'rollable' || a.top === b.top) && a.target === b.name;
// free space: a box with holes; a new piece must be inside the box and touch no hole
const fits = (free, b) => b[0] >= free.box[0] && b[1] >= free.box[1] && b[2] >= free.box[2] && b[3] <= free.box[3] && b[4] <= free.box[4] && b[5] <= free.box[5] && !free.holes.some(h => hit(h, b));

// build the structure that starts in chunk (cx, cz): its pieces [{ el, name, pos, rot, box, depth }], in the game's order
function jigAssemble(ws, cx, cz, conf, startPool) {
  const rnd = chunkRand(ws, cx, cz);
  const y0 = conf.ySample ? conf.ySample[0] + rnd.nextInt(conf.ySample[1] - conf.ySample[0] + 1) : conf.y;   // trial chambers: a random height first
  const rot = rnd.nextInt(4), P0 = jigPool(startPool); if (!P0) return null;
  const el0 = P0.list[rnd.nextInt(P0.list.length)];
  if (el0.t === 'e') return null;
  const pos = [cx * 16, y0, cz * 16];
  let anchor = pos;
  if (conf.anchor) { const a = jigBlocks(el0, pos, rot, rnd).find(j => j.name === conf.anchor); if (!a) return null; anchor = a.pos; }
  const off = sub3(anchor, pos), origin = sub3(pos, off);
  const start = { el: el0, name: el0.name, pos: origin, rot, box: elBox(el0, origin, rot), depth: 0 };
  const cxm = Math.trunc((start.box[0] + start.box[3]) / 2), czm = Math.trunc((start.box[2] + start.box[5]) / 2);   // Java's int division
  const k = conf.anchor ? origin[1] : y0, l = start.box[1] + 1;   // the game lowers the start piece by its "ground level delta" (1)
  start.pos[1] += k - l; start.box[1] += k - l; start.box[4] += k - l;
  const m = k + off[1];
  const pieces = [start];
  if (conf.size > 0) {
    const D = conf.dist;
    const free0 = { box: [cxm - D, Math.max(m - D, conf.minY + (conf.pad || 0)), czm - D, cxm + D, Math.min(m + D + 1, conf.maxY - (conf.pad || 0)) - 1, czm + D], holes: [start.box.slice()] };
    const queue = new Map();   // placement priority → list (first in, first out); highest priority first
    const push = (s, p) => { if (!queue.has(p)) queue.set(p, []); queue.get(p).push(s); };
    const next = () => { const ks = [...queue.keys()].filter(q => queue.get(q).length).sort((a, b) => b - a); return ks.length ? queue.get(ks[0]).shift() : null; };
    const children = (piece, free, depth) => {
      const box = piece.box, minY = box[1], rigid = piece.el.proj !== 't'; let inner = null;
      for (const J of jigBlocks(piece.el, piece.pos, piece.rot, rnd)) {
        const dir = DIRS[J.front], out = add3(J.pos, dir), jy = J.pos[1] - minY;
        const pool = jigPool(J.pool); if (!pool && J.pool !== 'empty') continue;
        const fb = pool ? jigPool(pool.fb) : null;
        let space;
        if (inBox(box, out)) { if (!inner) inner = { box: box.slice(), holes: [] }; space = inner; } else space = free;
        const tries = [];
        if (depth !== conf.size && pool) tries.push(...shuffleJ(pool.list.slice(), rnd));
        if (fb) tries.push(...shuffleJ(fb.list.slice(), rnd));
        let placed = false;
        for (const el of tries) {
          if (el.t === 'e') break;
          for (const r2 of shuffleJ([0, 1, 2, 3], rnd)) {
            const js2 = jigBlocks(el, [0, 0, 0], r2, rnd), b2 = elBox(el, [0, 0, 0], r2);
            let hack = 0;
            if (conf.hack && b2[4] - b2[1] + 1 <= 16) hack = Math.max(0, ...js2.map(j2 => {
              if (!inBox(b2, add3(j2.pos, DIRS[j2.front]))) return 0;
              const p2 = jigPool(j2.pool); return Math.max(poolMaxY(j2.pool), p2 ? poolMaxY(p2.fb) : 0);
            }));
            for (const j2 of js2) {
              if (!canAttach(J, j2)) continue;
              const at = sub3(out, j2.pos), b3 = elBox(el, at, r2);
              // rigid pieces: same height as the jigsaw says; on the ground otherwise (taken as flat, at conf.y: houses on a hill can differ)
              const p = jy - j2.pos[1] + dir[1], q = rigid && el.proj !== 't' ? minY + p : conf.y - j2.pos[1], rr = q - b3[1];
              const b4 = [b3[0], b3[1] + rr, b3[2], b3[3], b3[4] + rr, b3[5]], at2 = [at[0], at[1] + rr, at[2]];
              if (hack > 0) { const s = Math.max(hack + 1, b4[4] - b4[1]); b4[4] = Math.max(b4[4], b4[1] + s); }
              if (!fits(space, b4)) continue;
              space.holes.push(b4.slice());
              const np = { el, name: el.name, pos: at2, rot: r2, box: b4, depth: depth + 1 };
              pieces.push(np);
              if (depth + 1 <= conf.size) push([np, space, depth + 1], J.prio);
              placed = true; break;
            }
            if (placed) break;
          }
          if (placed) break;
        }
      }
    };
    children(start, free0, 0);
    for (let s; (s = next());) children(s[0], s[1], s[2]);
  }
  return { pieces, center: [cxm, m, czm] };
}
// every container of a structure, in the game's order, with its loot seed: [{ x, y, z, block, table, seed, piece }]
function jigContainers(ws, A, salt) {
  const list = [];
  A.pieces.forEach((pc, i) => {
    const els = pc.el.t === 'L' ? pc.el.els : [pc.el];
    for (const e of els) if (e.t === 's') for (const [p, block, table] of e.tm.cont) {
      const w = add3(turnPos(p, pc.rot), pc.pos); list.push({ x: w[0], y: w[1], z: w[2], block, table, piece: i });
    }
  });
  // each chunk takes its own random numbers; its containers take the next ones, piece by piece, in this order
  const byChunk = new Map();
  for (const c of list) { const k = (c.x >> 4) + ',' + (c.z >> 4); if (!byChunk.has(k)) byChunk.set(k, []); byChunk.get(k).push(c); }
  for (const cs of byChunk.values()) { const r = chunkXoro(ws, cs[0].x & ~15, cs[0].z & ~15, salt); for (const c of cs) c.seed = r.nextLongJ(); }
  // a feature (tree) placed before a container in the same chunk uses some of those numbers first: that container's loot can differ
  A.pieces.forEach((pc, i) => { if (pc.el.t === 'f') for (const c of list) if (c.piece > i && (c.x >> 4) === (pc.pos[0] >> 4) && (c.z >> 4) === (pc.pos[2] >> 4)) c.unsure = true; });
  return list;
}

// ---- the exact biome at some points, from the engine (the map's colours are too coarse for structures on biome edges) ----
let ptsReq = 0; const ptsWait = new Map();
function exactBiomes(pts) {   // [[x, y, z]] → Promise of biome ids ('birch_forest'…)
  const seed = parseSeed($('seed').value);
  return new Promise(res => {
    if (seed === null || !(mapReady || ready)) return res(pts.map(() => null));
    const id = ++ptsReq; ptsWait.set(id, res);
    (mapReady ? mapWorker : worker).postMessage({ type: 'pts', id, seed: String(seed), ver: curVer(), pts });
  });
}
function onPts(m) { const f = ptsWait.get(m.id); if (f) { ptsWait.delete(m.id); f(m.ids.map(i => names && names[i] ? names[i].toLowerCase().replace(/ /g, '_') : null)); } }

// the game takes a camp's biome at the ground; the ground's height isn't known here, but above it the biome is the
// surface one (below it can be a cave biome: dripstone caves under a hill), so it's read high up
const SURFACE_Y = 256;
// ---- abandoned camps: each biome has its own camp (own pieces, own loot seeds); the game checks the biome at the middle of the tent ----
const campBuild = (ws, x, z, biome) => {
  const A = jigAssemble(BigInt(ws), x >> 4, z >> 4, JIG_CONF.camp, 'abandoned_camp/tent/' + biome);
  return A && { A, biome, conts: jigContainers(BigInt(ws), A, [, 4, CAMP_BIOMES.indexOf(biome)]) };
};
async function campResolve(ws, x, z, guess) {   // which camp the game built here: guess, check the biome at its tent's middle, again if it moved
  let b = CAMP_BIOMES.includes(guess) ? guess : 'forest';
  for (let i = 0; i < 3; i++) {
    const C = campBuild(ws, x, z, b), [mx, , mz] = C.A.center, [got] = await exactBiomes([[mx, SURFACE_Y, mz]]);
    if (!got || got === b || !CAMP_BIOMES.includes(got)) {
      if (got && !CAMP_BIOMES.includes(got)) return null;
      const bs = await exactBiomes(C.conts.map(c => [c.x, SURFACE_Y, c.z]));   // each chest's own biome (some loot depends on it)
      C.conts.forEach((c, i) => { c.biome = bs[i] || b; });
      return C;
    }
    b = got;
  }
  return campBuild(ws, x, z, b);
}
// the short name of a campsite piece: "barrel 7", "special 3", "taiga 2"
const campSiteName = n => n.split('/').pop().replace(/^campsite_/, '').replace(/^default_/, '').replace(/_(\d+)$/, ' $1').replace(/_/g, ' ');

let JIG_IDX = null;
const jigIndex = name => { if (!JIG_IDX) { JIG_IDX = new Map(); JIG.names.forEach((n, i) => JIG_IDX.set(n, i)); } return JIG_IDX.get(name); };
// ---- plans: the pieces from above and every chest, for the structure plan window (js/06c-plan.js) ----
function jigPlanOf(kind, ws, A, conts) {
  // not the one-block pieces (mobs, gold blocks); trees only for camps
  const tops = p => (p.el.t === 'L' ? p.el.els : [p.el]).filter(e => e.t === 's').map(e => [jigIndex(e.name), p.rot, p.pos]);   // drawn block by block (js/06h-topview.js)
  const pieces = A.pieces.filter(p => p.el.t !== 'e' && (kind === 'camp' || p.el.t !== 'f') && !/\/(mobs|blocks|spawner|villagers|animals|iron_golem|cats|sheep|butcher_animals)\//.test(p.name || '')).map(p => ({ t: p.name || '', b0: [p.box[0], p.box[1], p.box[2]], b1: [p.box[3], p.box[4], p.box[5]], top: tops(p) }));
  const chests = conts.filter(c => c.table).map(c => ({ x: c.x, y: kind === 'camp' || kind === 'village' ? null : c.y, z: c.z, table: c.table, seed: c.seed, barrel: c.block === 'barrel',
    pot: c.block === 'decorated_pot', disp: c.block === 'dispenser', pi: c.piece, y3: c.y,
    secret: /secret/.test(c.table), unsure: c.unsure, biome: c.biome }));
  return { pieces, chests };
}
