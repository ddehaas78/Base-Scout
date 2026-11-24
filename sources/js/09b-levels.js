// ---------- villager level-ups: every job, levels 1 to 5 (Librarian: 2 to 5, level 1 is the big table) ----------
// Each job and level has its own random sequence ("minecraft:trade_set/<job>/level_<n>"), seeded from the world seed.
// Every villager of that job in the world that reaches that level takes the next roll: trades are drawn from the
// level's list without putting them back, until enough offers are made. A trade that doesn't fit the villager (wrong
// villager type, map not made, item left without enchantments) gives no offer, and the draw goes on.
// The random parts of a trade (book, enchantments, dyes, potion, stew effect) use the same sequence, in that order.
// Data: js/09a-jobdata.js (26.x). Librarian is checked in game; the other jobs follow the same rules, not checked yet.
const JOB_ORDER = Object.keys(JOB_DATA);   // most used first
const JOB_LEVEL_NAMES = ['', 'Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master'];
const JOB_VARIANT_NAMES = { plains: 'Plains', desert: 'Desert', jungle: 'Jungle', savanna: 'Savanna', snow: 'Snowy', swamp: 'Swamp', taiga: 'Taiga' };
const DYE_RGB = [0xF9FFFE, 0xF9801D, 0xC74EBD, 0x3AB3DA, 0xFED83D, 0x80C71F, 0xF38BAA, 0x474F52, 0x9D9D97, 0x169C9C, 0x8932B8, 0x3C44AA, 0x835432, 0x5E7C16, 0xB02E26, 0x1D1D21];
const jobUsesVariant = job => Object.values(JOB_DATA[job].levels).some(l => l.pool.some(t => t[7]));

// ---- the game's enchanting (enchanting table rules, used by enchant_with_levels) ----
const jround = x => Math.floor(Math.fround(x + 0.5));   // Java Math.round on a float
function jobEnchant(rng, itemKey, cost) {
  const E = JOB_ENCH_FOR[itemKey], q = (E.e >> 2) + 1;
  cost += 1 + rng.nextInt(q) + rng.nextInt(q);
  const a = rng.nextFloat(), b = rng.nextFloat(), f = Math.fround(Math.fround(Math.fround(a + b) - 1) * Math.fround(0.15));
  cost = Math.max(1, jround(Math.fround(cost + Math.fround(cost * f))));
  let avail = [];
  for (const k of E.c) {
    const [, , max, mb, mp, xb, xp, w] = JOB_ENCH[k];
    for (let l = max; l >= 1; l--) if (cost >= mb + mp * (l - 1) && cost <= xb + xp * (l - 1)) { avail.push([k, l, w]); break; }
  }
  const out = [], bad = new Set(E.x.map(([p, r]) => p + ',' + r));
  const pick = () => {
    const total = avail.reduce((s, x) => s + x[2], 0); if (total <= 0) return;
    let r = rng.nextInt(total);
    for (const x of avail) { r -= x[2]; if (r < 0) { out.push([x[0], x[1]]); return; } }
  };
  if (!avail.length) return out;
  pick();
  while (rng.nextInt(50) <= cost) {
    if (out.length) { const last = out[out.length - 1][0]; avail = avail.filter(x => x[0] !== last && !bad.has(Math.min(x[0], last) + ',' + Math.max(x[0], last))); }
    if (!avail.length) break;
    pick();
    cost = Math.trunc(cost / 2);
  }
  return out;
}
function jobDyeColor(dyes) {   // how the game mixes dyes on leather
  let r = 0, g = 0, b = 0, m = 0;
  for (const d of dyes) { const c = DYE_RGB[d], cr = c >> 16 & 255, cg = c >> 8 & 255, cb = c & 255; m += Math.max(cr, cg, cb); r += cr; g += cg; b += cb; }
  const n = dyes.length; let ar = Math.trunc(r / n), ag = Math.trunc(g / n), ab = Math.trunc(b / n);
  const avg = Math.fround(m / n), cur = Math.max(ar, ag, ab);
  ar = Math.trunc(Math.fround(ar * avg / cur)); ag = Math.trunc(Math.fround(ag * avg / cur)); ab = Math.trunc(Math.fround(ab * avg / cur));
  return (ar << 16) + (ag << 8) + ab;
}
// one trade → an offer, or null when the game would drop it
function jobOffer(rng, t, ti) {
  const fn = t[6], o = { t: ti, p: t[1] };
  if (!fn || fn[0] === 'm') return o;
  if (fn[0] === 'b') {   // enchanted book, as for novice librarians
    const b = rng.nextInt(LIB_BOOKS.length), [key, max] = LIB_BOOKS[b], level = rng.between(1, max);
    let price = 2 + rng.nextInt(5 + level * 10) + 3 * level;
    if (LIB_DOUBLE.has(key)) price *= 2;
    o.book = b; o.level = level; o.p = Math.min(64, t[1] + price); return o;
  }
  if (fn[0] === 'e') {
    const levels = rng.nextInt(fn[3] - fn[2] + 1) + fn[2], ench = jobEnchant(rng, fn[1], levels);
    if (!ench.length) return null;
    o.ench = ench; o.p = Math.min(64, t[1] + levels); return o;
  }
  if (fn[0] === 'd') {
    let n = fn[1]; for (let i = 0; i < fn[2]; i++) if (rng.nextFloat() < fn[3]) n++;
    o.dyes = Array.from({ length: n }, () => rng.nextInt(16)); o.color = jobDyeColor(o.dyes); return o;
  }
  if (fn[0] === 'p') { o.potion = rng.nextInt(JOB_POTIONS.length); return o; }
  if (fn[0] === 's') { o.stew = rng.nextInt(fn[1].length); return o; }
  return o;
}
function jobRoll(rng, L, variant) {
  const left = L.pool.map((_, i) => i), out = [];
  while (out.length < L.amt && left.length) {
    const ti = left.splice(rng.nextInt(left.length), 1)[0], t = L.pool[ti];
    if (t[7] && !t[7].includes(variant)) continue;   // not for this villager type: no offer
    const o = jobOffer(rng, t, ti); if (o) out.push(o);
  }
  return out;
}

