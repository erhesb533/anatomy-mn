"""data/*.json-оос data/index.json (сэдвийн жагсаалт) болон хайлтын индекс үүсгэнэ.
Usage: python3 tools/build_index.py"""
import json, glob, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ORDER = ['bones-general', 'bones-skull', 'bones-vertebral-column-thorax', 'bones-upper-limb', 'bones-lower-limb',
         'joints-general', 'joints-selected',
         'muscles-head-neck-back', 'muscles-abdomen-thorax', 'muscles-upper-limb', 'muscles-lower-limb']
topics, search = [], []
for f in sorted(glob.glob(os.path.join(ROOT, 'data', '*.json'))):
    name = os.path.basename(f)
    if name in ('index.json', 'search.json'):
        continue
    d = json.load(open(f, encoding='utf-8'))
    t = d['topic']
    topics.append({'id': t['id'], 'file': name, 'system': t['system'], 'title': t['title'],
                   'counts': {'structures': len(d['structures']), 'practical': len(d['practical_questions']),
                              'theory': len(d['theory_questions'])}})
    for s in d['structures']:
        search.append([s['id'], t['id'], s['names'].get('la'), s['names'].get('en'), s['names'].get('mn'), s['kind']])
topics.sort(key=lambda x: ORDER.index(x['id']) if x['id'] in ORDER else 99)
json.dump({'version': '1.1', 'topics': topics}, open(os.path.join(ROOT, 'data', 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(search, open(os.path.join(ROOT, 'data', 'search.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(topics), 'topics,', len(search), 'structures')
