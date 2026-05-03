import fs from "node:fs"
import path from "node:path"
import type { AdminNotificationRecord, NetworkApplicationRecord } from "@prisma/client"
import { getDatabaseHealth } from "@/lib/database-health"
import { prisma } from "@/lib/db"

export const OPENRX_ADMIN_ID = "admin-openrx" as const

export type ApplicantRole = "provider" | "caregiver"
export type ApplicationStatus = "pending" | "approved" | "rejected"
export type NetworkApplicationStoreMode = "database" | "file" | "ephemeral"

export interface NetworkApplication {
  id: string
  role: ApplicantRole
  fullName: string
  email: string
  phone: string
  npi?: string
  licenseNumber?: string
  licenseState?: string
  licensedStates?: string[]
  orderingCertifyingStatus?: string
  malpracticeCoverage?: string
  stateLicensureAttestation?: boolean
  orderingScopeAttestation?: boolean
  noAutoPrescriptionAttestation?: boolean
  malpracticeAttestation?: boolean
  specialtyOrRole: string
  servicesSummary: string
  city: string
  state: string
  zip: string
  status: ApplicationStatus
  submittedAt: string
  reviewedAt?: string
  reviewedBy?: string
  reviewNotes?: string
}

export interface AdminNotification {
  id: string
  adminId: string
  title: string
  message: string
  applicationId: string
  type: "application_submitted" | "application_reviewed"
  isRead: boolean
  createdAt: string
}

interface ApplicationStore {
  applications: NetworkApplication[]
  notifications: AdminNotification[]
}

const FALLBACK_APPLICATIONS_FILE = path.join("/tmp", "openrx-applications.json")
let hasWarnedEphemeralApplicationsFallback = false

function resolveStorePath(): string {
  const configured = process.env.OPENRX_APPLICATIONS_PATH
  if (configured) return configured
  if (process.env.NODE_ENV === "production") {
    if (!hasWarnedEphemeralApplicationsFallback) {
      hasWarnedEphemeralApplicationsFallback = true
      console.warn(
        "OPENRX_APPLICATIONS_PATH is not set in production. Falling back to /tmp/openrx-applications.json (ephemeral storage). Set DATABASE_URL with network application tables or OPENRX_APPLICATIONS_PATH for durable records."
      )
    }
    return FALLBACK_APPLICATIONS_FILE
  }
  return path.join(process.cwd(), ".openrx-applications.json")
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ensureStoreDirectory(filePath: string): void {
  const directory = path.dirname(filePath)
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
}

function loadStore(): ApplicationStore {
  const storePath = resolveStorePath()
  try {
    if (!fs.existsSync(storePath)) {
      return { applications: [], notifications: [] }
    }
    const raw = fs.readFileSync(storePath, "utf8")
    const parsed = JSON.parse(raw) as Partial<ApplicationStore>
    return {
      applications: parsed.applications || [],
      notifications: parsed.notifications || [],
    }
  } catch (error) {
    throw new Error(
      `Unable to load network application store at ${storePath}: ${error instanceof Error ? error.message : "unknown error"}`
    )
  }
}

function saveStore(store: ApplicationStore): void {
  const storePath = resolveStorePath()
  try {
    ensureStoreDirectory(storePath)
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8")
  } catch (error) {
    throw new Error(
      `Unable to persist network application store at ${storePath}: ${error instanceof Error ? error.message : "unknown error"}`
    )
  }
}

function isMissingTableError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2021"
  )
}

function isValidRole(value: string): value is ApplicantRole {
  return value === "provider" || value === "caregiver"
}

function isValidStatus(value: string): value is ApplicationStatus {
  return value === "pending" || value === "approved" || value === "rejected"
}

function toNetworkApplication(record: NetworkApplicationRecord): NetworkApplication {
  return {
    id: record.id,
    role: isValidRole(record.role) ? record.role : "provider",
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    npi: record.npi || undefined,
    licenseNumber: record.licenseNumber || undefined,
    licenseState: record.licenseState || undefined,
    licensedStates: record.licensedStates,
    orderingCertifyingStatus: record.orderingCertifyingStatus || undefined,
    malpracticeCoverage: record.malpracticeCoverage || undefined,
    stateLicensureAttestation: record.stateLicensureAttestation,
    orderingScopeAttestation: record.orderingScopeAttestation,
    noAutoPrescriptionAttestation: record.noAutoPrescriptionAttestation,
    malpracticeAttestation: record.malpracticeAttestation,
    specialtyOrRole: record.specialtyOrRole,
    servicesSummary: record.servicesSummary,
    city: record.city,
    state: record.state,
    zip: record.zip,
    status: isValidStatus(record.status) ? record.status : "pending",
    submittedAt: record.submittedAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString(),
    reviewedBy: record.reviewedBy || undefined,
    reviewNotes: record.reviewNotes || undefined,
  }
}

