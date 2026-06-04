<script setup lang="ts">
import {
  AppWindow,
  ExternalLink,
  Grid2X2,
  LockKeyhole,
  Plus,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import type { NavApp, OpenMode } from '../types/app'
import {
  buildCurrentHostUrl,
  getCurrentHostPrefix,
  isValidPort,
} from '../utils/hostUrl'
import ConfirmDialog from './ConfirmDialog.vue'

type AddressMode = 'url' | 'port'

const props = defineProps<{
  apps: NavApp[]
  saving: boolean
  embedded?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [apps: NavApp[]]
}>()

const emptyForm = () => ({
  name: '',
  url: '',
  port: '',
  addressMode: 'url' as AddressMode,
  icon: 'globe',
  accent: '#38bdf8',
})

const draftApps = ref<NavApp[]>([])
const form = ref(emptyForm())
const formError = ref('')
const activeSection = ref<'apps' | 'system'>('apps')
const globalOpenMode = ref<OpenMode>('same-tab')
const pendingDeleteId = ref<string | null>(null)

const customApps = computed(() => draftApps.value.filter((app) => !app.locked))
const systemDraftApps = computed(() => draftApps.value.filter((app) => app.locked))

const pendingDeleteApp = computed(() =>
  pendingDeleteId.value ? draftApps.value.find((a) => a.id === pendingDeleteId.value) : null,
)
const currentHostPrefix = computed(() => getCurrentHostPrefix())
const formResolvedUrl = computed(() =>
  form.value.addressMode === 'port' ? buildCurrentHostUrl(form.value.port) : form.value.url.trim(),
)

const getFaviconUrl = (url: string) => {
  const trimmed = url.trim()
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return ''
  try {
    const parsed = new URL(trimmed)
    return `${parsed.origin}/favicon.ico`
  } catch {
    return ''
  }
}

const formFaviconUrl = computed(() => getFaviconUrl(formResolvedUrl.value))
const formFaviconFailed = ref(false)
const failedFavicons = ref(new Set<string>())

watch(formFaviconUrl, () => {
  formFaviconFailed.value = false
})

watch(
  () => props.apps,
  (apps) => {
    draftApps.value = apps.map((app) => ({ ...app }))
    const firstCustom = apps.find((app) => !app.locked)
    globalOpenMode.value = firstCustom?.openMode ?? 'same-tab'
  },
  { immediate: true },
)

const createId = (name: string) => {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const fallback = 'app-' + Date.now()
  const seed = base || fallback
  let candidate = seed
  let index = 2

  while (draftApps.value.some((app) => app.id === candidate)) {
    candidate = seed + '-' + index
    index += 1
  }

  return candidate
}

const autoSave = () => {
  emit('save', draftApps.value.map((app) => ({ ...app })))
}

const addApp = () => {
  formError.value = ''
  const name = form.value.name.trim()
  const url = formResolvedUrl.value

  if (!name) {
    formError.value = '名称必填'
    return
  }

  if (form.value.addressMode === 'port' && !isValidPort(form.value.port)) {
    formError.value = '端口需为 1-65535'
    return
  }

  if (!url) {
    formError.value = '名称和地址必填'
    return
  }

  draftApps.value.push({
    id: createId(name),
    name,
    url,
    icon: form.value.icon,
    category: '',
    description: '',
    openMode: globalOpenMode.value,
    accent: form.value.accent,
  })
  form.value = emptyForm()
  autoSave()
}

const requestDelete = (id: string) => {
  if (draftApps.value.some((app) => app.id === id && app.locked)) {
    return
  }
  pendingDeleteId.value = id
}

const confirmDelete = () => {
  if (pendingDeleteId.value) {
    draftApps.value = draftApps.value.filter((app) => app.id !== pendingDeleteId.value)
    pendingDeleteId.value = null
    autoSave()
  }
}

const cancelDelete = () => {
  pendingDeleteId.value = null
}

const setGlobalOpenMode = (mode: OpenMode) => {
  globalOpenMode.value = mode
  for (const app of draftApps.value) {
    if (!app.locked) {
      app.openMode = mode
    }
  }
  autoSave()
}

const handleBackdropClick = () => {
  if (!props.embedded) {
    emit('close')
  }
}

const onFaviconError = (url: string) => {
  failedFavicons.value.add(url)
}

const setAddressMode = (mode: AddressMode) => {
  form.value.addressMode = mode
  formError.value = ''
}
</script>

<template>
  <div
    :class="embedded ? 'settings-embed' : 'settings-backdrop'"
    role="presentation"
    @click.self="handleBackdropClick"
  >
    <section class="settings-panel" :class="{ embedded }" aria-label="设置">
      <header v-if="!embedded" class="settings-header">
        <h2>应用设置</h2>
        <button class="icon-button" type="button" title="关闭" @click="emit('close')">
          <X :size="18" />
        </button>
      </header>

      <div class="settings-content">
        <aside class="settings-sidebar" aria-label="设置分类">
          <button
            class="settings-nav-item"
            :class="{ active: activeSection === 'apps' }"
            type="button"
            @click="activeSection = 'apps'"
          >
            <Grid2X2 :size="17" />
            <span>应用</span>
            <small>{{ customApps.length }}</small>
          </button>

          <button
            class="settings-nav-item"
            :class="{ active: activeSection === 'system' }"
            type="button"
            @click="activeSection = 'system'"
          >
            <LockKeyhole :size="17" />
            <span>系统应用</span>
            <small>{{ systemDraftApps.length }}</small>
          </button>
        </aside>

        <div class="settings-page">
          <section v-if="activeSection === 'apps'" class="settings-section" aria-label="应用">
            <header class="settings-section-header">
              <h3>应用</h3>
              <div class="open-mode-toggle">
                <button
                  type="button"
                  class="mode-option"
                  :class="{ active: globalOpenMode === 'same-tab' }"
                  :disabled="saving"
                  @click="setGlobalOpenMode('same-tab')"
                >
                  <AppWindow :size="15" />
                  窗口内
                </button>
                <button
                  type="button"
                  class="mode-option"
                  :class="{ active: globalOpenMode === 'new-tab' }"
                  :disabled="saving"
                  @click="setGlobalOpenMode('new-tab')"
                >
                  <ExternalLink :size="15" />
                  新窗口
                </button>
              </div>
            </header>

            <div class="settings-apps-layout">
              <form class="settings-form" @submit.prevent="addApp">
                <label>
                  <span>名称</span>
                  <input
                    v-model="form.name"
                    autocomplete="off"
                    placeholder="Jellyfin"
                    :disabled="saving"
                  />
                </label>

                <div class="address-mode-toggle" aria-label="地址类型">
                  <button
                    type="button"
                    class="mode-option"
                    :class="{ active: form.addressMode === 'url' }"
                    :disabled="saving"
                    @click="setAddressMode('url')"
                  >
                    完整地址
                  </button>
                  <button
                    type="button"
                    class="mode-option"
                    :class="{ active: form.addressMode === 'port' }"
                    :disabled="saving"
                    @click="setAddressMode('port')"
                  >
                    当前主机端口
                  </button>
                </div>

                <label v-if="form.addressMode === 'url'">
                  <span>地址</span>
                  <input
                    v-model="form.url"
                    autocomplete="off"
                    placeholder="http://macmini.local:8096"
                    :disabled="saving"
                  />
                </label>

                <label v-else>
                  <span>端口</span>
                  <div class="port-url-field">
                    <span class="port-url-prefix">{{ currentHostPrefix }}:</span>
                    <input
                      v-model="form.port"
                      autocomplete="off"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      placeholder="5244"
                      :disabled="saving"
                    />
                  </div>
                </label>

                <div v-if="formFaviconUrl && !formFaviconFailed" class="favicon-preview">
                  <img :src="formFaviconUrl" alt="图标预览" @error="formFaviconFailed = true" />
                  <span>自动获取的图标</span>
                </div>

                <div class="form-row compact">
                  <label>
                    <span>颜色</span>
                    <input v-model="form.accent" type="color" />
                  </label>

                </div>

                <p v-if="formError" class="form-error">{{ formError }}</p>

                <button class="primary-button" type="submit" :disabled="saving">
                  <Plus :size="17" />
                  {{ saving ? '保存中…' : '添加应用' }}
                </button>
              </form>

              <div class="settings-list" aria-label="自定义应用列表">
                <article v-for="app in customApps" :key="app.id" class="settings-item">
                  <img
                    v-if="getFaviconUrl(app.url) && !failedFavicons.has(app.url)"
                    :src="getFaviconUrl(app.url)"
                    :alt="app.name"
                    class="settings-item__favicon"
                    @error="onFaviconError(app.url)"
                  />
                  <span
                    v-else
                    class="settings-item__swatch"
                    :style="{ background: app.accent ?? '#38bdf8' }"
                  />
                  <div>
                    <strong>{{ app.name }}</strong>
                    <span>{{ app.url }}</span>
                  </div>
                  <button
                    class="icon-button danger"
                    type="button"
                    title="删除"
                    :disabled="saving"
                    @click="requestDelete(app.id)"
                  >
                    <Trash2 :size="17" />
                  </button>
                </article>

                <p v-if="customApps.length === 0" class="settings-empty">没有自定义应用</p>
              </div>
            </div>
          </section>

          <section v-else class="settings-section" aria-label="系统应用">
            <header class="settings-section-header">
              <h3>系统应用</h3>
            </header>

            <div class="settings-list full" aria-label="系统应用列表">
              <article v-for="app in systemDraftApps" :key="app.id" class="settings-item">
                <span
                  class="settings-item__swatch"
                  :style="{ background: app.accent ?? '#38bdf8' }"
                />
                <div>
                  <strong>{{ app.name }}</strong>
                  <span>{{ app.url }}</span>
                </div>
                <button
                  class="icon-button locked"
                  type="button"
                  title="系统应用，不能删除"
                  disabled
                >
                  <LockKeyhole :size="16" />
                </button>
              </article>
            </div>
          </section>
        </div>
      </div>
    </section>

    <ConfirmDialog
      :open="pendingDeleteId !== null"
      title="删除应用"
      :message="pendingDeleteApp ? `确定删除「${pendingDeleteApp.name}」吗？` : ''"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
