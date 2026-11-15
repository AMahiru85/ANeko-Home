import countries from '../data/travel-countries.json';
import defaults from '../data/travel-defaults.json';
import { FLIGHT, FlightMotion, clamp, smooth, pointerInput } from './flight-motion';
import type * as Three from 'three';

type Card = (typeof countries)[number]['cards'][number];
type Photo = { mesh: Three.Mesh<Three.PlaneGeometry, Three.ShaderMaterial>; card: Card; group: number; aspect: number };
type Point = { x: number; y: number; life: number };
const modulo = (n: number, total: number) => ((n % total) + total) % total;
const range = (a: number, b: number, x: number) => smooth((x - a) / (b - a));

export function startTravelFlight(canvas: HTMLCanvasElement, trails: HTMLCanvasElement, root: HTMLElement, onCountry: (code: string[], name: string) => void, onError: () => void) {
  let disposed = false, release = () => {};
  const motion = new FlightMotion();
  void initialize().catch(() => { if (!disposed) onError(); });
  async function initialize() {
    const [THREE, { GLTFLoader }] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]);
    if (disposed) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: devicePixelRatio < 1.5 });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.autoClear = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
    const gallery = new THREE.Scene(), scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 100); camera.position.z = 7.5;
    const planeCamera = new THREE.PerspectiveCamera(FLIGHT.fov, 1, .1, 100);
    planeCamera.position.set(0, FLIGHT.cameraY, FLIGHT.cameraZ); planeCamera.lookAt(0, FLIGHT.lookY, 0);
    scene.add(new THREE.AmbientLight(0xfaf8f5, .85));
    const light = new THREE.DirectionalLight(0xffffff, 1.35); light.position.set(2, 8, 6); scene.add(light);
    // Match Tu: world-space mouse follow belongs to the layout parent.
    const planeLayout = new THREE.Group(); scene.add(planeLayout);
    const plane = new THREE.Group(); planeLayout.add(plane);
    const planeMaterial = new THREE.MeshPhongMaterial({ color: '#f0eeeb', specular: '#888888', shininess: 18 });
    const modelGeometries = new Set<Three.BufferGeometry>();
    const originalMaterials = new Set<Three.Material>();
    let modelReady = false, frame = 0, last = performance.now(), width = 1, height = 1, mobile = false, rem = 10;
    let planeWidth = 1, planeHeight = 1, planeLeft = 0, active = -1, dragging = false, pointerId = -1;
    let downX = 0, downY = 0, previousY = 0, downAt = 0, trailTime = 0, lastProof = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const textures = new Map<string, { texture: Three.Texture; aspect: number }>();
    const pending = new Set<string>(), photos = new Map<string, Photo>();
    const geometry = new THREE.PlaneGeometry(1, 1, 26, 26);
    const textureLoader = new THREE.TextureLoader();
    const ctx = trails.getContext('2d');
    const leftTrail: Point[] = [], rightTrail: Point[] = [];
    let wingLeft = new THREE.Vector3(-1, 0, 0), wingRight = new THREE.Vector3(1, 0, 0);
    const wingPosition = new THREE.Vector3();
    const variant = () => mobile ? 'mobile' : 'desktop';
    const tuning = () => defaults[variant()];
    const spacing = () => countries.map(country => country.groupSpacing[variant()]);
    const anchor = (index: number) => { const s = spacing(), cycle = s.reduce((a, b) => a + b, 0), n = modulo(index, s.length); return Math.floor(index / s.length) * cycle + s.slice(0, n).reduce((a, b) => a + b, 0); };
    const nearest = () => {
      const s = spacing(), average = s.reduce((a, b) => a + b, 0) / s.length;
      const approx = Math.round((motion.scroll - 6 - .25) / average);
      let best = approx, distance = Infinity;
      for (let i = approx - 5; i <= approx + 5; i++) { const d = Math.abs(-6 + motion.scroll - anchor(i) - .25); if (d < distance) { distance = d; best = i; } }
      return best;
    };
    function loadPhoto(card: Card) {
      if (pending.has(card.imageUrl) || textures.has(card.imageUrl) || disposed) return;
      pending.add(card.imageUrl);
      const url = new URL(card.imageUrl); url.searchParams.set('w', mobile ? '700' : '1100'); url.searchParams.set('q', '80');
      textureLoader.load(url.href, texture => {
        pending.delete(card.imageUrl);
        if (disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        textures.set(card.imageUrl, { texture, aspect: texture.image.width / texture.image.height });
      }, undefined, () => pending.delete(card.imageUrl));
    }
    function createPhoto(card: Card, group: number) {
      const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, uniforms: { map: { value: null }, opacity: { value: 0 }, fogAmount: { value: 0 }, velocity: { value: 0 }, loaded: { value: 0 } },
        vertexShader: 'varying vec2 vUv; uniform float velocity; void main(){vUv=uv;vec3 p=position;p.z-=pow(abs(uv.y-.5)*2.,2.)*velocity*.05;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
        fragmentShader: 'varying vec2 vUv;uniform sampler2D map;uniform float opacity;uniform float fogAmount;uniform float loaded;void main(){vec3 color=vec3(.92);if(loaded>.5)color=texture2D(map,vUv).rgb;gl_FragColor=vec4(mix(color,vec3(1.),fogAmount),opacity);#include <colorspace_fragment>}',
      });
      // Shader chunks must start on their own preprocessor line.
      material.fragmentShader = material.fragmentShader.replace(';#include', ';\n#include').replace('fragment>}', 'fragment>\n}');
      const mesh = new THREE.Mesh(geometry, material); gallery.add(mesh); return { mesh, card, group, aspect: 1 };
    }
    function updateGallery() {
      const t = tuning(), near = nearest(), keep = new Set<string>();
      const worldH = 2 * Math.tan(THREE.MathUtils.degToRad(18)) * 7.5, worldW = worldH * width / height;
      let selected = modulo(near, countries.length), selectedDistance = Infinity;
      for (let group = near - 2; group <= near + 4; group++) {
        const country = countries[modulo(group, countries.length)];
        const base = -6 + motion.scroll - anchor(group);
        const trigger = base + Math.min(...country.cards.map(card => card.flowOffset)) * t.flow.cardSpread * .42;
        if (Math.abs(trigger - .25) < selectedDistance) { selectedDistance = Math.abs(trigger - .25); selected = modulo(group, countries.length); }
        country.cards.forEach(card => {
          const key = group + ':' + card.id; keep.add(key);
          let photo = photos.get(key); if (!photo) { photo = createPhoto(card, group); photos.set(key, photo); }
          const relative = clamp((base + card.flowOffset * t.flow.cardSpread + 22) / 30.8, 0, 1);
          const center = clamp((base + 22) / 30.8, 0, 1);
          const z = base + card.flowOffset * t.flow.cardSpread + (relative - .5) * t.flow.groupParallax * card.depthTravel + (center - .5) * country.groupSpacing[variant()] * card.flowSpeedBias * t.flow.groupSpeedVariance * .36;
          photo.mesh.visible = z >= -22 && z <= 7.3;
          if (!photo.mesh.visible) return;
          if (group >= near - 1 && group <= near + 2) loadPhoto(card);
          const progress = clamp((z + 22) / 30.8, 0, 1), drift = (progress - .5) * 1.35;
          const spread = mobile ? t.look.layoutSpread : 1;
          photo.mesh.position.set((card.leftValue + card.widthValue / 2 - .5) * worldW * spread + drift * card.driftX * worldW * t.look.driftAmount, (.5 - card.topValue - card.heightValue / 2) * worldH * spread + drift * card.driftY * worldH * t.look.driftAmount, z);
          let w = card.widthValue * worldW * t.look.cardScale, h = card.heightValue * worldH * t.look.cardScale;
          if (mobile) h *= (worldW / worldH) / (1440 / 900);
          const image = textures.get(card.imageUrl);
          if (image) { photo.mesh.material.uniforms.map.value = image.texture; photo.mesh.material.uniforms.loaded.value = 1; if (image.aspect > w / h) h = w / image.aspect; else w = h * image.aspect; }
          photo.mesh.scale.set(w, h, 1);
          photo.mesh.material.uniforms.opacity.value = range(.02, .32, progress) * (1 - range(t.opacity.nearFadeStart, 1, progress));
          photo.mesh.material.uniforms.fogAmount.value = (1 - range(t.fog.farFogStart, .46, progress)) * t.fog.farFogStrength;
          photo.mesh.material.uniforms.velocity.value = motion.velocity;
        });
      }
      photos.forEach((photo, key) => { if (!keep.has(key)) { photo.mesh.removeFromParent(); photo.mesh.material.dispose(); photos.delete(key); } });
      if (selected !== active) { active = selected; motion.changeCountry(selected); onCountry(countries[selected].code, countries[selected].name); }
    }
    function resize() {
      width = Math.max(1, root.clientWidth); height = Math.max(1, root.clientHeight); mobile = width <= 768;
      rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
      planeHeight = Math.min(height * (mobile ? .46 : .52), (mobile ? 26 : 32) * rem);
      planeWidth = Math.min(30 * rem, width * .92); planeLeft = width / 2 + (mobile ? .4 : .76) * rem - planeWidth / 2;
      planeCamera.aspect = planeWidth / planeHeight; planeCamera.updateProjectionMatrix();
      const dpr = Math.min(devicePixelRatio, 1.75); trails.width = Math.round(width * dpr); trails.height = Math.round(height * dpr); ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      leftTrail.length = rightTrail.length = 0;
    }
    function drawTrails(dt: number, strength: number) {
      if (!ctx) return; ctx.clearRect(0, 0, width, height);
      const update = (points: Point[], wing: Three.Vector3, direction: number) => {
        if (modelReady && plane.visible && strength > .08 && trailTime > 1 / 45) {
          wingPosition.copy(wing); plane.localToWorld(wingPosition); wingPosition.project(planeCamera);
          const point = { x: (wingPosition.x + 1) * width / 2, y: (1 - wingPosition.y) * height / 2, life: 1 };
          if (point.y > -height && point.y < height * 2) points.unshift(point);
          points.splice(mobile ? 28 : 64);
        }
        const life = mobile ? .38 + strength * .67 : .45 + strength;
        points.forEach(point => { point.life -= dt / life; point.x += direction * (mobile ? 48 : 56) * dt * (.4 + strength); point.y += 35 * dt; });
        for (let i = points.length - 1; i >= 0; i--) if (points[i].life <= 0) points.splice(i, 1);
        ctx.lineCap = 'round';
        for (let i = 1; i < points.length; i++) { const a = points[i - 1], b = points[i], alpha = a.life * b.life * (1 - i / points.length * .65) * .55; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = 'rgba(170,170,170,' + alpha * .2 + ')'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')'; ctx.lineWidth = 1.3; ctx.stroke(); }
      };
      update(leftTrail, wingLeft, -1); update(rightTrail, wingRight, 1); if (trailTime > 1 / 45) trailTime = 0;
    }
    function tick(now: number) {
      if (disposed) return; frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, .05); last = now; if (document.hidden) return;
      const viewportH = 2 * Math.tan(THREE.MathUtils.degToRad(19)) * Math.hypot(FLIGHT.cameraZ, FLIGHT.cameraY);
      const viewportW = viewportH * width / height;
      const state = motion.step(dt, viewportW, viewportH, mobile, reduced); updateGallery();
      const centerX = planeLeft + planeWidth / 2, centerY = height - planeHeight / 2;
      planeLayout.position.set((centerX / width - .5) * viewportW + state.followX, (.5 - centerY / height) * viewportH + state.followY, 0);
      planeLayout.scale.set(planeWidth / width, planeHeight / height, planeHeight / height);
      plane.position.set(state.x, state.y, state.z); plane.rotation.set(state.rx, state.ry, state.rz); plane.scale.setScalar(state.scale); plane.visible = state.visible && modelReady; plane.updateMatrixWorld(true);
      renderer.setViewport(0, 0, width, height); renderer.setScissorTest(false); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(gallery, camera);
      renderer.clearDepth(); renderer.render(scene, planeCamera);
      trailTime += dt; drawTrails(dt, state.trail);
      if (now - lastProof > 100) { lastProof = now; root.dataset.flightReady = String(modelReady); root.dataset.flightEntry = String(state.progress); root.dataset.flightScroll = motion.scroll.toFixed(3); root.dataset.flightVelocity = motion.velocity.toFixed(3); root.dataset.flightBank = state.rz.toFixed(4); root.dataset.flightPitch = state.rx.toFixed(4); root.dataset.flightX = (planeLayout.position.x + state.x * planeLayout.scale.x).toFixed(4); root.dataset.flightY = (planeLayout.position.y + state.y * planeLayout.scale.y).toFixed(4); root.dataset.flightPointerBank = motion.bank.x.toFixed(4); root.dataset.flightPointerPitch = motion.pitch.x.toFixed(4); root.dataset.flightScale = state.scale.toFixed(4); root.dataset.flightCountry = countries[active]?.id; }
    }
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') { if (event.pointerId !== pointerId) return; const dy = previousY - event.clientY; previousY = event.clientY; if (Math.hypot(event.clientX - downX, event.clientY - downY) > 12) dragging = true; if (dragging) motion.move(dy * 3); return; }
      motion.setPointer(pointerInput(event.clientX / width * 2 - 1), pointerInput(-(event.clientY / height * 2 - 1)));
    };
    const pointerDown = (event: PointerEvent) => { if ((event.target as Element).closest('button,a')) return; pointerId = event.pointerId; downX = event.clientX; previousY = downY = event.clientY; downAt = performance.now(); dragging = false; if (event.pointerType === 'touch') root.setPointerCapture(event.pointerId); };
    const pointerUp = (event: PointerEvent) => { if (event.pointerId !== pointerId) return; const tap = !dragging && performance.now() - downAt <= 400 && Math.hypot(event.clientX - downX, event.clientY - downY) <= 12; pointerId = -1; if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId); if (tap) root.dispatchEvent(new CustomEvent('flight:return')); };
    const pointerCancel = () => { pointerId = -1; dragging = false; };
    const wheel = (event: WheelEvent) => { event.preventDefault(); motion.move(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1)); };
    const visibility = () => { last = performance.now(); };
    const observer = new ResizeObserver(resize); observer.observe(root);
    // Keep the last pointer target on pointerleave/blur. The original springs
    // continue easing the position and attitude instead of being hard-stopped.
    root.addEventListener('pointermove', pointerMove); root.addEventListener('pointerdown', pointerDown); root.addEventListener('pointerup', pointerUp); root.addEventListener('pointercancel', pointerCancel); root.addEventListener('wheel', wheel, { passive: false }); document.addEventListener('visibilitychange', visibility);
    release = () => {
      cancelAnimationFrame(frame); observer.disconnect();
      root.removeEventListener('pointermove', pointerMove); root.removeEventListener('pointerdown', pointerDown); root.removeEventListener('pointerup', pointerUp); root.removeEventListener('pointercancel', pointerCancel); root.removeEventListener('wheel', wheel);
      document.removeEventListener('visibilitychange', visibility);
      photos.forEach(photo => photo.mesh.material.dispose()); textures.forEach(item => item.texture.dispose()); modelGeometries.forEach(item => item.dispose()); originalMaterials.forEach(item => item.dispose());
      planeMaterial.dispose(); geometry.dispose(); renderer.dispose(); ctx?.clearRect(0, 0, width, height);
    };
    new GLTFLoader().load('/3d/models/plane.glb', gltf => {
      gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { modelGeometries.add(object.geometry); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => originalMaterials.add(material)); object.material = planeMaterial; } });
      if (disposed) { modelGeometries.forEach(item => item.dispose()); originalMaterials.forEach(item => item.dispose()); return; }
      const box = new THREE.Box3().setFromObject(gltf.scene), center = box.getCenter(new THREE.Vector3());
      wingLeft.set(box.min.x * .92, center.y, center.z); wingRight.set(box.max.x * .92, center.y, center.z);
      plane.add(gltf.scene); modelReady = true; motion.time = 0;
    }, undefined, () => { if (!disposed) onError(); });
    resize(); frame = requestAnimationFrame(tick);
  }
  return () => { disposed = true; release(); };
}
