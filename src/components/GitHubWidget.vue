<template>
  <section class="githubModule" aria-labelledby="github-module-title" :aria-busy="isBusy">
    <div class="githubModuleHeader">
      <div class="githubModuleTitle">
        <svg class="githubMark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.88c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.82c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.77c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"></path>
        </svg>
        <div>
          <p class="githubEyebrow">GitHub</p>
          <h2 id="github-module-title">Developer Activity</h2>
        </div>
      </div>

      <button
        class="githubRefresh"
        type="button"
        :disabled="isBusy"
        :title="isBusy ? '正在刷新 GitHub 信息' : '刷新 GitHub 信息'"
        :aria-label="isBusy ? '正在刷新 GitHub 信息' : '刷新 GitHub 信息'"
        @click="refresh"
      >
        <svg :class="{ 'is-spinning': isBusy }" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"></path>
        </svg>
      </button>
    </div>

    <div v-if="isInitialLoading" class="githubSkeleton" aria-hidden="true">
      <div class="githubProfileCard githubSkeletonBlock githubSkeletonProfile"></div>
      <div class="githubOverviewGrid">
        <div class="githubContributionCard githubSkeletonBlock githubSkeletonLarge"></div>
        <div class="githubActivityCard githubSkeletonBlock githubSkeletonLarge"></div>
      </div>
      <div class="githubRepositoryGrid">
        <div v-for="item in 3" :key="item" class="githubRepoCard githubSkeletonBlock githubSkeletonRepo"></div>
      </div>
    </div>

    <div v-else-if="status === 'error' && !hasData" class="githubErrorState" role="alert">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7v6M12 17h.01"></path>
      </svg>
      <div>
        <h3>GitHub 信息暂不可用</h3>
        <p>{{ errorMessage || '请稍后重新加载。' }}</p>
      </div>
      <button type="button" @click="refresh">重新加载</button>
    </div>

    <template v-else>
      <article class="githubProfileCard">
        <a class="githubAvatar" :href="profileUrl" target="_blank" rel="noreferrer" :aria-label="`打开 ${displayLogin} 的 GitHub 主页`">
          <img v-if="profile?.avatar" :src="profile.avatar" alt="" width="64" height="64" decoding="async" />
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M4 21a8 8 0 0 1 16 0"></path>
          </svg>
        </a>

        <div class="githubIdentity">
          <p class="githubHandle">@{{ displayLogin }}</p>
          <h3>{{ profile?.name || displayLogin }}</h3>
          <p class="githubBio">{{ profile?.bio || 'GitHub profile details are temporarily unavailable.' }}</p>
          <p v-if="profile?.location" class="githubLocation">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path>
              <circle cx="12" cy="10" r="2.5"></circle>
            </svg>
            {{ profile.location }}
          </p>
        </div>

        <dl v-if="profile" class="githubStats">
          <div>
            <dt>Repositories</dt>
            <dd>{{ profile.publicRepos }}</dd>
          </div>
          <div>
            <dt>Followers</dt>
            <dd>{{ profile.followers }}</dd>
          </div>
          <div>
            <dt>Following</dt>
            <dd>{{ profile.following }}</dd>
          </div>
        </dl>

        <a class="githubProfileLink" :href="profileUrl" target="_blank" rel="noreferrer" :aria-label="`在 GitHub 查看 ${displayLogin}`">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 17 17 7M7 7h10v10"></path>
          </svg>
        </a>
      </article>

      <p v-if="status === 'partial'" class="githubPartialNotice" role="status" :aria-label="errorMessage">
        部分 GitHub 数据暂不可用，已显示可用内容。
      </p>

      <div class="githubOverviewGrid">
        <article class="githubContributionCard">
          <div class="githubCardHeader">
            <div>
              <p class="githubCardEyebrow">Contributions</p>
              <h3>{{ totalContributions }} in the last year</h3>
            </div>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="4" height="4" rx="1"></rect>
              <rect x="10" y="3" width="4" height="4" rx="1"></rect>
              <rect x="17" y="3" width="4" height="4" rx="1"></rect>
              <rect x="3" y="10" width="4" height="4" rx="1"></rect>
              <rect x="10" y="10" width="4" height="4" rx="1"></rect>
              <rect x="17" y="10" width="4" height="4" rx="1"></rect>
              <rect x="3" y="17" width="4" height="4" rx="1"></rect>
              <rect x="10" y="17" width="4" height="4" rx="1"></rect>
              <rect x="17" y="17" width="4" height="4" rx="1"></rect>
            </svg>
          </div>

          <div v-if="contributionCells.length" class="githubCalendarScroller" tabindex="0" aria-label="近一年 GitHub 贡献日历">
            <div class="githubCalendar" :style="calendarStyle">
              <div class="githubMonthTrack" aria-hidden="true">
                <span v-for="month in monthLabels" :key="`${month.index}-${month.label}`" :style="{ left: `${month.index * 9}px` }">
                  {{ month.label }}
                </span>
              </div>
              <div class="githubCalendarBody">
                <div class="githubWeekdays" aria-hidden="true">
                  <span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span>
                </div>
                <div class="githubCalendarCells">
                  <span
                    v-for="(day, index) in contributionCells"
                    :key="day.date || `blank-${index}`"
                    class="githubContributionCell"
                    :class="day.isBlank ? 'is-blank' : `level-${day.level}`"
                    :title="day.isBlank ? '' : `${day.date}: ${day.count} contribution${day.count === 1 ? '' : 's'}`"
                  ></span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="githubCardEmpty">
            {{ failedSections.includes('contributions') ? 'Contribution data unavailable.' : 'No public contributions found.' }}
          </div>

          <div class="githubContributionFooter">
            <a :href="profileUrl" target="_blank" rel="noreferrer">View on GitHub</a>
            <div class="githubLegend" aria-label="贡献强度从少到多">
              <span>Less</span>
              <i v-for="level in 5" :key="level" :class="`level-${level - 1}`"></i>
              <span>More</span>
            </div>
          </div>
        </article>

        <article class="githubActivityCard">
          <div class="githubCardHeader githubActivityHeader">
            <div>
              <p class="githubCardEyebrow">Recent Activity</p>
              <h3>Public events</h3>
            </div>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="6" cy="5" r="2"></circle>
              <circle cx="18" cy="6" r="2"></circle>
              <circle cx="6" cy="19" r="2"></circle>
              <path d="M6 7v10M8 7c4 0 3 6 8 6M18 8v9"></path>
            </svg>
          </div>

          <div v-if="events.length" class="githubEventList">
            <div v-for="event in events" :key="event.id" class="githubEventItem">
              <div>
                <p>{{ event.action }}</p>
                <span>{{ event.repo }}</span>
              </div>
              <time>{{ event.date }}</time>
            </div>
          </div>
          <div v-else class="githubCardEmpty">
            {{ failedSections.includes('events') ? 'Activity data unavailable.' : 'No recent public activity.' }}
          </div>

          <a class="githubActivityLink" :href="profileUrl" target="_blank" rel="noreferrer">View all activity</a>
        </article>
      </div>

      <div class="githubRepositoryHeader">
        <p>Updated Repositories</p>
        <span>{{ repos.length }} shown</span>
      </div>

      <div v-if="repos.length" class="githubRepositoryGrid">
        <a v-for="repo in repos" :key="repo.id" class="githubRepoCard" :href="repo.url" target="_blank" rel="noreferrer">
          <div>
            <div class="githubRepoTopline">
              <span>{{ repo.isFork ? 'Forked Repository' : 'Repository' }}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 17 17 7M7 7h10v10"></path>
              </svg>
            </div>
            <h3>{{ repo.name }}</h3>
            <p>{{ repo.description }}</p>
          </div>
          <div class="githubRepoMeta">
            <span><i :style="{ backgroundColor: languageColor(repo.language) }"></i>{{ repo.language }}</span>
            <time v-if="repo.updatedAt">{{ formatRepoDate(repo.updatedAt) }}</time>
          </div>
        </a>
      </div>
      <div v-else class="githubRepoEmpty">
        {{ failedSections.includes('repos') ? 'Repository data unavailable.' : 'No public repositories found.' }}
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useGitHub } from '../composables/useGitHub.js'

