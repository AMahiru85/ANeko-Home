<template>
  <section class="mailPage" aria-labelledby="mail-title">
    <header class="mailToolbar">
      <div>
        <p>PRIVATE WEBMAIL</p>
        <h2 id="mail-title">邮箱</h2>
      </div>

      <div class="mailCommands">
        <button
          v-if="!authChecking && !showSettings && (!isAuthenticated || config?.configured)"
          class="is-primary"
          type="button"
          title="写邮件"
          @click="openComposer"
        >
          <SquarePen :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>写邮件</span>
        </button>
        <button
          v-if="!authChecking && !showSettings && (!isAuthenticated || config?.configured)"
          type="button"
          :disabled="isAuthenticated && (foldersStatus === 'loading' || messagesStatus === 'loading')"
          title="刷新邮箱"
          @click="refreshMailbox"
        >
          <RefreshCw :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>刷新</span>
        </button>
        <button
          v-if="!authChecking && (!isAuthenticated || config?.configured)"
          type="button"
          :class="{ 'is-active': showSettings }"
          :title="showSettings ? '返回邮箱' : '邮箱设置'"
          @click="toggleSettings"
        >
          <Inbox v-if="showSettings" :size="15" :stroke-width="1.8" aria-hidden="true" />
          <Settings v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ showSettings ? '返回邮箱' : '设置' }}</span>
        </button>
        <button
          type="button"
          class="mailAuthButton"
          :class="{ 'is-authenticated': isAuthenticated }"
          :disabled="authChecking"
          :title="isAuthenticated ? '退出管理员' : '管理员登录'"
          @click="isAuthenticated ? logout() : openLogin()"
        >
          <LogOut v-if="isAuthenticated" :size="15" :stroke-width="1.8" aria-hidden="true" />
          <LogIn v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ isAuthenticated ? '退出' : '登录' }}</span>
        </button>
      </div>
    </header>

    <div v-if="notice" class="mailNotice" :class="`is-${noticeKind}`" role="status">
      <CircleCheck v-if="noticeKind === 'success'" :size="16" :stroke-width="1.8" aria-hidden="true" />
      <CircleAlert v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
      <span>{{ notice }}</span>
    </div>

    <div v-if="authChecking" class="mailLoading" aria-label="正在检查管理员会话">
      <span v-for="index in 6" :key="index"></span>
    </div>

    <div v-else-if="isAuthenticated && configStatus === 'loading'" class="mailLoading" aria-label="正在加载邮箱配置">
      <span v-for="index in 6" :key="index"></span>
    </div>

    <div v-else-if="isAuthenticated && configStatus === 'error'" class="mailState" role="alert">
      <CircleAlert :size="30" :stroke-width="1.5" aria-hidden="true" />
      <h3>配置读取失败</h3>
      <p>{{ pageError }}</p>
      <button type="button" @click="loadConfig">重试</button>
    </div>

    <MailSettingsPanel
      v-else-if="isAuthenticated && (showSettings || !config?.configured)"
      :config="config"
      :access-code="accessCode"
      @saved="handleConfigSaved"
      @updated="handleConfigUpdated"
      @cancel="closeSettings"
      @notice="showNotice"
      @unauthorized="logout(false)"
    />

    <div v-else class="mailWorkspace" :class="{ 'is-locked': !isAuthenticated }">
      <aside
        class="mailFolders"
        :class="{ 'is-mobile-active': mobileView === 'folders' }"
        aria-label="邮箱文件夹"
      >
        <header class="mailPanelHeader">
          <div>
            <p>MAILBOXES</p>
            <h3>{{ isAuthenticated ? (config?.address || props.publicAddress || '邮箱') : (props.publicAddress || '管理员邮箱') }}</h3>
          </div>
          <button type="button" title="写邮件" aria-label="写邮件" @click="openComposer">
            <SquarePen :size="16" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </header>

        <div v-if="isAuthenticated && foldersStatus === 'loading'" class="mailPanelLoading">
          <span v-for="index in 6" :key="index"></span>
        </div>
        <div v-else-if="isAuthenticated && foldersStatus === 'error'" class="mailPanelState" role="alert">
          <CircleAlert :size="23" :stroke-width="1.5" aria-hidden="true" />
          <span>{{ foldersError }}</span>
          <button type="button" @click="loadFolders">重试</button>
        </div>
        <nav v-else class="mailFolderList">
          <button
            v-for="folder in visibleFolders"
            :key="folder.name"
            type="button"
            :class="{ 'is-current': selectedFolder === folder.name }"
            :disabled="!isSelectableFolder(folder)"
            @click="selectFolder(folder.name)"
          >
            <component :is="folderIcon(folder)" :size="16" :stroke-width="1.7" aria-hidden="true" />
            <span>{{ folderLabel(folder) }}</span>
            <b v-if="folder.unread">{{ compactNumber(folder.unread) }}</b>
          </button>
          <div v-if="visibleFolders.length === 0" class="mailPanelState is-small">
            <Folder :size="22" :stroke-width="1.5" aria-hidden="true" />
            <span>没有可用文件夹</span>
          </div>
        </nav>
      </aside>

      <section
        class="mailMessages"
        :class="{ 'is-mobile-active': mobileView === 'messages' }"
        aria-label="邮件列表"
      >
        <header class="mailPanelHeader is-list">
          <button class="mailMobileBack" type="button" title="返回文件夹" aria-label="返回文件夹" @click="mobileView = 'folders'">
            <ChevronLeft :size="18" :stroke-width="1.8" aria-hidden="true" />
          </button>
          <div>
            <p>MESSAGES</p>
            <h3>{{ activeFolderLabel }}</h3>
          </div>
          <button type="button" title="刷新邮件" aria-label="刷新邮件" :disabled="isAuthenticated && messagesStatus === 'loading'" @click="refreshMessages">
            <RefreshCw :size="15" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </header>

        <div v-if="!isAuthenticated" class="mailPanelState is-locked">
          <LockKeyhole :size="25" :stroke-width="1.5" aria-hidden="true" />
          <span>邮件列表已锁定</span>
        </div>
        <div v-else-if="messagesStatus === 'loading'" class="mailMessageLoading">
          <span v-for="index in 8" :key="index"></span>
        </div>
        <div v-else-if="messagesStatus === 'error'" class="mailPanelState" role="alert">
          <CircleAlert :size="23" :stroke-width="1.5" aria-hidden="true" />
          <span>{{ messagesError }}</span>
          <button type="button" @click="refreshMessages">重试</button>
        </div>
        <div v-else-if="messages.length === 0" class="mailPanelState">
          <Inbox :size="25" :stroke-width="1.5" aria-hidden="true" />
          <span>此文件夹没有邮件</span>
        </div>
        <ol v-else class="mailMessageList">
          <li v-for="message in messages" :key="messageKey(message)">
            <button
              type="button"
              :class="{ 'is-selected': selectedMessage?.uid === message.uid, 'is-unread': !message.seen }"
              @click="openMessage(message)"
            >
              <span class="mailUnreadDot" aria-hidden="true"></span>
              <span class="mailMessageLine">
                <strong>{{ senderLabel(message.from) }}</strong>
                <time :datetime="message.date">{{ formatListDate(message.date) }}</time>
              </span>
              <span class="mailSubject">{{ message.subject || '（无主题）' }}</span>
              <span class="mailMessageMeta">{{ formatBytes(message.size) }}</span>
            </button>
          </li>
        </ol>

        <footer v-if="messagesStatus === 'ready' && (cursorHistory.length > 1 || nextCursor)" class="mailPagination">
          <button type="button" :disabled="cursorHistory.length <= 1" title="上一页" @click="previousPage">
            <ChevronLeft :size="15" :stroke-width="1.8" aria-hidden="true" />
            <span>上一页</span>
          </button>
          <span>{{ cursorHistory.length }}</span>
          <button type="button" :disabled="!nextCursor" title="下一页" @click="nextPage">
            <span>下一页</span>
            <ChevronRight :size="15" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </footer>
      </section>

      <article
        class="mailReader"
        :class="{ 'is-mobile-active': mobileView === 'detail' }"
        aria-label="邮件正文"
      >
        <div v-if="!isAuthenticated" class="mailReaderEmpty is-locked">
          <LockKeyhole :size="30" :stroke-width="1.4" aria-hidden="true" />
          <span>邮件正文已锁定</span>
        </div>
        <div v-else-if="detailStatus === 'loading'" class="mailReaderLoading">
          <span></span><span></span><span></span>
        </div>
        <div v-else-if="detailStatus === 'error'" class="mailPanelState" role="alert">
          <CircleAlert :size="25" :stroke-width="1.5" aria-hidden="true" />
          <span>{{ detailError }}</span>
          <button v-if="selectedMessage" type="button" @click="loadMessageDetail(selectedMessage)">重试</button>
        </div>
        <div v-else-if="!messageDetail" class="mailReaderEmpty">
          <MailOpen :size="30" :stroke-width="1.4" aria-hidden="true" />
          <span>选择一封邮件</span>
        </div>
        <template v-else>
          <header class="mailReaderHeader">
            <div class="mailReaderActions">
              <button class="mailMobileBack" type="button" title="返回邮件列表" aria-label="返回邮件列表" @click="mobileView = 'messages'">
                <ChevronLeft :size="18" :stroke-width="1.8" aria-hidden="true" />
              </button>
              <span></span>
              <button
                type="button"
                :title="messageDetail.seen ? '标记为未读' : '标记为已读'"
                :aria-label="messageDetail.seen ? '标记为未读' : '标记为已读'"
                :disabled="markingSeen"
                @click="setSeen(!messageDetail.seen)"
              >
                <Mail v-if="messageDetail.seen" :size="16" :stroke-width="1.8" aria-hidden="true" />
                <MailOpen v-else :size="16" :stroke-width="1.8" aria-hidden="true" />
              </button>
            </div>
            <h3>{{ messageDetail.subject || '（无主题）' }}</h3>
            <dl class="mailEnvelope">
              <div><dt>发件人</dt><dd>{{ addressLabel(messageDetail.from) }}</dd></div>
              <div><dt>收件人</dt><dd>{{ addressLabel(messageDetail.to) }}</dd></div>
              <div v-if="hasAddresses(messageDetail.cc)"><dt>抄送</dt><dd>{{ addressLabel(messageDetail.cc) }}</dd></div>
              <div><dt>时间</dt><dd>{{ formatFullDate(messageDetail.date) }}</dd></div>
            </dl>
          </header>

          <div class="mailBodyToolbar" v-if="messageDetail.html">
            <div class="mailViewSwitch" role="group" aria-label="正文格式">
              <button type="button" :class="{ 'is-active': bodyMode === 'text' }" @click="bodyMode = 'text'">纯文本</button>
              <button type="button" :class="{ 'is-active': bodyMode === 'html' }" @click="bodyMode = 'html'">隔离 HTML</button>
            </div>
            <span v-if="bodyMode === 'html'"><ShieldCheck :size="13" :stroke-width="1.7" aria-hidden="true" />远程资源已阻止</span>
          </div>
          <div class="mailBody">
            <iframe
              v-if="bodyMode === 'html' && messageDetail.html && safeHtmlBody"
              class="mailHtmlBody"
              title="隔离的 HTML 邮件正文"
              sandbox
              referrerpolicy="no-referrer"
              :srcdoc="safeHtmlBody"
            ></iframe>
            <pre v-else>{{ messageDetail.text || htmlFallbackText || '（邮件正文为空）' }}</pre>
          </div>

          <section v-if="messageDetail.attachments?.length" class="mailAttachments" aria-label="附件">
            <h4><Paperclip :size="14" :stroke-width="1.7" aria-hidden="true" />附件</h4>
            <ul>
              <li v-for="(attachment, index) in messageDetail.attachments" :key="`${attachment.filename}-${index}`">
                <FileText :size="15" :stroke-width="1.7" aria-hidden="true" />
                <span>{{ attachment.filename || '未命名附件' }}</span>
                <small>{{ formatBytes(attachment.size) }}</small>
              </li>
            </ul>
          </section>
        </template>
      </article>
    </div>

    <AdminLoginDialog v-if="loginDialogLoaded" :open="showLogin" @close="showLogin = false" @authenticated="handleAuthenticated" />

    <Teleport v-if="isMounted && isAuthenticated" to="body">
      <Transition name="mail-modal">
        <div v-if="showComposer" class="mailModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="mail-compose-title" @mousedown.self="closeComposer">
          <form class="mailComposer" @submit.prevent="sendMessage">
            <header>
              <div>
                <p>NEW MESSAGE</p>
                <h3 id="mail-compose-title">写邮件</h3>
              </div>
              <button type="button" title="关闭" aria-label="关闭" :disabled="sending" @click="closeComposer">
                <X :size="18" :stroke-width="1.8" aria-hidden="true" />
              </button>
            </header>
            <div class="mailComposeFields">
              <label>
                <span>发件人</span>
                <input :value="config?.address" type="email" disabled />
              </label>
              <label>
                <span>收件人</span>
                <input v-model.trim="compose.to" type="text" autocomplete="off" required :disabled="sending" placeholder="name@example.com" />
              </label>
              <label>
                <span>抄送</span>
                <input v-model.trim="compose.cc" type="text" autocomplete="off" :disabled="sending" placeholder="多个地址用逗号分隔" />
              </label>
              <label>
                <span>主题</span>
                <input v-model="compose.subject" type="text" autocomplete="off" maxlength="998" :disabled="sending" />
              </label>
              <label class="is-body">
                <span>正文</span>
                <textarea v-model="compose.text" required maxlength="200000" :disabled="sending"></textarea>
              </label>
            </div>
            <p v-if="composeError" class="mailFormError" role="alert">{{ composeError }}</p>
            <footer>
              <button type="button" :disabled="sending" @click="closeComposer">取消</button>
              <button class="is-primary" type="submit" :disabled="sending">
                <LoaderCircle v-if="sending" class="is-spinning" :size="15" :stroke-width="1.8" aria-hidden="true" />
                <Send v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
                <span>{{ sending ? '发送中' : '发送' }}</span>
              </button>
            </footer>
          </form>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch, type Component } from 'vue'
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileText,
  Folder,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MailOpen,
  Paperclip,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  SquarePen,
  Trash2,
  X,
} from '@lucide/vue'
import { ApiRequestError, apiRequest, clearAdminAccess, restoreAdminAccess } from '../utils/admin-client'

