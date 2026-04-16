import { useMutation, useQuery } from "@apollo/client";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard as CardIcon,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ALL_INVOICES_QUERY, PAY_INVOICE_MUTATION } from "@/graphql/queries/creditCards";
import { INVOICE_TRANSACTIONS_QUERY } from "@/graphql/queries/transactions";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import {
  formatCurrency,
  formatDate,
  formatMonthYear,
  CREDIT_CARD_BRAND_LABELS,
  INVOICE_STATUS_LABELS,
  invoiceStatusColor,
  todayISO,
} from "@/lib/utils";
import type { Account, InvoiceWithCard, Transaction } from "@/types";

const paySchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  sourceAccountId: z.string().min(1, "Conta obrigatória"),
  paymentDate: z.string().min(1, "Data obrigatória"),
});
type PayFormData = z.infer<typeof paySchema>;

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "open", label: "Abertas" },
  { value: "closed", label: "Fechadas" },
  { value: "partial", label: "Pagas parcialmente" },
  { value: "paid", label: "Pagas" },
];

function statusIcon(status: string) {
  if (status === "paid") return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (status === "closed") return <AlertCircle size={14} className="text-amber-400" />;
  if (status === "partial") return <Clock size={14} className="text-orange-400" />;
  return <Clock size={14} className="text-blue-400" />;
}

