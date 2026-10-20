/* Анатоми MN — фреймворкгүй PWA.
   Агуулга зөвхөн data/*.json-д байна; энэ файлд эмнэлгийн мэдээлэл бичихгүй. */
'use strict';

const $app = document.getElementById('app');
const STORE_KEY = 'amn:v1';

// Интерфейсийн навигацийн нэрс (анатомийн нэр томьёо биш).
const TOPIC_LABELS = {
  'bones-general': 'Ясны ерөнхий бүтэц ба ангилал',
  'bones-skull': 'Гавлын яс',
  'bones-vertebral-column-thorax': 'Нуруу ба цээжний яс',
  'bones-upper-limb': 'Мөрний бүс ба дээд мөчний яс',
  'bones-lower-limb': 'Аарцаг ба доод мөчний яс',
  'joints-general': 'Үений ангилал ба хөдөлгөөн',
  'joints-selected': 'Гол үенүүдийн бүтэц',
  'muscles-head-neck-back': 'Толгой, хүзүү, нурууны булчин',
  'muscles-abdomen-thorax': 'Цээж, хэвлий, аарцгийн ёроолын булчин',
  'muscles-upper-limb': 'Мөрний бүс ба дээд мөчний булчин',
  'muscles-lower-limb': 'Аарцаг ба доод мөчний булчин',
};
const SYSTEMS = [
  { id: 'bones', mn: 'Яс', la: 'Ossa' },
  { id: 'joints', mn: 'Үе мөч', la: 'Juncturae' },
  { id: 'muscles', mn: 'Булчин', la: 'Musculi' },
];
const KIND_LABELS = {
  'bone': 'яс', 'bone-landmark': 'ясны хэсэг', 'skeleton-division': 'араг ясны хэсэг', 'cartilage': 'мөгөөрс',
  'joint': 'үе', 'joint-part': 'үений хэсэг', 'ligament': 'холбоос', 'tendon-fascia': 'шөрмөс, фасци',
  'muscle': 'булчин', 'muscle-group': 'булчингийн бүлэг', 'opening': 'нүх', 'region': 'муж',
};
const FIELD_LABELS = {
  description_mn: 'Тайлбар', clinical_mn: 'Эмнэлзүй',
  origin_mn: 'Эхлэл', insertion_mn: 'Бэхлэл', action_mn: 'Үйл ажиллагаа',
  innervation_mn: 'Мэдрэл', blood_supply_mn: 'Цусан хангамж',
  bone_class: 'Ясны ангилал', structural_class: 'Бүтцийн ангилал', functional_class: 'Үйл ажиллагааны ангилал',
  synovial_type: 'Синовын үений төрөл', movements_mn: 'Хөдөлгөөн',
};
const MISSING = 'Материалд байхгүй';
const LEITNER_DAYS = [0, 1, 3, 7, 14, 30];

