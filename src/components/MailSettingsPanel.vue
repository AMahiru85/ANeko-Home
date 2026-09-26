<template>
  <section class="mailSettings" aria-labelledby="mail-settings-title">
    <header class="mailSettingsHeader">
      <div>
        <p>MAIL CONNECTION</p>
        <h3 id="mail-settings-title">邮箱设置</h3>
      </div>
      <ShieldCheck :size="21" :stroke-width="1.6" aria-hidden="true" />
    </header>

    <form @submit.prevent="saveConfig">
      <section class="mailIdentitySettings">
        <header>
          <div>
            <p>IDENTITY</p>
            <h4>发件身份</h4>
          </div>
        </header>
        <div class="mailFields is-identity">
          <label class="mailField">
            <span>邮箱地址</span>
            <input v-model.trim="form.address" type="email" autocomplete="email" required placeholder="name@example.com" />
          </label>
          <label class="mailField">
            <span>显示名称</span>
            <input v-model.trim="form.displayName" type="text" autocomplete="name" maxlength="80" />
          </label>
        </div>
      </section>

      <div class="mailProtocolGrid">
        <section class="mailProtocol">
          <header>
            <div class="mailProtocolTitle">
              <Inbox :size="18" :stroke-width="1.7" aria-hidden="true" />
              <span><p>INCOMING</p><h4>IMAP</h4></span>
            </div>
            <span class="mailTlsBadge"><LockKeyhole :size="12" :stroke-width="1.8" aria-hidden="true" />TLS · 993</span>
          </header>
          <div class="mailFields">
            <label class="mailField is-wide">
              <span>服务器</span>
              <input v-model.trim="form.imap.host" type="text" autocomplete="off" required placeholder="imap.example.com" />
            </label>
            <label class="mailField is-wide">
              <span>用户名</span>
              <input v-model.trim="form.imap.username" type="text" autocomplete="username" required />
            </label>
            <label class="mailField is-wide">
              <span>密码</span>
              <div class="mailSecretInput">
                <input
                  v-model="form.imap.password"
                  :type="showImapPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  :disabled="form.imap.clearPassword"
                  :placeholder="form.imap.passwordConfigured ? '留空以保留已保存密码' : '请输入密码'"
                />
                <button type="button" :title="showImapPassword ? '隐藏密码' : '显示密码'" :aria-label="showImapPassword ? '隐藏密码' : '显示密码'" @click="showImapPassword = !showImapPassword">
                  <EyeOff v-if="showImapPassword" :size="15" :stroke-width="1.7" aria-hidden="true" />
                  <Eye v-else :size="15" :stroke-width="1.7" aria-hidden="true" />
                </button>
              </div>
              <span class="mailCredentialState">
                <small>{{ passwordState(form.imap) }}</small>
                <label v-if="form.imap.passwordConfigured"><input v-model="form.imap.clearPassword" type="checkbox" @change="handleClearPassword(form.imap)" />清除密码</label>
              </span>
            </label>
          </div>
          <footer>
            <span :class="testState.imap.kind">{{ testState.imap.message }}</span>
            <button type="button" :disabled="testingTarget !== ''" @click="testConnection('imap')">
              <LoaderCircle v-if="testingTarget === 'imap'" class="is-spinning" :size="14" :stroke-width="1.8" aria-hidden="true" />
              <PlugZap v-else :size="14" :stroke-width="1.8" aria-hidden="true" />
              <span>测试 IMAP</span>
            </button>
          </footer>
        </section>

        <section class="mailProtocol">
          <header>
            <div class="mailProtocolTitle">
              <Send :size="18" :stroke-width="1.7" aria-hidden="true" />
              <span><p>OUTGOING</p><h4>SMTP</h4></span>
            </div>
            <span class="mailTlsBadge"><LockKeyhole :size="12" :stroke-width="1.8" aria-hidden="true" />TLS · 465</span>
          </header>
          <div class="mailFields">
            <label class="mailField is-wide">
              <span>服务器</span>
              <input v-model.trim="form.smtp.host" type="text" autocomplete="off" required placeholder="smtp.example.com" />
            </label>
            <label class="mailField is-wide">
              <span>用户名</span>
              <input v-model.trim="form.smtp.username" type="text" autocomplete="username" required />
            </label>
            <label class="mailField is-wide">
              <span>密码</span>
              <div class="mailSecretInput">
                <input
                  v-model="form.smtp.password"
                  :type="showSmtpPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  :disabled="form.smtp.clearPassword"
                  :placeholder="form.smtp.passwordConfigured ? '留空以保留已保存密码' : '请输入密码'"
                />
                <button type="button" :title="showSmtpPassword ? '隐藏密码' : '显示密码'" :aria-label="showSmtpPassword ? '隐藏密码' : '显示密码'" @click="showSmtpPassword = !showSmtpPassword">
                  <EyeOff v-if="showSmtpPassword" :size="15" :stroke-width="1.7" aria-hidden="true" />
                  <Eye v-else :size="15" :stroke-width="1.7" aria-hidden="true" />
                </button>
              </div>
              <span class="mailCredentialState">
                <small>{{ passwordState(form.smtp) }}</small>
                <label v-if="form.smtp.passwordConfigured"><input v-model="form.smtp.clearPassword" type="checkbox" @change="handleClearPassword(form.smtp)" />清除密码</label>
              </span>
            </label>
          </div>
          <footer>
            <span :class="testState.smtp.kind">{{ testState.smtp.message }}</span>
            <button type="button" :disabled="testingTarget !== ''" @click="testConnection('smtp')">
              <LoaderCircle v-if="testingTarget === 'smtp'" class="is-spinning" :size="14" :stroke-width="1.8" aria-hidden="true" />
              <PlugZap v-else :size="14" :stroke-width="1.8" aria-hidden="true" />
              <span>测试 SMTP</span>
            </button>
          </footer>
        </section>
      </div>

      <section class="mailWebhookSettings">
        <header>
          <div class="mailProtocolTitle">
            <Webhook :size="18" :stroke-width="1.7" aria-hidden="true" />
            <span><p>OUTBOUND WEBHOOK</p><h4>Webhook 发信</h4></span>
          </div>
          <span class="mailWebhookSummary">{{ form.webhook.endpoints.length }} 个接口 · {{ form.webhook.templates.length }} 个模板</span>
        </header>
        <div class="mailWebhookWorkspace">
          <section class="mailWebhookBlock">
            <header class="mailWebhookBlockHeader">
              <div><p>TEMPLATES</p><h5>模板库</h5></div>
              <button type="button" class="mailIconTextButton" title="新增模板" @click="addTemplate">
                <Plus :size="14" :stroke-width="1.8" aria-hidden="true" /><span>新增模板</span>
              </button>
            </header>
            <div class="mailWebhookCards">
              <article v-for="template in form.webhook.templates" :key="template.id" class="mailWebhookCard">
                <header class="mailWebhookCardHeader">
                  <label class="mailWebhookNameField"><span>模板名称</span><input v-model.trim="template.name" type="text" maxlength="100" /></label>
                  <button type="button" class="mailIconButton is-danger" :disabled="template.id === 'default' || form.webhook.templates.length <= 1" title="删除模板" aria-label="删除模板" @click="removeTemplate(template.id)">
                    <Trash2 :size="14" :stroke-width="1.8" aria-hidden="true" />
                  </button>
                </header>
                <div class="mailWebhookIdRow"><span>模板标识</span><code>{{ template.id }}</code></div>
                <label class="mailField"><span>主题模板</span><input v-model="template.subject" type="text" maxlength="998" /></label>
                <label class="mailField"><span>正文模板</span><textarea v-model="template.text" maxlength="200000"></textarea></label>
              </article>
            </div>
            <div class="mailTemplateVariables" aria-label="模板变量">
              <span>变量</span><code v-pre>{{json}}</code><code v-pre>{{timestamp}}</code><code v-pre>{{event}}</code><code v-pre>{{user.name}}</code>
            </div>
          </section>

          <section class="mailWebhookBlock">
            <header class="mailWebhookBlockHeader">
              <div><p>ENDPOINTS</p><h5>Webhook 接口</h5></div>
              <button type="button" class="mailIconTextButton" title="新增接口" @click="addEndpoint">
                <Plus :size="14" :stroke-width="1.8" aria-hidden="true" /><span>新增接口</span>
              </button>
            </header>
            <div class="mailWebhookCards">
              <article v-for="endpoint in form.webhook.endpoints" :key="endpoint.id" class="mailWebhookCard">
                <header class="mailWebhookCardHeader">
                  <label class="mailWebhookNameField"><span>接口名称</span><input v-model.trim="endpoint.name" type="text" maxlength="100" /></label>
                  <label class="mailWebhookToggle"><input v-model="endpoint.enabled" type="checkbox" /><span>{{ endpoint.enabled ? '已启用' : '未启用' }}</span></label>
                  <button type="button" class="mailIconButton is-danger" :disabled="endpoint.id === 'default' || form.webhook.endpoints.length <= 1" title="删除接口" aria-label="删除接口" @click="removeEndpoint(endpoint.id)">
                    <Trash2 :size="14" :stroke-width="1.8" aria-hidden="true" />
                  </button>
                </header>
                <div class="mailWebhookControlGrid">
                  <div class="mailField"><span>接口标识</span><code class="mailWebhookIdValue">{{ endpoint.id }}</code></div>
                  <label class="mailField"><span>使用模板</span><select v-model="endpoint.templateId"><option v-for="template in form.webhook.templates" :key="template.id" :value="template.id">{{ template.name }}</option></select></label>
                  <label class="mailField is-wide"><span>接口地址</span><div class="mailWebhookUrl"><input :value="webhookUrl(endpoint.id)" type="text" readonly /><button type="button" class="mailIconButton" title="复制接口地址" aria-label="复制接口地址" @click="copyWebhookEndpoint(endpoint.id)"><Copy :size="14" :stroke-width="1.8" aria-hidden="true" /></button></div></label>
                  <label class="mailField is-wide"><span>Bearer Token</span><div class="mailWebhookTokenInput"><input v-model="endpoint.token" :type="webhookTokenType(endpoint.id)" maxlength="256" autocomplete="new-password" :disabled="endpoint.clearToken" :placeholder="endpoint.tokenConfigured ? '留空以保留已保存 Token' : '生成或输入至少 32 个字符'" /><button type="button" class="mailIconButton" :title="webhookTokenType(endpoint.id) === 'password' ? '显示 Token' : '隐藏 Token'" :aria-label="webhookTokenType(endpoint.id) === 'password' ? '显示 Token' : '隐藏 Token'" @click="toggleWebhookToken(endpoint.id)"><Eye v-if="webhookTokenType(endpoint.id) === 'password'" :size="14" :stroke-width="1.8" aria-hidden="true" /><EyeOff v-else :size="14" :stroke-width="1.8" aria-hidden="true" /></button><button type="button" class="mailIconButton" :disabled="!endpoint.token" title="复制 Token" aria-label="复制 Token" @click="copyWebhookToken(endpoint.id)"><Copy :size="14" :stroke-width="1.8" aria-hidden="true" /></button><button type="button" class="mailIconButton" title="生成新 Token" aria-label="生成新 Token" @click="generateWebhookToken(endpoint)"><RefreshCw :size="14" :stroke-width="1.8" aria-hidden="true" /></button></div><span class="mailCredentialState"><small>{{ webhookTokenState(endpoint) }}</small><label v-if="endpoint.tokenConfigured"><input v-model="endpoint.clearToken" type="checkbox" @change="handleClearWebhookToken(endpoint)" />清除 Token</label></span></label>
                  <label class="mailField"><span>固定收件人</span><input v-model.trim="endpoint.to" type="text" autocomplete="off" placeholder="name@example.com" /></label>
                  <label class="mailField"><span>固定抄送</span><input v-model.trim="endpoint.cc" type="text" autocomplete="off" placeholder="多个地址用逗号分隔" /></label>
                </div>
              </article>
            </div>
          </section>
        </div>
      </section>

      <p v-if="formError" class="mailSettingsError" role="alert">{{ formError }}</p>
      <footer class="mailSettingsFooter">
        <span v-if="config?.updatedAt">更新于 {{ formatDate(config.updatedAt) }}</span>
        <span v-else>尚未保存配置</span>
        <div>
          <button v-if="config?.configured" type="button" :disabled="saving" @click="emit('cancel')">取消</button>
          <button class="is-primary" type="submit" :disabled="saving || testingTarget !== ''">
            <LoaderCircle v-if="saving" class="is-spinning" :size="15" :stroke-width="1.8" aria-hidden="true" />
            <Save v-else :size="15" :stroke-width="1.8" aria-hidden="true" />
            <span>{{ saving ? '保存中' : '保存设置' }}</span>
          </button>
        </div>
      </footer>
    </form>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Copy, Eye, EyeOff, Inbox, LoaderCircle, LockKeyhole, PlugZap, Plus, RefreshCw, Save, Send, ShieldCheck, Trash2, Webhook } from '@lucide/vue'
