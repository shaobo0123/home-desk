<script setup lang="ts">
import { Monitor, Wifi } from 'lucide-vue-next'
import { onBeforeUnmount, ref } from 'vue'

defineProps<{
  systemName: string
}>()

const now = ref(new Date())
const timer = window.setInterval(() => {
  now.value = new Date()
}, 1000)

onBeforeUnmount(() => {
  window.clearInterval(timer)
})

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('zh-CN', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
</script>

<template>
  <header class="top-bar">
    <div class="top-brand">
      <Monitor :size="18" />
      <span>{{ systemName }}</span>
    </div>

    <div class="top-status">
      <Wifi :size="17" />
      <span>{{ formatTime(now) }}</span>
    </div>
  </header>
</template>
