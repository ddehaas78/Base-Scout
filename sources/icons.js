// Original 16x16 pixel icons for each structure (drawn for Base Scout, not game textures).
const ICON_PAL = {
  k: '#1b1b1b', R: '#b5482f', W: '#c99a5b', b: '#6fb6e0', d: '#6b4423', C: '#c8754a', T: '#5c5f5a', D: '#3c3f47',
  c: '#2fc9d6', S: '#0c4d55', L: '#ece8d6', g: '#3b9a5a', P: '#5aa79a', p: '#2f6b62', Q: '#3a2c20', O: '#6b4f32',
  w: '#e8d27a', e: '#2b1d12', G: '#5a5a5a', H: '#8c8c8c', B: '#7b5a3a', n: '#2a2a2a', Y: '#e3cf8a', y: '#c9772f',
  u: '#6b5530', M: '#3d5a3a', N: '#6e4e33', v: '#9b6bc9', l: '#4e3622', '~': '#3b6fb5', I: '#f2f6fa', i: '#c8d6e3',
  j: '#2b3a4a', s: '#9a9a8e', m: '#5f8a4a', z: '#c9b77e', A: '#5fb8f0', K: '#e0864a', V: '#b8b8c4', r: '#8e82ad', t: '#cfc6ea',
  f: '#6a2a2f', F: '#3d1519', x: '#34313b', X: '#4d4957', a: '#f0c33c', h: '#a77aa8', q: '#d7b0d7', E: '#e3e0a8', o: '#0d0d10',
};
const ICON_ART = {
  village: [
    '.......kk.......', '......kRRk......', '.....kRRRRk.....', '....kRRRRRRk....', '...kRRRRRRRRk...', '..kkkkkkkkkkkk..',
    '...kWWWWWWWWk...', '...kWbbWWbbWk...', '...kWbbWWbbWk...', '...kWWWWWWWWk...', '...kWWWddWWWk...', '...kWWWddWWWk...',
    '...kWWWddWWWk...', '...kkkkkkkkkk...'],
  trial: [
    '..kkkkkkkkkkkk..', '..kCCCCCCCCCCk..', '..kCkkkkkkkkCk..', '..kCkTTTTTTkCk..', '..kCkTkTTkTkCk..', '..kCkTTTTTTkCk..',
    '..kCkTkTTkTkCk..', '..kCkTTTTTTkCk..', '..kCkTkTTkTkCk..', '..kCkTTTTTTkCk..', '..kCkkkkkkkkCk..', '..kCCCCCCCCCCk..',
    '..kkkkkkkkkkkk..'],
  ancient: [
    '...kkkkkkkkkk...', '..kDDDDDDDDDDk..', '..kDkkkkkkkkDk..', '..kDkSSSSSSkDk..', '..kDkSccccSkDk..', '..kDkScSScSkDk..',
    '..kDkScSScSkDk..', '..kDkSccccSkDk..', '..kDkSSSSSSkDk..', '..kDkSSSSSSkDk..', '.kkDkkSSSSkkDkk.', '.kDDDDkSSkDDDDk.',
    '.kkkkkkkkkkkkkk.'],
  stronghold: [
    '....kkkkkkkk....', '..kkLLLLLLLLkk..', '.kLLLLggggLLLLk.', 'kLLLLggkkggLLLLk', 'kLLLggkkkkggLLLk', 'kLLLggkkkkggLLLk',
    'kLLLLggkkggLLLLk', '.kLLLLggggLLLLk.', '..kkLLLLLLLLkk..', '....kkkkkkkk....'],
  monument: [
    '.......kk.......', '......kPPk......', '.....kPPPPk.....', '....kPPppPPk....', '...kPPPPPPPPk...', '..kkkkkkkkkkkk..',
    '..kPPPPPPPPPPk..', '..kPpPPppPPpPk..', '..kPPPPPPPPPPk..', '.kkkkkkkkkkkkkk.', '.kPPPPPPPPPPPPk.', '.kPPppPPPPppPPk.',
    '.kPPPPPPPPPPPPk.', '.kkkkkkkkkkkkkk.'],
  mansion: [
    '...kkkkkkkkkk...', '..kQQQQQQQQQQk..', '.kQQQQQQQQQQQQk.', 'kkkkkkkkkkkkkkkk', '.kOOOOOOOOOOOOk.', '.kOwOOwOOwOOwOk.',
    '.kOOOOOOOOOOOOk.', '.kkkkkkkkkkkkkk.', '.kOOOOOOOOOOOOk.', '.kOwOOwOOwOOwOk.', '.kOOOOOeeOOOOOk.', '.kOOOOOeeOOOOOk.',
    '.kkkkkkkkkkkkkk.'],
  outpost: [
    '....kkkkkkkk....', '....kGGGGGGk....', '...kkkkkkkkkk...', '...kHHHHHHHHk...', '....kBBBBBBk....', '....kBnBBnBk....',
    '....kBBBBBBk....', '....kBBBBBBk....', '....kBnBBnBk....', '....kBBBBBBk....', '....kBBBBBBk....', '....kBBeeBBk....',
    '....kBBeeBBk....', '...kkkkkkkkkk...'],
  pyramid: [
    '.......kk.......', '......kYYk......', '.....kYYYYk.....', '....kYYyyYYk....', '...kYYYYYYYYk...', '..kYYYyYYyYYYk..',
    '.kYYYYYYYYYYYYk.', 'kYYYYYuuuuYYYYYk', 'kYYYYYuuuuYYYYYk', 'kkkkkkkkkkkkkkkk'],
  hut: [
    '.....kkkkkk.....', '....kMMMMMMk....', '...kMMMMMMMMk...', '..kkkkkkkkkkkk..', '...kNNNNNNNNk...', '...kNvNNNNvNk...',
    '...kNNNNNNNNk...', '...kkkkkkkkkk...', '....kl....lk....', '....kl....lk....', '....kl....lk....', '~~~~kl~~~~lk~~~~',
    '~~~~~~~~~~~~~~~~'],
};
Object.assign(ICON_ART, {
  fortress: [
    '.kkk........kkk.', '.kfk........kfk.', '.kFk........kFk.', 'kkkkkkkkkkkkkkkk', 'kffffffffffffffk', 'kfFfFfFfFfFfFfFk',
    'kkkkkkkkkkkkkkkk', '..kfk......kfk..', '..kFk......kFk..', '..kfk......kfk..', '..kFk......kFk..', '..kkk......kkk..'],
  bastion: [
    '.kkkk......kkkk.', '.kxxk......kxxk.', '.kxxkkkkkkkkxxk.', '.kxxxxxxxxxxxxk.', '.kxXxxxaaxxxXxk.', '.kxxxxaaaaxxxxk.',
    '.kxXxxxaaxxxXxk.', '.kxxxxxxxxxxxxk.', '.kxxxxkkkkxxxxk.', '.kxXxxkookxxXxk.', '.kxxxxkookxxxxk.', '.kkkkkkkkkkkkkk.'],
  gateway: [
    '.....kkkkkk.....', '....kGGGGGGk....', '...kGkkkkkkGk...', '...kGkootokGk...', '...kGkoooqkGk...', '...kGkotookGk...',
    '...kGkkkkkkGk...', '....kGGGGGGk....', '.....kkkkkk.....'],
  gatexit: [
    '.....kkkkkk.....', '....khhhhhhk....', '...khkkkkkkhk...', '...khkootokhk...', '...khkoooqkhk...', '...khkotookhk...',
    '...khkkkkkkhk...', '....khhhhhhk....', '.....kkkkkk.....'],
  retgate: [
    '.....kkkkkk.....', '....kEEEEEEk....', '...kEkkkkkkEk...', '...kEkootokEk...', '...kEkoooqkEk...', '...kEkotookEk...',
    '...kEkkkkkkEk...', '....kEEEEEEk....', '.....kkkkkk.....'],
  endship: [
    '.kkkk......kkkk.', 'krrrrkk..kkrrrrk', 'krtrrrrkkrrrrtrk', 'krrrrrrkkrrrrrrk', '.krrrrrkkrrrrrk.', '.krrrrk..krrrrk.',
    '..krrrk..krrrk..', '..krrk....krrk..', '...krk....krk...', '...kk......kk...'],
  endcity: [
    '....kkkkkkkk....', '....khhhhhhk....', '....kkkkkkkk....', '.....khqqhk.....', '.....khhhhk.....', '...kkkkkkkkkk...',
    '...khhhhhhhhk...', '...kkkkkkkkkk...', '.....khqqhk.....', '.....khhhhk.....', '.....khoohk.....', '....kkkkkkkk....',
    '..kEEEEEEEEEEk..', '..kkkkkkkkkkkk..'],
});

