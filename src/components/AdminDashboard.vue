<template>
  <section class="adminDashboard" aria-labelledby="admin-title">
    <header class="adminDashboardHeader">
      <div>
        <p class="adminEyebrow">ANeko - Home / 管理中心</p>
        <h1 id="admin-title">站点管理</h1>
        <p class="adminIntro">集中管理首页内容，并进入博客、相册、云盘和邮箱的管理功能。</p>
      </div>
      <div class="adminHeaderActions">
        <span v-if="accessCode" class="adminLoginState">已登录</span>
        <button type="button" @click="accessCode ? logout() : (showLogin = true)">
          {{ accessCode ? '退出登录' : '管理员登录' }}
        </button>
      </div>
    </header>

    <AdminLoginDialog
      v-if="loginDialogLoaded"
      :open="showLogin"
      @close="showLogin = false"
      @authenticated="handleAuthenticated"
    />

    <div v-if="notice" class="adminNotice" :class="`is-${noticeKind}`" role="status">{{ notice }}</div>

    <div v-if="authChecking" class="adminLoading">正在检查管理员登录状态…</div>
    <template v-else-if="!accessCode">
      <div class="adminLocked">
        <h2>需要管理员登录</h2>
        <p>登录后可以修改首页介绍、GitHub 账号和时间线，也可以进入其他管理页面。</p>
        <button type="button" @click="showLogin = true">登录管理中心</button>
      </div>
    </template>
    <template v-else>
      <nav class="adminSections" aria-label="管理功能">
        <a class="adminSectionCard" href="#home-config">
          <strong>首页内容</strong>
          <span>GitHub、介绍语、位置、标签和时间线</span>
        </a>
        <a class="adminSectionCard" href="/admin/blog/">
          <strong>博客管理</strong>
          <span>发布、编辑、删除文章并提交收录</span>
        </a>
        <a class="adminSectionCard" href="/photos/">
          <strong>相册管理</strong>
          <span>上传、编辑、排序和删除照片</span>
        </a>
        <a class="adminSectionCard" href="/drive/">
          <strong>云盘管理</strong>
          <span>上传文件、创建目录和整理资源</span>
        </a>
        <a class="adminSectionCard" href="/mail/">
          <strong>邮箱管理</strong>
          <span>邮箱设置、Webhook、收发邮件</span>
        </a>
      </nav>

      <form id="home-config" class="adminConfig" @submit.prevent="saveConfig">
        <header class="adminPanelHeader">
          <div>
            <p class="adminEyebrow">首页配置</p>
            <h2>编辑首页内容</h2>
          </div>
          <button class="adminPrimary" type="submit" :disabled="loading || saving">
            {{ saving ? '保存中…' : '保存配置' }}
          </button>
        </header>

        <div v-if="loading" class="adminLoading">正在加载首页配置…</div>
        <div v-else class="adminFormGrid">
          <label>
            <span>GitHub 账号</span>
            <input v-model.trim="form.githubUsername" type="text" autocomplete="off" required pattern="[A-Za-z0-9-]+" />
            <small>用于首页 GitHub 模块和 GitHub 外链。</small>
          </label>
          <label>
            <span>欢迎语</span>
            <input v-model.trim="form.welcome" type="text" maxlength="240" required />
          </label>
          <label>
            <span>身份介绍</span>
            <input v-model.trim="form.role" type="text" maxlength="240" required />
          </label>
          <label>
            <span>第二行介绍语</span>
            <input v-model.trim="form.quote" type="text" maxlength="240" required />
          </label>
          <label>
            <span>所在地</span>
            <input v-model.trim="form.location" type="text" maxlength="120" required />
          </label>
          <label>
            <span>学校或组织</span>
            <input v-model.trim="form.education" type="text" maxlength="120" required />
          </label>
        </div>

        <section class="adminListEditor">
          <header>
            <div>
              <p class="adminEyebrow">标签</p>
              <h3>首页标签</h3>
            </div>
            <button type="button" @click="form.tags.push('新标签')">添加标签</button>
          </header>
          <div class="adminTagEditor">
            <div v-for="(_, index) in form.tags" :key="index" class="adminInlineRow">
              <input v-model.trim="form.tags[index]" type="text" maxlength="32" :aria-label="`标签 ${index + 1}`" />
              <button type="button" title="删除标签" @click="form.tags.splice(index, 1)">删除</button>
            </div>
          </div>
        </section>

        <section class="adminListEditor">
          <header>
            <div>
              <p class="adminEyebrow">时间线</p>
              <h3>首页时间线</h3>
            </div>
            <button type="button" @click="form.timeline.unshift({ text: '', date: '' })">添加条目</button>
          </header>
          <div class="adminTimelineEditor">
            <div v-for="(item, index) in form.timeline" :key="index" class="adminTimelineRow">
              <input v-model.trim="item.date" type="text" maxlength="32" placeholder="2026.10" :aria-label="`时间线日期 ${index + 1}`" />
              <textarea v-model.trim="item.text" rows="2" maxlength="280" placeholder="事件描述" :aria-label="`时间线内容 ${index + 1}`"></textarea>
              <button type="button" title="删除条目" @click="form.timeline.splice(index, 1)">删除</button>
            </div>
          </div>
        </section>
      </form>
    </template>
  </section>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onMounted, reactive, ref } from 'vue'
