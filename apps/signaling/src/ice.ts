/**
 * ICE config for clients. TURN credentials are minted here (coturn `use-auth-secret`,
 * HMAC-SHA1 over "<expiry>:<user>") so the shared secret never ships in a client bundle.
 * Runs on Node and Cloudflare Workers (WebCrypto only).
 */
export interface IceEnv {
  TURN_SECRET?: string
  /** comma-separated, e.g. "turn:turn.narad.sh:3478?transport=udp,turns:turn.narad.sh:5349" */
  TURN_URLS?: string
  TURN_TTL?: string
  STUN_URLS?: string
}

export async function iceServersFor(env: IceEnv): Promise<RTCIceServerLike[]> {
  const stun = (env.STUN_URLS ?? 'stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478').split(',').map((s) => s.trim()).filter(Boolean)
  const servers: RTCIceServerLike[] = [{ urls: stun }]
  if (env.TURN_SECRET && env.TURN_URLS) {
    const ttl = Number(env.TURN_TTL ?? 3600)
    const username = `${Math.floor(Date.now() / 1000) + ttl}:narad`
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TURN_SECRET), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username)))
    servers.push({ urls: env.TURN_URLS.split(',').map((s) => s.trim()).filter(Boolean), username, credential: b64(mac) })
  }
  return servers
}

export interface RTCIceServerLike {
  urls: string[]
  username?: string
  credential?: string
}

function b64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }
