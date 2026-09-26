import type { APIRoute } from 'astro'
import { verifyAdminRequest } from './auth'
import { getBindings } from './cloudflare'
import { jsonResponse } from './http'
import {
  MAIL_REQUEST_MAX_BODY_BYTES,
  MailConfigConflictError,
  MailConfigUnavailableError,
  MailConfigValidationError,
} from './mail-config'
import {
  MailServiceConflictError,
  MailServiceInputError,
  MailServiceNotFoundError,
  MailServiceRateLimitError,
  MailServiceTooLargeError,
  MailServiceUnavailableError,
} from './mail-service'

export type AdminMailHandler = (
  context: Parameters<APIRoute>[0],
  bindings: Env,
) => Promise<Response>

export async function adminMailRoute(context: Parameters<APIRoute>[0], handler: AdminMailHandler) {
  try {
    const bindings = getBindings()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.request.method)) {
      const requestUrl = new URL(context.request.url)
      const origin = context.request.headers.get('Origin')
      if (origin && origin !== requestUrl.origin) return mailError('Forbidden', 403)
    }
    if (!await verifyAdminRequest(context.request, bindings)) {
      return mailError('Unauthorized', 401)
    }
    return await handler(context, bindings)
  } catch (error) {
    return mailExceptionResponse(error)
  }
}

export function mailExceptionResponse(error: unknown) {
  if (error instanceof MailConfigConflictError || error instanceof MailServiceConflictError) {
    return mailError(error.message, 409)
  }
  if (error instanceof MailConfigValidationError || error instanceof MailServiceInputError) {
    return mailError(error.message, 400)
  }
  if (error instanceof MailServiceNotFoundError) return mailError(error.message, 404)
  if (error instanceof MailServiceTooLargeError) return mailError(error.message, 413)
  if (error instanceof MailServiceRateLimitError) {
    return mailError(error.message, 429, { 'Retry-After': String(error.retryAfter) })
  }
  if (error instanceof MailConfigUnavailableError || error instanceof MailServiceUnavailableError) {
    return mailError('Mail service is unavailable', 503)
  }
  return mailError('Mail operation failed', 500)
}

export function mailSuccess<T>(data: T, status = 200) {
  return jsonResponse({ success: true, data }, status, 'no-store')
}

export function mailError(message: string, status: number, headers?: HeadersInit) {
  const response = jsonResponse({ success: false, error: message }, status, 'no-store')
  if (headers) {
    const extra = new Headers(headers)
    extra.forEach((value, key) => response.headers.set(key, value))
  }
  return response
}

function isJsonRequest(request: Request) {
  return request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() === 'application/json'
}

export async function readMailJson(request: Request) {
  if (!isJsonRequest(request)) throw new MailServiceInputError('Content-Type must be application/json')
  const contentLength = request.headers.get('Content-Length')
  if (contentLength && (!/^\d+$/.test(contentLength.trim())
    || Number(contentLength) > MAIL_REQUEST_MAX_BODY_BYTES)) {
    throw new MailServiceTooLargeError()
  }
  if (!request.body) throw new MailServiceInputError('Request body is required')

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > MAIL_REQUEST_MAX_BODY_BYTES) {
      await reader.cancel()
      throw new MailServiceTooLargeError()
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (!text.trim()) throw new Error('empty')
    return JSON.parse(text) as unknown
  } catch {
    throw new MailServiceInputError('Request body must contain valid JSON')
  }
}
