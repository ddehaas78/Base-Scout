// ---------- zone target ----------
function renderTarget() {
  const t = $('target');
  t.querySelectorAll('.chip,.rlabel').forEach(n => n.remove());
  const W = t.clientWidth || 380, R = W / 2;
  const rad = [0.40 * R, 0.70 * R, R];
  [0, 1, 2].forEach(z => {
    const l = document.createElement('div'); l.className = 'rlabel z' + (z + 1);
    l.textContent = `${RADII[z] * 2} across`;
    const a = -Math.PI / 4;  // label on the north-east edge
    l.style.left = (R + Math.cos(a) * rad[z]) + 'px'; l.style.top = (R + Math.sin(a) * rad[z]) + 'px';
    t.appendChild(l);
  });
  [0, 1, 2].forEach(z => {
    const list = placed.filter(p => p.zone === z);
    list.forEach((it, n) => {
      const c = document.createElement('div');
      c.className = 'chip placed' + (armed && armed.ref === it ? ' sel' : '') + (inVer(it.key) ? '' : ' na'); c.tabIndex = 0;
      c.innerHTML = chipHTML(it); c.title = meta(it).name + (inVer(it.key) ? '' : ` (not in ${VER}, left out of the search)`);
      let x, y;
      if (z === 0) { const h = 24, top = R - (list.length - 1) * h / 2; x = R; y = top + n * h; }
      else {
        const mid = (rad[z - 1] + rad[z]) / 2, ang = -Math.PI / 2 + (n / Math.max(1, list.length)) * Math.PI * 2 + (z === 2 ? Math.PI / list.length : 0);
        x = R + Math.cos(ang) * mid; y = R + Math.sin(ang) * mid;
      }
      c.style.left = x + 'px'; c.style.top = y + 'px';
      bindChip(c, { ref: it });
      t.appendChild(c);
    });
  });
  if (!$('zsum').children.length) {
    // the three ring sizes side by side (diameters in blocks)
    $('zsum').innerHTML = [0, 1, 2].map(z => `<label class="size" for="rs${z}" title="Ring ${z + 1}: blocks across"><i style="background:var(${ZCOL[z]})"></i><input type="number" id="rs${z}" min="50" max="4000" step="50" value="${RADII[z] * 2}"></label>`).join('')
      + '<span class="v">across</span>';
    [0, 1, 2].forEach(z => $('rs' + z).onchange = ev => {
      const v = Math.round((+ev.target.value || 0) / 2), next = RADII.slice(); next[z] = Math.max(25, Math.min(2000, v));
      if (!(next[0] < next[1] && next[1] < next[2])) { toast('Each ring has to be bigger than the one inside it.'); ev.target.value = RADII[z] * 2; return; }
      RADII = next; renderTarget(); restartSoon();
    });
  }
  $('target').classList.toggle('armed', !!armed);
  $('unplace').hidden = !(armed && armed.ref);
  if (typeof renderFixed === 'function') renderFixed();
  renderBiomeSizes();
}
function renderPalette() {
  const p = $('palette'); p.innerHTML = '';
  const list = (tab === 'structure' ? findStructs().map(s => ({ kind: 'structure', key: s.key, minor: s.minor })) : findBiomes().map(b => ({ kind: 'biome', key: b.key, minor: b.minor, cave: b.cave })))
    .filter(it => inVer(it.key));
  let divided = '';
  for (const it of list) {
    const sect = it.cave ? 'Cave biomes · underground' : it.minor ? (it.kind === 'biome' ? 'More biomes' : 'Smaller structures') : '';
    if (sect && sect !== divided) { divided = sect; const d = document.createElement('div'); d.className = 'pdiv'; d.textContent = sect; p.appendChild(d); }
    // structures can be placed many times; a biome only once
    const n = findMode === 'seeds' && seedsSub === 'fixed' ? 0 : placed.filter(q => q.kind === it.kind && q.key === it.key).length;   // Find seeds: no rings
    const used = it.kind === 'biome' && n > 0;
    const c = document.createElement('div');
    c.className = 'chip' + (used ? ' used' : '') + (armed && !armed.ref && armed.kind === it.kind && armed.key === it.key ? ' sel' : '');
    c.tabIndex = 0; c.innerHTML = chipHTML({ kind: it.kind, key: it.key }) + (it.kind === 'structure' && n ? `<span class="cnt">×${n}</span>` : '');
    c.title = used ? meta(it).name + ' (placed, drag to move)' : meta(it).name;
    bindChip(c, used ? { ref: placed.find(q => q.kind === it.kind && q.key === it.key) } : { kind: it.kind, key: it.key });
    p.appendChild(c);
  }
  $('tabS').setAttribute('aria-selected', tab === 'structure'); $('tabB').setAttribute('aria-selected', tab === 'biome');
}
function zoneAt(cx, cy) {
  const r = $('target').getBoundingClientRect(), R = r.width / 2;
  const d = Math.hypot(cx - (r.left + R), cy - (r.top + R)) / R;
  return d <= 0.40 ? 0 : d <= 0.70 ? 1 : d <= 1.0 ? 2 : -1;
}
function overPalette(cx, cy) { const r = $('palette').getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom; }
function place(src, zone) {
  if (src.ref) src.ref.zone = zone;
  else if (src.kind === 'structure' || !placed.some(q => q.kind === src.kind && q.key === src.key)) placed.push({ kind: src.kind, key: src.key, zone, ...(src.kind === 'biome' ? { size: 0 } : {}) });
  armed = null; changed();
}
function remove(src) { if (src.ref) placed = placed.filter(q => q !== src.ref); armed = null; changed(); }
function changed() { renderTarget(); renderPalette(); restartSoon(); }

