<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import ButtonIcon from './ButtonIcon.vue';
import ButtonMagnet from './ButtonMagnet.vue';
import { BUTTON_ROTATE_SPRING, EASE_IN_OUT_CIRC, EASE_OUT_CUBIC, useButtonMotion } from '../lib/button-motion';
import { subscribeHomeIntro } from '../lib/home-intro';
import { navigate } from 'astro:transitions/client';

const props=withDefaults(defineProps<{about?:boolean}>(),{about:false});
const about=ref(props.about);
const returning=ref(false);
const open=ref(props.about),renderContacts=ref(props.about),mobile=ref(false),emailHover=ref(false);
const wrapper=ref<HTMLElement|null>(null);
const toggleRoute=ref<HTMLElement|null>(null);
const toggleButton=ref<HTMLElement|null>(null);
const introElement=ref<HTMLElement|null>(null);
const contactRow=ref<HTMLElement|null>(null),chatIcon=ref<HTMLElement|null>(null),closeIcon=ref<HTMLElement|null>(null),backIcon=ref<HTMLElement|null>(null);
const introOpacity=ref(props.about?1:0),introY=ref(props.about?0:28);
const rotate=useButtonMotion(props.about?-90:0),rowShift=useButtonMotion(0);
const initialChatStyle=props.about?'transform:scale(.5);opacity:0':'transform:scale(1);opacity:1';
const initialBackStyle=props.about?'transform:scale(1);opacity:1':'transform:scale(.5);opacity:0';
const initialContactsStyle=ref(props.about?'opacity:1;translate:-5.8rem 0':'opacity:0;translate:0 0');
const initialToggleRouteStyle=props.about?'translate:-5.8rem 0':'translate:0 0';
const toggleSurfaceStyle=ref(props.about?'background-color:#000;border-radius:2.7rem':'background-color:#fff;border-radius:1.5rem');
const email='gbeaugonin@gmail.com';
const itemMotion=[0,1,2].map(()=>({x:useButtonMotion(props.about?0:-10),rotate:useButtonMotion(props.about?0:80),scale:useButtonMotion(props.about?1:.8),opacity:useButtonMotion(props.about?1:0),blur:useButtonMotion(props.about?0:2)}));
const contacts=computed(()=>[
  {name:mobile.value?'Send email':'Copy email',icon:'email' as const,href:'mailto:'+email},
  {name:'X (Twitter)',icon:'x' as const,href:'https://x.com/gabrielbgnn'},
  {name:'LinkedIn',icon:'linkedin' as const,href:'https://www.linkedin.com/in/gbeaugonin/'},
]);
let parent:HTMLElement|null=null,previousTranslate='',toastTimer=0,toggleGeneration=0,contactsGeneration=0,returnFrame=0;
let activeRowAnimation:Animation|undefined;
let rowShiftTarget:number|undefined;
const elementAnimations=new Map<HTMLElement,Map<string,{target:string;duration:number;easing:string;animation?:Animation}>>();
let introAnimation:Animation|undefined;
let stopIntro=()=>{};
let lastIntroVisible:boolean|undefined;
const toast=ref('');
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const rootSize=()=>Number.parseFloat(getComputedStyle(document.documentElement).fontSize)||10;
const itemStyle=(index:number)=>{
  const item=itemMotion[index];
  return {transform:'translateX('+item.x.value.value+'px) scale('+item.scale.value.value+') rotateY('+item.rotate.value.value+'deg)',opacity:Math.max(0,Math.min(1,item.opacity.value.value)),filter:'blur('+Math.max(0,item.blur.value.value)+'px)'};
};
// Match the reference: both directions animate toward their new target from
// the current value. Repeated route lifecycle events do not restart a track.
const animateElement=(node:HTMLElement|null,property:'transform'|'opacity'|'translate'|'backgroundColor'|'borderRadius',target:string,duration:number,easing=EASE_OUT_CUBIC)=>{
  if(!node)return;
  let tracks=elementAnimations.get(node);
  if(!tracks){tracks=new Map();elementAnimations.set(node,tracks);}
  const previous=tracks.get(property);
  if(previous?.target===target&&previous.duration===duration&&previous.easing===easing)return previous.animation;
  const from=getComputedStyle(node)[property];
  previous?.animation?.cancel();
  node.style[property]=target;
  const track:{target:string;duration:number;easing:string;animation?:Animation}={target,duration,easing};
  tracks.set(property,track);
  if(reduced()||from===target)return;
  const animation=node.animate([{[property]:from},{[property]:target}],{duration,easing,fill:'both'});
  track.animation=animation;
  animation.onfinish=()=>{
    if(tracks?.get(property)!==track)return;
    track.animation=undefined;animation.cancel();
  };
  return animation;
};
const animateToggleIcon=(node:HTMLElement|null,visible:boolean)=>{
  animateElement(node,'transform','scale('+(visible?1:.5)+')',250);
  animateElement(node,'opacity',visible?'1':'0',250);
};
const updateToggleSurface=()=>{
  const active=open.value||about.value;
  // Astro moves the persisted button between documents. Own these tracks with
  // WAAPI so swapping the page cannot finish its CSS transitions early.
  animateElement(toggleButton.value,'backgroundColor',active?'#000':'#fff',300,EASE_IN_OUT_CIRC);
  animateElement(toggleButton.value,'borderRadius',active?'2.7rem':'1.5rem',280,EASE_IN_OUT_CIRC);
  toggleSurfaceStyle.value=active?'background-color:#000;border-radius:2.7rem':'background-color:#fff;border-radius:1.5rem';
};
const resetContacts=()=>{
  itemMotion.forEach(item=>{
    item.x.motion.set(-10);item.opacity.motion.set(0);
    item.rotate.motion.set(mobile.value?0:80);
    item.scale.motion.set(mobile.value?1:.8);
    item.blur.motion.set(mobile.value?0:2);
  });
};
const animateContacts=(visible:boolean)=>{
  const node=contactRow.value;
  if(!node)return;
  const generation=++contactsGeneration;
  const animations=[
    animateElement(node,'opacity',visible?'1':'0',300,'ease-out'),
    animateElement(node,'translate',(visible&&about.value?-5.8*rootSize():0)+'px 0',visible?450:250),
  ].filter((animation):animation is Animation=>!!animation);
  const tracks=itemMotion.flatMap((item,index)=>{
    const delay=(visible?index:2-index)*.05;
    const axes=[{axis:item.x,target:visible?0:-10,delay},{axis:item.opacity,target:visible?1:0,delay}];
    if(mobile.value){item.rotate.motion.set(0);item.scale.motion.set(1);item.blur.motion.set(0);}
    else axes.push({axis:item.rotate,target:visible?0:80,delay},{axis:item.scale,target:visible?1:.8,delay},{axis:item.blur,target:visible?0:2,delay});
    return axes;
  });
  let pending=tracks.length+animations.length;
  const settled=()=>{
    if(--pending||generation!==contactsGeneration||visible||open.value)return;
    renderContacts.value=false;
    void nextTick(()=>{
      if(generation!==contactsGeneration||open.value)return;
      elementAnimations.forEach((entries,element)=>{
        if(element===node||node.contains(element)){entries.forEach(track=>track.animation?.cancel());elementAnimations.delete(element);}
      });
    });
  };
  animations.forEach(animation=>{void animation.finished.then(settled,settled);});
  tracks.forEach(({axis,target,delay})=>{
    axis.motion.spring(target,{stiffness:200,damping:17},delay,settled);
  });
};
const updateRowShift=()=>{
  const shift=mobile.value?(about.value?-5.8*rootSize():open.value?-8.7*rootSize():0):0;
  if(rowShiftTarget===shift)return;
  rowShiftTarget=shift;
  const current=parent?getComputedStyle(parent).translate.split(' ')[0]:'0';
  const parsed=Number.parseFloat(current);
  const start=Number.isFinite(parsed)?parsed:rowShift.value.value;
  rowShift.motion.stop();
  activeRowAnimation?.cancel();
  activeRowAnimation=undefined;
  if(reduced()){rowShift.motion.set(shift);parent?.style.setProperty('translate',shift+'px 0');return;}
  if(parent){
    const target=parent;
    const animation=target.animate([{translate:start+'px 0'},{translate:shift+'px 0'}],{duration:450,easing:EASE_OUT_CUBIC,fill:'both'});
    activeRowAnimation=animation;
    animation.onfinish=()=>{
      if(activeRowAnimation!==animation||parent!==target)return;
      rowShift.motion.set(shift);target.style.setProperty('translate',shift+'px 0');
      activeRowAnimation=undefined;animation.cancel();
    };
  }
};
const updateModeIcons=()=>{
  animateToggleIcon(chatIcon.value,!open.value&&!about.value&&!returning.value);
  animateToggleIcon(closeIcon.value,open.value&&!about.value&&!returning.value);
  animateToggleIcon(backIcon.value,about.value||returning.value);
};
watch([about,open,returning],async([,value],[,wasOpen])=>{
  const generation=++toggleGeneration;
  updateModeIcons();
  updateToggleSurface();
  if(value!==wasOpen)rotate.motion.spring(value?-90:0,BUTTON_ROTATE_SPRING);
  animateElement(toggleRoute.value,'translate',(about.value?-5.8*rootSize():0)+'px 0',450);
  updateRowShift();
  if(value===wasOpen){
    animateElement(contactRow.value,'translate',(value&&about.value?-5.8*rootSize():0)+'px 0',value?450:250);
    return;
  }
  if(value){
    if(!renderContacts.value){
      resetContacts();initialContactsStyle.value='opacity:0;translate:0 0';
      renderContacts.value=true;
    }
    await nextTick();
    if(generation!==toggleGeneration)return;
  }
  animateContacts(value);
});
const resize=()=>{
  const wasMobile=mobile.value;mobile.value=window.innerWidth<=768;
  updateRowShift();
  const row=contactRow.value;
  animateElement(toggleRoute.value,'translate',(about.value?-5.8*rootSize():0)+'px 0',450);
  animateElement(row,'translate',(open.value&&about.value?-5.8*rootSize():0)+'px 0',open.value?450:250);
  if(wasMobile!==mobile.value&&row)animateContacts(open.value);
};
const syncHomeIntro=(snapshot:{stage:number;playing:boolean})=>{
  const visible=!snapshot.playing||snapshot.stage>=2;
  if(visible===lastIntroVisible)return;
  lastIntroVisible=visible;
  const targetOpacity=visible?1:0,targetY=visible?0:28;
  const node=introElement.value;
  introAnimation?.cancel();
  if(!node){introOpacity.value=targetOpacity;introY.value=targetY;return;}
  if(reduced()){introOpacity.value=targetOpacity;introY.value=targetY;return;}
  const delay=visible&&snapshot.playing?80:0;
  const animation=node.animate([{opacity:introOpacity.value,transform:'translateY('+introY.value+'px)'},{opacity:targetOpacity,transform:'translateY('+targetY+'px)'}],{duration:visible&&snapshot.playing?720:0,delay,easing:'cubic-bezier(.32,0,0,1)',fill:'both'});
  introAnimation=animation;
  animation.onfinish=()=>{introOpacity.value=targetOpacity;introY.value=targetY;animation.cancel();};
};
const copyEmail=async()=>{
  let copied=false;
  try{
    if(navigator.clipboard?.writeText&&window.isSecureContext){await navigator.clipboard.writeText(email);copied=true;}
    else{
      const textarea=document.createElement('textarea');textarea.value=email;textarea.readOnly=true;
      Object.assign(textarea.style,{position:'fixed',top:'0',left:'0',opacity:'0'});document.body.append(textarea);textarea.focus();textarea.select();
      copied=document.execCommand('copy');textarea.remove();
    }
  }catch{}
  toast.value=copied?'copied to clipboard':'copy unavailable — '+email;
  clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>{toast.value='';},4000);
};
const refreshParent=()=>{
  const next=wrapper.value?.closest<HTMLElement>('.author-actions')??wrapper.value?.closest<HTMLElement>('.intro-actions')??wrapper.value?.parentElement??null;
  if(next===parent)return;
  activeRowAnimation?.cancel();activeRowAnimation=undefined;
  rowShiftTarget=undefined;
  parent=next;previousTranslate=parent?.style.translate??'';
};
const setRoute=(pathname:string)=>{
  const nextAbout=pathname==='/about'||pathname==='/about/';
  if(nextAbout===about.value)return;
  cancelAnimationFrame(returnFrame);returnFrame=0;
  if(nextAbout){about.value=true;returning.value=false;open.value=true;return;}
  about.value=false;returning.value=true;
};
const releaseReturn=()=>{
  if(!returning.value||returnFrame||location.pathname!=='/')return;
  returnFrame=requestAnimationFrame(()=>{
    returnFrame=0;
    if(about.value||location.pathname!=='/')return;
    returning.value=false;open.value=false;
  });
};
const routeTarget=(event:Event)=>{
  const pathname=(event as CustomEvent<{pathname?:string}>).detail?.pathname;
  if(typeof pathname!=='string')return;
  refreshParent();setRoute(pathname);
};
const syncRoute=()=>{
  refreshParent();setRoute(location.pathname);
  releaseReturn();
  updateRowShift();
};
const toggle=()=>{
  if(about.value){void navigate('/');return;}
  open.value=!open.value;
};
const keydown=(event:KeyboardEvent)=>{
  if(event.key!=='Escape')return;
  if(about.value){void navigate('/');return;}
  if(open.value)open.value=false;
};
onMounted(()=>{
  refreshParent();
  resize();window.addEventListener('resize',resize);
  syncRoute();
  updateModeIcons();
  updateToggleSurface();
  animateElement(toggleRoute.value,'translate',(about.value?-5.8*rootSize():0)+'px 0',450);
  window.addEventListener('gabriel:author-route',routeTarget);
  window.addEventListener('keydown',keydown);
  document.addEventListener('astro:page-load',syncRoute);
  document.addEventListener('astro:after-swap',syncRoute);
  stopIntro=subscribeHomeIntro((snapshot)=>{void nextTick(()=>syncHomeIntro(snapshot));});
});
onUnmounted(()=>{
  stopIntro();introAnimation?.cancel();
  elementAnimations.forEach(tracks=>tracks.forEach(track=>track.animation?.cancel()));elementAnimations.clear();
  cancelAnimationFrame(returnFrame);
  window.removeEventListener('resize',resize);clearTimeout(toastTimer);activeRowAnimation?.cancel();
  window.removeEventListener('gabriel:author-route',routeTarget);
  window.removeEventListener('keydown',keydown);
  document.removeEventListener('astro:page-load',syncRoute);
  document.removeEventListener('astro:after-swap',syncRoute);
  if(parent)parent.style.translate=previousTranslate;
});
</script>

