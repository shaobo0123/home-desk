<script setup lang="ts">
import type { NavApp } from '../types/app'
import AppIcon from './AppIcon.vue'

defineProps<{
  apps: NavApp[]
  minimizedAppIds: Set<string>
  runningAppIds: Set<string>
}>()

const emit = defineEmits<{
  openApp: [app: NavApp]
}>()
</script>

<template>
  <div class="app-grid" aria-label="应用列表">
    <AppIcon
      v-for="app in apps"
      :key="app.id"
      :app="app"
      :minimized="minimizedAppIds.has(app.id)"
      :running="runningAppIds.has(app.id)"
      @open-app="emit('openApp', $event)"
    />

    <p v-if="apps.length === 0" class="empty-state">没有匹配的服务</p>
  </div>
</template>
