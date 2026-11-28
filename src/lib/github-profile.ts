import { onBeforeUnmount, onMounted, ref } from 'vue';

export const githubUsername = 'AMahiru85';
export const githubProfileUrl = `https://github.com/${githubUsername}`;

export interface GitHubProfile {
  name: string;
  bio: string;
  location: string;
  avatar: string;
  publicRepos: number;
  followers: number;
  following: number;
}

export interface GitHubContributions {
  days: Array<{ date: string; count: number; level: number }>;
  total: number;
}

export interface GitHubProfileData {
  profile: GitHubProfile | null;
  contributions: GitHubContributions | null;
}

const cacheKey = `home-new:github-profile:v1:${githubUsername.toLowerCase()}`;
const cacheLifetime = 10 * 60 * 1000;
const requestTimeout = 9000;
const githubApi = `https://api.github.com/users/${githubUsername}`;
const contributionsApi = `https://github-contributions-api.jogruber.de/v4/${githubUsername}?y=last`;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function count(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function emptyData(): GitHubProfileData {
  return { profile: null, contributions: null };
}

function normalizeProfile(value: unknown): GitHubProfile {
  if (!isRecord(value) || typeof value.login !== 'string') {
    throw new Error('Invalid GitHub profile');
  }
  return {
    name: text(value.name) || value.login,
    bio: text(value.bio),
    location: text(value.location),
    avatar: text(value.avatar_url),
    publicRepos: count(value.public_repos),
    followers: count(value.followers),
    following: count(value.following),
  };
}

function normalizeContributions(value: unknown): GitHubContributions {
  if (!isRecord(value) || !Array.isArray(value.contributions)) {
    throw new Error('Invalid GitHub contributions');
  }
  const days = value.contributions.filter(isRecord)
    .filter(day => typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date))
    .map(day => ({
      date: text(day.date),
      count: count(day.count),
      level: Math.min(4, count(day.level)),
    }));
  const reportedTotal = isRecord(value.total) ? value.total.lastYear : undefined;
  return {
    days,
    total: typeof reportedTotal === 'number' && Number.isFinite(reportedTotal)
      ? count(reportedTotal) : days.reduce((total, day) => total + day.count, 0),
  };
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/vnd.github+json, application/json' },
  });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
  return response.json();
}

function isCachedData(value: unknown): value is GitHubProfileData {
  if (!isRecord(value)) return false;
  const { profile, contributions } = value;
  const strings = (item: JsonRecord, keys: string[]) => keys.every(key => typeof item[key] === 'string');
  const numbers = (item: JsonRecord, keys: string[]) => keys.every(key => typeof item[key] === 'number' && Number.isFinite(item[key]));
  return (profile === null || isRecord(profile)
      && strings(profile, ['name', 'bio', 'location', 'avatar'])
      && numbers(profile, ['publicRepos', 'followers', 'following']))
    && (contributions === null || isRecord(contributions) && numbers(contributions, ['total'])
      && Array.isArray(contributions.days) && contributions.days.every(day => isRecord(day)
        && strings(day, ['date']) && numbers(day, ['count', 'level'])));
}

function readCache(): { cachedAt: number; data: GitHubProfileData } | null {
  try {
    const cached: unknown = JSON.parse(window.localStorage.getItem(cacheKey) || 'null');
    if (!isRecord(cached) || typeof cached.cachedAt !== 'number'
      || !Number.isFinite(cached.cachedAt) || cached.cachedAt > Date.now()
      || !isCachedData(cached.data)) return null;
    // Existing v1 cache entries may include older widget sections.
    return {
      cachedAt: cached.cachedAt,
      data: { profile: cached.data.profile, contributions: cached.data.contributions },
    };
  } catch {
    return null;
  }
}

function writeCache(data: GitHubProfileData): void {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // The widget can still show live data if browser storage is unavailable.
  }
}

export function useGitHubProfile() {
  const data = ref<GitHubProfileData>(emptyData());
  const loading = ref(true);
  let controller: AbortController | null = null;
  let disposed = false;

  async function refresh(): Promise<void> {
    if (disposed || typeof window === 'undefined') return;
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    loading.value = true;
    const timeout = window.setTimeout(() => requestController.abort(), requestTimeout);

    try {
      const results = await Promise.allSettled([
        fetchJson(githubApi, requestController.signal).then(normalizeProfile),
        fetchJson(contributionsApi, requestController.signal).then(normalizeContributions),
      ] as const);
      if (disposed || controller !== requestController) return;

      // Keep previously loaded sections when an individual endpoint is unavailable.
      const next = { ...data.value };
      if (results[0].status === 'fulfilled') next.profile = results[0].value;
      if (results[1].status === 'fulfilled') next.contributions = results[1].value;
      data.value = next;
      if (results.some(result => result.status === 'fulfilled')) writeCache(next);
    } finally {
      window.clearTimeout(timeout);
      if (!disposed && controller === requestController) {
        controller = null;
        loading.value = false;
      }
    }
  }

  onMounted(() => {
    const cached = readCache();
    if (cached) {
      data.value = cached.data;
      if (Date.now() - cached.cachedAt < cacheLifetime) {
        loading.value = false;
        return;
      }
    }
    void refresh();
  });

  onBeforeUnmount(() => {
    disposed = true;
    controller?.abort();
    controller = null;
  });

  return { data, loading, refresh };
}
