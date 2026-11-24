const WASM_B64 = "__WASM_B64__";
const $ = id => document.getElementById(id);
// interface size (--ui in style.css): the page is zoomed, so things drawn on the maps are scaled to match
// CSS values are read many times per map frame: keep them until the next frame (theme or size may change after)
const CSS_CACHE = new Map();
const cssRaw = v => {
  let r = CSS_CACHE.get(v);
  if (r === undefined) {
    if (!CSS_CACHE.size) requestAnimationFrame(() => CSS_CACHE.clear());
    r = getComputedStyle(document.documentElement).getPropertyValue(v); CSS_CACHE.set(v, r);
  }
  return r;
};
const uiZoom = () => parseFloat(cssRaw('--ui')) || 1;
const drawScale = () => (devicePixelRatio || 1) * uiZoom();
let RADII = [250, 500, 750];   // ring radius in blocks; the page shows diameters
const ZCOL = ['--z1', '--z2', '--z3'];
const STRUCTURES = [
  { key: 'village', name: 'Village' }, { key: 'trial', name: 'Trial chambers' }, { key: 'ancient', name: 'Ancient city' },
  { key: 'stronghold', name: 'Stronghold' }, { key: 'monument', name: 'Ocean monument' }, { key: 'mansion', name: 'Woodland mansion' },
  { key: 'outpost', name: 'Pillager outpost' }, { key: 'pyramid', name: 'Desert pyramid' }, { key: 'hut', name: 'Witch hut' },
  // smaller ones, listed under the main structures
  { key: 'treasure', name: 'Buried treasure', minor: 1 }, { key: 'portal', name: 'Ruined portal', minor: 1 },
  { key: 'shipwreck', name: 'Shipwreck', minor: 1 }, { key: 'trail', name: 'Trail ruins', minor: 1 },
  { key: 'jungle', name: 'Jungle temple', minor: 1 }, { key: 'igloo', name: 'Igloo', minor: 1 },
  { key: 'ruins', name: 'Ocean ruins', minor: 1 }, { key: 'mineshaft', name: 'Mineshaft', minor: 1 },
  { key: 'well', name: 'Desert well', minor: 1 }, { key: 'fossil', name: 'Fossil', minor: 1 },
  { key: 'geode', name: 'Amethyst geode', minor: 1 }, { key: 'camp', name: 'Abandoned camp', minor: 1 },
];
const NETHER_STRUCTS = [{ key: 'fortress', name: 'Nether fortress' },
  { key: 'bas_treasure', name: 'Bastion: treasure' }, { key: 'bas_units', name: 'Bastion: housing' },
  { key: 'bas_hoglin', name: 'Bastion: hoglin stables' }, { key: 'bas_bridge', name: 'Bastion: bridge' },
  { key: 'nportal', name: 'Ruined portal', minor: 1 }];
const END_STRUCTS = [{ key: 'endship', name: 'End ship (elytra)' }, { key: 'endcity', name: 'End city, no ship' },
  { key: 'gateway', name: 'Main island gateways' }, { key: 'gatexit', name: 'Where they lead' }, { key: 'retgate', name: 'Wild gateways' }];
