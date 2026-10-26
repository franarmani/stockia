import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CreditCard,
  FilePlus2,
  Plus,
  Receipt,
  Search,
  Settings2,
  Truck,
  AlertTriangle,
  ChevronRight,
  Trash2,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { syncEngine } from "@/sync/syncEngine";
import { withSyncNote } from "@/sync/connectivity";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useAuthStore } from "@/stores/authStore";
import { cn, formatCurrency } from "@/lib/utils";
import { formatCuit, isValidCuit } from "@/features/purchases/cuit";
import { multiplyMoney } from "@/features/purchases/money";
import {
  createPurchase,
  getSupplierLedger,
  initializePurchases,
  listPurchaseCatalogs,
  listPurchaseProducts,
  listPurchases,
  lookupSupplierInArca,
  listSuppliers,
  listVatSummary,
  recordSupplierPayment,
  saveConcept,
  saveSupplier,
  setSupplierActive,
} from "@/features/purchases/purchasesService";
import type {
  PaymentMethod,
  PurchaseConcept,
  PurchaseDocument,
  PurchaseDraftItem,
  Supplier,
  SupplierLedgerMovement,
  TaxType,
} from "@/features/purchases/types";

type Section =
  | "dashboard"
  | "documents"
  | "suppliers"
  | "payments"
  | "vat"
  | "concepts";

const SECTIONS: Array<{ id: Section; label: string; icon: typeof BarChart3 }> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "documents", label: "Comprobantes", icon: Receipt },
  { id: "suppliers", label: "Proveedores", icon: Truck },
  { id: "payments", label: "Pagos", icon: CreditCard },
  { id: "vat", label: "IVA Compras", icon: BookOpen },
  { id: "concepts", label: "Conceptos", icon: Settings2 },
];

const emptySupplier = {
  legal_name: "",
  trade_name: "",
  cuit: "",
  vat_condition: "",
  address: "",
  city: "",
  province: "",
  postal_code: "",
  phone: "",
  email: "",
  notes: "",
  active: true,
};

const emptyItem = (): PurchaseDraftItem => ({
  description: "",
  quantity: "1",
  unit_cost: "",
  vat_rate: "21",
});

