import { onBeforeUnmount, onMounted, ref } from 'vue'

const GITHUB_USERNAME = 'AMahiru30'
const GITHUB_API = `https://api.github.com/users/${GITHUB_USERNAME}`
const CONTRIBUTIONS_API = `https://github-contributions-api.jogruber.de/v4/${GITHUB_USERNAME}?y=last`
const CACHE_KEY = 'aneko-github-cache-v1'
const CACHE_TTL = 10 * 60 * 1000

function createRequestError(response, service) {
  const isRateLimited = response.status === 429
    || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')

  if (isRateLimited) {
    return new Error(`${service} 请求次数已用完，请稍后再试`)
  }

  return new Error(`${service} 请求失败 (${response.status})`)
}

async function fetchJson(url, signal, service) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/vnd.github+json, application/json' },
  })

  if (!response.ok) throw createRequestError(response, service)
  return response.json()
}

function normalizeProfile(data) {
  if (!data || typeof data.login !== 'string') throw new Error('GitHub 用户数据格式无效')

  return {
    login: data.login,
    name: data.name || data.login,
    avatar: data.avatar_url || '',
    bio: data.bio || '暂无个人简介。',
    location: data.location || '',
    blog: data.blog || '',
    publicRepos: Number(data.public_repos) || 0,
    followers: Number(data.followers) || 0,
    following: Number(data.following) || 0,
    url: data.html_url || `https://github.com/${GITHUB_USERNAME}`,
  }
}

function normalizeRepos(data) {
  if (!Array.isArray(data)) throw new Error('GitHub 仓库数据格式无效')

  return data
    .filter((repo) => repo && !repo.archived)
    .slice(0, 3)
    .map((repo) => ({
      id: repo.id,
      name: repo.name,
      description: repo.description || '暂无仓库描述。',
      language: repo.language || '其他',
      url: repo.html_url,
      updatedAt: repo.updated_at,
      isFork: Boolean(repo.fork),
    }))
}

function translateEventAction(value) {
  const actionLabels = {
    assigned: '指派了',
    closed: '关闭了',
    created: '创建了',
    deleted: '删除了',
    edited: '编辑了',
    labeled: '添加了标签',
    locked: '锁定了',
    milestoned: '加入了里程碑',
    opened: '开启了',
    pinned: '置顶了',
    published: '发布了',
    reopened: '重新开启了',
    synchronize: '更新了',
    synchronized: '更新了',
    unassigned: '取消指派了',
    unlabeled: '移除了标签',
    unlocked: '解锁了',
    unpinned: '取消置顶了',
    demilestoned: '移出了里程碑',
    prereleased: '预发布了',
    released: '发布了',
    unpublished: '取消发布了',
  }

  return actionLabels[value] || '更新了'
}

function translateReferenceType(value) {
  return ({ branch: '分支', repository: '仓库', tag: '标签' })[value] || '引用'
}

function describeEvent(event) {
  const payload = event.payload || {}

  switch (event.type) {
    case 'PushEvent': {
      const message = payload.commits?.[0]?.message?.split('\n')[0]
      const branch = payload.ref?.replace('refs/heads/', '')
      if (message) return `推送：${message}`
      return branch ? `推送到分支 ${branch}` : '推送了提交'
    }
    case 'CreateEvent':
      return `${translateEventAction('created')}${translateReferenceType(payload.ref_type)}${payload.ref ? ` ${payload.ref}` : ''}`
    case 'DeleteEvent':
      return `${translateEventAction('deleted')}${translateReferenceType(payload.ref_type)}${payload.ref ? ` ${payload.ref}` : ''}`
    case 'WatchEvent':
      return '收藏了仓库'
    case 'ForkEvent':
      return '派生了仓库'
    case 'IssuesEvent':
      return `${translateEventAction(payload.action)}议题`
    case 'PullRequestEvent':
      return `${translateEventAction(payload.action)}拉取请求`
    case 'ReleaseEvent':
      return `${translateEventAction(payload.action)}版本`
    case 'PublicEvent':
      return '将仓库设为公开'
    default:
      return '更新了仓库'
  }
}

function normalizeEvents(data) {
  if (!Array.isArray(data)) throw new Error('GitHub 动态数据格式无效')

  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  })

  return data.slice(0, 4).map((event) => ({
    id: event.id,
    action: describeEvent(event),
    repo: event.repo?.name?.split('/').pop() || 'GitHub',
    date: event.created_at ? dateFormatter.format(new Date(event.created_at)) : '',
  }))
}

