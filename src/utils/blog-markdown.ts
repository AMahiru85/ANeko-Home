import type { Element, Root } from 'hast'
import githubDark from '@shikijs/themes/github-dark'
import astro from '@shikijs/langs/astro'
import bash from '@shikijs/langs/bash'
import css from '@shikijs/langs/css'
import dockerfile from '@shikijs/langs/dockerfile'
import html from '@shikijs/langs/html'
import javascript from '@shikijs/langs/javascript'
import json from '@shikijs/langs/json'
import jsx from '@shikijs/langs/jsx'
import markdown from '@shikijs/langs/markdown'
import sql from '@shikijs/langs/sql'
import tsx from '@shikijs/langs/tsx'
import typescript from '@shikijs/langs/typescript'
import vue from '@shikijs/langs/vue'
import yaml from '@shikijs/langs/yaml'
import { createHighlighterCore } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import GithubSlugger from 'github-slugger'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import remarkSmartypants from 'remark-smartypants'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { VFile } from 'vfile'
import { remarkGithubCard } from '../plugins/remark-github-card.mjs'

interface BlogHeading {
  depth: number
  slug: string
  text: string
}

const languageRegistrations = Array.from(new Map([
  ...astro,
  ...bash,
  ...css,
  ...dockerfile,
  ...html,
  ...javascript,
  ...json,
  ...jsx,
  ...markdown,
  ...sql,
  ...tsx,
  ...typescript,
  ...vue,
  ...yaml,
].map((language) => [language.name, language])).values())

const supportedLanguages = new Map<string, string>()

for (const language of languageRegistrations) {
  supportedLanguages.set(language.name, language.name)
  for (const alias of language.aliases ?? []) {
    supportedLanguages.set(alias, language.name)
  }
}

let highlighterPromise: ReturnType<typeof createHighlighterCore> | undefined

function getHighlighter() {
  highlighterPromise ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine({ forgiving: true }),
    langs: languageRegistrations,
    themes: [githubDark],
  })

  return highlighterPromise
}

function getText(node: Root | Element): string {
  return node.children.map((child) => {
    if (child.type === 'text') return child.value
    if (child.type === 'element') return getText(child)
    return ''
  }).join('')
}

function getCodeLanguage(code: Element) {
  const className = code.properties.className
  const classes = Array.isArray(className)
    ? className.filter((value): value is string => typeof value === 'string')
    : []
  const language = classes
    .map((name) => /^language-(\S+)$/.exec(name)?.[1])
    .find(Boolean)
    ?.toLowerCase()

  return language ? supportedLanguages.get(language) ?? 'text' : 'text'
}

function rehypeLimitedShiki() {
  return async (tree: Root) => {
    const blocks: Array<{ code: Element; index: number; parent: Root | Element }> = []

    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || typeof index !== 'number' || !parent) return
      if (node.children.length !== 1 || node.children[0].type !== 'element') return

      const code = node.children[0]
      if (code.tagName !== 'code') return
      blocks.push({ code, index, parent })
    })

    if (blocks.length === 0) return
    const highlighter = await getHighlighter()

    for (const { code, index, parent } of blocks) {
      const language = getCodeLanguage(code)
      const highlighted = highlighter.codeToHast(getText(code).replace(/(?:\r\n|\r|\n)$/, ''), {
        lang: language,
        theme: 'github-dark',
      })
      const pre = highlighted.children[0]
      if (pre?.type !== 'element') continue

      const className = Array.isArray(pre.properties.className)
        ? pre.properties.className.map((name) => name === 'shiki' ? 'astro-code' : name)
        : ['astro-code', 'github-dark']
      const style = typeof pre.properties.style === 'string' ? pre.properties.style : ''

      pre.properties.className = className
      pre.properties.dataLanguage = language
      pre.properties.style = `${style}; overflow-x: auto;`
      parent.children[index] = pre
    }
  }
}

function rehypeHeadingIds() {
  return (tree: Root, file: VFile) => {
    const headings: BlogHeading[] = []
    const slugger = new GithubSlugger()

    visit(tree, 'element', (node) => {
      const match = /^h([1-6])$/.exec(node.tagName)
      if (!match) return

      const text = getText(node)
      const slug = typeof node.properties.id === 'string'
        ? node.properties.id
        : slugger.slug(text)

      node.properties.id = slug
      headings.push({ depth: Number(match[1]), slug, text })
    })

    file.data.headings = headings
  }
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkSmartypants)
  .use(remarkDirective)
  .use(remarkGithubCard)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeLimitedShiki)
  .use(rehypeHeadingIds)
  .use(rehypeStringify, { allowDangerousHtml: true })

export async function renderBlogMarkdown(markdown: string) {
  const result = await processor.process(markdown)

  return {
    html: String(result),
    headings: (result.data.headings as BlogHeading[] | undefined) ?? [],
  }
}
