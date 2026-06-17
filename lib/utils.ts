import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function getStatusColor(status: string): string {
  const info = "border border-blue-300/30 bg-blue-400/14 text-blue-100"
  const warn = "border border-amber-300/32 bg-amber-300/16 text-amber-100"
  const success = "border border-emerald-300/30 bg-emerald-300/14 text-emerald-100"
  const danger = "border border-red-300/34 bg-red-400/16 text-red-100"
  const neutral = "border border-border bg-surface-2/72 text-secondary"
  const colors: Record<string, string> = {
    scheduled: info,
    "checked-in": warn,
    "in-progress": warn,
    completed: success,
    "no-show": danger,
    cancelled: neutral,
    submitted: info,
    processing: warn,
    approved: success,
    denied: danger,
    appealed: warn,
    paid: success,
    active: success,
    "pending-refill": warn,
    discontinued: neutral,
    pending: warn,
    urgent: danger,
    standard: info,
  }
  return colors[status] || neutral
}
