// ---------- where each structure's chests are, and each chest's loot seed (after xpple/cubiomes, MIT) ----------
// A plan: { key, x, z, minX, minZ, facing?, pieces: [{ t, b0: [x, y, z], b1: [x, y, z] }], chests: [{ x, z, table, seed, items }] }
// Chests are rolled in the world generator's "decorate" step: each chunk gets its own random numbers
// (lootPopSeed + index + 10000 · step), and the chests in that chunk take the next numbers in order.

// [first version, generation step, index of the structure in that step]
Object.assign(LOOT_SALT, {
  treasure: [['1.19.4', 3, 0]],
  outpost: [['1.19.4', 4, 9], ['26.3', 4, 27]],
  bastion: [['1.19.4', 4, 0], ['26.3', 4, 18]],
  endcity: [['1.19.4', 4, 2], ['26.3', 4, 20]],
  stronghold: [['1.19.4', 4, 19], ['26.3', 4, 37]],
  mineshaft: [['1.19.4', 3, 1]],
  mineshaft_mesa: [['1.19.4', 3, 2]],   // badlands mineshafts are a structure of their own
  ancient: [['1.19.4', 7, 0]],   // underground decoration: ancient_city, fortress, nether_fossil (by name)
});
// the random numbers a chunk's decorations use
const chunkXoro = (ws, cx, cz, salt) => new LootXoro(BigInt.asUintN(64, lootPopSeed(ws, cx & ~15, cz & ~15) + BigInt(salt[2] + 10000 * salt[1])));
const inChunk = (x, z, cx, cz) => x >= cx && x < cx + 16 && z >= cz && z < cz + 16;
// a piece's own cell → world cell, the way the game turns pieces (rot 0 north, 1 east, 2 south, 3 west)
function rotPos(p, x, z) {
  switch (p.rot) {
    case 0: return [p.b0[0] + x, p.b1[2] - z];
    case 1: return [p.b0[0] + z, p.b0[2] + x];
    case 2: return [p.b0[0] + x, p.b0[2] + z];
    default: return [p.b1[0] - z, p.b0[2] + x];
  }
}
// a filled box of blocks: the game draws one random number per block of its shell that is in this chunk
function genBox(p, cx, cz, x0, y0, z0, x1, y1, z1, r) {
  const h = y1 - y0 + 1; if (h <= 0) return;
  let n = 0;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const [tx, tz] = rotPos(p, x, z);
    if (inChunk(tx, tz, cx, cz)) n += x === x0 || x === x1 || z === z0 || z === z1 ? h : (h > 1 ? 2 : 1);
  }
  r.skip(n);
}
const boxesHit = (a0, a1, b0, b1) => a1[0] >= b0[0] && a0[0] <= b1[0] && a1[2] >= b0[2] && a0[2] <= b1[2] && a1[1] >= b0[1] && a0[1] <= b1[1];
const span = list => {   // the chunks a list of pieces covers
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of list) { x0 = Math.min(x0, p.b0[0]); z0 = Math.min(z0, p.b0[2]); x1 = Math.max(x1, p.b1[0]); z1 = Math.max(z1, p.b1[2]); }
  return [x0 & ~15, z0 & ~15, x1 & ~15, z1 & ~15];
};

// ---- stronghold ----
// [offset, size, weight, how many at most (0: any), lowest depth]
const SH = [[[-1, -1, 0], [5, 5, 7], 40, 0, 0], [[-1, -1, 0], [9, 5, 11], 5, 5, 0], [[-1, -1, 0], [5, 5, 5], 20, 0, 0], [[-1, -1, 0], [5, 5, 5], 20, 0, 0],
  [[-4, -1, 0], [11, 7, 11], 10, 6, 0], [[-1, -7, 0], [5, 11, 8], 5, 5, 0], [[-1, -7, 0], [5, 11, 5], 5, 5, 0], [[-4, -3, 0], [10, 9, 11], 5, 4, 0],
  [[-1, -1, 0], [5, 5, 7], 5, 4, 0], [[-4, -1, 0], [14, 11, 15], 10, 2, 5], [[-4, -1, 0], [11, 8, 16], 20, 1, 6], [[-1, -1, 0], [5, 5, 4], -1, -1, -1]];
