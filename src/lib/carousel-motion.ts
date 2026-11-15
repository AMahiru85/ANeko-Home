export const cubic = (x1: number, y1: number, x2: number, y2: number) => (p: number) => {
  if (p <= 0 || p >= 1) return Math.max(0, Math.min(1, p));
  const curve = (t: number, a: number, b: number) => 3*a*(1-t)**2*t + 3*b*(1-t)*t*t + t**3;
  let low = 0, high = 1;
  for (let i=0;i<24;i++) { const mid=(low+high)/2; if(curve(mid,x1,x2)<p) low=mid; else high=mid; }
  return curve((low+high)/2,y1,y2);
};
export const easeOutTest = cubic(.32,0,0,1);
export const opacityEase = cubic(.25,.1,.35,1);
export type SpringParameters = { stiffness: number; damping: number; mass: number };
export const CAROUSEL_SPRING: SpringParameters = { stiffness: 190, damping: 18, mass: 1 };
export const CARD_MAGNET = {
  strength: .095, radius: 325, repel: true, falloffExponent: 1.1,
  spring: { stiffness: 70, damping: 24, mass: .28 },
  releaseSpring: { stiffness: 140, damping: 26, mass: .14 },
};

// zP -> VP in the captured bundle: smoothstep attenuation, then exponent.
export function cardMagneticTarget(dx: number, dy: number) {
  const distance = Math.hypot(dx, dy);
  if (distance >= CARD_MAGNET.radius) return { x: 0, y: 0, inRadius: false };
  const remaining = Math.max(0, 1 - distance / CARD_MAGNET.radius);
  const falloff = Math.pow(remaining * remaining * (3 - 2 * remaining), CARD_MAGNET.falloffExponent);
  let x = -dx * CARD_MAGNET.strength * falloff;
  let y = -dy * CARD_MAGNET.strength * falloff;
  const maximum = CARD_MAGNET.radius * CARD_MAGNET.strength;
  const length = Math.hypot(x, y);
  if (length > maximum) { x *= maximum / length; y *= maximum / length; }
  return { x, y, inRadius: true };
}

// Original h7 ignores duration/bounce when stiffness/damping/mass are explicit.
export class MotionNumber {
  value: number; target: number; velocity=0; moving=false;
  private start: number; private initialVelocity=0; private elapsed=0;
  private tweenDuration=0; private ease=easeOutTest; private mode='spring';
  private granular=false;
  private parameters: SpringParameters = CAROUSEL_SPRING;
  constructor(value: number) { this.value=this.target=this.start=value; }
  set(value: number) { this.value=this.target=this.start=value; this.velocity=0; this.moving=false; }
  spring(target: number, parameters = CAROUSEL_SPRING, restart = false) {
    if(!restart && this.moving && this.mode==='spring' && this.target===target && this.parameters===parameters) return;
    this.start=this.value; this.initialVelocity=this.velocity; this.target=target;
    this.parameters=parameters;
    this.elapsed=0; this.mode='spring'; this.granular=Math.abs(target-this.start)<5;
    this.moving=this.start!==target || this.velocity!==0;
  }
  stop() { this.moving=false; }
  tween(target: number, seconds: number, ease=easeOutTest) {
    // Motion only starts an animation when its target changes. In particular,
    // stage 4 must not restart the unchanged positive side of the intro stack.
    if(this.mode==='tween' && this.target===target) return;
    this.start=this.value; this.target=target; this.elapsed=0;
    this.tweenDuration=seconds; this.ease=ease; this.mode='tween';
    this.moving=this.start!==target; if(seconds<=0) this.set(target);
  }
  private sample(t: number) {
    const { stiffness, damping, mass } = this.parameters;
    const omega = Math.sqrt(stiffness / mass);
    const alpha = damping / (2 * mass);
    const ratio = damping / (2 * Math.sqrt(stiffness * mass));
    const delta = this.start - this.target;
    if (ratio < 1) {
      const frequency = omega * Math.sqrt(1 - ratio * ratio);
      return this.target + Math.exp(-alpha * t) * (delta * Math.cos(frequency * t) + (this.initialVelocity + alpha * delta) / frequency * Math.sin(frequency * t));
    }
    if (ratio === 1) return this.target + Math.exp(-omega * t) * (delta + (this.initialVelocity + omega * delta) * t);
    const frequency = omega * Math.sqrt(ratio * ratio - 1);
    const hyperbolicTime = Math.min(frequency * t, 300);
    return this.target + Math.exp(-alpha * t) * (delta * Math.cosh(hyperbolicTime) + (this.initialVelocity + alpha * delta) / frequency * Math.sinh(hyperbolicTime));
  }
  step(dt: number) {
    if(!this.moving || dt<=0) return;
    const previous=this.value; this.elapsed+=dt;
    if(this.mode==='tween') {
      const p=Math.min(1,this.elapsed/this.tweenDuration);
      this.value=this.start+(this.target-this.start)*this.ease(p); this.moving=p<1;
    } else {
      this.value=this.sample(this.elapsed);
      const before=Math.max(0,this.elapsed-.005);
      const { stiffness, damping, mass } = this.parameters;
      const underdamped = damping / (2 * Math.sqrt(stiffness * mass)) < 1;
      const speed=underdamped ? Math.abs((this.value-this.sample(before))/(this.elapsed-before)) : 0;
      this.moving=speed>(this.granular?.01:2)||Math.abs(this.target-this.value)>(this.granular?.005:.5);
      if(!this.moving) this.value=this.target;
    }
    this.velocity=this.moving?(this.value-previous)/dt:0;
  }
}
export type ProjectPlaybackState = { version:1; slug:string; src:string; currentTime:number; recordedAt:number; scrollCursor:number; mobile:boolean };
export const PROJECT_PLAYBACK_KEY='gabriel:project-playback:v1';
const canonicalPreviewSrc=(src:string)=>{try{return new URL(src,location.href).href}catch{return src}}
declare global { interface Window { __gabrielCarouselCursor?: number; } }
