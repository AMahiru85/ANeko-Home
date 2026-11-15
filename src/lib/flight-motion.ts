// Flight parameters recovered from the site's TravelPage chunk with REA.
export const FLIGHT = { delay: 400, duration: 1450, scale: .3, restZ: -1.15, cameraZ: 4.9, cameraY: -.43, fov: 38, lookY: -.7, verticalTravel: .27 } as const;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const damp = (value: number, target: number, rate: number, dt: number) => target + (value - target) * Math.exp(-rate * dt);
export const smooth = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const smoother = (value: number) => { const t = clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function pointerInput(value: number) { const n = Math.abs(value); return clamp(n <= .03 ? 0 : (n - .03) / .97 * Math.sign(value), -.88, .88); }

export class FlightSpring {
  x = 0; v = 0;
  constructor(value = 0) { this.x = value; }
  step(target: number, dt: number, hz: number, damping = 1) {
    const t = clamp(dt, 0, .05), w = Math.max(.0001, hz) * Math.PI * 2;
    const a = 1 + 2 * t * Math.max(0, damping) * w, b = t * w * w, c = t * b;
    const x = (a * this.x + t * this.v + c * target) / (a + c);
    this.v = (this.v + b * (target - this.x)) / (a + c); this.x = x; return x;
  }
}

export class FlightMotion {
  target = 0; scroll = 0; velocity = 0; direction = 1; time = 0;
  pointerX = 0; pointerY = 0;
  followX = new FlightSpring(); followY = new FlightSpring();
  bank = new FlightSpring(); pitch = new FlightSpring();
  pressure = new FlightSpring(); speed = new FlightSpring();
  scrollBank = new FlightSpring(); scrollPitch = new FlightSpring(); size = new FlightSpring(1);
  swayX = 0; swayBank = 0; swaySize = 1;
  private country = -1; private countryAt = -100; private lastCountryAt = -100;
  setPointer(x: number, y: number) {
    this.pointerX = x; this.pointerY = y;
  }
  move(delta: number) {
    if (delta && Math.sign(delta) !== this.direction) this.direction *= -1;
    this.target += delta * .0115;
  }
  changeCountry(index: number) {
    if (index !== this.country) { if (this.country !== -1 && this.time - this.lastCountryAt > 4.1) { this.countryAt = this.time + .42; this.lastCountryAt = this.time; } this.country = index; }
  }
  step(dt: number, viewportWidth: number, viewportHeight: number, mobile: boolean, reduced: boolean) {
    dt = clamp(dt, 0, .05); this.time += dt;
    this.target += reduced ? 0 : 1.4 * dt * this.direction;
    const before = this.scroll; this.scroll = damp(this.scroll, this.target, 7, dt);
    this.velocity = clamp(damp(this.velocity, dt ? (this.scroll - before) / dt : 0, 7, dt), -44, 44);
    // Keep the original travel range and normalize turn velocity independently.
    const px = viewportWidth * .2 * .58, py = viewportHeight * .2 * 2 * FLIGHT.verticalTravel;
    // Preserve the original continuous spring integration, including velocity.
    // Outside the window the last pointer target stays in place, so the plane
    // eases to rest there without snapping or returning to the screen center.
    this.followX.step(!mobile && !reduced ? this.pointerX * px : 0, dt, .486, 1.2);
    this.followY.step(!mobile && !reduced ? this.pointerY * py : 0, dt, .486, 1.2);
    const turnX = Math.tanh(this.followX.v / Math.max(px, .00001) * 1.1);
    const turnY = Math.tanh(this.followY.v / Math.max(py, .00001) * 1.1 * .82);
    const targetBank = -turnX * .59, attack = Math.abs(targetBank) > Math.abs(this.bank.x) + .0001;
    this.bank.step(targetBank, dt, attack ? .9 : 1.55, 1.12);
    this.pitch.step(turnY * .59 * .08, dt, 1.9375, 1.15);
    const pressure = clamp(this.pressure.step(smooth(Math.abs(this.velocity) * .118), dt, 1.6325, 1.05), 0, 1);
    this.speed.step(Math.abs(this.velocity) < .02 ? 0 : Math.tanh(this.velocity * .085), dt, 1.15, 1.15);
    const h = this.time * .73, wiggle = h * 1.15;
    this.scrollBank.step(clamp(this.speed.v * .085, -.12, .12) + pressure * (Math.sin(h * .52) * .038 + Math.sin(h * .91 + 1.2) * .016), dt, 2.1);
    this.scrollPitch.step(-pressure * .028 - clamp(this.pressure.v * .012, -.04, .04) + pressure * Math.sin(h * .68 + .4) * .012, dt, 1.9, 1.05);
    this.size.step(mix(1, .84, pressure), dt, 1.3, 1.1);
    const elapsed = this.time - this.countryAt;
    const sway = elapsed >= 0 && elapsed < 4.1 ? smoother(elapsed / 4.1) : 0;
    const arc = Math.sin(Math.PI * sway), angle = Math.PI * 2 * sway, cos = Math.cos(angle);
    this.swayX = damp(this.swayX, .8 * Math.sin(angle), 12, dt);
    this.swayBank = damp(this.swayBank, (cos >= 0 ? -.57 : -.59) * cos * arc, 13, dt);
    this.swaySize = damp(this.swaySize, mix(1, .76, arc), 11, dt);
    const progress = reduced ? 1 : clamp((this.time * 1000 - FLIGHT.delay) / FLIGHT.duration, 0, 1), entry = 1 - (1 - progress) ** 2.4;
    const wind = mix(1, .42, pressure), shake = mix(1, .22, pressure);
    const windX = (Math.sin(h * 1.85) * .045 + Math.sin(h * .73) * .018) * mix(1, .56, arc * arc);
    const windY = Math.sin(h * 1.42) * .035 + Math.cos(h * .61) * .015;
    const wiggleX = .9 * (Math.sin(wiggle * 4.23 + .6) * .018 + Math.cos(wiggle * 8.15) * .009);
    const wiggleY = .9 * (Math.sin(wiggle * 3.95) * .012 + Math.sin(wiggle * 7.4 + .3) * .006);
    const wiggleZ = .9 * (Math.sin(wiggle * 3.71) * .024 + Math.sin(wiggle * 6.47 + 1.1) * .014 + Math.sin(wiggle * 11.3) * .007);
    const jitterX = .9 * .014 * (Math.sin(wiggle * 4.35) * .55 + Math.sin(wiggle * 7.8 + .5) * .35);
    const jitterY = .9 * .011 * (Math.sin(wiggle * 3.6 + .2) * .5 + Math.cos(wiggle * 6.9) * .3);
    return {
      visible: reduced || this.time * 1000 >= FLIGHT.delay, progress,
      followX: this.followX.x, followY: this.followY.x,
      x: mix(0, windX * wind + pressure * (Math.sin(h * .44) * .022 + Math.sin(h * .97 + .8) * .01), entry) + this.swayX + jitterX * shake,
      y: mix(-6.16, windY * wind + pressure * (Math.sin(h * .78) * .018 + Math.sin(h * 1.35 + .6) * .007), entry) - .1 + jitterY * shake,
      z: mix(-1.75, FLIGHT.restZ, entry),
      rx: mix(.78, Math.sin(h * 1.22) * .055 * 1.6 * wind + wiggleX * shake + this.scrollPitch.x + this.pitch.x, entry),
      ry: mix(0, Math.sin(h * .88) * .035 * 1.6 * wind + wiggleY * shake, entry),
      rz: mix(0, Math.sin(h * 1.68) * .085 * 1.6 * wind + this.swayBank + wiggleZ * shake + this.scrollBank.x + this.bank.x, entry),
      scale: FLIGHT.scale * clamp(this.size.x, .5, 1.15) * this.swaySize,
      trail: reduced ? 0 : clamp(Math.sin(progress * Math.PI) + pressure * .55 + arc + Math.abs(turnX) * .92 + Math.abs(turnY) * .28, 0, 1),
    };
  }
}
