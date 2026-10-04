<template>
  <div class="homeStack">
    <header class="sectionHeading"><p>TOOLS BEHIND THE IDEAS</p><h1>Tech Stack<span>.</span></h1><div class="stackTags"><span v-for="tag in tags" :key="tag">{{ tag }}</span></div></header>
    <div class="stackGrid">
      <article v-for="tool in tools" :key="tool.name" class="stackCard">
        <div class="stackTop"><component :is="tool.icon" :size="22" :stroke-width="1.5" aria-hidden="true" /><span>{{ tool.category }}</span></div>
        <div><h2>{{ tool.name }}</h2><p>{{ tool.description }}</p></div>
      </article>
    </div>
  </div>
</template>
<script setup lang="ts">
import { Braces, Cloud, Code2, Database, FileCode2, GitBranch, Layers, Zap } from '@lucide/vue'
defineProps<{ tags: string[] }>()
const tools = [
  { name: 'Astro', category: 'FRAMEWORK', description: '服务端渲染与内容组织', icon: Zap },
  { name: 'Vue 3', category: 'INTERFACE', description: '组件与交互体验', icon: Layers },
  { name: 'TypeScript', category: 'LANGUAGE', description: '类型与应用逻辑', icon: Braces },
  { name: 'HTML / CSS', category: 'WEB', description: '页面结构与响应式样式', icon: Code2 },
  { name: 'Cloudflare Workers', category: 'RUNTIME', description: '边缘计算与 API 服务', icon: Cloud },
  { name: 'KV / R2', category: 'STORAGE', description: '内容数据与文件存储', icon: Database },
  { name: 'Git', category: 'WORKFLOW', description: '版本管理与开源协作', icon: GitBranch },
  { name: 'Markdown', category: 'CONTENT', description: '博客写作与技术记录', icon: FileCode2 },
]
</script>
<style scoped>
.sectionHeading { padding: 14px 0 30px; }
.sectionHeading > p { font-size: 10px; letter-spacing: 0.18em; color: var(--home-muted); }
.sectionHeading h1 { margin: 12px 0 20px; font-size: 42px; letter-spacing: -0.05em; font-weight: 400; }
.sectionHeading h1 span { color: var(--home-accent); }
.stackTags { display: flex; gap: 8px; flex-wrap: wrap; }
.stackTags span { padding: 5px 10px; border: 1px solid var(--home-border); border-radius: 6px; color: var(--home-muted); font-size: 11px; }
.stackGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
.stackCard { min-height: 172px; display: flex; flex-direction: column; justify-content: space-between; gap: 28px; padding: 24px; border: 1px solid var(--home-border); border-radius: 18px; background: var(--home-surface); transition: border-color 0.2s, transform 0.2s; }
.stackCard:hover { border-color: var(--home-muted); transform: translateY(-3px); }
.stackTop { display: flex; align-items: center; justify-content: space-between; color: var(--home-muted); }
.stackTop span { font-size: 8px; letter-spacing: 0.08em; }
.stackCard h2 { font-size: 15px; font-weight: 500; line-height: 1.5; }
.stackCard p { margin-top: 6px; font-size: 11px; color: var(--home-muted); line-height: 1.7; }
@media (max-width: 900px) { .stackGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 500px) { .sectionHeading h1 { font-size: 36px; } .stackGrid { gap: 12px; } .stackCard { min-height: 156px; padding: 18px; } .stackTop span { font-size: 7px; letter-spacing: 0; } .stackCard h2 { font-size: 13px; } }
@media (prefers-reduced-motion: reduce) { .stackCard { transition: none; } }
</style>
