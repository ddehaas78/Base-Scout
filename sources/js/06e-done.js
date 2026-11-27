// ---------- structures you've done: ticked on the maps (dimmed icon, green tick), kept per seed in this browser ----------
// Tick from the structure's chest window (button next to ×) or by right-clicking its icon on a map.
let doneHide = false; try { doneHide = localStorage.getItem('basescout.done.hide') === '1'; } catch {}
let DONE = (() => { try { return JSON.parse(localStorage.getItem('basescout.done') || '{}') || {}; } catch { return {}; } })();
const doneSeed = () => parseSeed($('seed').value);
const doneId = (key, q) => key + ':' + q.x + ':' + q.z;
function isDone(key, q) { const s = doneSeed(); return s !== null && !!(DONE[s] && DONE[s][doneId(key, q)]); }
function setDone(key, q, on) {
  const s = doneSeed(); if (s === null) return;
  const m = DONE[s] || (DONE[s] = {}), id = doneId(key, q);
  if (on) m[id] = 1; else delete m[id];
  if (!Object.keys(m).length) delete DONE[s];
  try { localStorage.setItem('basescout.done', JSON.stringify(DONE)); } catch {}
  renderDone(); xMap.draw(); findMap.draw();
}
// the line under "Show on map": hide them, and how many there are for this seed
function renderDone() {
  const s = doneSeed(), n = s !== null && DONE[s] ? Object.keys(DONE[s]).length : 0;
  $('doneCount').innerHTML = n ? `${n} <span>${n === 1 ? 'structure done' : 'structures done'}</span>` : '';
  $('doneHide').checked = doneHide;
  renderDoneBtn();
}
$('doneHide').onchange = () => {
  doneHide = $('doneHide').checked;
  try { localStorage.setItem('basescout.done.hide', doneHide ? '1' : '0'); } catch {}
  xMap.draw(); findMap.draw();
};
$('seed').addEventListener('input', () => renderDone());
// the button in the chest window
let planQ = null;   // the structure the chest window shows: { key, x, z }
function renderDoneBtn() {
  const b = $('planDone'); if (!b) return;
  b.hidden = !planQ || $('planDlg').hidden;
  if (!planQ) return;
  const on = isDone(planQ.key, planQ);
  b.textContent = on ? '✓ Done (click to undo)' : 'Mark as done';
  b.classList.toggle('on', on);
}
$('planDone').onclick = () => { if (planQ) setDone(planQ.key, planQ, !isDone(planQ.key, planQ)); };
// right-click a structure on a map: mark it done (or undo), or open its chests
const doneMenu = document.createElement('div');
doneMenu.className = 'panel donemenu'; doneMenu.hidden = true; document.body.appendChild(doneMenu);
const closeDoneMenu = () => { doneMenu.hidden = true; };
// the small menu at the pointer: done / undo, and the chests when the structure has some
function showDoneMenu(s, M, cx, cy) {
  const on = isDone(s.key, s), z = uiZoom();
  doneMenu.innerHTML = `<div class="dmt">${escH(s.name)} <span class="dmxz">X ${s.x} · Z ${s.z}</span></div>
    <button type="button" data-a="done"${on ? ' class="on"' : ''}>${on ? '✓ Done (click to undo)' : 'Mark as done'}</button>
    ${LOOT_KEYS.has(s.key) ? '<button type="button" data-a="open">Open chests</button>' : ''}`;
  doneMenu.style.left = (cx / z + 6) + 'px'; doneMenu.style.top = (cy / z + 6) + 'px';
  doneMenu.hidden = false;
  const w = doneMenu.offsetWidth, h = doneMenu.offsetHeight;   // keep it on screen
  if (cx / z + 6 + w > innerWidth / z) doneMenu.style.left = (cx / z - w - 6) + 'px';
  if (cy / z + 6 + h > innerHeight / z) doneMenu.style.top = (cy / z - h - 6) + 'px';
  doneMenu.querySelector('[data-a=done]').onclick = () => { setDone(s.key, s, !on); closeDoneMenu(); if (typeof pin !== 'undefined' && pin && pin.q) renderPin(); };
  const o = doneMenu.querySelector('[data-a=open]'); if (o) o.onclick = () => { closeDoneMenu(); openPlan(s, M); };
  return true;
}
// right-click a structure on a map (any structure); double-click does the same for structures without chests (js/06c-plan.js)
function doneOnContext(M, keys) {
  M.cv.addEventListener('contextmenu', e => {
    const r = M.cv.getBoundingClientRect(), d = devicePixelRatio || 1;
    const s = structAt(M, keys(), (e.clientX - r.left) * d, (e.clientY - r.top) * d, 18);
    if (!s) return;
    e.preventDefault(); showDoneMenu(s, M, e.clientX, e.clientY);
  });
}
document.addEventListener('pointerdown', e => { if (!doneMenu.hidden && !doneMenu.contains(e.target)) closeDoneMenu(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDoneMenu(); });
addEventListener('wheel', closeDoneMenu, { passive: true });
doneOnContext(xMap, () => shownKeys);
doneOnContext(findMap, () => findMap.view.s >= 0.035 ? new Set(findAllKeys()) : new Set());
renderDone();
