<template>
  <BlogHeader
    v-if="page === 'blog'"
    :theme="theme"
    :compact="compact"
    :active-section="blogSection"
    @toggle-theme="toggleTheme"
    @open-search="openSearch"
  />
  <WorkspaceHeader
  v-else-if="page === 'photos' || page === 'drive' || page === 'mail' || page === 'admin'"
    :product="page"
    :theme="theme"
    @toggle-theme="toggleTheme"
  />
  <PageHeader
    v-else
    :theme="theme"
    :github-username="props.githubUsername"
    :greeting="props.greeting"
    :display-name="props.displayName"
    :occupation="props.occupation"
    :introduction="props.introduction"
    @open-popup="popupImage = $event"
    @toggle-theme="toggleTheme"
  />
  <PopupModal
    v-if="page === 'home' && popupImage"
    :image-url="popupImage"
    @close="popupImage = ''"
  />
  <BlogSearch v-if="page === 'blog' && searchLoaded" :open="searchOpen" @close="closeSearch" />
</template>

<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import BlogHeader from './BlogHeader.vue'
import PageHeader from './PageHeader.vue'
import PopupModal from './PopupModal.vue'
import WorkspaceHeader from './WorkspaceHeader.vue'
import { setCookie } from '../utils/cookie.js'

const BlogSearch = defineAsyncComponent(() => import('./BlogSearch.vue'))

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  page?: string
  compact?: boolean
  blogSection?: string
  githubUsername?: string
  greeting?: string
  displayName?: string
  occupation?: string
  introduction?: string
}>(), {
  page: 'home',
  compact: false,
  blogSection: 'articles',
  githubUsername: 'AMahiru85',
  greeting: "Hello I'm",
  displayName: 'ANeko',
  occupation: '🙂 Full Stack Developer',
  introduction: '📝 The only way to do great is to love what you do.',
})

const theme = ref('Light')
const searchOpen = ref(false)
const searchLoaded = ref(false)
const popupImage = ref('')

function openSearch() {
  searchLoaded.value = true
  searchOpen.value = true
}

function closeSearch() {
  searchOpen.value = false
}

function handleSearchShortcut(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault()
    if (searchOpen.value) closeSearch()
    else openSearch()
  }

  if (event.key === 'Escape') closeSearch()
}

function toggleTheme() {
  theme.value = theme.value === 'Dark' ? 'Light' : 'Dark'
  setCookie('themeState', theme.value, 365)
  document.documentElement.dataset.theme = theme.value
}

onMounted(() => {
  theme.value = document.documentElement.dataset.theme || 'Light'
  if (props.page === 'blog') window.addEventListener('keydown', handleSearchShortcut)

  const loading = document.getElementById('at-loading')
  if (!loading) return

  const progress = document.getElementById('at-loading-progress')
  const progressFill = document.getElementById('at-loading-progress-fill')
  let currentProgress = 0
  let totalWeight = 0
  let completedWeight = 0
  let hidden = false
  let observer: MutationObserver | null = null
  const tracked = new WeakSet<Element>()
  const resourceListeners = new Map<Element, () => void>()

  const setProgress = (value: number) => {
    const nextProgress = Math.max(currentProgress, Math.min(100, Math.round(value)))
    if (nextProgress === currentProgress) return
    currentProgress = nextProgress
    progress?.setAttribute('aria-valuenow', String(nextProgress))
    progressFill?.style.setProperty('--loading-progress', `${nextProgress}%`)
  }

  const loadedResourceNames = new Set(
    performance.getEntriesByType('resource').map((entry) => entry.name),
  )

  const hasLoadedUrl = (element: Element) => {
    let url = ''
    if (element instanceof HTMLImageElement || element instanceof HTMLMediaElement) {
      url = element.currentSrc || element.src
    } else if (element instanceof HTMLScriptElement) {
      url = element.src
    } else if (element instanceof HTMLLinkElement) {
      url = element.href
    } else if (element instanceof HTMLIFrameElement) {
      url = element.src
    }
    return Boolean(url && loadedResourceNames.has(url))
  }

  const isSettled = (element: Element) => {
    if (hasLoadedUrl(element)) return true
    if (element instanceof HTMLImageElement) return element.complete
    if (element instanceof HTMLMediaElement) return element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA || Boolean(element.error)
    if (element instanceof HTMLLinkElement) return element.rel === 'stylesheet' && Boolean(element.sheet)
    return false
  }

  const resourceWeight = (element: Element) => {
    if (element instanceof HTMLImageElement || element instanceof HTMLMediaElement) return 2
    if (element instanceof HTMLScriptElement || element instanceof HTMLLinkElement) return 1
    return 1
  }

  const updateProgress = () => {
    const resourceProgress = totalWeight > 0 ? completedWeight / totalWeight : 0
    // Keep a small completion buffer until the browser's load event confirms all page resources.
    setProgress(8 + resourceProgress * 87)
  }

  const trackResource = (element: Element) => {
    if (tracked.has(element)) return
    tracked.add(element)
    const weight = resourceWeight(element)
    totalWeight += weight
    let settled = false
    const markSettled = () => {
      if (settled) return
      settled = true
      completedWeight += weight
      element.removeEventListener('load', onResourceDone)
      element.removeEventListener('error', onResourceDone)
      resourceListeners.delete(element)
      updateProgress()
    }

    const onResourceDone = () => markSettled()
    resourceListeners.set(element, onResourceDone)
    element.addEventListener('load', onResourceDone, { once: true })
    element.addEventListener('error', onResourceDone, { once: true })
    if (isSettled(element)) queueMicrotask(markSettled)
  }

  const collectResources = () => {
    document
      .querySelectorAll('img:not([loading="lazy"]), video, audio, iframe, script[src], link[rel="stylesheet"], link[rel="preload"]')
      .forEach(trackResource)
    updateProgress()
  }

  const hideLoading = () => {
    if (hidden) return
    hidden = true
    observer?.disconnect()
    resourceListeners.forEach((listener, element) => {
      element.removeEventListener('load', listener)
      element.removeEventListener('error', listener)
    })
    resourceListeners.clear()
    setProgress(100)
    loading.classList.add('is-complete')
    loading.style.opacity = '0'
    window.setTimeout(() => {
      loading.style.display = 'none'
    }, 300)
  }

  collectResources()
  observer = new MutationObserver(collectResources)
  observer.observe(document.body, { childList: true, subtree: true })

  if (document.fonts?.ready) {
    totalWeight += 1
    document.fonts.ready
      .then(() => {
        completedWeight += 1
        updateProgress()
      })
      .catch(() => {
        completedWeight += 1
        updateProgress()
      })
  }

  if (document.readyState === 'complete') queueMicrotask(hideLoading)
  else window.addEventListener('load', hideLoading, { once: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleSearchShortcut)
})
</script>
