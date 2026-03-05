/**
 * ImportProductsModal.tsx
 * 4-step wizard: upload → column mapping → preview/validate → import + results
 */
import { useState, useRef, useCallback } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { parseFile, generateTemplate } from '@/lib/import/excelParser'
import type { ParsedFile } from '@/lib/import/excelParser'
import { detectColumns, FIELD_LABELS, getMissingRequired } from '@/lib/import/columnMatcher'
import type { ColumnMapping, ProductField } from '@/lib/import/columnMatcher'
import { mapAndValidateRows, runImport } from '@/lib/import/importApi'
import type { MappedRow, ImportMode, MatchBy, ImportResult } from '@/lib/import/importApi'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import {
  Upload, FileSpreadsheet, ChevronRight, ChevronLeft,
  CheckCircle2, AlertCircle, X, RotateCcw, Download,
  Loader2, AlertTriangle,
} from 'lucide-react'

const FIELD_OPTIONS: { value: ProductField | ''; label: string }[] = [
  { value: '', label: '— Ignorar columna —' },
  { value: 'name', label: 'Nombre (requerido)' },
  { value: 'sale_price', label: 'Precio venta (requerido)' },
  { value: 'purchase_price', label: 'Precio compra' },
  { value: 'stock', label: 'Stock' },
  { value: 'stock_min', label: 'Stock mínimo' },
  { value: 'barcode', label: 'Código de barras' },
  { value: 'category', label: 'Categoría' },
  { value: 'unit', label: 'Unidad (u/kg/mts/lts)' },
  { value: 'description', label: 'Descripción' },
  { value: 'brand', label: 'Marca' },
  { value: 'active', label: 'Activo' },
]

const STEPS = ['Archivo', 'Columnas', 'Preview', 'Importar']

interface Props { open: boolean; onClose: () => void; onDone?: () => void }

