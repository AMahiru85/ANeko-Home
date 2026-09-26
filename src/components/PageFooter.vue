<template>
  <footer class="pageFooter" :class="{ visible: isVisible }">
    Copyright &copy; {{ currentYear }} ANeko. All rights reserved.
  </footer>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const currentYear = new Date().getFullYear()
const isVisible = ref(false)
let scrollFrame = null

function handleScroll() {
  if (scrollFrame !== null) return
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = null
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight
    isVisible.value = scrollTop + windowHeight >= documentHeight - 10
  })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame)
})
</script>
