import './cyber.css';
import { createCosmos } from './scene-layers.js';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const chapters = [...document.querySelectorAll('.chapter')];
const workflowStages=['understand','understand','organize','design','design','design','build','build','spread','spread'];
const viewLayers=['management','field','field','data','system','system','system','field','management','system'];
// The reference pages put the chapter名 on the canvas as large type, not inside the column.
const stageTitles=chapters.map((section,i)=>{
  if(i===0)return '';   // the hero already carries its own title in the column
  const eyebrow=section.querySelector('.eyebrow');
  return eyebrow?eyebrow.textContent.replace(/^\s*\d+\s*\/\s*/,'').trim():'';
});
function updateNavigation(index){
  dissolveText(document.querySelector('#stage-title'),stageTitles[index]||'');
  for(const [selector,attribute,value] of [['[data-workflow]','workflow',workflowStages[index]],['[data-view-layer]','viewLayer',viewLayers[index]]]){
    document.querySelectorAll(selector).forEach(link=>{
      const active=link.dataset[attribute]===value;
      link.classList.toggle('active',active);
      if(active)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');
    });
  }
}
const labels = ['MANAGEMENT / WIDE VIEW','FIELD / PEOPLE & WORK','DESIGN / DATA · RULE · OWNER','CONCEPT / DATA','CONCEPT / DECISION','CONCEPT / OWNER','SYSTEM / RUN & REVIEW','DECISION · IMPACT · REUSE','MANAGEMENT / LEARNING LOOP','HUMAN × AI'];
const state = { chapter:0, progress:0, reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, deployed:false, field:false, choiceMade:false, shared:false, ai:false, inspection:-1, orderPhase:'idle', orderProgress:0 };
let playing=false,playbackScroll=0,playbackStarted=0;
const lenis=matchMedia('(prefers-reduced-motion: reduce)').matches?null:new Lenis({
  duration:1.05, wheelMultiplier:.9, touchMultiplier:1.4, anchors:{offset:-100},
});
// Native smooth scrolling fights the inertia; Lenis owns it while it is on.
if(lenis)document.documentElement.style.scrollBehavior='auto';
function scrollToTop(top){
  if(lenis)lenis.scrollTo(top,{immediate:true,force:true});
  else scrollTo({top,behavior:'instant'});
}
let cosmos=null;   // assigned below; stop() can run before that when motion is reduced
let narration=null,narrationAudio=null,narrationLine=-1,scripted=false;
const textTransitions=new WeakMap();
function dissolveText(element,text){
  const previous=textTransitions.get(element);
  if(state.reduced){previous?.animation?.cancel();element.textContent=text;textTransitions.delete(element);return;}
  if(previous?.text===text||(!previous&&element.textContent===text))return;
  const opacity=getComputedStyle(element).opacity;
  previous?.animation?.cancel();
  const transition={text};textTransitions.set(element,transition);
  transition.animation=element.animate([{opacity},{opacity:0,transform:'translateY(-4px)'}],{duration:180,easing:'ease-out',fill:'forwards'});
  transition.animation.finished.then(()=>{
    if(textTransitions.get(element)!==transition)return;
    element.textContent=text;transition.animation.cancel();
    transition.animation=element.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:550,easing:'cubic-bezier(.2,.7,.2,1)'});
  }).catch(()=>{});
}
function updateDiagram(){
  if(playing&&narration&&narrationLine>=0){
    dissolveText(document.querySelector('#diagram-caption'),narration.lines[narrationLine].text);
    return;
  }
  const captions=[
    '経営が抱える課題を、具体的な現場から解く。オレンジの人物がFDE。',
    'FDEが担当者と仕事をたどる。困りごとの奥にある業務と判断を見つける。',
    state.field||(!state.choiceMade&&state.progress>.5)?'入力・判断・担当を整理する。この構造が、システムの設計になる。':'情報が散らばったままでは、何をシステムにするか決められない。',
    '概念の内側へ。メールを、注文番号・取引先・金額・納期という事実に分解する。',
    '事実に条件を通す。一致なら自動、不一致なら人へ。判断を分岐として設計する。',
    '例外を誰に返すか。実行・確認・承認の責任を、人のまわりに配置する。',
    state.orderPhase==='review'?'金額の不一致を検出。自動登録せず、業務担当者の確認で止まる。':state.orderPhase==='done'?'人が確認した注文を登録。整理したルールと役割が、実際の処理になった。':'取込 → 照合 → 例外は人の確認 → 登録。業務の設計を、そのまま処理へ。',
    ['課題・技術・優先順位を、どこまで決められる？','本番での利用と業務の変化まで、追う？','現場の解決を、共通部品や製品へ戻せる？'][state.inspection]||'裁量・責任・再利用。3つの問いで、仕事の実態を見る。',
    state.shared?'受注現場の学びを共通化し、他部署へ。現場の解決が、経営の成果になる。':'経営レイヤーへ戻る。一つの現場の解決を、他でも活かせるか。',
    state.ai?'FDEが任せる範囲を設計し、AIが構造化・実装を支援。業務担当と結果を確かめる。':'現場理解・構造化・実装・検収・定着。仕組みをつくるだけでなく、使われるまで。'
  ];
  dissolveText(document.querySelector('#diagram-caption'),captions[state.chapter]);
}
function setDeployed(value){
  state.deployed=value;
  document.querySelector('#question').scrollIntoView({behavior:state.reduced?'instant':'smooth'});
}
document.querySelector('#deploy-button').onclick=()=>setDeployed(!state.deployed);
const nav = document.querySelector('.chapter-nav');
nav.innerHTML = chapters.map((section,i)=>`<a href="#${section.id}" aria-label="${i}章 ${section.querySelector('h1,h2').textContent}">0${i}</a>`).join('');
let bounds=[];
function measure(){bounds=chapters.map(el=>({top:el.getBoundingClientRect().top+scrollY,height:el.offsetHeight}));update();}
function update(){
  const probe=scrollY+innerHeight*.43;
  let index=0;
  bounds.forEach((b,i)=>{if(probe>=b.top)index=i;});
  state.chapter=index;
  updateNavigation(index);
  state.progress=Math.max(0,Math.min(1,(probe-bounds[index].top)/bounds[index].height));
  nav.querySelectorAll('a').forEach((a,i)=>{a.classList.toggle('active',i===index);i===index?a.setAttribute('aria-current','step'):a.removeAttribute('aria-current');});
  dissolveText(document.querySelector('#scene-label'),labels[index]);
  document.querySelector('#progress-fill').style.width=`${scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)*100}%`;
  document.documentElement.dataset.chapter=String(index);
  updateDiagram();
}
addEventListener('scroll',update,{passive:true});addEventListener('resize',measure);new ResizeObserver(measure).observe(document.querySelector('#experience'));measure();
document.fonts.ready.then(measure);
// Narrated walkthrough: the audio is the clock. Every line names one thing, and the page
// answers it — scroll to its chapter, run its beat, light that label — so the words and the
// picture never describe different things.

