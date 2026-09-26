import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../utils/auth'
import { getBindings } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'
import { allIndexNowPaths, IndexNowError, submitIndexNow } from '../../../utils/indexnow'
import { getStoredPostIndex } from '../../../utils/posts'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  let posts
  try {
    posts = await getStoredPostIndex()
  } catch (error) {
    console.error('[IndexNow] unable to read post index:', error instanceof Error ? error.message : 'Unknown error')
    return errorResponse('IndexNow 暂时无法读取博客数据，请稍后重试', 503)
  }

  try {
    const submitted = await submitIndexNow(allIndexNowPaths(posts))
    return successResponse({ submitted })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[IndexNow] manual submission failed:', message)

    if (error instanceof IndexNowError && error.kind === 'configuration') {
      return errorResponse('IndexNow 尚未正确配置，请检查密钥', 503)
    }
    if (error instanceof IndexNowError && error.kind === 'network') {
      return errorResponse('IndexNow 服务暂时无法连接，请稍后重试', 503)
    }

    return errorResponse('IndexNow 服务拒绝了这次提交，请稍后重试', 502)
  }
}
