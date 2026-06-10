import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { gunzipSync } from "node:zlib"

const partsDir = "patches/codex-model-boundary-screening-fix"

function canRunGitApply(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

if (!existsSync(partsDir)) {
  console.log("No Codex patch payload found; continuing without patch.")
  process.exit(0)
}

const payload = readdirSync(partsDir)
  .filter((name) => name.endsWith(".b64part"))
  .sort()
  .map((name) => readFileSync(join(partsDir, name), "utf8").trim())
  .join("")

if (!payload) {
  console.log("Codex patch payload is empty; continuing without patch.")
  process.exit(0)
}

const patch = gunzipSync(Buffer.from(payload, "base64"))
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
