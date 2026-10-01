<template>
  <section class="adminDashboard" aria-label="站点管理后台">
    <AdminLoginDialog
      v-if="loginDialogLoaded"
      :open="showLogin"
      @close="showLogin = false"
      @authenticated="handleAuthenticated"
    />

    <main class="adminMain">
        <div v-if="activePanel === 'home'" class="adminPageHeading">
          <div>
            <p class="adminBreadcrumb">管理后台 <span>/</span> {{ activeItem.label }}</p>
            <h2 class="adminPageTitle">站点管理</h2>
            <p class="adminPageDescription">{{ activeItem.description }}</p>
          </div>
        </div>

        <nav v-if="accessCode" class="adminSections" aria-label="管理功能">
          <button
            v-for="item in panels"
            :key="item.key"
            type="button"
            class="adminSectionCard"
            :class="{ 'is-active': activePanel === item.key }"
            :aria-current="activePanel === item.key ? 'page' : undefined"
            @click="selectPanel(item.key)"
          >
            <component :is="item.icon" :size="19" :stroke-width="1.8" aria-hidden="true" />
            <strong>{{ item.label }}</strong>
            <i v-if="item.key === 'home' && isDirty" class="adminUnsavedDot" title="有未保存的更改"></i>
          </button>
          <button class="adminLogout" type="button" @click="logout">
            <LogOut :size="16" aria-hidden="true" /><span>退出登录</span>
          </button>
        </nav>

        <div v-if="notice" class="adminNotice" :class="`is-${noticeKind}`" role="status">
          <CircleCheck v-if="noticeKind === 'success'" :size="17" aria-hidden="true" />
          <CircleAlert v-else :size="17" aria-hidden="true" />
          <span>{{ notice }}</span>
          <button type="button" aria-label="关闭提示" @click="notice = ''">×</button>
        </div>

        <div v-if="authChecking" class="adminAuthLoading" role="status">
          <LoaderCircle :size="20" class="adminSpinner" aria-hidden="true" />
          <span>正在检查登录状态…</span>
        </div>

        <section v-else-if="!accessCode" class="adminLoginGate">
          <div class="adminGateIcon"><ShieldCheck :size="28" aria-hidden="true" /></div>
          <div>
            <h2>登录后管理网站</h2>
            <p>首页内容、博客文章、相册、云盘和邮箱都可以在这里管理。</p>
          </div>
          <button class="adminButton adminButtonPrimary" type="button" @click="showLogin = true">登录管理后台</button>
        </section>

        <template v-else>
          <form v-if="activePanel === 'home'" class="homeEditor" @submit.prevent="saveConfig">
            <section class="editorCard">
              <header class="editorCardHeader">
                <span class="editorSectionIcon"><UserRound :size="18" aria-hidden="true" /></span>
                <div><h2>个人介绍</h2><p>显示在首页个人资料区域的内容</p></div>
              </header>
              <div class="editorFields">
                <label class="editorField editorFieldWide">
                  <span>欢迎语</span>
                  <input v-model.trim="form.welcome" type="text" maxlength="240" required placeholder="Hello, I'm ANeko!" />
                </label>
                <label class="editorField">
                  <span>身份介绍</span>
                  <input v-model.trim="form.role" type="text" maxlength="240" required placeholder="例如：全栈开发者" />
                </label>
                <label class="editorField">
                  <span>第二行介绍</span>
                  <input v-model.trim="form.quote" type="text" maxlength="240" required placeholder="写一句你想展示的话" />
                </label>
                <label class="editorField">
                  <span>所在地</span>
                  <input v-model.trim="form.location" type="text" maxlength="120" required placeholder="城市或地区" />
                </label>
                <label class="editorField">
                  <span>学校或组织</span>
                  <input v-model.trim="form.education" type="text" maxlength="120" required placeholder="学校、团队或组织" />
                </label>
              </div>
            </section>

            <section class="editorCard">
              <header class="editorCardHeader">
                <span class="editorSectionIcon"><CodeXml :size="18" aria-hidden="true" /></span>
                <div><h2>GitHub 与标签</h2><p>控制首页 GitHub 模块以及个人标签</p></div>
              </header>
              <div class="editorFields">
                <label class="editorField editorFieldWide">
                  <span>GitHub 账号</span>
                  <div class="editorInputPrefix"><span>@</span><input v-model.trim="form.githubUsername" type="text" autocomplete="off" required pattern="[A-Za-z0-9-]+" placeholder="GitHub 用户名" /></div>
                  <small>用于读取 GitHub 动态和生成个人主页链接。</small>
                </label>
              </div>
              <div class="editorSubheader">
                <div><h3>首页标签</h3><p>{{ form.tags.length }} 个标签，最多 12 个</p></div>
                <button class="adminButton adminButtonSecondary" type="button" :disabled="form.tags.length >= 12" @click="form.tags.push('新标签')">
                  <Plus :size="16" aria-hidden="true" />添加标签
                </button>
              </div>
              <div v-if="form.tags.length" class="tagEditor">
                <label v-for="(_, index) in form.tags" :key="index" class="tagEditorItem">
                  <input v-model.trim="form.tags[index]" type="text" maxlength="32" :aria-label="`首页标签 ${index + 1}`" />
                  <button type="button" :aria-label="`删除标签 ${index + 1}`" @click="form.tags.splice(index, 1)"><Trash2 :size="15" aria-hidden="true" /></button>
                </label>
              </div>
              <p v-else class="editorEmptyHint">还没有标签，点击“添加标签”创建。</p>
            </section>

            <section class="editorCard">
              <header class="editorCardHeader">
                <span class="editorSectionIcon"><Clock3 :size="18" aria-hidden="true" /></span>
                <div><h2>首页时间线</h2><p>按列表顺序展示在首页，可调整顺序</p></div>
              </header>
              <div class="editorSubheader timelineSubheader">
                <div><h3>时间线条目</h3><p>{{ form.timeline.length }} 条，最多 30 条</p></div>
                <button class="adminButton adminButtonSecondary" type="button" :disabled="form.timeline.length >= 30" @click="form.timeline.unshift({ text: '', date: '' })">
                  <Plus :size="16" aria-hidden="true" />添加条目
                </button>
              </div>
              <div v-if="form.timeline.length" class="timelineEditor">
                <article v-for="(item, index) in form.timeline" :key="index" class="timelineEditorRow">
                  <div class="timelineOrder"><span>{{ String(index + 1).padStart(2, '0') }}</span><div>
                    <button type="button" :disabled="index === 0" :aria-label="`时间线第 ${index + 1} 项上移`" @click="moveTimeline(index, -1)"><ChevronUp :size="16" /></button>
                    <button type="button" :disabled="index === form.timeline.length - 1" :aria-label="`时间线第 ${index + 1} 项下移`" @click="moveTimeline(index, 1)"><ChevronDown :size="16" /></button>
                  </div></div>
                  <label class="editorField timelineDate"><span>日期</span><input v-model.trim="item.date" type="text" maxlength="32" required placeholder="2026.10" /></label>
                  <label class="editorField timelineText"><span>事件内容</span><textarea v-model.trim="item.text" rows="2" maxlength="280" required placeholder="描述这段时间完成的事情" /></label>
                  <button class="timelineDelete" type="button" :aria-label="`删除时间线第 ${index + 1} 项`" @click="form.timeline.splice(index, 1)"><Trash2 :size="16" aria-hidden="true" /></button>
                </article>
              </div>
              <p v-else class="editorEmptyHint">暂无时间线内容，点击“添加条目”创建。</p>
            </section>

            <footer class="editorSavebar">
              <span :class="{ 'has-unsaved': isDirty }">{{ saving ? '正在保存更改…' : isDirty ? '有尚未保存的更改' : '所有更改均已保存' }}</span>
              <div>
                <button class="adminButton adminButtonSecondary" type="button" :disabled="!isDirty || saving" @click="restoreSaved">撤销更改</button>
                <button class="adminButton adminButtonPrimary" type="submit" :disabled="!isDirty || loading || saving">
                  <LoaderCircle v-if="saving" :size="16" class="adminSpinner" aria-hidden="true" />
                  <Save v-else :size="16" aria-hidden="true" />
                  {{ saving ? '保存中…' : '保存首页内容' }}
                </button>
              </div>
            </footer>
            <div v-if="loading" class="editorLoading"><LoaderCircle :size="18" class="adminSpinner" />正在加载首页设置…</div>
          </form>

          <section v-else class="adminModulePanel" :aria-label="`${activeItem.label}管理`">
            <component :is="activeComponent" />
          </section>
        </template>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, onBeforeUnmount, onMounted, reactive, ref, type Component } from 'vue'
