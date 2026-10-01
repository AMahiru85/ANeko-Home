export const SITE_CONFIG_KEY = 'site:home-config'

export interface HomeTimelineItem {
  date: string
  text: string
}

export interface HomeConfig {
  githubUsername: string
  welcome: string
  role: string
  quote: string
  location: string
  education: string
  tags: string[]
  timeline: HomeTimelineItem[]
}

export const DEFAULT_HOME_CONFIG: HomeConfig = {
  githubUsername: 'AMahiru85',
  welcome: "Hello I'm ANeko !",
  role: '🙂 Full Stack Developer',
  quote: '📝 The only way to do great is to love what you do.',
  location: 'China-GuangXi',
  education: 'No.1 middle school',
  tags: ['电子养胃中', '网页', 'linux', 'Vue', '前端'],
  timeline: [
    { text: '添加完整后端\n全面整合完善主页', date: '2026.7' },
    { text: '敬请期待...', date: '2026.6' },
    { text: '实现全站内容\n开源与无服务器化', date: '2026.5' },
    { text: '注册域名\naneko.ink', date: '2026.5' },
    { text: 'Vue重构主页', date: '2026.5' },
    { text: '更新博客', date: '2026.5' },
    { text: '...', date: '...' },
    { text: '注册域名\natbspb.online', date: '2025.9' },
    { text: '搭建第一个网站', date: '2025.8' },
  ],
}

function cleanText(value: unknown, fallback: string, maxLength = 240) {
  if (typeof value !== 'string') return fallback
  const result = value.trim().slice(0, maxLength)
  return result || fallback
}

function cleanUsername(value: unknown) {
  const username = cleanText(value, DEFAULT_HOME_CONFIG.githubUsername, 39)
  return /^[A-Za-z0-9-]+$/.test(username) ? username : DEFAULT_HOME_CONFIG.githubUsername
}

function cleanList(value: unknown, fallback: string[], maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [...fallback]
  const result = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
  return result
}

function normalizeTimeline(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_HOME_CONFIG.timeline.map((item) => ({ ...item }))
  const result = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      text: cleanText(item.text, '', 280),
      date: cleanText(item.date, '', 32),
    }))
    .filter((item) => item.text && item.date)
    .slice(0, 30)
  return result
}

export function normalizeHomeConfig(value: unknown): HomeConfig {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    githubUsername: cleanUsername(source.githubUsername),
    welcome: cleanText(source.welcome, DEFAULT_HOME_CONFIG.welcome),
    role: cleanText(source.role, DEFAULT_HOME_CONFIG.role),
    quote: cleanText(source.quote, DEFAULT_HOME_CONFIG.quote),
    location: cleanText(source.location, DEFAULT_HOME_CONFIG.location, 120),
    education: cleanText(source.education, DEFAULT_HOME_CONFIG.education, 120),
    tags: cleanList(source.tags, DEFAULT_HOME_CONFIG.tags, 12, 32),
    timeline: normalizeTimeline(source.timeline),
  }
}

export async function readHomeConfig(bindings: Env): Promise<HomeConfig> {
  try {
    const raw = await bindings.ANEKO_KV.get(SITE_CONFIG_KEY)
    return normalizeHomeConfig(raw ? JSON.parse(raw) : undefined)
  } catch (error) {
    console.error('[site-config] read failed', { errorType: error instanceof Error ? error.name : typeof error })
    return normalizeHomeConfig(undefined)
  }
}

export async function saveHomeConfig(bindings: Env, value: unknown): Promise<HomeConfig> {
  const config = normalizeHomeConfig(value)
  await bindings.ANEKO_KV.put(SITE_CONFIG_KEY, JSON.stringify(config))
  return config
}
