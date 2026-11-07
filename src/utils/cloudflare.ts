import { env } from 'cloudflare:workers'
import {
  BLOG_INDEX_KV_KEY,
  DRIVE_OBJECT_PREFIX,
  PHOTO_MANIFEST_KV_KEY,
} from './runtime-config'

export const BLOG_META_PREFIX = 'blog:post:'
export const BLOG_BODY_PREFIX = 'blog/posts/'
export const BLOG_ASSET_PREFIX = 'blog/assets/'
export const PHOTO_OBJECT_PREFIX = 'photos/'

export function getBindings(): Env {
  return env as Env
}

export function getBlogIndexKey() {
  return BLOG_INDEX_KV_KEY
}

export function getPhotoManifestKey() {
  return PHOTO_MANIFEST_KV_KEY
}

export function getDrivePrefix() {
  return DRIVE_OBJECT_PREFIX
}

export function getIndexNowKey(bindings: Env) {
  return bindings.INDEXNOW_KEY?.trim() || ''
}