export default function PurchasesPage() {
  const { profile } = useAuthStore();
  const businessId = profile?.business_id;
  const [section, setSection] = useState<Section>("dashboard");
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseDocument[]>([]);
  const [concepts, setConcepts] = useState<PurchaseConcept[]>([]);
  const [taxes, setTaxes] = useState<TaxType[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOrder, setSupplierOrder] = useState("legal_name");
  const [supplierModal, setSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState<any>(emptySupplier);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<SupplierLedgerMovement[]>([]);
  const [vatRows, setVatRows] = useState<any[]>([]);

  async function reload() {
    if (!businessId) return;
    setLoading(true);
    try {
      await initializePurchases(businessId);
      const [supplierRows, purchaseRows, catalogs, productRows] =
        await Promise.all([
          listSuppliers(businessId, supplierSearch, supplierOrder),
          listPurchases(businessId),
          listPurchaseCatalogs(businessId),
          listPurchaseProducts(businessId),
        ]);
      setSuppliers(supplierRows);
      setPurchases(purchaseRows);
      setConcepts(catalogs.concepts);
      setTaxes(catalogs.taxes);
      setMethods(catalogs.methods);
      setProducts(productRows);
    } catch (error: any) {
      toast.error(error.message || "No se pudo cargar Compras");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // Al sincronizar lo cargado sin conexión, recargar con los datos del servidor.
    return syncEngine.onSynced(() => { reload(); });
  }, [businessId]);

  useEffect(() => {
    if (!businessId || section !== "suppliers") return;
    const timer = setTimeout(
      () =>
        listSuppliers(businessId, supplierSearch, supplierOrder)
          .then(setSuppliers)
          .catch(() => {}),
      250,
    );
    return () => clearTimeout(timer);
  }, [businessId, supplierSearch, supplierOrder, section]);

  async function openLedger(supplier: Supplier) {
    if (!businessId) return;
    try {
      setLedger(await getSupplierLedger(businessId, supplier.id));
      setLedgerSupplier(supplier);
    } catch (error: any) {
      toast.error(error.message || "No se pudo cargar la cuenta corriente");
    }
  }

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthPurchases = purchases.filter(
    (p) => p.document_date.startsWith(monthKey) && p.status === "confirmed",
  );
  const metrics = {
    month: monthPurchases.reduce((sum, p) => sum + Number(p.total), 0),
    vat: monthPurchases.reduce(
      (sum, p: any) => sum + Number(p.vat_total || 0),
      0,
    ),
    debt: purchases.reduce((sum, p) => sum + Number(p.balance_due || 0), 0),
    pending: purchases.filter((p) => Number(p.balance_due) > 0).length,
    due: purchases.filter(
      (p) =>
        p.due_date &&
        Number(p.balance_due) > 0 &&
        new Date(p.due_date) <= new Date(Date.now() + 7 * 86400000),
    ).length,
  };

  if (loading)
    return (
      <div className="h-80 grid place-items-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#947FF8] border-t-transparent animate-spin" />
      </div>
    );

  return (
    <div className="animate-fade-in space-y-6 max-w-7xl mx-auto w-full pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0E1629] border border-white/[0.08] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-32 bg-gradient-to-bl from-[#3E73F5]/10 via-[#947FF8]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-[11px] font-bold text-[#947FF8] tracking-widest uppercase">
              Módulo de Compras
            </span>
          </div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)] text-[#FCFCFD]">
            Compras & Proveedores
          </h1>
          <p className="text-xs text-[#9CA6BA] mt-1.5">
            Gestión integral de gastos, facturas de compras, pagos y control de IVA
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            variant="secondary"
            onClick={() => setSupplierModal(true)}
            className="h-10 px-4 rounded-xl text-xs font-bold border border-white/[0.08] hover:bg-white/[0.08] transition-all"
          >
            <Building2 className="w-4 h-4 mr-2 text-[#9CA6BA]" /> Nuevo Proveedor
          </Button>
          <Button
            onClick={() => setPurchaseModal(true)}
            className="h-10 px-4 rounded-xl text-xs font-bold gradient-cajago-btn shadow-lg shadow-[#3E73F5]/25 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            <FilePlus2 className="w-4 h-4 mr-2" /> Nueva Compra
          </Button>
        </div>
      </div>

      {/* Segmented Section Tabs */}
      <div className="bg-[#0E1629] border border-white/[0.08] p-1.5 rounded-2xl flex flex-wrap gap-1.5 shadow-lg">
        {SECTIONS.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-[#3E73F5]/20 via-[#947FF8]/20 to-[#DE9BD3]/20 border border-[#947FF8]/40 text-[#FCFCFD] shadow-sm"
                  : "text-[#9CA6BA] hover:text-[#FCFCFD] hover:bg-white/[0.04] border border-transparent"
              )}
            >
              <item.icon className={cn("w-4 h-4", active ? "text-[#947FF8]" : "text-[#9CA6BA]")} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Tab Body */}
      {section === "dashboard" && (
        <Dashboard
          metrics={metrics}
          purchases={purchases}
          suppliers={suppliers}
          onDocuments={() => setSection("documents")}
        />
      )}
      {section === "documents" && (
        <Documents purchases={purchases} onNew={() => setPurchaseModal(true)} />
      )}
      {section === "suppliers" && (
        <Suppliers
          suppliers={suppliers}
          search={supplierSearch}
          order={supplierOrder}
          onSearch={setSupplierSearch}
          onOrder={setSupplierOrder}
          onEdit={(s: Supplier) => {
            setSupplierForm(s);
            setSupplierModal(true);
          }}
          onLedger={openLedger}
          onToggle={async (s: Supplier) => {
            if (!businessId) return;
            await setSupplierActive(businessId, s.id, !s.active);
            toast.success(withSyncNote(s.active ? "Proveedor desactivado" : "Proveedor activado"));
            reload();
          }}
        />
      )}
      {section === "payments" && (
        <Payments purchases={purchases} onNew={() => setPaymentModal(true)} />
      )}
      {section === "vat" && (
        <VatReport
          rows={vatRows}
          onLoad={async (from: string, to: string) => {
            if (!businessId) return;
            try {
              setVatRows(await listVatSummary(businessId, from, to));
            } catch (error: any) {
              toast.error(error.message || "No se pudo cargar el resumen de IVA");
            }
          }}
        />
      )}
      {section === "concepts" && (
        <Concepts
          concepts={concepts}
          onSave={async (name: string) => {
            if (!businessId) return;
            await saveConcept(businessId, { name });
            toast.success(withSyncNote("Concepto creado"));
            reload();
          }}
        />
      )}

      {/* Modals */}
      <SupplierForm
        open={supplierModal}
        value={supplierForm}
        onClose={() => {
          setSupplierModal(false);
          setSupplierForm(emptySupplier);
        }}
        onSave={async (value: any) => {
          if (!businessId) return;
          if (!isValidCuit(value.cuit))
            throw new Error("El CUIT no es válido.");
          await saveSupplier(businessId, value);
          toast.success(
            withSyncNote(value.id ? "Proveedor actualizado" : "Proveedor creado"),
          );
          setSupplierModal(false);
          setSupplierForm(emptySupplier);
          reload();
        }}
      />
      <PurchaseForm
        open={purchaseModal}
        suppliers={suppliers.filter((s) => s.active)}
        concepts={concepts.filter((c) => c.active)}
        taxes={taxes.filter((t) => t.active)}
        methods={methods}
        products={products}
        onClose={() => setPurchaseModal(false)}
        onSave={async (data: any) => {
          if (!businessId) return;
          const purchaseId = await createPurchase({ ...data, businessId });
          toast.success(
            purchaseId
              ? "Comprobante registrado con cuenta corriente y asiento contable"
              : "Comprobante guardado sin conexión · se registra con su asiento al volver la conexión",
          );
          setPurchaseModal(false);
          reload();
        }}
      />
      <PaymentForm
        open={paymentModal}
        suppliers={suppliers.filter((s) => s.active)}
        purchases={purchases}
        methods={methods}
        onClose={() => setPaymentModal(false)}
        onSave={async (data: any) => {
          if (!businessId) return;
          const paymentId = await recordSupplierPayment({ ...data, businessId });
          toast.success(
            paymentId
              ? "Pago registrado con éxito"
              : "Pago guardado sin conexión · se registra al volver la conexión",
          );
          setPaymentModal(false);
          reload();
        }}
      />
      <LedgerModal
        supplier={ledgerSupplier}
        movements={ledger}
        onClose={() => setLedgerSupplier(null)}
      />
    </div>
  );
}

