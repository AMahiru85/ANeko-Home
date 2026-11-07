/** Fixed storage keys and generated site URLs. */
export const SITE_ORIGIN = 'https://www.aneko.ink'
export const BLOG_INDEX_KV_KEY = 'blog:index'
export const PHOTO_MANIFEST_KV_KEY = 'photos'
export const DRIVE_OBJECT_PREFIX = 'drive/'
export const MAIL_CONFIG_STORAGE_KEY = 'mail:config:v3'

export function canonicalPathname(pathname: string) {
  if (pathname === '/' || pathname === '/admin' || pathname.endsWith('/') || pathname.startsWith('/api/')) return pathname
  const finalSegment = pathname.slice(pathname.lastIndexOf('/') + 1)
  return finalSegment.includes('.') ? pathname : `${pathname}/`
}
