/**
 * Akash on Cloudflare Workers + Durable Objects (WebSocket Hibernation).
 * One DO per room. Deploy: `pnpm --filter @narad/signaling deploy:cf`
 */
import { DurableObject } from 'cloudflare:workers'
import { clientIp, Room, roomIdFor, type SocketLike } from './room'
import { CORS, iceServersFor, type IceEnv } from './ice'
import { handlePush, type PushEnv, type PushStore, type PushSubscriptionJSONLike } from './push'

export interface Env extends IceEnv, PushEnv {
  ROOMS: DurableObjectNamespace<RoomDO>
  /** Optional KV namespace for push subscriptions (push is disabled without it). */
  PUSH?: KVNamespace
  LICENSE_PUBLIC_KEY?: string
}

const kvStore = (kv: KVNamespace): PushStore => ({
  get: async (t) => (await kv.get<PushSubscriptionJSONLike>(`sub:${t}`, 'json')) ?? undefined,
  set: (t, s) => kv.put(`sub:${t}`, JSON.stringify(s), { expirationTtl: 90 * 86400 }),
  del: (t) => kv.delete(`sub:${t}`),
})

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (url.pathname === '/health') return Response.json({ ok: true }, { headers: CORS })
    if (url.pathname === '/ice') return Response.json({ iceServers: await iceServersFor(env) }, { headers: { 'cache-control': 'no-store', ...CORS } })
    if (url.pathname.startsWith('/push/')) {
      if (!env.PUSH) return Response.json({ error: 'push disabled' }, { status: 404, headers: CORS })
      const r = await handlePush(req.method, url.pathname, () => req.json(), env, kvStore(env.PUSH))
      return r.body ? Response.json(r.body, { status: r.status, headers: CORS }) : new Response(null, { status: r.status, headers: CORS })
    }
    if (url.pathname !== '/ws') return new Response('Narad signaling (Akash). Nothing is stored here.\n')
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('expected websocket', { status: 426 })
    let room: { id: string; kind: string }
    try {
      room = await roomIdFor(url, clientIp(req.headers, '0.0.0.0'))
    } catch (err) {
      return new Response((err as Error).message, { status: 400 })
    }
    const stub = env.ROOMS.get(env.ROOMS.idFromName(room.id))
    const forward = new URL(req.url)
    forward.searchParams.set('__room', room.id)
    forward.searchParams.set('__kind', room.kind)
    return stub.fetch(new Request(forward.toString(), req))
  },
}

export class RoomDO extends DurableObject<Env> {
  private room?: Room
  private sockets = new Map<WebSocket, SocketLike>()

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const id = url.searchParams.get('__room') ?? 'unknown'
    const kind = (url.searchParams.get('__kind') as 'sabha' | 'code') ?? 'code'
    this.room ??= new Room(id, kind, { licensePublicKey: this.env.LICENSE_PUBLIC_KEY })
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    this.ctx.acceptWebSocket(server)
    this.sockets.set(server, this.wrap(server))
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const sock = this.sockets.get(ws) ?? this.wrap(ws)
    this.sockets.set(ws, sock)
    this.room ??= new Room('unknown', 'code')
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
    if (!this.room.handle(sock, text)) ws.close(4002, 'protocol')
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.drop(ws)
  }
  async webSocketError(ws: WebSocket): Promise<void> {
    this.drop(ws)
  }

  private drop(ws: WebSocket) {
    const sock = this.sockets.get(ws)
    if (sock) this.room?.leave(sock)
    this.sockets.delete(ws)
  }

  private wrap(ws: WebSocket): SocketLike {
    return { send: (d) => ws.send(d), close: (c, r) => ws.close(c, r) }
  }
}