<template>
  <div ref="wrapper" class="social-wrap source-social">
    <div ref="toggleRoute" class="source-social-toggle-route" :style="initialToggleRouteStyle">
    <div ref="introElement" class="source-social-intro" :style="{opacity:introOpacity,transform:'translateY('+introY+'px)'}">
      <ButtonMagnet>
        <button ref="toggleButton" class="social-button source-social-toggle" :class="{'source-social-open':open||about}" type="button" :style="[toggleSurfaceStyle,{transform:'rotate('+rotate.value.value+'deg)'}]" :aria-expanded="about?undefined:open" :aria-label="about?'Back to Home':open?'Close Social Links':'Open Social Links'" @click="toggle">
          <span class="source-social-icon-mask" aria-hidden="true">
            <span ref="chatIcon" data-icon="chat" class="source-social-toggle-icon" :style="initialChatStyle"><ButtonIcon name="chat" color="#1a1a1a" /></span>
            <span ref="closeIcon" data-icon="close" class="source-social-toggle-icon" style="transform:scale(.5);opacity:0"><ButtonIcon name="close" color="#fff" /></span>
            <span ref="backIcon" data-icon="back" class="source-social-toggle-icon" :style="initialBackStyle"><span style="display:inline-flex;transform:rotate(90deg)"><ButtonIcon name="back" color="#f6f6f6" /></span></span>
          </span>
        </button>
      </ButtonMagnet>
    </div>
    </div>
    <div v-if="renderContacts" ref="contactRow" class="source-social-links" :class="{'source-social-links-open':open}" :aria-hidden="!open" :style="initialContactsStyle">
      <div v-for="(contact,index) in contacts" :key="contact.icon" class="source-contact-slot">
        <ButtonMagnet>
          <button v-if="contact.icon==='email'&&!mobile" class="social-button source-contact" type="button" :style="itemStyle(index)" :aria-label="contact.name" :tabindex="open?0:-1" @mouseenter="emailHover=true" @mouseleave="emailHover=false" @click="copyEmail"><ButtonIcon name="email" /></button>
          <a v-else class="social-button source-contact" :style="itemStyle(index)" :href="contact.href" :aria-label="contact.name" :tabindex="open?0:-1" :target="contact.icon==='email'?undefined:'_blank'" :rel="contact.icon==='email'?undefined:'noreferrer'"><ButtonIcon :name="contact.icon" /></a>
          <span v-if="contact.icon==='email'&&!mobile" class="source-email-tooltip" :class="{'source-email-tooltip-visible':emailHover}">click to copy</span>
        </ButtonMagnet>
      </div>
    <Teleport v-if="toast" to="body"><div class="source-copy-toast" role="status">{{toast}}</div></Teleport>
    </div>
  </div>
