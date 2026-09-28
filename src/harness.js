import './series.css';
import './harness.css';
import * as THREE from 'three';

// 3Dでわかる ハーネス：スクロールの位置 g（章番号＋章の中の進み 0〜1）で、3Dの場面を組み替える。
// スタジアム＝公式のハーネス（変えられない）、クラブハウス＝作戦ボードを書く場所（自分で書く）、選手＝モデル。
// 05〜06章は、共通の作戦ボード1枚で2つの試合（ゲーム制作・アプリ開発）を戦う場面に切り替わる。
const canvas = document.getElementById('stage');
const tagLayer = document.getElementById('tags');
const secs = [...document.querySelectorAll('[data-ch]')];
const navs = [...document.querySelectorAll('.nav a')];
const bar = document.getElementById('bar');
const stageEl = document.querySelector('.stage');
const navEl = document.querySelector('.nav');

const COL = { bg: 0x060a13, text: 0xe7edf6, cyan: 0x96e5ff, orange: 0xffa777, red: 0xff7a7a, yellow: 0xffd84a };
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

// ---------- 場 ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(COL.bg, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COL.bg, 40, 80);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(4, 12, 6); scene.add(sun);

const PW = 6.8, PL = 10.5, M = 0.9;
const FW = PW + M * 2, FL = PL + M * 2;
const at = (u, v) => [(u - 0.5) * PW, (v - 0.5) * PL];
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });
const withEdges = (mesh, mat) => { mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), mat)); return mesh; };
// スタジアムとクラブハウスは、05〜06章のあいだ消える（クラブハウスは07章も）。消す材質をここに集める
const venue = { stadium: [], club: [] };
let fadeTo = venue.stadium;
const fading = mat => { mat.transparent = true; mat.userData.base = mat.opacity; fadeTo.push(mat); return mat; };

// 地面
const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ color: 0x070d17 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);

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
const pitchMat = new THREE.MeshBasicMaterial({ map: pitchTex });
const pitch = flat(pitchMat);

// ---------- スタジアム（公式のハーネス） ----------
const stadium = new THREE.Group(); scene.add(stadium);
const D = 2.2, HS = 1.6, TIERS = 4;
const standMat = fading(new THREE.MeshStandardMaterial({ color: 0x1c130c, emissive: COL.orange, emissiveIntensity: 0.06, opacity: 0.9 }));
const standLine = lineMat(COL.orange, 0.55);
for (let k = 0; k < TIERS; k++) {
  const o = (k * D) / TIERS, d = D / TIERS, h = ((k + 1) * HS) / TIERS;
  const sides = [
    [d, h, FL + 2 * (o + d), FW / 2 + o + d / 2, 0], [d, h, FL + 2 * (o + d), -(FW / 2 + o + d / 2), 0],
    [FW, h, d, 0, -(FL / 2 + o + d / 2)], [FW, h * 0.5, d, 0, FL / 2 + o + d / 2],
  ];
  for (const [w, hh, l, x, z] of sides) {
    const m = withEdges(new THREE.Mesh(new THREE.BoxGeometry(w, hh, l), standMat), standLine);
    m.position.set(x, hh / 2, z); stadium.add(m);
  }
}
// 屋根（左右と奥のスタンドの上）
const roofMat = fading(new THREE.MeshBasicMaterial({ color: COL.orange, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
[1, -1].forEach(s => {
  const r = withEdges(new THREE.Mesh(new THREE.BoxGeometry(D * 1.05, 0.06, FL + 2 * D), roofMat), standLine);
  r.position.set(s * (FW / 2 + D * 0.62), HS + 1.05, 0); r.rotation.z = s * -0.16; stadium.add(r);
});
{
  const r = withEdges(new THREE.Mesh(new THREE.BoxGeometry(FW + 2 * D, 0.06, D * 1.05), roofMat), standLine);
  r.position.set(0, HS + 1.05, -(FL / 2 + D * 0.62)); r.rotation.x = 0.16; stadium.add(r);
}
// 照明塔
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,244,210,1)'); gr.addColorStop(0.25, 'rgba(255,220,160,0.45)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const glowMat = fading(new THREE.SpriteMaterial({ map: glowTexture(), depthWrite: false, blending: THREE.AdditiveBlending }));
const poleMat = fading(new THREE.MeshStandardMaterial({ color: 0x2a1c12, emissive: COL.orange, emissiveIntensity: 0.15 }));
const headMat = fading(new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
  const x = sx * (FW / 2 + D + 0.5), z = sz * (FL / 2 + D + 0.5), H = 5.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, H, 10), poleMat); pole.position.set(x, H / 2, z); stadium.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.12), headMat); head.position.set(x, H, z); head.lookAt(0, 0, 0); stadium.add(head);
  const glow = new THREE.Sprite(glowMat); glow.position.set(x, H, z); glow.scale.setScalar(1.6); stadium.add(glow);
});

