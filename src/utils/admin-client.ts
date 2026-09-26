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

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)
  let payload: ApiEnvelope<T>

  try {
    payload = await response.json()
  } catch {
    throw new ApiRequestError(`HTTP ${response.status}`, response.status)
  }

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new ApiRequestError(payload.error || `HTTP ${response.status}`, response.status)
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
