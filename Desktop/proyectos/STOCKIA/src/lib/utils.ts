import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Deterministic gradient for a track/entity by id. Returns inline style values. */
export function trackGradient(id: string): { from: string; to: string } {
  const PALETTES = [
    { from: '#1e3a8a', to: '#1DB954' },
    { from: '#312e81', to: '#818cf8' },
    { from: '#0f766e', to: '#22d3ee' },
    { from: '#1e40af', to: '#60a5fa' },
    { from: '#6d28d9', to: '#c084fc' },
    { from: '#0e7490', to: '#34d399' },
    { from: '#166534', to: '#4ade80' },
    { from: '#9a3412', to: '#fb923c' },
    { from: '#831843', to: '#f472b6' },
    { from: '#1e3a5f', to: '#38bdf8' },
  ]
  let hash = 0
  for (const c of id) hash = (((hash << 5) - hash) + c.charCodeAt(0)) | 0
  return PALETTES[Math.abs(hash) % PALETTES.length]
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
