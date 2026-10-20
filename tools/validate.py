"""Агуулгын JSON файлуудыг шалгах.
Usage: python3 validate.py content/*.json     (нэг эсвэл олон файл)
Шалгах зүйлс:
  1. schema.json-оор бүтэц
  2. id давхардал (файл дотор болон бүх файлын хооронд)
  3. ta2_id байвал names.la нь TA2 хүснэгтийн Латин нэртэй яг таарах
  4. Зургийн файлын нэр эх сурвалжид байгаа эсэх
  5. Асуултын structure_id(s), parent_id нь бүтэц рүү заах эсэх (бүх файлыг хамт өгвөл)
  6. source_id нь sources.json-д байгаа эсэх
  7. verified:false
  8. correct_option_ids нь options-д байгаа эсэх
"""
import json, re, sys, glob, os
import jsonschema

HERE = os.path.dirname(os.path.abspath(__file__))
schema = json.load(open(os.path.join(HERE, '..', 'schema', 'schema.json'), encoding='utf-8'))
V = jsonschema.Draft202012Validator(schema)
source_ids = {s['id'] for s in json.load(open(os.path.join(HERE, '..', 'schema', 'sources.json'), encoding='utf-8'))['sources']}

ta2 = {}
for f in glob.glob(os.path.join(HERE, 'sources', 'ta2-*.md')):
    for line in open(f, encoding='utf-8'):
        m = re.match(r'^\| (\d+) \| (.*?) \| (.*?) \|$', line.rstrip())
        if m:
            ta2[int(m.group(1))] = (m.group(2), m.group(3))

figures = set()
for f in glob.glob(os.path.join(HERE, 'sources', '[01]*-*.md')):
    figures |= set(re.findall(r'\[Зураг: ([^\]]+)\]', open(f, encoding='utf-8').read()))

files = [f for a in sys.argv[1:] if not a.startswith('--') for f in glob.glob(a)
         if os.path.basename(f) not in ('index.json', 'search.json')]
problems = []
all_struct = {}
refs = []  # (file, where, id)
seen_q = {}

def P(f, msg):
    problems.append(f'{os.path.basename(f)}: {msg}')

for f in files:
    try:
        d = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        P(f, f'JSON уншигдсангүй: {e}')
        continue
    for e in V.iter_errors(d):
        P(f, f'schema {e.json_path}: {e.message[:180]}')
    for s in d.get('structures', []):
        sid = s.get('id')
        if sid in all_struct:
            P(f, f'давхардсан structure id "{sid}" (мөн {all_struct[sid]})')
        all_struct[sid] = os.path.basename(f)
        t = s.get('ta2_id')
        if t is not None:
            if t not in ta2:
                P(f, f'{sid}: ta2_id {t} TA2 хүснэгтэд алга')
            elif s['names'].get('la') != ta2[t][0]:
                P(f, f'{sid}: names.la "{s["names"].get("la")}" ≠ TA2 {t} "{ta2[t][0]}"')
        if s.get('parent_id'):
            refs.append((f, f'{sid}.parent_id', s['parent_id']))
        for img in s.get('images', []):
            if img.get('source_id') == 'openstax-ap2e' and img.get('file') not in figures:
                P(f, f'{sid}: зураг "{img.get("file")}" эх сурвалжид алга')
        for src in s.get('sources', []):
            if src.get('source_id') not in source_ids:
                P(f, f'{sid}: source_id "{src.get("source_id")}" бүртгэлгүй')
        if s.get('review', {}).get('verified') is not False:
            P(f, f'{sid}: verified false биш')
    for q in d.get('practical_questions', []) + d.get('theory_questions', []):
        qid = q.get('id')
        if qid in seen_q:
            P(f, f'давхардсан question id "{qid}"')
        seen_q[qid] = f
        for sid in ([q['structure_id']] if 'structure_id' in q else q.get('structure_ids', [])):
            refs.append((f, f'{qid}', sid))
        img = q.get('image')
        if img and img.get('source_id') == 'openstax-ap2e' and img.get('file') not in figures:
            P(f, f'{qid}: зураг "{img.get("file")}" эх сурвалжид алга')
        if 'correct_option_ids' in q:
            opts = {o['id'] for o in q.get('options', [])}
            bad = set(q['correct_option_ids']) - opts
            if bad:
                P(f, f'{qid}: зөв хариулт {bad} options-д алга')
        if q.get('review', {}).get('verified') is not False:
            P(f, f'{qid}: verified false биш')
        for src in q.get('sources', []):
            if src.get('source_id') not in source_ids:
                P(f, f'{qid}: source_id "{src.get("source_id")}" бүртгэлгүй')

for f, where, sid in refs:
    if sid not in all_struct:
        P(f, f'{where} → "{sid}" бүтэц олдсонгүй (өөр файлд байж магадгүй — бүх файлыг хамт шалга)')

counts = {}
for f in files:
    try:
        d = json.load(open(f, encoding='utf-8'))
        counts[os.path.basename(f)] = (len(d.get('structures', [])), len(d.get('practical_questions', [])), len(d.get('theory_questions', [])))
    except Exception:
        pass
for k, (a, b, c) in counts.items():
    print(f'{k}: бүтэц {a}, практик {b}, онол {c}')
print(f'\nАСУУДАЛ: {len(problems)}')
for p in problems:
    print(' -', p)
sys.exit(1 if problems else 0)