// Smaller structures (drawn for Base Scout, not game textures)
Object.assign(ICON_ART, {
 "treasure": [
  "..kkkkkkkkkkkk..",
  ".kBBBBBBBBBBBBk.",
  ".kBNNNNNNNNNNBk.",
  ".kBBBBBBBBBBBBk.",
  ".kkkkkkaakkkkkk.",
  ".kBBBBkaakBBBBk.",
  ".kBNNNNkkNNNNBk.",
  ".kBNNNNNNNNNNBk.",
  ".kBBBBBBBBBBBBk.",
  ".kkkkkkkkkkkkkk."
 ],
 "portal": [
  "...kkkkkkk......",
  "...kxXxXxXk.....",
  "...kXkkkkkxk....",
  "...kxkvvvvkXk...",
  "...kXkvqvvkxk...",
  "...kxkvvvvkXk...",
  "...kXkvvqvkxk...",
  "...kxkvvvvkXk...",
  "...kXkvvvvkxk...",
  "...kxkkkkkkXk...",
  "...kXxXxXxXxk...",
  "...kkkkkkkkkk...",
  "..kxk....kxXk...",
  "...k......kk...."
 ],
 "shipwreck": [
  ".......k........",
  "......kLk.......",
  "......kLLk......",
  "......kLLLk.....",
  "......kLLLLk....",
  "......kdkkkk....",
  "......kdk.......",
  "kk....kdk.....kk",
  "kNkkkkkkkkkkkkNk",
  ".kNNNNNNNNNNNNk.",
  ".kNBNNBNNBNNBNk.",
  "..kNNNNNNNNNNk..",
  "~~~kkkkkkkkkk~~~",
  "~~~~~~~~~~~~~~~~"
 ],
 "trail": [
  "....kkkkkkkk....",
  "...kyyyyyyyyk...",
  "..kyykkkkkkyyk..",
  "..kyk......kyk..",
  "..kyk.kkkk.kyk..",
  "..kCk.kRRk.kCk..",
  "..kyk.kRRk.kyk..",
  "..kCk.kRRk.kyk..",
  "..kyk.kkkk.kCk..",
  "kkkkkkkkkkkkkkkk",
  "kzzzzzzzzzzzzzzk",
  "kkkkkkkkkkkkkkkk"
 ],
 "jungle": [
  "......kkkk......",
  "......kGGk......",
  "....kkkkkkkk....",
  "....kmGmGGmk....",
  "..kkkkkkkkkkkk..",
  "..kGmGGkkGGmGk..",
  "..kmGGkjjkGGmk..",
  "kkkkkkkjjkkkkkkk",
  "kGGmGGkjjkGmGGmk",
  "kmGGmGkjjkGGmGGk",
  "kkkkkkkkkkkkkkkk"
 ],
 "igloo": [
  ".....kkkkkk.....",
  "...kkIIIIIIkk...",
  "..kIIIiIIIIIIk..",
  ".kIIIIIIIIiIIIk.",
  ".kIiIIIIIIIIIIk.",
  "kIIIIIkkkkIIIIIk",
  "kIIIIkjjjjkIiIIk",
  "kIIiIkjjjjkIIIIk",
  "kIIIIkjjjjkIIIIk",
  "kkkkkkkkkkkkkkkk"
 ],
 "ruins": [
  "..kk.......kk...",
  ".kHHk.....kHGk..",
  ".kGHk..kk.kHHk..",
  ".kHHk.kHHkkGHk..",
  ".kHGk.kGHkkHHk..",
  ".kHHk.kHHkkHGk..",
  ".kGHk.kHGkkHHk..",
  "~kHHk~kHHkkGHk~~",
  "~kkkkkkkkkkkkk~~",
  "~~A~~~~~A~~~~A~~",
  "~~~~~~~~~~~~~~~~"
 ],
 "mineshaft": [
  "kkkkkkkkkkkkkkkk",
  "kBBBBBBBBBBBBBBk",
  "kkkkkkkkkkkkkkkk",
  ".kBk........kBk.",
  ".kBk........kBk.",
  ".kBk..k..k..kBk.",
  ".kBk.kGkkGk.kBk.",
  ".kBkkGGGGGGkkBk.",
  ".kBkGkdkkdkGkBk.",
  "kkBkkkkkkkkkkBkk",
  "kGGGGGGGGGGGGGGk",
  "kkkkkkkkkkkkkkkk"
 ],
 "well": [
  "....kkkkkkkk....",
  "...kYYYYYYYYk...",
  "..kkkkkkkkkkkk..",
  "...kYk....kYk...",
  "...kzk....kzk...",
  "...kYk....kYk...",
  ".kkkkkkkkkkkkkk.",
  ".kYYkAAAAAAkYYk.",
  ".kzYkA~~~~AkYzk.",
  ".kYYkkkkkkkkYYk.",
  ".kkkkkkkkkkkkkk."
 ],
 "fossil": [
  ".....kkkkkk.....",
  "....kLLLLLLk....",
  "..kkkkkLLkkkkk..",
  ".kLLLLkLLkLLLLk.",
  "..kkkkkLLkkkkk..",
  ".kLLLLkLLkLLLLk.",
  "..kkkkkLLkkkkk..",
  ".kLLLLkLLkLLLLk.",
  "..kkkkkLLkkkkk..",
  "......kLLk......",
  ".....kEkkEk.....",
  ".....kk..kk....."
 ],
 "geode": [
  ".....kkkkkk.....",
  "...kkxXxXxXkk...",
  "..kxXhhhhhhXxk..",
  ".kXhhvvvvvvhhXk.",
  ".kxhvvqvvqvvhxk.",
  "kxhvvqqvvqqvvhxk",
  "kXhvvvvoovvvvhXk",
  "kxhvvqvoovqvvhxk",
  "kXhvvqqvvqqvvhXk",
  ".kxhvvvvvvvvhxk.",
  ".kXhhvvvvvvhhXk.",
  "..kxXhhhhhhXxk..",
  "...kkxXxXxXkk...",
  ".....kkkkkk....."
 ],
 "camp": [
  ".......kk.......",
  "......kKKk......",
  ".....kKKKKk.....",
  "....kKKyKKKk....",
  "...kKKKyyKKKk...",
  "..kKKKkkkkKKKk..",
  ".kKKKkeeeekKKKk.",
  "kkkkkkeeeekkkkkk",
  "...........k....",
  "..........kak...",
  ".........kaRak..",
  ".........kkkkk.."
 ]
});
ICON_ART.nportal = ICON_ART.portal;
for (const [k, c] of [['bas_treasure', 'a'], ['bas_units', 'A'], ['bas_hoglin', 'K'], ['bas_bridge', 'V']])
  ICON_ART[k] = ICON_ART.bastion.map(row => row.replace(/[aX]/g, c));
