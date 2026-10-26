import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  FilePlus2,
  Landmark,
  LayoutDashboard,
  RotateCcw,
  Scale,
  ScrollText,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Plus,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { syncEngine } from "@/sync/syncEngine";
import { withSyncNote } from "@/sync/connectivity";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  createManualEntry,
  listAccounts,
  listEntries,
  listLedger,
  reverseEntry,
  saveAccount,
  type AccountingAccount,
  type AccountingEntry,
} from "@/features/accounting/accountingService";

type Tab = "dashboard" | "accounts" | "entries" | "journal" | "ledger";

const tabs: Array<{ id: Tab; label: string; icon: typeof Scale }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "accounts", label: "Plan de Cuentas", icon: Landmark },
  { id: "entries", label: "Asientos", icon: Scale },
  { id: "journal", label: "Libro Diario", icon: BookOpen },
  { id: "ledger", label: "Libro Mayor", icon: ScrollText },
];

export default function AccountingPage() {
  const { profile } = useAuthStore();
  const [tab, setTab] = useState<Tab>("dashboard"),
    [accounts, setAccounts] = useState<AccountingAccount[]>([]),
    [entries, setEntries] = useState<AccountingEntry[]>([]),
    [loading, setLoading] = useState(true);

  const [accountModal, setAccountModal] = useState(false),
    [entryModal, setEntryModal] = useState(false),
    [accountForm, setAccountForm] = useState<any>({
      code: "",
      name: "",
      account_type: "asset",
      level: 1,
      postable: true,
      active: true,
    });

  async function reload() {
    if (!profile?.business_id) return;
    setLoading(true);
    try {
      const [a, e] = await Promise.all([
        listAccounts(profile.business_id),
        listEntries(profile.business_id),
      ]);
      setAccounts(a);
      setEntries(e);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    return syncEngine.onSynced(() => { reload(); });
  }, [profile?.business_id]);

  const totals = useMemo(
    () =>
      entries
        .flatMap((e) => e.accounting_entry_lines || [])
        .reduce(
          (a, l) => ({
            debit: a.debit + Number(l.debit),
            credit: a.credit + Number(l.credit),
          }),
          { debit: 0, credit: 0 },
        ),
    [entries],
  );

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
              Contabilidad & Finanzas
            </span>
          </div>
          <h1 className="cg-title text-[clamp(1.6rem,3.5vw,2.25rem)] text-[#FCFCFD]">
            Contabilidad General
          </h1>
          <p className="text-xs text-[#9CA6BA] mt-1.5">
            Plan de cuentas, libro diario, libro mayor y asientos contables automáticos
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Button
            variant="secondary"
            onClick={() => setAccountModal(true)}
            className="h-10 px-4 rounded-xl text-xs font-bold border border-white/[0.08] hover:bg-white/[0.08] transition-all"
          >
            <Plus className="w-4 h-4 mr-2 text-[#9CA6BA]" /> Nueva Cuenta
          </Button>
          <Button
            onClick={() => setEntryModal(true)}
            className="h-10 px-4 rounded-xl text-xs font-bold gradient-cajago-btn shadow-lg shadow-[#3E73F5]/25 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            <FilePlus2 className="w-4 h-4 mr-2" /> Asiento Manual
          </Button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="bg-[#0E1629] border border-white/[0.08] p-1.5 rounded-2xl flex flex-wrap gap-1.5 shadow-lg">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
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
      {tab === "dashboard" && (
        <AccountingDashboard
          accounts={accounts}
          entries={entries}
          totals={totals}
        />
      )}
      {tab === "accounts" && (
        <AccountPlan
          accounts={accounts}
          onEdit={(a) => {
            setAccountForm(a);
            setAccountModal(true);
          }}
        />
      )}
      {tab === "entries" && (
        <EntryList
          entries={entries}
          onReverse={async (entry) => {
            const reason = window.prompt("Motivo de la reversión");
            if (!reason) return;
            if (!profile?.business_id) return;
            const reversalId = await reverseEntry(profile.business_id, entry.id, reason);
            toast.success(reversalId ? "Asiento revertido" : "Reversión guardada sin conexión · se aplica al volver la conexión");
            reload();
          }}
        />
      )}
      {tab === "journal" && <Journal entries={entries} />}
      {tab === "ledger" && profile?.business_id && (
        <Ledger
          businessId={profile.business_id}
          accounts={accounts.filter((a) => a.postable)}
        />
      )}

      {/* Modals */}
      <AccountModal
        open={accountModal}
        value={accountForm}
        accounts={accounts}
        onClose={() => {
          setAccountModal(false);
          setAccountForm({
            code: "",
            name: "",
            account_type: "asset",
            level: 1,
            postable: true,
            active: true,
          });
        }}
        onSave={async (value: any) => {
          if (!profile?.business_id) return;
          await saveAccount(profile.business_id, value);
          toast.success(withSyncNote("Cuenta contable guardada"));
          setAccountModal(false);
          reload();
        }}
      />
      <EntryModal
        open={entryModal}
        accounts={accounts.filter((a) => a.postable && a.active)}
        onClose={() => setEntryModal(false)}
        onSave={async (value: any) => {
          if (!profile) return;
          const entryId = await createManualEntry(profile.business_id, profile.id, value);
          toast.success(entryId ? "Asiento manual registrado con éxito" : "Asiento guardado sin conexión · se numera y registra al volver la conexión");
          setEntryModal(false);
          reload();
        }}
      />
    </div>
  );
}

