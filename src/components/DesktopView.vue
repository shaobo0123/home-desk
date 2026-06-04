<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchApps, saveApps } from '../api/apps'
import type { NavApp } from '../types/app'
import AppGrid from './AppGrid.vue'
import DesktopWindow from './DesktopWindow.vue'
import FileManagerPanel from './FileManagerPanel.vue'
import SettingsPanel from './SettingsPanel.vue'
import TerminalPanel from './TerminalPanel.vue'
import TopBar from './TopBar.vue'

type OpenWindow = {
  id: string
  app: NavApp
  maximized: boolean
  minimized: boolean
  zIndex: number
}

const apps = ref<NavApp[]>([])
const openWindows = ref<OpenWindow[]>([])
const loading = ref(true)
const saving = ref(false)
const toastMessage = ref('')
const toastTone = ref<'info' | 'error'>('info')
let toastTimer: number | undefined
let nextWindowZIndex = 10

const runningAppIds = computed(() => new Set(openWindows.value.map((w) => w.id)))
const minimizedAppIds = computed(
  () =>
    new Set(
      openWindows.value
        .filter((w) => w.minimized)
        .map((w) => w.id),
    ),
)

const showToast = (message: string, tone: 'info' | 'error' = 'info') => {
  toastMessage.value = message
  toastTone.value = tone

  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }

  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
    toastTimer = undefined
  }, 3000)
}

const loadApps = async () => {
  loading.value = true

  try {
    apps.value = await fetchApps()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '读取 YAML 配置失败', 'error')
  } finally {
    loading.value = false
  }
}

const handleSaveApps = async (nextApps: NavApp[]) => {
  saving.value = true

  try {
    apps.value = await saveApps(nextApps)
    showToast('已保存')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存 YAML 配置失败', 'error')
  } finally {
    saving.value = false
  }
}

const focusWindow = (id: string) => {
  const target = openWindows.value.find((w) => w.id === id)

  if (target) {
    target.minimized = false
    nextWindowZIndex += 1
    target.zIndex = nextWindowZIndex
  }
}

const closeWindow = (id: string) => {
  openWindows.value = openWindows.value.filter((w) => w.id !== id)
}

const minimizeWindow = (id: string) => {
  const target = openWindows.value.find((w) => w.id === id)

  if (target) {
    target.minimized = true
  }
}

const toggleMaximizeWindow = (id: string) => {
  const target = openWindows.value.find((w) => w.id === id)

  if (target) {
    target.maximized = !target.maximized
    focusWindow(id)
  }
}

const openWindowExternal = (app: NavApp) => {
  if (!app.url.startsWith('app://')) {
    window.open(app.url, '_blank', 'noopener,noreferrer')
  }
}

const openDesktopWindow = (app: NavApp) => {
  const existingWindow = openWindows.value.find((w) => w.id === app.id)

  if (existingWindow) {
    focusWindow(app.id)
    return
  }

  nextWindowZIndex += 1
  openWindows.value.push({
    id: app.id,
    app: { ...app },
    maximized: false,
    minimized: false,
    zIndex: nextWindowZIndex,
  })
}

const handleOpenApp = (app: NavApp) => {
  if (app.openMode === 'new-tab') {
    window.open(app.url, '_blank', 'noopener,noreferrer')
    return
  }

  openDesktopWindow(app)
}

onMounted(loadApps)

onBeforeUnmount(() => {
  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }
})
</script>

<template>
  <main class="desktop-shell">
    <TopBar system-name="Mac mini" />

    <div v-if="toastMessage" class="toast" :class="toastTone" role="status">
      {{ toastMessage }}
    </div>

    <section class="desktop-main" aria-label="导航桌面">
      <div v-if="loading" class="desktop-loading">正在读取 YAML 配置</div>
      <AppGrid
        v-else
        :apps="apps"
        :minimized-app-ids="minimizedAppIds"
        :running-app-ids="runningAppIds"
        @open-app="handleOpenApp"
      />
    </section>

    <DesktopWindow
      v-for="(openWindow, index) in openWindows"
      v-show="!openWindow.minimized"
      :key="openWindow.id"
      :app="openWindow.app"
      :maximized="openWindow.maximized"
      :z-index="openWindow.zIndex"
      :offset="Math.min(index, 4) * 18 + 'px'"
      @close="closeWindow(openWindow.id)"
      @focus="focusWindow(openWindow.id)"
      @maximize="toggleMaximizeWindow(openWindow.id)"
      @minimize="minimizeWindow(openWindow.id)"
      @open-external="openWindowExternal(openWindow.app)"
    >
      <SettingsPanel
        v-if="openWindow.app.url === 'app://settings'"
        embedded
        :apps="apps"
        :saving="saving"
        @close="closeWindow(openWindow.id)"
        @save="handleSaveApps"
      />
      <TerminalPanel
        v-else-if="openWindow.app.url === 'app://terminal'"
        embedded
      />
      <FileManagerPanel
        v-else-if="openWindow.app.url === 'app://file-manager'"
        embedded
      />
      <iframe
        v-else
        class="desktop-window__frame"
        :src="openWindow.app.url"
        :title="openWindow.app.name"
      />
    </DesktopWindow>
  </main>
</template>
