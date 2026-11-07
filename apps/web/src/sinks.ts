/**
 * Browser file sinks for Pushpak. Prefers streaming straight to disk via the
 * File System Access API (Chrome/Edge desktop); falls back to in-memory Blob + download.
 */
import { MemorySink, type FileMeta, type FileSink, type SinkFactory, type Transfer } from '@narad/core'

export const hasFsAccess = typeof window !== 'undefined' && 'showSaveFilePicker' in window && 'showDirectoryPicker' in window

class WritableSink implements FileSink {
  constructor(private readonly w: FileSystemWritableFileStream) {}
  write(chunk: Uint8Array) {
    return this.w.write(chunk.slice())
  }
  close() {
    return this.w.close()
  }
  abort() {
    return this.w.abort()
  }
}

/**
 * Must be called from a user gesture (the Accept click). Opens the picker(s) up front,
 * then returns a factory that creates one sink per file as the transfer reaches it.
 */
export async function pickDiskSinks(files: FileMeta[]): Promise<SinkFactory | undefined> {
  try {
    if (files.length === 1 && !files[0]!.path) {
      const handle = await window.showSaveFilePicker({ suggestedName: files[0]!.name })
      return async () => new WritableSink(await handle.createWritable())
    }
    const dir = await window.showDirectoryPicker({ mode: 'readwrite' })
    return async (meta) => {
      // Folder transfers carry relative paths: recreate the tree under the chosen directory.
      const parts = (meta.path ?? meta.name).split('/').filter(Boolean).map(uniqueName)
      let cur = dir
      for (const seg of parts.slice(0, -1)) cur = await cur.getDirectoryHandle(seg, { create: true })
      const handle = await cur.getFileHandle(parts[parts.length - 1] ?? uniqueName(meta.name), { create: true })
      return new WritableSink(await handle.createWritable())
    }
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return undefined
    throw err
  }
}

export function memorySinks(onBlob: (blob: Blob, meta: FileMeta, transfer: Transfer) => void): SinkFactory {
  return async (meta, transfer) => new MemorySink(meta, (blob, m) => onBlob(blob, m, transfer))
}

export function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function uniqueName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_')
}

/** Expand dropped DataTransfer items (files and directories) into Files + relative paths. */
export async function filesFromDrop(dt: DataTransfer): Promise<{ files: File[]; paths: (string | undefined)[] }> {
  const files: File[] = []
  const paths: (string | undefined)[] = []
  const entries = Array.from(dt.items ?? [])
    .map((i) => (i.kind === 'file' ? (i as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.() : null))
    .filter((e): e is FileSystemEntry => !!e)
  if (!entries.length || entries.every((e) => e.isFile)) return { files: Array.from(dt.files), paths: Array.from(dt.files).map(() => undefined) }
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej))
      files.push(file)
      paths.push(prefix ? `${prefix}/${file.name}` : undefined)
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const all: FileSystemEntry[] = []
      // readEntries returns in batches until an empty batch
      while (true) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
        if (!batch.length) break
        all.push(...batch)
      }
      for (const e of all) await walk(e, prefix ? `${prefix}/${entry.name}` : entry.name)
    }
  }
  for (const e of entries) await walk(e, '')
  return { files, paths }
}