</template>

<style scoped>
.source-social {position:relative;width:5.4rem;height:5.4rem;flex-shrink:0;}
.source-social-toggle-route {position:relative;width:5.4rem;height:5.4rem;will-change:translate;}
.source-social-intro {position:relative;width:5.4rem;height:5.4rem;will-change:transform,opacity;}
.source-social .social-button {position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;width:5.4rem;height:5.4rem;min-width:5.4rem;padding:2rem;border:0;border-radius:1.5rem;background:#fff;color:#1a1a1a;font:inherit;line-height:1;cursor:pointer;scale:1;transition:scale .3s cubic-bezier(.075,.82,.165,1);}
.source-social .social-button:hover {transform:none;}
.source-social .source-social-toggle {will-change:transform;}
.source-social .source-social-open {background:#000;color:#fff;border-radius:2.7rem;}
.source-social-icon-mask {position:relative;width:2rem;height:2rem;overflow:hidden;}
.source-social-toggle-icon {position:absolute;inset:0;display:flex;align-items:center;justify-content:center;will-change:transform,opacity;}
.source-social-links {position:absolute;left:100%;top:0;display:flex;gap:.4rem;margin-left:.4rem;pointer-events:none;will-change:opacity;}
.source-social-links-open {pointer-events:auto;}
.source-contact-slot {position:relative;}
.source-contact {transform-origin:50% 50%;will-change:transform,opacity,filter;}
.source-email-tooltip {position:absolute;top:calc(100% + .8rem);left:50%;translate:-50% 0;pointer-events:none;white-space:nowrap;font-size:1.2rem;line-height:1;color:#1a1a1a;opacity:0;transition:opacity .2s ease-out;}
.source-email-tooltip-visible {opacity:1;}
.source-copy-toast {position:fixed;bottom:2.4rem;left:50%;translate:-50% 0;z-index:9999;min-height:4.8rem;max-width:calc(100vw - 3.2rem);width:19.1rem;padding:0 2.4rem;display:flex;align-items:center;justify-content:center;border-radius:1rem;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.08);font-family:'Suisse Intl',sans-serif;font-size:1.4rem;color:#1a1a1a;}
@media (hover:hover) {.source-social .social-button:hover {scale:1.037;}}
.source-social .social-button:active {scale:.97;}
.source-social .social-button:focus-visible {outline:2px solid #1a1a1a;outline-offset:2px;}
@media (max-width:768px) {.source-copy-toast {top:calc(env(safe-area-inset-top) + 2rem);bottom:auto;}}
@media (prefers-reduced-motion:reduce) {.source-social,.source-social .social-button,.source-email-tooltip {transition:none;}}
</style>
