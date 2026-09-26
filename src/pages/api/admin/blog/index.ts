import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../../utils/auth'
import { getBindings } from '../../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../../utils/http'
import { getStoredPostIndex } from '../../../../utils/posts'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  try {
    return successResponse(await getStoredPostIndex({ refresh: true, allowStale: false }))
  } catch {
    return errorResponse('博客文章列表暂时无法读取，请稍后重试', 503)
  }
}
