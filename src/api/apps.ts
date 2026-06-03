import type { NavApp } from '../types/app'

const appsEndpoint = '/api/apps'

export const fetchApps = async () => {
  const response = await fetch(appsEndpoint)

  if (!response.ok) {
    throw new Error('读取 YAML 配置失败')
  }

  return (await response.json()) as NavApp[]
}

export const saveApps = async (apps: NavApp[]) => {
  const response = await fetch(appsEndpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(apps),
  })

  if (!response.ok) {
    throw new Error('保存 YAML 配置失败')
  }

  return (await response.json()) as NavApp[]
}
