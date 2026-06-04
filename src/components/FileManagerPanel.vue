<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ChevronRight,
  Download,
  Edit3,
  File,
  FileCode,
  FileText,
  Folder,
  FolderPlus,
  Home,
  Image,
  Music,
  RefreshCw,
  Trash2,
  Upload,
  Video,
  Archive,
  X,
  Check,
  ArrowLeft,
} from 'lucide-vue-next'
import {
  listDirectory,
  readFileContent,
  writeFileContent,
  createDirectory,
  deleteEntry,
  renameEntry,
  downloadFile,
  uploadFiles,
  type FileEntry,
} from '../api/files'

defineProps<{
  embedded?: boolean
}>()

const currentPath = ref('/')
const entries = ref<FileEntry[]>([])
const loading = ref(false)
const error = ref('')

// Rename state
const renamingEntry = ref<string | null>(null)
const newName = ref('')

// Create directory state
const showNewDirInput = ref(false)
const newDirName = ref('')

// Text file preview
const previewFile = ref<{ path: string; content: string; editing: boolean } | null>(null)

// Drag state
const isDragging = ref(false)
const uploading = ref(false)

const pathSegments = computed(() => {
  if (currentPath.value === '/') return []
  return currentPath.value.split('/').filter(Boolean)
})

const getIcon = (entry: FileEntry) => {
  if (entry.type === 'directory') return Folder
  const ext = entry.name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, typeof File> = {
    js: FileCode, ts: FileCode, vue: FileCode, py: FileCode, jsx: FileCode, tsx: FileCode,
    html: FileCode, css: FileCode, scss: FileCode, json: FileCode, sh: FileCode,
    jpg: Image, jpeg: Image, png: Image, gif: Image, svg: Image, webp: Image,
    mp3: Music, wav: Music, flac: Music, aac: Music,
    mp4: Video, mkv: Video, avi: Video, mov: Video,
    pdf: FileText, md: FileText, txt: FileText, log: FileText, csv: FileText,
    zip: Archive, tar: Archive, gz: Archive, rar: Archive, '7z': Archive,
  }
  return map[ext] || File
}

const getIconColor = (entry: FileEntry) => {
  if (entry.type === 'directory') return '#22c55e'
  const ext = entry.name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    js: '#facc15', ts: '#3b82f6', vue: '#4ade80', py: '#60a5fa',
    html: '#f97316', css: '#a78bfa', json: '#fbbf24',
    jpg: '#f472b6', png: '#f472b6', gif: '#f472b6', svg: '#fb923c',
    mp3: '#e879f9', wav: '#e879f9',
    mp4: '#ef4444', mkv: '#ef4444',
    pdf: '#f87171', md: '#94a3b8', txt: '#94a3b8',
    zip: '#fbbf24', tar: '#fbbf24', gz: '#fbbf24',
  }
  return map[ext] || '#94a3b8'
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' +
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const isTextFile = (entry: FileEntry) => {
  if (entry.type === 'directory') return false
  const ext = entry.name.split('.').pop()?.toLowerCase() || ''
  const textExts = ['txt', 'md', 'json', 'js', 'ts', 'vue', 'jsx', 'tsx', 'css', 'scss',
    'html', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'sh', 'bash', 'zsh',
    'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'pl',
    'sql', 'env', 'gitignore', 'editorconfig', 'log', 'csv']
  return textExts.includes(ext) || entry.name.startsWith('.') || !entry.name.includes('.')
}

const loadDirectory = async () => {
  loading.value = true
  error.value = ''
  showNewDirInput.value = false
  renamingEntry.value = null

  try {
    const result = await listDirectory(currentPath.value)
    entries.value = result.entries
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取目录失败'
  } finally {
    loading.value = false
  }
}

const navigateTo = (path: string) => {
  currentPath.value = path || '/'
}

const navigateUp = () => {
  if (currentPath.value === '/') return
  const parent = '/' + currentPath.value.split('/').filter(Boolean).slice(0, -1).join('/')
  navigateTo(parent || '/')
}