// ---------- state ----------
const state = load();
function load() {
  try { return Object.assign({ lang: 'la', cards: {}, quiz: {}, lab: {} }, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
  catch { return { lang: 'la', cards: {}, quiz: {}, lab: {} }; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* private mode */ } }

// ---------- data ----------
let INDEX = null, SEARCH = null, SOURCES = null;
const TOPICS = {};
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}
async function index() { return INDEX || (INDEX = await getJSON('data/index.json')); }
async function sources() {
  if (!SOURCES) { const d = await getJSON('schema/sources.json'); SOURCES = Object.fromEntries(d.sources.map(s => [s.id, s])); }
  return SOURCES;
}
let FEEDBACK = null;
async function loadFeedback() {
  if (FEEDBACK) return FEEDBACK;
  try { FEEDBACK = await getJSON('feedback.json'); } catch { FEEDBACK = {}; }
  return FEEDBACK;
}
// Алдаа мэдээлэх холбоос: Google Form-ыг бүртгэлийн ID, байршилтайгаар урьдчилан бөглөж нээнэ.
function reportLink(record, where, cls = 'btn') {
  const f = FEEDBACK || {};
  if (!f.form_url) return '';
  const u = new URL(f.form_url);
  u.searchParams.set('usp', 'pp_url');
  if (f.entries && f.entries.record) u.searchParams.set(f.entries.record, record);
  if (f.entries && f.entries.where) u.searchParams.set(f.entries.where, where);
  return `<a class="${cls} report" href="${esc(u.toString())}" target="_blank" rel="noopener">Алдаа мэдээлэх</a>`;
}
let MODELS = null;
async function models() {
  if (!MODELS) { try { MODELS = (await getJSON('models/index.json')).models; } catch { MODELS = []; } }
  return MODELS;
}
async function topic(id) {
  if (TOPICS[id]) return TOPICS[id];
  const meta = (await index()).topics.find(t => t.id === id);
  if (!meta) return null;
  const d = await getJSON('data/' + meta.file);
  d.byId = Object.fromEntries(d.structures.map(s => [s.id, s]));
  return (TOPICS[id] = d);
}

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function nameOf(n) {
  const order = { la: ['la', 'en'], en: ['en', 'la'], mn: ['mn', 'la', 'en'] }[state.lang];
  for (const k of order) if (n && n[k]) return n[k];
  return '—';
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const today = () => Math.floor(Date.now() / 86400000);
function sysClass(sys) { return 'sys-' + sys; }
function crumbs(parts) {
  return `<nav class="crumbs" aria-label="Байршил">${parts.map(([href, label]) => href ? `<a href="${href}">${esc(label)}</a>` : esc(label)).join(' / ')}</nav>`;
}
function verifiedBadge(rec) { return rec.review && rec.review.verified ? '' : '<span class="badge" title="Багш шалгаагүй">Шалгагдаагүй</span>'; }
function topicProgress(t) {
  const ids = Object.keys(state.cards).filter(k => k.startsWith(t.id + '/'));
  const known = ids.filter(k => state.cards[k].box >= 3).length;
  return t.counts.structures ? Math.round(100 * known / t.counts.structures) : 0;
}
function figureHTML(img, caption) {
  return `<figure class="figure"><img src="media/${esc(img.file)}" alt="${esc(caption || img.file)}" loading="lazy" data-zoom>
    <figcaption>${[caption, img.view].filter(Boolean).map(esc).join(', ')}${caption || img.view ? ' — ' : ''}OpenStax A&amp;P 2e (CC BY-NC-SA 4.0)</figcaption></figure>`;
}

// ---------- views ----------
async function viewHome() {
  const idx = await index();
  const bySys = s => idx.topics.filter(t => t.system === s);
  $app.innerHTML = `
    <section class="hero">
      <p class="plate"><span class="b">Ossa</span>, <span class="j">juncturae</span>, <span class="m">musculi</span></p>
      <p>Яс, үе мөч, булчингийн ${idx.topics.reduce((a, t) => a + t.counts.structures, 0)} бүтэц. Атласаар үзэж, флэшкартаар цээжилж, зураг дээр таньж, тестээр шалгана.</p>
      <div class="search"><input id="q" type="search" placeholder="Бүтэц хайх: humerus, deltoid, condyle…" aria-label="Бүтэц хайх" autocomplete="off"></div>
      <ul class="results" id="results"></ul>
    </section>
    ${SYSTEMS.map(sys => `
      <section class="system ${sysClass(sys.id)}">
        <h2>${sys.mn} <span class="la">${sys.la}</span></h2>
        <ul class="topics">
          ${bySys(sys.id).map(t => { const p = topicProgress(t); return `
            <li><a href="#/t/${t.id}">
              <span class="t">${esc(TOPIC_LABELS[t.id] || t.title.en)}</span>
              <span class="p">${p}%</span>
              <span class="c">${t.counts.structures} бүтэц · ${t.counts.theory} тест · ${t.counts.practical} зураг</span>
              <span class="meter" aria-hidden="true"><i style="width:${p}%"></i></span>
            </a></li>`; }).join('')}
        </ul>
      </section>`).join('')}`;
  const q = document.getElementById('q'), out = document.getElementById('results');
  q.addEventListener('input', async () => {
    const term = q.value.trim().toLowerCase();
    if (term.length < 2) { out.innerHTML = ''; return; }
    SEARCH = SEARCH || await getJSON('data/search.json');
    const hits = SEARCH.filter(r => [r[2], r[3], r[4]].some(v => v && v.toLowerCase().includes(term))).slice(0, 30);
    out.innerHTML = hits.length ? hits.map(([id, tid, la, en, mn]) => `<li><a href="#/t/${tid}/s/${id}">
        <span class="latin">${esc(nameOf({ la, en, mn }))}</span><span class="where">${esc(TOPIC_LABELS[tid] || tid)}</span></a></li>`).join('')
      : `<li class="empty">"${esc(q.value)}" олдсонгүй. Латин эсвэл англи нэрээр хайж үзээрэй.</li>`;
  });
}

async function viewTopic(tid) {
  const d = await topic(tid); if (!d) return notFound();
  const meta = (await index()).topics.find(t => t.id === tid);
  const label = TOPIC_LABELS[tid] || d.topic.title.en;
  const models3d = (await models()).filter(m => m.topics.includes(tid));
  const kinds = [...new Set(d.structures.map(s => s.kind))];
  const kindFilter = sessionGet('kind:' + tid);
  const list = d.structures.filter(s => !kindFilter || s.kind === kindFilter);
  const isChild = s => s.parent_id && d.byId[s.parent_id];
  $app.innerHTML = `${crumbs([['#/', 'Нүүр'], [null, label]])}
    <div class="${sysClass(d.topic.system)}">
      <div class="topic-head"><h1>${esc(label)}</h1>
        <p class="small"><span class="latin">${esc(d.topic.title.la || '')}</span>${d.topic.title.la ? ' · ' : ''}${esc(d.topic.title.en)}</p></div>
      <div class="modes">
        <a href="#/t/${tid}/cards"><b>Флэшкарт</b><span>${meta.counts.structures} карт, давтлагын хуваарьтай</span></a>
        <a href="#/t/${tid}/lab"><b>Зураг таних</b><span>${meta.counts.practical} зураг</span></a>
        <a href="#/t/${tid}/quiz"><b>Тест</b><span>${meta.counts.theory} асуулт, тайлбартай</span></a>
        ${models3d.map(m => `<a href="#/3d/${m.id}?from=${tid}"><b>3D: ${esc(m.label)}</b><span>Эргүүлж харах, задлах, дарж таних</span></a>`).join('')}
      </div>
      <h2>Атлас</h2>
      <div class="filter" role="group" aria-label="Төрлөөр шүүх">
        <button class="chip" data-kind="" aria-pressed="${!kindFilter}">Бүгд</button>
        ${kinds.map(k => `<button class="chip" data-kind="${k}" aria-pressed="${kindFilter === k}">${esc(KIND_LABELS[k] || k)}</button>`).join('')}
      </div>
      <ul class="atlas">${list.map(s => `<li class="${!kindFilter && isChild(s) ? 'child' : ''}"><a href="#/t/${tid}/s/${s.id}">
        <span class="latin">${esc(nameOf(s.names))}</span><span class="kind">${esc(KIND_LABELS[s.kind] || s.kind)}</span></a></li>`).join('')}</ul>
    </div>`;
  $app.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { sessionSet('kind:' + tid, b.dataset.kind); viewTopic(tid); });
}
function sessionGet(k) { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } }
function sessionSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }

