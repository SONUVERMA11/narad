// node packages/license/scripts-keys.mjs → LICENSE_PUBLIC_KEY / LICENSE_PRIVATE_KEY
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
console.log(`LICENSE_PUBLIC_KEY=${Buffer.from(raw).toString('base64url')}`)
console.log(`LICENSE_PRIVATE_KEY=${jwk.d}`)
