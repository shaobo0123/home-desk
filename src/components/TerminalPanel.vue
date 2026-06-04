<script setup lang="ts">
import { Plus, Server, X, Monitor, ChevronDown, Trash2 } from 'lucide-vue-next'
import { onMounted, onBeforeUnmount, ref, nextTick, computed } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import type { SshConfig, SshHost } from '../types/app'
import { fetchSshHosts, saveSshHosts } from '../api/sshHosts'

defineProps<{
  embedded?: boolean
}>()

// ── Session types ──

type SessionType = 'local' | 'ssh'

type Session = {
  id: string
  type: SessionType
  title: string
  ssh?: SshConfig
  terminal: Terminal
  fitAddon: FitAddon
  ws: WebSocket
  container: HTMLDivElement | null
  connected: boolean
}

// ── State ──

const sessions = ref<Session[]>([])
const activeSessionId = ref<string>('')
const showNewMenu = ref(false)
const showSshDialog = ref(false)
const showSshConfigs = ref(false)
const sshHosts = ref<SshHost[]>([])
const containerRef = ref<HTMLDivElement>()
let resizeObserver: ResizeObserver | undefined
let sessionCounter = 0

const activeSession = computed(() =>
  sessions.value.find((s) => s.id === activeSessionId.value),
)

// ── SSH dialog form ──

const sshForm = ref({
  host: '',
  port: '22',
  user: 'root',
  authType: 'key' as 'key' | 'password',
  keyPath: '',
  password: '',
  saveConfig: false,
  configName: '',
  configAccent: '#22c55e',
})
const sshFormError = ref('')

// ── Lifecycle ──

onMounted(async () => {
  // Load saved SSH hosts
  try {
    sshHosts.value = await fetchSshHosts()
  } catch {
    sshHosts.value = []
  }

  // Create initial local session
  createLocalSession()

  // Observe container resize
  resizeObserver = new ResizeObserver(() => {
    activeSession.value?.fitAddon.fit()
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  for (const session of sessions.value) {
    session.ws.close()
    session.terminal.dispose()
  }
  sessions.value = []
})

// ── Session management ──

const createLocalSession = () => {
  sessionCounter++
  const id = `local-${Date.now()}-${sessionCounter}`
  const container = document.createElement('div')
  container.style.width = '100%'
  container.style.height = '100%'

  const { terminal, fitAddon } = createTerminalInstance(false)

  // Connect WebSocket (local shell)
  const ws = connectWebSocket(terminal, undefined)

  const session: Session = {
    id,
    type: 'local',
    title: '本地',
    terminal,
    fitAddon,
    ws,
    container: null,
    connected: true,
  }

  sessions.value.push(session)
  activeSessionId.value = id

  // Mount terminal after DOM update
  nextTick(() => {
    const host = getActiveContainer()
    if (host) {
      host.appendChild(container)
      terminal.open(container)
      session.container = container
      requestAnimationFrame(() => fitAddon.fit())
    }
  })
}

const createSshSession = (config: SshConfig, title: string) => {
  sessionCounter++
  const id = `ssh-${Date.now()}-${sessionCounter}`
  const container = document.createElement('div')
  container.style.width = '100%'
  container.style.height = '100%'

  const { terminal, fitAddon } = createTerminalInstance(true)
  terminal.write(`\x1b[33m正在连接 ${config.user}@${config.host}...\x1b[0m\r\n`)

  const ws = connectWebSocket(terminal, config)

  const session: Session = {
    id,
    type: 'ssh',
    title,
    terminal,
    fitAddon,
    ws,
    container: null,
    connected: true,
    ssh: config,
  }

  sessions.value.push(session)
  activeSessionId.value = id
  showNewMenu.value = false
  showSshDialog.value = false

  nextTick(() => {
    const host = getActiveContainer()
    if (host) {
      host.appendChild(container)
      terminal.open(container)
      session.container = container
      requestAnimationFrame(() => fitAddon.fit())
    }
  })
}

const switchSession = (id: string) => {
  if (activeSessionId.value === id) return

  // Hide current terminal container
  const current = activeSession.value
  if (current?.container) {
    current.container.style.display = 'none'
  }

  activeSessionId.value = id

  // Show new terminal container
  const target = sessions.value.find((s) => s.id === id)
  if (target?.container) {
    target.container.style.display = ''
    target.fitAddon.fit()
  } else {
    // Container not yet mounted — will be handled by nextTick
    nextTick(() => {
      if (target?.container) {
        target.fitAddon.fit()
      }
    })
  }

  showNewMenu.value = false
}

const closeSession = (id: string) => {
  const idx = sessions.value.findIndex((s) => s.id === id)
  if (idx === -1) return

  const session = sessions.value[idx]
  session.ws.close()
  session.terminal.dispose()
  session.container?.remove()

  sessions.value.splice(idx, 1)

  // If closed the active session, switch to another
  if (activeSessionId.value === id) {
    if (sessions.value.length > 0) {
      const newActive = sessions.value[Math.min(idx, sessions.value.length - 1)]
      activeSessionId.value = newActive.id
      if (newActive.container) {
        newActive.container.style.display = ''
        newActive.fitAddon.fit()
      }
    } else {
      activeSessionId.value = ''
      // Create a new local session if all closed
      createLocalSession()
    }
  }
}

// ── Terminal helpers ──

const createTerminalInstance = (isSSH: boolean) => {
  const terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#0d1520',
      foreground: '#f6f7fb',
      cursor: isSSH ? '#22c55e' : '#38bdf8',
      selectionBackground: 'rgba(56, 189, 248, 0.3)',
      black: '#1e293b',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#facc15',
      blue: '#60a5fa',
      magenta: '#e879f9',
      cyan: '#22d3ee',
      white: '#f1f5f9',
      brightBlack: '#475569',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fde68a',
      brightBlue: '#93c5fd',
      brightMagenta: '#f0abfc',
      brightCyan: '#67e8f9',
      brightWhite: '#ffffff',
    },
  })

  const fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  return { terminal, fitAddon }
}