const chapterSpan=new Map();
fetch('./narration/narration.json').then(response=>response.ok?response.json():null).then(data=>{
  if(!data)return;
  narration=data;
  data.lines.forEach(line=>{
    const span=chapterSpan.get(line.chapter)||{start:line.start,end:line.end};
    span.end=line.end;chapterSpan.set(line.chapter,span);
  });
  narrationAudio=new Audio(data.audio);
  narrationAudio.preload='metadata';
  narrationAudio.hidden=true;document.body.append(narrationAudio);
  narrationAudio.addEventListener('ended',()=>stop());
  const note=document.querySelector('#play-note');
  if(note)note.textContent=`音声つき / ${Math.floor(data.duration/60)}分${String(Math.round(data.duration%60)).padStart(2,'0')}秒`;
}).catch(()=>{});
function applyBeat(beat){
  if(!beat)return;
  scripted=true;
  const press=selector=>{const element=document.querySelector(selector);if(element)element.click();};
  if(beat==='organize'){if(!state.field)press('[data-choice="field"]');}
  else if(beat==='order-run'){if(state.orderPhase!=='running')setOrderPhase('running');}
  else if(beat==='order-approve'){if(state.orderPhase==='review')setOrderPhase('approved');}
  else if(beat.startsWith('inspect-')){
    const button=document.querySelector(`[data-inspect="${beat.slice(8)}"]`);
    if(button&&button.getAttribute('aria-expanded')!=='true')button.click();
  }
  else if(beat==='shared'){if(!state.shared)press('#reuse-button');}
  else if(beat==='ai'){if(!state.ai)press('[data-ai="1"]');}
  else if(beat==='stages'){
    // The line names the five stages; the nav at the top of the page is those five stages.
    const stages=[...document.querySelectorAll('[data-workflow]')];
    stages.forEach((stage,i)=>setTimeout(()=>{
      if(!playing)return;
      stages.forEach(other=>other.classList.remove('spoken'));
      stage.classList.add('spoken');
      if(i===stages.length-1)setTimeout(()=>stage.classList.remove('spoken'),700);
    },i*460));
  }
  scripted=false;
}
function speakLine(index){
  narrationLine=index;
  const line=narration.lines[index];
  cosmos?.setFocus(line.focus);
  applyBeat(line.beat);
  dissolveText(document.querySelector('#diagram-caption'),line.text);
}
function stop(){playing=false;
  if(narrationAudio){narrationAudio.pause();narrationAudio.currentTime=0;}
  narrationLine=-1;cosmos?.setFocus(null);
  document.querySelectorAll('[data-workflow].spoken').forEach(stage=>stage.classList.remove('spoken'));
  requestAnimationFrame(updateDiagram);document.querySelector('#stop-play').hidden=true;document.querySelector('#autoplay').setAttribute('aria-pressed','false');document.querySelector('#autoplay').innerHTML='<span>▷</span> 映像として見る';document.querySelector('#scene-state').textContent='EXPLORING';}
