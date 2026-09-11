import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createCosmos(canvas,state){
  let renderer;
  const fallback=()=>{canvas.hidden=true;document.querySelector('#fallback').hidden=false;document.querySelectorAll('.stage-tags span').forEach(e=>e.style.opacity=0);};
  try{renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});}catch{fallback();return;}
  renderer.setClearColor(0x060a13);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback();});
  const scene=new T.Scene();scene.fog=new T.FogExp2(0x060a13,.011);
  const camera=new T.PerspectiveCamera(40,1,.1,180);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new T.Vector2(1,1),.65,.6,.72);composer.addPass(bloom);composer.addPass(new SMAAPass());composer.addPass(new OutputPass());
  scene.add(new T.HemisphereLight(0x9ecaff,0x061121,1.1));
  const whiteLight=new T.DirectionalLight(0xe1f2ff,4);whiteLight.position.set(2,5,7);scene.add(whiteLight);
  const blueLight=new T.PointLight(0x2588ff,50,20,2);blueLight.position.set(-5,1,3);scene.add(blueLight);
  const orangeLight=new T.PointLight(0xff814f,30,20,2);orangeLight.position.set(4,-3,-2);scene.add(orangeLight);
  const root=new T.Group();scene.add(root);
  const groups=Array.from({length:7},()=>{const g=new T.Group();root.add(g);return g;});
  const cyan=new T.Color(0x79d8ff),warm=new T.Color(0xffa06b);
  const metal=new T.MeshStandardMaterial({color:0x284b6d,metalness:.78,roughness:.3});
  const silver=new T.MeshStandardMaterial({color:0x9caebc,metalness:.62,roughness:.25});
  function lightMaterial(color,intensity=1.3){return new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),toneMapped:false});}
  const glow=lightMaterial(0x7bdcff),amber=lightMaterial(0xff9f63),blue=lightMaterial(0x507edb,.8);
  function mesh(parent,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
  function ring(parent,radius,rotation=[0,0,0],color=0x7bdcff,opacity=.65,width=.009){const material=new T.MeshBasicMaterial({color,transparent:true,opacity,toneMapped:false});const m=mesh(parent,new T.TorusGeometry(radius,width,6,160),material);m.rotation.set(...rotation);return m;}
  function wire(parent,geometry,color=0x7bdcff,opacity=.4){const w=new T.LineSegments(new T.EdgesGeometry(geometry),new T.LineBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false}));w.scale.setScalar(1.008);parent.add(w);return w;}
  function path(parent,points,color=0x6dccff,opacity=.6){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const line=new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(100)),new T.LineBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending}));parent.add(line);curve.displayLine=line;return curve;}
  // Generated falloff texture keeps every visual editable and self-contained.
  const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;const ctx=glowCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.12,'rgba(255,255,255,.8)');gradient.addColorStop(.4,'rgba(255,255,255,.14)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const glowTexture=new T.CanvasTexture(glowCanvas);
  function beacon(parent,x,y,z,size=.35,color=0x95dfff){const sprite=new T.Sprite(new T.SpriteMaterial({map:glowTexture,color,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));sprite.position.set(x,y,z);sprite.scale.setScalar(size);parent.add(sprite);return sprite;}
  // Deterministic starfield lets screenshots be compared without changing the sky.
  let seed=7041;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const starPositions=[],starColors=[];
  for(let i=0;i<2200;i++){const x=(random()-.5)*100,y=(random()-.5)*70,z=-15-random()*75;starPositions.push(x,y,z);const c=random();starColors.push(.25+c*.55,.4+c*.45,.6+c*.4);}
  const starsGeo=new T.BufferGeometry();starsGeo.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));starsGeo.setAttribute('color',new T.Float32BufferAttribute(starColors,3));
  const stars=new T.Points(starsGeo,new T.PointsMaterial({size:.085,map:glowTexture,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));scene.add(stars);
  // A faint atmospheric cloud, produced by a shader rather than a static backdrop.
  const nebula=mesh(scene,new T.PlaneGeometry(150,100),new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv; void main(){vec2 p=vUv-.5;float a=exp(-dot(p*vec2(1.9,4.),p*vec2(1.9,4.))*6.);float w=sin(p.x*14.+p.y*9.)*.5+.5;vec3 c=mix(vec3(.015,.035,.08),vec3(.06,.04,.12),w);gl_FragColor=vec4(c,a*.62);}`}),4,4,-55);
  const coreShader=new T.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`varying vec3 vP;varying vec3 vN;varying vec3 vV;void main(){vP=position;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float time;varying vec3 vP;varying vec3 vN;varying vec3 vV;void main(){float rim=pow(1.-max(0.,dot(normalize(vN),vV)),2.8);float lines=pow(abs(sin(vP.y*19.+time*.12)),55.);float wave=sin(vP.x*8.+vP.z*7.)*sin(vP.y*12.-vP.z*3.);vec3 base=mix(vec3(.008,.018,.043),vec3(.026,.065,.12),wave*.5+.5);vec3 c=base+vec3(.1,.5,.8)*rim*.95+vec3(.03,.2,.35)*lines*.17;gl_FragColor=vec4(c,1.);}`});
  function planet(parent,r){const g=new T.Group();parent.add(g);mesh(g,new T.SphereGeometry(r,64,48),coreShader);const lattice=mesh(g,new T.IcosahedronGeometry(r*1.009,3),new T.MeshBasicMaterial({color:0x437db6,wireframe:true,transparent:true,opacity:.12,blending:T.AdditiveBlending}));return {group:g,lattice};}
  function crystal(parent,x,y,z,size=.38,color=glow){const g=new T.Group();g.position.set(x,y,z);parent.add(g);mesh(g,new T.OctahedronGeometry(size),metal);wire(g,new T.OctahedronGeometry(size*1.015),color===amber?0xffa06b:0x8fe4ff,.85);beacon(g,0,0,0,size*2.5,color===amber?0xffa06b:0x85dfff);return g;}
  const hero=groups[0];const globe=planet(hero,1.95);globe.group.rotation.z=.23;
  const heroRings=[ring(hero,2.8,[1.15,.35,.12],0x76cfff,.65),ring(hero,3.03,[1.15,.35,.12],0x4885b9,.35,.004),ring(hero,2.6,[.25,.8,-.5],0xffa16d,.45,.008),ring(hero,3.4,[1.5,-.2,.1],0x5f96ca,.28,.004)];
  const globePoints=[];const networkLines=[];
  for(let i=0;i<130;i++){const y=1-(i/129)*2,r=Math.sqrt(1-y*y),a=i*2.399963;const v=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(2.015);globePoints.push(v);beacon(globe.group,v.x,v.y,v.z,i%8===0?.25:.09,i%8===0?0xffb880:0x8bd4ff);}
  for(let i=0;i<globePoints.length;i++)for(let j=i+1;j<globePoints.length;j++){if(globePoints[i].distanceTo(globePoints[j])<.68){networkLines.push(...globePoints[i].toArray(),...globePoints[j].toArray());}}
  const network=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(networkLines,3)),new T.LineBasicMaterial({color:0x61b9ef,transparent:true,opacity:.25,blending:T.AdditiveBlending}));globe.group.add(network);
  const satellites=[crystal(hero,2.55,1.4,.5,.26,amber),crystal(hero,-2.45,-.85,1,.22),crystal(hero,1,-1.8,-1.9,.18)];
  const question=groups[1];const qA=planet(question,1.12);qA.group.position.set(-1.65,0,0);const qB=planet(question,1.12);qB.group.position.set(1.65,0,0);ring(qA.group,1.4,[1.2,0,.5],0x7bdcff,.55);ring(qB.group,1.4,[1.2,0,-.5],0xffa06b,.55);const questionLine=path(question,[[-1.6,0,0],[0,.55,.9],[1.6,0,0]],0x94b5d4,.4);crystal(question,0,.55,.9,.19,amber);
  const discover=groups[2];const cloud=[];const cloudBase=[];for(let i=0;i<100;i++){const a=random()*Math.PI*2,r=1.1+random()*2.2,v=new T.Vector3(Math.cos(a)*r,(random()-.5)*3,Math.sin(a)*r*.55);cloudBase.push(v);cloud.push(beacon(discover,v.x,v.y,v.z,i%7===0?.3:.15,i%7===0?0xff9e6a:0x66acde));}const signal=crystal(discover,0,0,.5,.5,amber);const scan=ring(discover,2.8,[0,0,0],0x89d9ff,.6,.013);ring(discover,2.88,[0,0,0],0x4d8ec1,.3,.004);const scanLine=path(discover,[[-2.8,0,0],[0,0,0],[2.8,0,0]],0x6ccafa,.4);
  const build=groups[3];const modules=[];
  for(let i=0;i<3;i++){const g=new T.Group();build.add(g);g.position.set((i-1)*2.5,(i-1)*.4,0);const geo=new T.BoxGeometry(1.25,1.25,1.25);mesh(g,geo,metal);wire(g,geo,i===2?0xffa06b:0x76cdff,.7);const face=mesh(g,new T.PlaneGeometry(.92,.92),new T.MeshBasicMaterial({color:i===2?0xffa06b:0x4aa6eb,transparent:true,opacity:.08}),0,0,.632);for(let k=0;k<4;k++){const bar=mesh(g,new T.BoxGeometry(.18+k*.12,.025,.01),i===2?amber:blue,-.25+k*.06,.3-k*.18,.64);}ring(g,.96,[Math.PI/2,0,0],0x7bdcff,.3,.004);modules.push(g);}
  const deliveryPath=path(build,[[-2.5,-.4,0],[-1.2,.6,1],[0,0,0],[1.1,-.2,1],[2.5,.4,0]],0x74cafa,.7);const deliveries=Array.from({length:4},()=>beacon(build,0,0,0,.4,0xffa06b));
  const difference=groups[4];const coordinates=[[-2,-.8,0],[0,1.5,-.3],[2,-.8,0]];const anchors=coordinates.map(p=>crystal(difference,...p,.58));path(difference,[...coordinates,coordinates[0]],0x67b8e8,.7);ring(difference,3.1,[.18,0,0],0x5c8bab,.3,.004);const compass=crystal(difference,0,-.1,.5,.28,amber);
  const reuse=groups[5];const hub=planet(reuse,.8);ring(reuse,1.14,[1.4,.1,0],0xffa06b,.8,.016);const endpoints=[[-2.55,1.3,.2],[2.6,1.25,-.3],[.6,-2.15,.3]];const reusePaths=[];const outer= endpoints.map((p,i)=>{const g=crystal(reuse,...p,.4);reusePaths.push(path(reuse,[[0,0,0],[p[0]*.45,p[1]*.6,1.5],p],0x5aa6db,.4));ring(g,.65,[.3,.2,0],0x7edbff,.4,.006);return g;});const sparks=Array.from({length:9},()=>beacon(reuse,0,0,0,.32,0xffba85));const waves=[1.5,2.1,2.7].map(r=>ring(reuse,r,[1.2,.25,0],0x5dbbf1,.16,.007));
  const future=groups[6];const futurePeople=[],robots=[],aiPaths=[];
  for(let i=0;i<5;i++){const x=(i-2)*1.25,y=Math.sin(i/4*Math.PI)*.8;futurePeople.push(crystal(future,x,y,0,.25,amber));ring(futurePeople[i],.43,[1.1,.3,0],0xffb87f,.5,.005);if(i===1||i===2){const robot=crystal(future,x,y+1.5,0,.2);robots.push(robot);aiPaths.push(path(future,[[x,y,0],[x+.4,y+.7,.3],[x,y+1.5,0]],0x72d8ff,.6));}}
  path(future,futurePeople.map(g=>g.position.toArray()),0xd29b7d,.7);const futureOrbit=ring(future,3.2,[1.3,0,.05],0x5fbbfa,.4,.006);
  const packets=Array.from({length:4},()=>beacon(future,0,0,0,.24));
  const tagConfig=[
    [['顧客の現場',[-2.5,1.5,0]],['技術',[2.7,-.9,0]],['FDE / つなぐ役割',[.3,-2.6,0]]],
    [['SES ?',[-1.7,1.8,0]],['FDE ?',[1.7,1.8,0]],['同じ現場に、異なる仕事の設計',[0,-2,0]]],
    [['現場の声',[-2,1.6,0]],['課題',[0,-.9,.5]],['判断の条件',[2,1,0]]],
    [['試作',[-2.5,-1.5,0]],['評価',[0,-1.3,0]],['本番',[2.5,-.8,0]]],
    [['裁量',[-2,-1.7,0]],['責任',[0,2.3,-.3]],['再利用',[2,-1.7,0]]],
    [['現場 A',[-2.55,2.1,0]],['共通基盤',[0,-1,0]],['現場 B',[2.6,2,0]]],
    [['現場理解',[-2.5,-.65,0]],['構造化・実装',[0,2.65,0]],['検収・定着',[2.2,-.7,0]]]
  ];
  const tags=[...document.querySelectorAll('.stage-tags span')];const projected=new T.Vector3();
  const poses=[[2.5,1.4,11],[1.5,1,11.5],[1,.4,11.5],[2.8,1.8,12.5],[.5,.3,12],[1.5,2,12],[1,1.6,12.5]];
  let width=innerWidth,height=innerHeight,mobile=width<=760;
  function resize(){width=innerWidth;height=innerHeight;mobile=width<=760;renderer.setSize(width,height);composer.setSize(width,height);camera.aspect=width/height;camera.setViewOffset(width,height,mobile?0:-width*.235,mobile?height*.24:0,width,height);camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();camera.position.set(...poses[0]);
  const clock=new T.Clock();let visible=true,lastChapter=-1,elapsed=1,lastDraw=0,lastFrame=0;let focus=0,spread=0,ai=0;let animationTime=0;
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{rootMargin:'50px'}).observe(document.querySelector('#experience'));
  function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-lastFrame)/1000||.016,.05);lastFrame=now;if(!visible||document.hidden)return;if(state.reduced&&now-lastDraw<100)return;lastDraw=now;if(!state.reduced)animationTime+=dt;const t=animationTime;
    if(lastChapter!==state.chapter){lastChapter=state.chapter;elapsed=0;}elapsed=state.reduced?1:Math.min(1,elapsed+dt*2.3);const ease=1-Math.pow(1-elapsed,3);
    groups.forEach((g,i)=>{g.visible=i===state.chapter;g.scale.setScalar(.9+.1*ease);});
    const pose=poses[state.chapter];
    const desired=new T.Vector3(...pose);
    // Fit the whole diagram to its portion of the viewport, including narrow laptops.
    const availableAspect=width*(mobile?.96:state.chapter===0?.52:.46)/height;
    const fitDistance=3.45/(Math.tan(T.MathUtils.degToRad(camera.fov/2))*availableAspect);
    desired.setLength(Math.max(desired.length()*(mobile?1.48:1),fitDistance));
    if(!state.reduced){desired.x+=Math.sin(t*.09)*.13+(state.progress-.5)*.65;desired.y+=(state.progress-.5)*.3;}
    camera.position.lerp(desired,state.reduced?1:1-Math.exp(-dt*3));camera.lookAt(0,0,0);camera.updateMatrixWorld();
    root.rotation.y=state.reduced?0:Math.sin(t*.08)*.06;root.updateMatrixWorld(true);stars.rotation.z=state.reduced?0:t*.0008;
    coreShader.uniforms.time.value=t;globe.group.rotation.y=state.reduced?.1:t*.045;
    heroRings[2].rotation.z=-.5+(state.reduced?0:Math.sin(t*.12)*.07);
    satellites.forEach((g,i)=>{g.rotation.y=state.reduced?0:t*.25;});
    focus=T.MathUtils.damp(focus,state.field?1:0,3,state.reduced?1:dt);cloud.forEach((p,i)=>{const base=cloudBase[i];p.position.copy(base).multiplyScalar(1-focus*.58);p.material.opacity=1-focus*.64;p.position.y+=state.reduced?0:Math.sin(t*.4+i)*.04;});signal.rotation.y=state.reduced?0:t*.25;scan.position.y=state.reduced?0:Math.sin(t*.6)*.4;
    modules.forEach((g,i)=>{g.rotation.y=state.reduced?.3:.3+Math.sin(t*.15+i)*.06;g.rotation.z=.05;});deliveries.forEach((p,i)=>p.position.copy(deliveryPath.getPoint(state.reduced?i/4:(t*.14+i/4)%1)));
    anchors.forEach((g,i)=>{g.rotation.y=state.reduced?0:t*.2;g.scale.setScalar(state.inspection===i?1.28:1);});
    spread=T.MathUtils.damp(spread,state.shared?1:0,3,state.reduced?1:dt);sparks.forEach((p,i)=>{p.visible=spread>.01;p.material.opacity=spread;p.position.copy(reusePaths[i%3].getPoint(state.reduced?.65:(t*.2+Math.floor(i/3)*.33)%1));});outer.forEach(g=>g.scale.setScalar(.82+spread*.25));waves.forEach((w,i)=>{w.material.opacity=.08+spread*.22;w.rotation.z=state.reduced?0:t*.04;});hub.group.rotation.y=state.reduced?0:t*.15;
    ai=T.MathUtils.damp(ai,state.ai?1:0,4,state.reduced?1:dt);aiPaths.forEach(p=>p.displayLine.material.opacity=ai*.6);robots.forEach(g=>{g.visible=ai>.01;g.scale.setScalar(ai);g.rotation.y=state.reduced?0:t*.3;});packets.forEach((p,i)=>{p.visible=ai>.01;p.position.copy(aiPaths[i%2].getPoint(state.reduced?.5:(t*.35+Math.floor(i/2)*.5)%1));});futurePeople.forEach(g=>g.rotation.y=state.reduced?0:t*.1);
    // Project DOM labels from the same world positions as the visible structures.
    for(let i=0;i<3;i++){const [text,point]=tagConfig[state.chapter][i];tags[i].textContent=text;projected.set(...point);groups[state.chapter].localToWorld(projected);projected.project(camera);const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;const show=x>45&&x<width-45&&y>95&&y<height*(mobile?.41:.82);tags[i].style.left=`${x}px`;tags[i].style.top=`${y}px`;tags[i].style.opacity=show?String(ease):'0';}
    composer.render();document.documentElement.dataset.rendered='true';document.documentElement.dataset.scene=String(state.chapter);
  }
  requestAnimationFrame(frame);
}
