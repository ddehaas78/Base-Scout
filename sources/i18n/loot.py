#!/usr/bin/env python3
"""Build js/06a-lootdata.js: chest loot tables for the structure plans of the Seed map.

    python3 i18n/loot.py <mcmeta data/minecraft folder> <lang folder with en_us.json> <older tables folder>

<mcmeta data/minecraft> is misode/mcmeta, branch "data" (loot_table/chests and tags/enchantment, for 26.x).
<older tables folder> holds the tables of earlier versions (desert_pyramid.1_21_9.json and so on), as kept by
xpple/cubiomes in loot/loot_tables/chests (MIT). Also writes i18n/loot_keys.json (names to translate, for game.py).
"""
import json, os, sys

DATA, LANG, OLD = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
EN = json.load(open(os.path.join(LANG, 'en_us.json')))
TEX = set(open('/tmp/texlist.txt').read().split()) if os.path.exists('/tmp/texlist.txt') else set()
bare = lambda s: s.split(':')[-1]
L = lambda x: x if isinstance(x, list) else [x]

# which table each version uses: [first site version, file]; the newest comes from mcmeta
# (only versions whose table is known for sure; earlier ones show "contents from Java ...")
TABLES = {
    'chests/desert_pyramid': [['1.21.6', 'desert_pyramid.1_21_6.json'], ['1.21.9', 'desert_pyramid.1_21_9.json'], ['1.21.11', None]],
    'chests/buried_treasure': [['1.21.6', 'buried_treasure.1_18.json'], ['1.21.11', None]],
    'chests/pillager_outpost': [['1.21.11', None]],
    'chests/end_city_treasure': [['1.21.9', 'end_city_treasure.1_21_9.json'], ['1.21.11', None]],
    'chests/bastion_other': [['1.21.6', 'bastion_other.1_21_1.json'], ['1.21.9', 'bastion_other.1_21_9.json'], ['1.21.11', None]],
    'chests/bastion_bridge': [['1.21.11', None]],
    'chests/abandoned_mineshaft': [['1.21.6', 'abandoned_mineshaft.1_21_1.json'], ['26.2', None]],
    'chests/stronghold_corridor': [['1.21.6', 'stronghold_corridor.1_21_6.json'], ['1.21.9', 'stronghold_corridor.1_21_9.json'], ['1.21.11', None]],
    'chests/stronghold_library': [['1.21.6', 'stronghold_library.1_21_1.json'], ['1.21.11', None]],
    'chests/stronghold_crossing': [['1.21.11', None]],
}
keys = set()

def tag(kind, name):
    out = []
    for v in json.load(open(os.path.join(DATA, 'tags', kind, *(bare(name) + '.json').split('/'))))['values']:
        v = v if isinstance(v, str) else v['id']
        for x in (tag(kind, v[1:]) if v.startswith('#') else [v]):
            if x not in out: out.append(x)
    return out

ITEMS, IIDX = [], {}
SPECIAL_TEX = {'enchanted_golden_apple': 'item/golden_apple', 'copper_horse_armor': 'item/iron_horse_armor', 'book': 'item/book',
               'tnt': 'block/tnt_side', 'crossbow': 'item/crossbow_standby', 'ancient_debris': 'block/ancient_debris_side',
               'bone_block': 'block/bone_block_side', 'lodestone': 'block/lodestone_side', 'compass': 'item/compass_00', 'iron_chain': 'item/chain',
               # items newer than the 1.21.4 textures: the closest older picture (the name stays right)
               'iron_spear': 'item/iron_sword', 'diamond_spear': 'item/diamond_sword', 'copper_nautilus_armor': 'item/iron_horse_armor',
               'iron_nautilus_armor': 'item/iron_horse_armor', 'golden_nautilus_armor': 'item/golden_horse_armor', 'diamond_nautilus_armor': 'item/diamond_horse_armor'}
def item(i):
    i = bare(i)
    if i not in IIDX:
        trim = 'trim_pattern.minecraft.' + i.replace('_armor_trim_smithing_template', '')   # "Dune Armor Trim", not just "Smithing Template"
        name = EN[trim] if i.endswith('_armor_trim_smithing_template') and trim in EN and not keys.add(trim) else \
            next((EN[k] for k in ('item.minecraft.' + i, 'block.minecraft.' + i) if k in EN and not keys.add(k)), i.replace('_', ' ').title())
        tex = SPECIAL_TEX.get(i) or next((p for p in ('item/' + i, 'block/' + i) if not TEX or p + '.png' in TEX), 'item/barrier')
        IIDX[i] = len(ITEMS); ITEMS.append([i, name, tex])
    return IIDX[i]

