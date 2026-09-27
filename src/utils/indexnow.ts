import { getBindings, getIndexNowKey } from './cloudflare'
import { POSTS_PER_PAGE, tagToSlug, type StoredBlogPost } from './posts'
import { SITE_ORIGIN } from './runtime-config'

const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
]
const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/
const MAX_URLS_PER_REQUEST = 10_000
const REQUEST_TIMEOUT_MS = 4_000
const SUBMISSION_TIMEOUT_MS = 12_000
const siteUrl = new URL(SITE_ORIGIN)
const PROVIDER_NAMES: Record<string, string> = {
  'https://api.indexnow.org/indexnow': 'IndexNow',
  'https://www.bing.com/indexnow': 'Bing',
}

type IndexNowErrorKind = 'configuration' | 'network' | 'upstream'

export class IndexNowError extends Error {
  readonly kind: IndexNowErrorKind
  readonly status?: number
  readonly retryAfter?: string
  readonly provider?: string
  readonly code: string
  progress?: IndexNowSubmissionResult
  providerResults?: IndexNowProviderResult[]

  constructor(
    kind: IndexNowErrorKind,
    message: string,
    status?: number,
    retryAfter?: string | null,
    provider?: string,
    code: string = kind,
  ) {
    super(message)
    this.name = 'IndexNowError'
    this.kind = kind
    this.status = status
    this.retryAfter = retryAfter || undefined
    this.provider = provider
    this.code = code
  }
}

export interface IndexNowSubmissionResult {
  requested: number
  submitted: number
  accepted: number
  pending: number
  status: 'empty' | 'accepted' | 'pending'
  providers: string[]
  providerResults: IndexNowProviderResult[]
}

export interface IndexNowProviderResult {
  provider: string
  state: 'accepted' | 'pending' | 'failed'
  status?: number
  message?: string
  retryAfter?: string
}

export function isValidIndexNowKey(key: string) {
  return INDEXNOW_KEY_PATTERN.test(key)
}

function publishedPosts(posts: StoredBlogPost[]) {
  return posts.filter((post) => !post.draft)
}

function listingPageCount(posts: StoredBlogPost[]) {
  return Math.max(1, Math.ceil(publishedPosts(posts).length / POSTS_PER_PAGE))
}

function addTagPaths(paths: Set<string>, posts: Array<StoredBlogPost | undefined>) {
  for (const post of posts) {
    if (!post || post.draft) continue
    for (const tag of post.tags) {
      const slug = tagToSlug(tag)
      if (slug) paths.add(`/blog/tag/${encodeURIComponent(slug)}/`)
    }
  }
}

function addListingPaths(paths: Set<string>, oldPosts: StoredBlogPost[], newPosts: StoredBlogPost[]) {
  const pageCount = Math.max(listingPageCount(oldPosts), listingPageCount(newPosts))
  for (let page = 2; page <= pageCount; page += 1) {
    paths.add(`/blog/page/${page}/`)
  }
}

export function blogIndexNowPaths(
  slug: string,
  oldPosts: StoredBlogPost[],
  newPosts: StoredBlogPost[],
) {
  const previous = oldPosts.find((post) => post.slug === slug)
  const current = newPosts.find((post) => post.slug === slug)
  if ((!previous || previous.draft) && (!current || current.draft)) return []

  const paths = new Set([
    `/blog/${encodeURIComponent(slug)}/`,
    '/blog/',
    '/blog/archive/',
    '/blog/about/',
  ])
  addTagPaths(paths, [previous, current])
  addListingPaths(paths, oldPosts, newPosts)
  return [...paths]
}

export function allIndexNowPaths(posts: StoredBlogPost[]) {
  const published = publishedPosts(posts)
  const paths = new Set([
    '/',
    '/blog/',
    '/blog/archive/',
    '/blog/about/',
    '/photos/',
    '/drive/',
    '/mail/',
  ])

  for (const post of published) {
    paths.add(`/blog/${encodeURIComponent(post.slug)}/`)
  }
  addTagPaths(paths, published)
  addListingPaths(paths, [], published)
  return [...paths]
}

function indexNowUrls(paths: Iterable<string>) {
  const urls = new Set<string>()
  for (const path of paths) {
    let url: URL
    try {
      url = new URL(path, siteUrl)
    } catch {
      continue
    }
    if (url.origin !== siteUrl.origin || url.username || url.password) continue
    url.hash = ''
    urls.add(url.href)
  }
  return [...urls]
}

function validRetryAfter(value: string | null) {
  if (!value) return undefined
  if (/^\d{1,10}$/.test(value)) return value
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toUTCString() : undefined
}