const handleDoubleClick = (entry: FileEntry) => {
  if (entry.type === 'directory') {
    navigateTo(currentPath.value === '/' ? `/${entry.name}` : `${currentPath.value}/${entry.name}`)
  } else if (isTextFile(entry)) {
    openPreview(entry)
  } else {
    downloadFile(currentPath.value === '/' ? `/${entry.name}` : `${currentPath.value}/${entry.name}`)
  }
}

const startRename = (entry: FileEntry) => {
  renamingEntry.value = entry.name
  newName.value = entry.name
}

const confirmRename = async () => {
  if (!renamingEntry.value || !newName.value.trim()) return
  const entryPath = currentPath.value === '/' ? `/${renamingEntry.value}` : `${currentPath.value}/${renamingEntry.value}`
  try {
    await renameEntry(entryPath, newName.value.trim())
    renamingEntry.value = null
    await loadDirectory()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '重命名失败'
  }
}

const handleDelete = async (entry: FileEntry) => {
  if (!confirm(`确定要删除 ${entry.name} 吗？`)) return
  const entryPath = currentPath.value === '/' ? `/${entry.name}` : `${currentPath.value}/${entry.name}`
  try {
    await deleteEntry(entryPath)
    await loadDirectory()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

const confirmCreateDir = async () => {
  if (!newDirName.value.trim()) return
  const dirPath = currentPath.value === '/' ? `/${newDirName.value.trim()}` : `${currentPath.value}/${newDirName.value.trim()}`
  try {
    await createDirectory(dirPath)
    showNewDirInput.value = false
    newDirName.value = ''
    await loadDirectory()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建目录失败'
  }
}

const openPreview = async (entry: FileEntry) => {
  const filePath = currentPath.value === '/' ? `/${entry.name}` : `${currentPath.value}/${entry.name}`
  try {
    const result = await readFileContent(filePath)
    previewFile.value = { path: filePath, content: result.content, editing: false }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法读取文件'
  }
}

const savePreview = async () => {
  if (!previewFile.value) return
  try {
    await writeFileContent(previewFile.value.path, previewFile.value.content)
    previewFile.value = null
    await loadDirectory()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  }
}

const triggerUpload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.onchange = async () => {
    if (!input.files?.length) return
    uploading.value = true
    try {
      await uploadFiles(currentPath.value, input.files)
      await loadDirectory()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '上传失败'
    } finally {
      uploading.value = false
    }
  }
  input.click()
}

const handleDrop = async (event: DragEvent) => {
  isDragging.value = false
  const files = event.dataTransfer?.files
  if (!files?.length) return
  uploading.value = true
  try {
    await uploadFiles(currentPath.value, files)
    await loadDirectory()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '上传失败'
  } finally {
    uploading.value = false
  }
}

watch(currentPath, loadDirectory)
onMounted(loadDirectory)
</script>

<template>
  <div class="fm-panel" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="handleDrop">
    <!-- Toolbar -->
    <div class="fm-toolbar">
      <button class="fm-btn" @click="navigateUp" :disabled="currentPath === '/'" title="返回上级">
        <ArrowLeft :size="16" />
      </button>

      <div class="fm-breadcrumb">
        <button class="fm-breadcrumb__item" @click="navigateTo('/')">
          <Home :size="14" />
        </button>
        <template v-for="(seg, i) in pathSegments" :key="i">
          <ChevronRight :size="14" class="fm-breadcrumb__sep" />
          <button
            class="fm-breadcrumb__item"
            @click="navigateTo('/' + pathSegments.slice(0, i + 1).join('/'))"
          >
            {{ seg }}
          </button>
        </template>
      </div>

      <div class="fm-toolbar__actions">
        <button class="fm-btn" @click="showNewDirInput = true; newDirName = ''" title="新建文件夹">
          <FolderPlus :size="16" />
        </button>
        <button class="fm-btn" @click="triggerUpload" :disabled="uploading" title="上传文件">
          <Upload :size="16" />
        </button>
        <button class="fm-btn" @click="loadDirectory" :disabled="loading" title="刷新">
          <RefreshCw :size="16" :class="{ 'fm-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- New directory input -->
    <div v-if="showNewDirInput" class="fm-new-dir">
      <input
        v-model="newDirName"
        class="fm-input fm-input--inline"
        placeholder="文件夹名称"
        @keyup.enter="confirmCreateDir"
        @keyup.escape="showNewDirInput = false"
        autofocus
      />
      <button class="fm-btn fm-btn--sm" @click="confirmCreateDir"><Check :size="14" /></button>
      <button class="fm-btn fm-btn--sm" @click="showNewDirInput = false"><X :size="14" /></button>
    </div>

    <!-- Error -->
    <div v-if="error" class="fm-error">{{ error }}</div>

    <!-- Uploading indicator -->
    <div v-if="uploading" class="fm-uploading">上传中...</div>

    <!-- File list -->
    <div class="fm-list">
      <!-- Table header -->
      <div class="fm-list__header">
        <span class="fm-col-name">名称</span>
        <span class="fm-col-size">大小</span>
        <span class="fm-col-date">修改时间</span>
        <span class="fm-col-actions">操作</span>
      </div>

      <!-- Entries -->
      <div class="fm-list__body">
        <div
          v-for="entry in entries"
          :key="entry.name"
          class="fm-entry"
          :class="{ 'fm-entry--dir': entry.type === 'directory' }"
          @dblclick="handleDoubleClick(entry)"
        >
          <span class="fm-col-name">
            <component :is="getIcon(entry)" :size="16" :style="{ color: getIconColor(entry) }" class="fm-entry__icon" />
            <template v-if="renamingEntry === entry.name">
              <input
                v-model="newName"
                class="fm-input fm-input--inline"
                @keyup.enter="confirmRename"
                @keyup.escape="renamingEntry = null"
                @blur="confirmRename"
                autofocus
              />
            </template>
            <template v-else>
              <span class="fm-entry__name">{{ entry.name }}</span>
            </template>
          </span>
          <span class="fm-col-size">{{ entry.type === 'file' ? formatSize(entry.size) : '-' }}</span>
          <span class="fm-col-date">{{ formatDate(entry.modified) }}</span>
          <span class="fm-col-actions">
            <button v-if="entry.type === 'file'" class="fm-btn fm-btn--ghost" @click="downloadFile(currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`)" title="下载">
              <Download :size="14" />
            </button>
            <button v-if="entry.type === 'file' && isTextFile(entry)" class="fm-btn fm-btn--ghost" @click="openPreview(entry)" title="编辑">
              <Edit3 :size="14" />
            </button>
            <button class="fm-btn fm-btn--ghost" @click="startRename(entry)" title="重命名">
              <Edit3 :size="14" />
            </button>
            <button class="fm-btn fm-btn--ghost fm-btn--danger" @click="handleDelete(entry)" title="删除">
              <Trash2 :size="14" />
            </button>
          </span>
        </div>

        <div v-if="entries.length === 0 && !loading" class="fm-empty">
          此目录为空
        </div>
      </div>
    </div>

    <!-- Drop overlay -->
    <div v-if="isDragging" class="fm-dropzone">
      <Upload :size="48" />
      <span>拖放文件到此处上传</span>
    </div>

    <!-- File preview overlay -->
    <div v-if="previewFile" class="fm-preview-overlay">
      <div class="fm-preview">
        <div class="fm-preview__header">
          <span class="fm-preview__title">{{ previewFile.path.split('/').pop() }}</span>
          <div class="fm-preview__actions">
            <button v-if="!previewFile.editing" class="fm-btn" @click="previewFile.editing = true">
              <Edit3 :size="14" /> 编辑
            </button>
            <button v-else class="fm-btn fm-btn--primary" @click="savePreview">
              <Check :size="14" /> 保存
            </button>
            <button class="fm-btn" @click="previewFile = null">
              <X :size="14" /> 关闭
            </button>
          </div>
        </div>
        <textarea
          v-if="previewFile.editing"
          class="fm-preview__editor"
          v-model="previewFile.content"
          spellcheck="false"
        />
        <pre v-else class="fm-preview__content">{{ previewFile.content }}</pre>
      </div>
    </div>
  </div>
</template>
