import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../../utils/auth'
import { BLOG_ASSET_PREFIX, getBindings } from '../../../../utils/cloudflare'
import { errorResponse, r2ObjectResponse, successResponse } from '../../../../utils/http'
import { joinObjectPath, normalizeObjectPath } from '../../../../utils/r2'
import { readBlogStorage } from '../../../../utils/blog-storage'

export const prerender = false

function getKey(path?: string) {
  return joinObjectPath(BLOG_ASSET_PREFIX, path || '')
}

export const GET: APIRoute = async ({ params }) => {
  let key: string
  try {
    key = getKey(params.path)
  } catch {
    return errorResponse('附件路径无效')
  }
  try {
    const object = await readBlogStorage(() => getBindings().ANEKO_R2.get(key))
    if (!object) return errorResponse('未找到附件', 404)
    return r2ObjectResponse(object, { cacheControl: 'public, max-age=31536000, immutable' })
  } catch (error) {
    console.error('[blog] asset read failed', { errorType: error instanceof Error ? error.name : typeof error })
    return errorResponse('附件暂时无法读取，请稍后重试', 503)
  }
}

export const PUT: APIRoute = async ({ params, request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  let path: string
  try {
    path = normalizeObjectPath(params.path || '')
  } catch {
    return errorResponse('附件路径无效')
  }
  if (!request.body) return errorResponse('请求内容不能为空')

  try {
    await bindings.ANEKO_R2.put(`${BLOG_ASSET_PREFIX}${path}`, request.body, {
      httpMetadata: {
        contentType: request.headers.get('Content-Type') || 'application/octet-stream',
      },
    })
    return successResponse({ path: `/api/blog/assets/${path}` })
  } catch (error) {
    console.error('[blog] asset upload failed', { errorType: error instanceof Error ? error.name : typeof error })
    return errorResponse('附件暂时无法上传，请稍后重试', 503)
  }
}

export const DELETE: APIRoute = async ({ params, request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  let path: string
  try {
    path = normalizeObjectPath(params.path || '')
  } catch {
    return errorResponse('附件路径无效')
  }
  try {
    await bindings.ANEKO_R2.delete(`${BLOG_ASSET_PREFIX}${path}`)
    return successResponse({ deleted: path })
  } catch (error) {
    console.error('[blog] asset deletion failed', { errorType: error instanceof Error ? error.name : typeof error })
    return errorResponse('附件暂时无法删除，请稍后重试', 503)
  }
}