const [SH_STRAIGHT, SH_PRISON, SH_LEFT, SH_RIGHT, SH_ROOM, SH_SSTAIRS, SH_STAIRS, SH_FIVE, SH_CHEST, SH_LIBRARY, SH_PORTAL, SH_FILLER] = SH.keys();
const SH_NAMES = ['Corridor', 'Prison cells', 'Turn', 'Turn', 'Room', 'Stairs', 'Stairs', 'Crossing', 'Chest corridor', 'Library', 'End portal room', 'Corridor'];
function orientBox(pos, off, size, f) {
  const b0 = pos.slice(), b1 = pos.slice();
  b0[1] += off[1]; b1[1] += off[1] + size[1] - 1;
  if (f === 0) { b0[0] += off[0]; b0[2] += off[2] - size[2] + 1; b1[0] += off[0] + size[0] - 1; b1[2] += off[2]; }
  else if (f === 1) { b0[0] += off[2]; b0[2] += off[0]; b1[0] += off[2] + size[2] - 1; b1[2] += off[0] + size[0] - 1; }
  else if (f === 2) { b0[0] += off[0]; b0[2] += off[2]; b1[0] += off[0] + size[0] - 1; b1[2] += off[2] + size[2] - 1; }
  else { b0[0] += off[2] - size[2] + 1; b0[2] += off[0]; b1[0] += off[2]; b1[2] += off[0] + size[0] - 1; }
  return [b0, b1];
}
function strongholdPieces(ws, cx, cz, nmax = 2000) {
  for (let attempt = 0; ; attempt++) {
    const r = chunkRand(BigInt.asIntN(64, BigInt(ws) + BigInt(attempt)), cx, cz);
    const E = { list: [], queue: [], portal: false, imposed: -1, last: -1, ntyp: new Array(11).fill(0), del: 0, total: 145, stopped: false };
    const hit = (b0, b1) => E.list.find(q => boxesHit(q.b0, q.b1, b0, b1));
    const add = (t, x, y, z, depth, f) => {
      const pos = [x, y, z], off = SH[t][0], size = SH[t][1].slice();
      let b0, b1;
      if (t === SH_LIBRARY) {
        [b0, b1] = orientBox(pos, off, size, f);
        if (!(b0[1] > 10 && !hit(b0, b1))) { size[1] = 6; [b0, b1] = orientBox(pos, off, size, f); if (b0[1] > 10 && hit(b0, b1)) return false; }
      } else if (t === SH_FILLER) {
        [b0, b1] = orientBox(pos, off, size, f);
        const p = hit(b0, b1); if (!p || p.b0[1] !== b0[1]) return false;
        let ok = false;
        for (let i = 2; i >= 1; i--) {
          size[2] = i; [b0, b1] = orientBox(pos, off, size, f);
          if (boxesHit(p.b0, p.b1, b0, b1)) continue;
          size[2] = i + 1; [b0, b1] = orientBox(pos, off, size, f);
          if (b0[1] > 1) { ok = true; break; }
        }
        if (!ok) return false;
      } else {
        [b0, b1] = orientBox(pos, off, size, f);
        if (b0[1] > 10 && hit(b0, b1)) return false;
      }
      const p = { t, b0, b1, rot: f, depth, add: 0 };
      if (t === SH_STRAIGHT) { r.nextInt(5); p.add = (r.nextInt(2) === 0 ? 1 : 0) | (r.nextInt(2) === 0 ? 2 : 0); }
      else if (t === SH_ROOM) { r.nextInt(5); p.add = r.nextInt(5) === 2 ? 1 : 0; }
      else if (t === SH_FIVE) { r.nextInt(5); p.add = r.next(1) | (r.next(1) << 1) | (r.next(1) << 2) | ((r.nextInt(3) > 0 ? 1 : 0) << 3); }
      else if (t === SH_PORTAL) E.portal = true;
      else if (t !== SH_FILLER) r.nextInt(5);
      E.list.push(p); E.queue.push(p);
      if (E.list.length >= nmax) E.stopped = true;
      return true;
    };
    const status = () => {
      for (let t = 0; t < 11; t++) { if ((E.del >> t) & 1) continue; if (SH[t][3] > 0 && E.ntyp[t] < SH[t][2]) return; }
      E.stopped = true;
    };
    const valid = (n, t) => SH[t][3] === 0 || n < SH[t][3];
    const extend = (piece, x, y, z, f) => {
      if (piece.depth > 50 || Math.abs(x - E.list[0].b0[0]) > 112 || Math.abs(z - E.list[0].b0[2]) > 112 || E.stopped) return;
      const depth = piece.depth + 1;
      if (E.imposed !== -1) { const t = E.imposed; E.imposed = -1; if (add(t, x, y, z, depth, f)) return; }
      for (let a = 0; a < 5; a++) {
        let w = r.nextInt(E.total);
        for (let t = 0; t < 11; t++) {
          if ((E.del >> t) & 1) continue;
          if ((w -= SH[t][2]) >= 0) continue;
          if (!(valid(E.ntyp[t], t) && depth >= SH[t][4]) || t === E.last) break;
          if (!add(t, x, y, z, depth, f)) continue;
          E.ntyp[t]++; E.last = t;
          if (!valid(E.ntyp[t], t)) { E.total -= SH[t][2]; E.del |= 1 << t; status(); }
          return;
        }
      }
      add(SH_FILLER, x, y, z, depth, f);
    };
    const fwd = (p, ox, oy) => {
      if (p.rot === 0) extend(p, p.b0[0] + ox, p.b0[1] + oy, p.b0[2] - 1, 0);
      else if (p.rot === 2) extend(p, p.b0[0] + ox, p.b0[1] + oy, p.b1[2] + 1, 2);
      else if (p.rot === 3) extend(p, p.b0[0] - 1, p.b0[1] + oy, p.b0[2] + ox, 3);
      else extend(p, p.b1[0] + 1, p.b0[1] + oy, p.b0[2] + ox, 1);
    };
    const left = (p, oy, oz) => p.rot === 0 || p.rot === 2 ? extend(p, p.b0[0] - 1, p.b0[1] + oy, p.b0[2] + oz, 3) : extend(p, p.b0[0] + oz, p.b0[1] + oy, p.b0[2] - 1, 0);
    const right = (p, oy, oz) => p.rot === 0 || p.rot === 2 ? extend(p, p.b1[0] + 1, p.b0[1] + oy, p.b0[2] + oz, 1) : extend(p, p.b0[0] + oz, p.b0[1] + oy, p.b1[2] + 1, 2);
    const grow = p => {
      switch (p.t) {
        case SH_STRAIGHT: fwd(p, 1, 1); if (p.add & 1) left(p, 1, 2); if (p.add & 2) right(p, 1, 2); break;
        case SH_PRISON: case SH_SSTAIRS: case SH_CHEST: fwd(p, 1, 1); break;
        case SH_LEFT: if (p.rot === 0 || p.rot === 1) left(p, 1, 1); else right(p, 1, 1); break;
        case SH_RIGHT: if (p.rot === 0 || p.rot === 1) right(p, 1, 1); else left(p, 1, 1); break;
        case SH_ROOM: fwd(p, 4, 1); left(p, 1, 4); right(p, 1, 4); break;
        case SH_STAIRS: if (p.add) E.imposed = SH_FIVE; fwd(p, 1, 1); break;
        case SH_FIVE: {
          let n = 3, n2 = 5; if (p.rot === 3 || p.rot === 0) { n = 5; n2 = 3; }
          fwd(p, 5, 1); if (p.add & 1) left(p, n, 1); if (p.add & 2) left(p, n2, 7); if (p.add & 4) right(p, n, 1); if (p.add & 8) right(p, n2, 7);
        }
      }
    };
    const x = (cx << 4) + 2, z = (cz << 4) + 2, rot = r.nextInt(4), sz = SH[SH_STAIRS][1];
    const start = { t: SH_STAIRS, b0: [x, 64, z], b1: rot % 2 ? [x + sz[2] - 1, 64 + sz[1] - 1, z + sz[0] - 1] : [x + sz[0] - 1, 64 + sz[1] - 1, z + sz[2] - 1], rot, depth: 0, add: 1 };
    E.list.push(start);
    grow(start);
    while (E.queue.length && !E.stopped) grow(E.queue.splice(r.nextInt(E.queue.length), 1)[0]);
    if (E.portal) return E.list;
  }
}
function strongholdChests(ws, list, salt) {
  const out = [], [x0, z0, x1, z1] = span(list);
  for (let cx = x0; cx <= x1; cx += 16) for (let cz = z0; cz <= z1; cz += 16) {
    const r = chunkXoro(ws, cx, cz, salt);
    const chest = (p, i, k, lx, lz, table) => { const [x, z] = rotPos(p, lx, lz); if (inChunk(x, z, cx, cz)) out.push({ i, k, x, z, table, seed: r.nextLongJ() }); };
    list.forEach((p, i) => {
      if (!(p.b1[0] >= cx && p.b0[0] <= cx + 15 && p.b1[2] >= cz && p.b0[2] <= cz + 15)) return;
      switch (p.t) {
        case SH_STRAIGHT: genBox(p, cx, cz, 0, 0, 0, 4, 4, 6, r); r.skip(4); break;
        case SH_PRISON: genBox(p, cx, cz, 0, 0, 0, 8, 4, 10, r); r.skip(12); break;
        case SH_LEFT: case SH_RIGHT: genBox(p, cx, cz, 0, 0, 0, 4, 4, 4, r); break;
        case SH_ROOM: genBox(p, cx, cz, 0, 0, 0, 10, 6, 10, r); if (p.add) chest(p, i, 0, 3, 8, 'chests/stronghold_crossing'); break;
        case SH_SSTAIRS: genBox(p, cx, cz, 0, 0, 0, 4, 10, 7, r); break;
        case SH_STAIRS: genBox(p, cx, cz, 0, 0, 0, 4, 10, 4, r); break;
        case SH_FIVE: genBox(p, cx, cz, 0, 0, 0, 9, 8, 10, r); r.skip(109); break;
        case SH_CHEST: genBox(p, cx, cz, 0, 0, 0, 4, 4, 6, r); chest(p, i, 0, 3, 3, 'chests/stronghold_corridor'); break;
        case SH_LIBRARY: {
          const tall = p.b1[1] - p.b0[1] + 1 > 6;
          genBox(p, cx, cz, 0, 0, 0, 13, (tall ? 11 : 6) - 1, 14, r); r.skip(10 * 4 * 13);
          chest(p, i, 0, 3, 5, 'chests/stronghold_library');
          if (tall) chest(p, i, 1, 12, 1, 'chests/stronghold_library');
          break;
        }
        case SH_PORTAL: r.skip(760); r.skip(12); break;   // the room's blocks, then the 12 eyes
      }
    });
  }
  return out.sort((a, b) => a.i - b.i || a.k - b.k);
}