function InvoiceCard({
  invoice,
  onPay,
}: {
  invoice: InvoiceWithCard;
  onPay: (inv: InvoiceWithCard) => void;
}) {
  const [showTx, setShowTx] = useState(false);
  const { data } = useQuery<{ invoiceTransactions: Transaction[] }>(INVOICE_TRANSACTIONS_QUERY, {
    variables: { invoiceId: invoice.id },
    skip: !showTx,
  });
  const txs = data?.invoiceTransactions ?? [];

  const paidPercent =
    invoice.totalAmount > 0
      ? Math.min(100, (invoice.paidAmount / invoice.totalAmount) * 100)
      : 0;
  const remaining = invoice.totalAmount - invoice.paidAmount;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-4">
        {/* Header: cartão + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600/20">
              <CardIcon size={16} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{invoice.creditCardName}</p>
              <p className="text-xs text-gray-500">{CREDIT_CARD_BRAND_LABELS[invoice.creditCardBrand] ?? invoice.creditCardBrand}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {statusIcon(invoice.status)}
            <span className={`text-xs font-medium ${invoiceStatusColor(invoice.status)}`}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </span>
          </div>
        </div>

        {/* Mês + datas */}
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-lg font-bold text-white">{formatMonthYear(invoice.referenceMonth)}</p>
            <p className="text-xs text-gray-500">
              Fecha {formatDate(invoice.closingDate)} · Vence {formatDate(invoice.dueDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-white">{formatCurrency(invoice.totalAmount)}</p>
            {invoice.paidAmount > 0 && invoice.status !== "paid" && (
              <p className="text-xs text-gray-500">
                Pago: {formatCurrency(invoice.paidAmount)} · Falta: {formatCurrency(remaining)}
              </p>
            )}
          </div>
        </div>

        {/* Barra de progresso de pagamento */}
        {invoice.totalAmount > 0 && (
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-surface-border">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  invoice.status === "paid" ? "bg-emerald-500" : "bg-violet-500"
                }`}
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-600">{paidPercent.toFixed(0)}% pago</p>
          </div>
        )}

        {/* Ações */}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setShowTx((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            {showTx ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showTx ? "Ocultar lançamentos" : `Ver lançamentos`}
            {txs.length > 0 && (
              <span className="ml-1 rounded-full bg-surface-border px-1.5 py-0.5 text-xs">
                {txs.length}
              </span>
            )}
          </button>
          {invoice.status !== "paid" && (
            <Button size="sm" variant="secondary" onClick={() => onPay(invoice)}>
              <DollarSign size={12} /> Pagar fatura
            </Button>
          )}
        </div>
      </div>

      {/* Lançamentos expandíveis */}
      {showTx && (
        <div className="border-t border-surface-border px-4 pb-4 pt-3">
          {txs.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Nenhum lançamento nesta fatura.</p>
          ) : (
            <div className="space-y-1">
              {txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-surface-border/50 last:border-0">
                  <div>
                    <p className="text-xs text-gray-300">{t.description}</p>
                    <p className="text-xs text-gray-600">{formatDate(t.date)}</p>
                  </div>
                  <span className="text-xs font-semibold text-red-400">{formatCurrency(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function InvoicesPage() {
  const [filterCard, setFilterCard] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [payingInvoice, setPayingInvoice] = useState<InvoiceWithCard | null>(null);

  const { data: invoicesData, loading } = useQuery<{ allInvoices: InvoiceWithCard[] }>(ALL_INVOICES_QUERY);
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);

  const [payInvoice, { loading: paying }] = useMutation(PAY_INVOICE_MUTATION, {
    refetchQueries: [ALL_INVOICES_QUERY],
    onCompleted: () => {
      toast.success("Pagamento registrado!");
      setPayingInvoice(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const payForm = useForm<PayFormData>({
    resolver: zodResolver(paySchema),
    defaultValues: { paymentDate: todayISO() },
  });

  const allInvoices = invoicesData?.allInvoices ?? [];
  const accounts = accountsData?.accounts ?? [];
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  // Cartões únicos para o filtro
  const cardOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allInvoices.forEach((inv) => {
      if (!seen.has(inv.creditCardId)) seen.set(inv.creditCardId, inv.creditCardName);
    });
    return [
      { value: "", label: "Todos os cartões" },
      ...Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [allInvoices]);

  // Faturas filtradas
  const filtered = useMemo(() => {
    return allInvoices.filter((inv) => {
      if (filterCard && inv.creditCardId !== filterCard) return false;
      if (filterStatus && inv.status !== filterStatus) return false;
      return true;
    });
  }, [allInvoices, filterCard, filterStatus]);

  // Métricas do dashboard
  const totalOpen = useMemo(
    () =>
      allInvoices
        .filter((inv) => inv.status === "open" || inv.status === "partial")
        .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0),
    [allInvoices]
  );

  const today = new Date();
  const currentMonthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const dueSoonTotal = useMemo(
    () =>
      allInvoices
        .filter((inv) => inv.status !== "paid" && inv.dueDate.startsWith(currentMonthYear))
        .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0),
    [allInvoices, currentMonthYear]
  );

  const totalPaidThisMonth = useMemo(
    () =>
      allInvoices
        .filter((inv) => inv.status === "paid" && inv.referenceMonth.startsWith(currentMonthYear))
        .reduce((sum, inv) => sum + inv.totalAmount, 0),
    [allInvoices, currentMonthYear]
  );

  function openPay(inv: InvoiceWithCard) {
    setPayingInvoice(inv);
    payForm.reset({
      amount: inv.totalAmount - inv.paidAmount,
      sourceAccountId: "",
      paymentDate: todayISO(),
    });
  }

  function onPaySubmit(data: PayFormData) {
    if (!payingInvoice) return;
    payInvoice({
      variables: {
        input: {
          invoiceId: payingInvoice.id,
          amount: data.amount,
          sourceAccountId: data.sourceAccountId,
          paymentDate: data.paymentDate,
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Faturas</h1>
        <p className="text-sm text-gray-500">Acompanhe todas as faturas dos seus cartões</p>
      </div>

      {/* Dashboard de métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
            <Clock size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total em aberto</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalOpen)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
            <AlertCircle size={20} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Vence este mês</p>
            <p className="text-lg font-bold text-white">{formatCurrency(dueSoonTotal)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pago este mês</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalPaidThisMonth)}</p>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="w-52">
          <Select
            options={cardOptions}
            value={filterCard}
            onChange={(e) => setFilterCard(e.target.value)}
          />
        </div>
        <div className="w-52">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
        </div>
        {(filterCard || filterStatus) && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setFilterCard(""); setFilterStatus(""); }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Lista de faturas */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-surface-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <FileText size={40} className="text-gray-600" />
          <p className="text-sm text-gray-500">
            {allInvoices.length === 0
              ? "Nenhuma fatura encontrada."
              : "Nenhuma fatura para os filtros selecionados."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inv) => (
            <InvoiceCard key={inv.id} invoice={inv} onPay={openPay} />
          ))}
        </div>
      )}

      {/* Modal pagar fatura */}
      <Modal
        open={!!payingInvoice}
        onClose={() => setPayingInvoice(null)}
        title="Pagar fatura"
        size="sm"
      >
        {payingInvoice && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface p-3 text-sm">
              <p className="text-xs text-gray-500">
                {payingInvoice.creditCardName} · {formatMonthYear(payingInvoice.referenceMonth)}
              </p>
              <p className="text-white font-semibold">{formatCurrency(payingInvoice.totalAmount)}</p>
              {payingInvoice.paidAmount > 0 && (
                <p className="text-xs text-gray-500">
                  Já pago: {formatCurrency(payingInvoice.paidAmount)}
                </p>
              )}
            </div>
            <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="space-y-4">
              <Input
                label="Valor a pagar (R$)"
                type="number"
                step="0.01"
                error={payForm.formState.errors.amount?.message}
                {...payForm.register("amount")}
              />
              <Select
                label="Conta de origem"
                options={[{ value: "", label: "Selecione a conta" }, ...accountOptions]}
                error={payForm.formState.errors.sourceAccountId?.message}
                {...payForm.register("sourceAccountId")}
              />
              <Input
                label="Data do pagamento"
                type="date"
                error={payForm.formState.errors.paymentDate?.message}
                {...payForm.register("paymentDate")}
              />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setPayingInvoice(null)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={paying}>
                  Registrar pagamento
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
