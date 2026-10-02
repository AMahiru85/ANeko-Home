<template>
  <section class="adminConsole" aria-labelledby="admin-console-title">
    <header class="adminConsoleHeader">
      <div>
        <p>ANeko / CONTROL ROOM</p>
        <h2 id="admin-console-title">管理控制台</h2>
      </div>
      <div class="adminHeaderActions">
        <a href="/" target="_blank" rel="noreferrer">查看主页</a>
        <button v-if="accessCode" type="button" @click="logout">退出登录</button>
      </div>
    </header>

    <nav class="adminTabs" aria-label="管理模块">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="{ 'is-active': activeTab === tab.id }"
        :aria-current="activeTab === tab.id ? 'page' : undefined"
        :disabled="!accessCode"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div v-if="authChecking" class="adminGate" role="status">正在检查管理员会话…</div>
    <div v-else-if="!accessCode" class="adminGate">
      <button type="button" @click="openLogin">管理员登录</button>
    </div>

    <section v-else-if="activeTab === 'site'" class="siteEditor" aria-labelledby="site-editor-title">
      <div class="siteEditorHeading">
        <div>
          <p>PUBLIC SITE</p>
          <h3 id="site-editor-title">首页内容</h3>
          <span>保存后会更新首页介绍、GitHub 展示、侧栏和站点入口。</span>
        </div>
        <div class="siteEditorActions">
          <a href="/" target="_blank" rel="noreferrer">预览主页 ↗</a>
          <button class="is-primary" type="button" :disabled="loading || saving" @click="saveContent">
            {{ saving ? '保存中…' : '保存设置' }}
          </button>
        </div>
      </div>

      <p v-if="notice" class="siteEditorNotice" :class="{ 'is-error': noticeKind === 'error' }" role="status">{{ notice }}</p>

      <div v-if="loading" class="siteEditorState" role="status">正在载入站点内容…</div>
      <div v-else-if="loadError" class="siteEditorState is-error" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" @click="loadContent">重试</button>
      </div>
      <form v-else class="siteEditorForm" @submit.prevent="saveContent">
        <section class="siteEditorSection">
          <header><span>01</span><div><h4>个人介绍</h4><p>显示在主页顶部和搜索摘要中。</p></div></header>
          <div class="siteEditorGrid">
            <label>欢迎语<input v-model="draft.profile.greeting" maxlength="80" required /></label>
            <label>显示名称<input v-model="draft.profile.displayName" maxlength="80" required /></label>
            <label>身份 / 职位<input v-model="draft.profile.role" maxlength="160" /></label>
            <label>GitHub 账号<input v-model="draft.github.username" maxlength="39" autocomplete="off" required /></label>
            <label class="is-wide">介绍语<textarea v-model="draft.profile.introduction" rows="3" maxlength="500"></textarea></label>
            <label class="is-wide">站点描述<textarea v-model="draft.profile.description" rows="3" maxlength="300"></textarea></label>
            <label>所在地<input v-model="draft.profile.location" maxlength="120" /></label>
            <label>学校 / 组织<input v-model="draft.profile.education" maxlength="120" /></label>
            <label class="is-wide">标签（每行一个）<textarea v-model="tagsText" rows="3" maxlength="1000"></textarea></label>
          </div>
        </section>

        <section class="siteEditorSection">
          <header>
            <span>02</span><div><h4>时间线</h4><p>按列表顺序显示；关闭的条目会从主页隐藏。</p></div>
            <button class="is-secondary" type="button" @click="addTimelineItem">添加条目</button>
          </header>
          <div v-if="draft.timeline.length" class="timelineEditorList">
            <article v-for="(item, index) in draft.timeline" :key="item.id" class="timelineEditorItem">
              <span class="timelineEditorIndex">{{ String(index + 1).padStart(2, '0') }}</span>
              <label>日期<input v-model="item.date" maxlength="40" required /></label>
              <label class="timelineEditorCopy">内容<textarea v-model="item.content" rows="2" maxlength="500" required></textarea></label>
              <label class="timelineEditorEnabled"><input v-model="item.enabled" type="checkbox" />显示</label>
              <div class="siteEditorRowActions">
                <button class="is-reorder" type="button" :disabled="index === 0" :aria-label="`上移时间线条目 ${index + 1}`" @click="moveItem(draft.timeline, index, -1)">↑</button>
                <button class="is-reorder" type="button" :disabled="index === draft.timeline.length - 1" :aria-label="`下移时间线条目 ${index + 1}`" @click="moveItem(draft.timeline, index, 1)">↓</button>
                <button class="is-remove" type="button" :aria-label="`删除时间线条目 ${index + 1}`" @click="removeTimelineItem(index)">删除</button>
              </div>
            </article>
          </div>
          <p v-else class="siteEditorEmpty">还没有时间线条目。</p>
        </section>

        <section class="siteEditorSection">
          <header><span>03</span><div><h4>站内项目</h4><p>主页功能入口卡片。</p></div><button class="is-secondary" type="button" @click="addProject">添加项目</button></header>
          <div class="repeatEditorList">
            <article v-for="(project, index) in draft.projects" :key="project.id" class="repeatEditorItem is-project">
              <label>名称<input v-model="project.name" maxlength="80" required /></label>
              <label>链接<input v-model="project.url" maxlength="2048" required /></label>
              <label>图标路径<input v-model="project.img" maxlength="2048" required /></label>
              <label class="projectExternal"><input v-model="project.external" type="checkbox" />站外链接</label>
              <div class="siteEditorRowActions">
                <button class="is-reorder" type="button" :disabled="index === 0" :aria-label="`上移项目 ${index + 1}`" @click="moveItem(draft.projects, index, -1)">↑</button>
                <button class="is-reorder" type="button" :disabled="index === draft.projects.length - 1" :aria-label="`下移项目 ${index + 1}`" @click="moveItem(draft.projects, index, 1)">↓</button>
                <button class="is-remove" type="button" :aria-label="`删除项目 ${index + 1}`" @click="removeProject(index)">删除</button>
              </div>
            </article>
          </div>
        </section>

        <section class="siteEditorSection">
          <header><span>04</span><div><h4>外部链接</h4><p>主页链接模块中展示的站外入口。</p></div><button class="is-secondary" type="button" @click="addExternalLink">添加链接</button></header>
          <div class="repeatEditorList">
            <article v-for="(link, index) in draft.externalLinks" :key="link.id" class="repeatEditorItem">
              <label>名称<input v-model="link.name" maxlength="80" required /></label>
              <label>说明<input v-model="link.meta" maxlength="120" /></label>
              <label>网址<input v-model="link.url" maxlength="2048" required /></label>
              <div class="siteEditorRowActions">
                <button class="is-reorder" type="button" :disabled="index === 0" :aria-label="`上移外部链接 ${index + 1}`" @click="moveItem(draft.externalLinks, index, -1)">↑</button>
                <button class="is-reorder" type="button" :disabled="index === draft.externalLinks.length - 1" :aria-label="`下移外部链接 ${index + 1}`" @click="moveItem(draft.externalLinks, index, 1)">↓</button>
                <button class="is-remove" type="button" :aria-label="`删除外部链接 ${index + 1}`" @click="removeExternalLink(index)">删除</button>
              </div>
            </article>
          </div>
        </section>

        <footer class="siteEditorFooter">
          <span>更改会写入 Cloudflare KV；公开字段会显示在主页。</span>
          <button class="is-primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存所有更改' }}</button>
        </footer>
      </form>
    </section>

    <div v-else class="adminPanel">
      <component :is="activePanel" v-if="activePanel" admin-mode :public-address="''" />
    </div>

    <AdminLoginDialog
      v-if="loginDialogLoaded"
      :open="showLogin"
      @close="showLogin = false"
      @authenticated="handleAuthenticated"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { ADMIN_ACCESS_CLEARED_EVENT, apiRequest, clearAdminAccess, restoreAdminAccess } from '../utils/admin-client'