// ---- mineshaft ----
const [MS_ROOM, MS_CORRIDOR, MS_CROSSING, MS_STAIRS] = [0, 1, 2, 3];
function mineshaftPieces(ws, cx, cz, nmax = 2000) {
  const r = chunkRand(ws, cx, cz); r.nextDouble();   // the "is there a mineshaft here" roll
  const list = [], maxDepth = 8;
  const hit = (b0, b1) => list.some(q => boxesHit(q.b0, q.b1, b0, b1));
  const put = (t, b0, b1, f, depth, add = 0) => { const p = { t, b0, b1, rot: f, depth, add }; list.push(p); grow(p); };
  const extend = (x, y, z, f, depth) => {
    if (list.length >= nmax || depth > maxDepth || Math.abs(x - list[0].b0[0]) > 80 || Math.abs(z - list[0].b0[2]) > 80) return;
    depth++;
    const sel = r.nextInt(100);
    if (sel >= 80) {
      const y1 = 2 + 4 * (r.nextInt(4) === 0 ? 1 : 0);
      const B = [[[x - 1, y, z - 4], [x + 3, y + y1, z]], [[x, y, z - 1], [x + 4, y + y1, z + 3]], [[x - 1, y, z], [x + 3, y + y1, z + 4]], [[x - 4, y, z - 1], [x, y + y1, z + 3]]][f];
      if (!hit(...B)) put(MS_CROSSING, ...B, f, depth);
    } else if (sel >= 70) {
      const B = [[[x, y - 5, z - 8], [x + 2, y + 2, z]], [[x, y - 5, z], [x + 8, y + 2, z + 2]], [[x, y - 5, z], [x + 2, y + 2, z + 8]], [[x - 8, y - 5, z], [x, y + 2, z + 2]]][f];
      if (!hit(...B)) put(MS_STAIRS, ...B, f, depth);
    } else {
      for (let len = r.nextInt(3) + 2; len > 0; len--) {
        const L = len * 5;
        const B = [[[x, y, z - (L - 1)], [x + 2, y + 2, z]], [[x, y, z], [x + L - 1, y + 2, z + 2]], [[x, y, z], [x + 2, y + 2, z + L - 1]], [[x - (L - 1), y, z], [x, y + 2, z + 2]]][f];
        if (hit(...B)) continue;
        const rails = r.nextInt(3) === 0, spider = !rails && r.nextInt(23) === 0;
        put(MS_CORRIDOR, ...B, f, depth, (rails ? 1 : 0) | (spider ? 2 : 0));
        return;
      }
    }
  };
  function grow(p) {
    if (list.length >= nmax) return;
    const [b0, b1] = [p.b0, p.b1], d = p.depth;
    if (p.t === MS_CORRIDOR) {
      const e = r.nextInt(4), y = () => b0[1] - 1 + r.nextInt(3);
      if (p.rot === 0) e <= 1 ? extend(b0[0], y(), b0[2] - 1, 0, d) : e === 2 ? extend(b0[0] - 1, y(), b0[2], 3, d) : extend(b1[0] + 1, y(), b0[2], 1, d);
      else if (p.rot === 1) e <= 1 ? extend(b1[0] + 1, y(), b0[2], 1, d) : e === 2 ? extend(b1[0] - 3, y(), b0[2] - 1, 0, d) : extend(b1[0] - 3, y(), b1[2] + 1, 2, d);
      else if (p.rot === 2) e <= 1 ? extend(b0[0], y(), b1[2] + 1, 2, d) : e === 2 ? extend(b0[0] - 1, y(), b1[2] - 3, 3, d) : extend(b1[0] + 1, y(), b1[2] - 3, 1, d);
      else e <= 1 ? extend(b0[0] - 1, y(), b0[2], 3, d) : e === 2 ? extend(b0[0], y(), b0[2] - 1, 0, d) : extend(b0[0], y(), b1[2] + 1, 2, d);
      if (d >= maxDepth) return;
      if (p.rot !== 0 && p.rot !== 2) {
        for (let x = b0[0] + 3; x + 3 <= b1[0]; x += 5) { const s = r.nextInt(5); if (s === 0) extend(x, b0[1], b0[2] - 1, 0, d + 1); else if (s === 1) extend(x, b0[1], b1[2] + 1, 2, d + 1); }
      } else {
        for (let z = b0[2] + 3; z + 3 <= b1[2]; z += 5) { const s = r.nextInt(5); if (s === 0) extend(b0[0] - 1, b0[1], z, 3, d + 1); else if (s === 1) extend(b1[0] + 1, b0[1], z, 1, d + 1); }
      }
    } else if (p.t === MS_CROSSING) {
      const N = () => extend(b0[0] + 1, b0[1], b0[2] - 1, 0, d), W = () => extend(b0[0] - 1, b0[1], b0[2] + 1, 3, d), Ea = () => extend(b1[0] + 1, b0[1], b0[2] + 1, 1, d), S = () => extend(b0[0] + 1, b0[1], b1[2] + 1, 2, d);
      [[N, W, Ea], [N, S, Ea], [S, W, Ea], [N, S, W]][p.rot].forEach(g => g());
      if (b1[1] - b0[1] + 1 > 3) {
        if (r.next(1)) extend(b0[0] + 1, b0[1] + 4, b0[2] - 1, 0, d);
        if (r.next(1)) extend(b0[0] - 1, b0[1] + 4, b0[2] + 1, 3, d);
        if (r.next(1)) extend(b1[0] + 1, b0[1] + 4, b0[2] + 1, 1, d);
        if (r.next(1)) extend(b0[0] + 1, b0[1] + 4, b1[2] + 1, 2, d);
      }
    } else if (p.t === MS_ROOM) {
      const hs = Math.max(1, b1[1] - b0[1] + 1 - 4), xs = b1[0] - b0[0] + 1, zs = b1[2] - b0[2] + 1;
      const side = (n, go) => { for (let pos = 0; pos < n; pos += 4) { pos += r.nextInt(n); if (pos + 3 > n) break; go(pos, b0[1] + r.nextInt(hs) + 1); } };
      side(xs, (pos, y) => extend(b0[0] + pos, y, b0[2] - 1, 0, d));
      side(xs, (pos, y) => extend(b0[0] + pos, y, b1[2] + 1, 2, d));
      side(zs, (pos, y) => extend(b0[0] - 1, y, b0[2] + pos, 3, d));
      side(zs, (pos, y) => extend(b1[0] + 1, y, b0[2] + pos, 1, d));
    } else {
      [() => extend(b0[0], b0[1], b0[2] - 1, 0, d), () => extend(b1[0] + 1, b0[1], b0[2], 1, d), () => extend(b0[0], b0[1], b1[2] + 1, 2, d), () => extend(b0[0] - 1, b0[1], b0[2], 3, d)][p.rot]();
    }
  }
  const x = (cx << 4) + 2, z = (cz << 4) + 2;
  const room = { t: MS_ROOM, b0: [x, 50, z], b1: [x, 50, z], rot: 0, depth: 0, add: 0 };
  room.b1 = [x + 7 + r.nextInt(6), 50 + 4 + r.nextInt(6), z + 7 + r.nextInt(6)];
  list.push(room); grow(room);
  return list;
}
function mineshaftChests(ws, list, salt) {
  const out = [], [x0, z0, x1, z1] = span(list);
  for (let cx = x0; cx <= x1; cx += 16) for (let cz = z0; cz <= z1; cz += 16) {
    const r = chunkXoro(ws, cx, cz, salt);
    list.forEach((p, i) => {
      if (p.t !== MS_CORRIDOR || !(p.b1[0] >= cx && p.b0[0] <= cx + 15 && p.b1[2] >= cz && p.b0[2] <= cz + 15)) return;
      const n = Math.trunc((p.rot === 0 || p.rot === 2 ? p.b1[2] - p.b0[2] + 1 : p.b1[0] - p.b0[0] + 1) / 5), len = n * 5 - 1;
      r.skip(3 * (len + 1));   // cobblestone... air above the floor: one number per block
      if (p.add & 2) r.skip(6 * (len + 1));
      const at = (x, z) => { const [tx, tz] = rotPos(p, x, z); return inChunk(tx, tz, cx, cz); };
      for (let s = 0; s < n; s++) {
        const z = 2 + s * 5;
        if ([0, 1, 2].every(x => at(x, z)) && r.nextIntJ(4) !== 0) r.skip(2);   // wooden supports
        for (const [a, b] of [[0, -1], [2, -1], [0, 1], [2, 1], [0, -2], [2, -2], [0, 2], [2, 2]]) if (at(a, z + b)) r.nextFloat();   // cobwebs
        for (const [lx, lz] of [[2, z - 1], [0, z + 1]]) {   // a chest minecart: 1 in 100 on each side
          if (r.nextIntJ(100) !== 0) continue;
          const [tx, tz] = rotPos(p, lx, lz);
          if (inChunk(tx, tz, cx, cz)) { r.nextBoolean(); out.push({ i, x: tx, z: tz, table: 'chests/abandoned_mineshaft', seed: r.nextLongJ(), cart: true }); }
        }
        if (((p.add >> 1) & 3) === 1) {   // cave spider spawner, once
          const [tx, tz] = rotPos(p, 1, z - 1 + r.nextIntJ(3));
          if (inChunk(tx, tz, cx, cz)) p.add |= 4;
        }
      }
      if (p.add & 1) for (let k = 0; k <= len; k++) if (at(1, k)) r.nextFloat();   // rails
    });
  }
  return out.sort((a, b) => a.i - b.i);
}

