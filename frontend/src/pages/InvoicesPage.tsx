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
  Calendar,
  TrendingUp,
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

const paySchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  sourceAccountId: z.string().min(1, "Conta obrigatória"),
  paymentDate: z.string().min(1, "Data obrigatória"),
});
type PayFormData = z.infer<typeof paySchema>;

type QuickFilter = "" | "open" | "due_month" | "paid_month";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "open", label: "Abertas" },
  { value: "closed", label: "Fechadas" },
  { value: "partial", label: "Pago parcial" },
  { value: "paid", label: "Pagas" },
];

function statusConfig(status: string) {
  return (
    {
      open:    { bg: "bg-blue-500/12 text-blue-400",    dot: "bg-blue-400" },
      closed:  { bg: "bg-amber-500/12 text-amber-400",  dot: "bg-amber-400" },
      partial: { bg: "bg-orange-500/12 text-orange-400",dot: "bg-orange-400" },
      paid:    { bg: "bg-emerald-500/12 text-emerald-400", dot: "bg-emerald-400" },
    }[status] ?? { bg: "bg-gray-500/12 text-gray-400", dot: "bg-gray-400" }
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {INVOICE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── Lançamentos da fatura ─────────────────────────────────────────────────────

function TransactionsView({ invoice, onBack }: { invoice: Invoice; onBack: () => void }) {
  const { data, loading } = useQuery<{ invoiceTransactions: Transaction[] }>(
    INVOICE_TRANSACTIONS_QUERY,
    { variables: { invoiceId: invoice.id } }
  );
  const txs = data?.invoiceTransactions ?? [];
  const total = txs.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Botão voltar */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors self-start"
      >
        <ChevronLeft size={16} /> Voltar às faturas
      </button>

      {/* Resumo da fatura */}
      <div className="rounded-xl border border-surface-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-white">{formatMonthYear(invoice.referenceMonth)}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar size={11} className="text-gray-600" />
                Fecha {formatDate(invoice.closingDate)}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <AlertCircle size={11} className="text-amber-500/70" />
                Vence {formatDate(invoice.dueDate)}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-white tabular-nums">{formatCurrency(invoice.totalAmount)}</p>
            <div className="mt-1">
              <StatusBadge status={invoice.status} />
            </div>
          </div>
        </div>
        {invoice.totalAmount > 0 && invoice.paidAmount > 0 && invoice.status !== "paid" && (
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-surface-border">
              <div
                className="h-1.5 rounded-full bg-sky-500 transition-all"
                style={{ width: `${Math.min(100, (invoice.paidAmount / invoice.totalAmount) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {formatCurrency(invoice.paidAmount)} pago · falta {formatCurrency(invoice.totalAmount - invoice.paidAmount)}
            </p>
          </div>
        )}
      </div>

      {/* Lista de lançamentos */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-card" />
          ))}
        </div>
      ) : txs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Receipt size={32} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhum lançamento nesta fatura.</p>
        </div>
      ) : (
        <div>
          <div className="rounded-xl border border-surface-border overflow-hidden divide-y divide-surface-border/60">
            {txs.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover/30 transition-colors">
                {/* Ícone categoria */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={
                    tx.category
                      ? { background: `${tx.category.color}20` }
                      : { background: "rgba(255,255,255,0.04)" }
                  }
                >
                  {tx.category?.icon ? (
                    <span className="text-base leading-none">{tx.category.icon}</span>
                  ) : tx.category ? (
                    <Tag size={14} style={{ color: tx.category.color }} />
                  ) : (
                    <Receipt size={14} className="text-gray-500" />
                  )}
                </div>

                {/* Descrição + meta */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate leading-snug">
                    {tx.description}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-xs text-gray-500">{formatDate(tx.date)}</span>
                    {tx.category && (
                      <>
                        <span className="text-gray-700 text-xs">·</span>
                        <span
                          className="text-xs font-medium"
                          style={{ color: tx.category.color }}
                        >
                          {tx.category.name}
                        </span>
                      </>
                    )}
                    {tx.installmentNumber && tx.totalInstallments && (
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-gray-400">
                        {tx.installmentNumber}/{tx.totalInstallments}x
                      </span>
                    )}
                  </div>
                </div>

                {/* Valor */}
                <p className="shrink-0 text-sm font-bold text-red-400 tabular-nums">
                  {formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>

          {/* Rodapé total */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-surface-border bg-surface px-4 py-3">
            <p className="text-sm text-gray-500">{txs.length} lançamento(s)</p>
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-red-400" />
              <p className="text-sm font-bold text-white tabular-nums">
                {formatCurrency(total)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal de faturas de um cartão ─────────────────────────────────────────────

function ModalFaturas({
  card, open, onClose, onPay,
}: {
  card: CreditCard | null; open: boolean; onClose: () => void; onPay: (inv: Invoice) => void;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

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
      {/* Header sticky */}
      <div className="-mx-4 -mt-4 mb-5 flex items-center gap-3 border-b border-surface-border px-4 pb-4 sm:-mx-6 sm:px-6 sticky top-0 z-10 bg-surface-card">
        <button
          onClick={selectedInvoice ? () => setSelectedInvoice(null) : onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-hover hover:text-white transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">
            {selectedInvoice
              ? `${formatMonthYear(selectedInvoice.referenceMonth)} · Lançamentos`
              : card?.name ?? ""}
          </p>
          <p className="text-xs text-gray-500">
            {selectedInvoice
              ? `${formatCurrency(selectedInvoice.totalAmount)}`
              : card ? `${CREDIT_CARD_BRAND_LABELS[card.brand]} · ${invoices.length} fatura(s)` : ""}
          </p>
        </div>
        {selectedInvoice && (
          <StatusBadge status={selectedInvoice.status} />
        )}
      </div>

      {selectedInvoice ? (
        <TransactionsView invoice={selectedInvoice} onBack={() => setSelectedInvoice(null)} />
      ) : loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-card" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <FileText size={36} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhuma fatura encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const paidPct = inv.totalAmount > 0
              ? Math.min(100, (inv.paidAmount / inv.totalAmount) * 100)
              : 0;
            const remaining = inv.totalAmount - inv.paidAmount;

            return (
              <div key={inv.id} className="rounded-xl border border-surface-border overflow-hidden">
                {/* Info da fatura */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-white">{formatMonthYear(inv.referenceMonth)}</p>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="text-xs text-gray-500">Fecha {formatDate(inv.closingDate)}</span>
                        <span className="text-xs text-gray-500">Vence {formatDate(inv.dueDate)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-white tabular-nums">{formatCurrency(inv.totalAmount)}</p>
                      {inv.status !== "paid" && remaining > 0 && (
                        <p className="text-xs text-amber-400">falta {formatCurrency(remaining)}</p>
                      )}
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  {inv.totalAmount > 0 && inv.paidAmount > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-surface-border">
                        <div
                          className={cn("h-1.5 rounded-full transition-all", inv.status === "paid" ? "bg-emerald-500" : "bg-sky-500")}
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-2 border-t border-surface-border px-4 py-3 bg-surface/40">
                  <Button
                    size="sm" variant="secondary"
                    onClick={() => setSelectedInvoice(inv)}
                    className="flex-1"
                  >
                    <Receipt size={13} /> Ver lançamentos
                  </Button>
                  {inv.status !== "paid" && inv.totalAmount > 0 && (
                    <Button
                      size="sm"
                      onClick={() => { onPay(inv); onClose(); }}
                    >
                      <DollarSign size={13} /> Pagar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── Card de cartão (view "Por cartão") ────────────────────────────────────────

function CardCartao({
  card, onViewInvoices, onPay,
}: {
  card: CreditCard;
  onViewInvoices: (card: CreditCard) => void;
  onPay: (inv: Invoice) => void;
}) {
  const usedAmount = card.totalLimit - card.availableLimit;
  const usedPct = card.totalLimit > 0 ? Math.min(100, (usedAmount / card.totalLimit) * 100) : 0;
  const inv = card.currentInvoice;

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <div className="flex-1 p-4 sm:p-5 space-y-4">
        {/* Nome + bandeira */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600/20">
            <CardIcon size={18} className="text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{card.name}</p>
            <p className="text-xs text-gray-500">
              {CREDIT_CARD_BRAND_LABELS[card.brand] ?? card.brand}
              {" · "}fecha dia {card.closingDay} · vence dia {card.dueDay}
            </p>
          </div>
        </div>

        {/* Limite — 2 colunas no mobile, barra de uso */}
        <div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg bg-surface p-2.5">
              <p className="text-[11px] text-gray-500 mb-0.5">Disponível</p>
              <p className="text-sm font-bold text-emerald-400 tabular-nums">{formatCurrency(card.availableLimit)}</p>
            </div>
            <div className="rounded-lg bg-surface p-2.5">
              <p className="text-[11px] text-gray-500 mb-0.5">Utilizado</p>
              <p className={cn("text-sm font-bold tabular-nums", usedPct > 90 ? "text-red-400" : usedPct > 70 ? "text-amber-400" : "text-white")}>
                {formatCurrency(usedAmount)}
              </p>
            </div>
          </div>

          {/* Barra de limite */}
          <div>
            <div className="h-2 rounded-full bg-surface-border overflow-hidden">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  usedPct > 90 ? "bg-red-500" : usedPct > 70 ? "bg-amber-500" : "bg-sky-500"
                )}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-600">
              {usedPct.toFixed(0)}% de {formatCurrency(card.totalLimit)} utilizado
            </p>
          </div>
        </div>

        {/* Fatura atual */}
        {inv ? (
          <div className="rounded-xl border border-surface-border overflow-hidden">
            {/* Header da fatura */}
            <div className="flex items-center justify-between px-3 py-2 bg-surface/60 border-b border-surface-border">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Fatura atual</p>
              <StatusBadge status={inv.status} />
            </div>

            <div className="p-3 space-y-3">
              {/* Valor + mês */}
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold text-white tabular-nums">{formatCurrency(inv.totalAmount)}</p>
                  <p className="text-xs text-gray-500">{formatMonthYear(inv.referenceMonth)}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>Fecha {formatDate(inv.closingDate)}</p>
                  <p>Vence {formatDate(inv.dueDate)}</p>
                </div>
              </div>

              {/* Progresso de pagamento */}
              {inv.totalAmount > 0 && inv.paidAmount > 0 && (
                <div>
                  <div className="h-1.5 rounded-full bg-surface-border">
                    <div
                      className={cn("h-1.5 rounded-full", inv.status === "paid" ? "bg-emerald-500" : "bg-sky-500")}
                      style={{ width: `${Math.min(100, (inv.paidAmount / inv.totalAmount) * 100)}%` }}
                    />
                  </div>
                  {inv.status !== "paid" && (
                    <p className="mt-1 text-xs text-gray-500">
                      {formatCurrency(inv.paidAmount)} pago · falta {formatCurrency(inv.totalAmount - inv.paidAmount)}
                    </p>
                  )}
                </div>
              )}

              {/* Botão pagar */}
              {inv.status !== "paid" && inv.totalAmount > 0 && (
                <Button size="sm" variant="secondary" className="w-full" onClick={() => onPay(inv)}>
                  <DollarSign size={13} /> Pagar fatura
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-surface-border p-4 text-center">
            <p className="text-xs text-gray-500">Sem compras no ciclo atual</p>
          </div>
        )}
      </div>

      {/* Footer: ver histórico */}
      <button
        onClick={() => onViewInvoices(card)}
        className="group flex w-full items-center justify-between border-t border-surface-border px-4 sm:px-5 py-3 text-xs text-gray-400 transition-colors hover:bg-surface-hover hover:text-white"
      >
        <span>Ver histórico de faturas</span>
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </button>
    </Card>
  );
}

// ── Card de fatura flat (view "Por fatura") ───────────────────────────────────

function InvoiceFlatCard({
  invoice, onPay, onViewTransactions,
}: {
  invoice: InvoiceWithCard;
  onPay: (inv: InvoiceWithCard) => void;
  onViewTransactions: (inv: InvoiceWithCard) => void;
}) {
  const paidPct = invoice.totalAmount > 0
    ? Math.min(100, (invoice.paidAmount / invoice.totalAmount) * 100)
    : 0;
  const remaining = invoice.totalAmount - invoice.paidAmount;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Cartão + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-600/20">
              <CardIcon size={11} className="text-sky-400" />
            </div>
            <p className="truncate text-xs text-gray-400 font-medium">
              {invoice.creditCardName}
            </p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        {/* Mês + valor */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-white">{formatMonthYear(invoice.referenceMonth)}</p>
            <p className="text-xs text-gray-500">Vence {formatDate(invoice.dueDate)}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-white tabular-nums">{formatCurrency(invoice.totalAmount)}</p>
            {invoice.status !== "paid" && remaining > 0 && (
              <p className="text-xs text-amber-400">falta {formatCurrency(remaining)}</p>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        {invoice.totalAmount > 0 && (
          <div>
            <div className="h-1.5 rounded-full bg-surface-border">
              <div
                className={cn("h-1.5 rounded-full transition-all", invoice.status === "paid" ? "bg-emerald-500" : "bg-sky-500")}
                style={{ width: `${paidPct}%` }}
              />
            </div>
            {invoice.paidAmount > 0 && invoice.status !== "paid" && (
              <p className="mt-1 text-xs text-gray-500">
                {formatCurrency(invoice.paidAmount)} pago de {formatCurrency(invoice.totalAmount)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-2 border-t border-surface-border px-4 py-3 bg-surface/30">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => onViewTransactions(invoice)}>
          <Receipt size={12} /> Lançamentos
        </Button>
        {invoice.status !== "paid" && invoice.totalAmount > 0 && (
          <Button size="sm" onClick={() => onPay(invoice)}>
            <DollarSign size={12} /> Pagar
          </Button>
        )}
      </div>
    </Card>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export function InvoicesPage() {
  const [viewMode, setViewMode] = useState<"card" | "invoice">("card");
  const [filterCard, setFilterCard] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("");
  const [invoiceModalCard, setInvoiceModalCard] = useState<CreditCard | null>(null);
  const [txModalInvoice, setTxModalInvoice] = useState<InvoiceWithCard | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const { data: cardsData, loading: cardsLoading } = useQuery<{ creditCards: CreditCard[] }>(CREDIT_CARDS_QUERY);
  const { data: allInvData, loading: allInvLoading } = useQuery<{ allInvoices: InvoiceWithCard[] }>(ALL_INVOICES_QUERY);
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);

  const [payInvoice, { loading: paying }] = useMutation(PAY_INVOICE_MUTATION, {
    refetchQueries: [CREDIT_CARDS_QUERY, ALL_INVOICES_QUERY],
    onCompleted: () => { toast.success("Pagamento registrado!"); setPayingInvoice(null); },
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

  const today = new Date();
  const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

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

  function handleQuickFilter(f: QuickFilter) {
    setQuickFilter((q) => (q === f ? "" : f));
    setFilterStatus("");
    setFilterCard("");
  }

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (filterCard && card.id !== filterCard) return false;
      if (quickFilter === "open") return card.currentInvoice && ["open", "partial", "closed"].includes(card.currentInvoice.status);
      if (quickFilter === "due_month") return allInvoices.some((inv) => inv.creditCardId === card.id && inv.status !== "paid" && inv.dueDate.startsWith(currentYM));
      if (quickFilter === "paid_month") return allInvoices.some((inv) => inv.creditCardId === card.id && inv.status === "paid" && inv.referenceMonth.startsWith(currentYM));
      if (filterStatus) return card.currentInvoice ? card.currentInvoice.status === filterStatus : false;
      return true;
    });
  }, [cards, allInvoices, filterCard, quickFilter, filterStatus, currentYM]);

  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      if (filterCard && inv.creditCardId !== filterCard) return false;
      if (quickFilter === "open") return ["open", "partial", "closed"].includes(inv.status);
      if (quickFilter === "due_month") return inv.status !== "paid" && inv.dueDate.startsWith(currentYM);
      if (quickFilter === "paid_month") return inv.status === "paid" && inv.referenceMonth.startsWith(currentYM);
      if (filterStatus) return inv.status === filterStatus;
      return true;
    });
  }, [allInvoices, filterCard, quickFilter, filterStatus, currentYM]);

  function openPay(inv: Invoice) {
    setPayingInvoice(inv);
    payForm.reset({ amount: inv.totalAmount - inv.paidAmount, sourceAccountId: "", paymentDate: todayISO() });
  }

  function onPaySubmit(data: PayFormData) {
    if (!payingInvoice) return;
    payInvoice({ variables: { input: { invoiceId: payingInvoice.id, amount: data.amount, sourceAccountId: data.sourceAccountId, paymentDate: data.paymentDate } } });
  }

  const loading = cardsLoading || allInvLoading;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white">Faturas</h1>
          <p className="text-sm text-gray-500">Acompanhe as faturas dos seus cartões</p>
        </div>

        {/* Toggle de visualização */}
        <div className="flex rounded-lg border border-surface-border bg-surface-card p-0.5 shrink-0">
          <button
            onClick={() => setViewMode("card")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "card" ? "bg-sky-600/20 text-sky-400" : "text-gray-500 hover:text-white"
            )}
          >
            <LayoutGrid size={13} /> Por cartão
          </button>
          <button
            onClick={() => setViewMode("invoice")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "invoice" ? "bg-sky-600/20 text-sky-400" : "text-gray-500 hover:text-white"
            )}
          >
            <List size={13} /> Por fatura
          </button>
        </div>
      </div>

      {/* Métricas clicáveis */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            id: "open" as QuickFilter,
            label: "Total em aberto",
            value: metrics.totalOpen,
            icon: Clock,
            activeClass: "border-blue-500/40 bg-blue-500/10",
            hoverClass: "hover:border-blue-500/30 hover:bg-blue-500/5",
            iconBg: "bg-blue-500/15",
            iconColor: "text-blue-400",
          },
          {
            id: "due_month" as QuickFilter,
            label: "Vence este mês",
            value: metrics.dueSoon,
            icon: AlertCircle,
            activeClass: "border-amber-500/40 bg-amber-500/10",
            hoverClass: "hover:border-amber-500/30 hover:bg-amber-500/5",
            iconBg: "bg-amber-500/15",
            iconColor: "text-amber-400",
          },
          {
            id: "paid_month" as QuickFilter,
            label: "Pago este mês",
            value: metrics.paidThisMonth,
            icon: CheckCircle2,
            activeClass: "border-emerald-500/40 bg-emerald-500/10",
            hoverClass: "hover:border-emerald-500/30 hover:bg-emerald-500/5",
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-400",
          },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => handleQuickFilter(m.id)}
            className={cn(
              "flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
              quickFilter === m.id ? m.activeClass : cn("border-surface-border bg-surface-card", m.hoverClass)
            )}
          >
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", m.iconBg)}>
              <m.icon size={20} className={m.iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className="text-lg font-bold text-white tabular-nums">{formatCurrency(m.value)}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {viewMode === "invoice" && (
          <div className="w-full sm:w-44">
            <Select options={cardFilterOptions} value={filterCard} onChange={(e) => { setFilterCard(e.target.value); setQuickFilter(""); }} />
          </div>
        )}
        <div className="w-full sm:w-44">
          <Select options={STATUS_OPTIONS} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setQuickFilter(""); }} />
        </div>
        {(filterCard || filterStatus || quickFilter) && (
          <Button size="sm" variant="secondary" onClick={() => { setFilterCard(""); setFilterStatus(""); setQuickFilter(""); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-surface-card" />
          ))}
        </div>
      ) : viewMode === "card" ? (
        filteredCards.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-14">
            <CardIcon size={36} className="text-gray-600" />
            <p className="text-sm text-gray-500">
              {cards.length === 0 ? "Nenhum cartão cadastrado." : "Nenhum cartão corresponde aos filtros."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCards.map((card) => (
              <CardCartao key={card.id} card={card} onViewInvoices={setInvoiceModalCard} onPay={openPay} />
            ))}
          </div>
        )
      ) : (
        filteredInvoices.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-14">
            <FileText size={36} className="text-gray-600" />
            <p className="text-sm text-gray-500">
              {allInvoices.length === 0 ? "Nenhuma fatura encontrada." : "Nenhuma fatura corresponde aos filtros."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredInvoices.map((inv) => (
              <InvoiceFlatCard key={inv.id} invoice={inv} onPay={openPay} onViewTransactions={setTxModalInvoice} />
            ))}
          </div>
        )
      )}

      {/* Modal: histórico de faturas do cartão */}
      <ModalFaturas
        card={invoiceModalCard}
        open={!!invoiceModalCard}
        onClose={() => setInvoiceModalCard(null)}
        onPay={openPay}
      />

      {/* Modal: lançamentos da fatura (view por fatura) */}
      <Modal
        open={!!txModalInvoice}
        onClose={() => setTxModalInvoice(null)}
        title={txModalInvoice ? `${txModalInvoice.creditCardName} · ${formatMonthYear(txModalInvoice.referenceMonth)}` : ""}
        size="lg"
      >
        {txModalInvoice && (
          <TransactionsView invoice={txModalInvoice} onBack={() => setTxModalInvoice(null)} />
        )}
      </Modal>

      {/* Modal: pagar fatura */}
      <Modal open={!!payingInvoice} onClose={() => setPayingInvoice(null)} title="Pagar fatura" size="sm">
        {payingInvoice && (
          <div className="space-y-4">
            {/* Resumo da fatura */}
            <div className="rounded-xl border border-surface-border bg-surface p-4 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">Fatura</p>
                  <p className="text-sm font-semibold text-white">{formatMonthYear(payingInvoice.referenceMonth)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white tabular-nums">{formatCurrency(payingInvoice.totalAmount)}</p>
                  {payingInvoice.paidAmount > 0 && (
                    <p className="text-xs text-amber-400">
                      falta {formatCurrency(payingInvoice.totalAmount - payingInvoice.paidAmount)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="space-y-3">
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
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setPayingInvoice(null)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" loading={paying}>
                  <DollarSign size={14} /> Registrar
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