const {
  username,
  profile,
  repos,
  events,
  contributions,
  totalContributions,
  status,
  errorMessage,
  failedSections,
  refresh,
} = useGitHub()

const isBusy = computed(() => status.value === 'loading' || status.value === 'refreshing')
const isInitialLoading = computed(() => status.value === 'loading' && !hasData.value)
const hasData = computed(() => Boolean(profile.value)
  || repos.value.length > 0
  || events.value.length > 0
  || contributions.value.length > 0)
const displayLogin = computed(() => profile.value?.login || username)
const profileUrl = computed(() => profile.value?.url || `https://github.com/${username}`)

const contributionCells = computed(() => {
  if (!contributions.value.length) return []

  const cells = [...contributions.value]
  const firstDay = new Date(`${cells[0].date}T00:00:00Z`).getUTCDay()
  for (let index = 0; index < firstDay; index += 1) cells.unshift({ isBlank: true })
  while (cells.length % 7 !== 0) cells.push({ isBlank: true })
  return cells
})

const weekCount = computed(() => contributionCells.value.length / 7)
const calendarStyle = computed(() => ({
  '--calendar-grid-width': `${Math.max(0, weekCount.value * 9 - 2)}px`,
}))

const monthLabels = computed(() => {
  const labels = []
  let previousMonth = -1
  let previousIndex = -4

  for (let index = 0; index < weekCount.value; index += 1) {
    const week = contributionCells.value.slice(index * 7, index * 7 + 7)
    const firstRealDay = week.find((day) => !day.isBlank)
    if (!firstRealDay) continue

    const date = new Date(`${firstRealDay.date}T00:00:00Z`)
    const month = date.getUTCMonth()
    if (month !== previousMonth && index - previousIndex >= 3) {
      labels.push({ index, label: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) })
      previousMonth = month
      previousIndex = index
    }
  }

  return labels
})

