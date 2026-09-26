<template>
  <header class="blogPageHeader" :class="{ 'is-compact': compact }">
    <div class="blogNavBar">
      <a class="blogHomeLink" href="/" data-astro-reload aria-label="返回主页">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 18-6-6 6-6"></path>
        </svg>
        <span>主页</span>
      </a>

      <nav class="blogSectionNav" aria-label="博客导航">
        <a
          v-for="link in navLinks"
          :key="link.id"
          :href="link.href"
          :class="{ 'is-active': activeSection === link.id }"
          :aria-current="activeSection === link.id ? 'page' : undefined"
        >
          {{ link.label }}
        </a>
      </nav>

      <div class="blogHeaderActions">
        <button class="blogSearchButton" type="button" aria-label="搜索文章" title="搜索文章" @click="$emit('open-search')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-4-4"></path>
          </svg>
        </button>
        <ThemeToggle :is-light="theme === 'Light'" @toggle="$emit('toggle-theme')" />
      </div>
    </div>

    <div class="blogMasthead">
      <p class="blogKicker">ANeko / JOURNAL</p>
      <h1>ANeko <span class="gradientText">Blog</span></h1>
      <p class="blogMastheadCopy">代码与日常留下的片段</p>
    </div>
  </header>
</template>

<script setup>
import ThemeToggle from './ThemeToggle.vue'

const navLinks = [
  { id: 'articles', label: '文章', href: '/blog/' },
  { id: 'archive', label: '归档', href: '/blog/archive/' },
  { id: 'about', label: '关于', href: '/blog/about/' },
  { id: 'manage', label: '管理', href: '/admin/blog/' },
]

defineProps({
  theme: {
    type: String,
    default: 'Light',
  },
  compact: {
    type: Boolean,
    default: false,
  },
  activeSection: {
    type: String,
    default: 'articles',
  },
})

defineEmits(['toggle-theme', 'open-search'])
</script>
