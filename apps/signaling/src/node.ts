/**
 * Akash on Node — runs anywhere (laptop, ₹400 VPS, Fly.io, Docker).
 *   NARAD_PORT=8794 pnpm start   (PORT is also honoured for PaaS hosts)
 */
import { createServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { clientIp, Room, roomIdFor } from './room'
import type { RoomKind } from '@narad/core'
import { consoleAudit, Counter } from './limits'
import { CORS, iceServersFor } from './ice'
import { handlePush, MemoryPushStore, pushEnabled } from './push'
import { readFileSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.NARAD_PORT ?? process.env.PORT ?? 8794)
const rooms = new Map<string, Room>()
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP ?? 40)
const MAX_CONN_TOTAL = Number(process.env.MAX_CONN_TOTAL ?? 5000)
const ROOM_CAPACITY = process.env.ROOM_CAPACITY ? Number(process.env.ROOM_CAPACITY) : undefined
const audit = process.env.AUDIT_LOG === '1' ? consoleAudit : undefined
const perIp = new Counter()
let total = 0
const started = Date.now()

// Push subscriptions: in memory, optionally persisted to a JSON file (PUSH_STORE_FILE) across restarts.
const pushStore = new MemoryPushStore()
const PUSH_FILE = process.env.PUSH_STORE_FILE
if (PUSH_FILE) {
  try {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(PUSH_FILE, 'utf8')) as Record<string, never>)) void pushStore.set(k, v)
  } catch {
    /* first run */
  }
  const persist = () => {
    try {
      writeFileSync(PUSH_FILE, JSON.stringify(Object.fromEntries((pushStore as unknown as { m: Map<string, unknown> }).m)))
    } catch (err) {
      console.warn('[narad/akash] could not persist push store', err)
    }
  }
  const origSet = pushStore.set.bind(pushStore)
  const origDel = pushStore.del.bind(pushStore)
  pushStore.set = async (t, s) => (await origSet(t, s), persist())
  pushStore.del = async (t) => (await origDel(t), persist())
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }
  if (req.url === '/ice') {
    void iceServersFor(process.env).then((iceServers) => {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS })
      res.end(JSON.stringify({ iceServers }))
    })
    return
  }
  if (req.url?.startsWith('/push/')) {
    const readJson = () =>
      new Promise<unknown>((resolve, reject) => {
        let data = ''
        req.on('data', (c: Buffer) => {
          data += c
          if (data.length > 8192) req.destroy()
        })
        req.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      })
    void handlePush(req.method ?? 'GET', req.url.split('?')[0]!, readJson, process.env, pushStore).then((r) => {
      res.writeHead(r.status, { 'content-type': 'application/json', ...CORS })
      res.end(r.body ? JSON.stringify(r.body) : undefined)
    })
    return
  }
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, peers: [...rooms.values()].reduce((a, r) => a + r.size, 0), connections: total, uptimeSec: Math.round((Date.now() - started) / 1000), push: pushEnabled(process.env) }))
    return
  }
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('Narad signaling (Akash). Nothing is stored here.\n')
})

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 })
const CORS_POST = { ...CORS, 'access-control-allow-methods': 'GET, POST, OPTIONS' }
void CORS_POST

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const ip = clientIp({ get: (n) => req.headers[n] as string | undefined }, req.socket.remoteAddress ?? '0.0.0.0')
  if (total >= MAX_CONN_TOTAL || perIp.get(ip) >= MAX_CONN_PER_IP) {
    audit?.({ ev: 'limit', what: 'ip', ts: Date.now() })
    ws.close(4003, 'too many connections')
    return
  }
  total++
  perIp.inc(ip)
  ws.once('close', () => {
    total--
    perIp.dec(ip)
  })
  const sock = { send: (d: string) => ws.send(d), close: (c?: number, r?: string) => ws.close(c, r) }
  let room: Room | undefined
  let roomKey: { id: string; kind: RoomKind } | undefined
  // Attach listeners before any await: a fast client's `join` can arrive while the room id is still being computed.
  const queue: string[] = []
  // Always resolve the live Room from the map at message time. An empty room is dropped from the map when its last
  // member leaves; a connection that resolved its room id just before that must not join the orphaned object.
  const liveRoom = (): Room => {
    const { id, kind } = roomKey!
    let r = rooms.get(id)
    if (!r) {
      r = new Room(id, kind, { capacity: ROOM_CAPACITY, audit, licensePublicKey: process.env.LICENSE_PUBLIC_KEY })
      rooms.set(id, r)
    }
    if (room && room !== r) room.leave(sock)
    room = r
    return r
  }
  const dispatch = (text: string) => {
    if (!liveRoom().handle(sock, text)) ws.close(4002, 'protocol')
  }
  ws.on('message', (data) => {
    const text = data.toString()
    if (!roomKey) {
      queue.push(text)
      return
    }
    dispatch(text)
  })
  ws.on('close', () => {
    if (!room) return
    room.leave(sock)
    if (room.size === 0 && rooms.get(room.id) === room) rooms.delete(room.id)
  })
  ws.on('error', () => ws.close())

  void roomIdFor(url, ip)
    .then(({ id, kind }) => {
      if (ws.readyState !== ws.OPEN) return
      roomKey = { id, kind }
      for (const text of queue.splice(0)) dispatch(text)
    })
    .catch((err: Error) => {
      ws.send(JSON.stringify({ t: 'error', message: err.message }))
      ws.close(4001, 'bad room')
    })
})

server.listen(PORT, () => console.log(`[narad/akash] signaling on ws://localhost:${PORT}/ws (health: /health)`))