function toAdminNotification(record: AdminNotificationRecord): AdminNotification {
  return {
    id: record.id,
    adminId: record.adminId,
    title: record.title,
    message: record.message,
    applicationId: record.applicationId,
    type: record.type === "application_reviewed" ? "application_reviewed" : "application_submitted",
    isRead: record.isRead,
    createdAt: record.createdAt.toISOString(),
  }
}

async function canUseDatabaseStore(): Promise<boolean> {
  const health = await getDatabaseHealth()
  if (!health.reachable) return false
  try {
    await prisma.networkApplicationRecord.count()
    return true
  } catch (error) {
    if (isMissingTableError(error)) return false
    return false
  }
}

export async function getNetworkApplicationStoreHealth(): Promise<{
  mode: NetworkApplicationStoreMode
  durable: boolean
  metric: string
}> {
  if (await canUseDatabaseStore()) {
    return { mode: "database", durable: true, metric: "Postgres-backed" }
  }
  const configuredPath = process.env.OPENRX_APPLICATIONS_PATH?.trim()
  if (configuredPath) {
    return { mode: "file", durable: true, metric: "Durable file path configured" }
  }
  return {
    mode: process.env.NODE_ENV === "production" ? "ephemeral" : "file",
    durable: process.env.NODE_ENV !== "production",
    metric: process.env.NODE_ENV === "production" ? "Using ephemeral /tmp fallback" : "Local file fallback",
  }
}

function addAdminNotification(
  store: ApplicationStore,
  params: Omit<AdminNotification, "id" | "createdAt" | "isRead">
): AdminNotification {
  const notification: AdminNotification = {
    id: createId("ntf"),
    createdAt: new Date().toISOString(),
    isRead: false,
    ...params,
  }
  store.notifications.unshift(notification)
  return notification
}

export async function submitNetworkApplication(input: {
  role: ApplicantRole
  fullName: string
  email: string
  phone: string
  npi?: string
  licenseNumber?: string
  licenseState?: string
  licensedStates?: string[]
  orderingCertifyingStatus?: string
  malpracticeCoverage?: string
  stateLicensureAttestation?: boolean
  orderingScopeAttestation?: boolean
  noAutoPrescriptionAttestation?: boolean
  malpracticeAttestation?: boolean
  specialtyOrRole: string
  servicesSummary: string
  city: string
  state: string
  zip: string
}): Promise<NetworkApplication> {
  if (await canUseDatabaseStore()) {
    const now = new Date()
    const applicationId = createId("app")
    const [application] = await prisma.$transaction([
      prisma.networkApplicationRecord.create({
        data: {
          id: applicationId,
          role: input.role,
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          phone: input.phone,
          npi: input.npi,
          licenseNumber: input.licenseNumber,
          licenseState: input.licenseState?.toUpperCase(),
          licensedStates: input.licensedStates?.map((item) => item.toUpperCase()) || [],
          orderingCertifyingStatus: input.orderingCertifyingStatus,
          malpracticeCoverage: input.malpracticeCoverage,
          stateLicensureAttestation: Boolean(input.stateLicensureAttestation),
          orderingScopeAttestation: Boolean(input.orderingScopeAttestation),
          noAutoPrescriptionAttestation: Boolean(input.noAutoPrescriptionAttestation),
          malpracticeAttestation: Boolean(input.malpracticeAttestation),
          specialtyOrRole: input.specialtyOrRole,
          servicesSummary: input.servicesSummary,
          city: input.city,
          state: input.state.toUpperCase(),
          zip: input.zip,
          status: "pending",
          submittedAt: now,
        },
      }),
      prisma.adminNotificationRecord.create({
        data: {
          id: createId("ntf"),
          adminId: OPENRX_ADMIN_ID,
          applicationId,
          type: "application_submitted",
          title: `New ${input.role} application`,
          message: `${input.fullName} applied as ${input.specialtyOrRole} in ${input.city}, ${input.state.toUpperCase()}.`,
          isRead: false,
          createdAt: now,
        },
      }),
    ])
    return toNetworkApplication(application)
  }

  const store = loadStore()
  const application: NetworkApplication = {
    id: createId("app"),
    role: input.role,
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    phone: input.phone,
    npi: input.npi,
    licenseNumber: input.licenseNumber,
    licenseState: input.licenseState?.toUpperCase(),
    licensedStates: input.licensedStates?.map((item) => item.toUpperCase()),
    orderingCertifyingStatus: input.orderingCertifyingStatus,
    malpracticeCoverage: input.malpracticeCoverage,
    stateLicensureAttestation: input.stateLicensureAttestation,
    orderingScopeAttestation: input.orderingScopeAttestation,
    noAutoPrescriptionAttestation: input.noAutoPrescriptionAttestation,
    malpracticeAttestation: input.malpracticeAttestation,
    specialtyOrRole: input.specialtyOrRole,
    servicesSummary: input.servicesSummary,
    city: input.city,
    state: input.state.toUpperCase(),
    zip: input.zip,
    status: "pending",
    submittedAt: new Date().toISOString(),
  }
  store.applications.unshift(application)

  addAdminNotification(store, {
    adminId: OPENRX_ADMIN_ID,
    applicationId: application.id,
    type: "application_submitted",
    title: `New ${application.role} application`,
    message: `${application.fullName} applied as ${application.specialtyOrRole} in ${application.city}, ${application.state}.`,
  })

  saveStore(store)
  return application
}

