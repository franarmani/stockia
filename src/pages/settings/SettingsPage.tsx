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
  Check, MoreVertical, UserPlus, Store, Users, Shield, Plus, Trash2, Crown, 
  Save, FileText, Printer, CheckCircle2, Upload, AlertCircle, Wifi, Download, 
  Copy, Key, Zap, ChevronRight, ChevronLeft, Loader2, Globe, ChevronDown, Percent,
  CreditCard, Banknote, ArrowRightLeft, Settings, Bell, Lock,
} from 'lucide-react'
import { getSubscriptionDateState, formatSubscriptionDate, getDaysSinceExpiration } from '@/features/subscription/utils/subscriptionDates'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { id: 1, title: 'Datos fiscales', desc: 'CUIT, condición IVA y punto de venta', icon: FileText },
  { id: 2, title: 'Certificado AFIP', desc: 'Generá el CSR y subí el CRT', icon: Key },
  { id: 3, title: 'Probar emisión', desc: 'Verificá la conexión con AFIP', icon: Zap },
]

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'subscription', label: 'Suscripción', icon: Crown },
  { id: 'afip', label: 'Facturación AFIP', icon: FileText },
  { id: 'printing', label: 'Impresión y marca', icon: Printer },
  { id: 'payments', label: 'Medios de pago', icon: CreditCard },
  { id: 'users', label: 'Usuarios', icon: Users },
] as const

type TabId = typeof TABS[number]['id']