function setMotion(reduced){state.reduced=reduced;document.documentElement.classList.toggle('reduce-motion',reduced);const button=document.querySelector('#motion');button.setAttribute('aria-pressed',String(reduced));button.textContent=reduced?'MOTION OFF':'MOTION ON';button.title=reduced?'動きを戻す':'動きを抑える';if(reduced)stop();}
setMotion(state.reduced);document.querySelector('#motion').onclick=()=>setMotion(!state.reduced);matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>setMotion(e.matches));
document.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>{state.field=button.dataset.choice==='field';state.choiceMade=true;document.querySelectorAll('[data-choice]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});document.querySelector('#choice-result').textContent=state.field?'メールとExcelは入力データ。照合と例外は判断ルール。承認者と確認待ちは担当・責任。FDEが業務担当と、構造を揃えます。':'メール、Excel、暗黙のルール、確認待ちが散らばっています。まだ、システムにするための構造になっていません。';});
document.querySelectorAll('[data-inspect]').forEach(button=>button.onclick=()=>{const expanded=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!expanded));button.nextElementSibling.hidden=expanded;button.querySelector('b').textContent=expanded?'＋':'−';state.inspection=expanded?-1:Number(button.dataset.inspect);measure();});
document.querySelector('#reuse-button').onclick=()=>{state.shared=!state.shared;document.querySelector('#reuse-button').setAttribute('aria-pressed',String(state.shared));document.querySelector('#reuse-button').innerHTML=state.shared?'受注現場だけに戻す <span>↙</span>':'学びを、次の現場へ <span>↗</span>';document.querySelector('#reuse-result').textContent=state.shared?'受注現場で確かめた接続部品と評価の手順を、他部署でも活用。共通化できる部分を使い、それぞれの固有の課題に時間を使います。':'受注現場だけに戻りました。どの学びを共通化できるかを判断します。';};
document.querySelectorAll('[data-ai]').forEach(button=>button.onclick=()=>{state.ai=button.dataset.ai==='1';document.querySelectorAll('[data-ai]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelector('#ai-result').textContent=state.ai?'構造化・実装をAIが支援。人が任せる範囲を設計し、結果をレビューして、本番への導入を判断します。':'現場理解・構造化・実装・検収・定着。仕事を工程で見ると、変化する役割が見えてきます。';});
document.querySelector('#autoplay').onclick=()=>{if(playing){stop();return;}if(state.reduced)setMotion(false);if(scrollY>=bounds.at(-1).top)scrollToTop(0);playbackScroll=scrollY;playbackStarted=performance.now();playing=true;document.querySelector('#autoplay').setAttribute('aria-pressed','true');document.querySelector('#autoplay').innerHTML='<span>Ⅱ</span> 再生中';document.querySelector('#stop-play').hidden=false;document.querySelector('#scene-state').textContent='PLAYING';
  if(narrationAudio){narrationAudio.currentTime=0;narrationLine=-1;narrationAudio.play().catch(()=>{});}};
document.querySelector('#stop-play').onclick=stop;
for(const event of ['wheel','touchstart'])addEventListener(event,stop,{passive:true});
addEventListener('keydown',e=>{if(['Escape','ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))stop();});
document.addEventListener('click',e=>{if(scripted)return;if(!e.target.closest('#autoplay')&&e.target.closest('a,button'))stop();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
document.addEventListener('click',()=>requestAnimationFrame(updateDiagram));
let orderStarted=0;
const orderButton=document.querySelector('#run-order');
function setOrderPhase(phase){
  state.orderPhase=phase;state.orderProgress=0;orderStarted=performance.now();
  const messages={idle:'この注文は、自動登録せず人の確認へ進む設計です。',running:'注文を取り込み、照合ルールで金額を確認しています。',review:'金額に不一致があります。業務担当者の確認待ちで停止しました。',approved:'業務担当者が確認しました。結果をシステムへ登録します。',done:'登録完了。例外を人に戻すルールまで、動く仕組みになりました。'};
  document.querySelector('#order-result').textContent=messages[phase];
  orderButton.disabled=phase==='running'||phase==='approved';
  orderButton.innerHTML=phase==='review'?'例外を確認して、登録する <span>→</span>':phase==='running'?'照合中…':phase==='approved'?'登録中…':phase==='done'?'もう一度、注文を流す <span>↶</span>':'サンプル注文を流す <span>→</span>';
  orderButton.dataset.phase=phase;updateDiagram();
}
orderButton.onclick=()=>setOrderPhase(state.orderPhase==='review'?'approved':'running');
function advanceOrder(now){
  if(state.orderPhase==='running'){state.orderProgress=Math.min(1,(now-orderStarted)/2600);if(state.orderProgress===1)setOrderPhase('review');}
  else if(state.orderPhase==='approved'){state.orderProgress=Math.min(1,(now-orderStarted)/1400);if(state.orderProgress===1)setOrderPhase('done');}
}
let last=performance.now();
// Keep fractional progress: at high frame rates, per-frame scrolling can be less than one pixel.
function autoFrame(now){
  const dt=Math.min((now-last)/1000,.05);last=now;advanceOrder(now);
  lenis?.raf(now);
  if(playing&&narration&&narrationAudio&&!narrationAudio.paused){
    const time=narrationAudio.currentTime;
    let index=0;
    for(let i=0;i<narration.lines.length;i++)if(time>=narration.lines[i].start)index=i;
    if(index!==narrationLine)speakLine(index);
    const line=narration.lines[index],span=chapterSpan.get(line.chapter);
    const box=bounds[line.chapter];
    if(box){
      const within=Math.min(1,Math.max(0,(time-span.start)/Math.max(.001,span.end-span.start)));
      const desired=box.top+within*Math.max(0,box.height-innerHeight*.62);
      playbackScroll+=(desired-playbackScroll)*Math.min(1,dt*2.4);
      scrollToTop(playbackScroll);
    }
  }else if(playing){
    const finish=bounds.at(-1).top+bounds.at(-1).height-innerHeight*.6;
    playbackScroll+=dt*innerHeight*.038;scrollToTop(playbackScroll);
    if(scrollY>=finish)stop();
  }
  requestAnimationFrame(autoFrame);
}
requestAnimationFrame(autoFrame);
cosmos=createCosmos(document.querySelector('#cosmos'),state);
// Look switch: two versions of the same page, remembered per browser and shareable via ?look=ash.
const lookButton=document.querySelector('#look');
function setLook(name){
  state.look=name==='ash'?'ash':'cyber';
  document.documentElement.dataset.look=state.look;
  lookButton.textContent=`LOOK: ${state.look.toUpperCase()}`;
  lookButton.setAttribute('aria-pressed',String(state.look==='ash'));
  lookButton.title=state.look==='ash'?'暗いサイバー調へ戻す':'明るい灰の空へ切り替える';
  try{localStorage.setItem('fde-look',state.look);}catch{}
  cosmos?.setLook(state.look);
}
setLook(new URLSearchParams(location.search).get('look')||(()=>{try{return localStorage.getItem('fde-look');}catch{return null;}})()||'cyber');
lookButton.onclick=()=>setLook(state.look==='ash'?'cyber':'ash');
