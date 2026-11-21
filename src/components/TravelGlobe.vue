<script lang="ts">
const flight = { angle: 0, time: 0, bank: 0, rotation: 2.2 };
</script>
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useLanguage } from '../lib/language';
const { t } = useLanguage();

const canvas = ref<HTMLCanvasElement | null>(null);
const ready = ref(false);
let disposed = false;
let cleanup = () => {};

onMounted(async () => {
  const host = canvas.value;
  if (!host) return;
  const [THREE, { GLTFLoader }] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]);
  if (disposed) return;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
  camera.position.z = 2.8;
  const renderer = new THREE.WebGLRenderer({ canvas: host, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  scene.add(new THREE.AmbientLight(0xfaf8f5, 1.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2);
  keyLight.position.set(-4, 3, 5); scene.add(keyLight);
  const world = new THREE.Group(); world.scale.setScalar(.6); scene.add(world);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), new THREE.MeshBasicMaterial({ color: 0x9aa39f, wireframe: true, transparent: true, opacity: .26 }));
  globe.rotation.set(.2, flight.rotation, 0); world.add(globe);
  // Occlude the aircraft behind Earth without changing the wireframe appearance.
  const occluder = new THREE.Mesh(new THREE.SphereGeometry(.995, 48, 48), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occluder.renderOrder = -1; world.add(occluder);
  const dots = new THREE.Points(new THREE.SphereGeometry(1.015, 32, 32), new THREE.PointsMaterial({ color: 0x0a0a0a, size: .018, transparent: true, opacity: .6 })); world.add(dots);
  const plane = new THREE.Group(); plane.scale.setScalar(.06); world.add(plane);
  const planeMaterial = new THREE.MeshPhongMaterial({ color: 0xf0eeeb, specular: 0x888888, shininess: 18 });
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: { uOpacity: { value: .2 }, uBlur: { value: 1 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float uOpacity;uniform float uBlur;varying vec2 vUv;void main(){vec2 uv=(vUv-vec2(.5))*2.;float body=length(uv*vec2(3.5,1.))-.3;float wings=length(vec2(uv.x,uv.y-.05)*vec2(.65,5.))-.3;float tail=length(vec2(uv.x,uv.y+.38)*vec2(1.8,8.))-.25;float k=.1;float d=-k*log(exp(-body/k)+exp(-wings/k)+exp(-tail/k));float alpha=smoothstep(uBlur,-uBlur*.75,d)*uOpacity;gl_FragColor=vec4(0.,0.,0.,alpha);}',
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial); world.add(shadow);
  const position = new THREE.Vector3(), tangent = new THREE.Vector3(), normal = new THREE.Vector3(), up = new THREE.Vector3(), side = new THREE.Vector3(), target = new THREE.Vector3();
  const look = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), bankQuaternion = new THREE.Quaternion();
  let frame = 0, previous = performance.now(), elapsed = flight.time, angle = flight.angle, bank = flight.bank;
  let boost = 0, kick = 0, active = false, intersecting = true, lastScroll = window.scrollY;
  let routeVisible = location.pathname === '/about' || location.pathname === '/about/';
  const mouse = { x: 0, y: 0 }, magnet = { x: 0, y: 0, vx: 0, vy: 0 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 768px)').matches;
  const placePlane = (alpha = 1) => {
    // ue / He in the captured TravelGlobe chunk: orbit, drifting tilt and bank.
    const tilt = .1 - angle * .16, x = Math.cos(angle) * 1.3, z = Math.sin(angle) * 1.3;
    const y = z * Math.sin(.2), depth = z * Math.cos(.2);
    position.set(x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt), depth); plane.position.copy(position);
    const dx = -Math.sin(angle) * 1.3, dz = Math.cos(angle) * 1.3, dy = dz * Math.sin(.2);
    tangent.set(dx * Math.cos(tilt) - dy * Math.sin(tilt), dx * Math.sin(tilt) + dy * Math.cos(tilt), dz * Math.cos(.2)).normalize();
    normal.copy(position).normalize(); bankQuaternion.setFromAxisAngle(tangent, bank); up.copy(normal).applyQuaternion(bankQuaternion).normalize();
    target.copy(position).add(tangent); look.lookAt(position, target, up); quaternion.setFromRotationMatrix(look); plane.quaternion.slerp(quaternion, alpha);
    shadow.position.copy(normal).multiplyScalar(1.005); target.copy(tangent).addScaledVector(normal, -tangent.dot(normal)).normalize(); side.crossVectors(target, normal).normalize();
    look.makeBasis(side, target, normal); shadow.quaternion.setFromRotationMatrix(look); shadow.scale.setScalar(.15 * (1 + .3 * 1.5)); shadowMaterial.uniforms.uOpacity.value = .2 * (1 - .3 * .8);
    host.dataset.planeAngle = angle.toFixed(4); host.dataset.planePosition = position.toArray().map(value => value.toFixed(4)).join(',');
  };
  const resize = () => { const rect = host.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); };
  const addScrollBoost = (delta: number) => {
    if (!active || reduced) return;
    const amount = THREE.MathUtils.clamp(Math.abs(delta) / 240, 0, 1); boost = THREE.MathUtils.clamp(boost + amount * 1.1 * (1 + boost / 15 * .35), 0, 15); kick += amount * 2;
  };
  const wheel = (event: WheelEvent) => addScrollBoost(event.deltaY);
  const scroll = () => { const next = window.scrollY; if (mobile) addScrollBoost((next - lastScroll) * 2); lastScroll = next; };
  const pointer = (event: MouseEvent) => {
    if (mobile || reduced || !active) return;
    const rect = host.getBoundingClientRect(), dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2, distance = Math.hypot(dx, dy);
    const strength = distance < 325 ? -.095 * Math.pow(1 - distance / 325, 1.1) : 0; mouse.x = dx * strength; mouse.y = dy * strength;
  };
  const leave = () => { mouse.x = 0; mouse.y = 0; };
  const animate = (now: number) => {
    frame = 0; const dt = Math.min((now - previous) / 1000, .05); previous = now;
    if (!reduced) {
      elapsed += dt; boost = THREE.MathUtils.clamp(boost * Math.exp(-1.5 * dt), 0, 15); kick *= Math.exp(-10 * dt);
      const speed = THREE.MathUtils.clamp(.4 + boost + kick, 0, 17.4); angle += dt * speed; bank += (Math.sin(elapsed * 1.2) * .35 - bank) * (1 - Math.exp(-2.6 * dt));
      placePlane(1 - Math.exp(-20 * (1 + (Math.max(speed / .4, 1) - 1) * 1.1) * dt)); globe.rotation.y += dt * .2; dots.rotation.y += dt * .06;
    }
    const step = dt / 3;
    for (let i = 0; i < 3; i++) { magnet.vx += (70 * (mouse.x - magnet.x) - 24 * magnet.vx) / .28 * step; magnet.vy += (70 * (mouse.y - magnet.y) - 24 * magnet.vy) / .28 * step; magnet.x += magnet.vx * step; magnet.y += magnet.vy * step; }
    host.style.translate = magnet.x.toFixed(3) + 'px ' + magnet.y.toFixed(3) + 'px'; renderer.render(scene, camera);
    flight.angle = angle; flight.time = elapsed; flight.bank = bank; flight.rotation = globe.rotation.y;
    if (active && !disposed) frame = requestAnimationFrame(animate);
  };
  const syncActive = () => {
    active = routeVisible && intersecting && !document.hidden; host.dataset.webglActive = String(active);
    if (active && !frame) { previous = performance.now(); frame = requestAnimationFrame(animate); }
    else if (!active && frame) { cancelAnimationFrame(frame); frame = 0; boost = 0; kick = 0; leave(); }
  };
  const route = (event: Event) => {
    const pathname = (event as CustomEvent<{ pathname?: string }>).detail?.pathname;
    if (typeof pathname !== 'string') return;
    routeVisible = pathname === '/about' || pathname === '/about/';
    syncActive();
  };
  const observer = new IntersectionObserver(entries => { intersecting = entries[0]?.isIntersecting ?? false; syncActive(); });
  const resizeObserver = new ResizeObserver(resize);
  const geometries = new Set<import('three').BufferGeometry>();
  new GLTFLoader().load('/3d/models/plane.glb', gltf => {
    gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { const old = Array.isArray(object.material) ? object.material : [object.material]; old.forEach(material => material.dispose()); if (disposed) object.geometry.dispose(); else { geometries.add(object.geometry); object.material = planeMaterial; } } });
    if (disposed) return; plane.add(gltf.scene);
    // The persistent Home island warms shader programs before About is shown.
    // Compiling asynchronously keeps the first visible frame out of the route
    // transition's main-thread budget, including the newly loaded aircraft.
    renderer.compileAsync(scene, camera).then(() => {
      if (disposed) return;
      renderer.render(scene, camera); host.dataset.sceneWarm = 'true'; ready.value = true;
    }).catch(() => { if (!disposed) ready.value = true; });
  }, undefined, () => { if (!disposed) host.dataset.planeError = 'load-failed'; });
  resize(); placePlane(); observer.observe(host); resizeObserver.observe(host); syncActive();
  window.addEventListener('wheel', wheel, { passive: true }); window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('mousemove', pointer);
  window.addEventListener('gabriel:author-route', route);
  document.documentElement.addEventListener('mouseleave', leave); document.addEventListener('visibilitychange', syncActive);
  cleanup = () => {
    cancelAnimationFrame(frame); observer.disconnect(); resizeObserver.disconnect(); window.removeEventListener('wheel', wheel); window.removeEventListener('scroll', scroll); window.removeEventListener('mousemove', pointer);
    document.documentElement.removeEventListener('mouseleave', leave); document.removeEventListener('visibilitychange', syncActive);
    window.removeEventListener('gabriel:author-route', route);
    geometries.forEach(geometry => geometry.dispose()); planeMaterial.dispose(); globe.geometry.dispose(); globe.material.dispose(); dots.geometry.dispose(); dots.material.dispose(); occluder.geometry.dispose(); occluder.material.dispose(); shadow.geometry.dispose(); shadowMaterial.dispose(); scene.clear(); renderer.dispose(); host.style.removeProperty('translate');
  };
});
onUnmounted(() => { disposed = true; cleanup(); });
</script>

<template>
  <canvas ref="canvas" class="travel-globe" data-webgl-scene="travel-globe" :data-plane-ready="ready" :aria-label="t('Rotating globe with an orbiting airplane')" />
</template>
<style scoped>
.travel-globe { opacity: 1; scale: 1; transition: opacity .7s cubic-bezier(.22,1,.36,1), scale .7s cubic-bezier(.22,1,.36,1); }
.travel-globe[data-plane-ready="false"] { opacity: 0; scale: .92; }
@media (prefers-reduced-motion: reduce) { .travel-globe { transition: none; } }
</style>