import {
  CircleAlert,
  CircleCheck,
  Clock3,
  ChevronDown,
  ChevronUp,
  FileText,
  CodeXml,
  HardDrive,
  Images,
  LoaderCircle,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from '@lucide/vue'
import { DEFAULT_HOME_CONFIG, type HomeConfig } from '../utils/site-config'
import { apiRequest, clearAdminAccess, restoreAdminAccess } from '../utils/admin-client'
import { userErrorMessage } from '../utils/user-error'

type PanelKey = 'home' | 'blog' | 'photos' | 'drive' | 'mail'
const AdminModuleLoading = defineComponent({
  setup: () => () => h('div', { class: 'adminModuleLoading', role: 'status' }, [
    h(LoaderCircle, { size: 20, class: 'adminSpinner', 'aria-hidden': 'true' }),
    h('span', '正在加载管理模块…'),
  ]),
})
const AdminModuleError = defineComponent({
  setup: () => () => h('div', { class: 'adminModuleLoading is-error', role: 'alert' }, '管理模块加载失败，请刷新页面后重试。'),
})
const BlogManager = defineAsyncComponent({ loader: () => import('./BlogManager.vue'), loadingComponent: AdminModuleLoading, errorComponent: AdminModuleError, delay: 120, timeout: 30000 })
const PhotoGallery = defineAsyncComponent({ loader: () => import('./PhotoGallery.vue'), loadingComponent: AdminModuleLoading, errorComponent: AdminModuleError, delay: 120, timeout: 30000 })
const DriveShell = defineAsyncComponent({ loader: () => import('./DriveShell.vue'), loadingComponent: AdminModuleLoading, errorComponent: AdminModuleError, delay: 120, timeout: 30000 })
const MailShell = defineAsyncComponent({ loader: () => import('./MailShell.vue'), loadingComponent: AdminModuleLoading, errorComponent: AdminModuleError, delay: 120, timeout: 30000 })
const AdminLoginDialog = defineAsyncComponent(() => import('./AdminLoginDialog.vue'))

const panels: { key: PanelKey; label: string; description: string; icon: Component }[] = [
  { key: 'home', label: '首页内容', description: '编辑首页个人资料、GitHub 账号、标签和时间线。', icon: UserRound },
  { key: 'blog', label: '博客管理', description: '撰写和维护博客文章，并向搜索引擎提交页面。', icon: FileText },
  { key: 'photos', label: '相册管理', description: '上传照片，编辑说明，整理相册内容。', icon: Images },
  { key: 'drive', label: '云盘管理', description: '上传和整理文件，管理目录与分享资源。', icon: HardDrive },
  { key: 'mail', label: '邮箱管理', description: '查看邮件、调整邮箱设置并管理 Webhook。', icon: Mail },
]

const activePanel = ref<PanelKey>('home')
const activeItem = computed(() => panels.find((item) => item.key === activePanel.value) || panels[0])
const activeComponent = computed(() => ({ blog: BlogManager, photos: PhotoGallery, drive: DriveShell, mail: MailShell }[activePanel.value as Exclude<PanelKey, 'home'>]))
const accessCode = ref('')
const authChecking = ref(true)
const loginDialogLoaded = ref(false)
const showLogin = ref(false)
const loading = ref(false)
const saving = ref(false)
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')
const savedSnapshot = ref(JSON.stringify(DEFAULT_HOME_CONFIG))
const form = reactive<HomeConfig>(cloneConfig(DEFAULT_HOME_CONFIG))
const isDirty = computed(() => JSON.stringify(form) !== savedSnapshot.value)

function cloneConfig(value: HomeConfig): HomeConfig {
  return { ...value, tags: [...value.tags], timeline: value.timeline.map((item) => ({ ...item })) }
}

function selectPanel(key: PanelKey) {
  activePanel.value = key
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${key}`)
}

function handleHashChange() {
  const key = window.location.hash.slice(1) as PanelKey
  if (panels.some((item) => item.key === key)) activePanel.value = key
}

function authHeaders(contentType?: string) {
  return { 'X-Access-Code': accessCode.value, ...(contentType ? { 'Content-Type': contentType } : {}) }
}

function showMessage(message: string, kind: 'success' | 'error') {
  notice.value = message
  noticeKind.value = kind
}

async function loadConfig() {
  if (!accessCode.value) return
  loading.value = true
  try {
    const config = await apiRequest<HomeConfig>('/api/admin/site-config', { headers: authHeaders(), cache: 'no-store' })
    Object.assign(form, cloneConfig(config))
    savedSnapshot.value = JSON.stringify(form)
  } catch (error) {
    showMessage(userErrorMessage(error, '首页设置加载失败，请检查网络后重试。'), 'error')
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!accessCode.value || saving.value || loading.value) return
  saving.value = true
  try {
    const config = await apiRequest<HomeConfig>('/api/admin/site-config', {
      method: 'PUT',
      headers: authHeaders('application/json'),
      body: JSON.stringify(form),
    })
    Object.assign(form, cloneConfig(config))
    savedSnapshot.value = JSON.stringify(form)
    showMessage('首页内容已保存。', 'success')
  } catch (error) {
    showMessage(userErrorMessage(error, '首页内容保存失败，请稍后重试。'), 'error')
  } finally {
    saving.value = false
  }
}

function restoreSaved() {
  Object.assign(form, cloneConfig(JSON.parse(savedSnapshot.value) as HomeConfig))
  notice.value = ''
}

function moveTimeline(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= form.timeline.length) return
  const [item] = form.timeline.splice(index, 1)
  form.timeline.splice(target, 0, item)
}

function handleAuthenticated(code: string) {
  accessCode.value = code
  showLogin.value = false
  void loadConfig()
}

function logout() {
  accessCode.value = ''
  clearAdminAccess()
  activePanel.value = 'home'
  showMessage('已退出管理员登录。', 'success')
}

function handleSessionCleared() {
  if (!accessCode.value) return
  accessCode.value = ''
  activePanel.value = 'home'
  showMessage('管理员登录已失效，请重新登录。', 'error')
}

onMounted(async () => {
  loginDialogLoaded.value = true
  handleHashChange()
  window.addEventListener('hashchange', handleHashChange)
  window.addEventListener('aneko:admin-session-cleared', handleSessionCleared)
  accessCode.value = await restoreAdminAccess()
  authChecking.value = false
  if (accessCode.value) await loadConfig()
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', handleHashChange)
  window.removeEventListener('aneko:admin-session-cleared', handleSessionCleared)
})
</script>

<style scoped>
.adminDashboard {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 0 8px 48px;
  color: var(--main_text_color);
  font-family: inherit;
}
.adminMain { min-width: 0; }
.adminPageHeading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 2px 17px;
}
.adminBreadcrumb { margin-bottom: 8px; color: color-mix(in srgb, var(--main_text_color) 68%, transparent); font-size: 12px; }
.adminBreadcrumb span { margin: 0 5px; opacity: .65; }
.adminPageTitle { margin: 0; font-size: clamp(25px, 3.5vw, 32px); font-weight: 600; line-height: 1.25; }
.adminPageDescription { margin-top: 7px; color: color-mix(in srgb, var(--main_text_color) 76%, transparent); font-size: 13px; line-height: 1.6; }
.adminSections {
  max-width: 100%;
  margin: 0 0 22px;
  padding: 6px;
  border: 1px solid var(--module_dock_border);
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--module_dock_bg);
  box-shadow: 0 10px 24px -18px var(--module_dock_shadow), inset 0 1px 0 rgba(255, 255, 255, .08);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.adminSections::-webkit-scrollbar { display: none; }
.adminSectionCard, .adminLogout, .adminButton {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 9px;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--module_dock_inactive_color);
  background: var(--module_dock_inactive_bg);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: color .18s ease, background-color .18s ease, border-color .18s ease;
}
.adminSectionCard:hover, .adminLogout:hover, .adminButtonSecondary:hover:not(:disabled) {
  border-color: var(--module_dock_border);
  color: var(--main_text_color);
  background: var(--module_dock_hover_bg);
}
.adminSectionCard.is-active {
  border-color: var(--module_dock_active_border);
  color: var(--module_dock_active_color);
  background: var(--module_dock_active_bg);
  font-weight: 600;
}
.adminSectionCard:focus-visible, .adminLogout:focus-visible, .adminButton:focus-visible, .adminNotice button:focus-visible, .tagEditorItem button:focus-visible, .timelineOrder button:focus-visible, .timelineDelete:focus-visible {
  outline: 2px solid var(--module_dock_active_border);
  outline-offset: 2px;
}
.adminSectionCard svg { width: 16px; height: 16px; }
.adminSectionCard strong { font-size: inherit; font-weight: inherit; }
.adminLogout { margin-left: auto; color: var(--main_text_color); }
.adminUnsavedDot { width: 7px; height: 7px; margin-left: 1px; border-radius: 50%; background: #f2c46d; }
.adminButton { min-height: 36px; border-color: var(--module_dock_border); color: var(--main_text_color); background: var(--module_dock_inactive_bg); }
.adminButtonPrimary, .adminButtonPrimary:hover:not(:disabled) {
  border-color: var(--module_dock_active_border);
  color: var(--module_dock_active_color);
  background: var(--module_dock_active_bg);
}
.adminButton:disabled { opacity: .45; cursor: not-allowed; }
.adminNotice, .adminLoginGate, .editorCard, .timelineEditorRow {
  border: 1px solid var(--module_dock_border);
  border-radius: 12px;
  color: var(--main_text_color);
  background: var(--item_bg_color);
  backdrop-filter: blur(var(--card_filter));
  -webkit-backdrop-filter: blur(var(--card_filter));
}
.adminNotice { margin: 0 0 16px; padding: 11px 13px; display: flex; align-items: center; gap: 9px; font-size: 13px; }
.adminNotice.is-success > svg { color: var(--weather_aqi_good_text); }
.adminNotice.is-error > svg { color: var(--weather_aqi_poor_text); }
.adminNotice button { margin-left: auto; border: 0; color: inherit; background: transparent; font-size: 20px; cursor: pointer; }
.adminAuthLoading, .adminModuleLoading { min-height: 150px; display: flex; align-items: center; justify-content: center; gap: 10px; color: color-mix(in srgb, var(--main_text_color) 78%, transparent); font-size: 13px; }
.adminModuleLoading.is-error { color: var(--weather_aqi_poor_text); }
.adminSpinner { animation: adminSpin .9s linear infinite; }
@keyframes adminSpin { to { transform: rotate(360deg); } }
.adminLoginGate { min-height: 180px; padding: 25px; display: flex; align-items: center; gap: 17px; }
.adminGateIcon { width: 48px; height: 48px; flex: 0 0 auto; border-radius: 12px; display: grid; place-items: center; color: var(--module_dock_active_color); background: var(--module_dock_active_bg); }
.adminLoginGate div:nth-child(2) { flex: 1; }
.adminLoginGate h2 { margin: 0 0 6px; font-size: 17px; }
.adminLoginGate p { color: color-mix(in srgb, var(--main_text_color) 75%, transparent); font-size: 13px; line-height: 1.6; }
.homeEditor { position: relative; display: grid; gap: 14px; }
.editorCard { padding: 20px 22px 22px; }
.editorCardHeader { padding-bottom: 15px; border-bottom: 1px solid var(--module_dock_border); display: flex; align-items: center; gap: 12px; }
.editorSectionIcon { width: 36px; height: 36px; flex: 0 0 auto; border-radius: 10px; display: grid; place-items: center; color: var(--module_dock_active_color); background: var(--module_dock_active_bg); }
.editorCardHeader h2 { font-size: 15px; font-weight: 600; }
.editorCardHeader p, .editorSubheader p { margin-top: 4px; color: color-mix(in srgb, var(--main_text_color) 70%, transparent); font-size: 11px; }
.editorFields { padding-top: 17px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px 18px; }
.editorField { min-width: 0; display: grid; align-content: start; gap: 7px; }
.editorField > span { font-size: 12px; font-weight: 550; }
.editorField input, .editorField textarea, .editorInputPrefix {
  width: 100%;
  min-height: 40px;
  padding: 0 11px;
  border: 1px solid var(--module_dock_border);
  border-radius: 7px;
  outline: none;
  color: var(--main_text_color);
  background: var(--weather_dialog_control_bg);
  font: inherit;
  font-size: 13px;
  user-select: text;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.editorField textarea { padding-block: 8px; resize: vertical; line-height: 1.5; }
.editorField input::placeholder, .editorField textarea::placeholder { color: color-mix(in srgb, var(--main_text_color) 55%, transparent); }
.editorField input:focus, .editorField textarea:focus, .editorInputPrefix:focus-within { border-color: var(--module_dock_active_border); box-shadow: 0 0 0 2px var(--module_dock_hover_bg); }
.editorField small { color: color-mix(in srgb, var(--main_text_color) 70%, transparent); font-size: 11px; }
.editorFieldWide { grid-column: 1 / -1; }
.editorInputPrefix { display: flex; align-items: center; gap: 8px; }
.editorInputPrefix > span { color: color-mix(in srgb, var(--main_text_color) 68%, transparent); }
.editorInputPrefix input { min-height: 36px; padding: 0; border: 0; background: transparent; box-shadow: none !important; }
.editorSubheader { margin-top: 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.editorSubheader h3 { font-size: 13px; font-weight: 600; }
.tagEditor { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
.tagEditorItem { max-width: 230px; min-width: 150px; flex: 1 1 165px; height: 38px; padding: 0 7px 0 10px; border: 1px solid var(--module_dock_border); border-radius: 7px; display: flex; align-items: center; gap: 7px; background: var(--weather_dialog_control_bg); }
.tagEditorItem input { width: 100%; min-width: 0; border: 0; outline: 0; color: var(--main_text_color); background: transparent; font: inherit; font-size: 12px; user-select: text; }
.tagEditorItem button, .timelineOrder button, .timelineDelete { width: 30px; height: 30px; flex: 0 0 auto; border: 0; border-radius: 6px; display: grid; place-items: center; color: var(--main_text_color); background: transparent; cursor: pointer; }
.tagEditorItem button:hover, .timelineDelete:hover { color: var(--weather_aqi_poor_text); background: var(--module_dock_hover_bg); }
.editorEmptyHint { margin-top: 12px; color: color-mix(in srgb, var(--main_text_color) 70%, transparent); font-size: 12px; }
.timelineEditor { margin-top: 12px; display: grid; gap: 8px; }
.timelineEditorRow { min-width: 0; padding: 10px; display: grid; grid-template-columns: 58px minmax(120px, .28fr) minmax(0, 1fr) 32px; align-items: center; gap: 10px; background: var(--module_dock_inactive_bg); }
.timelineOrder { display: flex; align-items: center; gap: 4px; }
.timelineOrder > span { color: color-mix(in srgb, var(--main_text_color) 68%, transparent); font-size: 11px; font-variant-numeric: tabular-nums; }
.timelineOrder > div { display: grid; }
.timelineOrder button { width: 24px; height: 19px; }
.timelineOrder button:disabled { opacity: .3; cursor: default; }
.timelineDate, .timelineText { gap: 4px; }
.timelineDate > span, .timelineText > span { color: color-mix(in srgb, var(--main_text_color) 70%, transparent); font-size: 10px; }
.timelineEditorRow .editorField input, .timelineEditorRow .editorField textarea { min-height: 36px; padding: 7px 9px; font-size: 12px; }
.timelineEditorRow .editorField textarea { min-height: 52px; }
.timelineDelete { width: 30px; height: 30px; }
.editorSavebar { position: sticky; z-index: 2; bottom: 12px; min-height: 58px; padding: 8px 10px 8px 14px; border: 1px solid var(--module_dock_border); border-radius: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--main_text_color); background: var(--module_dock_bg); box-shadow: 0 10px 24px -18px var(--module_dock_shadow); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
.editorSavebar > span { color: color-mix(in srgb, var(--main_text_color) 70%, transparent); font-size: 12px; }
.editorSavebar > span.has-unsaved { color: #ffe09a; }
.editorSavebar > div { display: flex; gap: 7px; }
.editorLoading { position: absolute; z-index: 3; inset: 0; min-height: 220px; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--main_text_color); background: var(--item_bg_color); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); font-size: 13px; }
.adminModulePanel { min-width: 0; }
.adminModulePanel :deep(.managerAuthButton), .adminModulePanel :deep(.photoAuthButton), .adminModulePanel :deep(.driveAuthButton), .adminModulePanel :deep(.mailAuthButton) { display: none !important; }
.adminModulePanel :deep(.managerToolbar), .adminModulePanel :deep(.photoGalleryMeta), .adminModulePanel :deep(.driveToolbar), .adminModulePanel :deep(.mailToolbar) { padding-top: 0; }
.adminModulePanel :deep(.blogManager), .adminModulePanel :deep(.photoGallery), .adminModulePanel :deep(.drivePage), .adminModulePanel :deep(.mailPage) { width: 100%; margin-inline: 0; }

@media (max-width: 760px) {
  .adminDashboard { padding-inline: 0; }
  .adminSections { flex-wrap: nowrap; }
  .adminLogout { margin-left: 0; }
  .timelineEditorRow { grid-template-columns: 45px minmax(0, 1fr) 30px; align-items: start; }
  .timelineOrder { grid-row: 1 / span 2; flex-direction: column; align-items: flex-start; }
  .timelineOrder > div { display: flex; }
  .timelineDate, .timelineText { grid-column: 2; }
  .timelineDelete { grid-column: 3; grid-row: 1; }
}
@media (max-width: 560px) {
  .adminPageHeading { padding: 18px 2px 14px; }
  .adminPageTitle { font-size: 25px; }
  .adminPageDescription { font-size: 12px; }
  .adminSections { margin-bottom: 16px; }
  .adminSectionCard, .adminLogout { min-height: 36px; padding-inline: 10px; font-size: 11px; }
  .adminLoginGate { padding: 18px; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
  .adminGateIcon { width: 42px; height: 42px; }
  .adminLoginGate div:nth-child(2) { flex: 1 1 calc(100% - 55px); }
  .adminLoginGate .adminButton { margin-left: 54px; }
  .editorCard { padding: 17px 14px; }
  .editorFields { grid-template-columns: 1fr; gap: 13px; }
  .editorFieldWide { grid-column: auto; }
  .editorSubheader { align-items: flex-start; }
  .editorSubheader .adminButton { min-height: 34px; padding-inline: 9px; font-size: 11px; }
  .tagEditorItem { min-width: min(100%, 145px); }
  .editorSavebar { bottom: 7px; padding: 8px; flex-wrap: wrap; }
  .editorSavebar > span { font-size: 10px; }
  .editorSavebar > div { gap: 5px; }
  .editorSavebar .adminButton { min-height: 34px; padding-inline: 8px; font-size: 11px; }
  .adminModulePanel :deep(.managerToolbar), .adminModulePanel :deep(.photoGalleryMeta), .adminModulePanel :deep(.driveToolbar), .adminModulePanel :deep(.mailToolbar) { align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .adminDashboard *, .adminDashboard *::before, .adminDashboard *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
</style>
