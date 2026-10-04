<template>
  <div class="homePage">
    <a class="homeSkip" href="#home-content" @click.prevent="focusContent">跳至内容</a>
    <header class="homeTopbar">
      <a class="homeBrand" href="/" aria-label="ANeko 主页">
        <Command :size="18" :stroke-width="1.6" aria-hidden="true" />
        <span class="homeBrandName">{{ content.profile.displayName }}<span class="brandSuffix"> / HOME</span></span>
        <span class="brandSeal" aria-hidden="true">猫</span>
      </a>
      <button class="homeTheme" type="button" :aria-label="theme === 'Dark' ? '切换浅色主题' : '切换深色主题'" @click="toggleTheme">
        <Sun v-if="theme === 'Dark'" :size="19" :stroke-width="1.5" aria-hidden="true" />
        <Moon v-else :size="19" :stroke-width="1.5" aria-hidden="true" />
      </button>
    </header>
    <main id="home-content" class="homeMain" tabindex="-1">
      <section v-for="tab in moduleTabs" :id="`${tab.id}-panel`" :key="tab.id" class="homePanel" :hidden="activeModule !== tab.id" role="tabpanel" :aria-labelledby="`${tab.id}-tab`" tabindex="0">
        <HomeIdentity v-if="tab.id === 'identity'" :content="content" @navigate="selectModule" />
        <HomeWorkspace v-else-if="tab.id === 'workspace' && visited.workspace" :projects="content.projects" :external-links="content.externalLinks" />
        <HomeProjects v-else-if="tab.id === 'projects' && visited.projects" :username="content.github.username" />
        <HomeStack v-else-if="tab.id === 'stack' && visited.stack" :tags="content.profile.tags" />
      </section>
    </main>
    <footer class="homeFooter">
      <span>© {{ year }} {{ content.profile.displayName }}</span>
      <span>Built with curiosity.<span class="footerDot" aria-hidden="true"> · </span><a href="/admin" data-astro-reload>管理</a></span>
    </footer>
    <nav class="moduleDock homeDock" role="tablist" aria-label="内容模块" aria-orientation="horizontal">
      <button v-for="(tab, index) in moduleTabs" :id="`${tab.id}-tab`" :key="tab.id" class="homeDockButton" :class="{ 'is-active': activeModule === tab.id }" type="button" role="tab" :aria-selected="activeModule === tab.id" :aria-controls="`${tab.id}-panel`" :tabindex="activeModule === tab.id ? 0 : -1" @click="selectModule(tab.id)" @keydown="handleTabKeydown($event, index)">
        <component :is="tab.icon" :size="20" :stroke-width="1.6" aria-hidden="true" /><span>{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Command, Cpu, FolderGit2, LayoutGrid, Moon, Sun, UserRound } from '@lucide/vue'
