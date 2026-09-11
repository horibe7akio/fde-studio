import './field.css';
import * as T from 'three';
import { createGrade, createPerson, CYAN, AMBER } from './lib/look.js';
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
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new T.Scene();
scene.background = new T.Color('#03080b');
scene.fog = new T.FogExp2('#03080b', 0.03);
const camera = new T.PerspectiveCamera(44, 1, 0.1, 200);
// Same post chain as the concept page, so the two read as one product.
const view = createGrade(renderer, scene, camera, { bloom: [0.52, 0.5, 0.62], grain: 0.05 });

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

// 22 cubes are the work that arrives from outside. The other 242 are eleven desks.
const MSG = 22;
const PER = 22;
// Spread out enough that one desk can be read on its own.
const ISLANDS = [
  [-5.1, -2.6], [-2.5, -4.0], [0.5, -2.5], [3.3, -3.9], [5.3, -1.4], [-4.3, 0.9],
  [-1.2, 2.3], [2.0, 1.2], [4.8, 3.1], [-3.1, 4.2], [1.1, 5.0],
];
const STALLED = 7;   // the desk where the work is waiting on a confirmation
const ALONE = 8;     // one person doing all of it; the second chair is empty
// The two desks the camera actually looks at; arriving work lands on these.
const MSG_TARGETS = [STALLED, 6];

/* ---- options the reader can turn ---------------------------------------- */
// Horibe decides these by looking, not by spec. So they are knobs, and they persist.
const OPT_KEY = 'fde-field-opts';
const OPT = Object.assign({ person: 'a', speed: 1, alone: 'empty' }, (() => {
  try { return JSON.parse(localStorage.getItem(OPT_KEY) || '{}'); } catch { return {}; }
})());
const saveOpt = () => { try { localStorage.setItem(OPT_KEY, JSON.stringify(OPT)); } catch { /* private window */ } };

/* ---- formations ------------------------------------------------------- */
let F = [];
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

const INK = '#0d3044', SCREEN = '#63dcff', SKIN = '#d6f2ff', TORSO = '#2a79a4';
const PAPER = '#eef7fb', PHONE = '#1b4a60', SHELF = '#0c2a3a';
const RED = '#ff5f8a', RED_SOFT = '#ff9ab5', WARM = '#ffb066';
const HIDE = [0.001, 0.001, 0.001];

