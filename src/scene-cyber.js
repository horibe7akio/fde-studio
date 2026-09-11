import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CYAN = 0x61fce4, LIME = 0xc6ff51, PINK = 0xff637f;

export function createCosmos(canvas, state) {
  const tags = [...document.querySelectorAll('.stage-tags span')];
  function fallback() {
    canvas.hidden = true;
    document.querySelector('#fallback').hidden = false;
    tags.forEach(tag => tag.style.opacity = 0);
  }
  let renderer;
  try { renderer = new T.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'}); }
  catch { fallback(); return; }
  renderer.setClearColor(new T.Color(0x03080b).multiplyScalar(.2));
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  canvas.addEventListener('webglcontextlost', e => {e.preventDefault(); fallback();});

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(new T.Color(0x03080b).multiplyScalar(.2), .045);
  const camera = new T.PerspectiveCamera(39, 1, .1, 100);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new T.Vector2(1,1), .62, .45, .6));
  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());
  scene.add(new T.HemisphereLight(0xb6ffed, 0x07201a, 2));
  const key = new T.DirectionalLight(0xe6fff7, 2.2); key.position.set(1,6,5); scene.add(key);
  const fill = new T.PointLight(CYAN, 25, 25); fill.position.set(-4,2,4); scene.add(fill);
  const rim = new T.PointLight(LIME, 50, 20); rim.position.set(4,3,-2); scene.add(rim);

  const root = new T.Group(); scene.add(root);
  const groups = Array.from({length:7}, () => {const group = new T.Group(); root.add(group); return group;});
  const dark = new T.MeshStandardMaterial({color:0x205749, metalness:.3, roughness:.35});
  const black = new T.MeshStandardMaterial({color:0x061410, metalness:.45, roughness:.5});
  function neon(color, opacity=1) {return new T.MeshBasicMaterial({color, transparent:opacity<1, opacity, toneMapped:false});}
  function mesh(parent, geo, mat, x=0, y=0, z=0) {
    const object = new T.Mesh(geo, mat); object.position.set(x,y,z); parent.add(object); return object;
  }
  function box(parent, dimensions, position, material=dark) {return mesh(parent, new T.BoxGeometry(...dimensions), material, ...position);}
  function outline(parent, geo, color=CYAN, opacity=.7) {
    const wire = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({color, transparent:true, opacity, toneMapped:false}));
    wire.scale.setScalar(1.01); parent.add(wire); return wire;
  }
  function ring(parent, radius, color=CYAN, thickness=.014, opacity=.7) {
    const object = mesh(parent, new T.TorusGeometry(radius, thickness, 8, 100), neon(color,opacity));
    object.rotation.x = Math.PI/2; return object;
  }
  function platform(parent, x, z, size=1.7, color=CYAN) {
    const g = new T.Group(); g.position.set(x,-1.25,z); parent.add(g);
    box(g,[size,.17,size],[0,0,0],black);
    outline(g,new T.BoxGeometry(size,.18,size),color,.5);
    for(let i=0;i<4;i++) box(g,[.28,.018,.055],[(i%2?1:-1)*(size*.42),.1,(i<2?1:-1)*size*.42],neon(color));
    return g;
  }
  function server(parent, x, y, z, {color=CYAN, size=1, layers=5}={}) {
    const g = new T.Group(); g.position.set(x,y,z); g.scale.setScalar(size); parent.add(g);
    const geo = new T.BoxGeometry(.9,1.5,.9);
    mesh(g,geo,dark); outline(g,geo,color,.7);
    for(let j=0;j<layers;j++) {
      const h = -.57+j*(1.14/Math.max(1,layers-1));
      box(g,[.69,.055,.025],[0,h,.47],neon(color,.75));
      box(g,[.045,.045,.025],[-.35,h,.49],neon(LIME));
      box(g,[.027,.045,.68],[.47,h,0],neon(color,.45));
    }
    box(g,[.58,.02,.58],[0,.76,0],neon(color,.27));
    return g;
  }
  function processor(parent, x, y, z, size=1, color=CYAN) {
    const g = new T.Group(); g.position.set(x,y,z); g.scale.setScalar(size); parent.add(g);
    box(g,[1.4,.18,1.4],[0,-.33,0],dark);
    outline(g,new T.BoxGeometry(1.4,.18,1.4),color,.7).position.y=-.33;
    for(let i=0;i<7;i++) for(const side of [-1,1]) {
      box(g,[.04,.05,.2],[(i-3)*.16,-.34,side*.76],neon(color));
      box(g,[.2,.05,.04],[side*.76,-.34,(i-3)*.16],neon(color));
    }
    const core = mesh(g,new T.OctahedronGeometry(.54),new T.MeshStandardMaterial({color:0x39a78d,emissive:color,emissiveIntensity:.24,metalness:.4,roughness:.32}),0,.12,0);
    outline(core,new T.OctahedronGeometry(.54),color,1);
    const halo = ring(g,.92,color,.017,.8); halo.position.y=-.3;
    const cage = ring(g,.88,color,.009,.35); cage.rotation.x=.25;
    return {group:g,core,halo,cage};
  }
  function link(parent, points, color=CYAN, thickness=.018) {
    const curve = new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal');
    const tube = mesh(parent,new T.TubeGeometry(curve,70,thickness,6,false),neon(color,.7));
    const packets = Array.from({length:4}, () => mesh(parent,new T.BoxGeometry(.09,.09,.2),neon(color)));
    return {curve,tube,packets};
  }
  function flow(connection, t, amount=1, speed=.15, color=CYAN) {
    connection.tube.material.opacity = .06+amount*.65;
    connection.tube.material.color.setHex(color);
    connection.packets.forEach((p,i)=> {
      p.visible=amount>.03; p.material.color.setHex(color);
      const u=state.reduced?(i+.5)/4:(t*speed+i/4)%1;
      p.position.copy(connection.curve.getPoint(u));
      p.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),connection.curve.getTangent(u));
    });
  }

  // The world is an explanatory circuit board, not an unrelated space backdrop.
  const grid = new T.GridHelper(48,64,0x26705b,0x16463b);
  grid.material.transparent=true;grid.material.opacity=.23;grid.material.blending=T.AdditiveBlending;grid.material.depthWrite=false;
  grid.position.y=-1.47; scene.add(grid);
  const floorOrbit=ring(root,5.2,CYAN,.012,.19); floorOrbit.position.y=-1.43;
  const floorOrbit2=ring(root,5.55,CYAN,.006,.09); floorOrbit2.position.y=-1.43;
  let seed=814; const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  const dust=[];
  for(let i=0;i<650;i++) dust.push((random()-.5)*45,random()*17-1,-random()*35-3);
  const particles = new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(dust,3)),new T.PointsMaterial({color:0x51bca0,size:.022,transparent:true,opacity:.7})); scene.add(particles);

  // 00: the central processor physically completes two disconnected routes.
  const hero=groups[0];
  platform(hero,-2.6,0,2,PINK); platform(hero,2.6,0,2.1,CYAN); platform(hero,0,0,2.05,LIME);
  const business=[server(hero,-2.9,-.25,-.32,{color:PINK,size:.86}),server(hero,-2.2,-.61,.48,{color:PINK,size:.58})];
  const systems=[server(hero,2.35,-.1,-.22,{size:1.06}),server(hero,3.06,-.56,.5,{size:.64})];
  const heroCore=processor(hero,0,.15,0,1.15,LIME);
  const uplinks=[link(hero,[[-2.6,-.8,.75],[-1.5,-.8,.75],[-1,-.55,.1],[0,-.4,0]],LIME),link(hero,[[0,-.4,0],[.95,-.55,.1],[1.5,-.8,.75],[2.6,-.8,.75]],CYAN)];
  const broken=[link(hero,[[-2.6,-.65,.8],[-1.85,-.65,.8]],PINK),link(hero,[[1.85,-.65,.8],[2.6,-.65,.8]],PINK)];
  const launchWaves=[0,1].map(()=>{const r=ring(hero,1,LIME,.016,.7);r.position.y=-1.12;return r;});
  const heroArcs=[ring(heroCore.group,1.26,LIME,.012,.38),ring(heroCore.group,1.4,CYAN,.006,.23)];heroArcs[0].rotation.x=.45;heroArcs[1].rotation.x=1.1;

  // 01: identical workplaces deliberately avoid encoding SES as inferior.
  const question=groups[1];
  for(const x of [-2,2]) {platform(question,x,0,2);server(question,x,-.12,0,{size:1.3});ring(question,1.3,CYAN,.014,.55).position.set(x,-1,0);}
  const questionLink=link(question,[[-2,-.9,.95],[0,-.9,1.35],[2,-.9,.95]],LIME);
  const questionHub=processor(question,0,.35,-.45,.63,LIME);

  // 02: incoming order data meets a visible exception-check bottleneck.
  const discover=groups[2];
  platform(discover,-2.7,0,1.7);platform(discover,0,0,1.9,PINK);platform(discover,2.7,0,1.7);
  server(discover,-2.7,-.4,0,{size:.9});server(discover,2.7,-.4,0,{size:.9});
  const bottleneck=processor(discover,0,-.03,0,1,PINK);
  const incoming=link(discover,[[-2.7,-.45,.55],[-1.25,-.45,.55],[0,-.45,.1]],CYAN);
  const outgoing=link(discover,[[0,-.45,.1],[1.25,-.45,.55],[2.7,-.45,.55]],LIME);
  const backlog=Array.from({length:20},(_,i)=>box(discover,[.12,.21,.04],[-1.8+(i%5)*.23,-.2+Math.floor(i/5)*.29,.7],neon(i%3?CYAN:PINK,.65)));
  const scan=ring(discover,1.15,PINK,.021,.7);scan.position.y=.12;

  // 03: a single, unambiguous left-to-right delivery chain.
  const build=groups[3];
  const stages=[-2.7,0,2.7].map((x,i)=>{platform(build,x,0,1.85,i===2?LIME:CYAN);return server(build,x,-.16,0,{color:i===2?LIME:CYAN,size:1.12});});
  const buildLinks=[link(build,[[-2.5,-.55,.65],[-1.3,-.55,.9],[0,-.55,.65]]),link(build,[[0,-.55,.65],[1.3,-.55,.9],[2.5,-.55,.65]],LIME)];
  const stageRings=stages.map((g,i)=>{const r=ring(build,.92,i===2?LIME:CYAN,.026,.8);r.position.set(g.position.x,.9,0);return r;});

  // 04: highlighting is tied to the reader's expanded question.
  const difference=groups[4];
  const anchorPositions=[[-2.6,-.35,.45],[0,.35,-.55],[2.6,-.35,.45]];
  const anchors=anchorPositions.map((p,i)=>{platform(difference,p[0],p[2],1.8);return processor(difference,...p,1,i===1?LIME:CYAN);});
  const anchorLinks=[link(difference,[[-2.6,-.8,.45],[0,-.8,.95],[2.6,-.8,.45]],CYAN)];

  // 05: A's learning passes through a reusable core before reaching B and C.
  const reuse=groups[5];
  platform(reuse,0,0,2,LIME);const reusable=processor(reuse,0,.1,0,1.15,LIME);
  const sitePositions=[[-2.85,-.35,.25],[2.65,-.35,-.75],[2.4,-.6,1.7]];
  const sites=sitePositions.map((p,i)=>{platform(reuse,p[0],p[2],1.45,i?CYAN:LIME);return server(reuse,...p,{color:i?CYAN:LIME,size:.78});});
  const reuseLinks=[link(reuse,[[-2.85,-.7,.4],[-1.5,-.6,.55],[0,-.35,0]],LIME),...sitePositions.slice(1).map(p=>link(reuse,[[0,-.35,0],[p[0]*.5,-.45,p[2]*.6],p.map((v,i)=>i===1?v-.2:v)],CYAN))];

  // 06: five human-owned stages, with AI helper blocks added above two of them.
  const future=groups[6];const humanNodes=[];const helpers=[];const helperLinks=[];
  for(let i=0;i<5;i++) {
    const x=(i-2)*1.48;
    const y=Math.sin(i/4*Math.PI)*.45-.25;
    const node=new T.Group();node.position.set(x,y,0);future.add(node);humanNodes.push(node);
    mesh(node,new T.SphereGeometry(.16,18,12),neon(LIME),0,.2,0);
    mesh(node,new T.CylinderGeometry(.18,.27,.45,16),dark,0,-.2,0);
    ring(node,.38,LIME,.019,.85).position.y=-.48;
    if(i===1||i===2){const helper=processor(future,x,y+1.9,0,.43,CYAN);helpers.push(helper);helperLinks.push(link(future,[[x,y+.3,0],[x+.28,y+1,0],[x,y+1.65,0]],CYAN,.012));}
  }
  const humanLink=link(future,humanNodes.map(g=>[g.position.x,g.position.y-.48,0]),LIME);

  let width=innerWidth,height=innerHeight,mobile=width<=760;
  function resize(){width=innerWidth;height=innerHeight;mobile=width<=760;renderer.setSize(width,height);composer.setSize(width,height);camera.aspect=width/height;camera.setViewOffset(width,height,mobile?0:-width*.25,mobile?height*.265:height*.02,width,height);camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();
  const labelSets=[
    ()=>[['現場の業務',[-2.7,1.25,0],'pink'],[state.deployed?'FDE / 接続中':'FDE / 待機中',[0,1.95,0],'lime'],['AI・システム',[2.65,1.55,0],'cyan']],
    ()=>[['客先で働く',[-2,1.65,0],'cyan'],['成果まで担う',[2,1.65,0],'cyan'],['場所だけでは、分からない',[0,-1.55,1.2],'lime']],
    ()=>[['注文データ',[-2.7,1.05,0],'cyan'],[state.field?'例外確認が詰まっていた':'どこが詰まっている？',[0,1.4,0],state.field?'lime':'pink'],['処理・承認',[2.7,1.05,0],'cyan']],
    ()=>[['01 試作',[-2.7,1.2,0],'cyan'],['02 評価',[0,1.2,0],'cyan'],['03 本番',[2.7,1.2,0],'lime']],
    ()=>[['裁量',[-2.6,1.3,.45],'cyan'],['責任',[0,2,-.55],'lime'],['再利用',[2.6,1.3,.45],'cyan']],
    ()=>[['現場 A',[-2.85,.9,.25],'lime'],['共通部品',[0,1.75,0],'lime'],['現場 B',[2.65,.9,-.75],'cyan'],['現場 C',[2.4,.5,1.7],'cyan']],
    ()=>humanNodes.map((g,i)=>[['現場理解','構造化','実装','検収','定着'][i],[g.position.x,g.position.y-.95,0],'lime'])
  ];
  const projected=new T.Vector3();
  let last=0,t=0,lastDraw=0,active=-1,reveal=0,deploy=0,focus=0,shared=0,ai=0,inView=true;
  new IntersectionObserver(entries=>inView=entries[0].isIntersecting,{rootMargin:'30px'}).observe(document.querySelector('#experience'));
  function frame(now) {
    requestAnimationFrame(frame);
    const dt=Math.min((now-last)/1000||.016,.05);last=now;
    if(!inView||document.hidden)return;
    if(state.reduced&&now-lastDraw<100)return;lastDraw=now;
    if(!state.reduced)t+=dt;
    if(active!==state.chapter){active=state.chapter;reveal=0;}
    reveal=state.reduced?1:Math.min(1,reveal+dt*2.7);
    groups.forEach((g,i)=>{g.visible=i===state.chapter;g.position.y=(1-reveal)*-.25;});
    const aspect=width*(mobile?.9:.43)/height;
    const distance=Math.max(13,4.05/(Math.tan(T.MathUtils.degToRad(19.5))*aspect));
    const desired=new T.Vector3(state.chapter===6?.8:2.3,mobile?4.7:4.4,12).setLength(distance);
    if(!state.reduced){desired.x+=(state.progress-.5)*.85;desired.y+=Math.sin(t*.1)*.12;}
    camera.position.lerp(desired,state.reduced?1:1-Math.exp(-dt*4));camera.lookAt(0,0,0);camera.updateMatrixWorld();
    deploy=T.MathUtils.damp(deploy,state.deployed?1:0,3,state.reduced?1:dt);
    focus=T.MathUtils.damp(focus,state.field?1:0,3,state.reduced?1:dt);
    shared=T.MathUtils.damp(shared,state.shared?1:0,3,state.reduced?1:dt);
    ai=T.MathUtils.damp(ai,state.ai?1:0,4,state.reduced?1:dt);
    heroCore.group.position.y=.15+(1-deploy)*.65;
    heroCore.core.material.emissiveIntensity=.2+deploy*.48;
    heroCore.core.rotation.y=state.reduced?.3:t*.35;
    heroArcs.forEach((r,i)=>{r.rotation.z=state.reduced?0:t*(i?-.14:.21);r.material.opacity=.18+deploy*.45;});
    uplinks.forEach((c,i)=>flow(c,t,deploy,.16,i?CYAN:LIME));
    broken.forEach(c=>{flow(c,t,1-deploy,.3,PINK);c.tube.visible=deploy<.99;});
    launchWaves.forEach((r,i)=>{const wave=state.reduced?.6:(t*.22+i*.5)%1;r.scale.setScalar(1+wave*2.9);r.material.opacity=deploy*(1-wave)*.5;});
    flow(questionLink,t,.45,.12,LIME);questionHub.core.rotation.y=state.reduced?0:t*.2;
    // Finding the bottleneck is not solving it: outbound delivery stays inactive.
    flow(incoming,t,.6,.2);flow(outgoing,t,0,.12,LIME);
    bottleneck.core.material.emissive.setHex(state.field?LIME:PINK);bottleneck.halo.material.color.setHex(state.field?LIME:PINK);
    scan.material.color.setHex(state.field?LIME:PINK);scan.position.y=state.reduced?.1:Math.sin(t*.8)*.3+.1;
    backlog.forEach((b,i)=>{b.position.y=-.2+Math.floor(i/5)*.29-focus*.25;b.scale.setScalar(1-focus*.64);});
    buildLinks.forEach((c,i)=>flow(c,t,1,.17,i?LIME:CYAN));
    stageRings.forEach((r,i)=>{r.position.y=.85+(state.reduced?0:Math.sin(t*1.6-i)*.06);r.material.opacity=.25+(Math.floor(t*.45)%3===i?.65:0);});
    anchors.forEach((a,i)=>{a.group.scale.setScalar(state.inspection===i?1.22:1);a.core.rotation.y=state.reduced?0:t*.17;});
    anchorLinks.forEach(c=>flow(c,t,.3,.1));
    reuseLinks.forEach((c,i)=>flow(c,t,i?shared:1,.18,i?CYAN:LIME));sites.forEach((g,i)=>g.scale.setScalar(.78*(i?.8+shared*.2:1)));reusable.core.rotation.y=state.reduced?0:t*.3;
    flow(humanLink,t,.7,.12,LIME);helpers.forEach(h=>{h.group.visible=ai>.02;h.group.scale.setScalar(.43*ai);});helperLinks.forEach(c=>flow(c,t,ai,.25,CYAN));
    root.updateMatrixWorld(true);
    const labels=labelSets[state.chapter]();
    labels.forEach((label,i)=>{
      const [text,point,accent]=label;projected.set(...point);groups[state.chapter].localToWorld(projected);projected.project(camera);
      const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
      tags[i].textContent=text;tags[i].dataset.accent=accent;
      tags[i].style.left=`${Math.max(65,Math.min(width-65,x))}px`;tags[i].style.top=`${y}px`;
      tags[i].style.opacity=y>80&&y<height*(mobile?.43:.77)?String(reveal):'0';
    });
    for(let i=labels.length;i<tags.length;i++)tags[i].style.opacity=0;
    composer.render();
    document.documentElement.dataset.rendered='true';document.documentElement.dataset.scene=String(state.chapter);
    canvas.dataset.connected=deploy>.95?'true':'false';
  }
  // Start at a fitted pose to avoid a fly-in from the camera's default origin.
  camera.position.set(2.3,4.4,20);
  requestAnimationFrame(frame);
}
