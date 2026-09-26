import { getBindings, getIndexNowKey } from './cloudflare'
import { POSTS_PER_PAGE, tagToSlug, type StoredBlogPost } from './posts'
import { SITE_ORIGIN } from './runtime-config'

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/
const MAX_URLS_PER_REQUEST = 10_000
const siteUrl = new URL(SITE_ORIGIN)

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

function retryDelayMs(response?: Response) {
  const retryAfter = response?.headers.get('Retry-After')
  if (!retryAfter) return 500
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 5000)
  const timestamp = Date.parse(retryAfter)
  return Number.isNaN(timestamp) ? 500 : Math.min(Math.max(timestamp - Date.now(), 0), 5000)
}

async function submitIndexNowBatch(key: string, urlList: string[]) {
  const body = JSON.stringify({
    host: siteUrl.hostname,
    key,
    keyLocation: new URL(`/${key}.txt`, siteUrl).href,
    urlList,
  })

  let response: Response | undefined
  let requestError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      if (response.status === 200 || response.status === 202) return
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response)))
        continue
      }
    } catch (error) {
      response = undefined
      requestError = error
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs()))
        continue
      }
    }
    break
  }

  if (!response && requestError) throw requestError
  const status = response?.status ?? 0
  const retryAfter = response?.headers.get('Retry-After')
  throw new Error(`IndexNow rejected the submission (${status}${retryAfter ? `, retry after ${retryAfter}` : ''})`)
}

export async function submitIndexNow(paths: Iterable<string>) {
  const bindings = getBindings()
  const key = getIndexNowKey(bindings)
  if (!INDEXNOW_KEY_PATTERN.test(key)) throw new Error('IndexNow key is not configured or invalid')

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