// ---- rolls worked out so far, per seed / job / level / villager type ----
const JOBD = {};
function jobData(seed, job, lv, variant) {
  const k = job + '/' + lv + '/' + (jobUsesVariant(job) ? variant : 0), d = JOBD[k];
  if (d && d.seed === seed) return d;
  const h = JOB_DATA[job].levels[lv].h;
  return (JOBD[k] = { seed, job, lv, variant, rolls: [], rng: new TradeRng(BigInt(seed), BigInt('0x' + h[0]), BigInt('0x' + h[1])) });
}
function jobEnsure(D, n) { const L = JOB_DATA[D.job].levels[D.lv]; while (D.rolls.length < n) D.rolls.push(jobRoll(D.rng, L, D.variant)); }
async function jobEnsureAsync(D, n, progress) {
  const L = JOB_DATA[D.job].levels[D.lv];
  while (D.rolls.length < n) {
    const end = Math.min(n, D.rolls.length + 3000);
    while (D.rolls.length < end) D.rolls.push(jobRoll(D.rng, L, D.variant));
    if (progress) progress(D.rolls.length / n);
    await new Promise(r => setTimeout(r, 0));
  }
}

// ---- state: the job picked for the whole Villager tab, the level shown on the right, positions ----
let upJob = 'librarian', upLevel = 2, upVariant = 0, upShown = 100, jobMode = 'known', jobShown = 200;
try {
  const s = JSON.parse(localStorage.getItem('basescout.jobs.ui') || '{}') || {};
  if (JOB_DATA[s.job]) upJob = s.job;
  if (s.level >= 2 && s.level <= 5) upLevel = s.level;
  if (s.variant >= 0 && s.variant < JOB_VARIANTS.length) upVariant = s.variant;
} catch {}
const upSaveUi = () => { try { localStorage.setItem('basescout.jobs.ui', JSON.stringify({ job: upJob, level: upLevel, variant: upVariant })); } catch {} };
const upPosMap = () => {
  let m = {}; try { m = JSON.parse(localStorage.getItem('basescout.jobs.pos') || '{}') || {}; } catch {}
  try {   // numbers saved by v60 (librarian levels only)
    const old = JSON.parse(localStorage.getItem('basescout.lib.up') || 'null');
    if (old) { for (const [seed, lv] of Object.entries(old)) for (const [l, n] of Object.entries(lv)) { m[seed] = m[seed] || {}; if (m[seed]['librarian/' + l] === undefined) m[seed]['librarian/' + l] = n; }
      localStorage.setItem('basescout.jobs.pos', JSON.stringify(m)); localStorage.removeItem('basescout.lib.up'); }
  } catch {}
  return m;
};
function posGet(seed, job, lv) { if (seed === null) return 0; const v = (upPosMap()[seed] || {})[job + '/' + lv]; return Number.isInteger(v) ? v : 0; }
function posSet(seed, job, lv, pos) {
  if (seed === null) return;
  const m = upPosMap(); m[seed] = m[seed] || {}; m[seed][job + '/' + lv] = Math.max(0, pos | 0);
  try { localStorage.setItem('basescout.jobs.pos', JSON.stringify(m)); } catch {}
}
const upGetPos = seed => posGet(seed, upJob, upLevel), upSetPos = (seed, v) => posSet(seed, upJob, upLevel, v);

