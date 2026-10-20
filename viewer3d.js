/* 3D горим: Z-Anatomy-ийн загварыг (CC BY-SA) Three.js-ээр харуулна.
   Хэсэг бүрийг models/<id>.map.json-оор атласын бүтэцтэй холбоно.
   Эмнэлгийн мэдээлэл энд бичихгүй — нэр, тайлбар data/*.json-оос ирнэ. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const KIND_TEXT = { bone: 'яс', landmark: 'ясны хэсэг', origin: 'булчингийн эхлэл', insertion: 'булчингийн бэхлэл' };

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

export async function mount(container, modelId, opts = {}) {
  const A = window.AMN;
  const reg = await (await fetch('models/index.json')).json();
  const model = reg.models.find(m => m.id === modelId);
  if (!model) throw new Error('model ' + modelId);
  const map = await (await fetch(model.map)).json();
  const topics = {};
  for (const t of new Set(map.filter(x => x.topic).map(x => x.topic))) topics[t] = await A.topic(t);
  const rec = x => x && x.topic && topics[x.topic] ? topics[x.topic].byId[x.structure_id] : null;
  const label = x => { const r = rec(x); return r ? A.nameOf(r.names) : x.name; };

  container.innerHTML = `
    <div class="v3d">
      <div class="v3d-canvas" tabindex="0" aria-label="3D загвар — чирж эргүүлнэ, хоёр хуруугаар томруулна"></div>
      <p class="v3d-status small">Загвар ачаалж байна…</p>
      <div class="v3d-tools" role="group" aria-label="Харагдац">
        <button class="chip" data-t="att" aria-pressed="false">Булчингийн бэхэлгээ</button>
        <button class="chip" data-t="pins" aria-pressed="false">Ясны хэсгүүд</button>
        <button class="chip" data-t="reset">Анхны байрлал</button>
        <button class="chip" data-t="explode" aria-pressed="false">Задлах</button>
        <button class="chip" data-t="quiz" aria-pressed="false">Таних тест</button>
        <button class="chip" data-t="showall" hidden>Бүх ясыг харуулах</button>
      </div>
      <label class="v3d-explode small" hidden>Задралын хэмжээ <input type="range" min="0" max="100" value="60" aria-label="Задралын хэмжээ"></label>
      <div class="v3d-legend small" hidden><span class="dot o"></span> эхлэл <span class="dot e"></span> бэхлэл</div>
      <div class="v3d-panel" aria-live="polite"></div>
    </div>`;
  const $c = container.querySelector('.v3d-canvas');
  const $status = container.querySelector('.v3d-status');
  const $panel = container.querySelector('.v3d-panel');
  const $legend = container.querySelector('.v3d-legend');

  // ---- scene ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  $c.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1, 2, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(-2, 1, -2); scene.add(rim);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12; controls.screenSpacePanning = true;

  const boneMat = new THREE.MeshStandardMaterial({ color: 0xE9DFC9, roughness: 0.72, metalness: 0 });
  const hiMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.55, emissive: 0x553300, emissiveIntensity: 0.35 });
  const dimMat = new THREE.MeshStandardMaterial({ color: 0xE9DFC9, roughness: 0.8, transparent: true, opacity: 0.28, depthWrite: false });
  const attMat = kind => new THREE.MeshStandardMaterial({
    color: new THREE.Color(kind === 'origin' ? (css('--muscles') || '#B3261E') : (css('--joints') || '#2C5FA8')),
    roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, transparent: true, opacity: 0.92,
  });
  const attHi = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await new Promise((res, rej) => loader.load(model.file, res,
      e => { if (e.total) $status.textContent = `Загвар ачаалж байна… ${Math.round(100 * e.loaded / e.total)}%`; }, rej));
  } catch (e) {
    $status.textContent = 'Загвар ачаалагдсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.'; throw e;
  }
  const root = gltf.scene; scene.add(root);
  // GLTFLoader нь node-ийн нэрийг цэвэрлэдэг ("Clavicle.r" → "Clavicler"), тиймээс ижил аргаар түлхүүр үүсгэнэ
  const byNode = new Map(map.map(x => [THREE.PropertyBinding.sanitizeNodeName(x.node), x]));
  const pickables = [], attachments = [], bones = [], contextMeshes = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    // FBX2glTF нь mesh-ийг node-ийн дор хүүхэд болгодог тул нэрийг дээш хайна
    let n = o, info = null;
    while (n && !(info = byNode.get(n.name)) ) n = n.parent;
    if (!info) { o.visible = false; return; }
    o.userData.info = info;
    if (info.kind === 'bone') { o.material = boneMat; bones.push(o); pickables.push(o); }
    else if (info.kind === 'context') { o.material = boneMat; contextMeshes.push(o); } // харагдацад (жишээ нь шүд), сонгогдохгүй
    else if (info.kind === 'origin' || info.kind === 'insertion') {
      if (!info.structure_id) { o.visible = false; return; }
      o.material = attMat(info.kind); o.userData.base = o.material; o.visible = false; attachments.push(o);
    } else o.visible = false;
  });

  // ---- framing ----
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const radius = size.length() / 2;
  function focus(obj, context = 2.2) {
    const b = new THREE.Box3();
    if (obj.parent === pins) b.setFromCenterAndSize(obj.position, new THREE.Vector3(1, 1, 1).multiplyScalar(radius * 0.12));
    else b.setFromObject(obj);
    const r = Math.min(Math.max(b.getSize(new THREE.Vector3()).length() / 2 * context, radius * 0.08), radius);
    const target = b.getCenter(new THREE.Vector3());
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
    controls.target.copy(target); camera.position.copy(target).add(dir.multiplyScalar(dist)); controls.update(); render();
  }
  function frame(target = center, r = radius) {
    const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.95;
    camera.near = dist / 200; camera.far = dist * 20; camera.updateProjectionMatrix();
    camera.position.copy(target).add(new THREE.Vector3(0, 0, dist)); // урдаас (anterior)
    controls.target.copy(target); controls.update(); render();
  }

  // ---- landmark pins ----
  const pinGeo = new THREE.SphereGeometry(radius * 0.012, 16, 12);
  const pinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(css('--joints') || '#2C5FA8'), depthTest: false });
  const pinHi = new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false });
  const pins = new THREE.Group(); pins.visible = false; pins.renderOrder = 10; scene.add(pins);
  const landmarks = map.filter(x => x.kind === 'landmark' && x.structure_id && x.pos && rec(x) && rec(x).kind !== 'bone');
  for (const l of landmarks) {
    const m = new THREE.Mesh(pinGeo, pinMat); m.position.fromArray(l.pos); m.userData.info = l; m.renderOrder = 10; pins.add(m);
  }

  // ---- parts: яс бүрийн node (mesh-үүдийн эцэг) — задлах, тусгаарлахад ашиглана ----
  const partOf = o => { let n = o; while (n && !byNode.get(n.name)) n = n.parent; return n; };
  const parts = new Map(); // node name -> { obj, base, worldCenter, off(world) }
  for (const m of [...bones, ...contextMeshes]) {
    const obj = partOf(m); const key = m.userData.info.node;
    if (!obj || parts.has(key)) continue;
    const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    parts.set(key, { obj, base: obj.position.clone(), c, kind: m.userData.info.kind });
  }
  const boneParts = [...parts.entries()].filter(([, p]) => p.kind === 'bone');
  for (const [, p] of parts) {
    if (p.kind === 'bone') p.offW = p.c.clone().sub(center).multiplyScalar(0.9);
    else { // харагдацын хэсгийг (шүд) хамгийн ойрын ястай хамт хөдөлгөнө
      const near = boneParts.reduce((a, b) => (b[1].c.distanceTo(p.c) < a[1].c.distanceTo(p.c) ? b : a));
      p.offW = near[1].c.clone().sub(center).multiplyScalar(0.9);
    }
    const a = p.obj.parent.worldToLocal(p.c.clone()), b = p.obj.parent.worldToLocal(p.c.clone().add(p.offW));
    p.offL = b.sub(a);
  }
  for (const pin of pins.children) pin.userData.base = pin.position.clone();
  let explodeT = 0;
  function setExplode(t) {
    explodeT = t;
    for (const [, p] of parts) p.obj.position.copy(p.base).addScaledVector(p.offL, t);
    for (const pin of pins.children) { const p = parts.get(pin.userData.info.bone); pin.position.copy(pin.userData.base); if (p) pin.position.addScaledVector(p.offW, t); }
    render();
  }
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let anim = 0;
  function animateExplode(to) {
    cancelAnimationFrame(anim);
    if (reduceMotion) return setExplode(to);
    const from = explodeT, t0 = performance.now();
    (function step(now) { const k = Math.min(1, (now - t0) / 450), e = 1 - Math.pow(1 - k, 3); setExplode(from + (to - from) * e); if (k < 1) anim = requestAnimationFrame(step); })(t0);
  }
  // ---- тусгаарлах: зөвхөн нэг ясыг харуулна ----
  let isolated = null;
  function isolate(node) {
    isolated = node;
    for (const [k, p] of parts) p.obj.visible = !node || k === node;
    for (const pin of pins.children) pin.visible = !node || pin.userData.info.bone === node;
    const sa = container.querySelector('[data-t=showall]'); if (sa) sa.hidden = !node;
    render();
  }

  // ---- render loop (only when needed) ----
  let needs = true;
  function render() { needs = true; }
  function resize() {
    const w = $c.clientWidth, h = $c.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); render();
  }
  let alive = true;
  (function loop() {
    if (!alive) return;
    requestAnimationFrame(loop);
    if (controls.update() || needs) {
      // цэгийн хэмжээг камерын зайтай уялдуулж, ойртоход ч жижиг хэвээр үлдээнэ
      const k = camera.position.distanceTo(controls.target) / (radius * 2.4);
      for (const p of pins.children) p.scale.setScalar(Math.min(1, k) * (p.material === pinHi ? 1.4 : 1));
      renderer.render(scene, camera); needs = false;
    }
  })();
  controls.addEventListener('change', render);
  const ro = new ResizeObserver(resize); ro.observe($c);
  resize(); frame();
  $status.textContent = `${new Set(bones.map(b => b.userData.info.node)).size} яс · ${landmarks.length} ясны хэсэг · ${attachments.length} булчингийн бэхэлгээ. Дарж сонгоно, чирж эргүүлнэ.`;

  // ---- selection ----
  let selected = [];
  function undim() { for (const b of [...bones, ...contextMeshes]) if (b.material === dimMat) b.material = boneMat; }
  // нэг яс олон mesh-ээс (primitive) бүрдэж болно — бүгдийг нь хамт сонгоно
  const meshesOf = o => o.userData.info && o.userData.info.kind === 'bone' ? bones.filter(b => b.userData.info.node === o.userData.info.node) : [o];
  function clearSel() {
    undim();
    for (const o of selected) o.material = o.userData.info.kind === 'bone' ? boneMat : (o.isMesh && o.parent === pins ? pinMat : o.userData.base);
    selected = [];
  }
  function highlight(objs) {
    clearSel();
    for (const o of objs) o.material = o.parent === pins ? pinHi : (o.userData.info.kind === 'bone' ? hiMat : attHi);
    selected = objs; render();
  }
  function describe(info) {
    const r = rec(info);
    const sameMuscle = info.structure_id && (info.kind === 'origin' || info.kind === 'insertion') ? attachments.filter(a => a.userData.info.structure_id === info.structure_id) : [];
    const seen = new Set();
    const bonePins = info.kind === 'bone' ? landmarks.filter(l => rec(l) && rec(l).parent_id === info.structure_id || l.bone === info.node).filter(l => !seen.has(l.structure_id) && seen.add(l.structure_id)) : [];
    const det = r && r.details || {};
    $panel.innerHTML = `
      <p class="v3d-name latin">${A.esc(label(info))}</p>
      <p class="small">${A.esc(KIND_TEXT[info.kind] || '')}${info.part_of ? ' (хэсэг)' : ''} · загварт: ${A.esc(info.name)} ${r ? A.verifiedBadge(r) : ''}</p>
      ${r && r.description_mn ? `<p>${A.esc(r.description_mn)}</p>` : ''}
      ${(info.kind === 'origin' || info.kind === 'insertion') && r ? `<dl class="facts">${A.fact('Эхлэл', det.origin_mn)}${A.fact('Бэхлэл', det.insertion_mn)}${A.fact('Үйл ажиллагаа', det.action_mn)}</dl>` : ''}
      ${bonePins.length ? `<p class="small">Энэ ясны хэсгүүд:</p><div class="links">${bonePins.map(l => `<button class="chip" data-pin="${A.esc(l.node)}">${A.esc(label(l))}</button>`).join('')}</div>` : ''}
      <div class="actions">
        <button class="btn" data-focus>Ойртож харах</button>
        ${info.kind === 'bone' ? `<button class="btn" data-iso>${isolated === info.node ? 'Бүх ясыг харуулах' : 'Зөвхөн энэ ясыг харах'}</button>` : ''}
        ${r ? `<a class="btn" href="#/t/${info.topic}/s/${info.structure_id}">Атласаар дэлгэрэнгүй</a>` : ''}
        ${sameMuscle.length > 1 ? `<button class="btn" data-both>Эхлэл ба бэхлэлийг харуулах</button>` : ''}
      </div>
      ${A.reportLink ? `<p class="small report-line">${A.reportLink(info.structure_id || info.node, '3D: ' + modelId + ' — ' + info.name, 'link')}</p>` : ''}`;
    $panel.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => {
      const p = pins.children.find(m => m.userData.info.node === b.dataset.pin);
      pins.visible = true; setPressed('pins', true); highlight([p]); describe(p.userData.info);
    });
    const fb = $panel.querySelector('[data-focus]');
    if (fb) fb.onclick = () => selected[0] && focus(selected[0]);
    const iso = $panel.querySelector('[data-iso]');
    if (iso) iso.onclick = () => {
      if (isolated === info.node) { isolate(null); frame(); } else { isolate(info.node); focus(selected[0] || parts.get(info.node).obj, 1.6); }
      describe(info);
    };
    const both = $panel.querySelector('[data-both]');
    if (both) both.onclick = () => { showAtt(true); highlight(sameMuscle); };
  }

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const targets = [...(pins.visible ? pins.children : []), ...attachments.filter(a => a.visible), ...bones];
    const hit = ray.intersectObjects(targets.filter(o => { let n = o; while (n) { if (!n.visible) return false; n = n.parent; } return true; }), false)[0];
    if (!hit) { clearSel(); render(); $panel.innerHTML = ''; return; }
    if (quiz.on) return quizAnswerClick(hit.object);
    highlight(meshesOf(hit.object)); describe(hit.object.userData.info);
  });

  // ---- tools ----
  const tools = container.querySelector('.v3d-tools');
  function setPressed(t, v) { const b = tools.querySelector(`[data-t=${t}]`); if (b) b.setAttribute('aria-pressed', String(v)); }
  function showAtt(v) { attachments.forEach(a => a.visible = v); setPressed('att', v); $legend.hidden = !v; render(); }
  tools.querySelector('[data-t=att]').onclick = e => showAtt(e.currentTarget.getAttribute('aria-pressed') !== 'true');
  tools.querySelector('[data-t=pins]').onclick = e => { pins.visible = e.currentTarget.getAttribute('aria-pressed') !== 'true'; setPressed('pins', pins.visible); render(); };
  tools.querySelector('[data-t=reset]').onclick = () => { isolate(null); setPressed('explode', false); container.querySelector('.v3d-explode').hidden = true; animateExplode(0); frame(); };
  const $ex = container.querySelector('.v3d-explode'), $range = $ex.querySelector('input');
  tools.querySelector('[data-t=explode]').onclick = e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    setPressed('explode', on); $ex.hidden = !on; const t = on ? $range.value / 100 : 0;
    animateExplode(t); if (!isolated) frame(center, radius * (1 + 0.9 * t));
  };
  $range.oninput = () => { cancelAnimationFrame(anim); setExplode($range.value / 100); };
  $range.onchange = () => { if (!isolated) frame(center, radius * (1 + 0.9 * $range.value / 100)); };
  tools.querySelector('[data-t=showall]').onclick = () => { isolate(null); frame(); if (selected[0]) describe(selected[0].userData.info); };
  tools.querySelector('[data-t=quiz]').onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; setPressed('quiz', on); on ? startQuiz() : stopQuiz(); };

  // ---- 3D identification quiz ----
  const quiz = { on: false, item: null, score: 0, n: 0 };
  const quizPool = () => [
    ...[...new Map(bones.filter(b => !b.userData.info.part_of).map(o => [o.userData.info.node, o])).values()].map(o => ({ obj: o, info: o.userData.info })),
    ...pins.children.map(o => ({ obj: o, info: o.userData.info })),
  ];
  function startQuiz() { isolate(null); quiz.on = true; quiz.score = 0; quiz.n = 0; showAtt(false); nextQ(); }
  function stopQuiz() { quiz.on = false; pins.children.forEach(p => p.visible = true); pins.visible = false; setPressed('pins', false); clearSel(); render(); $panel.innerHTML = ''; }
  function nextQ() {
    const pool = quizPool();
    const item = pool[Math.floor(Math.random() * pool.length)];
    quiz.item = item;
    pins.visible = item.obj.parent === pins; setPressed('pins', pins.visible);
    if (pins.visible) pins.children.forEach(p => p.visible = p === item.obj);
    highlight(meshesOf(item.obj)); frame(); focus(item.obj, item.obj.parent === pins ? 4 : 3.5);
    // бусад ясыг тунгалаг болгож, тодруулсан хэсгийг далдлагдахаас сэргийлнэ
    const target = item.obj.parent === pins ? item.info.bone : item.info.node;
    for (const b of bones) if (b.userData.info.node !== target) b.material = dimMat;
    for (const c of contextMeshes) c.material = dimMat;
    const same = pool.filter(p => p.info.kind === item.info.kind && p.info.structure_id !== item.info.structure_id);
    const opts = A.shuffle([item, ...A.shuffle(same).slice(0, 3)]);
    $panel.innerHTML = `<div class="progress-line"><span>Таних тест · ${quiz.score} / ${quiz.n}</span></div>
      <p class="stem">Шараар тодруулсан ${item.info.kind === 'bone' ? 'яс' : 'цэгийн ясны хэсэг'} аль нь вэ?</p>
      <div class="opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${'ABCD'[i]}</span><span class="latin">${A.esc(label(o.info))}</span></button>`).join('')}</div>`;
    $panel.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const pick = opts[+b.dataset.i], ok = pick.info.structure_id === item.info.structure_id;
      quiz.n++; if (ok) quiz.score++;
      $panel.querySelectorAll('[data-i]').forEach(x => { x.disabled = true; const o = opts[+x.dataset.i]; if (o.info.structure_id === item.info.structure_id) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
      $panel.insertAdjacentHTML('beforeend', `<div class="explain"><p class="verdict ${ok ? 'ok' : 'no'}">${ok ? 'Зөв.' : 'Буруу.'}</p>
        <div class="actions"><button class="btn primary" data-next>Дараагийнх</button><a class="btn" href="#/t/${item.info.topic}/s/${item.info.structure_id}">Атласаар үзэх</a></div></div>`);
      $panel.querySelector('[data-next]').onclick = () => { pins.children.forEach(p => p.visible = true); nextQ(); };
    });
    render();
  }
  function quizAnswerClick() { /* тест үед загвар дээр дарахад сонголт өөрчлөгдөхгүй */ }

  return () => { alive = false; ro.disconnect(); controls.dispose(); renderer.dispose(); };
}
