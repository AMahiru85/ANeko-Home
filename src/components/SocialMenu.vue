<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import ButtonIcon from './ButtonIcon.vue';
import ButtonMagnet from './ButtonMagnet.vue';
import { BUTTON_ROTATE_SPRING, EASE_OUT_CUBIC, useButtonMotion } from '../lib/button-motion';
import { subscribeHomeIntro } from '../lib/home-intro';

const open=ref(false),renderContacts=ref(false),mobile=ref(false),emailHover=ref(false);
const wrapper=ref<HTMLElement|null>(null);
const introElement=ref<HTMLElement|null>(null);
const contactRow=ref<HTMLElement|null>(null),chatIcon=ref<HTMLElement|null>(null),closeIcon=ref<HTMLElement|null>(null);
const introOpacity=ref(0),introY=ref(28);
const rotate=useButtonMotion(0),rowShift=useButtonMotion(0);
const email='gbeaugonin@gmail.com';
const itemMotion=[0,1,2].map(()=>({x:useButtonMotion(-10),rotate:useButtonMotion(80),scale:useButtonMotion(.8),opacity:useButtonMotion(0),blur:useButtonMotion(2)}));
const contacts=computed(()=>[
  {name:mobile.value?'Send email':'Copy email',icon:'email' as const,href:'mailto:'+email},
  {name:'X (Twitter)',icon:'x' as const,href:'https://x.com/gabrielbgnn'},
  {name:'LinkedIn',icon:'linkedin' as const,href:'https://www.linkedin.com/in/gbeaugonin/'},
]);
let parent:HTMLElement|null=null,previousTranslate='',closeTimer=0,toastTimer=0,toggleGeneration=0;
let activeRowAnimation:Animation|undefined;
let contactOpacityAnimation:Animation|undefined;
const iconAnimations=new Map<HTMLElement,Animation>();
let introAnimation:Animation|undefined;
let stopIntro=()=>{};
let lastIntroVisible:boolean|undefined;
const toast=ref('');
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const rootSize=()=>Number.parseFloat(getComputedStyle(document.documentElement).fontSize)||10;
const itemStyle=(index:number)=>{
  const item=itemMotion[index];
  return {transform:'translateX('+item.x.value.value+'px) rotateY('+item.rotate.value.value+'deg) scale('+item.scale.value.value+')',opacity:Math.max(0,Math.min(1,item.opacity.value.value)),filter:'blur('+Math.max(0,item.blur.value.value)+'px)'};
};
const animateToggleIcon=(node:HTMLElement|null,visible:boolean)=>{
  if(!node)return;
  const current=getComputedStyle(node);
  const from={transform:current.transform,opacity:current.opacity};
  const to={transform:'scale('+(visible?1:.5)+')',opacity:visible?'1':'0'};
  iconAnimations.get(node)?.cancel();
  Object.assign(node.style,to);
  if(reduced()){iconAnimations.delete(node);return;}
  const animation=node.animate([from,to],{duration:250,easing:EASE_OUT_CUBIC,fill:'both'});
  iconAnimations.set(node,animation);
  animation.onfinish=()=>{if(iconAnimations.get(node)!==animation)return;iconAnimations.delete(node);animation.cancel();};
};
const animateContactOpacity=(visible:boolean)=>{
  const node=contactRow.value;
  if(!node)return;
  const from=getComputedStyle(node).opacity;
  contactOpacityAnimation?.cancel();
  node.style.opacity=visible?'1':'0';
  if(reduced())return;
  // The row's variant defines an x transition, leaving opacity on Motion's easeOut fallback.
  const animation=node.animate([{opacity:from},{opacity:visible?1:0}],{duration:300,easing:'ease-out',fill:'both'});
  contactOpacityAnimation=animation;
  animation.onfinish=()=>{if(contactOpacityAnimation!==animation)return;contactOpacityAnimation=undefined;animation.cancel();};
};
const updateRowShift=()=>{
  const shift=mobile.value&&open.value?-8.7*rootSize():0;
  const current=parent?getComputedStyle(parent).translate.split(' ')[0]:'0';
  const start=Number.parseFloat(current)||rowShift.value.value;
  rowShift.motion.stop();
  if(reduced()){rowShift.motion.set(shift);parent?.style.setProperty('translate',shift+'px 0');return;}
  if(parent){
    const animation=parent.animate([{translate:start+'px 0'},{translate:shift+'px 0'}],{duration:450,easing:EASE_OUT_CUBIC,fill:'both'});
    animation.onfinish=()=>{rowShift.motion.set(shift);parent?.style.setProperty('translate',shift+'px 0');animation.cancel();};
    activeRowAnimation?.cancel();activeRowAnimation=animation;
  }
};
watch(open,async(value)=>{
  const generation=++toggleGeneration;
  clearTimeout(closeTimer);
  animateToggleIcon(chatIcon.value,!value);
  animateToggleIcon(closeIcon.value,value);
  rotate.motion.spring(value?-90:0,BUTTON_ROTATE_SPRING);
  updateRowShift();
  if(value){
    renderContacts.value=true;
    await nextTick();
    if(generation!==toggleGeneration)return;
    animateContactOpacity(true);
    itemMotion.forEach((item,index)=>{
      if(index>0)[item.x,item.rotate,item.scale,item.opacity,item.blur].forEach(value=>{value.motion.velocity=0;});
      if(!mobile.value){item.rotate.motion.spring(0,{stiffness:200,damping:17},index*.05);item.scale.motion.spring(1,{stiffness:200,damping:17},index*.05);item.blur.motion.spring(0,{stiffness:200,damping:17},index*.05);}
      else{item.rotate.motion.set(0);item.scale.motion.set(1);item.blur.motion.set(0);}
      item.x.motion.spring(0,{stiffness:200,damping:17},index*.05);
      item.opacity.motion.spring(1,{stiffness:200,damping:17},index*.05);
    });
  }else{
    animateContactOpacity(false);
    itemMotion.forEach((item,index)=>{
      const delay=(2-index)*.05;
      if(delay>0)[item.x,item.rotate,item.scale,item.opacity,item.blur].forEach(value=>{value.motion.velocity=0;});
      item.x.motion.spring(-10,{stiffness:200,damping:17},delay);
      item.opacity.motion.spring(0,{stiffness:200,damping:17},delay);
      item.rotate.motion.spring(mobile.value?0:80,{stiffness:200,damping:17},delay);
      item.scale.motion.spring(mobile.value?1:.8,{stiffness:200,damping:17},delay);
      item.blur.motion.spring(mobile.value?0:2,{stiffness:200,damping:17},delay);
    });
    closeTimer=window.setTimeout(()=>{if(!open.value)renderContacts.value=false;},1100);
  }
});
const resize=()=>{
  const wasMobile=mobile.value;mobile.value=window.innerWidth<=768;
  if(wasMobile!==mobile.value){updateRowShift();if(!open.value)itemMotion.forEach(item=>{item.rotate.motion.set(mobile.value?0:80);item.scale.motion.set(mobile.value?1:.8);item.blur.motion.set(mobile.value?0:2);});}
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
onMounted(()=>{
  parent=wrapper.value?.closest<HTMLElement>('.intro-actions')??wrapper.value?.parentElement??null;
  previousTranslate=parent?.style.translate??'';
  resize();window.addEventListener('resize',resize);
  stopIntro=subscribeHomeIntro((snapshot)=>{void nextTick(()=>syncHomeIntro(snapshot));});
});
onUnmounted(()=>{
  stopIntro();introAnimation?.cancel();
  contactOpacityAnimation?.cancel();iconAnimations.forEach(animation=>animation.cancel());iconAnimations.clear();
  window.removeEventListener('resize',resize);clearTimeout(closeTimer);clearTimeout(toastTimer);activeRowAnimation?.cancel();
  if(parent)parent.style.translate=previousTranslate;
});
</script>

<template>
  <div ref="wrapper" class="social-wrap source-social">
    <div ref="introElement" class="source-social-intro" :style="{opacity:introOpacity,transform:'translateY('+introY+'px)'}">
      <ButtonMagnet>
        <button class="social-button source-social-toggle" :class="{'source-social-open':open}" type="button" :style="{transform:'rotate('+rotate.value.value+'deg)'}" :aria-expanded="open" :aria-label="open?'Close Social Links':'Open Social Links'" @click="open=!open">
          <span class="source-social-icon-mask" aria-hidden="true">
            <span ref="chatIcon" data-icon="chat" class="source-social-toggle-icon" style="transform:scale(1);opacity:1"><ButtonIcon name="chat" color="#1a1a1a" /></span>
            <span ref="closeIcon" data-icon="close" class="source-social-toggle-icon" style="transform:scale(.5);opacity:0"><ButtonIcon name="close" color="#fff" /></span>
          </span>
        </button>
      </ButtonMagnet>
    </div>
    <div v-if="renderContacts" ref="contactRow" class="source-social-links" :class="{'source-social-links-open':open}" :aria-hidden="!open" style="opacity:0">
      <div v-for="(contact,index) in contacts" :key="contact.icon" class="source-contact-motion" :style="itemStyle(index)">
        <ButtonMagnet>
          <button v-if="contact.icon==='email'&&!mobile" class="social-button source-contact" type="button" :aria-label="contact.name" :tabindex="open?0:-1" @mouseenter="emailHover=true" @mouseleave="emailHover=false" @click="copyEmail"><ButtonIcon name="email" /></button>
          <a v-else class="social-button source-contact" :href="contact.href" :aria-label="contact.name" :tabindex="open?0:-1" :target="contact.icon==='email'?undefined:'_blank'" :rel="contact.icon==='email'?undefined:'noreferrer'"><ButtonIcon :name="contact.icon" /></a>
          <span v-if="contact.icon==='email'&&!mobile" class="source-email-tooltip" :class="{'source-email-tooltip-visible':emailHover}">click to copy</span>
        </ButtonMagnet>
      </div>
    <Teleport v-if="toast" to="body"><div class="source-copy-toast" role="status">{{toast}}</div></Teleport>
    </div>
  </div>
</template>

<style scoped>
.source-social {position:relative;width:5.4rem;height:5.4rem;flex-shrink:0;}
.source-social-intro {position:relative;width:5.4rem;height:5.4rem;will-change:transform,opacity;}
.source-social .social-button {position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;width:5.4rem;height:5.4rem;min-width:5.4rem;padding:2rem;border:0;border-radius:1.5rem;background:#fff;color:#1a1a1a;font:inherit;line-height:1;cursor:pointer;scale:1;transition:border-radius .28s cubic-bezier(.785,.135,.15,.86),background-color .3s cubic-bezier(.785,.135,.15,.86),scale .3s cubic-bezier(.075,.82,.165,1);}
.source-social .social-button:hover {transform:none;}
.source-social .source-social-toggle {will-change:transform;}
.source-social .source-social-open {background:#1a1a1a;color:#fff;border-radius:2.7rem;}
.source-social-icon-mask {position:relative;width:2rem;height:2rem;overflow:hidden;}
.source-social-toggle-icon {position:absolute;inset:0;display:flex;align-items:center;justify-content:center;will-change:transform,opacity;}
.source-social-links {position:absolute;left:100%;top:0;display:flex;gap:.4rem;margin-left:.4rem;pointer-events:none;will-change:opacity;}
.source-social-links-open {pointer-events:auto;}
.source-contact-motion {position:relative;transform-origin:50% 50%;will-change:transform,opacity,filter;}
.source-email-tooltip {position:absolute;top:calc(100% + .8rem);left:50%;translate:-50% 0;pointer-events:none;white-space:nowrap;font-size:1.2rem;line-height:1;color:#1a1a1a;opacity:0;transition:opacity .2s ease-out;}
.source-email-tooltip-visible {opacity:1;}
.source-copy-toast {position:fixed;bottom:2.4rem;left:50%;translate:-50% 0;z-index:9999;min-height:4.8rem;max-width:calc(100vw - 3.2rem);width:19.1rem;padding:0 2.4rem;display:flex;align-items:center;justify-content:center;border-radius:1rem;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.08);font-family:'Suisse Intl',sans-serif;font-size:1.4rem;color:#1a1a1a;}
@media (hover:hover) {.source-social .social-button:hover {scale:1.037;}}
.source-social .social-button:active {scale:.97;}
.source-social .social-button:focus-visible {outline:2px solid #1a1a1a;outline-offset:2px;}
@media (max-width:768px) {.source-copy-toast {top:calc(env(safe-area-inset-top) + 2rem);bottom:auto;}}
@media (prefers-reduced-motion:reduce) {.source-social .social-button,.source-email-tooltip {transition:none;}}
</style>
