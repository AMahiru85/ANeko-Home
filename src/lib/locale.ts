export type Language = 'en' | 'zh-CN';
export const defaultLanguage: Language = 'en';
export const languagePreferenceKey = 'aneko:language';

function trimTrailingSlash(pathname: string) {
  return pathname.replace(/\/+$/, '');
}

export function languageFromPath(pathname: string): Language {
  return trimTrailingSlash(pathname).endsWith('/zh') ? 'zh-CN' : defaultLanguage;
}

function basePath(pathname: string) {
  const trimmed = trimTrailingSlash(pathname);
  return trimmed.endsWith('/zh') ? trimmed.slice(0, -3) : trimmed;
}

export function localizedPath(pathname: string, locale: Language) {
  const path = basePath(pathname);
  return locale === 'zh-CN' ? path + '/zh/' : path + '/';
}

export function isHomePath(pathname: string) {
  return basePath(pathname) === '';
}

export function isAboutPath(pathname: string) {
  return basePath(pathname) === '/about';
}
