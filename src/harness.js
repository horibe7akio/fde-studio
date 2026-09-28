import './series.css';
import './harness.css';
import * as THREE from 'three';

// 3Dでわかる ハーネス：スクロールの位置 g（章番号＋章の中の進み 0〜1）で、3Dの作戦ボードを組み替える。
const canvas = document.getElementById('stage');
const tagLayer = document.getElementById('tags');
const secs = [...document.querySelectorAll('[data-ch]')];
const navs = [...document.querySelectorAll('.nav a')];
const bar = document.getElementById('bar');
const stageEl = document.querySelector('.stage');
const navEl = document.querySelector('.nav');

const COL = { bg: 0x060a13, text: 0xe7edf6, cyan: 0x96e5ff, orange: 0xffa777, red: 0xff7a7a, yellow: 0xffd84a, board: 0x0b1b27 };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const ramp = (x, a, b) => clamp((x - a) / (b - a));
const band = (x, a, b, f = 0.08) => Math.min(ramp(x, a, a + f), 1 - ramp(x, b - f, b));
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- 場 ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(COL.bg, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COL.bg, 22, 46);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(4, 10, 6); scene.add(sun);

const PW = 6.8, PL = 10.5, M = 0.9;
const at = (u, v) => [(u - 0.5) * PW, (v - 0.5) * PL];

// 作戦ボード（ピッチ）
function boardTexture() {
  const c = document.createElement('canvas'); c.width = 680; c.height = 1050;
  const x = c.getContext('2d');
  x.fillStyle = '#0b1b27'; x.fillRect(0, 0, 680, 1050);
  x.strokeStyle = 'rgba(150,229,255,0.6)'; x.lineWidth = 4;
  x.strokeRect(10, 10, 660, 1030);
  x.beginPath(); x.moveTo(10, 525); x.lineTo(670, 525); x.stroke();
  x.beginPath(); x.arc(340, 525, 92, 0, Math.PI * 2); x.stroke();
  x.strokeRect(150, 10, 380, 150); x.strokeRect(150, 890, 380, 150);
  x.strokeRect(265, 10, 150, 50); x.strokeRect(265, 990, 150, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const boardMat = new THREE.MeshBasicMaterial({ map: boardTexture() });
const board = new THREE.Mesh(new THREE.PlaneGeometry(PW, PL), boardMat);
board.rotation.x = -Math.PI / 2;
const boardGroup = new THREE.Group(); boardGroup.add(board); scene.add(boardGroup);
const edgeMat = new THREE.LineBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.4 });
const rectPts = (w, l, y = 0.01) => [new THREE.Vector3(-w / 2, y, -l / 2), new THREE.Vector3(w / 2, y, -l / 2), new THREE.Vector3(w / 2, y, l / 2), new THREE.Vector3(-w / 2, y, l / 2)];
const edges = [0, 0.06, 0.12].map(o => { const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rectPts(PW + o, PL + o)), edgeMat); boardGroup.add(l); return l; });

// 案件ごとのボード（重ねて出す）
const stack = [];
for (let k = 0; k < 4; k++) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PL), new THREE.MeshBasicMaterial({ color: 0x0d2230, transparent: true, opacity: 0.85 }));
  m.rotation.x = -Math.PI / 2; g.add(m);
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rectPts(PW, PL)), new THREE.LineBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.45 })));
  g.visible = false; scene.add(g); stack.push(g);
}

// ルールとスタジアム（公式のハーネス）：ピッチを囲む壁
const wallMat = new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
const wallLineMat = new THREE.LineBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.8 });
const FW = PW + M * 2, FL = PL + M * 2;
const walls = new THREE.Group(); scene.add(walls);
[[FW, 0.06, 0, -FL / 2], [FW, 0.06, 0, FL / 2], [0.06, FL, -FW / 2, 0], [0.06, FL, FW / 2, 0]].forEach(([w, l, x, z]) => {
  const geo = new THREE.BoxGeometry(w, 1, l);
  const m = new THREE.Mesh(geo, wallMat); m.position.set(x, 0.5, z); walls.add(m);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wallLineMat); e.position.copy(m.position); walls.add(e);
});