const AdminLoginDialog = defineAsyncComponent(() => import('./AdminLoginDialog.vue'))
const MailSettingsPanel = defineAsyncComponent(() => import('./MailSettingsPanel.vue'))

const props = defineProps<{ publicAddress?: string }>()

interface MailProtocolConfig {
  host: string
  port: number
  username: string
  passwordConfigured: boolean
}

interface MailConfig {
  configured: boolean
  revision: string | null
  updatedAt: string | null
  address: string
  displayName: string
  imap: MailProtocolConfig
  smtp: MailProtocolConfig
  webhook: {
    revision: string | null
    updatedAt: string | null
    templates: Array<{ id: string; name: string; subject: string; text: string }>
    endpoints: Array<{ id: string; name: string; enabled: boolean; tokenConfigured: boolean; to: string[]; cc: string[]; templateId: string }>
  }
}

interface MailFolder {
  name: string
  delimiter?: string
  attributes?: string[]
  total?: number
  unread?: number
}

interface MailAddress {
  name?: string
  address?: string
}

type AddressValue = string | MailAddress | Array<string | MailAddress> | null | undefined

interface MailSummary {
  uid: number
  subject: string
  from: AddressValue
  to?: AddressValue
  cc?: AddressValue
  date: string | null
  size: number
  seen: boolean
  flags?: string[]
  messageId?: string
}