function fact(label, value) {
  const v = Array.isArray(value) ? value.join(', ') : value;
  return `<div><dt>${esc(label)}</dt><dd>${v ? esc(v) : `<span class="missing">${MISSING}</span>`}</dd></div>`;
}
async function linkList(d, ids) {
  if (!ids || !ids.length) return '';
  const idx = await index();
  SEARCH = SEARCH || await getJSON('data/search.json');
  const where = Object.fromEntries(SEARCH.map(r => [r[0], r]));
  return `<div class="links">${ids.map(id => {
    const r = where[id];
    return r ? `<a href="#/t/${r[1]}/s/${id}" class="latin">${esc(nameOf({ la: r[2], en: r[3], mn: r[4] }))}</a>` : `<span class="small">${esc(id)}</span>`;
  }).join('')}</div>`;
}

async function viewStructure(tid, sid) {
  const d = await topic(tid); if (!d) return notFound();
  const s = d.byId[sid]; if (!s) return notFound();
  const src = await sources();
  const label = TOPIC_LABELS[tid] || d.topic.title.en;
  const det = s.details || {};
  const facts = [fact(FIELD_LABELS.description_mn, s.description_mn)];
  if (det.detail_type === 'muscle') ['origin_mn', 'insertion_mn', 'action_mn', 'innervation_mn', 'blood_supply_mn'].forEach(k => facts.push(fact(FIELD_LABELS[k], det[k])));
  if (det.detail_type === 'joint') ['structural_class', 'functional_class', 'synovial_type', 'movements_mn'].forEach(k => facts.push(fact(FIELD_LABELS[k], det[k])));
  if (det.detail_type === 'bone') facts.push(fact(FIELD_LABELS.bone_class, det.bone_class));
  facts.push(fact(FIELD_LABELS.clinical_mn, s.clinical_mn));
  const children = d.structures.filter(x => x.parent_id === sid).map(x => x.id);
  const related = [...new Set([...(det.landmark_ids || []), ...(det.articulates_with || []), ...(det.bone_ids || []), ...(det.ligament_ids || []), ...(det.origin_bone_ids || []), ...(det.insertion_bone_ids || [])])];
  const pos = d.structures.indexOf(s), prev = d.structures[pos - 1], next = d.structures[pos + 1];
  $app.innerHTML = `${crumbs([['#/', 'Нүүр'], ['#/t/' + tid, label], [null, s.names.la || s.names.en]])}
    <article class="${sysClass(s.system)}">
      <div class="name-block">
        <p class="primary">${esc(nameOf(s.names))}</p>
        <dl class="names">
          <dt>Монгол</dt><dd>${s.names.mn ? esc(s.names.mn) : `<span class="missing">${MISSING}</span>`}</dd>
          <dt>Латин</dt><dd class="latin">${s.names.la ? esc(s.names.la) : `<span class="missing">${MISSING}</span>`}${s.ta2_id ? ` <span class="small">TA2 ${s.ta2_id}</span>` : ''}</dd>
          <dt>Англи</dt><dd>${esc(s.names.en || '—')}</dd>
          ${(s.synonyms || []).length ? `<dt>Өөр нэр</dt><dd>${s.synonyms.map(x => esc(x.la || x.en)).join(', ')}</dd>` : ''}
          <dt>Төрөл</dt><dd>${esc(KIND_LABELS[s.kind] || s.kind)} ${verifiedBadge(s)}</dd>
        </dl>
      </div>
      ${s.parent_id && d.byId[s.parent_id] ? `<p class="small">Хамаарах бүтэц: <a href="#/t/${tid}/s/${s.parent_id}" class="latin">${esc(nameOf(d.byId[s.parent_id].names))}</a></p>` : ''}
      <dl class="facts">${facts.join('')}</dl>
      ${s.images.map(img => figureHTML(img, s.names.en)).join('')}
      ${children.length ? `<h3>Хэсгүүд</h3>${await linkList(d, children)}` : ''}
      ${related.length ? `<h3>Холбогдох бүтэц</h3>${await linkList(d, related)}` : ''}
      ${s.review && s.review.notes ? `<h3>Багшид зориулсан тэмдэглэл</h3><p class="note">${esc(s.review.notes)}</p>` : ''}
      <h3>Эх сурвалж</h3>
      <ul class="sources">${s.sources.map(x => {
        const m = /https?:\/\/\S+/.exec(x.locator || '');
        const name = src[x.source_id] ? src[x.source_id].title : x.source_id;
        return `<li>${esc(name)} — ${m ? esc(x.locator.replace(m[0], '')) + `<a href="${esc(m[0])}" target="_blank" rel="noopener">${esc(m[0])}</a>` : esc(x.locator)}</li>`;
      }).join('')}</ul>
      <div class="actions">
        ${prev ? `<a class="btn" href="#/t/${tid}/s/${prev.id}">Өмнөх</a>` : ''}
        ${next ? `<a class="btn" href="#/t/${tid}/s/${next.id}">Дараах</a>` : ''}
      </div>
      <div class="actions">${reportLink(s.id, 'Атлас: ' + label + ' — ' + (s.names.la || s.names.en))}</div>
    </article>`;
}

