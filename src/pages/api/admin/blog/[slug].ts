import type { APIRoute } from 'astro'
import { verifyAdminRequest } from '../../../../utils/auth'
import { BLOG_BODY_PREFIX, BLOG_META_PREFIX, getBindings } from '../../../../utils/cloudflare'
import { errorResponse, successResponse } from '../../../../utils/http'
import { isValidBlogSlug } from '../../../../utils/blog-config'
import { blogIndexNowPaths, queueIndexNow } from '../../../../utils/indexnow'
import {
  calculateReadingTime,
  invalidateBlogPostBodyCache,
  getStoredPostMetadata,
  getStoredPostIndex,
  rememberBlogPostBody,
  saveStoredPostIndex,
  type StoredBlogPost,
} from '../../../../utils/posts'

export const prerender = false

const MAX_ARTICLE_BYTES = 2 * 1024 * 1024

class BlogInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlogInputError'
  }
}

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
  if (!text) throw new BlogInputError(`${field}不能为空`)
  return text
}

function optionalText(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || undefined
}

function isoDate(value: unknown, field: string) {
  const date = new Date(requiredText(value, field))
  if (Number.isNaN(date.valueOf())) throw new BlogInputError(`${field}无效`)
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

  try {
    const metadata = await getStoredPostMetadata(slug)
    if (!metadata) return errorResponse('未找到文章', 404)

    let body: string
    try {
      const bodyObject = await bindings.ANEKO_R2.get(metadata.bodyKey)
      if (!bodyObject) return errorResponse('未找到文章正文', 404)
      body = await bodyObject.text()
    } catch (error) {
      console.error('[blog] admin post body read failed', {
        slug,
        errorType: error instanceof Error ? error.name : typeof error,
      })
      return errorResponse('文章暂时无法读取，请稍后重试', 503)
    }

    return successResponse({
      ...metadata,
      body,
    })
  } catch (error) {
    console.error('[blog] admin post read failed', {
      slug,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return errorResponse('文章暂时无法读取，请稍后重试', 503)
  }
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
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return errorResponse('请求内容必须是 JSON 对象')
    }
    input = parsed
  } catch {
    return errorResponse('请求内容不是有效的 JSON')
  }

  try {
    const body = requiredText(input.body, '正文')
    if (new TextEncoder().encode(body).byteLength > MAX_ARTICLE_BYTES) {
      return errorResponse('文章内容过大', 413)
    }

    const tags = Array.isArray(input.tags)
      ? [...new Set(input.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean))]
      : []
    const bodyVersion = crypto.randomUUID()
    const bodyKey = `${BLOG_BODY_PREFIX}${slug}/${bodyVersion}.md`
    const metadata: StoredBlogPost = {
      slug,
      title: requiredText(input.title, '标题'),
      description: requiredText(input.description, '简介'),
      pubDate: isoDate(input.pubDate, '发布日期'),
      updatedDate: input.updatedDate ? isoDate(input.updatedDate, '更新日期') : undefined,
      heroImage: optionalText(input.heroImage),
      bodyVersion,
      tags,
      author: optionalText(input.author) || 'ANeko',
      featured: Boolean(input.featured),
      draft: Boolean(input.draft),
      readingTime: calculateReadingTime(body),
      bodyKey,
    }

    const index = await getStoredPostIndex({ refresh: true, allowStale: false })
    const nextIndex = [...index.filter((post) => post.slug !== slug), metadata]

    await bindings.ANEKO_R2.put(bodyKey, body, {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    })
    await saveStoredPostIndex(nextIndex)
    await rememberBlogPostBody(slug, bodyVersion, body)
    queueIndexNow(locals.cfContext, blogIndexNowPaths(slug, index, nextIndex))

    // The index has committed. A compatibility mirror failure must not tell
    // the editor that a published article was not saved.
    try {
      await bindings.ANEKO_KV.put(`${BLOG_META_PREFIX}${slug}`, JSON.stringify(metadata))
    } catch (error) {
      console.warn('[blog] metadata mirror update failed', {
        slug,
        errorType: error instanceof Error ? error.name : typeof error,
      })
    }

    return successResponse(metadata)
  } catch (error) {
    if (error instanceof BlogInputError) return errorResponse(error.message)
    console.error('[blog] post save failed', {
      slug,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return errorResponse('文章暂时无法保存，请稍后重试', 503)
  }
}

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const bindings = getBindings()
  if (!await isAuthorized(request, bindings)) return errorResponse('未授权访问，请重新验证', 401)

  const slug = params.slug?.trim() || ''
  if (!isValidBlogSlug(slug)) return errorResponse('文章路径（Slug）无效')

  try {
    const index = await getStoredPostIndex({ refresh: true, allowStale: false })
    const existing = index.find((post) => post.slug === slug)
    const nextIndex = index.filter((post) => post.slug !== slug)

    const assetKeys: string[] = []
    let assetCursor: string | undefined
    do {
      const result = await bindings.ANEKO_R2.list({
        prefix: `blog/assets/${slug}/`,
        cursor: assetCursor,
      })
      assetKeys.push(...result.objects.map((object) => object.key))
      assetCursor = result.truncated ? result.cursor : undefined
    } while (assetCursor)

    const bodyKeys = new Set<string>([
      existing?.bodyKey || `${BLOG_BODY_PREFIX}${slug}.md`,
      `${BLOG_BODY_PREFIX}${slug}.md`,
    ])
    let bodyCursor: string | undefined
    do {
      const result = await bindings.ANEKO_R2.list({
        prefix: `${BLOG_BODY_PREFIX}${slug}/`,
        cursor: bodyCursor,
      })
      for (const object of result.objects) bodyKeys.add(object.key)
      bodyCursor = result.truncated ? result.cursor : undefined
    } while (bodyCursor)

    const bodyCacheVersions = new Set<string>(['legacy'])
    if (existing?.bodyVersion) bodyCacheVersions.add(existing.bodyVersion)
    const bodyVersionPrefix = `${BLOG_BODY_PREFIX}${slug}/`
    for (const bodyKey of bodyKeys) {
      if (!bodyKey.startsWith(bodyVersionPrefix) || !bodyKey.endsWith('.md')) continue
      const version = bodyKey.slice(bodyVersionPrefix.length, -3)
      if (version) bodyCacheVersions.add(version)
    }

    const deleteR2Keys = async (keys: string[]) => {
      for (let offset = 0; offset < keys.length; offset += 1000) {
        await bindings.ANEKO_R2.delete(keys.slice(offset, offset + 1000))
      }
    }

    await saveStoredPostIndex(nextIndex)
    await Promise.all([...bodyCacheVersions].map((version) => invalidateBlogPostBodyCache(
      slug,
      version === 'legacy' ? undefined : version,
    )))
    queueIndexNow(locals.cfContext, blogIndexNowPaths(slug, index, nextIndex))
    const cleanup = await Promise.allSettled([
      deleteR2Keys(Array.from(bodyKeys)),
      deleteR2Keys(assetKeys),
      bindings.ANEKO_KV.delete(`${BLOG_META_PREFIX}${slug}`),
    ])
    const cleanupPending = cleanup.some((result) => result.status === 'rejected')
    if (cleanupPending) console.warn('[blog] removed post has pending storage cleanup', { slug })
    return successResponse({ deleted: slug, cleanupPending })
  } catch (error) {
    console.error('[blog] post deletion failed', {
      slug,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return errorResponse('文章暂时无法删除，请稍后重试', 503)
  }
}
