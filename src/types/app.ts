export type OpenMode = 'same-tab' | 'new-tab'

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
}
