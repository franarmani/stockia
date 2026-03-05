/**
 * ClientPicker — left panel with search, filters, customer list.
 */
import { useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import type { Customer } from '@/types/database'
import {
  Search,
  Phone,
  ChevronRight,
  Clock,
  AlertCircle,
  Star,
  Filter,
  UserPlus,
  X,
  Loader2,
} from 'lucide-react'

interface Props {
  customers: Customer[]
  selected: Customer | null
  recentIds: string[]
  onSelect: (c: Customer) => void
  onManualPhone: () => void
  onAddCustomer?: (data: { name: string; phone: string }) => Promise<void>
}

type FilterMode = 'all' | 'with_debt' | 'recent' | 'with_phone'

export default function ClientPicker({ customers, selected, recentIds, onSelect, onManualPhone, onAddCustomer }: Props) {
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [adding, setAdding] = useState(false)

  const filtered = useMemo(() => {
    let list = customers

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
    }

    // Filter
    switch (filterMode) {
      case 'with_debt':
        list = list.filter((c) => c.balance < 0)
        break
      case 'recent':
        list = list.filter((c) => recentIds.includes(c.id))
        break
      case 'with_phone':
        list = list.filter((c) => !!c.phone)
        break
    }

    // Sort: recents first, then alphabetical
    return [...list].sort((a, b) => {
      const ai = recentIds.indexOf(a.id)
      const bi = recentIds.indexOf(b.id)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  }, [customers, search, filterMode, recentIds])

  const FILTERS: { key: FilterMode; label: string; icon: typeof Star }[] = [
    { key: 'all', label: 'Todos', icon: Filter },
    { key: 'with_debt', label: 'Con deuda', icon: AlertCircle },
    { key: 'recent', label: 'Últimos', icon: Clock },
    { key: 'with_phone', label: 'Con tel.', icon: Phone },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#25D366]/50"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 pt-2 pb-1 flex gap-1 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterMode(f.key)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
              filterMode === f.key
                ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30'
                : 'bg-white/5 text-white/40 border border-transparent hover:bg-white/10'
            }`}
          >
            <f.icon className="w-3 h-3" />
            {f.label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="px-3 pt-2 pb-1 space-y-1.5">
        <button
          onClick={onManualPhone}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors text-sm text-white"
        >
          <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-xs">Nuevo chat con número</span>
          <ChevronRight className="w-4 h-4 ml-auto text-white/40" />
        </button>

        {onAddCustomer && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors text-sm text-white"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium text-xs">Agregar cliente</span>
            <ChevronRight className="w-4 h-4 ml-auto text-white/40" />
          </button>
        )}

        {/* Inline add form */}
        {showAddForm && (
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400">Nuevo cliente</span>
              <button onClick={() => { setShowAddForm(false); setNewName(''); setNewPhone('') }} className="text-white/30 hover:text-white/60">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Nombre *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <input
              type="tel"
              placeholder="Teléfono *"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <button
              disabled={!newName.trim() || !newPhone.trim() || adding}
              onClick={async () => {
                setAdding(true)
                try {
                  await onAddCustomer!({ name: newName.trim(), phone: newPhone.trim() })
                  setShowAddForm(false)
                  setNewName('')
                  setNewPhone('')
                } finally {
                  setAdding(false)
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Guardar cliente
            </button>
          </div>
        )}
      </div>

      {/* Customer list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-white/30">
            {search ? 'Sin resultados' : 'No hay clientes'}
          </div>
        ) : (
          filtered.map((c) => {
            const isRecent = recentIds.includes(c.id)
            const isSel = selected?.id === c.id
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  isSel
                    ? 'bg-[#25D366]/15 border border-[#25D366]/30'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isSel ? 'bg-[#25D366] text-white' : 'bg-white/10 text-white/60'
                  }`}
                >
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">{c.name}</span>
                    {isRecent && <Clock className="w-3 h-3 text-white/25 shrink-0" />}
                  </div>
                  {c.phone ? (
                    <p className="text-xs text-white/40 truncate">{c.phone}</p>
                  ) : (
                    <p className="text-xs text-red-400/60 italic">Sin teléfono</p>
                  )}
                </div>
                {c.balance !== 0 && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                      c.balance < 0
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {formatCurrency(c.balance)}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Count */}
      <div className="px-3 py-2 border-t border-white/5 text-[10px] text-white/25 text-center">
        {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
