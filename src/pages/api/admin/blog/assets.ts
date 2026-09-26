import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../../utils/auth'
import { BLOG_ASSET_PREFIX, getBindings } from '../../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../../utils/http'
import { BLOG_SLUG_PATTERN } from '../../../../utils/blog-config'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('Unauthorized', 401)
  }

  const slug = new URL(request.url).searchParams.get('slug')?.trim() || ''
  if (!BLOG_SLUG_PATTERN.test(slug)) return errorResponse('Invalid article slug')

  const prefix = `${BLOG_ASSET_PREFIX}${slug}/`
  const assets: Array<{
    path: string
    size: number
    uploaded: string
    contentType?: string
  }> = []
  let cursor: string | undefined

  do {
    const result = await bindings.ANEKO_R2.list({ prefix, cursor, include: ['httpMetadata'] })
    assets.push(...result.objects.map((object) => ({
      path: object.key.slice(BLOG_ASSET_PREFIX.length),
      size: object.size,
      uploaded: object.uploaded.toISOString(),
      contentType: object.httpMetadata?.contentType,
    })))
    cursor = result.truncated ? result.cursor : undefined
  } while (cursor)

  return successResponse(assets.sort((a, b) => b.uploaded.localeCompare(a.uploaded)))
}