// ツマミ（02）：正面スタンドの前に並ぶ、用意された操作盤
const knobs = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 32), new THREE.MeshStandardMaterial({ color: 0x241810, emissive: COL.orange, emissiveIntensity: 0.3 }));
  const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), new THREE.MeshBasicMaterial({ color: COL.orange }));
  ptr.position.set(0, 0.11, -0.12); const dial = new THREE.Group(); dial.add(body, ptr); g.add(dial); g.userData.dial = dial;
  scene.add(g); knobs.push(g);
}

// 更新の走査面（03）
const scan = new THREE.Mesh(new THREE.PlaneGeometry(FW + 2 * D + 1, 4), new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
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
  const key = F.map(p => p[0].toFixed(3) + p[1].toFixed(3)).join() + notes.join();
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
const CX = -(FW / 2 + D + 4.2), CZ = -1.2;
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
// 窓の明かりと扉
const winMat = fading(new THREE.MeshBasicMaterial({ color: 0xbfefff, opacity: 0.55 }));
[-0.9, 0.9].forEach(x => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), winMat); w.position.set(x, 1.05, 2.21); club.add(w); });
{ const door = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.0), fading(new THREE.MeshBasicMaterial({ color: 0x2d5f78 }))); door.position.set(0, 0.5, 2.21); club.add(door); }
// クラブハウスの前に立てた作戦ボード
const whiteboard = new THREE.Group(); whiteboard.position.set(CX + 0.4, 0, CZ + 3.9); scene.add(whiteboard);
const clubBoard = makeBoard(-0.12);
fading(clubBoard.mat); fading(clubBoard.edge);
clubBoard.face.position.y = 1.9; whiteboard.add(clubBoard.face);
{
  const legMat = fading(new THREE.MeshStandardMaterial({ color: 0x3a4a5a }));
  [-1.2, 1.2].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 0.06), legMat); l.position.set(x, 1.45, 0.05); whiteboard.add(l); });
}
drawBoard(clubBoard, F442, []);

// 案件ごとのボード（04）：作戦ボードから4枚に分かれる
const caseBoards = [];
const caseMat = new THREE.MeshBasicMaterial({ color: 0xdbe8f0, transparent: true, side: THREE.DoubleSide });
const caseLine = lineMat(COL.cyan, 0.9);
for (let k = 0; k < 4; k++) {
  const b = withEdges(new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.85), caseMat), caseLine);
  b.visible = false; scene.add(b); caseBoards.push(b);
}

// ---------- 選手 ----------
const playerMat = new THREE.MeshStandardMaterial({ color: COL.text, emissive: COL.text, emissiveIntensity: 0.35, roughness: 0.35 });
const ballGeo = new THREE.SphereGeometry(0.21, 28, 18);
const makeTeam = mat => Array.from({ length: 10 }, () => { const m = new THREE.Mesh(ballGeo, mat); scene.add(m); return m; });
function makeGK(mat) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), mat));
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 40), new THREE.MeshBasicMaterial({ color: COL.cyan }));
  r.rotation.x = Math.PI / 2; g.add(r); scene.add(g);
  return g;
}
const players = makeTeam(playerMat);
const gk = makeGK(playerMat);
const [GX, GZ] = at(0.5, 0.955);

