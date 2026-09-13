"""Crop frames out of atlases: stdin JSON [{key, src, x, y, w, h}] -> writes zeus/anime/crops/<key>.webp"""
import sys, json, os
from PIL import Image
jobs = json.load(sys.stdin); os.makedirs('zeus/anime/crops', exist_ok=True)
cache = {}
for j in jobs:
    out = f"zeus/anime/crops/{j['key']}.webp"
    if os.path.exists(out): continue
    im = cache.get(j['src']) or cache.setdefault(j['src'], Image.open(j['src']).convert('RGBA'))
    im.crop((j['x'], j['y'], j['x'] + j['w'], j['y'] + j['h'])).save(out, 'WEBP', quality=88, method=4)
print(len(jobs))