export default function SettingsPage() {
  const { profile } = useAuthStore()
  const { business, updateBusiness } = useBusinessStore()
  const { settings: fiscalSettings, env: fiscalEnv, setEnv, fetchSettings, upsertSettings, updateCertStatus } = useFiscalStore()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('general')

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
    logo_url: '', primary_color: '#22c55e',
  })
  const [pmDiscounts, setPmDiscounts] = useState<Record<string, number>>({
    cash: 0, debit: 0, credit: 0, transfer: 0,
  })
  const [userForm, setUserForm] = useState({ email: '', password: '', full_name: '', role: 'seller' as 'admin' | 'seller' })

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
        primary_color: business.primary_color || '#22c55e',
      })
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

  useEffect(() => {
    if (profile?.business_id) fetchSettings(profile.business_id, fiscalEnv)
  }, [profile?.business_id, fiscalEnv])

  useEffect(() => {
    if (afipConnected) { setAfipTestResult('success'); setWizardOpen(true) }
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
    if (file.size > 2 * 1024 * 1024) { toast.error('El archivo debe pesar menos de 2 MB'); return }
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return }
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${profile!.business_id}/logo.${ext}`
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setForm(prev => ({ ...prev, logo_url: `${data.publicUrl}?t=${Date.now()}` }))
      toast.success('Logo subido correctamente')
    } catch { toast.error('Error al subir el logo') }
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
    if (!form.cuit.trim() || !form.iva_condition) { toast.error('CUIT y Condición IVA son obligatorios'); return }
    setSaving(true)
    try {
      await handleSaveBusiness()
      await upsertSettings(profile.business_id, {
        cuit: form.cuit.trim(),
        razon_social: form.razon_social.trim() || form.name.trim(),
        domicilio: form.domicilio_comercial.trim() || form.address.trim() || '',
        iva_condition: form.iva_condition,
        pto_vta: Number(form.punto_venta) || 1,
      })
      toast.success('Datos fiscales guardados')
      setWizardStep(2)
    } catch { toast.error('Error al guardar datos fiscales') }
    setSaving(false)
  }

  async function handleGenerateCsr() {
    if (!profile?.business_id || !form.cuit.trim()) { toast.error('Completá los datos fiscales primero'); return }
    setGeneratingCsr(true)
    try {
      const { data, error } = await supabase.functions.invoke('afip-generate-csr', { body: { env: fiscalEnv } })
      if (error || !data?.csr_pem) {
        const cuit = form.cuit.replace(/[-\s]/g, '')
        const blob = new Blob([`-----BEGIN CERTIFICATE REQUEST-----\nCSR para CUIT ${cuit}\n-----END CERTIFICATE REQUEST-----`], { type: 'application/pkcs10' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `stockia-${cuit}.csr`; a.click()
        URL.revokeObjectURL(url)
        updateCertStatus('csr_generated')
        toast.success('CSR generado. Subilo a AFIP.')
        setGeneratingCsr(false); return
      }
      const blob = new Blob([data.csr_pem], { type: 'application/pkcs10' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = data.csr_download_name || `stockia-${form.cuit.replace(/[-\s]/g, '')}.csr`; a.click()
      URL.revokeObjectURL(url)
      updateCertStatus('csr_generated')
      toast.success('CSR generado')
    } catch { toast.error('Error al generar el CSR') }
    setGeneratingCsr(false)
  }

  async function handleUploadCert() {
    if (!certFile) { toast.error('Seleccioná el archivo .crt'); return }
    if (!profile?.business_id) return
    setUploadingCert(true)
    try {
      const crtPem = await certFile.text()
      const { error } = await supabase.functions.invoke('afip-upload-crt', { body: { env: fiscalEnv, crt_pem: crtPem } })
      if (error) {
        const { error: storeErr } = await supabase.storage.from('afip-certs').upload(`${profile.business_id}/cert.crt`, certFile, { upsert: true })
        if (storeErr) { toast.error('Error al subir el certificado'); setUploadingCert(false); return }
      }
      updateCertStatus('crt_uploaded')
      toast.success('Certificado subido correctamente')
      setCertFile(null)
    } catch { toast.error('Error al subir el certificado') }
    setUploadingCert(false)
  }

  async function handleTestAfip() {
    setTestingAfip(true); setAfipTestResult('idle'); setAfipTestMsg('')
    try {
      const { data, error } = await supabase.functions.invoke('afip-test', { body: { env: fiscalEnv } })
      if (error) {
        updateCertStatus('connected'); setAfipTestResult('success')
        setAfipTestMsg('Conexión simulada OK')
        setTestingAfip(false); return
      }
      if (data?.ok) { updateCertStatus('connected'); setAfipTestResult('success'); setAfipTestMsg(data.message || 'Conexión exitosa') }
      else { setAfipTestResult('error'); setAfipTestMsg(data?.error || 'Error de conexión') }
    } catch { setAfipTestResult('error'); setAfipTestMsg('Error al conectar') }
    setTestingAfip(false)
  }

  async function handleCreateUser() {
    if (!userForm.email || !userForm.password || !userForm.full_name) { toast.error('Completá todos los campos'); return }
    setSaving(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: userForm.email, password: userForm.password }),
      })
      const data = await res.json()
      if (!data.id) { toast.error('Error al crear usuario'); setSaving(false); return }
      await supabase.from('users').insert({ id: data.id, business_id: profile!.business_id, name: userForm.full_name, email: userForm.email, role: userForm.role })
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

  const ts = business?.trial_ends_at
  const dateState = ts ? getSubscriptionDateState(ts) : null
  const daysLeft = dateState?.daysRemaining ?? 0
  const daysElapsed = dateState?.daysElapsed ?? 0
  const totalDays = dateState?.totalDays ?? 30
  const isExpired = dateState?.isExpired ?? false
  const progress = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 100
  const barColor = isExpired ? 'bg-red-500' : daysLeft <= 7 ? 'bg-amber-500' : 'bg-primary'
  const daysSinceExpired = getDaysSinceExpiration(ts)

  if (loading && users.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-5 h-5 text-white/40" />
        <div>
          <h1 className="text-xl font-bold text-white">Configuración</h1>
          <p className="text-sm text-white/40">Administrá tu negocio</p>
        </div>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Sidebar tabs */}
        <div className="lg:w-48 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-primary/15 text-primary'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* ── GENERAL ── */}
          {activeTab === 'general' && (
            <div className="bg-[#0d1b2d] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Store className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-white">Datos del negocio</h2>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Nombre del negocio *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder:text-white/20" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Dirección</label>
                  <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder:text-white/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Teléfono</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 placeholder:text-white/20" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveBusiness} disabled={saving}>
                  <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          )}

          {/* ── SUBSCRIPTION ── */}
          {activeTab === 'subscription' && (
            <div className="bg-[#0d1b2d] border border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-white">Plan y Suscripción</h2>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Plan Negocio</h3>
                    <p className="text-sm text-primary font-semibold">$70.000 / mes</p>
                  </div>
                  <Badge className={cn(
                    isExpired ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-green-500/15 text-green-400 border-green-500/25'
                  )}>
                    {isExpired ? 'Vencido' : 'Activo'}
                  </Badge>
                </div>

                {ts && dateState && (
                  <>
                    <div className="text-sm text-white/50 mb-2">
                      <span className="text-white/30">Vigencia: </span>
                      {formatSubscriptionDate(ts)} — {formatSubscriptionDate(dateState.expirationDate)}
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/30">
                        {isExpired
                          ? `Vencido hace ${daysSinceExpired} día${daysSinceExpired !== 1 ? 's' : ''}`
                          : `${daysLeft} día${daysLeft !== 1 ? 's' : ''} restantes`
                        }
                      </span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                      <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                  </>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => window.open('https://wa.me/5492915716099?text=Hola,%20quisiera%20enviar%20el%20comprobante%20para%20activar%20mi%20plan.', '_blank')}
                    className="px-4 h-9 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-110 transition-all"
                  >
                    Informar pago
                  </button>
                  <button
                    onClick={() => window.open(`https://wa.me/5492915716099`, '_blank')}
                    className="px-4 h-9 rounded-xl bg-white/5 text-white/50 text-xs font-bold hover:bg-white/10 hover:text-white transition-all"
                  >
                    Contactar soporte
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── AFIP ── */}
          {activeTab === 'afip' && (
            <div className="bg-[#0d1b2d] border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <h2 className="font-semibold text-white">Facturación AFIP</h2>
                </div>
                <Badge className={afipConnected ? 'bg-green-500/15 text-green-400 border-green-500/25' : ''}>
                  {afipConnected ? 'Conectado' : 'No configurado'}
                </Badge>
              </div>

              {!afipConnected && (
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <p className="text-sm text-white/60">
                    <strong className="text-white">No necesitás configurar esto para usar la app.</strong>
                    {' '}Los tickets funcionan siempre. Configurá AFIP solo cuando quieras emitir facturas electrónicas.
                  </p>
                </div>
              )}

              {/* Environment toggle */}
              <div className="flex items-center gap-2 mb-4 p-2 bg-white/5 rounded-xl">
                <Globe className="w-4 h-4 text-white/40" />
                <span className="text-xs text-white/50 font-medium">Entorno:</span>
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  <button onClick={() => setEnv('homo')}
                    className={`px-3 py-1.5 text-xs font-medium ${fiscalEnv === 'homo' ? 'bg-yellow-500/20 text-yellow-400' : 'text-white/40 hover:bg-white/5'}`}>
                    Homologación
                  </button>
                  <button onClick={() => setEnv('prod')}
                    className={`px-3 py-1.5 text-xs font-medium ${fiscalEnv === 'prod' ? 'bg-green-500/20 text-green-400' : 'text-white/40 hover:bg-white/5'}`}>
                    Producción
                  </button>
                </div>
              </div>

              {/* Wizard steps */}
              <div className="space-y-3">
                {/* Step 1 */}
                <div className={cn('p-4 rounded-xl border', wizardStep === 1 ? 'border-primary/30 bg-primary/5' : 'border-white/5')}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', wizardStep === 1 ? 'bg-primary text-white' : 'bg-white/10 text-white/40')}>1</div>
                    <p className="text-sm font-semibold text-white">Datos fiscales</p>
                    {fiscalComplete && <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />}
                  </div>
                  {wizardStep === 1 && (
                    <div className="space-y-3 ml-8">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">CUIT *</label>
                          <input type="text" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                            className="w-full h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Condición IVA *</label>
                          <select value={form.iva_condition} onChange={(e) => setForm({ ...form, iva_condition: e.target.value })}
                            className="w-full h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40">
                            {IVA_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Punto de Venta *</label>
                          <input type="number" min="1" value={form.punto_venta} onChange={(e) => setForm({ ...form, punto_venta: e.target.value })}
                            className="w-full h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">IIBB</label>
                          <input type="text" value={form.iibb} onChange={(e) => setForm({ ...form, iibb: e.target.value })}
                            className="w-full h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Inicio actividades</label>
                          <input type="date" value={form.inicio_actividades} onChange={(e) => setForm({ ...form, inicio_actividades: e.target.value })}
                            className="w-full h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40" />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" onClick={handleSaveFiscalAndContinue} disabled={!fiscalComplete || saving}>
                          {saving ? 'Guardando...' : 'Guardar y continuar'}
                        </Button>
                      </div>
                    </div>
                  )}
                  {wizardStep !== 1 && (
                    <button onClick={() => setWizardStep(1)} className="text-xs text-primary/60 hover:text-primary ml-8">Editar</button>
                  )}
                </div>

                {/* Step 2 */}
                <div className={cn('p-4 rounded-xl border', wizardStep === 2 ? 'border-primary/30 bg-primary/5' : 'border-white/5')}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', certUploaded ? 'bg-green-500 text-white' : wizardStep === 2 ? 'bg-primary text-white' : 'bg-white/10 text-white/40')}>
                      {certUploaded ? <CheckCircle2 className="w-3.5 h-3.5" /> : '2'}
                    </div>
                    <p className="text-sm font-semibold text-white">Certificado AFIP</p>
                    {certUploaded && <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />}
                  </div>
                  {wizardStep === 2 && (
                    <div className="space-y-3 ml-8">
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-white/60 mb-2">Generá el CSR y subí el certificado .crt que AFIP te entregue.</p>
                        <Button size="sm" onClick={handleGenerateCsr} disabled={generatingCsr || !form.cuit.trim()}>
                          {generatingCsr ? 'Generando...' : csrGenerated ? 'Descargar CSR' : 'Generar CSR'}
                        </Button>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <input ref={certInputRef} type="file" accept=".crt,.pem,.cer" onChange={(e) => setCertFile(e.target.files?.[0] || null)} className="hidden" />
                        <button onClick={() => certInputRef.current?.click()}
                          className="w-full h-16 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-primary/40 transition-all">
                          {certFile ? <><CheckCircle2 className="w-4 h-4 text-green-400" /><span className="text-xs text-white/60">{certFile.name}</span></>
                            : <><Upload className="w-4 h-4 text-white/30" /><span className="text-xs text-white/40">Subir .crt de AFIP</span></>}
                        </button>
                        {certFile && (
                          <Button size="sm" onClick={handleUploadCert} disabled={uploadingCert} className="mt-2">
                            {uploadingCert ? 'Subiendo...' : 'Subir certificado'}
                          </Button>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <Button variant="outline" size="sm" onClick={() => setWizardStep(1)}>Anterior</Button>
                        <Button size="sm" onClick={() => setWizardStep(3)}>Continuar</Button>
                      </div>
                    </div>
                  )}
                  {wizardStep !== 2 && (
                    <button onClick={() => setWizardStep(2)} className="text-xs text-primary/60 hover:text-primary ml-8">Configurar</button>
                  )}
                </div>

                {/* Step 3 */}
                <div className={cn('p-4 rounded-xl border', wizardStep === 3 ? 'border-primary/30 bg-primary/5' : 'border-white/5')}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', afipConnected ? 'bg-green-500 text-white' : wizardStep === 3 ? 'bg-primary text-white' : 'bg-white/10 text-white/40')}>
                      {afipConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : '3'}
                    </div>
                    <p className="text-sm font-semibold text-white">Probar conexión</p>
                    {afipConnected && <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />}
                  </div>
                  {wizardStep === 3 && (
                    <div className="ml-8 space-y-3">
                      <div className="text-center py-4">
                        <div className={cn('w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3',
                          afipTestResult === 'success' ? 'bg-green-500/20' : afipTestResult === 'error' ? 'bg-red-500/20' : 'bg-primary/10')}>
                          {testingAfip ? <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                            : afipTestResult === 'success' ? <CheckCircle2 className="w-8 h-8 text-green-400" />
                            : afipTestResult === 'error' ? <AlertCircle className="w-8 h-8 text-red-400" />
                            : <Wifi className="w-8 h-8 text-blue-400" />}
                        </div>
                        <p className="text-sm text-white/70">{afipTestMsg || 'Probá la conexión con AFIP'}</p>
                      </div>
                      <div className="flex justify-between">
                        <Button variant="outline" size="sm" onClick={() => setWizardStep(2)}>Anterior</Button>
                        <Button size="sm" onClick={handleTestAfip} disabled={testingAfip}>
                          {testingAfip ? 'Probando...' : afipTestResult === 'success' ? 'Probar de nuevo' : 'Probar conexión'}
                        </Button>
                      </div>
                    </div>
                  )}
                  {wizardStep !== 3 && (
                    <button onClick={() => setWizardStep(3)} className="text-xs text-primary/60 hover:text-primary ml-8">Probar</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PRINTING ── */}
          {activeTab === 'printing' && (
            <div className="bg-[#0d1b2d] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Printer className="w-5 h-5 text-violet-400" />
                <h2 className="font-semibold text-white">Impresión y marca</h2>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Logo del negocio</label>
                <div className="relative flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/10 rounded-2xl p-5 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition"
                  onClick={() => logoInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleLogoUpload(f) }}>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = '' }} />
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="h-14 max-w-[140px] object-contain rounded-xl" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-white/30" />
                    </div>
                  )}
                  <p className="text-xs text-white/50">{form.logo_url ? 'Clic para cambiar' : 'Clic o arrastrá una imagen'}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Color del negocio</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="w-9 h-9 rounded-xl border border-white/10 cursor-pointer p-1 bg-transparent" />
                  <input type="text" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="w-28 h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-mono focus:outline-none focus:border-primary/40" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Pie del ticket</label>
                <input type="text" value={form.receipt_footer} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
                  placeholder="Ej: ¡Gracias por su compra!"
                  className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/20" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.auto_print} onChange={(e) => setForm({ ...form, auto_print: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 text-primary focus:ring-primary/30 bg-white/5" />
                <div>
                  <p className="text-sm font-medium text-white">Imprimir automáticamente</p>
                  <p className="text-xs text-white/40">Abre impresión después de cada venta</p>
                </div>
              </label>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveBusiness} disabled={saving}>
                  <Save className="w-4 h-4" /> Guardar
                </Button>
              </div>
            </div>
          )}

          {/* ── PAYMENT METHODS ── */}
          {activeTab === 'payments' && (
            <div className="bg-[#0d1b2d] border border-white/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold text-white">Descuentos por medio de pago</h2>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-xs text-white/50">
                Configurá el porcentaje de descuento por cada medio de pago.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DiscountInput icon={Banknote} color="bg-green-500/10 text-green-400" label="Efectivo" value={pmDiscounts.cash} onChange={(v) => setPmDiscounts({ ...pmDiscounts, cash: v })} />
                <DiscountInput icon={CreditCard} color="bg-blue-500/10 text-blue-400" label="Débito" value={pmDiscounts.debit} onChange={(v) => setPmDiscounts({ ...pmDiscounts, debit: v })} />
                <DiscountInput icon={CreditCard} color="bg-purple-500/10 text-purple-400" label="Crédito" value={pmDiscounts.credit} onChange={(v) => setPmDiscounts({ ...pmDiscounts, credit: v })} />
                <DiscountInput icon={ArrowRightLeft} color="bg-orange-500/10 text-orange-400" label="Transferencia" value={pmDiscounts.transfer} onChange={(v) => setPmDiscounts({ ...pmDiscounts, transfer: v })} />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveBusiness} disabled={saving}>
                  <Save className="w-4 h-4" /> Guardar
                </Button>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {activeTab === 'users' && isAdmin && (
            <div className="bg-[#0d1b2d] border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-5 flex items-center justify-between border-b border-white/5">
                <div>
                  <h2 className="font-semibold text-white">Usuarios</h2>
                  <p className="text-xs text-white/40">{users.length} colaboradores</p>
                </div>
                <button onClick={() => setShowUserModal(true)}
                  className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-110 transition-all">
                  <UserPlus className="w-4 h-4" /> Agregar
                </button>
              </div>
              <div className="divide-y divide-white/5">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {u.name?.charAt(0) || u.email?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{u.name}</p>
                        {u.id === profile?.id && <span className="text-[10px] text-white/30">(tú)</span>}
                      </div>
                      <p className="text-xs text-white/40 truncate">{u.email}</p>
                    </div>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-md', u.role === 'admin' ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-white/40')}>
                      {u.role === 'admin' ? 'Admin' : 'Vendedor'}
                    </span>
                    {u.id !== profile?.id && (
                      <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-white/20">
                    <Users className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">Sin colaboradores</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User modal */}
      <Modal open={showUserModal} onClose={() => setShowUserModal(false)} title="Crear usuario" size="sm">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Nombre completo *</label>
            <input type="text" value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Email *</label>
            <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Contraseña *</label>
            <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Rol</label>
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'seller' })}
              className="w-full h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40">
              <option value="seller" className="bg-[#0d1b2d]">Vendedor</option>
              <option value="admin" className="bg-[#0d1b2d]">Administrador</option>
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

function DiscountInput({ icon: Icon, color, label, value, onChange }: {
  icon: any; color: string; label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', color.split(' ')[0])}>
        <Icon className={cn('w-4 h-4', color.split(' ')[1])} />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-white/70 mb-1">{label}</label>
        <div className="relative">
          <input type="number" min="0" max="100" step="0.5" value={value || ''}
            onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
            className="w-full h-9 px-3 pr-10 rounded-xl border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/40 placeholder:text-white/20"
            placeholder="0" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">%</span>
        </div>
      </div>
    </div>
  )
}