function bindChip(el, src) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY; let ghost = null;
    const move = ev => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        ghost = el.cloneNode(true); ghost.className = 'chip ghost'; document.body.appendChild(ghost);
        el.style.opacity = .35;
      }
      if (!ghost) return;
      const uz = uiZoom(); ghost.style.left = ev.clientX / uz + 'px'; ghost.style.top = ev.clientY / uz + 'px';
      const z = zoneAt(ev.clientX, ev.clientY);
      document.querySelectorAll('.ring').forEach(r => r.classList.toggle('hot', +r.dataset.zone === z));
      $('palette').classList.toggle('hot', !!src.ref && overPalette(ev.clientX, ev.clientY));
      const bio = src.kind === 'biome' && !src.ref, ri = bio ? fixedRowAt(ev.clientX, ev.clientY) : -1;
      $('fixbox').classList.toggle('hot', !bio && overFixed(ev.clientX, ev.clientY));
      $('fixbox').querySelectorAll('.frow').forEach((r, i) => r.classList.toggle('hot', i === ri));
    };
    const end = ev => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end);
      document.querySelectorAll('.ring').forEach(r => r.classList.remove('hot')); $('palette').classList.remove('hot'); $('fixbox').classList.remove('hot'); $('fixbox').querySelectorAll('.frow.hot').forEach(r => r.classList.remove('hot'));
      if (ghost) {
        ghost.remove(); el.style.opacity = '';
        if (ev.type === 'pointercancel') return;
        const z = zoneAt(ev.clientX, ev.clientY);
        if (overFixed(ev.clientX, ev.clientY)) addFixed(src, ev.clientX, ev.clientY);
        else if (findMode === 'seeds' && seedsSub === 'fixed') { /* Fixed spots: no rings */ }
        else if (z >= 0) place(src, z);
        else if (src.ref) remove(src);   // dropped outside the rings: removed
      } else if (!src.ref && armed && armed.ref) {   // a placed chip is selected and a list chip is clicked: remove it
        remove(armed);
      } else {   // a tap: arm this chip
        const same = armed && (armed.ref ? armed.ref === src.ref : (armed.kind === src.kind && armed.key === src.key && !src.ref));
        armed = same ? null : src; renderTarget(); renderPalette();
        if (armed) toast(src.ref ? 'Click a ring to move it, or click Remove.' : findMode === 'seeds' && seedsSub === 'fixed' ? (src.kind === 'biome' ? 'Now click the fixed spot it goes with.' : 'Now click the Fixed spots box.') : 'Now click a ring.');
      }
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  });
  el.addEventListener('keydown', e => {
    if (e.key === '1' || e.key === '2' || e.key === '3') place(src, +e.key - 1);
    if ((e.key === 'Delete' || e.key === 'Backspace') && src.ref) remove(src);
  });
}
$('target').addEventListener('click', e => {
  if (!armed || e.target.closest('.chip')) return;
  const z = zoneAt(e.clientX, e.clientY); if (z >= 0) place(armed, z);
});
$('palette').addEventListener('click', e => { if (armed && armed.ref && !e.target.closest('.chip')) remove(armed); });
$('unplace').onclick = () => { if (armed && armed.ref) remove(armed); };
$('tabS').onclick = () => { tab = 'structure'; renderPalette(); };
$('tabB').onclick = () => { tab = 'biome'; renderPalette(); };
new ResizeObserver(() => renderTarget()).observe($('target'));

// ---------- which dimension to search ----------
function setFindDim(d) {
  if (d === findDim) return;
  placedStore[findDim] = placed; findDim = d; placed = placedStore[d] || [];
  armed = null; tab = 'structure';
  document.querySelectorAll('#fdimseg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.fdim === d));
  $('landL').hidden = d !== 0;
  if (running) stopSearch();
  token++;   // ignore anything still on its way from the old search
  job = null; exact = []; close = []; sel = null; findMap.reset(); findMap.draw();
  $('mempty').hidden = false; $('mempty').textContent = 'Pick a result to see the area around it.';
  renderTarget(); renderPalette(); renderResults(); restartSoon();
}
document.querySelectorAll('#fdimseg button').forEach(b => b.onclick = () => setFindDim(+b.dataset.fdim));

