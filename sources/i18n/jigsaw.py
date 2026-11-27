#!/usr/bin/env python3
"""Build js/06d-jigsawdata.js: what the game needs to assemble bastions, ancient cities and abandoned camps piece by piece.

    python3 i18n/jigsaw.py [cache folder]

From misode/mcmeta (tag DATA, Mojang's own files): the template pools, and for every piece (structure .nbt file)
its size, its jigsaw blocks (where other pieces attach) and its containers (chests, barrels... with their loot table).
The assembly itself (the game's JigsawPlacement) is in js/06d-jigsaw.js.
"""
import gzip, io, json, os, re, struct, sys, tempfile, time, urllib.error, urllib.request

DATA = '26.3-data'
BASE = f'https://raw.githubusercontent.com/misode/mcmeta/{DATA}/data/minecraft/'
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'basescout-jigsaw')
os.makedirs(CACHE, exist_ok=True)
CAMP_BIOMES = ['bamboo_jungle', 'birch_forest', 'cherry_grove', 'dappled_forest', 'flower_forest', 'forest', 'meadow', 'old_growth_birch_forest',
  'old_growth_pine_taiga', 'old_growth_spruce_taiga', 'pale_garden', 'savanna', 'snowy_taiga', 'sparse_jungle', 'swamp', 'taiga', 'windswept_forest', 'wooded_badlands']
VILLAGES = ['desert', 'plains', 'savanna', 'snowy', 'taiga']
STARTS = {'bastion': 'bastion/starts', 'ancient': 'ancient_city/city_center', **{'camp_' + b: 'abandoned_camp/tent/' + b for b in CAMP_BIOMES},
          **{'village_' + v: 'village/' + v + '/town_centers' for v in VILLAGES}, 'trial': 'trial_chambers/chamber/end'}
# blocks whose block entity is a RandomizableContainer: placing one takes a random number for its loot seed
CONTAINERS = {'chest', 'trapped_chest', 'barrel', 'dispenser', 'dropper', 'hopper', 'decorated_pot', 'crafter',
              'shulker_box'} | {c + '_shulker_box' for c in 'white orange magenta light_blue yellow lime pink gray light_gray cyan purple blue brown green red black'.split()}

def get(path):
    f = os.path.join(CACHE, path.replace('/', '__'))
    if os.path.exists(f): return open(f, 'rb').read()
    for i in range(8):   # GitHub may say "too many requests": wait and try again
        try: d = urllib.request.urlopen(BASE + path, timeout=60).read(); break
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == 7: raise
            time.sleep(5 * (i + 1))
    open(f, 'wb').write(d)
    return d

def nbt(data):   # a small reader for the game's NBT files
    b = io.BytesIO(gzip.decompress(data))
    rd = lambda n: b.read(n)
    def payload(t):
        if t == 1: return struct.unpack('>b', rd(1))[0]
        if t == 2: return struct.unpack('>h', rd(2))[0]
        if t == 3: return struct.unpack('>i', rd(4))[0]
        if t == 4: return struct.unpack('>q', rd(8))[0]
        if t == 5: return struct.unpack('>f', rd(4))[0]
        if t == 6: return struct.unpack('>d', rd(8))[0]
        if t == 7: n = payload(3); return rd(n)
        if t == 8: n = struct.unpack('>H', rd(2))[0]; return rd(n).decode('utf-8', 'replace')
        if t == 9:
            et = rd(1)[0]; n = payload(3); return [payload(et) for _ in range(n)]
        if t == 10:
            out = {}
            while True:
                tt = rd(1)[0]
                if tt == 0: return out
                name = payload(8); out[name] = payload(tt)
        if t == 11: n = payload(3); return list(struct.unpack('>%di' % n, rd(4 * n)))
        if t == 12: n = payload(3); return list(struct.unpack('>%dq' % n, rd(8 * n)))
        raise ValueError(t)
    t = rd(1)[0]; payload(8); return payload(t)

bare = lambda s: s.split(':')[-1]
FULL = None   # blocks that count as full cubes (the template keeps them first): only order among non-container blocks, not needed