interface MailAttachment {
  filename?: string
  mimeType?: string
  size?: number
  contentId?: string
}

interface MailDetail extends MailSummary {
  text?: string
  html?: string
  attachments?: MailAttachment[]
}

interface FolderResponse { folders: MailFolder[] }
interface MessagesResponse {
  folder: string
  uidValidity: string | number | null
  messages: MailSummary[]
  nextCursor?: string | null
}
interface DetailResponse {
  folder: string
  uidValidity: string | number | null
  message: MailDetail
}

type RequestStatus = 'idle' | 'loading' | 'ready' | 'error'
type MobileView = 'folders' | 'messages' | 'detail'

const mailTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit', minute: '2-digit', hour12: false,
})
const mailShortDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit',
})
const mailFullDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})

const accessCode = ref('')
const authChecking = ref(true)
const showLogin = ref(false)
const loginDialogLoaded = ref(false)
const isMounted = ref(false)
const config = ref<MailConfig | null>(null)
const configStatus = ref<RequestStatus>('idle')
const pageError = ref('')
const showSettings = ref(false)
const folders = ref<MailFolder[]>([])
const foldersStatus = ref<RequestStatus>('idle')
const foldersError = ref('')
const selectedFolder = ref('INBOX')
const messages = ref<MailSummary[]>([])
const messagesStatus = ref<RequestStatus>('idle')
const messagesError = ref('')
const uidValidity = ref<string | number | null>('')
const cursorHistory = ref<Array<string | null>>([null])
const nextCursor = ref<string | null>(null)
const selectedMessage = ref<MailSummary | null>(null)
const messageDetail = ref<MailDetail | null>(null)
const detailStatus = ref<RequestStatus>('idle')
const detailError = ref('')
const markingSeen = ref(false)
const bodyMode = ref<'text' | 'html'>('text')
const mobileView = ref<MobileView>('folders')
const showComposer = ref(false)
const sending = ref(false)
const composeIdempotencyKey = ref('')
const composeError = ref('')
const compose = reactive({ to: '', cc: '', subject: '', text: '' })
const notice = ref('')
const noticeKind = ref<'success' | 'error'>('success')
const pageEpoch = ref(0)
let noticeTimer: number | null = null
let configController: AbortController | null = null
let foldersController: AbortController | null = null
let messagesController: AbortController | null = null
let detailController: AbortController | null = null

const previewFolders: MailFolder[] = [
  { name: 'INBOX' },
  { name: 'Sent' },
  { name: 'Drafts' },
  { name: 'Archive' },
  { name: 'Junk' },
  { name: 'Trash' },
]

const isAuthenticated = computed(() => Boolean(accessCode.value))
const visibleFolders = computed(() => isAuthenticated.value ? folders.value : previewFolders)
const activeFolder = computed(() => visibleFolders.value.find((folder) => folder.name === selectedFolder.value))
const activeFolderLabel = computed(() => activeFolder.value ? folderLabel(activeFolder.value) : '邮件')
const htmlFallbackText = computed(() => stripHtml(messageDetail.value?.html || ''))
const safeHtmlBody = ref('')
let htmlSanitizeEpoch = 0

watch(showLogin, (open) => {
  if (open) loginDialogLoaded.value = true
}, { flush: 'sync' })

function authHeaders(contentType?: string) {
  return {
    'X-Access-Code': accessCode.value,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  }
}

type MailboxConfig = Omit<MailConfig, 'webhook'>
type WebhookConfig = MailConfig['webhook']
type WebhookConfigResponse = Partial<WebhookConfig> & {
  enabled?: boolean
  tokenConfigured?: boolean
  to?: string[]
  cc?: string[]
  subject?: string
  text?: string
}