function AccountingDashboard({ accounts, entries, totals }: any) {
  const cards = [
    {
      label: "Cuentas Activas",
      value: accounts.filter((a: AccountingAccount) => a.active).length,
      isMoney: false,
      icon: Landmark,
      color: "text-[#3E73F5]",
      bg: "bg-[#3E73F5]/15 border-[#3E73F5]/25",
    },
    {
      label: "Asientos Confirmados",
      value: entries.filter((e: AccountingEntry) => e.status === "confirmed").length,
      isMoney: false,
      icon: Scale,
      color: "text-[#947FF8]",
      bg: "bg-[#947FF8]/15 border-[#947FF8]/25",
    },
    {
      label: "Total Debe",
      value: totals.debit,
      isMoney: true,
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/15 border-emerald-500/25",
    },
    {
      label: "Total Haber",
      value: totals.credit,
      isMoney: true,
      icon: DollarSign,
      color: "text-rose-400",
      bg: "bg-rose-500/15 border-rose-500/25",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Symmetrical KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
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

      {/* Advisory Note */}
      <div className="bg-[#0E1629] border border-amber-500/25 rounded-2xl p-5 shadow-lg flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
            Validación Profesional Requerida
          </h3>
          <p className="text-xs text-[#9CA6BA] mt-1 leading-relaxed">
            El plan inicial y las reglas automáticas de asientos contables son totalmente configurables.
            Recomendamos validar las imputaciones y cuentas con su contador o asesor fiscal para asegurar
            el cumplimiento normativo correspondiente.
          </p>
        </div>
      </div>
    </div>
  );
}

function AccountPlan({
  accounts,
  onEdit,
}: {
  accounts: AccountingAccount[];
  onEdit: (a: AccountingAccount) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1629] shadow-xl">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/[0.03] border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-wider text-[#9CA6BA]">
          <tr>
            <th className="px-4 py-3.5">Código</th>
            <th className="px-4 py-3.5">Cuenta Contable</th>
            <th className="px-4 py-3.5">Tipo</th>
            <th className="px-4 py-3.5">Imputación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {accounts.map((a) => (
            <tr
              key={a.id}
              className="hover:bg-white/[0.02] cursor-pointer transition-colors"
              onClick={() => onEdit(a)}
            >
              <td className="px-4 py-3.5 font-mono text-[#947FF8] font-bold">
                {a.code}
              </td>
              <td
                className="px-4 py-3.5 font-medium text-[#FCFCFD]"
                style={{ paddingLeft: `${16 + (a.level - 1) * 20}px` }}
              >
                {a.name}
              </td>
              <td className="px-4 py-3.5 text-[#9CA6BA] capitalize">
                {a.account_type === "asset"
                  ? "Activo"
                  : a.account_type === "liability"
                  ? "Pasivo"
                  : a.account_type === "equity"
                  ? "Patrimonio Neto"
                  : a.account_type === "income"
                  ? "Ingresos"
                  : "Gastos / Egresos"}
              </td>
              <td className="px-4 py-3.5">
                <span
                  className={cn(
                    "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                    a.postable
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                      : "bg-white/[0.05] text-[#9CA6BA] border-white/10"
                  )}
                >
                  {a.postable ? "Imputable" : "Agrupadora"}
                </span>
              </td>
            </tr>
          ))}
          {accounts.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center text-[#9CA6BA]/60 text-xs">
                Sin cuentas contables en el plan
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EntryList({
  entries,
  onReverse,
}: {
  entries: AccountingEntry[];
  onReverse: (e: AccountingEntry) => void;
}) {
  return (
    <div className="space-y-3.5">
      {entries.map((e) => (
        <div
          key={e.id}
          className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-5 shadow-lg space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div className="min-w-0">
              <p className="font-bold text-sm text-[#FCFCFD]">
                Asiento #{e.entry_number} · {e.description}
              </p>
              <p className="text-xs text-[#9CA6BA] mt-0.5 font-mono">
                {new Date(`${e.entry_date}T12:00`).toLocaleDateString("es-AR")} · Origen: {e.source_type} · Estado: {e.status}
              </p>
            </div>
            {e.status === "confirmed" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReverse(e)}
                className="text-xs text-[#9CA6BA] hover:text-rose-400 hover:bg-rose-500/10"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revertir
              </Button>
            )}
          </div>

          <div className="space-y-1.5 pt-1">
            {e.accounting_entry_lines?.map((l) => (
              <div
                key={l.id}
                className="grid grid-cols-2 sm:grid-cols-[1fr_130px_130px] gap-x-2 gap-y-1 text-xs py-2 sm:py-1 px-2.5 rounded-lg bg-white/[0.015]"
              >
                <span className="col-span-2 sm:col-span-1 text-[#9CA6BA] font-medium min-w-0 break-words">
                  <span className="font-mono text-[#947FF8] mr-2">{l.account?.code}</span>
                  {l.account?.name}
                </span>
                <span className="text-right font-mono font-bold text-[#FCFCFD] tabular-nums">
                  {Number(l.debit) ? formatCurrency(Number(l.debit)) : ""}
                </span>
                <span className="text-right font-mono font-bold text-[#FCFCFD] tabular-nums">
                  {Number(l.credit) ? formatCurrency(Number(l.credit)) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <div className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-12 text-center text-[#9CA6BA]/60 text-xs shadow-xl">
          Sin asientos contables registrados
        </div>
      )}
    </div>
  );
}

function Journal({ entries }: { entries: AccountingEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1629] shadow-xl">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/[0.03] border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-wider text-[#9CA6BA]">
          <tr>
            <th className="px-4 py-3.5">Fecha</th>
            <th className="px-4 py-3.5">Asiento</th>
            <th className="px-4 py-3.5">Cuenta / Concepto</th>
            <th className="px-4 py-3.5 text-right">Debe</th>
            <th className="px-4 py-3.5 text-right">Haber</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {entries.flatMap((e) =>
            e.accounting_entry_lines?.map((l, index) => (
              <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3.5 text-[#9CA6BA] font-mono whitespace-nowrap">
                  {index === 0 ? e.entry_date : ""}
                </td>
                <td className="px-4 py-3.5 font-semibold text-[#FCFCFD]">
                  {index === 0 ? `#${e.entry_number} ${e.description}` : ""}
                </td>
                <td className="px-4 py-3.5 text-[#9CA6BA]">
                  <span className="font-mono text-[#947FF8] mr-2">{l.account?.code}</span>
                  {l.account?.name}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-[#FCFCFD] tabular-nums">
                  {Number(l.debit) ? formatCurrency(Number(l.debit)) : ""}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-[#FCFCFD] tabular-nums">
                  {Number(l.credit) ? formatCurrency(Number(l.credit)) : ""}
                </td>
              </tr>
            )),
          )}
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-[#9CA6BA]/60 text-xs">
                Sin movimientos registrados en el Libro Diario
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Ledger({
  businessId,
  accounts,
}: {
  businessId: string;
  accounts: AccountingAccount[];
}) {
  const now = new Date(),
    [accountId, setAccountId] = useState(""),
    [from, setFrom] = useState(`${now.getFullYear()}-01-01`),
    [to, setTo] = useState(now.toISOString().slice(0, 10)),
    [rows, setRows] = useState<any[]>([]);

  return (
    <div className="space-y-4">
      {/* Symmetrical Filter Bar */}
      <div className="bg-[#0E1629] border border-white/[0.08] rounded-2xl p-5 shadow-lg grid md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3.5 items-end">
        <div>
          <label className="text-xs font-semibold text-[#9CA6BA] block mb-1.5">Cuenta Contable</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full h-11 rounded-xl bg-[#060B22] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
          >
            <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Seleccionar cuenta contable...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-[#0E1629] text-[#FCFCFD]">
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Desde"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          label="Hasta"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <Button
          disabled={!accountId}
          onClick={async () => {
            try {
              setRows(await listLedger(businessId, accountId, from, to));
            } catch (error: any) {
              toast.error(error.message || "No se pudo cargar el mayor");
            }
          }}
          className="gradient-cajago-btn font-bold text-xs h-11 px-6 shadow-md"
        >
          Consultar
        </Button>
      </div>

      {/* Symmetrical Ledger Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1629] shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.03] border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-wider text-[#9CA6BA]">
            <tr>
              <th className="px-4 py-3.5">Fecha</th>
              <th className="px-4 py-3.5">Asiento</th>
              <th className="px-4 py-3.5">Concepto</th>
              <th className="px-4 py-3.5 text-right">Debe</th>
              <th className="px-4 py-3.5 text-right">Haber</th>
              <th className="px-4 py-3.5 text-right">Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((r) => (
              <tr
                key={`${r.entry_id}-${r.description}`}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3.5 font-mono text-[#9CA6BA] whitespace-nowrap">
                  {r.entry_date}
                </td>
                <td className="px-4 py-3.5 font-semibold text-[#FCFCFD]">
                  #{r.entry_number}
                </td>
                <td className="px-4 py-3.5 text-[#9CA6BA]">
                  {r.description || r.entry_description}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-[#FCFCFD] tabular-nums">
                  {formatCurrency(Number(r.debit))}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-[#FCFCFD] tabular-nums">
                  {formatCurrency(Number(r.credit))}
                </td>
                <td className="px-4 py-3.5 text-right font-mono font-bold text-[#947FF8] tabular-nums">
                  {formatCurrency(Number(r.running_balance))}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[#9CA6BA]/60 text-xs">
                  {accountId
                    ? "Sin movimientos registrados para el período seleccionado"
                    : "Seleccioná una cuenta y presioná Consultar para ver el libro mayor"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountModal({ open, value, accounts, onClose, onSave }: any) {
  const [form, setForm] = useState(value);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(value), [value, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.id ? "Editar Cuenta Contable" : "Nueva Cuenta Contable"}
      size="md"
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Código de Cuenta *"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="Ej: 1.1.01.01"
            required
          />
          <Input
            label="Nombre de la Cuenta *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Caja Moneda Nacional"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-[#9CA6BA] block mb-1.5">Tipo de Cuenta *</label>
          <select
            value={form.account_type}
            onChange={(e) => setForm({ ...form, account_type: e.target.value })}
            className="w-full h-11 rounded-xl bg-[#0E1629] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
          >
            <option value="asset" className="bg-[#0E1629] text-[#FCFCFD]">Activo</option>
            <option value="liability" className="bg-[#0E1629] text-[#FCFCFD]">Pasivo</option>
            <option value="equity" className="bg-[#0E1629] text-[#FCFCFD]">Patrimonio Neto</option>
            <option value="income" className="bg-[#0E1629] text-[#FCFCFD]">Ingresos (Resultado Positivo)</option>
            <option value="expense" className="bg-[#0E1629] text-[#FCFCFD]">Egresos / Gastos (Resultado Negativo)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#9CA6BA] block mb-1.5">Cuenta Padre (Opcional)</label>
          <select
            value={form.parent_id || ""}
            onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
            className="w-full h-11 rounded-xl bg-[#0E1629] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
          >
            <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Sin cuenta padre (Nivel principal)</option>
            {accounts
              .filter((a: AccountingAccount) => a.id !== form.id)
              .map((a: AccountingAccount) => (
                <option key={a.id} value={a.id} className="bg-[#0E1629] text-[#FCFCFD]">
                  {a.code} · {a.name}
                </option>
              ))}
          </select>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-[#9CA6BA] cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={form.postable}
            onChange={(e) => setForm({ ...form, postable: e.target.checked })}
            className="rounded border-white/20"
          />{" "}
          <span>Cuenta imputable (permite registrar movimientos y asientos directos)</span>
        </label>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="gradient-cajago-btn font-bold text-xs shadow-md"
            disabled={saving || !form.code || !form.name}
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
            {saving ? "Guardando..." : "Guardar Cuenta"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EntryModal({ open, accounts, onClose, onSave }: any) {
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (index: number, patch: any) =>
    setLines(
      lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const totalDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  return (
    <Modal open={open} onClose={onClose} title="Registrar Asiento Manual" size="lg">
      <div className="space-y-4">
        <Input
          label="Descripción o Concepto del Asiento *"
          placeholder="Ej: Ajuste de saldos iniciales, devengamiento..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#9CA6BA]">Líneas del Asiento</label>
            <Button
              size="sm"
              variant="secondary"
              disabled={saving}
              onClick={() =>
                setLines([...lines, { accountId: "", debit: "", credit: "" }])
              }
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar Línea
            </Button>
          </div>

          <div className="hidden sm:grid sm:grid-cols-[1fr_130px_130px_36px] gap-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-[#9CA6BA]">
            <span>Cuenta Imputable</span>
            <span className="text-right">Debe ($)</span>
            <span className="text-right">Haber ($)</span>
            <span></span>
          </div>

          {lines.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-1 sm:grid-cols-[1fr_130px_130px_36px] gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] items-center"
            >
              <select
                value={line.accountId}
                onChange={(e) => update(index, { accountId: e.target.value })}
                className="w-full h-11 rounded-xl bg-[#0E1629] text-[#FCFCFD] border border-white/[0.08] px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#947FF8]"
              >
                <option value="" className="bg-[#0E1629] text-[#FCFCFD]">Seleccionar cuenta...</option>
                {accounts.map((a: AccountingAccount) => (
                  <option key={a.id} value={a.id} className="bg-[#0E1629] text-[#FCFCFD]">
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="0.00"
                type="number"
                step="0.01"
                value={line.debit}
                onChange={(e) =>
                  update(index, {
                    debit: e.target.value,
                    credit: e.target.value ? "" : line.credit,
                  })
                }
              />
              <Input
                placeholder="0.00"
                type="number"
                step="0.01"
                value={line.credit}
                onChange={(e) =>
                  update(index, {
                    credit: e.target.value,
                    debit: e.target.value ? "" : line.debit,
                  })
                }
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={lines.length <= 2}
                  onClick={() => removeLine(index)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA6BA] hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-20 transition-colors"
                  title="Eliminar fila"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Balance Status Footer */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0E1629] border border-white/[0.08] text-xs">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                isBalanced ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-400"
              )}
            />
            <span className={cn("font-semibold", isBalanced ? "text-emerald-400" : "text-rose-400")}>
              {isBalanced ? "Asiento balanceado (Debe = Haber)" : "Asiento desbalanceado"}
            </span>
          </div>
          <div className="font-mono tabular-nums text-right">
            <span className="text-[#9CA6BA] mr-3">Debe: <strong className="text-[#FCFCFD]">{formatCurrency(totalDebit)}</strong></span>
            <span className="text-[#9CA6BA]">Haber: <strong className="text-[#FCFCFD]">{formatCurrency(totalCredit)}</strong></span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="gradient-cajago-btn font-bold text-xs shadow-md"
            disabled={
              saving ||
              !description ||
              !isBalanced ||
              lines.some(
                (line) => !line.accountId || (!line.debit && !line.credit),
              )
            }
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                await onSave({
                  date: new Date().toISOString().slice(0, 10),
                  description,
                  lines,
                });
              } catch (e: any) {
                setError(e.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Confirmando..." : "Confirmar Asiento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
