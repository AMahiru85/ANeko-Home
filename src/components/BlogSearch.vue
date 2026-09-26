<template>
  <div
    v-if="open"
    class="blogSearchOverlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="blog-search-title"
    @mousedown.self="$emit('close')"
  >
    <div class="blogSearchDialog">
      <header class="blogSearchHeader">
        <div>
          <p>SEARCH</p>
          <h2 id="blog-search-title">搜索文章</h2>
        </div>
        <button type="button" aria-label="关闭搜索" title="关闭" @click="$emit('close')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18"></path>
          </svg>
        </button>
      </header>

      <div class="blogSearchField">
        <label for="blog-search-input">标题、摘要或标签</label>
        <div class="blogSearchInputWrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-4-4"></path>
          </svg>
          <input
            id="blog-search-input"
            ref="inputRef"
            v-model.trim="query"
            type="search"
            autocomplete="off"
            placeholder="输入关键词"
          />
        </div>
      </div>

      <div class="blogSearchResults" aria-live="polite">
        <div v-if="status === 'loading'" class="blogSearchSkeleton" aria-label="正在载入文章">
          <span v-for="item in 3" :key="item"></span>
        </div>

        <div v-else-if="status === 'error'" class="blogSearchState" role="alert">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v6M12 17h.01"></path>
          </svg>
          <div>
            <h3>搜索索引暂不可用</h3>
            <p>请稍后再试。</p>
          </div>
          <button type="button" @click="loadIndex">重新加载</button>
        </div>

        <div v-else-if="status === 'ready' && results.length === 0" class="blogSearchState is-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-4-4"></path>
          </svg>
          <div>
            <h3>没有匹配的文章</h3>
            <p>换一个标题、摘要或标签试试。</p>
          </div>
        </div>

        <template v-else-if="status === 'ready'">
          <p class="blogSearchResultLabel">{{ query ? `${results.length} 个结果` : '最近文章' }}</p>
          <a
            v-for="result in results"
            :key="result.slug"
            class="blogSearchResult"
            :href="`/blog/${result.slug}/`"
            @click="$emit('close')"
          >
            <div>
              <h3>{{ result.title }}</h3>
              <p>{{ result.description }}</p>
            </div>
            <span>{{ formatDate(result.date) }}</span>
          </a>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['close'])

const inputRef = ref(null)
const query = ref('')
const posts = ref([])
const status = ref('idle')

const results = computed(() => {
  const normalizedQuery = query.value.toLocaleLowerCase('zh-CN')
  if (!normalizedQuery) return posts.value.slice(0, 5)

  return posts.value.filter((post) => post.searchText.includes(normalizedQuery))
})

async function loadIndex() {
  status.value = 'loading'

  try {
    const response = await fetch('/api/search.json')
    if (!response.ok) throw new Error(`Search index returned ${response.status}`)
    const payload = await response.json()
    posts.value = (Array.isArray(payload) ? payload : []).map((post) => ({
      ...post,
      searchText: [post.title, post.description, ...(Array.isArray(post.tags) ? post.tags : [])]
        .filter((value) => typeof value === 'string')
        .join('\n')
        .toLocaleLowerCase('zh-CN'),
    }))
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

function formatDate(date) {
  return date.slice(0, 10).replaceAll('-', '.')
}

watch(() => props.open, async (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
  if (!isOpen) return
  if (status.value === 'idle') void loadIndex()
  await nextTick()
  inputRef.value?.focus()
}, { immediate: true })

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>