function Dashboard({ metrics, purchases, suppliers, onDocuments }: any) {
  const cards = [
    {
      label: "Compras del mes",
      value: metrics.month,
      isMoney: true,
      icon: Truck,
      color: "text-[#3E73F5]",
      bg: "bg-[#3E73F5]/15 border-[#3E73F5]/25",
    },
    {
      label: "IVA crédito fiscal",
      value: metrics.vat,
      isMoney: true,
      icon: Receipt,
      color: "text-[#947FF8]",
      bg: "bg-[#947FF8]/15 border-[#947FF8]/25",
    },
    {
      label: "Deuda proveedores",
      value: metrics.debt,
      isMoney: true,
      icon: CreditCard,
      color: "text-rose-400",
      bg: "bg-rose-500/15 border-rose-500/25",
    },
    {
      label: "Facturas pendientes",
      value: metrics.pending,
      isMoney: false,
      icon: CalendarClock,
      color: "text-amber-400",
      bg: "bg-amber-500/15 border-amber-500/25",
    },
    {
      label: "Próximos vencimientos",
      value: metrics.due,
      isMoney: false,
      icon: AlertTriangle,
      color: "text-[#DE9BD3]",
      bg: "bg-[#DE9BD3]/15 border-[#DE9BD3]/25",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-4.5 shadow-lg relative overflow-hidden transition-all duration-200 hover:border-white/20"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-[#9CA6BA] truncate">{c.label}</p>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border shrink-0", c.bg)}>
                <c.icon className={cn("w-4 h-4", c.color)} />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#FCFCFD] tracking-tight font-mono tabular-nums truncate">
              {c.isMoney ? formatCurrency(c.value) : c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Latest Documents Preview */}
      <div className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-bold text-[#FCFCFD]">Últimos Comprobantes de Compra</h2>
            <p className="text-xs text-[#9CA6BA] mt-0.5">Operaciones registradas recientemente en tu negocio</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDocuments}
            className="text-xs font-semibold text-[#947FF8] hover:text-[#FCFCFD] hover:bg-white/[0.05]"
          >
            Ver todos <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
        <Documents purchases={purchases.slice(0, 5)} compact />
      </div>

      <div className="flex items-center gap-2 text-xs text-[#9CA6BA]/70 px-1">
        <CheckCircle2 className="w-4 h-4 text-emerald-400/80" />
        <span>{suppliers.length} proveedores dados de alta en el sistema.</span>
      </div>
    </div>
  );
}

function Documents({
  purchases,
  onNew,
  compact = false,
}: {
  purchases: PurchaseDocument[];
  onNew?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "space-y-4"}>
      {!compact && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-[#9CA6BA]">
            {purchases.length} comprobante{purchases.length !== 1 ? "s" : ""} registrado{purchases.length !== 1 ? "s" : ""}
          </p>
          {onNew && (
            <Button
              onClick={onNew}
              size="sm"
              className="gradient-cajago-btn font-bold text-xs shadow-md"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Nuevo comprobante
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1629] shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.03] border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-wider text-[#9CA6BA]">
            <tr>
              <th className="px-4 py-3.5">Fecha</th>
              <th className="px-4 py-3.5">Proveedor</th>
              <th className="px-4 py-3.5">Comprobante</th>
              <th className="px-4 py-3.5 text-right">Total</th>
              <th className="px-4 py-3.5 text-right">Saldo</th>
              <th className="px-4 py-3.5 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3.5 whitespace-nowrap text-[#9CA6BA] font-mono">
                  {new Date(`${p.document_date}T12:00:00`).toLocaleDateString("es-AR")}
                </td>
                <td className="px-4 py-3.5 font-semibold text-[#FCFCFD]">
                  {p.supplier?.legal_name || p.supplier?.name}
                </td>
                <td className="px-4 py-3.5 font-mono text-[#9CA6BA]">
                  <span className="font-semibold text-[#FCFCFD]">
                    {p.document_type.replace("_", " ").toUpperCase()} {p.letter || ""}
                  </span>{" "}
                  {p.point_of_sale ? String(p.point_of_sale).padStart(4, "0") : ""}-{p.document_number ? String(p.document_number).padStart(8, "0") : ""}
                  {!p.is_fiscal && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                      NO FISCAL
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right font-bold text-[#FCFCFD] font-mono tabular-nums">
                  {formatCurrency(Number(p.total))}
                </td>
                <td className="px-4 py-3.5 text-right font-bold text-amber-400 font-mono tabular-nums">
                  {formatCurrency(Number(p.balance_due))}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span
                    className={cn(
                      "inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      p.status === "confirmed"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                        : p.status === "pending"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/25"
                    )}
                  >
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[#9CA6BA]/60 text-xs">
                  Sin comprobantes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Suppliers({
  suppliers,
  search,
  order,
  onSearch,
  onOrder,
  onEdit,
  onLedger,
  onToggle,
}: any) {
  return (
    <div className="space-y-4">
      {/* Search & Sort Filters */}
      <div className="grid sm:grid-cols-[1fr_240px] gap-3">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por CUIT, razón social o nombre..."
          icon={<Search className="w-4 h-4 text-[#9CA6BA]" />}
        />
        <select
          value={order}
          onChange={(e) => onOrder(e.target.value)}
          className="h-11 rounded-xl bg-[#0E1629] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8] focus:border-[#947FF8]"
        >
          <option value="legal_name" className="bg-[#0E1629] text-[#FCFCFD]">Ordenar por razón social</option>
          <option value="name" className="bg-[#0E1629] text-[#FCFCFD]">Ordenar por nombre</option>
          <option value="cuit" className="bg-[#0E1629] text-[#FCFCFD]">Ordenar por CUIT</option>
          <option value="created_at" className="bg-[#0E1629] text-[#FCFCFD]">Ordenar por fecha de alta</option>
        </select>
      </div>

      {/* Symmetrical Grid of Supplier Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {suppliers.map((s: Supplier) => (
          <div
            key={s.id}
            className={cn(
              "bg-[#0E1629] border border-white/[0.08] rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all duration-200 hover:border-white/20 flex flex-col justify-between",
              !s.active && "opacity-50"
            )}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[#FCFCFD] text-sm truncate">
                    {s.legal_name || s.name}
                  </h3>
                  <p className="text-xs text-[#9CA6BA] mt-0.5 truncate">
                    {s.trade_name || "Sin nombre comercial"}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 uppercase tracking-wider",
                    s.active
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                      : "bg-white/[0.05] text-[#9CA6BA] border-white/10"
                  )}
                >
                  {s.active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="space-y-1.5 py-2.5 border-t border-b border-white/[0.06] my-3 text-xs text-[#9CA6BA]">
                <div className="flex items-center justify-between">
                  <span>CUIT:</span>
                  <span className="font-mono text-[#FCFCFD] font-medium">{s.cuit ? formatCuit(s.cuit) : "Sin CUIT"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Ubicación:</span>
                  <span className="truncate max-w-[180px] text-[#FCFCFD]">{[s.city, s.province].filter(Boolean).join(", ") || "No especificada"}</span>
                </div>
                {s.phone && (
                  <div className="flex items-center justify-between">
                    <span>Teléfono:</span>
                    <span className="font-mono text-[#FCFCFD]">{s.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => onEdit(s)} className="flex-1 text-xs">
                Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => onLedger(s)} className="flex-1 text-xs border-white/[0.08] hover:bg-white/5">
                Cta. Cte.
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onToggle(s)}
                className="text-xs text-[#9CA6BA] hover:text-white"
              >
                {s.active ? "Desactivar" : "Activar"}
              </Button>
            </div>
          </div>
        ))}
        {suppliers.length === 0 && (
          <div className="col-span-full bg-[#0E1629] border border-white/[0.08] rounded-2xl p-12 text-center text-[#9CA6BA]/60 text-xs">
            No se encontraron proveedores
          </div>
        )}
      </div>
    </div>
  );
}

function Payments({
  purchases,
  onNew,
}: {
  purchases: PurchaseDocument[];
  onNew: () => void;
}) {
  const pending = purchases.filter((p) => Number(p.balance_due) > 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-[#0E1629] border border-white/[0.08] rounded-2xl p-5 shadow-lg">
        <div>
          <h2 className="text-base font-bold text-[#FCFCFD]">Pagos a Proveedores</h2>
          <p className="text-xs text-[#9CA6BA] mt-0.5">
            Comprobantes con saldo pendiente de pago o imputación
          </p>
        </div>
        <Button onClick={onNew} className="gradient-cajago-btn font-bold text-xs shadow-md">
          <CreditCard className="w-4 h-4 mr-2" /> Registrar Pago
        </Button>
      </div>
      <Documents purchases={pending} compact />
    </div>
  );
}

function VatReport({ rows, onLoad }: any) {
  const now = new Date(),
    [from, setFrom] = useState(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    ),
    [to, setTo] = useState(now.toISOString().slice(0, 10));

  const totals = rows.reduce(
    (a: any, r: any) => ({
      net: a.net + Number(r.taxable_net),
      v105: a.v105 + Number(r.vat_105),
      v21: a.v21 + Number(r.vat_21),
      v27: a.v27 + Number(r.vat_27),
      perceptions: a.perceptions + Number(r.perceptions),
      other: a.other + Number(r.other_taxes),
      total: a.total + Number(r.total),
    }),
    { net: 0, v105: 0, v21: 0, v27: 0, perceptions: 0, other: 0, total: 0 },
  );

  const labels: Record<string, string> = {
    net: "Neto Gravado",
    v105: "IVA 10,5%",
    v21: "IVA 21%",
    v27: "IVA 27%",
    perceptions: "Percepciones",
    other: "Otros Tributos",
    total: "Total Facturado",
  };

  return (
    <div className="space-y-5">
      {/* Date Filter Card */}
      <div className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-end gap-3.5">
        <div className="flex-1">
          <Input
            label="Fecha Desde"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Input
            label="Fecha Hasta"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button onClick={() => onLoad(from, to)} className="gradient-cajago-btn font-bold text-xs h-11 px-6 shadow-md">
          Consultar IVA Compras
        </Button>
      </div>

      {/* Symmetrical Totals Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {Object.entries(totals).map(([key, value]) => (
          <div key={key} className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-4 shadow-lg">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#9CA6BA] truncate">
              {labels[key]}
            </p>
            <p className="text-base font-bold text-[#FCFCFD] font-mono tabular-nums mt-1.5 truncate">
              {formatCurrency(value as number)}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-[#9CA6BA]/60 px-1">
        * El reporte de IVA Compras incluye únicamente comprobantes fiscales válidos y confirmados.
      </p>
    </div>
  );
}

function Concepts({
  concepts,
  onSave,
}: {
  concepts: PurchaseConcept[];
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-5">
      <div className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-6 shadow-lg space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#FCFCFD]">Nuevo Concepto de Gasto</h2>
          <p className="text-xs text-[#9CA6BA] mt-0.5">Clasificá tus facturas de compra y servicios</p>
        </div>
        <Input
          label="Nombre del concepto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Alquiler, Seguros, Papelería..."
        />
        <Button
          className="w-full gradient-cajago-btn font-bold text-xs shadow-md mt-2"
          disabled={!name.trim()}
          onClick={async () => {
            await onSave(name);
            setName("");
          }}
        >
          Crear Concepto
        </Button>
      </div>

      <div className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-6 shadow-lg">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA6BA] mb-4">
          Conceptos Registrados ({concepts.length})
        </h3>
        <div className="flex flex-wrap gap-2.5">
          {concepts.map((c) => (
            <span
              key={c.id}
              className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-[#FCFCFD]"
            >
              {c.name}
            </span>
          ))}
          {concepts.length === 0 && (
            <p className="text-xs text-[#9CA6BA]/60">Sin conceptos creados aún</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplierForm({ open, value, onClose, onSave }: any) {
  const [form, setForm] = useState(value),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");

  useEffect(() => setForm(value), [value, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.id ? "Editar Proveedor" : "Nuevo Proveedor"}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Razón Social *"
            value={form.legal_name || ""}
            onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            placeholder="Ej: Distribuidora Central S.A."
            required
          />
          <Input
            label="Nombre Comercial"
            value={form.trade_name || ""}
            onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
            placeholder="Ej: Mayorista Central"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 items-end">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#9CA6BA]">CUIT *</label>
              <button
                type="button"
                disabled={!isValidCuit(form.cuit || "")}
                onClick={async () => {
                  setError("");
                  try {
                    const official = await lookupSupplierInArca(form.cuit);
                    setForm({
                      ...form,
                      ...official,
                      cuit: formatCuit(official.cuit || form.cuit),
                    });
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
                className="text-[11px] font-bold text-[#947FF8] hover:text-[#B785F3] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                🔍 Consultar en ARCA
              </button>
            </div>
            <Input
              value={form.cuit || ""}
              onChange={(e) => setForm({ ...form, cuit: formatCuit(e.target.value) })}
              placeholder="30-12345678-9"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#9CA6BA] block mb-1.5">Condición frente al IVA</label>
            <select
              value={form.vat_condition || ""}
              onChange={(e) => setForm({ ...form, vat_condition: e.target.value })}
              className="w-full h-11 rounded-xl bg-[#0E1629] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8] focus:border-[#947FF8]"
            >
              <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Seleccionar condición</option>
              <option value="IVA Responsable Inscripto" className="bg-[#0E1629] text-[#FCFCFD]">IVA Responsable Inscripto</option>
              <option value="Responsable Monotributo" className="bg-[#0E1629] text-[#FCFCFD]">Responsable Monotributo</option>
              <option value="IVA Exento" className="bg-[#0E1629] text-[#FCFCFD]">IVA Exento</option>
              <option value="Consumidor Final" className="bg-[#0E1629] text-[#FCFCFD]">Consumidor Final</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Domicilio"
            value={form.address || ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Calle y número"
          />
          <Input
            label="Localidad"
            value={form.city || ""}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Ciudad"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Provincia"
            value={form.province || ""}
            onChange={(e) => setForm({ ...form, province: e.target.value })}
            placeholder="Provincia"
          />
          <Input
            label="Código Postal"
            value={form.postal_code || ""}
            onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
            placeholder="CP"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Teléfono"
            value={form.phone || ""}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Número de contacto"
          />
          <Input
            label="Email"
            type="email"
            value={form.email || ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="correo@proveedor.com"
          />
        </div>

        <Input
          label="Observaciones"
          value={form.notes || ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notas internas adicionales"
        />

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !form.legal_name || !form.cuit}
            className="gradient-cajago-btn font-bold shadow-md"
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                await onSave(form);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Guardando..." : "Guardar Proveedor"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PurchaseForm({
  open,
  suppliers,
  concepts,
  taxes,
  methods,
  products,
  onClose,
  onSave,
}: any) {
  const [supplierId, setSupplierId] = useState(""),
    [doc, setDoc] = useState<any>({
      document_type: "invoice",
      letter: "A",
      point_of_sale: "",
      document_number: "",
      document_date: new Date().toISOString().slice(0, 10),
      due_date: "",
      payment_condition: "account",
      payment_method_id: "",
      currency: "ARS",
      is_fiscal: true,
      is_internal: false,
      notes: "",
    }),
    [items, setItems] = useState<PurchaseDraftItem[]>([emptyItem()]),
    [extraTaxes, setExtraTaxes] = useState<any[]>([]),
    [updateStock, setUpdateStock] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");

  const totals = useMemo(() => {
    const itemTotals = items.reduce(
      (a, item) => {
        const subtotal = multiplyMoney(
          item.unit_cost || "0",
          item.quantity || "0",
        );
        const vat = Math.round((subtotal * Number(item.vat_rate || 0)) / 100);
        return { subtotal: a.subtotal + subtotal, vat: a.vat + vat };
      },
      { subtotal: 0, vat: 0 },
    );
    const other = extraTaxes.reduce(
      (sum, tax) => sum + multiplyMoney(tax.amount || "0", 1),
      0,
    );
    return {
      ...itemTotals,
      other,
      total: itemTotals.subtotal + itemTotals.vat + other,
    };
  }, [items, extraTaxes]);

  const updateItem = (index: number, patch: Partial<PurchaseDraftItem>) =>
    setItems(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      setItems([emptyItem()]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar Comprobante de Compra"
      size="xl"
    >
      <div className="space-y-6">
        {/* Step 1: Proveedor */}
        <div className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-4.5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#947FF8]">
            1 · Datos del Proveedor
          </p>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full h-11 rounded-xl bg-white/[0.04] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8] focus:border-[#947FF8]"
          >
            <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Seleccionar proveedor...</option>
            {suppliers.map((s: Supplier) => (
              <option key={s.id} value={s.id} className="bg-[#0E1629] text-[#FCFCFD]">
                {s.legal_name || s.name} · {formatCuit(s.cuit || "")}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Comprobante */}
        <div className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-4.5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#947FF8]">
            2 · Datos del Comprobante
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-[#9CA6BA] block mb-1">Tipo Doc.</label>
              <select
                value={doc.document_type}
                onChange={(e) =>
                  setDoc({
                    ...doc,
                    document_type: e.target.value,
                    is_internal: e.target.value === "internal",
                    is_fiscal: e.target.value !== "internal",
                  })
                }
                className="w-full h-11 rounded-xl bg-white/[0.04] text-[#FCFCFD] border border-white/[0.08] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
              >
                <option value="invoice" className="bg-[#0E1629] text-[#FCFCFD]">Factura</option>
                <option value="credit_note" className="bg-[#0E1629] text-[#FCFCFD]">Nota de crédito</option>
                <option value="debit_note" className="bg-[#0E1629] text-[#FCFCFD]">Nota de débito</option>
                <option value="internal" className="bg-[#0E1629] text-[#FCFCFD]">Doc. interno</option>
              </select>
            </div>

            <Input
              label="Letra"
              placeholder="A"
              maxLength={1}
              value={doc.letter}
              onChange={(e) =>
                setDoc({ ...doc, letter: e.target.value.toUpperCase() })
              }
            />
            <Input
              label="Punto de Venta"
              type="number"
              placeholder="0001"
              value={doc.point_of_sale}
              onChange={(e) =>
                setDoc({ ...doc, point_of_sale: e.target.value })
              }
            />
            <Input
              label="Número"
              type="number"
              placeholder="00000001"
              value={doc.document_number}
              onChange={(e) =>
                setDoc({ ...doc, document_number: e.target.value })
              }
            />

            <Input
              label="Fecha Emisión"
              type="date"
              value={doc.document_date}
              onChange={(e) =>
                setDoc({ ...doc, document_date: e.target.value })
              }
            />
            <Input
              label="Fecha Vto."
              type="date"
              value={doc.due_date}
              onChange={(e) => setDoc({ ...doc, due_date: e.target.value })}
            />

            <div>
              <label className="text-xs font-semibold text-[#9CA6BA] block mb-1">Condición Pago</label>
              <select
                value={doc.payment_condition}
                onChange={(e) =>
                  setDoc({ ...doc, payment_condition: e.target.value })
                }
                className="w-full h-11 rounded-xl bg-white/[0.04] text-[#FCFCFD] border border-white/[0.08] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
              >
                <option value="account" className="bg-[#0E1629] text-[#FCFCFD]">Cuenta corriente</option>
                <option value="cash" className="bg-[#0E1629] text-[#FCFCFD]">Contado</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#9CA6BA] block mb-1">
                {doc.payment_condition === "cash" ? "Medio de Pago" : "Moneda"}
              </label>
              {doc.payment_condition === "cash" ? (
                <select
                  value={doc.payment_method_id}
                  onChange={(e) =>
                    setDoc({ ...doc, payment_method_id: e.target.value })
                  }
                  className="w-full h-11 rounded-xl bg-white/[0.04] text-[#FCFCFD] border border-white/[0.08] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
                >
                  <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Seleccionar...</option>
                  {methods.map((m: PaymentMethod) => (
                    <option key={m.id} value={m.id} className="bg-[#0E1629] text-[#FCFCFD]">
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={doc.currency}
                  onChange={(e) =>
                    setDoc({ ...doc, currency: e.target.value.toUpperCase() })
                  }
                />
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Detalle de Items */}
        <div className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-4.5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-[#947FF8]">
              3 · Detalle de Artículos e IVA
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setItems([...items, emptyItem()])}
              className="text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar Fila
            </Button>
          </div>

          <div className="space-y-2.5">
            {/* Table Header Row */}
            <div className="hidden md:grid md:grid-cols-[1.5fr_1fr_90px_120px_90px_36px] gap-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-[#9CA6BA]">
              <span>Descripción / Producto</span>
              <span>Concepto</span>
              <span>Cant.</span>
              <span>Costo Unit.</span>
              <span>Alíc. IVA</span>
              <span></span>
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_90px_120px_90px_36px] gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] items-center"
              >
                <div className="col-span-2 md:col-span-1">
                  <Input
                    placeholder="Descripción del ítem"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <select
                    value={item.concept_id || ""}
                    onChange={(e) =>
                      updateItem(index, { concept_id: e.target.value })
                    }
                    className="w-full h-11 rounded-xl bg-white/[0.04] text-[#FCFCFD] border border-white/[0.08] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
                  >
                    <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Concepto...</option>
                    {concepts.map((c: PurchaseConcept) => (
                      <option key={c.id} value={c.id} className="bg-[#0E1629] text-[#FCFCFD]">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, { quantity: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="$0.00"
                    value={item.unit_cost}
                    onChange={(e) =>
                      updateItem(index, { unit_cost: e.target.value })
                    }
                  />
                </div>
                <div>
                  <select
                    value={item.vat_rate}
                    onChange={(e) =>
                      updateItem(index, { vat_rate: e.target.value })
                    }
                    className="w-full h-11 rounded-xl bg-white/[0.04] text-[#FCFCFD] border border-white/[0.08] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
                  >
                    {taxes
                      .filter((t: TaxType) => t.kind === "vat")
                      .map((t: TaxType) => (
                        <option key={t.id} value={t.rate || 0} className="bg-[#0E1629] text-[#FCFCFD]">
                          {t.rate}%
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA6BA] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Eliminar fila"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer & Totals */}
        <div className="grid md:grid-cols-[1fr_260px] gap-4 items-end bg-[#0E1629] border border-white/[0.08] rounded-2xl p-4.5">
          <div>
            <Input
              label="Observaciones"
              value={doc.notes}
              onChange={(e) => setDoc({ ...doc, notes: e.target.value })}
              placeholder="Notas internas de la operación..."
            />
            <label className="flex items-center gap-2 text-xs text-[#9CA6BA] mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={updateStock}
                onChange={(e) => setUpdateStock(e.target.checked)}
                className="rounded border-white/20"
              />{" "}
              <span>Ingresar automáticamente al stock los ítems vinculados a catálogo</span>
            </label>
          </div>

          <div className="text-right p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <p className="text-xs text-[#9CA6BA] font-mono">
              Neto {formatCurrency(totals.subtotal / 100)} · IVA {formatCurrency(totals.vat / 100)}
            </p>
            <p className="text-2xl font-bold text-[#FCFCFD] font-mono tabular-nums mt-1">
              {formatCurrency(totals.total / 100)}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="gradient-cajago-btn font-bold text-xs shadow-md"
            disabled={
              saving ||
              !supplierId ||
              items.some((i) => !i.description || !i.unit_cost) ||
              !doc.point_of_sale ||
              !doc.document_number ||
              (doc.payment_condition === "cash" && !doc.payment_method_id)
            }
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                await onSave({ supplierId, document: doc, items, updateStock });
              } catch (e: any) {
                setError(e.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Confirmando..." : "Confirmar Operación"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PaymentForm({
  open,
  suppliers,
  purchases,
  methods,
  onClose,
  onSave,
}: any) {
  const [supplierId, setSupplierId] = useState(""),
    [purchaseId, setPurchaseId] = useState(""),
    [amount, setAmount] = useState(""),
    [methodId, setMethodId] = useState(""),
    [notes, setNotes] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");

  const pending = purchases.filter(
    (p: PurchaseDocument) =>
      p.supplier_id === supplierId && Number(p.balance_due) > 0,
  );

  return (
    <Modal open={open} onClose={onClose} title="Registrar Pago a Proveedor" size="md">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#9CA6BA] block mb-1.5">Proveedor</label>
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setPurchaseId("");
            }}
            className="w-full h-11 rounded-xl bg-[#0E1629] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
          >
            <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Seleccionar proveedor...</option>
            {suppliers.map((s: Supplier) => (
              <option key={s.id} value={s.id} className="bg-[#0E1629] text-[#FCFCFD]">
                {s.legal_name || s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#9CA6BA] block mb-1.5">Comprobante a Imputar (Opcional)</label>
          <select
            value={purchaseId}
            onChange={(e) => {
              setPurchaseId(e.target.value);
              const p = pending.find(
                (row: PurchaseDocument) => row.id === e.target.value,
              );
              if (p) setAmount(String(p.balance_due));
            }}
            className="w-full h-11 rounded-xl bg-[#0E1629] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
          >
            <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Sin imputar a comprobante específico</option>
            {pending.map((p: PurchaseDocument) => (
              <option key={p.id} value={p.id} className="bg-[#0E1629] text-[#FCFCFD]">
                {p.document_type.toUpperCase()} {p.point_of_sale}-{p.document_number} · Saldo pendiente: {formatCurrency(Number(p.balance_due))}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Importe del Pago *"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <div>
          <label className="text-xs font-semibold text-[#9CA6BA] block mb-1.5">Medio de Pago *</label>
          <select
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
            className="w-full h-11 rounded-xl bg-[#0E1629] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
          >
            <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Seleccionar medio...</option>
            {methods.map((m: PaymentMethod) => (
              <option key={m.id} value={m.id} className="bg-[#0E1629] text-[#FCFCFD]">
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Observación"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Número de transferencia, cheque o referencia..."
        />

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="gradient-cajago-btn font-bold text-xs shadow-md"
            disabled={saving || !supplierId || !amount || !methodId}
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                await onSave({
                  supplierId,
                  purchaseId,
                  amount,
                  date: new Date().toISOString().slice(0, 10),
                  paymentMethodId: methodId,
                  notes,
                });
              } catch (e: any) {
                setError(e.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Registrando..." : "Registrar Pago"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LedgerModal({
  supplier,
  movements,
  onClose,
}: {
  supplier: Supplier | null;
  movements: SupplierLedgerMovement[];
  onClose: () => void;
}) {
  let balance = 0;
  const chronological = [...movements]
    .reverse()
    .map((m) => ({
      ...m,
      balance: (balance += Number(m.debit) - Number(m.credit)),
    }))
    .reverse();

  return (
    <Modal
      open={!!supplier}
      onClose={onClose}
      title={`Cuenta Corriente · ${supplier?.legal_name || supplier?.name}`}
      size="lg"
    >
      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1629] shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.03] border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-wider text-[#9CA6BA]">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3 text-right">Debe / Haber</th>
              <th className="px-4 py-3 text-right">Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {chronological.map((m) => (
              <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-[#9CA6BA] font-mono whitespace-nowrap">
                  {new Date(m.occurred_at).toLocaleDateString("es-AR")}
                </td>
                <td className="px-4 py-3 font-medium text-[#FCFCFD]">
                  {m.description || m.movement_type}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-mono font-bold tabular-nums",
                    Number(m.debit) ? "text-amber-400" : "text-emerald-400"
                  )}
                >
                  {Number(m.debit)
                    ? `+${formatCurrency(Number(m.debit))}`
                    : `-${formatCurrency(Number(m.credit))}`}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-[#FCFCFD] tabular-nums">
                  {formatCurrency(m.balance)}
                </td>
              </tr>
            ))}
            {!movements.length && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-[#9CA6BA]/60 text-xs">
                  Sin movimientos registrados en la cuenta corriente
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
