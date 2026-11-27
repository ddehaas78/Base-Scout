// ---------- chest loot: which chests a structure has, and what is in each one ----------
// Chests get a "loot seed" when the structure is built: the world generator's random numbers for the chunk
// (population seed + the structure's index and generation step), then one number per chest. Opening the chest
// rolls its loot table with Java's Random seeded by that number. Rules follow xpple/cubiomes (MIT), checked
// there against the game; the numbers per version are the same as theirs.
const M64 = (1n << 64n) - 1n, M48 = (1n << 48n) - 1n;
const lmix = x => { x = ((x ^ (x >> 30n)) * 0xbf58476d1ce4e5b9n) & M64; x = ((x ^ (x >> 27n)) * 0x94d049bb133111ebn) & M64; return x ^ (x >> 31n); };
const lrot = (x, r) => ((x << BigInt(r)) | (x >> BigInt(64 - r))) & M64;
class LootXoro {   // the world generator's random numbers (Xoroshiro128++, used the way Java's WorldgenRandom does), on 32-bit halves for speed
  constructor(seed) {
    const l = (BigInt.asUintN(64, seed) ^ 0x6a09e667f3bcc909n) & M64, lo = lmix(l), hi = lmix((l + 0x9e3779b97f4a7c15n) & M64);
    this.a = Number(lo >> 32n) >>> 0; this.b = Number(lo & 0xffffffffn) >>> 0; this.c = Number(hi >> 32n) >>> 0; this.d = Number(hi & 0xffffffffn) >>> 0;
  }
  step() {   // advance; returns the top 32 bits of the output (this.ol keeps the low 32 bits)
    const a = this.a, b = this.b, c = this.c, d = this.d;
    let sl = b + d, sh = (a + c + (sl > 0xffffffff ? 1 : 0)) >>> 0; sl >>>= 0;   // lo + hi
    const rh = ((sh << 17) | (sl >>> 15)) >>> 0, rl = ((sl << 17) | (sh >>> 15)) >>> 0;   // rotl 17
    let ol = rl + b; const oh = (rh + a + (ol > 0xffffffff ? 1 : 0)) >>> 0; this.ol = ol >>> 0;   // + lo
    const hh = (c ^ a) >>> 0, hl = (d ^ b) >>> 0;   // h = hi ^ lo
    const r49h = ((b << 17) | (a >>> 15)) >>> 0, r49l = ((a << 17) | (b >>> 15)) >>> 0;   // rotl(lo, 49)
    const s21h = ((hh << 21) | (hl >>> 11)) >>> 0, s21l = (hl << 21) >>> 0;   // h << 21
    this.a = (r49h ^ hh ^ s21h) >>> 0; this.b = (r49l ^ hl ^ s21l) >>> 0;
    this.c = ((hh << 28) | (hl >>> 4)) >>> 0; this.d = ((hl << 28) | (hh >>> 4)) >>> 0;   // rotl(h, 28)
    return oh;
  }
  raw() { const h = this.step(); return (BigInt(h) << 32n) | BigInt(this.ol); }
  skip(n) { for (let i = 0; i < n; i++) this.step(); }
  nextLongJ() { const a = this.step() | 0, b = this.step() | 0; return BigInt.asIntN(64, (BigInt(a) << 32n) + BigInt(b)); }
  nextIntJ(n) {
    const m = n - 1;
    if ((m & n) === 0) return Number(BigInt.asIntN(64, (BigInt(n) * BigInt(this.step() >>> 1)) & M64) >> 31n);
    let bits, val;
    do { bits = this.step() >>> 1; val = bits % n; } while (((bits - val + m) | 0) < 0);
    return val;
  }
  nextFloat() { return (this.step() >>> 8) / 16777216; }
  nextBoolean() { return this.step() >>> 31; }
}
class LootRand {   // Java's java.util.Random, used to roll a chest's loot
  constructor(seed) { this.s = (BigInt.asUintN(64, seed) ^ 0x5DEECE66Dn) & M48; }
  next(bits) { this.s = (this.s * 0x5DEECE66Dn + 0xBn) & M48; return Number(BigInt.asIntN(32, this.s >> BigInt(48 - bits))); }
  nextInt(n) {
    if ((n & -n) === n) return Number((BigInt(n) * BigInt(this.next(31))) >> 31n);
    let bits, val;
    do { bits = this.next(31); val = bits % n; } while (((bits - val + n - 1) | 0) < 0);
    return val;
  }
  nextFloat() { return this.next(24) / 16777216; }
  nextLong() { return BigInt.asIntN(64, (BigInt(this.next(32)) << 32n) + BigInt(this.next(32))); }
  nextDouble() { return (this.next(26) * 134217728 + this.next(27)) / 9007199254740992; }
}
// Java's Random seeded for a chunk (structure starts and their pieces)
function chunkRand(ws, cx, cz) {
  const r = new LootRand(BigInt(ws)), a = r.nextLong(), b = r.nextLong();
  return new LootRand(BigInt.asIntN(64, ((a * BigInt(cx)) & M64) ^ ((b * BigInt(cz)) & M64) ^ BigInt.asUintN(64, BigInt(ws))));
}
// population seed of a chunk (1.18+), as the game makes it before placing structures and features
function lootPopSeed(ws, x, z) {
  const r = new LootXoro(ws), a = r.nextLongJ() | 1n, b = r.nextLongJ() | 1n;
  return BigInt.asIntN(64, ((BigInt(x) * a + BigInt(z) * b) & M64) ^ BigInt.asUintN(64, ws));
}
const verAtLeast = (v, w) => { const p = s => s.split('.').map(Number); const a = p(v), b = p(w); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; };
function lootTableFor(name, ver) {
  const t = LOOT_TABLES[name]; if (!t) return null;
  let pick = null; for (const [first, pools] of t) if (verAtLeast(ver, first)) pick = pools;
  return pick;
}
// enchanting with levels (enchanting-table rules), with Java's Random
function lootEnchant(r, key, cost) {
  const E = LOOT_FOR[key], q = (E.e >> 2) + 1;
  cost += 1 + r.nextInt(q) + r.nextInt(q);
  const a = r.nextFloat(), b = r.nextFloat(), f = Math.fround(Math.fround(Math.fround(a + b) - 1) * Math.fround(0.15));
  cost = Math.max(1, Math.floor(Math.fround(Math.fround(cost + Math.fround(cost * f)) + 0.5)));
  let avail = [];
  for (const k of E.c) {
    const [, , max, mb, mp, xb, xp, w] = LOOT_ENCH[k];
    for (let l = max; l >= 1; l--) if (cost >= mb + mp * (l - 1) && cost <= xb + xp * (l - 1)) { avail.push([k, l, w]); break; }
  }
  const out = [], bad = new Set(E.x.map(([p, q2]) => p + ',' + q2));
  const pick = () => {
    const total = avail.reduce((s, x) => s + x[2], 0); if (total <= 0) return;
    let w = r.nextInt(total);
    for (const x of avail) { w -= x[2]; if (w < 0) { out.push([x[0], x[1]]); return; } }
  };
  if (!avail.length) return out;
  pick();
  while (r.nextInt(50) <= cost) {
    const last = out[out.length - 1][0];
    avail = avail.filter(x => x[0] !== last && !bad.has(Math.min(x[0], last) + ',' + Math.max(x[0], last)));
    if (!avail.length) break;
    pick(); cost = Math.trunc(cost / 2);
  }
  return out;
}
// roll a loot table: a list of { i: item, n: count, ench: [[enchantment, level]], note? }
// (pools with conditions and entries with chances follow xpple/cubiomes: each entry's chances are rolled every time, in order)
const chance = (r, c) => r.nextFloat() < Math.fround(c);
function lootRoll(name, ver, seed, biome, size = 27) {   // size: the container's slots (dispenser 9, pot 1)   // biome: the chest's own (some entries are left out in some biomes)
  const T = lootTableFor(name, ver); if (!T) return null;
  const r = new LootRand(BigInt(seed)), out = [];
  const pools = T => { for (const [[a, b], ents, poolFns, poolIf] of T) {
    const pass = c => typeof c === 'number' ? chance(r, c) : !(c[0] === 'nb' && c[1].includes(biome));
    if (poolIf && !poolIf.every(pass)) continue;
    const rolls = a === b ? a : r.nextInt(b - a + 1) + a, total = ents.reduce((s, e) => s + e[1], 0), conditional = ents.some(e => e[3]);
    for (let k = 0; k < rolls; k++) {
      let e = null;
      if (!conditional) {
        if (total <= 0) continue;
        e = ents[0];
        if (ents.length > 1) { let w = r.nextInt(total); for (e of ents) { w -= e[1]; if (w < 0) break; } }
      } else {
        const ok = ents.filter(x => (!x[3] || x[3].every(pass)) && x[1] > 0);
        if (!ok.length) continue;
        e = ok[0];
        if (ok.length > 1) { let w = r.nextInt(ok.reduce((s, x) => s + x[1], 0)); for (e of ok) { w -= e[1]; if (w < 0) break; } }
      }
      if (typeof e[0] === 'string') { const T2 = lootTableFor(e[0], ver); if (T2) pools(T2); continue; }   // another table (trial chambers' reward chests)
      if (e[0] < 0) continue;
      const it = { i: e[0], n: 1, ench: [] };
      for (const f of poolFns ? e[2].concat(poolFns) : e[2]) {   // the item's own functions, then the pool's
        if (f[0] === 'c') it.n = f[1] === f[2] ? f[1] : r.nextInt(f[2] - f[1] + 1) + f[1];
        else if (f[0] === 'er') { const Lst = LOOT_LISTS[f[1]], k2 = Lst[r.nextInt(Lst.length)], max = LOOT_ENCH[k2][2]; it.ench = [[k2, max > 1 ? r.nextInt(max) + 1 : 1]]; }
        else if (f[0] === 'el') it.ench = lootEnchant(r, f[1], f[2] === f[3] ? f[2] : r.nextInt(f[3] - f[2] + 1) + f[2]);
        else if (f[0] === 'f') r.nextFloat();   // wear: one random number
        else if (f[0] === 'h') it.note = f[1][r.nextInt(f[1].length)];   // goat horn sound
        else if (f[0] === 'p') it.note = f[1];   // potion
        else if (f[0] === 'n') it.name = f[1];   // its own name
        else if (f[0] === 's') { const [nm, lo, hi] = f[1][r.nextInt(f[1].length)]; r.nextInt(hi - lo + 1); it.note = nm; }   // stew effect, then its length
      }
      out.push(it);
    }
  } };
  pools(T);
  out.slots = lootSlots(r, out, size);
  return out;
}
// where the game puts each stack in a chest (27 slots): shuffle the free slots, split some stacks, shuffle the stacks
function lootSlots(r, items, size = 27) {
  const between = (a, b) => a >= b ? a : r.nextInt(b - a + 1) + a, shuffle = a => { for (let i = a.length; i > 1; i--) { const j = r.nextInt(i); [a[i - 1], a[j]] = [a[j], a[i - 1]]; } };
  const free = Array.from({ length: size }, (_, i) => i); shuffle(free);
  let stacks = [], big = [];
  for (const it of items) (it.n > 1 ? big : stacks).push({ ...it });
  while (size - stacks.length - big.length > 0 && big.length) {
    const s = big.splice(between(0, big.length - 1), 1)[0], k = between(1, Math.trunc(s.n / 2)), s2 = { ...s, n: k }; s.n -= k;
    if (s.n > 1 && r.next(1) !== 0) big.push(s); else stacks.push(s);
    if (s2.n > 1 && r.next(1) !== 0) big.push(s2); else stacks.push(s2);
  }
  stacks = stacks.concat(big); shuffle(stacks);
  const slots = new Array(size).fill(null);
  for (const s of stacks) { if (!free.length) break; slots[free.pop()] = s; }
  return slots;
}

