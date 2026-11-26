#!/usr/bin/env python3
"""Build js/06a2-looticons.js: inventory icons for the chest items that the texture mirror (1.21.4) can't show right.

    python3 i18n/loot_icons.py [cache folder]

- Blocks (item models with elements) are drawn in 3D like in the game's inventory: the model's own cubes,
  its gui view (rotation, translation, scale) and the game's light (top bright, sides darker).
- Flat items whose texture is missing from the 1.21.4 mirror (newer items) are taken from the newer assets.
Models and textures come from misode/mcmeta, tag ASSETS (Mojang's own files). Each icon is a 64 x 64 PNG, inlined.
"""
import base64, io, json, math, os, re, sys, tempfile, urllib.request
from PIL import Image

ASSETS = '26.3-assets'
BASE = f'https://raw.githubusercontent.com/misode/mcmeta/{ASSETS}/assets/minecraft/'
MIRROR = 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.4/assets/minecraft/textures/'
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'basescout-icons')   # downloaded files, kept between runs
os.makedirs(CACHE, exist_ok=True)
OUT, S = 64, 4   # icon size, and drawn S times bigger first so the edges come out smooth

def get(url):
    f = os.path.join(CACHE, re.sub(r'[^a-zA-Z0-9._-]', '_', url[-150:]))
    if os.path.exists(f):
        d = open(f, 'rb').read(); return None if d == b'404' else d
    try: d = urllib.request.urlopen(url, timeout=30).read()
    except urllib.error.HTTPError as e:
        if e.code != 404: raise
        d = b'404'
    open(f, 'wb').write(d)
    return None if d == b'404' else d

bare = lambda s: s.split(':')[-1]
def tex(path):
    d = get(BASE + 'textures/' + bare(path) + '.png')
    if not d: return None
    im = Image.open(io.BytesIO(d)).convert('RGBA')
    return im.crop((0, 0, im.width, im.width)) if im.height > im.width else im   # animated: first frame

def model(path):   # the model with its parents merged: textures, elements, gui view
    out = {'textures': {}, 'elements': None, 'gui': None, 'root': None}
    while path:
        d = get(BASE + 'models/' + bare(path) + '.json')
        if not d: out['root'] = bare(path); break
        m = json.loads(d)
        for k, v in m.get('textures', {}).items(): out['textures'].setdefault(k, v)
        if out['elements'] is None and 'elements' in m: out['elements'] = m['elements']
        if out['gui'] is None and 'gui' in m.get('display', {}): out['gui'] = m['display']['gui']
        path = m.get('parent')
        if path and bare(path) in ('builtin/generated', 'builtin/entity'): out['root'] = bare(path); break
    return out

def resolve(t, textures, n=0):
    while t and t.startswith('#') and n < 10: t = textures.get(t[1:]); n += 1
    return t

def item_models(d):   # the models an item draws (composite: several, each with its own place)
    t = bare(d.get('type', ''))
    if t == 'model': return [(d['model'], None)]
    if t == 'composite': return [x for m in d['models'] for x in [(mm, m.get('transformation')) for mm, tr in item_models(m)]]
    if t == 'select' and bare(d.get('property', '')) == 'display_context':   # the inventory's own model
        for c in d.get('cases', []):
            w = c.get('when'); w = w if isinstance(w, list) else [w]
            if 'gui' in w: return item_models(c['model'])
    if t in ('select', 'condition', 'range_dispatch'):
        for k in ('fallback', 'on_false'):
            if k in d: return item_models(d[k])
        if d.get('cases'): return item_models(d['cases'][0]['model'])
        if d.get('entries'): return item_models(d['entries'][0]['model'])
    return []

# ---- small 3D maths ----
def rx(a): c, s = math.cos(a), math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]
def ry(a): c, s = math.cos(a), math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]
def rz(a): c, s = math.cos(a), math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]
def mm(a, b): return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
def mv(a, v): return [sum(a[i][k] * v[k] for k in range(3)) for i in range(3)]
def quat(q):   # (x, y, z, w) → matrix
    x, y, z, w = q; return [[1 - 2*(y*y + z*z), 2*(x*y - z*w), 2*(x*z + y*w)], [2*(x*y + z*w), 1 - 2*(x*x + z*z), 2*(y*z - x*w)], [2*(x*z - y*w), 2*(y*z + x*w), 1 - 2*(x*x + y*y)]]
I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

