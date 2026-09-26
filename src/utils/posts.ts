import { BLOG_META_PREFIX, getBindings, getBlogIndexKey } from './cloudflare'

export const POSTS_PER_PAGE = 6

export interface StoredBlogPost {
  slug: string
  title: string
  description: string
  pubDate: string
  updatedDate?: string
  heroImage?: string
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

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function isStoredBlogPost(value: unknown): value is StoredBlogPost {
  if (!value || typeof value !== 'object') return false
  const post = value as Partial<StoredBlogPost>

  return typeof post.slug === 'string'
    && typeof post.title === 'string'
    && typeof post.description === 'string'
    && typeof post.pubDate === 'string'
    && typeof post.bodyKey === 'string'
    && Array.isArray(post.tags)
}

export async function getStoredPostMetadata(slug: string) {
  const bindings = getBindings()
  const rawMetadata = await bindings.ANEKO_KV.get(`${BLOG_META_PREFIX}${slug}`)

  if (rawMetadata) {
    try {
      const parsed = JSON.parse(rawMetadata)
      if (isStoredBlogPost(parsed)) return parsed
    } catch {
      // Fall back to the index for metadata written before per-post keys existed.
    }
  }

  return (await getStoredPostIndex()).find((post) => post.slug === slug) ?? null
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

export async function getStoredPostIndex() {
  const bindings = getBindings()
  const raw = await bindings.ANEKO_KV.get(getBlogIndexKey(bindings))
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isStoredBlogPost) : []
  } catch {
    return []
  }
}

export async function saveStoredPostIndex(posts: StoredBlogPost[]) {
  const bindings = getBindings()
  const sorted = [...posts].sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate))
  await bindings.ANEKO_KV.put(getBlogIndexKey(bindings), JSON.stringify(sorted))
}

export async function getPublishedPosts() {
  return (await getStoredPostIndex())
    .filter((post) => !post.draft)
    .map(normalizeStoredPost)
    .filter((post): post is BlogPost => Boolean(post))
}

export async function getBlogPost(slug: string) {
  const bindings = getBindings()
  const storedPost = await getStoredPostMetadata(slug)

  if (!storedPost || storedPost.draft) return null

  const post = normalizeStoredPost(storedPost)
  if (!post) return null

  const bodyObject = await bindings.ANEKO_R2.get(storedPost.bodyKey)
  if (!bodyObject) return null

  post.body = await bodyObject.text()
  return post
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
