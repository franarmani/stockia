import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export default function Modal({ open, onClose, title, children, className, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 text-foreground" role="dialog" data-modal-open="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Content */}
      <div
        className={cn(
          'relative animate-scale-in max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-auto min-w-0',
          'bg-surface text-foreground border border-border shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_30px_90px_rgba(2,5,12,0.6)] rounded-[1.25rem]',
          {
            'w-full max-w-sm': size === 'sm',
            'w-full max-w-lg': size === 'md',
            'w-full max-w-2xl': size === 'lg',
            'w-full max-w-4xl': size === 'xl',
          },
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sticky top-0 z-10 bg-surface border-b border-border/40">
            <h2 className="text-base font-bold tracking-[-0.015em] text-foreground min-w-0 break-words">{title}</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-surface-secondary -mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-4 sm:p-5 min-w-0">{children}</div>
      </div>
    </div>
  )
}