import { DEFAULT_HOME_CONFIG, type HomeConfig } from '../utils/site-config'
import { apiRequest, clearAdminAccess, restoreAdminAccess } from '../utils/admin-client'
import { userErrorMessage } from '../utils/user-error'

const AdminLoginDialog = defineAsyncComponent(() => import('./AdminLoginDialog.vue'))
const accessCode = ref('')
const authChecking = ref(true)
const loginDialogLoaded = ref(false)
const showLogin = ref(false)
const loading = ref(false)
const saving = ref(false)
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')

const form = reactive<HomeConfig>(cloneConfig(DEFAULT_HOME_CONFIG))

function cloneConfig(value: HomeConfig): HomeConfig {
  return {
    ...value,
    tags: [...value.tags],
    timeline: value.timeline.map((item) => ({ ...item })),
  }
}

function authHeaders(contentType?: string) {
  return {
    'X-Access-Code': accessCode.value,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  }
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
  } catch (error) {
    showMessage(userErrorMessage(error, '首页配置加载失败，请稍后重试。'), 'error')
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!accessCode.value || saving.value) return
  saving.value = true
  try {
    const config = await apiRequest<HomeConfig>('/api/admin/site-config', {
      method: 'PUT',
      headers: authHeaders('application/json'),
      body: JSON.stringify(form),
    })
    Object.assign(form, cloneConfig(config))
    showMessage('首页配置已保存，刷新首页后即可看到更新。', 'success')
  } catch (error) {
    showMessage(userErrorMessage(error, '首页配置保存失败，请稍后重试。'), 'error')
  } finally {
    saving.value = false
  }
}

function handleAuthenticated(code: string) {
  accessCode.value = code
  showLogin.value = false
  void loadConfig()
}

function logout() {
  clearAdminAccess()
  accessCode.value = ''
  showMessage('已退出管理员登录。', 'success')
}

onMounted(async () => {
  loginDialogLoaded.value = true
  accessCode.value = await restoreAdminAccess()
  authChecking.value = false
  if (accessCode.value) await loadConfig()
})
</script>

