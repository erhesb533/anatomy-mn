import json, glob, re, sys, os
R = '/home/claude/anatomy-mn'
nodes = json.load(open(sys.argv[1]))
ta2 = {}
for f in glob.glob(R + '/tools/sources/ta2-*.md'):
    for line in open(f, encoding='utf-8'):
        m = re.match(r'^\| (\d+) \| (.*?) \| (.*?) \|$', line.rstrip())
        if m: ta2[int(m.group(1))] = (m.group(2), m.group(3))
def norm(s):
    s = (s or '').lower().replace('’', "'")
    s = re.sub(r'\(.*?\)', '', s)
    s = re.sub(r'\b(the|muscle|muscles|bone|of hand|of the hand)\b', ' ', s)
    s = s.replace('first', '1st').replace('second', '2nd').replace('third', '3rd').replace('fourth', '4th').replace('fifth', '5th')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()
idx = {}
for f in sorted(glob.glob(R + '/data/*.json')):
    base = os.path.basename(f)
    if base in ('index.json', 'search.json'): continue
    d = json.load(open(f, encoding='utf-8')); tid = d['topic']['id']
    for s in d['structures']:
        keys = [s['names'].get('en'), s['names'].get('la')] + [x.get('en') for x in s.get('synonyms', [])] + [x.get('la') for x in s.get('synonyms', [])]
        if s.get('ta2_id') in ta2: keys += list(ta2[s['ta2_id']])
        for k in keys:
            if k: idx.setdefault(norm(k), (tid, s['id']))
hit = miss = 0; misses = []
for n in nodes:
    raw = re.sub(r'\.[a-z0-9]+$', '', n['node'])
    k = norm(raw)
    m = idx.get(k)
    if not m and n['kind'] in ('origin', 'insertion'):
        m = idx.get(norm(re.sub(r'^(long|short|lateral|medial|clavicular part of|acromial part of|scapular spinal part of|spinal part of) (head of )?', '', raw.lower())))
        if m: n['part_of'] = True
    if not m and n['kind'] == 'bone':
        if re.search(r'phalanx .* of hand', raw, re.I): m = ('bones-upper-limb', 'phalanges-of-hand'); n['part_of'] = True
        elif re.search(r'metacarpal bone', raw, re.I): m = ('bones-upper-limb', 'metacarpal-bones'); n['part_of'] = True
        elif re.search(r'phalanx .* of foot', raw, re.I): m = ('bones-lower-limb', 'phalanges-of-foot'); n['part_of'] = True
        elif re.search(r'metatarsal bone', raw, re.I): m = ('bones-lower-limb', 'metatarsal-bones'); n['part_of'] = True
    if not m and n['kind'] in ('origin', 'insertion'):
        m2 = idx.get(norm(re.sub(r'^(ascending|transverse|descending|deep|superficial|abdominal|sternocostal|clavicular|acromial|spinal|scapular spinal) (part|head) of ', '', raw, flags=re.I)))
        if m2: m = m2; n['part_of'] = True
    n['name'] = raw
    if m: n['topic'], n['structure_id'] = m; hit += 1
    else: miss += 1; misses.append((n['kind'], raw))
json.dump(nodes, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
import collections
print('matched', hit, 'unmatched', miss)
print(collections.Counter(k for k, _ in misses))
[print(' ', k, '|', r) for k, r in misses if k != 'landmark']