// ツマミ（02）
const knobs = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 32), new THREE.MeshStandardMaterial({ color: 0x241810, emissive: COL.orange, emissiveIntensity: 0.25 }));
  const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.24), new THREE.MeshBasicMaterial({ color: COL.orange }));
  ptr.position.set(0, 0.1, -0.1); g.add(body, ptr); g.userData.ptr = ptr;
  scene.add(g); knobs.push(g);
}

// 更新の走査面（03）
const scan = new THREE.Mesh(new THREE.PlaneGeometry(FW, 2.4), new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scene.add(scan);

// 選手
const F442 = [[.15,.80],[.38,.80],[.62,.80],[.85,.80],[.15,.58],[.38,.58],[.62,.58],[.85,.58],[.38,.33],[.62,.33]];
const F433 = [[.15,.80],[.38,.80],[.62,.80],[.85,.80],[.25,.58],[.50,.60],[.75,.58],[.20,.33],[.50,.30],[.80,.33]];
const F541 = [[.10,.79],[.30,.81],[.50,.82],[.70,.81],[.90,.79],[.18,.60],[.40,.60],[.60,.60],[.82,.60],[.50,.36]];
const F352 = [[.25,.80],[.50,.81],[.75,.80],[.10,.58],[.30,.58],[.50,.60],[.70,.58],[.90,.58],[.38,.33],[.62,.33]];
const F811 = [[.50,.80],[.50,.56],[.10,.30],[.21,.24],[.33,.30],[.44,.24],[.56,.30],[.67,.24],[.79,.30],[.90,.24]];
const A = F442.map(p => p.slice()); A[7] = [.90, .72];
const B = A.map(p => p.slice()); B[4] = [.25, .32];
const Cf = B.map(p => p.slice()); Cf[5] = [.50, .26];
const KF = [[0,F442],[5.15,F442],[5.25,A],[5.30,A],[5.40,B],[5.45,B],[5.55,Cf],[5.58,Cf],[5.70,F811],[6.0,F811],
            [6.12,F433],[6.25,F433],[6.35,F541],[6.5,F541],[6.6,F442],[6.75,F442],[6.85,F352],[8.0,F352],[8.3,F442]];
function form(g) {
  for (let i = 0; i < KF.length - 1; i++) {
    const [g0, f0] = KF[i], [g1, f1] = KF[i + 1];
    if (g <= g1) { const k = ease(clamp((g - g0) / Math.max(1e-6, g1 - g0))); return f0.map((p, j) => [lerp(p[0], f1[j][0], k), lerp(p[1], f1[j][1], k)]); }
  }
  return KF[KF.length - 1][1];
}
const playerMat = new THREE.MeshStandardMaterial({ color: COL.text, emissive: COL.text, emissiveIntensity: 0.35, roughness: 0.35 });
const ballGeo = new THREE.SphereGeometry(0.21, 28, 18);
const players = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(ballGeo, playerMat); scene.add(m); return m; });
const gk = new THREE.Group();
gk.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), playerMat));
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 40), new THREE.MeshBasicMaterial({ color: COL.cyan }));
ring.rotation.x = Math.PI / 2; gk.add(ring); scene.add(gk);

// 相手とボール（05）
const redMat = new THREE.MeshStandardMaterial({ color: COL.red, emissive: COL.red, emissiveIntensity: 0.5, transparent: true });
const reds = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(ballGeo, redMat); scene.add(m); return m; });
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
scene.add(ball);

// 審判（07）
const referee = new THREE.Group();
referee.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), new THREE.MeshStandardMaterial({ color: 0x15130a, emissive: COL.yellow, emissiveIntensity: 0.15 })));
const rring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 10, 44), new THREE.MeshBasicMaterial({ color: COL.yellow }));
rring.rotation.x = Math.PI / 2; referee.add(rring); scene.add(referee);

// ---------- 文字（3Dの位置に合わせて置く） ----------
const tags = [];
function tag(cls, text, anchor, alpha) {
  const el = document.createElement('div'); el.className = `tag ${cls}`; el.textContent = typeof text === 'string' ? text : '';
  tagLayer.append(el); tags.push({ el, text, anchor, alpha });
}
const v3 = new THREE.Vector3();
const S = { wallH: 0.35, lift: 0, pY: 0.21 };
const rnd = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
let F = F442;