const ICONS = {};
function buildIcons() {
  for (const [key, rows] of Object.entries(ICON_ART)) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const x = c.getContext('2d'), top = Math.floor((16 - rows.length) / 2);
    rows.forEach((row, j) => [...row.padEnd(16, '.').slice(0, 16)].forEach((ch, i) => {
      if (ch === '.' || !ICON_PAL[ch]) return;
      x.fillStyle = ICON_PAL[ch]; x.fillRect(i, top + j, 1, 1);
    }));
    ICONS[key] = { canvas: c, url: c.toDataURL() };
  }
}

// ---- real item textures, fetched at runtime (not bundled) ----
const TEX_SOURCES = [
  'https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.21.4/assets/minecraft/textures/',
  'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.4/assets/minecraft/textures/',
];
// key -> [texture, overlay texture, overlay tint, corner badge colour, outline colour]
// 'CHEST' = the chest front, cut out of entity/chest/normal (chests have no flat item texture)
const BASTION_GOLD = '#f2c53d';
const TEX_FOR = {
  // Overworld: main structures
  village: ['item/bell'], trial: ['item/trial_key'], ancient: ['item/echo_shard'], stronghold: ['item/ender_eye'],
  monument: ['item/trident'], mansion: ['item/totem_of_undying'], outpost: ['item/crossbow_standby'],
  pyramid: ['block/tnt_side'], hut: ['item/potion', 'item/potion_overlay', '#7b3fbf'],
  // Overworld: smaller structures
  treasure: ['item/heart_of_the_sea'], portal: ['block/crying_obsidian'], shipwreck: ['item/oak_boat'],
  trail: ['item/brush'], jungle: ['block/mossy_cobblestone'], igloo: ['item/snowball'], ruins: ['item/prismarine_shard'],
  mineshaft: ['item/chest_minecart'], well: ['item/water_bucket'], fossil: ['item/bone'], geode: ['item/amethyst_shard'],
  camp: ['item/campfire'],
  // Nether
  fortress: ['item/blaze_rod'], bastion: ['item/gold_ingot'],
  // bastions: one item per type, all with a gold outline so they read as bastions
  bas_treasure: ['CHEST', null, null, null, BASTION_GOLD], bas_units: ['item/nether_brick', null, null, null, BASTION_GOLD],
  bas_hoglin: ['item/porkchop', null, null, null, BASTION_GOLD], bas_bridge: ['item/chain', null, null, null, BASTION_GOLD],
  nportal: ['block/crying_obsidian', null, null, '#d1402f'],
  // End
  endcity: ['item/shulker_shell'], endship: ['item/elytra'], gateway: ['item/ender_pearl'],
  gatexit: ['item/ender_pearl', null, null, '#c77ddb'], retgate: ['item/ender_pearl', null, null, '#e3e0a8'],
};
function loadTex(path) {
  return new Promise((ok, fail) => {
    let i = 0;
    const tryNext = () => {
      if (i >= TEX_SOURCES.length) return fail(new Error('no texture ' + path));
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => ok(im); im.onerror = () => { i++; tryNext(); };
      im.src = TEX_SOURCES[i] + path + '.png';
    };
    tryNext();
  });
}
async function loadItemTextures(onDone) {
  const cache = {}, get = p => cache[p] || (cache[p] = loadTex(p));
  let changed = 0;
  const drawChest = async x => {   // chest front from the 64x64 chest sheet (lid, body, latch; rows stored upside down)
    const a = await get('entity/chest/normal');
    const flip = (sx, sy, w, h, dx, dy) => { for (let r = 0; r < h; r++) x.drawImage(a, sx, sy + h - 1 - r, w, 1, dx, dy + r, w, 1); };
    flip(14, 14, 14, 5, 1, 1); flip(14, 33, 14, 10, 1, 6); flip(1, 1, 2, 4, 7, 3);
  };
  await Promise.all(Object.entries(TEX_FOR).map(async ([key, [base, overlay, tint, badge, outline]]) => {
    try {
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      if (overlay) {   // tinted liquid under the bottle (potion)
        const o = document.createElement('canvas'); o.width = 16; o.height = 16;
        const ox = o.getContext('2d'); ox.drawImage(await get(overlay), 0, 0, 16, 16);
        ox.globalCompositeOperation = 'multiply'; ox.fillStyle = tint; ox.fillRect(0, 0, 16, 16);
        ox.globalCompositeOperation = 'destination-in'; ox.drawImage(await get(overlay), 0, 0, 16, 16);
        x.drawImage(o, 0, 0);
      }
      if (base === 'CHEST') await drawChest(x); else x.drawImage(await get(base), 0, 0, 16, 16);
      if (outline) {   // 1-pixel outline around the item's shape
        const px = x.getImageData(0, 0, 16, 16).data, solid = (i, j) => i >= 0 && j >= 0 && i < 16 && j < 16 && px[(j * 16 + i) * 4 + 3] > 40;
        x.fillStyle = outline;
        for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
          if (solid(i, j)) continue;
          let near = false;
          for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && solid(i + di, j + dj)) { near = true; break; }
          if (near) x.fillRect(i, j, 1, 1);
        }
      }
      if (badge) {   // little coloured square, bottom right, to tell variants apart
        x.fillStyle = '#111'; x.fillRect(10, 10, 6, 6); x.fillStyle = badge; x.fillRect(11, 11, 4, 4);
      }
      ICONS[key] = { canvas: c, url: c.toDataURL(), real: true };
      changed++;
    } catch (e) { /* offline or blocked: keep the drawn icon */ }
  }));
  if (changed) {   // keep them for next time, so a reload shows the real textures at once
    const keep = {};
    for (const k of Object.keys(TEX_FOR)) if (ICONS[k] && ICONS[k].url && ICONS[k].real) keep[k] = ICONS[k].url;
    try { localStorage.setItem(ICON_CACHE, JSON.stringify({ src: TEX_SOURCES[0], icons: keep })); } catch {}
  }
  if (changed && onDone) onDone();
}

// ---- the real textures saved by the last visit (localStorage): shown straight away, before the download above finishes ----
const ICON_CACHE = 'basescout.icons.v1';
(() => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(ICON_CACHE) || 'null'); } catch {}
  if (!saved || saved.src !== TEX_SOURCES[0] || !saved.icons) return;
  for (const [key, url] of Object.entries(saved.icons)) {
    if (!ICONS[key] || typeof url !== 'string' || !url.startsWith('data:image/png')) continue;
    const c = ICONS[key].canvas, im = new Image();
    ICONS[key].url = url; ICONS[key].real = true;   // pictures in the page use the saved one now
    im.onload = () => { const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, c.width, c.height); };   // the map icon: redrawn in place
    im.src = url;
  }
})();
