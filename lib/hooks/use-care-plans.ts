"use client"

import { useCallback, useEffect, useState } from "react"
import type { CarePlan, CarePlanStatus } from "@/lib/care-plan"
import { updateCarePlanRecommendationStatus } from "@/lib/care-plan"
import { trackWorkflowEvent } from "@/lib/product-analytics"

export const CARE_PLAN_STORAGE_KEY = "openrx:demo-care-plans:v1"

type StorageLike = Pick<Storage, "getItem" | "setItem">

export function readLocalCarePlans(storage?: StorageLike | null): CarePlan[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(CARE_PLAN_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as CarePlan[]) : []
    return Array.isArray(parsed) ? parsed.filter((plan) => plan?.id && Array.isArray(plan.recommendations)) : []
  } catch {
    return []
  }
}

export function writeLocalCarePlans(plans: CarePlan[], storage?: StorageLike | null): boolean {
  if (!storage) return false
  try {
    storage.setItem(CARE_PLAN_STORAGE_KEY, JSON.stringify(plans.slice(0, 30)))
    return true
  } catch {
    return false
  }
}

export function mergeCarePlan(plans: CarePlan[], draft: CarePlan): CarePlan[] {
  const current = plans.find((plan) => plan.id === draft.id)
  if (!current) return [draft, ...plans]
  return [
    {
      ...draft,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      recommendations: draft.recommendations.map((item) => {
        const saved = current.recommendations.find((existing) => existing.id === item.id)
        return saved ? { ...item, status: saved.status } : item
      }),
    },
    ...plans.filter((plan) => plan.id !== draft.id),
  ]
}

export function useCarePlans() {
  const [plans, setPlans] = useState<CarePlan[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setPlans(readLocalCarePlans(window.localStorage))
    setIsReady(true)
    const refresh = () => setPlans(readLocalCarePlans(window.localStorage))
    window.addEventListener("openrx:care-plans-updated", refresh)
    return () => window.removeEventListener("openrx:care-plans-updated", refresh)
  }, [])

  const persist = useCallback((next: CarePlan[]) => {
    setPlans(next)
    writeLocalCarePlans(next, window.localStorage)
    window.dispatchEvent(new CustomEvent("openrx:care-plans-updated"))
  }, [])

  const addPlan = useCallback((draft: CarePlan) => {
    setPlans((current) => {
      const next = mergeCarePlan(current, draft)
      writeLocalCarePlans(next, window.localStorage)
      return next
    })
    trackWorkflowEvent("care_plan_created", { origin: draft.origin })
    window.dispatchEvent(new CustomEvent("openrx:care-plans-updated"))
  }, [])

  const setRecommendationStatus = useCallback((planId: string, recommendationId: string, status: CarePlanStatus) => {
    setPlans((current) => {
      const next = current.map((plan) =>
        plan.id === planId ? updateCarePlanRecommendationStatus(plan, recommendationId, status) : plan
      )
      writeLocalCarePlans(next, window.localStorage)
      return next
    })
    window.dispatchEvent(new CustomEvent("openrx:care-plans-updated"))
  }, [])

  const removePlan = useCallback((planId: string) => {
    persist(plans.filter((plan) => plan.id !== planId))
  }, [persist, plans])

  return { plans, isReady, addPlan, setRecommendationStatus, removePlan }
}

