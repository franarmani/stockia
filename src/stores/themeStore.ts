import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light' | 'system'

interface ThemeState {
  theme: ThemeMode
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: ThemeMode): 'dark' | 'light' {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b0f15')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f8fafc')
    }
    localStorage.setItem('cajago_theme', theme)
  }
  return resolved
}

// Initial setup from localStorage
const stored = typeof localStorage !== 'undefined' ? (localStorage.getItem('cajago_theme') as ThemeMode | null) : null
const initialTheme: ThemeMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
const initialResolved = typeof document !== 'undefined' ? applyTheme(initialTheme) : 'dark'

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  resolvedTheme: initialResolved,
  setTheme: (theme: ThemeMode) => {
    const resolved = applyTheme(theme)
    set({ theme, resolvedTheme: resolved })
  },
  toggleTheme: () => {
    const current = get().resolvedTheme
    const next: ThemeMode = current === 'dark' ? 'light' : 'dark'
    const resolved = applyTheme(next)
    set({ theme: next, resolvedTheme: resolved })
  },
}))

