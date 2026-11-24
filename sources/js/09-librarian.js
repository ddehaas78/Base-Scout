// ---------- librarian trades (Java 26.1+, novice librarians) ----------
// All novice librarians share one random sequence, "minecraft:trade_set/librarian/level_1", seeded from the
// world seed (Xoroshiro128++). Each roll takes 2 of the 3 trades in the pool, without putting them back.
// Book list, order and doubled prices: tag #tradeable / #double_trade_price in the 26.1-26.3 data.
const LIB_BOOKS = [['protection',4],['fire_protection',4],['feather_falling',4],['blast_protection',4],
  ['projectile_protection',4],['respiration',3],['aqua_affinity',1],['thorns',3],['depth_strider',3],
  ['sharpness',5],['smite',5],['bane_of_arthropods',5],['knockback',2],['fire_aspect',2],['looting',3],
  ['sweeping_edge',3],['efficiency',5],['silk_touch',1],['unbreaking',3],['fortune',3],['power',5],['punch',2],
  ['flame',1],['infinity',1],['luck_of_the_sea',3],['lure',3],['loyalty',3],['impaling',5],['riptide',3],
  ['channeling',1],['multishot',1],['quick_charge',3],['piercing',4],['density',5],['breach',4],['lunge',3],
  ['binding_curse',1],['vanishing_curse',1],['frost_walker',2],['mending',1]];
