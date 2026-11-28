<script setup lang="ts">
import { isAboutPath, isHomePath } from '../lib/locale';
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { Project } from '../data/projects';
import { CARD_MAGNET, cardMagneticTarget, MotionNumber, opacityEase } from '../lib/carousel-motion';
import { ensureHomeIntro, getHomeIntroSnapshot, subscribeHomeIntro, type HomeIntroSnapshot } from '../lib/home-intro';
import { useLanguage } from '../lib/language';
import type { Language } from '../lib/locale';
const props=withDefaults(defineProps<{initialLanguage:Language;projects:Project[];introStage?:number;playIntro?:boolean}>(),{playIntro:undefined});
const { language, t } = useLanguage(props.initialLanguage);
const sharedIntro=getHomeIntroSnapshot();
const controlled=computed(()=>props.introStage!==undefined||props.playIntro!==undefined);
const cursor=ref(0), dragging=ref(false), mobile=ref(false), mounted=ref(false), intro=ref(props.playIntro??sharedIntro.playing), stage=ref(props.introStage??(props.playIntro===false?5:sharedIntro.stage));
const seen=reactive(new Set<number>());
const modulo=(n:number,total:number)=>((n%total)+total)%total;
const active=computed(()=>props.projects.length?modulo(cursor.value,props.projects.length):0);
// Numeric physical cursor keys retain six nodes on each one-step move, even across the data boundary.
const stack=computed(()=>props.projects.length?Array.from({length:7},(_,i)=>{
  const offset=i-3,key=cursor.value+offset;return {key,offset,project:props.projects[modulo(key,props.projects.length)]};
}):[]);
type Motion={x:MotionNumber;y:MotionNumber;rotate:MotionNumber;scale:MotionNumber;opacity:MotionNumber;magnetX:MotionNumber;magnetY:MotionNumber;magnetEnabled:boolean;magnetInside:boolean;node?:HTMLElement;magnetNode?:HTMLElement};
const motions=new Map<number,Motion>(),videos=new Map<number,HTMLVideoElement>(),warmVideos=new Map<string,HTMLVideoElement>();
watch(language,()=>videos.forEach((video,key)=>video.setAttribute('aria-label',props.projects[modulo(key,props.projects.length)].title+' '+t('预览'))));
const timers=new Set<number>(),topMask=ref<HTMLElement>(),bottomMask=ref<HTMLElement>();
const maskY=new MotionNumber(0),maskOpacity=new MotionNumber(1);
let height=0,raf=0,lastTime=0,wheelUntil=0,repeatAt=0,dragAt=0,suppressClick=false;
let magnetReturnUntil=0;
let unsubscribeIntro:undefined|(()=>void);
type CarouselRoutePhase='home'|'exiting-about'|'about'|'returning-home';
const routePhase=ref<CarouselRoutePhase>('home');
let routeTimer=0;
const pointer={id:null as number|null,x:0,y:0,dragging:false,captured:false,triggered:false};
const allowed=()=>mounted.value&&!intro.value&&routePhase.value==='home'&&isHomePath(location.pathname);
const source=(project:Project)=>mobile.value&&project.mobileVideo?.trim()?project.mobileVideo:project.video;
const later=(callback:()=>void,ms:number)=>{const id=window.setTimeout(()=>{timers.delete(id);callback();},ms);timers.add(id);};
function position(offset:number) {
  return {y:offset===0?0:Math.sign(offset)*(height*(mobile.value?.37:.4)+Math.max(0,Math.abs(offset)-1)*(mobile.value?43:35)),
    rotate:offset===0?0:Math.sign(offset)*(mobile.value?93:98),scale:offset===0?1:mobile.value?.76:.8};
}
function routePosition(offset:number){
  const normal=position(offset);
  if(routePhase.value==='exiting-about'||routePhase.value==='about'){
    if(offset===0)return {x:Math.max(window.innerWidth*.6,420),y:0,rotate:0,scale:1,opacity:1};
    return {x:0,y:Math.sign(offset)*height*.6,rotate:normal.rotate,scale:mobile.value?.76:.8,opacity:0};
  }
  return {x:0,y:normal.y,rotate:normal.rotate,scale:normal.scale,opacity:offset===0?1:0};
}
function draw() {
  motions.forEach(m=>{
    if(!m.node)return;
    m.node.style.transform='translateX('+m.x.value+'px) translateY('+m.y.value+'px) scale('+m.scale.value+') rotateX('+m.rotate.value+'deg)';
    if(m.magnetNode)m.magnetNode.style.transform='translateX('+m.magnetX.value+'px) translateY('+m.magnetY.value+'px)';
    m.node.querySelectorAll<HTMLElement>('.card-visuals,.card-copy').forEach(node=>node.style.opacity=String(m.opacity.value));
  });
  if(topMask.value){topMask.value.style.transform='translateY('+(-maskY.value)+'px)';topMask.value.style.opacity=String(maskOpacity.value);}
  if(bottomMask.value){bottomMask.value.style.transform='translateY('+maskY.value+'px)';bottomMask.value.style.opacity=String(maskOpacity.value);}
}
function tick(now:number) {
  const dt=(now-lastTime)/1000;lastTime=now;raf=0;let moving=false;
  motions.forEach(m=>[m.x,m.y,m.rotate,m.scale,m.opacity,m.magnetX,m.magnetY].forEach(axis=>{axis.step(dt);moving||=axis.moving;}));
  [maskY,maskOpacity].forEach(axis=>{axis.step(dt);moving||=axis.moving;});draw();
  if(moving)raf=requestAnimationFrame(tick);
}
function animate(){if(!raf){lastTime=performance.now();raf=requestAnimationFrame(tick);}}
function releaseMagnet(m:Motion,disabled=false){
  m.magnetX.stop();m.magnetY.stop();m.magnetInside=false;
  if(disabled&&Math.hypot(m.magnetX.value,m.magnetY.value)<=.5){m.magnetX.set(0);m.magnetY.set(0);}
  else {m.magnetX.spring(0,CARD_MAGNET.releaseSpring,true);m.magnetY.spring(0,CARD_MAGNET.releaseSpring,true);}
}
function syncMagnetEnabled(){
  const enabled=mounted.value&&routePhase.value==='home'&&!mobile.value&&!intro.value&&!dragging.value&&performance.now()>=magnetReturnUntil&&isHomePath(location.pathname);
  motions.forEach((m,key)=>{
    const next=enabled&&key===cursor.value;
    if(m.magnetEnabled&&!next)releaseMagnet(m,true);
    m.magnetEnabled=next;
  });
  draw();animate();
}
function magnetMove(event:MouseEvent){
  const m=motions.get(cursor.value);
  if(!m?.magnetEnabled||!m.magnetNode)return;
  // The source measures the moving magnetic wrapper, including its transform.
  const rect=m.magnetNode.getBoundingClientRect();
  const target=cardMagneticTarget(event.clientX-rect.left-rect.width/2,event.clientY-rect.top-rect.height/2);
  if(target.inRadius){
    m.magnetX.spring(target.x,CARD_MAGNET.spring,true);m.magnetY.spring(target.y,CARD_MAGNET.spring,true);m.magnetInside=true;
  }else if(m.magnetInside)releaseMagnet(m);
  animate();
}
function magnetLeave(){motions.forEach(m=>{if(m.magnetInside)releaseMagnet(m);});animate();}
function holdReturnMagnet(){
  magnetReturnUntil=performance.now()+1250;
  later(()=>{if(performance.now()>=magnetReturnUntil)syncMagnetEnabled();},1250);
}
function warm(project:Project){
  const src=source(project);if(!src||warmVideos.has(src))return;
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.src=src;video.load();warmVideos.set(src,video);
}
function syncVideos(){videos.forEach((video,key)=>{if(key===cursor.value&&routePhase.value!=='about')video.play().catch(()=>{});else video.pause();});}
function ownerInStack(key:number|undefined){return key!==undefined&&stack.value.some(item=>item.key===key);}
function bindVideoSlot(key:number,element:unknown){
  // Vue owns this stable empty slot; the native video can cross route trees.
  if(!(element instanceof HTMLElement))return;
  const project=props.projects[modulo(key,props.projects.length)],src=source(project);
  let video=videos.get(key)??element.querySelector<HTMLVideoElement>('video'),claimed=false;
  // Keep the route overlay's live video out of the new card while the return
  // morph is running. The card owns a normal preview instance; the overlay
  
  const fresh=!videos.has(key);
  if(!video){video=document.createElement('video');video.src=src;video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';}
  else if(new URL(video.currentSrc||video.src,location.href).href!==new URL(src,location.href).href){video.src=src;video.load();}
  video.setAttribute('aria-label',project.title+' '+t('预览'));
  videos.set(key,video);if(video.parentElement!==element)element.appendChild(video);
  
  syncVideos();
}
function bindCard(key:number,element:unknown){
  const m=motions.get(key);if(m){m.node=element instanceof HTMLElement?element:undefined;m.magnetNode=m.node?.querySelector<HTMLElement>('.card-magnet')??undefined;}draw();
}
function sync(first=false,returning=false){
  if(!mounted.value)return;
  const routeTween=returning||routePhase.value==='exiting-about'||routePhase.value==='returning-home';
  const snap=routePhase.value==='about'||routeTween&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seconds=mobile.value?.8:1.2;
  const keys=new Set(stack.value.map(item=>item.key));motions.forEach((_,key)=>{if(!keys.has(key))motions.delete(key);});
  videos.forEach((video,key)=>{if(!keys.has(key)){video.pause();video.remove();videos.delete(key);}});seen.add(cursor.value);
  stack.value.forEach(item=>{
    const target=routePosition(item.offset);let m=motions.get(item.key);
    if(!m){
      const startY=routePhase.value==='about'?target.y:intro.value?(item.offset<=0?-1:1)*height*.92:item.offset===0&&first?0:Math.sign(item.offset)*height*.6;
      m={x:new MotionNumber(routePhase.value==='about'?target.x:0),y:new MotionNumber(startY),rotate:new MotionNumber(item.offset===0&&intro.value?-(mobile.value?93:98):target.rotate),
        scale:new MotionNumber(routePhase.value==='about'?target.scale:intro.value?(item.offset===0?.8:target.scale):1),opacity:new MotionNumber(item.offset===0&&!intro.value?1:0),
        magnetX:new MotionNumber(0),magnetY:new MotionNumber(0),magnetEnabled:false,magnetInside:false};
      motions.set(item.key,m);
    }
    if(intro.value)return;
    if(snap){m.x.set(target.x);m.y.set(target.y);m.rotate.set(target.rotate);m.scale.set(target.scale);m.opacity.set(target.opacity);}
    else if(routeTween){m.x.tween(target.x,seconds);m.y.tween(target.y,seconds);m.rotate.tween(target.rotate,seconds);m.scale.tween(target.scale,seconds);m.opacity.tween(target.opacity,.3,opacityEase);}
    else {m.x.set(0);m.y.spring(target.y);m.rotate.spring(target.rotate);m.scale.spring(target.scale);m.opacity.tween(target.opacity,.3,opacityEase);}
  });
  if(props.projects[active.value])warm(props.projects[active.value]);
  syncMagnetEnabled();
  nextTick(()=>{syncVideos();draw();animate();window.dispatchEvent(new CustomEvent('gabriel:carousel-cursor',{detail:{cursor:cursor.value}}));});
}
function introStage(value:number){
  stage.value=value;if(value<3)return;
  motions.forEach((m,key)=>{
    const offset=key-cursor.value,current=offset===0,stackStage=value<4;
    const shifted=stackStage?(current?-1:offset<0?offset-1:offset):offset;
    const target=position(shifted),duration=value>=4&&current?.82:.72;
    m.y.tween(stackStage&&current?position(-1).y+(mobile.value?18:22):target.y,duration);
    m.rotate.tween(target.rotate,duration);m.scale.tween(stackStage&&current?(mobile.value?.76:.8):target.scale,duration);
    m.opacity.tween(value>=4&&current?1:0,duration);
  });
  maskY.tween(0,.72);maskOpacity.tween(1,.24,opacityEase);animate();
}
function applyIntroSnapshot(snapshot:HomeIntroSnapshot){
  if(routePhase.value!=='home'&&snapshot.playing)return;
  const wasPlaying=intro.value;intro.value=snapshot.playing;stage.value=snapshot.stage;
  if(snapshot.playing)introStage(snapshot.stage);
  else if(wasPlaying)sync();
  syncMagnetEnabled();
}
function setRoute(pathname:string){
  if(!mounted.value)return;
  const about=isAboutPath(pathname);
  if(!about&&!isHomePath(pathname)&&pathname!=='')return;
  const wasAbout=routePhase.value==='about'||routePhase.value==='exiting-about';
  if(about===wasAbout)return;
  clearTimeout(routeTimer);
  routePhase.value=about?'exiting-about':'returning-home';
  intro.value=false;stage.value=5;
  pointer.id=null;pointer.dragging=false;pointer.captured=false;pointer.triggered=false;dragging.value=false;
  const seconds=matchMedia('(prefers-reduced-motion: reduce)').matches?0:mobile.value?.8:1.2;
  if(!about)holdReturnMagnet();
  maskY.tween(0,seconds);maskOpacity.tween(1,seconds);
  sync(false,true);
  routeTimer=window.setTimeout(()=>{
    routeTimer=0;
    routePhase.value=about?'about':'home';
    syncVideos();syncMagnetEnabled();
  },seconds*1000+34);
}
function authorRoute(event:Event){
  const pathname=(event as CustomEvent<{pathname?:string}>).detail?.pathname;
  if(typeof pathname==='string')setRoute(pathname);
}
function pageLoad(){setRoute(location.pathname);}
function advance(offset:number, fromDrag=false){
  if(allowed()&&props.projects.length&&offset!==0){
    if(performance.now()<magnetReturnUntil)holdReturnMagnet();
    const nextCursor = cursor.value + offset;
    if (fromDrag) {
      // Switch the visible preview before the cards move past each other.
      motions.forEach((motion, key) => {
        if (key !== nextCursor) motion.opacity.set(0);
      });
    }
    cursor.value = nextCursor;
    window.dispatchEvent(new CustomEvent('gabriel:carousel-cursor',{detail:{cursor:cursor.value}}));
  }
}
function triggerDrag(dy:number){
  const now = performance.now();
  if (now - dragAt < 170) return;
  advance(dy > 0 ? -1 : 1, true);
  pointer.triggered=true;suppressClick=true;dragAt=now;
}
function down(e:PointerEvent){
  if(!allowed()||(e.pointerType==='mouse'&&e.button!==0))return;
  pointer.id=e.pointerId;pointer.x=e.clientX;pointer.y=e.clientY;pointer.dragging=true;pointer.captured=false;pointer.triggered=false;suppressClick=false;
}
function move(e:PointerEvent){
  if(!allowed()||!pointer.dragging||pointer.id!==e.pointerId)return;
  const dy=e.clientY-pointer.y,dx=e.clientX-pointer.x;if(Math.abs(dy)<=Math.abs(dx)||Math.abs(dy)<45)return;
  if(!pointer.captured){(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);pointer.captured=true;dragging.value=true;}
  e.preventDefault();triggerDrag(dy);pointer.x=e.clientX;pointer.y=e.clientY;
}
function up(e:PointerEvent){
  if(!pointer.dragging||pointer.id!==e.pointerId)return;
  const target=e.currentTarget as HTMLElement;if(pointer.captured&&target.hasPointerCapture(e.pointerId))target.releasePointerCapture(e.pointerId);
  if(allowed()&&!pointer.triggered){const dy=e.clientY-pointer.y,dx=e.clientX-pointer.x;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>=30)triggerDrag(dy);}
  pointer.id=null;pointer.dragging=false;pointer.captured=false;pointer.triggered=false;dragging.value=false;
  if(suppressClick)later(()=>{suppressClick=false;},0);
}
function click(e:MouseEvent,key:number){if(suppressClick){e.preventDefault();suppressClick=false;return;} const offset=key-cursor.value; if(offset!==0){e.preventDefault();advance(offset);}} function wheel(e:WheelEvent){
  if(!isHomePath(location.pathname))return;e.preventDefault();if(!allowed())return;
  const delta=Math.abs(e.deltaY),now=performance.now();if(delta<20||now<wheelUntil)return;
  wheelUntil=now+Math.max(30,165-delta);advance(e.deltaY>0?-1:1);
}
function key(e:KeyboardEvent){
  if(!allowed()||!['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.key))return;
  if(e.repeat){const now=performance.now();if(now-repeatAt<50)return;repeatAt=now;}
  advance(e.key==='ArrowUp'||e.key==='ArrowLeft'?1:-1);
}
function resize(){height=window.innerHeight;mobile.value=window.innerWidth<769;sync();}
watch(cursor,()=>{window.__gabrielCarouselCursor=cursor.value;sync();},{flush:'sync'});
watch([mobile,intro,dragging],syncMagnetEnabled,{flush:'sync'});
watch(()=>props.introStage,value=>{if(value!==undefined&&mounted.value){intro.value=props.playIntro!==false;introStage(value);}});
watch(()=>props.playIntro,value=>{if(!value&&mounted.value){intro.value=false;sync();}});
onMounted(()=>{
  height=window.innerHeight;mobile.value=window.innerWidth<769;
  const returning=window.__gabrielCarouselCursor!==undefined;
  if(returning)holdReturnMagnet();
  if(returning)cursor.value=window.__gabrielCarouselCursor!;
  const snapshot=getHomeIntroSnapshot();
  intro.value=controlled.value?props.playIntro!==false:snapshot.playing;
  stage.value=props.introStage??(intro.value?snapshot.stage:5);mounted.value=true;
  if(isAboutPath(location.pathname)){routePhase.value='about';intro.value=false;stage.value=5;}
  maskY.set(intro.value?height*.6:0);maskOpacity.set(intro.value?0:1);sync(true,returning);
  if(mobile.value)props.projects.forEach(warm);
  window.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',key);window.addEventListener('resize',resize);
  window.addEventListener('mousemove',magnetMove);document.documentElement.addEventListener('mouseleave',magnetLeave);
  window.addEventListener('gabriel:author-route',authorRoute);document.addEventListener('astro:page-load',pageLoad);
  
  if(controlled.value){if(intro.value)introStage(stage.value);else animate();}
  else {unsubscribeIntro=subscribeHomeIntro(applyIntroSnapshot);ensureHomeIntro(props.projects);}
});
onUnmounted(()=>{
  mounted.value=false;unsubscribeIntro?.();cancelAnimationFrame(raf);timers.forEach(clearTimeout);
  window.removeEventListener('wheel',wheel);window.removeEventListener('keydown',key);window.removeEventListener('resize',resize);
  window.removeEventListener('mousemove',magnetMove);document.documentElement.removeEventListener('mouseleave',magnetLeave);
  window.removeEventListener('gabriel:author-route',authorRoute);document.removeEventListener('astro:page-load',pageLoad);clearTimeout(routeTimer);
  
  motions.forEach(m=>{m.magnetX.stop();m.magnetY.stop();});
  videos.forEach(video=>{video.pause();video.remove();});warmVideos.forEach(video=>{video.pause();video.removeAttribute('src');video.load();});
});
</script>
<template>
  <section class="project-slider" :aria-label="t('项目轮播')" :data-intro-stage="stage" :data-intro-playing="intro" :data-route-phase="routePhase" :aria-hidden="routePhase==='about'||routePhase==='exiting-about'">
    <div class="cards" :class="{dragging}" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @pointerleave="up">
      <div v-for="item in stack" :key="item.key" :ref="element=>bindCard(item.key,element)" class="project-card" :class="{current:item.offset===0}" :data-card-cursor="item.key" :data-card-offset="item.offset">
        <div class="card-magnet">
        <div class="card-media">
          <div class="card-visuals">
            <div v-if="seen.has(item.key)" :ref="element=>bindVideoSlot(item.key,element)" class="card-video-slot" />
          </div>
          <div class="card-copy"><strong>{{item.project.title}}</strong></div>
        </div>
        </div>
      </div>
    </div>
    <div ref="topMask" class="carousel-mask carousel-mask-top" aria-hidden="true" />
    <div ref="bottomMask" class="carousel-mask carousel-mask-bottom" aria-hidden="true" />
  </section>
    <div v-if="mounted" class="project-dots carousel-dots" :class="{'intro-visible':stage>=5&&(routePhase==='home'||routePhase==='returning-home')}" role="img" :aria-label="t('项目')+' '+(active+1)+' '+t('共')+' '+props.projects.length">
      <span v-for="(_,index) in props.projects" :key="index" :class="{active:index===props.projects.length-1-active}" />
    </div>
</template>
<style scoped>
.project-slider {animation:none!important;}
.project-slider[data-route-phase="about"] {visibility:hidden;pointer-events:none;}
.project-slider::before,.project-slider::after {display:none;}
.cards {perspective:1500px;transform-style:preserve-3d;touch-action:manipulation;user-select:none;}
.project-card {translate:0 -50%;transform-style:preserve-3d;transform-origin:center center;border-radius:32px;opacity:1;background:transparent;overflow:visible;animation:none!important;transition:none!important;filter:none!important;}
.card-magnet {position:relative;width:100%;height:100%;border-radius:inherit;overflow:hidden;background:#eaeaea;transform-style:preserve-3d;}
.card-media {border-radius:inherit;background:#eaeaea;}
.card-visuals {position:absolute;inset:0;border-radius:inherit;transform:translateZ(0);backface-visibility:hidden;}
.card-video-slot {width:100%;height:100%;}
.card-video-slot :deep(video) {display:block;width:100%;height:100%;object-fit:cover;opacity:1!important;mix-blend-mode:normal;transform:none!important;animation:none!important;transition:none!important;filter:none!important;}
.card-visuals video,.card-visuals img {display:block;width:100%;height:100%;object-fit:cover;opacity:1!important;mix-blend-mode:normal;transform:none!important;animation:none!important;transition:none!important;filter:none!important;}
.project-card .card-copy {left:3rem;bottom:3rem;color:#fff;mix-blend-mode:exclusion;text-shadow:none;}
.project-card .card-copy strong {font-size:1.6rem;font-weight:400;line-height:1;letter-spacing:0;}
.carousel-mask {position:absolute;left:0;width:100%;height:8rem;z-index:50;pointer-events:none;}
.carousel-mask-top {top:0;background:linear-gradient(to bottom,var(--paper),transparent);}
.carousel-mask-bottom {bottom:0;background:linear-gradient(to top,var(--paper),transparent);}
.carousel-dots {position:fixed;right:8.1rem;top:50%;transform:translateY(-50%);display:grid;gap:.8rem;z-index:20;opacity:0;animation:none!important;transition:opacity .35s cubic-bezier(.215,.61,.355,1);pointer-events:none;}
.carousel-dots.intro-visible {opacity:1;}
.carousel-dots span {width:3px;height:3px;border-radius:50%;background:#1a1a1a;opacity:.2;transition:opacity .25s ease-out;}
.carousel-dots span.active {opacity:1;}
@media(max-width:768px){.carousel-dots{right:2.5rem;}.project-card .card-copy strong{font-size:1.4rem;}}
</style>

