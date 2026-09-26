<template>
  <a class="switch" :class="{ 'is-theme-ready': isThemeReady }" href="javascript:void(0)">
    <div class="onoffswitch">
      <input
        type="checkbox"
        name="onoffswitch"
        class="onoffswitch-checkbox"
        id="myonoffswitch"
        :checked="isLight"
        @change="$emit('toggle')"
      />
      <label class="onoffswitch-label" for="myonoffswitch">
        <span class="onoffswitch-inner"></span>
        <span class="onoffswitch-switch"></span>
      </label>
    </div>
  </a>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  isLight: {
    type: Boolean,
    default: true
  }
})

defineEmits(['toggle'])

const isThemeReady = ref(false)
let readyFrame = null

onMounted(() => {
  readyFrame = window.requestAnimationFrame(() => {
    readyFrame = window.requestAnimationFrame(() => {
      isThemeReady.value = true
      readyFrame = null
    })
  })
})

onBeforeUnmount(() => {
  if (readyFrame !== null) window.cancelAnimationFrame(readyFrame)
})
</script>
