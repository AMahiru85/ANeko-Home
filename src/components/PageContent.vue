<template>
  <div class="workspaceModules">
    <TimeWidget />
    <WeatherWidget />
  </div>

  <section
    id="module-panel"
    class="modulePanel"
    role="tabpanel"
    :aria-labelledby="`${activeModule}-tab`"
  >
  <div class="moduleSwitcherLayout">
  <nav class="moduleDock" role="tablist" aria-label="内容模块" :aria-orientation="isMobileDock ? 'horizontal' : 'vertical'">
    <div class="moduleDockSurface">
      <div v-for="(tab, index) in moduleTabs" :key="tab.id" class="moduleDockItem">
        <button
          :id="`${tab.id}-tab`"
          class="moduleDockButton"
          :class="{ 'is-active': activeModule === tab.id }"
          type="button"
          role="tab"
          :aria-label="tab.label"
          :aria-selected="activeModule === tab.id"
          aria-controls="module-panel"
          :tabindex="activeModule === tab.id ? 0 : -1"
          @click="selectModule(tab.id)"
          @keydown="handleTabKeydown($event, index)"
        >
          <svg v-if="tab.id === 'all'" class="moduleDockIcon" viewBox="0 0 24 24" aria-hidden="true">
            <rect width="7" height="7" x="3" y="3" rx="1"></rect>
            <rect width="7" height="7" x="14" y="3" rx="1"></rect>
            <rect width="7" height="7" x="14" y="14" rx="1"></rect>
            <rect width="7" height="7" x="3" y="14" rx="1"></rect>
          </svg>
          <svg v-else-if="tab.id === 'github'" class="moduleDockIcon is-brand" viewBox="96 96 832 832" aria-hidden="true">
            <path d="M512 120c-217.6 0-393.6 176-393.6 393.6 0 173.6 112.8 320.8 269.6 372.8 19.6 3.6 26.8-8.4 26.8-18.8v-66.4c-109.6 23.8-132.8-52.8-132.8-52.8-17.8-45.4-43.6-57.6-43.6-57.6-35.6-24.4 2.8-24 2.8-24 39.6 2.8 60.4 40.8 60.4 40.8 35.2 60.4 92.4 43 115.2 32.8 3.6-25.6 13.8-43 25.2-53-87.2-10-178.8-43.6-178.8-193.6 0-42.8 15.2-77.6 40.4-105.2-4-10-17.6-50.8 4-106 0 0 32.8-10.4 108 40.4 31.2-8.8 64.8-13.2 98.4-13.4 33.6.2 67.2 4.6 98.4 13.4 75.2-50.8 108-40.4 108-40.4 21.6 55.2 8 96 4 106 25.2 27.6 40.4 62.4 40.4 105.2 0 150.4-91.6 183.2-178.8 193.6 14 12.2 26.8 36.4 26.8 73.6v108.8c0 10.4 7.2 22.4 27.2 18.4 156.8-52 269.6-199.2 269.6-372.8C905.6 296 729.6 120 512 120z"></path>
          </svg>
          <svg v-else-if="tab.id === 'site'" class="moduleDockIcon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"></path>
          </svg>
          <svg v-else class="moduleDockIcon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.07.07l2-2A5 5 0 0 0 12 4l-1.15 1.15"></path>
            <path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"></path>
          </svg>
        </button>
      </div>
    </div>
  </nav>

  <div ref="modulePanelRef" class="moduleContent">
      <div
        ref="githubMountRef"
        class="githubMount"
        v-show="activeModule === 'all' || activeModule === 'github'"
        :aria-busy="!shouldMountGitHub"
      >
        <GitHubWidget v-if="shouldMountGitHub" />
      </div>

      <div v-show="activeModule === 'all' || activeModule === 'site'">
        <div class="title">
          <svg t="1705257422086" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1891">
            <path d="M629.333333 202.666667v213.333333h277.333334v448h-512v-213.333333h-277.333334v-448h512z m213.333334 277.333333h-213.333334v170.666667h-170.666666v149.333333h384v-320z m-277.333334-213.333333h-384v320h213.333334v-170.666667h170.666666v-149.333333z m0 213.333333h-106.666666v106.666667h106.666666v-106.666667z" p-id="1892"></path>
          </svg>
          site
        </div>
        <div class="projectList">
          <a
            v-for="project in siteProjects"
            :key="project.name"
            class="projectItem"
            :href="project.url"
            :target="project.external ? '_blank' : undefined"
            :rel="project.external ? 'noreferrer' : undefined"
          >
            <div class="projectItemLeft">
              <h1>{{ project.name }}</h1>
            </div>
            <div class="projectItemRight">
              <img
                :class="`projectIcon projectIcon--${project.id}`"
                :src="project.img"
                alt=""
                loading="lazy"
                decoding="async"
              />
            </div>
          </a>
        </div>
      </div>

      <div v-show="activeModule === 'all' || activeModule === 'links'" class="externalLinksSection">
        <div class="title">
          <Link2 class="icon externalLinksTitleIcon" :size="26" :stroke-width="1.8" aria-hidden="true" />
          links
        </div>
        <div class="externalLinkGrid">
          <a
            v-for="link in externalLinks"
            :key="link.name"
            class="externalLinkButton"
            :href="link.url"
            target="_blank"
            rel="noreferrer"
          >
            <span class="externalLinkCopy">
              <strong>{{ link.name }}</strong>
              <small>{{ link.meta }}</small>
            </span>
            <ExternalLink class="externalLinkArrow" :size="15" :stroke-width="1.7" aria-hidden="true" />
          </a>
        </div>
      </div>
  </div>
  </div>

      <div v-show="activeModule === 'all' || activeModule === 'github'" class="siteSkillsSection">
        <div class="title">
          <svg t="1705257823317" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7833">
            <path d="M395.765333 586.570667h-171.733333c-22.421333 0-37.888-22.442667-29.909333-43.381334L364.768 95.274667A32 32 0 0 1 394.666667 74.666667h287.957333c22.72 0 38.208 23.018667 29.632 44.064l-99.36 243.882666h187.050667c27.509333 0 42.186667 32.426667 24.042666 53.098667l-458.602666 522.56c-22.293333 25.408-63.626667 3.392-54.976-29.28l85.354666-322.421333zM416.714667 138.666667L270.453333 522.581333h166.869334a32 32 0 0 1 30.933333 40.181334l-61.130667 230.954666 322.176-367.114666H565.312c-22.72 0-38.208-23.018667-29.632-44.064l99.36-243.882667H416.714667z" p-id="7834"></path>
          </svg>
          skills
        </div>
        <div class="skill">
          <picture>
            <source media="(max-width: 800px)" srcset="/static/svg/skillWap.svg" />
            <img src="/static/svg/skillPc.svg" alt="" loading="lazy" decoding="async" />
          </picture>
        </div>
      </div>
  </section>

