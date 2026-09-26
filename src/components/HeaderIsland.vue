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
    v-else-if="page === 'photos' || page === 'drive' || page === 'mail'"
    :product="page"
    :theme="theme"
    @toggle-theme="toggleTheme"
  />
  <PageHeader
    v-else
    :theme="theme"
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

<script setup>
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import BlogHeader from './BlogHeader.vue'
import PageHeader from './PageHeader.vue'
import PopupModal from './PopupModal.vue'
import WorkspaceHeader from './WorkspaceHeader.vue'
import { setCookie } from '../utils/cookie.js'

const BlogSearch = defineAsyncComponent(() => import('./BlogSearch.vue'))

defineOptions({ inheritAttrs: false })

const props = defineProps({
  page: {
    type: String,
    default: 'home',
  },
  compact: {
    type: Boolean,
    default: false,
  },
  blogSection: {
    type: String,
    default: 'articles',
  },
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

  const hideLoading = () => {
    loading.style.opacity = '0'
    window.setTimeout(() => {
      loading.style.display = 'none'
    }, 300)
  }

  if (document.readyState === 'complete') hideLoading()
  else window.addEventListener('load', hideLoading, { once: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleSearchShortcut)
})
</script>
