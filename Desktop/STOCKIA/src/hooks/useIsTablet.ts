import { useState, useEffect } from 'react'

export function useIsTablet(min = 768, max = 1024): boolean {
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= min && window.innerWidth < max
  })

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${min}px) and (max-width: ${max - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches)
    setIsTablet(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [min, max])

  return isTablet
}