import { ApiRequestError, apiRequest } from '../utils/admin-client'

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
  webhook: MailWebhookConfig
}

interface MailWebhookConfig {
  revision: string | null
  updatedAt: string | null
  templates: MailWebhookTemplate[]
  endpoints: MailWebhookEndpoint[]
}
interface MailWebhookTemplate { id: string; name: string; subject: string; text: string }
interface MailWebhookEndpoint { id: string; name: string; enabled: boolean; tokenConfigured: boolean; to: string[]; cc: string[]; templateId: string }

interface EditableWebhookEndpoint {
  id: string
  name: string
  enabled: boolean
  tokenConfigured: boolean
  templateId: string
  token: string
  clearToken: boolean
  to: string
  cc: string
}

interface EditableProtocol extends MailProtocolConfig {
  password: string
  clearPassword: boolean
}

interface ConfigForm {
  address: string
  displayName: string
  imap: EditableProtocol
  smtp: EditableProtocol
  webhook: EditableWebhook
}

interface EditableWebhook {
  templates: MailWebhookTemplate[]
  endpoints: EditableWebhookEndpoint[]
}

interface ProtocolPayload {
  host: string
  port: number
  username: string
  password?: string | null
}

type TestTarget = 'imap' | 'smtp'

const mailSettingsDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})

