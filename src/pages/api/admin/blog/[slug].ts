import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../../utils/auth'
import { BLOG_BODY_PREFIX, BLOG_META_PREFIX, getBindings } from '../../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../../utils/http'
import { isValidBlogSlug } from '../../../../utils/blog-config'
import { blogIndexNowPaths, queueIndexNow } from '../../../../utils/indexnow'
import {
  calculateReadingTime,
  getStoredPostMetadata,
  getStoredPostIndex,
  saveStoredPostIndex,
  type StoredBlogPost,
} from '../../../../utils/posts'

export const prerender = false

const MAX_ARTICLE_BYTES = 2 * 1024 * 1024

interface BlogPostInput {
  title?: unknown
  description?: unknown
  pubDate?: unknown
  updatedDate?: unknown
  heroImage?: unknown
  tags?: unknown
  author?: unknown
  featured?: unknown
  draft?: unknown
  body?: unknown
}

function requiredText(value: unknown, field: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${field}不能为空`)
  return text
}

function optionalText(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || undefined
}

function isoDate(value: unknown, field: string) {
  const date = new Date(requiredText(value, field))
  if (Number.isNaN(date.valueOf())) throw new Error(`${field}无效`)
  return date.toISOString()
}

async function isAuthorized(request: Request, bindings = getBindings()) {
  return verifyAdminRequest(request, bindings)
}

export const GET: APIRoute = async ({ params, request }) => {
  const bindings = getBindings()
  if (!await isAuthorized(request, bindings)) return errorResponse('未授权访问，请重新验证', 401)

  const slug = params.slug?.trim() || ''
  if (!isValidBlogSlug(slug)) return errorResponse('文章路径（Slug）无效')

  const metadata = await getStoredPostMetadata(slug)
  if (!metadata) return errorResponse('未找到文章', 404)

  const bodyObject = await bindings.ANEKO_R2.get(metadata.bodyKey)
  if (!bodyObject) return errorResponse('未找到文章正文', 404)

  return successResponse({
    ...metadata,
    body: await bodyObject.text(),
  })
}

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const bindings = getBindings()
  if (!await isAuthorized(request, bindings)) return errorResponse('未授权访问，请重新验证', 401)

  const slug = params.slug?.trim() || ''
  if (!isValidBlogSlug(slug)) return errorResponse('文章路径（Slug）无效')

  const declaredLength = Number(request.headers.get('Content-Length') || 0)
  if (declaredLength > MAX_ARTICLE_BYTES) return errorResponse('文章内容过大', 413)

  let input: BlogPostInput
  try {
    input = await request.json()
  } catch {
    return errorResponse('请求内容不是有效的 JSON')
  }

  try {
    const body = requiredText(input.body, 'body')
    if (new TextEncoder().encode(body).byteLength > MAX_ARTICLE_BYTES) {
      return errorResponse('文章内容过大', 413)
    }

    const tags = Array.isArray(input.tags)
      ? [...new Set(input.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean))]
      : []
    const bodyKey = `${BLOG_BODY_PREFIX}${slug}.md`
    const metadata: StoredBlogPost = {
      slug,
      title: requiredText(input.title, 'title'),
      description: requiredText(input.description, 'description'),
      pubDate: isoDate(input.pubDate, 'pubDate'),
      updatedDate: input.updatedDate ? isoDate(input.updatedDate, 'updatedDate') : undefined,
      heroImage: optionalText(input.heroImage),
      tags,
      author: optionalText(input.author) || 'ANeko',
      featured: Boolean(input.featured),
      draft: Boolean(input.draft),
      readingTime: calculateReadingTime(body),
      bodyKey,
    }

    const index = await getStoredPostIndex()
    const nextIndex = [...index.filter((post) => post.slug !== slug), metadata]

    await bindings.ANEKO_R2.put(bodyKey, body, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    })
    await Promise.all([
      bindings.ANEKO_KV.put(`${BLOG_META_PREFIX}${slug}`, JSON.stringify(metadata)),
      saveStoredPostIndex(nextIndex),
    ])
    queueIndexNow(locals.cfContext, blogIndexNowPaths(slug, index, nextIndex))

    return successResponse(metadata)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '文章保存失败')
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const bindings = getBindings()
  if (!await isAuthorized(request, bindings)) return errorResponse('未授权访问，请重新验证', 401)

  const slug = params.slug?.trim() || ''
  if (!isValidBlogSlug(slug)) return errorResponse('文章路径（Slug）无效')

  const index = await getStoredPostIndex()
  const existing = index.find((post) => post.slug === slug)
  const nextIndex = index.filter((post) => post.slug !== slug)

  const assetKeys: string[] = []
  let cursor: string | undefined
  do {
    const result = await bindings.ANEKO_R2.list({
      prefix: `blog/assets/${slug}/`,
      cursor,
    })
    assetKeys.push(...result.objects.map((object) => object.key))
    cursor = result.truncated ? result.cursor : undefined
  } while (cursor)

  await Promise.all([
    bindings.ANEKO_R2.delete(existing?.bodyKey || `${BLOG_BODY_PREFIX}${slug}.md`),
    assetKeys.length ? bindings.ANEKO_R2.delete(assetKeys) : Promise.resolve(),
    bindings.ANEKO_KV.delete(`${BLOG_META_PREFIX}${slug}`),
    saveStoredPostIndex(nextIndex),
  ])
  queueIndexNow(locals.cfContext, blogIndexNowPaths(slug, index, nextIndex))

  return successResponse({ deleted: slug })
}
