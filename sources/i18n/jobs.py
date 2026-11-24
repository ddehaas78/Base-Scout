#!/usr/bin/env python3
"""Build js/09a-jobdata.js: every villager job's trades (26.x data), for the level-up panel of the Librarian tab.

    python3 i18n/jobs.py <mcmeta data/minecraft folder> <lang folder with en_us.json>

The data folder is misode/mcmeta, branch "data" (data/minecraft: trade_set, villager_trade, tags, enchantment).
Also writes i18n/job_keys.json: the game's language keys of every name used, for game.py (translations).
"""
import hashlib, json, os, sys

DATA, LANG = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
EN = json.load(open(os.path.join(LANG, 'en_us.json')))
TEX = set(open('/tmp/texlist.txt').read().split()) if os.path.exists('/tmp/texlist.txt') else set()
J = lambda *p: json.load(open(os.path.join(DATA, *p)))
L = lambda x: x if isinstance(x, list) else [x]
bare = lambda s: s.split(':')[-1]

# jobs in order of use (most used first)
JOBS = ['librarian', 'farmer', 'cleric', 'armorer', 'toolsmith', 'weaponsmith', 'fletcher', 'cartographer',
        'fisherman', 'mason', 'shepherd', 'butcher', 'leatherworker']
# how well items take enchantments (the "enchantable" value of the item)
ENCHANTABILITY = {'diamond_helmet': 10, 'diamond_chestplate': 10, 'diamond_leggings': 10, 'diamond_boots': 10,
                  'diamond_axe': 10, 'diamond_shovel': 10, 'diamond_pickaxe': 10, 'diamond_sword': 10,
                  'iron_axe': 14, 'iron_shovel': 14, 'iron_pickaxe': 14, 'iron_sword': 14,
                  'bow': 1, 'crossbow': 1, 'fishing_rod': 1}
DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan',
        'purple', 'blue', 'brown', 'green', 'red', 'black']   # DyeColor order (ids 0-15)

def tag(kind, name):
    out = []
    for v in J('tags', kind, *(bare(name) + '.json').split('/'))['values']:
        v = v if isinstance(v, str) else v['id']
        for x in (tag(kind, v[1:]) if v.startswith('#') else [v]):
            if x not in out: out.append(x)
    return out
def holders(kind, v):   # an id, a list of ids or a #tag
    if isinstance(v, list): return [x for y in v for x in holders(kind, y)]
    return tag(kind, v[1:]) if v.startswith('#') else [v]

keys = set()
def name_of(item):
    i = bare(item)
    for k in ('item.minecraft.' + i, 'block.minecraft.' + i):
        if k in EN: keys.add(k); return EN[k]
    return i.replace('_', ' ').title()
def tex_of(item):
    i = bare(item)
    SPECIAL = {'clock': 'item/clock_00', 'compass': 'item/compass_00', 'crossbow': 'item/crossbow_standby', 'tipped_arrow': 'item/arrow',
               'shield': 'entity/shield_base_nopattern', 'map': 'item/map'}
    if i in SPECIAL: return SPECIAL[i]
    if i.endswith('_map'): return 'item/filled_map'
    if i.endswith('_banner_pattern'): return 'item/globe_banner_pattern' if 'item/globe_banner_pattern.png' in TEX else 'item/flower_banner_pattern'
    for p in ('item/' + i, 'block/' + i, 'block/' + i + '_front', 'block/' + i + '_side', 'block/' + i + '_top'):
        if not TEX or p + '.png' in TEX: return p
    if i.endswith('_bed'): return 'item/' + i if 'item/' + i + '.png' in TEX else 'block/' + i.replace('_bed', '_wool')
    if i.endswith('_banner'): return 'block/' + i.replace('_banner', '_wool')
    if i.endswith('_carpet'): return 'block/' + i.replace('_carpet', '_wool')
    if i == 'bell': return 'item/bell'
    if i == 'shield': return 'item/shield' if 'item/shield.png' in TEX else 'block/oak_planks'
    return 'item/barrier'

ITEMS, IIDX = [], {}
def item(i):
    i = bare(i)
    if i not in IIDX: IIDX[i] = len(ITEMS); ITEMS.append([i, name_of(i), tex_of(i)])
    return IIDX[i]

# enchanting: every non-treasure enchantment that traded equipment can get, in tag order
ENCH_KEYS = [bare(e) for e in tag('enchantment', 'on_traded_equipment')]
ENCH = {}
for e in ENCH_KEYS:
    d = J('enchantment', e + '.json'); keys.add('enchantment.minecraft.' + e)
    ENCH[e] = d
ENCH_ROWS = [[e, EN['enchantment.minecraft.' + e], ENCH[e]['max_level'], ENCH[e]['min_cost']['base'], ENCH[e]['min_cost']['per_level_above_first'],
              ENCH[e]['max_cost']['base'], ENCH[e]['max_cost']['per_level_above_first'], ENCH[e]['weight']] for e in ENCH_KEYS]
def excl(e):
    x = ENCH[e].get('exclusive_set')
    return set(bare(v) for v in holders('enchantment', x)) if x else set()
def compatible(a, b): return a != b and b not in excl(a) and a not in excl(b)
def items_of(v): return set(bare(x) for x in holders('item', v))
ENCH_FOR = {}
def ench_item(i):   # candidates (in tag order) and the pairs that can't go together
    if i in ENCH_FOR: return
    cand = [k for k, e in enumerate(ENCH_KEYS) if i in items_of(ENCH[e].get('primary_items', ENCH[e]['supported_items']))]
    bad = [[a, b] for a in cand for b in cand if a < b and not compatible(ENCH_KEYS[a], ENCH_KEYS[b])]
    ENCH_FOR[i] = {'e': ENCHANTABILITY[i], 'c': cand, 'x': bad}

