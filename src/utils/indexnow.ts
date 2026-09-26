import { getBindings, getIndexNowKey } from './cloudflare'
import { POSTS_PER_PAGE, tagToSlug, type StoredBlogPost } from './posts'
import { SITE_ORIGIN } from './runtime-config'

const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
]
const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/
const MAX_URLS_PER_REQUEST = 10_000
const REQUEST_TIMEOUT_MS = 5_000
const siteUrl = new URL(SITE_ORIGIN)

type IndexNowErrorKind = 'configuration' | 'network' | 'upstream'

export class IndexNowError extends Error {
  readonly kind: IndexNowErrorKind
  readonly status?: number
  readonly retryAfter?: string

  constructor(kind: IndexNowErrorKind, message: string, status?: number, retryAfter?: string | null) {
    super(message)
    this.name = 'IndexNowError'
    this.kind = kind
    this.status = status
    this.retryAfter = retryAfter || undefined
  }
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
    const url = new URL(path, siteUrl)
    if (url.origin !== siteUrl.origin) continue
    url.hash = ''
    urls.add(url.href)
  }
  return [...urls]
}

function retryDelayMs(retryAfter?: string | null) {
  if (!retryAfter) return 500
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 5000)
  const timestamp = Date.parse(retryAfter)
  return Number.isNaN(timestamp) ? 500 : Math.min(Math.max(timestamp - Date.now(), 0), 5000)
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function sanitizeProviderMessage(message: string, key: string) {
  return message.replaceAll(key, '[redacted]').replace(/\s+/g, ' ').trim().slice(0, 300)
}

async function requestIndexNow(endpoint: string, body: string, key: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body,
      signal: controller.signal,
    })
    const responseBody = await response.text()
    if (response.status === 200 || response.status === 202) return response

    const providerMessage = sanitizeProviderMessage(responseBody, key)
    throw new IndexNowError(
      'upstream',
      `IndexNow provider returned HTTP ${response.status}${providerMessage ? `: ${providerMessage}` : ''}`,
      response.status,
      response.headers.get('Retry-After'),
    )
  } catch (error) {
    if (error instanceof IndexNowError) throw error
    throw new IndexNowError(
      'network',
      error instanceof Error && error.name === 'AbortError'
        ? 'IndexNow provider request timed out'
        : 'Unable to reach an IndexNow provider',
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function submitIndexNowBatch(key: string, urlList: string[]) {
  const body = JSON.stringify({
    host: siteUrl.hostname,
    key,
    keyLocation: new URL(`/${key}.txt`, siteUrl).href,
    urlList,
  })

  let lastError: IndexNowError | undefined
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await requestIndexNow(endpoint, body, key)
        if (response.status === 200 || response.status === 202) return
      } catch (error) {
        const indexNowError = error instanceof IndexNowError
          ? error
          : new IndexNowError('network', 'Unable to reach an IndexNow provider')
        lastError = indexNowError

        if (attempt === 0 && (indexNowError.kind === 'network' || isRetryableStatus(indexNowError.status ?? 0))) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs(indexNowError.retryAfter)))
          continue
        }

        if (indexNowError.kind === 'upstream' && !isRetryableStatus(indexNowError.status ?? 0)) {
          throw indexNowError
        }
      }
      break
    }

    if (!lastError || lastError.kind === 'upstream' && !isRetryableStatus(lastError.status ?? 0)) break
  }

  throw lastError ?? new IndexNowError('network', 'Unable to reach an IndexNow provider')
}

export async function submitIndexNow(paths: Iterable<string>) {
  const bindings = getBindings()
  const key = getIndexNowKey(bindings)
  if (!INDEXNOW_KEY_PATTERN.test(key)) {
    throw new IndexNowError('configuration', 'IndexNow key is not configured or invalid')
  }

  const urlList = indexNowUrls(paths)
  if (!urlList.length) return 0

  for (let offset = 0; offset < urlList.length; offset += MAX_URLS_PER_REQUEST) {
    await submitIndexNowBatch(key, urlList.slice(offset, offset + MAX_URLS_PER_REQUEST))
  }
  return urlList.length
}

export function queueIndexNow(context: ExecutionContext, paths: string[]) {
  if (!paths.length) return
  try {
    context.waitUntil(
      submitIndexNow(paths).catch((error) => {
        console.error('[IndexNow] submission failed:', error instanceof Error ? error.message : 'Unknown error')
      }),
    )
  } catch (error) {
    console.error('[IndexNow] unable to queue submission:', error instanceof Error ? error.message : 'Unknown error')
  }
}