// A desk with someone at it. Four cubes are the person; the shape depends on the knob.
function desk(f, base, cx, cz, opts) {
  const { stalled = false, empty = false, papers = 3, flat = 0 } = opts;
  const y = (v) => (flat ? 0.02 + v * 0.12 : v);
  const h = (v) => (flat ? v * 0.18 : v);
  const dim = (col) => (flat ? '#0c2330' : col);
  let i = base;
  const P = (x, yy, z, sx, sy, sz, col) => put(f, i++, cx + x, y(yy), cz + z, sx, h(sy), sz, dim(col));

  P(0, 0.30, 0, 0.92, 0.05, 0.50, INK);
  P(0, 0.15, -0.02, 0.70, 0.28, 0.06, INK);
  P(-0.20, 0.55, -0.14, 0.46, 0.34, 0.04, SCREEN);
  P(-0.20, 0.36, -0.14, 0.09, 0.09, 0.09, INK);

  // The person. Stalled desks turn away from the screen, toward the phone.
  const face = stalled ? 0.16 : -0.04;
  const head = stalled ? RED : SKIN;
  if (empty) {
    P(0, 0.16, 0.60, 0.26, 0.30, 0.06, INK);          // 椅子だけ
    P(0, 0.001, 0.60, ...HIDE, INK);
    P(0, 0.001, 0.60, ...HIDE, INK);
    P(0, 0.001, 0.60, ...HIDE, INK);
  } else if (OPT.person === 'b') {                     // 肩のある人
    P(face, 0.30, 0.46, 0.20, 0.34, 0.18, TORSO);
    P(face, 0.50, 0.46, 0.36, 0.08, 0.20, TORSO);      // 肩
    P(face, 0.63, 0.46, 0.17, 0.17, 0.17, head);
    P(0, 0.16, 0.62, 0.26, 0.30, 0.06, INK);
  } else if (OPT.person === 'c') {                     // 細い人
    P(face, 0.38, 0.46, 0.15, 0.52, 0.15, TORSO);
    P(face, 0.72, 0.46, 0.20, 0.20, 0.20, head);
    P(0, 0.16, 0.62, 0.26, 0.30, 0.06, INK);
    P(0, 0.001, 0.60, ...HIDE, INK);
  } else if (OPT.person === 'real') {                  // 実体の人を使うので、席は小物だけ
    P(0, 0.16, 0.62, 0.26, 0.30, 0.06, INK);          // 椅子
    P(0.02, 0.35, 0.16, 0.30, 0.02, 0.12, INK);       // キーボード
    P(-0.42, 0.36, 0.06, 0.10, 0.10, 0.10, SHELF);    // マグ
    P(0.60, 0.22, -0.30, 0.22, 0.40, 0.30, SHELF);    // 書類棚
  } else {                                             // a：いまの形
    P(face, 0.32, 0.46, 0.26, 0.38, 0.20, TORSO);
    P(face, 0.62, 0.46, 0.19, 0.19, 0.19, head);
    P(0, 0.16, 0.60, 0.26, 0.30, 0.06, INK);
    P(0, 0.001, 0.60, ...HIDE, INK);
  }

  for (let k = 0; k < 4; k++) {
    const on = k < papers;
    P(0.34, 0.34 + k * 0.04, -0.06, on ? 0.26 : 0.001, on ? 0.03 : 0.001, on ? 0.20 : 0.001,
      stalled ? RED_SOFT : PAPER);
  }
  P(0.41, 0.37, 0.20, 0.13, 0.07, 0.17, stalled ? RED : PHONE);

  for (let k = 0; k < 3; k++) P(-0.66, 0.14 + k * 0.16, -0.68, 0.22, 0.13, 0.16, SHELF);
  for (let k = 0; k < 6; k++) {
    const j = jitter[(base + k) % N];
    P((j[0] - 0.5) * 1.9, 0.03, (j[2] - 0.5) * 1.9, 0.08, 0.03, 0.08, '#0a2231');
  }
  return i;
}

function field(f, { flat = 0, healed = false } = {}) {
  for (let k = 0; k < MSG; k++) {
    const isl = MSG_TARGETS[k % MSG_TARGETS.length], [cx, cz] = ISLANDS[isl], j = jitter[k];
    put(f, k, cx + 0.3 + (j[0] - 0.5) * 0.3, flat ? 0.02 : 0.40 + j[1] * 0.05, cz - 0.1 + (j[2] - 0.5) * 0.3,
      0.2, flat ? 0.01 : 0.03, 0.15, flat ? '#0c2330' : (k % 3 === 0 ? '#5fd8ff' : PAPER));
  }
  let i = MSG;
  ISLANDS.forEach(([cx, cz], n) => {
    i = desk(f, i, cx, cz, {
      stalled: !healed && n === STALLED,
      empty: n === ALONE && OPT.alone === 'empty',
      papers: [3, 4, 2, 4, 1, 2, 3, 4, 2, 1, 2][n],
      flat,
    });
  });
  if (healed) {
    const [sx, sz] = ISLANDS[STALLED];
    put(f, MSG + STALLED * PER + 4, sx - 0.55, 0.30, sz + 0.5, 0.22, 0.34, 0.18, WARM);
    put(f, MSG + STALLED * PER + 5, sx - 0.55, 0.57, sz + 0.5, 0.16, 0.16, 0.16, WARM);
  }
}

