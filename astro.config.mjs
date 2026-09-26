import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import vue from '@astrojs/vue'
import { unified } from '@astrojs/markdown-remark'
import remarkDirective from 'remark-directive'
import { remarkGithubCard } from './src/plugins/remark-github-card.mjs'

export default defineConfig({
  integrations: [vue()],
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough',
    persistState: true,
    prerenderEnvironment: 'node',
    sessionKVBindingName: 'ANEKO_KV',
  }),
  markdown: {
    processor: unified({
      remarkPlugins: [remarkDirective, remarkGithubCard],
    }),
  },
  vite: {
    build: {
      // Keep the wallpaper backdrop-filter declarations in the production CSS.
      cssMinify: false,
    },
  },
})
