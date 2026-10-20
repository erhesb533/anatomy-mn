// Usage: node build.mjs <in.glb> <group[,group...]> <side r|l|both> <out.glb> <out-nodes.json> [contextGroup,...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, quantize, meshopt, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';

const [,, inp, groupArg, side, out, outJson, ctxArg] = process.argv;
const groups = groupArg.split(','), ctxGroups = ctxArg ? ctxArg.split(',') : [];
const xf = (m, v) => [m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12], m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13], m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const byName = new Map(root.listNodes().map(n => [n.getName(), n]));
for (const gname of [...groups, ...ctxGroups]) if (!byName.get(gname)) throw new Error('group not found ' + gname);

// world matrix of the group so we can re-parent it to the scene root
const keep = new Set();
const walk = n => { keep.add(n); n.listChildren().forEach(walk); };
// "bone" = mesh-тэй, .g/.j биш node. side: r|l бол зөвхөн тэр тал, both бол хоёр тал + дан ясууд
const isBone = c => c.getMesh() && !/\.(g|j|t)$/.test(c.getName()) && !/\.(o|e)\d*[rl]$/.test(c.getName());
const sideOk = name => side === 'both' ? true : (name.endsWith('.' + side) || !/\.[rl]$/.test(name)) && !(side === 'r' ? /\.l$/ : /\.r$/).test(name);
const bones = [], context = [];
function find(n, into) { for (const c of n.listChildren()) { if (isBone(c)) { if (sideOk(c.getName())) into.push(c); } else if (/\.g$/.test(c.getName())) find(c, into); } }
for (const gname of groups) find(byName.get(gname), bones);
for (const gname of ctxGroups) find(byName.get(gname), context);
[...bones, ...context].forEach(walk);

// Bake world transforms into each kept bone, then attach to a fresh root.
const newRoot = doc.createNode('model');
for (const b of [...bones, ...context]) {
  const m = b.getWorldMatrix();
  b.getParentNode()?.removeChild(b);
  b.setMatrix(m);
  newRoot.addChild(b);
}
for (const c of scene.listChildren()) scene.removeChild(c);
scene.addChild(newRoot);

// record node info (before stripping label meshes)
const info = [];
const tmp = [];
for (const c of context) { info.push({ node: c.getName(), kind: 'context', bone: c.getName() }); c.listChildren().forEach(k => tmp.push(k)); }
for (const b of bones) (function rec(n, boneName) {
  const name = n.getName();
  const kind = n === b ? 'bone'
    : /\.t$/.test(name) ? 'landmark'
    : /\.o\d*[rl]$/.test(name) ? 'origin'
    : /\.e\d*[rl]$/.test(name) ? 'insertion'
    : /\.j$/.test(name) ? 'label' : 'other';
  if (kind === 'landmark') {
    const w = n.getWorldMatrix(); const tpos = [w[12], w[13], w[14]];
    // .j хүүхэд нь шошгоос бүтэц рүү татсан шугам; бүтэц дээрх үзүүрийг олно
    const j = n.listChildren().find(c => /\.j$/.test(c.getName()) && c.getMesh());
    let tip = null;
    if (j) {
      const jm = j.getWorldMatrix(); const pts = [];
      for (const prim of j.getMesh().listPrimitives()) { const a = prim.getAttribute('POSITION'); const v = [0, 0, 0];
        for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); pts.push(xf(jm, v)); } }
      const far = pts.reduce((best, p) => dist(p, tpos) > dist(best, tpos) ? p : best, pts[0]);
      tip = far;
    }
    info.push({ node: name, kind, bone: boneName, label_pos: tpos, tip });
  } else if (kind !== 'label') info.push({ node: name, kind, bone: boneName });
  if (kind === 'label') tmp.push(n);
  n.listChildren().forEach(c => rec(c, kind === 'bone' ? name : boneName));
})(b, b.getName());
// аль цэг ясны гадаргуу дээр байгааг шалгаж pos-г сонгоно
const boneVerts = {};
for (const b of bones) { const m = b.getWorldMatrix(); const arr = []; const v = [0,0,0];
  const add = n => { const mesh = n.getMesh(); if (mesh && n === b) for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i += 3) { a.getElement(i, v); arr.push(xf(m, v)); } } };
  add(b); boneVerts[b.getName()] = arr; }
const near = (p, arr) => arr.reduce((d, q) => Math.min(d, dist(p, q)), Infinity);
let chooseTip = 0, chooseLabel = 0;
for (const x of info) if (x.kind === 'landmark') {
  const arr = boneVerts[x.bone] || [];
  const dl = near(x.label_pos, arr), dt = x.tip ? near(x.tip, arr) : Infinity;
  x.pos = dt < dl ? x.tip : x.label_pos; x.surface_dist = Math.min(dl, dt);
  if (dt < dl) chooseTip++; else chooseLabel++;
  delete x.tip;
}
console.log('landmark pos: tip', chooseTip, 'label', chooseLabel);
// drop label leader meshes
for (const n of tmp) n.dispose();
// drop materials' textures (none expected) and simplify attachment meshes a bit
await doc.transform(
  prune(), dedup(), weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.0005 }),
  quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }), prune()
);
await io.write(out, doc);
fs.writeFileSync(outJson, JSON.stringify(info, null, 1));
const tris = root.listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() || 0) / 3, 0), 0);
console.log('nodes kept', info.length, 'tris', tris, 'bytes', fs.statSync(out).size);