// ---------- 2つの試合（05〜06）：共通の作戦ボード1枚で、ゲーム制作とアプリ開発を戦う ----------
const SIDE = ['ゲーム制作', 'アプリ開発'];   // 0＝左、1＝右
const SEP = 4.4;                            // 左右のピッチの中心（x）
const TB = { y: 3.3, z: -PL / 2 - 1.9, s: 1.7 };   // 作戦ボードの高さ・奥行き・大きさ
const twinPitch = SIDE.map(() => flat(new THREE.MeshBasicMaterial({ map: pitchTex })));
const twinMat = SIDE.map(() => new THREE.MeshStandardMaterial({ color: COL.text, emissive: COL.text, emissiveIntensity: 0.35, roughness: 0.35 }));
const twinTeam = twinMat.map(makeTeam);
const twinGK = twinMat.map(makeGK);
const twinRedMat = SIDE.map(() => new THREE.MeshStandardMaterial({ color: COL.red, emissive: COL.red, emissiveIntensity: 0.5, transparent: true }));
const twinReds = twinRedMat.map(m => Array.from({ length: 3 }, () => { const r = new THREE.Mesh(ballGeo, m); scene.add(r); return r; }));
const twinBall = SIDE.map(() => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); scene.add(b); return b; });
const sharedBoard = makeBoard(-0.5);
const ownBoard = SIDE.map(() => makeBoard(-0.5));
[sharedBoard, ...ownBoard].forEach(b => { b.face.visible = false; b.face.scale.setScalar(TB.s); scene.add(b.face); });
const linkMat = new THREE.LineDashedMaterial({ color: COL.cyan, dashSize: 0.3, gapSize: 0.2, transparent: true });
const links = SIDE.map(() => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), linkMat); scene.add(l); return l; });

// 共通のボードに貼られていく付箋と、貼られる g
const PILE = [['確認', 5.29], ['止まるな', 5.52], ...['片づけ', '重い処理', '記録', '言葉づかい', '命名', '報告', '手順', '禁止事項'].map((n, i) => [n, 6.02 + 0.02 * i])];
const OWN_NOTE = ['止まるな', '確認'];
const OWN_FORM = [F433, F541];
// ボードが1枚のあいだは、両方の試合に同じ陣形が効く
function sharedForm(g) {
  const hold = ramp(g, 5.30, 5.35) * (1 - ramp(g, 5.53, 5.57));   // 確認：下がって待つ
  const push = ramp(g, 5.53, 5.58) * (1 - ramp(g, 6.10, 6.24));   // 止まるな：前へ出る
  return mix(shift(F442, 0.08 * hold - 0.13 * push), F811, ease(ramp(g, 6.10, 6.24)));
}
// ボードを分けたあとは、それぞれの試合の陣形へ。07章の前に1つのピッチへ戻る
function twinForm(s, g) {
  const own = ease(ramp(g, 6.54, 6.64)), back = ease(ramp(g, 6.95, 7.05));
  return mix(mix(sharedForm(g), OWN_FORM[s], own), F442, back);
}
// 試合の出来事：concede＝失点、block＝守れた、score＝得点
const EVENTS = [
  { s: 1, type: 'concede', a: 5.10, b: 5.24 },   // アプリ開発：確かめずに進めて失点
  { s: 1, type: 'block', a: 5.33, b: 5.48 },     // ＋確認 → アプリ開発は守れる
  { s: 0, type: 'score', a: 5.57, b: 5.72 },     // ＋止まるな → ゲーム制作は点が取れる
  { s: 1, type: 'concede', a: 5.57, b: 5.72 },   //            → アプリ開発はカウンターで失点
  { s: 0, type: 'concede', a: 6.30, b: 6.46 },   // 8-1-1 → 両方とも失点
  { s: 1, type: 'concede', a: 6.30, b: 6.46 },
  { s: 0, type: 'score', a: 6.70, b: 6.86 },     // ボードを分ける → 両方とも勝つ
  { s: 1, type: 'block', a: 6.70, b: 6.86 },
];
const RESULT = { concede: ['bad', '失点', 0.86], block: ['good', '守れた', 0.66], score: ['good', '得点', 0.26] };

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
const S = { lift: 0, sy: 1, pY: 0.21, split: 0, bsplit: 0 };
const rnd = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
const standTop = () => stadium.position.y + HS * S.sy;
const wbTop = () => [whiteboard.position.x, 3.2, whiteboard.position.z];
const sideX = s => (s ? 1 : -1) * SEP * S.split;
const boardX = s => (s ? 1 : -1) * SEP * S.bsplit;

