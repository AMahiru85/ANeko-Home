<template>
  <section class="homeWorkspace" aria-labelledby="home-workspace-title">
    <div class="workspaceHeading">
      <div>
        <p class="sectionEyebrow">WORKSPACE</p>
        <h2 id="home-workspace-title">日常工作台</h2>
      </div>
      <span class="sectionCaption">一点工具，一点秩序</span>
    </div>

    <form class="workspaceSearch" role="search" aria-label="网页搜索" @submit.prevent="searchWeb">
      <Search :size="19" :stroke-width="1.8" aria-hidden="true" />
      <input v-model="searchQuery" type="search" aria-label="搜索关键词" placeholder="搜索一点灵感…" maxlength="500" />
      <button type="submit" :disabled="!searchQuery.trim()" aria-label="在新标签页使用 Bing 搜索">
        <span>搜索</span><ArrowUpRight :size="16" aria-hidden="true" />
      </button>
    </form>

    <div class="workspaceConditions">
      <TimeWidget />
      <WeatherWidget />
    </div>

    <div class="workspaceTools">
      <section class="workspaceCard focusCard" aria-labelledby="workspace-focus-title">
        <div class="cardHeading">
          <h3 id="workspace-focus-title"><Timer :size="17" aria-hidden="true" />专注时刻</h3>
          <span class="cardHint">25 / 5</span>
        </div>
        <div class="focusModes" role="group" aria-label="选择计时模式">
          <button type="button" :aria-pressed="focusMode === 'focus'" @click="selectFocusMode('focus')">专注 25 分钟</button>
          <button type="button" :aria-pressed="focusMode === 'break'" @click="selectFocusMode('break')">休息 5 分钟</button>
        </div>
        <output class="focusClock" role="timer" aria-live="off" :aria-label="`剩余 ${remainingMinutes} 分 ${remainingSeconds} 秒`">{{ timerText }}</output>
        <div class="focusProgress" aria-hidden="true"><span :style="{ width: `${timerProgress}%` }"></span></div>
        <div class="focusActions">
          <button class="primaryButton" type="button" @click="toggleFocusTimer">
            <Pause v-if="isTimerRunning" :size="15" aria-hidden="true" /><Play v-else :size="15" aria-hidden="true" />
            {{ isTimerRunning ? '暂停' : remaining === 0 ? '再来一次' : '开始' }}
          </button>
          <button class="iconButton" type="button" aria-label="重置计时器" title="重置计时器" @click="resetFocusTimer"><RotateCcw :size="16" aria-hidden="true" /></button>
          <p class="focusNotice" role="status">{{ timerNotice || (isTimerRunning ? '把注意力留给眼前这一件事。' : '准备好了，就开始吧。') }}</p>
        </div>
      </section>

      <section class="workspaceCard todoCard" aria-labelledby="workspace-todo-title">
        <div class="cardHeading">
          <h3 id="workspace-todo-title"><ListTodo :size="17" aria-hidden="true" />今日待办</h3>
          <span class="cardHint">{{ unfinishedTasks }} 件未完成</span>
        </div>
        <form class="todoForm" @submit.prevent="addTask">
          <input v-model="newTask" type="text" aria-label="新增待办内容" placeholder="记下一件小事" maxlength="150" :disabled="tasks.length >= 20" />
          <button class="iconButton" type="submit" :disabled="!newTask.trim() || tasks.length >= 20" aria-label="添加待办"><Plus :size="17" aria-hidden="true" /></button>
        </form>
        <ul v-if="tasks.length" class="todoList" aria-label="待办事项">
          <li v-for="task in tasks" :key="task.id" :class="{ 'is-complete': task.completed }">
            <label>
              <input v-model="task.completed" type="checkbox" />
              <span class="todoCheckbox" aria-hidden="true"><Check v-if="task.completed" :size="12" /></span>
              <span class="todoText">{{ task.text }}</span>
            </label>
            <button class="todoRemove" type="button" :aria-label="`删除待办：${task.text}`" @click="removeTask(task.id)"><X :size="14" aria-hidden="true" /></button>
          </li>
        </ul>
        <div v-else class="todoEmpty"><ListTodo :size="26" :stroke-width="1.3" aria-hidden="true" /><p>从一件小事开始。</p></div>
        <div class="todoFooter">
          <span>{{ storageMessage || (tasks.length >= 20 ? '最多保留 20 件待办' : '待办保存在当前浏览器') }}</span>
          <button v-if="tasks.some((task) => task.completed)" type="button" @click="clearCompletedTasks">清除已完成</button>
        </div>
      </section>
    </div>

    <section v-if="projects.length" class="workspaceServices" aria-labelledby="workspace-services-title">
      <div class="subsectionHeading"><h3 id="workspace-services-title"><LayoutGrid :size="16" aria-hidden="true" />我的站点</h3><span>常用入口</span></div>
      <div class="workspaceServiceGrid">
        <a v-for="project in projects" :key="project.id" class="serviceCard" :href="project.url" :target="project.external ? '_blank' : undefined" :rel="project.external ? 'noopener noreferrer' : undefined">
          <span class="serviceIcon"><img :src="project.img" alt="" width="24" height="24" loading="lazy" decoding="async" /></span>
          <span class="serviceName">{{ project.name }}<small>{{ project.external ? '在新标签页打开' : '进入站点' }}</small></span>
          <ArrowUpRight :size="15" class="serviceArrow" aria-hidden="true" />
        </a>
      </div>
    </section>

    <section v-if="externalLinks.length" class="workspaceLinks" aria-labelledby="workspace-links-title">
      <div class="subsectionHeading"><h3 id="workspace-links-title"><Link2 :size="16" aria-hidden="true" />网络收藏夹</h3><span>随时出发</span></div>
      <div class="workspaceLinkGrid">
        <a v-for="link in externalLinks" :key="link.id" :href="link.url" target="_blank" rel="noopener noreferrer">
          <span class="linkIcon"><Link2 :size="16" aria-hidden="true" /></span>
          <span class="linkCopy"><strong>{{ link.name }}</strong><small v-if="link.meta">{{ link.meta }}</small></span>
          <ArrowUpRight :size="15" aria-hidden="true" />
        </a>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowUpRight, Check, LayoutGrid, Link2, ListTodo, Pause, Play, Plus, RotateCcw, Search, Timer, X } from '@lucide/vue'
