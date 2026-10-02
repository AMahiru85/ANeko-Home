export interface SiteTimelineItem {
  id: string
  date: string
  content: string
  enabled: boolean
}

export interface SiteExternalLink {
  id: string
  name: string
  meta: string
  url: string
}

export interface SiteProject {
  id: string
  name: string
  url: string
  img: string
  external: boolean
}

export interface SiteContent {
  profile: {
    greeting: string
    displayName: string
    role: string
    introduction: string
    description: string
    location: string
    education: string
    tags: string[]
  }
  github: {
    username: string
  }
  timeline: SiteTimelineItem[]
  projects: SiteProject[]
  externalLinks: SiteExternalLink[]
}

export const SITE_CONTENT_KV_KEY = 'site:content:v1'

export const DEFAULT_SITE_CONTENT: SiteContent = {
  profile: {
    greeting: "Hello I'm",
    displayName: 'ANeko',
    role: '🙂 Full Stack Developer',
    introduction: '📝 The only way to do great is to love what you do.',
    description: 'ANeko - Home 是 ANeko 的个人主页，汇集技术博客、在线云盘、网页邮箱和照片相册，记录开发实践、系统配置与日常片段，并提供常用在线服务入口。',
    location: 'China-GuangXi',
    education: 'No.1 middle school',
    tags: ['电子养胃中', '网页', 'linux', 'Vue', '前端'],
  },
  github: {
    username: 'AMahiru85',
  },
  timeline: [
    { id: 'home-backend', date: '2026.7', content: '添加完整后端\n全面整合完善主页', enabled: true },
    { id: 'coming-soon', date: '2026.6', content: '敬请期待...', enabled: true },
    { id: 'open-source', date: '2026.5', content: '实现全站内容\n开源与无服务器化', enabled: true },
    { id: 'domain-aneko', date: '2026.5', content: '注册域名\naneko.ink', enabled: true },
    { id: 'vue-home', date: '2026.5', content: 'Vue重构主页', enabled: true },
    { id: 'blog-update', date: '2026.5', content: '更新博客', enabled: true },
    { id: 'timeline-break', date: '...', content: '...', enabled: true },
    { id: 'domain-old', date: '2025.9', content: '注册域名\natbspb.online', enabled: true },
    { id: 'first-site', date: '2025.8', content: '搭建第一个网站', enabled: true },
  ],
  projects: [
    { id: 'blog', name: '博客', url: '/blog/', img: '/static/svg/blog.svg', external: false },
    { id: 'cloud', name: '云盘', url: '/drive/', img: '/static/svg/cloud.svg', external: false },
    { id: 'mail', name: '邮箱', url: '/mail/', img: '/static/svg/mail.svg', external: false },
    { id: 'photo', name: '相册', url: '/photos/', img: '/static/svg/photo.svg', external: false },
  ],
  externalLinks: [
    { id: 'ai', name: '中转', meta: 'ai.aneko.ink', url: 'https://ai.aneko.ink' },
    { id: 'probe', name: '探针', meta: 'tz.aneko.ink', url: 'https://tz.aneko.ink' },
    { id: 'edt', name: 'edt', meta: 'dl.aneko.ink', url: 'https://dl.aneko.ink/login' },
  ],
}

type JsonRecord = Record<string, unknown>

export class SiteContentReadError extends Error {
  status: 500 | 503

