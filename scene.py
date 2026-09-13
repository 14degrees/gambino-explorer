"""Inspect syd GameScenes inside a .wad.xml.

  python3 scene.py find "Shamrock"                    game ids whose title matches (from games.json)
  python3 scene.py list  dl/game117/slot.wad.xml      scenes in a wad, with node/state counts
  python3 scene.py tree  dl/game117/slot.wad.xml slot/scene.object [maxdepth]
  python3 scene.py sm    dl/game117/slot.wad.xml icons/icon_2.object     states / transitions / rules
"""
import re, json, sys, collections

def load_scenes(path):
    s = open(path).read()
    return {m.group(1): json.loads(m.group(2)) for m in re.finditer(r'<scene id="([^"]+)">(.*?)</scene>', s, re.S)}

def fmt(n):
    p = n.get('properties', {})
    bits = [n['type']]
    if 'Id' in p: bits.append(f"#{p['Id']}")
    for k in ('SpriteName', 'VideoName', 'SoundName', 'TextureName', 'FontName'):
        if k in p: bits.append(f"{k.replace('Name','').lower()}={p[k]}")
    if 'Text' in p: bits.append(f"text={p['Text']!r}")
    if 'Position' in p: bits.append(f"@({p['Position'].get('x',0)},{p['Position'].get('y',0)})")
    if 'Size' in p: bits.append(f"{p['Size'].get('w','?')}x{p['Size'].get('h','?')}")
    if 'Scale' in p: bits.append(f"scale={p['Scale']}")
    if 'DrawOrder' in p: bits.append(f"z{p['DrawOrder']}")
    if p.get('Hidden'): bits.append('HIDDEN')
    if n.get('effect'): bits.append('fx=' + ','.join(n['effect']))
    if n.get('blend'): bits.append('blend=' + json.dumps(n['blend']))
    return ' '.join(bits)

def tree(nodes, maxdepth):
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []): parent[c] = i
    roots = [i for i in range(len(nodes)) if i not in parent]
    def walk(i, d):
        if d > maxdepth: return
        n = nodes[i]
        kids = sorted(n.get('children', []), key=lambda c: -nodes[c].get('properties', {}).get('DrawOrder', 0))
        print('  ' * d + f"[{i}] " + fmt(n))
        for c in kids: walk(c, d + 1)
    for r in roots: walk(r, 0)

def statemachine(r):
    rules = r.get('rules', []); trans = r.get('transitions', []); states = r.get('states', [])
    def rule_txt(i):
        x = rules[i]
        return f"{x['type']}:{x.get('signal', '')}{'/'.join(map(str, x.get('params', [])))}"
    for i, st in enumerate(states):
        if 'id' not in st: continue
        outs = [rule_txt(trans[t]['rule']) for t in st.get('transitions', []) if 'rule' in trans[t]]
        print(f"  state {st['id']!r:<22} onEnter=action#{st.get('onEnter', '-')}  targets={st.get('targets', [])}  on: {', '.join(outs)}")

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'find':
        g = json.load(open('games.json')); q = sys.argv[2].lower()
        seen = set()
        for loc, v in g.items():
            gid = loc.rsplit('/', 1)[-1]
            if q in (v['title'] or '').lower() and gid not in seen:
                seen.add(gid); print(f"{gid:<10} {v['title']}   (assetsVersion {v['assetsVersion']}, level {v['availableFromLevel']})")
        sys.exit()
    wad = sys.argv[2]
    sc = load_scenes(wad)
    if cmd == 'list':
        for k in sorted(sc):
            r = sc[k]['resource']
            print(f"{len(r.get('nodes', [])):>4} nodes {len(r.get('states', [])):>4} states  {k}")
        sys.exit()
    sid = sys.argv[3]; r = sc[sid]['resource']
    print(f"{sid}: {len(r.get('nodes',[]))} nodes, {len(r.get('states',[]))} states, {len(r.get('transitions',[]))} transitions, {len(r.get('rules',[]))} rules, {len(r.get('actions',[]))} actions, {len(r.get('signalEvents',[]))} signalEvents\n")
    if cmd == 'tree':
        tree(r['nodes'], int(sys.argv[4]) if len(sys.argv) > 4 else 99)
    elif cmd == 'sm':
        statemachine(r)
