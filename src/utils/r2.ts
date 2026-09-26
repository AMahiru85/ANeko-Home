export function normalizeObjectPath(value: string, allowEmpty = false) {
  const normalized = value.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')

  if (!normalized) {
    if (allowEmpty) return ''
    throw new Error('路径不能为空')
  }

  const segments = normalized.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))) {
    throw new Error('路径无效')
  }

  return segments.join('/')
}

export function normalizeFolderPath(value: string) {
  const normalized = normalizeObjectPath(value, true)
  return normalized ? `${normalized}/` : ''
}

export function normalizeFileName(value: string) {
  const normalized = normalizeObjectPath(value)
  if (normalized.includes('/')) throw new Error('文件名无效')
  return normalized
}

export function joinObjectPath(prefix: string, relativePath: string) {
  return `${prefix}${normalizeObjectPath(relativePath)}`
}