import TimeWidget from '../TimeWidget.vue'
import WeatherWidget from '../WeatherWidget.vue'
import type { SiteExternalLink, SiteProject } from '../../utils/site-content'

defineProps<{ projects: SiteProject[]; externalLinks: SiteExternalLink[] }>()

const searchQuery = ref('')

function searchWeb() {
  const query = searchQuery.value.trim()
  if (!query) return
  window.open(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer')
}

type FocusMode = 'focus' | 'break'
const durations: Record<FocusMode, number> = { focus: 25 * 60, break: 5 * 60 }
const focusMode = ref<FocusMode>('focus')
const remaining = ref(durations.focus)
const isTimerRunning = ref(false)
const timerNotice = ref('')
const remainingMinutes = computed(() => Math.floor(remaining.value / 60))
const remainingSeconds = computed(() => remaining.value % 60)
const timerText = computed(() => `${String(remainingMinutes.value).padStart(2, '0')}:${String(remainingSeconds.value).padStart(2, '0')}`)
const timerProgress = computed(() => (1 - remaining.value / durations[focusMode.value]) * 100)
let timerInterval: number | null = null
let timerDeadline = 0

function stopTimer() {
  if (timerInterval !== null) window.clearInterval(timerInterval)
  timerInterval = null
  isTimerRunning.value = false
}

function updateTimer() {
  remaining.value = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000))
  if (remaining.value === 0) {
    stopTimer()
    timerNotice.value = focusMode.value === 'focus' ? '专注完成，切换到休息放松一下。' : '休息完成，准备开始下一次专注。'
  }
}

function toggleFocusTimer() {
  if (isTimerRunning.value) {
    updateTimer()
    stopTimer()
    return
  }
  if (remaining.value === 0) remaining.value = durations[focusMode.value]
  timerNotice.value = ''
  timerDeadline = Date.now() + remaining.value * 1000
  isTimerRunning.value = true
  timerInterval = window.setInterval(updateTimer, 250)
}

function resetFocusTimer() {
  stopTimer()
  remaining.value = durations[focusMode.value]
  timerNotice.value = ''
}