POTIONS = [bare(p) for p in tag('potion', 'tradeable')]
def potion_name(p):
    base = p.replace('long_', '').replace('strong_', '')
    k = 'item.minecraft.tipped_arrow.effect.' + base; keys.add(k)
    return EN.get(k, base) + (' II' if p.startswith('strong_') else ' (long)' if p.startswith('long_') else '')

def fn_of(mods, gives):
    for m in L(mods or []):
        t = bare(m.get('type', '')) if isinstance(m, dict) else ''
        if t == 'enchant_randomly': return ['b']
        if t == 'enchant_with_levels':
            lv = m['levels']; ench_item(gives)
            return ['e', gives, lv['min'], lv['max']]
        if t == 'set_random_dyes':
            n = m['number_of_dyes']; base = n['inputs'][0]; bi = n['inputs'][1]
            assert n['type'] == 'minecraft:add' and bi['type'] == 'minecraft:binomial'
            return ['d', base, bi['n'], bi['p']]
        if t == 'set_random_potion': return ['p']
        if t == 'set_stew_effect':
            effs = []
            for e in m['effects']:
                k = 'effect.minecraft.' + bare(e['type']); keys.add(k); effs.append([EN[k], e['duration']])
            return ['s', effs]
        if t == 'exploration_map': return ['m']
    return 0

VARIANTS = ['plains', 'desert', 'jungle', 'savanna', 'snow', 'swamp', 'taiga']
DATA_OUT = {}
for job in JOBS:
    keys.add('entity.minecraft.villager.' + job)
    DATA_OUT[job] = {'name': EN['entity.minecraft.villager.' + job], 'levels': {}}
    for lv in range(1, 6):
        ts = J('trade_set', job, f'level_{lv}.json')
        assert isinstance(ts['amount'], (int, float)), (job, lv)
        assert not ts.get('allow_duplicates'), (job, lv)
        pool = []
        for v in holders('villager_trade', ts['trades']):
            d = J('villager_trade', *(bare(v) + '.json').split('/'))
            for part in ('wants', 'additional_wants', 'gives'):
                if part in d: assert isinstance(d[part].get('count', 1), int), (v, part)
            g = bare(d['gives']['id'])
            pred = d.get('merchant_predicate', {}).get('predicate', {}).get('minecraft:predicates', {}).get('minecraft:villager/variant')
            pool.append([item(d['wants']['id']), d['wants'].get('count', 1),
                         item(d['additional_wants']['id']) if 'additional_wants' in d else -1, d.get('additional_wants', {}).get('count', 0),
                         item(g), d['gives'].get('count', 1), fn_of(d.get('given_item_modifier'), g),
                         [VARIANTS.index(bare(x)) for x in L(pred)] if pred else 0])
        h = hashlib.md5(ts['random_sequence'].encode()).hexdigest()   # the sequence's seed mix: MD5 of its name, two halves
        DATA_OUT[job]['levels'][lv] = {'amt': int(ts['amount']), 'h': [h[:16], h[16:]], 'pool': pool}
for k in ('merchant.level.1', 'merchant.level.2', 'merchant.level.3', 'merchant.level.4', 'merchant.level.5'): keys.add(k)
for d in DYES: keys.add('color.minecraft.' + d)

js = ['// ---------- every villager job\'s trades (generated by i18n/jobs.py from the 26.x game data; do not edit) ----------',
      '// JOB_DATA[job].levels[n] = { amt: offers per level-up, h: MD5 of the random sequence name (hex halves), pool: trades in tag order }',
      '// a trade: [wants item, count, extra item (-1 none), count, gives item, count, random part, villager types or 0]',
      '// random part: 0 | ["b"] book | ["e", item, min, max] enchanting | ["d", base, n, p] dyes | ["p"] potion | ["s", effects] stew | ["m"] map',
      'const JOB_ITEMS = ' + json.dumps(ITEMS, ensure_ascii=False, separators=(',', ':')) + ';   // [id, name, texture]',
      'const JOB_ENCH = ' + json.dumps(ENCH_ROWS, ensure_ascii=False, separators=(',', ':')) + ';   // [id, name, max level, min cost base, +per level, max cost base, +per level, weight]',
      'const JOB_ENCH_FOR = ' + json.dumps(ENCH_FOR, separators=(',', ':')) + ';   // item: { e: enchantability, c: possible enchantments, x: pairs that exclude each other }',
      'const JOB_POTIONS = ' + json.dumps([[p, potion_name(p)] for p in POTIONS], ensure_ascii=False, separators=(',', ':')) + ';',
      'const JOB_DYES = ' + json.dumps([[d, EN['color.minecraft.' + d]] for d in DYES], separators=(',', ':')) + ';',
      'const JOB_VARIANTS = ' + json.dumps(VARIANTS) + ';',
      'const JOB_DATA = ' + json.dumps(DATA_OUT, ensure_ascii=False, separators=(',', ':')) + ';', '']
open(os.path.join(HERE, '..', 'js', '09a-jobdata.js'), 'w', encoding='utf-8').write('\n'.join(js))
json.dump(sorted(keys), open(os.path.join(HERE, 'job_keys.json'), 'w'), indent=0)
print(len(ITEMS), 'items,', len(ENCH_ROWS), 'enchantments,', len(ENCH_FOR), 'enchantable items,', len(keys), 'names')
