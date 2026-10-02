import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../utils/auth'
import { getBindings } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'
import { normalizeSiteContent, readAdminSiteContent, SiteContentReadError, writeSiteContent } from '../../../utils/site-content'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) return errorResponse('未授权访问，请重新验证', 401)
  try {
    return successResponse(await readAdminSiteContent(bindings))
  } catch (error) {
    if (error instanceof SiteContentReadError) return errorResponse(error.message, error.status)
    return errorResponse('暂时无法读取站点内容，请稍后重试。', 503)
  }
}

export const PUT: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) return errorResponse('未授权访问，请重新验证', 401)

  const declaredLength = Number(request.headers.get('Content-Length') || 0)
  if (declaredLength > 64 * 1024) return errorResponse('站点内容不能超过 64 KB', 413)

  let body: unknown
  try {
    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > 64 * 1024) return errorResponse('站点内容不能超过 64 KB', 413)
    body = JSON.parse(raw)
  } catch {
    return errorResponse('请求内容不是有效的 JSON')
  }

  let content: ReturnType<typeof normalizeSiteContent>
  try {
    content = normalizeSiteContent(body)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '站点内容无效')
  }

  try {
    return successResponse(await writeSiteContent(bindings, content))
  } catch {
    return errorResponse('站点内容保存失败，请稍后重试。', 500)
  }
}