function selectFocusMode(mode: FocusMode) {
  if (mode === focusMode.value) return
  focusMode.value = mode
  resetFocusTimer()
}

interface WorkspaceTask { id: string; text: string; completed: boolean }
const TASK_STORAGE_KEY = 'aneko:workspace:tasks:v1'
const tasks = ref<WorkspaceTask[]>([])
const newTask = ref('')
const storageMessage = ref('')
const unfinishedTasks = computed(() => tasks.value.filter((task) => !task.completed).length)
let storageReady = false

function isWorkspaceTask(value: unknown): value is WorkspaceTask {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 80
    && typeof item.text === 'string' && item.text.trim().length > 0 && item.text.length <= 150
    && typeof item.completed === 'boolean'
}

function addTask() {
  const text = newTask.value.trim()
  if (!text || tasks.value.length >= 20) return
  const id = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  tasks.value.push({ id, text, completed: false })
  newTask.value = ''
}

function removeTask(id: string) { tasks.value = tasks.value.filter((task) => task.id !== id) }
function clearCompletedTasks() { tasks.value = tasks.value.filter((task) => !task.completed) }

onMounted(() => {
  try {
    const saved = window.localStorage.getItem(TASK_STORAGE_KEY)
    if (saved) {
      const items: unknown = JSON.parse(saved)
      if (Array.isArray(items)) {
        const uniqueIds = new Set<string>()
        tasks.value = items.filter(isWorkspaceTask).filter((task) => {
          if (uniqueIds.has(task.id)) return false
          uniqueIds.add(task.id)
          return true
        }).slice(0, 20).map((task) => ({ id: task.id, text: task.text.trim(), completed: task.completed }))
      }
    }
  } catch {
    storageMessage.value = '浏览器存储不可用，待办仅在本次访问保留'
  }
  storageReady = true
})

watch(tasks, (value) => {
  if (!storageReady) return
  try {
    window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(value))
    storageMessage.value = ''
  } catch {
    storageMessage.value = '浏览器存储不可用，待办仅在本次访问保留'
  }
}, { deep: true })

onBeforeUnmount(stopTimer)
</script>