tag('rule', g => (g >= 7.9 ? '公式のハーネス：変えられない' : '公式のハーネス（Claude Code）'), () => [-FW / 2, S.wallH - S.lift + 0.35, -FL / 2], g => clamp(band(g, 0.85, 4.1, 0.15) + band(g, 7.9, 9.9, 0.15)));
tag('rule', '変えられない', () => [0, S.wallH + 0.55, -FL / 2], g => band(g, 1.95, 3.05, 0.1));
['モデル', '考える深さ', '許可', '道具'].forEach((n, i) => tag('rule', n, () => [-2.55 + 1.7 * i, S.wallH + 0.75, FL / 2], g => band(g, 1.95, 3.05, 0.1)));
tag('rule', '更新 v2.1.283：/doctor prompt-audit', () => [0, S.wallH + 0.55, FL / 2], g => band(g, 3.15, 4.05, 0.08));
tag('model', '選手の成長（新しいモデル）', () => [0, 1.3, -0.4], g => band(g, 3.55, 4.02, 0.08));
tag('model', '選手（モデル）', () => [PW / 2 - 0.2, S.pY + S.lift * 1.6 + 0.6, -1.6], g => band(g, 0.95, 2.0, 0.12));
tag('board', '作戦ボード（自分で書く）', () => [PW / 2, 0.05, PL / 2 + 0.2], g => band(g, 0.9, 2.0, 0.12));
tag('board', '共通のボード（全体用）', () => [-PW / 2, 0.05, PL / 2 + 0.3], g => band(g, 3.95, 5.1, 0.12));
tag('board', '案件ごとのボード', () => [PW / 2 + 0.3, -0.1, -PL / 2 + 0.6], g => band(g, 4.15, 5.1, 0.1));
['ゲーム制作', 'アプリ開発', '資料づくり', '広報'].forEach((n, k) => tag('board', n, () => [PW / 2 + stack[k].position.x + 0.2, stack[k].position.y, PL * 0.3], g => band(g, 4.2, 5.1, 0.1)));
tag('board', '作戦ボード：毎日組み直す', () => [0, 0.05, PL / 2 + 0.8], g => band(g, 8.05, 9.9, 0.12));
[[5.2, 5.34, 7, '＋確認のルール'], [5.34, 5.47, 4, '＋片づけのルール'], [5.47, 5.58, 5, '＋重い処理のルール'], [5.58, 5.72, 1, '＋止まるなのルール']].forEach(([a, b, idx, t]) =>
  tag('add', t, () => { const [x, z] = at(...F[idx]); return [x, 0.8, z]; }, g => band(g, a, b, 0.03)));
tag('board', '気づけば、最大公倍数', () => [0, 0.5, 0.2], g => band(g, 5.55, 5.74, 0.04));
tag('big', '8-1-1', () => [0, 1.2, -PL / 2 + 0.9], g => band(g, 5.66, 6.02, 0.04));
tag('big goal', '失点', () => [0, 0.9, PL * 0.22], g => band(g, 5.9, 6.03, 0.02));
[['ゲーム制作', '4-3-3'], ['アプリ開発', '5-4-1'], ['資料づくり', '4-4-2'], ['広報', '3-5-2']].forEach(([n, f], k) => {
  const al = g => band(g, 6 + k * 0.25 + 0.02, 6 + (k + 1) * 0.25, 0.04);
  tag('vs', 'VS ' + n, () => [0, 0.4, -FL / 2 - 0.6], al);
  tag('fm', 'この試合の最適　' + f, () => [0, 0.1, FL / 2 + 0.6], al);
});
tag('ref', '審判（フック）', () => { const [x, z] = at(.5, .47); return [x, 1.05, z]; }, g => band(g, 7.02, 8.06, 0.06));
tag('whistle', 'ピッ', () => { const [x, z] = at(.66, .40); return [x, 0.9, z]; }, g => band(g, 7.18, 7.34, 0.03));
for (let i = 0; i < 14; i++) {
  const st = 7.46 + i * 0.025;
  tag('whistle', 'ピッ', () => { const [x, z] = at(0.12 + 0.76 * rnd(i, 1), 0.1 + 0.8 * rnd(i, 2)); return [x, 0.7, z]; }, g => band(g, st, st + 0.14, 0.02) * (1 - ramp(g, 7.86, 7.95)));
}
tag('stop', '試合が止まる', () => [0, 0.8, 0.6], g => ramp(g, 7.6, 7.7) * (1 - ramp(g, 7.98, 8.12)));
tag('ref', '笛の加減は、人が決める', () => [0, 0.1, FL / 2 + 0.6], g => band(g, 7.8, 8.05, 0.04));

