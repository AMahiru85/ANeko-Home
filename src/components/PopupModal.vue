<template>
  <div class="tc" :class="{ active: imageUrl }" @click="$emit('close')">
    <div class="tc-main" :class="{ active: imageUrl }" @click.stop>
      <img v-if="imageUrl" class="tc-img" :src="imageUrl" alt="" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  imageUrl: {
    type: String,
    default: '',
  },
})

defineEmits(['close'])
</script>