// ---- end city ----
const EC = [[9, 3, 9], [11, 1, 11], [4, 5, 1], [4, 6, 7], [4, 5, 3], [4, 6, 3], [12, 3, 12], [12, 7, 12], [16, 5, 16], [11, 7, 11], [11, 7, 11], [13, 1, 13], [12, 23, 28], [13, 7, 13], [13, 7, 13], [15, 1, 15], [6, 6, 6], [6, 3, 6], [6, 3, 6], [8, 4, 8]];
const [EC_BASE_FLOOR, EC_BASE_ROOF, EC_BRIDGE_END, EC_GENTLE, EC_BRIDGE, EC_STEEP, EC_FAT_BASE, EC_FAT_MID, EC_FAT_TOP, EC_SECOND_1, EC_SECOND_2, EC_SECOND_ROOF, EC_SHIP, EC_THIRD_1, EC_THIRD_2, EC_THIRD_ROOF, EC_TOWER_BASE, , EC_TOWER_PIECE, EC_TOWER_TOP] = EC.keys();
const EC_NAMES = ['base_floor', 'base_roof', 'bridge_end', 'bridge_gentle_stairs', 'bridge_piece', 'bridge_steep_stairs', 'fat_tower_base', 'fat_tower_middle', 'fat_tower_top',
  'second_floor_1', 'second_floor_2', 'second_roof', 'ship', 'third_floor_1', 'third_floor_2', 'third_roof', 'tower_base', 'tower_floor', 'tower_piece', 'tower_top'];   // the pieces' files