function normalizeConfig(
  value: Partial<MailboxConfig> | null | undefined,
  webhookValue?: WebhookConfigResponse | null,
): MailConfig {
  const protocol = (entry: Partial<MailProtocolConfig> | undefined, port: number): MailProtocolConfig => ({
    host: entry?.host || '',
    port,
    username: entry?.username || '',
    passwordConfigured: Boolean(entry?.passwordConfigured),
  })
  const imap = protocol(value?.imap, 993)
  const smtp = protocol(value?.smtp, 465)
  const legacySubject = webhookValue?.subject?.trim() || ''
  const legacyText = webhookValue?.text || ''
  const legacyTo = Array.isArray(webhookValue?.to) ? webhookValue.to : []
  const legacyCc = Array.isArray(webhookValue?.cc) ? webhookValue.cc : []
  const legacyTemplate = {
    id: 'default',
    name: '默认模板',
    subject: legacySubject || 'Webhook notification',
    text: legacyText.trim() ? legacyText : '{{json}}',
  }
  const legacyEndpoint = {
    id: 'default',
    name: '默认接口',
    enabled: Boolean(webhookValue?.enabled),
    tokenConfigured: Boolean(webhookValue?.tokenConfigured),
    to: legacyTo,
    cc: legacyCc,
    templateId: 'default',
  }
  return {
    configured: Boolean(value?.configured && imap.passwordConfigured && smtp.passwordConfigured),
    revision: value?.revision ?? null,
    updatedAt: value?.updatedAt ?? null,
    address: value?.address || '',
    displayName: value?.displayName || '',
    imap,
    smtp,
    webhook: {
      revision: webhookValue?.revision ?? null,
      updatedAt: webhookValue?.updatedAt ?? null,
      templates: Array.isArray(webhookValue?.templates) && webhookValue.templates.length
        ? webhookValue.templates
        : [legacyTemplate],
      endpoints: Array.isArray(webhookValue?.endpoints) && webhookValue.endpoints.length
        ? webhookValue.endpoints
        : [legacyEndpoint],
    },
  }
}

async function loadConfig() {
  if (!accessCode.value) return
  const epoch = pageEpoch.value
  configController?.abort()
  configController = new AbortController()
  configStatus.value = 'loading'
  pageError.value = ''
  try {
    const [result, webhook] = await Promise.all([
      apiRequest<MailboxConfig>('/api/admin/mail/config', {
        headers: authHeaders(),
        cache: 'no-store',
        signal: configController.signal,
      }),
      apiRequest<WebhookConfigResponse>('/api/admin/mail/webhook', {
        headers: authHeaders(),
        cache: 'no-store',
        signal: configController.signal,
      }),
    ])
    if (epoch !== pageEpoch.value) return
    config.value = normalizeConfig(result, webhook)
    configStatus.value = 'ready'
    showSettings.value = !config.value.configured
    if (config.value.configured) await loadFolders()
  } catch (error) {
    if (isAbortError(error)) return
    if (epoch !== pageEpoch.value) return
    configStatus.value = 'error'
    pageError.value = errorMessage(error, '无法读取邮箱配置')
  }
}

async function loadFolders() {
  if (!accessCode.value || !config.value?.configured) return
  const epoch = pageEpoch.value
  foldersController?.abort()
  foldersController = new AbortController()
  foldersStatus.value = 'loading'
  foldersError.value = ''
  try {
    const result = await apiRequest<FolderResponse>('/api/admin/mail/folders', {
      headers: authHeaders(),
      cache: 'no-store',
      signal: foldersController.signal,
    })
    if (epoch !== pageEpoch.value) return
    folders.value = Array.isArray(result.folders) ? result.folders : []
    foldersStatus.value = 'ready'
    if (!selectedFolder.value || !folders.value.some(
      (item) => item.name === selectedFolder.value && isSelectableFolder(item),
    )) {
      selectedFolder.value = preferredFolder(folders.value)?.name || ''
    }
    if (selectedFolder.value) {
      cursorHistory.value = [null]
      await loadMessages(null)
    } else {
      resetMessageState()
    }
  } catch (error) {
    if (isAbortError(error)) return
    if (epoch !== pageEpoch.value) return
    foldersStatus.value = 'error'
    foldersError.value = errorMessage(error, '无法读取邮箱文件夹')
  }
}

async function loadMessages(cursor: string | null) {
  if (!selectedFolder.value || !accessCode.value) return
  const epoch = pageEpoch.value
  messagesController?.abort()
  messagesController = new AbortController()
  detailController?.abort()
  messagesStatus.value = 'loading'
  messagesError.value = ''
  selectedMessage.value = null
  messageDetail.value = null
  detailStatus.value = 'idle'
  const query = new URLSearchParams({ folder: selectedFolder.value, limit: '25' })
  if (cursor) {
    query.set('cursor', cursor)
    query.set('uidValidity', String(uidValidity.value))
  }
  try {
    const result = await apiRequest<MessagesResponse>(`/api/admin/mail/messages?${query}`, {
      headers: authHeaders(),
      cache: 'no-store',
      signal: messagesController.signal,
    })
    if (epoch !== pageEpoch.value) return
    messages.value = Array.isArray(result.messages) ? result.messages : []
    uidValidity.value = result.uidValidity
    nextCursor.value = result.nextCursor || null
    messagesStatus.value = 'ready'
  } catch (error) {
    if (isAbortError(error)) return
    if (epoch !== pageEpoch.value) return
    messagesStatus.value = 'error'
    messagesError.value = errorMessage(error, '无法读取邮件列表')
  }
}

async function loadMessageDetail(summary: MailSummary) {
  if (!uidValidity.value) {
    detailStatus.value = 'error'
    detailError.value = '邮箱服务器未返回 UIDVALIDITY，请刷新后重试'
    return
  }
  const epoch = pageEpoch.value
  detailController?.abort()
  detailController = new AbortController()
  detailStatus.value = 'loading'
  detailError.value = ''
  messageDetail.value = null
  bodyMode.value = 'text'
  const query = new URLSearchParams({
    folder: selectedFolder.value,
    uidValidity: String(uidValidity.value),
  })
  try {
    const result = await apiRequest<DetailResponse>(`/api/admin/mail/messages/${encodeURIComponent(String(summary.uid))}?${query}`, {
      headers: authHeaders(),
      cache: 'no-store',
      signal: detailController.signal,
    })
    if (epoch !== pageEpoch.value) return
    if (selectedMessage.value?.uid !== summary.uid) return
    messageDetail.value = result.message
    uidValidity.value = result.uidValidity
    detailStatus.value = 'ready'
    if (!result.message.seen) await setSeen(true, true)
  } catch (error) {
    if (isAbortError(error)) return
    if (epoch !== pageEpoch.value) return
    detailStatus.value = 'error'
    detailError.value = errorMessage(error, '无法读取邮件正文')
  }
}

async function selectFolder(name: string) {
  const folder = visibleFolders.value.find((item) => item.name === name)
  if (!folder || !isSelectableFolder(folder)) return
  if (selectedFolder.value === name && (messagesStatus.value === 'ready' || !isAuthenticated.value)) {
    mobileView.value = 'messages'
    return
  }
  selectedFolder.value = name
  cursorHistory.value = [null]
  mobileView.value = 'messages'
  if (!isAuthenticated.value) return
  await loadMessages(null)
}

function openMessage(summary: MailSummary) {
  selectedMessage.value = summary
  mobileView.value = 'detail'
  void loadMessageDetail(summary)
}

