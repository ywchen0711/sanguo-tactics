# Rewrites the import map in index.html so every module carries the same version tag.
# python tools/importmap.py [version]
import os, re, sys
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = sys.argv[1] if len(sys.argv) > 1 else '1'
files = []
for root, _, fs in os.walk(os.path.join(here, 'js')):
    for f in fs:
        if f.endswith('.js'):
            files.append(os.path.relpath(os.path.join(root, f), here).replace(os.sep, '/'))
files.sort()
entries = ',\n  '.join(f'"./{f}": "./{f}?v={v}"' for f in files if f != 'js/game.js')
p = os.path.join(here, 'index.html')
s = open(p, encoding='utf-8').read()
s = re.sub(r'<script type="importmap">\{ "imports": \{.*?\} \}</script>', '<script type="importmap">{ "imports": {\n  ' + entries + '\n} }</script>', s, flags=re.S)
s = re.sub(r'js/game\.js\?v=\w+', f'js/game.js?v={v}', s)
s = re.sub(r'style\.css\?v=\w+', f'style.css?v={v}', s)
open(p, 'w', encoding='utf-8').write(s)
print(len(files), 'modules, version', v)
