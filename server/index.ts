import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { systemAppIds, systemApps } from '../src/config/systemApps'
import type { NavApp, OpenMode } from '../src/types/app'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const dataDir = path.join(rootDir, 'data')
const appsFile = path.join(dataDir, 'apps.yaml')
const distDir = path.join(rootDir, 'dist')

const app = Fastify({ logger: true })
const allowedOpenModes = new Set<OpenMode>(['same-tab', 'new-tab'])

const readApps = async () => {
  const raw = await readFile(appsFile, 'utf-8')
  const parsed = YAML.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error('apps.yaml must contain a list')
  }

  return withSystemApps(parsed.map(normalizeApp))
}

const writeApps = async (apps: NavApp[]) => {
  await mkdir(dataDir, { recursive: true })
  const doc = YAML.stringify(withSystemApps(apps), { collectionStyle: 'block' })
  await writeFile(appsFile, doc, 'utf-8')
}

const withSystemApps = (apps: NavApp[]) => {
  const userApps = apps.filter((app) => !systemAppIds.has(app.id))

  return [
    ...systemApps.map((app) => ({ ...app })),
    ...userApps,
  ]
}

const normalizeApp = (value: unknown): NavApp => {
  if (!value || typeof value !== 'object') {
    throw new Error('Every app must be an object')
  }

  const source = value as Record<string, unknown>
  const id = readRequiredString(source, 'id')
  const name = readRequiredString(source, 'name')
  const url = readRequiredString(source, 'url')
  const icon = readOptionalString(source, 'icon') || 'globe'
  const category = readOptionalString(source, 'category') || ''
  const description = readOptionalString(source, 'description') || ''
  const openModeValue = readOptionalString(source, 'openMode') || 'new-tab'
  const accent = readOptionalString(source, 'accent')
  const iconColor = readOptionalString(source, 'iconColor')

  if (!allowedOpenModes.has(openModeValue as OpenMode)) {
    throw new Error(`Invalid openMode for ${name}`)
  }

  return {
    id,
    name,
    url,
    icon,
    category,
    description,
    openMode: openModeValue as OpenMode,
    locked: Boolean(source.locked),
    ...(accent ? { accent } : {}),
    ...(iconColor ? { iconColor } : {}),
  }
}

const readRequiredString = (source: Record<string, unknown>, key: string) => {
  const value = source[key]

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${key} is required`)
  }

  return value.trim()
}

const readOptionalString = (source: Record<string, unknown>, key: string) => {
  const value = source[key]

  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

app.get('/api/apps', async () => {
  return readApps()
})

app.put('/api/apps', async (request) => {
  const apps = request.body

  if (!Array.isArray(apps)) {
    throw new Error('Request body must be an app list')
  }

  const normalizedApps = withSystemApps(apps.map(normalizeApp))
  await writeApps(normalizedApps)

  return normalizedApps
})

app.get('/api/health', async () => {
  return { ok: true }
})

try {
  await access(distDir)
  await app.register(fastifyStatic, {
    root: distDir,
    prefix: '/',
  })
} catch {
  app.log.info('dist directory not found; static serving is disabled')
}

const port = Number(process.env.PORT || 3010)
const host = process.env.HOST || '0.0.0.0'

await app.listen({ host, port })