const props = defineProps<{
  config: MailConfig | null
  accessCode: string
}>()

const emit = defineEmits<{
  saved: [config: MailConfig]
  updated: [config: MailConfig]
  cancel: []
  notice: [message: string, kind?: 'success' | 'error']
  unauthorized: []
}>()

const form = reactive<ConfigForm>(emptyForm())
const saving = ref(false)
const formError = ref('')
const showImapPassword = ref(false)
const showSmtpPassword = ref(false)
const showWebhookTokens = reactive<Record<string, boolean>>({})
const testingTarget = ref<TestTarget | ''>('')
const testState = reactive<Record<TestTarget, { kind: '' | 'success' | 'error'; message: string }>>({
  imap: { kind: '', message: '' },
  smtp: { kind: '', message: '' },
})
let latestMailConfig: Omit<MailConfig, 'webhook'> | null = null
let latestWebhookConfig: MailWebhookConfig | null = null
let skipNextPropHydrate = false

function protocolDefaults(port: number): EditableProtocol {
  return { host: '', port, username: '', passwordConfigured: false, password: '', clearPassword: false }
}

function emptyForm(): ConfigForm {
  return {
    address: '',
    displayName: '',
    imap: protocolDefaults(993),
    smtp: protocolDefaults(465),
    webhook: {
      templates: [{ id: 'default', name: '默认模板', subject: 'Webhook notification', text: '{{json}}' }],
      endpoints: [{ id: 'default', name: '默认接口', enabled: false, tokenConfigured: false, token: '', clearToken: false, to: '', cc: '', templateId: 'default' }],
    },
  }
}