const ALWAYS = new Set(['stronghold', 'gateway', 'gatexit']);   // few enough to show at any zoom
const ALL_STRUCTS = STRUCTURES.concat(NETHER_STRUCTS, END_STRUCTS);
const MINOR = new Set(STRUCTURES.concat(NETHER_STRUCTS).filter(s => s.minor).map(s => s.key));   // drawn small and underneath when the map is busy
const DIMS = {
  '0': { name: 'Overworld', structs: STRUCTURES, maxSpan: 120000 },
  '-1': { name: 'Nether', structs: NETHER_STRUCTS, maxSpan: 60000 },
  '1': { name: 'End', structs: END_STRUCTS, maxSpan: 16000 },
};
const BIOMES = [
  ['plains','Plains',1],['meadow','Meadow',177],['cherry','Cherry grove',185],['flower','Flower forest',132],['forest','Forest',4],
  ['birch','Birch forest',27],['dark','Dark forest',29],['pale','Pale garden',186],['taiga','Taiga',5],['jungle','Jungle',21],
  ['bamboo','Bamboo jungle',168],['savanna','Savanna',35],['desert','Desert',2],['badlands','Badlands',37],['swamp','Swamp',6],
  ['mangrove','Mangrove swamp',184],['mushroom','Mushroom fields',14],['snowy','Snowy plains',12],['icespikes','Ice spikes',140],
  ['peaks','Mountain peaks',180],['slopes','Snowy slopes',179],['windswept','Windswept hills',3],['ocean','Ocean',0],
  ['warmocean','Warm ocean',44],['river','River',7],['beach','Beach',16],['dappled','Dappled forest',187],
  // "More biomes": single variants (the chips above group some of them, e.g. Ocean covers every ocean)
  ['sunflower','Sunflower plains',129,1],['snowytaiga','Snowy taiga',30,1],['oldbirch','Old growth birch forest',155,1],['oldpine','Old growth pine taiga',32,1],['oldspruce','Old growth spruce taiga',160,1],['sparsejungle','Sparse jungle',23,1],['savplateau','Savanna plateau',36,1],['wsavanna','Windswept savanna',163,1],['woodbad','Wooded badlands',38,1],['eroded','Eroded badlands',165,1],['grove','Grove',178,1],['jagged','Jagged peaks',180,1],['frozenpeaks','Frozen peaks',181,1],['stonypeaks','Stony peaks',182,1],['wforest','Windswept forest',34,1],['gravelly','Windswept gravelly hills',131,1],['stonyshore','Stony shore',25,1],['snowybeach','Snowy beach',26,1],['frozenriver','Frozen river',11,1],['deepocean','Deep ocean',24,1],['lukewarm','Lukewarm ocean',45,1],['coldocean','Cold ocean',46,1],['frozenocean','Frozen ocean',10,1],
  // cave biomes: found underground (see CAVE_Y in worker.js); the map still shows the surface
  ['dripstone','Dripstone caves',174,2],['lush','Lush caves',175,2],['deepdark','Deep dark',183,2],['sulfur','Sulfur caves',188,2],
].map(([key, name, swatch, minor]) => ({ key, name, swatch, minor: !!minor, cave: minor === 2 }));
const NETHER_BIOMES = [['nwastes', 'Nether wastes', 8], ['soulsand', 'Soul sand valley', 170], ['crimson', 'Crimson forest', 171],
  ['warped', 'Warped forest', 172], ['basalt', 'Basalt deltas', 173]].map(([key, name, swatch]) => ({ key, name, swatch }));
// Java versions, newest first: [label, cubiomes version, changes after 1.21.4 (see wrap.c)]
const VERSIONS = [
  ['26.3', 28, 4], ['26.2', 28, 3], ['26.1.2', 28, 2], ['26.1.1', 28, 2], ['26.1', 28, 2],
  ['1.21.11', 28, 2], ['1.21.10', 28, 2], ['1.21.9', 28, 2], ['1.21.8', 28, 1], ['1.21.7', 28, 1], ['1.21.6', 28, 1], ['1.21.5', 28, 1],
  ['1.21.4', 28, 0], ['1.21.3', 27, 0], ['1.21.2', 27, 0], ['1.21.1', 26, 0], ['1.21', 26, 0],
  ['1.20.6', 25, 0], ['1.20.5', 25, 0], ['1.20.4', 25, 0], ['1.20.3', 25, 0], ['1.20.2', 25, 0], ['1.20.1', 25, 0], ['1.20', 25, 0],
  ['1.19.4', 24, 0], ['1.19.3', 24, 0], ['1.19.2', 23, 0], ['1.19.1', 23, 0], ['1.19', 23, 0],
  ['1.18.2', 22, 0], ['1.18.1', 22, 0], ['1.18', 22, 0],
];
const vAge = label => { const i = VERSIONS.findIndex(v => v[0] === label); return i < 0 ? -1 : VERSIONS.length - i; };   // bigger = newer
let VER = '26.3';
try { const v = localStorage.getItem('basescout.ver'); if (vAge(v) > 0) VER = v; } catch {}
const verOf = label => { const v = VERSIONS.find(q => q[0] === label) || VERSIONS[0]; return { mc: v[1], ext: v[2] }; };
const curVer = () => verOf(VER);
// first version where a structure or biome exists (the rest exist in every version listed)
const SINCE = { lib: '26.1', ancient: '1.19', trial: '1.21', trail: '1.20', camp: '26.3', mangrove: '1.19', cherry: '1.20', pale: '1.21.4', dappled: '26.3', sulfur: '26.2', deepdark: '1.19' };
const inVer = (key, label = VER) => !SINCE[key] || vAge(label) >= vAge(SINCE[key]);
const meta = it => it.kind === 'structure' ? ALL_STRUCTS.find(s => s.key === it.key) : BIOMES.concat(NETHER_BIOMES).find(b => b.key === it.key);
const isNetherKey = k => NETHER_STRUCTS.some(s => s.key === k) || NETHER_BIOMES.some(b => b.key === k);
let findDim = 0;
const placedStore = { '0': [], '-1': [] };
const findStructs = () => findDim === -1 ? NETHER_STRUCTS : STRUCTURES;
const findBiomes = () => findDim === -1 ? NETHER_BIOMES : BIOMES;

