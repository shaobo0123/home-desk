<script setup lang="ts">
import { ExternalLink, Maximize2, Minimize2, Minus, X } from 'lucide-vue-next'
import type { NavApp } from '../types/app'

defineProps<{
  app: NavApp
  maximized: boolean
  zIndex: number
  offset: string
}>()

const emit = defineEmits<{
  close: []
  focus: []
  maximize: []
  minimize: []
  openExternal: []
}>()
</script>

<template>
  <section
    class="desktop-window"
    :class="{ maximized }"
    :style="{ zIndex, '--window-offset': offset }"
    :aria-label="app.name"
    @mousedown="emit('focus')"
  >
    <header class="desktop-window__bar">
      <span class="desktop-window__title">{{ app.name }}</span>
      <div class="desktop-window__location">
        <input class="desktop-window__url" :value="app.url" readonly aria-label="链接" />
        <button
          class="icon-button"
          type="button"
          title="新窗口打开"
          :disabled="app.url.startsWith('app://')"
          @click="emit('openExternal')"
        >
          <ExternalLink :size="16" />
        </button>
      </div>
      <div class="desktop-window__controls">
        <button class="icon-button" type="button" title="最小化" @click="emit('minimize')">
          <Minus :size="16" />
        </button>
        <button
          class="icon-button"
          type="button"
          :title="maximized ? '还原' : '最大化'"
          @click="emit('maximize')"
        >
          <Minimize2 v-if="maximized" :size="16" />
          <Maximize2 v-else :size="16" />
        </button>
        <button class="icon-button" type="button" title="关闭" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
    </header>

    <div class="desktop-window__body">
      <slot />
    </div>
  </section>
</template>