const LIB_DOUBLE = new Set(['binding_curse', 'vanishing_curse', 'frost_walker', 'mending']);
const LIB_NAMES = {"protection": ["Protection", "Protection"], "fire_protection": ["Fire Protection", "Protection contre le feu"], "feather_falling": ["Feather Falling", "Chute amortie"], "blast_protection": ["Blast Protection", "Protection contre les explosions"], "projectile_protection": ["Projectile Protection", "Protection contre les projectiles"], "respiration": ["Respiration", "Apnée"], "aqua_affinity": ["Aqua Affinity", "Affinité aquatique"], "thorns": ["Thorns", "Épines"], "depth_strider": ["Depth Strider", "Agilité aquatique"], "sharpness": ["Sharpness", "Tranchant"], "smite": ["Smite", "Châtiment"], "bane_of_arthropods": ["Bane of Arthropods", "Fléau des arthropodes"], "knockback": ["Knockback", "Recul"], "fire_aspect": ["Fire Aspect", "Aura de feu"], "looting": ["Looting", "Butin"], "sweeping_edge": ["Sweeping Edge", "Affilage"], "efficiency": ["Efficiency", "Efficacité"], "silk_touch": ["Silk Touch", "Toucher de soie"], "unbreaking": ["Unbreaking", "Solidité"], "fortune": ["Fortune", "Fortune"], "power": ["Power", "Puissance"], "punch": ["Punch", "Frappe"], "flame": ["Flame", "Flamme"], "infinity": ["Infinity", "Infinité"], "luck_of_the_sea": ["Luck of the Sea", "Chance de la mer"], "lure": ["Lure", "Appât"], "loyalty": ["Loyalty", "Loyauté"], "impaling": ["Impaling", "Empalement"], "riptide": ["Riptide", "Impulsion"], "channeling": ["Channeling", "Canalisation"], "multishot": ["Multishot", "Tir multiple"], "quick_charge": ["Quick Charge", "Charge rapide"], "piercing": ["Piercing", "Perforation"], "density": ["Density", "Densité"], "breach": ["Breach", "Brèche"], "lunge": ["Lunge", "Élan"], "binding_curse": ["Curse of Binding", "Malédiction du lien éternel"], "vanishing_curse": ["Curse of Vanishing", "Malédiction de disparition"], "frost_walker": ["Frost Walker", "Semelles givrantes"], "mending": ["Mending", "Raccommodage"], "item.minecraft.paper": ["Paper", "Papier"], "block.minecraft.bookshelf": ["Bookshelf", "Bibliothèque"], "item.minecraft.enchanted_book": ["Enchanted Book", "Livre enchanté"]};   // [English, French], from the game's language files
const LIB_IDX = Object.fromEntries(LIB_BOOKS.map(([k], i) => [k, i]));
const U64 = (1n << 64n) - 1n;
const rotl64 = (x, k) => ((x << BigInt(k)) | (x >> BigInt(64 - k))) & U64;
const mix13 = z => { z &= U64; z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & U64; z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & U64; return z ^ (z >> 31n); };
const LIB_HLO = 0x177c58e542b3b329n, LIB_HHI = 0x77089a3ae630bff4n;   // MD5 of "minecraft:trade_set/librarian/level_1"
class TradeRng {
  constructor(seed, hlo = LIB_HLO, hhi = LIB_HHI) {   // hlo, hhi: MD5 of the sequence name (level 1 by default)
    const lo = (BigInt.asUintN(64, seed) ^ 0x6A09E667F3BCC909n) & U64, hi = (lo + 0x9E3779B97F4A7C15n) & U64;
    this.lo = mix13(lo ^ hlo); this.hi = mix13(hi ^ hhi);
    if ((this.lo | this.hi) === 0n) { this.lo = 0x9E3779B97F4A7C15n; this.hi = 7640891576956012809n; }
  }
  nextLong() { const l = this.lo; let m = this.hi; const n = (rotl64((l + m) & U64, 17) + l) & U64;
    m ^= l; this.lo = rotl64(l, 49) ^ m ^ ((m << 21n) & U64); this.hi = rotl64(m, 28); return n; }
  nextInt(bound) { const b = BigInt(bound);
    let l = this.nextLong() & 0xFFFFFFFFn, m = l * b, n = m & 0xFFFFFFFFn;
    if (n < b) { const j = ((1n << 32n) - b) % b; while (n < j) { l = this.nextLong() & 0xFFFFFFFFn; m = l * b; n = m & 0xFFFFFFFFn; } }
    return Number(m >> 32n); }
  nextFloat() { return Number(this.nextLong() >> 40n) / 16777216; }   // 24 random bits, like the game's nextFloat
  between(a, b) { return a >= b ? a : this.nextInt(b - a + 1) + a; }
}
// An offer as a small number: 0 paper, 1 bookshelf, 2 + book*8 + level for a book.
const libCode = (book, level) => 2 + book * 8 + level;
const libBook = c => c >= 2 ? { book: (c - 2) >> 3, level: (c - 2) & 7 } : null;
function libRollInto(rng, L, i) {   // one roll: 2 offers of [paper, book, bookshelf], in slot order
  const left = [0, 2, 1], out = [];   // pool order: paper, enchanted book, bookshelf
  while (out.length < 2) {
    const e = left.splice(rng.nextInt(left.length), 1)[0];
    if (e !== 2) { out.push([e, 0]); continue; }
    const b = rng.nextInt(LIB_BOOKS.length), [key, max] = LIB_BOOKS[b];
    const level = rng.between(1, max);
    let price = 2 + rng.nextInt(5 + level * 10) + 3 * level;
    if (LIB_DOUBLE.has(key)) price *= 2;
    out.push([libCode(b, level), Math.min(64, price)]);
  }
  L.s1[i] = out[0][0]; L.p1[i] = out[0][1]; L.s2[i] = out[1][0]; L.p2[i] = out[1][1];
}
let LIB = null;   // the rolls worked out so far for one seed
function libData(seed) {
  if (!LIB || LIB.seed !== seed) LIB = { seed, n: 0, cap: 0, s1: null, s2: null, p1: null, p2: null, rng: new TradeRng(BigInt(seed)) };
  return LIB;
}
function libGrow(L, n) {
  if (n <= L.cap) return;
  const cap = Math.max(n, L.cap * 2, 4096), g = (a, T) => { const b = new T(cap); if (a) b.set(a); return b; };
  L.s1 = g(L.s1, Uint16Array); L.s2 = g(L.s2, Uint16Array); L.p1 = g(L.p1, Uint8Array); L.p2 = g(L.p2, Uint8Array); L.cap = cap;   // book codes go past 255
}
function libEnsure(L, n) { libGrow(L, n); while (L.n < n) libRollInto(L.rng, L, L.n++); }
async function libEnsureAsync(L, n, progress) {
  libGrow(L, n);
  while (L.n < n) {
    const end = Math.min(n, L.n + 5000);
    while (L.n < end) libRollInto(L.rng, L, L.n++);
    if (progress) progress(L.n / n);
    await new Promise(r => setTimeout(r, 0));
  }
}

