export interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
}

export const ADMIN_SESSION_KEY = 'aneko-admin-access'
const LEGACY_SESSION_KEY = 'aneko-drive-access'

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

function requestErrorMessage(status: number) {
  if (status === 400) return '请求内容有误，请检查后重试。'
  if (status === 401) return '登录状态已失效，请重新登录。'
  if (status === 403) return '当前操作未获授权。'
  if (status === 404) return '请求的内容不存在或已被删除。'
  if (status === 408) return '请求超时，请稍后重试。'
  if (status === 413) return '文件或内容过大，请缩小后重试。'
  if (status === 429) return '操作过于频繁，请稍后重试。'
  if (status >= 500) return '服务暂时不可用，请稍后重试。'
  return '请求失败，请稍后重试。'
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)
  let payload: ApiEnvelope<T>

  try {
    payload = await response.json()
  } catch {
    throw new ApiRequestError(requestErrorMessage(response.status), response.status)
  }

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new ApiRequestError(payload.error || requestErrorMessage(response.status), response.status)
  }

  return payload.data
}

export async function verifyAdminAccess(code: string, turnstileToken: string) {
  const result = await apiRequest<{ valid: boolean }>('/api/admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, 'cf-turnstile-response': turnstileToken }),
  })
  return result.valid
}

export function storeAdminAccess(code: string) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, code)
  sessionStorage.removeItem(LEGACY_SESSION_KEY)
}

export function clearAdminAccess() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
  sessionStorage.removeItem(LEGACY_SESSION_KEY)
  void fetch('/api/admin/session', {
    method: 'DELETE',
    keepalive: true,
  }).catch(() => undefined)
}

export async function restoreAdminAccess() {
  const code = sessionStorage.getItem(ADMIN_SESSION_KEY)
    || sessionStorage.getItem(LEGACY_SESSION_KEY)
    || ''

  if (!code) return ''

  try {
    const result = await apiRequest<{ valid: boolean }>('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (!result.valid) {
      clearAdminAccess()
      return ''
    }
    storeAdminAccess(code)
    return code
  } catch {
    clearAdminAccess()
    return ''
  }
}