function hydrate(value: MailConfig | null) {
  latestMailConfig = value
  form.address = value?.address || ''
  form.displayName = value?.displayName || ''
  Object.assign(form.imap, protocolDefaults(993), value?.imap || {}, { port: 993, password: '', clearPassword: false })
  Object.assign(form.smtp, protocolDefaults(465), value?.smtp || {}, { port: 465, password: '', clearPassword: false })
  hydrateWebhook(value?.webhook || null)
  formError.value = ''
  testState.imap = { kind: '', message: '' }
  testState.smtp = { kind: '', message: '' }
}

function hydrateWebhook(value: MailWebhookConfig | null) {
  latestWebhookConfig = value
  form.webhook.templates = (value?.templates || []).map((item) => ({ ...item }))
  form.webhook.endpoints = (value?.endpoints || []).map((item) => ({
    ...item,
    token: '',
    clearToken: false,
    to: item.to.join(', '),
    cc: item.cc.join(', '),
  }))
  if (!form.webhook.templates.length) form.webhook.templates = emptyForm().webhook.templates
  if (!form.webhook.endpoints.length) form.webhook.endpoints = emptyForm().webhook.endpoints
  for (const id of Object.keys(showWebhookTokens)) {
    if (!form.webhook.endpoints.some((endpoint) => endpoint.id === id)) delete showWebhookTokens[id]
  }
}

function authHeaders() {
  return { 'X-Access-Code': props.accessCode, 'Content-Type': 'application/json' }
}

function passwordState(protocol: EditableProtocol) {
  if (protocol.clearPassword) return '保存后清除密码'
  if (protocol.password) return protocol.passwordConfigured ? '将更新已保存密码' : '将保存新密码'
  return protocol.passwordConfigured ? '密码已保存' : '尚未设置密码'
}

function handleClearPassword(protocol: EditableProtocol) {
  if (protocol.clearPassword) protocol.password = ''
}

function webhookPath(id: string) {
  return id === 'default' ? '/api/mail/webhook' : `/api/mail/webhook/${encodeURIComponent(id)}`
}

function webhookUrl(id: string) {
  return webhookPath(id)
}

function uniqueId(prefix: string, values: Array<{ id: string }>, reserved: Array<{ id: string }> = []) {
  const ids = new Set([...values, ...reserved].map((item) => item.id))
  let index = 1
  let id = prefix
  while (ids.has(id)) id = `${prefix}-${index++}`
  return id
}

function generateWebhookToken(endpoint: EditableWebhookEndpoint) {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  endpoint.token = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  endpoint.clearToken = false
  showWebhookTokens[endpoint.id] = true
}

function webhookTokenType(id: string) { return showWebhookTokens[id] ? 'text' : 'password' }

function toggleWebhookToken(id: string) { showWebhookTokens[id] = !showWebhookTokens[id] }

function handleClearWebhookToken(endpoint: EditableWebhookEndpoint) {
  if (endpoint.clearToken) endpoint.token = ''
}

function webhookTokenState(endpoint: EditableWebhookEndpoint) {
  if (endpoint.clearToken) return '保存后清除 Token'
  if (endpoint.token) return endpoint.tokenConfigured ? '将轮换已保存 Token' : '将保存新 Token'
  return endpoint.tokenConfigured ? 'Token 已保存' : '尚未设置 Token'
}

async function copyWebhookEndpoint(id = 'default') {
  const endpoint = new URL(webhookPath(id), window.location.origin).toString()
  try {
    await navigator.clipboard.writeText(endpoint)
    emit('notice', 'Webhook 地址已复制')
  } catch {
    emit('notice', endpoint)
  }
}

async function copyWebhookToken(id: string) {
  const token = form.webhook.endpoints.find((endpoint) => endpoint.id === id)?.token
  if (!token) return
  try {
    await navigator.clipboard.writeText(token)
    emit('notice', 'Webhook Token 已复制')
  } catch {
    emit('notice', '无法访问剪贴板，请手动复制', 'error')
  }
}

function validateProtocol(label: string, protocol: EditableProtocol, allowClear = false) {
  if (!protocol.host.trim()) throw new Error(`请填写 ${label} 服务器`)
  if (!protocol.username.trim()) throw new Error(`请填写 ${label} 用户名`)
  if (protocol.clearPassword && !allowClear) throw new Error(`${label} 密码将被清除，无法测试连接`)
  if (!protocol.clearPassword && !protocol.passwordConfigured && !protocol.password) throw new Error(`请填写 ${label} 密码`)
}