tag('rule', g => (g >= 7.9 ? 'スタジアム＝公式のハーネス：変えられない' : 'スタジアム＝公式のハーネス（Claude Code）'), () => [FW / 2 + D * 0.6, standTop() + 1.6, -FL / 2 - D * 0.6], g => clamp(band(g, 0.85, 4.1, 0.15) + band(g, 7.9, 9.9, 0.15)));
tag('rule', '変えられない', () => [0, standTop() + 1.4, -FL / 2 - D], g => band(g, 1.95, 3.05, 0.1));
['モデル', '考える深さ', '許可', '道具'].forEach((n, i) => tag('rule', n, () => [-2.55 + 1.7 * i, 0.9, FL / 2 + D + 0.9], g => band(g, 1.95, 3.05, 0.1)));
tag('rule', '更新 v2.1.283：/doctor prompt-audit', () => [0, standTop() + 1.6, scan.position.z], g => band(g, 3.15, 4.05, 0.08));
tag('model', '選手の成長（新しいモデル）', () => [0, S.pY + 1.1, -0.4], g => band(g, 3.55, 4.02, 0.08));
tag('model', '選手＝モデル', () => [PW / 2 - 0.6, S.pY + 0.7, -1.6], g => band(g, 0.95, 2.0, 0.12));
tag('board', 'クラブハウス＝自分で書く場所', () => [CX, 3.4, CZ - 1.2], g => clamp(band(g, 0.85, 2.0, 0.12) + band(g, 7.9, 9.9, 0.15)));
tag('board', '作戦ボード（CLAUDE.md・スキル・フック）', wbTop, g => band(g, 0.9, 2.0, 0.12));
tag('board', '共通のボード（全体用）', wbTop, g => band(g, 3.95, 4.98, 0.12));
tag('board', '案件ごとのボード', () => [whiteboard.position.x, 5.1, whiteboard.position.z + 0.6], g => band(g, 4.15, 4.98, 0.1));
['ゲーム制作', 'アプリ開発', '資料づくり', '広報'].forEach((n, k) => tag('board', n, () => { const p = caseBoards[k].position; return [p.x, p.y - 0.62, p.z]; }, g => band(g, 4.2, 4.98, 0.1)));
tag('board', '作戦ボード：毎日組み直す', wbTop, g => band(g, 8.05, 9.9, 0.12));

// 05〜06：2つの試合
SIDE.forEach((n, s) => tag('model', `${n}の試合`, () => [sideX(s), 0.1, -PL / 2 - 0.5], g => band(g, 5.05, 6.96, 0.05)));
tag('board', '共通の作戦ボード（1枚）', () => [0, TB.y + 1.1 * TB.s, TB.z - 0.6 * TB.s], g => band(g, 5.05, 6.55, 0.04));
tag('add', '＋確認のルール', () => [0, TB.y - 1.1 * TB.s, TB.z + 0.6 * TB.s], g => band(g, 5.27, 5.40, 0.02));
tag('add', '＋止まるなのルール', () => [0, TB.y - 1.1 * TB.s, TB.z + 0.6 * TB.s], g => band(g, 5.50, 5.63, 0.02));
[8, 6, 1].forEach((i, k) => tag('wait', '確認待ち…', () => { const p = twinTeam[0][i].position; return [p.x, 0.85, p.z]; }, g => band(g, 5.34 + 0.02 * k, 5.53, 0.02)));
tag('res bad', '攻めきれない', () => [sideX(0), 1.1, -PL * 0.3], g => band(g, 5.40, 5.53, 0.02));
EVENTS.forEach(e => {
  const [cls, text, v] = RESULT[e.type];
  tag(`res ${cls}`, text, () => [sideX(e.s), 1.1, (v - 0.5) * PL], g => ramp(g, lerp(e.a, e.b, 0.62), lerp(e.a, e.b, 0.72)) * (1 - ramp(g, e.b + 0.015, e.b + 0.045)));
});
tag('fm', '確認＝足かせ ／ 止まるな＝助け', () => [sideX(0), 0.1, PL / 2 + 0.75], g => band(g, 5.77, 5.99, 0.04));
tag('fm', '確認＝助け ／ 止まるな＝足かせ', () => [sideX(1), 0.1, PL / 2 + 0.75], g => band(g, 5.77, 5.99, 0.04));
tag('board', '気づけば、最大公倍数', () => [0, TB.y - 1.1 * TB.s, TB.z + 0.6 * TB.s], g => band(g, 6.06, 6.28, 0.03));
tag('big', '8-1-1', () => [0, 1.6, -1.5], g => band(g, 6.18, 6.50, 0.03));
SIDE.forEach((n, s) => tag('board', `${n}のボード`, () => [boardX(s), TB.y + 1.1 * TB.s, TB.z - 0.6 * TB.s], g => band(g, 6.58, 6.96, 0.03)));
['4-3-3', '5-4-1'].forEach((f, s) => tag('fm', 'この試合の最適　' + f, () => [sideX(s), 0.1, PL / 2 + 0.75], g => band(g, 6.62, 6.96, 0.03)));

