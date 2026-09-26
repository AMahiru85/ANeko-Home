import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../../utils/auth'
import { getBindings } from '../../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../../utils/http'
import { getStoredPostIndex } from '../../../../utils/posts'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('Unauthorized', 401)
  }

  return successResponse(await getStoredPostIndex())
}