// ---------- カメラ（章ごとに少し回り込む） ----------
const CAM = [
  { az: 0.38, el: 0.92, d: 17.5 }, { az: -0.62, el: 0.5, d: 18.5 }, { az: 0.5, el: 0.62, d: 17 },
  { az: 0.22, el: 0.82, d: 16.5 }, { az: -0.8, el: 0.34, d: 19.5 }, { az: 0.0, el: 1.02, d: 16.5 },
  { az: 0.3, el: 0.92, d: 16.5 }, { az: -0.22, el: 0.96, d: 16.5 }, { az: 0.42, el: 0.78, d: 18.5 }, { az: 0.42, el: 0.78, d: 18.5 },
];
function camAt(g) {
  const x = clamp(g - 0.5, 0, CAM.length - 1.001), i = Math.floor(x), k = ease(x - i);
  const a = CAM[i], b = CAM[i + 1];
  return { az: lerp(a.az, b.az, k), el: lerp(a.el, b.el, k), d: lerp(a.d, b.d, k) };
}

// ---------- 大きさとスクロール ----------
let W = 0, H = 0, G = 0, tops = [], hs = [], queued = false, mobile = false;
function measure() {
  W = canvas.clientWidth; H = canvas.clientHeight; mobile = innerWidth < 900;
  renderer.setSize(W, H, false);
  if (mobile) { camera.aspect = W / H; camera.clearViewOffset(); }
  else { camera.aspect = (W * 1.5) / H; camera.setViewOffset(W * 1.5, H, 0, 0, W, H); }
  camera.updateProjectionMatrix();
  tops = secs.map(s => s.getBoundingClientRect().top + window.scrollY);
  hs = secs.map(s => s.offsetHeight);
}
function progress() {
  const c = window.scrollY + innerHeight * (mobile ? 0.73 : 0.5);
  let g = 0;
  for (let i = 0; i < secs.length; i++) if (c >= tops[i]) g = i + clamp((c - tops[i]) / hs[i], 0, 0.999);
  const last = tops.length - 1;
  if (c >= tops[last] + hs[last]) g = 9;
  return g;
}