// ---- how an offer looks ----
const jItem = i => JOB_ITEMS[i];
const jIcon = i => texImg(jItem(i)[2], jItem(i)[1]);
const jMain = t => jItem(t[4])[0] === 'emerald' ? t[0] : t[4];   // the item the trade is about
const jobEnchText = ench => ench.map(([k, l]) => `<span>${escH(JOB_ENCH[k][1] + (JOB_ENCH[k][2] > 1 ? ' ' + ROMAN[l] : ''))}</span>`).join(', ');
function jobOfferHtml(o, pool) {
  const t = pool[o.t];
  if (o.book !== undefined) {   // a librarian's book: same look as the big table
    const c = libCode(o.book, o.level);
    return libOffer(c, o.p);
  }
  const em = i => jItem(i)[0] === 'emerald', main = jMain(t), sells = em(t[4]);
  const giveSide = `${t[1] > 1 || em(t[0]) ? `<b>${o.p}</b>` : ''}${jIcon(t[0])}${t[2] >= 0 ? ` + ${t[3] > 1 ? `<b>${t[3]}</b>` : ''}${jIcon(t[2])}` : ''}`;
  const getSide = `${t[5] > 1 ? `<b>${t[5]}</b>` : ''}${jIcon(t[4])}`;
  let extra = '';
  if (o.ench) extra = `<span class="jx ench">${jobEnchText(o.ench)}</span>`;
  if (o.dyes) extra = `<span class="jx"><i class="sw" style="background:#${o.color.toString(16).padStart(6, '0')}"></i>${o.dyes.map(d => `<span>${escH(JOB_DYES[d][1])}</span>`).join(' + ')}</span>`;
  if (o.potion !== undefined) extra = `<span class="jx">${escH(JOB_POTIONS[o.potion][1])}</span>`;
  if (o.stew !== undefined) extra = `<span class="jx">${escH(t[6][1][o.stew][0])}</span>`;
  return `<span class="offer joffer${o.ench ? ' book' : ''}" title="${escH(jItem(main)[1])}"><span class="jt">${giveSide}<span class="ar">→</span>${getSide}</span><span class="jn">${escH(jItem(main)[1])}</span>${extra}</span>`;
}
const jobWanted = o => o.book !== undefined && libIsWanted(libCode(o.book, o.level), o.p);


