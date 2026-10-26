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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 dark-shell" role="dialog" data-modal-open="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Content */}
      <div
        className={cn(
          'relative animate-scale-in max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-auto min-w-0',
          'bg-[#10141c] border border-white/[0.09] shadow-[0_30px_90px_rgba(2,5,12,0.6)] rounded-[1.25rem]',
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
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-0 sticky top-0 z-10 bg-[#10141c]">
            <h2 className="text-base font-bold tracking-[-0.015em] text-white min-w-0 break-words">{title}</h2>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors p-0.5 rounded hover:bg-white/10 -mr-1"
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
