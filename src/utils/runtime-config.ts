/**
 * Shared defaults for optional Worker variables and generated site URLs.
 * Cloudflare variables remain supported as runtime overrides.
 */
export const SITE_ORIGIN = 'https://www.aneko.ink'
export const DEFAULT_BLOG_INDEX_KEY = 'blog:index'
export const DEFAULT_PHOTO_MANIFEST_KEY = 'photos'
export const DEFAULT_DRIVE_PREFIX = 'drive/'
export const DEFAULT_TURNSTILE_HOSTNAME = new URL(SITE_ORIGIN).hostname
export const DEFAULT_MAIL_CONFIG_KV_KEY = 'mail:config:v3'
