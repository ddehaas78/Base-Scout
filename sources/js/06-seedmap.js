// ---------- seed map tab ----------
let xSpawn = null, pin = null, xFirst = true;
let xDim = 0, xHover = null, xCoords = true;
try { xCoords = localStorage.getItem('basescout.xz') !== '0'; } catch {}
// remember what is hidden, so structures added later start switched on
let shownKeys = new Set(ALL_STRUCTS.filter(s => !s.minor).map(s => s.key));   // the smaller ones start hidden
try {
  const sh = JSON.parse(localStorage.getItem('basescout.shown') || 'null');
  if (Array.isArray(sh)) shownKeys = new Set(sh);
  else { const h = JSON.parse(localStorage.getItem('basescout.hidden') || 'null'); if (Array.isArray(h)) h.forEach(k => shownKeys.delete(k)); }
} catch {}
const dimKeys = () => DIMS[xDim].structs.map(s => s.key).filter(k => inVer(k));
const STRUCT_SPAN = 20000;   // structures load once the view is narrower than this (strongholds always)
const MAX_SPAN = { geode: 3000, fossil: 6000, mineshaft: 6000, treasure: 8000 };   // the very common ones need a closer zoom
const spanOK = (k, span) => ALWAYS.has(k) || span <= (MAX_SPAN[k] || STRUCT_SPAN);
const xMap = MapView({
  name: 'explore', canvas: $('xmap'), maxSpan: () => DIMS[xDim].maxSpan,
  seed: () => parseSeed($('seed').value),
  dim: () => xDim,
  ver: () => curVer(),
  active: () => curTab === 'map',
  keys: (S, span) => dimKeys().filter(k => shownKeys.has(k) && spanOK(k, span)).sort(),
  overlay: M => {
    const { ctx, cv } = M, d = drawScale(), v = M.view;
    $('xempty').hidden = !!M.layers.length;
    if (!$('xhov').textContent) setText($('xhov'), 'Point at the map to read its coordinates');
    $('xhud').hidden = !M.layers.length || !$('xhud').textContent; $('xhov').hidden = !M.layers.length;
    if (!M.layers.length) { $('xnote').hidden = true; return; }
    // chunk grid when close in
    if (v.s >= 1.6) {
      ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
      const [x0, z0] = M.toWorld(0, 0), [x1, z1] = M.toWorld(cv.width, cv.height);
      ctx.beginPath();
      for (let x = Math.floor(x0 / 16) * 16; x <= x1; x += 16) { const sx = Math.round(M.scr(x, 0)[0]) + .5; ctx.moveTo(sx, 0); ctx.lineTo(sx, cv.height); }
      for (let z = Math.floor(z0 / 16) * 16; z <= z1; z += 16) { const sy = Math.round(M.scr(0, z)[1]) + .5; ctx.moveTo(0, sy); ctx.lineTo(cv.width, sy); }
      ctx.stroke();
    }
    const span = M.span(), close = span <= STRUCT_SPAN;
    const visible = new Set([...shownKeys].filter(k => dimKeys().includes(k) && spanOK(k, span)));   // far out: only what is still loaded fresh
    let onScreen = 0;   // few icons in view: keep them big at any zoom
    for (const k of visible) for (const q of (M.structs[k] ? M.structs[k].values() : [])) {
      const [x, y] = M.scr(q.x, q.z); if (x >= 0 && y >= 0 && x <= cv.width && y <= cv.height) onScreen++;
    }
    const few = onScreen <= 120;
    const size = k => few ? Math.max(20, Math.min(28, v.s * 100)) : MINOR.has(k) ? 12 : ALWAYS.has(k) && !close ? 16 : Math.max(13, Math.min(28, v.s * 100));
    // a picked gateway and its exit are joined by a dashed line
    const link = pin && pin.q && (pin.q.key === 'gateway' || pin.q.key === 'gatexit') ? pin.q : null;
    if (link) {
      const [ax, ay] = M.scr(link.key === 'gateway' ? link.x : link.sx, link.key === 'gateway' ? link.z : link.sz);
      const [bx2, by2] = M.scr(link.key === 'gateway' ? link.dx : link.x, link.key === 'gateway' ? link.dz : link.z);
      ctx.save(); ctx.strokeStyle = '#c9a6ff'; ctx.lineWidth = 2 * d; ctx.setLineDash([8 * d, 6 * d]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke(); ctx.restore();
    }
    drawIcons(M, visible, size, (k, sz) => sz >= 18 * d);
    // X above, Z below each icon, once there are few enough on screen to read them
    if (xCoords && onScreen <= 80) {
      const items = [];
      for (const k of visible) for (const q of (M.structs[k] ? M.structs[k].values() : [])) items.push({ x: q.x, z: q.z, size: size(k) });
      drawCoordLabels(M, items);
    }
    if (xHover) {   // ring the icon under the pointer
      const [hx, hy] = M.scr(xHover.x, xHover.z), rr = size(xHover.key) * d / 2 + 7 * d;
      ctx.lineWidth = 3 * d; ctx.strokeStyle = '#3fcf80'; ctx.beginPath(); ctx.roundRect(hx - rr, hy - rr, 2 * rr, 2 * rr, 6 * d); ctx.stroke();
    }
    // gateway numbers: the order they open, one per dragon kill
    if (xDim === 1 && v.s >= 0.12) {
      ctx.font = `700 ${11 * d}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (const k of ['gateway', 'gatexit']) {
        if (!shownKeys.has(k) || !M.structs[k]) continue;
        for (const q of M.structs[k].values()) {
          const [x, y] = M.scr(q.x, q.z), off = size(k) * d / 2 + 4 * d;
          if (x < -30 || y < -30 || x > cv.width + 30 || y > cv.height + 30) continue;
          ctx.lineWidth = 3 * d; ctx.strokeStyle = '#0b0a10'; ctx.strokeText(String(q.n), x + off, y);
          ctx.fillStyle = '#ffffff'; ctx.fillText(String(q.n), x + off, y);
        }
      }
    }
    const hidden = dimKeys().some(k => shownKeys.has(k) && !spanOK(k, span));
    $('xnote').hidden = !hidden;
    setText($('xnote'), close ? 'Zoom in more to see the smaller structures' : 'Zoom in to see structures');
    if (xSpawn && xDim === 0) {   // spawn: white cross in a dark ring
      const [x, y] = M.scr(xSpawn.x, xSpawn.z);
      ctx.beginPath(); ctx.arc(x, y, 9 * d, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,14,12,.8)'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * d; ctx.beginPath();
      ctx.moveTo(x - 5 * d, y); ctx.lineTo(x + 5 * d, y); ctx.moveTo(x, y - 5 * d); ctx.lineTo(x, y + 5 * d); ctx.stroke();
    }
    if (pin) { const [x, y] = M.scr(pin.x, pin.z); diamond(ctx, x, y, 7, css('--accent')); }
  },
  loaded: () => { if (pin && !pin.biome) renderPin(); },
  hover: (M, x, z, sx, sy) => {
    const b = M.biomeAt(x, z); if (!b) return;
    const s = structAt(M, shownKeys, sx, sy, 16);
    const was = xHover; xHover = s;
    if ((was && was.x) !== (s && s.x) || (was && was.z) !== (s && s.z)) M.draw();
    $('xmap').style.cursor = s ? 'pointer' : '';
    $('xhov').hidden = false; setHTML($('xhov'), s ? coordsHTML(s.x, s.z, xDim, s.name, 'Cursor', true) : coordsHTML(x, z, xDim, b, 'Cursor', true));
  },
  click: (M, x, z, sx, sy) => {
    if (seedRoute && seedRoute.on) { seedRoute.click(M, x, z, sx, sy); return; }   // route mode: clicks add or take out stops (js/06b-route.js)
    const s = structAt(M, shownKeys, sx, sy, 18);
    pin = s ? { x: s.x, z: s.z, label: s.n ? (s.key === 'gateway' ? `Gateway ${s.n}` : `Exit of gateway ${s.n}`) : s.key === 'fossil' && s.deep ? 'Deep fossil' : s.name, q: s } : { x, z, label: null };
    renderPin(); M.draw();
  },
});
function renderPinBar() {
  const bar = $('xhud');
  if (!pin) { bar.textContent = 'Click to pick a point'; bar.hidden = !xMap.layers.length; return; }
  bar.innerHTML = coordsHTML(pin.x, pin.z, xDim, pin.label, 'Picked');
  bar.hidden = !xMap.layers.length;
}
function renderPin() {
  renderPinBar();
  const box = $('pinbox');
  if (!pin) { box.innerHTML = '<p class="hint">Click the map to pick a point. Click a structure icon to pick that structure.</p>'; return; }
  const here = `${pin.x} ~ ${pin.z}`, seed = parseSeed($('seed').value);
  const ow = xDim === -1 ? `${pin.x * 8} ~ ${pin.z * 8}` : here, ne = xDim === 0 ? `${Math.floor(pin.x / 8)} ~ ${Math.floor(pin.z / 8)}` : here;
  const owX = xDim === -1 ? pin.x * 8 : pin.x, owZ = xDim === -1 ? pin.z * 8 : pin.z;
  const biome = xMap.biomeAt(pin.x, pin.z) || ''; pin.biome = biome;
  const copies = xDim === 0 ? `<button type="button" data-copy="${ow}">Overworld ${ow}</button><button type="button" data-copy="${ne}">Nether ${ne}</button>`
    : xDim === -1 ? `<button type="button" data-copy="${ne}">Nether ${ne}</button><button type="button" data-copy="${ow}">Overworld ${ow}</button>`
    : `<button type="button" data-copy="${here}">End ${here}</button>`;
  const g = pin.q && pin.q.n ? pin.q : null;
  const gateNote = !g ? '' : g.key === 'gateway'
    ? `<p class="hint" style="margin:0">Opens after dragon kill ${g.n}${g.n === 1 ? ' (the first one)' : ''}. Throw an ender pearl into it to reach ${g.dx}, ${g.dz}.</p>`
    : `<p class="hint" style="margin:0">Where gateway ${g.n} drops you, on the outer islands. It sits at ${g.sx}, ${g.sz} on the main island.</p>`;
  const wildNote = pin.q && pin.q.key === 'retgate' ? `<p class="hint" style="margin:0">Spawns on its own in the End highlands. Throw an ender pearl into it to go back to the main island.</p>` : '';
  const jump = !g ? '' : g.key === 'gateway' ? `<button type="button" id="pinJump">Go to its exit</button>` : `<button type="button" id="pinJump">Go to the gateway</button>`;
  const BASTION_NOTES = {
    'Bastion: treasure': 'Treasure room: the best loot, with ancient debris and a gold-block pile in the middle. Lots of magma cubes.',
    'Bastion: housing': 'Housing units: many small rooms with chests spread around. Watch for piglin brutes.',
    'Bastion: hoglin stables': 'Hoglin stables: hoglins in pens, chests on the ramps. Good for lodestone and gold.',
    'Bastion: bridge': 'Bridge: a long bridge over lava to the main keep. Piglins guard the entrance.',
  };
  const basNote = BASTION_NOTES[pin.label] ? `<p class="hint" style="margin:0">${BASTION_NOTES[pin.label]}</p>` : '';
  const MINOR_NOTES = {
    treasure: 'Buried treasure: the chest is at exactly these X and Z, under the sand. A map from a shipwreck or ocean ruin leads here too.',
    portal: 'Ruined portal: the frame is broken and some obsidian is missing. There is a loot chest nearby.',
    nportal: 'Ruined portal in the Nether.',
    shipwreck: 'Shipwreck: underwater or on a beach. Its chests can hold a buried treasure map.',
    trail: 'Trail ruins: mostly buried. Brush the suspicious gravel for pottery sherds.',
    jungle: 'Jungle temple: watch for the tripwire and arrow traps.',
    igloo: 'Igloo: some have a hidden basement under a carpet.',
    ruins: 'Ocean ruins: on the sea floor.',
    mineshaft: 'Mineshaft: it starts in this chunk, underground, and its tunnels spread out from here.',
    well: 'Desert well: only built on sand, so it can be missing where water or a structure is in the way.',
    geode: 'Amethyst geode: somewhere between y -58 and 30. It can be missing where a cave or water cuts through it.',
    camp: 'Abandoned camp: tents with chests and barrels.',
  };
  const fossilNote = pin.q && pin.q.key === 'fossil' ? (pin.q.deep
    ? 'Deep fossil: near the bottom of the world, with diamond ore in it.'
    : 'Fossil: buried about 15 to 25 blocks under the surface.') + ' It can be missing where a cave cuts through it.' : '';
  const minorNote = pin.q && (MINOR_NOTES[pin.q.key] || fossilNote) ? `<p class="hint" style="margin:0">${MINOR_NOTES[pin.q.key] || fossilNote}</p>` : '';
  const shipNote = pin.label === 'End ship (elytra)' ? `<p class="hint" style="margin:0">The elytra hangs in an item frame at the back of the ship, next to the dragon head.</p>` : '';
  box.innerHTML = `<div class="coords">X ${pin.x} · Z ${pin.z} <span class="sub" style="font-family:var(--f-body)">${DIMS[xDim].name}</span></div>
    <div class="sub">${[pin.label, biome, fmt(Math.hypot(pin.x, pin.z)) + ' from 0, 0'].filter(Boolean).join(' · ')}</div>
    ${shipNote}${gateNote}${wildNote}${basNote}${minorNote}<div class="actions">${copies}${jump}
      ${xDim !== 1 ? `<button type="button" id="pinFind" title="Search for base spots starting here">Find a base here</button>` : ''}
      ${pin.q && LOOT_KEYS.has(pin.q.key) ? `<button type="button" id="pinPlan" title="Plan from above and what is in each chest (or double-click the structure)">Chests</button>` : ''}</div>`;
  box.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy));
  if ($('pinPlan')) $('pinPlan').onclick = () => openPlan(pin.q);
  if ($('pinJump')) $('pinJump').onclick = () => {
    const to = g.key === 'gateway' ? { key: 'gatexit', x: g.dx, z: g.dz, n: g.n, sx: g.x, sz: g.z } : { key: 'gateway', x: g.sx, z: g.sz, n: g.n, dx: g.x, dz: g.z };
    xMap.centerOn(to.x, to.z);
    pin = { x: to.x, z: to.z, label: to.key === 'gateway' ? `Gateway ${to.n}` : `Exit of gateway ${to.n}`, q: to };
    renderPin(); xMap.changed();
  };
  if ($('pinFind')) $('pinFind').onclick = () => {
    const toN = findDim === -1, sx = toN ? (xDim === -1 ? pin.x : Math.floor(owX / 8)) : owX, sz = toN ? (xDim === -1 ? pin.z : Math.floor(owZ / 8)) : owZ;   // the Find tab's own dimension
    $('start').value = 'custom'; $('cx').value = sx; $('cz').value = sz; $('start').onchange();
    setTab('find');
    if (placed.length) startSearch(); else toast('Start set to this point. Drag what you want into the rings.');
  };
}
function renderToggles() {
  const box = $('toggles'); box.innerHTML = '';
  let divided = false;
  for (const s of DIMS[xDim].structs) {
    if (!inVer(s.key)) continue;
    if (s.minor && !divided) { divided = true; const d = document.createElement('div'); d.className = 'pdiv'; d.textContent = 'Smaller structures'; box.appendChild(d); }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tog';
    b.setAttribute('aria-pressed', shownKeys.has(s.key));
    b.innerHTML = `<img class="ico" alt="" src="${ICONS[s.key] ? ICONS[s.key].url : ''}"${RING[s.key] ? ` style="outline:2px solid ${RING[s.key]};outline-offset:1px;border-radius:2px"` : ''}><span>${s.name}</span>`;
    b.onclick = () => { shownKeys.has(s.key) ? shownKeys.delete(s.key) : shownKeys.add(s.key); togglesChanged(); };
    box.appendChild(b);
  }
}
function togglesChanged() {
  try { localStorage.setItem('basescout.shown', JSON.stringify([...shownKeys])); } catch {}
  renderToggles(); xMap.draw(); xMap.request(false);
}
$('togAll').onclick = () => { dimKeys().forEach(k => shownKeys.add(k)); togglesChanged(); };   // includes the smaller ones
$('togNone').onclick = () => { dimKeys().forEach(k => shownKeys.delete(k)); togglesChanged(); };
function goTo(x, z, label) {
  if (xMap.span() > 4000) xMap.fitTo(x, z, 1200); else xMap.centerOn(x, z);
  pin = { x: Math.round(x), z: Math.round(z), label: label || null };
  renderPin(); xMap.changed();
}
$('gotoForm').onsubmit = e => {
  e.preventDefault();
  let x = +$('gx').value || 0, z = +$('gz').value || 0;
  if ($('gNether').checked && xDim === 0) { x *= 8; z *= 8; }        // typed Nether coords, showing the Overworld
  if ($('gNether').checked && xDim === -1) { x = Math.floor(x / 8); z = Math.floor(z / 8); }   // typed Overworld coords, showing the Nether
  goTo(x, z);
};
$('goOrigin').onclick = () => goTo(0, 0);
$('goSpawn').onclick = () => { if (xSpawn) goTo(xSpawn.x, xSpawn.z, 'World spawn'); else toast('Enter a seed first.'); };
$('zxz').setAttribute('aria-pressed', xCoords);
$('zxz').onclick = () => {
  xCoords = !xCoords; $('zxz').setAttribute('aria-pressed', xCoords);
  try { localStorage.setItem('basescout.xz', xCoords ? '1' : '0'); } catch {}
  xMap.draw();
};
$('zin').onclick = () => xMap.zoomAt(xMap.cv.width / 2, xMap.cv.height / 2, 1.6);
$('zout').onclick = () => xMap.zoomAt(xMap.cv.width / 2, xMap.cv.height / 2, 1 / 1.6);

// ---------- dimensions ----------
function renderDimUI() {
  document.querySelectorAll('#dimseg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.dim === xDim));
  $('xdim').textContent = DIMS[xDim].name;
  $('gNetherL').hidden = xDim === 1;
  $('gNetherT').textContent = xDim === -1 ? 'These are Overworld coordinates' : 'These are Nether coordinates';
  $('goSpawn').hidden = xDim !== 0;
  $('togHint').textContent = xDim === 0 ? 'Structures appear once you zoom in to about 20,000 blocks across. Strongholds show at any zoom.'
    : 'Structures appear once you zoom in to about 20,000 blocks across.';
}
function setDim(d, quiet) {
  if (d === xDim) return;
  const [cx, cz] = xMap.center(), prev = xDim;
  const f = prev === 0 && d === -1 ? 1 / 8 : prev === -1 && d === 0 ? 8 : null;   // Overworld ↔ Nether keep the same spot
  xDim = d;
  if (f) { xMap.centerOn(Math.round(cx * f), Math.round(cz * f)); if (pin) pin = { x: Math.floor(pin.x * f), z: Math.floor(pin.z * f), label: 'Same spot in the ' + DIMS[d].name }; }
  else { xMap.fitTo(0, 0, d === 1 ? 1500 : 2500); pin = null; }
  try { localStorage.setItem('basescout.dim', String(d)); } catch {}
  xMap.reset(); renderDimUI(); renderToggles(); renderPin();
  setText($('xhov'), '');   // the next draw puts the placeholder back
  if (!quiet) { xMap.draw(); xMap.request(true); }
}
$('xmap').addEventListener('pointerleave', () => { if (xHover) { xHover = null; xMap.draw(); } });   // the mouse bar keeps the last position
document.querySelectorAll('#dimseg button').forEach(b => b.onclick = () => setDim(+b.dataset.dim));