const languageColors = {
  Astro: '#ff5d01',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Java: '#b07219',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  TypeScript: '#3178c6',
  Vue: '#41b883',
}

const repoDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function languageColor(language) {
  return languageColors[language] || '#a3a3a3'
}

function formatRepoDate(date) {
  return repoDateFormatter.format(new Date(date))
}
</script>

<style scoped>
.githubModule {
  width: calc(100% - 14px);
  margin: 34px 7px 18px;
  color: var(--main_text_color);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.githubModuleHeader,
.githubModuleTitle,
.githubProfileCard,
.githubCardHeader,
.githubCalendarBody,
.githubContributionFooter,
.githubLegend,
.githubRepoTopline,
.githubRepoMeta,
.githubRepositoryHeader,
.githubLocation {
  display: flex;
  align-items: center;
}

.githubModuleHeader {
  min-height: 48px;
  justify-content: space-between;
  margin-bottom: 14px;
}

.githubModuleTitle {
  min-width: 0;
  gap: 12px;
}

.githubModuleTitle h2 {
  margin: 2px 0 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 27px;
}

.githubEyebrow,
.githubCardEyebrow,
.githubHandle,
.githubRepoTopline span,
.githubRepositoryHeader p {
  margin: 0;
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  text-transform: uppercase;
  opacity: 0.56;
}

.githubMark {
  width: 28px;
  height: 28px;
  fill: currentColor;
}

.githubRefresh,
.githubErrorState button {
  border: 1px solid var(--module_dock_border);
  color: var(--main_text_color);
  background: var(--item_bg_color);
  cursor: pointer;
}

.githubRefresh {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition: transform 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
}

.githubRefresh:hover:not(:disabled) {
  background: var(--item_hover_color);
  transform: translateY(-2px);
}

.githubRefresh:active:not(:disabled) {
  transform: scale(0.96);
}

.githubRefresh:focus-visible,
.githubCalendarScroller:focus-visible,
.githubErrorState button:focus-visible,
.githubProfileLink:focus-visible,
.githubRepoCard:focus-visible {
  outline: 2px solid var(--fill);
  outline-offset: 2px;
}

.githubRefresh:disabled {
  cursor: wait;
  opacity: 0.55;
}

.githubRefresh svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.githubRefresh svg.is-spinning {
  animation: githubSpin 0.9s linear infinite;
}

.githubProfileCard,
.githubContributionCard,
.githubActivityCard,
.githubRepoCard,
.githubErrorState,
.githubRepoEmpty {
  border: 1px solid var(--module_dock_border);
  border-radius: 24px;
  background: var(--item_bg_color);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
}

.githubProfileCard:hover,
.githubContributionCard:hover,
.githubActivityCard:hover,
.githubRepoCard:hover {
  border-color: var(--module_dock_active_border);
  background: var(--item_hover_color);
}

.githubProfileCard {
  position: relative;
  min-width: 0;
  min-height: 132px;
  padding: 24px;
  gap: 18px;
}

.githubAvatar {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  border: 1px solid var(--module_dock_border);
  border-radius: 50%;
  overflow: hidden;
  color: var(--main_text_color);
  background: var(--module_dock_inactive_bg);
}

.githubAvatar img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.githubAvatar svg {
  width: 100%;
  height: 100%;
  padding: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
}

.githubIdentity {
  min-width: 0;
  flex: 1 1 auto;
}

.githubIdentity h3 {
  margin: 2px 0 0;
  overflow: hidden;
  font-size: 21px;
  font-weight: 600;
  line-height: 27px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.githubBio {
  max-width: 44ch;
  margin: 6px 0 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 17px;
  opacity: 0.67;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.githubLocation {
  gap: 5px;
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 14px;
  opacity: 0.5;
}

.githubLocation svg {
  width: 11px;
  height: 11px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
}

.githubStats {
  margin: 0 40px 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(74px, 1fr));
  gap: 8px;
}

.githubStats div {
  min-width: 0;
  padding-left: 14px;
  border-left: 1px solid var(--module_dock_border);
}

.githubStats dt {
  overflow: hidden;
  font-size: 9px;
  line-height: 13px;
  opacity: 0.5;
  text-overflow: ellipsis;
  text-transform: uppercase;
}

.githubStats dd {
  margin: 4px 0 0;
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  font-weight: 300;
  line-height: 25px;
}

.githubProfileLink {
  position: absolute;
  top: 22px;
  right: 22px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: inherit;
}

.githubProfileLink:hover {
  background: var(--left_tag_item);
}

.githubProfileLink svg,
.githubRepoTopline svg,
.githubCardHeader > svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.githubPartialNotice {
  margin: 10px 2px 0;
  font-size: 11px;
  line-height: 16px;
  opacity: 0.7;
}

.githubOverviewGrid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(255px, 1fr);
  gap: 18px;
}

.githubContributionCard,
.githubActivityCard {
  min-width: 0;
  min-height: 268px;
  padding: 18px;
}

.githubContributionCard {
  display: flex;
  flex-direction: column;
}

.githubCardHeader {
  min-width: 0;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.githubCardHeader h3 {
  margin: 3px 0 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 19px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.githubCardHeader > svg {
  flex: 0 0 auto;
  opacity: 0.56;
}

.githubCalendarScroller {
  width: 100%;
  min-width: 0;
  padding: 13px 13px 10px;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid color-mix(in srgb, var(--module_dock_border) 72%, transparent);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.08);
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}

.githubCalendarScroller::-webkit-scrollbar {
  width: auto;
  height: 3px;
}

.githubCalendarScroller::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.25);
}

