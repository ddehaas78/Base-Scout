// ---------- routes, on both maps (Seed map and Spot finder) ----------
// The square button under XZ turns route mode on: each click on a structure (or anywhere) adds a stop, a click on a
// stop takes it out. The stops are joined by a line, in order, with the length of each leg; the list gives every
// stop's coordinates, the distance from the one before and the total. One route per map, seed and dimension, kept in
// the browser.
function routeBestOrder(list) {   // shortest way through every stop, starting at the first one: nearest neighbour, then 2-opt
  if (list.length < 4) return list.slice();
  const left = list.slice(1), out = [list[0]], dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  while (left.length) {
    const last = out[out.length - 1]; let bi = 0, bd = Infinity;
    left.forEach((p, i) => { const dd = dist(p, last); if (dd < bd) { bd = dd; bi = i; } });
    out.push(left.splice(bi, 1)[0]);
  }
  for (let better = true, n = 0; better && n < 200; n++) {
    better = false;
    for (let i = 1; i < out.length - 1; i++) for (let k = i + 1; k < out.length; k++) {
      const a = out[i - 1], b = out[i], c = out[k], e = out[k + 1];
      const before = dist(a, b) + (e ? dist(c, e) : 0), after = dist(a, c) + (e ? dist(b, e) : 0);
      if (after < before - 1e-6) { out.splice(i, k - i + 1, ...out.slice(i, k + 1).reverse()); better = true; }
    }
  }
  return out;
}
const routeLen = list => list.reduce((t, p, i) => i ? t + Math.hypot(p.x - list[i - 1].x, p.z - list[i - 1].z) : 0, 0);