# enchantments picked by enchant_randomly: the tag's members in tag order (1.21.11 added Lunge)
ENCH = []
def ench_list(spec, lunge):   # spec: '#tag', one enchantment id, or a list of ids
    out = []
    names = [x for s in L(spec) for x in (tag('enchantment', s[1:]) if s.startswith('#') else [s])]
    for e in names:
        e = bare(e)
        if e == 'lunge' and not lunge: continue
        d = json.load(open(os.path.join(DATA, 'enchantment', e + '.json')))
        k = 'enchantment.minecraft.' + e; keys.add(k)
        if e not in [x[0] for x in ENCH]:
            ENCH.append([e, EN[k], d['max_level'], d['min_cost']['base'], d['min_cost']['per_level_above_first'],
                         d['max_cost']['base'], d['max_cost']['per_level_above_first'], d['weight']])
        out.append([x[0] for x in ENCH].index(e))
    return out
LISTS = {}
ENCHANTABILITY = {'book': 1, 'bow': 1, 'crossbow': 1, 'fishing_rod': 1, 'trident': 1}
for mat, v in (('leather', 15), ('chainmail', 12), ('iron', 9), ('golden', 25), ('diamond', 10), ('netherite', 15)):
    for part in ('helmet', 'chestplate', 'leggings', 'boots'): ENCHANTABILITY[mat + '_' + part] = v
for mat, v in (('wooden', 15), ('stone', 5), ('iron', 14), ('golden', 22), ('diamond', 10), ('netherite', 15)):
    for part in ('sword', 'axe', 'pickaxe', 'shovel', 'hoe', 'spear'): ENCHANTABILITY[mat + '_' + part] = v   # spears: 1.21.11
FOR = {}   # enchanting an item from a list: its enchantability, the possible enchantments, and pairs that exclude each other
def holders(kind, v):
    if isinstance(v, list): return [x for y in v for x in holders(kind, y)]
    return tag(kind, v[1:]) if v.startswith('#') else [v]

def for_item(listkey, it):
    k = listkey + '|' + it
    if k in FOR: return k
    names = [ENCH[i][0] for i in LISTS[listkey]]
    defs = {e: json.load(open(os.path.join(DATA, 'enchantment', e + '.json'))) for e in names}
    items_of = lambda v: set(bare(x) for x in holders('item', v))
    ok = lambda e: it == 'book' or it in items_of(defs[e].get('primary_items', defs[e]['supported_items']))
    cand = [i for i in LISTS[listkey] if ok(ENCH[i][0])]
    excl = lambda e: set(bare(x) for x in holders('enchantment', defs[e]['exclusive_set'])) if defs[e].get('exclusive_set') else set()
    bad = [[a, b] for a in cand for b in cand if a < b and (ENCH[b][0] in excl(ENCH[a][0]) or ENCH[a][0] in excl(ENCH[b][0]))]
    FOR[k] = {'e': ENCHANTABILITY[it], 'c': cand, 'x': bad}
    return k
def number(n):   # [min, max] of a number provider (constant or uniform)
    if isinstance(n, (int, float)): return [int(n), int(n)]
    t = bare(n.get('type', 'uniform'))
    assert t in ('uniform', 'constant'), n
    return [int(n['value']), int(n['value'])] if t == 'constant' else [int(n['min']), int(n['max'])]
cur_item = ['']
def fns(e, lunge):
    if 'name' in e: cur_item[0] = bare(e['name'])
    out = []
    raw = L(e.get('functions', [])) + L(e.get('modifier', []))
    for f in raw:
        t = bare(f.get('function') or f.get('type'))
        if t == 'sequence': raw += L(f['functions']); continue
        if t == 'set_count': out.append(['c'] + number(f['count']))
        elif t == 'enchant_randomly':
            opt = f.get('options'); assert opt, f
            key = ','.join(L(opt)) + ('+lunge' if lunge else '')
            if key not in LISTS: LISTS[key] = ench_list(opt, lunge)
            it = cur_item[0]
            if it != 'book' and f.get('only_compatible', True):   # gear: only what can go on it (its supported items)
                k2 = key + '|' + it
                if k2 not in LISTS:
                    sup = lambda e: it in set(bare(x) for x in holders('item', json.load(open(os.path.join(DATA, 'enchantment', e + '.json')))['supported_items']))
                    LISTS[k2] = [i for i in LISTS[key] if sup(ENCH[i][0])]
                key = k2
            out.append(['er', key])
        elif t == 'set_damage': out.append(['f'])   # one random number, the item's wear (not shown)
        elif t == 'set_instrument':
            horns = [bare(x) for x in tag('instrument', f['options'][1:])]
            for h in horns: keys.add('instrument.minecraft.' + h)
            out.append(['h', [EN.get('instrument.minecraft.' + h, h) for h in horns]])
        elif t == 'set_potion':
            k = 'item.minecraft.potion.effect.' + bare(f['id']); keys.add(k); out.append(['p', EN.get(k, bare(f['id']))])
        elif t == 'enchant_with_levels':
            opt = f.get('options'); assert opt, f
            key = ','.join(L(opt)) + ('+lunge' if lunge else '')
            if key not in LISTS: LISTS[key] = ench_list(opt, lunge)
            out.append(['el', for_item(key, cur_item[0])] + number(f['levels']))
        elif t in ('set_name', 'set_lore', 'set_components', 'exploration_map'): pass
        else: raise SystemExit('loot function not handled yet: ' + t)
    return out