FACES = {   # corner at uv (0,0), direction of u, direction of v, normal; as seen from outside, sides upright
    'north': (lambda f, t: (t[0], t[1], f[2]), (-1, 0, 0), (0, -1, 0), (0, 0, -1)),
    'south': (lambda f, t: (f[0], t[1], t[2]), (1, 0, 0), (0, -1, 0), (0, 0, 1)),
    'west':  (lambda f, t: (f[0], t[1], f[2]), (0, 0, 1), (0, -1, 0), (-1, 0, 0)),
    'east':  (lambda f, t: (t[0], t[1], t[2]), (0, 0, -1), (0, -1, 0), (1, 0, 0)),
    'up':    (lambda f, t: (f[0], t[1], f[2]), (1, 0, 0), (0, 0, 1), (0, 1, 0)),
    'down':  (lambda f, t: (f[0], f[1], t[2]), (1, 0, 0), (0, 0, -1), (0, -1, 0)),
}
def default_uv(face, f, t):
    return {'down': [f[0], 16 - t[2], t[0], 16 - f[2]], 'up': [f[0], f[2], t[0], t[2]], 'north': [16 - t[0], 16 - t[1], 16 - f[0], 16 - f[1]],
            'south': [f[0], 16 - t[1], t[0], 16 - f[1]], 'west': [f[2], 16 - t[1], t[2], 16 - f[1]], 'east': [16 - t[2], 16 - t[1], 16 - f[2], 16 - f[1]]}[face]
TINT = (0x91 / 255, 0xbd / 255, 0x59 / 255)   # grass and leaves: the plains colour
LIGHT = {'up': 1.0, 'down': 0.5, 'north': 0.8, 'south': 0.8, 'east': 0.6, 'west': 0.6}

