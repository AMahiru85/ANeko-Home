<template>
  <section class="adminApp" aria-label="站点管理后台">
    <AdminLoginDialog
      v-if="loginDialogLoaded"
      :open="showLogin"
      @close="showLogin = false"
      @authenticated="handleAuthenticated"
    />

    <div class="adminLayout">
      <aside class="adminSidebar" aria-label="后台导航">
        <nav class="adminNav">
          <button
            v-for="item in panels"
            :key="item.key"
            type="button"
            class="adminNavItem"
            :class="{ 'is-active': activePanel === item.key }"
            :aria-current="activePanel === item.key ? 'page' : undefined"
            @click="selectPanel(item.key)"
          >
            <component :is="item.icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ item.label }}</span>
            <span v-if="item.key === 'home' && isDirty" class="adminUnsavedDot" title="有未保存的更改"></span>
          </button>
        </nav>

        <button v-if="accessCode" class="adminLogout" type="button" @click="logout">
          <LogOut :size="16" aria-hidden="true" /><span>退出登录</span>
        </button>
      </aside>

      <main class="adminMain">
        <div class="adminPageHeading">
          <div>
            <p class="adminBreadcrumb">管理后台 <span>/</span> {{ activeItem.label }}</p>
            <h2 class="adminPageTitle">{{ activeItem.label }}</h2>
            <p class="adminPageDescription">{{ activeItem.description }}</p>
          </div>
        </div>

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
    </div>
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
.adminApp {
  --admin-surface: rgba(249, 250, 252, .97);
  --admin-surface-raised: #fff;
  --admin-control: #f6f7f9;
  --admin-text: #20242c;
  --admin-muted: #707783;
  --admin-line: rgba(29, 37, 50, .1);
  --admin-accent: #6658d3;
  --admin-accent-soft: rgba(102, 88, 211, .11);
  --admin-danger: #c94a58;
  width: min(1480px, calc(100% - 44px));
  min-height: min(860px, calc(100dvh - 46px));
  margin: 22px auto 34px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .48);
  border-radius: 20px;
  color: var(--admin-text);
  background: var(--admin-surface);
  box-shadow: 0 24px 90px rgba(10, 15, 26, .22);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  font-family: "b", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
