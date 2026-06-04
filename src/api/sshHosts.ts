import type { SshHost } from '../types/app'

export const fetchSshHosts = async (): Promise<SshHost[]> => {
  const res = await fetch('/api/ssh-hosts')
  if (!res.ok) throw new Error('读取 SSH 配置失败')
  return res.json()
}

export const saveSshHosts = async (hosts: SshHost[]): Promise<SshHost[]> => {
  const res = await fetch('/api/ssh-hosts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hosts),
  })
  if (!res.ok) throw new Error('保存 SSH 配置失败')
  return res.json()
}
