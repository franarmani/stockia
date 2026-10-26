import { checkIsTauriDesktop } from '../sync/storage'

function isBlockedBrowserShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase()
  const primaryModifier = event.ctrlKey || event.metaKey

  if (key === 'f5' || key === 'f12' || key === 'browserback' || key === 'browserforward') return true
  if (event.altKey && (key === 'arrowleft' || key === 'arrowright')) return true
  if (!primaryModifier) return false

  if (['r', 's', 'p', 'u'].includes(key)) return true
  return event.shiftKey && ['i', 'j', 'c'].includes(key)
}

export function installNativeAppGuards(): void {
  if (!checkIsTauriDesktop()) return

  document.addEventListener('contextmenu', event => {
    event.preventDefault()
    event.stopPropagation()
  }, true)

  window.addEventListener('keydown', event => {
    if (!isBlockedBrowserShortcut(event)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)
}
