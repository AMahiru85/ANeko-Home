import type { APIRoute } from 'astro'
import {
  expiredAdminSessionCookie,
  verifyAccessCode,
  verifyAdminSession,
} from '../../../utils/auth'
import { getBindings } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  let code = ''
  try {
    const body = await request.json() as { code?: unknown }
    code = typeof body.code === 'string' ? body.code : ''
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const bindings = getBindings()
  const [validCode, validSession] = await Promise.all([
    verifyAccessCode(code, bindings.ACCESS_CODE),
    verifyAdminSession(request, bindings.TURNSTILE_SECRET),
  ])
  const valid = validCode && validSession
  const response = successResponse({ valid })
  if (!valid) response.headers.set('Set-Cookie', expiredAdminSessionCookie())
  return response
}

export const DELETE: APIRoute = async () => {
  const response = successResponse({ cleared: true })
  response.headers.set('Set-Cookie', expiredAdminSessionCookie())
  return response
}
