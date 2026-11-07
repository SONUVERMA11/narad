// Prints a fresh VAPID key pair for the push nudge. Run once, keep the private key secret.
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
const b64url = (b) => Buffer.from(b).toString('base64url')
console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`)
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`)
console.log(`VAPID_SUBJECT=mailto:you@example.com`)