// cfg: map (MapView), id (prefix of the page elements), store (localStorage key), seed() / dim() / keys() for that map
function makeRoute(cfg) {
  const R = { on: false, data: {} }, el = s => $(cfg.id + s), M = cfg.map;
  try { R.data = JSON.parse(localStorage.getItem(cfg.store) || '{}') || {}; } catch {}
  const where = () => { const s = cfg.seed(); return s === null || s === undefined ? null : s + '/' + cfg.dim(); };
  R.stops = () => {
    const w = where(); if (w === null) return [];
    if (!R.data[w]) { R.data = Object.fromEntries(Object.entries(R.data).filter(([, v]) => v.length).slice(-30)); R.data[w] = []; }
    return R.data[w];
  };
  const save = () => { try { localStorage.setItem(cfg.store, JSON.stringify(R.data)); } catch {} };
  R.click = (m, x, z, sx, sy) => {
    const list = R.stops(), d = drawScale();
    if (where() === null) return;
    const near = list.findIndex(p => { const [px, py] = m.scr(p.x, p.z); return Math.hypot(px - sx, py - sy) < 16 * d; });
    if (near >= 0) list.splice(near, 1);   // a click on a stop takes it out
    else {
      const s = structAt(m, cfg.keys(), sx, sy, 18);
      list.push(s ? { x: s.x, z: s.z, key: s.key, name: s.n ? (s.key === 'gateway' ? `Gateway ${s.n}` : `Exit of gateway ${s.n}`) : s.key === 'fossil' && s.deep ? 'Deep fossil' : s.name }
        : { x, z, key: null, name: 'Point' });
    }
    save(); R.render(); m.draw();
  };
  let shownFor = null;
  R.render = () => {
    const list = R.stops(); shownFor = where();
    el('').setAttribute('aria-pressed', R.on);
    el('Sec').hidden = !R.on && !list.length;
    el('Hint').hidden = list.length > 1;
    el('Best').disabled = list.length < 4; el('Copy').disabled = !list.length; el('Clear').disabled = !list.length;
    const icon = p => p.key && ICONS[p.key] ? `<img class="ico" alt="" src="${ICONS[p.key].url}">` : '<span class="rdot"></span>';
    el('List').innerHTML = list.map((p, i) => `<div class="rstop" data-i="${i}" title="Show it on the map">
        <span class="rn">${i + 1}</span>${icon(p)}<span class="rname">${escH(p.name)}</span>
        <span class="rxz">${p.x}, ${p.z}</span>
        <span class="rd">${i ? '+' + fmt(Math.hypot(p.x - list[i - 1].x, p.z - list[i - 1].z)) : ''}</span>
        <button type="button" class="rx" data-x="${i}" aria-label="Remove">×</button></div>`).join('')
      + (list.length > 1 ? `<div class="rtotal"><span>Total</span> <b>${fmt(routeLen(list))}</b> <span>blocks</span></div>` : '');
    el('List').querySelectorAll('.rstop').forEach(e => e.onclick = ev => {
      if (ev.target.closest('.rx')) return;
      const p = list[+e.dataset.i]; M.centerOn(p.x, p.z); M.changed();
    });
    el('List').querySelectorAll('.rx').forEach(b => b.onclick = () => { list.splice(+b.dataset.x, 1); save(); R.render(); M.draw(); });
  };
  el('').onclick = () => {
    R.on = !R.on;
    if (R.on) toast('Route on: click structures to add them, click one again to take it out.');
    R.render(); M.draw();
  };
  el('Clear').onclick = () => { R.stops().length = 0; save(); R.render(); M.draw(); };
  el('Best').onclick = () => {
    const list = R.stops(), before = routeLen(list);
    list.splice(0, list.length, ...routeBestOrder(list)); save(); R.render(); M.draw();
    const saved = before - routeLen(list);
    toast(saved > 1 ? `Shorter by ${fmt(saved)} blocks` : 'Already the shortest order');
  };
  el('Copy').onclick = () => {
    const list = R.stops();
    copy(list.map((p, i) => `${i + 1}. ${p.name}: ${p.x} ~ ${p.z}`).join('\n') + (list.length > 1 ? `\nTotal: ${fmt(routeLen(list))} blocks` : ''));
  };
  // the line, the stop numbers and the length of each leg, drawn over the map
  const draw = M.draw;
  M.draw = () => {
    draw();
    if (where() !== shownFor) R.render();   // another seed, dimension or result: its own route
    const list = R.stops(); if (!list.length || !M.layers.length) return;
    const { ctx } = M, d = drawScale(), pts = list.map(p => M.scr(p.x, p.z));
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (pts.length > 1) {
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 6 * d; ctx.stroke();
      ctx.strokeStyle = '#ffff55'; ctx.lineWidth = 3 * d; ctx.stroke();
      ctx.font = `600 ${11 * d}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 1; i < pts.length; i++) {   // leg lengths, where there is room for them
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        if (Math.hypot(bx - ax, by - ay) < 90 * d) continue;
        const t = fmt(Math.hypot(list[i].x - list[i - 1].x, list[i].z - list[i - 1].z)), mx = (ax + bx) / 2, my = (ay + by) / 2, w = ctx.measureText(t).width + 8 * d;
        ctx.fillStyle = 'rgba(10,10,10,.85)'; ctx.fillRect(mx - w / 2, my - 8 * d, w, 16 * d);
        ctx.fillStyle = '#ffff55'; ctx.fillText(t, mx, my);
      }
    }
    ctx.font = `700 ${11 * d}px ui-monospace, Menlo, monospace`;
    pts.forEach(([x, y], i) => {   // numbered badges next to each stop
      const bx = x - 14 * d, by = y - 14 * d, r = 8 * d;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fillStyle = '#ffff55'; ctx.fill();
      ctx.lineWidth = 2 * d; ctx.strokeStyle = '#000'; ctx.stroke();
      ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), bx, by + 0.5 * d);
      if (!list[i].key) { ctx.beginPath(); ctx.arc(x, y, 5 * d, 0, Math.PI * 2); ctx.fillStyle = '#ffff55'; ctx.fill(); ctx.stroke(); }
    });
    ctx.restore();
  };
  R.render();
  return R;
}
const seedRoute = makeRoute({ map: xMap, id: 'zroute', store: 'basescout.route.map', seed: () => parseSeed($('seed').value), dim: () => xDim, keys: () => shownKeys });
const findRoute = makeRoute({ map: findMap, id: 'froute', store: 'basescout.route.find',
  seed: () => (job && sel ? (sel.seed || job.seed) : null), dim: () => (job && job.dim) || 0, keys: () => new Set(findAllKeys()) });
