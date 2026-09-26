import type { APIRoute } from 'astro'
import { getPublishedPosts } from '../../utils/posts'

export const prerender = false

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts()
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