function validateForm() {
  if (!form.address.trim()) throw new Error('请填写邮箱地址')
  if (!/^\S+@\S+\.\S+$/.test(form.address.trim())) throw new Error('邮箱地址格式不正确')
  validateProtocol('IMAP', form.imap, true)
  validateProtocol('SMTP', form.smtp, true)
  if (form.imap.clearPassword !== form.smtp.clearPassword) {
    throw new Error('清除配置时请同时清除 IMAP 和 SMTP 密码')
  }
  if (!form.webhook.templates.length) throw new Error('请至少保留一个模板')
  const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
  const templateIds = new Set<string>()
  for (const item of form.webhook.templates) {
    if (!idPattern.test(item.id) || templateIds.has(item.id)) throw new Error('模板标识必须唯一且只含英文字母、数字、点、下划线或连字符')
    if (!item.name.trim() || item.name.length > 100 || !item.subject.trim() || item.subject.length > 998 || /[\u0000-\u001f\u007f]/u.test(item.subject)) {
      throw new Error('模板名称或主题模板无效')
    }
    if (!item.text.trim() || item.text.length > 200000) throw new Error('模板正文无效')
    templateIds.add(item.id)
  }
  if (!form.webhook.endpoints.length) throw new Error('请至少保留一个接口')
  const endpointIds = new Set<string>()
  for (const item of form.webhook.endpoints) {
    if (!idPattern.test(item.id) || endpointIds.has(item.id)) throw new Error('接口标识必须唯一且只含英文字母、数字、点、下划线或连字符')
    if (!item.name.trim() || item.name.length > 100 || !templateIds.has(item.templateId)) throw new Error('接口名称或模板选择无效')
    const recipients = parseRecipients(item.to)
    const cc = parseRecipients(item.cc)
    if (recipients.length + cc.length > 20) throw new Error(`接口“${item.name}”的收件人和抄送不能超过 20 个`)
    if (item.enabled && (!recipients.length || (item.clearToken || (!item.tokenConfigured && !item.token)))) {
      throw new Error(`启用接口“${item.name}”前请填写收件人并设置 Token`)
    }
    if (item.token && (item.token.length < 32 || item.token.length > 256 || !/^[A-Za-z0-9._~-]+$/.test(item.token))) {
      throw new Error(`接口“${item.name}”的 Token 需为 32–256 个英文字母、数字、点、下划线、波浪号或连字符`)
    }
    endpointIds.add(item.id)
  }
}

function parseRecipients(value: string) {
  return [...new Set(value.split(/[;,\n]/).map((item) => item.trim().toLowerCase()).filter(Boolean))]
}

function protocolPayload(protocol: EditableProtocol): ProtocolPayload {
  const result: ProtocolPayload = {
    host: protocol.host.trim(),
    port: protocol.port,
    username: protocol.username.trim(),
  }
  if (protocol.clearPassword) result.password = null
  else if (protocol.password) result.password = protocol.password
  return result
}

function configPayload(includeRevision = true) {
  return {
    ...(includeRevision ? { revision: latestMailConfig?.revision ?? null } : {}),
    address: form.address.trim(),
    displayName: form.displayName.trim(),
    imap: protocolPayload(form.imap),
    smtp: protocolPayload(form.smtp),
  }
}

function webhookPayload() {
  return {
    revision: latestWebhookConfig?.revision ?? null,
    templates: form.webhook.templates.map((item) => ({
      id: item.id,
      name: item.name.trim(),
      subject: item.subject,
      text: item.text,
    })),
    endpoints: form.webhook.endpoints.map((item) => ({
      id: item.id,
      name: item.name.trim(),
      enabled: item.enabled,
      to: parseRecipients(item.to),
      cc: parseRecipients(item.cc),
      templateId: item.templateId,
      ...(item.clearToken || (!item.tokenConfigured && !item.token)
        ? { token: null }
        : item.token ? { token: item.token } : {}),
    })),
  }
}

async function testConnection(target: TestTarget) {
  formError.value = ''
  testState[target] = { kind: '', message: '' }
  try {
    if (!form.address.trim()) throw new Error('请填写邮箱地址')
    if (!/^\S+@\S+\.\S+$/.test(form.address.trim())) throw new Error('邮箱地址格式不正确')
    validateProtocol(target.toUpperCase(), form[target])
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '请检查连接设置'
    return
  }
  testingTarget.value = target
  try {
    await apiRequest<{ target: TestTarget; ok: boolean }>('/api/admin/mail/test', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ target, config: configPayload(false) }),
    })
    testState[target] = { kind: 'success', message: '连接成功' }
  } catch (error) {
    testState[target] = { kind: 'error', message: requestError(error, '连接失败') }
  } finally {
    testingTarget.value = ''
  }
}

