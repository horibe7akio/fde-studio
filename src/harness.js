import './series.css';
import './harness.css';
import * as THREE from 'three';

// 3Dでわかる ハーネス：スクロールの位置 g（章番号＋章の中の進み 0〜1）で、3Dの場面を組み替える。
// スタジアム＝公式のハーネス（変えられない）、クラブハウス＝作戦ボードを書く場所（自分で書く）、選手＝モデル。
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

// ---------- 場 ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(COL.bg, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COL.bg, 30, 62);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(4, 12, 6); scene.add(sun);

const PW = 6.8, PL = 10.5, M = 0.9;
const FW = PW + M * 2, FL = PL + M * 2;
const at = (u, v) => [(u - 0.5) * PW, (v - 0.5) * PL];
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });
const withEdges = (mesh, mat) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), mat); mesh.add(e); return mesh; };

// 地面
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: 0x070d17 }));
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
const pitchMat = new THREE.MeshBasicMaterial({ map: pitchTexture() });
const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PW, PL), pitchMat);
pitch.rotation.x = -Math.PI / 2; scene.add(pitch);

// ---------- スタジアム（公式のハーネス） ----------
const stadium = new THREE.Group(); scene.add(stadium);
const D = 2.2, HS = 1.6, TIERS = 4;
const standMat = new THREE.MeshStandardMaterial({ color: 0x1c130c, emissive: COL.orange, emissiveIntensity: 0.06, transparent: true, opacity: 0.9 });
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
const roofMat = new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
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
const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a1c12, emissive: COL.orange, emissiveIntensity: 0.15 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff1cf });
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

// ---------- クラブハウス（作戦ボードを書く場所） ----------
const CX = -(FW / 2 + D + 4.2), CZ = -1.2;
const club = new THREE.Group(); club.position.set(CX, 0, CZ); scene.add(club);
const clubLine = lineMat(COL.cyan, 0.7);
const clubBody = withEdges(new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 4.4), new THREE.MeshStandardMaterial({ color: 0x0c1c28, emissive: COL.cyan, emissiveIntensity: 0.05, transparent: true, opacity: 0.85 })), clubLine);
clubBody.position.y = 0.9; club.add(clubBody);
{
  const s = new THREE.Shape(); s.moveTo(-2.0, 0); s.lineTo(2.0, 0); s.lineTo(0, 1.0); s.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(s, { depth: 4.8, bevelEnabled: false }); roofGeo.translate(0, 0, -2.4);
  const roof = withEdges(new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x0e2231, emissive: COL.cyan, emissiveIntensity: 0.08 })), clubLine);
  roof.position.y = 1.8; club.add(roof);
}
// 窓の明かりと扉
const winMat = new THREE.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.55 });
[-0.9, 0.9].forEach(x => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), winMat); w.position.set(x, 1.05, 2.21); club.add(w); });
{ const door = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.0), new THREE.MeshBasicMaterial({ color: 0x2d5f78 })); door.position.set(0, 0.5, 2.21); club.add(door); }