// ---- Flashcards (Leitner) ----
async function viewCards(tid) {
  const d = await topic(tid); if (!d) return notFound();
  const label = TOPIC_LABELS[tid] || d.topic.title.en;
  const t = today();
  const key = s => tid + '/' + s.id;
  const due = shuffle(d.structures.filter(s => { const c = state.cards[key(s)]; return !c || c.due <= t; }))
    .sort((a, b) => ((state.cards[key(a)] || {}).box || 0) - ((state.cards[key(b)] || {}).box || 0));
  let i = 0, shown = false, done = 0;
  const render = () => {
    if (i >= due.length) {
      const nextDue = d.structures.map(s => (state.cards[key(s)] || {}).due).filter(Boolean).sort()[0];
      $app.innerHTML = `${crumbs([['#/', 'Нүүр'], ['#/t/' + tid, label], [null, 'Флэшкарт']])}
        <div class="stage ${sysClass(d.topic.system)}"><h1>Өнөөдрийн давтлага дууслаа</h1>
          <p>${done} карт давтлаа. ${nextDue ? `Дараагийн карт ${Math.max(nextDue - t, 0)} хоногийн дараа гарна.` : ''}</p>
          <div class="actions"><a class="btn primary" href="#/t/${tid}/quiz">Тест өгөх</a><a class="btn" href="#/t/${tid}">Сэдэв рүү буцах</a></div></div>`;
      return;
    }
    const s = due[i], c = state.cards[key(s)] || { box: 0 }, det = s.details || {};
    const back = [
      s.description_mn ? `<p>${esc(s.description_mn)}</p>` : '',
      det.detail_type === 'muscle' ? `<dl class="facts">${['origin_mn', 'insertion_mn', 'action_mn', 'innervation_mn'].map(k => fact(FIELD_LABELS[k], det[k])).join('')}</dl>` : '',
      s.images[0] ? figureHTML(s.images[0], s.names.en) : '',
    ].join('');
    const other = state.lang === 'en' ? s.names.la : s.names.en;
    $app.innerHTML = `${crumbs([['#/', 'Нүүр'], ['#/t/' + tid, label], [null, 'Флэшкарт']])}
      <div class="stage ${sysClass(s.system)}">
        <div class="progress-line"><span>${i + 1} / ${due.length}</span><span>Хайрцаг ${c.box} / 5</span></div>
        <p class="card-front">${esc(nameOf(s.names))}</p>
        ${shown ? `<p class="card-sub">${esc(other || '')} · ${esc(KIND_LABELS[s.kind] || s.kind)}</p>${back}
          <div class="actions"><button class="btn bad" data-a="0">Мэдээгүй</button><button class="btn good" data-a="1">Мэдсэн</button></div>
          <p class="small report-line">${reportLink(s.id, 'Флэшкарт: ' + label, 'link')}</p>`
        : `<p class="card-sub">Энэ бүтцийн байрлал, үүргийг санаж байна уу?</p>
          <div class="actions"><button class="btn primary" data-a="show">Хариуг харах</button></div>`}
      </div>
      <p class="small">"Мэдсэн" бол карт дараагийн хайрцагт шилжиж, улам ховор гарна. "Мэдээгүй" бол эхний хайрцагт буцаж, маргааш дахин гарна.</p>`;
    $app.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      if (b.dataset.a === 'show') { shown = true; return render(); }
      const box = b.dataset.a === '1' ? Math.min(c.box + 1, 5) : 0;
      state.cards[key(s)] = { box, due: t + (b.dataset.a === '1' ? LEITNER_DAYS[box] : 1) };
      save(); i++; done++; shown = false; render();
    });
    bindZoom();
  };
  render();
}

