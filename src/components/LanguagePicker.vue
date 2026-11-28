<script setup lang="ts">
import { computed } from 'vue';
import { navigate } from 'astro:transitions/client';
import { useLanguage } from '../lib/language';
import { languagePreferenceKey, localizedPath, type Language } from '../lib/locale';

const props = defineProps<{ initialLanguage: Language }>();
const { language, t } = useLanguage(props.initialLanguage);
const nextLanguage = computed<Language>(() => language.value === 'en' ? 'zh-CN' : 'en');
const switchLabel = computed(() => t(nextLanguage.value === 'zh-CN' ? '切换到简体中文' : '切换到英文'));

const switchLanguage = () => {
  const value = nextLanguage.value;
  try { localStorage.setItem(languagePreferenceKey, value); } catch {}
  const { pathname, search, hash } = location;
  void navigate(localizedPath(pathname, value) + search + hash);
};
</script>

<template>
  <div class="language-picker">
    <button class="language-trigger" type="button" :aria-label="switchLabel" :title="switchLabel" @click="switchLanguage">
      <img class="language-icon" src="/icons/language.svg" alt="" width="20" height="20" />
    </button>
  </div>
</template>

<style scoped>
.language-picker {position:fixed;top:max(2.4rem,env(safe-area-inset-top));left:max(2.4rem,env(safe-area-inset-left));z-index:80;font-family:'Suisse Intl',Arial,sans-serif;color:#1a1a1a;}
.language-trigger {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}
.language-icon {
  transition: scale .2s ease;
}
.language-trigger:focus-visible {outline:2px solid #1a1a1a;outline-offset:3px;}
@media(hover:hover) {.language-trigger:hover .language-icon {scale:1.08;}}
@media(max-width:768px) {.language-picker {top:calc(env(safe-area-inset-top) + 2rem);left:max(2rem,env(safe-area-inset-left));}}
@media(prefers-reduced-motion:reduce) {.language-icon {transition:none;}}
</style>
