import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ui import UI
G=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'game.json')))
for k,v in UI.items(): assert len(v)==7, k
js = r'''// ---------- interface language ----------
// Every English text on the page (and in the tooltips) is swapped for the chosen language as it appears: the code
// keeps writing English, and this layer translates text nodes and title / placeholder / aria-label attributes.
// Game names (biomes, enchantments, items) come from the game's own language files; the rest is the site's text.
const LANGS = [['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano'], ['pt', 'Português'], ['pl', 'Polski'], ['nl', 'Nederlands']];
const LI = { fr: 0, es: 1, de: 2, it: 3, pt: 4, pl: 5, nl: 6 };
const I18N_UI = __UI__;
const I18N_GAME = __GAME__;   // lowercase English game name -> official names
const W = (...a) => a;   // [fr, es, de, it, pt, pl, nl]
const WORDS = {
  here: W('ici', 'aquí', 'hier', 'qui', 'aqui', 'tutaj', 'hier'),
  latest: W('le plus récent', 'la más reciente', 'der neueste', 'il più recente', 'a mais recente', 'najnowsze', 'de nieuwste'),
  near: W('près de', 'cerca de', 'nahe', 'vicino a', 'perto de', 'blisko', 'bij'),
  at: W('à', 'en', 'bei', 'a', 'em', 'w', 'bij'),
  spawn: W('spawn', 'aparición', 'Spawn', 'spawn', 'spawn', 'spawn', 'spawn'),
  want: W('voulu', 'quiero', 'Ziel', 'voluto', 'desejado', 'chcę', 'gewenst'),
  oneIn: W('1 sur', '1 de cada', '1 von', '1 su', '1 em', '1 na', '1 op'),
  structs: W('structure(s)', 'estructura(s)', 'Bauwerk(e)', 'struttura/e', 'estrutura(s)', 'struktur(y)', 'bouwwerk(en)'),
  bspots: W('repère(s) de biome', 'punto(s) de bioma', 'Biom-Punkt(e)', 'punto/i bioma', 'ponto(s) de bioma', 'punkt(y) biomu', 'bioompunt(en)'),
  unique: W('(3 à 5 donnent une seule réponse)', '(3–5 dan una sola respuesta)', '(3–5 ergeben eine eindeutige Antwort)', '(3–5 danno una sola risposta)', '(3–5 dão uma só resposta)', '(3–5 dają jedną odpowiedź)', '(3–5 geven één antwoord)'),
  ready: W('prêt, environ', 'listo, unos', 'bereit, etwa', 'pronto, circa', 'pronto, cerca de', 'gotowe, ok.', 'klaar, ongeveer'),
  loose: W('trop large(s)', 'demasiado amplia(s)', 'zu ungenau', 'troppo larga/e', 'muito solta(s)', 'zbyt luźne', 'te ruim'),
  tapRemove: W('touche pour retirer', 'toca para quitar', 'tippen zum Entfernen', 'tocca per togliere', 'toque para remover', 'dotknij, by usunąć', 'tik om te verwijderen'),
  placed: W('placé, glisse pour déplacer', 'colocado, arrastra para mover', 'platziert, zum Verschieben ziehen', 'piazzato, trascina per spostare', 'colocado, arraste para mover', 'umieszczone, przeciągnij, by przesunąć', 'geplaatst, sleep om te verplaatsen'),
  long: W('longue', 'larga', 'lang', 'lunga', 'longa', 'długa', 'lang'),
  showMore: W('Afficher {n} de plus', 'Mostrar {n} más', '{n} weitere zeigen', 'Mostra altri {n}', 'Mostrar mais {n}', 'Pokaż {n} więcej', '{n} meer tonen'),
  ring: W('Cercle {n} : blocs de large', 'Anillo {n}: bloques de ancho', 'Ring {n}: Blöcke breit', 'Anello {n}: blocchi di larghezza', 'Anel {n}: blocos de largura', 'Pierścień {n}: bloków szerokości', 'Ring {n}: blokken breed'),
  fromZero: W('à {n} de 0, 0', 'a {n} de 0, 0', '{n} von 0, 0', 'a {n} da 0, 0', 'a {n} de 0, 0', '{n} od 0, 0', '{n} van 0, 0'),
  patch: W('Taille minimale de la zone de {b}', 'Tamaño mínimo de la zona de {b}', 'Wie groß das Gebiet {b} sein muss', 'Dimensione minima della zona di {b}', 'Tamanho mínimo da área de {b}', 'Jak duży musi być obszar: {b}', 'Hoe groot het gebied {b} moet zijn'),
};
let uiLang = 'en';
try { uiLang = localStorage.getItem('basescout.lang') || ''; } catch {}
if (!LANGS.some(l => l[0] === uiLang)) { const n = (navigator.language || 'en').slice(0, 2); uiLang = LANGS.some(l => l[0] === n) ? n : 'en'; }
const keepCase = (src, t) => src === src.toLowerCase() && uiLang !== 'de' ? t.toLowerCase() : t;
function tr(s) {
  if (uiLang === 'en' || !s) return s;
  const i = LI[uiLang], u = I18N_UI[s];
  if (u) return u[i];
  const g = I18N_GAME[s.toLowerCase()];
  if (g) return keepCase(s, g[i]);
  let m;
  const w = k => WORDS[k][i];
  if ((m = s.match(/^([\d,.]+) across$/))) return `${m[1]} ${I18N_UI.across[i]}`;
  if ((m = s.match(/^([\d,.]+) here$/))) return `${m[1]} ${w('here')}`;
  if ((m = s.match(/^Roll (\d+)( \(the latest\))?$/))) return `${I18N_UI.Roll[i]} ${m[1]}${m[2] ? ` (${w('latest')})` : ''}`;
  if ((m = s.match(/^roll (\d+)$/))) return `${I18N_UI.Roll[i].toLowerCase()} ${m[1]}`;
  if ((m = s.match(/^Roll (\d+): (.+),$/))) return `${I18N_UI.Roll[i]} ${m[1]} : ${tr(m[2])},`;
  if ((m = s.match(/^Show ([\d,]+) more$/))) return w('showMore').replace('{n}', m[1]);
  if ((m = s.match(/^Ring (\d): blocks across$/))) return w('ring').replace('{n}', m[1]);
  if ((m = s.match(/^(.+): tap to remove$/))) return `${tr(m[1])} : ${w('tapRemove')}`;
  if ((m = s.match(/^(.+) \(placed, drag to move\)$/))) return `${tr(m[1])} (${w('placed')})`;
  if ((m = s.match(/^How big the (.+) patch has to be$/))) return w('patch').replace('{b}', tr(m[1]));
  if ((m = s.match(/^(.+) · ([\d,.]+) from 0, 0$/))) return `${tr(m[1])} · ${w('fromZero').replace('{n}', m[2])}`;
  if ((m = s.match(/^(near|at|spawn) (-?[\d,]+, -?[\d,]+) · (.+)$/))) return `${w(m[1])} ${m[2]} · ${tr(m[3])}`;
  if ((m = s.match(/^([\d,.]+) · want ≤ ([\d,.]+)$/))) return `${m[1]} · ${w('want')} ≤ ${m[2]}`;
  if ((m = s.match(/^· 1 in (.+)$/))) return `· ${w('oneIn')} ${m[1]}`;
  if ((m = s.match(/^(Overworld|Nether) (-?\d+ ~ -?\d+)$/))) return `${tr(m[1])} ${m[2]}`;
  if ((m = s.match(/^(\d+) structures? · (\d+) biome spots?( \(3–5 make the answer unique\))?( · ready, about (.+))?$/)))
    return `${m[1]} ${w('structs')} · ${m[2]} ${w('bspots')}${m[3] ? ' ' + w('unique') : ''}${m[4] ? ` · ${w('ready')} ${m[5]}` : ''}`;
  if ((m = s.match(/^(\d+) structures? (?:is|are) too loose$/))) return `${m[1]} ${w('structs')} ${w('loose')}`;
  if ((m = s.match(/^(.+) ([IVX]+)$/)) && I18N_GAME[m[1].toLowerCase()]) return `${tr(m[1])} ${m[2]}`;
  if ((m = s.match(/^(.+) \(long\)$/)) && I18N_GAME[m[1].toLowerCase()]) return `${tr(m[1])} (${w('long')})`;
  return s;
}
// text nodes and attributes keep their English original, so switching language (or back) always starts from it
const I18N_ORIG = new WeakMap(), I18N_ATTRS = ['title', 'placeholder', 'aria-label'];
function trNode(n) {
  const v = n.nodeValue, rec = I18N_ORIG.get(n);
  const en = rec && v === rec[1] ? rec[0] : v;
  const core = en.trim();
  if (!core || !/[A-Za-z]{2}/.test(core)) { I18N_ORIG.set(n, [en, v]); return; }
  const out = uiLang === 'en' ? en : en.replace(core, tr(core.replace(/\s+/g, ' ')));
  I18N_ORIG.set(n, [en, out]);
  if (v !== out) n.nodeValue = out;
}
function trAttrs(el) {
  let rec = I18N_ORIG.get(el); if (!rec) { rec = {}; I18N_ORIG.set(el, rec); }
  for (const a of I18N_ATTRS) {
    const v = el.getAttribute(a); if (v == null) continue;
    const en = rec[a] && v === rec[a][1] ? rec[a][0] : v, out = uiLang === 'en' ? en : tr(en.trim());
    rec[a] = [en, out]; if (v !== out) el.setAttribute(a, out);
  }
}
const skipI18n = el => !el || el.closest('script,style,#lang,[data-noi18n],.saved .sn');
function trTree(root) {
  if (root.nodeType === 3) { if (!skipI18n(root.parentElement)) trNode(root); return; }
  if (root.nodeType !== 1 || skipI18n(root)) return;
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: e => e.nodeType === 1 && skipI18n(e) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n; while ((n = w.nextNode())) { if (n.nodeType === 3) trNode(n); else trAttrs(n); }
}
new MutationObserver(list => {
  for (const r of list) {
    if (r.type === 'characterData') { if (!skipI18n(r.target.parentElement)) trNode(r.target); }
    else if (r.type === 'attributes') { if (!skipI18n(r.target)) trAttrs(r.target); }
    else r.addedNodes.forEach(trTree);
  }
}).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
function setUiLang(l) {
  uiLang = l; try { localStorage.setItem('basescout.lang', l); } catch {}
  document.documentElement.lang = l; $('lang').value = l;
  trTree(document.body);
}
$('lang').innerHTML = LANGS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
$('lang').onchange = () => setUiLang($('lang').value);
// the Librarian keeps its own book names in English: this layer translates them with the game's names
libLang = 'en';
setUiLang(uiLang);
'''
js = js.replace('__UI__', json.dumps(UI, ensure_ascii=False, separators=(',',':'))).replace('__GAME__', json.dumps(G, ensure_ascii=False, separators=(',',':')))
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', '11-i18n.js'),'w').write(js)
print(len(js))
