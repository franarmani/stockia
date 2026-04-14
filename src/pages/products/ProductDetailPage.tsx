import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types/database'
import Button from '@/components/ui/Button'
import { 
  ArrowLeft, Package, TrendingUp, AlertTriangle, 
  BarChart3, Settings, ShieldCheck, Zap, Loader2,
  CheckCircle2, Info, Search, ChevronRight
} from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { getMarketPrices, analyzeProductIntelligence, type AnalysisResult, type MarketData } from '@/services/intelligenceService'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { isDecimalUnit } from '@/stores/posStore'
import { UNIT_SHORT, type Category, type Supplier, type ProductUnit } from '@/types/database'

const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: 'u', label: 'Unidad (u)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'mts', label: 'Metro (mts)' },
  { value: 'lts', label: 'Litro (lts)' },
]

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Edit logic
  const [showEditModal, setShowEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [form, setForm] = useState({
    name: '', barcode: '', sale_price: '', purchase_price: '',
    stock: '', stock_min: '3', category_id: '', unit: 'u' as string,
    brand: '', size_label: '', model: '', presentation: '', supplier_id: '',
  })

  useEffect(() => {
    if (id) fetchProduct()
  }, [id])

  async function fetchProduct() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !data) {
      navigate('/products')
      return
    }
    setProduct(data)
    setSearchTerm(data.name)

    // Fetch dependencies for edit modal
    const [{ data: cats }, { data: sups }] = await Promise.all([
      supabase.from('categories').select('*').eq('business_id', data.business_id).order('name'),
      supabase.from('suppliers').select('*').eq('business_id', data.business_id).eq('active', true).order('name')
    ])
    setCategories(cats || [])
    setSuppliers(sups || [])

    setLoading(false)
  }

  function openEdit() {
    if (!product) return
    setForm({
      name: product.name,
      barcode: product.barcode || '',
      sale_price: String(product.sale_price),
      purchase_price: String(product.purchase_price),
      stock: String(product.stock),
      stock_min: String(product.stock_min),
      category_id: product.category_id || '',
      unit: product.unit || 'u',
      brand: product.brand || '',
      size_label: product.size_label || '',
      model: product.model || '',
      presentation: product.presentation || '',
      supplier_id: product.supplier_id || '',
    })
    setShowEditModal(true)
  }

  async function handleSave() {
    if (!product || !form.name || !form.sale_price) return
    setSaving(true)
    const payload = {
      name: form.name,
      barcode: form.barcode || null,
      sale_price: Number(form.sale_price),
      purchase_price: Number(form.purchase_price) || 0,
      stock: Number(form.stock) || 0,
      stock_min: Number(form.stock_min) || 3,
      category_id: form.category_id || null,
      unit: form.unit || 'u',
      brand: form.brand || null,
      size_label: form.size_label || null,
      model: form.model || null,
      presentation: form.presentation || null,
      supplier_id: form.supplier_id || null,
    }

    const { error } = await supabase.from('products').update(payload).eq('id', product.id)
    if (error) {
      toast.error('Error al guardar cambios')
    } else {
      toast.success('Producto actualizado exitosamente')
      setShowEditModal(false)
      fetchProduct()
    }
    setSaving(false)
  }

  async function runRadarAnalysis() {
    if (!product) return
    setAnalyzing(true)
    try {
      // Calculation of the current margin
      const margin = product.sale_price > 0 
        ? Math.round(((product.sale_price - (product.purchase_price || 0)) / product.sale_price) * 100)
        : 0

      // Unified call to the Edge Function (handles ML search + Groq AI)
      const { marketData, analysis } = await analyzeProductIntelligence({
        productName: searchTerm || product.name,
        category: 'General', 
        price: product.sale_price,
        cost: product.purchase_price || 0,
        margin: margin,
        salesLast2Weeks: 0, 
        unitsSold: 0, 
        trend: 'estable'
      })
      
      setMarketData(marketData)
      setAnalysis(analysis)
      toast.success('Análisis completado con éxito')
    } catch (error: any) {
      toast.error(error.message || 'Error al analizar el producto')
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )

  if (!product) return null

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header / Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/products')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">Volver a productos</span>
        </button>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Settings className="w-4 h-4 mr-2" /> Editar Producto
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Package className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  {product.category_id || 'Sin categoría'}
                </Badge>
                {product.stock <= product.stock_min && (
                  <Badge variant="destructive" className="animate-pulse">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Stock Bajo
                  </Badge>
                )}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{product.name}</h1>
              <p className="text-white/50 text-lg">
                {product.brand} {product.model} · {product.presentation}
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-white/10">
                <div>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-1">Precio Venta</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(product.sale_price)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-1">Costo Actual</p>
                  <p className="text-2xl font-bold text-white/80">{formatCurrency(product.purchase_price || 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-1">Margen Bruto</p>
                  <p className="text-2xl font-bold text-green-400">
                    {product.sale_price > 0 
                      ? `${Math.round(((product.sale_price - (product.purchase_price || 0)) / product.sale_price) * 100)}%`
                      : '0%'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <div className="animate-fade-in space-y-4">
              <div className="glass-card p-6 border-green-500/20 bg-green-500/5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Diagnóstico AI</h2>
                </div>
                <p className="text-white/80 leading-relaxed text-sm">{analysis.diagnosis}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-6 border-red-500/20 bg-red-500/5">
                  <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Problemas detectados
                  </h3>
                  <ul className="space-y-2">
                    {analysis.problems.map((p, i) => (
                      <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="glass-card p-6 border-blue-500/20 bg-blue-500/5">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Oportunidades
                  </h3>
                  <ul className="space-y-2">
                    {analysis.opportunities.map((p, i) => (
                      <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="glass-card p-6 border-primary/20 bg-primary/5">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Recomendaciones Estratégicas
                </h3>
                <ul className="space-y-3">
                  {analysis.recommendations.map((p, i) => (
                    <li key={i} className="text-sm text-white/80 flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                      </div>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="glass-card p-6 bg-linear-to-r from-green-500/10 to-blue-500/10 border-white/10">
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Impacto Económico Estimado</h3>
                <p className="text-xl font-bold text-white">{analysis.impact}</p>
              </div>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-white/35 font-medium uppercase tracking-wider">Ventas (30d)</p>
                <p className="text-xl font-bold text-white">0 unids.</p>
              </div>
            </div>
            <div className="glass-card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-white/35 font-medium uppercase tracking-wider">Rentabilidad</p>
                <p className="text-xl font-bold text-white">Alta</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar / AI Radar */}
        <div className="space-y-6">
          <div className="glass-card border-primary/30 bg-primary/5 p-6 relative overflow-hidden group">
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all" />
             
             <div className="relative z-10">
               <div className="flex items-center gap-2 mb-4">
                 <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                   <Zap className="w-4 h-4 text-primary" />
                 </div>
                 <h2 className="text-lg font-bold text-white tracking-tight">Radar de Mercado</h2>
               </div>
               
               <p className="text-sm text-white/60 mb-6 leading-relaxed">
                 Analizá el precio de este producto contra la competencia en tiempo real usando IA.
               </p>

               {/* Plan Promo Info */}
               <div className="mb-6 p-3 rounded-xl bg-primary/10 border border-primary/20 flex gap-3 items-start group/promo hover:bg-primary/15 transition-colors">
                 <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 group-hover/promo:scale-110 transition-transform">
                   <ShieldCheck className="w-4 h-4 text-primary" />
                 </div>
                 <div>
                   <p className="text-[11px] font-bold text-white uppercase tracking-wider">Beneficio VIP Incluido</p>
                   <p className="text-[10px] text-white/50 leading-tight mt-0.5">
                     Este modo está incluido en tu Plan Negocio por 30 días. Próximamente exclusivo para <span className="text-primary font-bold">Plan Premium ($100.000/mes)</span>.
                   </p>
                 </div>
               </div>

               <div className="mb-6">
                 <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 block">
                   Palabra clave de búsqueda
                 </label>
                 <div className="relative">
                   <input 
                     type="text" 
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                     placeholder="Ej: Taladro Stanley 13mm"
                   />
                   <Search className="absolute right-3 top-2.5 w-4 h-4 text-white/20" />
                 </div>
                 <p className="text-[10px] text-white/30 mt-2 italic leading-tight">
                   Si el nombre es muy específico, simplificalo para obtener mejores resultados de mercado.
                 </p>
               </div>
               
               {marketData && (
                 <div className="space-y-3 mb-6 p-4 rounded-xl bg-black/20 border border-white/5">
                   <div className="flex justify-between text-xs text-white/40 uppercase font-bold tracking-wider">
                     <span>Mercado (Argentina)</span>
                     <a 
                       href={`https://listado.mercadolibre.com.ar/${encodeURIComponent(searchTerm)}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="text-primary hover:underline flex items-center gap-1"
                     >
                       Ver en MLA <ChevronRight className="w-3 h-3" />
                     </a>
                   </div>
                   <div className="flex justify-between items-baseline">
                     <span className="text-sm text-white/60">Promedio</span>
                     <span className="text-lg font-bold text-white">{formatCurrency(marketData.avg)}</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                     <div>
                       <span className="text-[10px] text-white/30 block">Mínimo</span>
                       <span className="text-sm font-bold text-white/70">{formatCurrency(marketData.min)}</span>
                     </div>
                     <div className="text-right">
                       <span className="text-[10px] text-white/30 block">Máximo</span>
                       <span className="text-sm font-bold text-white/70">{formatCurrency(marketData.max)}</span>
                     </div>
                   </div>

                   {/* REAL SAMPLES FOR TRANSPARENCY */}
                   <div className="mt-4 pt-4 border-t border-white/5">
                     <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Fuentes detectadas (Top 5)</p>
                     <div className="space-y-2">
                       {marketData.samples.map((sample, idx) => (
                         <a 
                          key={idx} 
                          href={sample.permalink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-start justify-between gap-3 group/sample"
                         >
                           <span className="text-[11px] text-white/50 group-hover/sample:text-white transition-colors truncate flex-1">
                             {sample.title}
                           </span>
                           <span className="text-[11px] font-bold text-white/70">
                             {formatCurrency(sample.price)}
                           </span>
                         </a>
                       ))}
                     </div>
                   </div>
                 </div>
               )}

               <Button 
                onClick={runRadarAnalysis}
                disabled={analyzing}
                className="w-full h-11 gradient-primary shadow-lg shadow-green-900/40"
               >
                 {analyzing ? (
                   <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando en Mercado Libre...
                   </>
                 ) : (
                   analysis ? 'Actualizar Análisis' : 'Activar Radar AI'
                 )}
               </Button>
               
               <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-white/30 uppercase tracking-widest font-bold">
                 <ShieldCheck className="w-3 h-3" /> Powered by Groq AI
               </div>
             </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-widest opacity-40">Estado de Inventario</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Stock Actual</span>
                <span className="text-lg font-bold text-white">{product.stock} {product.unit || 'uds'}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${product.stock <= product.stock_min ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, (product.stock / (product.stock_min * 3)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/30">Mínimo sugerido</span>
                <span className="text-xs font-semibold text-white/40">{product.stock_min} {product.unit || 'uds'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Edit Modal mirroring ProductsPage */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Producto" size="md">
        <div className="space-y-4 max-h-[70vh] overflow-auto pr-2 custom-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Nombre *</label>
              <input 
                type="text" 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all placeholder:text-white/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Precio venta *</label>
                <input 
                  type="number" 
                  value={form.sale_price} 
                  onChange={(e) => setForm({...form, sale_price: e.target.value})} 
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Costo</label>
                <input 
                  type="number" 
                  value={form.purchase_price} 
                  onChange={(e) => setForm({...form, purchase_price: e.target.value})} 
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Unidad</label>
                <select 
                  value={form.unit} 
                  onChange={(e) => setForm({...form, unit: e.target.value})}
                  className="w-full h-11 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all appearance-none cursor-pointer"
                >
                  {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value} className="bg-slate-900">{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Stock</label>
                <input 
                  type="number" 
                  value={form.stock} 
                  onChange={(e) => setForm({...form, stock: e.target.value})} 
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1">Stock mín</label>
                <input 
                  type="number" 
                  value={form.stock_min} 
                  onChange={(e) => setForm({...form, stock_min: e.target.value})} 
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
                />
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em] mb-3 ml-1">Variantes</p>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="text" 
                  value={form.brand} 
                  onChange={(e) => setForm({...form, brand: e.target.value})} 
                  placeholder="Marca" 
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all" 
                />
                <input 
                  type="text" 
                  value={form.model} 
                  onChange={(e) => setForm({...form, model: e.target.value})} 
                  placeholder="Modelo" 
                  className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input 
                type="text" 
                value={form.barcode} 
                onChange={(e) => setForm({...form, barcode: e.target.value})} 
                placeholder="Código de barras"
                className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
              />
              <select 
                value={form.category_id} 
                onChange={(e) => setForm({...form, category_id: e.target.value})} 
                className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-900">Categoría</option>
                {categories.map(c => (<option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button 
              onClick={() => setShowEditModal(false)}
              className="flex-1 h-12 rounded-2xl border border-white/10 bg-white/5 text-white/70 font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-violet-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-violet-500 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
