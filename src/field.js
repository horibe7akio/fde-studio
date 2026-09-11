import './field.css';
import * as T from 'three';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

/* One swarm of cubes. It never appears or disappears — it only changes shape. */
const N = 264;
const STAGGER = 0.42;            // how much of the morph is spent waiting your turn
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('stage');
const beats = [...document.querySelectorAll('.beat')];

const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
const scene = new T.Scene();
scene.background = new T.Color('#03080b');
scene.fog = new T.FogExp2('#03080b', 0.03);
const camera = new T.PerspectiveCamera(44, 1, 0.1, 200);

scene.add(new T.HemisphereLight('#a6dcff', '#06121a', 0.8));
const key = new T.DirectionalLight('#d8f2ff', 1.05);
key.position.set(6, 10, 7);
scene.add(key);
const warm = new T.PointLight('#ffb066', 2.4, 24, 2);
warm.position.set(-1.6, 2.4, 2.6);
scene.add(warm);

const grid = new T.GridHelper(70, 70, new T.Color('#164a63'), new T.Color('#0a2130'));
grid.material.transparent = true;
grid.material.opacity = 0.34;
scene.add(grid);

const mesh = new T.InstancedMesh(
  new T.BoxGeometry(1, 1, 1),
  new T.MeshStandardMaterial({ roughness: 0.42, metalness: 0.2, emissiveIntensity: 1 }),
  N,
);
mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(N * 3), 3);
scene.add(mesh);

/* ---- formations ------------------------------------------------------- */
const F = [];
const rnd = (() => { let s = 20260911; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
const jitter = Array.from({ length: N }, () => [rnd(), rnd(), rnd()]);
const delay = Array.from({ length: N }, () => rnd());

const blank = () => ({ p: new Float32Array(N * 3), s: new Float32Array(N * 3), c: new Float32Array(N * 3) });
const put = (f, i, x, y, z, sx, sy, sz, col) => {
  f.p[i * 3] = x; f.p[i * 3 + 1] = y; f.p[i * 3 + 2] = z;
  f.s[i * 3] = sx; f.s[i * 3 + 1] = sy; f.s[i * 3 + 2] = sz;
  const c = new T.Color(col);
  f.c[i * 3] = c.r; f.c[i * 3 + 1] = c.g; f.c[i * 3 + 2] = c.b;
};

// 1. the spec: tidy rows of type on a flat sheet
{
  const f = blank(), COLS = 22, ROWS = 12;
  for (let i = 0; i < N; i++) {
    const col = i % COLS, row = (i / COLS) | 0;
    const lineLen = [20, 18, 21, 9, 19, 17, 20, 13, 18, 21, 16, 7][row];
    const on = col < lineLen;
    put(f, i, -2.1 + col * 0.2, 1.45 + row * 0.004, -1.25 + row * 0.228,
      on ? 0.15 : 0.001, on ? 0.03 : 0.001, on ? 0.058 : 0.001, on ? '#cfe6f2' : '#0b1f2a');
  }
  F.push(f);
}

// 2. the field: eleven islands of work, one of them stalled
const ISLANDS = [
  [-3.3, -1.7], [-1.6, -2.6], [0.3, -1.6], [2.1, -2.5], [3.4, -0.9], [-2.8, 0.6],
  [-0.8, 1.5], [1.3, 0.8], [3.1, 2.0], [-2.0, 2.7], [0.7, 3.2],
];
const STALLED = 7;
{
  const f = blank(), per = N / ISLANDS.length;
  for (let i = 0; i < N; i++) {
    const isl = (i / per) | 0, j = jitter[i];
    const [cx, cz] = ISLANDS[Math.min(isl, ISLANDS.length - 1)];
    put(f, i,
      cx + (j[0] - 0.5) * 1.05, 0.09 + j[1] * 0.52, cz + (j[2] - 0.5) * 1.05,
      0.15, 0.13, 0.15, isl === STALLED ? '#ff5f8a' : (i % 9 === 0 ? '#8fe6ff' : '#1d5570'));
  }
  F.push(f);
}

// 3. the demo: a bright block in the middle, the rest gone flat and dark
{
  const f = blank(), SHELL = 76;
  for (let i = 0; i < N; i++) {
    if (i < SHELL) {
      const a = (i / SHELL) * Math.PI * 2, r = 0.62 + (i % 3) * 0.09;
      put(f, i, Math.cos(a) * r, 1.55 + ((i % 4) - 1.5) * 0.3, Math.sin(a) * r, 0.2, 0.2, 0.2, '#7fe6ff');
    } else {
      const j = jitter[i];
      put(f, i, (j[0] - 0.5) * 13, 0.015, (j[2] - 0.5) * 11, 0.17, 0.02, 0.17, '#0e2937');
    }
  }
  F.push(f);
}

// 4. the system of record: four buried layers, and the wiring back up to it
{
  const f = blank(), PIPES = 4, PER_PIPE = 11, PIPED = PIPES * PER_PIPE;
  const px = [-2.6, -0.4, 1.4, 3.0], pz = [-1.4, 1.2, -0.6, 1.8];
  for (let i = 0; i < N; i++) {
    if (i < PIPED) {
      const p = (i / PER_PIPE) | 0, k = i % PER_PIPE;
      put(f, i, px[p], -1.15 + k * 0.2, pz[p], 0.09, 0.14, 0.09, '#ffb066');
    } else {
      const k = i - PIPED, layer = (k / 56) | 0, m = k % 56;
      put(f, i, -3.5 + (m % 14) * 0.54, -1.15 - layer * 0.36, -1.35 + ((m / 14) | 0) * 0.92,
        0.5, 0.075, 0.82, layer % 2 ? '#14415a' : '#0d2c3c');
    }
  }
  F.push(f);
}

// 5. one continuous path: from under the floor, through the field, to the front
{
  const f = blank();
  const curve = new T.CatmullRomCurve3([
    new T.Vector3(-3.9, -1.5, -0.6), new T.Vector3(-2.6, -0.35, 0.2), new T.Vector3(-1.3, 0.35, -0.5),
    new T.Vector3(0.1, 0.5, 0.5), new T.Vector3(1.5, 0.4, -0.3), new T.Vector3(2.8, 0.75, 0.6),
    new T.Vector3(3.9, 1.15, 1.5),
  ]);
  const a = new T.Color('#5fd8ff'), b = new T.Color('#ffb066'), c = new T.Color();
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), v = curve.getPoint(t), j = jitter[i];
    c.copy(a).lerp(b, t);
    put(f, i, v.x + (j[0] - 0.5) * 0.055, v.y + (j[1] - 0.5) * 0.055, v.z + (j[2] - 0.5) * 0.055,
      0.16, 0.16, 0.16, `#${c.getHexString()}`);
  }
  F.push(f);
}