</template>

<script setup>
import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ExternalLink, Link2 } from '@lucide/vue'
import TimeWidget from './TimeWidget.vue'
import WeatherWidget from './WeatherWidget.vue'

const GitHubWidget = defineAsyncComponent(() => import('./GitHubWidget.vue'))

const moduleTabs = [
  { id: 'all', label: '所有内容' },
  { id: 'github', label: 'GITHUB 信息' },
  { id: 'site', label: '本站功能' },
  { id: 'links', label: '外部链接' },
]
const activeModule = ref('all')
const modulePanelRef = ref(null)
const isMobileDock = ref(false)
const githubMountRef = ref(null)
const shouldMountGitHub = ref(false)
let switchAnimation = null
let dockMediaQuery = null
let githubObserver = null
let githubIdleHandle = null
let githubIdleUsesRequestIdleCallback = false

function syncDockOrientation(event) {
  isMobileDock.value = event.matches
}

function clearGitHubIdle() {
  if (githubIdleHandle === null) return
  if (githubIdleUsesRequestIdleCallback && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(githubIdleHandle)
  } else {
    window.clearTimeout(githubIdleHandle)
  }
  githubIdleHandle = null
}

function mountGitHub() {
  if (shouldMountGitHub.value) return
  shouldMountGitHub.value = true
  githubObserver?.disconnect()
  githubObserver = null
  clearGitHubIdle()
}

