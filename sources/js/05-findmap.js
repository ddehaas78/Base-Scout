// ---------- the map beside the results ----------
const wantedKeys = () => new Set((job ? job.items : []).filter(i => i.kind === 'structure').map(i => i.key).concat((job && job.pins || []).filter(p => p.kind !== 'biome').map(p => p.key)));
let fCoords = true, fPick = null, fHover = null;
try { fCoords = localStorage.getItem('basescout.fxz') !== '0'; } catch {}
// X above, Z below each listed structure
function drawCoordLabels(M, items) {
  const { ctx, cv } = M, d = drawScale();
  ctx.font = `600 ${10.5 * d}px ui-monospace, "JetBrains Mono", Menlo, monospace`; ctx.textAlign = 'center';
  ctx.lineJoin = 'round'; ctx.lineWidth = 3 * d; ctx.strokeStyle = 'rgba(8,10,9,.92)'; ctx.fillStyle = '#f5f7f4';
  for (const it of items) {
    const [x, y] = M.scr(it.x, it.z);
    if (x < -40 || y < -40 || x > cv.width + 40 || y > cv.height + 40) continue;
    const half = it.size * d / 2 + 5 * d;
    ctx.textBaseline = 'bottom'; ctx.strokeText(String(it.x), x, y - half); ctx.fillText(String(it.x), x, y - half);
    ctx.textBaseline = 'top'; ctx.strokeText(String(it.z), x, y + half); ctx.fillText(String(it.z), x, y + half);
  }
}
// the map beside the results: the main structures, plus any smaller ones you asked for
const findAllKeys = () => (job && job.dim === -1 ? NETHER_STRUCTS : STRUCTURES).filter(s => !s.minor || wantedKeys().has(s.key)).map(s => s.key).filter(k => inVer(k, job ? job.verLabel : VER));
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// "Picked  X, Z : -1234, 567 | -155, 70 | forest": Overworld numbers in white, Nether numbers in red
const OW_COL = '#f5f7f4', NE_COL = '#ff6b5a';
// tailFirst (the Cursor bars, anchored on the right): the biome goes first, so the numbers never move
function coordsHTML(x, z, dim, tail, label, tailFirst) {
  const n = (v, w) => String(v).padStart(w, ' ');   // monospace: padding keeps every number in its slot
  const pair = (a, b, w, col) => `<span class="cn" style="color:${col}">${n(a, w)},${n(b, w)}</span>`, bar = ' <span class="cl">|</span> ';
  let h = (label ? `<b>${label}</b> ` : '') + `<span class="cl">X, Z :</span>` + pair(x, z, 7, dim === -1 ? NE_COL : OW_COL);
  if (dim === 0) h += bar + pair(Math.floor(x / 8), Math.floor(z / 8), 6, NE_COL);
  else if (dim === -1) h += bar + pair(x * 8, z * 8, 8, OW_COL);
  if (!tail) return h;
  return tailFirst ? `<span class="tl">${escH(tail)}</span>` + bar + h : h + bar + escH(tail);
}
document.querySelectorAll('.caveat').forEach(c => c.title = c.textContent.trim());
function renderFindPickBar() {
  const bar = $('hud');
  if (!sel || !findMap.layers.length) { bar.hidden = true; return; }
  const q = fPick || { x: sel.x, z: sel.z, label: 'Base spot' };
  setHTML(bar, coordsHTML(q.x, q.z, (job && job.dim) || 0, q.label, 'Picked'));
  bar.hidden = false;
}
const findMap = MapView({
  name: 'find', canvas: $('map'), maxSpan: 60000,
  seed: () => (job && sel ? (sel.seed || job.seed) : null),
  active: () => curTab === 'find',
  dim: () => (job && job.dim) || 0,
  ver: () => (job ? job.ver : curVer()),
  keys: (S, span) => (S >= 256 ? [] : S === 64 ? [...wantedKeys()] : findAllKeys()).filter(k => spanOK(k, span)),
  overlay: M => {
    const { ctx, cv } = M, d = drawScale(), v = M.view;
    if (!M.layers.length || !sel) { $('mtitle').hidden = true; $('hud').hidden = true; $('fhov').hidden = true; return; }
    $('mempty').hidden = true; $('mtitle').hidden = false; $('fhov').hidden = !$('fhov').textContent;
    setText($('mtitle'), `X ${sel.x} · Z ${sel.z}`);
    renderFindPickBar();
    const [bx, by] = M.scr(sel.x, sel.z), rings = job.items.length > 0;
    if (rings) {
      ctx.save(); ctx.fillStyle = 'rgba(8,10,9,.35)'; ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height); ctx.arc(bx, by, job.radii[2] * v.s, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.restore();
      [2, 1, 0].forEach(z => {
        ctx.strokeStyle = css(ZCOL[z]); ctx.lineWidth = 2 * d; ctx.setLineDash([7 * d, 5 * d]);
        ctx.beginPath(); ctx.arc(bx, by, job.radii[z] * v.s, 0, Math.PI * 2); ctx.stroke();
      });
    }
    for (const p of job.pins || []) {   // fixed spots: where you said, and how close it had to be
      const [px, py] = M.scr(p.x, p.z), rr = Math.max(6 * d, p.r * v.s);
      ctx.strokeStyle = NE_COL; ctx.lineWidth = 2 * d; ctx.setLineDash([5 * d, 4 * d]);
      ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(px - 5 * d, py); ctx.lineTo(px + 5 * d, py); ctx.moveTo(px, py - 5 * d); ctx.lineTo(px, py + 5 * d); ctx.stroke();
    }
    ctx.setLineDash([]);
    // close in: every structure, the ones you asked for bigger. Far out: only yours, shrinking. Very far: none.
    const wanted = wantedKeys(), far = v.s < 0.08, tiny = v.s < 0.035;
    const others = new Set(findAllKeys().filter(k => !wanted.has(k)));
    const wantSize = far ? Math.max(7, Math.min(22, v.s * 280)) : 26;
    if (!tiny) {
      if (!far) { ctx.globalAlpha = 0.7; drawIcons(M, others, () => 16, () => false); ctx.globalAlpha = 1; }
      const zoneOf = k => Math.min(...job.items.filter(i => i.kind === 'structure' && i.key === k).map(i => i.zone));
      drawIcons(M, wanted, () => wantSize, k => !far && (isFinite(zoneOf(k)) ? css(ZCOL[zoneOf(k)]) : NE_COL));
      // coordinates, once few enough are on screen to read
      if (fCoords) {
        const items = [];
        const add = (keys, size) => { for (const k of keys) for (const q of (M.structs[k] ? M.structs[k].values() : [])) {
          const [x, y] = M.scr(q.x, q.z); if (x >= 0 && y >= 0 && x <= cv.width && y <= cv.height) items.push({ x: q.x, z: q.z, size });
        } };
        add(wanted, wantSize); if (!far) add(others, 16);
        if (items.length <= 80) drawCoordLabels(M, items);
      }
    }
    if (fHover) {   // ring the icon under the pointer
      const [hx, hy] = M.scr(fHover.x, fHover.z), rr = (wanted.has(fHover.key) ? wantSize : 16) * d / 2 + 6 * d;
      ctx.lineWidth = 3 * d; ctx.strokeStyle = '#3fcf80'; ctx.beginPath(); ctx.roundRect(hx - rr, hy - rr, 2 * rr, 2 * rr, 6 * d); ctx.stroke();
    }
    if (findMode === 'seed') for (const [list, col] of [[close, css('--warn')], [exact, css('--accent')]]) for (const s2 of list) {
      if (s2 === sel) continue;
      const [x, y] = M.scr(s2.x, s2.z);
      if (x < -10 || y < -10 || x > cv.width + 10 || y > cv.height + 10) continue;
      ctx.beginPath(); ctx.arc(x, y, 5 * d, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 1.5 * d; ctx.strokeStyle = '#0b1a11'; ctx.stroke();
    }
    if (job && job.start === 'custom' && findMode === 'seed') {   // the coordinates typed in Start from: a red dot
      const [sx, sy] = M.scr(startPos.x, startPos.z);
      if (sx > -20 && sy > -20 && sx < cv.width + 20 && sy < cv.height + 20) {
        ctx.beginPath(); ctx.arc(sx, sy, 7 * d, 0, Math.PI * 2); ctx.fillStyle = '#e5322d'; ctx.fill();
        ctx.lineWidth = 2.5 * d; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.font = `700 ${11 * d}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3 * d; ctx.strokeStyle = 'rgba(8,10,9,.92)'; ctx.strokeText('Start', sx + 11 * d, sy); ctx.fillStyle = '#ffffff'; ctx.fillText('Start', sx + 11 * d, sy);
      }
    }
    diamond(ctx, bx, by, 7, '#ffffff');
    if (fPick) { const [x, y] = M.scr(fPick.x, fPick.z); diamond(ctx, x, y, 6, css('--accent')); }
  },
  hover: (M, x, z, sx, sy) => {
    const b = M.biomeAt(x, z); if (!b || !sel) return;
    const s = M.view.s >= 0.035 ? structAt(M, new Set(findAllKeys()), sx, sy, 14) : null;
    const was = fHover; fHover = s;
    if ((was && was.x) !== (s && s.x) || (was && was.z) !== (s && s.z)) M.draw();
    $('map').style.cursor = s ? 'pointer' : '';
    $('fhov').hidden = false;
    setHTML($('fhov'), s ? coordsHTML(s.x, s.z, (job && job.dim) || 0, s.name, 'Cursor', true)
      : coordsHTML(x, z, (job && job.dim) || 0, b, 'Cursor', true));
  },
  click: (M, x, z, sx, sy) => {
    if (findRoute && findRoute.on) { findRoute.click(M, x, z, sx, sy); return; }   // route mode (js/06b-route.js)
    // a click on a result dot opens that spot; on a structure or anywhere else, picks it
    const d = drawScale(); let best = null, bd = 10 * d;
    if (findMode === 'seed') for (const s2 of exact.concat(close)) { const [px, py] = M.scr(s2.x, s2.z), dd = Math.hypot(px - sx, py - sy); if (dd < bd && s2 !== sel) { bd = dd; best = s2; } }
    if (best) { select(best); return; }
    const s = M.view.s >= 0.035 ? structAt(M, new Set(findAllKeys()), sx, sy, 16) : null;
    fPick = s ? { x: s.x, z: s.z, label: s.name } : { x, z, label: null };
    M.draw();
  },
});
$('map').addEventListener('pointerleave', () => { $('fhov').hidden = true; setText($('fhov'), ''); if (fHover) { fHover = null; findMap.draw(); } });
$('fxz').setAttribute('aria-pressed', fCoords);
$('fxz').onclick = () => { fCoords = !fCoords; $('fxz').setAttribute('aria-pressed', fCoords); try { localStorage.setItem('basescout.fxz', fCoords ? '1' : '0'); } catch {} findMap.draw(); };
$('fzin').onclick = () => findMap.zoomAt(findMap.cv.width / 2, findMap.cv.height / 2, 1.6);
$('fzout').onclick = () => findMap.zoomAt(findMap.cv.width / 2, findMap.cv.height / 2, 1 / 1.6);