import { DEFAULT_SITE_CONTENT, type SiteContent } from '../utils/site-content'
import { userErrorMessage } from '../utils/user-error'

const AdminLoginDialog = defineAsyncComponent(() => import('./AdminLoginDialog.vue'))
const BlogManager = defineAsyncComponent(() => import('./BlogManager.vue'))
const PhotoGallery = defineAsyncComponent(() => import('./PhotoGallery.vue'))
const DriveShell = defineAsyncComponent(() => import('./DriveShell.vue'))
const MailShell = defineAsyncComponent(() => import('./MailShell.vue'))

const tabs = [
  { id: 'site', label: '首页内容' },
  { id: 'blog', label: '博客' },
  { id: 'photos', label: '相册' },
  { id: 'drive', label: '云盘' },
  { id: 'mail', label: '邮箱' },
] as const
type TabId = typeof tabs[number]['id']

const panelByTab = { blog: BlogManager, photos: PhotoGallery, drive: DriveShell, mail: MailShell }
const accessCode = ref('')
const authChecking = ref(true)
const showLogin = ref(false)
const loginDialogLoaded = ref(false)
const activeTab = ref<TabId>('site')
const activePanel = computed(() => activeTab.value === 'site' ? null : panelByTab[activeTab.value])
const draft = ref<SiteContent>(cloneDefaultContent())
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')

