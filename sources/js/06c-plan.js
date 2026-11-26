// ---------- structure plan: double-click a structure on the Seed map (or "Chests" in the picked point) ----------
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
function slotHTML(s) {
  if (!s) return '<i class="slot"></i>';
  const it = LOOT_ITEMS[s.i], ench = s.ench.length, name = it[0] === 'book' && ench ? 'Enchanted Book' : it[1];
  const tip = name + (ench ? ': ' + s.ench.map(([e, l]) => LOOT_ENCH[e][1] + (LOOT_ENCH[e][2] > 1 ? ' ' + ROMAN[l] : '')).join(', ') : '');
  const tex = it[0] === 'book' && ench ? 'item/enchanted_book' : it[2];
  return `<i class="slot${ench || it[0] === 'enchanted_golden_apple' ? ' glint' : ''}" title="${escH(tip)}"><img src="${texUrl(tex)}" alt="${escH(name)}" loading="lazy" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${texUrl(tex, 1)}'}">${s.n > 1 ? `<b>${s.n}</b>` : ''}</i>`;
}
function chestHTML(S, k) {
  const c = S.chests[k];
  if (!c.items) return `<p class="hint"><span>Chest contents are worked out from Java</span> ${LOOT_FROM}. <span>Pick a newer version at the top to see them.</span></p>`;
  const best = c.items.filter(s => s.ench.length || ['diamond', 'enchanted_golden_apple', 'golden_apple', 'emerald', 'diamond_horse_armor', 'dune_armor_trim_smithing_template'].includes(LOOT_ITEMS[s.i][0]));
  const sp = t => `<span>${escH(t)}</span>`;   // one text per span, so each part gets translated
  const bestTxt = best.map(s => { const it = LOOT_ITEMS[s.i]; return (s.n > 1 ? s.n + ' ' : '') + sp(it[0] === 'book' && s.ench.length ? 'Enchanted Book' : it[1]) + (s.ench.length ? ' (' + s.ench.map(([e, l]) => sp(LOOT_ENCH[e][1] + (LOOT_ENCH[e][2] > 1 ? ' ' + ROMAN[l] : ''))).join(', ') + ')' : ''); });
  return `<div class="mcchest"><div class="mct"><span>Chest</span> ${k + 1}<span class="mcxz">X ${c.x} · Z ${c.z}</span></div><div class="slots">${c.items.slots.map(slotHTML).join('')}</div></div>
    ${bestTxt.length ? `<div class="pbest"><b>Best:</b> ${bestTxt.join(', ')}</div>` : ''}`;
}
function renderPlan() {
  const S = planCur; if (!S) return;
  $('planTitle').innerHTML = `<span>Desert pyramid</span> <span class="sub">X ${S.x} · Z ${S.z}</span>`;
  $('planMap').innerHTML = planHTML(S) + `<p class="hint">The 4 chests are in a hidden room about 12 blocks under the blue block in the middle of the floor. A pressure plate in that room sets off 9 TNT: don't step on it.</p>`;
  $('planChests').innerHTML = `<div class="ptabs" role="group" aria-label="Chests">${S.chests.map((c, k) => `<button type="button" data-chest="${k}" aria-pressed="${k === planSel}"><span>Chest</span> ${k + 1}</button>`).join('')}</div>${chestHTML(S, planSel)}
    <p class="hint">Contents are fixed by the seed when the pyramid is built. Already opened chests, or chests changed by another player, won't match.</p>`;
  document.querySelectorAll('#planDlg [data-chest]').forEach(b => b.onclick = () => { planSel = +b.dataset.chest; renderPlan(); });
}
function openPlan(q) {
  if (!q || !LOOT_KEYS.has(q.key)) return false;
  const seed = parseSeed($('seed').value); if (seed === null) { toast('Enter a seed first.'); return true; }
  planCur = lootStructure(q.key, BigInt(seed), q.x, q.z, VER); planSel = 0;
  if (!planCur) { toast('No plan for this structure in this version.'); return true; }
  $('planDlg').hidden = false; renderPlan(); $('planClose').focus();
  return true;
}
const closePlan = () => { $('planDlg').hidden = true; planCur = null; };
$('planClose').onclick = closePlan;
$('planDlg').addEventListener('click', e => { if (e.target === $('planDlg')) closePlan(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('planDlg').hidden) closePlan(); });
// double-click a structure on the Seed map
xMap.cv.addEventListener('dblclick', e => {   // same pointer maths as the map's own click (js/04-maps.js)
  if (typeof seedRoute !== 'undefined' && seedRoute.on) return;   // in route mode, clicks add stops
  const r = xMap.cv.getBoundingClientRect(), d = devicePixelRatio || 1;
  const s = structAt(xMap, shownKeys, (e.clientX - r.left) * d, (e.clientY - r.top) * d, 18);
  if (s && openPlan(s)) { e.preventDefault(); e.stopPropagation(); }
}, true);
