import './series.css';
import './harness.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createGrade } from './lib/look.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

// 3Dでわかる ハーネス：スクロールの位置 g（章番号＋章の中の進み 0〜1）で、3Dの場面を組み替える。
// 最初から最後まで、同じ画面に「作戦ボード1枚と、2つの試合（ゲーム制作・アプリ開発）」がある。
// スタジアム＝公式のハーネス（変えられない）、クラブハウス＝作戦ボードを書く場所、選手＝モデル、審判＝フック。
// 場面の出る時刻は、声の台本（public/narration/harness.json）の行の位置から決める。声と絵がずれないように。
const canvas = document.getElementById('stage');
const tagLayer = document.getElementById('tags');
const caption = document.getElementById('caption');
const secs = [...document.querySelectorAll('[data-ch]')];
const dayLinks = [...document.querySelectorAll('[data-day]')];
const layerLinks = [...document.querySelectorAll('[data-layer]')];
const dayNav = document.querySelector('.day-nav');
const layerNav = document.querySelector('.layer-nav');
const bar = document.getElementById('bar');
const stageEl = document.querySelector('.stage');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?motion：PR動画の書き出し用。時刻を外から1コマずつ進め、文字の演出を重ねる
const MOTION = new URLSearchParams(location.search).has('motion');
if (MOTION) document.documentElement.classList.add('motion');
let gOverride = null;

const COL = { bg: 0x060a13, text: 0xe7edf6, cyan: 0x96e5ff, orange: 0xffa777, red: 0xff7a7a, yellow: 0xffd84a, violet: 0xb79bff };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const ramp = (x, a, b) => clamp((x - a) / (b - a));
const band = (x, a, b, f = 0.08) => Math.min(ramp(x, a, a + f), 1 - ramp(x, b - f, b));
const lerp = (a, b, k) => a + (b - a) * k;

// フォーメーション（u＝横 0〜1、v＝縦 0〜1。v＝1 の側が自陣のゴール）
const F442 = [[.15,.80],[.38,.80],[.62,.80],[.85,.80],[.15,.58],[.38,.58],[.62,.58],[.85,.58],[.38,.33],[.62,.33]];
const F433 = [[.15,.80],[.38,.80],[.62,.80],[.85,.80],[.25,.58],[.50,.60],[.75,.58],[.20,.33],[.50,.30],[.80,.33]];
const F541 = [[.10,.79],[.30,.81],[.50,.82],[.70,.81],[.90,.79],[.18,.60],[.40,.60],[.60,.60],[.82,.60],[.50,.36]];
const F811 = [[.50,.80],[.50,.56],[.10,.30],[.21,.24],[.33,.30],[.44,.24],[.56,.30],[.67,.24],[.79,.30],[.90,.24]];
const shift = (F, dv) => F.map(([u, v]) => [u, clamp(v + dv, 0.1, 0.9)]);
const mix = (Fa, Fb, k) => Fa.map((p, j) => [lerp(p[0], Fb[j][0], k), lerp(p[1], Fb[j][1], k)]);

// ---------- 時刻：台本の行 ----------
// 章ごとの行数。声の台本が読めるまでは、章の中を行数で均等に割って使う。
const LINES = [2, 5, 7, 5, 5, 4, 4, 4];
const CHAPTERS = LINES.length;
let CUE = LINES.map(n => Array.from({ length: n }, (_, i) => [i / n, (i + 1) / n]));
// L(c, i, a, b)：c章 i行目の中の a〜b（0〜1）を、g の範囲で返す
const L = (c, i, a = 0, b = 1) => { const [f0, f1] = CUE[c][i]; return [c + lerp(f0, f1, a), c + lerp(f0, f1, b)]; };
const p = (c, i, a = 0) => L(c, i, a, a)[0];
const during = (g, c, i, f = 0.03) => band(g, ...L(c, i), f);
const span = (g, a, b, f = 0.04) => band(g, a, b, f);

// ---------- 場 ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(COL.bg, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(COL.bg, 0.018);
// 映り込み：スタジアム、選手、ピッチが部屋の光を拾う
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 260);
const grade = createGrade(renderer, scene, camera, { bloom: [0.78, 0.55, 0.58], grain: 0.045, chroma: 0.0022, vignette: 0.42 });
// 被写界深度：見ている物（画面の縦の真ん中）にピント、手前と奥をボカす。ミニチュアのように見える
const tiltH = new ShaderPass(HorizontalTiltShiftShader), tiltV = new ShaderPass(VerticalTiltShiftShader);
grade.composer.insertPass(tiltH, 1); grade.composer.insertPass(tiltV, 2);
tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.5;
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(4, 12, 6); scene.add(sun);

const PW = 6.8, PL = 10.5, M = 0.9;
const FW = PW + M * 2, FL = PL + M * 2;
const SEP = 4.4;                 // 左右のピッチの中心（x）
const SW = 2 * SEP + FW;         // スタジアムの内側の幅：2つのピッチを囲む
const at = (u, v) => [(u - 0.5) * PW, (v - 0.5) * PL];
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });
const withEdges = (mesh, mat) => { mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), mat)); return mesh; };
const venue = { stadium: [], club: [] };
let fadeTo = venue.stadium;
const fading = mat => { mat.transparent = true; mat.userData.base = mat.opacity; fadeTo.push(mat); return mat; };

// 地面
// 床：濡れたような光沢。照明と部屋の光が映り込む
const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: 0x060c16, roughness: 0.22, metalness: 0.65 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);

// 空：真上は深い紺、地平にかけて青緑の靄。カメラについてくる
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 256, 0, 0);
  [['#04070d', 0], ['#0a1a24', 0.42], ['#123040', 0.5], ['#0a1622', 0.6], ['#03060c', 1]].forEach(([col, at]) => gr.addColorStop(at, col));
  x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
sky.frustumCulled = false; scene.add(sky);

