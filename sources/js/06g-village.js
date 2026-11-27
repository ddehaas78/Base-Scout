// ---------- villages and trial chambers: put together piece by piece like the game does it (js/06d-jigsaw.js) ----------

// villages: five kinds, each its own structure. In a village chunk the game tries them in a random order (the chunk's own
// random numbers) and builds the first one whose biome, at the middle of its town center, fits.
const VILLAGE_KINDS = ['plains', 'desert', 'savanna', 'snowy', 'taiga'];   // the order of structure_set/villages
const VILLAGE_BIOMES = { plains: ['plains', 'meadow'], desert: ['desert'], savanna: ['savanna'], snowy: ['snowy_plains'], taiga: ['taiga'] };
const VILLAGE_SALT = { desert: 0, plains: 1, savanna: 2, snowy: 3, taiga: 4 };   // + 21 (1.19.4 to 26.2) or + 39 (26.3): surface structures, by name
Object.assign(LOOT_SALT, { trial: [['1.21', 3, 4]] });   // underground structures: buried_treasure, mineshaft, mineshaft_mesa, trail_ruins, trial_chambers
const villageSalt = (kind, ver) => [, 4, VILLAGE_SALT[kind] + (verAtLeast(ver, '26.3') ? 39 : 21)];
const villageKindOf = biome => VILLAGE_KINDS.find(k => VILLAGE_BIOMES[k].includes(biome));

const villageBuild = (ws, x, z, kind, ver) => {
  const A = jigAssemble(BigInt(ws), x >> 4, z >> 4, JIG_CONF.village, 'village/' + kind + '/town_centers');
  return A && { A, kind, conts: jigContainers(BigInt(ws), A, villageSalt(kind, ver)) };
};
async function villageResolve(ws, x, z, ver) {
  const r = chunkRand(BigInt(ws), x >> 4, z >> 4), left = VILLAGE_KINDS.slice();
  while (left.length) {
    const kind = left.splice(r.nextInt(left.length), 1)[0];   // all weigh the same
    const V = villageBuild(ws, x, z, kind, ver); if (!V) continue;
    const [mx, , mz] = V.A.center, [b] = await exactBiomes([[mx, SURFACE_Y, mz]]);
    if (!b || VILLAGE_BIOMES[kind].includes(b)) return V;
  }
  return null;
}
// a house's short name: "small house 3", "weaponsmith 2"
const villagePieceName = n => n.split('/').pop().replace(/^(plains|desert|savanna|snowy|taiga)_/, '').replace(/_(\d+)$/, ' $1').replace(/_/g, ' ');
LOOT_MORE.village = (ws, x, z, ver, biome, built) => {
  const V = built || (villageKindOf(biome) && villageBuild(ws, x, z, villageKindOf(biome), ver)); if (!V) return null;
  const P = jigPlanOf('village', ws, V.A, V.conts);
  P.pieces.forEach(p => { p.kind = V.kind; });
  P.chests.forEach(c => { c.house = villagePieceName(V.A.pieces[c.pi].name || ''); });
  const ground = { plains: 'block/grass_block_top|91bd59', desert: 'block/sand', savanna: 'block/grass_block_top|bfb755', snowy: 'block/snow', taiga: 'block/grass_block_top|86b783' }[V.kind];
  return { ground, info: `<span>${{ plains: 'Plains village', desert: 'Desert village', savanna: 'Savanna village', snowy: 'Snowy village', taiga: 'Taiga village' }[V.kind]}</span>`, ...P };
};

// trial chambers: deep underground (Y −40 to −20 for the start), every chest, barrel, pot and dispenser with loot
LOOT_MORE.trial = (ws, x, z, ver) => {
  const salt = lootSalt('trial', ver); if (!salt) return null;
  const A = jigAssemble(BigInt(ws), x >> 4, z >> 4, JIG_CONF.trial, JIG_CONF.trial.pool); if (!A) return null;
  return jigPlanOf('trial', ws, A, jigContainers(BigInt(ws), A, salt));
};

['village', 'trial'].forEach(k => LOOT_KEYS.add(k));