// ---- structures ----
// desert pyramid: [first version, generation step, index of the structure in that step]
const LOOT_SALT = { pyramid: [['1.18', 4, 3], ['1.19', 4, 1], ['26.3', 4, 19]] };
const lootSalt = (key, ver) => { let s = null; for (const x of LOOT_SALT[key] || []) if (verAtLeast(ver, x[0])) s = x; return s; };
// the direction a single-piece structure faces: the structure's own random numbers (Java Random, large-feature seed)
function lootFacing(ws, cx, cz) {
  const r = new LootRand(BigInt(ws)), a = r.nextLong(), b = r.nextLong();
  const s = BigInt.asIntN(64, ((BigInt(cx) * a) & M64) ^ ((BigInt(cz) * b) & M64) ^ BigInt.asUintN(64, BigInt(ws)));
  return ['north', 'east', 'south', 'west'][new LootRand(s).nextInt(4)];
}
// desert pyramid: 4 chests in the hidden room
function lootPyramid(ws, x, z, ver) {
  const minX = x & ~15, minZ = z & ~15, key = 'pyramid';
  const salt = lootSalt('pyramid', ver); if (!salt) return null;
  const r = new LootXoro(BigInt.asUintN(64, lootPopSeed(BigInt(ws), minX, minZ) + BigInt(salt[2] + 10000 * salt[1])));
  r.nextIntJ(3);   // how far below the lowest ground the pyramid sits (0 to 2 blocks)
  // the game places them north, east, south, west of the middle, in the pyramid's own directions, 2 blocks out
  const facing = lootFacing(ws, minX >> 4, minZ >> 4), table = 'chests/desert_pyramid';
  const world = (lx, lz) => facing === 'north' ? [minX + lx, minZ + 20 - lz] : facing === 'south' ? [minX + lx, minZ + lz]
    : facing === 'west' ? [minX + 20 - lz, minZ + lx] : [minX + lz, minZ + lx];
  return { key, x: minX + 10, z: minZ + 10, minX, minZ, facing,
    chests: [[0, -2], [2, 0], [0, 2], [-2, 0]].map(([dx, dz]) => { const seed = r.nextLongJ(), [wx, wz] = world(10 + dx, 10 + dz); return { x: wx, z: wz, table, seed, items: lootRoll(table, ver, seed) }; }) };
}
const LOOT_KEYS = new Set();   // structures with a plan (js/06b-structs.js)