// Example layout so the page opens working; the user's own drags replace it.
let placed = [];
let tab = 'structure', armed = null;   // armed: item picked by tap, waiting for a zone
let colors = null, names = null, worker = null, mapWorker = null, mapReady = false, running = false, job = null;
let exact = [], close = [], sel = null, tilesDone = 0, shown = { exact: 6, close: 6 };

const css = v => cssRaw(v).trim();
// set text / HTML only when it changed: maps redraw often and every DOM write is translated again
// (an element written this way must always be written this way, or the remembered value goes stale)
const setText = (el, s) => { if (el._w !== 't' + s) { el._w = 't' + s; el.textContent = s; } };
const setHTML = (el, s) => { if (el._w !== 'h' + s) { el._w = 'h' + s; el.innerHTML = s; } };
const fmt = n => Math.round(n).toLocaleString('en-US');
const rgb = id => colors ? `rgb(${colors[id*3]},${colors[id*3+1]},${colors[id*3+2]})` : '#777';

const BIOME_SIZES = [[0, 'Any size'], [64, 'Small · 64+ across'], [128, 'Medium · 128+ across'], [256, 'Large · 256+ across'], [512, 'Huge · 512+ across']];
const sizeTag = s => s >= 512 ? 'XL' : s >= 256 ? 'L' : s >= 128 ? 'M' : s >= 64 ? 'S' : '';
function renderBiomeSizes() {
  const list = placed.filter(q => q.kind === 'biome');
  $('bsizes').hidden = !list.length;
  $('bsrows').innerHTML = '';
  for (const it of list) {
    const m = meta(it), row = document.createElement('label');
    row.className = 'row';
    row.innerHTML = `<span class="swatch" style="background:${rgb(m.swatch)}"></span><span class="nm">${m.name}</span>
      <select aria-label="How big the ${m.name} patch has to be">${BIOME_SIZES.map(([v, t]) => `<option value="${v}"${(it.size || 0) === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
    row.querySelector('select').onchange = ev => { it.size = +ev.target.value; renderTarget(); restartSoon(); };
    $('bsrows').appendChild(row);
  }
}
function chipHTML(it) {
  const m = meta(it);
  const icon = it.kind === 'structure' ? `<img class="ico" alt="" src="${ICONS[it.key] ? ICONS[it.key].url : ''}">` : `<span class="swatch" style="background:${rgb(m.swatch)}"></span>`;
  const tag = it.kind === 'biome' && it.size ? `<span class="bsz" title="At least ${it.size} blocks across">${sizeTag(it.size)}</span>` : '';
  return `${icon}<span class="t">${m.name}</span>${tag}`;
}