// 作戦ボード（ホワイトボード）：いまのフォーメーションと、足したルールが書かれる
const wbCanvas = document.createElement('canvas'); wbCanvas.width = 600; wbCanvas.height = 400;
const wbCtx = wbCanvas.getContext('2d');
const wbTex = new THREE.CanvasTexture(wbCanvas); wbTex.colorSpace = THREE.SRGBColorSpace; wbTex.anisotropy = 4;
const whiteboard = new THREE.Group(); whiteboard.position.set(CX + 0.4, 0, CZ + 3.9); scene.add(whiteboard);
{
  const face = withEdges(new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.0), new THREE.MeshBasicMaterial({ map: wbTex, side: THREE.DoubleSide })), lineMat(COL.cyan, 0.9));
  face.position.y = 1.9; face.rotation.x = -0.12; whiteboard.add(face);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a });
  [-1.2, 1.2].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 0.06), legMat); l.position.set(x, 1.45, 0.05); whiteboard.add(l); });
}
let wbKey = '';
function drawWhiteboard(F, rules, frz) {
  const key = F.map(p => p[0].toFixed(3) + p[1].toFixed(3)).join() + rules + (frz > 0.5);
  if (key === wbKey) return; wbKey = key;
  const x = wbCtx, w = 600, h = 400;
  x.fillStyle = frz > 0.5 ? '#9aa3ad' : '#eef3f7'; x.fillRect(0, 0, w, h);
  // 横向きのピッチ（左が自陣）
  const px = 40, py = 40, pw = 380, ph = 320;
  x.strokeStyle = '#2a6f8f'; x.lineWidth = 3; x.strokeRect(px, py, pw, ph);
  x.beginPath(); x.moveTo(px + pw / 2, py); x.lineTo(px + pw / 2, py + ph); x.stroke();
  x.beginPath(); x.arc(px + pw / 2, py + ph / 2, 42, 0, Math.PI * 2); x.stroke();
  x.strokeRect(px, py + ph / 2 - 70, 56, 140); x.strokeRect(px + pw - 56, py + ph / 2 - 70, 56, 140);
  x.fillStyle = '#1b3b52';
  F.forEach(([u, v]) => { x.beginPath(); x.arc(px + (1 - v) * pw, py + u * ph, 10, 0, Math.PI * 2); x.fill(); });
  x.beginPath(); x.arc(px + 0.045 * pw, py + ph / 2, 10, 0, Math.PI * 2); x.stroke();
  // 足したルールの付箋
  const notes = ['確認', '片づけ', '重い処理', '止まるな'];
  for (let i = 0; i < rules; i++) {
    const nx = 440 + (i % 2) * 70, ny = 50 + Math.floor(i / 2) * 78 + (i % 2) * 14;
    x.save(); x.translate(nx + 30, ny + 28); x.rotate((i % 2 ? 1 : -1) * 0.06);
    x.fillStyle = '#9fe6ff'; x.fillRect(-32, -28, 64, 56);
    x.fillStyle = '#06313f'; x.font = '700 15px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(notes[i], 0, 0); x.restore();
  }
  wbTex.needsUpdate = true;
}

// 案件ごとのボード（04）：作戦ボードから4枚に分かれる
const caseBoards = [];
const caseMat = new THREE.MeshBasicMaterial({ color: 0xdbe8f0, transparent: true, side: THREE.DoubleSide });
for (let k = 0; k < 4; k++) {
  const b = withEdges(new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.85), caseMat), lineMat(COL.cyan, 0.9));
  b.visible = false; scene.add(b); caseBoards.push(b);
}

// ---------- 選手 ----------
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
const S = { lift: 0, sy: 1, pY: 0.21 };
const rnd = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
const standTop = () => stadium.position.y + HS * S.sy;
const wbTop = () => [whiteboard.position.x, 3.2, whiteboard.position.z];
let F = F442;