async function setSeen(seen: boolean, silent = false) {
  if (!messageDetail.value || !uidValidity.value || markingSeen.value) return
  const epoch = pageEpoch.value
  markingSeen.value = true
  const currentUid = messageDetail.value.uid
  const currentFolder = selectedFolder.value
  const currentUidValidity = uidValidity.value
  const query = new URLSearchParams({ folder: currentFolder, uidValidity: String(currentUidValidity) })
  try {
    await apiRequest<{ uid: number; seen: boolean }>(`/api/admin/mail/messages/${encodeURIComponent(String(currentUid))}?${query}`, {
      method: 'PATCH',
      headers: authHeaders('application/json'),
      body: JSON.stringify({ seen }),
    })
    if (epoch !== pageEpoch.value
      || selectedFolder.value !== currentFolder
      || uidValidity.value !== currentUidValidity) return
    if (messageDetail.value?.uid === currentUid) messageDetail.value.seen = seen
    const summary = messages.value.find((item) => item.uid === currentUid)
    if (summary) summary.seen = seen
    if (!silent) showNotice(seen ? '已标记为已读' : '已标记为未读')
  } catch (error) {
    if (epoch !== pageEpoch.value) return
    const message = errorMessage(error, '状态更新失败')
    if (!silent) showNotice(message, 'error')
  } finally {
    markingSeen.value = false
  }
}

function previousPage() {
  if (cursorHistory.value.length <= 1) return
  cursorHistory.value.pop()
  void loadMessages(cursorHistory.value.at(-1) || null)
}

function nextPage() {
  if (!nextCursor.value) return
  cursorHistory.value.push(nextCursor.value)
  void loadMessages(nextCursor.value)
}

async function refreshMessages() {
  if (!requireAdminAccess()) return
  await loadMessages(cursorHistory.value.at(-1) || null)
}

async function refreshMailbox() {
  if (!requireAdminAccess()) return
  await loadFolders()
  if (foldersStatus.value === 'ready') showNotice('邮箱已刷新')
}

function toggleSettings() {
  if (!requireAdminAccess()) return
  if (showSettings.value) {
    closeSettings()
    return
  }
  abortMailboxRequests()
  resetMailbox()
  showSettings.value = !showSettings.value
}

function handleConfigUpdated(nextConfig: MailConfig) {
  config.value = normalizeConfig(nextConfig, nextConfig.webhook)
  configStatus.value = 'ready'
}

function handleConfigSaved(nextConfig: MailConfig) {
  config.value = normalizeConfig(nextConfig, nextConfig.webhook)
  configStatus.value = 'ready'
  showSettings.value = !config.value.configured
  if (config.value.configured) void loadFolders()
  else resetMailbox()
}

function closeSettings() {
  showSettings.value = false
  if (config.value?.configured) void loadFolders()
}

function handleAuthenticated(code: string) {
  pageEpoch.value += 1
  accessCode.value = code
  showLogin.value = false
  showNotice('管理员登录成功')
  void loadConfig()
}

function openLogin() {
  showLogin.value = true
}

function requireAdminAccess() {
  if (isAuthenticated.value) return true
  openLogin()
  return false
}

function logout(showConfirmation = true) {
  pageEpoch.value += 1
  abortRequests()
  clearAdminAccess()
  accessCode.value = ''
  config.value = null
  configStatus.value = 'idle'
  showSettings.value = false
  showLogin.value = false
  showComposer.value = false
  resetMailbox()
  resetComposer()
  mobileView.value = 'folders'
  if (showConfirmation) showNotice('已退出管理员')
}

function openComposer() {
  if (!requireAdminAccess()) return
  resetComposer()
  showComposer.value = true
}

function closeComposer() {
  if (!sending.value) showComposer.value = false
}

function resetComposer() {
  compose.to = ''
  compose.cc = ''
  compose.subject = ''
  compose.text = ''
  composeError.value = ''
  composeIdempotencyKey.value = ''
}

function parseRecipients(value: string) {
  return value.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean)
}

async function sendMessage() {
  const to = parseRecipients(compose.to)
  const cc = parseRecipients(compose.cc)
  if (!to.length) {
    composeError.value = '请填写收件人'
    return
  }
  sending.value = true
  composeError.value = ''
  if (!composeIdempotencyKey.value) {
    composeIdempotencyKey.value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  try {
    await apiRequest<{ sent: boolean; idempotencyKey: string }>('/api/admin/mail/send', {
      method: 'POST',
      headers: authHeaders('application/json'),
      body: JSON.stringify({
        idempotencyKey: composeIdempotencyKey.value,
        to,
        cc,
        subject: compose.subject,
        text: compose.text,
      }),
    })
    showComposer.value = false
    resetComposer()
    showNotice('邮件已发送')
  } catch (error) {
    composeError.value = errorMessage(error, '邮件发送失败')
  } finally {
    sending.value = false
  }
}

function resetMessageState() {
  messages.value = []
  messagesStatus.value = 'idle'
  messagesError.value = ''
  uidValidity.value = ''
  cursorHistory.value = [null]
  nextCursor.value = null
  selectedMessage.value = null
  messageDetail.value = null
  detailStatus.value = 'idle'
  detailError.value = ''
}

function resetMailbox() {
  folders.value = []
  foldersStatus.value = 'idle'
  foldersError.value = ''
  selectedFolder.value = isAuthenticated.value ? '' : 'INBOX'
  resetMessageState()
}

function abortRequests() {
  configController?.abort()
  abortMailboxRequests()
}

function abortMailboxRequests() {
  foldersController?.abort()
  messagesController?.abort()
  detailController?.abort()
}

function preferredFolder(items: MailFolder[]) {
  const selectable = items.filter(isSelectableFolder)
  return selectable.find((item) => /(^|[/.])inbox$/i.test(item.name)) || selectable[0]
}

function isSelectableFolder(folder: MailFolder) {
  return !(folder.attributes || []).some((attribute) => attribute.replace(/^\\/, '').toLowerCase() === 'noselect')
}

function folderIcon(folder: MailFolder): Component {
  const value = `${folder.name} ${(folder.attributes || []).join(' ')}`.toLowerCase()
  if (value.includes('inbox')) return Inbox
  if (value.includes('sent')) return Send
  if (value.includes('draft')) return FileText
  if (value.includes('trash') || value.includes('deleted')) return Trash2
  if (value.includes('archive')) return Archive
  if (value.includes('junk') || value.includes('spam')) return Mail
  return Folder
}

function folderLabel(folder: MailFolder) {
  const tail = folder.name.split(folder.delimiter || '/').filter(Boolean).at(-1) || folder.name
  const labels: Record<string, string> = {
    inbox: '收件箱', sent: '已发送', trash: '已删除', deleted: '已删除', archive: '归档', drafts: '草稿箱', junk: '垃圾邮件', spam: '垃圾邮件',
  }
  return labels[tail.toLowerCase()] || tail
}

function compactNumber(value: number | undefined) {
  if (!value) return ''
  return value > 99 ? '99+' : String(value)
}

function messageKey(message: MailSummary) {
  return `${uidValidity.value}:${message.uid}`
}

function addresses(value: AddressValue): Array<string | MailAddress> {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function singleAddressLabel(value: string | MailAddress) {
  if (typeof value === 'string') return value
  if (value.name && value.address) return `${value.name} <${value.address}>`
  return value.name || value.address || ''
}

function addressLabel(value: AddressValue) {
  return addresses(value).map(singleAddressLabel).filter(Boolean).join(', ') || '—'
}

function senderLabel(value: AddressValue) {
  const first = addresses(value)[0]
  if (!first) return '未知发件人'
  if (typeof first === 'string') return first
  return first.name || first.address || '未知发件人'
}

function hasAddresses(value: AddressValue) {
  return addresses(value).length > 0
}

function formatListDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ''
  const now = new Date()
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  return (sameDay ? mailTimeFormatter : mailShortDateFormatter).format(date)
}

function formatFullDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value || '—'
  return mailFullDateFormatter.format(date)
}

