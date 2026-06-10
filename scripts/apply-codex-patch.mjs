import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { brotliDecompressSync, gunzipSync } from "node:zlib"

const patchPayloads = [
  {
    id: "model-boundary-screening-fix",
    dir: "patches/codex-model-boundary-screening-fix",
    file: "screening-referral.patch.br.b64",
  },
  {
    id: "screening-source-url-followup",
    dir: "patches/codex-screening-source-url-followup",
    file: "screening-referral.patch.br.b64",
  },
]

function canRunGitApply(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function readSortedParts(payloadDir, extension) {
  return readdirSync(payloadDir)
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => readFileSync(join(payloadDir, name), "utf8").trim())
    .join("")
}

function loadPatchPayload(payload) {
  if (!existsSync(payload.dir)) {
    return null
  }

  const brotliPayloadPath = join(payload.dir, payload.file)
  if (existsSync(brotliPayloadPath)) {
    const encoded = readFileSync(brotliPayloadPath, "utf8").trim()
    return brotliDecompressSync(Buffer.from(encoded, "base64"))
  }

  const brotliParts = readSortedParts(payload.dir, ".br.b64part")
  if (brotliParts) {
    return brotliDecompressSync(Buffer.from(brotliParts, "base64"))
  }

  const gzipParts = readSortedParts(payload.dir, ".b64part")
  if (gzipParts) {
    return gunzipSync(Buffer.from(gzipParts, "base64"))
  }

  return null
}

function applyPatchPayload(payload, patch) {
  const tmp = mkdtempSync(join(tmpdir(), `openrx-codex-${payload.id}-`))
  const patchPath = join(tmp, `${payload.id}.patch`)
  const markerPath = join(tmpdir(), `openrx-codex-${payload.id}.applied`)
  writeFileSync(patchPath, patch)

  if (existsSync(markerPath)) {
    console.log(`Codex patch ${payload.id} already applied in this workspace.`)
    return
  }

  if (canRunGitApply(["apply", "--binary", "--reverse", "--check", patchPath])) {
    writeFileSync(markerPath, new Date().toISOString())
    console.log(`Codex patch ${payload.id} already present.`)
    return
  }

  try {
    execFileSync("git", ["apply", "--binary", "--check", patchPath], { stdio: "inherit" })
    execFileSync("git", ["apply", "--binary", "--whitespace=nowarn", patchPath], { stdio: "inherit" })
    writeFileSync(markerPath, new Date().toISOString())
    console.log(`Applied Codex patch ${payload.id}.`)
  } catch (error) {
    console.error(`Failed to apply Codex patch ${payload.id}.`)
    throw error
  }
}

let appliedAnyPatch = false
for (const payload of patchPayloads) {
  const patch = loadPatchPayload(payload)
  if (!patch) {
    console.log(`No Codex patch payload found for ${payload.id}; continuing.`)
    continue
  }
  applyPatchPayload(payload, patch)
  appliedAnyPatch = true
}

if (!appliedAnyPatch) {
  console.log("No Codex patch payloads found; continuing without patch.")
}