function endCityPieces(ws, cx, cz) {
  const r = chunkRand(ws, cx, cz), all = [];
  let ship = false;
  // env: { off: where this level's pieces start in all, n: how many }
  const addP = (env, prev, rot, px, py, pz, t) => {
    const s = EC[t], pos = prev ? prev.pos.slice() : [px, py, pz], b0 = pos.slice(), b1 = pos.slice();
    b1[1] += s[1];
    if (rot === 0) { b1[0] += s[0]; b1[2] += s[2]; } else if (rot === 1) { b0[0] -= s[2]; b1[2] += s[0]; } else if (rot === 2) { b0[0] -= s[0]; b0[2] -= s[2]; } else { b1[0] += s[2]; b0[2] -= s[0]; }
    const p = { t, rot, depth: 0, pos, b0, b1 };
    if (prev) {
      const d = [[px, pz], [-pz, px], [-px, -pz], [pz, -px]][prev.rot];
      for (const v of [p.pos, p.b0, p.b1]) { v[0] += d[0]; v[1] += py; v[2] += d[1]; }
    }
    all[env.off + env.n++] = p;
    return p;
  };
  const rec = (gen, env, cur, depth, extra) => {
    if (depth > 8) return false;
    const loc = { off: env.off + env.n, n: 0, y: env.y };
    if (!gen(loc, cur, depth, extra)) return false;
    const gd = r.next(32);
    for (let i = 0; i < loc.n; i++) {
      const p = all[loc.off + i]; p.depth = gd;
      for (let j = 0; j < env.n; j++) {   // only the pieces of the level that asked
        const q = all[env.off + j];
        if (q.b1[0] >= p.b0[0] && q.b0[0] <= p.b1[0] && q.b1[2] >= p.b0[2] && q.b0[2] <= p.b1[2] && q.b1[1] >= p.b0[1] && q.b0[1] <= p.b1[1]) {
          if (cur.depth !== q.depth) return false;
          break;
        }
      }
    }
    env.n += loc.n;
    return true;
  };
  function tower(env, cur, depth) {
    const rot = cur.rot, x = 3 + r.nextInt(2), z = 3 + r.nextInt(2);
    let base = addP(env, cur, rot, x, -3, z, EC_TOWER_BASE);
    base = addP(env, base, rot, 0, 7, 0, EC_TOWER_PIECE);
    let floor = r.nextInt(3) === 0 ? base : null;
    const fc = 1 + r.nextInt(3);
    for (let i = 0; i < fc; i++) { base = addP(env, base, rot, 0, 4, 0, EC_TOWER_PIECE); if (i < fc - 1 && r.next(1)) floor = base; }
    if (floor) {
      for (const [dr, bx, by, bz] of [[0, 1, -1, 0], [1, 6, -1, 1], [3, 0, -1, 5], [2, 5, -1, 6]]) {
        if (!r.next(1)) continue;
        rec(bridge, env, addP(env, base, (rot + dr) & 3, bx, by, bz, EC_BRIDGE_END), depth + 1);   // from the top piece, as cubiomes does
      }
    } else if (depth !== 7) return rec(fat, env, base, depth + 1);
    addP(env, base, rot, -1, 4, -1, EC_TOWER_TOP);
    return true;
  }
  function bridge(env, cur, depth) {
    const rot = cur.rot, fc = 1 + r.nextInt(4);
    let base = addP(env, cur, rot, 0, 0, -4, EC_BRIDGE), y = 0;
    base.depth = -1;
    for (let i = 0; i < fc; i++) {
      if (r.next(1)) { base = addP(env, base, rot, 0, y, -4, EC_BRIDGE); y = 0; continue; }
      base = r.next(1) ? addP(env, base, rot, 0, y, -4, EC_STEEP) : addP(env, base, rot, 0, y, -8, EC_GENTLE);
      y = 4;
    }
    if (!ship && r.nextInt(10 - depth) === 0) {
      const x = -8 + r.nextInt(8), z = -70 + r.nextInt(10);
      base = addP(env, base, rot, x, y, z, EC_SHIP); ship = true;
    } else {
      env.y = y + 1;
      if (!rec(house, env, base, depth + 1)) return false;
    }
    base = addP(env, base, (rot + 2) & 3, 4, y, 0, EC_BRIDGE_END);
    base.depth = -1;
    return true;
  }
  function house(env, cur, depth) {
    if (depth > 8) return false;
    const rot = cur.rot;
    let base = addP(env, cur, rot, -3, env.y, -11, EC_BASE_FLOOR);
    const size = r.nextInt(3);
    if (size === 0) { addP(env, base, rot, -1, 4, -1, EC_BASE_ROOF); return true; }
    base = addP(env, base, rot, -1, 0, -1, EC_SECOND_2);
    if (size === 1) base = addP(env, base, rot, -1, 8, -1, EC_SECOND_ROOF);
    else { base = addP(env, base, rot, -1, 4, -1, EC_THIRD_2); base = addP(env, base, rot, -1, 8, -1, EC_THIRD_ROOF); }
    rec(tower, env, base, depth + 1);
    return true;
  }
  function fat(env, cur, depth) {
    const rot = cur.rot;
    let base = addP(env, cur, rot, -3, 4, -3, EC_FAT_BASE);
    base = addP(env, base, rot, 0, 4, 0, EC_FAT_MID);
    for (let j = 0; j < 2 && r.nextInt(3) !== 0; j++) {
      base = addP(env, base, rot, 0, 8, 0, EC_FAT_MID);
      for (const [dr, bx, by, bz] of [[0, 4, -1, 0], [1, 12, -1, 4], [3, 0, -1, 8], [2, 8, -1, 12]]) {
        if (!r.next(1)) continue;
        rec(bridge, env, addP(env, base, (rot + dr) & 3, bx, by, bz, EC_BRIDGE_END), depth + 1);
      }
    }
    addP(env, base, rot, -2, 8, -2, EC_FAT_TOP);
    return true;
  }
  const rot = r.nextInt(4), env = { off: 0, n: 0, y: 0 };
  let base = addP(env, null, rot, cx * 16 + 8, 0, cz * 16 + 8, EC_BASE_FLOOR);
  base = addP(env, base, rot, -1, 0, -1, EC_SECOND_1);
  base = addP(env, base, rot, -1, 4, -1, EC_THIRD_1);
  base = addP(env, base, rot, -1, 8, -1, EC_THIRD_ROOF);
  rec(tower, env, base, 1);
  return all.slice(0, env.n);
}
// chests: [x, z] in the piece's own turned frame (pos − 1, then turned)
const EC_CHESTS = { [EC_FAT_TOP]: [[3, 11], [5, 13]], [EC_SHIP]: [[5, 7], [7, 7]], [EC_THIRD_2]: [[6, 2]] };
const ecTurn = (p, a, b) => { const x = p.pos[0] - 1, z = p.pos[2] - 1; return [[x + a, z + b], [x - b, z + a], [x - a, z - b], [x + b, z - a]][p.rot]; };
function endCityChests(ws, list, salt) {
  const out = [];
  list.forEach((p, i) => {
    const C = EC_CHESTS[p.t]; if (!C) return;
    const pts = C.map(([a, b]) => ecTurn(p, a, b));
    const push = (pt, seed) => out.push({ i, x: pt[0], z: pt[1], table: 'chests/end_city_treasure', seed, ship: p.t === EC_SHIP });
    if (pts.length === 2 && pts[0][0] >> 4 === pts[1][0] >> 4 && pts[0][1] >> 4 === pts[1][1] >> 4) {
      const r = chunkXoro(ws, pts[0][0], pts[0][1], salt); r.nextLongJ(); r.nextLongJ();
      push(pts[0], r.nextLongJ()); push(pts[1], r.nextLongJ());
    } else for (const pt of pts) { const r = chunkXoro(ws, pt[0], pt[1], salt); r.nextLongJ(); push(pt, r.nextLongJ()); }
  });
  return out;
}

