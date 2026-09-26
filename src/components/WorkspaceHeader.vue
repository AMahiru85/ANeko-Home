<template>
  <header class="blogPageHeader workspacePageHeader">
    <div class="blogNavBar workspaceNavBar">
      <a class="blogHomeLink" href="/" data-astro-reload aria-label="返回主页">
        <ArrowLeft :size="17" :stroke-width="1.8" aria-hidden="true" />
        <span>主页</span>
      </a>

      <div class="blogHeaderActions">
        <ThemeToggle :is-light="theme === 'Light'" @toggle="$emit('toggle-theme')" />
      </div>
    </div>

    <div class="blogMasthead workspaceMasthead">
      <p class="blogKicker">{{ currentProduct.kicker }}</p>
      <h1 class="blogMastheadTitle">ANeko <span class="gradientText">{{ currentProduct.name }}</span></h1>
      <p class="blogMastheadCopy">{{ currentProduct.copy }}</p>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowLeft } from '@lucide/vue'
import ThemeToggle from './ThemeToggle.vue'

const props = defineProps({
  product: {
    type: String,
    required: true,
  },
  theme: {
    type: String,
    default: 'Light',
  },
})

defineEmits(['toggle-theme'])

const products = {
  photos: {
    name: '相册',
    kicker: 'ANeko / 照片',
    copy: '从相册取回光影与片刻',
  },
  drive: {
    name: '网盘',
    kicker: 'ANeko / 文件存储',
    copy: '文件、目录与归档',
  },
  mail: {
    name: '邮箱',
    kicker: 'ANeko / 收件箱',
    copy: '连接已有邮箱，收取与发送邮件',
  },
}

const currentProduct = computed(() => products[props.product] || products.photos)
</script>