:global([data-theme="Dark"]) .adminApp {
  --admin-surface: rgba(25, 27, 32, .97);
  --admin-surface-raised: #202228;
  --admin-control: #191b20;
  --admin-text: #f1f2f5;
  --admin-muted: #a2a6b0;
  --admin-line: rgba(255, 255, 255, .1);
  --admin-accent: #a89aff;
  --admin-accent-soft: rgba(168, 154, 255, .14);
  --admin-danger: #ff8c96;
  border-color: rgba(255, 255, 255, .1);
}
.adminTopbar { min-height: 76px; padding: 0 30px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--admin-line); }
.adminBrand { display: inline-flex; align-items: center; gap: 12px; color: var(--admin-text); }
.adminBrandMark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 12px; color: white; background: linear-gradient(145deg, #8070ee, #5547bd); font-size: 20px; font-weight: 700; }
.adminBrandText { display: grid; gap: 2px; }
.adminBrandText strong { font-size: 14px; font-weight: 650; }
.adminBrandText small { color: var(--admin-muted); font-size: 12px; }
.adminTopbarRight, .adminSecureState { display: flex; align-items: center; gap: 12px; }
.adminSecureState { color: var(--admin-muted); font-size: 13px; }
.adminSecureState i { width: 8px; height: 8px; border-radius: 50%; background: #45b77a; box-shadow: 0 0 0 3px rgba(69, 183, 122, .13); }
.adminLogout, .adminButton { min-height: 40px; padding: 0 14px; border: 1px solid var(--admin-line); border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; color: var(--admin-text); background: var(--admin-surface-raised); font: inherit; font-size: 13px; font-weight: 550; cursor: pointer; transition: background .18s ease, border-color .18s ease, transform .18s ease; }
.adminLogout:hover, .adminButtonSecondary:hover { border-color: var(--admin-accent); background: var(--admin-accent-soft); }
.adminLayout { min-height: 720px; display: grid; grid-template-columns: 238px minmax(0, 1fr); }
.adminSidebar { padding: 27px 15px 18px; border-right: 1px solid var(--admin-line); display: flex; flex-direction: column; }
.adminNavCaption { margin: 0 12px 11px; color: var(--admin-muted); font-size: 11px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; }
.adminNav { display: grid; gap: 5px; }
.adminNavItem { position: relative; min-height: 46px; padding: 0 13px; border: 0; border-radius: 9px; display: flex; align-items: center; gap: 12px; color: var(--admin-muted); background: transparent; font: inherit; font-size: 14px; text-align: left; cursor: pointer; transition: color .16s ease, background .16s ease; }
.adminNavItem:hover { color: var(--admin-text); background: var(--admin-control); }
.adminNavItem.is-active { color: var(--admin-accent); background: var(--admin-accent-soft); font-weight: 650; }
.adminUnsavedDot { width: 7px; height: 7px; margin-left: auto; border-radius: 50%; background: #e4a63b; }
.adminSidebarBottom { margin-top: auto; }
.adminSidebarHint { margin: 25px 5px 16px; padding: 13px 11px; border: 1px solid var(--admin-line); border-radius: 10px; display: flex; gap: 10px; color: var(--admin-accent); }
.adminSidebarHint span { display: grid; gap: 4px; }
.adminSidebarHint strong { color: var(--admin-text); font-size: 12px; }
.adminSidebarHint small { color: var(--admin-muted); font-size: 11px; line-height: 1.45; }
.adminBackLink { min-height: 40px; padding: 0 10px; border-top: 1px solid var(--admin-line); display: flex; align-items: center; justify-content: space-between; color: var(--admin-muted); font-size: 13px; }
.adminBackLink:hover { color: var(--admin-text); }
.adminMain { min-width: 0; padding: 35px clamp(24px, 4vw, 58px) 50px; }
.adminPageHeading { min-height: 100px; margin-bottom: 27px; display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.adminBreadcrumb { margin: 0 0 10px; color: var(--admin-muted); font-size: 12px; }
.adminBreadcrumb span { margin: 0 5px; opacity: .65; }
.adminPageTitle { margin: 0; color: var(--admin-text); font-size: clamp(25px, 3vw, 32px); font-weight: 680; letter-spacing: -.035em; }
.adminPageDescription { margin: 8px 0 0; color: var(--admin-muted); font-size: 14px; line-height: 1.55; }
.adminButtonPrimary { border-color: var(--admin-accent); color: #fff; background: #6658d3; }
:global([data-theme="Dark"]) .adminButtonPrimary { color: #201c3c; background: #b1a5ff; }
.adminButtonPrimary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.05); }
.adminButtonSecondary { background: var(--admin-surface-raised); }
.adminButton:disabled { opacity: .45; cursor: not-allowed; }
.adminNotice { margin: 0 0 20px; padding: 12px 14px; border: 1px solid var(--admin-line); border-radius: 9px; display: flex; align-items: center; gap: 10px; color: var(--admin-text); background: var(--admin-surface-raised); font-size: 13px; }
.adminNotice.is-success > svg { color: #319565; }
.adminNotice.is-error > svg { color: var(--admin-danger); }
.adminNotice button { margin-left: auto; border: 0; color: var(--admin-muted); background: transparent; font-size: 21px; cursor: pointer; }
.adminAuthLoading { min-height: 200px; display: flex; align-items: center; justify-content: center; gap: 11px; color: var(--admin-muted); font-size: 14px; }
.editorLoading { position: absolute; z-index: 3; inset: 0; min-height: 220px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 11px; color: var(--admin-muted); background: var(--admin-surface); font-size: 14px; }
.adminSpinner { animation: adminSpin .9s linear infinite; }
@keyframes adminSpin { to { transform: rotate(360deg); } }
.adminLoginGate { min-height: 245px; padding: 35px; border: 1px solid var(--admin-line); border-radius: 14px; display: flex; align-items: center; gap: 20px; background: var(--admin-surface-raised); }
.adminGateIcon { width: 58px; height: 58px; flex: 0 0 auto; border-radius: 16px; display: grid; place-items: center; color: var(--admin-accent); background: var(--admin-accent-soft); }
.adminLoginGate div:nth-child(2) { flex: 1; }
.adminLoginGate h2 { margin: 0 0 7px; color: var(--admin-text); font-size: 18px; }
.adminLoginGate p { margin: 0; color: var(--admin-muted); font-size: 14px; line-height: 1.6; }
.homeEditor { position: relative; display: grid; gap: 18px; }
.editorCard { padding: 23px 25px 25px; border: 1px solid var(--admin-line); border-radius: 14px; background: var(--admin-surface-raised); }
.editorCardHeader { display: flex; align-items: center; gap: 13px; padding-bottom: 19px; border-bottom: 1px solid var(--admin-line); }
.editorSectionIcon { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; color: var(--admin-accent); background: var(--admin-accent-soft); }
.editorCardHeader h2 { margin: 0; color: var(--admin-text); font-size: 16px; font-weight: 650; }
.editorCardHeader p, .editorSubheader p { margin: 5px 0 0; color: var(--admin-muted); font-size: 12px; }
.editorFields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 20px; padding-top: 21px; }
.editorField { min-width: 0; display: grid; align-content: start; gap: 8px; color: var(--admin-text); }
.editorField > span { font-size: 13px; font-weight: 570; }
.editorField input, .editorField textarea, .editorInputPrefix { width: 100%; min-height: 43px; padding: 0 12px; border: 1px solid var(--admin-line); border-radius: 8px; outline: none; color: var(--admin-text); background: var(--admin-control); font: inherit; font-size: 14px; user-select: text; transition: border-color .15s ease, box-shadow .15s ease; }
.editorField input::placeholder, .editorField textarea::placeholder { color: var(--admin-muted); opacity: .75; }
.editorField input:focus, .editorField textarea:focus, .editorInputPrefix:focus-within { border-color: var(--admin-accent); box-shadow: 0 0 0 3px var(--admin-accent-soft); }
.editorField small { color: var(--admin-muted); font-size: 12px; }
.editorFieldWide { grid-column: 1 / -1; }
.editorInputPrefix { display: flex; align-items: center; gap: 9px; }
.editorInputPrefix > span { color: var(--admin-muted); font-size: 15px; }
.editorInputPrefix input { min-height: 39px; padding: 0; border: 0; outline: 0; background: transparent; box-shadow: none !important; }
.editorSubheader { margin-top: 23px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.editorSubheader h3 { margin: 0; color: var(--admin-text); font-size: 14px; font-weight: 620; }
.tagEditor { margin-top: 15px; display: flex; flex-wrap: wrap; gap: 9px; }
.tagEditorItem { max-width: 230px; min-width: 160px; flex: 1 1 170px; height: 40px; padding: 0 8px 0 12px; border: 1px solid var(--admin-line); border-radius: 8px; display: flex; align-items: center; gap: 8px; background: var(--admin-control); }
.tagEditorItem input { width: 100%; min-width: 0; border: 0; outline: 0; color: var(--admin-text); background: transparent; font: inherit; font-size: 13px; user-select: text; }
.tagEditorItem button, .timelineOrder button, .timelineDelete { width: 30px; height: 30px; flex: 0 0 auto; border: 0; border-radius: 7px; display: grid; place-items: center; color: var(--admin-muted); background: transparent; cursor: pointer; }
.tagEditorItem button:hover, .timelineDelete:hover { color: var(--admin-danger); background: rgba(201, 74, 88, .1); }
.editorEmptyHint { margin: 15px 0 0; color: var(--admin-muted); font-size: 13px; }
.timelineEditor { margin-top: 15px; display: grid; gap: 10px; }
.timelineEditorRow { min-width: 0; padding: 12px; border: 1px solid var(--admin-line); border-radius: 10px; display: grid; grid-template-columns: 66px minmax(130px, .28fr) minmax(0, 1fr) 34px; align-items: center; gap: 12px; background: var(--admin-control); }
.timelineOrder { display: flex; align-items: center; gap: 6px; }
.timelineOrder > span { color: var(--admin-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.timelineOrder > div { display: grid; }
.timelineOrder button { width: 24px; height: 20px; }
.timelineOrder button:disabled { opacity: .28; cursor: default; }
.timelineDate, .timelineText { gap: 5px; }
.timelineDate > span, .timelineText > span { color: var(--admin-muted); font-size: 11px; }
.timelineEditorRow .editorField input, .timelineEditorRow .editorField textarea { min-height: 38px; padding: 8px 10px; font-size: 13px; }
.timelineEditorRow .editorField textarea { min-height: 54px; resize: vertical; line-height: 1.45; }
.timelineDelete { width: 32px; height: 32px; }
.editorSavebar { position: sticky; z-index: 2; bottom: 12px; min-height: 66px; margin-top: 2px; padding: 10px 13px 10px 18px; border: 1px solid var(--admin-line); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 14px; color: var(--admin-muted); background: var(--admin-surface); box-shadow: 0 9px 32px rgba(12, 17, 28, .14); backdrop-filter: blur(16px); }
.editorSavebar > span { font-size: 13px; }
.editorSavebar > span.has-unsaved { color: #a56c10; }
:global([data-theme="Dark"]) .editorSavebar > span.has-unsaved { color: #ffd078; }
.editorSavebar > div { display: flex; gap: 9px; }
.adminModulePanel { min-width: 0; }
.adminModuleLoading { min-height: 220px; display: flex; align-items: center; justify-content: center; gap: 11px; color: var(--admin-muted); font-size: 14px; }
.adminModuleLoading.is-error { color: var(--admin-danger); }
.adminModulePanel :deep(.managerAuthButton), .adminModulePanel :deep(.photoAuthButton), .adminModulePanel :deep(.driveAuthButton), .adminModulePanel :deep(.mailAuthButton) { display: none !important; }
.adminModulePanel :deep(.managerToolbar), .adminModulePanel :deep(.photoGalleryMeta), .adminModulePanel :deep(.driveToolbar), .adminModulePanel :deep(.mailToolbar) { padding-top: 0; }
.adminModulePanel :deep(.blogManager), .adminModulePanel :deep(.photoGallery), .adminModulePanel :deep(.drivePage), .adminModulePanel :deep(.mailPage) { width: 100%; margin-inline: 0; }

@media (max-width: 900px) {
  .adminApp { width: calc(100% - 24px); margin: 12px auto 22px; min-height: calc(100dvh - 24px); border-radius: 15px; }
  .adminLayout { grid-template-columns: 190px minmax(0, 1fr); }
  .adminMain { padding-inline: 25px; }
  .timelineEditorRow { grid-template-columns: 55px minmax(110px, .35fr) minmax(0, 1fr) 30px; gap: 8px; padding: 9px; }
}
@media (max-width: 680px) {
  .adminApp { width: 100%; min-height: 100dvh; margin: 0; border: 0; border-radius: 0; }
  .adminTopbar { min-height: 66px; padding: 0 17px; }
  .adminBrandMark { width: 34px; height: 34px; border-radius: 10px; }
  .adminBrandText strong { font-size: 13px; }
  .adminBrandText small { font-size: 11px; }
  .adminSecureState { display: none; }
  .adminLogout { min-height: 36px; padding: 0 10px; font-size: 12px; }
  .adminLayout { min-height: 0; display: block; }
  .adminSidebar { position: sticky; z-index: 10; top: 0; padding: 9px 12px; border-right: 0; border-bottom: 1px solid var(--admin-line); background: var(--admin-surface); }
  .adminNavCaption, .adminSidebarBottom { display: none; }
  .adminNav { display: flex; overflow-x: auto; gap: 5px; scrollbar-width: none; }
  .adminNav::-webkit-scrollbar { display: none; }
  .adminNavItem { min-height: 41px; padding: 0 12px; flex: 0 0 auto; gap: 7px; font-size: 12px; }
  .adminNavItem svg { width: 16px; height: 16px; }
  .adminMain { padding: 24px 15px 34px; }
  .adminPageHeading { min-height: 0; margin-bottom: 20px; gap: 10px; }
  .adminPageTitle { font-size: 25px; }
  .adminPageDescription { max-width: 450px; font-size: 13px; }
  .adminLoginGate { min-height: 0; padding: 20px; align-items: flex-start; flex-wrap: wrap; gap: 13px; }
  .adminGateIcon { width: 44px; height: 44px; border-radius: 12px; }
  .adminLoginGate div:nth-child(2) { flex: 1 1 calc(100% - 60px); }
  .adminLoginGate h2 { font-size: 16px; }
  .adminLoginGate p { font-size: 13px; }
  .adminLoginGate .adminButton { margin-left: 57px; }
  .editorCard { padding: 18px 15px; }
  .editorFields { grid-template-columns: 1fr; gap: 15px; padding-top: 18px; }
  .editorFieldWide { grid-column: auto; }
  .editorSubheader { align-items: flex-start; }
  .editorSubheader .adminButton { min-height: 36px; padding: 0 10px; font-size: 12px; }
  .tagEditorItem { min-width: min(100%, 150px); }
  .timelineEditorRow { grid-template-columns: 44px minmax(0, 1fr) 32px; align-items: start; }
  .timelineOrder { grid-row: 1 / span 2; flex-direction: column; align-items: flex-start; }
  .timelineOrder > div { display: flex; }
  .timelineDate { grid-column: 2; }
  .timelineText { grid-column: 2; }
  .timelineDelete { grid-column: 3; grid-row: 1; }
  .editorSavebar { bottom: 8px; padding: 8px 9px 8px 12px; flex-wrap: wrap; }
  .editorSavebar > span { font-size: 11px; }
  .editorSavebar > div { gap: 6px; }
  .editorSavebar .adminButton { min-height: 38px; padding: 0 10px; font-size: 12px; }
  .adminModulePanel :deep(.managerToolbar), .adminModulePanel :deep(.photoGalleryMeta), .adminModulePanel :deep(.driveToolbar), .adminModulePanel :deep(.mailToolbar) { align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }

/* Keep the admin workspace in the same translucent visual language as the site. */
.adminApp {
  --admin-surface: var(--item_bg_color);
  --admin-surface-raised: var(--item_bg_color);
  --admin-control: var(--weather_dialog_control_bg);
  --admin-text: var(--main_text_color);
  --admin-muted: rgba(255, 255, 255, .74);
  --admin-line: var(--module_dock_border);
  --admin-accent: var(--module_dock_active_color);
  --admin-accent-soft: var(--item_hover_color);
  --admin-danger: #ffb2b8;
  width: 100%;
  min-height: 0;
  margin: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  color: var(--main_text_color);
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  font-family: inherit;
}
:global([data-theme="Dark"]) .adminApp { border: 0; }
.adminLayout { min-height: 0; display: block; }
.adminSidebar {
  position: relative;
  top: auto;
  padding: 10px 0;
  border: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
}
.adminNav {
  width: fit-content;
  max-width: 100%;
  padding: 6px;
  border: 1px solid var(--module_dock_border);
  border-radius: 15px;
  display: flex;
  flex: 1 1 auto;
  gap: 5px;
  background: var(--module_dock_bg);
  box-shadow: 0 10px 24px -18px var(--module_dock_shadow), inset 0 1px 0 rgba(255, 255, 255, .08);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}
.adminNavItem {
  min-height: 40px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 10px;
  gap: 8px;
  color: var(--module_dock_inactive_color);
  background: var(--module_dock_inactive_bg);
  font-size: 13px;
  transition: color .25s ease, background-color .25s ease, border-color .25s ease, transform .25s ease;
}
.adminNavItem:hover { color: var(--main_text_color); border-color: var(--module_dock_border); background: var(--module_dock_hover_bg); transform: translateY(-1px); }
.adminNavItem.is-active { color: var(--module_dock_active_color); border-color: var(--module_dock_active_border); background: var(--module_dock_active_bg); font-weight: 600; }
.adminLogout {
  min-height: 38px;
  border-color: var(--module_dock_border);
  color: var(--main_text_color);
  background: var(--item_bg_color);
  font-size: 12px;
}
.adminLogout:hover { background: var(--item_hover_color); }
.adminMain { min-width: 0; padding: 0 7px 45px; }
.adminPageHeading {
  min-height: 105px;
  margin: 0 0 20px;
  padding: 20px 2px 17px;
  align-items: flex-end;
  border-bottom: 1px solid var(--module_dock_border);
}
.adminBreadcrumb { color: rgba(255, 255, 255, .72); }
.adminPageTitle { color: var(--main_text_color); font-size: clamp(25px, 4vw, 34px); font-weight: 600; letter-spacing: 0; }
.adminPageDescription { color: rgba(255, 255, 255, .78); }
.adminButton, .adminNotice, .adminLoginGate, .editorCard, .timelineEditorRow {
  border-color: var(--module_dock_border);
  color: var(--main_text_color);
  background: var(--item_bg_color);
  backdrop-filter: blur(var(--card_filter));
  -webkit-backdrop-filter: blur(var(--card_filter));
}
.adminButton { min-height: 36px; border-radius: 6px; font-size: 12px; }
.adminButtonPrimary, :global([data-theme="Dark"]) .adminButtonPrimary {
  border-color: var(--module_dock_active_border);
  color: var(--module_dock_active_color);
  background: var(--module_dock_active_bg);
}
.adminButtonSecondary { color: var(--main_text_color); background: var(--module_dock_inactive_bg); }
.adminButtonSecondary:hover { background: var(--item_hover_color); }
.adminNotice { color: var(--main_text_color); }
.adminAuthLoading, .editorLoading, .adminModuleLoading { color: rgba(255, 255, 255, .8); }
.editorLoading { background: var(--item_bg_color); backdrop-filter: blur(15px); }
.adminLoginGate { min-height: 180px; border-radius: 13px; }
.editorCard { border-radius: 13px; padding: 21px 22px 23px; }
.editorSectionIcon { border-radius: 10px; color: var(--module_dock_active_color); background: var(--module_dock_active_bg); }
.editorCardHeader h2, .editorSubheader h3 { color: var(--main_text_color); }
.editorCardHeader p, .editorSubheader p, .editorField small { color: rgba(255, 255, 255, .72); }
.editorField, .editorField > span { color: var(--main_text_color); }
.editorField input, .editorField textarea, .editorInputPrefix {
  border-color: var(--module_dock_border);
  color: var(--main_text_color);
  background: var(--weather_dialog_control_bg);
}
.editorField input::placeholder, .editorField textarea::placeholder { color: rgba(255, 255, 255, .58); }
.editorField input:focus, .editorField textarea:focus, .editorInputPrefix:focus-within { border-color: var(--module_dock_active_border); box-shadow: 0 0 0 3px var(--module_dock_hover_bg); }
.editorInputPrefix input { background: transparent; }
.tagEditorItem, .timelineEditorRow { border-color: var(--module_dock_border); background: var(--module_dock_inactive_bg); }
.tagEditorItem input, .tagEditorItem button, .timelineOrder button, .timelineDelete { color: var(--main_text_color); }
.editorEmptyHint { color: rgba(255, 255, 255, .72); }
.timelineDate > span, .timelineText > span, .timelineOrder > span { color: rgba(255, 255, 255, .65); }
.editorSavebar {
  border-color: var(--module_dock_border);
  color: var(--main_text_color);
  background: var(--module_dock_bg);
  box-shadow: 0 10px 24px -18px var(--module_dock_shadow);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}
.editorSavebar > span.has-unsaved, :global([data-theme="Dark"]) .editorSavebar > span.has-unsaved { color: #ffe09a; }
.adminModulePanel :deep(.managerToolbar p), .adminModulePanel :deep(.driveToolbar p), .adminModulePanel :deep(.mailToolbar p) { color: rgba(255, 255, 255, .75); }
@media (max-width: 680px) {
  .adminSidebar { top: 0; padding: 8px 0; }
  .adminNav { width: 100%; flex: 1 1 0; overflow-x: auto; scrollbar-width: none; }
  .adminNav::-webkit-scrollbar { display: none; }
  .adminNavItem { min-height: 38px; padding: 0 10px; }
  .adminMain { padding: 0 0 32px; }
  .adminPageHeading { min-height: 90px; padding: 16px 2px 14px; }
}
</style>
