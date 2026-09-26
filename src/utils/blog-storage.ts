import { SITE_ORIGIN } from './runtime-config'

// This cache is internal to the Worker. No public route serves these keys.
const CACHE_NAME = 'aneko-blog-v2'
export const BLOG_FRESH_MS = 30_000
export const BLOG_FALLBACK_MS = 5 * 60_000

export interface BlogSnapshot<T> {
  savedAt: number
  value: T
}

function cacheKey(resource: string) {
  return new Request(new URL(`/__blog-cache/v2/${encodeURIComponent(resource)}`, SITE_ORIGIN))
}

async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Blog storage read timed out')), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

// Retry reads only. A timed-out write may already have committed remotely.
export async function readBlogStorage<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await bounded(read(), 3_000)
  } catch {
    return bounded(read(), 3_000)
  }
}

export async function readBlogSnapshot<T>(resource: string, valid: (value: unknown) => value is T) {
  try {
    return await bounded((async () => {
      const cache = await caches.open(CACHE_NAME)
      const response = await cache.match(cacheKey(resource))
      if (!response) return undefined
      const snapshot = await response.json() as BlogSnapshot<unknown>
      const age = Date.now() - snapshot.savedAt
      if (!Number.isFinite(age) || age < 0 || age > BLOG_FALLBACK_MS || !valid(snapshot.value)) return undefined
      return snapshot as BlogSnapshot<T>
    })(), 1_000)
  } catch {
    return undefined
  }
}

export async function writeBlogSnapshot<T>(resource: string, snapshot: BlogSnapshot<T>) {
  try {
    await bounded((async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(cacheKey(resource), new Response(JSON.stringify(snapshot), {
        headers: {
          'Cache-Control': `public, max-age=${BLOG_FALLBACK_MS / 1000}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
      }))
    })(), 1_000)
  } catch {
    // Storage remains authoritative; a cache failure must not fail a save.
  }
}

export async function deleteBlogSnapshot(resource: string) {
  try {
    await bounded((async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.delete(cacheKey(resource))
    })(), 1_000)
  } catch {
    // Cache API invalidation is local to a Cloudflare location and best-effort.
  }
}
