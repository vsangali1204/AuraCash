import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import { useState, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import toast from "react-hot-toast";
import {
  DollarSign, Users, CheckSquare, Square, AlertCircle,
  Clock, Calendar, ChevronDown, ChevronUp, List,
  UserCheck, Search, X, TrendingDown, TrendingUp,
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
  RECEIPTS_QUERY,
} from "@/graphql/queries/receivables";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import {
  cn, formatCurrency, formatDate,
  RECEIPT_STATUS_LABELS, PAYMENT_METHOD_LABELS, todayISO,
} from "@/lib/utils";
import type { Account, Transaction, Receipt } from "@/types";

const receiptSchema = z.object({
  amountReceived: z.coerce.number().positive("Valor positivo"),
  receiptDate: z.string().min(1, "Data obrigatória"),
  destinationAccountId: z.string().min(1, "Conta obrigatória"),
  notes: z.string().optional(),
  deferRemainingToDate: z.string().optional(),
});

const bulkSchema = z.object({
  receiptDate: z.string().min(1, "Data obrigatória"),
  destinationAccountId: z.string().min(1, "Conta obrigatória"),
  notes: z.string().optional(),
  totalAmount: z.coerce.number().positive("Valor positivo").optional().or(z.literal("")),
});

type ReceiptFormData = z.infer<typeof receiptSchema>;
type BulkFormData = z.infer<typeof bulkSchema>;

type Period = "next_month" | "this_month" | "overdue" | "all";
type ViewMode = "list" | "by_person";

const PERIOD_TABS: { value: Period; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { value: "next_month", label: "Próximo mês",  shortLabel: "Próx. mês", icon: <Calendar size={13} /> },
  { value: "this_month", label: "Este mês",     shortLabel: "Este mês",  icon: <Clock size={13} /> },
  { value: "overdue",    label: "Atrasados",    shortLabel: "Atrasados", icon: <AlertCircle size={13} /> },
  { value: "all",        label: "Todos",        shortLabel: "Todos",     icon: <Users size={13} /> },
];

const NO_DEBTOR_KEY = "__sem_devedor__";

type ReceiptModalFormProps = {
  form: UseFormReturn<ReceiptFormData>;
  onSubmit: (data: ReceiptFormData) => void;
  accountOptions: { value: string; label: string }[];
  receivingTx: Transaction;
  deferRemaining: boolean;
  setDeferRemaining: (v: boolean) => void;
  registering: boolean;
  onCancel: () => void;
};

function ReceiptModalForm({
  form,
  onSubmit,
  accountOptions,
  receivingTx,
  deferRemaining,
  setDeferRemaining,
  registering,
  onCancel,
}: ReceiptModalFormProps) {
  const watchedAmount = useWatch({ control: form.control, name: "amountReceived" });
  const parsedAmount = Number(watchedAmount) || 0;
  const leftover = receivingTx.remainingAmount - parsedAmount;
  const isPartial = parsedAmount > 0 && leftover > 0;
  const isOverpayment = parsedAmount > receivingTx.remainingAmount;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <Input
        label="Valor recebido (R$)"
        type="number"
        step="0.01"
        error={form.formState.errors.amountReceived?.message}
        {...form.register("amountReceived")}
      />
      <Input
        label="Data do recebimento"
        type="date"
        error={form.formState.errors.receiptDate?.message}
        {...form.register("receiptDate")}
      />
      <Select
        label="Conta destino"
        options={accountOptions}
        placeholder="Selecione"
        error={form.formState.errors.destinationAccountId?.message}
        {...form.register("destinationAccountId")}
      />
      <Input label="Observação (opcional)" {...form.register("notes")} />

      {/* Pagamento parcial — opção de adiar restante */}
      {isPartial && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-3 space-y-2.5">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deferRemaining}
              onChange={(e) => setDeferRemaining(e.target.checked)}
              className="h-4 w-4 rounded border-surface-border bg-surface accent-amber-500 cursor-pointer"
            />
            <span className="text-sm text-amber-300">
              Adiar saldo restante{" "}
              <span className="font-semibold">({formatCurrency(leftover)})</span>{" "}
              para o próximo mês
            </span>
          </label>
          {deferRemaining && (
            <Input
              label="Data de previsão do restante"
              type="date"
              {...form.register("deferRemainingToDate")}
            />
          )}
        </div>
      )}

      {/* Pagamento a mais */}
      {isOverpayment && (
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/8 px-3 py-2.5">
          <p className="text-xs text-blue-300">
            Valor acima do pendente —{" "}
            <span className="font-semibold">
              {formatCurrency(receivingTx.remainingAmount)}
            </span>{" "}
            serão registrados e o lançamento será encerrado.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" loading={registering}>
          Registrar
        </Button>
      </div>
    </form>
  );
}

type BulkReceiveFormProps = {
  form: UseFormReturn<BulkFormData>;
  onSubmit: (data: BulkFormData) => void;
  accountOptions: { value: string; label: string }[];
  selectedCount: number;
  selectedAmount: number;
  bulkPersonLabel: string | null;
  bulkLoading: boolean;
  onCancel: () => void;
};

function BulkReceiveForm({
  form,
  onSubmit,
  accountOptions,
  selectedCount,
  selectedAmount,
  bulkPersonLabel,
  bulkLoading,
  onCancel,
}: BulkReceiveFormProps) {
  const watchedTotal = useWatch({ control: form.control, name: "totalAmount" });
  const parsedTotal = watchedTotal !== "" ? Number(watchedTotal) || 0 : 0;
  const isProrated = parsedTotal > 0;
  const exceedsTotal = parsedTotal > selectedAmount;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="rounded-xl bg-surface border border-surface-border p-4 space-y-2">
        {bulkPersonLabel && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Devedor:</span>
            <span className="text-sm font-semibold text-amber-400">{bulkPersonLabel}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-500">Lançamentos</p>
            <p className="text-lg font-bold text-white">{selectedCount}</p>
          </div>
          <div>
            <p className="text-gray-500">Total pendente</p>
            <p className="text-lg font-bold text-amber-400">{formatCurrency(selectedAmount)}</p>
          </div>
        </div>

        {/* Preview do rateio */}
        {isProrated && !exceedsTotal && (
          <div className="mt-1 rounded-lg bg-sky-500/8 border border-sky-500/20 px-3 py-2 space-y-1">
            <p className="text-xs font-semibold text-sky-300">Rateio proporcional</p>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Valor a distribuir</span>
              <span className="font-semibold text-white">{formatCurrency(parsedTotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Saldo após pagamento</span>
              <span className="font-semibold text-amber-400">{formatCurrency(selectedAmount - parsedTotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Média por lançamento</span>
              <span className="font-medium text-gray-300">{formatCurrency(parsedTotal / selectedCount)}</span>
            </div>
          </div>
        )}
        {exceedsTotal && (
          <p className="text-xs text-amber-400 mt-1">
            Valor acima do total pendente — será tratado como pagamento integral.
          </p>
        )}
        {!isProrated && (
          <p className="text-xs text-gray-600">
            Sem valor informado: cada lançamento será quitado integralmente.
          </p>
        )}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <Input
          label="Valor a distribuir (R$) — opcional"
          type="number"
          step="0.01"
          placeholder={`máx. ${formatCurrency(selectedAmount)}`}
          error={form.formState.errors.totalAmount?.message as string | undefined}
          {...form.register("totalAmount")}
        />
        <Input label="Data do recebimento" type="date"
          error={form.formState.errors.receiptDate?.message}
          {...form.register("receiptDate")} />
        <Select label="Conta destino" options={accountOptions} placeholder="Selecione"
          error={form.formState.errors.destinationAccountId?.message}
          {...form.register("destinationAccountId")} />
        <Input label="Observação (opcional)" {...form.register("notes")} />
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={bulkLoading}>
            <DollarSign size={14} />
            {isProrated && !exceedsTotal ? "Distribuir" : "Confirmar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ReceivablesPage() {
  const [period, setPeriod] = useState<Period>("next_month");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [debtorFilter, setDebtorFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [receivingTx, setReceivingTx] = useState<Transaction | null>(null);
  const [deferRemaining, setDeferRemaining] = useState(false);
  const [historyTx, setHistoryTx] = useState<Transaction | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkPersonLabel, setBulkPersonLabel] = useState<string | null>(null);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  const { data: txData, loading } = useQuery<{ receivableTransactions: Transaction[] }>(
    RECEIVABLE_TRANSACTIONS_QUERY,
    { variables: { period: period === "all" ? null : period }, fetchPolicy: "cache-and-network" }
  );

  const { data: summaryData } = useQuery<{ receivableTransactions: Transaction[] }>(
    RECEIVABLE_TRANSACTIONS_QUERY,
    { variables: { period: null }, fetchPolicy: "cache-and-network" }
  );

  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);

  const [fetchReceipts, { data: receiptsData, loading: receiptsLoading }] =
    useLazyQuery<{ receipts: Receipt[] }>(RECEIPTS_QUERY, { fetchPolicy: "network-only" });

  function openHistory(tx: Transaction) {
    setHistoryTx(tx);
    fetchReceipts({ variables: { transactionId: tx.id } });
  }

  const transactions = txData?.receivableTransactions ?? [];
  const allTxs = summaryData?.receivableTransactions ?? [];
  const accounts = accountsData?.accounts ?? [];
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  const now = new Date();
  const nextM = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
  const nextY = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();

  function getNextMonthISO(): string {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return d.toISOString().split("T")[0];
  }

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

  const totalPending    = allTxs.reduce((s, t) => s + t.remainingAmount, 0);
  const nextMonthTotal  = allTxs.filter(isNextMonth).reduce((s, t) => s + t.remainingAmount, 0);
  const thisMonthTotal  = allTxs.filter(isThisMonth).reduce((s, t) => s + t.remainingAmount, 0);
  const overdueTotal    = allTxs.filter(isOverdue).reduce((s, t) => s + t.remainingAmount, 0);

  const filteredTransactions = useMemo(() => {
    if (!debtorFilter.trim()) return transactions;
    const q = debtorFilter.toLowerCase();
    return transactions.filter(
      (tx) => tx.debtorName?.toLowerCase().includes(q) || tx.description.toLowerCase().includes(q)
    );
  }, [transactions, debtorFilter]);

  const groupedByPerson = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filteredTransactions) {
      const key = tx.debtorName ?? NO_DEBTOR_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return new Map(
      [...map.entries()].sort(
        ([, a], [, b]) =>
          b.reduce((s, t) => s + t.remainingAmount, 0) -
          a.reduce((s, t) => s + t.remainingAmount, 0)
      )
    );
  }, [filteredTransactions]);

  const pendingIds = filteredTransactions.map((t) => t.id);
  const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(pendingIds));
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
      if (allPersonSelected) personTxs.forEach((tx) => next.delete(tx.id));
      else personTxs.forEach((tx) => next.add(tx.id));
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

  const refetchVars = [
    { query: RECEIVABLE_TRANSACTIONS_QUERY, variables: { period: period === "all" ? null : period } },
    { query: RECEIVABLE_TRANSACTIONS_QUERY, variables: { period: null } },
    { query: RECEIVABLE_SUMMARY_QUERY },
    { query: ACCOUNTS_QUERY },
  ];

  const [createReceipt, { loading: registering }] = useMutation(CREATE_RECEIPT_MUTATION, {
    refetchQueries: refetchVars,
    onCompleted: () => { toast.success("Recebimento registrado!"); setReceivingTx(null); setDeferRemaining(false); },
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
    setDeferRemaining(false);
    receiptForm.reset({
      amountReceived: tx.remainingAmount,
      receiptDate: todayISO(),
      destinationAccountId: accounts[0]?.id ?? "",
      deferRemainingToDate: getNextMonthISO(),
    });
  }

  function openBulk(personLabel?: string) {
    bulkForm.reset({ receiptDate: todayISO(), destinationAccountId: accounts[0]?.id ?? "" });
    setBulkPersonLabel(personLabel ?? null);
    setBulkModalOpen(true);
  }

  function openBulkForPerson(key: string) {
    selectOnlyPerson(key);
    openBulk(key === NO_DEBTOR_KEY ? "sem devedor" : key);
  }

  function onReceiptSubmit(data: ReceiptFormData) {
    if (!receivingTx) return;
    const parsedAmount = Number(data.amountReceived);
    const isPartial = parsedAmount < receivingTx.remainingAmount;
    createReceipt({
      variables: {
        input: {
          transactionId: receivingTx.id,
          amountReceived: parsedAmount,
          receiptDate: data.receiptDate,
          destinationAccountId: data.destinationAccountId,
          notes: data.notes || null,
          deferRemainingToDate:
            isPartial && deferRemaining && data.deferRemainingToDate
              ? data.deferRemainingToDate
              : null,
        },
      },
    });
  }

  function onBulkSubmit(data: BulkFormData) {
    const totalAmount = data.totalAmount !== "" && data.totalAmount ? Number(data.totalAmount) : null;
    bulkReceive({
      variables: {
        input: {
          transactionIds: Array.from(selected),
          receiptDate: data.receiptDate,
          destinationAccountId: data.destinationAccountId,
          notes: data.notes || null,
          totalAmount,
        },
      },
    });
  }

  const selectedAmount = filteredTransactions
    .filter((t) => selected.has(t.id))
    .reduce((s, t) => s + t.remainingAmount, 0);

  // ── Row de transação redesenhado para mobile-first ─────────────────────────

  function renderTxRow(tx: Transaction) {
    const isSelected = selected.has(tx.id);
    const isOverdueItem = tx.competenceDate && tx.competenceDate < todayISO();
    const isPartial = tx.receivedAmount > 0;

    return (
      <div
        key={tx.id}
        className={cn(
          "group px-4 py-4 transition-colors",
          isSelected ? "bg-sky-500/5" : "hover:bg-surface-hover/30"
        )}
      >
        <div className="flex gap-3">
          {/* Checkbox */}
          <button
            onClick={() => toggleOne(tx.id)}
            className="mt-0.5 shrink-0 text-gray-500 hover:text-sky-400 transition-colors"
          >
            {isSelected
              ? <CheckSquare size={18} className="text-sky-400" />
              : <Square size={18} />}
          </button>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Linha 1: descrição + valor */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white leading-snug">
                  {tx.description}
                </p>
                {tx.debtorName && viewMode === "list" && (
                  <p className="mt-0.5 text-xs font-medium text-amber-400 flex items-center gap-1">
                    <span className="opacity-70">↩</span> {tx.debtorName}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold text-white tabular-nums">
                  {formatCurrency(tx.amount)}
                </p>
                {tx.totalInstallments && tx.totalInstallments > 1 && (
                  <p className="text-[11px] text-gray-500">
                    parc. {tx.installmentNumber}/{tx.totalInstallments}
                  </p>
                )}
              </div>
            </div>

            {/* Linha 2: meta info */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs text-gray-500">{formatDate(tx.date)}</span>
              <span className="text-gray-700">·</span>
              <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[tx.paymentMethod]}</span>
              {tx.competenceDate && (
                <>
                  <span className="text-gray-700">·</span>
                  <span className={cn(
                    "text-xs font-medium",
                    isOverdueItem ? "text-red-400" : "text-sky-400"
                  )}>
                    {isOverdueItem ? "⚠ Venceu " : "Prev. "}{formatDate(tx.competenceDate)}
                  </span>
                </>
              )}
              {tx.receiptStatus && (
                <Badge variant={tx.receiptStatus === "partial" ? "default" : "neutral"}>
                  {RECEIPT_STATUS_LABELS[tx.receiptStatus]}
                </Badge>
              )}
            </div>

            {/* Linha 3: status de recebimento parcial */}
            {isPartial && (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/8 border border-emerald-500/15 px-3 py-1.5">
                <TrendingUp size={13} className="text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-emerald-400">
                      Recebido: {formatCurrency(tx.receivedAmount)}
                    </span>
                    <span className="text-xs font-semibold text-amber-400">
                      Pendente: {formatCurrency(tx.remainingAmount)}
                    </span>
                  </div>
                  {/* progress bar */}
                  <div className="mt-1 h-1 rounded-full bg-surface-border">
                    <div
                      className="h-1 rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, (tx.receivedAmount / tx.amount) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Linha 4: ações */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openReceipt(tx)}
                className="flex-1 sm:flex-none"
              >
                <DollarSign size={13} />
                {isPartial ? "Novo recebimento" : "Registrar recebimento"}
              </Button>
              {isPartial && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openHistory(tx)}
                  className="flex-1 sm:flex-none"
                >
                  Histórico
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Valores a Receber</h1>
          <p className="text-sm text-gray-500">
            Total pendente:{" "}
            <span className="font-semibold text-amber-400">{formatCurrency(totalPending)}</span>
          </p>
        </div>
      </div>

      {/* Cards de resumo — 2×2 clicáveis */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {([
          { label: "Próx. mês", value: nextMonthTotal, period: "next_month" as Period, color: "sky",   Icon: Calendar },
          { label: "Este mês",  value: thisMonthTotal, period: "this_month" as Period, color: "blue",  Icon: Clock },
          { label: "Atrasados", value: overdueTotal,   period: "overdue" as Period,    color: "red",   Icon: TrendingDown },
          { label: "Total",     value: totalPending,   period: "all" as Period,        color: "amber", Icon: Users },
        ] as const).map((card) => (
          <button
            key={card.period}
            onClick={() => changePeriod(card.period)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              period === card.period
                ? card.color === "red"   ? "border-red-500/40 bg-red-500/10"
                : card.color === "sky"   ? "border-sky-500/40 bg-sky-500/10"
                : card.color === "blue"  ? "border-blue-500/40 bg-blue-500/10"
                : "border-amber-500/40 bg-amber-500/10"
                : "border-surface-border bg-surface-card hover:border-surface-hover"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <card.Icon size={12} className={
                card.color === "red" ? "text-red-400"
                : card.color === "sky" ? "text-sky-400"
                : card.color === "blue" ? "text-blue-400"
                : "text-amber-400"
              } />
              <p className="text-[11px] font-medium text-gray-500">{card.label}</p>
            </div>
            <p className={cn(
              "text-base font-bold tabular-nums",
              card.color === "red" && card.value > 0 ? "text-red-400"
              : card.color === "sky" ? "text-sky-400"
              : card.color === "blue" ? "text-blue-400"
              : "text-amber-400"
            )}>
              {formatCurrency(card.value)}
            </p>
          </button>
        ))}
      </div>

      {/* Tabs de período com scroll horizontal */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => changePeriod(tab.value)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                period === tab.value
                  ? "bg-sky-600 text-white"
                  : "border border-surface-border bg-surface-card text-gray-400 hover:text-white"
              )}
            >
              {tab.icon}
              <span className="hidden xs:inline">{tab.label}</span>
              <span className="xs:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Barra de busca + toggle de visualização */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Filtrar por pessoa ou descrição…"
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

        {/* Toggle Lista / Por pessoa */}
        <div className="flex rounded-lg border border-surface-border bg-surface-card overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode("list")}
            title="Lista"
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm transition-colors",
              viewMode === "list" ? "bg-surface-hover text-white" : "text-gray-400 hover:text-white"
            )}
          >
            <List size={15} />
            <span className="hidden sm:inline text-xs font-medium">Lista</span>
          </button>
          <button
            onClick={() => setViewMode("by_person")}
            title="Por pessoa"
            className={cn(
              "flex items-center gap-1.5 border-l border-surface-border px-3 py-2 text-sm transition-colors",
              viewMode === "by_person" ? "bg-surface-hover text-white" : "text-gray-400 hover:text-white"
            )}
          >
            <UserCheck size={15} />
            <span className="hidden sm:inline text-xs font-medium">Por pessoa</span>
          </button>
        </div>
      </div>

      {/* Barra de ação em lote */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{selected.size} selecionado(s)</p>
              <p className="text-xs text-gray-400">
                Total: <span className="font-semibold text-emerald-400">{formatCurrency(selectedAmount)}</span>
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
          </div>
          <Button size="sm" onClick={() => openBulk()} className="w-full">
            <DollarSign size={14} /> Receber todos selecionados
          </Button>
        </div>
      )}

      {/* ── VISUALIZAÇÃO LISTA ────────────────────────────────────────────────── */}
      {viewMode === "list" && (
        loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-card" />)}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-14">
            <Users size={36} className="text-gray-600" />
            <p className="text-sm text-gray-500 text-center px-4">
              {debtorFilter
                ? `Nenhum resultado para "${debtorFilter}".`
                : period === "overdue" ? "Nenhum valor atrasado."
                : period === "next_month" ? "Nenhum valor previsto para o próximo mês."
                : period === "this_month" ? "Nenhum valor previsto para este mês."
                : "Nenhum valor a receber pendente."}
            </p>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            {/* Cabeçalho com seleção geral */}
            <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3 bg-surface-card/50">
              <button onClick={toggleAll} className="text-gray-400 hover:text-white transition-colors shrink-0">
                {allSelected ? <CheckSquare size={18} className="text-sky-400" /> : <Square size={18} />}
              </button>
              <span className="text-xs text-gray-500 flex-1">
                {filteredTransactions.length} lançamento(s)
              </span>
              <span className="text-xs font-semibold text-amber-400">
                {formatCurrency(filteredTransactions.reduce((s, t) => s + t.remainingAmount, 0))} pendente
              </span>
            </div>
            <div className="divide-y divide-surface-border/60">
              {filteredTransactions.map(renderTxRow)}
            </div>
          </Card>
        )
      )}

      {/* ── VISUALIZAÇÃO POR PESSOA ───────────────────────────────────────────── */}
      {viewMode === "by_person" && (
        loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-card" />)}
          </div>
        ) : groupedByPerson.size === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-14">
            <UserCheck size={36} className="text-gray-600" />
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
              const paidPct = personTotal > 0 ? Math.min(100, ((personTotal - personPending) / personTotal) * 100) : 0;

              return (
                <Card key={key} padding="none" className="overflow-hidden">
                  {/* Cabeçalho da pessoa */}
                  <button
                    className="w-full text-left px-4 py-4 hover:bg-surface-hover/30 transition-colors"
                    onClick={() => setExpandedPerson(isExpanded ? null : key)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox da pessoa */}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); togglePerson(key); }}
                        onKeyDown={(e) => e.key === "Enter" && togglePerson(key)}
                        className="shrink-0 text-gray-400 hover:text-sky-400 transition-colors"
                      >
                        {personSelected
                          ? <CheckSquare size={18} className="text-sky-400" />
                          : personPartial
                          ? <CheckSquare size={18} className="text-sky-400/50" />
                          : <Square size={18} />}
                      </span>

                      {/* Avatar */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                        <span className="text-sm font-bold">
                          {personLabel === "Sem devedor" ? "?" : personLabel.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{personLabel}</p>
                        <p className="text-xs text-gray-500">{txs.length} lançamento(s)</p>
                        {/* Mini progress */}
                        {paidPct > 0 && (
                          <div className="mt-1.5 h-1 rounded-full bg-surface-border w-24">
                            <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
                          </div>
                        )}
                      </div>

                      {/* Valor + chevron */}
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <p className="text-sm font-bold text-amber-400 tabular-nums">
                            {formatCurrency(personPending)}
                          </p>
                          <p className="text-[11px] text-gray-500">pendente</p>
                        </div>
                        {isExpanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {/* Ações da pessoa (sempre visíveis no collapsed) */}
                  {!isExpanded && (
                    <div className="px-4 pb-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => openBulkForPerson(key)}
                      >
                        <DollarSign size={12} /> Receber tudo de {personLabel}
                      </Button>
                    </div>
                  )}

                  {/* Lançamentos expandidos */}
                  {isExpanded && (
                    <>
                      <div className="border-t border-surface-border divide-y divide-surface-border/60">
                        {txs.map(renderTxRow)}
                      </div>
                      <div className="border-t border-surface-border px-4 py-3">
                        <Button
                          size="sm"
                          onClick={() => openBulkForPerson(key)}
                          className="w-full"
                        >
                          <DollarSign size={13} /> Receber todos de {personLabel}
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Modal — Registrar recebimento individual */}
      <Modal open={!!receivingTx} onClose={() => setReceivingTx(null)} title="Registrar recebimento" size="sm">
        {receivingTx && (
          <div className="space-y-4">
            {/* Info da transação */}
            <div className="rounded-xl bg-surface border border-surface-border p-4 space-y-2">
              <p className="text-sm font-semibold text-white">{receivingTx.description}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {receivingTx.debtorName && (
                  <div>
                    <p className="text-gray-500">Devedor</p>
                    <p className="font-medium text-amber-400">{receivingTx.debtorName}</p>
                  </div>
                )}
                {receivingTx.competenceDate && (
                  <div>
                    <p className="text-gray-500">Previsão</p>
                    <p className="font-medium text-sky-400">{formatDate(receivingTx.competenceDate)}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500">Valor total</p>
                  <p className="font-semibold text-white">{formatCurrency(receivingTx.amount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Pendente</p>
                  <p className="font-bold text-amber-400">{formatCurrency(receivingTx.remainingAmount)}</p>
                </div>
              </div>
              {receivingTx.receivedAmount > 0 && (
                <p className="text-xs text-emerald-400">
                  Já recebido: {formatCurrency(receivingTx.receivedAmount)}
                </p>
              )}
            </div>

            <ReceiptModalForm
              form={receiptForm}
              onSubmit={onReceiptSubmit}
              accountOptions={accountOptions}
              receivingTx={receivingTx}
              deferRemaining={deferRemaining}
              setDeferRemaining={setDeferRemaining}
              registering={registering}
              onCancel={() => setReceivingTx(null)}
            />
          </div>
        )}
      </Modal>

      {/* Modal — Histórico de recebimentos */}
      <Modal
        open={!!historyTx}
        onClose={() => setHistoryTx(null)}
        title="Histórico de recebimentos"
        size="sm"
      >
        {historyTx && (
          <div className="space-y-3">
            <div className="rounded-xl bg-surface border border-surface-border p-3 space-y-1">
              <p className="text-sm font-semibold text-white">{historyTx.description}</p>
              {historyTx.debtorName && (
                <p className="text-xs text-amber-400">{historyTx.debtorName}</p>
              )}
              <div className="flex gap-4 text-xs mt-1">
                <span className="text-gray-500">Total: <span className="text-white font-medium">{formatCurrency(historyTx.amount)}</span></span>
                <span className="text-gray-500">Recebido: <span className="text-emerald-400 font-medium">{formatCurrency(historyTx.receivedAmount)}</span></span>
                <span className="text-gray-500">Pendente: <span className="text-amber-400 font-medium">{formatCurrency(historyTx.remainingAmount)}</span></span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-surface-border">
                <div
                  className="h-1.5 rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, (historyTx.receivedAmount / historyTx.amount) * 100)}%` }}
                />
              </div>
            </div>

            {receiptsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-card" />)}
              </div>
            ) : receiptsData?.receipts.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-4">Nenhum recebimento registrado.</p>
            ) : (
              <div className="space-y-2">
                {receiptsData?.receipts.map((r) => (
                  <div key={r.id} className="rounded-lg border border-surface-border bg-surface-card px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-400">{formatCurrency(r.amountReceived)}</span>
                      <span className="text-xs text-gray-400">{formatDate(r.receiptDate)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{r.destinationAccountName}</p>
                    {r.notes && <p className="text-xs text-gray-600 mt-0.5 italic">{r.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            <Button variant="secondary" className="w-full" onClick={() => setHistoryTx(null)}>
              Fechar
            </Button>
          </div>
        )}
      </Modal>

      {/* Modal — Receber em lote */}
      <Modal
        open={bulkModalOpen}
        onClose={() => { setBulkModalOpen(false); setBulkPersonLabel(null); }}
        title="Receber em lote"
        size="sm"
      >
        <BulkReceiveForm
          form={bulkForm}
          onSubmit={onBulkSubmit}
          accountOptions={accountOptions}
          selectedCount={selected.size}
          selectedAmount={selectedAmount}
          bulkPersonLabel={bulkPersonLabel}
          bulkLoading={bulkLoading}
          onCancel={() => { setBulkModalOpen(false); setBulkPersonLabel(null); }}
        />
      </Modal>
    </div>
  );
}