// 漂う粉塵：時刻だけで動く点。毎フレームの計算は GPU 側
const DUST = 520;
const dust = (() => {
  const pos = [], seed = [];
  for (let i = 0; i < DUST; i++) { pos.push((Math.random() - 0.5) * 24, Math.random() * 6, (Math.random() - 0.5) * 17); seed.push(Math.random(), Math.random(), Math.random()); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.3 } },
    vertexShader: `attribute vec3 aSeed; uniform float uTime; varying float vA;
      void main(){ vec3 q=position; float ph=aSeed.x*6.2832;
        q.x+=sin(uTime*(.07+aSeed.y*.06)+ph)*1.4; q.z+=cos(uTime*(.06+aSeed.z*.05)+ph)*1.2;
        q.y=mod(q.y+uTime*(.08+aSeed.z*.12),6.);
        vec4 mv=modelViewMatrix*vec4(q,1.); vA=(.35+.65*aSeed.y)*smoothstep(0.,1.2,q.y)*smoothstep(6.,4.5,q.y);
        gl_PointSize=max(1.,(1.+aSeed.z*1.6)*38./max(1.,-mv.z)); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; uniform float uOpacity;
      void main(){ vec2 d=gl_PointCoord-.5; float r=dot(d,d); if(r>.25) discard; gl_FragColor=vec4(vec3(.85,.95,1.),smoothstep(.25,0.,r)*vA*uOpacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts); return pts;
})();

// ピッチ
function pitchTexture() {
  const c = document.createElement('canvas'); c.width = 680; c.height = 1050;
  const x = c.getContext('2d');
  for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? '#0c1f2b' : '#0a1b26'; x.fillRect(0, i * 105, 680, 105); }
  x.strokeStyle = 'rgba(150,229,255,0.6)'; x.lineWidth = 4;
  x.strokeRect(10, 10, 660, 1030);
  x.beginPath(); x.moveTo(10, 525); x.lineTo(670, 525); x.stroke();
  x.beginPath(); x.arc(340, 525, 92, 0, Math.PI * 2); x.stroke();
  x.strokeRect(150, 10, 380, 150); x.strokeRect(150, 890, 380, 150);
  x.strokeRect(265, 10, 150, 50); x.strokeRect(265, 990, 150, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const pitchTex = pitchTexture();
const flat = mat => { const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PL), mat); m.rotation.x = -Math.PI / 2; scene.add(m); return m; };

// ---------- スタジアム（公式のハーネス）：2つのピッチをまるごと囲む ----------
const stadium = new THREE.Group(); scene.add(stadium);
const D = 2.2, HS = 1.6, TIERS = 4;
const standMat = fading(new THREE.MeshStandardMaterial({ color: 0x1c130c, emissive: COL.orange, emissiveIntensity: 0.06, opacity: 0.9, metalness: 0.3, roughness: 0.5 }));
const standLine = lineMat(COL.orange, 0.55);
for (let k = 0; k < TIERS; k++) {
  const o = (k * D) / TIERS, d = D / TIERS, h = ((k + 1) * HS) / TIERS;
  const sides = [
    [d, h, FL + 2 * (o + d), SW / 2 + o + d / 2, 0], [d, h, FL + 2 * (o + d), -(SW / 2 + o + d / 2), 0],
    [SW, h, d, 0, -(FL / 2 + o + d / 2)], [SW, h * 0.5, d, 0, FL / 2 + o + d / 2],
  ];
  for (const [w, hh, l, x, z] of sides) {
    const m = withEdges(new THREE.Mesh(new THREE.BoxGeometry(w, hh, l), standMat), standLine);
    m.position.set(x, hh / 2, z); stadium.add(m);
  }
}
const roofMat = fading(new THREE.MeshBasicMaterial({ color: COL.orange, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
[1, -1].forEach(s => {
  const r = withEdges(new THREE.Mesh(new THREE.BoxGeometry(D * 1.05, 0.06, FL + 2 * D), roofMat), standLine);
  r.position.set(s * (SW / 2 + D * 0.62), HS + 1.05, 0); r.rotation.z = s * -0.16; stadium.add(r);
});
{
  const r = withEdges(new THREE.Mesh(new THREE.BoxGeometry(SW + 2 * D, 0.06, D * 1.05), roofMat), standLine);
  r.position.set(0, HS + 1.05, -(FL / 2 + D * 0.62)); r.rotation.x = 0.16; stadium.add(r);
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,244,210,1)'); gr.addColorStop(0.25, 'rgba(255,220,160,0.45)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const glowMat = fading(new THREE.SpriteMaterial({ map: glowTexture(), depthWrite: false, blending: THREE.AdditiveBlending }));
// 照明の光の筋：先ほど明るく、根もとへ消えていく円すい
const lamps = [], beams = [];
const poolGeo = new THREE.PlaneGeometry(7, 7);
const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffd6a0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
const coneGeo = new THREE.ConeGeometry(2.6, 6.2, 32, 1, true);
const beamMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(0xffe6c2) }, uOpacity: { value: 0.075 } },
  vertexShader: `varying float vY; void main(){ vY=(position.y+3.1)/6.2; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying float vY; uniform vec3 uColor; uniform float uOpacity; void main(){ gl_FragColor=vec4(uColor, pow(vY,1.6)*uOpacity); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});
const poleMat = fading(new THREE.MeshStandardMaterial({ color: 0x2a1c12, emissive: COL.orange, emissiveIntensity: 0.15 }));
const headMat = fading(new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
  const x = sx * (SW / 2 + D + 0.5), z = sz * (FL / 2 + D + 0.5), H = 5.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, H, 10), poleMat); pole.position.set(x, H / 2, z); stadium.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.12), headMat); head.position.set(x, H, z); head.lookAt(0, 0, 0); stadium.add(head);
  const glow = new THREE.Sprite(glowMat); glow.position.set(x, H, z); glow.scale.setScalar(1.6); stadium.add(glow);
  const pool = new THREE.Mesh(poolGeo, poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(x * 0.9, 0.01, z * 0.9); stadium.add(pool);
  const lamp = new THREE.PointLight(0xffe2b8, 5.5, 22, 1.6); lamp.position.set(x, H - 0.2, z); stadium.add(lamp); lamps.push(lamp);
  const cone = new THREE.Mesh(coneGeo, beamMat); cone.position.set(x * 0.8, H / 2, z * 0.8);
  cone.lookAt(x * 0.35, 0, z * 0.35); cone.rotateX(-Math.PI / 2); stadium.add(cone); beams.push(cone);
});

// ツマミ（05）：正面スタンドの前に並ぶ、用意された操作盤
const knobs = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 32), new THREE.MeshStandardMaterial({ color: 0x241810, emissive: COL.orange, emissiveIntensity: 0.3 }));
  const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), new THREE.MeshBasicMaterial({ color: COL.orange }));
  ptr.position.set(0, 0.11, -0.12); const dial = new THREE.Group(); dial.add(body, ptr); g.add(dial); g.userData.dial = dial;
  scene.add(g); knobs.push(g);
}
const knobX = i => -2.55 + 1.7 * i, knobZ = FL / 2 + D + 0.9;

