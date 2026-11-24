#!/usr/bin/env python3
"""Build the site (../index.html) from the sources in this folder.

    python3 build.py              -> ../index.html (next to this folder, ready for GitHub Pages)
    python3 build.py out.html     -> another file

The page is one self-contained file: page.html with style.css (+ theme-mc.css, the Minecraft look), js/*.js (in name order),
icons.js, worker.js (the search engine, run as a Web Worker) and wasm/finder.wasm put inside it.
"""
import base64, glob, gzip, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
def read(p): return open(os.path.join(HERE, p), encoding='utf-8').read()

def build(out, raw_wasm=False):
    page = read('page.html')
    js = ''.join(read(p) for p in sorted(os.path.relpath(f, HERE) for f in glob.glob(os.path.join(HERE, 'js', '*.js'))))
    worker, icons = read('worker.js'), read('icons.js')
    for name, text in (('worker.js', worker), ('icons.js', icons), ('js', js)):
        assert '</script' not in text, name + ' must not contain </script'
    wasm = open(os.path.join(HERE, 'wasm', 'finder.wasm'), 'rb').read()
    if not raw_wasm: wasm = gzip.compress(wasm, 9, mtime=0)   # the page unzips it (DecompressionStream)
    for marker, text in (('/*STYLE*/', read('style.css') + '\n' + read('theme-mc.css')), ('/*SCRIPT*/', js), ('/*WORKER*/', worker), ('/*ICONS*/', icons),
                         ('__WASM_B64__', base64.b64encode(wasm).decode())):
        assert page.count(marker) == 1, marker
        page = page.replace(marker, text)
    head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')
    cut = page.index('</style>') + len('</style>')
    html = (head + page[:cut] + '\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)} '
            'body{margin:0} img{max-width:100%}</style>\n</head>\n<body>\n' + page[cut:] + '\n</body>\n</html>\n')
    open(out, 'w', encoding='utf-8').write(html)
    print(f'{out}: {len(html.encode()):,} bytes')

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    build(args[0] if args else os.path.join(HERE, '..', 'index.html'), raw_wasm='--raw-wasm' in sys.argv)