function canUseFallback(error: IndexNowError) {
  // A rate limit or an explicit Retry-After must not cause an immediate retry.
  if (error.retryAfter || error.status === 429) return false
  return error.kind === 'network'
    || error.status === 408
    || error.status === 425
    || (error.status !== undefined && error.status >= 500)
}

function closeResponse(response: Response) {
  // Upstream error pages may be very large and may echo the public key or URLs.
  // Their HTTP status is sufficient for diagnosis; never buffer or log the body.
  void response.body?.cancel().catch(() => undefined)
}

async function withTimeout<T>(milliseconds: number, operation: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort()
      reject(new DOMException('Request timed out', 'TimeoutError'))
    }, milliseconds)
  })
  try {
    return await Promise.race([operation(controller.signal), timedOut])
  } finally {
    clearTimeout(timeout)
  }
}

async function requestIndexNow(endpoint: string, body: string, deadline: number) {
  const provider = PROVIDER_NAMES[endpoint] ?? 'IndexNow'
  const remaining = deadline - Date.now()
  if (remaining <= 0) {
    throw new IndexNowError('network', '本次 IndexNow 提交已超时，请稍后重试。', undefined, undefined, provider, 'submission_timeout')
  }
  try {
    return await withTimeout(Math.min(REQUEST_TIMEOUT_MS, remaining), async (signal) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
        // The deployed Workers runtime rejects redirect: 'error' before I/O.
        redirect: 'manual',
        signal,
      })
      closeResponse(response)
      if (response.status === 200 || response.status === 202) {
        return { status: response.status, provider }
      }
      if (response.status >= 300 && response.status < 400) {
        // Do not forward the key/URL batch to an arbitrary redirect target.
        throw new IndexNowError(
          'upstream',
          `${provider} 提交接口返回 HTTP ${response.status} 重定向，本次未提交成功，请检查提交接口地址。`,
          response.status, validRetryAfter(response.headers.get('Retry-After')), provider, 'provider_redirect',
        )
      }
      throw new IndexNowError(
        'upstream',
        `${provider} 返回 HTTP ${response.status}：${indexNowUpstreamHint(response.status)}`,
        response.status, validRetryAfter(response.headers.get('Retry-After')), provider, 'provider_rejected',
      )
    })
  } catch (error) {
    if (error instanceof IndexNowError) throw error
    const timedOut = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
    throw new IndexNowError(
      'network',
      timedOut ? `${provider} 响应超时，请稍后重试。` : `暂时无法连接 ${provider}，请稍后重试。`,
      undefined, undefined, provider, timedOut ? 'provider_timeout' : 'provider_network',
    )
  }
}

async function submitIndexNowBatch(key: string, urlList: string[], deadline: number) {
  const body = JSON.stringify({
    host: siteUrl.hostname,
    key,
    keyLocation: new URL(`/${key}.txt`, siteUrl).href,
    urlList,
  })

  let lastError: IndexNowError | undefined
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      return await requestIndexNow(endpoint, body, deadline)
    } catch (error) {
      if (!(error instanceof IndexNowError)) throw error
      lastError = error
      if (!canUseFallback(error) || Date.now() >= deadline) throw error
    }
  }
  throw lastError ?? new IndexNowError('network', '暂时无法连接 IndexNow，请稍后重试。')
}

async function submitIndexNowBatchToAllProviders(key: string, urlList: string[], deadline: number) {
  const body = JSON.stringify({
    host: siteUrl.hostname,
    key,
    keyLocation: new URL(`/${key}.txt`, siteUrl).href,
    urlList,
  })
  const outcomes = await Promise.all(INDEXNOW_ENDPOINTS.map(async (endpoint): Promise<{
    result: IndexNowProviderResult
    error?: IndexNowError
  }> => {
    const provider = PROVIDER_NAMES[endpoint] ?? 'IndexNow'
    try {
      const response = await requestIndexNow(endpoint, body, deadline)
      return {
        result: {
          provider,
          state: response.status === 200 ? 'accepted' : 'pending',
          status: response.status,
        },
      }
    } catch (error) {
      const providerError = error instanceof IndexNowError
        ? error
        : new IndexNowError('network', `暂时无法连接 ${provider}，请稍后重试。`, undefined, undefined, provider, 'provider_network')
      return {
        result: {
          provider,
          state: 'failed',
          status: providerError.status,
          message: providerError.message,
          retryAfter: providerError.retryAfter,
        },
        error: providerError,
      }
    }
  }))
  const providerResults = outcomes.map((outcome) => outcome.result)
  const accepted = outcomes.some((outcome) => outcome.result.state === 'accepted')
  const pending = outcomes.some((outcome) => outcome.result.state === 'pending')
  if (!accepted && !pending) {
    const errors = outcomes.flatMap((outcome) => outcome.error ? [outcome.error] : [])
    const preferredError = errors.find((error) => error.retryAfter || error.status === 429) ?? errors[0]
    const summary = outcomes.map(({ result }) =>
      `${result.provider}：${result.message ?? '提交失败，请稍后重试。'}`,
    ).join('；')
    const error = new IndexNowError(
      preferredError?.kind ?? 'network',
      `主接口和 Bing 均未接收：${summary}`,
      preferredError?.status,
      preferredError?.retryAfter,
      preferredError?.provider,
      preferredError?.code ?? 'provider_rejected',
    )
    error.providerResults = providerResults
    throw error
  }
  return { providerResults, accepted, pending }
}

