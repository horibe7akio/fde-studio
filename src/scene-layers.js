import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const CYAN = 0x61fce4, LIME = 0xc6ff51, PINK = 0xff637f;

// Two switchable looks. CYBER is the dark neon original; ASH borrows the hazy, ash-lit
// atmosphere of the mech game (warm horizon, grey-blue zenith, drifting dust).
const ASSEMBLY = 5.4;   // seconds the opening takes to build itself

const LOOKS={
  cyber:{bg:0x03080b,bgScale:.2,fog:0x03080b,fogScale:.2,fogK:.55,exposure:1.16,bloom:[.72,.52,.55],env:.28,
    hemi:[0xb6ffed,0x07201a,1.35],key:[0xe6fff7,3.4],dark:0x205749,black:0x11302a,building:0x173936,
    sky:[0x02070a,0x0a2c30,0x061826],grade:[.055,.0020,.34],
    dust:0x9ffbe8,dustOpacity:.5,additive:true,plexus:[0x61fce4,.3],glow:[[0x19c9b4,.62],[0xffae69,.3]],stream:[0x9ffbe8,.55]},
  ash:{bg:0xc4bdb1,bgScale:1,fog:0xc9c2b6,fogScale:1,fogK:.95,exposure:1.02,bloom:[.3,.6,.85],env:.5,
    hemi:[0x8fb2e2,0x6d4d2b,1.05],key:[0xfff0d0,4.1],dark:0x5e5a53,black:0x8b8478,building:0x6b665c,
    sky:[0x6b6151,0xe6cea4,0x74879f],grade:[.040,.0011,.20],
    dust:0xfff6e4,dustOpacity:.5,additive:false,plexus:[0x39485a,.26],glow:[[0xffe9c4,.32],[0xffffff,0]],stream:[0xffffff,.28]}
};

