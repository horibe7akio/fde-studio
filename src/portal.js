import './series.css';
import './portal.css';
import * as THREE from 'three';
import { series } from './series.js';

// カードは src/series.js の一覧から作る（資料を足したら、あちらに1件足すだけ）
const list = document.getElementById('cards');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
series.forEach((s, i) => {
  const li = el('li', 'card');
  li.append(el('span', 'no', String(i + 1).padStart(2, '0')));
  const h = el('h2'); const a = el('a'); a.href = `./${s.path}`;
  a.append(el('small', '', '3Dでわかる'), document.createTextNode(s.title)); h.append(a); li.append(h);
  li.append(el('p', 'q', s.question), el('p', 's', s.summary));
  const tags = el('ul', 'tags'); (s.tags || []).forEach(t => tags.append(el('li', '', t))); li.append(tags);
  if (s.extras?.length) {
    const ex = el('ul', 'extras');
    s.extras.forEach(x => { const l = el('li'); const xa = el('a', '', x.label); xa.href = `./${x.path}`; l.append(xa); ex.append(l); });
    li.append(ex);
  }
  li.append(el('span', 'go', 'OPEN →'));
  list.append(li);
});

// 背景：ゆっくり回る点の格子（読む邪魔をしない程度に）
const canvas = document.getElementById('bg');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x060a13, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x060a13, 8, 26);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
camera.position.set(0, 4.5, 12);
camera.lookAt(0, 0, 0);
const N = 28, pts = [];
for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) pts.push((x - N / 2) * 0.7, 0, (z - N / 2) * 0.7);
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
const grid = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x96e5ff, size: 0.05, transparent: true, opacity: 0.55 }));
scene.add(grid);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
function frame(t) {
  const p = geo.attributes.position.array, s = t * 0.0004;
  for (let i = 0; i < p.length; i += 3) p[i + 1] = Math.sin(p[i] * 0.6 + s) * 0.35 + Math.cos(p[i + 2] * 0.5 + s * 0.8) * 0.35;
  geo.attributes.position.needsUpdate = true;
  grid.rotation.y = s * 0.15 + window.scrollY * 0.0006;
  renderer.render(scene, camera);
  if (!still) requestAnimationFrame(frame);
}
addEventListener('resize', resize);
resize(); frame(0);