<style scoped>
.homeWorkspace { color: var(--home-text); }
.workspaceHeading, .cardHeading, .subsectionHeading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.workspaceHeading { margin-bottom: 24px; }
.sectionEyebrow { margin-bottom: 9px; color: var(--home-accent); font-size: 10px; font-weight: 600; letter-spacing: .18em; }
.workspaceHeading h2 { margin: 0; font-size: clamp(23px, 3vw, 29px); line-height: 1.35; font-weight: 600; letter-spacing: -.04em; }
.sectionCaption { color: var(--home-muted); font-size: 11px; }
.workspaceSearch { display: flex; align-items: center; gap: 14px; min-height: 56px; padding: 8px 9px 8px 20px; margin-bottom: 20px; border: 1px solid var(--home-border); border-radius: 14px; background: var(--home-surface); }
.workspaceSearch > svg { flex-shrink: 0; color: var(--home-muted); }
input, button { font: inherit; }
input { min-width: 0; color: var(--home-text); background: transparent; border: 0; border-radius: 0; outline: 0; }
input::placeholder { color: var(--home-muted); opacity: .8; }
input:disabled { cursor: not-allowed; }
button { display: inline-flex; justify-content: center; align-items: center; gap: 7px; color: var(--home-text); border: 0; cursor: pointer; }
button:disabled { opacity: .4; cursor: not-allowed; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--home-accent); outline-offset: 4px; }
.workspaceSearch:focus-within, .todoForm:focus-within { border-color: var(--home-accent); }
.workspaceSearch input { flex: 1; width: 100%; min-height: 36px; font-size: 13px; }
.workspaceSearch button { min-height: 38px; padding: 0 15px; border-radius: 9px; background: var(--home-soft); font-size: 11px; white-space: nowrap; }
.workspaceConditions, .workspaceTools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.workspaceConditions { margin-bottom: 18px; }
.workspaceConditions :deep(.timeModule), .workspaceConditions :deep(.weatherModule) { height: 167px; min-height: 167px; margin: 0; border: 1px solid var(--home-border); border-radius: 15px; padding: 23px; color: var(--home-text); background: var(--home-surface); backdrop-filter: none; -webkit-backdrop-filter: none; }
.workspaceConditions :deep(.timeDate) { margin-bottom: 15px; color: var(--home-muted); opacity: 1; font-size: 11px; }
.workspaceConditions :deep(.timeDisplay) { width: 100%; flex-direction: row; gap: 20px; justify-content: space-between; }
.workspaceConditions :deep(.timeValue) { font-size: clamp(43px, 5.5vw, 69px); line-height: 1; font-weight: 300; letter-spacing: -.06em; }
.workspaceConditions :deep(.sunTransit) { width: 64px; padding-bottom: 2px; }
.workspaceConditions :deep(.sunTransitArc) { transform: scale(.74); transform-origin: bottom left; width: 84px; height: 42px; }
.workspaceConditions :deep(.sunTransitDot) { background: var(--home-accent); border-color: var(--home-accent); }
.workspaceConditions :deep(.sunTransitLabel) { font-size: 8px; }
.workspaceConditions :deep(.weatherReading) { font-size: 24px; }
.workspaceConditions :deep(.weatherTemperature) { font-size: 26px; }
.workspaceConditions :deep(.weatherSummaryMeta), .workspaceConditions :deep(.weatherLocation) { color: var(--home-muted); }
.workspaceConditions :deep(.weatherSummaryMeta) { font-size: 9px; }
.workspaceConditions :deep(.weatherLocation) { font-size: 10px; }
.workspaceConditions :deep(.weatherRefresh), .workspaceConditions :deep(.weatherDetails) { color: var(--home-muted); background: var(--home-soft); border-color: var(--home-border); }
.workspaceCard { min-width: 0; padding: 22px; border: 1px solid var(--home-border); border-radius: 15px; background: var(--home-surface); }
.cardHeading h3, .subsectionHeading h3 { display: flex; align-items: center; gap: 9px; margin: 0; font-size: 12px; font-weight: 600; }
.cardHeading h3 svg, .subsectionHeading h3 svg { color: var(--home-muted); flex-shrink: 0; }
.cardHint { font-size: 9px; color: var(--home-muted); white-space: nowrap; }
.focusModes { display: flex; gap: 3px; width: fit-content; padding: 3px; margin: 21px 0 18px; border-radius: 8px; background: var(--home-soft); }
.focusModes button { min-height: 27px; padding: 0 11px; color: var(--home-muted); background: transparent; border-radius: 6px; font-size: 9px; }
.focusModes button[aria-pressed="true"] { background: var(--home-surface); color: var(--home-text); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.focusClock { display: block; margin-bottom: 17px; font-family: ui-sans-serif, system-ui, sans-serif; font-variant-numeric: tabular-nums; font-size: 49px; font-weight: 300; line-height: 1.1; letter-spacing: -.04em; }
.focusProgress { height: 3px; overflow: hidden; border-radius: 2px; background: var(--home-soft); }
.focusProgress span { display: block; height: 100%; background: var(--home-accent); transition: width .25s linear; }
.focusActions { display: flex; align-items: center; gap: 8px; margin-top: 18px; }
.primaryButton { min-height: 32px; padding: 0 13px; border-radius: 8px; background: var(--home-accent); color: #fff; font-size: 10px; flex-shrink: 0; }
.iconButton { width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px; background: var(--home-soft); }
.focusNotice { margin: 0 0 0 3px; color: var(--home-muted); font-size: 9px; line-height: 1.6; }
.todoCard { display: flex; flex-direction: column; }
.todoForm { display: flex; align-items: center; gap: 8px; margin-top: 21px; padding: 4px 4px 4px 12px; border: 1px solid var(--home-border); border-radius: 9px; }
.todoForm input { width: 100%; flex: 1; min-height: 30px; font-size: 11px; }
.todoForm .iconButton { width: 29px; height: 29px; }
.todoList { max-height: 134px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--home-border) transparent; margin: 12px 0; padding: 0; list-style: none; }
.todoList::-webkit-scrollbar { width: 3px; }
.todoList::-webkit-scrollbar-thumb { background: var(--home-border); border-radius: 3px; }
.todoList li { display: flex; align-items: center; gap: 8px; min-height: 35px; }
.todoList label { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; cursor: pointer; }
.todoList input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.todoCheckbox { width: 15px; height: 15px; border: 1px solid var(--home-border); border-radius: 4px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
.todoList input:focus-visible + .todoCheckbox { outline: 2px solid var(--home-accent); outline-offset: 3px; }
.todoText { min-width: 0; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.is-complete .todoCheckbox { border-color: var(--home-accent); background: var(--home-accent); color: #fff; }
.is-complete .todoText { color: var(--home-muted); text-decoration: line-through; }
.todoRemove { width: 28px; height: 28px; flex-shrink: 0; color: var(--home-muted); background: transparent; border-radius: 6px; }
.todoRemove:hover { color: var(--home-text); background: var(--home-soft); }
.todoEmpty { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 9px; min-height: 100px; color: var(--home-muted); opacity: .7; }
.todoEmpty p { margin: 0; font-size: 10px; }
.todoFooter { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 8px; color: var(--home-muted); font-size: 8px; line-height: 1.5; }
.todoFooter button { padding: 0; background: transparent; color: var(--home-accent); font-size: 9px; white-space: nowrap; }
.workspaceServices, .workspaceLinks { margin-top: 30px; }
.subsectionHeading { margin-bottom: 14px; }
.subsectionHeading > span { color: var(--home-muted); font-size: 9px; }
.workspaceServiceGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.serviceCard { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 17px; min-height: 127px; padding: 17px; color: var(--home-text); border: 1px solid var(--home-border); border-radius: 12px; background: var(--home-surface); text-decoration: none; transition: border-color .18s ease, transform .18s ease; }
.serviceCard:hover { transform: translateY(-3px); border-color: var(--home-accent); }
.serviceIcon { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 7px; border-radius: 9px; background: var(--home-soft); }
.serviceIcon img { width: 100%; height: 100%; object-fit: contain; }
.serviceName { font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }
.serviceName small { display: block; margin-top: 4px; color: var(--home-muted); font-size: 8px; font-weight: 400; }
.serviceArrow { position: absolute; top: 17px; right: 16px; color: var(--home-muted); }
.workspaceLinkGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.workspaceLinkGrid a { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 16px; color: var(--home-text); border: 1px solid var(--home-border); border-radius: 12px; background: var(--home-surface); text-decoration: none; transition: border-color .18s ease; }
.workspaceLinkGrid a:hover { border-color: var(--home-accent); }
.linkIcon { color: var(--home-muted); flex-shrink: 0; }
.linkCopy { min-width: 0; flex: 1; }
.linkCopy strong { display: block; font-size: 11px; font-weight: 500; overflow-wrap: anywhere; }
.linkCopy small { display: block; margin-top: 4px; color: var(--home-muted); font-size: 9px; overflow-wrap: anywhere; }
.workspaceLinkGrid a > svg { flex-shrink: 0; color: var(--home-muted); }
@media (max-width: 1050px) {
  .workspaceServiceGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workspaceConditions :deep(.timeValue) { font-size: 52px; }
  .workspaceConditions :deep(.sunTransit) { display: none; }
  .workspaceLinkGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
  .workspaceHeading { align-items: flex-end; gap: 10px; }
  .sectionCaption { display: none; }
  .workspaceSearch { padding-left: 14px; gap: 10px; }
  .workspaceSearch button { padding-inline: 11px; }
  .workspaceConditions, .workspaceTools { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .workspaceConditions { margin-bottom: 12px; }
  .workspaceConditions :deep(.timeModule), .workspaceConditions :deep(.weatherModule) { height: 153px; min-height: 153px; }
  .workspaceConditions :deep(.timeValue) { font-size: 60px; }
  .workspaceConditions :deep(.sunTransit) { display: block; }
  .workspaceCard { padding: 20px; }
  .focusClock { font-size: 52px; }
  .todoEmpty { min-height: 94px; }
  .workspaceLinkGrid { grid-template-columns: minmax(0, 1fr); }
  .workspaceServices, .workspaceLinks { margin-top: 25px; }
}
@media (prefers-reduced-motion: reduce) {
  .serviceCard, .workspaceLinkGrid a, .focusProgress span { transition: none; }
}
</style>
