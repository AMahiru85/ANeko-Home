import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../utils/auth'
import { getBindings, getPhotoManifestKey } from '../../utils/cloudflare'
import { errorResponse, jsonResponse, successResponse } from '../../utils/http'
import { normalizeObjectPath } from '../../utils/r2'

export const prerender = false

interface PhotoManifestItem {
  title?: string
  date?: string
  description?: string
  images: { img: string }[]
}

function isManifest(value: unknown): value is PhotoManifestItem[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false
    const photo = item as Partial<PhotoManifestItem>
    if (photo.title !== undefined && typeof photo.title !== 'string') return false
    if (photo.date !== undefined && typeof photo.date !== 'string') return false
    if (photo.description !== undefined && typeof photo.description !== 'string') return false
    if (!Array.isArray(photo.images)) return false

    return photo.images.every((image) => {
      if (!image || typeof image.img !== 'string' || !image.img.trim()) return false
      try {
        const normalized = normalizeObjectPath(image.img.trim())
        return normalized === image.img.trim() && !normalized.startsWith('photos/')
      } catch {
        return false
      }
    })
  })
}

export const GET: APIRoute = async () => {
  const bindings = getBindings()
  const raw = await bindings.ANEKO_KV.get(getPhotoManifestKey(bindings))
  if (!raw) return jsonResponse([], 200, 'public, max-age=30')

  try {
    const manifest = JSON.parse(raw)
    return isManifest(manifest)
      ? jsonResponse(manifest, 200, 'public, max-age=30')
      : errorResponse('Invalid photo manifest', 500)
  } catch {
    return errorResponse('Invalid photo manifest', 500)
  }
}

export const PUT: APIRoute = async ({ request }) => {
  const bindings = getBindings()
  if (!await verifyAdminRequest(request, bindings)) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const manifest = await request.json()
    if (!isManifest(manifest)) return errorResponse('Invalid photo manifest')
    await bindings.ANEKO_KV.put(getPhotoManifestKey(bindings), JSON.stringify(manifest))
    return successResponse({ count: manifest.length })
  } catch {
    return errorResponse('Invalid JSON body')
  }
}
