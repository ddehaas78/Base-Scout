// ---------- name tooltips: hold the mouse on a button or chip for 1 s and its full name shows, like an item in the game ----------
// For names cut short ("Bastion: ...") and icon buttons. Uses the element's title if it has one, else its text.
// The native title is taken off while hovering so the browser doesn't show a second box.
(() => {
  const tip = document.createElement('div');
  tip.className = 'mctip'; tip.hidden = true; tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  const SEL = 'button, .chip, select, [role="button"], [data-tip]';
  let cur = null, timer = 0, last = [0, 0];
  const textOf = el => (el.dataset.tip || el.dataset.tipTitle || el.getAttribute('title') || (el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent : el.textContent) || '').replace(/\s+/g, ' ').trim();
  const place = () => {
    const z = uiZoom(), w = tip.offsetWidth, h = tip.offsetHeight, vw = innerWidth / z, vh = innerHeight / z;
    let x = last[0] / z + 14, y = last[1] / z - h - 10;   // above-right of the pointer, like the game
    if (x + w > vw - 4) x = vw - w - 4;
    if (y < 4) y = last[1] / z + 20;
    if (y + h > vh - 4) y = vh - h - 4;
    tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
  };
  const hide = () => {
    clearTimeout(timer); tip.hidden = true;
    if (cur && cur.dataset.tipTitle !== undefined) { cur.setAttribute('title', cur.dataset.tipTitle); delete cur.dataset.tipTitle; }
    cur = null;
  };
  document.addEventListener('pointerover', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest(SEL);
    if (el === cur) return;
    hide(); if (!el || el.disabled) return;
    cur = el; last = [e.clientX, e.clientY];
    if (el.hasAttribute('title')) { el.dataset.tipTitle = el.getAttribute('title'); el.removeAttribute('title'); }
    timer = setTimeout(() => {
      if (cur !== el || !el.isConnected) return;
      const t = textOf(el); if (!t) return;
      tip.textContent = t; tip.hidden = false; place();
    }, 1000);
  });
  document.addEventListener('pointermove', e => { last = [e.clientX, e.clientY]; if (!tip.hidden) place(); }, { passive: true });
  document.addEventListener('pointerout', e => { if (cur && !cur.contains(e.relatedTarget)) hide(); });
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'scroll']) document.addEventListener(ev, hide, { capture: true, passive: true });
})();