onMounted(() => {
  dockMediaQuery = window.matchMedia('(max-width: 800px)')
  syncDockOrientation(dockMediaQuery)
  dockMediaQuery.addEventListener('change', syncDockOrientation)

  if ('IntersectionObserver' in window && githubMountRef.value) {
    githubObserver = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) mountGitHub()
    }, { rootMargin: '200px 0px' })
    githubObserver.observe(githubMountRef.value)
  }

  if ('requestIdleCallback' in window) {
    githubIdleUsesRequestIdleCallback = true
    githubIdleHandle = window.requestIdleCallback(mountGitHub, { timeout: 3000 })
  } else {
    githubIdleHandle = window.setTimeout(mountGitHub, 1800)
  }
})

async function selectModule(moduleId) {
  if (moduleId === 'all' || moduleId === 'github') mountGitHub()
  if (moduleId === activeModule.value) return

  const previousIndex = moduleTabs.findIndex((tab) => tab.id === activeModule.value)
  const nextIndex = moduleTabs.findIndex((tab) => tab.id === moduleId)
  activeModule.value = moduleId
  await nextTick()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const panel = modulePanelRef.value
  if (!panel?.animate) return

  switchAnimation?.cancel()
  const offset = nextIndex > previousIndex ? 10 : -10
  const animation = panel.animate([
    { opacity: 0.3, transform: `translate3d(0, ${offset}px, 0)` },
    { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  ], {
    duration: 260,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    fill: 'both',
  })

  switchAnimation = animation
  animation.addEventListener('finish', () => {
    if (switchAnimation !== animation) return
    animation.cancel()
    switchAnimation = null
  }, { once: true })
}

onBeforeUnmount(() => {
  switchAnimation?.cancel()
  dockMediaQuery?.removeEventListener('change', syncDockOrientation)
  githubObserver?.disconnect()
  clearGitHubIdle()
})

function handleTabKeydown(event, currentIndex) {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (!keys.includes(event.key)) return

  event.preventDefault()
  let targetIndex = currentIndex

  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    targetIndex = (currentIndex - 1 + moduleTabs.length) % moduleTabs.length
  }
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    targetIndex = (currentIndex + 1) % moduleTabs.length
  }
  if (event.key === 'Home') targetIndex = 0
  if (event.key === 'End') targetIndex = moduleTabs.length - 1

  selectModule(moduleTabs[targetIndex].id)
  event.currentTarget.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]')[targetIndex]?.focus()
}

const siteProjects = [
  { id: 'blog', name: '博客', url: '/blog/', img: '/static/svg/blog.svg', external: false },
  { id: 'cloud', name: '云盘', url: '/drive/', img: '/static/svg/cloud.svg', external: false },
  { id: 'mail', name: '邮箱', url: '/mail/', img: '/static/svg/mail.svg', external: false },
  { id: 'photo', name: '相册', url: '/photos/', img: '/static/svg/photo.svg', external: false },
]

const externalLinks = [
  { name: '中转', meta: 'ai.aneko.ink', url: 'https://ai.aneko.ink' },
  { name: '探针', meta: 'tz.aneko.ink', url: 'https://tz.aneko.ink' },
  { name: 'edt', meta: 'dl.aneko.ink', url: 'https://dl.aneko.ink/login' },
]
</script>

<style scoped>
.githubMount {
  min-height: 320px;
}
</style>
