export function jsonResponse(data: unknown, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, error: message }, status)
}

export function successResponse<T>(data: T, status = 200) {
  return jsonResponse({ success: true, data }, status)
}

export function r2ObjectResponse(
  object: R2ObjectBody,
  options: { cacheControl?: string; downloadName?: string } = {},
) {
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', options.cacheControl || 'public, max-age=3600')
  headers.set('ETag', object.httpEtag)

  if (options.downloadName) {
    headers.set(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(options.downloadName)}`,
    )
  }

  return new Response(object.body, { headers })
}