export default function ImportProductsModal({ open, onClose, onDone }: Props) {
  const { profile } = useAuthStore()
  const [step, setStep] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [loading, setLoading] = useState(false)
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([])
  const [mode, setMode] = useState<ImportMode>('upsert')
  const [matchBy, setMatchBy] = useState<MatchBy>('barcode')
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep(0); setFile(null); setParsed(null); setMappings([]); setSelectedSheet('')
    setMappedRows([]); setResult(null); setProgress(0); setProgressText(''); setImporting(false)
  }

  function handleClose() { reset(); onClose() }

  // ─── STEP 0: File Upload ──────────────────────────────────────────────────
  async function handleFileDrop(f: File) {
    setFile(f); setLoading(true)
    try {
      const result = await parseFile(f)
      setParsed(result)
      setSelectedSheet(result.selectedSheet)
      setMappings(result.columnMappings)
      setStep(1)
    } catch (e: any) {
      toast.error(e.message || 'Error al leer el archivo')
    } finally {
      setLoading(false)
    }
  }

  async function handleSheetChange(sheet: string) {
    if (!file) return
    setLoading(true)
    try {
      const result = await parseFile(file, { sheetName: sheet })
      setParsed(result); setSelectedSheet(sheet); setMappings(result.columnMappings)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  // ─── STEP 1: Column Mapping ───────────────────────────────────────────────
  function updateMapping(idx: number, field: ProductField | '') {
    setMappings(prev => {
      const next = [...prev]
      // If another column already has this field, clear it
      if (field) {
        next.forEach((m, i) => { if (i !== idx && m.field === field) next[i] = { ...m, field: null } })
      }
      next[idx] = { ...next[idx], field: field || null }
      return next
    })
  }

  function goToPreview() {
    const missing = getMissingRequired(mappings)
    if (missing.length > 0) {
      toast.error(`Falta mapear: ${missing.map(f => FIELD_LABELS[f]).join(', ')}`)
      return
    }
    const rows = mapAndValidateRows(parsed!.rows, mappings)
    setMappedRows(rows)
    setStep(2)
  }

  // ─── STEP 3: Import ───────────────────────────────────────────────────────
  async function startImport() {
    if (!profile?.business_id) return
    abortRef.current = new AbortController()
    setImporting(true); setProgress(0); setResult(null)

    const res = await runImport(
      profile.business_id,
      mappedRows,
      mode,
      matchBy,
      (pct, processed, total) => {
        setProgress(pct)
        setProgressText(`${processed} / ${total} filas`)
      },
      abortRef.current.signal,
    )
    setResult(res); setImporting(false); setStep(3)
    onDone?.()
  }

  function downloadErrorReport(errors: ImportResult['errors']) {
    if (errors.length === 0) return
    const rows = errors.map(e => ({ Fila: e.rowIndex, Campo: e.field, Error: e.message, Valor: String(e.value ?? '') }))
    const csv = Papa.unparse(rows, { quotes: true })
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'errores_importacion.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  function downloadTemplate() {
    const buf = generateTemplate()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_productos.xlsx'
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const errorRows = mappedRows.filter(r => r.errors.length > 0)
  const validRows = mappedRows.filter(r => r.errors.length === 0)

  return (
    <Modal open={open} onClose={handleClose} title="Importar productos" size="lg">
      <div className="space-y-5">
        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors ${
                i < step ? 'bg-primary text-white' : i === step ? 'bg-primary/10 text-primary border-2 border-primary' : 'bg-slate-100 text-slate-400'
              }`}>{i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}</div>
              <span className={`mx-1.5 text-xs font-medium hidden sm:block ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-primary' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 0: Upload ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f) }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileDrop(f) }} />
              {loading
                ? <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
                : <><FileSpreadsheet className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                  <p className="font-semibold text-foreground">Arrastrá tu archivo acá</p>
                  <p className="text-sm text-muted-foreground mt-1">O hacé click para seleccionar — .xlsx, .xls, .csv</p></>
              }
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">¿No tenés el formato? Descargá la plantilla para empezar.</p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4" /> Plantilla
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Column mapping ── */}
        {step === 1 && parsed && (
          <div className="space-y-4">
            {parsed.sheetNames.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Hoja del archivo</label>
                <select value={selectedSheet} onChange={e => handleSheetChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {parsed.sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold mb-1">Mapeo de columnas</p>
              <p className="text-xs text-muted-foreground mb-3">
                Detectamos {mappings.filter(m => m.field).length} de {mappings.length} columnas. Revisá el mapeo y corregí si es necesario.
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {mappings.map((m, i) => (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border ${m.field ? 'border-green-200 bg-green-50/50' : 'border-slate-200'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Columna del archivo</p>
                      <p className="text-sm font-medium truncate">{m.original}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                      value={m.field || ''}
                      onChange={e => updateMapping(i, e.target.value as ProductField | '')}
                      className="w-48 h-9 px-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 shrink-0"
                    >
                      {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {parsed.rows.length} filas detectadas · {file?.name}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(0)}><ChevronLeft className="w-4 h-4" /> Atrás</Button>
              <Button size="sm" className="flex-1" onClick={goToPreview}>
                Ver preview <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview + validation ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${validRows.length > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {validRows.length} válidas
              </div>
              {errorRows.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  <AlertCircle className="w-3.5 h-3.5" /> {errorRows.length} con errores
                </div>
              )}
            </div>

            {/* Error summary */}
            {errorRows.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 space-y-1 max-h-32 overflow-y-auto">
                {errorRows.slice(0, 8).flatMap(r => r.errors).map((e, i) => (
                  <p key={i} className="text-xs text-red-700">
                    <span className="font-semibold">Fila {e.rowIndex}:</span> {e.message}
                  </p>
                ))}
                {errorRows.length > 8 && <p className="text-xs text-red-500">… y {errorRows.length - 8} más</p>}
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-auto max-h-64 rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-muted-foreground font-semibold">#</th>
                    <th className="px-2 py-2 text-left text-muted-foreground font-semibold">Nombre</th>
                    <th className="px-2 py-2 text-right text-muted-foreground font-semibold">P.Venta</th>
                    <th className="px-2 py-2 text-right text-muted-foreground font-semibold">P.Compra</th>
                    <th className="px-2 py-2 text-right text-muted-foreground font-semibold">Stock</th>
                    <th className="px-2 py-2 text-left text-muted-foreground font-semibold">Barcode</th>
                    <th className="px-2 py-2 text-left text-muted-foreground font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, 30).map((row) => {
                    const hasErr = row.errors.length > 0
                    const errFields = new Set(row.errors.map(e => e.field))
                    return (
                      <tr key={row.rowIndex} className={hasErr ? 'bg-red-50' : ''}>
                        <td className="px-2 py-1.5 text-muted-foreground">{row.rowIndex}</td>
                        <td className={`px-2 py-1.5 font-medium ${errFields.has('name') ? 'text-red-600' : ''}`}>{row.mapped.name || <span className="text-red-500">—</span>}</td>
                        <td className={`px-2 py-1.5 text-right ${errFields.has('sale_price') ? 'text-red-600' : ''}`}>{row.mapped.sale_price ?? <span className="text-red-500">—</span>}</td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground">{row.mapped.purchase_price ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right">{row.mapped.stock ?? '—'}</td>
                        <td className="px-2 py-1.5 text-muted-foreground font-mono">{row.mapped.barcode || '—'}</td>
                        <td className="px-2 py-1.5">
                          {hasErr
                            ? <span title={row.errors.map(e => e.message).join('; ')} className="text-red-500 cursor-help">❌</span>
                            : <span className="text-green-500">✓</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {mappedRows.length > 30 && (
                <p className="text-center text-xs text-muted-foreground py-2">Mostrando 30 de {mappedRows.length} filas</p>
              )}
            </div>

            {/* Import options */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Modo de importación</p>
                <div className="space-y-1">
                  {([['upsert','Crear y actualizar (recomendado)'],['create','Solo crear nuevos'],['update','Solo actualizar existentes']] as const).map(([val, label]) => (
                    <label key={val} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition ${mode === val ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-slate-50'}`}>
                      <input type="radio" name="mode" value={val} checked={mode === val} onChange={() => setMode(val)} className="accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Identificar por</p>
                <div className="space-y-1">
                  {([['barcode','Código de barras'],['name','Nombre del producto']] as const).map(([val, label]) => (
                    <label key={val} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition ${matchBy === val ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-slate-50'}`}>
                      <input type="radio" name="matchBy" value={val} checked={matchBy === val} onChange={() => setMatchBy(val)} className="accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4" /> Atrás</Button>
              <Button size="sm" className="flex-1" disabled={validRows.length === 0} onClick={() => setStep(3)}>
                Importar {validRows.length} productos <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Import progress / result ── */}
        {step === 3 && (
          <div className="space-y-5">
            {!result && !importing && (
              <div className="text-center space-y-4">
                <div className="bg-amber-50 rounded-xl p-4">
                  <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold">Listo para importar</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se importarán <strong>{validRows.length}</strong> productos en modo <strong>{mode === 'upsert' ? 'crear y actualizar' : mode === 'create' ? 'solo crear' : 'solo actualizar'}</strong>.
                    {errorRows.length > 0 && <> <strong>{errorRows.length}</strong> filas con errores serán omitidas.</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4" /> Atrás</Button>
                  <Button size="sm" className="flex-1" onClick={startImport}>
                    <Upload className="w-4 h-4" /> Importar ahora
                  </Button>
                </div>
              </div>
            )}

            {importing && (
              <div className="space-y-3 text-center">
                <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                <p className="text-sm font-medium">Importando productos...</p>
                <p className="text-xs text-muted-foreground">{progressText}</p>
                <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
                <Button variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>Cancelar</Button>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: '✅', label: 'Creados', val: result.created, color: 'green' },
                    { icon: '🔁', label: 'Actualizados', val: result.updated, color: 'blue' },
                    { icon: '⏭️', label: 'Omitidos', val: result.skipped, color: 'slate' },
                    { icon: '❌', label: 'Errores', val: result.errors.length, color: 'red' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-3 text-center bg-${s.color}-50`}>
                      <p className="text-xl">{s.icon}</p>
                      <p className={`text-xl font-bold text-${s.color}-700`}>{s.val}</p>
                      <p className={`text-xs text-${s.color}-600`}>{s.label}</p>
                    </div>
                  ))}
                </div>
                {result.errors.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-3 space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 6).map((e, i) => (
                      <p key={i} className="text-xs text-red-700"><span className="font-semibold">Fila {e.rowIndex}:</span> {e.message}</p>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleClose}>
                    <X className="w-4 h-4" /> Cerrar
                  </Button>
                  {result.errors.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => downloadErrorReport(result.errors)}>
                      <Download className="w-4 h-4" /> Errores CSV
                    </Button>
                  )}
                  <Button size="sm" onClick={reset}>
                    <RotateCcw className="w-4 h-4" /> Nueva importación
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