// ---- the job picker (top of the Villager tab) ----
function renderJobPick() {
  const sel = $('upJob');
  if (!sel.options.length) sel.innerHTML = JOB_ORDER.map(j => `<option value="${j}">${escH(JOB_DATA[j].name)}</option>`).join('');
  sel.value = upJob;
  const usesV = jobUsesVariant(upJob);
  $('upVarL').hidden = !usesV;
  if (usesV) { const vs = $('upVar'); if (!vs.options.length) vs.innerHTML = JOB_VARIANTS.map((v, i) => `<option value="${i}">${escH(JOB_VARIANT_NAMES[v])}</option>`).join(''); vs.value = upVariant; }
  const lib = upJob === 'librarian';
  $('libCards').hidden = !lib; document.querySelector('#paneLib .libbar').hidden = !lib; $('libWantSec').hidden = !lib;
  $('libLocLib').hidden = !lib; $('libLocJob').hidden = lib;
  $('libYourH').textContent = lib ? 'Your librarian' : 'Your villager';
  $('jobCheck').hidden = lib; $('libHowSec').hidden = !lib;
}

// ---- left side and big table for jobs other than librarian: the novice (level 1) rerolls ----
const LIB_THEAD = $('libTable').tHead.innerHTML;
function renderJobMain() {
  const seed = parseSeed($('seed').value), okVer = inVer('lib');
  $('libVerNote').hidden = okVer;
  if (!okVer) { $('libVerNote').innerHTML = `Villager trades can only be predicted from Java 26.1. The version picked at the top is <b>${escH(VER)}</b>. <button type="button" id="libToNew" style="padding:3px 9px;font-size:12px;margin-left:4px">Use 26.3</button>`; $('libToNew').onclick = () => setVersion('26.3'); }
  document.querySelectorAll('input[name=libmode]').forEach(r => r.checked = r.value === jobMode);
  $('libLocate').hidden = jobMode !== 'locate';
  if (jobMode === 'locate' && !MAIN.obs) { MAIN.obs = [obsEmpty(MAIN), obsEmpty(MAIN), obsEmpty(MAIN)]; renderObs(MAIN); }
  const L = JOB_DATA[upJob].levels[1], cols = Math.max(2, L.amt);
  $('libTable').tHead.innerHTML = `<tr><th>Roll</th><th title="How many rerolls from now, counting the next one as 1">Rerolls</th>${Array.from({ length: cols }, (_, k) => `<th>Trade ${k + 1}</th>`).join('')}</tr>`;
  if (seed === null || !okVer) {
    $('libNext').innerHTML = `<p class="hint" style="margin:0">${seed === null ? 'Enter your world seed at the top.' : 'Pick Java 26.1 or newer at the top.'}</p>`;
    $('libRows').innerHTML = ''; $('libMore').innerHTML = ''; return;
  }
  const pos = posGet(seed, upJob, 1), D = jobData(seed, upJob, 1, upVariant);
  $('libPosIn').value = pos;
  jobEnsure(D, pos + Math.max(1500, jobShown + 50));
  const pair = r => `<div class="pair">${r.map(o => jobOfferHtml(o, L.pool)).join('')}</div>`;
  $('libNext').innerHTML = `<div class="libnow">${pos > 0 ? `<div><span>Your villager should be showing</span> <b>roll ${pos - 1}</b>:</div>${pair(D.rolls[pos - 1])}` : ''}
    <div><span>The next reroll</span> (<b>roll ${pos}</b>) <span>should show:</span></div>${pair(D.rolls[pos])}
    <div class="row2"><button type="button" class="go" id="libYes" style="min-width:0">I rerolled, that's what came out</button><button type="button" id="libNo">Something else came out</button>${pos > 0 ? '<button type="button" id="libUndo" title="Go back one roll">Undo</button>' : ''}</div></div>`;
  $('libYes').onclick = () => { posSet(seed, upJob, 1, pos + 1); jobMode = 'known'; renderLib(); };
  $('libNo').onclick = () => { jobMode = 'locate'; MAIN.obs = null; renderLib(); toast('Enter the last few rolls you saw, and the site will find where you are.'); };
  if ($('libUndo')) $('libUndo').onclick = () => { posSet(seed, upJob, 1, pos - 1); renderLib(); };
  const rows = [];
  for (let i = pos; i < D.rolls.length && rows.length < jobShown; i++)
    rows.push(`<tr class="${i === pos ? 'now' : ''}"><td class="num">${i}</td><td class="num">${libRerolls(i, pos)}</td>${Array.from({ length: cols }, (_, k) => `<td>${D.rolls[i][k] ? jobOfferHtml(D.rolls[i][k], L.pool) : ''}</td>`).join('')}</tr>`);
  $('libRows').innerHTML = rows.join('');
  $('libMore').innerHTML = rows.length >= jobShown ? '<button type="button" id="libMoreB">Show 200 more</button>' : '';
  if ($('libMoreB')) $('libMoreB').onclick = () => { jobShown += 200; renderLib(); };
}