// 6. time: a short stretch of building, then a much longer one of being trusted
{
  const f = blank(), BUILD = 77, x0 = -3.5;
  for (let i = 0; i < N; i++) {
    const inBuild = i < BUILD;
    const x = inBuild ? x0 + (i / BUILD) * 1.3 : x0 + 1.62 + ((i - BUILD) / (N - BUILD)) * 3.9;
    put(f, i, x, inBuild ? 1.34 : 1.0, 0.9 + ((i % 3) - 1) * 0.13,
      0.03, inBuild ? 0.5 : 0.3, 0.3, inBuild ? '#5fd8ff' : '#ffb066');
  }
  F.push(f);
}

// 7. back into the field — now connected, and the stall is gone
{
  const f = blank(), per = N / ISLANDS.length;
  for (let i = 0; i < N; i++) {
    const isl = (i / per) | 0, j = jitter[i];
    const [cx, cz] = ISLANDS[Math.min(isl, ISLANDS.length - 1)];
    put(f, i,
      cx + (j[0] - 0.5) * 0.92, 0.09 + j[1] * 0.46, cz + (j[2] - 0.5) * 0.92,
      0.15, 0.13, 0.15, isl === STALLED ? '#8fe6ff' : (i % 7 === 0 ? '#ffb066' : '#1f6484'));
  }
  F.push(f);
}

/* ---- camera per beat --------------------------------------------------- */
const POSE = [
  { p: [0, 7.0, 6.4], l: [0, 1.35, 0] },
  { p: [0.6, 2.3, 7.4], l: [0, 0.5, 0] },
  { p: [0, 2.1, 5.6], l: [0, 1.3, 0] },
  { p: [3.4, -0.25, 6.6], l: [0.2, -1.25, 0] },
  { p: [0.3, 2.4, 7.0], l: [0, 0.1, 0.2] },
  { p: [0, 1.75, 5.0], l: [0.1, 1.15, 0.9] },
  { p: [0.4, 3.0, 7.0], l: [0, 0.5, 0.2] },
];

/* ---- morph ------------------------------------------------------------- */
const dummy = new T.Object3D();
const cA = new T.Color(), cB = new T.Color(), cOut = new T.Color();
const state = { p: 0, target: 0 };
const camPos = new T.Vector3().fromArray(POSE[0].p);
const camLook = new T.Vector3().fromArray(POSE[0].l);
const vA = new T.Vector3(), vB = new T.Vector3();

// Odd beats keep their copy on the left, even beats on the right.
// Sliding the camera the other way leaves the swarm on the free half of the screen.
const SHIFT = [-1, 1, -1, 1, -1, 1, -1];
function lerpPose(u) {
  const i = Math.min(Math.floor(u), POSE.length - 2), t = T.MathUtils.smoothstep(u - i, 0, 1);
  vA.fromArray(POSE[i].p).lerp(vB.fromArray(POSE[i + 1].p), t);
  const l = new T.Vector3().fromArray(POSE[i].l).lerp(new T.Vector3().fromArray(POSE[i + 1].l), t);
  // Pan starts at the same width where the copy moves to one side (760px in the CSS).
  const amount = innerWidth >= 760 ? T.MathUtils.clamp(innerWidth / 1200, 0.8, 1.25) * 2.2 : 0;
  const sx = (SHIFT[i] + (SHIFT[i + 1] - SHIFT[i]) * t) * amount;
  vA.x += sx; l.x += sx;
  return { p: vA.clone(), l };
}