const connectWebSocket = (terminal: Terminal, ssh?: SshConfig): WebSocket => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams()

  if (ssh) {
    params.set('mode', 'ssh')
    params.set('host', ssh.host)
    params.set('port', String(ssh.port))
    params.set('user', ssh.user)
    params.set('authType', ssh.authType)
    if (ssh.keyPath) params.set('keyPath', ssh.keyPath)
    if (ssh.password) params.set('password', ssh.password)
  }

  const queryStr = params.toString()
  const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/terminal${queryStr ? '?' + queryStr : ''}`)

  ws.onmessage = (event) => {
    terminal.write(event.data)
  }

  ws.onclose = () => {
    terminal.write('\r\n\x1b[33m[连接已断开]\x1b[0m\r\n')
  }

  ws.onerror = () => {
    terminal.write('\r\n\x1b[31m[连接错误]\x1b[0m\r\n')
  }

  terminal.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })

  terminal.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('\x01' + JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  return ws
}

const getActiveContainer = (): HTMLElement | null => {
  return containerRef.value ?? null
}

// ── SSH connection ──

const handleSshConnect = async () => {
  sshFormError.value = ''
  const f = sshForm.value
  const host = f.host.trim()
  const port = Number(f.port)
  const user = f.user.trim()

  if (!host || !user) {
    sshFormError.value = '主机和用户必填'
    return
  }
  if (!port || port < 1 || port > 65535) {
    sshFormError.value = '端口需为 1-65535'
    return
  }
  if (f.authType === 'key' && !f.keyPath.trim()) {
    sshFormError.value = '密钥认证需要填写密钥路径'
    return
  }

  const config: SshConfig = {
    host,
    port,
    user,
    authType: f.authType,
    ...(f.authType === 'key' && f.keyPath.trim() ? { keyPath: f.keyPath.trim() } : {}),
    ...(f.authType === 'password' && f.password ? { password: f.password } : {}),
  }

  // Save config if requested
  if (f.saveConfig && f.configName.trim()) {
    const newHost: SshHost = {
      id: f.configName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ssh-' + Date.now(),
      name: f.configName.trim(),
      host,
      port,
      user,
      authType: f.authType,
      ...(f.authType === 'key' && f.keyPath.trim() ? { keyPath: f.keyPath.trim() } : {}),
      ...(f.authType === 'password' && f.password ? { password: f.password } : {}),
      accent: f.configAccent,
    }
    sshHosts.value.push(newHost)
    try {
      sshHosts.value = await saveSshHosts(sshHosts.value)
    } catch { /* ignore */ }
  }

  createSshSession(config, `${user}@${host}`)
  resetSshForm()
}

const connectToSavedHost = (host: SshHost) => {
  const config: SshConfig = {
    host: host.host,
    port: host.port,
    user: host.user,
    authType: host.authType,
    ...(host.keyPath ? { keyPath: host.keyPath } : {}),
    ...(host.password ? { password: host.password } : {}),
  }
  showNewMenu.value = false
  createSshSession(config, host.name)
}

const deleteSshHost = async (hostId: string) => {
  sshHosts.value = sshHosts.value.filter((h) => h.id !== hostId)
  try {
    sshHosts.value = await saveSshHosts(sshHosts.value)
  } catch { /* ignore */ }
}

const resetSshForm = () => {
  sshForm.value = {
    host: '',
    port: '22',
    user: 'root',
    authType: 'key',
    keyPath: '',
    password: '',
    saveConfig: false,
    configName: '',
    configAccent: '#22c55e',
  }
  sshFormError.value = ''
}

const openSshDialog = () => {
  showNewMenu.value = false
  showSshDialog.value = true
  resetSshForm()
}

const closeSshDialog = () => {
  showSshDialog.value = false
  resetSshForm()
}

// Close menus on outside click
const handlePanelClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.term-tab-bar') && !target.closest('.term-new-menu') && !target.closest('.term-ssh-dialog')) {
    showNewMenu.value = false
  }
}
</script>

<template>
  <div :class="embedded ? 'terminal-embed' : 'terminal-full'" @click="handlePanelClick">
    <!-- Tab bar -->
    <div class="term-tab-bar">
      <div class="term-tabs">
        <button
          v-for="session in sessions"
          :key="session.id"
          class="term-tab"
          :class="{ active: session.id === activeSessionId }"
          @click="switchSession(session.id)"
        >
          <Monitor v-if="session.type === 'local'" :size="13" />
          <Server v-else :size="13" class="term-tab__ssh-icon" />
          <span class="term-tab__title">{{ session.title }}</span>
          <span
            class="term-tab__close"
            role="button"
            tabindex="0"
            title="关闭"
            @click.stop="closeSession(session.id)"
            @keydown.enter.stop="closeSession(session.id)"
          >
            <X :size="12" />
          </span>
        </button>
      </div>

      <div class="term-tab-actions">
        <button class="term-tab-btn" title="新建" @click.stop="showNewMenu = !showNewMenu">
          <Plus :size="15" />
          <ChevronDown :size="12" />
        </button>
      </div>
    </div>

    <!-- New session dropdown menu -->
    <div v-if="showNewMenu" class="term-new-menu" @click.stop>
      <button class="term-new-menu__item" @click="createLocalSession(); showNewMenu = false">
        <Monitor :size="14" />
        本地终端
      </button>

      <div v-if="sshHosts.length > 0" class="term-new-menu__section">
        <span class="term-new-menu__label">已保存的主机</span>
        <button
          v-for="host in sshHosts"
          :key="host.id"
          class="term-new-menu__item term-new-menu__item--ssh"
          @click="connectToSavedHost(host)"
        >
          <Server :size="14" />
          <span>
            <strong>{{ host.name }}</strong>
            <small>{{ host.user }}@{{ host.host }}:{{ host.port }}</small>
          </span>
        </button>
      </div>

      <div class="term-new-menu__divider" />
      <button class="term-new-menu__item" @click="openSshDialog">
        <Server :size="14" />
        SSH 连接...
      </button>
    </div>

    <!-- Terminal containers -->
    <div class="term-body" ref="containerRef" />

    <!-- SSH connection dialog -->
    <div v-if="showSshDialog" class="term-ssh-dialog-backdrop" @click.self="closeSshDialog">
      <div class="term-ssh-dialog" @click.stop>
        <div class="term-ssh-dialog__header">
          <h3>SSH 连接</h3>
          <button class="term-ssh-dialog__close" @click="closeSshDialog">
            <X :size="16" />
          </button>
        </div>

        <!-- Saved hosts quick connect -->
        <div v-if="sshHosts.length > 0" class="term-ssh-dialog__saved">
          <span class="term-ssh-dialog__label">快速连接</span>
          <div class="term-ssh-dialog__host-list">
            <div
              v-for="host in sshHosts"
              :key="host.id"
              class="term-ssh-dialog__host-btn"
              role="button"
              tabindex="0"
              @click="connectToSavedHost(host)"
              @keydown.enter="connectToSavedHost(host)"
            >
              <span class="term-ssh-dialog__host-dot" :style="{ background: host.accent || '#22c55e' }" />
              <span>{{ host.name }}</span>
              <span
                class="term-ssh-dialog__host-delete"
                role="button"
                tabindex="0"
                title="删除配置"
                @click.stop="deleteSshHost(host.id)"
                @keydown.enter.stop="deleteSshHost(host.id)"
              >
                <Trash2 :size="12" />
              </span>
            </div>
          </div>
        </div>

        <div class="term-ssh-dialog__divider" />

        <!-- Manual connection form -->
        <form class="term-ssh-dialog__form" @submit.prevent="handleSshConnect">
          <div class="term-ssh-form-row">
            <label class="term-ssh-form-field" style="flex:2">
              <span>主机</span>
              <input v-model="sshForm.host" autocomplete="off" placeholder="192.168.1.100" />
            </label>
            <label class="term-ssh-form-field" style="flex:1">
              <span>端口</span>
              <input v-model="sshForm.port" autocomplete="off" inputmode="numeric" placeholder="22" />
            </label>
          </div>

          <label class="term-ssh-form-field">
            <span>用户名</span>
            <input v-model="sshForm.user" autocomplete="off" placeholder="root" />
          </label>

          <div class="term-ssh-form-toggle">
            <button
              type="button"
              :class="{ active: sshForm.authType === 'key' }"
              @click="sshForm.authType = 'key'"
            >密钥</button>
            <button
              type="button"
              :class="{ active: sshForm.authType === 'password' }"
              @click="sshForm.authType = 'password'"
            >密码</button>
          </div>

          <label v-if="sshForm.authType === 'key'" class="term-ssh-form-field">
            <span>密钥路径</span>
            <input v-model="sshForm.keyPath" autocomplete="off" placeholder="~/.ssh/id_rsa" />
          </label>

          <label v-else class="term-ssh-form-field">
            <span>密码</span>
            <input v-model="sshForm.password" type="password" autocomplete="off" placeholder="登录密码" />
          </label>

          <!-- Save config -->
          <label class="term-ssh-form-check">
            <input v-model="sshForm.saveConfig" type="checkbox" />
            <span>保存为配置</span>
          </label>

          <div v-if="sshForm.saveConfig" class="term-ssh-form-row">
            <label class="term-ssh-form-field" style="flex:2">
              <span>名称</span>
              <input v-model="sshForm.configName" autocomplete="off" placeholder="我的服务器" />
            </label>
            <label class="term-ssh-form-field" style="flex:1">
              <span>颜色</span>
              <input v-model="sshForm.configAccent" type="color" />
            </label>
          </div>

          <p v-if="sshFormError" class="term-ssh-form-error">{{ sshFormError }}</p>

          <div class="term-ssh-form-actions">
            <button type="button" class="term-ssh-btn term-ssh-btn--cancel" @click="closeSshDialog">取消</button>
            <button type="submit" class="term-ssh-btn term-ssh-btn--connect">连接</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
