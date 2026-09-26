<template>
  <Teleport v-if="isMounted" to="body">
    <Transition name="admin-dialog">
      <div
        v-if="open"
        class="adminDialogBackdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-login-title"
        @mousedown.self="close"
      >
        <form class="adminDialog" @submit.prevent="submit">
          <header>
            <div>
              <p>ADMIN ACCESS</p>
              <h3 id="admin-login-title">管理员登录</h3>
            </div>
            <button type="button" title="关闭" aria-label="关闭" @click="close">
              <X :size="18" :stroke-width="1.8" aria-hidden="true" />
            </button>
          </header>

          <label for="admin-access-code">访问码</label>
          <div class="adminInputWrap">
            <LockKeyhole :size="17" :stroke-width="1.7" aria-hidden="true" />
            <input
              id="admin-access-code"
              ref="input"
              v-model="code"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>
          <TurnstileWidget
            :key="turnstileKey"
            :site-key="TURNSTILE_SITE_KEY"
            action="admin_login"
            @token="handleTurnstileToken"
            @expired="handleTurnstileExpired"
            @error="handleTurnstileError"
          />
          <p v-if="error" class="adminFormError">{{ error }}</p>
          <button class="adminPrimaryButton" type="submit" :disabled="submitting">
            {{ submitting ? '验证中' : '登录' }}
          </button>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { LockKeyhole, X } from '@lucide/vue'
import { storeAdminAccess, verifyAdminAccess as verifyAdminAccessRequest } from '../utils/admin-client'
import TurnstileWidget from './TurnstileWidget.vue'
import { TURNSTILE_SITE_KEY } from '../utils/turnstile-client'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  close: []
  authenticated: [code: string]
}>()

const code = ref('')
const error = ref('')
const submitting = ref(false)
const input = ref<HTMLInputElement | null>(null)
const isMounted = ref(false)
const turnstileToken = ref('')
const turnstileKey = ref(0)

onMounted(async () => {
  isMounted.value = true
  if (props.open) {
    await nextTick()
    input.value?.focus()
  }
})

watch(() => props.open, async (open) => {
  if (!open) return
  code.value = ''
  error.value = ''
  turnstileToken.value = ''
  turnstileKey.value += 1
  await nextTick()
  input.value?.focus()
})

function close() {
  if (!submitting.value) emit('close')
}

function handleTurnstileToken(token: string) {
  turnstileToken.value = token
  error.value = ''
}

function handleTurnstileExpired() {
  turnstileToken.value = ''
  error.value = '安全验证已过期，请重新验证'
}

function handleTurnstileError() {
  turnstileToken.value = ''
  error.value = '安全验证加载失败，请刷新后重试'
}

async function verifyAdminAccess(codeValue: string) {
  const token = turnstileToken.value
  if (!token) throw new Error('请完成安全验证')
  turnstileToken.value = ''
  turnstileKey.value += 1
  return verifyAdminAccessRequest(codeValue, token)
}

async function submit() {
  submitting.value = true
  error.value = ''

  try {
    if (!await verifyAdminAccess(code.value)) throw new Error('访问码不正确')
    storeAdminAccess(code.value)
    emit('authenticated', code.value)
  } catch (nextError) {
    error.value = nextError instanceof Error ? nextError.message : '登录失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.adminDialogBackdrop {
  position: fixed;
  inset: 0;
  z-index: 100000;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--weather_dialog_backdrop);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.adminDialog {
  width: min(420px, 100%);
  padding: 20px;
  border: 1px solid var(--weather_dialog_border);
  border-radius: 8px;
  color: var(--weather_dialog_text);
  background: var(--weather_dialog_bg);
  box-shadow: 0 24px 70px -34px var(--weather_dialog_shadow), inset 0 1px 0 var(--weather_dialog_inset);
}

.adminDialog header {
  min-height: 56px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--weather_dialog_line);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.adminDialog header p {
  margin: 0;
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  opacity: 0.5;
}

.adminDialog h3 {
  margin: 3px 0 0;
  font-size: 18px;
  line-height: 24px;
}

.adminDialog header button {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  display: grid;
  place-items: center;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.adminDialog header button:hover {
  border-color: var(--weather_dialog_line);
  background: var(--weather_dialog_control_hover);
}

.adminDialog label {
  margin-bottom: 7px;
  display: block;
  color: var(--weather_dialog_muted);
  font-size: 9px;
  line-height: 13px;
}

.adminInputWrap {
  height: 46px;
  border: 1px solid var(--weather_dialog_line_strong);
  border-radius: 6px;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  background: var(--weather_dialog_control_bg);
}

.adminInputWrap svg {
  justify-self: end;
  margin-right: 8px;
  color: var(--weather_dialog_subtle);
}

.adminInputWrap input {
  width: 100%;
  height: 100%;
  padding-right: 12px;
  border: 0;
  outline: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: 12px;
}

.adminFormError {
  margin: 8px 0 0;
  color: #b14646;
  font-size: 9px;
  line-height: 14px;
}

.adminPrimaryButton {
  width: 100%;
  min-height: 40px;
  margin-top: 18px;
  padding: 0 14px;
  border: 1px solid var(--weather_dialog_active_bg);
  border-radius: 6px;
  color: var(--weather_dialog_active_text);
  background: var(--weather_dialog_active_bg);
  font-size: 10px;
  cursor: pointer;
}

.adminPrimaryButton:disabled { opacity: 0.5; }

.admin-dialog-enter-active,
.admin-dialog-leave-active { transition: opacity 0.22s ease; }
.admin-dialog-enter-active .adminDialog,
.admin-dialog-leave-active .adminDialog { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease; }
.admin-dialog-enter-from,
.admin-dialog-leave-to { opacity: 0; }
.admin-dialog-enter-from .adminDialog,
.admin-dialog-leave-to .adminDialog { opacity: 0; transform: translateY(10px) scale(0.98); }

@media (prefers-reduced-motion: reduce) {
  .admin-dialog-enter-active,
  .admin-dialog-leave-active,
  .admin-dialog-enter-active .adminDialog,
  .admin-dialog-leave-active .adminDialog { transition: none; }
}
</style>
