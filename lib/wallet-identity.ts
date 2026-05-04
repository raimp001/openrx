// ── Wallet Identity System ─────────────────────────────────
// Uses Coinbase Smart Wallet address as the user's identity.
// Profile data is persisted in localStorage keyed by wallet address.
// On wallet reconnect, profile is automatically restored.

import type { LivePatient } from "./live-data-types"

const STORAGE_PREFIX = "openrx:profile:" as const

export interface WalletProfile {
  walletAddress: string
  serverUserId?: string
  serverPatientId?: string
  walletSessionSyncedAt?: string
  fullName: string
  dateOfBirth: string
  gender: string
  phone: string
  email: string
  address: string
  insuranceProvider: string
  insurancePlan: string
  insuranceId: string
  emergencyContactName: string
  emergencyContactPhone: string
  medicalHistory: { condition: string; diagnosed: string; status: string }[]
  allergies: string[]
  primaryPhysicianId: string
  preferredPharmacy: string
  pharmacyNpi: string
  devices: string[]
  onboardingComplete: boolean
  createdAt: string
  lastSeen: string
  // Agent preferences
  agentAutoPay: boolean
  agentAutoPayLimit: number
  agentRxAutoPay: boolean
  // Self-improvement preferences
  allowAgentImprovements: boolean
}

function storageKey(address: string): string {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`
}

/** Save a wallet-linked profile to localStorage */
export function saveWalletProfile(profile: WalletProfile): void {
  if (typeof window === "undefined") return
  const key = storageKey(profile.walletAddress)
  localStorage.setItem(key, JSON.stringify({
    ...profile,
    lastSeen: new Date().toISOString(),
  }))
}

/** Load a wallet-linked profile from localStorage */
export function loadWalletProfile(walletAddress: string): WalletProfile | null {
  if (typeof window === "undefined") return null
  try {
    const key = storageKey(walletAddress)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const profile = JSON.parse(raw) as WalletProfile
    // Update last seen
    profile.lastSeen = new Date().toISOString()
    localStorage.setItem(key, JSON.stringify(profile))
    return profile
  } catch {
    return null
  }
}

/** Delete a wallet-linked profile */
export function deleteWalletProfile(walletAddress: string): void {
  if (typeof window === "undefined") return
  const key = storageKey(walletAddress)
  localStorage.removeItem(key)
}

/** Create a blank profile for a new wallet */
export function createBlankProfile(walletAddress: string): WalletProfile {
  return {
    walletAddress,
    fullName: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    insuranceProvider: "",
    insurancePlan: "",
    insuranceId: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    medicalHistory: [],
    allergies: [],
    primaryPhysicianId: "",
    preferredPharmacy: "",
    pharmacyNpi: "",
    devices: [],
    onboardingComplete: false,
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    agentAutoPay: false,
    agentAutoPayLimit: 50,
    agentRxAutoPay: false,
    allowAgentImprovements: true,
  }
}

/** Convert WalletProfile to a Patient-compatible object for seed data compatibility */
export function profileToPatient(profile: WalletProfile): LivePatient {
  return {
    id: `wallet-${profile.walletAddress.slice(2, 10).toLowerCase()}`,
    full_name: profile.fullName || `Wallet ${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`,
    date_of_birth: profile.dateOfBirth || "1990-01-01",
    gender: profile.gender || "Not specified",
    phone: profile.phone || "",
    email: profile.email || "",
    address: profile.address || "",
    insurance_provider: profile.insuranceProvider || "Not set",
    insurance_plan: profile.insurancePlan || "Not set",
    insurance_id: profile.insuranceId || "",
    emergency_contact_name: profile.emergencyContactName || "",
    emergency_contact_phone: profile.emergencyContactPhone || "",
    medical_history: profile.medicalHistory,
    allergies: profile.allergies,
    primary_physician_id: profile.primaryPhysicianId || "",
    created_at: profile.createdAt,
  }
}

/** Get wallet-linked patient data */
export function resolvePatientForWallet(walletAddress: string | undefined): LivePatient | null {
  if (!walletAddress) {
    return null
  }
  const profile = loadWalletProfile(walletAddress)
  if (profile && profile.onboardingComplete) {
    return profileToPatient(profile)
  }
  return null
}

/** List all stored wallet profiles (for admin/debug) */
export function listAllProfiles(): WalletProfile[] {
  if (typeof window === "undefined") return []
  const profiles: WalletProfile[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) profiles.push(JSON.parse(raw) as WalletProfile)
      } catch { /* skip corrupted entries */ }
    }
  }
  return profiles.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
}