function buildAll() {
  F = [];
  { // 1. 仕様書
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
  { const f = blank(); field(f); F.push(f); }                       // 2. 現場
  { // 3. デモ
    const f = blank();
    field(f, { flat: 1 });
    const SHELL = 40;
    for (let i = 0; i < SHELL; i++) {
      const a = (i / SHELL) * Math.PI * 2, r = 0.62 + (i % 3) * 0.09;
      put(f, i + 60, Math.cos(a) * r, 1.55 + ((i % 4) - 1.5) * 0.3, Math.sin(a) * r, 0.2, 0.2, 0.2, '#7fe6ff');
    }
    F.push(f);
  }
  { // 4. 基幹システム
    const f = blank(), PIPES = 4, PER_PIPE = 11, PIPED = PIPES * PER_PIPE;
    const px = [-2.6, -0.4, 1.4, 3.0], pz = [-1.4, 1.2, -0.6, 1.8];
    for (let i = 0; i < N; i++) {
      if (i < PIPED) {
        const p = (i / PER_PIPE) | 0, k = i % PER_PIPE;
        put(f, i, px[p], -1.15 + k * 0.2, pz[p], 0.09, 0.14, 0.09, WARM);
      } else {
        const k = i - PIPED, layer = (k / 56) | 0, m = k % 56;
        put(f, i, -3.5 + (m % 14) * 0.54, -1.15 - layer * 0.36, -1.35 + ((m / 14) | 0) * 0.92,
          0.5, 0.075, 0.82, layer % 2 ? '#14415a' : '#0d2c3c');
      }
    }
    F.push(f);
  }
  { // 5. 1本の道
    const f = blank();
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(-3.9, -1.5, -0.6), new T.Vector3(-2.6, -0.35, 0.2), new T.Vector3(-1.3, 0.35, -0.5),
      new T.Vector3(0.1, 0.5, 0.5), new T.Vector3(1.5, 0.4, -0.3), new T.Vector3(2.8, 0.75, 0.6),
      new T.Vector3(3.9, 1.15, 1.5),
    ]);
    const a = new T.Color('#5fd8ff'), b = new T.Color(WARM), c = new T.Color();
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), v = curve.getPoint(t), j = jitter[i];
      c.copy(a).lerp(b, t);
      put(f, i, v.x + (j[0] - 0.5) * 0.055, v.y + (j[1] - 0.5) * 0.055, v.z + (j[2] - 0.5) * 0.055,
        0.16, 0.16, 0.16, `#${c.getHexString()}`);
    }
    F.push(f);
  }
  { // 6. 時間
    const f = blank(), BUILD = 77, x0 = -3.5;
    for (let i = 0; i < N; i++) {
      const inBuild = i < BUILD;
      const x = inBuild ? x0 + (i / BUILD) * 1.3 : x0 + 1.62 + ((i - BUILD) / (N - BUILD)) * 3.9;
      put(f, i, x, inBuild ? 1.34 : 1.0, 0.9 + ((i % 3) - 1) * 0.13,
        0.03, inBuild ? 0.5 : 0.3, 0.3, inBuild ? '#5fd8ff' : WARM);
    }
    F.push(f);
  }
  { const f = blank(); field(f, { healed: true }); F.push(f); }     // 7. 現場（再）
}
buildAll();

/* ---- the people at those desks ----------------------------------------- */
// The cubes are the work. The people are people — the same figure the concept page uses.
const crowd = new T.Group();
scene.add(crowd);
const folks = ISLANDS.map(([cx, cz], n) => {
  const p = createPerson(n === STALLED ? 0xff637f : CYAN, 0.52);
  p.group.position.set(cx + 0.06, 0, cz + 0.78);
  p.group.rotation.y = Math.PI;                    // face the desk
  p.group.scale.setScalar(0.001);
  crowd.add(p.group);
  return p;
});
const fdeFigure = createPerson(AMBER, 0.58);
fdeFigure.group.position.set(ISLANDS[STALLED][0] - 0.85, 0, ISLANDS[STALLED][1] + 0.7);
fdeFigure.group.rotation.y = Math.PI * 0.72;
fdeFigure.group.scale.setScalar(0.001);
crowd.add(fdeFigure.group);

