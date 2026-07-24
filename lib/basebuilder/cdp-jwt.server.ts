import { createPrivateKey, randomBytes, sign as nodeSign } from "node:crypto"

export interface CdpJwtConfig {
  keyName: string
  privateKeyPem: string
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

/**
 * Build the short-lived EdDSA JWT the Coinbase Developer Platform expects for
 * its authenticated APIs (e.g. the onramp session-token endpoint).
 * Uses Node's built-in crypto so no extra dependency is required.
 */
export function buildCdpJwt(config: CdpJwtConfig, input: {
  method: string
  host: string
  path: string
  nowSeconds?: number
  expiresInSeconds?: number
}): string {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const header = {
    alg: "EdDSA",
    kid: config.keyName,
    typ: "JWT",
    nonce: randomBytes(16).toString("hex"),
  }
  const payload = {
    iss: "cdp",
    sub: config.keyName,
    nbf: now,
    exp: now + (input.expiresInSeconds ?? 120),
    uris: [`${input.method.toUpperCase()} ${input.host}${input.path}`],
  }

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const privateKey = createPrivateKey(config.privateKeyPem)
  const signature = nodeSign(null, Buffer.from(unsigned), privateKey)
  return `${unsigned}.${base64url(signature)}`
}

export function getCdpApiConfig(): CdpJwtConfig | null {
  const keyName = (process.env.CDP_API_KEY_NAME || process.env.CDP_API_KEY_ID || "").trim()
  const rawSecret = (process.env.CDP_API_KEY_SECRET || process.env.CDP_API_SECRET || "").trim()
  if (!keyName || !rawSecret) return null
  // Env vars often store PEMs with escaped newlines.
  const privateKeyPem = rawSecret.includes("\\n") ? rawSecret.replace(/\\n/g, "\n") : rawSecret
  return { keyName, privateKeyPem }
}
