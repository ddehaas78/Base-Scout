// ---------- structure plan: double-click a structure on the Seed map (or "Chests" in the picked point) ----------
// Desert pyramid, buried treasure, pillager outpost, bastion (start part), end city, stronghold and mineshaft.
// Shows the structure from above, where its chests are, and what is in each chest, laid out like the game's chest.
const LOOT_FROM = '1.21.6';   // chest contents are worked out from this version
const texUrl = (path, k = 0) => `${TEX_SOURCES[k]}${path}.png`;
const texBg = path => `background-image:url('${texUrl(path)}'),url('${texUrl(path, 1)}')`;   // second source if the first fails
let planCur = null, planSel = 0;

// desert pyramid from above, in its own directions (front with the two towers and the door at local z = 0)
function pyramidCell(lx, lz) {
  const tower = lz <= 4 && (lx <= 4 || lx >= 16), dx = lx - 10, dz = lz - 10;
  if (tower) return (lx === 2 || lx === 18) && lz === 2 ? 'block/orange_terracotta' : (lx === 2 || lx === 18 || lz === 2) ? 'block/cut_sandstone' : 'block/sandstone_top';
  if (lz <= 1 && lx >= 9 && lx <= 11) return 'door';
  if (dx === 0 && dz === 0) return 'block/blue_terracotta';
  if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2 && (Math.abs(dx) === 2 || Math.abs(dz) === 2) && (dx === 0 || dz === 0 || Math.abs(dx) === Math.abs(dz))) return 'block/orange_terracotta';
  if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2) return 'block/sandstone_top';
  const ring = Math.min(lx, 20 - lx, lz, 20 - lz);
  return ring % 2 ? 'block/sandstone_top|step' : 'block/sandstone_top';   // every other step a little darker
}
function planHTML(S) {
  const local = (wx, wz) => {   // world cell → the pyramid's own cell
    const ox = wx - S.minX, oz = wz - S.minZ;
    return S.facing === 'north' ? [ox, 20 - oz] : S.facing === 'south' ? [ox, oz] : S.facing === 'west' ? [oz, 20 - ox] : [oz, ox];
  };
  const cells = [];
  for (let z = 0; z < 21; z++) for (let x = 0; x < 21; x++) {
    const [lx, lz] = local(S.minX + x, S.minZ + z), t = pyramidCell(lx, lz);
    const [tex, cls] = t.split('|');
    cells.push(t === 'door' ? '<i class="pc door"></i>' : `<i class="pc${cls ? ' ' + cls : ''}" style="${texBg(tex)}"></i>`);
  }
  const chests = S.chests.map((c, k) => `<button type="button" class="pchest${k === planSel ? ' on' : ''}" data-chest="${k}" style="grid-column:${c.x - S.minX + 1};grid-row:${c.z - S.minZ + 1}" title="Chest ${k + 1}: X ${c.x}, Z ${c.z}">${k + 1}</button>`).join('');
  return `<div class="pgridwrap"><span class="pnorth">N</span><div class="pgrid">${cells.join('')}</div><div class="pgrid pchests">${chests}</div></div>`;   // chests on their own layer, so blocks don't shift
}
// the other structures: their pieces from above with the game's textures (north up, 1 block = 1 texture tile).
// The view can be zoomed (wheel, + / −) and moved (drag); chests stay the same size.
// a piece's look: [name, textures (top layer first), darken 0..1]
const LOOK = {
  stronghold: p => [
    ['Corridor', ['block/stone_bricks']], ['Prison cells', ['block/iron_bars', 'block/stone_bricks']], ['Turn', ['block/stone_bricks']], ['Turn', ['block/stone_bricks']],
    ['Room', ['block/mossy_stone_bricks']], ['Stairs', ['block/stone_bricks'], .3], ['Stairs', ['block/stone_bricks'], .3], ['Crossing', ['block/mossy_stone_bricks']],
    ['Chest corridor', ['block/cracked_stone_bricks']], ['Library', ['block/bookshelf']], ['End portal room', ['block/end_portal_frame_top']], ['Corridor', ['block/stone_bricks'], .15]][p.t],
  mineshaft: p => p.t === 0 ? ['Dirt room (start)', ['block/dirt']] : p.t === 2 ? ['Crossing', ['block/oak_log_top']] : p.t === 3 ? ['Stairs', ['block/oak_planks'], .3]
    : p.add & 2 ? ['Corridor with a spider spawner', ['block/cobweb', 'block/oak_planks']] : p.add & 1 ? ['Corridor with rails', ['block/rail', 'block/oak_planks']] : ['Corridor', ['block/oak_planks']],
  endcity: p => p.t === 12 ? ['End ship', ['block/purpur_block'], .35] : [2, 3, 4, 5].includes(p.t) ? ['Bridge', ['block/end_stone_bricks']]
    : p.t === 8 ? ['Tower top (2 chests)', ['block/purpur_pillar_top']] : [0, 1, 9, 10, 11, 13, 14, 15].includes(p.t) ? ['House', ['block/purpur_block'], .12] : ['Tower', ['block/purpur_block']],
  bastion: p => /air_base|big_air_full|starting_pieces\/entrance/.test(p.t) ? ['Start of the bastion', ['block/polished_blackstone_bricks'], .1]
    : /ramparts|walls|rampart_plates|edges/.test(p.t) ? ['Ramparts and walls', ['block/cracked_polished_blackstone_bricks'], .3]
    : /treasure/.test(p.t) ? ['Treasure room', ['block/gilded_blackstone']] : /hoglin_stable/.test(p.t) ? ['Hoglin stables', ['block/blackstone_top']]
    : /bridge/.test(p.t) ? ['Bridge', ['block/basalt_top']] : ['Housing', ['block/polished_blackstone_bricks']],
  outpost: () => ['Watchtower', ['block/dark_oak_planks']],
  treasure: () => ['Beach sand', ['block/sand']],
  jungle: () => ['Jungle temple', ['block/mossy_cobblestone']],
  igloo: p => p.t ? ['Basement (under the igloo)', ['block/stone_bricks'], .35] : ['Igloo', ['block/snow']],
  shipwreck: p => p.t ? ['Shipwreck (rotten)', ['block/spruce_planks'], .3] : ['Shipwreck', ['block/spruce_planks']],
  portal: p => p.t ? ['Giant ruined portal', ['block/crying_obsidian']] : ['Ruined portal', ['block/obsidian']],
  nportal: p => p.t ? ['Giant ruined portal', ['block/crying_obsidian']] : ['Ruined portal', ['block/obsidian']],
  fortress: p => [9, 10].includes(p.t) ? ['Corridor turn (chest 1 in 3)', ['block/red_nether_bricks']] : p.t >= 7 ? ['Corridor', ['block/nether_bricks'], .2] : ['Bridge', ['block/nether_bricks']],
  camp: p => p.t === 2 ? ['Tree', ['block/oak_leaves'], .2] : p.t ? ['Campsite', ['block/coarse_dirt']] : ['Tent', ['block/white_wool']],
  village: p => /streets/.test(p.t) ? ['Path', ['block/dirt_path_top']] : /town_centers/.test(p.t) ? ['Village center', ['block/cobblestone']]
    : /decor|well|fountain/.test(p.t) ? ['Decoration', ['block/cobblestone'], .3]
    : ['House', [{ plains: 'block/oak_planks', desert: 'block/sandstone_top', savanna: 'block/acacia_planks', snowy: 'block/spruce_planks', taiga: 'block/spruce_planks' }[p.kind] || 'block/oak_planks']],
  trial: p => /\/chamber\//.test(p.t) ? ['Trial chamber', ['block/chiseled_tuff_top']] : /intersection/.test(p.t) ? ['Crossing', ['block/copper_block'], .2]
    : /corridor|hallway|entrance/.test(p.t) ? ['Corridor', ['block/tuff_bricks']] : /reward/.test(p.t) ? ['Vault', ['block/chiseled_tuff_bricks_top']] : ['Room', ['block/tuff_bricks'], .3],
  ancient: p => /city_center/.test(p.t) && !/walls/.test(p.t) ? ['City center (portal frame)', ['block/reinforced_deepslate_top']]
    : /walls/.test(p.t) ? ['Walls', ['block/deepslate_bricks'], .25] : /ice_box/.test(p.t) ? ['Ice box', ['block/packed_ice']]
    : /entrance/.test(p.t) ? ['Entrance', ['block/deepslate_tiles'], .35] : /structures/.test(p.t) ? ['Building', ['block/deepslate_tiles']] : ['Sculk', ['block/sculk']],
};
const planKind = key => key.startsWith('bas_') ? 'bastion' : key === 'endship' ? 'endcity' : key;
const texLayers = (tex, dark) => (dark ? [`linear-gradient(rgba(0,0,0,${dark}),rgba(0,0,0,${dark}))`] : []).concat(tex.map(t => `url('${texUrl(t)}'),url('${texUrl(t, 1)}')`)).join(',');
let pv = null;   // the plan view: { x0, z0, W, H, k, ox, oy }
function schemHTML(S) {
  const look = LOOK[planKind(S.key)], pieces = S.key === 'treasure' ? [{ t: 0, b0: [S.x - 4, 0, S.z - 4], b1: [S.x + 4, 0, S.z + 4] }] : S.pieces;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of pieces.concat(S.chests.map(c => ({ b0: [c.x, 0, c.z], b1: [c.x, 0, c.z] })))) { x0 = Math.min(x0, p.b0[0]); z0 = Math.min(z0, p.b0[2]); x1 = Math.max(x1, p.b1[0]); z1 = Math.max(z1, p.b1[2]); }
  x0 -= 4; z0 -= 4; x1 += 4; z1 += 4;
  pv = { x0, z0, W: x1 - x0 + 1, H: z1 - z0 + 1 };
  const order = pieces.map((p, i) => i).sort((a, b) => (pieces[a].b0[1] - pieces[b].b0[1]) || a - b);   // lower pieces first, so towers sit on top
  const kinds = new Map();
  const blocks = order.map(i => {
    const p = pieces[i], [name, tex, dark] = look(p); kinds.set(name, [tex, dark]);
    const big = ['Library', 'End portal room', 'End ship', 'Dirt room (start)', 'Start of the bastion', 'Watchtower'].includes(name);
    return `<i class="ppc" style="--x:${p.b0[0] - x0};--z:${p.b0[2] - z0};--w:${p.b1[0] - p.b0[0] + 1};--h:${p.b1[2] - p.b0[2] + 1};background-image:${texLayers(tex, dark)}" title="${escH(name)}">${big ? `<b>${escH(name)}</b>` : ''}</i>`;
  }).join('');
  const chests = S.chests.map((c, j) => `<button type="button" class="pchest${c.cart ? ' cart' : ''}${j === planSel ? ' on' : ''}" data-chest="${j}" style="--x:${c.x - x0 + .5};--z:${c.z - z0 + .5}" title="${escH(chestName(S, j))} ${j + 1}">${j + 1}</button>`).join('');
  const legend = [...kinds].map(([name, [tex, dark]]) => `<span><i style="background-image:${texLayers(tex, dark)}"></i>${escH(name)}</span>`).join('');
  return `<div class="pview" id="pview"><span class="pnorth">N ↑</span><div class="pworld" id="pworld">${blocks}${chests}</div>
    <div class="pzoom"><button type="button" id="pzIn" title="Zoom in">+</button><button type="button" id="pzOut" title="Zoom out">−</button><button type="button" id="pzFit" title="See it all">⤢</button></div></div>
    <div class="plegend">${legend}</div>`;
}
function pvApply() {
  const w = $('pworld'); if (!w || !pv) return;
  w.style.setProperty('--k', pv.k); w.style.transform = `translate(${pv.ox}px,${pv.oy}px)`;
  w.classList.toggle('near', pv.k >= 5);
}
function pvFit(focus) {
  const v = $('pview'); if (!v || !pv) return;
  const vw = v.clientWidth, vh = v.clientHeight;
  pv.k = Math.min(vw / pv.W, vh / pv.H, 16);
  pv.ox = (vw - pv.W * pv.k) / 2; pv.oy = (vh - pv.H * pv.k) / 2;
  if (focus) pvZoom(Math.min(16, Math.max(pv.k, 6)) / pv.k, ...focus);
  pvApply();
}
function pvZoom(f, cx, cy) {   // zoom by f around the view point cx, cy
  const k = Math.min(24, Math.max(pv.k0 || 0.3, pv.k * f)); f = k / pv.k;
  pv.ox = cx - (cx - pv.ox) * f; pv.oy = cy - (cy - pv.oy) * f; pv.k = k; pvApply();
}
function pvWire() {
  const v = $('pview'); if (!v) return;
  pvFit(); pv.k0 = pv.k * 0.8;
  const mid = () => [v.clientWidth / 2, v.clientHeight / 2];
  $('pzIn').onclick = () => pvZoom(1.6, ...mid()); $('pzOut').onclick = () => pvZoom(1 / 1.6, ...mid()); $('pzFit').onclick = () => pvFit();
  v.addEventListener('wheel', e => { e.preventDefault(); const r = v.getBoundingClientRect(); pvZoom(Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let drag = null;
  v.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; drag = [e.clientX, e.clientY]; v.setPointerCapture(e.pointerId); v.classList.add('grab'); });
  v.addEventListener('pointermove', e => { if (!drag) return; pv.ox += e.clientX - drag[0]; pv.oy += e.clientY - drag[1]; drag = [e.clientX, e.clientY]; pvApply(); });
  const up = () => { drag = null; v.classList.remove('grab'); };
  v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
}
const chestName = (S, j) => { const c = S.chests[j]; return c.ship ? 'Ship chest' : c.cart ? 'Minecart' : c.disp ? 'Dispenser' : c.pot ? 'Pot' : c.barrel ? 'Barrel' : c.secret ? 'Secret chest' : 'Chest'; };
const PLAN_INFO = {
  pyramid: ['Desert pyramid', "The 4 chests are in a hidden room about 12 blocks under the blue block in the middle of the floor. A pressure plate in that room sets off 9 TNT: don't step on it."],
  treasure: ['Buried treasure', 'One chest, buried at exactly these X and Z, usually a few blocks under the sand or gravel of a beach or the sea floor.'],
  outpost: ['Pillager outpost', 'The chest is on the top floor of the watchtower. Pillagers keep spawning around it.'],
  jungle: ['Jungle temple', 'Two chests: one in the room under the lever puzzle, one past the tripwires at the back. The two dispensers shoot arrows at the tripwires: their arrows are in the list too.'],
  igloo: ['Igloo', 'The chest is in the basement, under the carpet in the igloo (break it, then climb down the ladder). Only half of the igloos have a basement.'],
  shipwreck: ['Shipwreck', 'Supply chest at the front, map chest in the middle (the treasure map), treasure chest at the back. Broken wrecks have only some of them.'],
  portal: ['Ruined portal', 'One chest, near the portal: where exactly depends on the ground, so the marker only shows the portal.'],
  nportal: ['Ruined portal', 'One chest, near the portal: where exactly depends on the ground, so the marker only shows the portal.'],
  fortress: ['Nether fortress', 'Chests are in some corridor turns (about 1 in 3). The fortress drawn here can be cut short by lava lakes or the edges of the Nether.'],
  camp: ['Abandoned camp', 'A tent and a campsite, put together like the game does it: chests and barrels are at these exact X and Z (their height depends on the ground). Some campsites also hide a secret chest.'],
  village: ['Village', 'Every chest of the village at its exact X and Z (the height depends on the ground; on hilly ground some houses can move or be missing).'],
  trial: ['Trial chambers', 'Every chest, barrel, pot and dispenser with loot, at its exact place and height (Y). The vaults need a trial key: their loot is not shown.'],
  ancient: ['Ancient city', 'Every chest of the city, at its exact place and height (Y): pieces are drawn flat, so chests on several floors can look close. Sneak: sculk shriekers call the Warden.'],
  bastion: ['Bastion remnant', 'Every chest of the bastion, put together piece by piece like the game does it, at its exact place and height (Y). Pieces are drawn flat, so chests on several floors can look close.'],
  endcity: ['End city', 'Tall towers have 2 chests at the top, some houses have 1, and the ship has 2 (and the elytra). The plan is flat: chests can be high up.'],
  stronghold: ['Stronghold', 'Chests are in chest corridors, store rooms and libraries (2 in a tall library). Where a cave cuts through, a chest can be missing or hold something else.'],
  mineshaft: ['Mineshaft', 'Chests are in minecarts along the corridors. Parts in the air, in water or cut by caves are not built, which can change or remove chests.'],
};
const LOOT_BEST = /^(diamond|emerald|golden_apple|enchanted_golden_apple|diamond_horse_armor|diamond_nautilus_armor|heart_of_the_sea|ancient_debris|netherite_scrap|gold_block|name_tag|lodestone|music_disc_.*|.*_smithing_template)$/;   // rare items: their name is yellow in the tooltip
// explorer maps lead to the nearest structure of their kind (the game looks from the chest)
const MAP_TARGET = { buried_treasure_map: 'treasure', abandoned_camp_map: 'camp', buried_ancient_city_map: 'ancient', buried_trial_chambers_map: 'trial',
  buried_mineshaft_map: 'mineshaft', desert_pyramid_map: 'pyramid', jungle_pyramid_map: 'jungle', warm_ocean_ruins_map: 'ruins', woodland_mansion_map: 'mansion' };
function mapTarget(key, c) {
  let best = null, bd = Infinity;
  for (const M of [xMap, findMap]) for (const q of (M.structs[key] || new Map()).values()) {
    const d = Math.hypot(q.x - c.x, q.z - c.z); if (d < bd) { bd = d; best = q; }
  }
  return best && { x: best.x, z: best.z, d: Math.round(bd) };
}
// the item's tooltip, laid out like the game's: name, then grey lines (enchantments, effect, sound, where a map leads)
function slotTip(s, it, name, ench, c) {
  const sp = t => `<span>${escH(t)}</span>`, lines = [];
  for (const [e, l] of s.ench) lines.push(sp(LOOT_ENCH[e][1] + (LOOT_ENCH[e][2] > 1 ? ' ' + ROMAN[l] : '')));
  if (s.note) lines.push(it[0] === 'goat_horn' ? `${sp('Sound')}: ${sp(s.note)}` : it[0] === 'suspicious_stew' ? `${sp('Effect')}: ${sp(s.note)}` : sp(s.note));
  const target = MAP_TARGET[it[0]];
  if (target) {
    const st = ALL_STRUCTS.find(x => x.key === target), t = c && mapTarget(target, c);
    lines.push(`${sp('Leads to the nearest')} ${sp(st ? st.name : target)}`);
    lines.push(t ? `${sp('Probably')} X ${t.x} · Z ${t.z} <span class="tipd">(${fmt(t.d)} ${sp('blocks')})</span>` : sp('Zoom the map out around here to see which one'));
  }
  if (s.n > 1) lines.push(`× ${s.n}`);
  const cls = ench || it[0] === 'enchanted_golden_apple' ? 'tipn ench' : LOOT_BEST.test(it[0]) ? 'tipn rare' : 'tipn';
  return `<div class="${cls}">${sp(name)}</div>` + lines.map(l => `<div class="tipl">${l}</div>`).join('');
}
function slotHTML(s, c) {
  if (!s) return '<i class="slot"></i>';
  const it = LOOT_ITEMS[s.i], ench = s.ench.length, name = s.name || (it[0] === 'book' && ench ? 'Enchanted Book' : it[1]);
  const tex = it[0] === 'book' && ench ? 'item/enchanted_book' : it[2];
  const own = !(it[0] === 'book' && ench) && LOOT_ICONS[it[0]];   // blocks in 3D and newer items: js/06a2-looticons.js
  const img = own ? `<img class="own" src="${own}" alt="${escH(name)}">`
    : `<img src="${texUrl(tex)}" alt="${escH(name)}" loading="lazy" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${texUrl(tex, 1)}'}">`;
  return `<i class="slot${ench || it[0] === 'enchanted_golden_apple' ? ' glint' : ''}" data-tip-html="${escH(slotTip(s, it, name, ench, c))}">${img}${s.n > 1 ? `<b>${s.n}</b>` : ''}</i>`;
}
function chestHTML(S, k) {
  const c = S.chests[k];
  if (!c.items) return `<p class="hint"><span>Chest contents are worked out from Java</span> ${LOOT_FROM}. <span>Pick a newer version at the top to see them.</span></p>`;
  return `<div class="mcchest"><div class="mct"><span>${chestName(S, k)}</span> ${k + 1}${c.house ? ` <span class="mchouse">· ${escH(c.house)}</span>` : ''}<span class="mcxz">X ${c.x}${c.y != null ? ' · Y ' + c.y : ''} · Z ${c.z}</span></div><div class="slots">${c.items.slots.map(s => slotHTML(s, c)).join('')}</div></div>`;
}
function renderPlan() {
  const S = planCur; if (!S) return;
  const [title, note] = PLAN_INFO[planKind(S.key)];
  $('planTitle').innerHTML = `<span>${title}</span> <span class="sub">X ${S.x} · Z ${S.z}</span>`;
  if (S.drawn !== true) {   // the map is built once per plan; picking a chest only moves the highlight
    $('planMap').innerHTML = (S.info ? `<p class="pinfo">${S.info}</p>` : '') + (S.key === 'pyramid' ? planHTML(S) : schemHTML(S)) + `<p class="hint">${note}</p>`;
    S.drawn = true; if (S.key !== 'pyramid') requestAnimationFrame(pvWire);
  } else document.querySelectorAll('#planMap .pchest').forEach(b => b.classList.toggle('on', +b.dataset.chest === planSel));
  if (!S.chests.length) { $('planChests').innerHTML = `<p class="hint">${S.note || 'No chest in this one.'}</p>`; return; }
  planSel = Math.min(planSel, S.chests.length - 1);
  const tabs0 = document.querySelector('#planChests .ptabs'), keep = tabs0 ? tabs0.scrollTop : 0;   // the tab list keeps its scroll when a tab is picked
  $('planChests').innerHTML = `<div class="ptabs" role="group" aria-label="Chests">${S.chests.map((c, k) => `<button type="button" data-chest="${k}" aria-pressed="${k === planSel}"><span>${chestName(S, k)}</span> ${k + 1}</button>`).join('')}</div>${chestHTML(S, planSel)}
    <p class="hint">Contents are fixed by the seed when the structure is built. Already opened chests, or chests changed by another player, won't match.</p>`;
  document.querySelectorAll('#planDlg [data-chest]').forEach(b => b.onclick = () => { planSel = +b.dataset.chest; renderPlan(); });
  const tabs1 = document.querySelector('#planChests .ptabs');
  if (tabs1) {
    tabs1.scrollTop = keep;
    const on = tabs1.querySelector('[aria-pressed="true"]');   // picked on the plan: bring its tab into view
    if (on && (on.offsetTop < tabs1.scrollTop || on.offsetTop + on.offsetHeight > tabs1.scrollTop + tabs1.clientHeight)) tabs1.scrollTop = on.offsetTop - 4;
  }
}
function openPlan(q, M = xMap) {
  if (!q || !LOOT_KEYS.has(q.key)) return false;
  const seed = parseSeed($('seed').value); if (seed === null) { toast('Enter a seed first.', 'bad'); return true; }
  planQ = { key: q.key, x: q.x, z: q.z };   // for the "Mark as done" button (js/06e-done.js)
  if (q.key === 'village') {   // which village it is depends on the exact biome at its center: ask the engine first
    villageResolve(seed, q.x, q.z, VER).then(V => showPlan(V && lootStructure('village', BigInt(seed), q.x, q.z, VER, '', V)));
    return true;
  }
  if (q.key === 'camp') {   // the camp depends on the exact biome at its tent: ask the engine first
    const guess = String(M.biomeAt(q.x, q.z) || '').toLowerCase().replace(/ /g, '_');
    campResolve(seed, q.x, q.z, guess).then(C => showPlan(C && lootStructure('camp', BigInt(seed), q.x, q.z, VER, C.biome, C)));
    return true;
  }
  showPlan(lootStructure(q.key, BigInt(seed), q.x, q.z, VER, M.biomeAt(q.x, q.z) || ''));
  return true;
}
function showPlan(p) {
  planCur = p; planSel = 0;
  if (!planCur) { toast('No plan for this structure in this version.', 'bad'); return true; }
  $('planDlg').hidden = false; renderPlan(); renderDoneBtn(); $('planClose').focus();
  return true;
}
const closePlan = () => { $('planDlg').hidden = true; planCur = null; };
addEventListener('resize', () => { if (!$('planDlg').hidden && $('pview')) pvFit(); });   // the view follows the window's size
$('planClose').onclick = closePlan;
$('planDlg').addEventListener('click', e => { if (e.target === $('planDlg')) closePlan(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('planDlg').hidden) closePlan(); });
// double-click a structure on the Seed map, or on the Spot finder map beside the results
function planOnDblclick(M, keys, radius, routeOn) {
  M.cv.addEventListener('dblclick', e => {   // same pointer maths as the map's own click (js/04-maps.js)
    if (routeOn()) return;   // in route mode, clicks add stops
    const r = M.cv.getBoundingClientRect(), d = devicePixelRatio || 1;
    const s = structAt(M, keys(), (e.clientX - r.left) * d, (e.clientY - r.top) * d, radius);
    if (!s) return;
    if (LOOT_KEYS.has(s.key) ? openPlan(s, M) : (typeof showDoneMenu === 'function' && showDoneMenu(s, M, e.clientX, e.clientY))) { e.preventDefault(); e.stopPropagation(); }   // no chests: the "Mark as done" menu
  }, true);
}
planOnDblclick(xMap, () => shownKeys, 18, () => typeof seedRoute !== 'undefined' && seedRoute.on);
planOnDblclick(findMap, () => findMap.view.s >= 0.035 ? new Set(findAllKeys()) : new Set(), 16, () => typeof findRoute !== 'undefined' && findRoute && findRoute.on);