def table(path, lunge):
    d = json.load(open(path)); pools = []
    for p in d['pools']:
        assert not p.get('conditions') and not p.get('condition'), path
        ents = []
        for e in p['entries']:
            t = bare(e['type'])
            assert t in ('item', 'empty'), (path, e)
            conds = L(e.get('conditions', [])) + L(e.get('condition', []))
            # location_check: only in some biomes (e.g. a disc in sulfur caves); taken as not there, like xpple/cubiomes
            if any(bare(c['condition'] if 'condition' in c else c['type']) == 'location_check' for c in conds): continue
            assert not conds, (path, e)
            ents.append([item(e['name']) if t == 'item' else -1, e.get('weight', 1), fns(e, lunge)])
        pf = []
        if p.get('functions') or p.get('modifier'):   # functions for every item of the pool, after the item's own
            cur_item[0] = bare(p['entries'][0].get('name', '')); pf = fns(p, lunge)
        pools.append([number(p['rolls']), ents] + ([pf] if pf else []))
    return pools

OUT = {}
for name, vers in TABLES.items():
    OUT[name] = []
    if vers[0][0] == '1.21.11' and vers[0][1] is None:   # no older copy: the same table, before Lunge existed (no spears in these)
        t = table(os.path.join(DATA, 'loot_table', name + '.json'), lunge=False)
        assert 'spear' not in json.dumps([ITEMS[e[0]] for pl in t for e in pl[1] if e[0] >= 0]), name
        OUT[name].append(['1.21.6', t])
    if name == 'chests/end_city_treasure':   # 1.21.6 to 1.21.8: the 1.21.9 table without copper horse armor (copper came in 1.21.9)
        t = table(os.path.join(OLD, 'end_city_treasure.1_21_9.json'), lunge=False)
        for pl in t: pl[1] = [e for e in pl[1] if e[0] < 0 or ITEMS[e[0]][0] != 'copper_horse_armor']
        OUT[name].append(['1.21.6', t])
    for first, f in vers:
        path = os.path.join(OLD, f) if f else os.path.join(DATA, 'loot_table', name + '.json')
        OUT[name].append([first, table(path, lunge=f is None)])   # Lunge exists from 1.21.11

js = ['// ---------- chest loot tables for the structure plans (generated by i18n/loot.py; do not edit) ----------',
      '// LOOT_TABLES[name] = [[first version, pools]], a pool = [[min rolls, max rolls], entries], an entry = [item (-1 empty), weight, functions]',
      '// a pool may have a third part: functions for every item of the pool',
      '// functions: ["c", min, max] set count | ["er", list] enchant randomly from LOOT_LISTS[list] | ["el", LOOT_FOR key, min, max] enchant with levels',
      '//   | ["f"] wear (one random number) | ["h", names] goat horn sound | ["p", name] potion',
      'const LOOT_ITEMS = ' + json.dumps(ITEMS, ensure_ascii=False, separators=(',', ':')) + ';   // [id, name, texture]',
      'const LOOT_ENCH = ' + json.dumps(ENCH, ensure_ascii=False, separators=(',', ':')) + ';   // [id, name, max level, min cost base, +per level, max cost base, +per level, weight]',
      'const LOOT_LISTS = ' + json.dumps(LISTS, separators=(',', ':')) + ';',
      'const LOOT_FOR = ' + json.dumps(FOR, separators=(',', ':')) + ';   // "list|item": { e: enchantability, c: possible, x: pairs that exclude each other }',
      'const LOOT_TABLES = ' + json.dumps(OUT, separators=(',', ':')) + ';', '']
open(os.path.join(HERE, '..', 'js', '06a-lootdata.js'), 'w', encoding='utf-8').write('\n'.join(js))
json.dump(sorted(keys), open(os.path.join(HERE, 'loot_keys.json'), 'w'), indent=0)
print(len(ITEMS), 'items,', len(ENCH), 'enchantments,', {k: len(v) for k, v in LISTS.items()})
