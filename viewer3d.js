/* 3D горим: Z-Anatomy-ийн загварыг (CC BY-SA) Three.js-ээр харуулна.
   Загвар нь нэг эсвэл хэд хэдэн давхаргаас (яс, булчин, үе) бүрдэнэ — models/index.json.
   Хэсэг бүрийг models/<layer>.map.json-оор атласын бүтэцтэй холбоно.
   Эмнэлгийн мэдээлэл энд бичихгүй — нэр, тайлбар data/*.json-оос ирнэ. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const KIND_TEXT = {
  bone: 'яс', 'bone-landmark': 'ясны хэсэг', 'skeleton-division': 'араг ясны хэсэг', cartilage: 'мөгөөрс',
  joint: 'үе', 'joint-part': 'үений хэсэг', ligament: 'холбоос', 'tendon-fascia': 'шөрмөс, фасци',
  muscle: 'булчин', 'muscle-group': 'булчингийн бүлэг', origin: 'булчингийн эхлэл', insertion: 'булчингийн бэхлэл',
  'brain-part': 'тархины хэсэг', 'spinal-cord-part': 'нугасны хэсэг', nerve: 'мэдрэл', ganglion: 'зангилаа',
  meninx: 'бүрхүүл', ventricle: 'ховдол', vessel: 'судас', tract: 'зам',
};
const NERVE_KINDS = new Set(['nerve', 'ganglion']);
const NEURO_KINDS = new Set(['brain-part', 'spinal-cord-part', 'meninx', 'ventricle', 'vessel', 'tract', 'nerve', 'ganglion']);
const MUSCLE_KINDS = new Set(['muscle', 'muscle-group', 'tendon-fascia']);
const SOFT_KINDS = new Set(['ligament', 'joint', 'joint-part']);

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

export async function mount(container, modelId) {
  const A = window.AMN;
  const reg = await (await fetch('models/index.json')).json();
  const model = reg.models.find(m => m.id === modelId);
  if (!model) throw new Error('model ' + modelId);
  const layerDefs = model.layers.map(id => ({ id, ...reg.layers[id] }));
  const maps = await Promise.all(layerDefs.map(l => fetch(l.map).then(r => r.json())));
  maps.forEach((m, li) => m.forEach(x => { x.layer = li; }));
  const topics = {};
  for (const t of new Set(maps.flat().filter(x => x.topic).map(x => x.topic))) topics[t] = await A.topic(t);
  const rec = x => x && x.topic && topics[x.topic] ? topics[x.topic].byId[x.structure_id] : null;
  const label = x => { const r = rec(x); return r ? A.nameOf(r.names) : x.name; };
  const kindOf = x => x.kind === 'bone' ? ((rec(x) || {}).kind || 'bone') : x.kind; // "bone" = загварын дээд түвшний хэсэг

  container.innerHTML = `
    <div class="v3d">
      <div class="v3d-canvas" tabindex="0" aria-label="3D загвар — чирж эргүүлнэ, хоёр хуруугаар томруулна"></div>
      <p class="v3d-status small">Загвар ачаалж байна…</p>
      ${layerDefs.length > 1 ? `<div class="v3d-tools" role="group" aria-label="Давхарга">${layerDefs.map((l, i) =>
        `<button class="chip" data-layer="${i}" aria-pressed="true">${A.esc(l.label)}</button>`).join('')}</div>` : ''}
      <div class="v3d-tools" role="group" aria-label="Харагдац" data-tools>
        <button class="chip" data-t="att" aria-pressed="false" hidden>Булчингийн бэхэлгээ</button>
        <button class="chip" data-t="pins" aria-pressed="false" hidden>Ясны хэсгүүд</button>
        <button class="chip" data-t="reset">Анхны байрлал</button>
        <button class="chip" data-t="explode" aria-pressed="false">Задлах</button>
        <button class="chip" data-t="quiz" aria-pressed="false">Таних тест</button>
        <button class="chip" data-t="showall" hidden>Бүгдийг харуулах</button>
      </div>
      ${model.clip ? `<label class="v3d-explode v3d-clip small">Хөндлөн огтлол <input type="range" min="0" max="100" value="88" aria-label="Хөндлөн огтлолын түвшин"></label>` : ''}
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

  // DoubleSide: зарим загварт нормаль урвуу (жишээ нь эгэм) — хоёр талаас нь гэрэлтүүлнэ
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, side: THREE.DoubleSide,
    clippingPlanes: model.clip ? [clipPlane] : null, ...extra });
  // тархины хэсгүүдийг ялгахын тулд бүтэц бүрд ойролцоо (ягаан-шаргал) өөр өнгө өгнө
  const brainMats = new Map();
  const brainMatFor = sid => {
    if (!brainMats.has(sid)) {
      let h = 0; for (const ch of sid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const c = new THREE.Color().setHSL((0.93 + (h % 1000) / 1000 * 0.22) % 1, 0.42 + (h >> 10) % 100 / 100 * 0.3, 0.62 + (h >> 17) % 100 / 100 * 0.16);
      brainMats.set(sid, std(c, { roughness: 0.6 }));
    }
    return brainMats.get(sid);
  };
  const muscleColor = new THREE.Color(css('--muscles') || '#B3261E').lerp(new THREE.Color(0xffffff), 0.18);
  const MAT = {
    bone: std(0xE9DFC9),
    muscle: std(muscleColor, { roughness: 0.55 }),
    soft: std(new THREE.Color(css('--joints') || '#2C5FA8').lerp(new THREE.Color(0xffffff), 0.55), { roughness: 0.5 }),
    ctxBone: std(0xD9D3C7, { transparent: true, opacity: 0.85 }),
    ctxMuscle: std(0xB89A96, { roughness: 0.6 }),
    ctxSoft: std(0xC9CED4, { roughness: 0.6 }),
    ghostBone: std(0xE9DFC9, { transparent: true, opacity: 0.35, depthWrite: false }),
    // мэдрэлийн тогтолцоо: мэдрэл = шар (атласын уламжлал), тархи = цайвар ягаан-саарал
    nerve: std(new THREE.Color(css('--nerves') || '#7A6500').lerp(new THREE.Color(0xffe680), 0.55), { roughness: 0.5 }),
    ctxNerve: std(0xD8D0A8, { roughness: 0.6 }),
    brain: std(0xE6C3BC, { roughness: 0.6 }),
    ctxBrain: std(0xCFC6C4, { roughness: 0.65 }),
  };
  // мэдрэл шар өнгөтэй тул мэдрэлийн давхаргад тодруулгыг цэнхэр болгоно
  const tintOf = info => layerDefs[info.layer].tint || '';
  const ghostLayers = new Set((model.ghost || []).map(id => model.layers.indexOf(id)));
  const hiMat = std(0xffd23f, { roughness: 0.55, emissive: 0x553300, emissiveIntensity: 0.35 });
  const hiNerve = std(0x2fb8ff, { roughness: 0.5, emissive: 0x003355, emissiveIntensity: 0.4 });
  const hiFor = info => tintOf(info) === 'nerve' ? hiNerve : hiMat;
  const hiWord = info => tintOf(info) === 'nerve' ? 'Цэнхэрээр' : 'Шараар';
  const dimMat = std(0xE9DFC9, { roughness: 0.8, transparent: true, opacity: 0.22, depthWrite: false });
  const attMat = kind => std(new THREE.Color(kind === 'origin' ? (css('--muscles') || '#B3261E') : (css('--joints') || '#2C5FA8')),
    { roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, transparent: true, opacity: 0.92 });
  const attHi = std(0xffd23f, { roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const baseMatFor = info => {
    const k = kindOf(info), matched = !!info.structure_id, tint = tintOf(info);
    if (tint === 'nerve' || NERVE_KINDS.has(k)) return matched ? MAT.nerve : MAT.ctxNerve;
    if (tint === 'brain' || NEURO_KINDS.has(k)) return matched ? brainMatFor(info.structure_id) : MAT.ctxBrain;
    if (MUSCLE_KINDS.has(k) || layerDefs[info.layer].id.startsWith('muscles')) return matched ? MAT.muscle : MAT.ctxMuscle;
    if (SOFT_KINDS.has(k) || layerDefs[info.layer].id === 'joints') return matched ? MAT.soft : MAT.ctxSoft;
    if (ghostLayers.has(info.layer)) return MAT.ghostBone;
    return matched ? MAT.bone : MAT.ctxBone;
  };

  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const pickables = [], attachments = [], contextMeshes = [], layerRoots = [];
  let loaded = 0;
  for (let li = 0; li < layerDefs.length; li++) {
    let gltf;
    try {
      gltf = await new Promise((res, rej) => loader.load(layerDefs[li].file, res, e => {
        if (e.total) $status.textContent = `Загвар ачаалж байна… ${Math.round(100 * (loaded + e.loaded / e.total) / layerDefs.length)}%`;
      }, rej));
    } catch (e) {
      $status.textContent = 'Загвар ачаалагдсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.'; throw e;
    }
    loaded++;
    const root = gltf.scene; root.userData.layer = li; scene.add(root); layerRoots.push(root);
    // GLTFLoader нь node-ийн нэрийг цэвэрлэдэг ("Clavicle.r" → "Clavicler"), тиймээс ижил аргаар түлхүүр үүсгэнэ
    const byNode = new Map(maps[li].map(x => [THREE.PropertyBinding.sanitizeNodeName(x.node), x]));
    root.traverse(o => {
      if (!o.isMesh) return;
      let n = o, info = null;
      while (n && !(info = byNode.get(n.name))) n = n.parent;
      if (!info) { o.visible = false; return; }
      o.userData.info = info; o.userData.part = n;
      // зарим хэсгийн (жишээ нь эгэм) нормаль загварт буруу — геометрээс дахин тооцоолно
      // нимгэн мэдрэлийн хоолойд (квантчилсан байрлал) дахин тооцсон нормаль тэг болдог — файлын нормалийг хэвээр үлдээнэ
      if ((info.kind === 'bone' || info.kind === 'context') && !layerDefs[li].tint) o.geometry.computeVertexNormals();
      if (info.kind === 'bone') {
        o.material = baseMatFor(info); o.userData.base = o.material;
        if (info.structure_id) pickables.push(o); else contextMeshes.push(o);
      } else if (info.kind === 'context') { o.material = MAT.bone; o.userData.base = o.material; contextMeshes.push(o); }
      else if (info.kind === 'origin' || info.kind === 'insertion') {
        if (!info.structure_id) { o.visible = false; return; }
        o.material = attMat(info.kind); o.userData.base = o.material; o.visible = false; attachments.push(o);
      } else o.visible = false;
    });
  }
  const allParts = [...pickables, ...contextMeshes];

  // ---- framing ----
  // model.frame: зөвхөн эдгээр давхаргад тааруулж харуулна (жишээ нь тархи — vagus доош үргэлжилдэг)
  const frameIdx = (model.frame || []).map(id => model.layers.indexOf(id)).filter(i => i >= 0);
  const box = new THREE.Box3(); layerRoots.forEach((r, i) => { if (!frameIdx.length || frameIdx.includes(i)) box.expandByObject(r); });
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
    const vf = THREE.MathUtils.degToRad(camera.fov / 2), hf = Math.atan(Math.tan(vf) * Math.max(camera.aspect, 0.01));
    // хайрцгийн хэмжээгээр (бөмбөрцгөөс нягт) — өндөр, өргөний аль нь хязгаарлаж байгааг харгалзана
    const k = r / radius, lat = model.view === 'lateral';
    const W = (lat ? size.z : size.x) * k / 2, H = size.y * k / 2, D = (lat ? size.x : size.z) * k / 2;
    const dist = Math.max(H / Math.tan(vf), W / Math.tan(hf)) * 1.1 + D;
    camera.near = dist / 200; camera.far = dist * 20; camera.updateProjectionMatrix();
    // урдаас (anterior); model.view = 'lateral' бол хажуугаас
    camera.position.copy(target).add(model.view === 'lateral' ? new THREE.Vector3(dist, 0, 0) : new THREE.Vector3(0, 0, dist));
    controls.target.copy(target); controls.update(); render();
  }

  // ---- хөндлөн огтлол (model.clip): хэвтээ хавтгайгаар дээд хэсгийг таслан дотоод бүтцийг харуулна ----
  const clip = { on: !!model.clip, plane: clipPlane };
  if (clip.on) {
    renderer.localClippingEnabled = true;
    const $clip = container.querySelector('.v3d-clip input');
    const thick = size.x * 1.6; // нугасны өргөн (z нь муруйлтаас болж урт)
    const setClip = (v, reframe) => {
      clip.plane.constant = box.min.y + (box.max.y - box.min.y) * v / 100;
      if (reframe) {
        // огтлолын төв: хавтгайн ойролцоох оройнуудын дундаж (нугас муруй тул bbox-ын төвөөс зөрнө)
        const y0 = clip.plane.constant, tol = (box.max.y - box.min.y) * 0.004, acc = new THREE.Vector3(); let nAcc = 0;
        const v = new THREE.Vector3();
        for (const o of allParts) { const pa = o.geometry.attributes.position; o.updateWorldMatrix(true, false);
          for (let i = 0; i < pa.count; i += 3) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); if (Math.abs(v.y - y0) < tol) { acc.add(v); nAcc++; } } }
        const cx = nAcc ? acc.x / nAcc : center.x, cz = nAcc ? acc.z / nAcc : center.z;
        const t = new THREE.Vector3(cx, y0 - thick * 0.05, cz);
        const vf = THREE.MathUtils.degToRad(camera.fov / 2), hf = Math.atan(Math.tan(vf) * Math.max(camera.aspect, 0.01));
        const dist = thick * 0.75 / Math.sin(Math.min(vf, hf));
        camera.near = dist / 200; camera.far = dist * 50; camera.updateProjectionMatrix();
        camera.position.copy(t).add(new THREE.Vector3(0, dist * 0.94, dist * 0.34));
        controls.target.copy(t); controls.update();
      }
      render();
    };
    $clip.oninput = () => setClip(+$clip.value, true);
    clip.reset = () => setClip(+$clip.value, true);
  }

  // ---- landmark pins (зөвхөн ясны давхаргад) ----
  const pinGeo = new THREE.SphereGeometry(radius * 0.010, 16, 12);
  const pinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(css('--joints') || '#2C5FA8'), depthTest: false });
  const pinHi = new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false });
  const pins = new THREE.Group(); pins.visible = false; pins.renderOrder = 10; scene.add(pins);
  // булчингийн загварт ясны цэгүүдийг харуулахгүй (анхаарал сарниулна)
  const pinLayers = new Set(layerDefs.map((l, i) => i).filter(i => !layerDefs.some(l => l.id.startsWith('muscles')) || i === 0 || layerDefs[i].id.startsWith('muscles')));
  const landmarks = maps.flat().filter(x => x.kind === 'landmark' && x.structure_id && x.pos && rec(x) && rec(x).kind !== 'bone' && pinLayers.has(x.layer));
  for (const l of landmarks) {
    const m = new THREE.Mesh(pinGeo, pinMat); m.position.fromArray(l.pos); m.userData.info = l; m.userData.base = pinMat; m.renderOrder = 10; pins.add(m);
  }
  const toolBtn = t => container.querySelector(`[data-tools] [data-t=${t}]`);
  if (landmarks.length) toolBtn('pins').hidden = false;
  if (attachments.length && !layerDefs.some(l => l.id.startsWith('muscles'))) toolBtn('att').hidden = false;

  // ---- parts: хэсэг бүрийн node — задлах, тусгаарлахад ----
  const partKey = o => o.userData.info.layer + ':' + o.userData.info.node;
  const parts = new Map();
  for (const m of allParts) {
    const k = partKey(m); if (parts.has(k)) continue;
    const obj = m.userData.part;
    const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    parts.set(k, { obj, base: obj.position.clone(), c, info: m.userData.info });
  }
  const boneParts = [...parts.values()].filter(p => p.info.kind === 'bone');
  for (const p of parts.values()) {
    let src = p;
    if (p.info.kind === 'context' && boneParts.length) // харагдацын хэсгийг (шүд) хамгийн ойрын хэсэгтэй хамт хөдөлгөнө
      src = boneParts.reduce((a, b) => (b.c.distanceTo(p.c) < a.c.distanceTo(p.c) ? b : a));
    p.offW = src.c.clone().sub(center).multiplyScalar(0.9);
    const a = p.obj.parent.worldToLocal(p.c.clone()), b = p.obj.parent.worldToLocal(p.c.clone().add(p.offW));
    p.offL = b.sub(a);
  }
  for (const pin of pins.children) pin.userData.basePos = pin.position.clone();
  let explodeT = 0;
  function setExplode(t) {
    explodeT = t;
    for (const p of parts.values()) p.obj.position.copy(p.base).addScaledVector(p.offL, t);
    for (const pin of pins.children) {
      const p = parts.get(pin.userData.info.layer + ':' + pin.userData.info.bone);
      pin.position.copy(pin.userData.basePos); if (p) pin.position.addScaledVector(p.offW, t);
    }
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
  let isolated = null; // partKey
  function isolate(k) {
    isolated = k;
    for (const [pk, p] of parts) p.obj.visible = !k || pk === k;
    for (const pin of pins.children) pin.visible = !k || (pin.userData.info.layer + ':' + pin.userData.info.bone) === k;
    toolBtn('showall').hidden = !k;
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
      const k = camera.position.distanceTo(controls.target) / (radius * 2.4);
      for (const p of pins.children) p.scale.setScalar(Math.min(1, k) * (p.material === pinHi ? 1.4 : 1));
      renderer.render(scene, camera); needs = false;
    }
  })();
  controls.addEventListener('change', render);
  const ro = new ResizeObserver(resize); ro.observe($c);
  resize(); frame(); if (clip.on) clip.reset();
  const countBy = pred => new Set(pickables.filter(o => pred(kindOf(o.userData.info))).map(o => o.userData.info.structure_id)).size;
  const nBone = countBy(k => !MUSCLE_KINDS.has(k) && !SOFT_KINDS.has(k) && !NEURO_KINDS.has(k)), nMus = countBy(k => MUSCLE_KINDS.has(k)), nSoft = countBy(k => SOFT_KINDS.has(k));
  const nNerve = countBy(k => NERVE_KINDS.has(k)), nNeuro = countBy(k => NEURO_KINDS.has(k) && !NERVE_KINDS.has(k));
  $status.textContent = [nBone && `${nBone} яс`, nMus && `${nMus} булчин`, nSoft && `${nSoft} үе, холбоос`, nNeuro && `${nNeuro} тархи, нугасны бүтэц`, nNerve && `${nNerve} мэдрэл`, landmarks.length && `${landmarks.length} ясны хэсэг`]
    .filter(Boolean).join(' · ') + '. Дарж сонгоно, чирж эргүүлнэ.' + (contextMeshes.length ? ' Саарал хэсгүүд атласд ороогүй.' : '');

  // ---- selection ----
  let selected = [];
  const restore = o => { o.material = o.userData.base || MAT.bone; };
  function undim() { for (const o of allParts) if (o.material === dimMat) restore(o); }
  // нэг бүтэц олон mesh-ээс бүрдэж болно (хоёр тал, хэсгүүд) — бүгдийг нь хамт сонгоно
  const meshesOf = o => {
    const inf = o.userData.info;
    if (!inf || inf.kind !== 'bone') return [o];
    return pickables.filter(b => b.userData.info.layer === inf.layer && b.userData.info.structure_id === inf.structure_id);
  };
  function clearSel() { undim(); for (const o of selected) restore(o); selected = []; }
  function highlight(objs) {
    clearSel();
    for (const o of objs) o.material = o.parent === pins ? pinHi : (o.userData.info.kind === 'bone' ? hiFor(o.userData.info) : attHi);
    selected = objs; render();
  }
  function describe(obj) {
    const info = obj.userData.info, r = rec(info), k = kindOf(info);
    const sameMuscle = info.structure_id && (info.kind === 'origin' || info.kind === 'insertion') ? attachments.filter(a => a.userData.info.structure_id === info.structure_id) : [];
    const seen = new Set();
    const bonePins = info.kind === 'bone' ? landmarks.filter(l => l.layer === info.layer && (rec(l) && rec(l).parent_id === info.structure_id || l.bone === info.node))
      .filter(l => !seen.has(l.structure_id) && seen.add(l.structure_id)) : [];
    const det = r && r.details || {};
    const showMuscle = det.detail_type === 'muscle';
    $panel.innerHTML = `
      <p class="v3d-name latin">${A.esc(label(info))}</p>
      <p class="small">${A.esc(KIND_TEXT[k] || '')}${info.part_of ? ` (загварт: ${A.esc(info.name)})` : ''} ${r ? A.verifiedBadge(r) : ''}</p>
      ${r && r.description_mn ? `<p>${A.esc(r.description_mn)}</p>` : ''}
      ${showMuscle ? `<dl class="facts">${A.fact('Эхлэл', det.origin_mn)}${A.fact('Бэхлэл', det.insertion_mn)}${A.fact('Үйл ажиллагаа', det.action_mn)}${A.fact('Мэдрэл', det.innervation_mn)}</dl>` : ''}
      ${bonePins.length ? `<p class="small">Энэ ясны хэсгүүд:</p><div class="links">${bonePins.map(l => `<button class="chip" data-pin="${A.esc(l.node)}">${A.esc(label(l))}</button>`).join('')}</div>` : ''}
      <div class="actions">
        <button class="btn" data-focus>Ойртож харах</button>
        ${info.kind === 'bone' ? `<button class="btn" data-iso>${isolated === partKey(obj) ? 'Бүгдийг харуулах' : 'Зөвхөн үүнийг харах'}</button>` : ''}
        ${r ? `<a class="btn" href="#/t/${info.topic}/s/${info.structure_id}">Атласаар дэлгэрэнгүй</a>` : ''}
        ${sameMuscle.length > 1 ? `<button class="btn" data-both>Эхлэл ба бэхлэлийг харуулах</button>` : ''}
      </div>
      ${A.reportLink ? `<p class="small report-line">${A.reportLink(info.structure_id || info.node, '3D: ' + modelId + ' — ' + info.name, 'link')}</p>` : ''}`;
    $panel.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => {
      const p = pins.children.find(m => m.userData.info.node === b.dataset.pin && m.userData.info.layer === info.layer);
      pins.visible = true; setPressed('pins', true); highlight([p]); describe(p);
    });
    const fb = $panel.querySelector('[data-focus]');
    if (fb) fb.onclick = () => selected[0] && focus(selected[0]);
    const iso = $panel.querySelector('[data-iso]');
    if (iso) iso.onclick = () => {
      const pk = partKey(obj);
      if (isolated === pk) { isolate(null); frame(); } else { isolate(pk); focus(obj, 1.6); }
      describe(obj);
    };
    const both = $panel.querySelector('[data-both]');
    if (both) both.onclick = () => { showAtt(true); highlight(sameMuscle); };
  }

  const visibleDeep = o => { let n = o; while (n) { if (!n.visible) return false; n = n.parent; } return true; };
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    if (quiz.on) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    // саарал (атласд ороогүй) хэсэг доорх хэсгийг халхлахгүйн тулд тэдгээрийг алгасна
    const targets = [...(pins.visible ? pins.children : []), ...attachments, ...pickables].filter(visibleDeep);
    const hit = ray.intersectObjects(targets, false).find(h => !clip.on || h.point.y <= clip.plane.constant);
    if (!hit) { clearSel(); render(); $panel.innerHTML = ''; return; }
    highlight(meshesOf(hit.object)); describe(hit.object);
  });

  // ---- tools ----
  const tools = container.querySelector('[data-tools]');
  function setPressed(t, v) { const b = tools.querySelector(`[data-t=${t}]`); if (b) b.setAttribute('aria-pressed', String(v)); }
  function showAtt(v) { attachments.forEach(a => a.visible = v); setPressed('att', v); $legend.hidden = !v; render(); }
  tools.querySelector('[data-t=att]').onclick = e => showAtt(e.currentTarget.getAttribute('aria-pressed') !== 'true');
  tools.querySelector('[data-t=pins]').onclick = e => { pins.visible = e.currentTarget.getAttribute('aria-pressed') !== 'true'; setPressed('pins', pins.visible); render(); };
  const $ex = container.querySelector('.v3d-explode'), $range = $ex.querySelector('input');
  tools.querySelector('[data-t=reset]').onclick = () => { isolate(null); setPressed('explode', false); $ex.hidden = true; animateExplode(0); frame(); if (clip.on) clip.reset(); };
  tools.querySelector('[data-t=explode]').onclick = e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    setPressed('explode', on); $ex.hidden = !on; const t = on ? $range.value / 100 : 0;
    animateExplode(t); if (!isolated) frame(center, radius * (1 + 0.9 * t));
  };
  $range.oninput = () => { cancelAnimationFrame(anim); setExplode($range.value / 100); };
  $range.onchange = () => { if (!isolated) frame(center, radius * (1 + 0.9 * $range.value / 100)); };
  tools.querySelector('[data-t=showall]').onclick = () => { isolate(null); frame(); if (selected[0] && selected[0].parent !== pins) describe(selected[0]); };
  tools.querySelector('[data-t=quiz]').onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; setPressed('quiz', on); on ? startQuiz() : stopQuiz(); };
  container.querySelectorAll('[data-layer]').forEach(b => b.onclick = () => {
    const li = +b.dataset.layer, on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on)); layerRoots[li].visible = on;
    for (const pin of pins.children) if (pin.userData.info.layer === li) pin.visible = on;
    render();
  });

  // ---- 3D таних тест ----
  const quiz = { on: false, item: null, score: 0, n: 0 };
  const primary = layerDefs.map((l, i) => i).filter(i => /^(muscles|joints)/.test(layerDefs[i].id) || layerDefs[i].tint);
  const quizPool = () => [
    ...[...new Map(pickables.filter(o => visibleDeep(o) && (!primary.length || !primary.some(i => layerRoots[i].visible) || primary.includes(o.userData.info.layer))).map(o => [o.userData.info.layer + ':' + o.userData.info.structure_id, o])).values()]
      .map(o => ({ obj: o, info: o.userData.info })),
    ...(pinLayers.size ? pins.children.filter(p => layerRoots[p.userData.info.layer].visible).map(o => ({ obj: o, info: o.userData.info })) : []),
  ];
  function startQuiz() { isolate(null); quiz.on = true; quiz.score = 0; quiz.n = 0; showAtt(false); nextQ(); }
  function stopQuiz() { quiz.on = false; pins.children.forEach(p => p.visible = true); pins.visible = false; setPressed('pins', false); clearSel(); render(); $panel.innerHTML = ''; }
  const noun = info => { const k = kindOf(info); return info.kind === 'landmark' ? 'цэгийн ясны хэсэг' : MUSCLE_KINDS.has(k) ? 'булчин' : NERVE_KINDS.has(k) ? 'мэдрэл' : NEURO_KINDS.has(k) ? 'бүтэц' : SOFT_KINDS.has(k) ? 'бүтэц' : 'яс'; };
  function nextQ() {
    const pool = quizPool();
    if (!pool.length) { $panel.innerHTML = '<p>Асуулт гаргах хэсэг алга. Давхаргуудаа асаана уу.</p>'; return; }
    const item = pool[Math.floor(Math.random() * pool.length)];
    quiz.item = item;
    pins.visible = item.obj.parent === pins; setPressed('pins', pins.visible);
    if (pins.visible) pins.children.forEach(p => p.visible = p === item.obj);
    const targets = meshesOf(item.obj);
    highlight(targets); frame(); focus(item.obj, item.obj.parent === pins ? 4 : 3.5);
    // бусад хэсгийг тунгалаг болгож, тодруулсан хэсгийг далдлагдахаас сэргийлнэ
    const keepNode = item.obj.parent === pins ? item.info.layer + ':' + item.info.bone : null;
    for (const o of allParts) if (!targets.includes(o) && partKey(o) !== keepNode) o.material = dimMat;
    const same = pool.filter(p => noun(p.info) === noun(item.info) && p.info.structure_id !== item.info.structure_id);
    const opts = A.shuffle([item, ...A.shuffle(same).slice(0, 3)]);
    $panel.innerHTML = `<div class="progress-line"><span>Таних тест · ${quiz.score} / ${quiz.n}</span></div>
      <p class="stem">${item.obj.parent === pins ? 'Шараар' : hiWord(item.info)} тодруулсан ${noun(item.info)} аль нь вэ?</p>
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

  return () => { alive = false; cancelAnimationFrame(anim); ro.disconnect(); controls.dispose(); renderer.dispose(); };
}
