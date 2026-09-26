const encoder = new TextEncoder()

export const ADMIN_SESSION_COOKIE = '__Host-aneko-admin-session'

const ADMIN_SESSION_VERSION = 'v1'
const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60
const ADMIN_SESSION_CLOCK_SKEW_SECONDS = 60
const ADMIN_SESSION_TOKEN_PATTERN = /^v1\.(\d{10})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

export async function verifyAccessCode(provided: string | null, expected?: string) {
  if (!provided || !expected) return false

  const [providedHash, expectedHash] = await Promise.all([
    digest(provided),
    digest(expected),
  ])

  if (providedHash.length !== expectedHash.length) return false

  let difference = 0
  for (let index = 0; index < providedHash.length; index += 1) {
    difference |= providedHash[index] ^ expectedHash[index]
  }

  return difference === 0
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function importSessionKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function sessionMessage(issuedAt: number, nonce: string) {
  return encoder.encode(`aneko-admin-session:${ADMIN_SESSION_VERSION}:${issuedAt}:${nonce}`)
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return ''

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=')
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue
    return pair.slice(separator + 1).trim()
  }
  return ''
}

export async function createAdminSessionToken(secretValue?: string) {
  const secret = secretValue?.trim()
  if (!secret) throw new Error('Admin session secret is not configured')

  const issuedAt = Math.floor(Date.now() / 1000)
  const nonce = encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)))
  const key = await importSessionKey(secret)
  const signature = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    sessionMessage(issuedAt, nonce),
  ))
  return `${ADMIN_SESSION_VERSION}.${issuedAt}.${nonce}.${encodeBase64Url(signature)}`
}

export async function verifyAdminSession(request: Request, secretValue?: string) {
  const secret = secretValue?.trim()
  const token = getCookie(request, ADMIN_SESSION_COOKIE)
  if (!secret || token.length > 256) return false

  const match = ADMIN_SESSION_TOKEN_PATTERN.exec(token)
  if (!match) return false

  const issuedAt = Number(match[1])
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isSafeInteger(issuedAt)
    || issuedAt > now + ADMIN_SESSION_CLOCK_SKEW_SECONDS
    || now - issuedAt > ADMIN_SESSION_TTL_SECONDS) {
    return false
  }

  try {
    const key = await importSessionKey(secret)
    return crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(match[3]),
      sessionMessage(issuedAt, match[2]),
    )
  } catch {
    return false
  }
}

export async function verifyAdminRequest(request: Request, bindings: Env) {
  const [validCode, validSession] = await Promise.all([
    verifyAccessCode(request.headers.get('X-Access-Code'), bindings.ACCESS_CODE),
    verifyAdminSession(request, bindings.TURNSTILE_SECRET),
  ])
  return validCode && validSession
}

export function adminSessionCookie(token: string) {
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/; Max-Age=${ADMIN_SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`
}

export function expiredAdminSessionCookie() {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict`
}
