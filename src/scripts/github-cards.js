const CARD_SELECTOR = '.githubRepoEmbed[data-github-repo]'
const CACHE_KEY = 'aneko:github-repository-cards:v1'
const CACHE_TTL = 30 * 60 * 1000
const pendingRequests = new Map()
const countFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const languageColors = {
  Astro: '#ff5d01',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Java: '#b07219',
  JavaScript: '#f1e05a',
  Kotlin: '#a97bff',
  Python: '#3572a5',
  Rust: '#dea584',
  TypeScript: '#3178c6',
  Vue: '#41b883',
}

function readCache(repository) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const entry = cache[repository.toLowerCase()]
    if (!entry || entry.expiresAt < Date.now()) return null
    return entry.data
  } catch {
    return null
  }
}

function writeCache(repository, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    cache[repository.toLowerCase()] = {
      data,
      expiresAt: Date.now() + CACHE_TTL,
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // The card remains usable when browser storage is unavailable.
  }
}

function fetchRepository(repository) {
  const cached = readCache(repository)
  if (cached) return Promise.resolve(cached)

  const key = repository.toLowerCase()
  if (pendingRequests.has(key)) return pendingRequests.get(key)

  const request = fetch(`https://api.github.com/repos/${repository}`, {
    headers: { Accept: 'application/vnd.github+json' },
    referrerPolicy: 'no-referrer',
  })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub request failed (${response.status})`)
      return response.json()
    })
    .then((data) => {
      const normalized = {
        avatar: data.owner?.avatar_url || '',
        description: data.description || '该仓库暂时没有描述。',
        forks: Math.max(0, Number(data.forks_count) || 0),
        isArchived: Boolean(data.archived),
        isFork: Boolean(data.fork),
        language: data.language || 'Other',
        license: data.license?.spdx_id || 'No license',
        stars: Math.max(0, Number(data.stargazers_count) || 0),
      }
      writeCache(repository, normalized)
      return normalized
    })
    .finally(() => pendingRequests.delete(key))

  pendingRequests.set(key, request)
  return request
}

function setField(card, field, value) {
  const target = card.querySelector(`[data-github-field="${field}"]`)
  if (target) target.textContent = value
}

function renderRepository(card, data) {
  setField(card, 'description', data.description)
  setField(card, 'language', data.language)
  setField(card, 'stars', countFormatter.format(data.stars))
  setField(card, 'forks', countFormatter.format(data.forks))
  setField(card, 'license', data.license)
  setField(card, 'status', data.isArchived ? 'Archived' : data.isFork ? 'Fork' : 'Public')

  const avatar = card.querySelector('.githubRepoEmbedAvatar img')
  if (avatar && data.avatar) avatar.src = data.avatar

  const languageDot = card.querySelector('.githubRepoEmbedLanguageDot')
  if (languageDot) {
    languageDot.style.backgroundColor = languageColors[data.language] || '#a3a3a3'
  }

  card.dataset.state = data.isArchived ? 'archived' : 'ready'
  card.setAttribute('aria-busy', 'false')
}

function renderError(card) {
  setField(card, 'description', '仓库信息暂时无法获取，点击仍可前往 GitHub。')
  setField(card, 'status', 'Unavailable')
  card.dataset.state = 'error'
  card.setAttribute('aria-busy', 'false')
}

function initializeGithubCards() {
  document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
    if (card.dataset.githubInitialized === 'true') return

    const repository = card.dataset.githubRepo
    if (!repository) return

    card.dataset.githubInitialized = 'true'
    fetchRepository(repository)
      .then((data) => renderRepository(card, data))
      .catch(() => renderError(card))
  })
}

document.addEventListener('astro:page-load', initializeGithubCards)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGithubCards, { once: true })
} else {
  initializeGithubCards()
}
