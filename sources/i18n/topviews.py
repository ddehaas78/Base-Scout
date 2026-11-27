#!/usr/bin/env python3
"""Build js/06d-topdata.js: every jigsaw piece (js/06d-jigsawdata.js) seen from above, block by block, for the structure plans.

    python3 i18n/topviews.py <mcmeta assets folder> [jigsaw cache folder]

<mcmeta assets folder> is misode/mcmeta, tag 26.3-assets (assets/minecraft: blockstates and models/block).
The pieces themselves (structure .nbt files) come from the same place as i18n/jigsaw.py (its cache folder).

What each column shows: like a floor plan, the roof or ceiling is lifted off: under the top blocks, the first air, then
the first thing under it (the floor of a room, a chest standing there). A column solid all the way down (3 blocks or more)
is a wall: it is drawn darker. Elsewhere (roads, fields) the top block. Textures are the 1.21.4 mirror's (the site's own source).
"""
import base64, gzip, json, os, re, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ASSETS = os.path.join(sys.argv[1], 'assets', 'minecraft')
if len(sys.argv) > 2: sys.argv = [sys.argv[0], sys.argv[2]]
else: sys.argv = sys.argv[:1]
import jigsaw   # its cache folder and its .nbt reader
TEX = set(open('/tmp/texlist.txt').read().split()) if os.path.exists('/tmp/texlist.txt') else None   # textures the mirror has
bare = lambda s: s.split(':')[-1]
EMPTY = {'air', 'cave_air', 'void_air', 'structure_void', 'jigsaw', 'light', 'barrier', 'structure_block'}

# colours the game paints over grey textures (grass, leaves, water...)
GRASS, FOLIAGE, WATER = '7cbd6b', '59ae30', '3f76e4'
TINT = {'bush': GRASS, 'firefly_bush': GRASS, 'grass_block': GRASS, 'short_grass': GRASS, 'tall_grass': GRASS, 'fern': GRASS, 'large_fern': GRASS, 'sugar_cane': GRASS, 'vine': FOLIAGE,
        'oak_leaves': FOLIAGE, 'jungle_leaves': FOLIAGE, 'acacia_leaves': FOLIAGE, 'dark_oak_leaves': FOLIAGE, 'mangrove_leaves': '8db127',
        'spruce_leaves': '619961', 'birch_leaves': '80a755', 'water': WATER, 'lily_pad': '208030', 'melon_stem': '8fb83a', 'pumpkin_stem': '8fb83a',
        'attached_melon_stem': '8fb83a', 'attached_pumpkin_stem': '8fb83a', 'potted_fern': GRASS, 'bubble_column': WATER}
# blocks whose model draws nothing useful from above: a picture of their own
SPECIAL = {'water': 'block/water_still', 'lava': 'block/lava_still', 'chest': 'block/oak_planks', 'trapped_chest': 'block/oak_planks',
           'ender_chest': 'block/obsidian', 'bubble_column': 'block/water_still', 'fire': 'block/fire_0', 'soul_fire': 'block/soul_fire_0'}

NEWER = {'bush': 'block/short_grass', 'wildflowers': 'block/pink_petals', 'tall_dry_grass': 'block/dead_bush', 'short_dry_grass': 'block/dead_bush',
         'leaf_litter': 'block/pink_petals', 'firefly_bush': 'block/short_grass', 'cactus_flower': 'block/cactus_top', 'iron_chain': 'block/chain',
         'poplar_log': 'block/birch_log', 'poplar_fence': 'block/birch_planks', 'poplar_*': 'block/birch_planks', 'red_poplar_leaves': 'block/acacia_leaves',
         '*copper_lantern': 'block/lantern', '*_wall_sign': 'block/oak_planks', 'purpur_pillar': 'block/purpur_pillar_top'}
def model(path):
    out = {'textures': {}, 'elements': None}
    while path:
        f = os.path.join(ASSETS, 'models', *(bare(path) + '.json').split('/'))
        if not os.path.exists(f): break
        m = json.load(open(f))
        for k, v in m.get('textures', {}).items(): out['textures'].setdefault(k, v)
        if out['elements'] is None and 'elements' in m: out['elements'] = m['elements']
        path = m.get('parent')
    return out