export function indexNowUpstreamHint(status: number) {
  if (status === 400) return '提交数据格式无效，请重试；若持续发生，请检查站点主机名和提交网址。'
  if (status === 403) return '密钥验证失败。请确认 Worker 的 INDEXNOW_KEY 与公开密钥文件内容完全一致，且密钥文件可通过 HTTPS 访问。'
  if (status === 422) return '提交的网址与密钥文件所在主机不匹配，请确认 www.aneko.ink 的密钥文件可访问。'
  if (status === 429) return '搜索引擎请求过于频繁，请稍后重试。'
  if (status >= 500) return '搜索引擎服务暂时异常，请稍后重试。'
  return '请检查 IndexNow 密钥、密钥文件和提交的网址。'
}

export async function submitIndexNow(
  paths: Iterable<string>,
  options: { allProviders?: boolean } = {},
): Promise<IndexNowSubmissionResult> {
  const deadline = Date.now() + SUBMISSION_TIMEOUT_MS
  const bindings = getBindings()
  const key = getIndexNowKey(bindings)
  if (!isValidIndexNowKey(key)) {
    throw new IndexNowError('configuration', 'IndexNow 密钥未配置或格式无效：INDEXNOW_KEY 须为 8–128 位字母、数字或短横线。')
  }

  const urlList = indexNowUrls(paths)
  const result: IndexNowSubmissionResult = {
    requested: urlList.length,
    submitted: 0,
    accepted: 0,
    pending: 0,
    status: 'empty',
    providers: [],
    providerResults: [],
  }
  if (!urlList.length) return result

  try {
    // The provider verifies keyLocation externally. A same-zone Worker fetch
    // can reach a different origin, so it cannot reliably verify this route.
    for (let offset = 0; offset < urlList.length; offset += MAX_URLS_PER_REQUEST) {
      const batch = urlList.slice(offset, offset + MAX_URLS_PER_REQUEST)
      if (options.allProviders) {
        const batchResult = await submitIndexNowBatchToAllProviders(key, batch, deadline)
        result.providerResults.push(...batchResult.providerResults)
        result.submitted += batch.length
        if (batchResult.accepted) result.accepted += batch.length
        else if (batchResult.pending) result.pending += batch.length
        for (const providerResult of batchResult.providerResults) {
          if (providerResult.state !== 'failed' && !result.providers.includes(providerResult.provider)) {
            result.providers.push(providerResult.provider)
          }
        }
      } else {
        const response = await submitIndexNowBatch(key, batch, deadline)
        result.submitted += batch.length
        if (response.status === 200) result.accepted += batch.length
        else result.pending += batch.length
        if (!result.providers.includes(response.provider)) result.providers.push(response.provider)
        result.providerResults.push({
          provider: response.provider,
          state: response.status === 200 ? 'accepted' : 'pending',
          status: response.status,
        })
      }
      result.status = result.pending > 0 ? 'pending' : 'accepted'
    }
    return result
  } catch (error) {
    if (error instanceof IndexNowError) {
      if (error.providerResults) result.providerResults.push(...error.providerResults)
      error.progress = result
    }
    throw error
  }
}

export function queueIndexNow(context: ExecutionContext, paths: string[]) {
  if (!paths.length) return
  try {
    context.waitUntil(
      submitIndexNow(paths).catch((error) => {
        console.error('[IndexNow] submission failed:', error instanceof IndexNowError
          ? { code: error.code, status: error.status, provider: error.provider, message: error.message }
          : { errorType: error instanceof Error ? error.name : typeof error })
      }),
    )
  } catch (error) {
    console.error('[IndexNow] unable to queue submission:', { errorType: error instanceof Error ? error.name : typeof error })
  }
}