function update() {
  queued = false;
  const g = G = progress();

  // 3つの層を上下に離して見せる（01）
  S.lift = ease(band(g, 0.85, 2.05, 0.3));
  S.wallH = 0.35 + 0.85 * ease(band(g, 1.9, 3.1, 0.2));
  walls.position.y = -1.3 * S.lift;
  walls.scale.y = S.wallH; walls.children.forEach(o => { o.position.y = 0.5; });
  wallLineMat.opacity = 0.35 + 0.6 * clamp(band(g, 0.85, 4.1, 0.15) + band(g, 7.9, 9.9, 0.15));
  wallMat.opacity = 0.05 + 0.1 * band(g, 1.9, 3.1, 0.15);

  // ツマミ
  const a2 = band(g, 1.95, 3.05, 0.1);
  knobs.forEach((k, i) => {
    k.visible = a2 > 0.01; k.scale.setScalar(Math.max(0.001, a2));
    k.position.set(-2.55 + 1.7 * i, S.wallH + 0.12, FL / 2 + 0.05);
    k.userData.ptr.parent.rotation.y = -1.2 + 2.2 * ease(clamp(g - 2)) + i * 0.5;
  });

  // 更新の走査面
  const a3 = band(g, 2.95, 3.75, 0.1);
  scan.material.opacity = 0.22 * a3; scan.visible = a3 > 0.01;
  scan.position.set(0, 1.0, lerp(-FL / 2, FL / 2, ease(ramp(g, 3.05, 3.55))));

  // 作戦ボードと、案件ごとのボード
  const bloat = band(g, 5.12, 5.74, 0.06);
  edgeMat.opacity = 0.35 + 0.65 * bloat;
  edges.forEach((l, i) => { l.visible = i === 0 || bloat > 0.05; });
  const frz = ramp(g, 7.6, 7.7) * (1 - ramp(g, 7.98, 8.12));
  boardMat.color.setScalar(1 - 0.6 * frz);
  const a4 = band(g, 3.95, 5.1, 0.12), sp = ease(ramp(g, 4.0, 4.35));
  stack.forEach((s, k) => { s.visible = a4 > 0.01; s.position.set(0.25 * (k + 1) * sp, -(k + 1) * 0.62 * sp, 0); s.children.forEach(c => { c.material.opacity = (c.isMesh ? 0.85 : 0.45) * a4; }); });

  // 選手
  F = form(g);
  const grow = ramp(g, 3.5, 3.85) * (1 - ramp(g, 4.0, 4.3));
  S.pY = 0.21 * (1 + 0.45 * grow) + S.lift * 1.6;
  playerMat.emissiveIntensity = 0.35 + 0.9 * grow;
  playerMat.color.setScalar(1 - 0.45 * frz); playerMat.emissive.setScalar(1 - 0.5 * frz);
  players.forEach((p, i) => { const [x, z] = at(...F[i]); p.position.set(x, S.pY, z); p.scale.setScalar(1 + 0.45 * grow); });
  const [gx, gz] = at(.5, .955); gk.position.set(gx, 0.17 + S.lift * 1.6, gz);

  // 相手の攻め
  const atk = band(g, 5.72, 6.02, 0.03), k5 = ease(ramp(g, 5.74, 5.9));
  [[[.30, .42], [.35, .86]], [[.50, .38], [.50, .90]], [[.70, .42], [.65, .86]]].forEach(([p0, p1], i) => {
    const [x, z] = at(lerp(p0[0], p1[0], k5), lerp(p0[1], p1[1], k5)); reds[i].position.set(x, 0.21, z); reds[i].visible = atk > 0.01;
  });
  redMat.opacity = atk;
  const [bx, bz] = at(.5, .4 + .59 * ease(ramp(g, 5.74, 5.93))); ball.position.set(bx, 0.1, bz); ball.visible = atk > 0.01; ball.material.opacity = atk;

  // 審判
  const ar = band(g, 7.02, 8.06, 0.06);
  const [rx, rz] = at(.5, .47); referee.position.set(rx, 0.26, rz); referee.visible = ar > 0.01; referee.scale.setScalar(Math.max(0.001, ar));

  // カメラ
  const c = camAt(g), dist = c.d * (mobile ? 1.28 : 1.25);
  camera.position.set(Math.sin(c.az) * Math.cos(c.el) * dist, Math.sin(c.el) * dist, 0.3 + Math.cos(c.az) * Math.cos(c.el) * dist);
  camera.lookAt(0, mobile ? 0.2 : -0.3, 0.3);
  camera.updateMatrixWorld();

  renderer.render(scene, camera);

  // 文字
  for (const t of tags) {
    const a = t.alpha(g);
    if (a <= 0.01) { t.el.style.opacity = '0'; continue; }
    if (typeof t.text === 'function') { const s = t.text(g); if (t.el.textContent !== s) t.el.textContent = s; }
    v3.set(...t.anchor()).project(camera);
    const x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H;
    t.el.style.opacity = String(a);
    t.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
  }

  const ch = Math.floor(g);
  navs.forEach((a, i) => a.classList.toggle('on', ch === i + 1));
  stageEl.classList.toggle('off', g >= 9 && mobile);
  navEl.classList.toggle('gone', g >= 9);
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
}
function onScroll() { if (!queued) { queued = true; requestAnimationFrame(update); } }
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { measure(); update(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); update(); });
measure(); update();
