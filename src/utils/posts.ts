import { getBindings, getBlogIndexKey } from './cloudflare'
import { isValidBlogSlug } from './blog-config'
import {
  BLOG_FRESH_MS, BLOG_FALLBACK_MS, readBlogStorage, readBlogSnapshot,
  writeBlogSnapshot, deleteBlogSnapshot,
} from './blog-storage'

export const POSTS_PER_PAGE = 6

export interface StoredBlogPost {
  slug: string
  title: string
  description: string
  pubDate: string
  updatedDate?: string
  heroImage?: string
  bodyVersion?: string
  tags: string[]
  author: string
  featured: boolean
  draft: boolean
  readingTime: number
  bodyKey: string
}

export interface BlogPostData {
  title: string
  description: string
  pubDate: Date
  updatedDate?: Date
  heroImage?: string
  tags: string[]
  author: string
  featured: boolean
  draft: boolean
}

export interface BlogPost {
  id: string
  bodyKey: string
  readingTime: number
  body?: string
  data: BlogPostData
}

export class BlogDataUnavailableError extends Error {
  constructor(resource: 'index' | 'post') {
    super(resource === 'index' ? '博客文章列表暂时无法读取' : '博客文章暂时无法读取')
    this.name = 'BlogDataUnavailableError'
  }
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function isStoredBlogPost(value: unknown): value is StoredBlogPost {
  if (!value || typeof value !== 'object') return false
  const post = value as Partial<StoredBlogPost>

  return typeof post.slug === 'string'
    && isValidBlogSlug(post.slug)
    && typeof post.title === 'string'
    && typeof post.description === 'string'
    && typeof post.pubDate === 'string'
    && Number.isFinite(Date.parse(post.pubDate))
    && typeof post.bodyKey === 'string'
    && post.bodyKey.startsWith('blog/posts/')
    && (post.bodyVersion === undefined || typeof post.bodyVersion === 'string')
    && Array.isArray(post.tags)
    && post.tags.every((tag) => typeof tag === 'string')
    && (post.draft === undefined || typeof post.draft === 'boolean')
    && (post.featured === undefined || typeof post.featured === 'boolean')
}

function normalizeStoredPost(post: StoredBlogPost): BlogPost | null {
  const pubDate = new Date(post.pubDate)
  if (Number.isNaN(pubDate.valueOf())) return null

  const updatedDate = post.updatedDate ? new Date(post.updatedDate) : undefined

  return {
    id: post.slug,
    bodyKey: post.bodyKey,
    readingTime: Math.max(1, Number(post.readingTime) || 1),
    data: {
      title: post.title,
      description: post.description,
      pubDate,
      updatedDate: updatedDate && !Number.isNaN(updatedDate.valueOf()) ? updatedDate : undefined,
      heroImage: post.heroImage,
      tags: post.tags.filter((tag): tag is string => typeof tag === 'string'),
      author: post.author || 'ANeko',
      featured: Boolean(post.featured),
      draft: Boolean(post.draft),
    },
  }
}

function isPostIndex(value: unknown): value is StoredBlogPost[] {
  return Array.isArray(value) && value.every(isStoredBlogPost)
}

function indexCacheKey() {
  return 'index:' + getBlogIndexKey(getBindings())
}

function bodyCacheKey(slug: string, version = 'legacy') {
  return ['body', getBlogIndexKey(getBindings()), slug, version].join(':')
}

export async function getStoredPostIndex(options: { refresh?: boolean; allowStale?: boolean } = {}) {
  const refresh = options.refresh ?? true
  const allowStale = options.allowStale ?? false
  const cacheKey = indexCacheKey()
  const cached = !refresh || allowStale ? await readBlogSnapshot(cacheKey, isPostIndex) : undefined
  if (!refresh && cached && Date.now() - cached.savedAt < BLOG_FRESH_MS) return cached.value

  const bindings = getBindings()
  const readStartedAt = Date.now()
  try {
    const raw = await readBlogStorage(() => bindings.ANEKO_KV.get(getBlogIndexKey(bindings)))
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)
    // Refuse invalid indexes rather than silently dropping entries during a save.
    if (!isPostIndex(parsed)) throw new TypeError('Invalid blog index')
    await writeBlogSnapshot(cacheKey, { savedAt: readStartedAt, value: parsed })
    return parsed
  } catch (error) {
    console.error('[blog] index read failed', {
      errorType: error instanceof Error ? error.name : typeof error,
      fallback: Boolean(allowStale && cached),
    })
    if (allowStale && cached && Date.now() - cached.savedAt <= BLOG_FALLBACK_MS) return cached.value
    throw new BlogDataUnavailableError('index')
  }
}