import HomeIdentity from './home/HomeIdentity.vue'
import type { SiteContent } from '../utils/site-content'
import { setCookie } from '../utils/cookie.js'
defineProps<{ content: SiteContent }>()
const HomeWorkspace = defineAsyncComponent(() => import('./home/HomeWorkspace.vue'))
const HomeProjects = defineAsyncComponent(() => import('./home/HomeProjects.vue'))
const HomeStack = defineAsyncComponent(() => import('./home/HomeStack.vue'))
type ModuleId = 'identity' | 'workspace' | 'projects' | 'stack'
const moduleTabs = [
  { id: 'identity' as const, label: '身份', icon: UserRound },
  { id: 'workspace' as const, label: '工作区', icon: LayoutGrid },
  { id: 'projects' as const, label: '项目', icon: FolderGit2 },
  { id: 'stack' as const, label: '技术栈', icon: Cpu },
]
const activeModule = ref<ModuleId>('identity')
const visited = ref({ identity: true, workspace: false, projects: false, stack: false })
const theme = ref('Light')
const year = new Date().getFullYear()
function syncHash() {
  const id = window.location.hash.replace(/^#\/?/, '')
  const selected = moduleTabs.find(tab => tab.id === id)?.id
  if (!selected && id) return
  const next = selected || 'identity'
  activeModule.value = next
  visited.value[next] = true
}
function focusContent() {
  document.getElementById('home-content')?.focus()
}
function selectModule(id: ModuleId) {
  if (id === activeModule.value) return
  activeModule.value = id
  visited.value[id] = true
  window.location.hash = id === 'identity' ? '/' : `/${id}`
  window.scrollTo({ top: 0, behavior: 'instant' })
}
async function handleTabKeydown(event: KeyboardEvent, index: number) {
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % moduleTabs.length
  else if (event.key === 'ArrowLeft') next = (index + moduleTabs.length - 1) % moduleTabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = moduleTabs.length - 1
  else return
  event.preventDefault()
  selectModule(moduleTabs[next].id)
  await nextTick()
  document.getElementById(`${moduleTabs[next].id}-tab`)?.focus()
}
function toggleTheme() {
  theme.value = theme.value === 'Dark' ? 'Light' : 'Dark'
  document.documentElement.dataset.theme = theme.value
  setCookie('themeState', theme.value, 365)
}
onMounted(() => {
  theme.value = document.documentElement.dataset.theme || 'Light'
  syncHash()
  window.addEventListener('hashchange', syncHash)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', syncHash))
</script>

<style scoped>
.homePage { position: relative; z-index: 1; width: min(1120px, calc(100% - 96px)); min-height: 100svh; margin: auto; padding-bottom: 124px; }
.homeTopbar { height: 126px; display: flex; justify-content: space-between; align-items: center; }
.homeBrand { display: flex; align-items: center; gap: 12px; min-width: 0; max-width: calc(100% - 54px); font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; }
.homeBrandName { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.homeBrand > svg, .brandSeal { flex-shrink: 0; }
.brandSuffix { color: var(--home-muted); }
.brandSeal { display: grid; place-items: center; width: 22px; height: 22px; margin-left: 2px; border-radius: 7px; background: var(--home-soft); color: var(--home-muted); font-size: 10px; letter-spacing: 0; }
.homeTheme { width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--home-muted); cursor: pointer; }
.homeTheme:hover { background: var(--home-soft); color: var(--home-text); }
.homeMain { min-height: min(570px, calc(100svh - 250px)); outline: none; }
.homePanel[hidden] { display: none; }
.homePanel { min-width: 0; animation: homeEnter 0.35s ease; }
.homeFooter { margin-top: 42px; display: flex; justify-content: space-between; gap: 16px; font-size: 10px; line-height: 1.8; color: var(--home-muted); letter-spacing: 0.03em; }
.homeFooter a:hover { color: var(--home-text); }
.footerDot { padding: 0 6px; }
.homeDock.moduleDock { position: fixed; inset: auto auto calc(22px + env(safe-area-inset-bottom)) 50%; transform: translateX(-50%); z-index: 30; display: flex; width: auto; margin: 0; padding: 7px; gap: 4px; border: 1px solid var(--home-border); border-radius: 24px; background: var(--home-surface); box-shadow: 0 12px 40px rgb(0 0 0 / 8%); backdrop-filter: blur(20px); }
.homeDockButton { width: 65px; height: 58px; border: 0; border-radius: 17px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--home-muted); background: transparent; cursor: pointer; transition: color 0.18s, background 0.18s, transform 0.18s; }
.homeDockButton span { font-size: 10px; }
.homeDockButton:hover { color: var(--home-text); transform: translateY(-2px); }
.homeDockButton.is-active { color: var(--home-text); background: var(--home-soft); }
.homeSkip { position: fixed; top: -80px; left: 24px; padding: 12px 18px; border: 1px solid var(--home-border); border-radius: 12px; background: var(--home-bg); z-index: 40; }
.homeSkip:focus { top: 18px; }
@keyframes homeEnter { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 700px) {
  .homePage { width: calc(100% - 40px); padding-bottom: 120px; }
  .homeTopbar { height: 96px; }
  .homeBrand { gap: 9px; letter-spacing: 0.14em; }
  .homeFooter { flex-wrap: wrap; margin-top: 30px; gap: 6px 16px; }
  .homeDock.moduleDock { bottom: calc(16px + env(safe-area-inset-bottom)); }
}
@media (prefers-reduced-motion: reduce) { .homePanel { animation: none; } .homeDockButton { transition: none; } }
</style>
