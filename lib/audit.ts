import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { buildPhiSafeLogMetadata } from "@/lib/phi-deidentification"

export async function logPhiAccess(params: {
  userId: string
  action: string
  resourceType: string
  resourceId: string
  metadata?: Record<string, unknown>
}) {
  try {
    const metadata = buildPhiSafeLogMetadata(params.metadata ?? {}) as Prisma.InputJsonValue
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resourceType,
        resourceId: params.resourceId,
        metadata,
      },
    })
  } catch {
    console.error(`Audit log write failed: ${params.action} ${params.resourceType}`)
  }
}
