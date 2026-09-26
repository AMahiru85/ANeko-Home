import type { APIRoute } from 'astro'
import { BlogDataUnavailableError, getPublishedPosts } from '../../utils/posts'

export const prerender = false

export const GET: APIRoute = async () => {
  let posts: Awaited<ReturnType<typeof getPublishedPosts>>
  try {
    posts = await getPublishedPosts()
  } catch (error) {
    if (!(error instanceof BlogDataUnavailableError)) throw error
    return new Response(JSON.stringify({ success: false, error: '博客搜索暂时不可用，请稍后重试。' }), {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '60',
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  }
  const searchIndex = posts.map((post) => ({
    title: post.data.title,
    description: post.data.description,
    slug: post.id,
    tags: post.data.tags,
    date: post.data.pubDate.toISOString(),
  }))

  return new Response(JSON.stringify(searchIndex), {
    headers: {
      'Cache-Control': 'public, max-age=30',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