/* ---- work arriving from outside ---------------------------------------- */
// Orders do not arrive on a beat. Each one has its own speed and its own start.
const msgSpeed = Array.from({ length: MSG }, (_, k) => 0.07 + ((k * 37) % 11) * 0.012);
const msgPhase = Array.from({ length: MSG }, (_, k) => ((k * 53) % 97) / 97);
const msgFrom = Array.from({ length: MSG }, (_, k) => {
  const side = k % 2 ? 1 : -1;
  return new T.Vector3(side * 7.5, 2.6 + ((k * 17) % 9) * 0.22, -3.4 + ((k * 29) % 13) * 0.55);
});
const msgTo = Array.from({ length: MSG }, (_, k) => {
  const [cx, cz] = ISLANDS[MSG_TARGETS[k % MSG_TARGETS.length]];
  return new T.Vector3(cx + 0.32, 0.42, cz - 0.08);
});
const msgPos = new T.Vector3();
// The desks are on screen during the second beat and again at the end.
const fieldWeight = (u) =>
  Math.max(
    T.MathUtils.smoothstep(u, 0.35, 0.9) * (1 - T.MathUtils.smoothstep(u, 1.35, 1.9)),
    T.MathUtils.smoothstep(u, 5.4, 5.9),
  );
function messageAt(k, time) {
  const raw = (time * msgSpeed[k] * OPT.speed + msgPhase[k]) % 1;
  const t = Math.min(raw * 1.55, 1);            // flies in, then rests on the desk
  const e = T.MathUtils.smoothstep(t, 0, 1);
  msgPos.copy(msgFrom[k]).lerp(msgTo[k], e);
  msgPos.y += Math.sin(Math.PI * e) * 1.5;
  return msgPos;
}

/* ---- camera per beat --------------------------------------------------- */
const POSE = [
  { p: [0, 7.0, 6.4], l: [0, 1.35, 0] },
  { p: [0.45, 1.35, 4.35], l: [-0.3, 0.55, 1.15] },
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
    let spin = Math.sin(e * Math.PI) * 0.9;
    if (k < MSG) {
      const w = fieldWeight(u);
      if (w > 0.002) {
        dummy.position.lerp(messageAt(k, time), w);
        spin *= 0.3;                              // paper should not tumble
      }
    }
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
  view.setSize(w, h);
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

  // People belong to the field beats only, and the FDE only turns up at the end.
  const here = fieldWeight(u);
  const solid = OPT.person === 'real' ? 1 : 0;
  const t = now / 1000;
  folks.forEach((p, n) => {
    const s0 = 0.52 * here * solid;
    p.group.scale.setScalar(Math.max(s0, 0.001));
    p.left.rotation.z = -0.25 + Math.sin(t * 1.6 + n) * 0.06 * here;
    p.right.rotation.z = 0.25 - Math.sin(t * 1.5 + n * 1.3) * 0.06 * here;
    p.halo.material.opacity = 0.55 * here * solid;
  });
  const arrived = T.MathUtils.smoothstep(u, 5.7, 6.0);
  fdeFigure.group.scale.setScalar(Math.max(0.58 * arrived, 0.001));
  fdeFigure.halo.material.opacity = 0.8 * arrived;

  view.render(t, here * 0.05);
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

/* ---- knobs -------------------------------------------------------------- */
{
  const toggle = document.getElementById('knobs-toggle');
  const body = document.getElementById('knobs-body');
  const buttons = [...document.querySelectorAll('.knob button')];
  const paint = () => buttons.forEach((b) => {
    b.setAttribute('aria-pressed', String(String(OPT[b.dataset.opt]) === b.dataset.val));
  });
  toggle.addEventListener('click', () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });
  buttons.forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.opt;
    OPT[key] = key === 'speed' ? Number(b.dataset.val) : b.dataset.val;
    saveOpt();
    if (key !== 'speed') buildAll();   // the shape changed, so the formations do too
    paint();
  }));
  paint();
}
