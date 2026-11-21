<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { setLanguage, useLanguage, type Language } from '../lib/language';

const { language, t } = useLanguage();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const choices = [{ value: 'en', label: 'English' }, { value: 'zh-CN', label: '简体中文' }] as const;
const close = (restoreFocus = false) => {
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
};
const focusChoice = (index: number) => {
  root.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[index]?.focus();
};
const toggle = async () => {
  if (open.value) { close(); return; }
  open.value = true;
  await nextTick();
  focusChoice(choices.findIndex(choice => choice.value === language.value));
};
const select = (value: Language) => { setLanguage(value); close(true); };
const keydown = (event: KeyboardEvent) => {
  if (!open.value) return;
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopImmediatePropagation(); close(true); return;
  }
  if (event.key === 'Tab') { close(); return; }
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const items = [...root.value?.querySelectorAll('[role="menuitemradio"]') ?? []];
  const index = items.indexOf(document.activeElement as Element);
  focusChoice(event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1
    : (index + (event.key === 'ArrowUp' ? -1 : 1) + choices.length) % choices.length);
};
const outside = (event: PointerEvent) => {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close();
};
const route = () => close();
onMounted(() => {
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('astro:before-preparation', route);
});
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside);
  document.removeEventListener('keydown', keydown, true);
  document.removeEventListener('astro:before-preparation', route);
});
</script>

<template>
  <div ref="root" class="language-picker">
    <button ref="trigger" class="language-trigger" type="button" :aria-label="t('Choose language')"
      :title="t('Choose language')" aria-haspopup="menu" :aria-expanded="open" aria-controls="language-menu" @click="toggle"
      @keydown.arrow-down.prevent="toggle" @keydown.arrow-up.prevent="toggle">
      <img class="language-icon" src="/icons/language.svg" alt="" width="20" height="20" />
    </button>
    <Transition name="language-menu">
      <div v-if="open" id="language-menu" class="language-menu" role="menu" :aria-label="t('Language')">
        <button v-for="choice in choices" :key="choice.value" type="button" role="menuitemradio"
          :aria-checked="language === choice.value" :lang="choice.value" @click="select(choice.value)">
          <span>{{ choice.label }}</span>
          <svg v-if="language === choice.value" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="m3 7 2.5 2.5L11 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </Transition>
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
.language-menu {position:absolute;top:calc(100% + .8rem);left:0;width:17rem;min-width:150px;padding:.6rem;border:1px solid rgb(26 26 26 / 5%);border-radius:1.5rem;background:#fff;box-shadow:0 .8rem 3rem rgb(0 0 0 / 7%);transform-origin:top left;}
.language-menu button {width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:2rem;padding:1.4rem 1.2rem;border:0;border-radius:1rem;background:transparent;color:inherit;font:inherit;font-size:max(1.4rem,13px);line-height:1;white-space:nowrap;cursor:pointer;text-align:left;}
.language-menu button:hover,.language-menu button:focus-visible {background:#f6f6f6;}
.language-trigger:focus-visible,.language-menu button:focus-visible {outline:2px solid #1a1a1a;outline-offset:3px;}
.language-menu-enter-active,.language-menu-leave-active {transition:opacity .18s ease,transform .18s cubic-bezier(.215,.61,.355,1);}
.language-menu-enter-from,.language-menu-leave-to {opacity:0;transform:translateY(-4px) scale(.97);}
@media(hover:hover) {.language-trigger:hover .language-icon {scale:1.08;}}
@media(max-width:768px) {.language-picker {top:calc(env(safe-area-inset-top) + 2rem);left:max(2rem,env(safe-area-inset-left));}}
@media(prefers-reduced-motion:reduce) {.language-icon,.language-menu-enter-active,.language-menu-leave-active {transition:none;}}
</style>
