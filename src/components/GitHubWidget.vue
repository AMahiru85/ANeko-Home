<script setup lang="ts">
import { computed } from 'vue';
import { githubProfileUrl, githubUsername, useGitHubProfile } from '../lib/github-profile';
import { useLanguage } from '../lib/language';
import type { Language } from '../lib/locale';

const props = defineProps<{ initialLanguage: Language }>();
const { t } = useLanguage(props.initialLanguage);
const { data, loading, refresh } = useGitHubProfile();
const refreshLabel = computed(() => t(loading.value ? '正在加载 GitHub 数据' : '刷新 GitHub 数据'));
const unavailable = '暂时无法加载';
const containsHan = (text: string) => /\p{Script=Han}/u.test(text);
const calendar = computed(() => {
  const days = data.value.contributions?.days ?? [];
  if (!days.length) return [];
  const leading = new Date(days[0].date + 'T00:00:00Z').getUTCDay();
  return [...Array<null>(leading).fill(null), ...days];
});
</script>

<template>
  <section class="github-widget" :aria-label="t('GitHub 资料与贡献')" :aria-busy="loading">
    <div class="profile">
      <div class="profile-header">
        <img v-if="data.profile?.avatar" class="avatar" :src="data.profile.avatar" alt="" width="40" height="40" loading="lazy" decoding="async" />
        <div class="identity">
          <p v-if="data.profile?.name && data.profile.name !== githubUsername" class="profile-name"
            :class="{ 'chinese-text': containsHan(data.profile.name) }">{{ data.profile.name }}</p>
          <a :href="githubProfileUrl" target="_blank" rel="noopener noreferrer">@{{ githubUsername }}</a>
        </div>
        <button type="button" class="refresh" :aria-label="refreshLabel" :title="refreshLabel" :disabled="loading" @click="refresh">
          <span class="refresh-text">{{ refreshLabel }}</span>
          <span class="refresh-icon" aria-hidden="true">↻</span>
        </button>
      </div>
      <p v-if="data.profile?.bio" :class="{ 'chinese-text': containsHan(data.profile.bio) }">{{ data.profile.bio }}</p>
      <p v-if="data.profile?.location" class="muted" :class="{ 'chinese-text': containsHan(data.profile.location) }">{{ data.profile.location }}</p>
      <dl v-if="data.profile" class="stats">
        <div>
          <dt>
            <span class="repo-label">{{ t('公开仓库') }}</span>
            <span class="repo-label-short">{{ t('仓库') }}</span>
          </dt>
          <dd>{{ data.profile.publicRepos }}</dd>
        </div>
        <div><dt>{{ t('关注者') }}</dt><dd>{{ data.profile.followers }}</dd></div>
        <div><dt>{{ t('正在关注') }}</dt><dd>{{ data.profile.following }}</dd></div>
      </dl>
      <p v-else-if="!loading" class="muted status" role="status">{{ t(unavailable) }}</p>
    </div>

    <div class="contributions">
      <header class="section-header">
        <h2>{{ t('近一年贡献') }}</h2>
        <p v-if="data.contributions" class="contribution-total">{{ data.contributions.total }} <span class="contribution-unit">{{ t('次贡献') }}</span></p>
      </header>
      <div v-if="calendar.length" class="calendar-scroll" tabindex="0" role="region" :aria-label="t('近一年贡献日历')">
        <div class="calendar" aria-hidden="true">
          <span v-for="(day, index) in calendar" :key="day?.date ?? index"
            class="day" :class="day ? 'level-' + day.level : 'empty-day'"
            :title="day ? day.date + ' · ' + day.count + ' ' + t('次贡献') : undefined" />
        </div>
      </div>
      <p v-else class="muted status">{{ t(data.contributions ? '暂无公开贡献' : loading ? '正在加载' : unavailable) }}</p>
      <div v-if="calendar.length" class="legend" aria-hidden="true">
        <span>{{ t('少') }}</span><i v-for="level in 5" :key="level" class="day" :class="'level-' + (level - 1)" /><span>{{ t('多') }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.github-widget {
  display: grid;
  gap: clamp(20px, 3.2rem, 36px);
  min-width: 0;
  color: #1a1a1a;
  font-family: 'Suisse Intl', Arial, sans-serif;
  font-size: max(1.4rem, 14px);
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.profile-header, .section-header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.profile-header { align-items: center; }
.profile { display: grid; gap: 8px; }
.contributions {
  min-width: 0;
  padding-top: max(1.6rem, 12px);
  border-top: 1px solid var(--line);
}
.section-header { align-items: baseline; }
.section-header h2 { font-size: max(1.6rem, 15px); }
.contribution-total { font-variant-numeric: tabular-nums; }
.contribution-unit { color: #696969; }
.section-header + .status, .calendar-scroll { margin-top: 10px; }
.refresh {
  min-height: 32px;
  margin-left: auto;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #696969;
  font-size: max(1.3rem, 13px);
  cursor: pointer;
}
.refresh:disabled { opacity: .65; cursor: default; }
.refresh-icon, .repo-label-short { display: none; }
.refresh:enabled:hover, .github-widget a:hover { text-decoration: underline; text-underline-offset: .2em; }
.github-widget :focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.avatar { flex: none; border-radius: 50%; background: var(--paper); filter: grayscale(1); object-fit: cover; }
.identity { flex: 1 1 110px; min-width: 0; }
.profile-name { font-size: max(1.8rem, 17px); line-height: 1.2; }
.profile-name + a { color: #696969; }
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 8px 0 0;
}
.stats dt, .muted { color: #696969; }
.stats dd { margin: 2px 0 0; font-size: max(1.8rem, 18px); line-height: 1.2; font-variant-numeric: tabular-nums; }
.calendar-scroll { overflow-x: auto; padding: 2px 0 6px; }
.calendar {
  display: grid;
  width: max(100%, 380px);
  grid-auto-flow: column;
  grid-template-rows: repeat(7, auto);
  grid-auto-columns: minmax(0, 1fr);
  gap: 2px;
}
.day { border-radius: 2px; aspect-ratio: 1; }
.level-0 { background: #e4e4e4; }
.level-1 { background: #c5c5c5; }
.level-2 { background: #989898; }
.level-3 { background: #646464; }
.level-4 { background: #292929; }
.legend { display: flex; justify-content: flex-end; align-items: center; gap: 4px; font-size: 12px; color: #696969; }
.legend .day { width: 7px; }
.chinese-text,
.github-widget:lang(zh-CN) :is(.refresh, .stats dt, .status, .contribution-unit) {
  font-size: max(1.2rem, 12px);
}
.profile-name.chinese-text,
.github-widget:lang(zh-CN) .section-header h2 { font-size: max(1.4rem, 14px); }
.github-widget:lang(zh-CN) .legend { font-size: 11px; }

@media (max-width: 768px) {
  .github-widget { gap: 14px; font-size: 14px; }
  .profile { gap: 4px; }
  .profile-header { flex-wrap: nowrap; gap: 8px; }
  .avatar { width: 32px; height: 32px; }
  .identity { flex: 1; }
  .profile-name { font-size: 15px; }
  .profile-name.chinese-text { font-size: 14px; }
  .refresh { flex: none; width: 44px; min-height: 44px; padding: 0; }
  .refresh-text, .repo-label { display: none; }
  .refresh-icon { display: inline-block; font: 20px/1 Arial, sans-serif; }
  .refresh:enabled:hover { text-decoration: none; color: var(--ink); }
  .repo-label-short { display: inline; }
  .stats { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 3px; }
  .stats > div { display: flex; align-items: baseline; gap: 4px; white-space: nowrap; }
  .stats dt, .github-widget:lang(zh-CN) .stats dt { font-size: 12px; }
  .stats dd { margin: 0; font-size: 13px; }
  .contributions { padding-top: 10px; }
  .section-header { gap: 2px 8px; }
  .section-header h2, .github-widget:lang(zh-CN) .section-header h2 { font-size: 14px; }
  .section-header + .status, .calendar-scroll { margin-top: 6px; }
  .calendar-scroll { overflow-x: visible; padding-bottom: 4px; }
  .calendar { width: 100%; gap: 1px; }
}
</style>
