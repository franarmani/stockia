/**
 * ExportProductsModal.tsx
 * Export products to xlsx/csv with column selector and filters.
 */
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { exportProducts, DEFAULT_EXPORT_COLUMNS } from '@/lib/import/exportWriter'
import type { ExportColumn } from '@/lib/import/exportWriter'
import type { Product, Category } from '@/types/database'
import { FileSpreadsheet, FileText, Download, Filter } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  products: Product[]
  categories: Category[]
}

export default function ExportProductsModal({ open, onClose, products, categories }: Props) {
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_EXPORT_COLUMNS.map(c => ({ ...c })))
  const [filterCategory, setFilterCategory] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active')
  const [filterLowStock, setFilterLowStock] = useState(false)

  function toggleColumn(idx: number) {
    setColumns(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], enabled: !next[idx].enabled }
      return next
    })
  }

  function getFilteredProducts() {
    // Build category map
    const catMap: Record<string, string> = {}
    for (const c of categories) catMap[c.id] = c.name

    let list = products.map(p => ({ ...p, category_name: p.category_id ? (catMap[p.category_id] || '') : '' }))

    if (filterCategory) list = list.filter(p => p.category_id === filterCategory)
    if (filterActive === 'active') list = list.filter(p => p.active)
    if (filterActive === 'inactive') list = list.filter(p => !p.active)
    if (filterLowStock) list = list.filter(p => p.stock <= p.stock_min)
    return list
  }

  const filtered = getFilteredProducts()
  const enabledCount = columns.filter(c => c.enabled).length

  function handleExport(format: 'xlsx' | 'csv') {
    exportProducts(filtered, { columns, format })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Exportar productos" size="sm">
      <div className="space-y-5">
        {/* Filters */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Filtros</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Categoría</label>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Estado</label>
            <div className="flex gap-2">
              {([['all','Todos'],['active','Activos'],['inactive','Inactivos']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilterActive(val)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${filterActive === val ? 'bg-primary text-white border-primary' : 'border-slate-200 text-muted-foreground hover:border-primary/40'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={filterLowStock} onChange={e => setFilterLowStock(e.target.checked)}
              className="w-4 h-4 rounded accent-primary" />
            <span className="text-sm">Solo stock bajo</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Se exportarán <strong>{filtered.length}</strong> productos de {products.length} totales.
          </p>
        </div>

        <div className="border-t border-slate-100" />

        {/* Column selector */}
        <div>
          <p className="text-sm font-semibold mb-2">Columnas ({enabledCount}/{columns.length})</p>
          <div className="grid grid-cols-2 gap-1.5">
            {columns.map((col, i) => (
              <label key={col.field} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${col.enabled ? 'bg-primary/5 text-primary font-medium' : 'bg-slate-50 text-muted-foreground hover:bg-slate-100'}`}>
                <input type="checkbox" checked={col.enabled} onChange={() => toggleColumn(i)} className="accent-primary" />
                {col.label}
              </label>
            ))}
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => handleExport('xlsx')} disabled={filtered.length === 0 || enabledCount === 0}>
            <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => handleExport('csv')} disabled={filtered.length === 0 || enabledCount === 0}>
            <FileText className="w-4 h-4" /> CSV
          </Button>
        </div>
      </div>
    </Modal>
  )
}