.githubCalendar {
  width: calc(var(--calendar-grid-width) + 29px);
  min-width: calc(var(--calendar-grid-width) + 29px);
}

.githubMonthTrack {
  position: relative;
  width: var(--calendar-grid-width);
  height: 14px;
  margin: 0 0 5px 29px;
}

.githubMonthTrack span {
  position: absolute;
  top: 0;
  font-size: 8px;
  line-height: 12px;
  opacity: 0.55;
}

.githubCalendarBody {
  align-items: flex-start;
}

.githubWeekdays {
  width: 29px;
  flex: 0 0 29px;
  display: grid;
  grid-template-rows: repeat(7, 7px);
  gap: 2px;
  font-size: 7px;
  line-height: 7px;
  opacity: 0.54;
}

.githubCalendarCells {
  width: var(--calendar-grid-width);
  display: grid;
  grid-template-rows: repeat(7, 7px);
  grid-auto-flow: column;
  grid-auto-columns: 7px;
  gap: 2px;
}

.githubContributionCell,
.githubLegend i {
  display: block;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.09);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.035);
}

.githubContributionCell {
  width: 7px;
  height: 7px;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.githubContributionCell:not(.is-blank):hover {
  z-index: 1;
  filter: brightness(1.18);
  transform: scale(1.25);
}

.githubContributionCell.is-blank {
  visibility: hidden;
}

.githubContributionCell.level-1,
.githubLegend i.level-1 { background: #9be9a8; }
.githubContributionCell.level-2,
.githubLegend i.level-2 { background: #40c463; }
.githubContributionCell.level-3,
.githubLegend i.level-3 { background: #30a14e; }
.githubContributionCell.level-4,
.githubLegend i.level-4 { background: #216e39; }

.githubContributionFooter {
  justify-content: space-between;
  gap: 14px;
  margin-top: auto;
  padding-top: 16px;
  font-size: 9px;
  line-height: 13px;
  opacity: 0.68;
}

.githubContributionFooter a,
.githubActivityLink {
  color: inherit;
}

.githubContributionFooter a:hover,
.githubActivityLink:hover {
  text-decoration: underline;
}

.githubLegend {
  flex: 0 0 auto;
  gap: 4px;
}

.githubLegend i {
  width: 9px;
  height: 9px;
}

.githubActivityCard {
  display: flex;
  flex-direction: column;
}

.githubActivityHeader {
  padding-bottom: 9px;
  border-bottom: 1px solid color-mix(in srgb, var(--module_dock_border) 70%, transparent);
}

.githubEventList {
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.githubEventItem {
  min-width: 0;
  min-height: 37px;
  padding: 4px 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--module_dock_border) 54%, transparent);
}

.githubEventItem:last-child {
  border-bottom: 0;
}

.githubEventItem > div {
  min-width: 0;
}

.githubEventItem p,
.githubEventItem span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.githubEventItem p {
  margin: 0;
  font-size: 11px;
  font-weight: 500;
  line-height: 15px;
}

.githubEventItem span,
.githubEventItem time {
  font-size: 9px;
  line-height: 13px;
  opacity: 0.55;
}

.githubEventItem span {
  display: block;
  margin-top: 1px;
}

.githubEventItem time {
  flex: 0 0 auto;
}

.githubActivityLink {
  margin-top: auto;
  padding-top: 9px;
  border-top: 1px solid color-mix(in srgb, var(--module_dock_border) 70%, transparent);
  font-size: 9px;
  line-height: 13px;
  text-align: right;
  opacity: 0.68;
}

.githubCardEmpty {
  min-height: 120px;
  flex: 1 1 auto;
  display: grid;
  place-items: center;
  padding: 18px;
  font-size: 11px;
  text-align: center;
  opacity: 0.55;
}

.githubRepositoryHeader {
  justify-content: space-between;
  margin: 22px 2px 10px;
}

.githubRepositoryHeader span {
  font-size: 9px;
  opacity: 0.5;
}

.githubRepositoryGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.githubRepoCard {
  min-width: 0;
  min-height: 174px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: inherit;
}

.githubRepoCard:hover {
  transform: translateY(-2px);
}

.githubRepoCard:active {
  transform: scale(0.98);
}

.githubRepoTopline {
  justify-content: space-between;
  gap: 10px;
}

.githubRepoTopline svg {
  flex: 0 0 auto;
  opacity: 0.55;
  transition: transform 0.2s ease;
}

.githubRepoCard:hover .githubRepoTopline svg {
  transform: translate(2px, -2px);
}

.githubRepoCard h3 {
  margin: 16px 0 0;
  overflow: hidden;
  font-size: 16px;
  font-weight: 600;
  line-height: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.githubRepoCard > div > p {
  margin: 7px 0 0;
  display: -webkit-box;
  overflow: hidden;
  font-size: 10px;
  line-height: 15px;
  opacity: 0.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.githubRepoMeta {
  justify-content: space-between;
  gap: 10px;
  margin-top: 20px;
  font-size: 9px;
  line-height: 13px;
  opacity: 0.65;
}

.githubRepoMeta span {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.githubRepoMeta i {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
}

.githubRepoMeta time {
  flex: 0 0 auto;
}

.githubErrorState {
  min-height: 180px;
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.githubErrorState > svg {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  opacity: 0.65;
}

.githubErrorState h3 {
  margin: 0;
  font-size: 15px;
}

.githubErrorState p {
  max-width: 46ch;
  margin: 5px 0 0;
  font-size: 11px;
  line-height: 16px;
  opacity: 0.6;
}

.githubErrorState button {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 11px;
}

.githubRepoEmpty {
  min-height: 110px;
  padding: 24px;
  display: grid;
  place-items: center;
  font-size: 11px;
  opacity: 0.6;
}

.githubSkeletonBlock {
  position: relative;
  overflow: hidden;
}

.githubSkeletonBlock::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.12) 42%, transparent 64%);
  transform: translateX(-100%);
  animation: githubSkeletonSweep 1.35s ease-in-out infinite;
}

.githubSkeletonProfile {
  min-height: 132px;
}

.githubSkeletonLarge {
  min-height: 268px;
}

.githubSkeletonRepo {
  min-height: 174px;
}

@keyframes githubSpin {
  to { transform: rotate(360deg); }
}

@keyframes githubSkeletonSweep {
  to { transform: translateX(100%); }
}

@media (max-width: 1100px) {
  .githubOverviewGrid {
    grid-template-columns: 1fr;
  }

  .githubRepositoryGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .githubActivityCard {
    min-height: 268px;
  }
}

@media (max-width: 920px) {
  .githubProfileCard {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .githubStats {
    width: calc(100% - 82px);
    margin: 0 0 0 82px;
  }
}

@media (max-width: 680px) {
  .githubModule {
    width: calc(100% - 18px);
    margin-inline: 9px;
  }

  .githubProfileCard,
  .githubContributionCard,
  .githubActivityCard,
  .githubRepoCard,
  .githubErrorState {
    border-radius: 20px;
  }

  .githubProfileCard,
  .githubContributionCard,
  .githubActivityCard {
    padding: 18px;
  }

  .githubRepositoryGrid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .githubRepoCard {
    min-height: 158px;
  }

  .githubStats {
    width: 100%;
    margin: 2px 0 0;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .githubStats div:first-child {
    padding-left: 0;
    border-left: 0;
  }

  .githubContributionFooter {
    align-items: flex-start;
    flex-direction: column;
  }

  .githubErrorState {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 420px) {
  .githubModuleTitle h2 {
    font-size: 19px;
  }

  .githubProfileCard {
    gap: 14px;
  }

  .githubAvatar {
    width: 54px;
    height: 54px;
    flex-basis: 54px;
  }

  .githubIdentity {
    width: calc(100% - 68px);
    flex-basis: calc(100% - 68px);
  }

  .githubIdentity h3 {
    padding-right: 20px;
    font-size: 18px;
  }

  .githubBio {
    white-space: normal;
  }

  .githubProfileLink {
    top: 18px;
    right: 18px;
  }

  .githubStats dt {
    font-size: 8px;
  }

  .githubStats dd {
    font-size: 19px;
  }

  .githubCalendarScroller {
    padding-inline: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .githubRefresh,
  .githubProfileCard,
  .githubContributionCard,
  .githubActivityCard,
  .githubRepoCard,
  .githubContributionCell,
  .githubRepoTopline svg {
    transition: none;
  }

  .githubRefresh svg.is-spinning,
  .githubSkeletonBlock::after {
    animation: none;
  }
}
</style>
