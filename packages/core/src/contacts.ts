/**
 * Contacts = pairwise secrets. Two paired devices share `pairSecret`; both join the
 * room derived from it, so they find each other on any network without a directory
 * and without the server learning who is whose contact.
 */
import { sha256Hex } from './crypto'
import { store } from './identity'

export interface Contact {
  deviceId: string
  name: string
  /** base64 SPKI of the contact's identity key (Phase 3: signed presence). */
  identityPub: string
  /** base64, 32 bytes, derived from the SPAKE2 key at pairing time. */
  pairSecret: string
  addedAt: number
  /** Auto-accept files from this contact without a prompt. */
  autoAccept?: boolean
  /** Push my clipboard changes to this contact and apply theirs (each side opts in separately). */
  syncClipboard?: boolean
}

const PREFIX = 'contact:'

export const contacts = {
  list: () => store.list<Contact>(PREFIX),
  get: (deviceId: string) => store.get<Contact>(PREFIX + deviceId),
  save: (c: Contact) => store.set(PREFIX + c.deviceId, c),
  remove: (deviceId: string) => store.del(PREFIX + deviceId),
}

/** Room both contacts join. Unguessable without the pair secret; fits the server's code-room grammar. */
export async function pairRoomId(deviceA: string, deviceB: string, pairSecret: string): Promise<string> {
  const [x, y] = [deviceA, deviceB].sort()
  return 'p-' + (await sha256Hex(`narad-pair|${x}|${y}|${pairSecret}`)).slice(0, 32)
}

/**
 * Token under which `targetDeviceId`'s push subscription is filed for this contact pair.
 * Only the two paired devices can derive it; different pairs give unrelated tokens.
 */
export async function nudgeToken(pairSecret: string, targetDeviceId: string): Promise<string> {
  return sha256Hex(`narad-nudge|${pairSecret}|${targetDeviceId}`)
}

/** Human-facing "Narad ID", e.g. rohan#7k2p. Not a lookup key; a name you recognise in your contacts. */
export function naradId(name: string, deviceId: string): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'narad'
  return `${slug}#${deviceId.slice(0, 4)}`
}
