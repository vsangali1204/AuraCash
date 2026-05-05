import { useMutation, useQuery } from "@apollo/client";
import { useState, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  DollarSign, Users, CheckSquare, Square, AlertCircle,
  Clock, Calendar, ChevronDown, ChevronUp, CreditCard, ArrowLeftRight,
  List, UserCheck, Search, X,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  RECEIVABLE_TRANSACTIONS_QUERY,
  CREATE_RECEIPT_MUTATION,
  BULK_RECEIVE_MUTATION,
  RECEIVABLE_SUMMARY_QUERY,
} from "@/graphql/queries/receivables";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import {
  formatCurrency, formatDate, formatMonthYear,
  RECEIPT_STATUS_LABELS, PAYMENT_METHOD_LABELS, todayISO,
} from "@/lib/utils";
import type { Account, Transaction } from "@/types";

// ── Schemas ────────────────────────────────────────────────────────────────

const receiptSchema = z.object({
  amountReceived: z.coerce.number().positive("Valor positivo"),
  receiptDate: z.string().min(1, "Data obrigatória"),
  destinationAccountId: z.string().min(1, "Conta obrigatória"),
  notes: z.string().optional(),
});

const bulkSchema = z.object({
  receiptDate: z.string().min(1, "Data obrigatória"),
  destinationAccountId: z.string().min(1, "Conta obrigatória"),
  notes: z.string().optional(),
});

type ReceiptFormData = z.infer<typeof receiptSchema>;
type BulkFormData = z.infer<typeof bulkSchema>;

// ── Período helpers ────────────────────────────────────────────────────────

type Period = "next_month" | "this_month" | "overdue" | "all";
type ViewMode = "list" | "by_person";

const PERIOD_TABS: { value: Period; label: string; icon: React.ReactNode }[] = [
  { value: "next_month", label: "Próximo mês",  icon: <Calendar size={13} /> },
  { value: "this_month", label: "Este mês",     icon: <Clock size={13} /> },
  { value: "overdue",    label: "Atrasados",    icon: <AlertCircle size={13} /> },
  { value: "all",        label: "Todos",        icon: <Users size={13} /> },
];

const NO_DEBTOR_KEY = "__sem_devedor__";

// ── Component ──────────────────────────────────────────────────────────────

