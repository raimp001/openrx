"use client"

// ── Wallet Identity Context ────────────────────────────────
// React context that bridges Coinbase Smart Wallet connection
// with the OpenRx identity system. Automatically loads/saves
// user profiles when wallet connects/disconnects.

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react"
import { useAccount, useSignMessage } from "wagmi"
import {
  type WalletProfile,
  loadWalletProfile,
  saveWalletProfile,
  createBlankProfile,
  profileToPatient,
} from "./wallet-identity"
import type { LivePatient } from "./live-data-types"
import { buildWalletAuthMessage } from "./wallet-auth-message"

const EMPTY_PATIENT: LivePatient = {
  id: "",
  full_name: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  insurance_provider: "",
  insurance_plan: "",
  insurance_id: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  medical_history: [],
  allergies: [],
  primary_physician_id: "",
  created_at: "",
}

interface WalletIdentityState {
  // Wallet state
  isConnected: boolean
  walletAddress: string | undefined
  // Profile state
  profile: WalletProfile | null
  isNewUser: boolean
  isLoading: boolean
  databaseSyncStatus: "idle" | "syncing" | "synced" | "database_missing" | "error"
  databaseSyncMessage: string
  // Patient-compatible data for existing components
  currentPatient: LivePatient
  // Actions
  updateProfile: (updates: Partial<WalletProfile>) => void
  completeOnboarding: () => void
  setAgentAutoPay: (enabled: boolean, limit?: number) => void
  setAgentRxAutoPay: (enabled: boolean) => void
  getWalletAuthHeaders: () => Promise<Record<string, string>>
}

const WalletIdentityContext = createContext<WalletIdentityState>({
  isConnected: false,
  walletAddress: undefined,
  profile: null,
  isNewUser: false,
  isLoading: true,
  databaseSyncStatus: "idle",
  databaseSyncMessage: "",
  currentPatient: EMPTY_PATIENT,
  updateProfile: () => {},
  completeOnboarding: () => {},
  setAgentAutoPay: () => {},
  setAgentRxAutoPay: () => {},
  getWalletAuthHeaders: async () => ({}),
})

export function WalletIdentityProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [profile, setProfile] = useState<WalletProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isNewUser, setIsNewUser] = useState(false)
  const [databaseSyncStatus, setDatabaseSyncStatus] = useState<WalletIdentityState["databaseSyncStatus"]>("idle")
  const [databaseSyncMessage, setDatabaseSyncMessage] = useState("")
  const lastSyncedFingerprintRef = useRef("")
  const walletProofRef = useRef<{
    walletAddress: string
    message: string
    signature: string
  } | null>(null)

  // Load profile when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      const existing = loadWalletProfile(address)
      if (existing) {
        setProfile(existing)
        setIsNewUser(false)
      } else {
        const blank = createBlankProfile(address)
        saveWalletProfile(blank)
        setProfile(blank)
        setIsNewUser(true)
      }
    } else {
      setProfile(null)
      setIsNewUser(false)
      setDatabaseSyncStatus("idle")
      setDatabaseSyncMessage("")
      lastSyncedFingerprintRef.current = ""
    }
    setIsLoading(false)
  }, [isConnected, address])

  // Update profile
  const updateProfile = useCallback(
    (updates: Partial<WalletProfile>) => {
      if (!profile) return
      const updated = { ...profile, ...updates }
      setProfile(updated)
      saveWalletProfile(updated)
    },
    [profile]
  )

  // Complete onboarding
  const completeOnboarding = useCallback(() => {
    if (!profile) return
    const updated = { ...profile, onboardingComplete: true }
    setProfile(updated)
    saveWalletProfile(updated)
    setIsNewUser(false)
  }, [profile])

  // Agent auto-pay toggle
  const setAgentAutoPay = useCallback(
    (enabled: boolean, limit?: number) => {
      updateProfile({
        agentAutoPay: enabled,
        ...(limit !== undefined ? { agentAutoPayLimit: limit } : {}),
      })
    },
    [updateProfile]
  )

  // Agent Rx auto-pay toggle
  const setAgentRxAutoPay = useCallback(
    (enabled: boolean) => {
      updateProfile({ agentRxAutoPay: enabled })
    },
    [updateProfile]
  )

  const getWalletAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!address) return {}

    const walletAddress = address.toLowerCase()
    const cached = walletProofRef.current
    if (cached?.walletAddress === walletAddress) {
      return {
        "x-wallet-address": walletAddress,
        "x-wallet-message": cached.message,
        "x-wallet-signature": cached.signature,
      }
    }

    const message = buildWalletAuthMessage(walletAddress)
    const signature = await signMessageAsync({ message })
    walletProofRef.current = { walletAddress, message, signature }

    return {
      "x-wallet-address": walletAddress,
      "x-wallet-message": message,
      "x-wallet-signature": signature,
    }
  }, [address, signMessageAsync])

  const currentPatient: LivePatient =
    profile && profile.onboardingComplete
      ? profileToPatient(profile)
      : EMPTY_PATIENT

  useEffect(() => {
    if (!isConnected || !address || !profile?.onboardingComplete) {
      return
    }

    const payload = {
      walletAddress: address,
      profile,
    }
    const fingerprint = JSON.stringify(payload)

    if (lastSyncedFingerprintRef.current === fingerprint) {
      return
    }

    let active = true
    setDatabaseSyncStatus("syncing")
    setDatabaseSyncMessage("Syncing live records...")

    getWalletAuthHeaders().then((walletHeaders) => fetch("/api/profile/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...walletHeaders,
      },
      body: JSON.stringify(payload),
    }))
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { error?: string; message?: string } | null

        if (!active) return

        if (!response.ok) {
          if (response.status === 503) {
            setDatabaseSyncStatus("database_missing")
            setDatabaseSyncMessage("Set DATABASE_URL to activate live patient records.")
            return
          }

          setDatabaseSyncStatus("error")
          setDatabaseSyncMessage(result?.error || "Failed to sync live records.")
          return
        }

        lastSyncedFingerprintRef.current = fingerprint
        setDatabaseSyncStatus("synced")
        setDatabaseSyncMessage(result?.message || "Live records synced.")
        window.dispatchEvent(new CustomEvent("openrx:live-refresh"))
      })
      .catch(() => {
        if (!active) return
        setDatabaseSyncStatus("error")
        setDatabaseSyncMessage("Failed to sync live records.")
      })

    return () => {
      active = false
    }
  }, [address, getWalletAuthHeaders, isConnected, profile])

  return (
    <WalletIdentityContext.Provider
      value={{
        isConnected,
        walletAddress: address,
        profile,
        isNewUser,
        isLoading,
        databaseSyncStatus,
        databaseSyncMessage,
        currentPatient,
        updateProfile,
        completeOnboarding,
        setAgentAutoPay,
        setAgentRxAutoPay,
        getWalletAuthHeaders,
      }}
    >
      {children}
    </WalletIdentityContext.Provider>
  )
}

export function useWalletIdentity() {
  return useContext(WalletIdentityContext)
}
