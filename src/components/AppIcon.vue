<script setup lang="ts">
import {
  Boxes,
  Download,
  Film,
  Folder,
  Globe,
  Home,
  Router,
  Server,
  Settings,
  Terminal,
} from 'lucide-vue-next'
import { computed } from 'vue'
import type { Component } from 'vue'
import type { NavApp } from '../types/app'

const props = defineProps<{
  app: NavApp
  minimized?: boolean
  running?: boolean
}>()

const emit = defineEmits<{
  openApp: [app: NavApp]
}>()

const iconMap: Record<string, Component> = {
  boxes: Boxes,
  download: Download,
  film: Film,
  folder: Folder,
  globe: Globe,
  home: Home,
  router: Router,
  server: Server,
  settings: Settings,
  terminal: Terminal,
}

const iconComponent = computed(() => iconMap[props.app.icon] ?? Globe)

const openApp = () => emit('openApp', props.app)
</script>

<template>
  <button
    class="app-icon"
    :class="{ minimized, running }"
    type="button"
    :title="minimized ? '已最小化，点击恢复' : app.name"
    @click="openApp"
  >
    <span class="app-icon__tile" :style="{ '--accent': app.accent ?? '#38bdf8' }">
      <component :is="iconComponent" :size="30" stroke-width="1.9" :style="{ color: app.iconColor ?? '#ffffff' }" />
      <span v-if="running" class="app-icon__state" aria-hidden="true" />
    </span>
    <span class="app-icon__name">{{ app.name }}</span>
  </button>
</template>