  constructor(message: string, status: 500 | 503) {
    super(message)
    this.name = 'SiteContentReadError'
    this.status = status
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, field: string, maxLength: number, allowEmpty = true) {
  if (typeof value !== 'string') throw new Error(`${field} 必须是文本`)
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new Error(`${field} 不能超过 ${maxLength} 个字符`)
  if (!allowEmpty && !normalized) throw new Error(`${field} 不能为空`)
  return normalized
}

function id(value: unknown, field: string) {
  const result = text(value, field, 80, false)
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new Error(`${field} 格式无效`)
  return result
}

function safeUrl(value: unknown, field: string) {
  const result = text(value, field, 2048, false)
  if (result.startsWith('/') && !result.startsWith('//') && !result.includes('\\') && !/[\u0000-\u001F\u007F]/u.test(result)) {
    try {
      const url = new URL(result, 'https://aneko.invalid')
      if (url.origin === 'https://aneko.invalid') return result
    } catch {
      // Report one consistent validation error below.
    }
  }
  try {
    const url = new URL(result)
    if (url.protocol === 'https:' || url.protocol === 'http:') return result
  } catch {
    // Report one consistent validation error below.
  }
  throw new Error(`${field} 只能使用站内路径或 HTTP(S) 链接`)
}

function itemArray<T>(value: unknown, field: string, normalize: (entry: unknown, index: number) => T, max = 30): T[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${field} 必须是最多 ${max} 项的列表`)
  return value.map(normalize)
}

function assertUniqueIds<T extends { id: string }>(items: T[], field: string) {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error(`${field}中不能有重复 ID`)
  }
  return items
}

export function normalizeSiteContent(value: unknown): SiteContent {
  if (!isRecord(value) || !isRecord(value.profile) || !isRecord(value.github)) {
    throw new Error('站点内容格式无效')
  }

  const profile = value.profile
  const github = value.github
  const username = text(github.username, 'GitHub 用户名', 39, false)
  if (!/^(?=.{1,39}$)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(username)) {
    throw new Error('GitHub 用户名格式无效')
  }

  const tags = itemArray(profile.tags, '标签', (entry, index) => text(entry, `标签 ${index + 1}`, 40, false), 20)
  const timeline = assertUniqueIds(itemArray(value.timeline, '时间线', (entry, index) => {
    if (!isRecord(entry)) throw new Error(`时间线 ${index + 1} 格式无效`)
    if (typeof entry.enabled !== 'boolean') throw new Error(`时间线 ${index + 1} 状态无效`)
    return {
      id: id(entry.id, `时间线 ${index + 1} ID`),
      date: text(entry.date, `时间线 ${index + 1} 日期`, 40, false),
      content: text(entry.content, `时间线 ${index + 1} 内容`, 500, false),
      enabled: entry.enabled,
    }
  }), '时间线')
  const projects = assertUniqueIds(itemArray(value.projects, '站内项目', (entry, index) => {
    if (!isRecord(entry) || typeof entry.external !== 'boolean') throw new Error(`站内项目 ${index + 1} 格式无效`)
    return {
      id: id(entry.id, `站内项目 ${index + 1} ID`),
      name: text(entry.name, `站内项目 ${index + 1} 名称`, 80, false),
      url: safeUrl(entry.url, `站内项目 ${index + 1} 链接`),
      img: safeUrl(entry.img, `站内项目 ${index + 1} 图标`),
      external: entry.external,
    }
  }), '站内项目')
  const externalLinks = assertUniqueIds(itemArray(value.externalLinks, '外部链接', (entry, index) => {
    if (!isRecord(entry)) throw new Error(`外部链接 ${index + 1} 格式无效`)
    return {
      id: id(entry.id, `外部链接 ${index + 1} ID`),
      name: text(entry.name, `外部链接 ${index + 1} 名称`, 80, false),
      meta: text(entry.meta, `外部链接 ${index + 1} 说明`, 120),
      url: safeUrl(entry.url, `外部链接 ${index + 1} 链接`),
    }
  }), '外部链接')

  return {
    profile: {
      greeting: text(profile.greeting, '欢迎语', 80, false),
      displayName: text(profile.displayName, '显示名称', 80, false),
      role: text(profile.role, '身份介绍', 160),
      introduction: text(profile.introduction, '介绍语', 500),
      description: text(profile.description, '站点描述', 300),
      location: text(profile.location, '所在地', 120),
      education: text(profile.education, '学校或组织', 120),
      tags,
    },
    github: { username },
    timeline,
    projects,
    externalLinks,
  }
}

export async function readAdminSiteContent(bindings: Env): Promise<SiteContent> {
  let raw: string | null
  try {
    raw = await bindings.ANEKO_KV.get(SITE_CONTENT_KV_KEY)
  } catch {
    throw new SiteContentReadError('暂时无法读取站点内容，请稍后重试。', 503)
  }

  if (!raw) return normalizeSiteContent(DEFAULT_SITE_CONTENT)

  let record: unknown
  try {
    record = JSON.parse(raw)
  } catch {
    throw new SiteContentReadError('存储的站点内容格式损坏，未载入默认值以避免覆盖。', 500)
  }
  if (!isRecord(record) || record.schemaVersion !== 1 || !('content' in record)) {
    throw new SiteContentReadError('存储的站点内容版本无效，未载入默认值以避免覆盖。', 500)
  }
  try {
    return normalizeSiteContent(record.content)
  } catch {
    throw new SiteContentReadError('存储的站点内容不符合当前格式，未载入默认值以避免覆盖。', 500)
  }
}

export async function readSiteContent(bindings: Env): Promise<SiteContent> {
  try {
    return await readAdminSiteContent(bindings)
  } catch {
    return normalizeSiteContent(DEFAULT_SITE_CONTENT)
  }
}

export async function writeSiteContent(bindings: Env, value: unknown) {
  const content = normalizeSiteContent(value)
  await bindings.ANEKO_KV.put(SITE_CONTENT_KV_KEY, JSON.stringify({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    content,
  }))
  return content
}