export function createCosmos(canvas, state) {
  const tags = [...document.querySelectorAll('.stage-tags span')];
  function fallback() {
    canvas.hidden = true;
    document.querySelector('#fallback').hidden = false;
    document.querySelectorAll('.stage-tags span').forEach(tag => tag.style.opacity = 0);
  }
  let renderer;
  try { renderer = new T.WebGLRenderer({canvas, antialias:false, powerPreference:'high-performance'}); }
  catch { fallback(); return; }
  renderer.setClearColor(new T.Color(0x03080b).multiplyScalar(.2));
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', e => {e.preventDefault(); fallback();});

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .35;
  scene.fog = new T.FogExp2(new T.Color(0x03080b).multiplyScalar(.2), .045);
  const camera = new T.PerspectiveCamera(39, 1, .1, 100);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom=new UnrealBloomPass(new T.Vector2(1,1), .72, .52, .55);composer.addPass(bloom);
  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());
  // Merged into ONE pass on purpose: separate grain/vignette/aberration passes are what makes
  // these pages stutter on older laptops.
  const grade=new ShaderPass({
    uniforms:{tDiffuse:{value:null},uRes:{value:new T.Vector2(1,1)},uTime:{value:0},
      uGrain:{value:.055},uChroma:{value:.002},uVignette:{value:.34},uLift:{value:0}},
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uRes;
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
      }`});
  composer.addPass(grade);
  const hemi=new T.HemisphereLight(0xb6ffed, 0x07201a, 2);scene.add(hemi);
  const key = new T.DirectionalLight(0xe6fff7, 2.2); key.position.set(1,6,5); scene.add(key);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left=-8.6;key.shadow.camera.right=8.6;key.shadow.camera.top=6.8;key.shadow.camera.bottom=-6.8;
  key.shadow.camera.near=.5;key.shadow.camera.far=42;key.shadow.bias=-.0022;key.shadow.normalBias=.03;
  scene.add(key.target);
  const fill = new T.PointLight(CYAN, 25, 25); fill.position.set(-4,2,4); scene.add(fill);
  const rim = new T.PointLight(LIME, 50, 20); rim.position.set(4,3,-2); scene.add(rim);

  const root = new T.Group(); scene.add(root);
  const dark = new T.MeshStandardMaterial({color:0x205749, metalness:.3, roughness:.35});
  const black = new T.MeshStandardMaterial({color:0x061410, metalness:.45, roughness:.5});
  function neon(color, opacity=1) {return new T.MeshBasicMaterial({color, transparent:opacity<1, opacity, toneMapped:false});}
  function mesh(parent, geo, mat, x=0, y=0, z=0) {
    const object = new T.Mesh(geo, mat.clone()); object.position.set(x,y,z); parent.add(object); return object;
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
  function draw(connection, progress) {
    const index=connection.tube.geometry.index;
    if(!index)return;
    connection.tube.visible=progress>.01;
    connection.tube.geometry.setDrawRange(0,Math.floor(index.count*Math.min(1,progress)/3)*3);
  }
  function flow(connection, t, amount=1, speed=.15, color=CYAN) {
    connection.tube.userData.baseOpacity = .06+amount*.65;
    connection.tube.material.color.setHex(color);
    connection.packets.forEach((p,i)=> {
      p.visible=amount>.03; p.material.color.setHex(color);
      const u=state.reduced?(i+.5)/4:(t*speed+i/4)%1;
      p.position.copy(connection.curve.getPoint(u));
      p.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),connection.curve.getTangent(u));
    });
  }


  const AMBER=0xffae69;
  // The vertical axis is "which layer are we looking at": management on top, data at the bottom.
  const LAYER_Y={management:4.6,field:0,system:-4.6,data:-9.2};
  const chapterLayers=['management','field','field','data','system','system','system','field','management','system'];
  const SHEET=26;
  const layerGrids=Object.entries(LAYER_Y).map(([name,y])=>{
    const sheet=new T.Mesh(new T.PlaneGeometry(SHEET,SHEET*.72),new T.ShaderMaterial({
      uniforms:{uColor:{value:new T.Color(0x2f7f6d)},uOpacity:{value:.2},uSize:{value:new T.Vector2(SHEET,SHEET*.72)}},
      transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader:`varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity; uniform vec2 uSize;
        // Fixed world-space line width: derivative-based grids smear into a haze at grazing angles.
        float rule(vec2 p,float step,float w){ vec2 d=abs(fract(p/step-.5)-.5)*step; return 1.-smoothstep(w*.45,w,min(d.x,d.y)); }
        void main(){
          vec2 p=vUv*uSize;
          float grid=rule(p,1.,.026)*.38+rule(p,5.,.05)*.8;
          float fade=smoothstep(1.,.3,length(vUv-.5)*2.);
          float a=grid*fade*uOpacity;
          if(a<.002) discard;
          gl_FragColor=vec4(uColor,a);
        }`}));
    sheet.rotation.x=-Math.PI/2;sheet.position.y=y-.3;sheet.frustumCulled=false;scene.add(sheet);
    const accent=name==='field'?0xffae69:name==='system'?0xc6ff51:0x61fce4;
    const edge=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(17.6,.05,13.2)),new T.LineBasicMaterial({color:accent,transparent:true,opacity:.3,blending:T.AdditiveBlending,depthWrite:false}));
    edge.position.y=y-.32;scene.add(edge);
    return{name,y,sheet,edge,accent};
  });
  const columns=new T.Group();scene.add(columns);
  for(const [x,z] of [[-8.4,-6.6],[8.4,-6.6],[-8.4,6.6],[8.4,6.6]]){
    const height=LAYER_Y.management-LAYER_Y.data+2.6;
    const column=new T.Mesh(new T.CylinderGeometry(.03,.03,height,6),new T.MeshBasicMaterial({color:0x61fce4,transparent:true,opacity:.1,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
    column.position.set(x,(LAYER_Y.management+LAYER_Y.data)/2,z);columns.add(column);
  }
  const company=new T.Group(),workplace=new T.Group(),documents=new T.Group(),conceptData=new T.Group(),conceptDecision=new T.Group(),conceptOwner=new T.Group(),systems=new T.Group(),sharedGroup=new T.Group(),aiGroup=new T.Group();
  root.add(company,workplace,documents,conceptData,conceptDecision,conceptOwner,systems,sharedGroup,aiGroup);
  // Backdrop: a gradient dome whose two soft blobs are tinted by the layer currently in view,
  // so the background itself says which layer you are on (mood-driven background, Codrops pattern).
  const skyMaterial=new T.ShaderMaterial({
    uniforms:{uBottom:{value:new T.Color(0x02070a)},uHorizon:{value:new T.Color(0x0a2c30)},uTop:{value:new T.Color(0x061826)},
      uAccentA:{value:new T.Color(CYAN)},uAccentB:{value:new T.Color(CYAN)},uBlob:{value:.55},
      uTime:{value:0},uRes:{value:new T.Vector2(1,1)},uMobile:{value:0},uAccentMix:{value:1}},
    side:T.BackSide,fog:false,depthWrite:false,toneMapped:false,
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`varying vec2 vUv; uniform vec3 uBottom,uHorizon,uTop,uAccentA,uAccentB;
      uniform float uBlob,uTime,uMobile,uAccentMix; uniform vec2 uRes;
      void main(){
        vec3 base=mix(uBottom,uHorizon,smoothstep(.24,.50,vUv.y));
        base=mix(base,uTop,smoothstep(.50,.94,vUv.y));
        float aspect=uRes.x/max(uRes.y,1.);
        vec2 p=vec2(gl_FragCoord.x/uRes.x*aspect,gl_FragCoord.y/uRes.y);
        vec2 a=mix(vec2((.72+sin(uTime*.09)*.04)*aspect,.54+cos(uTime*.07)*.05),
                   vec2((.50+sin(uTime*.09)*.04)*aspect,.80+cos(uTime*.07)*.04),uMobile);
        vec2 b=mix(vec2((.86+cos(uTime*.06)*.05)*aspect,.26+sin(uTime*.05)*.04),
                   vec2((.70+cos(uTime*.06)*.05)*aspect,.62+sin(uTime*.05)*.03),uMobile);
        float side=mix(smoothstep(.54,.78,p.x/aspect),smoothstep(.34,.60,p.y),uMobile);
        vec3 accentA=mix(uHorizon,uAccentA,uAccentMix),accentB=mix(uHorizon,uAccentB,uAccentMix);
        base=mix(base,accentA,uBlob*side*smoothstep(.42,.0,distance(p,a))*.60);
        base=mix(base,accentB,uBlob*side*smoothstep(.28,.0,distance(p,b))*.45);
        gl_FragColor=vec4(base,1.);
      }`});
  const sky=new T.Mesh(new T.SphereGeometry(60,32,16),skyMaterial);
  sky.frustumCulled=false;scene.add(sky);

  // Dust: one Points draw call; every mote drifts from time alone, so the CPU does nothing per frame.
  const DUST_V=`attribute vec3 aSeed; uniform float uTime,uPx,uDrift; varying float vA;
    void main(){ vec3 p=position; float ph=aSeed.x*6.2832;
      p.x+=sin(uTime*(.12+aSeed.y*.1)+ph)*1.3; p.z+=cos(uTime*(.1+aSeed.z*.08)+ph)*1.3;
      p.y+=mod(uTime*(.14+aSeed.z*.18)+aSeed.x*12.,12.)-6.+uDrift;
      vec4 mv=modelViewMatrix*vec4(p,1.); vA=.3+.7*aSeed.y;
      gl_PointSize=max(1.,uPx*(1.+aSeed.z*1.8)*30./max(1.,-mv.z)); gl_Position=projectionMatrix*mv; }`;
  const DUST_F=`varying float vA; uniform vec3 uColor; uniform float uOpacity;
    void main(){ vec2 d=gl_PointCoord-.5; float r=dot(d,d); if(r>.25) discard;
      gl_FragColor=vec4(uColor,smoothstep(.25,.02,r)*vA*uOpacity); }`;
  function motes(count,extent,size){
    const pos=[],seed=[];
    for(let i=0;i<count;i++){pos.push((Math.random()-.5)*extent[0],(Math.random()-.5)*extent[1],(Math.random()-.5)*extent[2]);seed.push(Math.random(),Math.random(),Math.random());}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('aSeed',new T.Float32BufferAttribute(seed,3));
    const m=new T.ShaderMaterial({uniforms:{uTime:{value:0},uPx:{value:size},uDrift:{value:0},uColor:{value:new T.Color(CYAN)},uOpacity:{value:.5}},vertexShader:DUST_V,fragmentShader:DUST_F,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
    const points=new T.Points(g,m);points.frustumCulled=false;scene.add(points);return points;
  }
  // Background visual, the familiar tech grammar: a constellation network, a halo behind the
  // stack, and light streams running between the layers. All time-driven on the GPU.
  // Two frequencies per axis, offset per node, so the network never settles into a visible pulse.
  const DRIFT=`vec3 drift(vec3 p,vec3 s,float t){ float ph=s.x*6.2832;
    float a=t*(.15+s.y*.13)+ph, b=t*(.12+s.z*.14)+ph*1.3, c=t*(.13+s.x*.11)+ph*.7;
    return p+vec3(sin(a)*3.1+cos(a*.43+s.z*4.1)*1.6,
                  cos(b)*2.3+sin(b*.61+s.x*3.3)*1.2,
                  sin(c)*2.2+cos(c*.37+s.y*5.2)*1.3); }`;
  const nodeCount=150,nodePos=[],nodeSeed=[];
  for(let i=0;i<nodeCount;i++){nodePos.push((Math.random()-.5)*60,LAYER_Y.data-4+Math.random()*34,-8-Math.random()*16);nodeSeed.push(Math.random(),Math.random(),Math.random());}
  const plexusPoints=new T.Points(new T.BufferGeometry(),new T.ShaderMaterial({
    uniforms:{uTime:{value:0},uColor:{value:new T.Color(CYAN)},uOpacity:{value:.3}},
    vertexShader:`attribute vec3 aSeed; uniform float uTime; varying float vA; ${DRIFT}
      void main(){ vec4 mv=modelViewMatrix*vec4(drift(position,aSeed,uTime),1.);
        gl_PointSize=max(1.,(1.4+aSeed.z*2.2)*60./max(1.,-mv.z)); gl_Position=projectionMatrix*mv;
        vA=(.4+.6*aSeed.y)*smoothstep(-.35,.35,gl_Position.x/gl_Position.w); }`,
    fragmentShader:`varying float vA; uniform vec3 uColor; uniform float uOpacity;
      void main(){ vec2 d=gl_PointCoord-.5; float r=dot(d,d); if(r>.25) discard; gl_FragColor=vec4(uColor,smoothstep(.25,.0,r)*vA*uOpacity*1.6); }`,
    transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  plexusPoints.geometry.setAttribute('position',new T.Float32BufferAttribute(nodePos,3));
  plexusPoints.geometry.setAttribute('aSeed',new T.Float32BufferAttribute(nodeSeed,3));
  const linkPos=[],linkSeed=[],linkFade=[];
  for(let i=0;i<nodeCount;i++)for(let j=i+1;j<nodeCount;j++){
    const dx=nodePos[i*3]-nodePos[j*3],dy=nodePos[i*3+1]-nodePos[j*3+1],dz=nodePos[i*3+2]-nodePos[j*3+2];
    if(dx*dx+dy*dy+dz*dz>52||Math.random()>.7)continue;
    const fade=Math.random();
    for(const k of [i,j]){linkPos.push(nodePos[k*3],nodePos[k*3+1],nodePos[k*3+2]);linkSeed.push(nodeSeed[k*3],nodeSeed[k*3+1],nodeSeed[k*3+2]);linkFade.push(fade);}
  }
  const plexusLinks=new T.LineSegments(new T.BufferGeometry(),new T.ShaderMaterial({
    uniforms:{uTime:{value:0},uColor:{value:new T.Color(CYAN)},uOpacity:{value:.3}},
    vertexShader:`attribute vec3 aSeed; attribute float aFade; uniform float uTime; varying float vA; ${DRIFT}
      void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(drift(position,aSeed,uTime),1.);
        vA=(.35+.65*(.5+.5*sin(uTime*.5+aFade*6.2832)))*smoothstep(-.35,.35,gl_Position.x/gl_Position.w); }`,
    fragmentShader:`varying float vA; uniform vec3 uColor; uniform float uOpacity; void main(){ gl_FragColor=vec4(uColor,vA*uOpacity); }`,
    transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  plexusLinks.geometry.setAttribute('position',new T.Float32BufferAttribute(linkPos,3));
  plexusLinks.geometry.setAttribute('aSeed',new T.Float32BufferAttribute(linkSeed,3));
  plexusLinks.geometry.setAttribute('aFade',new T.Float32BufferAttribute(linkFade,1));
  plexusPoints.frustumCulled=plexusLinks.frustumCulled=false;scene.add(plexusPoints,plexusLinks);

  function haloTexture(){
    const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
    const gradient=g.createRadialGradient(128,128,0,128,128,128);
    gradient.addColorStop(0,'rgba(255,255,255,.9)');gradient.addColorStop(.28,'rgba(255,255,255,.38)');gradient.addColorStop(.62,'rgba(255,255,255,.08)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gradient;g.fillRect(0,0,256,256);return new T.CanvasTexture(c);
  }
  const haloMap=haloTexture();
  const halos=[[54,36,[3,LAYER_Y.field-1,-15]],[24,15,[7,LAYER_Y.field+1.5,-9]]].map(([w,h,position])=>{
    const halo=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:haloMap,color:CYAN,transparent:true,opacity:.5,depthWrite:false,fog:false,toneMapped:false,blending:T.AdditiveBlending}));
    halo.position.set(...position);halo.frustumCulled=false;scene.add(halo);return halo;
  });

  const streamPos=[],streamSeed=[],streamEnd=[],streamSpan=LAYER_Y.management-LAYER_Y.data+6;
  for(let i=0;i<260;i++){
    const angle=Math.random()*Math.PI*2,radius=8.6+Math.random()*4.5;
    const x=Math.cos(angle)*radius*1.15,z=Math.sin(angle)*radius*.85,seed=[Math.random(),Math.random()<.5?1:-1,.4+Math.random()*.9];
    for(const end of [0,1]){streamPos.push(x,LAYER_Y.data-3,z);streamSeed.push(...seed);streamEnd.push(end);}
  }
  const streams=new T.LineSegments(new T.BufferGeometry(),new T.ShaderMaterial({
    uniforms:{uTime:{value:0},uSpan:{value:streamSpan},uColor:{value:new T.Color(CYAN)},uOpacity:{value:.55}},
    vertexShader:`attribute vec3 aSeed; attribute float aEnd; uniform float uTime,uSpan; varying float vA;
      void main(){ float f=mod(aSeed.x*uSpan+uTime*aSeed.z*aSeed.y*1.4,uSpan); float g=f+aEnd*.55*aSeed.z;
        vA=smoothstep(0.,2.5,f)*smoothstep(uSpan,uSpan-2.5,f)*(1.-aEnd*.8)*(.5+.5*aSeed.z);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position+vec3(0.,g,0.),1.); }`,
    fragmentShader:`varying float vA; uniform vec3 uColor; uniform float uOpacity; void main(){ gl_FragColor=vec4(uColor,vA*uOpacity); }`,
    transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  streams.geometry.setAttribute('position',new T.Float32BufferAttribute(streamPos,3));
  streams.geometry.setAttribute('aSeed',new T.Float32BufferAttribute(streamSeed,3));
  streams.geometry.setAttribute('aEnd',new T.Float32BufferAttribute(streamEnd,1));
  streams.frustumCulled=false;scene.add(streams);

  const dust=motes(900,[30,14,22],1.5);
  const streaks=motes(320,[12,18,8],2.6);
  streaks.material.uniforms.uOpacity.value=0;

  company.position.y=sharedGroup.position.y=LAYER_Y.management;
  systems.position.y=aiGroup.position.y=LAYER_Y.system;
  const conceptBaseY=[LAYER_Y.data,LAYER_Y.system,LAYER_Y.system];
  const layerOrder=['management','field','system','data'];
  const bonds=[];
  const bondGroup=new T.Group();root.add(bondGroup);
  [[-4.4,-3.1],[4.4,-3.1],[-4.4,3.3],[4.4,3.3]].forEach(([x,z],corner)=>{
    for(let i=0;i<layerOrder.length-1;i++){
      const top=LAYER_Y[layerOrder[i]],bottom=LAYER_Y[layerOrder[i+1]];
      const path=[[x,top-.2,z],[x*.82,(top+bottom)/2,z*.82],[x,bottom+.2,z]];
      // Half the bonds are built the other way round, so the light travels both up and down.
      const bond=link(bondGroup,corner%2?path.slice().reverse():path,corner%2?LIME:CYAN,.05);
      // A collar where the strand meets each floor: the layers are wired, not merely stacked.
      for(const y of [top,bottom]){const collar=ring(bondGroup,.46,corner%2?LIME:CYAN,.032,.85);collar.position.set(x,y,z);collar.rotation.x=Math.PI/2;}
      bond.packets.forEach(packet=>packet.scale.setScalar(2.4));
      bonds.push(bond);
    }
  });
  function opacity(group,value){
    group.visible=value>.001;
    group.traverse(o=>{if(o.material){o.material.opacity=o.userData.baseOpacity*value;o.material.depthWrite=value>.99&&o.userData.baseDepthWrite;}});
  }
  const floors=[];
  function plate(parent,w,d,x=0,z=0,color=CYAN){
    const p=box(parent,[w,.12,d],[x,-.12,z],black);outline(p,new T.BoxGeometry(w,.12,d),color,.55);
    floors.push(p);return p;
  }
  const scanBars=[];
  function scanBar(parent,w,d,z0,color,phase){
    const bar=box(parent,[w,.03,.26],[0,-.04,z0],neon(color,.26));scanBars.push({bar,d,z0,phase});return bar;
  }
  plate(company,14,10,0,0,CYAN);scanBar(company,14,10,0,CYAN,0);
  const focusFloor=plate(workplace,6.8,4.4,0,.1,AMBER);scanBar(workplace,6.8,4.4,.1,AMBER,.35);
  function building(x,z,height,color=CYAN){
    const g=new T.Group();company.add(g);g.position.set(x,0,z);
    const geo=new T.BoxGeometry(1.7,height,1.35);
    const building=mesh(g,geo,new T.MeshStandardMaterial({color:0x173936,metalness:.25,roughness:.4}),0,height/2,0);
    buildingMats.push(building.material);
    outline(building,geo,color,.45);
    box(g,[1.9,.08,1.52],[0,height+.03,0],neon(color,.5));
    for(let row=.38;row<height-.1;row+=.48)for(let col=-.5;col<=.5;col+=.5){
      box(g,[.23,.22,.018],[col,row,.684],neon(color,.42));
    }
    return g;
  }
  const buildingMats=[];
  const buildings=[building(-5,-2.5,2.8),building(5,-2.5,2.5),building(-5,2.6,1.7),building(5,2.6,2),building(0,-3.9,3.5)];
  for(const x of [-3.4,3.4])box(company,[.04,1,4.4],[x,.45,.1],neon(CYAN,.12));

  // Adapted from V1: separate head, torso, arms and legs, rather than an abstract processor.
  function person(parent,x,z,color,scale=1){
    const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
    const suit=new T.MeshStandardMaterial({color,roughness:.5,metalness:.08,emissive:color,emissiveIntensity:.09});
    mesh(g,new T.CylinderGeometry(.24,.29,.69,24),suit,0,.62,0);
    mesh(g,new T.SphereGeometry(.23,24,18),new T.MeshStandardMaterial({color:0xffeed9,roughness:.55}),0,1.18,0);
    box(g,[.17,.38,.22],[-.14,.17,0],dark);box(g,[.17,.38,.22],[.14,.17,0],dark);
    const left=box(g,[.14,.6,.17],[-.34,.68,0],suit);left.rotation.z=-.25;
    const right=box(g,[.14,.6,.17],[.34,.68,0],suit);right.rotation.z=.25;
    box(g,[.14,.09,.028],[.08,.74,.265],neon(color));
    const halo=ring(g,.53,color,.019,.8);halo.position.y=.015;
    return {group:g,left,right,halo};
  }
  const fde=person(workplace,0,1.55,AMBER,1.15);
  const colleagues=[person(workplace,-2.35,.15,CYAN,.85),person(workplace,2.25,.4,CYAN,.85)];
  const desks=new T.Group();workplace.add(desks);
  for(const x of [-1.8,1.8]){
    box(desks,[1.1,.07,.7],[x,.75,-.5],dark);
    for(const dx of [-.44,.44])box(desks,[.045,.74,.045],[x+dx,.35,-.5],dark);
    const screen=box(desks,[.57,.4,.035],[x,1.03,-.65],neon(CYAN,.16));outline(screen,new T.BoxGeometry(.57,.4,.035),CYAN,.5);
  }
  const loosePositions=[[-2.5,1.8,.3],[-1.5,2.65,-.8],[.3,2.65,-.5],[2.2,2.1,-.7],[1.15,1.45,1.1],[-.55,1.5,1]];
  const arrangedPositions=[[-2.25,1.65,-.25],[-2.25,.86,-.25],[0,1.65,-.25],[0,.86,-.25],[2.25,1.65,-.25],[2.25,.86,-.25]];
  const cardNames=['注文メール','Excelへ転記','照合ルール','例外の条件','誰が承認？','確認待ち'];
  const cards=loosePositions.map((p,i)=>{
    const g=new T.Group();g.position.set(...p);documents.add(g);
    const card=box(g,[1.3,.58,.045],[0,0,0],neon(i>=4?AMBER:CYAN,.13));outline(card,new T.BoxGeometry(1.3,.58,.045),i>=4?AMBER:CYAN,.65);
    for(let k=0;k<2;k++)box(g,[.6-k*.17,.018,.018],[-.2,-.11-k*.09,.035],neon(i>=4?AMBER:CYAN,.48));
    g.rotation.z=(i%2?1:-1)*(.11+i*.025);return g;
  });
  const queue=new T.Group();workplace.add(queue);queue.position.set(2.42,0,.75);
  const queueItems=Array.from({length:7},(_,i)=>{
    const g=new T.Group();g.position.y=.1+i*.115;queue.add(g);
    const item=box(g,[.86,.075,.56],[0,0,0],neon(PINK,.17));
    outline(item,new T.BoxGeometry(.86,.075,.56),PINK,.72);
    return g;
  });
  const queueRing=ring(queue,.78,PINK,.026,.85);queueRing.rotation.x=Math.PI/2;queueRing.position.y=.03;
  const laneGuides=new T.Group();workplace.add(laneGuides);
  for(const x of [-2.25,0,2.25]){const r=box(laneGuides,[1.8,2.3,.015],[x,1.35,-.35],neon(CYAN,.025));outline(r,new T.BoxGeometry(1.8,2.3,.015),CYAN,.22);}

  // A second zoom level: the three columns become conceptual worlds.
  const dataCore=mesh(conceptData,new T.IcosahedronGeometry(.62,1),new T.MeshStandardMaterial({color:0x174c44,emissive:CYAN,emissiveIntensity:.35,metalness:.45,roughness:.25}),0,1.15,0);
  outline(dataCore,new T.IcosahedronGeometry(.62,1),CYAN,.9);
  const dataHalo=[ring(conceptData,1.15,CYAN,.016,.65),ring(conceptData,1.75,CYAN,.01,.35),ring(conceptData,2.35,CYAN,.008,.2)];
  dataHalo.forEach((r,i)=>{r.position.y=1.15;r.rotation.x=Math.PI/2+i*.42;r.rotation.z=i*.7;});
  const dataPositions=[[-2.4,1.7,.1],[-1.55,.35,.5],[-.95,2.65,-.15],[.8,2.65,.25],[1.65,.4,.4],[2.45,1.65,-.1],[-.2,.25,-1.25],[.25,2,-1.65]];
  const dataBits=dataPositions.map((p,i)=>{
    const g=new T.Group();g.position.set(...p);conceptData.add(g);
    const bit=box(g,[i%2?.72:.48,.28,.08],[0,0,0],neon(i===4?LIME:CYAN,.18));
    outline(bit,new T.BoxGeometry(i%2?.72:.48,.28,.08),i===4?LIME:CYAN,.72);
    return g;
  });
  const dataThreads=dataPositions.map(p=>link(conceptData,[p,[p[0]*.45,1.15,p[2]*.4],[0,1.15,0]],CYAN,.009));

  const decisionCore=mesh(conceptDecision,new T.OctahedronGeometry(.72),new T.MeshStandardMaterial({color:0x40551b,emissive:LIME,emissiveIntensity:.28,metalness:.5,roughness:.22}),0,1.2,0);
  outline(decisionCore,new T.OctahedronGeometry(.72),LIME,1);
  const decisionRing=ring(conceptDecision,1.22,LIME,.02,.8);decisionRing.position.y=1.2;decisionRing.rotation.x=.42;
  const autoGate=new T.Group(),humanGate=new T.Group();conceptDecision.add(autoGate,humanGate);autoGate.position.set(-2.25,1.2,0);humanGate.position.set(2.25,1.2,.2);
  for(const [gate,color] of [[autoGate,CYAN],[humanGate,AMBER]]){
    const frame=box(gate,[1.15,1.35,.1],[0,0,0],neon(color,.05));outline(frame,new T.BoxGeometry(1.15,1.35,.1),color,.9);
    ring(gate,.37,color,.016,.7);
  }
  const decisionIn=link(conceptDecision,[[0,3,0],[0,2.1,0],[0,1.2,0]],LIME,.024);
  const decisionAuto=link(conceptDecision,[[0,1.2,0],[-1.05,1.2,0],[-2.25,1.2,0]],CYAN,.026);
  const decisionHuman=link(conceptDecision,[[0,1.2,0],[1.05,1.2,.1],[2.25,1.2,.2]],AMBER,.026);

  const ownerPerson=person(conceptOwner,0,.1,AMBER,1.3);
  const ownerPeers=[person(conceptOwner,-2.25,.15,CYAN,.72),person(conceptOwner,2.25,.15,CYAN,.72)];
  const ownerRings=[ring(conceptOwner,.85,AMBER,.022,.8),ring(conceptOwner,1.65,LIME,.016,.6),ring(conceptOwner,2.55,CYAN,.012,.42)];
  ownerRings.forEach((r,i)=>{r.position.set(0,.05,.1);r.rotation.x=Math.PI/2;});
  const ownerLinks=[link(conceptOwner,[[-2.25,.75,.15],[-1.2,1,.1],[0,1,.1]],CYAN,.018),link(conceptOwner,[[0,1,.1],[1.2,1,.1],[2.25,.75,.15]],AMBER,.018)];

  const workflowPositions=[[-2.7,.6,-.3],[-.9,.6,-.3],[.9,.6,1.15],[2.7,.6,-.3]];
  const systemNodes=workflowPositions.map((p,i)=>{
    const g=new T.Group();g.position.set(...p);systems.add(g);
    box(g,[1.13,.42,.8],[0,-.22,0],dark);outline(g,new T.BoxGeometry(1.13,.42,.8),i===2?AMBER:CYAN,.7).position.y=-.22;
    const face=box(g,[.94,.56,.06],[0,.35,0],neon(i===2?AMBER:CYAN,.14));outline(face,new T.BoxGeometry(.94,.56,.06),i===2?AMBER:CYAN,.85);
    for(let j=0;j<3;j++)box(g,[.5-j*.1,.025,.015],[-.12,.48-j*.12,.045],neon(i===2?AMBER:CYAN,.65));
    return g;
  });
  plate(systems,7.4,4.8,0,.1,LIME);scanBar(systems,7.4,4.8,.1,LIME,.6);
  plate(conceptData,6.4,4.4,0,0,CYAN);scanBar(conceptData,6.4,4.4,0,CYAN,.15);
  plate(conceptDecision,6.4,4.4,0,0,LIME);scanBar(conceptDecision,6.4,4.4,0,LIME,.5);
  plate(conceptOwner,6.4,4.4,0,0,AMBER);scanBar(conceptOwner,6.4,4.4,0,AMBER,.8);
  // The one person inside the system layer is the reviewer at "人の確認"; FDE stays on the field floor.
  const reviewer=person(systems,1.85,1.9,CYAN,.6);reviewer.group.position.y=-.42;
  const routeIn=link(systems,[[-2.7,.65,-.3],[-1.8,.65,-.3],[-.9,.65,-.3]],CYAN,.025);
  const routeReview=link(systems,[[-.9,.65,-.3],[-.1,.65,.9],[.9,.65,1.15]],AMBER,.025);
  const routeApproved=link(systems,[[.9,.65,1.15],[2,.65,.8],[2.7,.65,-.3]],LIME,.025);
  const routeNormal=link(systems,[[-.9,.65,-.3],[.6,.65,-1.2],[2.7,.65,-.3]],CYAN,.013);
  const allRoutes=[routeIn,routeReview,routeApproved,routeNormal];
  allRoutes.forEach(c=>c.packets.forEach(p=>p.visible=false));
  routeNormal.tube.material.opacity=.23;
  const order=mesh(systems,new T.BoxGeometry(.18,.18,.18),neon(LIME));
  const exceptionRing=ring(systems,.65,AMBER,.03,.8);exceptionRing.position.set(.9,.08,1.15);
  const sharedCore=processor(sharedGroup,0,.6,-1.3,.8,LIME);
  const enterprisePaths=[[-5,-2.5],[5,-2.5],[5,2.6]].map(([x,z])=>link(sharedGroup,[[0,.45,-1.3],[x*.45,.65,z*.45],[x,.55,z]],LIME,.028));
  const sharedParts=[[-5,-2.5],[5,-2.5],[5,2.6]].map(([x,z])=>{
    const g=new T.Group();g.position.set(x,.62,z);sharedGroup.add(g);
    const part=box(g,[.62,.44,.62],[0,0,0],neon(LIME,.17));
    outline(part,new T.BoxGeometry(.62,.44,.62),LIME,.9);
    return g;
  });
  const aiHelpers=[processor(aiGroup,-.9,2.5,-.3,.36,CYAN),processor(aiGroup,1.1,2.5,-.3,.36,CYAN)];
  const aiPaths=[link(aiGroup,[[-.9,2.3,-.3],[-.9,1.5,-.3],[-.9,.65,-.3]],CYAN,.012),link(aiGroup,[[1.1,2.3,-.3],[1.7,1.5,-.3],[2.7,.65,-.3]],CYAN,.012)];

  root.traverse(object=>{
    if(!object.isMesh||!object.material||!object.material.isMeshStandardMaterial)return;
    object.castShadow=!floors.includes(object);
  });
  floors.forEach(floor=>{floor.receiveShadow=true;floor.castShadow=false;});

  // Capture original opacity once, before parent/child fades can multiply it.
  root.traverse(o=>{if(o.material){o.userData.baseOpacity=o.material.opacity;o.userData.baseDepthWrite=o.material.depthWrite;o.material.transparent=true;}});

  let width=innerWidth,height=innerHeight,mobile=width<=760;
  let modelWidth=width*.4;
  function resize(){
    width=innerWidth;height=innerHeight;mobile=width<=760;
    const left=mobile?96:width*.49+140,right=width-(mobile?16:35);
    modelWidth=(right-left)*.86;
    renderer.setSize(width,height);composer.setSize(width,height);camera.aspect=width/height;
    skyMaterial.uniforms.uRes.value.set(width,height);grade.uniforms.uRes.value.set(width,height);
    skyMaterial.uniforms.uMobile.value=mobile?1:0;
    camera.setViewOffset(width,height,width*.5-(left+right)*.5,mobile?height*.245:height*.025,width,height);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize',resize);resize();
  const scopes=['management','field','design','data','decision','owner','system','field','management','system'];
  const scopeNames=['経営レイヤー','受注現場','業務設計','概念 / データ','概念 / 判断','概念 / 担当','動くシステム','現場と成果','経営へ戻す','人とAIの分担'];
  const weights=Array.from({length:scopes.length},(_,i)=>i===state.chapter?1:0);
  let fromWeights=[...weights],targetChapter=state.chapter,transitionElapsed=1.3,travelDirection=1;
  // Separate label banks let outgoing labels leave with their own geometry.
  const tagBanks=scopes.map((_,chapter)=>chapter===0?tags:tags.map(()=>{
    const tag=document.createElement('span');tags[0].parentElement.append(tag);return tag;
  }));
  const conceptGroups=[conceptData,conceptDecision,conceptOwner];
  let cameraAzimuth=2.15;
  let assemblyTime=0,staging=0;
  let last=0,lastDraw=0,t=0,inView=true,fieldZoom=0,conceptZoom=0,organization=0,systemization=0,spread=0,help=0;
  const cameraTarget=new T.Vector3(0,.7,0),actorTarget=new T.Vector3();
  const projected=new T.Vector3();
  new IntersectionObserver(entries=>inView=entries[0].isIntersecting,{rootMargin:'50px'}).observe(document.querySelector('#experience'));
  function projectedLabel(text,position,accent='cyan',world=false){return {text,position,accent,world};}
  const wideLabels=()=>[
    projectedLabel('経営レイヤー',[0,5.9+LAYER_Y.management,-2.2]),
    projectedLabel('営業',[-5,3.4+LAYER_Y.management,-2.5]),
    projectedLabel('経理',[5,3.1+LAYER_Y.management,-2.5]),
    projectedLabel('受注現場',[0,.2,2.55],'amber'),
    projectedLabel('FDE',[fde.group.position.x,fde.group.position.y+2.2,fde.group.position.z],'amber')
  ];
  function labelsFor(chapter){
    if(chapter===0||chapter===8)return chapter===8&&state.shared?
      [...wideLabels().slice(0,4),projectedLabel('再利用できる部品',[0,2,-1.3],'lime')]:wideLabels();
    const actorLabels=[projectedLabel('FDE',[fde.group.position.x,fde.group.position.y+.12,fde.group.position.z+.65],'amber')];
    if(chapter===1)return [...actorLabels,projectedLabel('ボトルネック',[2.42,1.82,.75],'pink',true),...cards.map((card,i)=>projectedLabel(cardNames[i],card.position.toArray(),i>=4?'amber':'cyan'))];
    if(chapter===2){
      if(organization<.65)return [...actorLabels,...cards.map((card,i)=>projectedLabel(cardNames[i],card.position.toArray(),i>=4?'amber':'cyan'))];
      return [...actorLabels,projectedLabel('入力 / データ',[-2.25,2.45,-.25]),projectedLabel('判断 / ルール',[0,2.45,-.25],'lime'),projectedLabel('担当 / 責任',[2.25,2.45,-.25],'amber'),...cards.map((card,i)=>projectedLabel(cardNames[i],card.position.toArray(),i>=4?'amber':'cyan'))];
    }
    if(chapter===3)return [projectedLabel('注文番号',[-2.4,2.1,.1]),projectedLabel('取引先',[-.95,3.05,-.15]),projectedLabel('金額',[.8,3.05,.25],'lime'),projectedLabel('納期',[2.45,2.05,-.1]),projectedLabel('判断に必要な事実',[0,1.15,0],'cyan')];
    if(chapter===4)return [projectedLabel('入力された事実',[0,3.35,0]),projectedLabel('条件に一致？',[0,1.2,0],'lime'),projectedLabel('自動で進む',[-2.25,2.1,0]),projectedLabel('人に戻す',[2.25,2.1,.2],'amber')];
    if(chapter===5)return [projectedLabel('実行',[-2.25,1.45,.15]),projectedLabel('確認',[0,2.35,.1],'amber'),projectedLabel('承認',[2.25,1.45,.15]),projectedLabel('誰が引き受ける？',[0,.05,2.55],'lime')];
    if(chapter===7)return [...actorLabels,projectedLabel('課題・優先順位',[-2.3,1.65,-.5],'amber'),projectedLabel('本番での成果',[0,2,-.5],'lime'),projectedLabel('学びを残す',[2.3,1.65,-.5])];
    return [...actorLabels,projectedLabel(systemization>.6?'ボトルネック解消':'ボトルネック',[2.42,1.82,.75],systemization>.6?'lime':'pink',true),...workflowPositions.map((p,i)=>projectedLabel(['取込','照合','人の確認','登録'][i],[p[0],p[1]+.92,p[2]],i===2?'amber':'cyan')),projectedLabel(chapter===9&&state.ai?'AIが構造化・実装を支援':mobile?'条件一致 → 自動登録':'条件一致なら、自動登録',[.8,chapter===9&&state.ai?3.05:2.6,-1.6])];
  }
  function frame(now){
    requestAnimationFrame(frame);
    const dt=Math.min((now-last)/1000||.016,.05);last=now;
    if(!inView||document.hidden)return;if(state.reduced&&now-lastDraw<100)return;lastDraw=now;
    if(!state.reduced)t+=dt;
    const c=state.chapter,dampDt=state.reduced?1:dt;
    if(c!==targetChapter){
      fromWeights=[...weights];travelDirection=Math.sign(c-targetChapter);targetChapter=c;transitionElapsed=0;
    }
    transitionElapsed=state.reduced?1.3:Math.min(1.3,transitionElapsed+dt);
    const u=transitionElapsed/1.3;
    const eased=u*u*u*(u*(u*6-15)+10);
    weights.forEach((_,i)=>weights[i]=T.MathUtils.lerp(fromWeights[i],i===c?1:0,eased));
    const wideWeight=weights[0]+weights[8];
    fieldZoom=1-wideWeight;
    conceptZoom=weights[3]+weights[4]+weights[5];
    const laterWeight=weights.slice(3).reduce((a,b)=>a+b,0);
    const organizedChoice=state.field||(!state.choiceMade&&c===2&&state.progress>.5);
    organization=state.reduced?(laterWeight+weights[2]*Number(organizedChoice)):T.MathUtils.damp(organization,laterWeight+weights[2]*Number(organizedChoice),4,dampDt);
    systemization=weights.slice(6).reduce((a,b)=>a+b,0);
    spread=T.MathUtils.damp(spread,weights[8]*Number(state.shared),4,dampDt);
    help=T.MathUtils.damp(help,weights[9]*Number(state.ai),4,dampDt);
    conceptGroups.forEach((group,i)=>{
      const weight=weights[i+3];
      // Incoming concepts grow from depth; outgoing concepts pass the camera.
      const offset=state.reduced?0:(1-weight)*(i+3===c?-1:1)*travelDirection;
      const scale=1+offset*.18;
      const smoothScale=state.reduced?scale:T.MathUtils.damp(group.scale.x,scale,7,dt);
      group.scale.setScalar(smoothScale);
      group.position.y=conceptBaseY[i]+1.2*(1-smoothScale);
      group.position.z=state.reduced?offset*.65:T.MathUtils.damp(group.position.z,offset*.65,7,dt);
    });
    systems.scale.setScalar(.82+systemization*.18);
    documents.scale.setScalar(1+conceptZoom*.16);

    // The camera changes distance inside one shared world; the office is not a replacement scene.
    const halfWidth=T.MathUtils.lerp(T.MathUtils.lerp(7.65,3.85,fieldZoom),2.55,conceptZoom);
    const availableAspect=modelWidth/height;
    const distance=halfWidth/(Math.tan(T.MathUtils.degToRad(camera.fov/2))*availableAspect);
    // Keep legibility consistent across the enterprise/field camera distances.
    scene.fog.density=fogK/distance;
    // The opening builds itself like a city: floor, floor, floor, then the towers, then the wiring.
    assemblyTime=state.chapter>0?ASSEMBLY:Math.min(ASSEMBLY,assemblyTime+dt);
    const assembly=state.reduced?1:assemblyTime/ASSEMBLY;
    const arrivals=layerOrder.map((_,i)=>T.MathUtils.clamp((assembly-i*.13)/.3,0,1));
    const arrivalOf=name=>arrivals[layerOrder.indexOf(name)];
    const wiring=T.MathUtils.clamp((assembly-.54)/.34,0,1);
    const staffed=T.MathUtils.clamp((assembly-.8)/.2,0,1);
    buildings.forEach((tower,i)=>{
      const grown=T.MathUtils.clamp((assembly-.28-i*.045)/.26,0,1);
      tower.scale.y=.02+grown*.98;
    });
    const altitude=weights.reduce((sum,weight,i)=>sum+weight*LAYER_Y[chapterLayers[i]],0);
    const desiredTarget=new T.Vector3(0,altitude+T.MathUtils.lerp(T.MathUtils.lerp(.6,1.12,fieldZoom),1.25,conceptZoom),T.MathUtils.lerp(.15,0,conceptZoom));
    cameraTarget.lerp(desiredTarget,state.reduced?1:1-Math.exp(-dt*4));
    const desiredAzimuth=2.15+(state.reduced?0:(state.progress-.5)*.45)+weights[3]*.16-weights[4]*.2;
    cameraAzimuth=state.reduced?desiredAzimuth:T.MathUtils.damp(cameraAzimuth,desiredAzimuth,3,dt);
    const direction=new T.Vector3(cameraAzimuth,5.3,11).normalize();
    camera.position.copy(cameraTarget).addScaledVector(direction,distance);
    camera.lookAt(cameraTarget);camera.updateMatrixWorld();
    const sunAngle=.55+state.progress*1.65;
    key.position.set(Math.cos(sunAngle)*5.2,altitude+6.4,Math.sin(sunAngle)*4.6+1.2);
    key.target.position.set(0,altitude,0);key.target.updateMatrixWorld();
    sky.position.copy(camera.position);
    skyMaterial.uniforms.uTime.value=grade.uniforms.uTime.value=t;
    // Scroll speed lifts the picture slightly, the way the reference pages react to velocity.
    const speed=Math.min(1,Math.abs(state.progress-lastProgress)/Math.max(dt,.001)*.6);lastProgress=state.progress;
    scrollLift=T.MathUtils.damp(scrollLift,state.reduced?0:speed,6,dampDt);
    grade.uniforms.uLift.value=scrollLift*.16;
    // The blobs take the colour of the layer in view, blended across the transition.
    accentA.setRGB(0,0,0);accentB.setRGB(0,0,0);
    weights.forEach((weight,i)=>{
      if(weight<=.001)return;
      accentA.add(tempColor.set(LAYER_ACCENT[chapterLayers[i]]).multiplyScalar(weight));
      accentB.add(tempColor.set(i>=3&&i<=5?LIME:AMBER).multiplyScalar(weight));
    });
    skyMaterial.uniforms.uAccentA.value.copy(accentA);skyMaterial.uniforms.uAccentB.value.copy(accentB);
    plexusPoints.material.uniforms.uTime.value=plexusLinks.material.uniforms.uTime.value=streams.material.uniforms.uTime.value=t;
    halos.forEach(halo=>halo.quaternion.copy(camera.quaternion));
    streams.material.uniforms.uOpacity.value=streamOpacity*T.MathUtils.smoothstep(halfWidth,3.2,6.4);
    dust.position.set(cameraTarget.x,altitude+1.5,cameraTarget.z);dust.material.uniforms.uTime.value=t;
    streaks.position.set(cameraTarget.x,cameraTarget.y,cameraTarget.z);streaks.material.uniforms.uTime.value=t*3;
    streaks.material.uniforms.uDrift.value=-travelDirection*(1-u)*5;
    streaks.material.uniforms.uOpacity.value=state.reduced?0:Math.sin(u*Math.PI)*.9;
    scanBars.forEach(({bar,d,z0,phase})=>{bar.position.z=z0-d/2+((state.reduced?phase:(t*.075+phase))%1)*d;});

    const workingWeight=weights[6]+weights[7]+weights[9];
    actorTarget.set(-1.05*weights[1]-1.65*workingWeight,0,1.55+.35*workingWeight);
    fde.group.position.lerp(actorTarget,state.reduced?1:1-Math.exp(-dt*3));
    fde.group.scale.setScalar(1.15*staffed);
    colleagues.forEach(colleague=>colleague.group.scale.setScalar(.85*staffed));
    fde.right.rotation.z=.25+weights[2]*.65;
    fde.right.rotation.x=weights[2]*-.6;
    fde.group.rotation.y=-.3*weights[1]+.12*weights[2];
    fde.halo.userData.baseOpacity=.7+(state.reduced?0:Math.sin(t*1.5)*.15);
    colleagues[1].group.position.set(2.25-1.3*systemization,0,.4+1.9*systemization);
    cards.forEach((card,i)=>{
      const loose=new T.Vector3(...loosePositions[i]),arranged=new T.Vector3(...arrangedPositions[i]);
      if(!state.reduced){loose.y+=Math.sin(t*.7+i)*.08;loose.x+=Math.cos(t*.4+i)*.06;}
      card.position.copy(loose.lerp(arranged,organization));
      card.rotation.z=(i%2?1:-1)*(.11+i*.025)*(1-organization);
    });
    // 取込 → 照合 → 人の確認 → 登録。Each station rises, then its line reaches the next one:
    // the design does not appear all at once, it becomes the system step by step.
    // Slower than the 1.3s chapter cross-fade: four steps need time to be read as four steps.
    staging=state.reduced?systemization:T.MathUtils.damp(staging,systemization,1.9,dampDt);
    const step=(from,to)=>T.MathUtils.clamp((staging-from)/(to-from),0,1);
    const stations=[step(0,.18),step(.28,.46),step(.55,.72),step(.8,1)];
    const cleared=T.MathUtils.clamp(systemization,0,1);
    queueItems.forEach((item,i)=>{
      const drained=T.MathUtils.clamp((cleared-(queueItems.length-1-i)*.1)/.32,0,1);
      item.scale.setScalar(1-drained*.96);
      item.position.y=.1+i*.115-drained*.1+(state.reduced?0:Math.sin(t*1.4+i*.8)*.012);
    });
    queueRing.material.color.setHex(cleared>.55?LIME:PINK);
    queueRing.userData.baseOpacity=state.reduced?.8:.45+Math.sin(t*(cleared>.55?1.2:3.1))*.3;
    systemNodes.forEach((node,i)=>{
      node.scale.setScalar(.12+stations[i]*.88);
      node.position.y=workflowPositions[i][1]-(1-stations[i])*.55;
    });
    draw(routeIn,step(.15,.33));
    draw(routeReview,step(.42,.6));
    draw(routeApproved,step(.68,.86));
    draw(routeNormal,step(.86,1));
    dataCore.rotation.y+=state.reduced?0:dt*.42;dataCore.rotation.x+=state.reduced?0:dt*.18;
    dataBits.forEach((bit,i)=>{if(!state.reduced){bit.rotation.y=t*.35+i*.4;bit.position.y=dataPositions[i][1]+Math.sin(t*.8+i)*.09;}});
    dataThreads.forEach((connection,i)=>flow(connection,t,weights[3],.08+i*.006,i===4?LIME:CYAN));
    decisionCore.rotation.y+=state.reduced?0:dt*.5;
    flow(decisionIn,t,weights[4],.12,LIME);flow(decisionAuto,t,weights[4],.16,CYAN);flow(decisionHuman,t,weights[4],.13,AMBER);
    ownerPerson.right.rotation.z=.7;ownerPerson.right.rotation.x=-.4;
    ownerLinks.forEach((connection,i)=>flow(connection,t,weights[5],.11+i*.025,i?AMBER:CYAN));
    ownerRings.forEach((r,i)=>{if(!state.reduced)r.rotation.z+=(i%2?1:-1)*dt*(.08+i*.025);});
    order.visible=state.orderPhase!=='idle';
    const progress=state.orderProgress||0;
    if(state.orderPhase==='running'){
      order.position.copy((progress<.5?routeIn:routeReview).curve.getPoint(progress<.5?progress*2:(progress-.5)*2));
    }else if(state.orderPhase==='review')order.position.set(.9,.84,1.15);
    else if(state.orderPhase==='approved')order.position.copy(routeApproved.curve.getPoint(progress));
    else if(state.orderPhase==='done')order.position.set(2.7,.9,-.3);
    exceptionRing.userData.baseOpacity=state.orderPhase==='review'?(state.reduced?.9:.6+Math.sin(t*4)*.25):.2;
    enterprisePaths.forEach((connection,i)=>{
      const reach=T.MathUtils.clamp((spread-i*.16)/.5,0,1);
      draw(connection,reach);
      flow(connection,t,reach,.13+i*.01,LIME);
      sharedParts[i].scale.setScalar(T.MathUtils.clamp((reach-.75)/.25,0,1));
    });
    aiPaths.forEach(connection=>flow(connection,t,help,.2,CYAN));
    // Fade after animated materials update, so glowing packets cannot escape the transition.
    const wide=T.MathUtils.smoothstep(halfWidth,3.4,6.6);
    layerGrids.forEach(layer=>{
      const near=1-Math.min(1,Math.abs(altitude-layer.y)/5.4);
      const arrived=arrivalOf(layer.name);
      const drop=(1-arrived)*-2.6;
      layer.sheet.position.y=layer.y-.3+drop;
      layer.edge.position.y=layer.y-.32+drop;
      layer.sheet.material.uniforms.uOpacity.value=(.13+near*.42)*(.45+.55*wide)*arrived*sheetGain;
      layer.edge.material.opacity=(.06+near*.34)*(.35+.65*wide)*arrived;
    });
    columns.children.forEach(column=>column.material.opacity=.1*wide*arrivals[3]);
    const bonded=wiring*(.3+.7*wide);
    bonds.forEach((bond,i)=>flow(bond,t,bonded,.1+i%3*.02,i%2?LIME:CYAN));
    opacity(bondGroup,bonded);
    opacity(company,wideWeight*arrivalOf('management'));
    opacity(workplace,(1-conceptZoom)*arrivalOf('field'));
    opacity(desks,(1-conceptZoom)*(1-systemization));
    opacity(laneGuides,(1-conceptZoom)*organization*(1-systemization));
    opacity(documents,(1-systemization)*(1-conceptZoom)*arrivalOf('field'));
    opacity(queue,Math.min(1,weights[1]+weights[2]+weights[6]+weights[7]+weights[9])*(1-conceptZoom));
    opacity(systems,systemization*(1-wideWeight*.75));
    conceptGroups.forEach((group,i)=>opacity(group,weights[i+3]));
    opacity(sharedGroup,weights[8]);opacity(aiGroup,help);
    root.updateMatrixWorld(true);
    tagBanks.forEach((bank,chapter)=>{
      // A quiet midpoint prevents two sets of labels competing during the dissolve.
      const labelOpacity=T.MathUtils.smoothstep(weights[chapter],.35,.9);
      const labels=labelOpacity>.001?labelsFor(chapter):[];
      labels.forEach((label,i)=>{
        projected.set(...label.position);
        if(label.world){/* already in world space */}
        else if(chapter>=3&&chapter<=5)conceptGroups[chapter-3].localToWorld(projected);
        else if(chapter===1||chapter===2){if(i>0)documents.localToWorld(projected);}
        else if(chapter===6||chapter===9){if(i>0)systems.localToWorld(projected);}
        projected.project(camera);
        const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
        bank[i].textContent=label.text;bank[i].dataset.accent=label.accent;
        const focused=focus&&label.text===focus;
        bank[i].dataset.focus=focused?'true':'false';
        bank[i].style.left=Math.max(65,Math.min(width-65,x))+'px';bank[i].style.top=y+'px';
        bank[i].style.opacity=y>95&&y<height*(mobile?.395:.78)?String(labelOpacity*(focus&&label.text!==focus?.25:1)):'0';
      });
      for(let i=labels.length;i<bank.length;i++)bank[i].style.opacity=0;
    });
    document.querySelector('#zoom-readout').textContent=scopeNames[c];
    composer.render();document.documentElement.dataset.rendered='true';document.documentElement.dataset.scene=String(c);
    canvas.dataset.cameraDistance=distance.toFixed(2);canvas.dataset.organized=organization>.9?'true':'false';canvas.dataset.scope=scopes[c];
    canvas.dataset.assembly=assembly.toFixed(3);canvas.dataset.transition=u.toFixed(3);canvas.dataset.sceneWeights=weights.map(w=>w.toFixed(3)).join(',');
  }
  const LAYER_ACCENT={management:CYAN,field:AMBER,system:LIME,data:CYAN};
  const accentA=new T.Color(),accentB=new T.Color(),tempColor=new T.Color();
  let fogK=.55,look='cyber',streamOpacity=.55,lastProgress=0,scrollLift=0,focus=null,sheetGain=1;
  function setLook(name){
    const L=LOOKS[name]||LOOKS.cyber;look=name in LOOKS?name:'cyber';
    renderer.setClearColor(new T.Color(L.bg).multiplyScalar(L.bgScale));
    scene.fog.color.set(L.fog).multiplyScalar(L.fogScale);fogK=L.fogK;
    renderer.toneMappingExposure=L.exposure;
    bloom.strength=L.bloom[0];bloom.radius=L.bloom[1];bloom.threshold=L.bloom[2];
    scene.environmentIntensity=L.env;
    hemi.color.set(L.hemi[0]);hemi.groundColor.set(L.hemi[1]);hemi.intensity=L.hemi[2];
    key.color.set(L.key[0]);key.intensity=L.key[1];
    dark.color.set(L.dark);black.color.set(L.black);buildingMats.forEach(m=>m.color.set(L.building));
    layerGrids.forEach(layer=>{
      layer.sheet.material.uniforms.uColor.value.set(look==='ash'?0x4a4438:layer.accent);
      layer.sheet.material.blending=look==='ash'?T.NormalBlending:T.AdditiveBlending;
      layer.sheet.material.needsUpdate=true;
    });
    sheetGain=look==='ash'?1.5:1;
    skyMaterial.uniforms.uBottom.value.set(L.sky[0]);skyMaterial.uniforms.uHorizon.value.set(L.sky[1]);skyMaterial.uniforms.uTop.value.set(L.sky[2]);
    skyMaterial.uniforms.uBlob.value=look==='ash'?.46:.55;
    skyMaterial.uniforms.uAccentMix.value=look==='ash'?.55:1;
    grade.uniforms.uGrain.value=L.grade[0];grade.uniforms.uChroma.value=L.grade[1];grade.uniforms.uVignette.value=L.grade[2];
    for(const points of [dust,streaks]){
      points.material.uniforms.uColor.value.set(L.dust);
      points.material.blending=L.additive?T.AdditiveBlending:T.NormalBlending;points.material.needsUpdate=true;
    }
    dust.material.uniforms.uOpacity.value=L.dustOpacity;
    for(const object of [plexusPoints,plexusLinks]){object.material.uniforms.uColor.value.set(L.plexus[0]);object.material.uniforms.uOpacity.value=L.plexus[1];object.material.blending=L.additive?T.AdditiveBlending:T.NormalBlending;object.material.needsUpdate=true;}
    halos.forEach((halo,i)=>{halo.material.color.set(L.glow[i][0]);halo.material.opacity=L.glow[i][1];halo.visible=L.glow[i][1]>0;});
    streams.material.uniforms.uColor.value.set(L.stream[0]);streamOpacity=L.stream[1];
    canvas.dataset.look=look;
  }
  setLook('cyber');
  requestAnimationFrame(frame);
  return {setLook, setFocus(text){focus=text||null;}};
}