function formatBytes(value: number | undefined) {
  if (!value || value < 1) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const size = value / (1024 ** index)
  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`
}

function stripHtml(value: string) {
  if (!value) return ''
  if (typeof window === 'undefined') return ''
  const parsedDocument = new DOMParser().parseFromString(value, 'text/html')
  return parsedDocument.body.textContent?.replace(/\n{3,}/g, '\n\n').trim() || ''
}

async function createSafeHtmlDocument(value: string) {
  if (!value || typeof window === 'undefined') return ''
  const { default: DOMPurify } = await import('dompurify')
  const clean = DOMPurify.sanitize(value, {
    FORBID_TAGS: ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'svg', 'math', 'base'],
    FORBID_ATTR: ['srcset', 'formaction', 'ping'],
  })
  const securityPolicy = "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${securityPolicy}"><meta name="referrer" content="no-referrer"><style>html{color-scheme:light dark}body{margin:0;padding:18px;color:#202124;background:transparent;font:14px/1.65 system-ui,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#476c9b}@media(prefers-color-scheme:dark){body{color:#e8e8e8}a{color:#9bbce8}}</style></head><body>${clean}</body></html>`
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError && error.status === 401) {
    logout(false)
    return '管理员会话已失效，请重新登录'
  }
  return error instanceof Error ? error.message : fallback
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function showNotice(message: string, kind: 'success' | 'error' = 'success') {
  notice.value = message
  noticeKind.value = kind
  if (noticeTimer !== null) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, 2800)
}

watch(showComposer, (open) => {
  if (typeof document !== 'undefined') document.documentElement.style.overflow = open ? 'hidden' : ''
})

watch(
  () => bodyMode.value === 'html' ? messageDetail.value?.html || '' : '',
  async (html) => {
    const epoch = ++htmlSanitizeEpoch
    if (!html) {
      safeHtmlBody.value = ''
      return
    }
    try {
      const safeDocument = await createSafeHtmlDocument(html)
      if (epoch === htmlSanitizeEpoch) safeHtmlBody.value = safeDocument
    } catch {
      if (epoch !== htmlSanitizeEpoch) return
      safeHtmlBody.value = ''
      showNotice('HTML 正文处理失败，已显示纯文本', 'error')
    }
  },
)

watch(
  () => [compose.to, compose.cc, compose.subject, compose.text],
  () => {
    if (!sending.value) composeIdempotencyKey.value = ''
  },
)

onMounted(async () => {
  isMounted.value = true
  accessCode.value = await restoreAdminAccess()
  authChecking.value = false
  if (accessCode.value) await loadConfig()
})

onBeforeUnmount(() => {
  abortRequests()
  if (noticeTimer !== null) window.clearTimeout(noticeTimer)
  document.documentElement.style.removeProperty('overflow')
})
</script>

<style scoped>
.mailPage {
  width: calc(100% - 14px);
  margin: 0 7px;
  padding: 24px 0 76px;
  color: inherit;
}

.mailToolbar {
  min-height: 112px;
  padding: 24px 2px 18px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 22px;
}

.mailToolbar p,
.mailPanelHeader p,
.mailComposer header p {
  margin: 0;
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  opacity: 0.5;
}

.mailToolbar h2 { margin: 5px 0 0; font-size: 25px; line-height: 32px; }
.mailCommands { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 7px; }

