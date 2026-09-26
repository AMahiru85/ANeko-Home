export const BLOG_SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u

const RESERVED_SLUGS = new Set(['about', 'archive', 'assets', 'page', 'tag'])

export function isValidBlogSlug(slug: string) {
  return BLOG_SLUG_PATTERN.test(slug)
    && !RESERVED_SLUGS.has(slug.toLocaleLowerCase('zh-CN'))
}