const turn4 = (rot, a, b) => [[a, b], [-b, a], [-a, -b], [b, -a]][rot];

// a structure's plan, or null when this version is not covered
function lootStructure(key, ws, x, z, ver, biome, built) {   // built: a camp already put together (js/06d-jigsaw.js)
  ws = BigInt(ws); biome = String(biome || '').toLowerCase().replace(/ /g, '_');   // the map's name ("birch forest") → the game's id
  const minX = x & ~15, minZ = z & ~15, cx = x >> 4, cz = z >> 4;
  const roll = c => { c.items = lootRoll(c.table, ver, c.seed, c.biome || biome, c.disp ? 9 : c.pot ? 1 : 27); return c; };
  const plan = o => { o.chests.forEach(roll); return Object.assign({ key, x, z, minX, minZ, pieces: [] }, o); };
  const saltKey = key.startsWith('bas_') ? 'bastion' : key === 'endship' ? 'endcity' : key === 'mineshaft' && /badlands/.test(biome || '') ? 'mineshaft_mesa' : key;
  if (key === 'pyramid') return lootPyramid(ws, x, z, ver);
  if (typeof LOOT_MORE !== 'undefined' && LOOT_MORE[key]) { const o2 = LOOT_MORE[key](ws, x, z, ver, biome, built); return o2 && plan(o2); }   // js/06b2-structs2.js, js/06e-ancient.js
  const salt = lootSalt(saltKey, ver); if (!salt) return null;
  if (key === 'treasure') {
    const r = chunkXoro(ws, minX, minZ, salt), c = { x: minX + 9, z: minZ + 9, table: 'chests/buried_treasure', seed: r.nextLongJ() };
    return plan({ ground: 'block/sand', x: c.x, z: c.z, chests: [c], pieces: [{ t: 'chest', b0: [c.x, 0, c.z], b1: [c.x, 0, c.z] }] });
  }
  if (key === 'outpost') {
    const rot = chunkRand(ws, cx, cz).nextInt(4), [dx, dz] = [[10, 10], [-10, 10], [-10, -10], [10, -10]][rot];
    const c = { x: minX + dx, z: minZ + dz, table: 'chests/pillager_outpost' }; c.seed = chunkXoro(ws, c.x, c.z, salt).nextLongJ();
    const A = jigAssemble(ws, cx, cz, JIG_CONF.outpost, JIG_CONF.outpost.pool);   // the whole outpost (tents, cages, logs), to draw it
    const pieces = A ? jigPlanOf('outpost', ws, A, []).pieces : [{ t: 'tower', b0: [minX + (dx < 0 ? -14 : 0), 0, minZ + (dz < 0 ? -14 : 0)], b1: [minX + (dx < 0 ? 0 : 14), 0, minZ + (dz < 0 ? 0 : 14)] }];
    return plan({ ground: 'block/grass_block_top|91bd59', facing: ['north', 'east', 'south', 'west'][rot], chests: [c], pieces });
  }
  if (saltKey === 'bastion' || key === 'ancient') {   // whole structure, piece by piece: js/06d-jigsaw.js
    const conf = JIG_CONF[saltKey === 'bastion' ? 'bastion' : 'ancient'], A = jigAssemble(ws, cx, cz, conf, conf.pool);
    return A && plan(jigPlanOf(saltKey, ws, A, jigContainers(ws, A, salt)));
  }
  if (saltKey === 'endcity') {
    const pieces = endCityPieces(ws, cx, cz);
    pieces.forEach(p => { p.topx = ['end_city/' + EC_NAMES[p.t], p.rot, 0, p.pos[0] - 1, p.pos[2] - 1, 0, 0]; });   // drawn block by block (js/06h-topview.js)
    return plan({ pieces, chests: endCityChests(ws, pieces, salt) });
  }
  if (key === 'stronghold') {
    const pieces = strongholdPieces(ws, cx, cz);
    return plan({ pieces, chests: strongholdChests(ws, pieces, salt) });
  }
  if (key === 'mineshaft') {
    const pieces = mineshaftPieces(ws, cx, cz);
    return plan({ pieces, chests: mineshaftChests(ws, pieces, salt), mesa: saltKey === 'mineshaft_mesa' });
  }
  return null;
}
LOOT_KEYS.clear();
['pyramid', 'treasure', 'outpost', 'bas_treasure', 'bas_units', 'bas_hoglin', 'bas_bridge', 'endship', 'endcity', 'stronghold', 'mineshaft', 'jungle', 'igloo', 'shipwreck', 'portal', 'nportal', 'fortress', 'camp', 'ancient'].forEach(k => LOOT_KEYS.add(k));