const tagsText = computed({
  get: () => draft.value.profile.tags.join('\n'),
  set: (value: string) => { draft.value.profile.tags = value.split(/\r?\n/u).map((tag) => tag.trim()).filter(Boolean) },
})

function cloneDefaultContent(): SiteContent {
  return JSON.parse(JSON.stringify(DEFAULT_SITE_CONTENT)) as SiteContent
}

function setNotice(message: string, kind: 'success' | 'error' = 'success') {
  notice.value = message
  noticeKind.value = kind
}

function adminHeaders() {
  return { 'Content-Type': 'application/json', 'X-Access-Code': accessCode.value }
}

async function loadContent() {
  if (!accessCode.value) return
  loading.value = true
  loadError.value = ''
  try {
    draft.value = await apiRequest<SiteContent>('/api/admin/site-content', {
      headers: { 'X-Access-Code': accessCode.value },
    })
  } catch (error) {
    loadError.value = userErrorMessage(error, '无法读取站点内容，请稍后重试。')
  } finally {
    loading.value = false
  }
}

async function saveContent() {
  if (!accessCode.value || saving.value) return
  saving.value = true
  notice.value = ''
  try {
    draft.value = await apiRequest<SiteContent>('/api/admin/site-content', {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(draft.value),
    })
    setNotice('首页内容已保存。')
  } catch (error) {
    setNotice(userErrorMessage(error, '保存失败，请检查输入后重试。'), 'error')
  } finally {
    saving.value = false
  }
}

function addTimelineItem() {
  draft.value.timeline.push({ id: crypto.randomUUID(), date: '', content: '', enabled: true })
}

function removeTimelineItem(index: number) { draft.value.timeline.splice(index, 1) }

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return
  const [item] = items.splice(index, 1)
  items.splice(target, 0, item)
}

function addProject() {
  draft.value.projects.push({ id: crypto.randomUUID(), name: '', url: '/', img: '/static/svg/blog.svg', external: false })
}

function removeProject(index: number) { draft.value.projects.splice(index, 1) }

function addExternalLink() {
  draft.value.externalLinks.push({ id: crypto.randomUUID(), name: '', meta: '', url: 'https://' })
}

function removeExternalLink(index: number) { draft.value.externalLinks.splice(index, 1) }

