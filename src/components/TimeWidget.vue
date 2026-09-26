<template>
  <section ref="timeModuleRef" class="timeModule" :aria-label="`${dateText}, ${timeText}`">
    <p class="timeDate">{{ dateText }}</p>
    <div class="timeDisplay">
      <time class="timeValue" :datetime="machineDateTime">{{ timeText }}</time>
      <div class="sunTransit" aria-hidden="true">
        <div class="sunTransitArc">
          <span
            class="sunTransitDot"
            :class="{ 'is-revealing': isRevealing }"
            :style="sunStyle"
            @animationend="isRevealing = false"
          ></span>
        </div>
        <span class="sunTransitLabel">Sun Transit</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
})

const now = ref(null)
const timeModuleRef = ref(null)
const isRevealing = ref(false)
let timer = null
let observer = null
let revealFrame = null
let revealStartFrame = null

const timeText = computed(() => now.value ? timeFormatter.format(now.value) : '--:--')
const dateText = computed(() => now.value ? dateFormatter.format(now.value) : 'Local Time')
const machineDateTime = computed(() => now.value?.toISOString())
const sunProgress = computed(() => {
  if (!now.value) return 0

  const hours = now.value.getHours()
    + now.value.getMinutes() / 60
    + now.value.getSeconds() / 3600

  return Math.min(1, Math.max(0, (hours - 6) / 12))
})
const sunStyle = computed(() => ({ '--sun-progress': `${sunProgress.value * 100}%` }))

function revealSun() {
  isRevealing.value = false
  if (revealStartFrame !== null) window.cancelAnimationFrame(revealStartFrame)
  if (revealFrame !== null) window.cancelAnimationFrame(revealFrame)

  revealStartFrame = window.requestAnimationFrame(() => {
    revealFrame = window.requestAnimationFrame(() => {
      isRevealing.value = true
    })
  })
}

onMounted(() => {
  const updateClock = () => {
    now.value = new Date()
    timer = window.setTimeout(updateClock, 60_000 - (Date.now() % 60_000))
  }
  updateClock()

  if ('IntersectionObserver' in window && timeModuleRef.value) {
    observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) revealSun()
    }, { threshold: 0.2 })
    observer.observe(timeModuleRef.value)
  } else {
    revealSun()
  }
})

onBeforeUnmount(() => {
  if (timer !== null) window.clearTimeout(timer)
  if (observer) observer.disconnect()
  if (revealStartFrame !== null) window.cancelAnimationFrame(revealStartFrame)
  if (revealFrame !== null) window.cancelAnimationFrame(revealFrame)
})
</script>
