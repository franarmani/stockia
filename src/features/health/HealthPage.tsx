import { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Package, Wallet,
  AlertTriangle, Users, Activity, ExternalLink, RefreshCw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useBusinessStore } from '@/stores/businessStore'
import { formatCurrency } from '@/lib/utils'

interface HealthMetrics {
  todaySales: number
  yesterdaySales: number
  criticalStockCount: number
  lowStockCount: number
  cajaOpen: boolean
  cajaOpenedAt: string | null
  totalDebt: number
  debtorCount: number
  rejectedInvoices: number
  productsWithoutCost: number
}

function TrendIcon({ current, previous }: { current: number; previous: number }) {
  if (current > previous) return <TrendingUp className="w-4 h-4 text-green-400" />
  if (current < previous) return <TrendingDown className="w-4 h-4 text-red-400" />
  return <Minus className="w-4 h-4 text-white/40" />
}

function scoreColor(score: number) {
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

interface HealthCardProps {
  title: string
  value: string
  sub?: string
  severity: 'ok' | 'warn' | 'danger'
  icon: React.ReactNode
  action?: string
  actionUrl?: string
  extra?: React.ReactNode
}

function HealthCard({ title, value, sub, severity, icon, action, actionUrl, extra }: HealthCardProps) {
  const navigate = useNavigate()
  const border = severity === 'ok' ? 'border-green-500/20' : severity === 'warn' ? 'border-amber-500/20' : 'border-red-500/20'
  const bg = severity === 'ok' ? '' : severity === 'warn' ? 'bg-amber-500/5' : 'bg-red-500/5'
  const valColor = severity === 'ok' ? 'text-green-400' : severity === 'warn' ? 'text-amber-400' : 'text-red-400'
  return (
    <div className={`glass-card p-4 border ${border} ${bg} flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${severity === 'ok' ? 'bg-green-500/20' : severity === 'warn' ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
            {icon}
          </div>
          <p className="text-[12px] text-white/50 font-medium">{title}</p>
        </div>
        {action && actionUrl && (
          <button
            onClick={() => navigate(actionUrl)}
            className="text-[11px] text-primary hover:text-primary/80 transition flex items-center gap-1"
          >
            {action} <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
      <div>
        <p className={`text-2xl font-bold ${valColor}`}>{value}</p>
        {sub && <p className="text-[12px] text-white/40 mt-0.5">{sub}</p>}
      </div>
      {extra}
    </div>
  )
}

export default function HealthPage() {
  const { business } = useBusinessStore()
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMetrics = async () => {
    if (!business?.id) return
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

      const [todaySalesRes, yesterdaySalesRes, stockRes, cajaRes, debtRes, invoiceRes, noCostRes] = await Promise.all([
        supabase.from('sales').select('total').eq('business_id', business.id).eq('voided', false).gte('created_at', today + 'T00:00:00').lt('created_at', today + 'T23:59:59'),
        supabase.from('sales').select('total').eq('business_id', business.id).eq('voided', false).gte('created_at', yesterday + 'T00:00:00').lt('created_at', yesterday + 'T23:59:59'),
        supabase.from('stock_insights').select('stock_status').eq('business_id', business.id),
        supabase.from('cash_sessions').select('status,opened_at').eq('business_id', business.id).eq('status', 'open').maybeSingle(),
        supabase.from('customer_accounts').select('balance').eq('business_id', business.id).gt('balance', 0),
        supabase.from('invoices').select('id').eq('business_id', business.id).eq('status', 'rejected'),
        supabase.from('products').select('id').eq('business_id', business.id).eq('active', true).eq('purchase_price', 0),
      ])

      const todaySales = (todaySalesRes.data ?? []).reduce((s, r) => s + r.total, 0)
      const yesterdaySales = (yesterdaySalesRes.data ?? []).reduce((s, r) => s + r.total, 0)
      const criticalStockCount = (stockRes.data ?? []).filter(r => r.stock_status === 'critical').length
      const lowStockCount = (stockRes.data ?? []).filter(r => r.stock_status === 'low').length
      const cajaOpen = cajaRes.data?.status === 'open'
      const cajaOpenedAt = cajaRes.data?.opened_at ?? null
      const totalDebt = (debtRes.data ?? []).reduce((s, r) => s + r.balance, 0)
      const debtorCount = debtRes.data?.length ?? 0
      const rejectedInvoices = invoiceRes.data?.length ?? 0
      const productsWithoutCost = noCostRes.data?.length ?? 0

      setMetrics({
        todaySales, yesterdaySales, criticalStockCount, lowStockCount,
        cajaOpen, cajaOpenedAt, totalDebt, debtorCount, rejectedInvoices, productsWithoutCost,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMetrics() }, [business?.id])

  // Compute score 0-100
  const score = metrics ? Math.max(0, 100
    - (metrics.criticalStockCount * 15)
    - (metrics.lowStockCount * 5)
    - (metrics.rejectedInvoices * 10)
    - (metrics.productsWithoutCost > 5 ? 10 : metrics.productsWithoutCost * 2)
    - (!metrics.cajaOpen && metrics.todaySales > 0 ? 5 : 0)
  ) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Salud del negocio</h1>
            <p className="text-[12px] text-white/50">Estado general en tiempo real</p>
          </div>
        </div>
        <button onClick={fetchMetrics} className="glass-btn flex items-center gap-1.5 text-[12px]">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Score */}
      {score !== null && (
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'}
                strokeWidth="3"
                strokeDasharray={`${score} ${100 - score}`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-[16px] font-bold ${scoreColor(score)}`}>
              {score}
            </span>
          </div>
          <div>
            <p className="text-[13px] text-white/50 font-medium">Score del negocio</p>
            <p className={`text-lg font-bold ${scoreColor(score)}`}>
              {score >= 75 ? 'Muy bien' : score >= 50 ? 'Atención requerida' : 'Acción urgente'}
            </p>
            <p className="text-[11px] text-white/30 mt-0.5">Basado en stock, deuda, caja y facturación</p>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-4 h-28 animate-pulse" />
          ))}
        </div>
      ) : metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Ventas hoy */}
          <HealthCard
            title="Ventas hoy"
            value={formatCurrency(metrics.todaySales)}
            sub={`Ayer: ${formatCurrency(metrics.yesterdaySales)}`}
            severity={metrics.todaySales >= metrics.yesterdaySales ? 'ok' : 'warn'}
            icon={<TrendIcon current={metrics.todaySales} previous={metrics.yesterdaySales} />}
            action="Ver historial" actionUrl="/sales"
          />
          {/* Stock crítico */}
          <HealthCard
            title="Stock crítico"
            value={`${metrics.criticalStockCount} producto${metrics.criticalStockCount !== 1 ? 's' : ''}`}
            sub={metrics.lowStockCount > 0 ? `+ ${metrics.lowStockCount} en stock bajo` : 'Stock bajo: ninguno'}
            severity={metrics.criticalStockCount > 0 ? 'danger' : metrics.lowStockCount > 0 ? 'warn' : 'ok'}
            icon={<Package className={`w-4 h-4 ${metrics.criticalStockCount > 0 ? 'text-red-400' : 'text-green-400'}`} />}
            action="Ver productos" actionUrl="/products"
          />
          {/* Caja */}
          <HealthCard
            title="Caja"
            value={metrics.cajaOpen ? 'Abierta' : 'Cerrada'}
            sub={metrics.cajaOpen && metrics.cajaOpenedAt
              ? `Abierta hace ${Math.floor((Date.now() - new Date(metrics.cajaOpenedAt).getTime()) / 3600000)}h`
              : undefined}
            severity={metrics.cajaOpen ? 'ok' : 'warn'}
            icon={<Wallet className={`w-4 h-4 ${metrics.cajaOpen ? 'text-green-400' : 'text-amber-400'}`} />}
            action="Ir a caja" actionUrl="/cash-register"
          />
          {/* Clientes con deuda */}
          <HealthCard
            title="Deuda clientes"
            value={formatCurrency(metrics.totalDebt)}
            sub={`${metrics.debtorCount} cliente${metrics.debtorCount !== 1 ? 's' : ''} con saldo pendiente`}
            severity={metrics.totalDebt === 0 ? 'ok' : metrics.totalDebt > 50000 ? 'danger' : 'warn'}
            icon={<Users className={`w-4 h-4 ${metrics.totalDebt === 0 ? 'text-green-400' : 'text-amber-400'}`} />}
            action="Ver clientes" actionUrl="/customers"
          />
          {/* Facturas rechazadas */}
          <HealthCard
            title="Facturas rechazadas"
            value={`${metrics.rejectedInvoices}`}
            sub={metrics.rejectedInvoices === 0 ? 'Sin problemas AFIP' : 'Requieren atención'}
            severity={metrics.rejectedInvoices === 0 ? 'ok' : 'danger'}
            icon={<AlertTriangle className={`w-4 h-4 ${metrics.rejectedInvoices === 0 ? 'text-green-400' : 'text-red-400'}`} />}
            action="Ver comprobantes" actionUrl="/comprobantes"
          />
          {/* Productos sin costo */}
          <HealthCard
            title="Sin precio de costo"
            value={`${metrics.productsWithoutCost} producto${metrics.productsWithoutCost !== 1 ? 's' : ''}`}
            sub="Afecta el cálculo de ganancia"
            severity={metrics.productsWithoutCost === 0 ? 'ok' : metrics.productsWithoutCost > 10 ? 'danger' : 'warn'}
            icon={<Package className={`w-4 h-4 ${metrics.productsWithoutCost === 0 ? 'text-green-400' : 'text-amber-400'}`} />}
            action="Corregir" actionUrl="/products"
          />
        </div>
      )}
    </div>
  )
}