def resolve(t, tx):
    n = 0
    while t and (isinstance(t, dict) or t.startswith('#')) and n < 10:
        t = t.get('sprite') if isinstance(t, dict) else tx.get(t[1:]); n += 1
    return bare(t) if t else None

def pick_variant(bs, props):
    if 'variants' in bs:
        best = None
        for key, v in bs['variants'].items():
            conds = dict(c.split('=') for c in key.split(',') if '=' in c)
            if all(props.get(k) == val for k, val in conds.items()):
                best = v; break
            if best is None: best = v
        return best[0] if isinstance(best, list) else best
    for part in bs.get('multipart', []):   # fences, walls...: the post
        if 'when' not in part:
            a = part['apply']; return a[0] if isinstance(a, list) else a
    a = bs['multipart'][0]['apply'] if bs.get('multipart') else None
    return a[0] if isinstance(a, list) else a

CACHE = {}
def top_texture(bid, props):
    key = bid + json.dumps(props, sort_keys=True)
    if key in CACHE: return CACHE[key]
    tex = SPECIAL.get(bid)
    if not tex:
        f = os.path.join(ASSETS, 'blockstates', bid + '.json')
        if os.path.exists(f):
            v = pick_variant(json.load(open(f)), props)
            if v:
                M = model(v['model']); side = v.get('x', 0) in (90, 270)   # a log lying down: its side is on top
                face = 'north' if side else 'up'
                if M['elements']:
                    els = [e for e in M['elements'] if face in e.get('faces', {})]
                    if els:
                        e = max(els, key=lambda e: e['to'][1] if face == 'up' else e['to'][2] - e['from'][2])
                        tex = resolve(e['faces'][face]['texture'], M['textures'])
                if not tex:
                    for k in (('side', 'all', 'particle') if side else ('top', 'end', 'up', 'all', 'texture', 'cross', 'plant', 'particle')):
                        if k in M['textures']: tex = resolve(M['textures'][k], M['textures']); break
    if tex and TEX is not None and tex + '.png' not in TEX: tex = None   # not in the mirror (newer than 1.21.4)
    if not tex:   # newer blocks, and beds (drawn by the game, no model): the closest older picture
        if bid.endswith('_bed'): tex = 'block/hay_block_top' if bid == 'straw_bed' else 'block/' + bid[:-4] + '_wool'
        else: tex = NEWER.get(bid) or next((v for k, v in NEWER.items() if (k.endswith('*') and bid.startswith(k[:-1])) or (k.startswith('*') and bid.endswith(k[1:]))), None)
    CACHE[key] = tex
    return tex

SW = ['with_mast', 'upsidedown_full', 'upsidedown_fronthalf', 'upsidedown_backhalf', 'sideways_full', 'sideways_fronthalf', 'sideways_backhalf',
      'rightsideup_full', 'rightsideup_fronthalf', 'rightsideup_backhalf']
EXTRA = ['igloo/top', 'igloo/middle', 'igloo/bottom'] + ['shipwreck/' + n for n in SW] + ['shipwreck/' + n + '_degraded' for n in SW] \
    + ['ruined_portal/portal_%d' % i for i in range(1, 11)] + ['ruined_portal/giant_portal_%d' % i for i in range(1, 4)] \
    + ['end_city/' + n for n in ['base_floor', 'base_roof', 'bridge_end', 'bridge_gentle_stairs', 'bridge_piece', 'bridge_steep_stairs', 'fat_tower_base',
       'fat_tower_middle', 'fat_tower_top', 'second_floor_1', 'second_floor_2', 'second_roof', 'ship', 'third_floor_1', 'third_floor_2', 'third_roof',
       'tower_base', 'tower_floor', 'tower_piece', 'tower_top']]
