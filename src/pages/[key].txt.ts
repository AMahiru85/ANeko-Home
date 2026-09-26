import type { APIRoute } from 'astro'
import { getBindings, getIndexNowKey } from '../utils/cloudflare'
import { isValidIndexNowKey } from '../utils/indexnow'

export const prerender = false

export const GET: APIRoute = async ({ params }) => {
  const key = getIndexNowKey(getBindings())
  if (!isValidIndexNowKey(key) || params.key !== key) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex',
      },
    })
  }

  return new Response(key, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
