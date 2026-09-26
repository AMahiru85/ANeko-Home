import { defineMiddleware } from 'astro:middleware'
import { canonicalPathname, SITE_ORIGIN } from './utils/runtime-config'

const canonicalOrigin = new URL(SITE_ORIGIN)
const siteHostnames = new Set([canonicalOrigin.hostname, canonicalOrigin.hostname.replace(/^www\./, '')])

export const onRequest = defineMiddleware(async ({ request }, next) => {
  const url = new URL(request.url)
  if (!siteHostnames.has(url.hostname.toLowerCase())) return next()

  const canonicalPath = canonicalPathname(url.pathname)
  if (url.protocol !== canonicalOrigin.protocol
    || url.host !== canonicalOrigin.host
    || url.pathname !== canonicalPath) {
    url.protocol = canonicalOrigin.protocol
    url.host = canonicalOrigin.host
    url.pathname = canonicalPath
    return Response.redirect(url, 308)
  }

  return next()
})