UNDER = ('trial_chambers', 'ancient_city', 'bastion')   # underground: their ceilings are skipped anyway, nothing more to do
def top_view(T):
    sx, sy, sz = T['size']
    pal = T['palette'] if 'palette' in T else T['palettes'][0]
    grid = {}
    for blk in T['blocks']:
        st = pal[blk['state']]; bid = bare(st.get('Name') or st['id'])
        x, y, z = blk['pos']; grid[(x, y, z)] = (bid, st.get('Properties') or st.get('properties') or {})
    cells, missing = [], set()
    for z in range(sz):
        for x in range(sx):
            col = [grid.get((x, y, z)) for y in range(sy - 1, -1, -1)]   # top down
            empty = [c is None or c[0] in EMPTY for c in col]
            if all(empty): cells.append(None); continue
            k0 = empty.index(False)   # the top: a roof, a ceiling, the ground
            i = next((k for k in range(k0, len(col)) if empty[k]), None)   # air under it: a room...
            j = None if i is None else next((k for k in range(i, len(col)) if not empty[k]), None)   # ...and its floor (or a chest on it)
            if j is not None: cells.append((col[j], False))
            else: cells.append((col[k0], len(col) - k0 - (0 if i is None else len(col) - i) >= 3))   # solid down from there: a wall (3+ blocks) or the ground
    return cells

def main():
    js = open(os.path.join(HERE, '..', 'js', '06d-jigsawdata.js')).read()
    JIG = json.loads(js[js.index('{'):js.rindex('}') + 1])
    texs, tidx, out, missing = [], {}, bytearray(), {}
    def tex_id(bid, props):
        t = top_texture(bid, props)
        if not t: missing[bid] = missing.get(bid, 0) + 1; return 0
        name = 'block/' + t.split('block/')[-1] if t.startswith('block/') else t
        k = name + ('|' + TINT[bid] if bid in TINT else '')
        if k not in tidx: tidx[k] = len(texs) + 1; texs.append(k)
        return tidx[k]
    offs, extra = [], {}
    for n in EXTRA:   # pieces of structures that are not put together by jigsaws (js/06b2-structs2.js, js/06b-structs.js)
        T = jigsaw.nbt(jigsaw.get('structure/' + n + '.nbt')); cells = top_view(T)
        extra[n] = [len(out), T['size'][0], T['size'][2]]
        for c in cells:
            if c is None: out += b'\0\0'; continue
            (bid, props), wall = c
            v = tex_id(bid, props) * 2 + (1 if wall else 0)
            out += bytes([v & 255, v >> 8])
    for n in JIG['names']:
        try: T = jigsaw.nbt(jigsaw.get('structure/' + n + '.nbt'))
        except Exception: offs.append(-1); continue
        cells = top_view(T)
        offs.append(len(out))
        for c in cells:
            if c is None: out += b'\0\0'; continue
            (bid, props), wall = c
            v = tex_id(bid, props) * 2 + (1 if wall else 0)   # low bit: a wall (drawn darker)
            out += bytes([v & 255, v >> 8])
    assert len(texs) * 2 + 1 < 65536
    z = base64.b64encode(gzip.compress(bytes(out), 9, mtime=0)).decode()
    path = os.path.join(HERE, '..', 'js', '06d-topdata.js')
    with open(path, 'w') as f:
        f.write('// every jigsaw piece seen from above, block by block (built by i18n/topviews.py; do not edit)\n')
        f.write('// TOP_TEX: textures ("block/x" or "block/x|rrggbb" painted that colour); TOP_AT[piece] = where its cells start in the data\n')
        f.write('// (2 bytes a cell, row by row along X: texture number × 2, +1 for a wall; 0 = nothing); TOP_GZ: the data, gzipped then base64\n')
        f.write('const TOP_TEX = ' + json.dumps(texs, separators=(',', ':')) + ';\n')
        f.write('const TOP_AT = ' + json.dumps(offs, separators=(',', ':')) + ';\n')
        f.write('const TOP_EXTRA = ' + json.dumps(extra, separators=(',', ':')) + ';   // other pieces: name → [where, size x, size z]\n')
        f.write('const TOP_GZ = "' + z + '";\n')
    print(len(texs), 'textures,', len(out), 'bytes raw,', os.path.getsize(path), 'bytes in the file')
    print('no texture:', sorted(missing.items(), key=lambda x: -x[1])[:40])

if __name__ == '__main__':
    main()
