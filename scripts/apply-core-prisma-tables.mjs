import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function splitSqlStatements(sql) {
  const statements = []
  let current = ""
  let inSingle = false
  let inDouble = false
  let inLineComment = false
  let inBlockComment = false
  let dollarTag = null

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]
    const next = sql[i + 1]

    if (inLineComment) {
      current += char
      if (char === "\n") inLineComment = false
      continue
    }

    if (inBlockComment) {
      current += char
      if (char === "*" && next === "/") {
        current += next
        i += 1
        inBlockComment = false
      }
      continue
    }

    if (dollarTag) {
      current += char
      if (char === "$" && sql.slice(i, i + dollarTag.length) === dollarTag) {
        current += sql.slice(i + 1, i + dollarTag.length)
        i += dollarTag.length - 1
        dollarTag = null
      }
      continue
    }

    if (!inSingle && !inDouble && char === "-" && next === "-") {
      current += char + next
      i += 1
      inLineComment = true
      continue
    }

    if (!inSingle && !inDouble && char === "/" && next === "*") {
      current += char + next
      i += 1
      inBlockComment = true
      continue
    }

    if (!inSingle && !inDouble && char === "$") {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/)
      if (match) {
        dollarTag = match[0]
        current += dollarTag
        i += dollarTag.length - 1
        continue
      }
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle
      current += char
      continue
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble
      current += char
      continue
    }

    if (char === ";" && !inSingle && !inDouble) {
      const trimmed = current.trim()
      if (trimmed) statements.push(trimmed)
      current = ""
      continue
    }

    current += char
  }

  const trailing = current.trim()
  if (trailing) statements.push(trailing)
  return statements
}

async function main() {
  const fileArg = process.argv[2] || "prisma/manual-migrations/20260323_core_prisma_tables.sql"
  const sqlPath = path.resolve(process.cwd(), fileArg)
  const sql = fs.readFileSync(sqlPath, "utf8")
  const statements = splitSqlStatements(sql)

  console.log(`Applying ${statements.length} SQL statements from ${path.relative(process.cwd(), sqlPath)}...`)

  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i]
    const label = statement
      .split(/\s+/)
      .slice(0, 6)
      .join(" ")
      .replace(/\s+/g, " ")
    console.log(`[${i + 1}/${statements.length}] ${label}`)
    await prisma.$executeRawUnsafe(statement)
  }

  const requiredTables = [
    "users",
    "patient_profiles",
    "doctor_profiles",
    "appointments",
    "prescriptions",
    "medications",
    "medical_records",
    "lab_results",
    "vital_signs",
    "messages",
    "notifications",
    "payments",
  ]

  const rows = await prisma.$queryRawUnsafe(
    `select tablename from pg_tables where schemaname = current_schema() and tablename = any($1::text[]) order by tablename`,
    requiredTables
  )

  console.log("Applied core tables:")
  console.log(JSON.stringify(rows, null, 2))
}

main()
  .catch((error) => {
    console.error("Failed to apply core Prisma tables:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