def template(name):
    try: T = nbt(get('structure/' + bare(name) + '.nbt'))
    except urllib.error.HTTPError as e:   # a pool can name a piece the game doesn't have: the game then uses an empty one
        if e.code != 404: raise
        print('missing piece (empty in the game too):', name); return {'size': [0, 0, 0], 'jig': [], 'cont': []}
    pal = T['palette'] if 'palette' in T else T['palettes'][0]
    jig, cont = [], []
    for blk in T['blocks']:
        st = pal[blk['state']]; bid = bare(st.get('Name') or st['id']); pos = blk['pos']
        if 'nbt' not in blk: continue
        e = blk['nbt']
        if bid == 'jigsaw':
            o = (st.get('Properties') or st.get('properties') or {}).get('orientation', 'north_up')
            jig.append([pos, o, bare(e.get('name', 'empty')), bare(e.get('target', 'empty')), bare(e.get('pool', 'empty')),
                        e.get('joint', ''), e.get('placement_priority', 0), e.get('selection_priority', 0)])
        elif bid in CONTAINERS:
            cont.append([pos, bid, bare(e.get('LootTable', ''))])
    key = lambda x: (x[0][1], x[0][0], x[0][2])   # the game's order for blocks with data: y, then x, then z
    jig.sort(key=key); cont.sort(key=key)
    return {'size': T['size'], 'jig': jig, 'cont': cont}

def element(e):
    t = bare(e['element_type'])
    if t in ('single_pool_element', 'legacy_single_pool_element'):
        return {'t': 's', 'loc': bare(e['location']), 'proj': e.get('projection', 'rigid')}
    if t == 'list_pool_element':
        return {'t': 'l', 'els': [element(x) for x in e['elements']], 'proj': e.get('projection', 'rigid')}
    if t == 'feature_pool_element': return {'t': 'f', 'proj': e.get('projection', 'rigid')}
    if t == 'empty_pool_element': return {'t': 'e'}
    raise ValueError(t)

def aliases():   # trial chambers: some pools are aliases (spawner mobs, picked by their own random): one target stands for all
    out = {}
    def walk(a):
        t = bare(a['type'])
        if t == 'direct': out.setdefault(bare(a['alias']), bare(a['target']))
        elif t == 'random': out.setdefault(bare(a['alias']), bare(a['targets'][0]['data']))
        elif t == 'random_group': [walk(x) for x in a['groups'][0]['data']]
    for x in json.loads(get('worldgen/structure/trial_chambers.json')).get('pool_aliases', []): walk(x)
    return out

def main():
    pools, temps, todo = {}, {}, list(STARTS.values())
    ALIAS = aliases()
    def need_template(loc):
        if loc not in temps:
            temps[loc] = template(loc)
            for j in temps[loc]['jig']:
                if j[4] != 'empty' and j[4] not in pools: todo.append(j[4])
    def walk(el):
        if el['t'] == 's': need_template(el['loc'])
        elif el['t'] == 'l': [walk(x) for x in el['els']]
    while todo:
        p = todo.pop()
        if p in pools or p == 'empty': continue
        d = json.loads(get('worldgen/template_pool/' + ALIAS.get(p, p) + '.json'))
        P = {'fb': bare(d.get('fallback', 'empty')), 'els': []}
        for x in d['elements']:
            el = element(x['element']); P['els'].append([el, x['weight']]); walk(el)
        pools[p] = P
        if P['fb'] not in pools and P['fb'] != 'empty': todo.append(P['fb'])
    # template names → short numbers, to keep the file small
    names = sorted(temps); idx = {n: i for i, n in enumerate(names)}
    def short(el):
        if el['t'] == 's': return [idx[el['loc']], el['proj'][0]]
        if el['t'] == 'l': return ['L', [short(x) for x in el['els']], el['proj'][0]]
        if el['t'] == 'f': return ['f', el['proj'][0]]
        return [el['t']]
    out = {'starts': STARTS, 'names': names, 'temps': [temps[n] for n in names],
           'pools': {k: {'fb': v['fb'], 'els': [[short(e), w] for e, w in v['els']]} for k, v in pools.items()}}
    js = os.path.join(HERE, '..', 'js', '06d-jigsawdata.js')
    with open(js, 'w') as f:
        f.write(f'// bastions, ancient cities, abandoned camps, villages and trial chambers, piece by piece: pools and pieces of Java {DATA[:-5]} (built by i18n/jigsaw.py)\n')
        f.write('const JIG = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    nc = sum(len(t['cont']) for t in temps.values())
    print(len(pools), 'pools,', len(temps), 'pieces,', nc, 'containers,', os.path.getsize(js), 'bytes')

if __name__ == '__main__':
    main()
