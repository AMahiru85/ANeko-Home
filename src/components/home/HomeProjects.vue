<template>
  <div class="homeProjects">
    <header class="sectionHeading">
      <div><p>OPEN SOURCE & ACTIVITY</p><h1>Projects<span>.</span></h1></div>
      <a :href="`https://github.com/${username}`" target="_blank" rel="noreferrer">@{{ username }} <ArrowUpRight :size="16" aria-hidden="true" /></a>
    </header>
    <GitHubWidget :username="username" />
  </div>
</template>
<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'
import GitHubWidget from '../GitHubWidget.vue'
defineProps<{ username: string }>()
</script>
<style scoped>
.sectionHeading { display: flex; justify-content: space-between; align-items: end; gap: 20px; padding: 14px 0 28px; }
.sectionHeading p { color: var(--home-muted); font-size: 10px; letter-spacing: 0.18em; }
.sectionHeading h1 { margin-top: 12px; font-weight: 400; font-size: 42px; letter-spacing: -0.05em; }
.sectionHeading h1 span { color: var(--home-accent); }
.sectionHeading a { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--home-muted); }
.sectionHeading a:hover { color: var(--home-text); }
.homeProjects :deep(.githubModule) { width: 100%; margin: 0; }
.homeProjects :deep(.githubModuleHeader) { min-height: 38px; }
.homeProjects :deep(.githubModuleTitle h2) { font-size: 15px; line-height: 22px; font-weight: 500; }
.homeProjects :deep(.githubMark) { width: 22px; height: 22px; }
.homeProjects :deep(.githubProfileCard), .homeProjects :deep(.githubContributionCard), .homeProjects :deep(.githubActivityCard), .homeProjects :deep(.githubRepoCard) { border-radius: 18px; backdrop-filter: none; }
.homeProjects :deep(.githubProfileCard) { margin-bottom: 18px; }
.homeProjects :deep(.githubRepoCard:hover) { transform: translateY(-3px); }
@media (max-width: 500px) { .sectionHeading { align-items: start; flex-direction: column; gap: 14px; } .sectionHeading h1 { font-size: 36px; } }
</style>
