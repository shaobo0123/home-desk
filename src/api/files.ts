const base = '/api/files'

export type FileEntry = {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
}

export type DirectoryListing = {
  path: string
  absolutePath: string
  entries: FileEntry[]
}

export const listDirectory = async (dirPath: string = '/'): Promise<DirectoryListing> => {
  const res = await fetch(`${base}?path=${encodeURIComponent(dirPath)}`)
  if (!res.ok) throw new Error('无法读取目录')
  return res.json()
}

export const readFileContent = async (filePath: string): Promise<{ path: string; content: string }> => {
  const res = await fetch(`${base}/content?path=${encodeURIComponent(filePath)}`)
  if (!res.ok) throw new Error('无法读取文件')
  return res.json()
}

export const writeFileContent = async (filePath: string, content: string): Promise<void> => {
  const res = await fetch(`${base}/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, content }),
  })
  if (!res.ok) throw new Error('无法保存文件')
}

export const createDirectory = async (dirPath: string): Promise<void> => {
  const res = await fetch(`${base}/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dirPath }),
  })
  if (!res.ok) throw new Error('无法创建目录')
}

export const deleteEntry = async (entryPath: string): Promise<void> => {
  const res = await fetch(`${base}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: entryPath }),
  })
  if (!res.ok) throw new Error('无法删除')
}

export const renameEntry = async (oldPath: string, newName: string): Promise<void> => {
  const res = await fetch(`${base}/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, newName }),
  })
  if (!res.ok) throw new Error('无法重命名')
}

export const downloadFile = (filePath: string) => {
  window.open(`${base}/download?path=${encodeURIComponent(filePath)}`, '_blank')
}

export const uploadFiles = async (targetDir: string, files: FileList): Promise<void> => {
  for (const file of files) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${base}/upload?targetDir=${encodeURIComponent(targetDir)}`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error(`上传 ${file.name} 失败`)
  }
}