def render3d(parts):
    """parts: [(model, transformation)] → 64 x 64 icon. The gui view of the first model is used for all."""
    W = OUT * S; img = Image.new('RGBA', (W, W)); px = img.load()
    gui = parts[0][0]['gui'] or {'rotation': [30, 225, 0], 'translation': [0, 0, 0], 'scale': [0.625] * 3}
    a = [math.radians(x) for x in gui.get('rotation', [0, 0, 0])]
    R = mm(mm(rx(a[0]), ry(a[1])), rz(a[2])); Tg = [x / 16 for x in gui.get('translation', [0, 0, 0])]; Sg = gui.get('scale', [1, 1, 1])
    quads = []
    for M, tr in parts:
        Rt = mm(quat(tr['left_rotation']), quat(tr.get('right_rotation', [0, 0, 0, 1]))) if tr else I3
        Tt = tr['translation'] if tr else [0, 0, 0]
        def place(v):   # model point (0-16) → screen space (-0.5..0.5, y up, z toward the viewer)
            p = [x / 16 for x in v]
            p = [q + t for q, t in zip(mv(Rt, p), Tt)]
            p = [(p[i] - 0.5) * Sg[i] for i in range(3)]
            return [q + t for q, t in zip(mv(R, p), Tg)]
        for e in M['elements'] or []:
            f, t = e['from'], e['to']; er = e.get('rotation')
            def rot_el(v):
                if not er or not er.get('angle'): return v
                o = er['origin']; ang = math.radians(er['angle']); ax = er['axis']
                m = rx(ang) if ax == 'x' else ry(ang) if ax == 'y' else rz(ang)
                return [q + oo for q, oo in zip(mv(m, [v[i] - o[i] for i in range(3)]), o)]
            for name, fc in e.get('faces', {}).items():
                tp = resolve(fc.get('texture'), M['textures'])
                im = tp and tex(tp)
                if im is None: continue
                corner, du, dv, n = FACES[name]
                ext = [t[i] - f[i] for i in range(3)]
                c0 = corner(f, t); su = sum(abs(du[i]) * ext[i] for i in range(3)); sv = sum(abs(dv[i]) * ext[i] for i in range(3))
                p0 = rot_el(list(c0)); pu = rot_el([c0[i] + du[i] * su for i in range(3)]); pv = rot_el([c0[i] + dv[i] * sv for i in range(3)])
                P0, PU, PV = place(p0), place(pu), place(pv)
                E1 = [PU[i] - P0[i] for i in range(3)]; E2 = [PV[i] - P0[i] for i in range(3)]
                nz = E1[0] * E2[1] - E1[1] * E2[0]   # facing the viewer? (screen y up: outward faces wind clockwise)
                if nz > 0 and not (su == 0 or sv == 0): continue
                uv = fc.get('uv') or default_uv(name, f, t)
                depth = P0[2] + (E1[2] + E2[2]) / 2
                tint = TINT if 'tintindex' in fc else (1, 1, 1)
                quads.append((depth, P0, E1, E2, im, uv, fc.get('rotation', 0), [LIGHT[name] * c for c in tint]))
    quads.sort(key=lambda q: q[0])
    to_px = lambda x, y: ((x + 0.5) * W, (0.5 - y) * W)
    for _, P0, E1, E2, im, uv, frot, light in quads:
        a0 = to_px(P0[0], P0[1]); a1 = to_px(P0[0] + E1[0], P0[1] + E1[1]); a2 = to_px(P0[0] + E2[0], P0[1] + E2[1])
        ux, uy = a1[0] - a0[0], a1[1] - a0[1]; vx, vy = a2[0] - a0[0], a2[1] - a0[1]
        det = ux * vy - uy * vx
        if abs(det) < 1e-6: continue
        xs = [a0[0], a1[0], a2[0], a1[0] + vx]; ys = [a0[1], a1[1], a2[1], a1[1] + vy]
        tw, th = im.size; tpx = im.load(); k = tw / 16
        for y in range(max(0, int(min(ys))), min(W, int(max(ys)) + 1)):
            for x in range(max(0, int(min(xs))), min(W, int(max(xs)) + 1)):
                dx, dy = x + .5 - a0[0], y + .5 - a0[1]
                s = (dx * vy - dy * vx) / det; tt = (ux * dy - uy * dx) / det
                if not (0 <= s < 1 and 0 <= tt < 1): continue
                for _ in range(frot // 90 % 4): s, tt = tt, 1 - s
                u = uv[0] + (uv[2] - uv[0]) * s; v = uv[1] + (uv[3] - uv[1]) * tt
                c = tpx[min(tw - 1, max(0, int(u * k))), min(th - 1, max(0, int(v * k)))]
                if c[3] < 16: continue
                px[x, y] = (int(c[0] * light[0]), int(c[1] * light[1]), int(c[2] * light[2]), 255)
    return img.resize((OUT, OUT), Image.LANCZOS)

def flat(M):
    layers = [M['textures'][k] for k in sorted(M['textures']) if re.fullmatch(r'layer\d+', k)]
    ims = [tex(l) for l in layers]
    if not ims or ims[0] is None: return None
    base = Image.new('RGBA', ims[0].size)
    for im in ims:
        if im is not None: base.alpha_composite(im.resize(base.size, Image.NEAREST))
    return base.resize((OUT, OUT), Image.NEAREST)

def main():
    src = open(os.path.join(HERE, '..', 'js', '06a-lootdata.js')).read()
    items = json.loads(re.search(r'const LOOT_ITEMS = (\[.*?\]);', src).group(1))
    icons = {}
    for key, name, cur in items:
        d = get(BASE + 'items/' + key + '.json')
        if not d: continue
        parts = [(model(m), tr) for m, tr in item_models(json.loads(d)['model'])]
        if not parts: continue
        if any(p[0]['elements'] for p in parts):
            im = render3d([p for p in parts if p[0]['elements']]); why = '3D'
        else:
            layer0 = bare(parts[0][0]['textures'].get('layer0', ''))
            if not layer0 or get(MIRROR + layer0 + '.png'): continue   # the mirror has it (the site shows it from there)
            im = flat(parts[0][0]); why = 'flat ' + layer0
        if im is None: continue
        b = io.BytesIO(); im.quantize(colors=96, method=Image.Quantize.FASTOCTREE).save(b, 'PNG', optimize=True)   # few colours: small files
        icons[key] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
        print(f'{key:32} {why:30} {len(b.getvalue())} bytes')
    out = os.path.join(HERE, '..', 'js', '06a2-looticons.js')
    with open(out, 'w') as f:
        f.write('// inventory icons for chest items: blocks in 3D like the game, newer items the mirror lacks (built by i18n/loot_icons.py)\n')
        f.write('const LOOT_ICONS = ' + json.dumps(icons, separators=(',', ':')) + ';\n')
    print(len(icons), 'icons,', os.path.getsize(out), 'bytes →', out)

if __name__ == '__main__':
    main()