.mailCommands button,
.mailState button,
.mailPanelState button,
.mailPagination button,
.mailComposer footer button {
  min-height: 36px;
  padding: 0 11px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: inherit;
  background: var(--item_bg_color);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.mailCommands button:hover,
.mailState button:hover,
.mailPanelState button:hover,
.mailPagination button:hover,
.mailComposer footer button:hover { border-color: var(--module_dock_active_border); background: var(--item_hover_color); }
.mailCommands button:active,
.mailState button:active,
.mailPanelState button:active,
.mailPagination button:active,
.mailComposer footer button:active { transform: scale(0.97); }
.mailCommands button:disabled,
.mailPagination button:disabled { opacity: 0.35; pointer-events: none; }
.mailCommands button.is-primary,
.mailComposer footer button.is-primary { border-color: var(--weather_dialog_active_bg); color: var(--weather_dialog_active_text); background: var(--weather_dialog_active_bg); }
.mailCommands button.is-active,
.mailAuthButton.is-authenticated { border-color: rgba(90, 160, 118, 0.48); }

.mailNotice {
  min-height: 42px;
  margin-top: 10px;
  padding: 0 12px;
  border: 1px solid var(--module_dock_border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--item_bg_color);
  font-size: 10px;
}
.mailNotice.is-error,
.mailFormError { color: #c85858; }

.mailState {
  min-height: min(560px, calc(100dvh - 250px));
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.mailState h3 { margin: 5px 0 0; font-size: 19px; line-height: 27px; }
.mailState p { margin: 6px 0 0; font-size: 10px; opacity: 0.5; }
.mailState button { margin-top: 19px; }

.mailLoading { min-height: min(560px, calc(100dvh - 250px)); border-bottom: 1px solid var(--module_dock_border); display: grid; grid-template-columns: 180px minmax(250px, 0.8fr) minmax(0, 1.4fr); }
.mailLoading span { min-height: 120px; border-right: 1px solid var(--module_dock_border); border-bottom: 1px solid var(--module_dock_border); background: linear-gradient(100deg, transparent 20%, var(--item_bg_color) 45%, transparent 70%); background-size: 220% 100%; animation: mailShimmer 1.35s ease-in-out infinite; }

.mailWorkspace {
  height: clamp(600px, calc(100dvh - 198px), 900px);
  min-height: 600px;
  border-bottom: 1px solid var(--module_dock_border);
  display: grid;
  grid-template-columns: 190px minmax(280px, 0.78fr) minmax(0, 1.35fr);
  overflow: hidden;
}
.mailFolders,
.mailMessages,
.mailReader { min-width: 0; min-height: 0; border-right: 1px solid var(--module_dock_border); display: flex; flex-direction: column; }
.mailReader { border-right: 0; }

.mailPanelHeader {
  height: 76px;
  min-height: 76px;
  padding: 14px;
  border-bottom: 1px solid var(--module_dock_border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.mailPanelHeader > div { min-width: 0; }
.mailPanelHeader h3 { margin: 3px 0 0; overflow: hidden; font-size: 11px; line-height: 17px; text-overflow: ellipsis; white-space: nowrap; }
.mailPanelHeader > button,
.mailReaderActions button {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  display: grid;
  place-items: center;
  color: inherit;
  background: transparent;
  cursor: pointer;
}
.mailPanelHeader > button:hover,
.mailReaderActions button:hover { border-color: var(--module_dock_border); background: var(--item_hover_color); }
.mailPanelHeader > button:disabled,
.mailReaderActions button:disabled { opacity: 0.35; pointer-events: none; }
.mailMobileBack { display: none !important; }

.mailFolderList { min-height: 0; padding: 8px; overflow-y: auto; }
.mailFolderList > button {
  width: 100%;
  min-height: 39px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 5px;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 10px;
  text-align: left;
  cursor: pointer;
}
.mailFolderList > button:hover { background: var(--item_hover_color); }
.mailFolderList > button.is-current { border-color: var(--module_dock_border); background: var(--item_bg_color); }
.mailFolderList > button:disabled { opacity: 0.38; cursor: default; }
.mailFolderList > button:disabled:hover { background: transparent; }
.mailFolderList > button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mailFolderList > button b { min-width: 19px; height: 18px; padding: 0 5px; border-radius: 9px; display: grid; place-items: center; color: var(--module_dock_active_color); background: var(--module_dock_active_bg); font-size: 8px; font-weight: 600; }

.mailPanelLoading,
.mailMessageLoading { min-height: 0; overflow: hidden; }
.mailPanelLoading span,
.mailMessageLoading span { height: 62px; border-bottom: 1px solid var(--module_dock_border); display: block; background: linear-gradient(100deg, transparent 20%, var(--item_bg_color) 45%, transparent 70%); background-size: 220% 100%; animation: mailShimmer 1.35s ease-in-out infinite; }
.mailPanelState,
.mailReaderEmpty { min-height: 0; flex: 1; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; }
.mailPanelState > span,
.mailReaderEmpty span { max-width: 240px; font-size: 9px; line-height: 15px; opacity: 0.5; }
.mailPanelState.is-locked > svg,
.mailReaderEmpty.is-locked > svg { opacity: 0.42; }
.mailPanelState button { margin-top: 3px; }
.mailPanelState.is-small { min-height: 180px; }

.mailMessageList { min-height: 0; margin: 0; padding: 0; flex: 1; overflow-y: auto; list-style: none; }
.mailMessageList li { margin: 0; border-bottom: 1px solid var(--module_dock_border); }
.mailMessageList li > button {
  width: 100%;
  min-height: 82px;
  padding: 11px 12px 10px 23px;
  border: 0;
  position: relative;
  display: grid;
  gap: 5px;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.mailMessageList li > button:hover { background: var(--item_hover_color); }
.mailMessageList li > button.is-selected { background: var(--item_bg_color); box-shadow: inset 2px 0 0 var(--module_dock_active_border); }
.mailUnreadDot { position: absolute; top: 19px; left: 10px; width: 6px; height: 6px; border-radius: 50%; background: transparent; }
.mailMessageList button.is-unread .mailUnreadDot { background: #4f8dca; }
.mailMessageLine { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mailMessageLine strong { overflow: hidden; font-size: 10px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.mailMessageList button.is-unread .mailMessageLine strong,
.mailMessageList button.is-unread .mailSubject { font-weight: 650; }
.mailMessageLine time,
.mailMessageMeta { flex: 0 0 auto; font-size: 8px; opacity: 0.42; }
.mailSubject { overflow: hidden; font-size: 10px; line-height: 15px; text-overflow: ellipsis; white-space: nowrap; }
.mailMessageMeta { justify-self: end; }

.mailPagination { min-height: 48px; padding: 6px 9px; border-top: 1px solid var(--module_dock_border); display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.mailPagination button { min-height: 32px; padding: 0 8px; }
.mailPagination > span { font-size: 8px; opacity: 0.45; }

.mailReader { overflow: hidden; }
.mailReaderLoading { min-height: 0; padding: 25px; flex: 1; display: grid; grid-template-rows: 110px 28px minmax(250px, 1fr); gap: 14px; }
.mailReaderLoading span { background: linear-gradient(100deg, transparent 20%, var(--item_bg_color) 45%, transparent 70%); background-size: 220% 100%; animation: mailShimmer 1.35s ease-in-out infinite; }
.mailReaderHeader { padding: 19px 20px 17px; border-bottom: 1px solid var(--module_dock_border); }
.mailReaderActions { min-height: 34px; display: flex; align-items: center; justify-content: space-between; }
.mailReaderActions > span { flex: 1; }
.mailReaderHeader h3 { margin: 12px 0 14px; font-size: 18px; line-height: 25px; overflow-wrap: anywhere; }
.mailEnvelope { margin: 0; display: grid; gap: 5px; }
.mailEnvelope > div { min-width: 0; display: grid; grid-template-columns: 50px minmax(0, 1fr); gap: 8px; font-size: 9px; line-height: 15px; }
.mailEnvelope dt { opacity: 0.4; }
.mailEnvelope dd { margin: 0; overflow-wrap: anywhere; opacity: 0.7; user-select: text; }

.mailBodyToolbar { min-height: 48px; padding: 7px 18px; border-bottom: 1px solid var(--module_dock_border); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mailViewSwitch { height: 30px; padding: 2px; border: 1px solid var(--module_dock_border); border-radius: 5px; display: flex; background: var(--item_bg_color); }
.mailViewSwitch button { min-width: 62px; padding: 0 8px; border: 0; border-radius: 3px; color: inherit; background: transparent; font: inherit; font-size: 8px; cursor: pointer; }
.mailViewSwitch button.is-active { background: var(--item_hover_color); }
.mailBodyToolbar > span { display: inline-flex; align-items: center; gap: 5px; font-size: 8px; opacity: 0.48; }
.mailBody { min-height: 260px; flex: 1; overflow: auto; }
.mailBody pre { min-height: 100%; margin: 0; padding: 22px; color: inherit; background: transparent; font: 11px/1.8 ui-monospace, "Cascadia Code", Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
.mailHtmlBody { width: 100%; height: 100%; min-height: 400px; border: 0; display: block; background: #fff; color-scheme: light dark; }
.mailAttachments { padding: 14px 20px 18px; border-top: 1px solid var(--module_dock_border); }
.mailAttachments h4 { margin: 0 0 8px; display: flex; align-items: center; gap: 6px; font-size: 9px; }
.mailAttachments ul { margin: 0; padding: 0; list-style: none; }
.mailAttachments li { min-height: 36px; padding: 0 8px; border-bottom: 1px solid var(--module_dock_border); display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 7px; }
.mailAttachments li span { overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.mailAttachments li small { font-size: 8px; opacity: 0.44; }

.mailModalBackdrop { position: fixed; inset: 0; z-index: 99999; padding: 18px; display: flex; align-items: center; justify-content: center; background: var(--weather_dialog_backdrop); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.mailComposer { width: min(720px, 100%); max-height: calc(100dvh - 36px); border: 1px solid var(--weather_dialog_border); border-radius: 8px; display: flex; flex-direction: column; color: var(--weather_dialog_text); background: var(--weather_dialog_bg); box-shadow: 0 24px 70px -34px var(--weather_dialog_shadow), inset 0 1px 0 var(--weather_dialog_inset); }
.mailComposer > header { min-height: 72px; padding: 17px 20px 14px; border-bottom: 1px solid var(--weather_dialog_line); display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.mailComposer > header h3 { margin: 3px 0 0; font-size: 18px; line-height: 24px; }
.mailComposer > header button { width: 32px; height: 32px; padding: 0; border: 1px solid transparent; border-radius: 5px; display: grid; place-items: center; color: inherit; background: transparent; cursor: pointer; }
.mailComposer > header button:hover { border-color: var(--weather_dialog_line); background: var(--weather_dialog_control_hover); }
.mailComposeFields { min-height: 0; padding: 17px 20px; overflow-y: auto; display: grid; gap: 12px; }
.mailComposeFields label { min-width: 0; display: grid; grid-template-columns: 62px minmax(0, 1fr); align-items: center; gap: 9px; }
.mailComposeFields label > span { color: var(--weather_dialog_muted); font-size: 9px; }
.mailComposeFields input,
.mailComposeFields textarea { width: 100%; border: 1px solid var(--weather_dialog_line_strong); border-radius: 6px; outline: 0; color: inherit; background: var(--weather_dialog_control_bg); font: inherit; font-size: 11px; }
.mailComposeFields input { height: 42px; padding: 0 11px; }
.mailComposeFields textarea { min-height: 270px; padding: 12px; resize: vertical; font: 11px/19px ui-monospace, "Cascadia Code", Consolas, monospace; }
.mailComposeFields input:focus,
.mailComposeFields textarea:focus { border-color: var(--weather_dialog_focus); }
.mailComposeFields input:disabled { opacity: 0.45; }
.mailComposeFields label.is-body { align-items: start; }
.mailComposeFields label.is-body > span { padding-top: 11px; }
.mailFormError { margin: 0 20px 12px; padding: 9px 11px; border: 1px solid rgba(193, 78, 78, 0.26); border-radius: 6px; background: rgba(193, 78, 78, 0.07); font-size: 9px; }
.mailComposer > footer { min-height: 66px; padding: 12px 20px; border-top: 1px solid var(--weather_dialog_line); display: flex; align-items: center; justify-content: flex-end; gap: 7px; }
.is-spinning { animation: mailSpin 0.8s linear infinite; }

.mail-modal-enter-active,
.mail-modal-leave-active { transition: opacity 0.2s ease; }
.mail-modal-enter-active .mailComposer,
.mail-modal-leave-active .mailComposer { transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease; }
.mail-modal-enter-from,
.mail-modal-leave-to { opacity: 0; }
.mail-modal-enter-from .mailComposer,
.mail-modal-leave-to .mailComposer { opacity: 0; transform: translateY(10px) scale(0.985); }

@keyframes mailShimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
@keyframes mailSpin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .mailWorkspace { grid-template-columns: 165px minmax(250px, 0.8fr) minmax(0, 1.15fr); }
  .mailReaderHeader { padding-inline: 16px; }
}

@media (max-width: 800px) {
  .mailPage { width: calc(100% - 18px); margin: 0 9px; }
  .mailWorkspace { height: max(620px, calc(100dvh - 180px)); min-height: 620px; grid-template-columns: minmax(0, 1fr); }
  .mailFolders,
  .mailMessages,
  .mailReader { display: none; border-right: 0; }
  .mailFolders.is-mobile-active,
  .mailMessages.is-mobile-active,
  .mailReader.is-mobile-active { display: flex; }
  .mailMobileBack { display: grid !important; }
  .mailPanelHeader.is-list { display: grid; grid-template-columns: 34px minmax(0, 1fr) 34px; }
  .mailReaderActions { margin-bottom: 8px; }
  .mailFolderList { padding: 10px; }
  .mailFolderList > button { min-height: 48px; }
  .mailMessageList li > button { min-height: 86px; }
}

@media (max-width: 640px) {
  .mailToolbar { min-height: 104px; padding-top: 18px; align-items: flex-start; flex-direction: column; }
  .mailCommands { width: 100%; justify-content: flex-start; }
  .mailCommands .mailAuthButton { margin-left: auto; }
  .mailCommands button { width: 36px; padding: 0; }
  .mailCommands button span { display: none; }
  .mailLoading { grid-template-columns: 1fr; }
  .mailLoading span { min-height: 78px; }
  .mailWorkspace { height: max(600px, calc(100dvh - 194px)); }
  .mailBodyToolbar { align-items: flex-start; flex-direction: column; }
  .mailComposeFields { padding-inline: 14px; }
  .mailComposeFields label { grid-template-columns: 1fr; gap: 6px; }
  .mailComposeFields label.is-body > span { padding-top: 0; }
  .mailComposeFields textarea { min-height: 240px; }
  .mailComposer > header,
  .mailComposer > footer { padding-inline: 14px; }
  .mailFormError { margin-inline: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .mailLoading span,
  .mailPanelLoading span,
  .mailMessageLoading span,
  .mailReaderLoading span,
  .is-spinning { animation: none; }
  .mailCommands button,
  .mailState button,
  .mailPanelState button,
  .mailPagination button,
  .mailComposer footer button,
  .mail-modal-enter-active,
  .mail-modal-leave-active,
  .mail-modal-enter-active .mailComposer,
  .mail-modal-leave-active .mailComposer { transition: none; }
}
</style>
