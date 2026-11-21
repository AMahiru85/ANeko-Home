import { onMounted, readonly, ref, watch } from 'vue';

export type Language = 'en' | 'zh-CN';
type RichPiece = { text: string; ink?: boolean; href?: string };
const language = ref('en' as Language);
const storageKey = 'aneko:language';
let installed = false;

const chinese: Record<string, string> = {
  'Home': '主页',
  'About': '关于',
  'Travel': '旅行',
  'Site': '网站导航',
  'UX Designer': '用户体验设计师',
  'Choose language': '选择语言',
  'Language': '语言',
  'Open About Page': '查看关于页面',
  'Back to Home': '返回主页',
  'Open Social Links': '展开社交链接',
  'Close Social Links': '收起社交链接',
  'Send email': '发送邮件',
  'Copy email': '复制邮箱',
  'click to copy': '点击复制',
  'copied to clipboard': '已复制到剪贴板',
  'copy unavailable — ': '无法复制，请手动复制：',
  'About Gabriel Beaugonin': '关于 Gabriel Beaugonin',
  'Open the travel gallery': '打开旅行相册',
  'Click to travel': '点击开启旅行',
  'Interactive travel gallery': '互动旅行相册',
  'Fly through travel photographs': '飞越旅行照片',
  "The travel gallery couldn't load. Please try again.": '旅行相册加载失败，请重试。',
  'Return to the about page': '返回关于页面',
  'Click to return': '点击返回',
  'Rotating globe with an orbiting airplane': '飞机环绕的旋转地球',
  'Project Slider': '项目轮播',
  'Project': '项目',
  'of': '共',
  'preview': '预览',
  'Award-winning UX Designer': '屡获殊荣的用户体验设计师',
  ', turning business goals, user needs, and messy problems into interfaces that feel obvious.': '，将商业目标、用户需求与复杂问题，转化为清晰直观的界面。',
  'After studying at ': '毕业于 ',
  ', I worked alongside sharp designers and developers at ': '，曾与 ',
  '&': '和',
  ', crafting impactful websites.': ' 的优秀设计师和开发者合作，打造令人印象深刻的网站。',
  'Recognitions:': '所获荣誉：',
  'Now freelance, travelling, and ': '目前是一名自由设计师，在旅行中创作，',
  'available worldwide.': '接受来自世界各地的合作。',
  ' Currently based in ': '目前旅居于',
  'Paris, France.': '法国巴黎。',
  'A creative collaboration with ': '创意合作伙伴：',
  ' and ': ' 与 ',
  '.': '。',
};

export function translate(text: string) {
  return language.value === 'zh-CN' ? chinese[text] ?? text : text;
}

function readLanguage(): Language {
  try { return localStorage.getItem(storageKey) === 'zh-CN' ? 'zh-CN' : 'en'; }
  catch { return 'en'; }
}

function applyLanguage(root: Document, pathname: string) {
  root.documentElement.lang = language.value;
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    element.textContent = translate(element.dataset.i18n ?? '');
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach(element => {
    element.setAttribute('aria-label', translate(element.dataset.i18nLabel ?? ''));
  });
  root.querySelectorAll<HTMLElement>('[data-language-content]').forEach(element => {
    if (element.dataset.languageRendered === language.value) return;
    const pieces = JSON.parse(element.dataset.languageContent ?? '[]') as RichPiece[];
    const nodes = pieces.map(piece => {
      const node = root.createElement(piece.href ? 'a' : 'span');
      element.getAttributeNames().filter(name => name.startsWith('data-astro-cid-')).forEach(name => node.setAttribute(name, ''));
      node.dataset.aboutPart = '';
      if (piece.ink) node.classList.add('about-ink');
      if (piece.href) {
        node.classList.add('about-rich-link');
        node.setAttribute('href', piece.href);
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
      node.textContent = translate(piece.text);
      return node;
    });
    element.replaceChildren(...nodes);
    element.dataset.languageRendered = language.value;
  });
  const about = pathname === '/about' || pathname === '/about/';
  const travel = pathname === '/travel' || pathname === '/travel/';
  root.title = language.value === 'zh-CN'
    ? travel ? '旅行 — Gabriel Beaugonin' : about ? 'Gabriel Beaugonin — 关于' : 'Gabriel Beaugonin — 用户体验设计师'
    : travel ? 'Travel — Gabriel Beaugonin' : about ? 'Gabriel Beaugonin — About' : 'Gabriel Beaugonin — UX Designer';
}

export function setLanguage(next: Language) {
  if (next === language.value) return;
  language.value = next;
  try { localStorage.setItem(storageKey, next); } catch {}
  applyLanguage(document, location.pathname);
  window.dispatchEvent(new CustomEvent('gabriel:language', { detail: { language: next } }));
}

export function installLanguage() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  language.value = readLanguage();
  applyLanguage(document, location.pathname);
  if (language.value === 'zh-CN') window.dispatchEvent(new CustomEvent('gabriel:language', { detail: { language: language.value } }));
  document.addEventListener('astro:before-swap', event => {
    const { newDocument, to } = event as Event & { newDocument?: Document; to?: URL };
    if (newDocument) applyLanguage(newDocument, to?.pathname ?? location.pathname);
  });
  document.addEventListener('astro:after-swap', () => applyLanguage(document, location.pathname));
  document.addEventListener('astro:page-load', () => applyLanguage(document, location.pathname));
}

export function useLanguage() {
  // Hydrate with the same English values as the server, then apply the saved
  // preference. Persisted islands continue to share subsequent changes.
  const current = ref('en' as Language);
  watch(language, next => { current.value = next; });
  onMounted(() => { installLanguage(); current.value = language.value; });
  return {
    language: readonly(current),
    t: (text: string) => current.value === 'zh-CN' ? chinese[text] ?? text : text,
  };
}