export async function getStoredPostMetadata(slug: string) {
  // The index is the publication commit point. Leftover metadata keys must not
  // bring a removed article back into the public site or the editor.
  return (await getStoredPostIndex()).find((post) => post.slug === slug) ?? null
}

export async function saveStoredPostIndex(posts: StoredBlogPost[]) {
  if (!isPostIndex(posts)) throw new TypeError('Invalid blog index')
  const bindings = getBindings()
  const sorted = [...posts].sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
  await bindings.ANEKO_KV.put(getBlogIndexKey(bindings), JSON.stringify(sorted))
  await writeBlogSnapshot(indexCacheKey(), { savedAt: Date.now(), value: sorted })
}

export async function getPublishedPosts() {
  return (await getStoredPostIndex({ refresh: false, allowStale: true }))
    .filter((post) => !post.draft)
    .map(normalizeStoredPost)
    .filter((post): post is BlogPost => Boolean(post))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
}

export async function invalidateBlogPostBodyCache(slug: string, bodyVersion?: string) {
  await deleteBlogSnapshot(bodyCacheKey(slug, bodyVersion))
}

export async function rememberBlogPostBody(slug: string, bodyVersion: string, body: string) {
  await writeBlogSnapshot(bodyCacheKey(slug, bodyVersion), { savedAt: Date.now(), value: body })
}

export async function getBlogPost(slug: string) {
  if (!isValidBlogSlug(slug)) return null
  const index = await getStoredPostIndex({ refresh: false, allowStale: true })
  const metadata = index.find((post) => post.slug === slug)
  if (!metadata || metadata.draft) return null
  const post = normalizeStoredPost(metadata)
  if (!post) return null

  const cacheKey = bodyCacheKey(slug, metadata.bodyVersion)
  const cached = await readBlogSnapshot(cacheKey, (value): value is string => typeof value === 'string')
  if (cached && Date.now() - cached.savedAt < BLOG_FRESH_MS) {
    post.body = cached.value
    return post
  }

  const bindings = getBindings()
  const readStartedAt = Date.now()
  try {
    const body = await readBlogStorage(async () => {
      const object = await bindings.ANEKO_R2.get(metadata.bodyKey)
      return object ? object.text() : null
    })
    // A published index entry with a missing body is a storage inconsistency,
    // not evidence that the URL was deleted. Do not turn this into a 404.
    if (body === null) throw new BlogDataUnavailableError('post')
    post.body = body
    await writeBlogSnapshot(cacheKey, { savedAt: readStartedAt, value: body })
    return post
  } catch (error) {
    console.error('[blog] body read failed', {
      errorType: error instanceof Error ? error.name : typeof error,
      fallback: Boolean(cached),
    })
    if (cached && Date.now() - cached.savedAt <= BLOG_FALLBACK_MS) {
      post.body = cached.value
      return post
    }
    throw new BlogDataUnavailableError('post')
  }
}

export function formatPostDate(date: Date) {
  return dateFormatter.format(date).replaceAll('/', '.')
}

export function calculateReadingTime(markdown: string) {
  const contentLength = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s/g, '')
    .length

  return Math.max(1, Math.ceil(contentLength / 500))
}

export function getReadingTime(post: BlogPost) {
  return post.readingTime
}

export function getTagCounts(posts: BlogPost[]) {
  const counts = new Map<string, number>()

  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
}

export function tagToSlug(tag: string) {
  return tag
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[\/\\\s]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function getTagEntries(posts: BlogPost[]) {
  return getTagCounts(posts).map(([tag, count]) => ({
    tag,
    count,
    slug: tagToSlug(tag),
  }))
}

export function toPostSummary(post: BlogPost) {
  return {
    slug: post.id,
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.pubDate.toISOString(),
    dateLabel: formatPostDate(post.data.pubDate),
    tags: post.data.tags,
    author: post.data.author,
    heroImage: post.data.heroImage,
    readingTime: getReadingTime(post),
  }
}
