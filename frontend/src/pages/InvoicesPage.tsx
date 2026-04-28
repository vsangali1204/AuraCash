import { useMutation, useQuery } from "@apollo/client";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { z } from "zod";
import {
  CreditCard as CardIcon,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  ArrowRight,
  ChevronLeft,
  Tag,
  Receipt,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  CREDIT_CARDS_QUERY,
  ALL_INVOICES_QUERY,
  INVOICES_QUERY,
  PAY_INVOICE_MUTATION,
} from "@/graphql/queries/creditCards";
import { INVOICE_TRANSACTIONS_QUERY } from "@/graphql/queries/transactions";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import {
  cn,
  formatCurrency,
  formatDate,
  formatMonthYear,
  CREDIT_CARD_BRAND_LABELS,
  INVOICE_STATUS_LABELS,
  todayISO,
} from "@/lib/utils";
import type { Account, CreditCard, Invoice, InvoiceWithCard, Transaction } from "@/types";

// ── Schemas ───────────────────────────────────────────────────────────────────

const paySchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  sourceAccountId: z.string().min(1, "Conta obrigatória"),
  paymentDate: z.string().min(1, "Data obrigatória"),
});
type PayFormData = z.infer<typeof paySchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

type QuickFilter = "" | "open" | "due_month" | "paid_month";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "open", label: "Abertas" },
  { value: "closed", label: "Fechadas" },
  { value: "partial", label: "Pago parcial" },
  { value: "paid", label: "Pagas" },
];