// 07：審判
tag('ref', '審判＝フック', () => { const [x, z] = at(.5, .47); return [x, 1.05, z]; }, g => band(g, 7.02, 8.06, 0.06));
tag('whistle', 'ピッ', () => { const [x, z] = at(.66, .40); return [x, 0.9, z]; }, g => band(g, 7.18, 7.34, 0.03));
for (let i = 0; i < 14; i++) {
  const st = 7.46 + i * 0.025;
  tag('whistle', 'ピッ', () => { const [x, z] = at(0.12 + 0.76 * rnd(i, 1), 0.1 + 0.8 * rnd(i, 2)); return [x, 0.7, z]; }, g => band(g, st, st + 0.14, 0.02) * (1 - ramp(g, 7.86, 7.95)));
}
tag('stop', '試合が止まる', () => [0, 0.8, 0.6], g => ramp(g, 7.6, 7.7) * (1 - ramp(g, 7.98, 8.12)));
tag('ref', '笛の加減は、人が決める', () => [0, 0.1, PL / 2 + 0.4], g => band(g, 7.8, 8.05, 0.04));

// ---------- カメラ（g ごとの見る場所） ----------
// tx/tz＝見る先。d＝距離（dm はスマホ）。05〜06章は2つのピッチが両方入る位置で止める。
const TWIN = { az: 0, el: 0.98, d: 36, dm: 34, tx: 0, tz: -1.6 };
const CAM = [
  [0.5, { az: 0.42, el: 0.62, d: 29, tx: -3.5, tz: 0 }],             // 00 はじめ
  [1.5, { az: -0.35, el: 0.5, d: 30, tx: -3.5, tz: 0 }],             // 01 3つの層
  [2.5, { az: 0.5, el: 0.55, d: 24, tx: 0, tz: 1 }],                 // 02 ことわり
  [3.5, { az: 0.22, el: 0.72, d: 25, tx: 0, tz: 0 }],                // 03 変わる
  [4.5, { az: -0.3, el: 0.3, d: 18, tx: CX + 0.6, tz: CZ + 2.5 }],   // 04 ボード
  [4.97, TWIN], [6.97, TWIN],                                          // 05〜06 2つの試合
  [7.5, { az: -0.22, el: 0.96, d: 25, tx: 0, tz: 0.3 }],             // 07 審判
  [8.5, { az: 0.42, el: 0.6, d: 29, tx: -3.5, tz: 0 }],              // 08 まとめ
];
CAM.forEach(([, c]) => { c.dm ??= c.d * 1.3; });
function camAt(g) {
  if (g <= CAM[0][0]) return CAM[0][1];
  for (let i = 0; i < CAM.length - 1; i++) {
    const [g0, a] = CAM[i], [g1, b] = CAM[i + 1];
    if (g > g1) continue;
    const k = ease((g - g0) / (g1 - g0)), o = {};
    for (const key in a) o[key] = lerp(a[key], b[key], k);
    return o;
  }
  return CAM[CAM.length - 1][1];
}

// ---------- 大きさとスクロール ----------
let W = 0, H = 0, tops = [], hs = [], queued = false, mobile = false;
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

