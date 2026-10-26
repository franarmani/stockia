import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import CajaGoBrand from '@/components/brand/CajaGoBrand'

/** Pantallas de ingreso y registro con el mismo estilo que el hero de la landing. */
export default function AuthShell({
  eyebrow,
  title,
  accent,
  subtitle,
  children,
  footer,
  wide = false,
  brandHref = '/',
  brandTag,
}: {
  eyebrow: string
  title: string
  accent: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
  /** null = la marca no es un link (en el programa de escritorio no hay landing). */
  brandHref?: string | null
  brandTag?: string
}) {
  const reducedMotion = useReducedMotion()
  const brand = <CajaGoBrand size="sm" showTag={brandTag} />

  return (
    <div className="cg-stage flex flex-col">
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-[1240px] items-center px-4 sm:px-6 lg:px-8">
        {brandHref ? <Link to={brandHref} aria-label="CajaGo">{brand}</Link> : brand}
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pb-12 pt-6 sm:pt-10">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={`flex w-full flex-col items-center text-center ${wide ? 'max-w-lg' : 'max-w-md'}`}
        >
          <p className="cg-pill"><span className="cg-dot" />{eyebrow}</p>
          <h1 className="cg-title mt-5 text-[clamp(1.9rem,6vw,2.75rem)]">
            {title} <span className="cg-accent block">{accent}</span>
          </h1>
          {subtitle && <p className="mt-3 max-w-md text-pretty text-sm leading-6 text-slate-400 sm:text-base">{subtitle}</p>}
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={`cg-card mt-8 w-full p-5 text-left sm:p-7 ${wide ? 'max-w-lg' : 'max-w-md'}`}
        >
          {children}
        </motion.div>

        {footer && <div className={`mt-6 w-full text-center ${wide ? 'max-w-lg' : 'max-w-md'}`}>{footer}</div>}

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
          {['Sin tarjeta', 'Funciona sin internet', 'Soporte humano'].map((item) => (
            <li key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400/80" /> {item}</li>
          ))}
        </ul>
      </main>
    </div>
  )
}