tag('rule', g => (g >= 7.9 ? 'スタジアム＝公式のハーネス：変えられない' : 'スタジアム＝公式のハーネス（Claude Code）'), () => [FW / 2 + D * 0.6, standTop() + 1.6, -FL / 2 - D * 0.6], g => clamp(band(g, 0.85, 4.1, 0.15) + band(g, 7.9, 9.9, 0.15)));
tag('rule', '変えられない', () => [0, standTop() + 1.4, -FL / 2 - D], g => band(g, 1.95, 3.05, 0.1));
['モデル', '考える深さ', '許可', '道具'].forEach((n, i) => tag('rule', n, () => [-2.55 + 1.7 * i, 0.9, FL / 2 + D + 0.9], g => band(g, 1.95, 3.05, 0.1)));
tag('rule', '更新 v2.1.283：/doctor prompt-audit', () => [0, standTop() + 1.6, scan.position.z], g => band(g, 3.15, 4.05, 0.08));
tag('model', '選手の成長（新しいモデル）', () => [0, S.pY + 1.1, -0.4], g => band(g, 3.55, 4.02, 0.08));
tag('model', '選手＝モデル', () => [PW / 2 - 0.6, S.pY + 0.7, -1.6], g => band(g, 0.95, 2.0, 0.12));
tag('board', 'クラブハウス＝自分で書く場所', () => [CX, 3.4, CZ - 1.2], g => clamp(band(g, 0.85, 2.0, 0.12) + band(g, 7.9, 9.9, 0.15)));
tag('board', '作戦ボード（CLAUDE.md・スキル・フック）', wbTop, g => band(g, 0.9, 2.0, 0.12));
tag('board', '共通のボード（全体用）', wbTop, g => band(g, 3.95, 5.1, 0.12));
tag('board', '案件ごとのボード', () => [whiteboard.position.x, 5.1, whiteboard.position.z + 0.6], g => band(g, 4.15, 5.1, 0.1));
['ゲーム制作', 'アプリ開発', '資料づくり', '広報'].forEach((n, k) => tag('board', n, () => { const p = caseBoards[k].position; return [p.x, p.y - 0.62, p.z]; }, g => band(g, 4.2, 5.1, 0.1)));
tag('board', 'ルールが増えていく', wbTop, g => band(g, 5.2, 5.74, 0.05));
tag('board', '作戦ボード：毎日組み直す', wbTop, g => band(g, 8.05, 9.9, 0.12));
[[5.2, 5.34, 7, '＋確認のルール'], [5.34, 5.47, 4, '＋片づけのルール'], [5.47, 5.58, 5, '＋重い処理のルール'], [5.58, 5.72, 1, '＋止まるなのルール']].forEach(([a, b, idx, t]) =>
  tag('add', t, () => { const [x, z] = at(...F[idx]); return [x, 0.8, z]; }, g => band(g, a, b, 0.03)));
tag('board', '気づけば、最大公倍数', () => [0, 0.5, 0.2], g => band(g, 5.55, 5.74, 0.04));
tag('big', '8-1-1', () => [0, 1.2, -PL / 2 + 0.9], g => band(g, 5.66, 6.02, 0.04));
tag('big goal', '失点', () => [0, 0.9, PL * 0.22], g => band(g, 5.9, 6.03, 0.02));
[['ゲーム制作', '4-3-3'], ['アプリ開発', '5-4-1'], ['資料づくり', '4-4-2'], ['広報', '3-5-2']].forEach(([n, f], k) => {
  const al = g => band(g, 6 + k * 0.25 + 0.02, 6 + (k + 1) * 0.25, 0.04);
  tag('vs', 'VS ' + n, () => [0, 0.4, -PL / 2 - 0.3], al);
  tag('fm', 'この試合の最適　' + f, () => [0, 0.1, PL / 2 + 0.4], al);
});
tag('ref', '審判＝フック', () => { const [x, z] = at(.5, .47); return [x, 1.05, z]; }, g => band(g, 7.02, 8.06, 0.06));
tag('whistle', 'ピッ', () => { const [x, z] = at(.66, .40); return [x, 0.9, z]; }, g => band(g, 7.18, 7.34, 0.03));
for (let i = 0; i < 14; i++) {
  const st = 7.46 + i * 0.025;
  tag('whistle', 'ピッ', () => { const [x, z] = at(0.12 + 0.76 * rnd(i, 1), 0.1 + 0.8 * rnd(i, 2)); return [x, 0.7, z]; }, g => band(g, st, st + 0.14, 0.02) * (1 - ramp(g, 7.86, 7.95)));
}
tag('stop', '試合が止まる', () => [0, 0.8, 0.6], g => ramp(g, 7.6, 7.7) * (1 - ramp(g, 7.98, 8.12)));
tag('ref', '笛の加減は、人が決める', () => [0, 0.1, PL / 2 + 0.4], g => band(g, 7.8, 8.05, 0.04));