// 2つの試合の出来事（相手とボールの動き）
function playEvent(s, g, on) {
  const reds = twinReds[s], ball = twinBall[s];
  reds.forEach(r => { r.visible = false; }); ball.visible = false;
  const e = on && EVENTS.find(ev => ev.s === s && g >= ev.a - 0.01 && g <= ev.b + 0.03);
  if (!e) return;
  const k = ramp(g, e.a, e.b), alpha = band(g, e.a - 0.01, e.b + 0.03, 0.015), ox = sideX(s);
  twinRedMat[s].opacity = alpha; ball.material.opacity = alpha;
  const put = (m, u, v, y) => { const [x, z] = at(u, v); m.position.set(ox + x, y, z); m.visible = true; };
  if (e.type === 'concede') {
    const kk = ease(k);
    [[.30, .42, .36, .86], [.50, .38, .50, .92], [.70, .42, .64, .86]].forEach(([u0, v0, u1, v1], i) => put(reds[i], lerp(u0, u1, kk), lerp(v0, v1, kk), 0.21));
    put(ball, 0.5, lerp(0.40, 0.99, ease(ramp(k, 0.15, 0.85))), 0.1);
  } else if (e.type === 'block') {
    const kk = ease(ramp(k, 0, 0.55));
    [[.30, .40, .34, .64], [.50, .36, .50, .60], [.70, .40, .66, .64]].forEach(([u0, v0, u1, v1], i) => put(reds[i], lerp(u0, u1, kk), lerp(v0, v1, kk), 0.21));
    put(ball, 0.5, k < 0.55 ? lerp(0.38, 0.70, ease(k / 0.55)) : lerp(0.70, 0.45, ease((k - 0.55) / 0.45)), 0.1);
  } else {
    const kb = ease(ramp(k, 0.1, 0.85));
    put(ball, lerp(0.5, 0.53, kb), lerp(0.55, 0.0, kb), 0.1);
  }
}

