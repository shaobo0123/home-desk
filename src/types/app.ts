export type OpenMode = 'same-tab' | 'new-tab'

export type SshConfig = {
  host: string
  port: number
  user: string
  authType: 'key' | 'password'
  keyPath?: string
  password?: string
}

export type SshHost = {
  id: string
  name: string
  host: string
  port: number
  user: string
  authType: 'key' | 'password'
  keyPath?: string
  password?: string
  icon?: string
  accent?: string
}

export type NavApp = {
  id: string
  name: string
  url: string
  icon: string
  category: string
  description: string
  openMode?: OpenMode
  locked?: boolean
  accent?: string
  iconColor?: string
  ssh?: SshConfig
}