function morph(u, time) {
  const i = Math.min(Math.floor(u), F.length - 2), t = u - i;
  const a = F[i], b = F[i + 1];
  for (let k = 0; k < N; k++) {
    // each cube starts its move at a slightly different moment, so the shape flows
    const raw = (t - delay[k] * STAGGER) / (1 - STAGGER);
    const e = T.MathUtils.smoothstep(T.MathUtils.clamp(raw, 0, 1), 0, 1);
    const o = k * 3;
    const breathe = Math.sin(time * 0.9 + k * 0.7) * 0.012 * (1 - Math.abs(t - 0.5) * 2);
    dummy.position.set(
      a.p[o] + (b.p[o] - a.p[o]) * e,
      a.p[o + 1] + (b.p[o + 1] - a.p[o + 1]) * e + breathe,
      a.p[o + 2] + (b.p[o + 2] - a.p[o + 2]) * e,
    );
    dummy.scale.set(
      a.s[o] + (b.s[o] - a.s[o]) * e,
      a.s[o + 1] + (b.s[o + 1] - a.s[o + 1]) * e,
      a.s[o + 2] + (b.s[o + 2] - a.s[o + 2]) * e,
    );
    // a cube in motion turns a little; one at rest sits square
    const spin = Math.sin(e * Math.PI) * 0.9;
    dummy.rotation.set(spin * 0.5, spin * (0.6 + delay[k]), 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(k, dummy.matrix);
    cA.fromArray(a.c, o); cB.fromArray(b.c, o);
    cOut.copy(cA).lerp(cB, e);
    mesh.instanceColor.setXYZ(k, cOut.r, cOut.g, cOut.b);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.material.emissive = new T.Color('#0a2b3a');
  grid.material.opacity = 0.12 + 0.3 * (1 - Math.abs(u - 1) / 3);
  warm.intensity = 1.6 + Math.max(0, 2.2 - Math.abs(u - 4) * 1.6);
}

/* ---- scroll ------------------------------------------------------------ */
const lenis = reduced ? null : new Lenis({ duration: 1.1, smoothWheel: true });
if (lenis) document.documentElement.style.scrollBehavior = 'auto';

let centers = [];
function measure() {
  centers = beats.map((b) => {
    const r = b.getBoundingClientRect();
    return r.top + scrollY + r.height / 2;
  });
}
function readProgress() {
  if (!centers.length) measure();
  const eye = scrollY + innerHeight / 2;
  let u = 0;
  if (eye <= centers[0]) u = 0;
  else if (eye >= centers[centers.length - 1]) u = centers.length - 1;
  else {
    for (let i = 0; i < centers.length - 1; i++) {
      if (eye >= centers[i] && eye <= centers[i + 1]) {
        u = i + (eye - centers[i]) / (centers[i + 1] - centers[i]);
        break;
      }
    }
  }
  state.target = u / (F.length - 1);
  const idx = Math.round(u);
  beats.forEach((s, i) => s.classList.toggle('on', i === idx));
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < 760 ? 58 : 44;
  camera.updateProjectionMatrix();
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (lenis) lenis.raf(now);
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  resize();
  readProgress();
  state.p += (state.target - state.p) * Math.min(dt * (reduced ? 12 : 3.2), 1);
  const u = state.p * (F.length - 1);
  const pose = lerpPose(u);
  camPos.lerp(pose.p, Math.min(dt * 2.8, 1));
  camLook.lerp(pose.l, Math.min(dt * 2.8, 1));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  morph(u, now / 1000);
  renderer.render(scene, camera);
}
resize();
requestAnimationFrame(frame);
if (import.meta.env && import.meta.env.DEV) {
  // Verification helper: jump straight to a beat without waiting for the easing.
  window.__beat = (i) => {
    state.target = i / (F.length - 1);
    state.p = state.target;
    const pose = lerpPose(state.p * (F.length - 1));
    camPos.copy(pose.p); camLook.copy(pose.l);
    camera.position.copy(camPos); camera.lookAt(camLook);
    morph(state.p * (F.length - 1), performance.now() / 1000);
    renderer.render(scene, camera);
    beats.forEach((s, k) => s.classList.toggle('on', k === i));
    document.querySelectorAll('.copy').forEach((c) => { c.style.transition = 'none'; });
    return { beat: i, u: state.p * (F.length - 1) };
  };
}
addEventListener('resize', () => { resize(); measure(); });
addEventListener('load', measure);