<style scoped>
.adminDashboard { width: min(1080px, 100%); margin: 0 auto; padding: 34px 24px 70px; color: var(--main_text_color); }
.adminDashboardHeader, .adminPanelHeader, .adminListEditor > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.adminEyebrow { margin: 0 0 8px; opacity: .64; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.adminDashboard h1, .adminDashboard h2, .adminDashboard h3, .adminDashboard p { margin-top: 0; }
.adminDashboard h1 { margin-bottom: 10px; font-size: clamp(28px, 5vw, 44px); }
.adminDashboard h2 { margin-bottom: 8px; font-size: 24px; }
.adminDashboard h3 { margin-bottom: 0; font-size: 17px; }
.adminIntro { max-width: 620px; margin-bottom: 0; opacity: .72; line-height: 1.7; }
.adminHeaderActions { display: flex; align-items: center; gap: 10px; }
.adminDashboard button, .adminSectionCard { border: 1px solid var(--module_dock_border); border-radius: 7px; color: inherit; background: var(--item_bg_color); }
.adminDashboard button { min-height: 34px; padding: 0 12px; cursor: pointer; font: inherit; font-size: 11px; }
.adminDashboard button:hover, .adminSectionCard:hover { background: var(--item_hover_color); }
.adminDashboard button:disabled { opacity: .5; cursor: wait; }
.adminLoginState { opacity: .72; font-size: 11px; }
.adminNotice { margin: 22px 0 0; padding: 11px 13px; border-radius: 7px; background: var(--item_bg_color); font-size: 12px; }
.adminNotice.is-error { color: #ffb4b4; }
.adminNotice.is-success { color: #b9f2cb; }
.adminLocked { margin-top: 32px; padding: 34px; border: 1px solid var(--module_dock_border); border-radius: 10px; background: var(--item_bg_color); text-align: center; }
.adminLocked p { margin: 0 auto 18px; max-width: 520px; opacity: .72; line-height: 1.7; }
.adminSections { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 28px 0; }
.adminSectionCard { min-height: 112px; padding: 16px; display: flex; flex-direction: column; gap: 9px; text-decoration: none; }
.adminSectionCard strong { font-size: 14px; }
.adminSectionCard span { opacity: .64; font-size: 10px; line-height: 1.55; }
.adminConfig { padding: 22px; border: 1px solid var(--module_dock_border); border-radius: 10px; background: var(--item_bg_color); }
.adminPrimary { color: var(--module_dock_active_color) !important; background: var(--module_dock_active_bg) !important; }
.adminFormGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 22px; }
.adminFormGrid label, .adminInlineRow, .adminTimelineRow { display: flex; flex-direction: column; gap: 6px; }
.adminFormGrid label > span { font-size: 11px; }
.adminFormGrid small { opacity: .56; font-size: 10px; }
.adminDashboard input, .adminDashboard textarea { width: 100%; border: 1px solid var(--module_dock_border); border-radius: 5px; outline: none; padding: 9px 10px; color: inherit; background: var(--weather_dialog_control_bg); font: inherit; font-size: 11px; user-select: text; }
.adminDashboard textarea { resize: vertical; line-height: 1.5; }
.adminListEditor { margin-top: 28px; padding-top: 22px; border-top: 1px solid var(--module_dock_border); }
.adminTagEditor { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
.adminInlineRow { flex-direction: row; }
.adminInlineRow button, .adminTimelineRow button { flex: 0 0 auto; }
.adminTimelineEditor { display: grid; gap: 10px; margin-top: 16px; }
.adminTimelineRow { display: grid; grid-template-columns: 120px minmax(0, 1fr) auto; align-items: start; }
.adminLoading { padding: 26px 0; opacity: .68; font-size: 12px; }
@media (max-width: 820px) { .adminSections { grid-template-columns: repeat(2, minmax(0, 1fr)); } .adminTagEditor, .adminFormGrid { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .adminDashboard { padding-inline: 14px; } .adminDashboardHeader, .adminPanelHeader, .adminListEditor > header { flex-direction: column; } .adminSections { grid-template-columns: 1fr; } .adminConfig { padding: 16px; } .adminTimelineRow { grid-template-columns: 1fr; } }
</style>
