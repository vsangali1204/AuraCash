import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import { useState, useMemo, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import toast from "react-hot-toast";
import {
  DollarSign, Users, CheckSquare, Square, AlertCircle,
  Clock, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, List,
  UserCheck, Search, X, TrendingUp, FileDown, Zap,
} from "lucide-react";
import type {
  DebtorGroup,
  CategoryTotal,
} from "@/components/reports/ReceivablesPDFReport";
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
import { REPROCESS_RECURRENCE_MUTATION } from "@/graphql/queries/recurrences";
import {
  cn, formatCurrency, formatDate, formatMonthYear, addMonths,
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

type Period = string; // "overdue" | "all" | "YYYY-MM"
type ViewMode = "list" | "by_person";

const MONTHS_AHEAD = 6;

/** Gera os próximos N meses (incluindo o atual) como tabs no formato "YYYY-MM". */
function buildMonthTabs(count: number): { value: string; label: string }[] {
  const base = todayISO();
  return Array.from({ length: count }, (_, i) => {
    const key = addMonths(base, i).slice(0, 7);
    return { value: key, label: formatMonthYear(key) };
  });
}

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

type FilterMode = "months" | "overdue" | "all";

export function ReceivablesPage() {
  const monthTabs = useMemo(() => buildMonthTabs(MONTHS_AHEAD), []);
  const thisMonthKey = monthTabs[0].value;
  const nextMonthKey = monthTabs[1].value;

  const [period, setPeriod] = useState<Period>(thisMonthKey);
  // Enquanto true, o efeito abaixo pode pular sozinho pro próximo mês com
  // pendência (ex.: agosto já foi todo recebido) — desliga assim que o
  // usuário navega manualmente, pra nunca brigar com a escolha dele.
  const autoSeekRef = useRef(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [debtorFilter, setDebtorFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [receivingTx, setReceivingTx] = useState<Transaction | null>(null);
  const [deferRemaining, setDeferRemaining] = useState(false);
  const [historyTx, setHistoryTx] = useState<Transaction | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkPersonLabel, setBulkPersonLabel] = useState<string | null>(null);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfSelectedDebtors, setPdfSelectedDebtors] = useState<Set<string>>(new Set());
  const [pdfGenerating, setPdfGenerating] = useState(false);

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

  function getNextMonthISO(): string {
    // Retorna o primeiro dia do próximo mês como data padrão de adiamento
    return `${nextMonthKey}-01`;
  }

  function isOverdue(tx: Transaction) {
    if (!tx.competenceDate) return false;
    return tx.competenceDate < todayISO();
  }

  const totalPending = allTxs.reduce((s, t) => s + t.remainingAmount, 0);
  const overdueTotal = allTxs.filter(isOverdue).reduce((s, t) => s + t.remainingAmount, 0);

  // O modo/mês atual é derivado direto de `period`, e a lista/total em
  // destaque vêm de `filteredTransactions` — então o card nunca fica
  // dessincronizado do que está sendo mostrado (nem do filtro de busca).
  const filterMode: FilterMode = period === "overdue" ? "overdue" : period === "all" ? "all" : "months";
  const monthIdx = Math.max(0, monthTabs.findIndex((m) => m.value === period));
  const currentPeriodLabel =
    filterMode === "overdue" ? "Atrasados"
    : filterMode === "all" ? "Todos"
    : monthTabs[monthIdx].label;

  function selectMonthsMode() {
    if (filterMode !== "months") changePeriod(thisMonthKey);
  }

  // Ao carregar, se o mês corrente já estiver zerado (ex.: agosto já foi
  // todo recebido), pula sozinho pro próximo mês com algo pendente — sem
  // brigar com uma navegação manual do usuário (ver changePeriod/autoSeekRef).
  useEffect(() => {
    if (!autoSeekRef.current || filterMode !== "months" || loading) return;
    if (transactions.length > 0) {
      autoSeekRef.current = false;
      return;
    }
    const idx = monthTabs.findIndex((m) => m.value === period);
    if (idx === -1 || idx >= monthTabs.length - 1) {
      autoSeekRef.current = false;
      if (period !== thisMonthKey) setPeriod(thisMonthKey);
      return;
    }
    setPeriod(monthTabs[idx + 1].value);
  }, [loading, transactions, period, filterMode, monthTabs, thisMonthKey]);

  const filteredTransactions = useMemo(() => {
    if (!debtorFilter.trim()) return transactions;
    const q = debtorFilter.toLowerCase();
    return transactions.filter(
      (tx) => tx.debtorName?.toLowerCase().includes(q) || tx.description.toLowerCase().includes(q)
    );
  }, [transactions, debtorFilter]);

  const selectedTotal = filteredTransactions.reduce((s, t) => s + t.remainingAmount, 0);

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

  // allDebtorsForPdf reutiliza o mesmo agrupamento já computado por groupedByPerson
  const allDebtorsForPdf = groupedByPerson;

  // Itens previstos (isProjected) não têm um lançamento real: não podem ser
  // selecionados nem recebidos até a recorrência gerar o lançamento de fato.
  const pendingIds = filteredTransactions.filter((t) => !t.isProjected).map((t) => t.id);
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
    const personTxs = (groupedByPerson.get(key) ?? []).filter((tx) => !tx.isProjected);
    const allPersonSelected = personTxs.length > 0 && personTxs.every((tx) => selected.has(tx.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPersonSelected) personTxs.forEach((tx) => next.delete(tx.id));
      else personTxs.forEach((tx) => next.add(tx.id));
      return next;
    });
  }

  function selectOnlyPerson(key: string) {
    const personTxs = (groupedByPerson.get(key) ?? []).filter((tx) => !tx.isProjected);
    setSelected(new Set(personTxs.map((tx) => tx.id)));
  }

  function changePeriod(p: Period) {
    autoSeekRef.current = false;
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

  const [generatingRecId, setGeneratingRecId] = useState<string | null>(null);

  const [reprocessRec] = useMutation<{ reprocessRecurrence: number }>(REPROCESS_RECURRENCE_MUTATION, {
    refetchQueries: refetchVars,
    onCompleted: (d) => {
      setGeneratingRecId(null);
      if (d.reprocessRecurrence === 0) {
        toast("Recorrência fora do dia de execução deste mês.", { icon: "ℹ️" });
      } else {
        toast.success("Lançamento gerado! Já pode registrar o recebimento.");
      }
    },
    onError: (e) => { setGeneratingRecId(null); toast.error(e.message); },
  });

  function handleGenerateNow(recurrenceId: string) {
    setGeneratingRecId(recurrenceId);
    reprocessRec({ variables: { id: recurrenceId } });
  }

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
    const isRemainder = !!tx.isPartialRemainder;
    const isProjected = !!tx.isProjected;

    return (
      <div
        key={tx.id}
        className={cn(
          "group px-4 py-4 transition-colors",
          isProjected
            ? "border-l-2 border-dashed border-sky-500/30 bg-sky-500/[0.03]"
            : isSelected ? "bg-sky-500/5" : "hover:bg-surface-hover/30"
        )}
      >
        <div className="flex gap-3">
          {/* Checkbox */}
          {isProjected ? (
            <span className="mt-0.5 shrink-0 text-sky-500/50" title="Previsão — ainda não gerado">
              <Clock size={18} />
            </span>
          ) : (
            <button
              onClick={() => toggleOne(tx.id)}
              className="mt-0.5 shrink-0 text-gray-500 hover:text-sky-400 transition-colors"
            >
              {isSelected
                ? <CheckSquare size={18} className="text-sky-400" />
                : <Square size={18} />}
            </button>
          )}

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
              {isRemainder && (
                <Badge variant="neutral" className="border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                  ↩ saldo parcial
                </Badge>
              )}
              {isProjected ? (
                <Badge variant="neutral" className="border border-sky-500/30 bg-sky-500/10 text-sky-300">
                  Previsto
                </Badge>
              ) : tx.receiptStatus && (
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
            {isProjected ? (
              period === thisMonthKey && tx.recurrence ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleGenerateNow(tx.recurrence!.id)}
                    disabled={generatingRecId === tx.recurrence!.id}
                    className="flex-1 sm:flex-none"
                  >
                    <Zap size={13} />
                    {generatingRecId === tx.recurrence!.id ? "Gerando…" : "Gerar lançamento"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic">
                  Previsão da recorrência — gerado automaticamente quando o dia chegar.
                </p>
              )
            ) : (
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
            )}
          </div>
        </div>
      </div>
    );
  }

  function openPdfModal() {
    setPdfSelectedDebtors(new Set(allDebtorsForPdf.keys()));
    setPdfModalOpen(true);
  }

  async function handleGeneratePDF() {
    if (pdfSelectedDebtors.size === 0) return;
    setPdfGenerating(true);
    try {
      const debtors: DebtorGroup[] = [...pdfSelectedDebtors].map((key) => ({
        name: key === NO_DEBTOR_KEY ? "Sem devedor" : key,
        transactions: allDebtorsForPdf.get(key) ?? [],
      }));

      const allTxsSelected = debtors.flatMap((d) => d.transactions);
      const totalGrand = allTxsSelected.reduce((s, t) => s + t.remainingAmount, 0);

      const catMap = new Map<string, CategoryTotal>();
      for (const tx of allTxsSelected) {
        const name = tx.category?.name ?? "Sem categoria";
        const color = tx.category?.color ?? "#94a3b8";
        const cur = catMap.get(name);
        if (cur) cur.amount += tx.remainingAmount;
        else catMap.set(name, { name, color, amount: tx.remainingAmount });
      }
      const categoryTotals = [...catMap.values()].sort((a, b) => b.amount - a.amount);

      const now = new Date();
      const generatedAt = now.toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      const { downloadReceivablesPDF } = await import("@/components/reports/ReceivablesPDFReport");
      await downloadReceivablesPDF({ debtors, categoryTotals, generatedAt, totalGrand, periodLabel: currentPeriodLabel });
      setPdfModalOpen(false);
    } catch {
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setPdfGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Valores a Receber</h1>
          <p className="mt-1 text-sm text-gray-400">
            Total pendente:{" "}
            <span className="font-semibold text-amber-400">{formatCurrency(totalPending)}</span>
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={openPdfModal} className="shrink-0">
          <FileDown size={14} /> Relatório PDF
        </Button>
      </div>

      {/* Aviso de atrasados — sempre visível, independente do filtro atual */}
      {overdueTotal > 0 && filterMode !== "overdue" && (
        <button
          onClick={() => changePeriod("overdue")}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-left transition-colors hover:bg-red-500/10"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-red-300">
            <AlertCircle size={13} /> Você tem valores atrasados
          </span>
          <span className="text-xs font-semibold text-red-400">{formatCurrency(overdueTotal)} →</span>
        </button>
      )}

      {/* Modo de filtro: Meses / Atrasados / Todos */}
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-surface-border bg-surface-card p-1">
        <button
          onClick={selectMonthsMode}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors",
            filterMode === "months" ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white"
          )}
        >
          <Calendar size={14} /> Meses
        </button>
        <button
          onClick={() => changePeriod("overdue")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors",
            filterMode === "overdue" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
          )}
        >
          <AlertCircle size={14} /> Atrasados
        </button>
        <button
          onClick={() => changePeriod("all")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors",
            filterMode === "all" ? "bg-amber-600 text-white" : "text-gray-400 hover:text-white"
          )}
        >
          <Users size={14} /> Todos
        </button>
      </div>

      {/* Navegador de mês — só aparece no modo "Meses" */}
      {filterMode === "months" && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface-card px-2 py-2">
          <button
            aria-label="Mês anterior"
            disabled={monthIdx === 0}
            onClick={() => changePeriod(monthTabs[monthIdx - 1].value)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-gray-400"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold capitalize text-white">
            {monthTabs[monthIdx].label}
            {monthIdx === 0 && <span className="ml-1.5 text-[11px] font-normal text-sky-400">(atual)</span>}
          </span>
          <button
            aria-label="Próximo mês"
            disabled={monthIdx === monthTabs.length - 1}
            onClick={() => changePeriod(monthTabs[monthIdx + 1].value)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-gray-400"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Total do filtro selecionado — sempre reflete o que está sendo exibido abaixo */}
      <Card
        className={cn(
          "flex items-center justify-between gap-3",
          filterMode === "overdue" ? "border-red-500/30 bg-red-500/5"
          : filterMode === "all" ? "border-amber-500/30 bg-amber-500/5"
          : "border-sky-500/30 bg-sky-500/5"
        )}
      >
        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            {filterMode === "months" ? "Previsto para" : "Mostrando"}
          </p>
          <p className="truncate text-sm font-semibold capitalize text-white">{currentPeriodLabel}</p>
          <p className="mt-0.5 text-xs text-gray-500">{filteredTransactions.length} lançamento(s)</p>
        </div>
        <p
          className={cn(
            "shrink-0 text-xl font-bold tabular-nums",
            filterMode === "overdue" ? "text-red-400"
            : filterMode === "all" ? "text-amber-400"
            : "text-sky-400"
          )}
        >
          {formatCurrency(selectedTotal)}
        </p>
      </Card>

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
                : period === "all" ? "Nenhum valor a receber pendente."
                : `Nenhum valor previsto para ${currentPeriodLabel}.`}
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
              const personRealTxs = txs.filter((tx) => !tx.isProjected);
              const personSelected = personRealTxs.length > 0 && personRealTxs.every((tx) => selected.has(tx.id));
              const personPartial = personRealTxs.some((tx) => selected.has(tx.id)) && !personSelected;
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
                  {!isExpanded && personRealTxs.length > 0 && (
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
                      {personRealTxs.length > 0 && (
                        <div className="border-t border-surface-border px-4 py-3">
                          <Button
                            size="sm"
                            onClick={() => openBulkForPerson(key)}
                            className="w-full"
                          >
                            <DollarSign size={13} /> Receber todos de {personLabel}
                          </Button>
                        </div>
                      )}
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

      {/* Modal — Gerar Relatório PDF */}
      <Modal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title="Gerar Relatório PDF"
        size="sm"
      >
        <div className="space-y-4">
          {/* Active period indicator */}
          <div className="flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/8 px-3 py-2">
            <Calendar size={13} className="text-sky-400 shrink-0" />
            <p className="text-xs text-sky-300">
              Período: <span className="font-semibold">{currentPeriodLabel}</span>
              {debtorFilter && <span className="text-sky-400/70"> · filtro "{debtorFilter}"</span>}
            </p>
          </div>

          {/* Selection header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              <span className="font-semibold text-white">{pdfSelectedDebtors.size}</span> de{" "}
              {allDebtorsForPdf.size} pessoa(s) selecionada(s)
            </p>
            <div className="flex gap-2">
              <button
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                onClick={() => setPdfSelectedDebtors(new Set(allDebtorsForPdf.keys()))}
              >
                Todas
              </button>
              <span className="text-gray-600">·</span>
              <button
                className="text-xs text-gray-500 hover:text-white transition-colors"
                onClick={() => setPdfSelectedDebtors(new Set())}
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Debtor list */}
          <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-surface-border p-2">
            {[...allDebtorsForPdf.entries()].map(([key, txs]) => {
              const label = key === NO_DEBTOR_KEY ? "Sem devedor" : key;
              const pending = txs.reduce((s, t) => s + t.remainingAmount, 0);
              const isSelected = pdfSelectedDebtors.has(key);
              return (
                <button
                  key={key}
                  onClick={() =>
                    setPdfSelectedDebtors((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "bg-sky-500/10 border border-sky-500/30"
                      : "border border-transparent hover:bg-surface-hover/30"
                  )}
                >
                  {isSelected
                    ? <CheckSquare size={16} className="text-sky-400 shrink-0" />
                    : <Square size={16} className="text-gray-500 shrink-0" />}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold">
                    {label.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{label}</p>
                    <p className="text-xs text-gray-500">{txs.length} lançamento(s)</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-400 shrink-0 tabular-nums">
                    {formatCurrency(pending)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Generate button */}
          <Button
            className="w-full"
            onClick={handleGeneratePDF}
            disabled={pdfSelectedDebtors.size === 0 || pdfGenerating}
          >
            {pdfGenerating ? (
              "Gerando PDF…"
            ) : (
              <>
                <FileDown size={14} />
                Baixar PDF ({pdfSelectedDebtors.size} pessoa{pdfSelectedDebtors.size !== 1 ? "s" : ""})
              </>
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