// 更新の走査面（07）
const scan = new THREE.Mesh(new THREE.PlaneGeometry(SW + 2 * D + 1, 4), new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
scene.add(scan);

// ---------- 作戦ボード（ホワイトボード）：陣形と、足したルールの付箋を描く ----------
function makeBoard(tilt) {
  const c = document.createElement('canvas'); c.width = 600; c.height = 400;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true });
  const edge = lineMat(COL.cyan, 0.9);
  const face = withEdges(new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.0), mat), edge);
  face.rotation.x = tilt;
  return { face, mat, edge, ctx: c.getContext('2d'), tex, key: '' };
}
// 付箋の位置：8枚までは右の余白、それ以上は陣形の上に重なる（付箋だらけ）
const NOTE_SPOTS = [[440, 22], [518, 34], [440, 114], [518, 126], [440, 206], [518, 218], [440, 298], [518, 310], [120, 70], [250, 220]];
function drawBoard(b, F, notes) {
  const key = F.map(q => q[0].toFixed(3) + q[1].toFixed(3)).join() + notes.join();
  if (key === b.key) return; b.key = key;
  const x = b.ctx;
  x.fillStyle = '#eef3f7'; x.fillRect(0, 0, 600, 400);
  const px = 40, py = 40, pw = 380, ph = 320;   // 横向きのピッチ（左が自陣）
  x.strokeStyle = '#2a6f8f'; x.lineWidth = 3; x.strokeRect(px, py, pw, ph);
  x.beginPath(); x.moveTo(px + pw / 2, py); x.lineTo(px + pw / 2, py + ph); x.stroke();
  x.beginPath(); x.arc(px + pw / 2, py + ph / 2, 42, 0, Math.PI * 2); x.stroke();
  x.strokeRect(px, py + ph / 2 - 70, 56, 140); x.strokeRect(px + pw - 56, py + ph / 2 - 70, 56, 140);
  x.fillStyle = '#1b3b52';
  F.forEach(([u, v]) => { x.beginPath(); x.arc(px + (1 - v) * pw, py + u * ph, 10, 0, Math.PI * 2); x.fill(); });
  x.beginPath(); x.arc(px + 0.045 * pw, py + ph / 2, 10, 0, Math.PI * 2); x.stroke();
  notes.forEach((n, i) => {
    const [nx, ny] = NOTE_SPOTS[i % NOTE_SPOTS.length];
    x.save(); x.translate(nx + 36, ny + 30); x.rotate((i % 2 ? 1 : -1) * 0.07);
    x.fillStyle = '#9fe6ff'; x.fillRect(-36, -30, 72, 60);
    x.fillStyle = '#06313f'; x.font = `700 ${n.length > 4 ? 12 : 15}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(n, 0, 0); x.restore();
  });
  b.tex.needsUpdate = true;
}

// ---------- クラブハウス（作戦ボードを書く場所） ----------
fadeTo = venue.club;
const CX = -(SW / 2 + D + 4.2), CZ = -1.2;
const club = new THREE.Group(); club.position.set(CX, 0, CZ); scene.add(club);
const clubLine = fading(lineMat(COL.cyan, 0.7));
const clubBody = withEdges(new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 4.4), fading(new THREE.MeshStandardMaterial({ color: 0x0c1c28, emissive: COL.cyan, emissiveIntensity: 0.05, opacity: 0.85 }))), clubLine);
clubBody.position.y = 0.9; club.add(clubBody);
{
  const s = new THREE.Shape(); s.moveTo(-2.0, 0); s.lineTo(2.0, 0); s.lineTo(0, 1.0); s.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(s, { depth: 4.8, bevelEnabled: false }); roofGeo.translate(0, 0, -2.4);
  const roof = withEdges(new THREE.Mesh(roofGeo, fading(new THREE.MeshStandardMaterial({ color: 0x0e2231, emissive: COL.cyan, emissiveIntensity: 0.08 }))), clubLine);
  roof.position.y = 1.8; club.add(roof);
}
const winMat = fading(new THREE.MeshBasicMaterial({ color: 0xbfefff, opacity: 0.55 }));
[-0.9, 0.9].forEach(x => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), winMat); w.position.set(x, 1.05, 2.21); club.add(w); });
{ const door = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.0), fading(new THREE.MeshBasicMaterial({ color: 0x2d5f78 }))); door.position.set(0, 0.5, 2.21); club.add(door); }
const whiteboard = new THREE.Group(); whiteboard.position.set(CX + 0.4, 0, CZ + 3.9); scene.add(whiteboard);
const clubBoard = makeBoard(-0.12);
fading(clubBoard.mat); fading(clubBoard.edge);
clubBoard.face.position.y = 1.9; whiteboard.add(clubBoard.face);
{
  const legMat = fading(new THREE.MeshStandardMaterial({ color: 0x3a4a5a }));
  [-1.2, 1.2].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 0.06), legMat); l.position.set(x, 1.45, 0.05); whiteboard.add(l); });
}
drawBoard(clubBoard, F442, []);

// ---------- 2つの試合：共通の作戦ボード1枚で、ゲーム制作とアプリ開発を戦う ----------
const SIDE = ['ゲーム制作', 'アプリ開発'];   // 0＝左、1＝右
const sideX = s => (s ? 1 : -1) * SEP;
const TB = { y: 4.4, z: -PL / 2 - 1.9, s: 1.7 };   // 作戦ボードの高さ・奥行き・大きさ
const ballGeo = new THREE.SphereGeometry(0.21, 28, 18);
const makeTeam = mat => Array.from({ length: 10 }, () => { const m = new THREE.Mesh(ballGeo, mat); scene.add(m); return m; });
function makeGK(mat) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), mat));
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 40), new THREE.MeshBasicMaterial({ color: COL.cyan }));
  r.rotation.x = Math.PI / 2; g.add(r); scene.add(g);
  return g;
}
const [GX, GZ] = at(0.5, 0.955);
const pitchMats = SIDE.map(() => new THREE.MeshStandardMaterial({ map: pitchTex, emissiveMap: pitchTex, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.3, metalness: 0.2, transparent: true }));
const pitches = pitchMats.map((m, s) => { const f = flat(m); f.position.x = sideX(s); return f; });
const teamMat = SIDE.map(() => new THREE.MeshStandardMaterial({ color: COL.text, emissive: COL.text, emissiveIntensity: 0.35, roughness: 0.22, metalness: 0.25 }));
const teams = teamMat.map(makeTeam);
const keepers = teamMat.map(makeGK);
const redMat = SIDE.map(() => new THREE.MeshStandardMaterial({ color: COL.red, emissive: COL.red, emissiveIntensity: 0.5, transparent: true }));
const reds = redMat.map(m => Array.from({ length: 3 }, () => { const r = new THREE.Mesh(ballGeo, m); scene.add(r); return r; }));
const balls = SIDE.map(() => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); scene.add(b); return b; });
const sharedBoard = makeBoard(-0.5);
const ownBoard = SIDE.map(() => makeBoard(-0.5));
[sharedBoard, ...ownBoard].forEach(b => { b.face.visible = false; b.face.scale.setScalar(TB.s); scene.add(b.face); });
const linkMat = new THREE.LineDashedMaterial({ color: COL.cyan, dashSize: 0.3, gapSize: 0.2, transparent: true });
const links = SIDE.map(() => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), linkMat); scene.add(l); return l; });

// 付箋：02章で「確認」「止まるな」、03章で8枚。ボードが1枚のあいだは、両方の試合に同じ陣形が効く
const EXTRA = ['片づけ', '重い処理', '記録', '言葉づかい', '命名', '報告', '手順', '禁止事項'];
const OWN_NOTE = ['止まるな', '確認'];
const OWN_FORM = [F433, F541];
function pileAt(g) {
  const notes = [];
  if (g >= p(2, 1, 0.1)) notes.push('確認');
  if (g >= p(2, 4, 0.1)) notes.push('止まるな');
  EXTRA.forEach((n, i) => { if (g >= p(3, 0, 0.1 + 0.8 * i / EXTRA.length)) notes.push(n); });
  return notes;
}
function sharedForm(g) {
  const hold = ramp(g, p(2, 1, 0.15), p(2, 1, 0.35)) * (1 - ramp(g, p(2, 4, 0.1), p(2, 4, 0.3)));   // 確認：下がって待つ
  const push = ramp(g, p(2, 4, 0.2), p(2, 4, 0.45)) * (1 - ramp(g, p(3, 2), p(3, 2, 0.5)));        // 止まるな：前へ出る
  return mix(shift(F442, 0.08 * hold - 0.13 * push), F811, ease(ramp(g, p(3, 2), p(3, 2, 0.5))));
}
// ボードを分けたあとは、それぞれの試合の陣形のまま最後まで戦う
const ownFrom = s => p(4, 1 + s);
function sideForm(s, g) { return mix(sharedForm(g), OWN_FORM[s], ease(ramp(g, ownFrom(s), ownFrom(s) + 0.05))); }

// 試合の出来事：concede＝失点、block＝守れた、score＝得点。窓は台本の行
const events = () => [
  { s: 1, type: 'concede', w: L(2, 0, 0.1, 0.9) },   // アプリ開発：確かめずに進めて失点
  { s: 1, type: 'block', w: L(2, 2, 0.05, 0.9) },    // ＋確認 → アプリ開発は守れる
  { s: 0, type: 'score', w: L(2, 5, 0.05, 0.9) },    // ＋止まるな → ゲーム制作は点が取れる
  { s: 1, type: 'concede', w: L(2, 5, 0.05, 0.9) },  //            → アプリ開発はカウンターで失点
  { s: 0, type: 'concede', w: L(3, 3, 0.05, 0.9) },  // 8-1-1 → 両方とも失点
  { s: 1, type: 'concede', w: L(3, 3, 0.05, 0.9) },
  { s: 0, type: 'score', w: L(4, 3, 0.05, 0.9) },    // ボードを分ける → 両方とも勝つ
  { s: 1, type: 'block', w: L(4, 3, 0.05, 0.9) },
];
const RESULT = { concede: ['bad', '失点', 0.86], block: ['good', '守れた', 0.66], score: ['good', '得点', 0.26] };

// 審判（06）：両方の試合に1人ずつ
const referees = SIDE.map(() => {
  const r = new THREE.Group();
  r.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), new THREE.MeshStandardMaterial({ color: 0x15130a, emissive: COL.yellow, emissiveIntensity: 0.15 })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 10, 44), new THREE.MeshBasicMaterial({ color: COL.yellow }));
  ring.rotation.x = Math.PI / 2; r.add(ring); scene.add(r);
  return r;
});

// ---------- 文字（3Dの位置に合わせて置く） ----------
const tags = [];
function tag(cls, text, anchor, alpha) {
  const el = document.createElement('div'); el.className = `tag ${cls}`; el.textContent = typeof text === 'string' ? text : '';
  tagLayer.append(el); tags.push({ el, text, anchor, alpha });
}
const v3 = new THREE.Vector3();
const S = { sy: 1, pY: 0.21, bsplit: 0 };
const rnd = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
const standTop = () => stadium.position.y + HS * S.sy;
const boardX = s => (s ? 1 : -1) * SEP * S.bsplit;
const boardTop = () => [0, TB.y + 1.1 * TB.s, TB.z - 0.6 * TB.s];
const boardFoot = () => [0, TB.y - 1.1 * TB.s, TB.z + 0.6 * TB.s];

// 01：同じボードで、2つの試合
SIDE.forEach((n, s) => tag('model', `${n}の試合`, () => [sideX(s), 0.1, -PL / 2 - 0.5], g => ramp(g, p(1, s), p(1, s) + 0.04) * (1 - ramp(g, 4.94, 5.0))));
tag('model', '選手＝モデル', () => { const q = teams[1][9].position; return [q.x, q.y + 0.7, q.z]; }, g => during(g, 1, 2));
tag('board', 'クラブハウス＝自分で書く場所', () => [CX, 3.4, CZ - 1.2], g => during(g, 1, 3));
tag('board', '作戦ボード（CLAUDE.md・メモリ・スキル・フック）', boardTop, g => during(g, 1, 3));
tag('board', '作戦ボード（1枚）', boardTop, g => span(g, p(1, 4), p(4, 0, 0.15)));
// 02：ルールを1つ足す
tag('add', '＋確認のルール', boardFoot, g => during(g, 2, 1));
tag('add', '＋止まるなのルール', boardFoot, g => during(g, 2, 4));
[8, 6, 1].forEach((i, k) => tag('wait', '確認待ち…', () => { const q = teams[0][i].position; return [q.x, 0.85, q.z]; }, g => band(g, p(2, 3, 0.05 * k), L(2, 3)[1], 0.02)));
tag('res bad', '攻めきれない', () => [sideX(0), 1.1, -PL * 0.3], g => during(g, 2, 3));
events().forEach((_, k) => {
  const { s, type } = events()[k], [cls, text, v] = RESULT[type];
  tag(`res ${cls}`, text, () => [sideX(s), 1.1, (v - 0.5) * PL], g => {
    const [a, b] = events()[k].w;
    return ramp(g, lerp(a, b, 0.55), lerp(a, b, 0.68)) * (1 - ramp(g, b + 0.01, b + 0.04));
  });
});
tag('fm', '確認＝足かせ ／ 止まるな＝助け', () => [sideX(0), 0.1, PL / 2 + 0.75], g => during(g, 2, 6));
tag('fm', '確認＝助け ／ 止まるな＝足かせ', () => [sideX(1), 0.1, PL / 2 + 0.75], g => during(g, 2, 6));
// 03：最大公倍数
tag('board', '最大公倍数', boardFoot, g => during(g, 3, 1));
tag('big', '8-1-1', () => [0, 1.6, -1.5], g => span(g, p(3, 2, 0.3), L(3, 4)[1], 0.03));
// 04：ボードを分ける
SIDE.forEach((n, s) => tag('board', `${n}のボード`, () => [boardX(s), TB.y + 1.1 * TB.s, TB.z - 0.6 * TB.s], g => span(g, ownFrom(s), 5.0)));
['4-3-3', '5-4-1'].forEach((f, s) => tag('fm', 'この試合の最適　' + f, () => [sideX(s), 0.1, PL / 2 + 0.75], g => span(g, p(4, 3), 5.0)));
// 05：変えられない地面と、4つのツマミ
tag('rule', 'スタジアム＝公式のハーネス（Claude Code）', () => [SW / 2 + D * 0.6, standTop() + 1.6, -FL / 2 - D * 0.6], g => span(g, p(5, 0), L(5, 1)[1]));
tag('rule', '変えられない', () => [0, standTop() + 1.4, -FL / 2 - D], g => during(g, 5, 1));
const KNOBS = ['モデル', '考える深さ', '許可', '道具'];
const knobTurn = (i, g) => ease(ramp(g, p(5, 3, i / 4), p(5, 3, (i + 0.8) / 4)));
const knobsOn = g => span(g, p(5, 2), 6.0);
KNOBS.forEach((n, i) => tag('rule knob', n, () => [knobX(i), 0.9, knobZ], g => {
  const on = knobsOn(g);
  const active = band(g, p(5, 3, i / 4), p(5, 3, (i + 1) / 4), 0.01);
  return on * (g < p(5, 3) ? 0.5 : g > L(5, 3)[1] ? 1 : 0.35 + 0.65 * Math.max(active, knobTurn(i, g) * (g > p(5, 3, (i + 1) / 4) ? 0.6 : 0)));
}));
// 06：審判
tag('ref', '審判＝フック', () => { const [x, z] = at(.5, .47); return [sideX(0) + x, 1.05, z]; }, g => span(g, p(6, 0), 7.0, 0.05));
tag('whistle', 'ピッ', () => { const [x, z] = at(.66, .40); return [sideX(1) + x, 0.9, z]; }, g => during(g, 6, 1, 0.02));
for (let i = 0; i < 14; i++) {
  tag('whistle', 'ピッ', () => { const [x, z] = at(0.12 + 0.76 * rnd(i, 1), 0.1 + 0.8 * rnd(i, 2)); return [sideX(i % 2) + x, 0.7, z]; },
    g => band(g, p(6, 2, 0.05 + 0.05 * i), Math.min(p(6, 2, 0.05 + 0.05 * i + 0.25), L(6, 2)[1]), 0.01));
}
tag('stop', '試合が止まる', () => [0, 0.8, 0.6], g => during(g, 6, 2));
tag('ref', '笛の加減は、人が決める', () => [0, 0.1, PL / 2 + 0.4], g => during(g, 6, 3));
// 07：明日は、相手が変わる
tag('rule', '更新 v2.1.283：/doctor prompt-audit', () => [0, standTop() + 1.6, scan.position.z], g => during(g, 7, 1));
tag('model', '選手の成長（新しいモデル）', () => { const q = teams[0][8].position; return [q.x, q.y + 1.0, q.z]; }, g => band(g, p(7, 1, 0.4), L(7, 1)[1], 0.03));
tag('rule', 'スタジアム＝公式のハーネス：変えられない', () => [SW / 2 + D * 0.6, standTop() + 1.6, -FL / 2 - D * 0.6], g => span(g, p(7, 3), 8.2));
tag('board', '作戦ボード：毎日組み直す', () => [boardX(0), TB.y + 1.1 * TB.s, TB.z - 0.6 * TB.s], g => span(g, p(7, 3), 8.2));

// ---------- カメラ（g ごとの見る場所） ----------
// tx/tz＝見る先。d＝距離（dm はスマホ）。
// 1行ごとの画：声が名指しした物へ寄る。ty＝見る高さ、mx＝スマホで見る先、blur＝ボケの強さ
const shot = o => ({ ty: 0.3, blur: 1, dm: o.d * 1.25, mx: o.tx, ...o });
const SH = {
  WIDE: shot({ az: 0.36, el: 0.62, d: 50, tx: -2.4, tz: 0, dm: 62, mx: -4, blur: 0.45 }),
  WIDE2: shot({ az: 0.3, el: 0.68, d: 44, tx: -0.5, tz: 0, dm: 56, mx: -2, blur: 0.55 }),
  TWIN: shot({ az: 0, el: 0.98, d: 44, tx: 2.8, tz: -1.4, dm: 41, mx: 0, blur: 0.6 }),
  LEFT: shot({ az: -0.16, el: 0.8, d: 25, tx: -4.4, tz: 0.6 }),
  RIGHT: shot({ az: 0.16, el: 0.8, d: 25, tx: 4.4, tz: 0.6 }),
  PLAYERS: shot({ az: 0.38, el: 0.46, d: 15, tx: 4.4, ty: 0.3, tz: 1.6, blur: 1.4 }),
  CLUB: shot({ az: -0.3, el: 0.62, d: 44, tx: -5.2, tz: -1, dm: 52, mx: -7, blur: 0.6 }),
  BOARD: shot({ az: 0, el: 0.3, d: 15, tx: 0, ty: 4.2, tz: -7, blur: 1.3 }),
  BOARDS: shot({ az: 0, el: 0.36, d: 22, tx: 0, ty: 4.0, tz: -6.5, blur: 1.1 }),
  BOARD_L: shot({ az: -0.24, el: 0.5, d: 20, tx: -4.4, ty: 2.6, tz: -4, blur: 1.2 }),
  BOARD_R: shot({ az: 0.24, el: 0.5, d: 20, tx: 4.4, ty: 2.6, tz: -4, blur: 1.2 }),
  STAND: shot({ az: 0.42, el: 0.46, d: 42, tx: 2.6, tz: 3, dm: 46, mx: 0, blur: 0.7 }),
  WALL: shot({ az: 0.3, el: 0.28, d: 22, tx: 4, ty: 2.2, tz: -8, mx: 0, blur: 1.1 }),
  KNOBS: shot({ az: 0, el: 0.66, d: 13, tx: 0, ty: 0.3, tz: 9.6, blur: 1.4 }),
  REF: shot({ az: -0.2, el: 0.55, d: 14, tx: -4.4, ty: 0.5, tz: 0, blur: 1.4 }),
  HIGH: shot({ az: 0.2, el: 1.1, d: 48, tx: 2, tz: -1, dm: 50, mx: 0, blur: 0.5 }),
};
const SHOTS = [
  ['WIDE', 'WIDE2'],
  ['LEFT', 'RIGHT', 'PLAYERS', 'CLUB', 'TWIN'],
  ['RIGHT', 'BOARD', 'RIGHT', 'LEFT', 'BOARD', 'TWIN', 'TWIN'],
  ['BOARD', 'BOARD', 'TWIN', 'TWIN', 'WIDE2'],
  ['BOARDS', 'BOARD_L', 'BOARD_R', 'TWIN', 'TWIN'],
  ['STAND', 'WALL', 'KNOBS', 'KNOBS'],
  ['REF', 'RIGHT', 'TWIN', 'TWIN'],
  ['TWIN', 'HIGH', 'TWIN', 'WIDE'],
];
// 行の頭で着いて、行の終わりまで留まり、次の行へ移る
function camKeys() {
  const keys = [];
  SHOTS.forEach((row, c) => row.forEach((name, i) => { keys.push([p(c, i, 0), SH[name]], [p(c, i, 0.82), SH[name]]); }));
  return keys;
}
function camAt(g) {
  const keys = camKeys();
  keys.forEach(([, c]) => { c.dm ??= c.d * 1.3; });
  if (g <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [g0, a] = keys[i], [g1, b] = keys[i + 1];
    if (g > g1) continue;
    const k = ease(clamp((g - g0) / Math.max(1e-4, g1 - g0))), o = {};
    for (const key in a) o[key] = lerp(a[key], b[key], k);
    return o;
  }
  return keys[keys.length - 1][1];
}

// ---------- ナビ：1日の回し方（横）と、見ている層（縦） ----------
const DAY = ['see', 'see', 'write', 'write', 'write', 'turn', 'ref', 'next'];
const dayAt = g => (g >= p(7, 2) ? 'see' : DAY[clamp(Math.floor(g), 0, CHAPTERS - 1)]);
function layerAt(g) {
  const c = Math.floor(g);
  if (c <= 0) return 'pitch';
  if (c === 1) return g >= p(1, 3) ? 'board' : 'pitch';
  if (c <= 4) return 'board';
  if (c === 5) return g >= p(5, 2) ? 'knob' : 'stadium';
  if (c === 6) return 'board';
  if (g < p(7, 1)) return 'pitch';
  return g < p(7, 2) ? 'stadium' : 'board';
}

// ---------- 大きさとスクロール ----------
let W = 0, H = 0, tops = [], hs = [], queued = false, mobile = false;
const probe = () => innerHeight * (mobile ? 0.73 : 0.5);
function measure() {
  W = canvas.clientWidth; H = canvas.clientHeight; mobile = innerWidth < 900;
  renderer.setSize(W, H, false);
  grade.setSize(W, H);
  if (mobile) { camera.aspect = W / H; camera.clearViewOffset(); }
  else if (MOTION) { camera.aspect = W / H; camera.clearViewOffset(); }
  else { camera.aspect = (W * 1.5) / H; camera.setViewOffset(W * 1.5, H, 0, 0, W, H); }
  camera.updateProjectionMatrix();
  tops = secs.map(s => s.getBoundingClientRect().top + window.scrollY);
  hs = secs.map(s => s.offsetHeight);
}
function progress() {
  const c = window.scrollY + probe();
  let g = 0;
  for (let i = 0; i < secs.length; i++) if (c >= tops[i]) g = i + clamp((c - tops[i]) / hs[i], 0, 0.999);
  const last = tops.length - 1;
  if (c >= tops[last] + hs[last]) g = CHAPTERS;
  return g;
}

// 冒頭：床（スタジアム）→ 2つのピッチ → 作戦ボード → 選手、の順に組み上がる
let intro = reduced ? 1 : 0, introStart = null;
function introTick(now) {
  introStart ??= now;
  intro = Math.min(1, (now - introStart) / 2800);
  if (intro < 1) requestAnimationFrame(introTick);
}

// 試合の出来事（相手とボールの動き）
function playEvent(s, g) {
  const rs = reds[s], ball = balls[s];
  rs.forEach(r => { r.visible = false; }); ball.visible = false;
  const e = events().find(ev => ev.s === s && g >= ev.w[0] - 0.01 && g <= ev.w[1] + 0.03);
  if (!e) return false;
  const [a, b] = e.w, k = ramp(g, a, b), alpha = band(g, a - 0.01, b + 0.03, 0.015), ox = sideX(s);
  redMat[s].opacity = alpha; redMat[s].color.setHex(COL.red); redMat[s].emissive.setHex(COL.red); ball.material.opacity = alpha;
  const put = (m, u, v, y) => { const [x, z] = at(u, v); m.position.set(ox + x, y, z); m.visible = true; };
  if (e.type === 'concede') {
    const kk = ease(k);
    [[.30, .42, .36, .86], [.50, .38, .50, .92], [.70, .42, .64, .86]].forEach(([u0, v0, u1, v1], i) => put(rs[i], lerp(u0, u1, kk), lerp(v0, v1, kk), 0.21));
    put(ball, 0.5, lerp(0.40, 0.99, ease(ramp(k, 0.15, 0.85))), 0.1);
  } else if (e.type === 'block') {
    const kk = ease(ramp(k, 0, 0.55));
    [[.30, .40, .34, .64], [.50, .36, .50, .60], [.70, .40, .66, .64]].forEach(([u0, v0, u1, v1], i) => put(rs[i], lerp(u0, u1, kk), lerp(v0, v1, kk), 0.21));
    put(ball, 0.5, k < 0.55 ? lerp(0.38, 0.70, ease(k / 0.55)) : lerp(0.70, 0.45, ease((k - 0.55) / 0.45)), 0.1);
  } else {
    const kb = ease(ramp(k, 0.1, 0.85));
    put(ball, lerp(0.5, 0.53, kb), lerp(0.55, 0.0, kb), 0.1);
  }
  return true;
}

// ---------- 声（映像として見る） ----------
let narration = null, audio = null, playing = false, spoken = -1, focus = null;
const narrationURL = new URL('../narration/harness.json', location.href);
fetch(narrationURL).then(r => (r.ok ? r.json() : null)).then(data => {
  if (!data) return;
  narration = data;
  // 台本の実際の尺で、章の中の行の位置を置き直す
  const byCh = LINES.map(() => []);
  data.lines.forEach(l => byCh[l.chapter]?.push(l));
  CUE = byCh.map((ls, c) => {
    if (ls.length !== LINES[c]) return CUE[c];
    const s0 = ls[0].start, d = Math.max(0.001, ls[ls.length - 1].end - s0);
    return ls.map(l => [(l.start - s0) / d, (l.end - s0) / d]);
  });
  audio = new Audio(new URL(data.audio.split('/').pop(), narrationURL).href);
  audio.preload = 'metadata'; audio.hidden = true; document.body.append(audio);
  audio.addEventListener('ended', stop);
  const note = document.getElementById('play-note');
  if (note) note.textContent = `音声つき / ${Math.floor(data.duration / 60)}分${String(Math.round(data.duration % 60)).padStart(2, '0')}秒`;
  update();
}).catch(() => {});
function scrollToG(g) {
  const c = clamp(Math.floor(g), 0, CHAPTERS - 1), f = g - c;
  // 'instant': the page's smooth scrolling would otherwise trail the voice by seconds
  window.scrollTo({ top: Math.max(0, tops[c] + f * hs[c] - probe()), behavior: 'instant' });
}
function playFrame() {
  if (!playing) return;
  const t = audio.currentTime, lines = narration.lines;
  let i = 0; lines.forEach((l, k) => { if (t >= l.start) i = k; });
  const cur = lines[i], same = lines.filter(l => l.chapter === cur.chapter);
  const s0 = same[0].start, d = Math.max(0.001, same[same.length - 1].end - s0);
  if (i !== spoken) { spoken = i; focus = cur.focus; caption.textContent = cur.text; caption.classList.add('on'); }
  scrollToG(cur.chapter + clamp((t - s0) / d, 0, 0.999));
  requestAnimationFrame(playFrame);
}
const playButton = document.getElementById('play'), stopButton = document.getElementById('stop-play');
function stop() {
  if (!playing) return;
  playing = false; spoken = -1; focus = null;
  if (audio) { audio.pause(); audio.currentTime = 0; }
  caption.classList.remove('on');
  playButton.setAttribute('aria-pressed', 'false'); stopButton.hidden = true;
  update();
}
playButton.addEventListener('click', () => {
  if (playing) { stop(); return; }
  if (!audio) return;
  measure(); scrollToG(0);
  audio.currentTime = 0; audio.play().catch(() => {});
  playing = true; playButton.setAttribute('aria-pressed', 'true'); stopButton.hidden = false;
  requestAnimationFrame(playFrame);
});
stopButton.addEventListener('click', stop);
for (const ev of ['wheel', 'touchstart']) addEventListener(ev, stop, { passive: true });
addEventListener('keydown', e => { if (['Escape', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) stop(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

// ---------- 1コマ ----------
const goal = new THREE.Vector3(), goalLook = new THREE.Vector3(), look = new THREE.Vector3();
let snap = true, clock = 0, frameDt = 0.016, last = 0, inView = true;
new IntersectionObserver(e => { inView = e[0].isIntersecting; }).observe(stageEl);
function update() {
  queued = false;
  const g = gOverride ?? progress();
  const grown = ease(ramp(intro, 0, 0.4)), fields = ramp(intro, 0.25, 0.55), boards = ramp(intro, 0.45, 0.72);

  // スタジアム：冒頭で地面から立ち上がり、05章でせり上がって光る
  const st5 = band(g, 5.0, 6.0, 0.06);
  S.sy = Math.max(0.02, grown) * (1 + 0.25 * ease(st5));
  stadium.scale.y = S.sy;
  venue.stadium.forEach(m => { m.opacity = m.userData.base; });
  // クラブハウスは出番（01章）と最後の全景だけ。ほかの章では本文の下に入ってしまう
  const clubVis = ramp(intro, 0.3, 0.6) * (1 - band(g, p(1, 4, 0.6), p(7, 3), 0.15));
  venue.club.forEach(m => { m.opacity = m.userData.base * clubVis; });
  club.visible = whiteboard.visible = clubVis > 0.01;
  standMat.emissiveIntensity = 0.06 + 0.22 * st5;
  standLine.opacity = 0.35 + 0.5 * st5;

  // ツマミ（05）
  const kOn = knobsOn(g);
  knobs.forEach((k, i) => {
    k.visible = kOn > 0.01; k.scale.setScalar(Math.max(0.001, kOn));
    k.position.set(knobX(i), 0.12, knobZ);
    k.userData.dial.rotation.y = -1.2 + 2.2 * knobTurn(i, g) + i * 0.5;
  });

  // 更新の走査面（07）
  const a7 = during(g, 7, 1);
  scan.material.opacity = 0.2 * a7; scan.visible = a7 > 0.01;
  scan.position.set(0, 2.0, lerp(-FL / 2 - D, FL / 2 + D, ease(ramp(g, p(7, 1, 0.05), p(7, 1, 0.8)))));

  // 2つの試合
  const dim = 1 - 0.5 * st5;                                                      // 05章は地面を見せる
  const frz = during(g, 6, 2);                                                    // 笛が多すぎて止まる
  const grow = ramp(g, p(7, 1, 0.3), p(7, 1, 0.6));                               // 新しいモデルで選手が育つ
  const stall = during(g, 2, 3, 0.02);                                            // 確認待ちで止まる（左）
  S.bsplit = ease(ramp(g, p(4, 0, 0.1), p(4, 0, 0.6)));
  const pile = pileAt(g), splitOn = g >= p(4, 0, 0.1);
  S.pY = 0.21 * (1 + 0.45 * grow);
  for (let s = 0; s < 2; s++) {
    const ox = sideX(s), F = sideForm(s, g);
    pitchMats[s].opacity = fields;
    pitchMats[s].color.setScalar((1 - 0.6 * frz) * dim * (s === 0 ? 1 - 0.3 * stall : 1));
    teamMat[s].color.setScalar((1 - 0.45 * frz) * (s === 0 ? 1 - 0.4 * stall : 1));
    teamMat[s].emissiveIntensity = (0.35 + 0.35 * grow) * (s === 0 ? 1 - 0.55 * stall : 1);
    teams[s].forEach((pl, i) => {
      const [x, z] = at(...F[i]);
      pl.position.set(ox + x, S.pY, z);
      pl.scale.setScalar(Math.max(0.001, ramp(intro, 0.6 + i * 0.025, 0.78 + i * 0.025)) * (1 + 0.45 * grow));
    });
    keepers[s].position.set(ox + GX, 0.17, GZ); keepers[s].scale.setScalar(Math.max(0.001, ramp(intro, 0.6, 0.8)));
    const b = ownBoard[s];
    b.face.visible = splitOn;
    if (splitOn) {
      b.mat.opacity = boards; b.edge.opacity = 0.9 * boards;
      b.face.position.set(boardX(s), TB.y, TB.z + 0.02 * (s + 1));
      drawBoard(b, F, g < ownFrom(s) ? pile : [OWN_NOTE[s]]);
    }
    const l = links[s];
    const fromX = splitOn ? boardX(s) : 0;
    const pos = l.geometry.attributes.position;
    pos.setXYZ(0, fromX, TB.y - 0.88 * TB.s, TB.z + 0.48 * TB.s); pos.setXYZ(1, ox, 0.03, -PL / 2 + 1.2); pos.needsUpdate = true;
    l.computeLineDistances();
    l.visible = g >= p(1, 4);
    const event = playEvent(s, g);
    // 07：明日は相手が変わる（新しい相手が、違う色で入ってくる）
    const rivals = span(g, p(7, 0), L(7, 1)[1], 0.03);
    if (!event && rivals > 0.01) {
      redMat[s].opacity = rivals;
      const hue = new THREE.Color(COL.red).lerp(new THREE.Color(COL.violet), ease(ramp(g, p(7, 0, 0.1), p(7, 0, 0.6))));
      redMat[s].color.copy(hue); redMat[s].emissive.copy(hue);
      [[.30, .30], [.50, .24], [.70, .30]].forEach(([u, v], i) => { const [x, z] = at(u, lerp(0.05, v, ease(ramp(g, p(7, 0), p(7, 0, 0.5))))); reds[s][i].position.set(ox + x, 0.21, z); reds[s][i].visible = true; });
    }
  }
  linkMat.opacity = ramp(g, p(1, 4), p(1, 4, 0.3)) * (0.45 + 0.5 * during(g, 2, 6, 0.04)) * dim;
  sharedBoard.face.visible = !splitOn;
  if (!splitOn) {
    sharedBoard.mat.opacity = boards; sharedBoard.edge.opacity = 0.9 * boards;
    sharedBoard.face.position.set(0, TB.y, TB.z);
    drawBoard(sharedBoard, sharedForm(g), pile);
  }

  // 審判（06）
  const ar = span(g, p(6, 0), 7.0, 0.06);
  referees.forEach((r, s) => { const [x, z] = at(.5, .47); r.position.set(sideX(s) + x, 0.26, z); r.visible = ar > 0.01; r.scale.setScalar(Math.max(0.001, ar)); });

  // カメラ
  const c = camAt(g), dist = mobile ? c.dm : c.d, tx = mobile ? c.mx : c.tx;
  goal.set(tx + Math.sin(c.az) * Math.cos(c.el) * dist, Math.sin(c.el) * dist, c.tz + Math.cos(c.az) * Math.cos(c.el) * dist);
  goalLook.set(tx, c.ty, c.tz);
  const blurPx = (mobile ? 2.6 : 4.2) * c.blur;
  tiltH.uniforms.h.value = blurPx / Math.max(1, W); tiltV.uniforms.v.value = blurPx / Math.max(1, H);
  const k = snap || reduced ? 1 : 1 - Math.exp(-frameDt * 2.6);
  camera.position.lerp(goal, k); look.lerp(goalLook, k); snap = false;
  camera.lookAt(look);
  camera.updateMatrixWorld();

  sky.position.copy(camera.position);
  dust.material.uniforms.uTime.value = clock;
  scene.fog.density = 0.75 / Math.max(10, camera.position.distanceTo(look));
  grade.render(clock);

  // 文字：声が名指ししたものだけを明るく、ほかは下げる
  for (const t of tags) {
    let a = t.alpha(g);
    if (a <= 0.01) { t.el.style.opacity = '0'; t.el.classList.remove('focus'); continue; }
    const text = typeof t.text === 'function' ? t.text(g) : t.text;
    if (t.el.textContent !== text) t.el.textContent = text;
    const named = !!focus && text.startsWith(focus);
    if (focus && !named) a *= 0.3;
    t.el.classList.toggle('focus', named);
    v3.set(...t.anchor()).project(camera);
    const x = (v3.x * 0.5 + 0.5) * W, y = (-v3.y * 0.5 + 0.5) * H;
    t.el.style.opacity = String(a);
    t.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
  }

  const day = dayAt(g), layer = layerAt(g), done = g >= CHAPTERS;
  dayLinks.forEach(a => a.classList.toggle('on', a.dataset.day === day));
  layerLinks.forEach(a => a.classList.toggle('on', a.dataset.layer === layer));
  dayNav.classList.toggle('loop', g >= p(7, 2) && !done);
  dayNav.classList.toggle('gone', done); layerNav.classList.toggle('gone', done);
  stageEl.classList.toggle('off', done && mobile);
  document.documentElement.dataset.chapter = String(Math.min(Math.floor(g), CHAPTERS - 1));
  document.documentElement.dataset.rendered = 'true';
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
}
// 常に描く：粉塵、光の筋、カメラの移動が止まらないように。見えていない間は止める
function loop(now) {
  requestAnimationFrame(loop);
  frameDt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  if (!inView || document.hidden) return;
  if (!reduced) clock += frameDt;
  update();
}
window.addEventListener('resize', () => { measure(); snap = true; });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
measure(); update();
if (!MOTION) { requestAnimationFrame(loop); if (!reduced) requestAnimationFrame(introTick); }

// ---------- PR動画（?motion） ----------
if (MOTION) {
  const mg = document.createElement('div'); mg.id = 'mg';
  mg.innerHTML = '<div class="mg-type"></div><div class="mg-dip"></div><div class="mg-end"><p>3Dでわかる</p><h1>ハーネス</h1><span>なぜ毎日組み直すのか</span></div>';
  document.body.append(mg);
  const typeEl = mg.querySelector('.mg-type'), dip = mg.querySelector('.mg-dip'), end = mg.querySelector('.mg-end');
  // [始まり秒, 終わり秒, g の始まり, g の終わり, 文字の行]
  const SEGS = () => [
    [0, 3, 0.02, 0.5, ['ハーネスは、なぜ', '<em>毎日</em>組み直すのか。']],
    [3, 8, p(1, 4, 0.2), p(1, 4, 0.8), ['ボードは<em>一枚</em>。', '試合は、<em>二つ</em>。']],
    [8, 13, p(2, 5, 0), p(2, 6, 0.8), ['同じルールが、', '<em>助け</em>にも、<b>足かせ</b>にもなる。']],
    [13, 18, p(3, 1, 0.2), p(3, 3, 0.9), ['気づけば、<em>最大公倍数</em>。', '攻撃的にしようとして、<b>8-1-1</b>。']],
    [18, 23, p(4, 0, 0), p(4, 3, 0.9), ['とある案件（試合）で最適なハーネスは、', '他の試合で<em>最適とはかぎらない</em>。']],
    [23, 27, p(7, 3, 0), p(7, 3, 0.95), ['だから、ハーネスは', '<em>毎日組み直す</em>。']],
    [27, 30.5, p(7, 3, 0.95), p(7, 3, 0.99), []],
  ];
  let segNow = -1;
  window.__frame = t => {
    const segs = SEGS();
    const i = Math.max(0, segs.findIndex(([a, b]) => t >= a && t < b));
    const [a, b, g0, g1, lines] = segs[i === -1 ? segs.length - 1 : i];
    const k = clamp((t - a) / (b - a));
    if (i !== segNow) {
      snap = i !== 0 || segNow === -1;
      segNow = i;
      typeEl.innerHTML = lines.map(l => `<div class="mg-line"><span>${l}</span></div>`).join('');
    }
    gOverride = lerp(g0, g1, k);
    intro = i === 0 ? clamp(t / 2.6) : 1;
    clock = t; frameDt = 1 / 30;
    update();
    // 1行ずつ下からせり上がり、場面の終わりで消える
    [...typeEl.children].forEach((el, j) => {
      const inK = ease(ramp(t, a + 0.25 + j * 0.35, a + 0.85 + j * 0.35)), outK = ramp(t, b - 0.45, b - 0.1);
      el.firstChild.style.transform = `translateY(${(1 - inK) * 110}%)`;
      el.style.opacity = String(1 - outK);
    });
    // 場面の変わり目で0.25秒の暗転、最後は暗くしてエンドカード
    const cut = Math.max(...segs.slice(1).map(([s0]) => 1 - clamp(Math.abs(t - s0) / 0.14)));
    const endK = ramp(t, 27, 27.6);
    dip.style.opacity = String(Math.max(cut, endK * 0.86));
    end.style.opacity = String(ease(ramp(t, 27.3, 28.1)));
    end.style.transform = `translateY(${(1 - ease(ramp(t, 27.3, 28.1))) * 16}px)`;
    return true;
  };
  window.__ready = false;
  const wait = () => (narration ? (window.__ready = true) : setTimeout(wait, 100));
  wait();
}
