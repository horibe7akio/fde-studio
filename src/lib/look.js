// Shared look for every page in this explainer: the same post chain, the same people.
// Lifted out of scene-layers.js so the deep-dive pages do not start from nothing.
import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CYAN = 0x61fce4, AMBER = 0xffae69, LIME = 0xc6ff51, PINK = 0xff637f;

/**
 * Bloom, anti-aliasing, then grain + vignette + chromatic aberration in ONE pass.
 * They are merged on purpose: separate passes are what makes these pages stutter
 * on older laptops.
 */
export function createGrade(renderer, scene, camera, opts = {}) {
  const { bloom = [0.62, 0.5, 0.6], grain = 0.055, chroma = 0.002, vignette = 0.34 } = opts;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new T.Vector2(1, 1), ...bloom);
  composer.addPass(bloomPass);
  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uRes: { value: new T.Vector2(1, 1) }, uTime: { value: 0 },
      uGrain: { value: grain }, uChroma: { value: chroma }, uVignette: { value: vignette }, uLift: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uRes;
      uniform float uTime,uGrain,uChroma,uVignette,uLift;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec2 c=vUv-.5; float r2=dot(c,c);
        vec2 off=c*r2*uChroma*22.;
        vec4 color=vec4(texture2D(tDiffuse,vUv+off).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-off).b,1.);
        color.rgb*=1.-uVignette*smoothstep(.08,.62,r2);
        color.rgb+=(hash(vUv*uRes+fract(uTime)*vec2(37.,17.))-.5)*uGrain;
        color.rgb*=1.+uLift;
        gl_FragColor=color;
      }`,
  });
  composer.addPass(grade);

  return {
    composer,
    bloom: bloomPass,
    grade,
    setSize(w, h) {
      composer.setSize(w, h);
      bloomPass.setSize(w, h);
      grade.uniforms.uRes.value.set(w, h);
    },
    render(time, lift = 0) {
      grade.uniforms.uTime.value = time;
      grade.uniforms.uLift.value = lift;
      composer.render();
    },
  };
}

const DARK = new T.MeshStandardMaterial({ color: 0x205749, metalness: 0.3, roughness: 0.35 });

/**
 * The same figure the concept page uses: cylinder body, round head, badge, halo.
 * Orange is the FDE, cyan is the person whose work it is.
 */
export function createPerson(color = CYAN, scale = 1) {
  const g = new T.Group();
  g.scale.setScalar(scale);
  const suit = new T.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.08, emissive: color, emissiveIntensity: 0.09 });
  const add = (geo, mat, x, y, z) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z); g.add(m); return m;
  };
  add(new T.CylinderGeometry(0.24, 0.29, 0.69, 20), suit, 0, 0.62, 0);
  add(new T.SphereGeometry(0.23, 20, 14), new T.MeshStandardMaterial({ color: 0xffeed9, roughness: 0.55 }), 0, 1.18, 0);
  add(new T.BoxGeometry(0.17, 0.38, 0.22), DARK, -0.14, 0.17, 0);
  add(new T.BoxGeometry(0.17, 0.38, 0.22), DARK, 0.14, 0.17, 0);
  const left = add(new T.BoxGeometry(0.14, 0.6, 0.17), suit, -0.34, 0.68, 0); left.rotation.z = -0.25;
  const right = add(new T.BoxGeometry(0.14, 0.6, 0.17), suit, 0.34, 0.68, 0); right.rotation.z = 0.25;
  add(new T.BoxGeometry(0.14, 0.09, 0.028),
    new T.MeshBasicMaterial({ color, toneMapped: false }), 0.08, 0.74, 0.265);       // 名札
  const halo = new T.Mesh(
    new T.RingGeometry(0.51, 0.53, 32),
    new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, toneMapped: false, side: T.DoubleSide }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.015; g.add(halo);
  return { group: g, left, right, halo, suit };
}

/**
 * The FDE explainer's figure: rounded blocks, so the silhouette and the direction of an arm
 * read at any camera distance. Arms hang from the shoulder, so rotating one reads as raising it.
 * `trim` is the page's shared dark material, so the legs follow its look switch.
 * (createPerson above is the earlier cylinder figure, still used by field.js.)
 */
export function createFigure(color = CYAN, { trim = DARK } = {}) {
  const g = new T.Group();
  // Barely emissive: a glowing figure blooms into a blob and the shape stops reading.
  const suit = new T.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.08, emissive: color, emissiveIntensity: 0.03 });
  const rounded = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 4, r);
  const add = (parent, geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  add(g, rounded(0.5, 0.5, 0.3, 0.07), suit, 0, 0.78, 0);
  add(g, rounded(0.48, 0.12, 0.28, 0.03), trim, 0, 0.48, 0);
  for (const x of [-0.12, 0.12]) add(g, rounded(0.19, 0.4, 0.24, 0.05), trim, x, 0.22, 0);
  add(g, rounded(0.34, 0.34, 0.32, 0.11), new T.MeshStandardMaterial({ color: 0xf0d8c2, roughness: 0.55 }), 0, 1.25, 0);
  const [left, right] = [-1, 1].map(side => {
    const pivot = new T.Group(); pivot.position.set(side * 0.32, 0.98, 0); pivot.rotation.z = side * 0.25; g.add(pivot);
    add(pivot, rounded(0.13, 0.46, 0.16, 0.05), suit, 0, -0.21, 0);
    return pivot;
  });
  add(g, new T.BoxGeometry(0.13, 0.08, 0.02), new T.MeshBasicMaterial({ color, toneMapped: false }), 0.1, 0.88, 0.16);   // 名札
  const halo = add(g, new T.TorusGeometry(0.53, 0.019, 8, 100),
    new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, toneMapped: false }), 0, 0.015, 0);
  halo.rotation.x = Math.PI / 2;
  return { group: g, left, right, halo, suit };
}

/**
 * A glass tower on a podium, stepping back near the top, with a lit curtain wall.
 * Stands on y=0, so an opening animation can grow it with scale.y. All mullions are one mesh.
 * Returns the body material so a look switch can recolour it.
 */
export function createTower(height, accent = CYAN, { trim = DARK } = {}) {
  const g = new T.Group();
  const body = new T.MeshStandardMaterial({ color: 0x173936, metalness: 0.55, roughness: 0.2 });
  const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const podium = 0.34, lower = (height - podium) * 0.64, upper = height - podium - lower;
  add(new T.BoxGeometry(2.0, podium, 1.62), trim, 0, podium / 2, 0);
  add(new T.BoxGeometry(1.6, lower, 1.26), body, 0, podium + lower / 2, 0);
  add(new T.BoxGeometry(1.16, upper, 0.92), body, 0, podium + lower + upper / 2, 0);
  const strips = [], lowerMid = podium + lower / 2, upperMid = podium + lower + upper / 2;
  const strip = (w, h, d, x, y, z) => strips.push(new T.BoxGeometry(w, h, d).translate(x, y, z));
  for (let x = -0.7; x <= 0.71; x += 0.2) { strip(0.018, lower * 0.94, 0.012, x, lowerMid, 0.636); strip(0.018, lower * 0.94, 0.012, x, lowerMid, -0.636); }
  for (let z = -0.5; z <= 0.51; z += 0.2) { strip(0.012, lower * 0.94, 0.018, 0.806, lowerMid, z); strip(0.012, lower * 0.94, 0.018, -0.806, lowerMid, z); }
  for (let x = -0.45; x <= 0.46; x += 0.18) strip(0.016, upper * 0.9, 0.012, x, upperMid, 0.466);
  add(mergeGeometries(strips), new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.38, toneMapped: false }), 0, 0, 0);
  add(new T.BoxGeometry(1.24, 0.05, 1.0), new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.7, toneMapped: false }), 0, height + 0.025, 0);
  add(new T.BoxGeometry(0.4, 0.16, 0.3), trim, 0.2, height + 0.13, -0.1);
  return { group: g, body };
}
