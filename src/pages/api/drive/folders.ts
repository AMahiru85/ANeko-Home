import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../utils/auth'
import { getBindings, getDrivePrefix } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'
import { normalizeFileName, normalizeFolderPath } from '../../../utils/r2'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  try {
    const body = await request.json() as { name?: unknown; prefix?: unknown }
    const name = normalizeFileName(typeof body.name === 'string' ? body.name.trim() : '')
    const prefix = normalizeFolderPath(typeof body.prefix === 'string' ? body.prefix : '')
    const folder = `${prefix}${name}/`

    await bindings.ANEKO_R2.put(`${getDrivePrefix(bindings)}${folder}.keep`, new Uint8Array())
    return successResponse({ folder }, 201)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '创建文件夹失败')
  }
}
