import type { APIRoute } from 'astro'
import { getPublishedPosts, getTagEntries, POSTS_PER_PAGE, type BlogPost } from '../utils/posts'
import { SITE_ORIGIN } from '../utils/runtime-config'

export const prerender = false

interface SitemapEntry {
  path: string
  lastmod?: Date
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function getLastModified(posts: BlogPost[]) {
  return posts.reduce<Date | undefined>((latest, post) => {
    const modified = post.data.updatedDate ?? post.data.pubDate
    return !latest || modified > latest ? modified : latest
  }, undefined)
}

function renderEntry(entry: SitemapEntry) {
  const location = escapeXml(new URL(entry.path, SITE_ORIGIN).href)
  const lastmod = entry.lastmod
    ? `\n    <lastmod>${entry.lastmod.toISOString()}</lastmod>`
    : ''

  return `  <url>\n    <loc>${location}</loc>${lastmod}\n  </url>`
}

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts()
  const blogLastModified = getLastModified(posts)
  const entries: SitemapEntry[] = [
    { path: '/' },
    { path: '/blog/', lastmod: blogLastModified },
    { path: '/blog/archive/', lastmod: blogLastModified },
    { path: '/blog/about/', lastmod: blogLastModified },
    { path: '/photos/' },
    { path: '/drive/' },
    { path: '/mail/' },
  ]

  for (const post of posts) {
    entries.push({
      path: `/blog/${encodeURIComponent(post.id)}/`,
      lastmod: post.data.updatedDate ?? post.data.pubDate,
    })
  }

  for (const { tag, slug } of getTagEntries(posts)) {
    if (!slug) continue
    entries.push({
      path: `/blog/tag/${encodeURIComponent(slug)}/`,
      lastmod: getLastModified(posts.filter((post) => post.data.tags.includes(tag))),
    })
  }

  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)
  for (let page = 2; page <= totalPages; page += 1) {
    entries.push({
      path: `/blog/page/${page}/`,
      lastmod: blogLastModified,
    })
  }

  const uniqueEntries = Array.from(
    new Map(entries.map((entry) => [new URL(entry.path, SITE_ORIGIN).href, entry])).values(),
  )
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...uniqueEntries.map(renderEntry),
    '</urlset>',
    '',
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