export async function deleteNetworkApplication(applicationId: string): Promise<void> {
  if (await canUseDatabaseStore()) {
    await prisma.networkApplicationRecord.delete({ where: { id: applicationId } }).catch(() => undefined)
    return
  }

  const store = loadStore()
  store.applications = store.applications.filter((item) => item.id !== applicationId)
  store.notifications = store.notifications.filter((item) => item.applicationId !== applicationId)
  saveStore(store)
}

export async function listNetworkApplications(params?: {
  status?: ApplicationStatus
  role?: ApplicantRole
}): Promise<NetworkApplication[]> {
  if (await canUseDatabaseStore()) {
    const records = await prisma.networkApplicationRecord.findMany({
      where: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.role ? { role: params.role } : {}),
      },
      orderBy: { submittedAt: "desc" },
    })
    return records.map(toNetworkApplication)
  }

  const store = loadStore()
  let items = [...store.applications]
  if (params?.status) items = items.filter((item) => item.status === params.status)
  if (params?.role) items = items.filter((item) => item.role === params.role)
  return items
}

export async function reviewNetworkApplication(input: {
  applicationId: string
  decision: "approved" | "rejected"
  reviewer: string
  notes?: string
}): Promise<NetworkApplication> {
  if (await canUseDatabaseStore()) {
    const existing = await prisma.networkApplicationRecord.findUnique({
      where: { id: input.applicationId },
    })
    if (!existing) throw new Error("Application not found.")
    if (existing.status !== "pending") {
      if (existing.status === input.decision) return toNetworkApplication(existing)
      throw new Error(`Application is already ${existing.status}.`)
    }

    const now = new Date()
    const [application] = await prisma.$transaction([
      prisma.networkApplicationRecord.update({
        where: { id: input.applicationId },
        data: {
          status: input.decision,
          reviewedAt: now,
          reviewedBy: input.reviewer,
          reviewNotes: input.notes,
        },
      }),
      prisma.adminNotificationRecord.create({
        data: {
          id: createId("ntf"),
          adminId: OPENRX_ADMIN_ID,
          applicationId: input.applicationId,
          type: "application_reviewed",
          title: `Application ${input.decision}`,
          message: `${existing.fullName} was ${input.decision} by ${input.reviewer}.`,
          isRead: false,
          createdAt: now,
        },
      }),
    ])
    return toNetworkApplication(application)
  }

  const store = loadStore()
  const application = store.applications.find((item) => item.id === input.applicationId)
  if (!application) throw new Error("Application not found.")
  if (application.status !== "pending") {
    if (application.status === input.decision) return application
    throw new Error(`Application is already ${application.status}.`)
  }

  application.status = input.decision
  application.reviewedAt = new Date().toISOString()
  application.reviewedBy = input.reviewer
  application.reviewNotes = input.notes

  addAdminNotification(store, {
    adminId: OPENRX_ADMIN_ID,
    applicationId: application.id,
    type: "application_reviewed",
    title: `Application ${input.decision}`,
    message: `${application.fullName} was ${input.decision} by ${input.reviewer}.`,
  })

  saveStore(store)
  return application
}

export async function listAdminNotifications(adminId: string = OPENRX_ADMIN_ID): Promise<AdminNotification[]> {
  if (await canUseDatabaseStore()) {
    const records = await prisma.adminNotificationRecord.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
    })
    return records.map(toAdminNotification)
  }

  const store = loadStore()
  return store.notifications.filter((item) => item.adminId === adminId)
}

export async function markAdminNotificationRead(notificationId: string): Promise<AdminNotification> {
  if (await canUseDatabaseStore()) {
    const notification = await prisma.adminNotificationRecord.update({
      where: { id: notificationId },
      data: { isRead: true },
    })
    return toAdminNotification(notification)
  }

  const store = loadStore()
  const notification = store.notifications.find((item) => item.id === notificationId)
  if (!notification) throw new Error("Notification not found.")
  notification.isRead = true
  saveStore(store)
  return notification
}
