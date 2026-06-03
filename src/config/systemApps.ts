import type { NavApp } from '../types/app'

export const systemApps: NavApp[] = [
  {
    id: 'file-manager',
    name: '文件管理',
    url: '/files/',
    icon: 'folder',
    category: 'system',
    description: '内置文件管理入口',
    openMode: 'same-tab',
    locked: true,
    accent: '#22c55e',
  },
  {
    id: 'settings',
    name: '设置',
    url: 'app://settings',
    icon: 'settings',
    category: 'system',
    description: '内置应用设置',
    openMode: 'same-tab',
    locked: true,
    accent: '#60a5fa',
  },
  {
    id: 'terminal',
    name: '终端',
    url: '/terminal/',
    icon: 'terminal',
    category: 'system',
    description: '内置终端入口',
    openMode: 'same-tab',
    locked: true,
    accent: '#111827',
    iconColor: '#ffffff',
  },
]

export const systemAppIds = new Set(systemApps.map((app) => app.id))