// ---------- カメラ（章ごとに見る場所を変える） ----------
// tx/tz＝見る先。スタジアムとクラブハウスの全体は tx=-3.5、ピッチは 0、04章はクラブハウス。
const CAM = [
  { az: 0.42, el: 0.62, d: 29, tx: -3.5, tz: 0 },   // 00 はじめ
  { az: -0.35, el: 0.5, d: 30, tx: -3.5, tz: 0 },   // 01 3つの層
  { az: 0.5, el: 0.55, d: 24, tx: 0, tz: 1 },       // 02 ことわり
  { az: 0.22, el: 0.72, d: 25, tx: 0, tz: 0 },      // 03 変わる
  { az: -0.3, el: 0.3, d: 18, tx: CX + 0.6, tz: CZ + 2.5 }, // 04 ボード
  { az: 0.0, el: 1.0, d: 25, tx: 0, tz: 0.3 },      // 05 8-1-1
  { az: 0.3, el: 0.92, d: 25, tx: 0, tz: 0.3 },     // 06 VS
  { az: -0.22, el: 0.96, d: 25, tx: 0, tz: 0.3 },   // 07 審判
  { az: 0.42, el: 0.6, d: 29, tx: -3.5, tz: 0 },    // 08 まとめ
  { az: 0.42, el: 0.6, d: 29, tx: -3.5, tz: 0 },
];
function camAt(g) {
  const x = clamp(g - 0.5, 0, CAM.length - 1.001), i = Math.floor(x), k = ease(x - i);
  const a = CAM[i], b = CAM[i + 1], o = {};
  for (const key in a) o[key] = lerp(a[key], b[key], k);
  return o;
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

function update() {
  queued = false;
  const g = progress();

  // 3つの層を上下に離して見せる（01）：スタジアムは沈み、選手は浮き、クラブハウスはそのまま
  S.lift = ease(band(g, 0.85, 2.05, 0.3));
  const rule = clamp(band(g, 0.85, 4.1, 0.15) + band(g, 7.9, 9.9, 0.15));
  S.sy = 1 + 0.25 * ease(band(g, 1.9, 3.1, 0.2));
  stadium.position.y = -1.6 * S.lift;
  stadium.scale.y = S.sy;
  standLine.opacity = 0.35 + 0.55 * rule;
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

  // 選手とフォーメーション
  F = form(g);
  const frz = ramp(g, 7.6, 7.7) * (1 - ramp(g, 7.98, 8.12));
  pitchMat.color.setScalar(1 - 0.6 * frz);
  const grow = ramp(g, 3.5, 3.85) * (1 - ramp(g, 4.0, 4.3));
  S.pY = 0.21 * (1 + 0.45 * grow) + S.lift * 1.6;
  playerMat.emissiveIntensity = 0.35 + 0.9 * grow;
  playerMat.color.setScalar(1 - 0.45 * frz); playerMat.emissive.setScalar(1 - 0.5 * frz);
  players.forEach((p, i) => { const [x, z] = at(...F[i]); p.position.set(x, S.pY, z); p.scale.setScalar(1 + 0.45 * grow); });
  const [gx, gz] = at(.5, .955); gk.position.set(gx, 0.17 + S.lift * 1.6, gz);

  // 作戦ボード：いまの陣形と、足したルールの付箋
  const rules = g >= 5.2 && g < 5.74 ? [5.2, 5.34, 5.47, 5.58].filter(t => g >= t).length : 0;
  drawWhiteboard(F, rules, frz);

  // 案件ごとのボード
  const a4 = band(g, 3.95, 5.1, 0.12), sp = ease(ramp(g, 4.0, 4.4));
  caseBoards.forEach((b, k) => {
    b.visible = a4 > 0.01;
    b.position.set(lerp(whiteboard.position.x, whiteboard.position.x - 2.1 + 1.4 * k, sp), lerp(1.9, 4.2, sp), whiteboard.position.z + 0.3);
    b.scale.setScalar(Math.max(0.001, lerp(0.4, 1, sp)));
  });
  caseMat.opacity = a4;

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
  const c = camAt(g), dist = c.d * (mobile ? 1.3 : 1);
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
