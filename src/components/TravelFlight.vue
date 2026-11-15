<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { navigate } from 'astro:transitions/client';
import { startTravelFlight } from '../lib/travel-flight-scene';
const root = ref<HTMLElement>(), canvas = ref<HTMLCanvasElement>(), trails = ref<HTMLCanvasElement>();
const country = ref('Bangkok'), failed = ref(false), leaving = ref(false);
let stop = () => {}, transition: Animation | undefined, removeEvents = () => {};
let origin = { x: .5, y: .5 };
const returnToAbout = async () => {
  if (leaving.value || !root.value) return; leaving.value = true;
  try { sessionStorage.setItem('gabriel:travel-return', 'true'); } catch {}
  transition?.cancel();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const center = origin.x * 100 + '% ' + origin.y * 100 + '%';
    transition = root.value.animate([{ clipPath: 'circle(' + Math.hypot(innerWidth, innerHeight) + 'px at ' + center + ')' }, { clipPath: 'circle(0px at ' + center + ')' }], { duration: 820, easing: 'cubic-bezier(.32,0,0,1)', fill: 'forwards' });
    await transition.finished.catch(() => {});
  }
  await navigate('/about');
};
onMounted(() => {
  if (!root.value || !canvas.value || !trails.value) return;
  try { const saved = JSON.parse(sessionStorage.getItem('gabriel:travel-origin') || 'null'); if (innerWidth <= 768 && saved && Date.now() - saved.at < 60000) origin = { x: saved.x, y: saved.y }; } catch {}
  const node = root.value, center = origin.x * 100 + '% ' + origin.y * 100 + '%';
  node.style.clipPath = 'none';
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) transition = node.animate([{ clipPath: 'circle(0px at ' + center + ')' }, { clipPath: 'circle(' + Math.hypot(innerWidth, innerHeight) + 'px at ' + center + ')' }], { duration: 1200, easing: 'cubic-bezier(.32,0,0,1)' });
  stop = startTravelFlight(canvas.value, trails.value, node, (_next, name) => { country.value = name; }, () => { failed.value = true; });
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); void returnToAbout(); } };
  const tap = () => { void returnToAbout(); };
  const beforeSwap = () => { stop(); transition?.cancel(); };
  window.addEventListener('keydown', key); node.addEventListener('flight:return', tap); document.addEventListener('astro:before-swap', beforeSwap);
  removeEvents = () => { window.removeEventListener('keydown', key); node.removeEventListener('flight:return', tap); document.removeEventListener('astro:before-swap', beforeSwap); };
});
onUnmounted(() => { stop(); transition?.cancel(); removeEvents(); });
</script>
<template>
  <main ref="root" class="travel-flight" aria-label="Interactive travel gallery" :aria-busy="leaving" data-travel-flight>
    <canvas ref="canvas" class="flight-canvas" aria-label="Fly through travel photographs" />
    <canvas ref="trails" class="flight-trails" aria-hidden="true" />
    <p v-if="failed" class="flight-fallback" role="status">The travel gallery couldn't load. Please try again.</p>
    <button class="flight-return" type="button" aria-label="Return to the about page" :disabled="leaving" @click="returnToAbout">
      <span class="sr-only">{{ country }}</span><span class="flight-return-caption">Click to return</span>
    </button>
  </main>
</template>
<style scoped>
.travel-flight {position:fixed;inset:0;z-index:70;overflow:hidden;background:#fff;touch-action:none;cursor:pointer;clip-path:circle(0);}
.flight-canvas,.flight-trails {position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;}
.flight-trails {z-index:2;}
.flight-return {position:absolute;z-index:3;bottom:8.6rem;left:50%;translate:-50% 0;display:flex;flex-direction:column;align-items:center;padding:0;border:0;background:transparent;cursor:pointer;}
.flight-return-caption {font-size:1.4rem;color:rgb(26 26 26 / 28%);white-space:nowrap;}
.flight-return:focus-visible {outline:2px solid #1a1a1a;outline-offset:.8rem;}
.flight-fallback {position:absolute;top:40%;left:50%;translate:-50% -50%;font-size:1.6rem;color:#9f9f9f;text-align:center;max-width:80%;}
@media(max-width:768px) {.flight-return {bottom:4.4rem;}}
</style>
