import { useMutation, useQuery } from "@apollo/client";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { z } from "zod";
import {
  CreditCard as CardIcon,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
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

function getMonthYM(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function prevMonthOf(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function nextMonthOf(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function statusConfig(status: string) {
  return (
    {
      open:    { bg: "bg-blue-500/12 text-blue-400",    dot: "bg-blue-400" },
      closed:  { bg: "bg-amber-500/12 text-amber-400",  dot: "bg-amber-400" },
      partial: { bg: "bg-orange-500/12 text-orange-400", dot: "bg-orange-400" },
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


export function InvoicesPage() {
  const now = new Date();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [navMonth, setNavMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const { data: cardsData, loading: cardsLoading } = useQuery<{ creditCards: CreditCard[] }>(CREDIT_CARDS_QUERY);
  const { data: allInvData } = useQuery<{ allInvoices: InvoiceWithCard[] }>(ALL_INVOICES_QUERY);
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);

  const cards = cardsData?.creditCards ?? [];
  const allInvoices = allInvData?.allInvoices ?? [];
  const accounts = accountsData?.accounts ?? [];

  const effectiveCardId = selectedCardId ?? cards[0]?.id ?? null;
  const selectedCard = cards.find((c) => c.id === effectiveCardId) ?? null;

  const { data: cardInvData, loading: cardInvLoading } = useQuery<{ invoices: Invoice[] }>(INVOICES_QUERY, {
    variables: { creditCardId: effectiveCardId },
    skip: !effectiveCardId,
  });
  const cardInvoices = cardInvData?.invoices ?? [];

  const selectedMonthYM = getMonthYM(navMonth.year, navMonth.month);
  const selectedInvoice = cardInvoices.find((inv) => inv.referenceMonth.startsWith(selectedMonthYM)) ?? null;

  const { data: txData, loading: txLoading } = useQuery<{ invoiceTransactions: Transaction[] }>(
    INVOICE_TRANSACTIONS_QUERY,
    { variables: { invoiceId: selectedInvoice?.id }, skip: !selectedInvoice }
  );
  const transactions = txData?.invoiceTransactions ?? [];

  const today = new Date();
  const currentYM = getMonthYM(today.getFullYear(), today.getMonth() + 1);

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

  const groupedTxs = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((tx) => {
        const list = groups.get(tx.date) ?? [];
        list.push(tx);
        groups.set(tx.date, list);
      });
    return Array.from(groups.entries());
  }, [transactions]);

  const [payInvoice, { loading: paying }] = useMutation(PAY_INVOICE_MUTATION, {
    refetchQueries: [CREDIT_CARDS_QUERY, ALL_INVOICES_QUERY, INVOICES_QUERY],
    onCompleted: () => { toast.success("Pagamento registrado!"); setPayingInvoice(null); },
    onError: (e) => toast.error(e.message),
  });

  const payForm = useForm<PayFormData>({
    resolver: zodResolver(paySchema),
    defaultValues: { paymentDate: todayISO() },
  });

  function openPay(inv: Invoice) {
    setPayingInvoice(inv);
    payForm.reset({ amount: inv.totalAmount - inv.paidAmount, sourceAccountId: "", paymentDate: todayISO() });
  }

  function onPaySubmit(data: PayFormData) {
    if (!payingInvoice) return;
    payInvoice({ variables: { input: { invoiceId: payingInvoice.id, ...data } } });
  }

  const usedAmount = selectedCard ? selectedCard.totalLimit - selectedCard.availableLimit : 0;
  const usedPct = selectedCard && selectedCard.totalLimit > 0
    ? Math.min(100, (usedAmount / selectedCard.totalLimit) * 100)
    : 0;

  const monthLabel = new Date(navMonth.year, navMonth.month - 1, 1)
    .toLocaleString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Faturas</h1>
        <p className="text-sm text-gray-500">Acompanhe as faturas dos seus cartões</p>
      </div>

      {/* Métricas resumo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          {
            label: "Total em aberto",
            value: metrics.totalOpen,
            icon: Clock,
            iconBg: "bg-blue-500/15",
            iconColor: "text-blue-400",
            valueColor: "text-blue-300",
          },
          {
            label: "Vence este mês",
            value: metrics.dueSoon,
            icon: AlertCircle,
            iconBg: "bg-amber-500/15",
            iconColor: "text-amber-400",
            valueColor: "text-amber-300",
          },
          {
            label: "Pago este mês",
            value: metrics.paidThisMonth,
            icon: CheckCircle2,
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-400",
            valueColor: "text-emerald-300",
          },
        ].map((m) => (
          <div key={m.label} className="flex flex-col gap-1.5 rounded-xl border border-surface-border bg-surface-card p-3 sm:p-4">
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", m.iconBg)}>
              <m.icon size={14} className={m.iconColor} />
            </div>
            <p className="text-[11px] leading-tight text-gray-500">{m.label}</p>
            <p className={cn("text-sm font-bold tabular-nums sm:text-base", m.valueColor)}>
              {formatCurrency(m.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Seletor de cartões */}
      {cardsLoading ? (
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 w-36 shrink-0 animate-pulse rounded-xl bg-surface-card" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12">
          <CardIcon size={36} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhum cartão cadastrado.</p>
        </Card>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cards.map((card) => {
            const isActive = card.id === effectiveCardId;
            const hasPending = card.currentInvoice &&
              ["open", "partial", "closed"].includes(card.currentInvoice.status) &&
              card.currentInvoice.totalAmount > 0;
            return (
              <button
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all",
                  isActive
                    ? "border-sky-500/40 bg-sky-500/10"
                    : "border-surface-border bg-surface-card text-gray-400 hover:border-sky-500/20 hover:text-white"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  isActive ? "bg-sky-500/20" : "bg-surface"
                )}>
                  <CardIcon size={14} className={isActive ? "text-sky-400" : "text-gray-500"} />
                </div>
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-medium max-w-[110px]", isActive ? "text-white" : "text-gray-300")}>
                    {card.name}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">
                    {card.currentInvoice
                      ? formatCurrency(card.currentInvoice.totalAmount)
                      : (CREDIT_CARD_BRAND_LABELS[card.brand] ?? card.brand)}
                  </p>
                </div>
                {hasPending && (
                  <span className="ml-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo do cartão selecionado */}
      {selectedCard && (
        <div className="space-y-4">
          {/* Info do limite */}
          <div className="rounded-xl border border-surface-border bg-surface-card p-3 sm:p-4">
            <div className="flex items-center justify-between gap-4 mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600/20">
                  <CardIcon size={14} className="text-sky-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{selectedCard.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {CREDIT_CARD_BRAND_LABELS[selectedCard.brand] ?? selectedCard.brand}
                    {" · "}fecha dia {selectedCard.closingDay} · vence dia {selectedCard.dueDay}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">Disponível</p>
                <p className="text-sm font-bold text-emerald-400 tabular-nums">
                  {formatCurrency(selectedCard.availableLimit)}
                </p>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-surface-border overflow-hidden">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  usedPct > 90 ? "bg-red-500" : usedPct > 70 ? "bg-amber-500" : "bg-sky-500"
                )}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-600">
              {formatCurrency(usedAmount)} usado de {formatCurrency(selectedCard.totalLimit)} ({usedPct.toFixed(0)}%)
            </p>
          </div>

          {/* Navegação de mês */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setNavMonth((m) => prevMonthOf(m.year, m.month))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-hover hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold capitalize text-white">{monthLabel}</span>
            <button
              onClick={() => setNavMonth((m) => nextMonthOf(m.year, m.month))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-hover hover:text-white transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Resumo da fatura */}
          {cardInvLoading ? (
            <div className="h-36 animate-pulse rounded-xl bg-surface-card" />
          ) : selectedInvoice ? (
            <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4">
                {/* Valor + status + datas */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-3xl font-bold text-white tabular-nums">
                      {formatCurrency(selectedInvoice.totalAmount)}
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={selectedInvoice.status} />
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500 shrink-0 space-y-1">
                    <div className="flex items-center justify-end gap-1">
                      <Calendar size={11} />
                      <span>Fecha {formatDate(selectedInvoice.closingDate)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <AlertCircle size={11} className="text-amber-500/70" />
                      <span className="text-amber-400/80">Vence {formatDate(selectedInvoice.dueDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Barra de progresso */}
                {selectedInvoice.totalAmount > 0 && (
                  <div>
                    <div className="h-2 rounded-full bg-surface-border overflow-hidden">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all",
                          selectedInvoice.status === "paid" ? "bg-emerald-500" : "bg-sky-500"
                        )}
                        style={{
                          width: `${Math.min(100, (selectedInvoice.paidAmount / selectedInvoice.totalAmount) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        {selectedInvoice.paidAmount > 0
                          ? `${formatCurrency(selectedInvoice.paidAmount)} pago`
                          : "Nenhum pagamento registrado"}
                      </span>
                      {selectedInvoice.status !== "paid" && selectedInvoice.paidAmount < selectedInvoice.totalAmount && (
                        <span className="text-amber-400">
                          falta {formatCurrency(selectedInvoice.totalAmount - selectedInvoice.paidAmount)}
                        </span>
                      )}
                      {selectedInvoice.status === "paid" && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 size={11} /> Paga
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Botão pagar */}
                {selectedInvoice.status !== "paid" && selectedInvoice.totalAmount > 0 && (
                  <Button onClick={() => openPay(selectedInvoice)} className="w-full">
                    <DollarSign size={15} /> Pagar fatura
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-border py-10">
              <Receipt size={28} className="text-gray-600" />
              <p className="text-sm text-gray-500">Sem fatura para este mês.</p>
            </div>
          )}

          {/* Gráfico + lançamentos */}
          {selectedInvoice && (
            <>
              {/* Lista de lançamentos */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Lançamentos</p>
                  {!txLoading && (
                    <span className="text-xs text-gray-500">
                      {transactions.length} item{transactions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {txLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-card" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-border py-10">
                    <Receipt size={28} className="text-gray-600" />
                    <p className="text-sm text-gray-500">Nenhum lançamento nesta fatura.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-surface-border overflow-hidden">
                      {groupedTxs.map(([date, txList], groupIdx) => (
                        <div key={date}>
                          {/* Cabeçalho de data */}
                          <div className={cn(
                            "px-4 py-2 bg-surface/60",
                            groupIdx > 0 && "border-t border-surface-border"
                          )}>
                            <p className="text-xs font-semibold capitalize text-gray-500">
                              {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                              })}
                            </p>
                          </div>

                          {/* Lançamentos do dia */}
                          <div className="divide-y divide-surface-border/50">
                            {txList.map((tx) => (
                              <div
                                key={tx.id}
                                className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover/30 transition-colors"
                              >
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

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium leading-snug text-white">
                                    {tx.description}
                                  </p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    {tx.category && (
                                      <span
                                        className="text-xs font-medium"
                                        style={{ color: tx.category.color }}
                                      >
                                        {tx.category.name}
                                      </span>
                                    )}
                                    {tx.installmentNumber && tx.totalInstallments && (
                                      <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-gray-400">
                                        {tx.installmentNumber}/{tx.totalInstallments}x
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <p className="shrink-0 text-sm font-bold tabular-nums text-red-400">
                                  {formatCurrency(tx.amount)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total dos lançamentos */}
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-surface-border bg-surface-card px-4 py-3">
                      <p className="text-sm text-gray-500">
                        {transactions.length} lançamento{transactions.length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-red-400" />
                        <p className="text-sm font-bold tabular-nums text-white">
                          {formatCurrency(transactions.reduce((s, t) => s + t.amount, 0))}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal: pagar fatura */}
      <Modal open={!!payingInvoice} onClose={() => setPayingInvoice(null)} title="Pagar fatura" size="sm">
        {payingInvoice && (
          <div className="space-y-4">
            <div className="rounded-xl border border-surface-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">Fatura</p>
                  <p className="text-sm font-semibold text-white">
                    {formatMonthYear(payingInvoice.referenceMonth)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold tabular-nums text-white">
                    {formatCurrency(payingInvoice.totalAmount)}
                  </p>
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
                options={[
                  { value: "", label: "Selecione a conta" },
                  ...accounts.map((a) => ({ value: a.id, label: a.name })),
                ]}
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