function selectTab(tab: TabId) {
  activeTab.value = tab
  const url = new URL(window.location.href)
  if (tab === 'site') url.searchParams.delete('tab')
  else url.searchParams.set('tab', tab)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function openLogin() {
  loginDialogLoaded.value = true
  showLogin.value = true
}

async function handleAuthenticated(code: string) {
  accessCode.value = code
  showLogin.value = false
  await loadContent()
}

function logout() {
  clearAdminAccess()
  accessCode.value = ''
  draft.value = cloneDefaultContent()
  selectTab('site')
}

function handleAdminAccessCleared() {
  accessCode.value = ''
  draft.value = cloneDefaultContent()
  loading.value = false
  saving.value = false
}

watch(showLogin, (open) => {
  if (open) loginDialogLoaded.value = true
}, { flush: 'sync' })

onMounted(async () => {
  window.addEventListener(ADMIN_ACCESS_CLEARED_EVENT, handleAdminAccessCleared)
  const tab = new URLSearchParams(window.location.search).get('tab')
  if (tabs.some((candidate) => candidate.id === tab)) activeTab.value = tab as TabId

  accessCode.value = await restoreAdminAccess()
  authChecking.value = false
  if (accessCode.value) await loadContent()
})

onUnmounted(() => {
  window.removeEventListener(ADMIN_ACCESS_CLEARED_EVENT, handleAdminAccessCleared)
})
</script>

<style scoped>
.adminConsole { width: min(100% - 24px, 1120px); margin: 0 auto; color: var(--main_text_color); }
.adminConsoleHeader,.adminHeaderActions,.adminTabs,.siteEditorHeading,.siteEditorActions,.siteEditorSection > header,.siteEditorFooter { display: flex; align-items: center; }
.adminConsoleHeader { justify-content: space-between; gap: 20px; padding: 22px 0 18px; }
.adminConsoleHeader p,.siteEditorHeading p { margin: 0 0 5px; font-size: 9px; letter-spacing: .14em; opacity: .55; }
.adminConsoleHeader h2 { margin: 0; font-size: 25px; line-height: 1.2; }
.adminHeaderActions { gap: 8px; }
.adminHeaderActions a,.adminHeaderActions button,.siteEditorActions a { color: inherit; font: inherit; font-size: 10px; text-decoration: none; opacity: .7; }
.adminHeaderActions button,.siteEditorActions button,.siteEditorSection button,.siteEditorState button,.adminGate button,.siteEditorFooter button { min-height: 35px; padding: 0 12px; border: 1px solid var(--module_dock_border); border-radius: 6px; color: inherit; background: var(--item_bg_color); font: inherit; font-size: 10px; cursor: pointer; }
.adminTabs { gap: 5px; margin-bottom: 18px; padding: 5px; border: 1px solid var(--module_dock_border); border-radius: 8px; background: color-mix(in srgb, var(--item_bg_color) 75%, transparent); overflow-x: auto; }
.adminTabs button { min-height: 34px; padding: 0 15px; border: 0; border-radius: 5px; color: inherit; background: transparent; font: inherit; font-size: 10px; white-space: nowrap; cursor: pointer; opacity: .68; }
.adminTabs button.is-active { color: var(--weather_dialog_active_text); background: var(--weather_dialog_active_bg); opacity: 1; }
.adminTabs button:disabled { cursor: not-allowed; opacity: .38; }
.adminGate,.siteEditorState { min-height: 230px; padding: 32px; border: 1px solid var(--module_dock_border); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: color-mix(in srgb, var(--item_bg_color) 82%, transparent); text-align: center; }
.adminGate h3 { margin: 0; font-size: 18px; }
.adminGate p { max-width: 420px; margin: 0 0 6px; font-size: 11px; line-height: 1.7; opacity: .65; }
.adminGate button,.siteEditorFooter button.is-primary,.siteEditorActions button.is-primary { color: var(--weather_dialog_active_text); background: var(--weather_dialog_active_bg); }
.adminPanel { min-width: 0; }
.siteEditor { padding: 20px; border: 1px solid var(--module_dock_border); border-radius: 8px; background: color-mix(in srgb, var(--item_bg_color) 82%, transparent); }
.siteEditorHeading { justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.siteEditorHeading h3 { margin: 0 0 5px; font-size: 20px; }
.siteEditorHeading span { font-size: 10px; opacity: .62; }
.siteEditorActions { gap: 12px; flex-shrink: 0; }
.siteEditorNotice { margin: 0 0 12px; padding: 10px 12px; border-radius: 5px; color: #246b45; background: rgba(54, 174, 107, .12); font-size: 10px; }
.siteEditorNotice.is-error,.siteEditorState.is-error { color: #b14646; }
.siteEditorForm { display: grid; gap: 12px; }
.siteEditorSection { padding: 18px; border: 1px solid var(--module_dock_border); border-radius: 7px; background: color-mix(in srgb, var(--item_bg_color) 90%, transparent); }
.siteEditorSection > header { gap: 12px; margin-bottom: 16px; }
.siteEditorSection > header > span { align-self: flex-start; padding-top: 2px; color: var(--weather_dialog_muted); font-size: 9px; letter-spacing: .08em; }
.siteEditorSection > header > div { flex: 1; }
.siteEditorSection h4 { margin: 0; font-size: 13px; }
.siteEditorSection header p { margin: 4px 0 0; font-size: 9px; opacity: .58; }
.siteEditorGrid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.siteEditorForm label { min-width: 0; display: grid; gap: 6px; color: var(--weather_dialog_muted); font-size: 9px; }
.siteEditorForm input:not([type=checkbox]),.siteEditorForm textarea { width: 100%; min-width: 0; border: 1px solid var(--weather_dialog_line_strong); border-radius: 5px; padding: 9px 10px; color: var(--weather_dialog_text); background: var(--weather_dialog_control_bg); font: inherit; font-size: 10px; line-height: 1.55; outline: none; }
.siteEditorForm textarea { resize: vertical; }
.siteEditorForm input:focus,.siteEditorForm textarea:focus { border-color: var(--weather_dialog_active_bg); }
.siteEditorForm .is-wide { grid-column: 1 / -1; }
.timelineEditorList,.repeatEditorList { display: grid; gap: 8px; }
.timelineEditorItem,.repeatEditorItem { display: grid; grid-template-columns: 28px minmax(105px,.7fr) minmax(180px,2fr) 62px 100px; align-items: center; gap: 9px; padding: 10px; border: 1px solid var(--module_dock_border); border-radius: 6px; }
.timelineEditorIndex { font-size: 9px; opacity: .5; }
.timelineEditorEnabled { display: flex !important; align-items: center; gap: 5px !important; }
.timelineEditorEnabled input { accent-color: var(--weather_dialog_active_bg); }
.repeatEditorItem { grid-template-columns: repeat(3,minmax(0,1fr)) 100px; }
.repeatEditorItem.is-project { grid-template-columns: repeat(3,minmax(0,1fr)) 90px 100px; }
.projectExternal { display: flex !important; align-items: center; gap: 6px !important; }
.projectExternal input { accent-color: var(--weather_dialog_active_bg); }
.siteEditorRowActions { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.siteEditorSection .is-reorder { width: 28px; min-height: 30px; padding: 0; }
.siteEditorSection .is-reorder:disabled { opacity: .35; cursor: not-allowed; }
.siteEditorSection .is-secondary { margin-left: auto; }
.siteEditorSection .is-remove { min-height: 30px; padding: 0 8px; color: #b14646; }
.siteEditorEmpty { margin: 0; font-size: 10px; opacity: .6; }
.siteEditorFooter { justify-content: space-between; gap: 16px; padding: 4px 2px 0; }
.siteEditorFooter span { font-size: 9px; opacity: .55; }
.siteEditorFooter button { min-width: 130px; }
@media (max-width: 760px) {
  .adminConsole { width: calc(100% - 18px); }
  .adminConsoleHeader { align-items: flex-start; }
  .siteEditor { padding: 12px; }
  .siteEditorHeading { align-items: flex-start; flex-direction: column; }
  .siteEditorGrid { grid-template-columns: 1fr; }
  .siteEditorForm .is-wide { grid-column: auto; }
  .timelineEditorItem { grid-template-columns: 24px minmax(80px,.7fr) minmax(120px,2fr); }
  .timelineEditorEnabled { grid-column: 2; }
  .timelineEditorItem .siteEditorRowActions { grid-column: 3; justify-self: end; }
  .repeatEditorItem { grid-template-columns: 1fr 1fr; }
  .repeatEditorItem .siteEditorRowActions { grid-column: 1 / -1; justify-self: end; }
  .siteEditorFooter { align-items: flex-start; flex-direction: column; }
}
</style>
