import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../../utils/auth'
import { BLOG_ASSET_PREFIX, getBindings } from '../../../../utils/cloudflare'
import { errorResponse, r2ObjectResponse, successResponse } from '../../../../utils/http'
import { joinObjectPath, normalizeObjectPath } from '../../../../utils/r2'

export const prerender = false

function getKey(path?: string) {
  return joinObjectPath(BLOG_ASSET_PREFIX, path || '')
}

export const GET: APIRoute = async ({ params }) => {
  try {
    const object = await getBindings().ANEKO_R2.get(getKey(params.path))
    if (!object) return errorResponse('未找到附件', 404)
    return r2ObjectResponse(object, { cacheControl: 'public, max-age=31536000, immutable' })
  } catch {
    return errorResponse('附件路径无效')
  }
}

export const PUT: APIRoute = async ({ params, request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  try {
    const path = normalizeObjectPath(params.path || '')
    if (!request.body) return errorResponse('请求内容不能为空')

    await bindings.ANEKO_R2.put(`${BLOG_ASSET_PREFIX}${path}`, request.body, {
      httpMetadata: {
        contentType: request.headers.get('Content-Type') || 'application/octet-stream',
      },
    })
    return successResponse({ path: `/api/blog/assets/${path}` })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '附件上传失败')
  }
}

export const DELETE: APIRoute = async ({ params, request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  try {
    const path = normalizeObjectPath(params.path || '')
    await bindings.ANEKO_R2.delete(`${BLOG_ASSET_PREFIX}${path}`)
    return successResponse({ deleted: path })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '附件删除失败')
  }
}
