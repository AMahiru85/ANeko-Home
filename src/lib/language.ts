import { onMounted, readonly, ref, watch } from 'vue';
import { english } from '../data/english';
import { defaultLanguage, languageFromPath, localizedPath, type Language } from './locale';

const language = ref<Language>(defaultLanguage);
let installed = false;

export function translate(text: string, locale: Language = defaultLanguage) {
  return locale === 'en' && Object.hasOwn(english, text) ? english[text] : text;
}

export function installLanguage() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  language.value = languageFromPath(location.pathname);

  document.addEventListener('astro:after-swap', () => {
    const locale = languageFromPath(location.pathname);
    if (locale === language.value) return;
    language.value = locale;
    // These elements can survive a swap through transition:persist.
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
      element.textContent = translate(element.dataset.i18n ?? '', locale);
    });
    document.querySelectorAll<HTMLAnchorElement>('[data-home-about-link]').forEach(link => {
      link.href = localizedPath('/about', locale);
      link.setAttribute('aria-label', translate(link.dataset.i18nLabel ?? '', locale));
    });
  });
}

export function useLanguage(initialLanguage: Language) {
  // Match the static HTML during hydration, then follow client-side swaps.
  const current = ref(initialLanguage);
  watch(language, next => { current.value = next; });
  onMounted(() => { installLanguage(); current.value = language.value; });
  return {
    language: readonly(current),
    t: (text: string) => translate(text, current.value),
  };
}
