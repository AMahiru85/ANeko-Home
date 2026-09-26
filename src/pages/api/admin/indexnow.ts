import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../utils/auth'
import { getBindings } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'
import { allIndexNowPaths, submitIndexNow } from '../../../utils/indexnow'
import { getStoredPostIndex } from '../../../utils/posts'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const submitted = await submitIndexNow(allIndexNowPaths(await getStoredPostIndex()))
    return successResponse({ submitted })
  } catch (error) {
    console.error('[IndexNow] manual submission failed:', error instanceof Error ? error.message : 'Unknown error')
    return errorResponse('Unable to submit URLs to IndexNow', 502)
  }
}
