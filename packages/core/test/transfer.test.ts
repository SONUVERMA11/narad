import { describe, expect, it } from 'vitest'
import { chunkFile } from '../src/transfer'
import { CHUNK_DATA } from '../src/protocol'
import { nameFor, randomRoomCode } from '../src/names'

describe('Pushpak chunking', () => {
  it('splits a file into fixed-size chunks and preserves bytes', async () => {
    const size = CHUNK_DATA * 3 + 1234
    const data = new Uint8Array(size)
    for (let i = 0; i < size; i += 65536) crypto.getRandomValues(data.subarray(i, Math.min(size, i + 65536)))
    const file = new File([data], 'blob.bin')
    const chunks: Uint8Array[] = []
    for await (const c of chunkFile(file)) chunks.push(c.slice())
    expect(chunks.length).toBe(4)
    expect(chunks.slice(0, 3).every((c) => c.length === CHUNK_DATA)).toBe(true)
    expect(chunks[3]!.length).toBe(1234)
    const joined = new Uint8Array(size)
    let off = 0
    for (const c of chunks) {
      joined.set(c, off)
      off += c.length
    }
    expect(joined).toEqual(data)
  })

  it('yields one empty chunk for an empty file', async () => {
    const chunks = []
    for await (const c of chunkFile(new File([], 'empty.txt'))) chunks.push(c)
    expect(chunks.length).toBe(1)
    expect(chunks[0]!.length).toBe(0)
  })
})

describe('names', () => {
  it('is deterministic per seed', () => {
    expect(nameFor('abc')).toEqual(nameFor('abc'))
    expect(nameFor('abc').name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
  })
  it('room codes look like word-word-nn', () => {
    expect(randomRoomCode()).toMatch(/^[a-z]+-[a-z]+-\d{2}$/)
  })
})
