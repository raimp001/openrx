import { prisma } from "@/lib/db"

export async function logPhiAccess(params: {
  userId: string
  action: string
  resourceType: string
  resourceId: string
  metadata?: Record<string, unknown>
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resourceType,
        resourceId: params.resourceId,
        metadata: (params.metadata ?? {}) as Record<string, string>,
      },
    })
  } catch {
    console.error(`Audit log write failed: ${params.action} ${params.resourceType}`)
  }
}
