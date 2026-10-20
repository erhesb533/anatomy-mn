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
# TA2 шатлалаар эцэг бүтэц (tools/model3d/part_of.json)
PO = json.load(open(R + '/tools/model3d/part_of.json', encoding='utf-8'))
ta2_by_en = {}
for i, (la, en) in ta2.items():
    for k in (la, en): ta2_by_en.setdefault(norm(k), i)
sid_topic = {sid: t for (t, sid) in idx.values()}
def part_of(raw):
    for pat, sid in PO['name_patterns']:
        if re.search(pat, raw) and sid in sid_topic: return (sid_topic[sid], sid)
    i = ta2_by_en.get(norm(raw)) or ta2_by_en.get(norm(re.sub(r'\*', '', raw)))
    if i is None: return None
    best = None
    for a, b, sid in PO['ta2_ranges']:
        if a <= i <= b and sid in sid_topic and (best is None or b - a < best[0]): best = (b - a, sid)
    return (sid_topic[best[1]], best[1]) if best else None
hit = miss = 0; misses = []
for n in nodes:
    raw = re.sub(r'\.[a-z0-9]+$', '', n['node'])
    k = norm(raw)
    m = idx.get(k)
    if not m and n['kind'] in ('origin', 'insertion'):
        m = idx.get(norm(re.sub(r'^(long|short|lateral|medial|clavicular part of|acromial part of|scapular spinal part of|spinal part of) (head of )?', '', raw.lower())))
        if m: n['part_of'] = True
    # бүлгийн бүтэц рүү (part_of) — тоолох нэртэй ясууд, үений капсул
    GROUPS = [(r'^Vertebra C[3-7]$', 'bones-vertebral-column-thorax', 'cervical-vertebrae'),
              (r'^Vertebra T\d+$', 'bones-vertebral-column-thorax', 'thoracic-vertebrae'),
              (r'^Vertebra L\d$', 'bones-vertebral-column-thorax', 'lumbar-vertebrae'),
              (r'^\w+ rib$', 'bones-vertebral-column-thorax', 'ribs'),
              (r'^Costal cartilage of \w+ rib$', 'bones-vertebral-column-thorax', 'costal-cartilage')]
    if not m and n['kind'] == 'bone':
        for pat, t, sid in GROUPS:
            if re.search(pat, raw): m = (t, sid); n['part_of'] = True; break
    if not m and n['kind'] == 'bone':
        cap = re.match(r'^Articular capsules? of (.+)$', raw)
        if cap:
            j = idx.get(norm(cap.group(1)))
            if j: m = j; n['part_of'] = True
    if not m and n['kind'] == 'bone':
        if re.search(r'phalanx .* of hand', raw, re.I): m = ('bones-upper-limb', 'phalanges-of-hand'); n['part_of'] = True
        elif re.search(r'metacarpal bone', raw, re.I): m = ('bones-upper-limb', 'metacarpal-bones'); n['part_of'] = True
        elif re.search(r'phalanx .* of foot', raw, re.I): m = ('bones-lower-limb', 'phalanges-of-foot'); n['part_of'] = True
        elif re.search(r'metatarsal bone', raw, re.I): m = ('bones-lower-limb', 'metatarsal-bones'); n['part_of'] = True
    if not m and n['kind'] in ('origin', 'insertion', 'bone'):
        stripped = re.sub(r'^(ascending|transverse|descending|deep|superficial|abdominal|sternocostal|clavicular|acromial|spinal|scapular spinal|long|short|lateral|medial|ulnar|humeral|humero-ulnar|radial|oblique|inferior|superior|anterior|posterior|costal|lumbar|sternal|iliac|pubic|ischial|femoral|tibial|fibular|tendinous|muscular|vertebral|cranial|cervical|thoracic|orbital|palpebral|labial|alar|transverse|first|second|third|fourth) (part|head|belly|portion|fasciculus|fibres|fibers)s? of (the )?', '', raw, flags=re.I)
        m2 = idx.get(norm(stripped))
        if not m2: m2 = idx.get(norm(re.sub(r'\b(muscle|part)\b', '', stripped)))
        if m2 and stripped != raw: m = m2; n['part_of'] = True
        elif m2: m = m2
    if not m and n['kind'] == 'bone':
        m = part_of(raw)
        if m: n['part_of'] = True
    n['name'] = raw
    if m: n['topic'], n['structure_id'] = m; hit += 1
    else: miss += 1; misses.append((n['kind'], raw))
json.dump(nodes, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
import collections
print('matched', hit, 'unmatched', miss)
print(collections.Counter(k for k, _ in misses))
[print(' ', k, '|', r) for k, r in misses if k != 'landmark']