// ---- Theory quiz ----
async function viewQuiz(tid) {
  const d = await topic(tid); if (!d) return notFound();
  const label = TOPIC_LABELS[tid] || d.topic.title.en;
  const weight = q => { const r = state.quiz[q.id]; return r ? (r.wrong ? 0 : 2) : 1; };
  const qs = shuffle(d.theory_questions).sort((a, b) => weight(a) - weight(b)).slice(0, 10);
  let i = 0, picked = new Set(), checked = false, score = 0;
  const render = async () => {
    if (i >= qs.length) {
      $app.innerHTML = `${crumbs([['#/', 'Нүүр'], ['#/t/' + tid, label], [null, 'Тест']])}
        <div class="stage ${sysClass(d.topic.system)}"><p class="small">Үр дүн</p><p class="score">${score} / ${qs.length}</p>
          <p>Буруу хариулсан асуултууд дараагийн тестэд түрүүлж гарна.</p>
          <div class="actions"><button class="btn primary" id="again">Дахин 10 асуулт</button><a class="btn" href="#/t/${tid}">Сэдэв рүү буцах</a></div></div>`;
      document.getElementById('again').onclick = () => viewQuiz(tid);
      return;
    }
    const q = qs[i], multi = q.correct_option_ids.length > 1, right = new Set(q.correct_option_ids);
    const isRight = () => picked.size === right.size && [...picked].every(x => right.has(x));
    const related = checked && q.structure_ids.length ? await linkList(d, q.structure_ids) : '';
    $app.innerHTML = `${crumbs([['#/', 'Нүүр'], ['#/t/' + tid, label], [null, 'Тест']])}
      <div class="stage ${sysClass(d.topic.system)}">
        <div class="progress-line"><span>${i + 1} / ${qs.length}</span><span>${verifiedBadge(q)}</span></div>
        <p class="stem">${esc(q.stem_mn)}</p>
        ${multi ? '<p class="small">Хэд хэдэн зөв хариулт байж болно.</p>' : ''}
        <div class="opts">${q.options.map(o => {
          let cls = '';
          if (checked) cls = right.has(o.id) ? 'right' : (picked.has(o.id) ? 'wrong' : '');
          return `<button class="opt ${cls}" data-o="${o.id}" aria-pressed="${picked.has(o.id)}" ${checked ? 'disabled' : ''}><span class="k">${o.id.toUpperCase()}</span><span>${esc(o.text_mn)}</span></button>`;
        }).join('')}</div>
        ${checked ? `<div class="explain"><p class="verdict ${isRight() ? 'ok' : 'no'}">${isRight() ? 'Зөв.' : 'Буруу.'}</p><p>${esc(q.explanation_mn)}</p>
          <p class="small">${q.sources.map(x => esc(x.locator)).join('; ')}</p>
          ${related}<p class="small report-line">${reportLink(q.id, 'Тест: ' + label, 'link')}</p></div>` : ''}
        <div class="actions">${checked ? `<button class="btn primary" id="next">${i + 1 < qs.length ? 'Дараагийн асуулт' : 'Дүнг харах'}</button>`
          : `<button class="btn primary" id="check" ${picked.size ? '' : 'disabled'}>Шалгах</button>`}</div>
      </div>`;
    $app.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
      const id = b.dataset.o;
      if (multi) picked.has(id) ? picked.delete(id) : picked.add(id); else picked = new Set([id]);
      render();
    });
    const chk = document.getElementById('check');
    if (chk) chk.onclick = () => { checked = true; const ok = isRight(); if (ok) score++; state.quiz[q.id] = { wrong: !ok, n: ((state.quiz[q.id] || {}).n || 0) + 1 }; save(); render(); };
    const nx = document.getElementById('next');
    if (nx) nx.onclick = () => { i++; picked = new Set(); checked = false; render(); };
  };
  await render();
}

