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
  const colors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800",
    "checked-in": "bg-yellow-100 text-yellow-800",
    "in-progress": "bg-terra/20 text-terra",
    completed: "bg-green-100 text-green-800",
    "no-show": "bg-red-100 text-red-800",
    cancelled: "bg-sand/70 text-secondary",
    submitted: "bg-blue-100 text-blue-800",
    processing: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    denied: "bg-red-100 text-red-800",
    appealed: "bg-orange-100 text-orange-800",
    paid: "bg-green-100 text-green-800",
    active: "bg-green-100 text-green-800",
    "pending-refill": "bg-yellow-100 text-yellow-800",
    discontinued: "bg-sand/70 text-secondary",
    pending: "bg-yellow-100 text-yellow-800",
    urgent: "bg-red-100 text-red-800",
    standard: "bg-blue-100 text-blue-800",
  }
  return colors[status] || "bg-sand/70 text-secondary"
}