function update() {
  queued = false;
  const g = progress();

  // スタジアムとクラブハウス：05〜06章のあいだは消して、2つの試合だけを見せる
  const sf = 1 - band(g, 4.93, 7.1, 0.1), cf = 1 - band(g, 4.93, 7.95, 0.1);
  venue.stadium.forEach(m => { m.opacity = m.userData.base * sf; });
  venue.club.forEach(m => { m.opacity = m.userData.base * cf; });
  stadium.visible = sf > 0.005;
  club.visible = whiteboard.visible = cf > 0.005;

  // 3つの層を上下に離して見せる（01）：スタジアムは沈み、選手は浮き、クラブハウスはそのまま
  S.lift = ease(band(g, 0.85, 2.05, 0.3));
  const rule = clamp(band(g, 0.85, 4.1, 0.15) + band(g, 7.9, 9.9, 0.15));
  S.sy = 1 + 0.25 * ease(band(g, 1.9, 3.1, 0.2));
  stadium.position.y = -1.6 * S.lift;
  stadium.scale.y = S.sy;
  standLine.opacity = (0.35 + 0.55 * rule) * sf;
  standMat.emissiveIntensity = 0.06 + 0.2 * band(g, 1.9, 3.1, 0.15);

  // ツマミ
  const a2 = band(g, 1.95, 3.05, 0.1);
  knobs.forEach((k, i) => {
    k.visible = a2 > 0.01; k.scale.setScalar(Math.max(0.001, a2));
    k.position.set(-2.55 + 1.7 * i, 0.12, FL / 2 + D + 0.9);
    k.userData.dial.rotation.y = -1.2 + 2.2 * ease(clamp(g - 2)) + i * 0.5;
  });

  // 更新の走査面：スタジアムを奥から手前へなめる
  const a3 = band(g, 2.95, 3.75, 0.1);
  scan.material.opacity = 0.2 * a3; scan.visible = a3 > 0.01;
  scan.position.set(0, 2.0, lerp(-FL / 2 - D, FL / 2 + D, ease(ramp(g, 3.05, 3.55))));

  // 選手（01〜04、07〜08）
  const frz = ramp(g, 7.6, 7.7) * (1 - ramp(g, 7.98, 8.12));
  pitchMat.color.setScalar(1 - 0.6 * frz);
  const grow = ramp(g, 3.5, 3.85) * (1 - ramp(g, 4.0, 4.3));
  S.pY = 0.21 * (1 + 0.45 * grow) + S.lift * 1.6;
  playerMat.emissiveIntensity = 0.35 + 0.9 * grow;
  playerMat.color.setScalar(1 - 0.45 * frz); playerMat.emissive.setScalar(1 - 0.5 * frz);
  players.forEach((p, i) => { const [x, z] = at(...F442[i]); p.position.set(x, S.pY, z); p.scale.setScalar(1 + 0.45 * grow); });
  gk.position.set(GX, 0.17 + S.lift * 1.6, GZ);

  // 案件ごとのボード（04）
  const a4 = band(g, 3.95, 4.98, 0.12), sp = ease(ramp(g, 4.0, 4.4));
  caseBoards.forEach((b, k) => {
    b.visible = a4 > 0.01;
    b.position.set(lerp(whiteboard.position.x, whiteboard.position.x - 2.1 + 1.4 * k, sp), lerp(1.9, 4.2, sp), whiteboard.position.z + 0.3);
    b.scale.setScalar(Math.max(0.001, lerp(0.4, 1, sp)));
  });
  caseMat.opacity = a4; caseLine.opacity = 0.9 * a4;

  // 2つの試合（05〜06）：1つのピッチが左右に分かれ、共通のボード1枚から両方へ線が伸びる
  const twinOn = g >= 4.99 && g < 7.06;
  S.split = ease(ramp(g, 4.99, 5.09)) * (1 - ease(ramp(g, 6.96, 7.06)));
  S.bsplit = ease(ramp(g, 6.54, 6.64));
  pitch.visible = gk.visible = !twinOn;
  players.forEach(p => { p.visible = !twinOn; });
  const stall = ramp(g, 5.31, 5.35) * (1 - ramp(g, 5.53, 5.57));   // ゲーム制作：確認待ちで止まる
  twinMat[0].color.setScalar(1 - 0.4 * stall); twinMat[0].emissiveIntensity = 0.35 - 0.2 * stall;
  linkMat.opacity = ramp(g, 5.02, 5.1) * (0.45 + 0.5 * band(g, 5.76, 5.99, 0.04));
  const pile = PILE.filter(([, t]) => g >= t).map(([n]) => n);
  sharedBoard.face.visible = twinOn && g < 6.54;
  if (sharedBoard.face.visible) {
    sharedBoard.mat.opacity = ramp(g, 5.0, 5.08); sharedBoard.edge.opacity = 0.9 * sharedBoard.mat.opacity;
    sharedBoard.face.position.set(0, TB.y, TB.z);
    drawBoard(sharedBoard, sharedForm(g), pile);
  }
  for (let s = 0; s < 2; s++) {
    const ox = sideX(s), F = twinForm(s, g);
    twinPitch[s].visible = twinOn; twinPitch[s].position.x = ox;
    twinTeam[s].forEach((p, i) => { const [x, z] = at(...F[i]); p.position.set(ox + x, 0.21, z); p.visible = twinOn; });
    twinGK[s].position.set(ox + GX, 0.17, GZ); twinGK[s].visible = twinOn;
    const b = ownBoard[s];
    b.face.visible = twinOn && g >= 6.54;
    if (b.face.visible) { b.face.position.set(boardX(s), TB.y, TB.z + 0.02 * (s + 1)); drawBoard(b, F, g < 6.58 ? pile : [OWN_NOTE[s]]); }
    const l = links[s]; l.visible = twinOn;
    if (twinOn) {
      const pos = l.geometry.attributes.position;
      pos.setXYZ(0, boardX(s), TB.y - 0.88 * TB.s, TB.z + 0.48 * TB.s); pos.setXYZ(1, ox, 0.03, -PL / 2 + 1.2); pos.needsUpdate = true;
      l.computeLineDistances();
    }
    playEvent(s, g, twinOn);
  }

  // 審判
  const ar = band(g, 7.02, 8.06, 0.06);
  const [rx, rz] = at(.5, .47); referee.position.set(rx, 0.26, rz); referee.visible = ar > 0.01; referee.scale.setScalar(Math.max(0.001, ar));

  // カメラ
  const c = camAt(g), dist = mobile ? c.dm : c.d;
  camera.position.set(c.tx + Math.sin(c.az) * Math.cos(c.el) * dist, Math.sin(c.el) * dist, c.tz + Math.cos(c.az) * Math.cos(c.el) * dist);
  camera.lookAt(c.tx, mobile ? 0.6 : 0.2, c.tz);
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
