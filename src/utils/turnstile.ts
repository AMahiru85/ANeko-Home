import { DEFAULT_TURNSTILE_HOSTNAME } from './runtime-config'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const MAX_TOKEN_LENGTH = 2048
const VERIFY_TIMEOUT_MS = 10_000

interface SiteverifyResponse {
  success?: unknown
  action?: unknown
  hostname?: unknown
}

function expectedHostnames(bindings: Env) {
  const configured = (bindings.TURNSTILE_HOSTNAMES?.trim() || DEFAULT_TURNSTILE_HOSTNAME)
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)
  return new Set(configured)
}

export async function verifyTurnstileToken(
  token: unknown,
  request: Request,
  bindings: Env,
  expectedAction = 'admin_login',
) {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return false

  const secret = bindings.TURNSTILE_SECRET?.trim()
  const hostnames = expectedHostnames(bindings)
  if (!secret || hostnames.size === 0) return false

  const form = new URLSearchParams({ secret, response: token })
  const clientIp = request.headers.get('CF-Connecting-IP')
  if (clientIp) form.set('remoteip', clientIp)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: controller.signal,
    })
    if (!response.ok) return false

    const result = await response.json() as SiteverifyResponse
    return result.success === true
      && result.action === expectedAction
      && typeof result.hostname === 'string'
      && hostnames.has(result.hostname.toLowerCase())
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
