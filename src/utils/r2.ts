export function normalizeObjectPath(value: string, allowEmpty = false) {
  const normalized = value.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')

  if (!normalized) {
    if (allowEmpty) return ''
    throw new Error('Path is required')
  }

  const segments = normalized.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))) {
    throw new Error('Invalid path')
  }

  return segments.join('/')
}

export function normalizeFolderPath(value: string) {
  const normalized = normalizeObjectPath(value, true)
  return normalized ? `${normalized}/` : ''
}

export function normalizeFileName(value: string) {
  const normalized = normalizeObjectPath(value)
  if (normalized.includes('/')) throw new Error('Invalid file name')
  return normalized
}

export function joinObjectPath(prefix: string, relativePath: string) {
  return `${prefix}${normalizeObjectPath(relativePath)}`
}
