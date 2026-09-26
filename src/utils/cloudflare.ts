import { env } from 'cloudflare:workers'
import {
  DEFAULT_BLOG_INDEX_KEY,
  DEFAULT_DRIVE_PREFIX,
  DEFAULT_PHOTO_MANIFEST_KEY,
} from './runtime-config'

export const BLOG_META_PREFIX = 'blog:post:'
export const BLOG_BODY_PREFIX = 'blog/posts/'
export const BLOG_ASSET_PREFIX = 'blog/assets/'
export const PHOTO_OBJECT_PREFIX = 'photos/'

export function getBindings(): Env {
  return env as Env
}

export function getBlogIndexKey(bindings: Env) {
  return bindings.BLOG_INDEX_KEY?.trim() || DEFAULT_BLOG_INDEX_KEY
}

export function getPhotoManifestKey(bindings: Env) {
  return bindings.PHOTO_MANIFEST_KEY?.trim() || DEFAULT_PHOTO_MANIFEST_KEY
}

export function getDrivePrefix(bindings: Env) {
  const prefix = bindings.DRIVE_PREFIX?.trim() || DEFAULT_DRIVE_PREFIX
  return prefix.endsWith('/') ? prefix : `${prefix}/`
}