// ---- Figure practice ----
async function viewLab(tid) {
  const d = await topic(tid); if (!d) return notFound();
  const label = TOPIC_LABELS[tid] || d.topic.title.en;
  const qs = shuffle(d.practical_questions).sort((a, b) => ((state.lab[a.id] || {}).ok ? 1 : 0) - ((state.lab[b.id] || {}).ok ? 1 : 0));
  let i = 0, revealed = false, found = 0;
  const render = () => {
    if (i >= qs.length || !qs.length) {
      $app.innerHTML = `${crumbs([['#/', 'Нүүр'], ['#/t/' + tid, label], [null, 'Зураг таних']])}
        <div class="stage"><h1>${qs.length ? 'Бүх зургийг үзлээ' : 'Энэ сэдэвт зураг алга'}</h1>${qs.length ? `<p class="score">${found} / ${qs.length}</p>` : ''}
        <div class="actions"><a class="btn" href="#/t/${tid}">Сэдэв рүү буцах</a></div></div>`;
      return;
    }
    const q = qs[i], s = d.byId[q.structure_id] || { names: q.answer, system: d.topic.system };
    $app.innerHTML = `${crumbs([['#/', 'Нүүр'], ['#/t/' + tid, label], [null, 'Зураг таних']])}
      <div class="stage ${sysClass(s.system)}">
        <div class="progress-line"><span>${i + 1} / ${qs.length}</span><span>${verifiedBadge(q)}</span></div>
        <p class="stem">Зураг дээрээс <span class="latin">${esc(nameOf(q.answer))}</span>${q.answer.en && q.answer.en !== nameOf(q.answer) ? ` <span class="small">(${esc(q.answer.en)})</span>` : ''} бүтцийг олоорой.</p>
        <p class="small">Зурган дээрх шошго англиар бичигдсэн.</p>
        ${figureHTML(q.image, '')}
        ${revealed ? `<p>${esc(s.description_mn || '')}</p>
          <div class="actions"><button class="btn bad" data-a="0">Олсонгүй</button><button class="btn good" data-a="1">Олсон</button></div>
          <p class="small report-line">${reportLink(q.id, 'Зураг таних: ' + label + ' — ' + q.image.file, 'link')}</p>`
        : `<div class="actions"><button class="btn primary" data-a="show">Тайлбар харах</button><button class="btn" data-a="skip">Алгасах</button></div>`}
      </div>
      <p class="note">Одоогийн зургууд дээр нэр нь бичигдсэн байгаа тул энэ горим бол нэрийг байрлалтай холбох дасгал. Шошгогүй зураг, сумаар заасан жинхэнэ лабораторийн горим дараагийн хувилбарт нэмэгдэнэ.</p>`;
    $app.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'show') { revealed = true; return render(); }
      if (a !== 'skip') { state.lab[q.id] = { ok: a === '1' }; if (a === '1') found++; save(); }
      i++; revealed = false; render();
    });
    bindZoom();
  };
  render();
}

