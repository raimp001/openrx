import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function clean(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed || "unknown"
}

function shortSha(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 7) : "unknown"
}

export async function GET() {
  const commitSha = clean(process.env.VERCEL_GIT_COMMIT_SHA)

  return NextResponse.json(
    {
      status: "ok",
      generatedAt: new Date().toISOString(),
      deployment: {
        environment: clean(process.env.VERCEL_ENV),
        url: clean(process.env.VERCEL_URL),
        productionUrl: clean(process.env.VERCEL_PROJECT_PRODUCTION_URL),
      },
      git: {
        provider: clean(process.env.VERCEL_GIT_PROVIDER),
        owner: clean(process.env.VERCEL_GIT_REPO_OWNER),
        repo: clean(process.env.VERCEL_GIT_REPO_SLUG),
        branch: clean(process.env.VERCEL_GIT_COMMIT_REF),
        commitSha,
        commitShort: shortSha(commitSha),
        commitMessage: clean(process.env.VERCEL_GIT_COMMIT_MESSAGE),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  )
}
