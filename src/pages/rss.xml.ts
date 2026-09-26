import type { APIRoute } from 'astro'
import { getPublishedPosts } from '../utils/posts'
import { SITE_ORIGIN } from '../utils/runtime-config'

export const prerender = false

function escapeXml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts()
  const items = posts.map((post) => {
    const link = new URL(`/blog/${encodeURIComponent(post.id)}/`, SITE_ORIGIN).href
    return [
      '    <item>',
      `      <title>${escapeXml(post.data.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `      <description>${escapeXml(post.data.description)}</description>`,
      `      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>`,
      ...post.data.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
      '    </item>',
    ].join('\n')
  })
  const lastBuildDate = posts.reduce<Date | undefined>((latest, post) => {
    const modified = post.data.updatedDate ?? post.data.pubDate
    return !latest || modified > latest ? modified : latest
  }, undefined)
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>ANeko - Home | 博客</title>',
    `    <link>${SITE_ORIGIN}/blog/</link>`,
    `    <atom:link href="${SITE_ORIGIN}/rss.xml" rel="self" type="application/rss+xml" />`,
    '    <description>开发实践、系统配置、技术笔记与日常记录</description>',
    '    <language>zh-CN</language>',
    ...(lastBuildDate ? [`    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>`] : []),
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