// ---- right side: the level-ups (levels 2 to 5) ----
function renderUp() {
  const seed = parseSeed($('seed').value), okVer = inVer('lib');
  document.querySelectorAll('#upseg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.up === upLevel));
  const L = JOB_DATA[upJob].levels[upLevel];
  if (seed === null || !okVer) {
    $('upWantBox').innerHTML = `<p class="hint" style="margin:0">${seed === null ? 'Enter your world seed at the top.' : 'Pick Java 26.1 or newer at the top.'}</p>`;
    $('upRows').innerHTML = ''; $('upMore').innerHTML = ''; return;
  }
  const pos = upGetPos(seed), D = jobData(seed, upJob, upLevel, upVariant);
  $('upPosIn').value = pos;
  jobEnsure(D, pos + Math.max(1500, upShown + 50));
  // librarian: the nearest level-up with each wanted book
  if (upJob === 'librarian' && upLevel < 5) {
    $('upWantBox').hidden = false;
    $('upWantBox').innerHTML = libWanted.map(w => {
      let first = null;
      for (let i = pos; i < D.rolls.length && !first; i++) for (const o of D.rolls[i]) if (o.book !== undefined && o.book === w.book && o.level >= w.min && o.p <= w.max) { first = { i, o }; break; }
      const title = `${libBookName(w.book)}${w.min > 1 ? ' ' + ROMAN[w.min] + '+' : ''}`;
      if (!first) return `<div class="upw"><b>${escH(title)}</b> <span>not in the next</span> <span>${fmt(D.rolls.length - pos)}</span></div>`;
      const n = libRerolls(first.i, pos);
      return `<div class="upw${n === 1 ? ' good' : ''}"><b>${escH(libName(libCode(first.o.book, first.o.level)))}</b> <span class="em">${emerald()}${first.o.p}</span>
        <span>${n === 1 ? 'next level-up' : 'level-up'}</span>${n === 1 ? '' : ` <span class="upn">#${first.i}</span> <span>(in</span> <span class="upn">${n}</span><span>)</span>`}</div>`;
    }).join('') || '<p class="hint" style="margin:0">Add a book you want on the left.</p>';
  } else { $('upWantBox').hidden = true; $('upWantBox').innerHTML = ''; }
  const cols = Math.max(2, L.amt), rows = [], lib = upJob === 'librarian';
  const booksOnly = lib && $('libBooks').checked, wantOnly = lib && $('libOnlyWant').checked, booksLeft = lib && $('libLeft').checked;
  $('upHead').innerHTML = `<th>#</th><th title="How many level-ups to this level from now, counting the next one as 1">In</th>` + Array.from({ length: cols }, (_, k) => `<th>${booksLeft && k === 0 ? 'Book' : booksLeft && k === 1 ? 'Other' : 'Trade ' + (k + 1)}</th>`).join('');
  for (let i = pos; i < D.rolls.length && rows.length < upShown; i++) {
    let r = D.rolls[i].slice();
    const want = r.some(jobWanted);
    if (booksOnly && !r.some(o => o.book !== undefined)) continue;
    if (wantOnly && !want) continue;
    if (booksLeft && r.length > 1 && r[0].book === undefined && r[1].book !== undefined) r = [r[1], r[0], ...r.slice(2)];
    rows.push(`<tr class="${want ? 'want' : ''}${i === pos ? ' now' : ''}"><td class="num">${i}</td><td class="num">${libRerolls(i, pos)}</td>`
      + Array.from({ length: cols }, (_, k) => `<td>${r[k] ? jobOfferHtml(r[k], L.pool) : ''}</td>`).join('') + '</tr>');
  }
  $('upRows').innerHTML = rows.join('') || `<tr><td colspan="${cols + 2}" class="hint">Nothing like that in the level-ups worked out so far.</td></tr>`;
  $('upMore').innerHTML = rows.length >= upShown ? '<button type="button" id="upMoreB">Show 100 more</button>' : '';
  if ($('upMoreB')) $('upMoreB').onclick = () => { upShown += 100; renderUp(); };
}
const upReset = () => { upShown = 100; UP.obs = null; $('upFindBox').hidden = true; $('upRes').innerHTML = ''; upSaveUi(); renderUp(); };
document.querySelectorAll('#upseg button').forEach(b => b.onclick = () => { upLevel = +b.dataset.up; upReset(); });
const jobChanged = () => { upShown = 100; jobShown = 200; UP.obs = null; MAIN.obs = null; jobMode = 'known'; $('upFindBox').hidden = true; $('upRes').innerHTML = ''; $('jobLocRes').innerHTML = ''; upSaveUi(); renderLib(); };
$('upJob').onchange = () => { upJob = $('upJob').value; jobChanged(); };
$('upVar').onchange = () => { upVariant = +$('upVar').value; jobChanged(); };
$('upPosIn').onchange = () => { const v = Math.floor(+$('upPosIn').value); if (v >= 0) { upSetPos(parseSeed($('seed').value), v); renderUp(); } };
$('upInc').onclick = () => { const seed = parseSeed($('seed').value); upSetPos(seed, upGetPos(seed) + 1); renderUp(); };
$('upFind').onclick = () => {
  const open = $('upFindBox').hidden; $('upFindBox').hidden = !open;
  if (open && !UP.obs) { UP.obs = [obsEmpty(UP)]; renderObs(UP); }
};
// the whole tab follows the job: the librarian keeps its own table; other jobs use the generic one
const _renderLibMain = renderLib;
renderLib = function () {
  renderJobPick();
  if (upJob === 'librarian') { if ($('libTable').tHead.innerHTML !== LIB_THEAD) $('libTable').tHead.innerHTML = LIB_THEAD; _renderLibMain(); }
  else renderJobMain();
  renderUp();
};
// the left controls, for jobs other than librarian
document.querySelectorAll('input[name=libmode]').forEach(r => { const libH = r.onchange; r.onchange = () => {
  if (upJob === 'librarian') return libH();
  jobMode = r.value; if (jobMode === 'locate') MAIN.obs = null; renderLib();
}; });
{ const libH = $('libPosIn').onchange; $('libPosIn').onchange = () => {
  if (upJob === 'librarian') return libH();
  const v = Math.floor(+$('libPosIn').value); if (v >= 0) { posSet(parseSeed($('seed').value), upJob, 1, v); jobMode = 'known'; renderLib(); }
}; }

// ---- finding where you are from the trades you see (left: rerolls of level 1, right: level-ups) ----
const UP = { obs: null, max: 50000, busy: false, el: 'upObs', res: 'upRes', lv: () => upLevel, row: 'Level-up',
  done: () => { $('upFindBox').hidden = true; renderUp(); toast('Found it. The list now starts at the next level-up.'); } };
const MAIN = { obs: null, max: 50000, busy: false, el: 'jobObs', res: 'jobLocRes', lv: () => 1, row: 'Roll',
  done: () => { jobMode = 'known'; renderLib(); toast('Found you. The list now starts at your next reroll.'); } };
const obsEmpty = C => Array.from({ length: Math.min(JOB_DATA[upJob].levels[C.lv()].amt, 2) }, () => ({ t: null, book: LIB_IDX.mending, level: 1, price: '' }));
function renderObs(C) {
  if (!C.obs) return;
  const L = JOB_DATA[upJob].levels[C.lv()], books = LIB_BOOKS.map((q, i) => [i, libBookName(i)]).sort((a, b) => a[1].localeCompare(b[1], libLang));
  const head = r => C.row === 'Roll' ? `Roll ${r + 1}${r === C.obs.length - 1 && C.obs.length > 1 ? ' (the latest)' : ''}`
    : `<span class="ohl"><span>Level-up</span> ${r + 1}${r === C.obs.length - 1 && C.obs.length > 1 ? ' <span>(the latest)</span>' : ''}</span>`;
  $(C.el).innerHTML = C.obs.map((o, r) => `<div class="obsrow"><div class="oh">${head(r)}${C.obs.length > 1 ? `<button type="button" data-del="${r}" aria-label="Remove this level-up">×</button>` : ''}</div>
    ${o.map((sl, k) => { const tt = sl.t === null ? null : L.pool[sl.t], fn = tt && tt[6]; return `<div class="oslot"><span class="on">${k + 1}</span>
      <span class="oitems" role="group" aria-label="Slot ${k + 1}">${L.pool.map((t, ti) => (t[7] && !t[7].includes(upVariant)) ? '' :
        `<button type="button" class="oitem" data-r="${r}" data-k="${k}" data-t="${ti}" aria-pressed="${sl.t === ti}" title="${escH(t[6] && t[6][0] === 'b' ? 'Enchanted Book' : jItem(jMain(t))[1])}">${t[6] && t[6][0] === 'b' ? texImg(LIB_ITEM_TEX.book, 'Enchanted Book') : jIcon(jMain(t))}</button>`).join('')}</span>
      ${fn && fn[0] === 'b' ? `<select data-r="${r}" data-k="${k}" data-f="book" aria-label="Book">${books.map(([i, n]) => `<option value="${i}"${i === sl.book ? ' selected' : ''}>${escH(n)}</option>`).join('')}</select>
      <select data-r="${r}" data-k="${k}" data-f="level" aria-label="Level"${LIB_BOOKS[sl.book][1] === 1 ? ' disabled' : ''}>${Array.from({ length: LIB_BOOKS[sl.book][1] }, (_, i) => `<option value="${i + 1}"${i + 1 === sl.level ? ' selected' : ''}>${ROMAN[i + 1]}</option>`).join('')}</select>` : '<span></span><span></span>'}
      ${fn && (fn[0] === 'b' || fn[0] === 'e') ? `<label class="oprice" title="Price in emeralds (optional)">${emerald()}<input type="number" min="1" max="64" value="${escH(sl.price)}" data-r="${r}" data-k="${k}" data-f="price" aria-label="Price in emeralds, optional"></label>` : '<span></span>'}</div>`; }).join('')}</div>`).join('');
  $(C.el).querySelectorAll('[data-f]').forEach(el => el.onchange = () => {
    const sl = C.obs[+el.dataset.r][+el.dataset.k], f = el.dataset.f;
    sl[f] = f === 'book' || f === 'level' ? +el.value : el.value;
    if (f === 'book') sl.level = Math.min(sl.level, LIB_BOOKS[sl.book][1]);
    if (f !== 'price') renderObs(C);
  });
  $(C.el).querySelectorAll('.oitem').forEach(b => b.onclick = () => {   // click again to clear
    const sl = C.obs[+b.dataset.r][+b.dataset.k], t = +b.dataset.t; sl.t = sl.t === t ? null : t; renderObs(C);
  });
  $(C.el).querySelectorAll('[data-del]').forEach(b => b.onclick = () => { C.obs.splice(+b.dataset.del, 1); renderObs(C); });
}
$('upObsAdd').onclick = () => { UP.obs.push(obsEmpty(UP)); renderObs(UP); };
$('upObsGo').onclick = () => obsLocate(UP, false);
$('jobObsAdd').onclick = () => { MAIN.obs.push(obsEmpty(MAIN)); renderObs(MAIN); };
$('jobObsGo').onclick = () => obsLocate(MAIN, false);
async function obsLocate(C, further) {
  const seed = parseSeed($('seed').value), job = upJob, lv = C.lv();
  if (seed === null) { toast('Enter your world seed at the top first.'); return; }
  if (C.busy) return;
  if (C.obs.some(o => o.some(sl => sl.t === null))) { toast('Fill in both slots of every level-up, or remove the empty ones.'); return; }
  const L = JOB_DATA[job].levels[lv];
  const obs = C.obs.map(o => o.map(sl => ({ t: sl.t, book: L.pool[sl.t][6] && L.pool[sl.t][6][0] === 'b' ? sl.book : null, level: sl.level, p: +sl.price || 0 })));
  if (further) C.max = Math.min(1000000, C.max * 10);
  const K = obs.length, D = jobData(seed, job, lv, upVariant), box = $(C.res);
  C.busy = true;
  box.innerHTML = '<div class="libres"><span>Working out the level-ups…</span> <span class="prog">0%</span></div>';
  await jobEnsureAsync(D, C.max + K, f => { const e = box.querySelector('.prog'); if (e) e.textContent = Math.round(f * 100) + '%'; });
  C.busy = false;
  if (job !== upJob || lv !== C.lv()) { box.innerHTML = ''; return; }
  const same = (o, s) => o && o.t === s.t && (s.book === null || (o.book === s.book && o.level === s.level));
  const hits = [];
  for (let i = 0; i <= C.max; i++) {
    let k = 0;
    for (; k < K; k++) if (!obs[k].every((s, j) => same(D.rolls[i + k][j], s))) break;
    if (k === K) { hits.push(i); if (hits.length > 200) break; }
  }
  const priceOK = i => obs.every((o, k) => o.every((s, j) => !s.p || D.rolls[i + k][j].p === s.p));
  const typedPrices = obs.some(o => o.some(s => s.p)), byPrice = typedPrices ? hits.filter(priceOK) : [];
  const was = posGet(seed, job, lv), cands = byPrice.length ? byPrice : hits;
  const pick = hits.length === 1 ? hits[0] : byPrice.length === 1 ? byPrice[0] : null;
  const use = i => { posSet(seed, job, lv, i + K); C.obs = null; box.innerHTML = ''; C.done(); };
  if (pick !== null) { use(pick); return; }
  if (!hits.length) {
    box.innerHTML = `<div class="libres bad"><b>No match.</b><ul>
      <li>Is the seed right, and the version 26.1 or newer?</li><li>Slot 1 is the top trade of the new level, slot 2 the one under it.</li>
      <li>Were the level-ups one after the other, with no other villager of this job reaching this level in between?</li>
      ${jobUsesVariant(job) ? '<li>Is the villager type right?</li>' : ''}</ul>
      ${C.max < 1000000 ? '<button type="button" class="further">Search further</button>' : ''}</div>`;
    const f = box.querySelector('.further'); if (f) f.onclick = () => obsLocate(C, true);
    return;
  }
  const near = cands.filter(i => i >= was - 2)[0];
  const list = [...new Set([near, ...cands].filter(i => i !== undefined))].slice(0, 6);
  box.innerHTML = `<div class="libres"><b><span>${hits.length > 200 ? '200+' : hits.length}</span> <span>places match.</span></b> <span>Add the next level-up when it happens, type the prices, or pick one:</span>
    ${list.map(i => `<div class="cand"><span>#${i + K - 1}</span>${i === near ? ' <span>(closest to your number)</span>' : ''}<button type="button" data-use="${i}">Use</button></div>`).join('')}</div>`;
  box.querySelectorAll('[data-use]').forEach(b => b.onclick = () => use(+b.dataset.use));
}
