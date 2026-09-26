import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../utils/auth'
import { getBindings } from '../../../utils/cloudflare'
import { errorResponse, jsonResponse, successResponse } from '../../../utils/http'
import { allIndexNowPaths, IndexNowError, submitIndexNow } from '../../../utils/indexnow'
import { getStoredPostIndex } from '../../../utils/posts'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  let posts: Awaited<ReturnType<typeof getStoredPostIndex>>
  try {
    posts = await getStoredPostIndex({ refresh: true, allowStale: false })
  } catch (error) {
    console.error('[IndexNow] unable to read post index:', { errorType: error instanceof Error ? error.name : typeof error })
    return errorResponse('IndexNow 暂时无法读取博客数据，请稍后重试', 503)
  }

  try {
    const result = await submitIndexNow(allIndexNowPaths(posts), { verifyKey: true })
    return successResponse(result, result.pending > 0 ? 202 : 200)
  } catch (error) {
    if (error instanceof IndexNowError) {
      console.error('[IndexNow] manual submission failed', {
        kind: error.kind,
        code: error.code,
        provider: error.provider,
        status: error.status,
        message: error.message,
      })
    } else {
      console.error('[IndexNow] manual submission failed', {
        errorType: error instanceof Error ? error.name : typeof error,
      })
    }

    if (error instanceof IndexNowError) {
      const status = error.kind !== 'upstream' ? 503
        : error.status === 429 ? 429
        : error.status === 400 || error.status === 422 ? error.status
        : (error.status ?? 0) >= 500 ? 503 : 502
      const progress = error.progress
      const partialMessage = progress?.submitted
        ? `其中 ${progress.submitted}/${progress.requested} 个页面已被接收，其余页面尚未提交成功。`
        : ''
      const keyVerification = progress?.keyVerification
      const verificationMessage = keyVerification?.status === 'unconfirmed'
        ? `站点自检补充：${keyVerification.message} 此自检结果不代表搜索引擎的访问结果。`
        : ''
      const response = jsonResponse({
        success: false,
        error: `${error.message}${partialMessage}${verificationMessage}`,
        diagnostic: {
          code: error.code,
          provider: error.provider,
          upstreamStatus: error.status,
          retryAfter: error.retryAfter,
          keyVerification,
          progress,
        },
      }, status)
      if (error.retryAfter) response.headers.set('Retry-After', error.retryAfter)
      return response
    }

    return errorResponse('IndexNow 提交遇到意外错误，请稍后重试', 502)
  }
}
