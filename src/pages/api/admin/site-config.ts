import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../utils/auth'
import { getBindings } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'
import { readHomeConfig, saveHomeConfig } from '../../../utils/site-config'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) return errorResponse('未授权访问，请重新验证', 401)
  return successResponse(await readHomeConfig(bindings))
}

export const PUT: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) return errorResponse('未授权访问，请重新验证', 401)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return errorResponse('请求内容必须是有效的 JSON')
  }

  try {
    return successResponse(await saveHomeConfig(bindings, payload))
  } catch (error) {
    console.error('[site-config] save failed', { errorType: error instanceof Error ? error.name : typeof error })
    return errorResponse('首页配置保存失败，请稍后重试', 503)
  }
}
