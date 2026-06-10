import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { brotliDecompressSync, gunzipSync } from "node:zlib"

const payloadDir = "patches/codex-model-boundary-screening-fix"
const brotliPayloadPath = join(payloadDir, "screening-referral.patch.br.b64")

function canRunGitApply(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function readSortedParts(extension) {
  return readdirSync(payloadDir)
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => readFileSync(join(payloadDir, name), "utf8").trim())
    .join("")
}

function loadPatchPayload() {
  if (!existsSync(payloadDir)) {
    return null
  }

  if (existsSync(brotliPayloadPath)) {
    const payload = readFileSync(brotliPayloadPath, "utf8").trim()
    return brotliDecompressSync(Buffer.from(payload, "base64"))
  }

  const brotliParts = readSortedParts(".br.b64part")
  if (brotliParts) {
    return brotliDecompressSync(Buffer.from(brotliParts, "base64"))
  }

  const gzipParts = readSortedParts(".b64part")
  if (gzipParts) {
    return gunzipSync(Buffer.from(gzipParts, "base64"))
  }

  return null
}

const patch = loadPatchPayload()

if (!patch) {
  console.log("No Codex patch payload found; continuing without patch.")
  process.exit(0)
}

const tmp = mkdtempSync(join(tmpdir(), "openrx-codex-patch-"))
const patchPath = join(tmp, "screening-referral.patch")
writeFileSync(patchPath, patch)

if (canRunGitApply(["apply", "--binary", "--reverse", "--check", patchPath])) {
  console.log("Codex screening/referral patch already applied.")
  process.exit(0)
}

try {
  execFileSync("git", ["apply", "--binary", "--check", patchPath], { stdio: "inherit" })
  execFileSync("git", ["apply", "--binary", "--whitespace=nowarn", patchPath], { stdio: "inherit" })
  console.log("Applied Codex screening/referral patch for build.")
} catch (error) {
  console.error("Failed to apply Codex screening/referral patch.")
  throw error
}
