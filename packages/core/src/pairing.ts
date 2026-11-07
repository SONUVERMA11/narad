/**
 * Pairing = SPAKE2 over an already-open (but unauthenticated) secure channel.
 * The channel fingerprint is the PAKE context, so a MITM'd channel cannot pair.
 * On success both sides hold the same pairSecret and store each other as a contact.
 */
import type { Contact } from './contacts'
import { fromBase64, toBase64 } from './crypto'
import { constantTimeEqual, deriveFromPake, Spake2, type PakeResult, type PakeRole } from './pake'
import type { PeerConnection } from './peer'
import type { ControlMsg } from './protocol'

export interface PairingSelf {
  deviceId: string
  name: string
  identityPub: string
}

export function runPairing(conn: PeerConnection, role: PakeRole, code: string, me: PairingSelf, timeoutMs = 60_000): Promise<Contact> {
  return new Promise<Contact>((resolve, reject) => {
    if (!conn.fingerprint) return reject(new Error('channel not secure yet'))
    const spake = new Spake2(role, code, conn.fingerprint)
    let result: PakeResult | undefined
    let confirmed = false
    let settled = false

    const finish = (err?: Error, contact?: Contact) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      offControl()
      offClosed()
      if (err) {
        void conn.sendControl({ t: 'pair-fail', reason: err.message }).catch(() => {})
        reject(err)
      } else resolve(contact!)
    }

    const timer = setTimeout(() => finish(new Error('pairing timed out')), timeoutMs)
    const offClosed = conn.on('closed', () => finish(new Error('connection closed during pairing')))
    const offControl = conn.on('control', (msg: ControlMsg) => {
      void (async () => {
        try {
          switch (msg.t) {
            case 'pake': {
              if (msg.role === role) throw new Error('both devices chose the same role')
              if (result) throw new Error('duplicate pake message')
              result = spake.finish(fromBase64(msg.msg))
              await conn.sendControl({ t: 'pake-confirm', mac: toBase64(result.myConfirm) })
              break
            }
            case 'pake-confirm': {
              if (!result) throw new Error('confirm before key agreement')
              if (!constantTimeEqual(fromBase64(msg.mac), result.theirConfirm)) throw new Error('wrong code')
              confirmed = true
              await conn.sendControl({ t: 'pair-info', deviceId: me.deviceId, name: me.name, identityPub: me.identityPub })
              break
            }
            case 'pair-info': {
              if (!confirmed || !result) throw new Error('pair-info before confirmation')
              const pairSecret = toBase64(deriveFromPake(result.key, 'pair-secret'))
              finish(undefined, { deviceId: msg.deviceId, name: msg.name, identityPub: msg.identityPub, pairSecret, addedAt: Date.now() })
              break
            }
            case 'pair-fail':
              finish(new Error(`peer: ${msg.reason}`))
              break
          }
        } catch (err) {
          finish(err as Error)
        }
      })()
    })

    conn.sendControl({ t: 'pake', role, msg: toBase64(spake.message) }).catch((err) => finish(err as Error))
  })
}
