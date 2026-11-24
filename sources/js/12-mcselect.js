// ---------- drop-down lists in the site's style ----------
// Every <select> keeps working as usual (its value, its change event, the code that reads it); only its list is
// drawn by the site, so it matches everywhere, in every browser.
let mcOpen = null;   // { sel, pop, act }
function mcClose(focus) {
  if (!mcOpen) return;
  mcOpen.pop.remove(); if (focus) mcOpen.sel.focus(); mcOpen = null;
}
function mcShow(sel) {
  mcClose();
  const pop = document.createElement('div'); pop.className = 'mcpop'; pop.setAttribute('role', 'listbox');
  const items = [];
  for (const el of sel.children) {
    const opts = el.tagName === 'OPTGROUP' ? [...el.children] : [el];
    if (el.tagName === 'OPTGROUP') { const g = document.createElement('div'); g.className = 'mcg'; g.textContent = el.label; pop.appendChild(g); }
    for (const o of opts) {
      if (o.tagName !== 'OPTION' || o.hidden) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mco' + (o.selected ? ' on' : ''); b.textContent = o.textContent;
      b.disabled = o.disabled; b.setAttribute('role', 'option'); b.tabIndex = -1;
      b.onmousedown = e => e.preventDefault();
      b.onclick = () => mcPick(o.index);
      b.onmousemove = () => mcAct(items.indexOf(b));
      items.push(b); pop.appendChild(b);
    }
  }
  document.body.appendChild(pop);
  const z = uiZoom(), r = sel.getBoundingClientRect(), vh = innerHeight / z, top = r.bottom / z, left = r.left / z;
  pop.style.minWidth = r.width / z + 'px'; pop.style.left = left + 'px';
  const h = Math.min(pop.scrollHeight + 4, 320);
  if (top + h > vh - 8 && r.top / z - h > 8) pop.style.top = (r.top / z - h) + 'px'; else { pop.style.top = top + 'px'; pop.style.maxHeight = Math.max(120, Math.min(320, vh - top - 8)) + 'px'; }
  const pr = pop.getBoundingClientRect(); if (pr.right / z > innerWidth / z - 4) pop.style.left = Math.max(4, innerWidth / z - pr.width / z - 4) + 'px';
  mcOpen = { sel, pop, items, act: -1 };
  const cur = items.findIndex(b => b.classList.contains('on'));
  mcAct(cur >= 0 ? cur : 0, true);
}
function mcAct(i, center) {
  if (!mcOpen || !mcOpen.items.length) return;
  i = Math.max(0, Math.min(mcOpen.items.length - 1, i));
  mcOpen.items.forEach((b, k) => b.classList.toggle('act', k === i)); mcOpen.act = i;
  const b = mcOpen.items[i], p = mcOpen.pop;
  if (center) p.scrollTop = b.offsetTop - p.clientHeight / 2 + b.offsetHeight / 2;
  else if (b.offsetTop < p.scrollTop) p.scrollTop = b.offsetTop; else if (b.offsetTop + b.offsetHeight > p.scrollTop + p.clientHeight) p.scrollTop = b.offsetTop + b.offsetHeight - p.clientHeight;
}
function mcPick(index) {
  const sel = mcOpen.sel; mcClose(true);
  if (sel.selectedIndex !== index) { sel.selectedIndex = index; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
}
document.addEventListener('mousedown', e => {
  if (mcOpen && mcOpen.pop.contains(e.target)) return;
  const s = e.target.closest && e.target.closest('select');
  if (s && !s.disabled && !s.multiple && e.button === 0) {
    e.preventDefault(); s.focus();
    if (mcOpen && mcOpen.sel === s) mcClose(); else mcShow(s);
    return;
  }
  mcClose();
}, true);
document.addEventListener('keydown', e => {
  if (mcOpen) {
    const k = e.key, it = mcOpen.items;
    if (k === 'Escape' || k === 'Tab') { mcClose(k === 'Escape'); if (k === 'Escape') e.preventDefault(); return; }
    if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); let i = mcOpen.act; do i += k === 'ArrowDown' ? 1 : -1; while (it[i] && it[i].disabled); mcAct(i); return; }
    if (k === 'Home' || k === 'End') { e.preventDefault(); mcAct(k === 'Home' ? 0 : it.length - 1); return; }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); const b = it[mcOpen.act]; if (b && !b.disabled) b.click(); return; }
    if (k.length === 1) {   // type a letter to jump
      const i = it.findIndex((b, j) => j > mcOpen.act && b.textContent.trim().toLowerCase().startsWith(k.toLowerCase()));
      const j = i >= 0 ? i : it.findIndex(b => b.textContent.trim().toLowerCase().startsWith(k.toLowerCase()));
      if (j >= 0) mcAct(j);
    }
    return;
  }
  const s = e.target;
  if (s && s.tagName === 'SELECT' && !s.disabled && !s.multiple && (e.key === 'Enter' || e.key === ' ' || (e.altKey && e.key === 'ArrowDown'))) { e.preventDefault(); mcShow(s); }
}, true);
addEventListener('resize', () => mcClose());
document.addEventListener('scroll', e => { if (mcOpen && !mcOpen.pop.contains(e.target)) mcClose(); }, true);

// - / + buttons next to a number box (the browser's own little arrows are hidden)
document.addEventListener('click', e => {
  const b = e.target.closest('.mcstep'); if (!b) return;
  const inp = document.getElementById(b.dataset.for); if (!inp) return;
  const min = inp.min === '' ? -Infinity : +inp.min, v = Math.max(min, Math.floor(+inp.value || 0) + +b.dataset.step);
  inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
});