function statusClasses(status: string) {
  return (
    {
      open: "bg-blue-500/10 text-blue-400",
      closed: "bg-amber-500/10 text-amber-400",
      partial: "bg-orange-500/10 text-orange-400",
      paid: "bg-emerald-500/10 text-emerald-400",
    }[status] ?? "bg-gray-500/10 text-gray-400"
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        statusClasses(status)
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {INVOICE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── TransactionsView (drill-down dentro de ModalFaturas) ──────────────────────

function TransactionsView({
  invoice,
  onBack,
}: {
  invoice: Invoice;
  onBack: () => void;
}) {
  const { data, loading } = useQuery<{ invoiceTransactions: Transaction[] }>(
    INVOICE_TRANSACTIONS_QUERY,
    { variables: { invoiceId: invoice.id } }
  );
  const txs = data?.invoiceTransactions ?? [];

  return (
    <div>
      {/* Voltar */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
      >
        <ChevronLeft size={14} />
        Voltar para faturas
      </button>

      {/* Resumo da fatura */}
      <div className="mb-4 flex items-center justify-between rounded-lg bg-surface p-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {formatMonthYear(invoice.referenceMonth)}
          </p>
          <p className="text-xs text-gray-500">Vence {formatDate(invoice.dueDate)}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">{formatCurrency(invoice.totalAmount)}</p>
          <StatusBadge status={invoice.status} />
        </div>
      </div>

      {/* Lista de lançamentos */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-card" />
          ))}
        </div>
      ) : txs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10">
          <Receipt size={32} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhum lançamento nesta fatura.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {txs.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 border-b border-surface-border/40 py-3 last:border-0"
            >
              {/* Ícone categoria */}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={
                  tx.category
                    ? { background: `${tx.category.color}22` }
                    : { background: "rgba(255,255,255,0.04)" }
                }
              >
                {tx.category?.icon ? (
                  <span className="text-sm leading-none">{tx.category.icon}</span>
                ) : tx.category ? (
                  <Tag size={12} style={{ color: tx.category.color }} />
                ) : (
                  <Receipt size={12} className="text-gray-500" />
                )}
              </div>

              {/* Descrição */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{tx.description}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(tx.date)}
                  {tx.category ? ` · ${tx.category.name}` : ""}
                  {tx.installmentNumber && tx.totalInstallments
                    ? ` · ${tx.installmentNumber}/${tx.totalInstallments}`
                    : ""}
                </p>
              </div>

              {/* Valor */}
              <p className="shrink-0 text-sm font-semibold text-red-400">
                {formatCurrency(tx.amount)}
              </p>
            </div>
          ))}

          {/* Rodapé total */}
          <div className="flex items-center justify-between pt-3">
            <p className="text-xs text-gray-500">{txs.length} lançamento(s)</p>
            <p className="text-sm font-semibold text-white">
              Total: {formatCurrency(txs.reduce((s, t) => s + t.amount, 0))}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── InvoiceRowInModal ─────────────────────────────────────────────────────────

function InvoiceRowInModal({
  invoice,
  onViewTransactions,
  onPay,
}: {
  invoice: Invoice;
  onViewTransactions: (inv: Invoice) => void;
  onPay: (inv: Invoice) => void;
}) {
  const paidPct =
    invoice.totalAmount > 0
      ? Math.min(100, (invoice.paidAmount / invoice.totalAmount) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-surface-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">
              {formatMonthYear(invoice.referenceMonth)}
            </p>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Fecha {formatDate(invoice.closingDate)} · Vence {formatDate(invoice.dueDate)}
          </p>
        </div>
        <p className="shrink-0 text-base font-bold text-white">
          {formatCurrency(invoice.totalAmount)}
        </p>
      </div>

      {/* Barra de progresso */}
      {invoice.totalAmount > 0 && invoice.paidAmount > 0 && (
        <div className="mt-3">
          <div className="h-1 rounded-full bg-surface-border">
            <div
              className={cn(
                "h-1 rounded-full transition-all",
                invoice.status === "paid" ? "bg-emerald-500" : "bg-sky-500"
              )}
              style={{ width: `${paidPct}%` }}
            />
          </div>
          {invoice.status !== "paid" && (
            <p className="mt-1 text-xs text-gray-600">
              {formatCurrency(invoice.paidAmount)} pago · Falta{" "}
              {formatCurrency(invoice.totalAmount - invoice.paidAmount)}
            </p>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onViewTransactions(invoice)}
          className="flex-1"
        >
          <Receipt size={12} /> Lançamentos
        </Button>
        {invoice.status !== "paid" && invoice.totalAmount > 0 && (
          <Button size="sm" variant="secondary" onClick={() => onPay(invoice)}>
            <DollarSign size={12} /> Pagar
          </Button>
        )}
      </div>
    </div>
  );
}

// ── ModalFaturas ──────────────────────────────────────────────────────────────

function ModalFaturas({
  card,
  open,
  onClose,
  onPay,
}: {
  card: CreditCard | null;
  open: boolean;
  onClose: () => void;
  onPay: (inv: Invoice) => void;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Resetar drill-down ao fechar
  useEffect(() => {
    if (!open) setSelectedInvoice(null);
  }, [open]);

  const { data, loading } = useQuery<{ invoices: Invoice[] }>(INVOICES_QUERY, {
    variables: { creditCardId: card?.id },
    skip: !card || !open,
  });
  const invoices = data?.invoices ?? [];

  return (
    <Modal open={open} onClose={onClose} size="lg">
      {/* Header customizado — sticky dentro do modal */}
      <div className="-mx-4 -mt-4 mb-5 flex items-center gap-3 border-b border-surface-border px-4 pb-4 sm:-mx-6 sm:px-6 sticky top-0 z-10 bg-surface-card">
        {selectedInvoice ? (
          <button
            onClick={() => setSelectedInvoice(null)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-surface-hover hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600/20">
            <CardIcon size={16} className="text-sky-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">
            {selectedInvoice
              ? `Lançamentos · ${formatMonthYear(selectedInvoice.referenceMonth)}`
              : card?.name ?? ""}
          </p>
          {!selectedInvoice && card && (
            <p className="text-xs text-gray-500">
              {CREDIT_CARD_BRAND_LABELS[card.brand]} · {invoices.length} fatura(s)
            </p>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {selectedInvoice ? (
        <TransactionsView
          invoice={selectedInvoice}
          onBack={() => setSelectedInvoice(null)}
        />
      ) : loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-card" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <FileText size={36} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhuma fatura encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <InvoiceRowInModal
              key={inv.id}
              invoice={inv}
              onViewTransactions={setSelectedInvoice}
              onPay={(inv) => { onPay(inv); onClose(); }}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── CardCartao (view "Por cartão") ────────────────────────────────────────────

function CardCartao({
  card,
  onViewInvoices,
  onPay,
}: {
  card: CreditCard;
  onViewInvoices: (card: CreditCard) => void;
  onPay: (inv: Invoice) => void;
}) {
  const usedAmount = card.totalLimit - card.availableLimit;
  const usedPct =
    card.totalLimit > 0 ? Math.min(100, (usedAmount / card.totalLimit) * 100) : 0;
  const inv = card.currentInvoice;
  const paidPct =
    inv && inv.totalAmount > 0
      ? Math.min(100, (inv.paidAmount / inv.totalAmount) * 100)
      : 0;

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <div className="flex-1 p-5">
        {/* Nome + bandeira */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600/20">
            <CardIcon size={20} className="text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white">{card.name}</p>
            <p className="text-xs text-gray-500">
              {CREDIT_CARD_BRAND_LABELS[card.brand] ?? card.brand} · Fecha dia{" "}
              {card.closingDay} · Vence dia {card.dueDay}
            </p>
          </div>
        </div>

        {/* Limites */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-gray-500">Limite total</p>
            <p className="text-sm font-semibold text-white">
              {formatCurrency(card.totalLimit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Disponível</p>
            <p className="text-sm font-semibold text-emerald-400">
              {formatCurrency(card.availableLimit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Utilizado</p>
            <p className="text-sm font-semibold text-amber-400">
              {formatCurrency(usedAmount)}
            </p>
          </div>
        </div>

        {/* Barra de uso do limite */}
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-surface-border">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all",
                usedPct > 90 ? "bg-red-500" : usedPct > 70 ? "bg-amber-500" : "bg-sky-500"
              )}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-600">{usedPct.toFixed(0)}% do limite utilizado</p>
        </div>

        {/* Fatura atual */}
        <div className="mt-4">
          {inv ? (
            <div className="rounded-xl border border-surface-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Fatura atual
                </p>
                <StatusBadge status={inv.status} />
              </div>

              <div className="mt-2 flex items-end justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(inv.totalAmount)}
                  </p>
                  <p className="text-xs text-gray-500">{formatMonthYear(inv.referenceMonth)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Fecha {formatDate(inv.closingDate)}</p>
                  <p className="text-xs text-gray-500">Vence {formatDate(inv.dueDate)}</p>
                </div>
              </div>

              {/* Progresso de pagamento */}
              {inv.totalAmount > 0 && (
                <div className="mt-3">
                  <div className="h-1 rounded-full bg-surface-border">
                    <div
                      className={cn(
                        "h-1 rounded-full transition-all",
                        inv.status === "paid" ? "bg-emerald-500" : "bg-sky-500"
                      )}
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>
                  {inv.paidAmount > 0 && inv.status !== "paid" && (
                    <p className="mt-1 text-xs text-gray-600">
                      {formatCurrency(inv.paidAmount)} pago · Falta{" "}
                      {formatCurrency(inv.totalAmount - inv.paidAmount)}
                    </p>
                  )}
                </div>
              )}

              {inv.status !== "paid" && inv.totalAmount > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => onPay(inv)}
                >
                  <DollarSign size={13} /> Pagar fatura
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-surface-border p-4 text-center">
              <p className="text-xs text-gray-500">Sem compras no ciclo atual</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer: ver histórico */}
      <button
        onClick={() => onViewInvoices(card)}
        className="group flex w-full items-center justify-between border-t border-surface-border px-5 py-3 text-xs text-gray-500 transition-colors hover:bg-surface-hover hover:text-white"
      >
        <span>Ver histórico de faturas</span>
        <ArrowRight
          size={14}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </button>
    </Card>
  );
}

// ── InvoiceFlatCard (view "Por fatura") ───────────────────────────────────────

function InvoiceFlatCard({
  invoice,
  onPay,
  onViewTransactions,
}: {
  invoice: InvoiceWithCard;
  onPay: (inv: InvoiceWithCard) => void;
  onViewTransactions: (inv: InvoiceWithCard) => void;
}) {
  const paidPct =
    invoice.totalAmount > 0
      ? Math.min(100, (invoice.paidAmount / invoice.totalAmount) * 100)
      : 0;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-4">
        {/* Card info + status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-600/20">
              <CardIcon size={12} className="text-sky-400" />
            </div>
            <p className="truncate text-xs text-gray-400">
              {invoice.creditCardName}
              <span className="text-gray-600"> · </span>
              {CREDIT_CARD_BRAND_LABELS[invoice.creditCardBrand] ?? invoice.creditCardBrand}
            </p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        {/* Mês + valor */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xl font-bold text-white">
              {formatMonthYear(invoice.referenceMonth)}
            </p>
            <p className="text-xs text-gray-500">
              Fecha {formatDate(invoice.closingDate)} · Vence {formatDate(invoice.dueDate)}
            </p>
          </div>
          <p className="text-lg font-bold text-white">{formatCurrency(invoice.totalAmount)}</p>
        </div>

        {/* Barra */}
        {invoice.totalAmount > 0 && (
          <div className="mt-3">
            <div className="h-1 rounded-full bg-surface-border">
              <div
                className={cn(
                  "h-1 rounded-full transition-all",
                  invoice.status === "paid" ? "bg-emerald-500" : "bg-sky-500"
                )}
                style={{ width: `${paidPct}%` }}
              />
            </div>
            {invoice.paidAmount > 0 && invoice.status !== "paid" && (
              <p className="mt-1 text-xs text-gray-600">
                {formatCurrency(invoice.paidAmount)} pago · Falta{" "}
                {formatCurrency(invoice.totalAmount - invoice.paidAmount)}
              </p>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => onViewTransactions(invoice)}
          >
            <Receipt size={12} /> Lançamentos
          </Button>
          {invoice.status !== "paid" && invoice.totalAmount > 0 && (
            <Button size="sm" variant="secondary" onClick={() => onPay(invoice)}>
              <DollarSign size={12} /> Pagar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── InvoicesPage ──────────────────────────────────────────────────────────────

export function InvoicesPage() {
  const [viewMode, setViewMode] = useState<"card" | "invoice">("card");
  const [filterCard, setFilterCard] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("");

  // Modal faturas (por cartão)
  const [invoiceModalCard, setInvoiceModalCard] = useState<CreditCard | null>(null);

  // Modal transações (por fatura — flat view)
  const [txModalInvoice, setTxModalInvoice] = useState<InvoiceWithCard | null>(null);

  // Modal pagar
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  // Queries
  const { data: cardsData, loading: cardsLoading } = useQuery<{ creditCards: CreditCard[] }>(
    CREDIT_CARDS_QUERY
  );
  const { data: allInvData, loading: allInvLoading } = useQuery<{
    allInvoices: InvoiceWithCard[];
  }>(ALL_INVOICES_QUERY);
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);

  const [payInvoice, { loading: paying }] = useMutation(PAY_INVOICE_MUTATION, {
    refetchQueries: [CREDIT_CARDS_QUERY, ALL_INVOICES_QUERY],
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

  const cards = cardsData?.creditCards ?? [];
  const allInvoices = allInvData?.allInvoices ?? [];
  const accounts = accountsData?.accounts ?? [];
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  // Opções do filtro de cartão (para view "por fatura")
  const cardFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allInvoices.forEach((inv) => {
      if (!seen.has(inv.creditCardId)) seen.set(inv.creditCardId, inv.creditCardName);
    });
    return [
      { value: "", label: "Todos os cartões" },
      ...Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [allInvoices]);

  // Data atual para filtros por mês
  const today = new Date();
  const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // ── Métricas do dashboard ──────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const totalOpen = allInvoices
      .filter((inv) => ["open", "partial", "closed"].includes(inv.status))
      .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0);

    const dueSoon = allInvoices
      .filter((inv) => inv.status !== "paid" && inv.dueDate.startsWith(currentYM))
      .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0);

    const paidThisMonth = allInvoices
      .filter((inv) => inv.status === "paid" && inv.referenceMonth.startsWith(currentYM))
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    return { totalOpen, dueSoon, paidThisMonth };
  }, [allInvoices, currentYM]);

  // ── Filtragem ──────────────────────────────────────────────────────────────

  function handleQuickFilter(f: QuickFilter) {
    setQuickFilter((q) => (q === f ? "" : f));
    setFilterStatus("");
    setFilterCard("");
  }

  function handleStatusFilter(v: string) {
    setFilterStatus(v);
    setQuickFilter("");
  }

  function handleCardFilter(v: string) {
    setFilterCard(v);
    setQuickFilter("");
  }

  // Cartões filtrados (view "por cartão")
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (filterCard && card.id !== filterCard) return false;

      if (quickFilter === "open")
        return (
          card.currentInvoice &&
          ["open", "partial", "closed"].includes(card.currentInvoice.status)
        );
      if (quickFilter === "due_month")
        return allInvoices.some(
          (inv) =>
            inv.creditCardId === card.id &&
            inv.status !== "paid" &&
            inv.dueDate.startsWith(currentYM)
        );
      if (quickFilter === "paid_month")
        return allInvoices.some(
          (inv) =>
            inv.creditCardId === card.id &&
            inv.status === "paid" &&
            inv.referenceMonth.startsWith(currentYM)
        );
      if (filterStatus) {
        if (!card.currentInvoice) return false;
        return card.currentInvoice.status === filterStatus;
      }
      return true;
    });
  }, [cards, allInvoices, filterCard, quickFilter, filterStatus, currentYM]);

  // Faturas filtradas (view "por fatura")
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      if (filterCard && inv.creditCardId !== filterCard) return false;
      if (quickFilter === "open") return ["open", "partial", "closed"].includes(inv.status);
      if (quickFilter === "due_month")
        return inv.status !== "paid" && inv.dueDate.startsWith(currentYM);
      if (quickFilter === "paid_month")
        return inv.status === "paid" && inv.referenceMonth.startsWith(currentYM);
      if (filterStatus) return inv.status === filterStatus;
      return true;
    });
  }, [allInvoices, filterCard, quickFilter, filterStatus, currentYM]);

  // ── Helpers de pagamento ───────────────────────────────────────────────────

  function openPay(inv: Invoice) {
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

  const loading = cardsLoading || allInvLoading;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white">Faturas</h1>
          <p className="text-sm text-gray-500">Acompanhe as faturas dos seus cartões</p>
        </div>

        {/* Toggle de modo de visualização */}
        <div className="flex rounded-lg border border-surface-border bg-surface-card p-0.5">
          <button
            onClick={() => setViewMode("card")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "card"
                ? "bg-sky-600/20 text-sky-400"
                : "text-gray-500 hover:text-white"
            )}
          >
            <LayoutGrid size={13} /> Por cartão
          </button>
          <button
            onClick={() => setViewMode("invoice")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "invoice"
                ? "bg-sky-600/20 text-sky-400"
                : "text-gray-500 hover:text-white"
            )}
          >
            <List size={13} /> Por fatura
          </button>
        </div>
      </div>

      {/* ── Métricas (clicáveis como filtro rápido) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Total em aberto */}
        <button
          onClick={() => handleQuickFilter("open")}
          className={cn(
            "flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
            quickFilter === "open"
              ? "border-blue-500/40 bg-blue-500/10"
              : "border-surface-border bg-surface-card hover:border-blue-500/30 hover:bg-blue-500/5"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
            <Clock size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total em aberto</p>
            <p className="text-lg font-bold text-white">{formatCurrency(metrics.totalOpen)}</p>
          </div>
        </button>

        {/* Vence este mês */}
        <button
          onClick={() => handleQuickFilter("due_month")}
          className={cn(
            "flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
            quickFilter === "due_month"
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-surface-border bg-surface-card hover:border-amber-500/30 hover:bg-amber-500/5"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
            <AlertCircle size={20} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Vence este mês</p>
            <p className="text-lg font-bold text-white">{formatCurrency(metrics.dueSoon)}</p>
          </div>
        </button>

        {/* Pago este mês */}
        <button
          onClick={() => handleQuickFilter("paid_month")}
          className={cn(
            "flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
            quickFilter === "paid_month"
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-surface-border bg-surface-card hover:border-emerald-500/30 hover:bg-emerald-500/5"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pago este mês</p>
            <p className="text-lg font-bold text-white">{formatCurrency(metrics.paidThisMonth)}</p>
          </div>
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        {viewMode === "invoice" && (
          <div className="w-full sm:w-48">
            <Select
              options={cardFilterOptions}
              value={filterCard}
              onChange={(e) => handleCardFilter(e.target.value)}
            />
          </div>
        )}
        <div className="w-full sm:w-48">
          <Select
            options={STATUS_OPTIONS}
            value={filterStatus}
            onChange={(e) => handleStatusFilter(e.target.value)}
          />
        </div>
        {(filterCard || filterStatus || quickFilter) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFilterCard("");
              setFilterStatus("");
              setQuickFilter("");
            }}
          >
            Limpar filtros
          </Button>
        )}
        {quickFilter && (
          <span className="text-xs text-gray-500">
            Filtro rápido ativo ·{" "}
            {quickFilter === "open"
              ? "Em aberto"
              : quickFilter === "due_month"
              ? "Vence este mês"
              : "Pago este mês"}
          </span>
        )}
      </div>

      {/* ── Conteúdo principal ── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-surface-card" />
          ))}
        </div>
      ) : viewMode === "card" ? (
        // ── View "Por cartão" ──
        filteredCards.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-16">
            <CardIcon size={40} className="text-gray-600" />
            <p className="text-sm text-gray-500">
              {cards.length === 0
                ? "Nenhum cartão cadastrado."
                : "Nenhum cartão corresponde aos filtros."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCards.map((card) => (
              <CardCartao
                key={card.id}
                card={card}
                onViewInvoices={setInvoiceModalCard}
                onPay={openPay}
              />
            ))}
          </div>
        )
      ) : (
        // ── View "Por fatura" ──
        filteredInvoices.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-16">
            <FileText size={40} className="text-gray-600" />
            <p className="text-sm text-gray-500">
              {allInvoices.length === 0
                ? "Nenhuma fatura encontrada."
                : "Nenhuma fatura corresponde aos filtros."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredInvoices.map((inv) => (
              <InvoiceFlatCard
                key={inv.id}
                invoice={inv}
                onPay={openPay}
                onViewTransactions={setTxModalInvoice}
              />
            ))}
          </div>
        )
      )}

      {/* ── Modal: histórico de faturas do cartão ── */}
      <ModalFaturas
        card={invoiceModalCard}
        open={!!invoiceModalCard}
        onClose={() => setInvoiceModalCard(null)}
        onPay={openPay}
      />

      {/* ── Modal: lançamentos da fatura (view por fatura) ── */}
      <Modal
        open={!!txModalInvoice}
        onClose={() => setTxModalInvoice(null)}
        title={
          txModalInvoice
            ? `${txModalInvoice.creditCardName} · ${formatMonthYear(txModalInvoice.referenceMonth)}`
            : ""
        }
        size="lg"
      >
        {txModalInvoice && (
          <TransactionsView
            invoice={txModalInvoice}
            onBack={() => setTxModalInvoice(null)}
          />
        )}
      </Modal>

      {/* ── Modal: pagar fatura ── */}
      <Modal
        open={!!payingInvoice}
        onClose={() => setPayingInvoice(null)}
        title="Pagar fatura"
        size="sm"
      >
        {payingInvoice && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs text-gray-500">
                Fatura {formatMonthYear(payingInvoice.referenceMonth)}
              </p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(payingInvoice.totalAmount)}
              </p>
              {payingInvoice.paidAmount > 0 && (
                <p className="text-xs text-gray-500">
                  Já pago: {formatCurrency(payingInvoice.paidAmount)} · Restante:{" "}
                  {formatCurrency(payingInvoice.totalAmount - payingInvoice.paidAmount)}
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPayingInvoice(null)}
                >
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