function normalizeContributions(data) {
  if (!Array.isArray(data?.contributions)) throw new Error('GitHub 贡献数据格式无效')

  const contributions = data.contributions.map((item) => ({
    date: item.date,
    count: Math.max(0, Number(item.count) || 0),
    level: Math.min(4, Math.max(0, Number(item.level) || 0)),
  }))
  const reportedTotal = Number(data.total?.lastYear)

  return {
    contributions,
    total: Number.isFinite(reportedTotal)
      ? reportedTotal
      : contributions.reduce((sum, item) => sum + item.count, 0),
  }
}

function readCache() {
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null')
    if (!cached || typeof cached.cachedAt !== 'number' || !cached.data) return null
    return cached
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data }))
  } catch {
    // The live data remains usable when storage is unavailable.
  }
}

export function useGitHub() {
  const profile = ref(null)
  const repos = ref([])
  const events = ref([])
  const contributions = ref([])
  const totalContributions = ref(0)
  const status = ref('loading')
  const errorMessage = ref('')
  const failedSections = ref([])
  const lastUpdated = ref(null)
  let controller = null

  function snapshot() {
    return {
      profile: profile.value,
      repos: repos.value,
      events: events.value,
      contributions: contributions.value,
      totalContributions: totalContributions.value,
      failedSections: failedSections.value,
    }
  }

  function applyData(data) {
    if (data.profile) profile.value = data.profile
    if (Array.isArray(data.repos)) repos.value = data.repos
    if (Array.isArray(data.events)) events.value = data.events
    if (Array.isArray(data.contributions)) contributions.value = data.contributions
    if (Number.isFinite(Number(data.totalContributions))) {
      totalContributions.value = Number(data.totalContributions)
    }
    if (Array.isArray(data.failedSections)) failedSections.value = data.failedSections
  }

  async function refresh() {
    controller?.abort()
    const requestController = new AbortController()
    controller = requestController
    status.value = profile.value || repos.value.length || events.value.length || contributions.value.length
      ? 'refreshing'
      : 'loading'
    errorMessage.value = ''
    failedSections.value = []

    const requests = [
      ['profile', fetchJson(GITHUB_API, requestController.signal, 'GitHub')],
      ['repos', fetchJson(`${GITHUB_API}/repos?sort=updated&per_page=6`, requestController.signal, 'GitHub')],
      ['events', fetchJson(`${GITHUB_API}/events?per_page=10`, requestController.signal, 'GitHub')],
      ['contributions', fetchJson(CONTRIBUTIONS_API, requestController.signal, '贡献服务')],
    ]

    const results = await Promise.allSettled(requests.map(([, request]) => request))
    if (requestController.signal.aborted) return

    const nextData = snapshot()
    const failures = []
    const messages = []

    results.forEach((result, index) => {
      const key = requests[index][0]
      if (result.status === 'rejected') {
        failures.push(key)
        messages.push(result.reason instanceof Error ? result.reason.message : 'GitHub 数据暂不可用')
        return
      }

      try {
        if (key === 'profile') nextData.profile = normalizeProfile(result.value)
        if (key === 'repos') nextData.repos = normalizeRepos(result.value)
        if (key === 'events') nextData.events = normalizeEvents(result.value)
        if (key === 'contributions') {
          const normalized = normalizeContributions(result.value)
          nextData.contributions = normalized.contributions
          nextData.totalContributions = normalized.total
        }
      } catch (error) {
        failures.push(key)
        messages.push(error instanceof Error ? error.message : 'GitHub 数据格式无效')
      }
    })

    nextData.failedSections = failures
    applyData(nextData)
    const hasData = Boolean(nextData.profile)
      || nextData.repos.length > 0
      || nextData.events.length > 0
      || nextData.contributions.length > 0

    failedSections.value = failures
    errorMessage.value = [...new Set(messages)].join('；')
    status.value = hasData ? (failures.length ? 'partial' : 'ready') : 'error'
    lastUpdated.value = Date.now()

    if (hasData) writeCache(nextData)
    if (controller === requestController) controller = null
  }

  onMounted(() => {
    const cached = readCache()
    if (cached) {
      applyData(cached.data)
      lastUpdated.value = cached.cachedAt

      if (Date.now() - cached.cachedAt < CACHE_TTL) {
        status.value = failedSections.value.length ? 'partial' : 'ready'
        return
      }
    }

    refresh()
  })

  onBeforeUnmount(() => controller?.abort())

  return {
    username: GITHUB_USERNAME,
    profile,
    repos,
    events,
    contributions,
    totalContributions,
    status,
    errorMessage,
    failedSections,
    lastUpdated,
    refresh,
  }
}
