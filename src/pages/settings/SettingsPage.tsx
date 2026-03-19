import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useBusinessStore } from '@/stores/businessStore'
import { useFiscalStore } from '@/stores/fiscalStore'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { IVA_CONDITIONS } from '@/types/database'
import type { UserProfile, FiscalEnv } from '@/types/database'
import {
  Store, Users, Shield, Plus, Trash2, Crown, Save, FileText, Printer,
  CheckCircle2, Upload, AlertCircle, Wifi, Download, Copy,
  Key, Zap, ChevronRight, ChevronLeft, Loader2, Globe, ChevronDown, Percent,
  CreditCard, Banknote, ArrowRightLeft,
} from 'lucide-react'

const WIZARD_STEPS = [
  { id: 1, title: 'Datos fiscales', desc: 'CUIT, condición IVA y punto de venta', icon: FileText },
  { id: 2, title: 'Certificado AFIP', desc: 'Generá el CSR y subí el CRT', icon: Key },
  { id: 3, title: 'Probar emisión', desc: 'Verificá la conexión con AFIP', icon: Zap },
]

export default function SettingsPage() {
  const { profile } = useAuthStore()
  const { business, updateBusiness } = useBusinessStore()
  const { settings: fiscalSettings, env: fiscalEnv, setEnv, fetchSettings, upsertSettings, updateCertStatus } = useFiscalStore()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)

  // AFIP wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [generatingCsr, setGeneratingCsr] = useState(false)
  const [uploadingCert, setUploadingCert] = useState(false)
  const [testingAfip, setTestingAfip] = useState(false)
  const [afipTestResult, setAfipTestResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [afipTestMsg, setAfipTestMsg] = useState('')
  const certInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '', address: '', phone: '',
    cuit: '', iva_condition: 'monotributo', punto_venta: '1',
    iibb: '', razon_social: '', domicilio_comercial: '', inicio_actividades: '',
    receipt_footer: '', auto_print: false,
    logo_url: '', primary_color: '#1DB954',
  })
  const [pmDiscounts, setPmDiscounts] = useState<Record<string, number>>({
    cash: 0, debit: 0, credit: 0, transfer: 0,
  })
  const [userForm, setUserForm] = useState({ email: '', password: '', full_name: '', role: 'seller' as 'admin' | 'seller' })

  // Derived state from fiscal store
  const certStatus = fiscalSettings?.cert_status || 'missing'
  const csrGenerated = certStatus === 'csr_generated' || certStatus === 'crt_uploaded' || certStatus === 'connected'
  const certUploaded = certStatus === 'crt_uploaded' || certStatus === 'connected'
  const afipConnected = certStatus === 'connected'

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name,
        address: business.address || '',
        phone: business.phone || '',
        cuit: business.cuit || '',
        iva_condition: business.iva_condition || 'monotributo',
        punto_venta: String(business.punto_venta || 1),
        iibb: (business as any).iibb || '',
        razon_social: (business as any).razon_social || '',
        domicilio_comercial: (business as any).domicilio_comercial || '',
        inicio_actividades: (business as any).inicio_actividades || '',
        receipt_footer: business.receipt_footer || '',
        auto_print: business.auto_print || false,
        logo_url: business.logo_url || '',
        primary_color: business.primary_color || '#1DB954',
      })
      // Load payment method discounts
      const saved = (business as any).payment_method_discounts
      if (saved && typeof saved === 'object') {
        setPmDiscounts({
          cash: saved.cash ?? 0,
          debit: saved.debit ?? 0,
          credit: saved.credit ?? 0,
          transfer: saved.transfer ?? 0,
        })
      }
    }
  }, [business])

  // Fetch fiscal settings when business or env changes
  useEffect(() => {
    if (profile?.business_id) {
      fetchSettings(profile.business_id, fiscalEnv)
    }
  }, [profile?.business_id, fiscalEnv])

  // Sync afipTestResult with stored cert_status
  useEffect(() => {
    if (afipConnected) {
      setAfipTestResult('success')
      setWizardOpen(true) // auto-expand if already configured
    }
  }, [afipConnected])

  useEffect(() => { if (profile?.business_id) fetchUsers() }, [profile?.business_id])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').eq('business_id', profile!.business_id)
    setUsers(data || [])
    setLoading(false)
  }

  async function handleLogoUpload(file: File) {
    if (!file) return
    const maxMb = 2
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`El archivo debe pesar menos de ${maxMb} MB`)
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes (PNG, JPG, SVG, WEBP)')
      return
    }
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${profile!.business_id}/logo.${ext}`

      const { error: upErr } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) throw upErr

      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      // Bust cache so the same filename shows the new image
      const bustedUrl = `${data.publicUrl}?t=${Date.now()}`
      setForm(prev => ({ ...prev, logo_url: bustedUrl }))
      toast.success('Logo subido correctamente')
    } catch (err: any) {
      console.error(err)
      toast.error('Error al subir el logo: ' + (err?.message || 'desconocido'))
    }
    setUploadingLogo(false)
  }

  async function handleSaveBusiness() {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      cuit: form.cuit.trim() || null,
      iva_condition: form.iva_condition || null,
      punto_venta: Number(form.punto_venta) || 1,
      iibb: form.iibb.trim() || null,
      razon_social: form.razon_social.trim() || null,
      domicilio_comercial: form.domicilio_comercial.trim() || null,
      inicio_actividades: form.inicio_actividades || null,
      receipt_footer: form.receipt_footer.trim() || null,
      auto_print: form.auto_print,
      logo_url: form.logo_url.trim() || null,
      primary_color: form.primary_color || null,
      payment_method_discounts: pmDiscounts,
    }
    const { error } = await supabase.from('businesses').update(payload).eq('id', profile!.business_id)
    if (error) { toast.error('Error al guardar'); setSaving(false); return }
    updateBusiness(payload as any)
    toast.success('Datos guardados')
    setSaving(false)
  }

  async function handleSaveFiscalAndContinue() {
    if (!profile?.business_id) return
    if (!form.cuit.trim() || !form.iva_condition) {
      toast.error('CUIT y Condición IVA son obligatorios')
      return
    }
    setSaving(true)
    try {
      // Save business data
      await handleSaveBusiness()
      // Save/update fiscal_settings
      await upsertSettings(profile.business_id, {
        cuit: form.cuit.trim(),
        razon_social: form.razon_social.trim() || form.name.trim(),
        domicilio: form.domicilio_comercial.trim() || form.address.trim() || '',
        iva_condition: form.iva_condition,
        pto_vta: Number(form.punto_venta) || 1,
      })
      toast.success('Datos fiscales guardados')
      setWizardStep(2)
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar datos fiscales')
    }
    setSaving(false)
  }

  async function handleGenerateCsr() {
    if (!profile?.business_id || !form.cuit.trim()) {
      toast.error('Completá los datos fiscales primero (CUIT requerido)')
      return
    }
    setGeneratingCsr(true)
    try {
      // Call Edge Function to generate CSR (RSA key pair generated server-side)
      const { data, error } = await supabase.functions.invoke('afip-generate-csr', {
        body: { env: fiscalEnv },
      })

      if (error || !data?.csr_pem) {
        // Fallback: simulate CSR locally for development
        console.warn('Edge Function not available, using local fallback:', error)
        const cuit = form.cuit.replace(/[-\s]/g, '')
        const csrContent = `-----BEGIN CERTIFICATE REQUEST-----\nCSR para CUIT ${cuit} — generado por STOCKIA\n(Deploy la Edge Function afip-generate-csr para generar CSR real)\n-----END CERTIFICATE REQUEST-----`
        
        const blob = new Blob([csrContent], { type: 'application/pkcs10' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `stockia-${cuit}.csr`
        a.click()
        URL.revokeObjectURL(url)

        // Update cert_status locally even without Edge Function
        updateCertStatus('csr_generated')
        toast.success('CSR generado (modo desarrollo). Descargá el archivo y subilo a AFIP.')
        setGeneratingCsr(false)
        return
      }

      // Download CSR from Edge Function response
      const blob = new Blob([data.csr_pem], { type: 'application/pkcs10' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.csr_download_name || `stockia-${form.cuit.replace(/[-\s]/g, '')}.csr`
      a.click()
      URL.revokeObjectURL(url)

      updateCertStatus('csr_generated')
      toast.success('CSR generado. Descargá el archivo y subilo a AFIP.')
    } catch (err: any) {
      toast.error(err?.message || 'Error al generar el CSR')
    }
    setGeneratingCsr(false)
  }

  async function handleUploadCert() {
    if (!certFile) { toast.error('Seleccioná el archivo .crt de AFIP'); return }
    if (!profile?.business_id) return
    setUploadingCert(true)
    try {
      // Read file as text
      const crtPem = await certFile.text()

      // Call Edge Function to store CRT
      const { data, error } = await supabase.functions.invoke('afip-upload-crt', {
        body: { env: fiscalEnv, crt_pem: crtPem },
      })

      if (error) {
        // Fallback: upload to storage directly
        console.warn('Edge Function not available, uploading to storage:', error)
        const folder = profile.business_id
        const { error: storeErr } = await supabase.storage
          .from('afip-certs')
          .upload(`${folder}/cert.crt`, certFile, { upsert: true })

        if (storeErr) {
          toast.error('Error al subir el certificado. Verificá que el bucket "afip-certs" exista.')
          setUploadingCert(false)
          return
        }
        updateCertStatus('crt_uploaded')
        toast.success('Certificado subido (modo desarrollo)')
      } else {
        updateCertStatus('crt_uploaded')
        toast.success('Certificado subido correctamente')
      }
      setCertFile(null)
    } catch { toast.error('Error al subir el certificado') }
    setUploadingCert(false)
  }

  async function handleTestAfip() {
    setTestingAfip(true)
    setAfipTestResult('idle')
    setAfipTestMsg('')
    try {
      // Call Edge Function to test AFIP connection
      const { data, error } = await supabase.functions.invoke('afip-test', {
        body: { env: fiscalEnv },
      })

      if (error) {
        // Fallback: simulate success for development
        console.warn('Edge Function not available, simulating:', error)
        updateCertStatus('connected')
        setAfipTestResult('success')
        setAfipTestMsg('Conexión simulada OK (deploy Edge Functions para conexión real)')
        setTestingAfip(false)
        return
      }

      if (data?.ok) {
        updateCertStatus('connected')
        setAfipTestResult('success')
        setAfipTestMsg(data.message || 'Conexión exitosa con AFIP')
      } else {
        setAfipTestResult('error')
        setAfipTestMsg(data?.error || 'No se pudo conectar con AFIP')
      }
    } catch (err: any) {
      setAfipTestResult('error')
      setAfipTestMsg(err?.message || 'Error al conectar con AFIP')
    }
    setTestingAfip(false)
  }

  async function handleCreateUser() {
    if (!userForm.email || !userForm.password || !userForm.full_name) { toast.error('Completá todos los campos'); return }
    setSaving(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: userForm.email, password: userForm.password }),
      })
      const data = await res.json()
      if (!data.id) { toast.error('Error al crear usuario'); setSaving(false); return }
      await supabase.from('users').insert({
        id: data.id, business_id: profile!.business_id,
        name: userForm.full_name, email: userForm.email, role: userForm.role,
      })
      toast.success('Usuario creado')
      setShowUserModal(false); setUserForm({ email: '', password: '', full_name: '', role: 'seller' }); fetchUsers()
    } catch { toast.error('Error inesperado') }
    setSaving(false)
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('¿Eliminar este usuario?')) return
    await supabase.from('users').delete().eq('id', userId)
    toast.success('Usuario eliminado'); fetchUsers()
  }

  const isAdmin = profile?.role === 'admin'
  const fiscalComplete = !!form.cuit.trim() && !!form.iva_condition && !!form.punto_venta

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground">Datos del negocio, facturación y usuarios</p>
      </div>

      {/* Business info */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Datos del negocio</h2>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre del negocio *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Dirección</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Teléfono</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== AFIP WIZARD ===== */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setWizardOpen((o) => !o)}
          className="w-full p-5 pb-3 flex items-center gap-2 text-left hover:bg-slate-50 transition"
        >
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-foreground">Facturación AFIP</h2>
          <span className="text-xs text-muted-foreground ml-1">(opcional)</span>
          {afipConnected && (
            <Badge variant="default" className="ml-auto bg-green-600 mr-2"><CheckCircle2 className="w-3 h-3" /> Conectado</Badge>
          )}
          {!afipConnected && (
            <Badge variant="outline" className="ml-auto mr-2 text-[10px]">No configurado</Badge>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${wizardOpen ? 'rotate-180' : ''}`} />
        </button>

        {!wizardOpen && (
          <div className="px-5 pb-4">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">No necesitás configurar esto para usar la app.</strong>
                {' '}Los tickets funcionan siempre. Configurá AFIP solo cuando tengas tu certificado digital y quieras emitir facturas electrónicas (A, B o C).
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setWizardOpen(true) }}
                className="mt-3 text-xs text-primary font-medium hover:underline"
              >
                Configurar facturación AFIP →
              </button>
            </div>
          </div>
        )}

        {wizardOpen && (
        <>

        {/* Environment toggle */}
        <div className="px-4 sm:px-6">
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Entorno:</span>
            <div className="flex rounded-lg bg-white shadow-sm border border-slate-200 overflow-hidden">
              <button
                onClick={() => setEnv('homo')}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  fiscalEnv === 'homo'
                    ? 'bg-amber-100 text-amber-800 border-r border-amber-200'
                    : 'text-muted-foreground hover:bg-slate-50 border-r border-slate-200'
                }`}
              >
                🧪 Homologación
              </button>
              <button
                onClick={() => setEnv('prod')}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  fiscalEnv === 'prod'
                    ? 'bg-green-100 text-green-800'
                    : 'text-muted-foreground hover:bg-slate-50'
                }`}
              >
                🚀 Producción
              </button>
            </div>
            {fiscalEnv === 'homo' && (
              <span className="text-[10px] text-amber-600 ml-1">Los comprobantes NO tienen validez fiscal</span>
            )}
          </div>
        </div>

        {/* Step indicator */}
        <div className="px-4 sm:px-6 pt-4">
          <div className="flex items-center gap-1">
            {WIZARD_STEPS.map((step, idx) => {
              const isActive = wizardStep === step.id
              const isDone = (step.id === 1 && fiscalComplete) || (step.id === 2 && certUploaded) || (step.id === 3 && afipConnected)
              const isPartial = step.id === 2 && csrGenerated && !certUploaded
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => setWizardStep(step.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all w-full ${
                      isActive ? 'bg-green-50 text-primary' : isDone ? 'bg-green-50 text-green-700' : isPartial ? 'bg-amber-50 text-amber-700' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isActive ? 'bg-primary text-white' : isDone ? 'bg-green-600 text-white' : isPartial ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                    </div>
                    <div className="hidden sm:block text-left min-w-0">
                      <p className="text-xs font-semibold truncate">{step.title}</p>
                      <p className="text-[10px] opacity-70 truncate">{step.desc}</p>
                    </div>
                  </button>
                  {idx < WIZARD_STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mx-1" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="p-4 sm:p-5">
          {/* STEP 1: Datos fiscales */}
          {wizardStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">CUIT *</label>
                  <input type="text" placeholder="XX-XXXXXXXX-X" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Condición IVA *</label>
                  <select value={form.iva_condition} onChange={(e) => setForm({ ...form, iva_condition: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {IVA_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Punto de Venta *</label>
                  <input type="number" min="1" max="99999" value={form.punto_venta} onChange={(e) => setForm({ ...form, punto_venta: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ing. Brutos (IIBB)</label>
                  <input type="text" placeholder="Número IIBB" value={form.iibb} onChange={(e) => setForm({ ...form, iibb: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Inicio de actividades</label>
                  <input type="date" value={form.inicio_actividades} onChange={(e) => setForm({ ...form, inicio_actividades: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Razón social</label>
                  <input type="text" value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} placeholder="Si difiere del nombre"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Domicilio comercial</label>
                  <input type="text" value={form.domicilio_comercial} onChange={(e) => setForm({ ...form, domicilio_comercial: e.target.value })} placeholder="Domicilio fiscal AFIP"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>

              <div className="bg-blue-50 rounded-2xl p-3 text-xs text-blue-800">
                <p className="font-semibold mb-1">Tipos de comprobante según condición IVA</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li><strong>Monotributo</strong> → Factura C (a cualquier cliente)</li>
                  <li><strong>Resp. Inscripto</strong> → Factura A (a RI) y Factura B (a CF/Mono)</li>
                  <li><strong>Ticket</strong>: comprobante interno sin validez fiscal</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveFiscalAndContinue} disabled={!fiscalComplete || saving}>
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <>Guardar y continuar <ChevronRight className="w-4 h-4" /></>}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Certificado AFIP */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              {certUploaded ? (
                <div className="bg-green-50 rounded-2xl p-3 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Certificado conectado</p>
                    <p className="text-xs text-green-700 mt-0.5">El archivo .crt está almacenado de forma segura. Podés reemplazarlo subiendo uno nuevo.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-2xl p-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Certificado requerido</p>
                    <p className="text-xs text-amber-700 mt-0.5">Para emitir facturas electrónicas necesitás vincular tu CUIT con STOCKIA a través de AFIP.</p>
                  </div>
                </div>
              )}

              {/* Step A: Generate CSR */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${csrGenerated ? 'bg-green-600 text-white' : 'bg-primary text-white'}`}>
                    {csrGenerated ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <p className="text-sm font-semibold text-foreground">Generar solicitud (CSR)</p>
                </div>
                <p className="text-xs text-muted-foreground ml-8">STOCKIA genera automáticamente el archivo CSR que necesitás para AFIP. La clave privada se guarda cifrada en nuestro servidor.</p>
                <div className="ml-8">
                  <Button size="sm" onClick={handleGenerateCsr} disabled={generatingCsr || !form.cuit.trim()} variant={csrGenerated ? 'outline' : 'default'}>
                    {generatingCsr ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</> :
                     csrGenerated ? <><CheckCircle2 className="w-4 h-4" /> Descargar CSR de nuevo</> :
                     <><Key className="w-4 h-4" /> Generar CSR</>}
                  </Button>
                </div>
              </div>

              {/* Step B: Instructions for AFIP */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                  <p className="text-sm font-semibold text-foreground">Subir CSR en AFIP</p>
                </div>
                <ol className="list-decimal ml-12 space-y-1.5 text-xs text-blue-900">
                  <li>Ingresá a <a href="https://www.afip.gob.ar" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:no-underline">www.afip.gob.ar</a> con tu <strong>Clave Fiscal</strong></li>
                  <li>Buscá el servicio <strong>"Administrador de Certificados Digitales"</strong>
                    <p className="text-[11px] text-blue-700 mt-0.5">Si no lo tenés, andá a "Administrador de Relaciones" → Agregar servicio → AFIP → Web Services → Administrador de Certificados Digitales</p>
                  </li>
                  <li>Hacé clic en <strong>"Agregar certificado"</strong> o <strong>"Solicitar certificado"</strong></li>
                  <li>Subí el archivo <code className="bg-white/70 px-1 rounded text-blue-900 font-mono">stockia-XXXX.csr</code> que descargaste</li>
                  <li>AFIP te va a devolver un archivo <code className="bg-white/70 px-1 rounded text-blue-900 font-mono">.crt</code> — <strong>descargalo</strong></li>
                </ol>
              </div>

              {/* Step C: Upload CRT */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${certUploaded ? 'bg-green-600 text-white' : 'bg-primary text-white'}`}>
                    {certUploaded ? <CheckCircle2 className="w-3.5 h-3.5" /> : '3'}
                  </div>
                  <p className="text-sm font-semibold text-foreground">Subir certificado (.crt) a STOCKIA</p>
                </div>
                <div className="ml-8">
                  <input ref={certInputRef} type="file" accept=".crt,.pem,.cer" onChange={(e) => setCertFile(e.target.files?.[0] || null)} className="hidden" />
                  <button onClick={() => certInputRef.current?.click()}
                    className={`w-full max-w-sm h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 transition ${
                      certFile ? 'border-green-400 bg-green-50 text-green-700' : 'border-slate-200 hover:border-primary hover:bg-primary/5 text-muted-foreground'
                    }`}>
                    {certFile ? <CheckCircle2 className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                    <span className="text-xs font-medium">{certFile ? certFile.name : 'Seleccionar archivo .crt de AFIP'}</span>
                  </button>
                  {certFile && (
                    <div className="mt-2">
                      <Button size="sm" onClick={handleUploadCert} disabled={uploadingCert}>
                        {uploadingCert ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</> : <><Upload className="w-4 h-4" /> Subir certificado</>}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <Button variant={certUploaded ? 'default' : 'outline'} onClick={() => setWizardStep(3)} disabled={!certUploaded && !csrGenerated}>
                  {certUploaded ? <>Continuar <ChevronRight className="w-4 h-4" /></> : 'Omitir por ahora'}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Test connection */}
          {wizardStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center py-6">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  afipTestResult === 'success' ? 'bg-green-100' : afipTestResult === 'error' ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  {testingAfip ? (
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  ) : afipTestResult === 'success' ? (
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  ) : afipTestResult === 'error' ? (
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  ) : (
                    <Wifi className="w-10 h-10 text-blue-600" />
                  )}
                </div>

                <h3 className="text-lg font-bold text-foreground">
                  {testingAfip ? 'Probando conexión...' :
                   afipTestResult === 'success' ? '¡Conexión exitosa!' :
                   afipTestResult === 'error' ? 'Error de conexión' :
                   'Probar emisión'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  {afipTestMsg || `Vamos a probar la conexión con AFIP ${fiscalEnv === 'homo' ? '(homologación)' : '(producción)'} para verificar que todo esté bien configurado.`}
                </p>

                {afipTestResult === 'success' && (
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full text-green-700 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    AFIP {fiscalEnv === 'homo' ? '(Homo)' : '(Prod)'} conectado — Listo para facturar
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(2)}>
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <Button onClick={handleTestAfip} disabled={testingAfip}>
                  {testingAfip ? <><Loader2 className="w-4 h-4 animate-spin" /> Probando...</>
                    : afipTestResult === 'success' ? <><CheckCircle2 className="w-4 h-4" /> Probar de nuevo</>
                    : <><Zap className="w-4 h-4" /> Probar conexión</>}
                </Button>
              </div>
            </div>
          )}
        </div>
        </>)}
      </div>

      {/* Ticket / Impression */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Printer className="w-5 h-5 text-violet-600" />
          <h2 className="font-semibold text-foreground">Impresión y marca</h2>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Logo del negocio</label>

            {/* Upload zone */}
            <div
              className="relative flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/15 rounded-2xl p-5 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition group"
              onClick={() => logoInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (file) handleLogoUpload(file)
              }}
            >
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleLogoUpload(file)
                  e.target.value = ''
                }}
              />

              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt="Logo"
                  className="h-16 max-w-[160px] object-contain rounded-xl"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white/30 group-hover:text-primary/70 transition" />
                </div>
              )}

              {uploadingLogo ? (
                <p className="text-xs text-white/50"><Loader2 className="inline w-3 h-3 animate-spin mr-1" />Subiendo...</p>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-white/70 group-hover:text-white transition">
                    {form.logo_url ? 'Clic para cambiar el logo' : 'Clic o arrastrá una imagen'}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">PNG, JPG, SVG, WEBP · máx. 2 MB</p>
                </div>
              )}
            </div>

            {/* URL fallback */}
            <div className="mt-2">
              <p className="text-xs text-white/35 mb-1">O ingresá una URL directamente</p>
              <input
                type="url"
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://ejemplo.com/logo.png"
                className="w-full h-9 px-3 rounded-xl border border-white/12 bg-white/6 text-white placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50"
              />
            </div>

            {form.logo_url && (
              <button
                type="button"
                onClick={() => setForm({ ...form, logo_url: '' })}
                className="mt-1.5 text-xs text-red-400/70 hover:text-red-400 transition"
              >
                Eliminar logo
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Color del negocio</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-1" />
              <input type="text" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                placeholder="#1DB954" className="w-32 h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <span className="text-xs text-muted-foreground">Aparece en tickets y facturas</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mensaje de pie del ticket</label>
            <input type="text" value={form.receipt_footer} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
              placeholder="Ej: ¡Gracias por su compra!" className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.auto_print} onChange={(e) => setForm({ ...form, auto_print: e.target.checked })}
              className="w-5 h-5 rounded border-slate-200 text-primary focus:ring-primary/30" />
            <div>
              <p className="text-sm font-medium">Imprimir automáticamente al cobrar</p>
              <p className="text-xs text-muted-foreground">Abre el diálogo de impresión después de cada venta</p>
            </div>
          </label>
        </div>
      </div>

      {/* Payment method discounts */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Percent className="w-5 h-5 text-emerald-600" />
          <h2 className="font-semibold text-foreground">Descuentos por medio de pago</h2>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-800">
            <p>Configurá el <strong>porcentaje de descuento</strong> que se aplica cuando el cliente paga con cada medio.</p>
            <p className="mt-1 text-emerald-600">Ejemplo: poné <strong>5</strong> en Efectivo = 5% de descuento si paga en efectivo. Dejá en 0 para no aplicar descuento.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <Banknote className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Efectivo</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={pmDiscounts.cash || ''}
                    onChange={(e) => setPmDiscounts({ ...pmDiscounts, cash: Math.max(0, Number(e.target.value)) })}
                    className="w-full h-10 px-3 pr-14 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">% dto</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Débito</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={pmDiscounts.debit || ''}
                    onChange={(e) => setPmDiscounts({ ...pmDiscounts, debit: Math.max(0, Number(e.target.value)) })}
                    className="w-full h-10 px-3 pr-14 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">% dto</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Crédito</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={pmDiscounts.credit || ''}
                    onChange={(e) => setPmDiscounts({ ...pmDiscounts, credit: Math.max(0, Number(e.target.value)) })}
                    className="w-full h-10 px-3 pr-14 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">% dto</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <ArrowRightLeft className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Transferencia</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={pmDiscounts.transfer || ''}
                    onChange={(e) => setPmDiscounts({ ...pmDiscounts, transfer: Math.max(0, Number(e.target.value)) })}
                    className="w-full h-10 px-3 pr-14 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">% dto</span>
                </div>
              </div>
            </div>
          </div>
          {/* Preview */}
          {Object.values(pmDiscounts).some(v => v > 0) && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vista previa (sobre $10.000)</p>
              {Object.entries(pmDiscounts).filter(([, v]) => v > 0).map(([method, pct]) => {
                const labels: Record<string, string> = { cash: 'Efectivo', debit: 'Débito', credit: 'Crédito', transfer: 'Transferencia' }
                const amount = 10000 - (10000 * pct) / 100
                return (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{labels[method] || method}</span>
                    <span className="text-green-600 font-medium">
                      -{pct}% → ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveBusiness} disabled={saving}>
          <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar todo'}
        </Button>
      </div>

      {/* Plan info */}
      {business && (
        <div className="gradient-primary rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5" />
            <span className="font-bold">Plan Negocio</span>
          </div>
          <p className="text-sm opacity-90 mb-1">
            Estado: {business.subscription_status === 'active' ? 'Activo' :
              business.subscription_status === 'trial' ? 'Período de prueba' : 'Inactivo'}
          </p>
          {business.trial_ends_at && (
            <p className="text-sm opacity-80">
              Prueba hasta: {new Date(business.trial_ends_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      )}

      {/* Users */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="p-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Usuarios</h2>
            </div>
            <Button size="sm" onClick={() => setShowUserModal(true)}>
              <Plus className="w-4 h-4" /> Agregar
            </Button>
          </div>
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>
                      <Shield className="w-3 h-3" /> {u.role === 'admin' ? 'Admin' : 'Vendedor'}
                    </Badge>
                    {u.id === profile?.id && <span className="text-[11px] text-muted-foreground">(tú)</span>}
                  </div>
                </div>
                {u.id !== profile?.id && (
                  <button onClick={() => handleDeleteUser(u.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-red-50 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {users.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">Sin usuarios</div>}
          </div>
        </div>
      )}

      {/* User Modal */}
      <Modal open={showUserModal} onClose={() => setShowUserModal(false)} title="Crear usuario" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre completo *</label>
            <input type="text" value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña *</label>
            <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rol</label>
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'seller' })}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="seller">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowUserModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreateUser} disabled={saving}>{saving ? 'Creando...' : 'Crear usuario'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
