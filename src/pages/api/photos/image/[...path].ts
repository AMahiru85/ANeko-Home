import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../../utils/auth'
import { getBindings, PHOTO_OBJECT_PREFIX } from '../../../../utils/cloudflare'
import { errorResponse, r2ObjectResponse, successResponse } from '../../../../utils/http'
import { normalizeObjectPath } from '../../../../utils/r2'

export const prerender = false

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const path = normalizeObjectPath(params.path || '')
    const object = await getBindings().ANEKO_R2.get(`${PHOTO_OBJECT_PREFIX}${path}`)
    if (!object) return errorResponse('未找到图片', 404)

    const downloadName = new URL(request.url).searchParams.has('download')
      ? path.split('/').at(-1)
      : undefined
    return r2ObjectResponse(object, {
      cacheControl: 'public, max-age=31536000, immutable',
      downloadName,
    })
  } catch {
    return errorResponse('图片路径无效')
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
    await bindings.ANEKO_R2.put(`${PHOTO_OBJECT_PREFIX}${path}`, request.body, {
      httpMetadata: {
        contentType: request.headers.get('Content-Type') || 'application/octet-stream',
      },
    })
    return successResponse({ path })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '图片上传失败')
  }
}

export const DELETE: APIRoute = async ({ params, request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  try {
    const path = normalizeObjectPath(params.path || '')
    await bindings.ANEKO_R2.delete(`${PHOTO_OBJECT_PREFIX}${path}`)
    return successResponse({ deleted: path })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '图片删除失败')
  }
}
