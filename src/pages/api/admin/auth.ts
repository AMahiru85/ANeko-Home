import type { APIRoute } from 'astro'
import { adminSessionCookie, createAdminSessionToken, verifyAccessCode } from '../../../utils/auth'
import { getBindings } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'
import { verifyTurnstileToken } from '../../../utils/turnstile'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  let code = ''
  let turnstileToken: unknown

  try {
    const body = await request.json() as { code?: unknown; 'cf-turnstile-response'?: unknown }
    code = typeof body.code === 'string' ? body.code : ''
    turnstileToken = body['cf-turnstile-response']
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const bindings = getBindings()
  if (!await verifyTurnstileToken(turnstileToken, request, bindings)) {
    return errorResponse('Turnstile verification failed', 403)
  }

  const valid = await verifyAccessCode(code, bindings.ACCESS_CODE)
  if (!valid) return successResponse({ valid: false })

  try {
    const sessionToken = await createAdminSessionToken(bindings.TURNSTILE_SECRET)
    const response = successResponse({ valid: true })
    response.headers.set('Set-Cookie', adminSessionCookie(sessionToken))
    return response
  } catch {
    return errorResponse('Unable to create admin session', 500)
  }
}