export function ReceivablesPage() {
  const [period, setPeriod] = useState<Period>("next_month");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [debtorFilter, setDebtorFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [receivingTx, setReceivingTx] = useState<Transaction | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkPersonLabel, setBulkPersonLabel] = useState<string | null>(null);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: txData, loading } = useQuery<{ receivableTransactions: Transaction[] }>(
    RECEIVABLE_TRANSACTIONS_QUERY,
    {
      variables: { period: period === "all" ? null : period },
      fetchPolicy: "cache-and-network",
    }
  );

  const { data: summaryData } = useQuery<{ receivableTransactions: Transaction[] }>(
    RECEIVABLE_TRANSACTIONS_QUERY,
    { variables: { period: null }, fetchPolicy: "cache-and-network" }
  );

  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);

  const transactions = txData?.receivableTransactions ?? [];
  const allTxs = summaryData?.receivableTransactions ?? [];
  const accounts = accountsData?.accounts ?? [];
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  // ── Totais do cabeçalho ───────────────────────────────────────────────────

  const now = new Date();
  const nextM = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
  const nextY = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();

  function isNextMonth(tx: Transaction) {
    if (!tx.competenceDate) return false;
    const [y, m] = tx.competenceDate.split("-").map(Number);
    return y === nextY && m === nextM;
  }
  function isThisMonth(tx: Transaction) {
    if (!tx.competenceDate) return false;
    const [y, m] = tx.competenceDate.split("-").map(Number);
    return y === now.getFullYear() && m === now.getMonth() + 1;
  }
  function isOverdue(tx: Transaction) {
    if (!tx.competenceDate) return false;
    return tx.competenceDate < todayISO();
  }

  const totalPending = allTxs.reduce((s, t) => s + t.remainingAmount, 0);
  const nextMonthTotal = allTxs.filter(isNextMonth).reduce((s, t) => s + t.remainingAmount, 0);
  const thisMonthTotal = allTxs.filter(isThisMonth).reduce((s, t) => s + t.remainingAmount, 0);
  const overdueTotal   = allTxs.filter(isOverdue).reduce((s, t) => s + t.remainingAmount, 0);

  // ── Filtro por devedor ────────────────────────────────────────────────────

  const filteredTransactions = useMemo(() => {
    if (!debtorFilter.trim()) return transactions;
    const q = debtorFilter.toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.debtorName?.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q)
    );
  }, [transactions, debtorFilter]);

  // ── Agrupamento por pessoa ────────────────────────────────────────────────

  const groupedByPerson = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filteredTransactions) {
      const key = tx.debtorName ?? NO_DEBTOR_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    // Ordena por saldo pendente decrescente
    return new Map(
      [...map.entries()].sort(
        ([, a], [, b]) =>
          b.reduce((s, t) => s + t.remainingAmount, 0) -
          a.reduce((s, t) => s + t.remainingAmount, 0)
      )
    );
  }, [filteredTransactions]);

  const debtorNames = useMemo(
    () =>
      [...new Set(allTxs.map((tx) => tx.debtorName).filter(Boolean) as string[])].sort(),
    [allTxs]
  );

  // ── Seleção ───────────────────────────────────────────────────────────────

  const pendingIds = filteredTransactions.map((t) => t.id);
  const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingIds));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function togglePerson(key: string) {
    const personTxs = groupedByPerson.get(key) ?? [];
    const allPersonSelected = personTxs.every((tx) => selected.has(tx.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPersonSelected) {
        personTxs.forEach((tx) => next.delete(tx.id));
      } else {
        personTxs.forEach((tx) => next.add(tx.id));
      }
      return next;
    });
  }

  function selectOnlyPerson(key: string) {
    const personTxs = groupedByPerson.get(key) ?? [];
    setSelected(new Set(personTxs.map((tx) => tx.id)));
  }

  function changePeriod(p: Period) {
    setPeriod(p);
    setSelected(new Set());
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const refetchVars = [
    { query: RECEIVABLE_TRANSACTIONS_QUERY, variables: { period: period === "all" ? null : period } },
    { query: RECEIVABLE_TRANSACTIONS_QUERY, variables: { period: null } },
    { query: RECEIVABLE_SUMMARY_QUERY },
    { query: ACCOUNTS_QUERY },
  ];

  const [createReceipt, { loading: registering }] = useMutation(CREATE_RECEIPT_MUTATION, {
    refetchQueries: refetchVars,
    onCompleted: () => { toast.success("Recebimento registrado!"); setReceivingTx(null); },
    onError: (e) => toast.error(e.message),
  });

  const [bulkReceive, { loading: bulkLoading }] = useMutation(BULK_RECEIVE_MUTATION, {
    refetchQueries: refetchVars,
    onCompleted: (d) => {
      toast.success(`${d.bulkReceive} recebimento(s) registrado(s)!`);
      setBulkModalOpen(false);
      setBulkPersonLabel(null);
      setSelected(new Set());
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Forms ─────────────────────────────────────────────────────────────────

  const receiptForm = useForm<ReceiptFormData>({
    resolver: zodResolver(receiptSchema),
    defaultValues: { receiptDate: todayISO() },
  });

  const bulkForm = useForm<BulkFormData>({
    resolver: zodResolver(bulkSchema),
    defaultValues: { receiptDate: todayISO() },
  });

  function openReceipt(tx: Transaction) {
    setReceivingTx(tx);
    receiptForm.reset({
      amountReceived: tx.remainingAmount,
      receiptDate: todayISO(),
      destinationAccountId: accounts[0]?.id ?? "",
    });
  }

  function openBulk(personLabel?: string) {
    bulkForm.reset({
      receiptDate: todayISO(),
      destinationAccountId: accounts[0]?.id ?? "",
    });
    setBulkPersonLabel(personLabel ?? null);
    setBulkModalOpen(true);
  }

  function openBulkForPerson(key: string) {
    selectOnlyPerson(key);
    const label = key === NO_DEBTOR_KEY ? "sem devedor" : key;
    openBulk(label);
  }

  function onReceiptSubmit(data: ReceiptFormData) {
    if (!receivingTx) return;
    createReceipt({
      variables: {
        input: {
          transactionId: receivingTx.id,
          amountReceived: data.amountReceived,
          receiptDate: data.receiptDate,
          destinationAccountId: data.destinationAccountId,
          notes: data.notes || null,
        },
      },
    });
  }

  function onBulkSubmit(data: BulkFormData) {
    bulkReceive({
      variables: {
        input: {
          transactionIds: Array.from(selected),
          receiptDate: data.receiptDate,
          destinationAccountId: data.destinationAccountId,
          notes: data.notes || null,
        },
      },
    });
  }

  const selectedAmount = filteredTransactions
    .filter((t) => selected.has(t.id))
    .reduce((s, t) => s + t.remainingAmount, 0);

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderTxRow(tx: Transaction) {
    const isSelected = selected.has(tx.id);
    const isExpanded = expandedTx === tx.id;
    const isOverdueItem = tx.competenceDate && tx.competenceDate < todayISO();

    return (
      <div key={tx.id} className={`transition-colors ${isSelected ? "bg-sky-500/5" : ""}`}>
        <div className="flex items-start gap-3 px-4 py-3">
          <button
            onClick={() => toggleOne(tx.id)}
            className="mt-0.5 shrink-0 text-gray-400 hover:text-sky-400 transition-colors"
          >
            {isSelected
              ? <CheckSquare size={18} className="text-sky-400" />
              : <Square size={18} />}
          </button>

          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            tx.transactionType === "expense" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
          }`}>
            {tx.paymentMethod === "credit" ? <CreditCard size={14} /> : <ArrowLeftRight size={14} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-white truncate">{tx.description}</p>
                  {tx.totalInstallments && tx.totalInstallments > 1 && (
                    <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-gray-400 shrink-0">
                      {tx.installmentNumber}/{tx.totalInstallments}x
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {tx.debtorName && viewMode === "list" && (
                    <span className="text-xs font-medium text-amber-400">↩ {tx.debtorName}</span>
                  )}
                  <span className="text-xs text-gray-500">{formatDate(tx.date)}</span>
                  <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[tx.paymentMethod]}</span>
                  {tx.competenceDate && (
                    <span className={`text-xs font-medium ${isOverdueItem ? "text-red-400" : "text-sky-400"}`}>
                      {isOverdueItem ? "⚠ Venceu " : "Prev. "}
                      {formatDate(tx.competenceDate)}
                    </span>
                  )}
                  {tx.receiptStatus && (
                    <Badge variant={tx.receiptStatus === "partial" ? "default" : "neutral"}>
                      {RECEIPT_STATUS_LABELS[tx.receiptStatus]}
                    </Badge>
                  )}
                </div>
                {tx.receivedAmount > 0 && (
                  <p className="mt-0.5 text-xs text-emerald-400">
                    Recebido: {formatCurrency(tx.receivedAmount)}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <p className="text-sm font-semibold text-white whitespace-nowrap">
                  {formatCurrency(tx.amount)}
                </p>
                {tx.remainingAmount < tx.amount && (
                  <p className="text-xs text-amber-400 whitespace-nowrap">
                    Pendente: {formatCurrency(tx.remainingAmount)}
                  </p>
                )}
                <div className="flex items-center gap-1">
                  {tx.invoice && (
                    <button
                      onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-hover hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => openReceipt(tx)}>
                    <DollarSign size={12} /> Receber
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isExpanded && tx.invoice && (
          <div className="border-t border-surface-border bg-surface px-4 py-2 text-xs text-gray-400 flex flex-wrap gap-3">
            <span>Cartão: {tx.creditCard?.name}</span>
            <span>Fatura: {formatMonthYear(tx.invoice.referenceMonth)}</span>
            <span>Venc.: {formatDate(tx.invoice.dueDate)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Valores a Receber</h1>
        <p className="text-sm text-gray-500">
          Total pendente:{" "}
          <span className="text-amber-400 font-semibold">{formatCurrency(totalPending)}</span>
        </p>
      </div>

      {/* Cards de resumo por período */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Próximo mês", value: nextMonthTotal, color: "sky",   period: "next_month" as Period },
          { label: "Este mês",    value: thisMonthTotal, color: "blue",  period: "this_month" as Period },
          { label: "Atrasados",   value: overdueTotal,   color: "red",   period: "overdue" as Period },
          { label: "Total geral", value: totalPending,   color: "amber", period: "all" as Period },
        ].map((card) => (
          <button
            key={card.period}
            onClick={() => changePeriod(card.period)}
            className={`rounded-xl border p-3 text-left transition-all ${
              period === card.period
                ? `border-${card.color}-500/40 bg-${card.color}-500/10`
                : "border-surface-border bg-surface-card hover:border-surface-hover"
            }`}
          >
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className={`mt-1 text-base font-bold ${
              card.color === "red" && card.value > 0 ? "text-red-400"
              : card.color === "sky" ? "text-sky-400"
              : card.color === "blue" ? "text-blue-400"
              : "text-amber-400"
            }`}>
              {formatCurrency(card.value)}
            </p>
          </button>
        ))}
      </div>

      {/* Tabs de período + controles de visualização */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => changePeriod(tab.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === tab.value
                  ? "bg-sky-600 text-white"
                  : "border border-surface-border bg-surface-card text-gray-400 hover:text-white"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Toggle de visualização */}
        <div className="flex rounded-lg border border-surface-border overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "list"
                ? "bg-surface-hover text-white"
                : "bg-surface-card text-gray-400 hover:text-white"
            }`}
          >
            <List size={14} /> Lista
          </button>
          <button
            onClick={() => setViewMode("by_person")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-l border-surface-border ${
              viewMode === "by_person"
                ? "bg-surface-hover text-white"
                : "bg-surface-card text-gray-400 hover:text-white"
            }`}
          >
            <UserCheck size={14} /> Por pessoa
          </button>
        </div>
      </div>

      {/* Filtro por nome */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder={
            viewMode === "by_person"
              ? "Filtrar por pessoa ou descrição…"
              : "Filtrar por devedor ou descrição…"
          }
          value={debtorFilter}
          onChange={(e) => setDebtorFilter(e.target.value)}
          className="w-full rounded-lg border border-surface-border bg-surface-card py-2 pl-8 pr-8 text-sm text-white placeholder-gray-500 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/20"
        />
        {debtorFilter && (
          <button
            onClick={() => setDebtorFilter("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Barra de ação em lote */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">
              {selected.size} selecionado(s)
            </p>
            <p className="text-xs text-gray-400">
              Total: <span className="text-emerald-400 font-semibold">{formatCurrency(selectedAmount)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
            <Button size="sm" onClick={() => openBulk()}>
              <DollarSign size={14} /> Receber todos
            </Button>
          </div>
        </div>
      )}

      {/* ── VISUALIZAÇÃO LISTA ──────────────────────────────────────────────── */}
      {viewMode === "list" && (
        <>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-card" />)}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-16">
              <Users size={40} className="text-gray-600" />
              <p className="text-sm text-gray-500">
                {debtorFilter
                  ? `Nenhum resultado para "${debtorFilter}".`
                  : period === "next_month" ? "Nenhum valor previsto para o próximo mês."
                  : period === "this_month" ? "Nenhum valor previsto para este mês."
                  : period === "overdue" ? "Nenhum valor atrasado."
                  : "Nenhum valor a receber pendente."}
              </p>
            </Card>
          ) : (
            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
                <button onClick={toggleAll} className="text-gray-400 hover:text-white transition-colors shrink-0">
                  {allSelected ? <CheckSquare size={18} className="text-sky-400" /> : <Square size={18} />}
                </button>
                <span className="text-xs font-medium text-gray-500 flex-1">
                  {filteredTransactions.length} lançamento(s) · {formatCurrency(filteredTransactions.reduce((s, t) => s + t.remainingAmount, 0))} pendente
                </span>
              </div>
              <div className="divide-y divide-surface-border">
                {filteredTransactions.map(renderTxRow)}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── VISUALIZAÇÃO POR PESSOA ─────────────────────────────────────────── */}
      {viewMode === "by_person" && (
        <>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-card" />)}
            </div>
          ) : groupedByPerson.size === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-16">
              <UserCheck size={40} className="text-gray-600" />
              <p className="text-sm text-gray-500">
                {debtorFilter ? `Nenhum resultado para "${debtorFilter}".` : "Nenhum valor a receber pendente."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {[...groupedByPerson.entries()].map(([key, txs]) => {
                const personLabel = key === NO_DEBTOR_KEY ? "Sem devedor" : key;
                const personPending = txs.reduce((s, t) => s + t.remainingAmount, 0);
                const personTotal = txs.reduce((s, t) => s + t.amount, 0);
                const personSelected = txs.every((tx) => selected.has(tx.id));
                const personPartial = txs.some((tx) => selected.has(tx.id)) && !personSelected;
                const isExpanded = expandedPerson === key;

                return (
                  <Card key={key} padding="none" className="overflow-hidden">
                    {/* Cabeçalho da pessoa */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => togglePerson(key)}
                        className="shrink-0 text-gray-400 hover:text-sky-400 transition-colors"
                      >
                        {personSelected
                          ? <CheckSquare size={18} className="text-sky-400" />
                          : personPartial
                          ? <CheckSquare size={18} className="text-sky-400/50" />
                          : <Square size={18} />}
                      </button>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                        <Users size={16} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{personLabel}</p>
                        <p className="text-xs text-gray-500">
                          {txs.length} lançamento(s) · total {formatCurrency(personTotal)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-bold text-amber-400 whitespace-nowrap">
                            {formatCurrency(personPending)}
                          </p>
                          <p className="text-xs text-gray-500">pendente</p>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => openBulkForPerson(key)}
                          title={`Receber tudo de ${personLabel}`}
                        >
                          <DollarSign size={12} /> Receber tudo
                        </Button>

                        <button
                          onClick={() => setExpandedPerson(isExpanded ? null : key)}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-hover hover:text-white transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Lançamentos da pessoa (expansível) */}
                    {isExpanded && (
                      <div className="border-t border-surface-border divide-y divide-surface-border">
                        {txs.map(renderTxRow)}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal — Registrar recebimento individual */}
      <Modal open={!!receivingTx} onClose={() => setReceivingTx(null)} title="Registrar recebimento" size="sm">
        {receivingTx && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface p-3 text-sm space-y-1">
              <p className="font-medium text-white">{receivingTx.description}</p>
              {receivingTx.debtorName && (
                <p className="text-gray-500">Devedor: <span className="text-white">{receivingTx.debtorName}</span></p>
              )}
              {receivingTx.competenceDate && (
                <p className="text-gray-500">Previsão: <span className="text-sky-400">{formatDate(receivingTx.competenceDate)}</span></p>
              )}
              {receivingTx.receivedAmount > 0 && (
                <p className="text-gray-500">Já recebido: <span className="text-emerald-400">{formatCurrency(receivingTx.receivedAmount)}</span></p>
              )}
              <p className="text-gray-500">Pendente: <span className="text-amber-400 font-semibold">{formatCurrency(receivingTx.remainingAmount)}</span></p>
            </div>
            <form onSubmit={receiptForm.handleSubmit(onReceiptSubmit)} className="space-y-4">
              <Input label="Valor recebido (R$)" type="number" step="0.01"
                error={receiptForm.formState.errors.amountReceived?.message}
                {...receiptForm.register("amountReceived")} />
              <Input label="Data do recebimento" type="date"
                error={receiptForm.formState.errors.receiptDate?.message}
                {...receiptForm.register("receiptDate")} />
              <Select label="Conta destino" options={accountOptions} placeholder="Selecione"
                error={receiptForm.formState.errors.destinationAccountId?.message}
                {...receiptForm.register("destinationAccountId")} />
              <Input label="Observação (opcional)" {...receiptForm.register("notes")} />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setReceivingTx(null)}>Cancelar</Button>
                <Button type="submit" loading={registering}>Registrar</Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Modal — Receber em lote */}
      <Modal open={bulkModalOpen} onClose={() => { setBulkModalOpen(false); setBulkPersonLabel(null); }} title="Receber em lote" size="sm">
        <div className="space-y-4">
          <div className="rounded-lg bg-surface p-3 text-sm space-y-1">
            {bulkPersonLabel && (
              <p className="font-medium text-white">
                Devedor: <span className="text-amber-400">{bulkPersonLabel}</span>
              </p>
            )}
            <p className="text-gray-500">
              Serão registrados <span className="text-white font-semibold">{selected.size} recebimento(s)</span>
            </p>
            <p className="text-gray-500">
              Valor total: <span className="text-emerald-400 font-semibold">{formatCurrency(selectedAmount)}</span>
            </p>
            <p className="text-xs text-gray-600">
              Cada lançamento será recebido pelo seu saldo pendente integral.
            </p>
          </div>
          <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-4">
            <Input label="Data do recebimento" type="date"
              error={bulkForm.formState.errors.receiptDate?.message}
              {...bulkForm.register("receiptDate")} />
            <Select label="Conta destino" options={accountOptions} placeholder="Selecione"
              error={bulkForm.formState.errors.destinationAccountId?.message}
              {...bulkForm.register("destinationAccountId")} />
            <Input label="Observação (opcional)" {...bulkForm.register("notes")} />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => { setBulkModalOpen(false); setBulkPersonLabel(null); }}>Cancelar</Button>
              <Button type="submit" loading={bulkLoading}>
                <DollarSign size={14} /> Confirmar recebimento
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