async function saveConfig() {
  formError.value = ''
  try {
    validateForm()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '请检查邮箱设置'
    return
  }
  saving.value = true
  const [mailResult, webhookResult] = await Promise.allSettled([
    apiRequest<Omit<MailConfig, 'webhook'>>('/api/admin/mail/config', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(configPayload()),
    }),
    apiRequest<MailWebhookConfig>('/api/admin/mail/webhook', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(webhookPayload()),
    }),
  ])

  if (mailResult.status === 'fulfilled') {
    latestMailConfig = mailResult.value
    Object.assign(form.imap, mailResult.value.imap, { password: '', clearPassword: false })
    Object.assign(form.smtp, mailResult.value.smtp, { password: '', clearPassword: false })
  }
  if (webhookResult.status === 'fulfilled') {
    hydrateWebhook(webhookResult.value)
  }

  const failures: string[] = []
  const rejectedReasons = [mailResult, webhookResult]
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason)
  if (rejectedReasons.some((error) => error instanceof ApiRequestError && error.status === 401)) emit('unauthorized')
  if (mailResult.status === 'rejected') failures.push(`邮箱配置保存失败：${requestError(mailResult.reason, '未知错误', false)}`)
  if (webhookResult.status === 'rejected') failures.push(`Webhook 保存失败：${requestError(webhookResult.reason, '未知错误', false)}`)

  if (failures.length) {
    if ((mailResult.status === 'fulfilled' || webhookResult.status === 'fulfilled') && latestMailConfig) {
      skipNextPropHydrate = true
      emit('updated', {
        ...latestMailConfig,
        webhook: latestWebhookConfig || emptyWebhookConfig(),
      })
    }
    const successes = [
      mailResult.status === 'fulfilled' ? '邮箱配置已保存' : '',
      webhookResult.status === 'fulfilled' ? 'Webhook 已保存' : '',
    ].filter(Boolean)
    formError.value = [...successes, ...failures].join('；')
    emit('notice', formError.value, 'error')
  } else if (mailResult.status === 'fulfilled' && webhookResult.status === 'fulfilled') {
    const combined = { ...mailResult.value, webhook: webhookResult.value }
    hydrate(combined)
    emit('saved', combined)
    emit('notice', '邮箱和 Webhook 设置已保存')
  }
  saving.value = false
}

function emptyWebhookConfig(): MailWebhookConfig {
  return {
    revision: null,
    updatedAt: null,
    templates: [{ id: 'default', name: '默认模板', subject: 'Webhook notification', text: '{{json}}' }],
    endpoints: [{ id: 'default', name: '默认接口', enabled: false, tokenConfigured: false, to: [], cc: [], templateId: 'default' }],
  }
}

function addTemplate() {
  const id = uniqueId('template', form.webhook.templates, latestWebhookConfig?.templates)
  form.webhook.templates.push({ id, name: '新模板', subject: 'Webhook notification', text: '{{json}}' })
}

function removeTemplate(id: string) {
  if (id === 'default' || form.webhook.templates.length <= 1) return
  form.webhook.templates = form.webhook.templates.filter((item) => item.id !== id)
  const fallback = form.webhook.templates[0]?.id
  if (fallback) {
    form.webhook.endpoints.forEach((item) => {
      if (item.templateId === id) item.templateId = fallback
    })
  }
}

function addEndpoint() {
  const id = uniqueId('endpoint', form.webhook.endpoints, latestWebhookConfig?.endpoints)
  const templateId = form.webhook.templates[0]?.id || 'default'
  form.webhook.endpoints.push({
    id,
    name: '新接口',
    enabled: false,
    tokenConfigured: false,
    token: '',
    clearToken: false,
    to: '',
    cc: '',
    templateId,
  })
}

function removeEndpoint(id: string) {
  if (id === 'default' || form.webhook.endpoints.length <= 1) return
  delete showWebhookTokens[id]
  form.webhook.endpoints = form.webhook.endpoints.filter((item) => item.id !== id)
}

function requestError(error: unknown, fallback: string, notifyUnauthorized = true) {
  if (error instanceof ApiRequestError && error.status === 401) {
    if (notifyUnauthorized) emit('unauthorized')
    return '管理员会话已失效，请重新登录'
  }
  return error instanceof Error ? error.message : fallback
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return mailSettingsDateFormatter.format(date)
}

watch(() => props.config, (value) => {
  if (skipNextPropHydrate) {
    skipNextPropHydrate = false
    return
  }
  hydrate(value)
}, { immediate: true })
</script>

