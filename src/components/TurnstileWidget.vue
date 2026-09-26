<template>
  <div ref="container" class="turnstileWidget" aria-label="安全验证"></div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const props = defineProps<{
  siteKey: string
  action: string
}>()

const emit = defineEmits<{
  token: [value: string]
  expired: []
  error: []
}>()

const container = ref<HTMLElement | null>(null)
let widgetId: string | null = null
let active = true

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (window.__anekoTurnstileScript) return window.__anekoTurnstileScript

  const promise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-aneko-turnstile]')
    const finish = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable'))

    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.dataset.anekoTurnstile = 'true'
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true })
    document.head.append(script)
  })

  window.__anekoTurnstileScript = promise
  void promise.catch(() => {
    if (window.__anekoTurnstileScript === promise) delete window.__anekoTurnstileScript
    if (!window.turnstile) document.querySelector<HTMLScriptElement>('script[data-aneko-turnstile]')?.remove()
  })

  return promise
}

onMounted(async () => {
  await nextTick()
  try {
    const turnstile = await loadTurnstile()
    if (!active || !container.value) return
    widgetId = turnstile.render(container.value, {
      sitekey: props.siteKey,
      action: props.action,
      theme: 'auto',
      size: 'flexible',
      callback: (token) => active && emit('token', token),
      'expired-callback': () => active && emit('expired'),
      'error-callback': () => active && emit('error'),
    })
  } catch {
    if (active) emit('error')
  }
})

onBeforeUnmount(() => {
  active = false
  if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId)
  widgetId = null
})
</script>

<style scoped>
.turnstileWidget {
  width: 100%;
  min-height: 65px;
  margin-top: 14px;
}
</style>
