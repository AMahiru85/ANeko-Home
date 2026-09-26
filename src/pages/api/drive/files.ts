import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../utils/auth'
import { getBindings, getDrivePrefix } from '../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../utils/http'
import { normalizeFileName, normalizeFolderPath, normalizeObjectPath } from '../../../utils/r2'

export const prerender = false

interface DriveFile {
  key: string
  size: number
  lastModified: string
  isFolder: boolean
  etag?: string
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const bindings = getBindings()
    const url = new URL(request.url)
    const prefix = normalizeFolderPath(url.searchParams.get('prefix') || '')
    const rootPrefix = getDrivePrefix(bindings)
    const objectPrefix = `${rootPrefix}${prefix}`
    const result = await bindings.ANEKO_R2.list({
      prefix: objectPrefix,
      delimiter: '/',
      cursor: url.searchParams.get('cursor') || undefined,
    })
    const files: DriveFile[] = []

    for (const folder of result.delimitedPrefixes) {
      files.push({
        key: folder.slice(rootPrefix.length),
        size: 0,
        lastModified: '',
        isFolder: true,
      })
    }

    for (const object of result.objects) {
      if (object.key.endsWith('/.keep')) continue
      files.push({
        key: object.key.slice(rootPrefix.length),
        size: object.size,
        lastModified: object.uploaded.toISOString(),
        isFolder: false,
        etag: object.etag,
      })
    }

    return successResponse({
      files,
      prefix,
      truncated: result.truncated,
      cursor: result.truncated ? result.cursor : undefined,
    })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '读取文件列表失败')
  }
}

export const POST: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  try {
    const formData = await request.formData()
    const prefix = normalizeFolderPath(String(formData.get('prefix') || ''))
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)
    if (!files.length) return errorResponse('请先选择要上传的文件')

    const uploaded: string[] = []
    for (const file of files) {
      const fileName = normalizeFileName(file.name)
      const key = `${getDrivePrefix(bindings)}${prefix}${fileName}`
      await bindings.ANEKO_R2.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      })
      uploaded.push(`${prefix}${fileName}`)
    }

    return successResponse({ uploaded }, 201)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '文件上传失败')
  }
}

export const DELETE: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('未授权访问，请重新验证', 401)
  }

  try {
    const url = new URL(request.url)
    const rawKey = url.searchParams.get('key') || ''
    const isFolder = rawKey.endsWith('/')
    const relativeKey = isFolder
      ? normalizeFolderPath(rawKey)
      : normalizeObjectPath(rawKey)
    const key = `${getDrivePrefix(bindings)}${relativeKey}`

    if (!isFolder) {
      await bindings.ANEKO_R2.delete(key)
      return successResponse({ deleted: relativeKey })
    }

    let cursor: string | undefined
    do {
      const list = await bindings.ANEKO_R2.list({ prefix: key, cursor })
      if (list.objects.length) {
        await bindings.ANEKO_R2.delete(list.objects.map((object) => object.key))
      }
      cursor = list.truncated ? list.cursor : undefined
    } while (cursor)

    return successResponse({ deleted: relativeKey })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '文件删除失败')
  }
}
