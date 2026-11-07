/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />
/// <reference types="@cloudflare/workers-types" />

interface Env {
  ANEKO_KV: KVNamespace
  ANEKO_R2: R2Bucket
  ASSETS: Fetcher
  ACCESS_CODE?: string
  TURNSTILE_SECRET?: string
  INDEXNOW_KEY?: string
}
