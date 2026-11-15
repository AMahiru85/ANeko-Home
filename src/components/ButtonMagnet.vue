<script setup lang="ts">
import { ref } from 'vue';
import { useButtonMagnet } from '../lib/button-motion';
const element=ref<HTMLElement|null>(null);
const {x,y}=useButtonMagnet(element);
</script>
<template><div ref="element" class="source-button-magnet" :style="{transform:'translate('+x+'px,'+y+'px)'}"><slot /></div></template>
<style scoped>.source-button-magnet {position:relative;flex-shrink:0;}</style>