<style scoped>
.mailSettings { border-bottom: 1px solid var(--module_dock_border); }
.mailSettingsHeader { min-height: 88px; padding: 18px 2px; border-bottom: 1px solid var(--module_dock_border); display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
.mailSettingsHeader p,
.mailIdentitySettings header p,
.mailProtocolTitle p { margin: 0; font-size: 9px; font-weight: 600; line-height: 13px; opacity: 0.5; }
.mailSettingsHeader h3 { margin: 4px 0 0; font-size: 20px; line-height: 27px; }
.mailSettingsHeader > svg { margin-bottom: 4px; opacity: 0.62; }
.mailIdentitySettings { padding: 22px 2px 26px; border-bottom: 1px solid var(--module_dock_border); }
.mailIdentitySettings h4,
.mailProtocol h4 { margin: 3px 0 0; font-size: 14px; line-height: 20px; }
.mailProtocolGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mailProtocol { min-width: 0; padding: 24px 20px 20px; border-bottom: 1px solid var(--module_dock_border); }
.mailProtocol:first-child { border-right: 1px solid var(--module_dock_border); }
.mailProtocol > header { min-height: 40px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.mailProtocolTitle { min-width: 0; display: flex; align-items: center; gap: 10px; }
.mailProtocolTitle > span { min-width: 0; }
.mailProtocolTitle > svg { opacity: 0.62; }
.mailTlsBadge { min-height: 24px; padding: 0 7px; border: 1px solid rgba(82, 139, 109, 0.38); border-radius: 4px; display: inline-flex; align-items: center; gap: 5px; color: #5a9d76; font-size: 8px; white-space: nowrap; }
.mailFields { margin-top: 18px; display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: 14px; }
.mailFields.is-identity { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mailField { min-width: 0; display: grid; gap: 7px; }
.mailField.is-wide { grid-column: 1 / -1; }
.mailField > span:first-child { color: var(--weather_dialog_muted); font-size: 9px; line-height: 13px; }
.mailField input { width: 100%; height: 42px; padding: 0 11px; border: 1px solid var(--weather_dialog_line_strong); border-radius: 6px; outline: 0; color: inherit; background: var(--weather_dialog_control_bg); font: inherit; font-size: 11px; user-select: text; }
.mailField textarea { width: 100%; min-height: 146px; padding: 11px; border: 1px solid var(--weather_dialog_line_strong); border-radius: 6px; outline: 0; resize: vertical; color: inherit; background: var(--weather_dialog_control_bg); font: 11px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; user-select: text; }
.mailField input:focus { border-color: var(--weather_dialog_focus); }
.mailField textarea:focus { border-color: var(--weather_dialog_focus); }
.mailField input:disabled { opacity: 0.42; }
.mailField input::placeholder { color: var(--weather_dialog_faint); }
.mailSecretInput { display: grid; grid-template-columns: minmax(0, 1fr) 42px; }
.mailSecretInput input { border-radius: 6px 0 0 6px; }
.mailSecretInput button { width: 42px; height: 42px; padding: 0; border: 1px solid var(--weather_dialog_line_strong); border-left: 0; border-radius: 0 6px 6px 0; display: grid; place-items: center; color: inherit; background: var(--weather_dialog_control_bg); cursor: pointer; }
.mailSecretInput button:hover { background: var(--weather_dialog_control_hover); }
.mailWebhookSettings { padding: 24px 2px 22px; border-bottom: 1px solid var(--module_dock_border); }
.mailWebhookSettings > header { min-height: 40px; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.mailWebhookSettings h4 { margin: 3px 0 0; font-size: 14px; line-height: 20px; }
.mailWebhookSummary { color: var(--weather_dialog_muted); font-size: 9px; line-height: 20px; }
.mailWebhookWorkspace { margin-top: 20px; display: grid; gap: 22px; }
.mailWebhookBlock { min-width: 0; padding-top: 18px; border-top: 1px solid var(--module_dock_border); }
.mailWebhookBlockHeader { min-height: 34px; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.mailWebhookBlockHeader p { margin: 0; color: var(--weather_dialog_muted); font-size: 9px; line-height: 13px; }
.mailWebhookBlockHeader h5 { margin: 3px 0 0; font-size: 13px; line-height: 18px; }
.mailIconTextButton { min-height: 30px; padding: 0 9px; border: 1px solid var(--module_dock_border); border-radius: 5px; display: inline-flex; align-items: center; gap: 5px; color: inherit; background: var(--item_bg_color); font: inherit; font-size: 9px; cursor: pointer; }
.mailIconTextButton:hover { border-color: var(--module_dock_active_border); background: var(--item_hover_color); }
.mailWebhookCards { margin-top: 14px; display: grid; gap: 12px; }
.mailWebhookCard { min-width: 0; padding: 14px; border: 1px solid var(--module_dock_border); border-radius: 6px; background: var(--item_bg_color); }
.mailWebhookCardHeader { min-height: 36px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: end; gap: 10px; }
.mailWebhookNameField { min-width: 0; display: grid; gap: 6px; }
.mailWebhookNameField > span,
.mailWebhookIdRow > span { color: var(--weather_dialog_muted); font-size: 8px; line-height: 12px; }
.mailWebhookNameField input { width: 100%; height: 36px; padding: 0 9px; border: 1px solid var(--weather_dialog_line_strong); border-radius: 5px; outline: 0; color: inherit; background: var(--weather_dialog_control_bg); font: inherit; font-size: 11px; }
.mailWebhookNameField input:focus { border-color: var(--weather_dialog_focus); }
.mailIconButton { width: 34px; height: 36px; padding: 0; border: 1px solid var(--weather_dialog_line_strong); border-radius: 5px; display: inline-grid; place-items: center; color: inherit; background: var(--weather_dialog_control_bg); cursor: pointer; }
.mailIconButton:hover { background: var(--weather_dialog_control_hover); }
.mailIconButton:disabled { opacity: 0.35; pointer-events: none; }
.mailIconButton.is-danger { color: #c85858; }
.mailWebhookIdRow { min-height: 25px; margin: 9px 0 12px; display: flex; align-items: center; gap: 8px; }
.mailWebhookIdRow code,
.mailWebhookIdValue { min-width: 0; padding: 3px 6px; border: 1px solid var(--module_dock_border); border-radius: 4px; color: var(--weather_dialog_muted); background: var(--weather_dialog_control_bg); font: 9px ui-monospace, SFMono-Regular, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mailWebhookControlGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.mailWebhookControlGrid select { width: 100%; height: 42px; padding: 0 9px; border: 1px solid var(--weather_dialog_line_strong); border-radius: 6px; outline: 0; color: inherit; background: var(--weather_dialog_control_bg); font: inherit; font-size: 11px; }
.mailWebhookControlGrid select:focus { border-color: var(--weather_dialog_focus); }
.mailWebhookUrl { display: grid; grid-template-columns: minmax(0, 1fr) 34px; }
.mailWebhookUrl input { min-width: 0; border-radius: 6px 0 0 6px; font: 9px ui-monospace, SFMono-Regular, Consolas, monospace; }
.mailWebhookUrl .mailIconButton { height: 42px; border-left: 0; border-radius: 0 6px 6px 0; }
.mailWebhookTokenInput { display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, 34px); }
.mailWebhookTokenInput input { min-width: 0; border-radius: 6px 0 0 6px; }
.mailWebhookTokenInput .mailIconButton { height: 42px; border-left: 0; border-radius: 0; }
.mailWebhookTokenInput .mailIconButton:last-child { border-radius: 0 6px 6px 0; }
.mailWebhookControlGrid .mailField textarea { min-height: 122px; }
.mailWebhookCard .mailCredentialState { margin-top: 5px; }
.mailWebhookCard .mailCredentialState label { white-space: nowrap; }
.mailWebhookToggle { min-height: 32px; padding: 0 9px; border: 1px solid var(--module_dock_border); border-radius: 6px; display: inline-flex; align-items: center; gap: 7px; font-size: 9px; cursor: pointer; }
.mailWebhookToggle input { width: 15px; height: 15px; margin: 0; accent-color: var(--weather_dialog_active_bg); }
.mailTemplateVariables { margin-top: 14px; display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.mailTemplateVariables > span { margin-right: 2px; color: var(--weather_dialog_muted); font-size: 8px; }
.mailTemplateVariables code { padding: 4px 6px; border: 1px solid var(--module_dock_border); border-radius: 4px; background: var(--item_bg_color); font-size: 8px; }
.mailCredentialState { min-height: 18px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mailCredentialState small { font-size: 8px; opacity: 0.45; }
.mailCredentialState label { display: inline-flex; align-items: center; gap: 5px; font-size: 8px; cursor: pointer; }
.mailCredentialState input { width: 14px; height: 14px; padding: 0; accent-color: var(--weather_dialog_active_bg); }
.mailProtocol > footer { min-height: 52px; margin-top: 17px; border-top: 1px solid var(--module_dock_border); display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.mailProtocol > footer > span { font-size: 8px; opacity: 0.5; }
.mailProtocol > footer > span.success { color: #5a9d76; opacity: 1; }
.mailProtocol > footer > span.error,
.mailSettingsError { color: #c85858; opacity: 1; }
.mailProtocol > footer button,
.mailSettingsFooter button { min-height: 36px; padding: 0 11px; border: 1px solid var(--module_dock_border); border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: inherit; background: var(--item_bg_color); font: inherit; font-size: 10px; cursor: pointer; }
.mailProtocol > footer button:hover,
.mailSettingsFooter button:hover { border-color: var(--module_dock_active_border); background: var(--item_hover_color); }
.mailProtocol > footer button:disabled,
.mailSettingsFooter button:disabled { opacity: 0.35; pointer-events: none; }
.mailSettingsError { margin: 14px 2px 0; padding: 10px 12px; border: 1px solid rgba(193, 78, 78, 0.26); border-radius: 6px; background: rgba(193, 78, 78, 0.07); font-size: 9px; }
.mailSettingsFooter { min-height: 76px; padding: 14px 2px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.mailSettingsFooter > span { font-size: 8px; opacity: 0.44; }
.mailSettingsFooter > div { display: flex; align-items: center; gap: 7px; }
.mailSettingsFooter button.is-primary { border-color: var(--weather_dialog_active_bg); color: var(--weather_dialog_active_text); background: var(--weather_dialog_active_bg); }
.is-spinning { animation: mailSettingsSpin 0.8s linear infinite; }
@keyframes mailSettingsSpin { to { transform: rotate(360deg); } }

@media (max-width: 800px) {
  .mailProtocol { padding-inline: 14px; }
}

@media (max-width: 680px) {
  .mailProtocolGrid,
  .mailFields.is-identity,
  .mailWebhookControlGrid { grid-template-columns: 1fr; }
  .mailProtocol:first-child { border-right: 0; }
}

@media (max-width: 640px) {
  .mailIdentitySettings { padding-inline: 0; }
  .mailProtocol { padding-inline: 0; }
  .mailWebhookSettings { padding-inline: 0; }
  .mailWebhookCard { padding-inline: 10px; }
  .mailWebhookCardHeader { grid-template-columns: minmax(0, 1fr) auto; }
  .mailWebhookCardHeader .mailIconButton { grid-column: 2; grid-row: 1; }
  .mailWebhookCardHeader .mailWebhookToggle { grid-column: 1 / -1; grid-row: 2; justify-self: start; }
  .mailProtocol > header { align-items: flex-start; }
  .mailFields { grid-template-columns: 1fr; }
  .mailField.is-wide { grid-column: auto; }
  .mailCredentialState { align-items: flex-start; flex-direction: column; }
  .mailProtocol > footer { align-items: flex-start; flex-direction: column; padding-top: 12px; }
  .mailProtocol > footer button { width: 100%; }
  .mailSettingsFooter { align-items: stretch; flex-direction: column; }
  .mailSettingsFooter > div { width: 100%; }
  .mailSettingsFooter button { flex: 1 1 0; }
}

@media (prefers-reduced-motion: reduce) {
  .is-spinning { animation: none; }
}
</style>
