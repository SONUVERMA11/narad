/** Fun, deterministic device names: "Neela Garud", "Kesari Mayur" ... */
const COLORS = ['Neela', 'Hara', 'Laal', 'Peela', 'Kesari', 'Baingani', 'Gulabi', 'Sunehra', 'Chandi', 'Shyam', 'Safed', 'Firozi']
const CREATURES = ['Garud', 'Mayur', 'Hans', 'Nandi', 'Jatayu', 'Airavat', 'Sher', 'Hiran', 'Kachhua', 'Koyal', 'Chakor', 'Tota', 'Baagh', 'Haathi', 'Morni', 'Sarang']
const EMOJI: Record<string, string> = {
  Garud: '🦅', Mayur: '🦚', Hans: '🦢', Nandi: '🐂', Jatayu: '🦅', Airavat: '🐘', Sher: '🦁', Hiran: '🦌',
  Kachhua: '🐢', Koyal: '🐦', Chakor: '🐦', Tota: '🦜', Baagh: '🐯', Haathi: '🐘', Morni: '🦚', Sarang: '🐦',
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function nameFor(seed: string): { name: string; emoji: string } {
  const h = hashString(seed)
  const color = COLORS[h % COLORS.length]!
  const creature = CREATURES[Math.floor(h / COLORS.length) % CREATURES.length]!
  return { name: `${color} ${creature}`, emoji: EMOJI[creature] ?? '🪔' }
}

export function randomId(len = 6): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

/** Human-friendly room codes like "pink-mango-42" */
const ADJ = ['pink', 'blue', 'gold', 'calm', 'swift', 'brave', 'cool', 'warm', 'lucky', 'royal']
const NOUN = ['mango', 'lotus', 'diya', 'chai', 'peepal', 'ganga', 'monsoon', 'kite', 'tabla', 'saffron']
export function randomRoomCode(): string {
  const b = new Uint8Array(3)
  crypto.getRandomValues(b)
  return `${ADJ[b[0]! % ADJ.length]}-${NOUN[b[1]! % NOUN.length]}-${10 + (b[2]! % 90)}`
}
