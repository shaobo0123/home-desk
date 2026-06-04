import type { FastifyInstance } from 'fastify'
import { readdir, readFile, rm, stat, writeFile, rename as fsRename, mkdir } from 'node:fs/promises'
import { createReadStream as createReadStreamCb } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'

type FileEntry = {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
}

const safePath = (userPath: string, root: string): string => {
  const resolved = resolve(root, '.' + userPath)
  if (!resolved.startsWith(root)) {
    throw new Error('Access denied: path outside root')
  }
  return resolved
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

export const registerFileRoutes = (app: FastifyInstance, filesRoot: string) => {
  const root = resolve(filesRoot)

  // List directory
  app.get('/api/files', async (request) => {
    const query = request.query as { path?: string }
    const dirPath = safePath(query.path || '/', root)

    const entries = await readdir(dirPath, { withFileTypes: true })
    const result: FileEntry[] = []

    for (const entry of entries) {
      // Skip hidden files/dirs
      if (entry.name.startsWith('.')) continue

      try {
        const fullPath = join(dirPath, entry.name)
        const stats = await stat(fullPath)
        result.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
        })
      } catch {
        // skip entries that can't be stat'd
      }
    }

    // Sort: directories first, then alphabetically
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return {
      path: '/' + dirPath.slice(root.length).replace(/^\//, ''),
      absolutePath: dirPath,
      entries: result,
    }
  })

  // Read text file content
  app.get('/api/files/content', async (request) => {
    const query = request.query as { path?: string }
    if (!query.path) throw new Error('path is required')
    const filePath = safePath(query.path, root)

    const stats = await stat(filePath)
    if (stats.isDirectory()) throw new Error('Cannot read directory as file')
    if (stats.size > 5 * 1024 * 1024) throw new Error('File too large for preview (max 5MB)')

    const content = await readFile(filePath, 'utf-8')
    return { path: query.path, content }
  })

  // Download file
  app.get('/api/files/download', async (request, reply) => {
    const query = request.query as { path?: string }
    if (!query.path) throw new Error('path is required')
    const filePath = safePath(query.path, root)

    const stats = await stat(filePath)
    if (stats.isDirectory()) throw new Error('Cannot download directory')

    const fileName = basename(filePath)
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    reply.header('Content-Type', 'application/octet-stream')
    reply.header('Content-Length', stats.size)

    return reply.send(createReadStreamCb(filePath))
  })

  // Write file content
  app.put('/api/files/content', async (request) => {
    const body = request.body as { path?: string; content?: string }
    if (!body.path) throw new Error('path is required')

    const filePath = safePath(body.path, root)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, body.content ?? '', 'utf-8')
    return { ok: true }
  })

  // Rename
  app.put('/api/files/rename', async (request) => {
    const body = request.body as { oldPath?: string; newName?: string }
    if (!body.oldPath || !body.newName) throw new Error('oldPath and newName are required')

    const oldResolved = safePath(body.oldPath, root)
    const newResolved = join(dirname(oldResolved), body.newName)

    // Ensure new path is also inside root
    if (!newResolved.startsWith(root)) throw new Error('Access denied: path outside root')

    await fsRename(oldResolved, newResolved)
    return { ok: true }
  })

  // Create directory
  app.post('/api/files/mkdir', async (request) => {
    const body = request.body as { path?: string }
    if (!body.path) throw new Error('path is required')

    const dirPath = safePath(body.path, root)
    await mkdir(dirPath, { recursive: true })
    return { ok: true }
  })

  // Upload files
  app.post('/api/files/upload', async (request) => {
    const data = await request.file()
    if (!data) throw new Error('No file uploaded')

    const query = request.query as { targetDir?: string }
    const targetDir = safePath(query.targetDir || '/', root)
    const targetPath = join(targetDir, data.filename)

    // Ensure target is inside root
    if (!targetPath.startsWith(root)) throw new Error('Access denied: path outside root')

    await pipeline(data.file, await import('node:fs').then(fs => fs.createWriteStream(targetPath)))
    return { ok: true }
  })

  // Delete file or directory
  app.delete('/api/files', async (request) => {
    const body = request.body as { path?: string }
    if (!body.path) throw new Error('path is required')

    const targetPath = safePath(body.path, root)
    await rm(targetPath, { recursive: true, force: true })
    return { ok: true }
  })
}