let unmount3d = null;
async function view3d(modelId, from) {
  const m = (await models()).find(x => x.id === modelId); if (!m) return notFound();
  const tid = from && m.topics.includes(from) ? from : m.topics[0];
  const label = TOPIC_LABELS[tid] || tid;
  $app.innerHTML = `${crumbs([['#/', 'Нүүр'], ['#/t/' + tid, label], [null, '3D загвар']])}
    <div class="${sysClass('bones')}"><h1>3D загвар: ${esc(m.label || '')}</h1>
    <p class="lead">${esc(m.hint || '')}</p>
    <div id="v3d-host"></div>
    <p class="small">3D загвар: Z-Anatomy (CC BY-SA 4.0), BodyParts3D © The Database Center for Life Science (CC BY-SA 2.1 JP).</p></div>`;
  const mod = await import('./viewer3d.js');
  unmount3d = await mod.mount(document.getElementById('v3d-host'), modelId);
}

async function viewAbout() {
  const src = Object.values(await sources());
  $app.innerHTML = `${crumbs([['#/', 'Нүүр'], [null, 'Эх сурвалж, лиценз']])}
    <h1>Эх сурвалж, лиценз</h1>
    <p class="lead">Энэ апп-ын агуулга нээлттэй эх сурвалжаас бэлтгэгдсэн бөгөөд анатомийн багш хараахан шалгаагүй. Бичлэг бүр "Шалгагдаагүй" гэсэн тэмдэгтэй, эх сурвалжийн байршил нь бичлэг бүрийн доор бий.</p>
    ${src.map(s => `<h3>${esc(s.title)}</h3><p class="small">${esc(s.publisher || '')}${s.license ? ' · Лиценз: ' + esc(s.license) : ''}<br>
      ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a>` : esc(s.note || '')}</p>`).join('')}
    <h3>Туршилтын хувилбар</h3>
    <p class="small">Энэ апп туршилтын (бета) шатандаа байна. Агуулгыг шалгалтад бэлдэхдээ сурах бичигтэйгээ тулгаж хэрэглээрэй. Алдаа олвол тухайн хуудсан дээрх "Алдаа мэдээлэх" товчийг дарна уу — ингэснээр агуулга хүн бүрт засагдана.</p>
    <h3>Ашиглах нөхцөл</h3>
    <p class="small">Агуулга: CC BY-NC-SA 4.0 — арилжааны бус, эх сурвалжийг дурдаж, ижил лицензээр түгээнэ. Програмын код: MIT. Анатомийн зургууд: OpenStax Anatomy and Physiology 2e, Betts et al., Rice University.</p>
    <h3>Хувийн мэдээлэл</h3>
    <p class="small">Таны ахиц зөвхөн энэ төхөөрөмжийн хөтөчид хадгалагдана. Сервер рүү юу ч илгээгдэхгүй.</p>
    <div class="actions"><button class="btn bad" id="reset">Ахицыг устгах</button></div>`;
  document.getElementById('reset').onclick = () => {
    if (confirm('Флэшкарт, тест, зургийн бүх ахицыг энэ төхөөрөмжөөс устгах уу?')) { state.cards = {}; state.quiz = {}; state.lab = {}; save(); location.hash = '#/'; }
  };
}

function notFound() {
  $app.innerHTML = `<h1>Хуудас олдсонгүй</h1><p>Холбоос буруу эсвэл агуулга шинэчлэгдсэн байж магадгүй.</p><p><a class="btn" href="#/">Нүүр хуудас руу</a></p>`;
}

// ---------- zoom ----------
function bindZoom() {
  const dlg = document.getElementById('zoom');
  $app.querySelectorAll('[data-zoom]').forEach(img => img.onclick = () => {
    dlg.querySelector('img').src = img.src; dlg.querySelector('img').alt = img.alt;
    dlg.showModal();
  });
}
document.querySelector('#zoom .close').onclick = () => document.getElementById('zoom').close();
document.getElementById('zoom').addEventListener('click', e => { if (e.target.tagName === 'DIALOG') e.target.close(); });

// ---------- language ----------
function syncLang() {
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
}
document.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { state.lang = b.dataset.lang; save(); syncLang(); route(); });

// ---------- router ----------
async function route() {
  const [h, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const p = h.split('/');
  await loadFeedback();
  if (unmount3d) { try { unmount3d(); } catch { /* ignore */ } unmount3d = null; }
  try {
    if (!h) await viewHome();
    else if (p[0] === '3d') await view3d(p[1], new URLSearchParams(qs || '').get('from'));
    else if (p[0] === 'about') await viewAbout();
    else if (p[0] === 't' && p[2] === 's') await viewStructure(p[1], p[3]);
    else if (p[0] === 't' && p[2] === 'cards') await viewCards(p[1]);
    else if (p[0] === 't' && p[2] === 'quiz') await viewQuiz(p[1]);
    else if (p[0] === 't' && p[2] === 'lab') await viewLab(p[1]);
    else if (p[0] === 't') await viewTopic(p[1]);
    else notFound();
    bindZoom();
  } catch (e) {
    console.error(e);
    $app.innerHTML = `<h1>Агуулга ачаалагдсангүй</h1><p>Интернэт холболтоо шалгаад хуудсыг дахин ачаална уу. Апп-ыг нэг удаа онлайнаар нээсэн бол дараа нь офлайнаар ажиллана.</p>`;
  }
  if (!p[2] || p[2] === 's') window.scrollTo(0, 0);
}
window.AMN = { topic, nameOf, esc, shuffle, fact, verifiedBadge, reportLink, get state() { return state; } };
window.addEventListener('hashchange', route);
syncLang();
route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
