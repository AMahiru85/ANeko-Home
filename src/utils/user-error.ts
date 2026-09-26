const STATUS_MESSAGES: Record<number, string> = {
  400: '请求内容有误，请检查后重试。',
  401: '登录状态已失效，请重新登录。',
  403: '当前操作未获授权。',
  404: '请求的内容不存在或已被删除。',
  408: '请求超时，请稍后重试。',
  413: '文件或内容过大，请缩小后重试。',
  429: '操作过于频繁，请稍后重试。',
  500: '服务发生错误，请稍后重试。',
  502: '服务暂时无法连接，请稍后重试。',
  503: '服务暂时不可用，请稍后重试。',
  504: '服务响应超时，请稍后重试。',
}

function statusMessage(status: number, fallback: string) {
  return STATUS_MESSAGES[status]
    || (status >= 500 ? '服务暂时不可用，请稍后重试。' : fallback)
}

function isChineseMessage(message: string) {
  return /[\u3400-\u9fff]/u.test(message)
}

export function userErrorMessage(error: unknown, fallback = '操作失败，请稍后重试。') {
  if (!error || typeof error !== 'object') return fallback

  const candidate = error as { message?: unknown; status?: unknown }
  const message = typeof candidate.message === 'string' ? candidate.message.trim() : ''
  const status = typeof candidate.status === 'number' ? candidate.status : null

  if (status !== null && status >= 400 && !isChineseMessage(message)) {
    return statusMessage(status, fallback)
  }

  const statusMatch = message.match(/(?:HTTP\s*)?([45]\d{2})\b|请求失败\s*[（(]([45]\d{2})[）)]/iu)
  if (statusMatch) {
    const parsedStatus = Number(statusMatch[1] || statusMatch[2])
    if (!isChineseMessage(message)) return statusMessage(parsedStatus, fallback)
    return statusMessage(parsedStatus, fallback)
  }

  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|internet disconnected/iu.test(message)) {
    return '网络连接失败，请检查网络后重试。'
  }

  if (isChineseMessage(message)) return message
  return fallback
}
