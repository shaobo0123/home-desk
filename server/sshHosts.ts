import type { FastifyInstance } from 'fastify'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import type { SshHost } from '../src/types/app'

export const registerSshHostRoutes = (app: FastifyInstance, dataDir: string) => {
  const sshHostsFile = path.join(dataDir, 'ssh-hosts.yaml')

  const readSshHosts = async (): Promise<SshHost[]> => {
    try {
      const raw = await readFile(sshHostsFile, 'utf-8')
      const parsed = YAML.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map(normalizeSshHost)
    } catch {
      return []
    }
  }

  const writeSshHosts = async (hosts: SshHost[]) => {
    await mkdir(dataDir, { recursive: true })
    const doc = YAML.stringify(hosts, { collectionStyle: 'block' })
    await writeFile(sshHostsFile, doc, 'utf-8')
  }

  // GET /api/ssh-hosts
  app.get('/api/ssh-hosts', async () => {
    return readSshHosts()
  })

  // PUT /api/ssh-hosts
  app.put('/api/ssh-hosts', async (request) => {
    const body = request.body
    if (!Array.isArray(body)) throw new Error('Request body must be a list')

    const hosts = body.map(normalizeSshHost)
    await writeSshHosts(hosts)
    return hosts
  })
}

const normalizeSshHost = (value: unknown): SshHost => {
  if (!value || typeof value !== 'object') throw new Error('Every host must be an object')

  const src = value as Record<string, unknown>
  const id = requiredStr(src, 'id')
  const name = requiredStr(src, 'name')
  const host = requiredStr(src, 'host')
  const port = typeof src.port === 'number' ? src.port : 22
  const user = requiredStr(src, 'user')
  const authType = src.authType === 'password' ? 'password' : 'key'
  const keyPath = optStr(src, 'keyPath')
  const password = optStr(src, 'password')
  const icon = optStr(src, 'icon') || 'server'
  const accent = optStr(src, 'accent')

  return {
    id,
    name,
    host,
    port,
    user,
    authType,
    ...(keyPath ? { keyPath } : {}),
    ...(password ? { password } : {}),
    icon,
    ...(accent ? { accent } : {}),
  }
}

const requiredStr = (src: Record<string, unknown>, key: string): string => {
  const v = src[key]
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${key} is required`)
  return v.trim()
}

const optStr = (src: Record<string, unknown>, key: string): string | undefined => {
  const v = src[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}
