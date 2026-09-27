const SITE_ORIGIN = 'https://www.aneko.ink'
const HOST = 'www.aneko.ink'
const MAX_URLS = 10_000
const REQUEST_TIMEOUT_MS = 4_000
const SUBMISSION_TIMEOUT_MS = 12_000
const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/
const ENDPOINTS = [
  ['https://api.indexnow.org/indexnow', 'IndexNow'],
  ['https://www.bing.com/indexnow', 'Bing'],
]

function fail(message) {
  throw new Error(message)
}

function timeoutFetch(url, init, milliseconds) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), milliseconds)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

function retryAfter(value) {
  if (!value) return ''
  if (/^\d{1,10}$/.test(value)) return value
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toUTCString() : ''
}

function normalizedUrls(raw) {
  const values = raw.trim()
    ? raw.split(/[\s,]+/)
    : [
        `${SITE_ORIGIN}/`,
        `${SITE_ORIGIN}/blog/`,
        `${SITE_ORIGIN}/sitemap.xml`,
      ]
  const urls = new Set()
  for (const value of values) {
    let url
    try {
      url = new URL(value)
    } catch {
      continue
    }
    if (url.origin !== SITE_ORIGIN || url.username || url.password) continue
    url.hash = ''
    urls.add(url.href)
  }
  if (!urls.size) fail('没有可提交的 www.aneko.ink URL')
  if (urls.size > MAX_URLS) fail(`一次最多提交 ${MAX_URLS} 个 URL`)
  return [...urls]
}

async function submit() {
  const key = (process.env.INDEXNOW_KEY || '').trim()
  if (!KEY_PATTERN.test(key)) fail('INDEXNOW_KEY 未配置或格式无效')

  const urls = normalizedUrls(process.env.INDEXNOW_URLS || '')
  const body = JSON.stringify({
    host: HOST,
    key,
    keyLocation: `${SITE_ORIGIN}/${key}.txt`,
    urlList: urls,
  })
  const deadline = Date.now() + SUBMISSION_TIMEOUT_MS
  let lastError

  for (const [endpoint, provider] of ENDPOINTS) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    try {
      const response = await timeoutFetch(endpoint, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
      }, Math.min(REQUEST_TIMEOUT_MS, remaining))

      // Never print or buffer an upstream response body; it may echo submitted data.
      void response.body?.cancel().catch(() => undefined)
      if (response.status === 200 || response.status === 202) {
        console.log(`${provider} 已接收 ${urls.length} 个 URL（HTTP ${response.status}）`)
        return
      }

      const delay = retryAfter(response.headers.get('Retry-After'))
      if (delay) console.error(`Retry-After: ${delay}`)
      const transient = response.status === 408 || response.status === 425 || response.status >= 500
      lastError = new Error(`${provider} 返回 HTTP ${response.status}`)
      // Do not immediately retry a rate limit or any explicit Retry-After.
      if (!transient || delay) break
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  fail(lastError?.message || 'IndexNow 提交失败')
}

try {
  await submit()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
