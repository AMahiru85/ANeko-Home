<script setup lang="ts">
import { computed } from 'vue';
import { buttonIcons, type ButtonIconName } from '../lib/button-icons';
const props=withDefaults(defineProps<{name:ButtonIconName;width?:string|number;height?:string|number;color?:string}>(),{color:'currentColor'});
const icon=computed(()=>buttonIcons[props.name]);
const svgWidth=computed(()=>props.width ?? (String(icon.value.width/10)+'rem'));
const svgHeight=computed(()=>props.height ?? (String(icon.value.height/10)+'rem'));
</script>
<template>
  <svg :width="svgWidth" :height="svgHeight" :viewBox="icon.viewBox" fill="none" xmlns="http://www.w3.org/2000/svg" :color="color" :overflow="icon.overflow ?? undefined" aria-hidden="true" focusable="false">
    <rect v-for="(rect,index) in icon.rects" :key="'rect-'+index" :x="rect.x" :y="rect.y" :width="rect.width" :height="rect.height" :rx="rect.rx" :stroke="rect.stroke" :stroke-width="rect.strokeWidth" :stroke-linejoin="rect.strokeLinejoin" />
    <path v-for="(path,index) in icon.paths" :key="index" :d="path.d" :fill="path.fill" :stroke="path.stroke" :stroke-width="path.strokeWidth" :stroke-linecap="path.strokeLinecap" :stroke-linejoin="path.strokeLinejoin" :fill-rule="path.fillRule" :clip-rule="path.clipRule" />
  </svg>
</template>