// ---- state: position per seed, wanted books, names ----
let libLang = 'en', libMode = null, libShown = 200, libWanted = [{ book: LIB_IDX.mending, min: 1, max: 64 }], libObs = null, libSearchMax = 100000;
try {
  const w = JSON.parse(localStorage.getItem('basescout.lib.want') || 'null');
  if (Array.isArray(w)) libWanted = w.filter(q => q && LIB_BOOKS[q.book]);
} catch {}
const libPosMap = () => { try { return JSON.parse(localStorage.getItem('basescout.lib.pos') || '{}') || {}; } catch { return {}; } };
function libGetPos(seed) { if (seed === null) return null; const v = libPosMap()[seed]; return Number.isInteger(v) ? v : null; }
function libSetPos(seed, pos) {
  if (seed === null) return;
  const m = libPosMap(); if (pos === null) delete m[seed]; else m[seed] = Math.max(0, pos | 0);
  try { localStorage.setItem('basescout.lib.pos', JSON.stringify(m)); } catch {}
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const libBookName = b => LIB_NAMES[LIB_BOOKS[b][0]][libLang === 'fr' ? 1 : 0];
function libName(c) {
  if (c === 0) return LIB_NAMES['item.minecraft.paper'][libLang === 'fr' ? 1 : 0];
  if (c === 1) return LIB_NAMES['block.minecraft.bookshelf'][libLang === 'fr' ? 1 : 0];
  const { book, level } = libBook(c);
  return libBookName(book) + (LIB_BOOKS[book][1] > 1 ? ' ' + ROMAN[level] : '');   // like the game: no "I" on one-level books
}
const libIsWanted = (c, p) => { const b = libBook(c); return !!b && libWanted.some(w => w.book === b.book && b.level >= w.min && p <= w.max); };
// real item textures (same mirror as the structure icons); the name shows if the picture can't load
const texImg = (path, alt) => `<img class="mci" src="${TEX_SOURCES[0]}${path}.png" alt="${escH(alt)}" title="${escH(alt)}" loading="lazy" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${TEX_SOURCES[1]}${path}.png'}else{this.replaceWith(document.createTextNode(this.alt))}">`;
const LIB_ITEM_TEX = { paper: 'item/paper', bookshelf: 'block/bookshelf', book: 'item/enchanted_book' };
const emerald = () => texImg('item/emerald', libLang === 'fr' ? 'émeraudes' : 'emeralds');
const libItemIcon = c => texImg(c === 0 ? LIB_ITEM_TEX.paper : c === 1 ? LIB_ITEM_TEX.bookshelf : LIB_ITEM_TEX.book, libName(c));
function libOffer(c, p, noPrice) {   // noPrice: the table shows prices in their own column
  const b = libBook(c), want = libIsWanted(c, p);
  return `<span class="offer${b ? ' book' : ''}${want ? ' want' : ''}">${libItemIcon(c)}${escH(libName(c))}${b && !noPrice ? ` <i>${emerald()}${p}</i>` : ''}</span>`;
}
const libRerolls = (i, pos) => i - pos + 1;   // the next roll is 1 reroll away

// ---- rendering ----
function renderLib() {
  const seed = parseSeed($('seed').value), okVer = inVer('lib');
  $('libVerNote').hidden = okVer;
  $('libVerNote').innerHTML = okVer ? '' : `Librarian trades can only be predicted from Java 26.1. The version picked at the top is ${escH(VER)}. <button type="button" id="libToNew" style="padding:3px 9px;font-size:12px;margin-left:4px">Use 26.3</button>`;
  if (!okVer) $('libToNew').onclick = () => setVersion('26.3');
  document.querySelectorAll('.liblang button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === libLang));
  const pos = libGetPos(seed);
  if (libMode !== 'locate') libMode = 'known';   // no roll number saved yet: start at 0, like a new world
  document.querySelectorAll('input[name=libmode]').forEach(r => r.checked = r.value === libMode);
  $('libPosIn').value = pos === null ? '' : pos;
  $('libLocate').hidden = libMode !== 'locate';
  if (libMode === 'locate' && !libObs) { libObs = [libEmptyObs(), libEmptyObs(), libEmptyObs()]; renderLibObs(); }
  renderLibWant();
  if (seed === null || !okVer) {
    $('libNext').innerHTML = `<p class="hint" style="margin:0">${seed === null ? 'Enter your world seed at the top.' : 'Pick Java 26.1 or newer at the top.'}</p>`;
    $('libCards').innerHTML = ''; $('libRows').innerHTML = ''; $('libMore').innerHTML = ''; return;
  }
  const L = libData(seed), from = pos === null ? 0 : pos, waiting = libMode === 'locate' && pos === null;
  libEnsure(L, from + Math.max(3000, libShown + 50));
  // your librarian: what he shows now, and what the next reroll will show
  const now = from > 0 ? `<div>Your librarian should be showing <b>roll ${from - 1}</b>:</div><div class="pair">${libOffer(L.s1[from - 1], L.p1[from - 1])}${libOffer(L.s2[from - 1], L.p2[from - 1])}</div>` : '';
  const nowWanted = from > 0 && (libIsWanted(L.s1[from - 1], L.p1[from - 1]) || libIsWanted(L.s2[from - 1], L.p2[from - 1]));
  $('libNext').innerHTML = waiting ? '<p class="hint" style="margin:0">Find your position first (above), so the list starts in the right place.</p>' :
    `<div class="libnow">${now}${nowWanted ? '<div class="good">That is a book you want: trade with him now to lock it in.</div>' : ''}
      <div>The next reroll (<b>roll ${from}</b>) should show:</div><div class="pair">${libOffer(L.s1[from], L.p1[from])}${libOffer(L.s2[from], L.p2[from])}</div>
      <div class="row2"><button type="button" class="go" id="libYes" style="min-width:0">I rerolled, that's what came out</button><button type="button" id="libNo">Something else came out</button>${from > 0 ? '<button type="button" id="libUndo" title="Go back one roll">Undo</button>' : ''}</div></div>`;
  if (!waiting) {
    $('libYes').onclick = () => { libSetPos(seed, from + 1); libMode = 'known'; renderLib(); };
    $('libNo').onclick = () => { libMode = 'locate'; libObs = null; renderLib(); toast('Enter the last few rolls you saw, and the site will find where you are.'); };
    if ($('libUndo')) $('libUndo').onclick = () => { libSetPos(seed, from - 1); renderLib(); };
  }
  // one card per wanted book: the nearest, and the cheapest in the next 300
  $('libCards').innerHTML = waiting ? '' : libWanted.map(w => {
    let first = null, cheap = null;
    for (let i = from; i < L.n; i++) for (const [c, p, slot] of [[L.s1[i], L.p1[i], 1], [L.s2[i], L.p2[i], 2]]) {
      const b = libBook(c); if (!b || b.book !== w.book || b.level < w.min || p > w.max) continue;
      if (!first) first = { i, p, slot, c };
      if (i < from + 300 && (!cheap || p < cheap.p)) cheap = { i, p, slot, c };
    }
    const title = `${libBookName(w.book)}${w.min > 1 ? ' ' + ROMAN[w.min] + '+' : ''}${w.max < 64 ? ` · ≤ ${w.max}` : ''}`;
    if (!first) return `<div class="libcard"><h3>${escH(title)}</h3><div class="d">Not in the next ${fmt(L.n - from)} rolls.</div></div>`;
    const n = libRerolls(first.i, from);
    return `<div class="libcard"><h3>${escH(title)}</h3><div class="n">${n} <small>reroll${n > 1 ? 's' : ''}</small></div>
      <div class="d">Roll ${first.i}: ${escH(libName(first.c))}, <span class="em">${emerald()}${first.p}</span> + a book, slot ${first.slot}</div>
      ${cheap && cheap.i !== first.i ? `<div class="d">Cheapest in the next 300: roll ${cheap.i} at <span class="em">${emerald()}${cheap.p}</span> (${libRerolls(cheap.i, from)} rerolls)</div>` : cheap ? '<div class="d">Also the cheapest in the next 300 rolls.</div>' : ''}</div>`;
  }).join('') || '<div class="libcard"><div class="d">Add a book you want on the left.</div></div>';
  // upcoming rolls
  const booksOnly = $('libBooks').checked, wantOnly = $('libOnlyWant').checked, booksLeft = $('libLeft').checked, rows = [];
  $('libTh1').textContent = booksLeft ? 'Book' : 'Slot 1'; $('libTh2').textContent = booksLeft ? 'Other' : 'Slot 2';
  if (!waiting) for (let i = from; i < L.n && rows.length < libShown; i++) {
    const a = L.s1[i], b = L.s2[i], want = libIsWanted(a, L.p1[i]) || libIsWanted(b, L.p2[i]);
    if (booksOnly && a < 2 && b < 2) continue;
    if (wantOnly && !want) continue;
    // "Books on the left": a book in slot 2 is shown in the first column, so the eye goes down one column;
    // the price (emeralds) sits between the two trades
    const flip = booksLeft && a < 2 && b >= 2, [c1, p1, c2, p2] = flip ? [b, L.p2[i], a, L.p1[i]] : [a, L.p1[i], b, L.p2[i]];
    const price = [c1 >= 2 ? p1 : null, c2 >= 2 ? p2 : null].filter(x => x !== null).join(' / ');
    rows.push(`<tr class="${want ? 'want' : ''}${i === from ? ' now' : ''}"><td class="num">${i}</td><td class="num">${libRerolls(i, from)}</td><td>${libOffer(c1, p1, 1)}</td>`
      + `<td class="num pr">${price ? `<span class="em">${emerald()}${price}</span>` : ''}</td><td>${libOffer(c2, p2, 1)}</td></tr>`);
  }
  $('libRows').innerHTML = rows.join('') || `<tr><td colspan="5" class="hint">${waiting ? 'Find your position first.' : 'Nothing like that in the rolls worked out so far.'}</td></tr>`;
  $('libMore').innerHTML = !waiting && rows.length >= libShown ? '<button type="button" id="libMoreB">Show 200 more</button>' : '';
  if ($('libMoreB')) $('libMoreB').onclick = () => { libShown += 200; renderLib(); };
}
function renderLibWant() {
  $('libWant').innerHTML = libWanted.map((w, k) => `<span class="chip">${escH(libBookName(w.book))}${w.min > 1 ? ' ' + ROMAN[w.min] + '+' : ''}${w.max < 64 ? ` · ≤ ${w.max}` : ''}<button type="button" data-k="${k}" aria-label="Remove">×</button></span>`).join('') || '<span class="hint">No books yet.</span>';
  $('libWant').querySelectorAll('button').forEach(b => b.onclick = () => { libWanted.splice(+b.dataset.k, 1); libSaveWant(); renderLib(); });
  const sel = $('libAddE'), keep = sel.value;
  sel.innerHTML = LIB_BOOKS.map((q, i) => [i, libBookName(i)]).sort((a, b) => a[1].localeCompare(b[1], libLang)).map(([i, n]) => `<option value="${i}">${escH(n)}</option>`).join('');
  sel.value = keep !== '' && LIB_BOOKS[keep] ? keep : String(LIB_IDX.mending);
  libFillLevels();
}
function libFillLevels() {
  const max = LIB_BOOKS[+$('libAddE').value][1];
  $('libAddL').innerHTML = Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i === 0 ? 'any level' : ROMAN[i + 1] + '+'}</option>`).join('');
  $('libAddL').disabled = max === 1;
}
function libSaveWant() { try { localStorage.setItem('basescout.lib.want', JSON.stringify(libWanted)); } catch {} }
$('libAddE').onchange = libFillLevels;
$('libAddB').onclick = () => {
  const book = +$('libAddE').value, min = +$('libAddL').value || 1, max = Math.min(64, Math.max(1, +$('libAddP').value || 64));
  const i = libWanted.findIndex(w => w.book === book);
  if (i >= 0) libWanted[i] = { book, min, max }; else libWanted.push({ book, min, max });
  $('libAddP').value = ''; libSaveWant(); renderLib();
};
document.querySelectorAll('input[name=libmode]').forEach(r => r.onchange = () => {
  const seed = parseSeed($('seed').value);
  libMode = r.value;
  if (libMode === 'known' && libGetPos(seed) === null) libSetPos(seed, 0);
  if (libMode === 'locate') libObs = null;
  renderLib();
});
$('libPosIn').onchange = () => { const seed = parseSeed($('seed').value), v = Math.floor(+$('libPosIn').value); if (v >= 0) { libSetPos(seed, v); libMode = 'known'; renderLib(); } };
$('libBooks').onchange = () => { libShown = 200; renderLib(); };
$('libOnlyWant').onchange = () => { libShown = 200; renderLib(); };
$('libLeft').checked = true;   // on unless turned off
try { if (localStorage.getItem('basescout.lib.left') === '0') $('libLeft').checked = false; } catch {}
$('libLeft').onchange = () => { try { localStorage.setItem('basescout.lib.left', $('libLeft').checked ? '1' : '0'); } catch {} renderLib(); };

// ---- finding the position from what you see ----
const libEmptyObs = () => [{ t: '', book: LIB_IDX.mending, level: 1, price: '' }, { t: '', book: LIB_IDX.mending, level: 1, price: '' }];
function renderLibObs() {
  if (!libObs) return;
  const books = LIB_BOOKS.map((q, i) => [i, libBookName(i)]).sort((a, b) => a[1].localeCompare(b[1], libLang));
  $('libObs').innerHTML = libObs.map((o, r) => `<div class="obsrow"><div class="oh">Roll ${r + 1}${r === libObs.length - 1 ? ' (the latest)' : ''}${libObs.length > 1 ? `<button type="button" data-del="${r}" aria-label="Remove this roll">×</button>` : ''}</div>
    ${o.map((sl, k) => `<div class="oslot"><span class="on">${k + 1}</span>
      <span class="oitems" role="group" aria-label="Slot ${k + 1}">${[['paper', libName(0)], ['bookshelf', libName(1)], ['book', libLang === 'fr' ? 'Livre enchanté' : 'Enchanted book']].map(([t, n]) =>
        `<button type="button" class="oitem" data-r="${r}" data-k="${k}" data-t="${t}" aria-pressed="${sl.t === t}" title="${escH(n)}">${texImg(LIB_ITEM_TEX[t], n)}</button>`).join('')}</span>
      ${sl.t === 'book' ? `<select data-r="${r}" data-k="${k}" data-f="book" aria-label="Book">${books.map(([i, n]) => `<option value="${i}"${i === sl.book ? ' selected' : ''}>${escH(n)}</option>`).join('')}</select>
      <select data-r="${r}" data-k="${k}" data-f="level" aria-label="Level"${LIB_BOOKS[sl.book][1] === 1 ? ' disabled' : ''}>${Array.from({ length: LIB_BOOKS[sl.book][1] }, (_, i) => `<option value="${i + 1}"${i + 1 === sl.level ? ' selected' : ''}>${ROMAN[i + 1]}</option>`).join('')}</select>
      <label class="oprice" title="Price in emeralds (optional)">${emerald()}<input type="number" min="1" max="64" value="${escH(sl.price)}" data-r="${r}" data-k="${k}" data-f="price" aria-label="Price in emeralds, optional"></label>` : '<span></span><span></span><span></span>'}</div>`).join('')}</div>`).join('');
  $('libObs').querySelectorAll('[data-f]').forEach(el => el.onchange = () => {
    const sl = libObs[+el.dataset.r][+el.dataset.k], f = el.dataset.f;
    sl[f] = f === 'book' || f === 'level' ? +el.value : el.value;
    if (f === 'book') sl.level = Math.min(sl.level, LIB_BOOKS[sl.book][1]);
    if (f !== 'price') renderLibObs();
  });
  $('libObs').querySelectorAll('.oitem').forEach(b => b.onclick = () => {   // click again to clear
    const sl = libObs[+b.dataset.r][+b.dataset.k]; sl.t = sl.t === b.dataset.t ? '' : b.dataset.t; renderLibObs();
  });
  $('libObs').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { libObs.splice(+b.dataset.del, 1); renderLibObs(); });
}
$('libObsAdd').onclick = () => { libObs.push(libEmptyObs()); renderLibObs(); };
let libBusy = false;
$('libObsGo').onclick = () => libLocate(false);
async function libLocate(further) {
  const seed = parseSeed($('seed').value);
  if (seed === null) { toast('Enter your world seed at the top first.'); return; }
  if (libBusy) return;
  const obs = libObs.map(o => o.map(sl => ({ c: sl.t === 'paper' ? 0 : sl.t === 'bookshelf' ? 1 : sl.t === 'book' ? libCode(sl.book, sl.level) : -1, p: +sl.price || 0 })));
  if (obs.some(o => o.some(sl => sl.c < 0))) { toast('Fill in both slots of every roll, or remove the empty ones.'); return; }
  if (further) libSearchMax = Math.min(2000000, libSearchMax * 10);
  const K = obs.length, L = libData(seed), box = $('libLocRes');
  libBusy = true;
  box.innerHTML = '<div class="libres">Working out the rolls… <span id="libProg">0%</span></div>';
  await libEnsureAsync(L, libSearchMax + K, f => { const e = $('libProg'); if (e) e.textContent = Math.round(f * 100) + '%'; });
  libBusy = false;
  const hits = [];
  for (let i = 0; i <= libSearchMax; i++) {
    let k = 0;
    for (; k < K; k++) if (L.s1[i + k] !== obs[k][0].c || L.s2[i + k] !== obs[k][1].c) break;
    if (k === K) { hits.push(i); if (hits.length > 200) break; }
  }
  // prices only break ties: a match whose base prices all agree with the ones typed in wins
  const priceOK = i => obs.every((o, k) => (!o[0].p || o[0].p === L.p1[i + k]) && (!o[1].p || o[1].p === L.p2[i + k]));
  const typedPrices = obs.some(o => o[0].p || o[1].p), byPrice = typedPrices ? hits.filter(priceOK) : [];
  const pick = hits.length === 1 ? hits[0] : byPrice.length === 1 ? byPrice[0] : null;
  if (pick !== null) {
    libSetPos(seed, pick + K); libMode = 'known'; libObs = null;
    box.innerHTML = ''; renderLib();
    toast(`Found you: your rolls were ${pick} to ${pick + K - 1}. The next one is roll ${pick + K}.${hits.length > 1 ? ' (picked using the prices)' : ''}`);
    return;
  }
  if (!hits.length) {
    box.innerHTML = `<div class="libres bad"><b>No match in the first ${fmt(libSearchMax)} rolls.</b><ul>
      <li>Is the seed right? Type /seed in game.</li><li>Is the version at the top 26.1 or newer, with Trade Rebalance off?</li>
      <li>Slot 1 is the top trade, slot 2 the one under it.</li><li>Are the book levels right?</li>
      <li>Were the rolls one after the other, with none skipped? Another player's librarian in between counts too.</li></ul>
      ${libSearchMax < 2000000 ? '<button type="button" id="libFurther">Search further</button>' : ''}</div>`;
    if ($('libFurther')) $('libFurther').onclick = () => libLocate(true);
    return;
  }
  const list = (byPrice.length ? byPrice : hits).slice(0, 8);
  box.innerHTML = `<div class="libres"><b>${hits.length > 200 ? 'More than 200' : hits.length} places match.</b> Reroll once more and add what you get, or pick the one whose next roll matches:
    ${list.map(i => `<div class="cand"><span>After roll ${i + K - 1}, next: ${libOffer(L.s1[i + K], L.p1[i + K])} ${libOffer(L.s2[i + K], L.p2[i + K])}</span><button type="button" data-use="${i}">Use</button></div>`).join('')}</div>`;
  box.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { libSetPos(seed, +b.dataset.use + K); libMode = 'known'; libObs = null; box.innerHTML = ''; renderLib(); });
}

