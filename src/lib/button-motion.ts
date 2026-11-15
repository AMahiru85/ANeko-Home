import { onMounted, onUnmounted, ref, type Ref } from 'vue';

export type ButtonSpring = { stiffness:number; damping:number; mass?:number };
const sample = (elapsed:number, initial:number, target:number, velocity:number, config:ButtonSpring) => {
  const mass=config.mass ?? 1;
  const alpha=config.damping/(2*mass), omegaSquared=config.stiffness/mass;
  const displacement=initial-target;
  const discriminant=alpha*alpha-omegaSquared;
  if(discriminant < -1e-8) {
    const frequency=Math.sqrt(-discriminant), angle=frequency*elapsed;
    return target+Math.exp(-alpha*elapsed)*(displacement*Math.cos(angle)+(velocity+alpha*displacement)/frequency*Math.sin(angle));
  }
  if(discriminant > 1e-8) {
    const root=Math.sqrt(discriminant), r1=-alpha+root, r2=-alpha-root;
    const a=(velocity-r2*displacement)/(r1-r2), b=displacement-a;
    return target+a*Math.exp(r1*elapsed)+b*Math.exp(r2*elapsed);
  }
  return target+Math.exp(-alpha*elapsed)*(displacement+(velocity+alpha*displacement)*elapsed);
};

// Equivalent physical spring parameters are recovered from wI/kr in the shipped bundle.
export class ButtonMotionValue {
  value:number;
  velocity=0;
  private target:number;
  private frame=0;
  private generation=0;
  constructor(value:number,private update:(value:number)=>void) { this.value=this.target=value; }
  set(value:number) { this.stop();this.value=this.target=value;this.velocity=0;this.update(value); }
  stop() { this.generation+=1;cancelAnimationFrame(this.frame);this.frame=0; }
  spring(target:number,config:ButtonSpring,delay=0,onFinish?:()=>void) {
    this.stop();
    this.target=target;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.set(target);onFinish?.();return;}
    const initial=this.value,initialVelocity=this.velocity,generation=this.generation;
    const start=performance.now()+delay*1000;
    const granular=Math.abs(target-initial)<5;
    const step=(now:number)=>{
      if(generation!==this.generation)return;
      const elapsed=(now-start)/1000;
      if(elapsed<0){this.frame=requestAnimationFrame(step);return;}
      this.value=sample(elapsed,initial,target,initialVelocity,config);
      const before=Math.max(0,elapsed-.005);
      this.velocity=elapsed>before?(this.value-sample(before,initial,target,initialVelocity,config))/(elapsed-before):initialVelocity;
      const moving=Math.abs(this.velocity)>(granular?.01:2)||Math.abs(target-this.value)>(granular?.005:.5);
      this.update(this.value);
      if(moving)this.frame=requestAnimationFrame(step);
      else{this.value=target;this.velocity=0;this.update(target);this.frame=0;onFinish?.();}
    };
    this.frame=requestAnimationFrame(step);
  }
}

export function useButtonMotion(initial:number) {
  const value=ref(initial);
  const motion=new ButtonMotionValue(initial,next=>{value.value=next;});
  onUnmounted(()=>motion.stop());
  return {value,motion};
}

export function useButtonMagnet(element:Ref<HTMLElement|null>) {
  const x=useButtonMotion(0),y=useButtonMotion(0);
  const spring={stiffness:150,damping:12,mass:.1};
  const release={stiffness:160,damping:26,mass:.14};
  let inRadius=false;
  const reset=()=>{
    if(!inRadius)return;
    inRadius=false;x.motion.spring(0,release);y.motion.spring(0,release);
  };
  const move=(event:MouseEvent)=>{
    if(window.innerWidth<=768){reset();return;}
    if(!element.value)return;
    const rect=element.value.getBoundingClientRect();
    const dx=event.clientX-(rect.left+rect.width/2),dy=event.clientY-(rect.top+rect.height/2);
    const distance=Math.hypot(dx,dy);
    if(distance>=40){reset();return;}
    const fraction=Math.max(0,1-distance/40);
    const falloff=fraction*fraction*(3-2*fraction);
    inRadius=true;
    x.motion.spring(dx*.15*falloff,spring);y.motion.spring(dy*.15*falloff,spring);
  };
  onMounted(()=>{
    window.addEventListener('mousemove',move);
    document.documentElement.addEventListener('mouseleave',reset);
  });
  onUnmounted(()=>{
    window.removeEventListener('mousemove',move);
    document.documentElement.removeEventListener('mouseleave',reset);
  });
  return {x:x.value,y:y.value};
}

export const BUTTON_LAYOUT_SPRING={stiffness:320,damping:34};
export const BUTTON_ROTATE_SPRING={stiffness:200,damping:20};
export const EASE_OUT_CUBIC='cubic-bezier(.215,.61,.355,1)';
export const EASE_IN_OUT_CIRC='cubic-bezier(.785,.135,.15,.86)';
