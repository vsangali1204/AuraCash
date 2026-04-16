import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp, DollarSign, Users, CreditCard, ArrowLeftRight } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  RECEIVABLE_SUMMARY_QUERY, RECEIVABLE_TRANSACTIONS_QUERY,
  CREATE_RECEIPT_MUTATION,
} from "@/graphql/queries/receivables";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import {
  formatCurrency, formatDate, formatMonthYear,
  RECEIPT_STATUS_LABELS, TRANSACTION_TYPE_LABELS, PAYMENT_METHOD_LABELS, todayISO,
} from "@/lib/utils";
import type { Account, ReceivableSummary, Transaction } from "@/types";

const receiptSchema = z.object({
  amountReceived: z.coerce.number().positive("Valor positivo"),
  receiptDate: z.string().min(1, "Data obrigatória"),
  destinationAccountId: z.string().min(1, "Conta obrigatória"),
  notes: z.string().optional(),
});

type ReceiptFormData = z.infer<typeof receiptSchema>;

export function ReceivablesPage() {
  const [expandedDebtor, setExpandedDebtor] = useState<string | null>(null);
  const [receivingTx, setReceivingTx] = useState<Transaction | null>(null);

  const { data: summaryData, loading } = useQuery<{ receivableSummary: ReceivableSummary[] }>(
    RECEIVABLE_SUMMARY_QUERY,
    { fetchPolicy: "cache-and-network" }
  );
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);
  const { data: txData, loading: txLoading } = useQuery<{ receivableTransactions: Transaction[] }>(
    RECEIVABLE_TRANSACTIONS_QUERY,
    {
      variables: { debtorName: expandedDebtor, status: null },
      skip: !expandedDebtor,
    }
  );

  const summaries = summaryData?.receivableSummary ?? [];
  const debtorTxs = txData?.receivableTransactions ?? [];
  const accounts = accountsData?.accounts ?? [];
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  const totalPending = summaries.reduce((s, d) => s + d.pendingAmount, 0);

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<ReceiptFormData>({
    resolver: zodResolver(receiptSchema),
    defaultValues: { receiptDate: todayISO() },
  });

  const [createReceipt, { loading: registering }] = useMutation(CREATE_RECEIPT_MUTATION, {
    refetchQueries: [RECEIVABLE_SUMMARY_QUERY, RECEIVABLE_TRANSACTIONS_QUERY],
    onCompleted: () => {
      toast.success("Recebimento registrado!");
      setReceivingTx(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openReceipt(tx: Transaction) {
    setReceivingTx(tx);
    reset({
      amountReceived: tx.remainingAmount,
      receiptDate: todayISO(),
      destinationAccountId: accounts[0]?.id ?? "",
    });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Valores a Receber</h1>
        <p className="text-sm text-gray-500">
          Total pendente:{" "}
          <span className="text-amber-400 font-semibold">{formatCurrency(totalPending)}</span>
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-card" />)}
        </div>
      ) : summaries.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <Users size={40} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhum valor a receber pendente.</p>
          <p className="text-xs text-gray-600 text-center max-w-sm">
            Ao criar um lançamento, marque a opção "Valor a receber" para rastreá-lo aqui.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {summaries.map((summary) => {
            const isExpanded = expandedDebtor === summary.debtorName;
            const receivedPercent = summary.totalAmount > 0
              ? (summary.receivedAmount / summary.totalAmount) * 100 : 0;

            return (
              <Card key={summary.debtorName} padding="none" className="overflow-hidden">
                <button
                  onClick={() => setExpandedDebtor(isExpanded ? null : summary.debtorName)}
                  className="flex w-full items-center justify-between p-4 hover:bg-surface-hover transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 font-bold">
                      {summary.debtorName[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{summary.debtorName}</p>
                      <p className="text-xs text-gray-500">{summary.transactionCount} lançamento(s) pendente(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-400">{formatCurrency(summary.pendingAmount)}</p>
                      <p className="text-xs text-gray-500">de {formatCurrency(summary.totalAmount)}</p>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Progress bar */}
                <div className="mx-4 mb-3">
                  <div className="h-1 rounded-full bg-surface-border">
                    <div className="h-1 rounded-full bg-amber-500 transition-all" style={{ width: `${receivedPercent}%` }} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-surface-border">
                    {txLoading ? (
                      <p className="py-4 text-center text-sm text-gray-500">Carregando...</p>
                    ) : (
                      <div className="divide-y divide-surface-border">
                        {debtorTxs.map((tx) => (
                          <TxRow key={tx.id} tx={tx} onReceive={openReceipt} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Receipt modal */}
      <Modal open={!!receivingTx} onClose={() => setReceivingTx(null)} title="Registrar recebimento" size="sm">
        {receivingTx && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface p-3 text-sm space-y-1">
              <p className="text-white font-medium">{receivingTx.description}</p>
              <p className="text-gray-500">Devedor: <span className="text-white">{receivingTx.debtorName}</span></p>
              {receivingTx.competenceDate && (
                <p className="text-gray-500">Previsão: <span className="text-violet-400">{formatDate(receivingTx.competenceDate)}</span></p>
              )}
              {receivingTx.receivedAmount > 0 && (
                <p className="text-gray-500">Já recebido: <span className="text-emerald-400">{formatCurrency(receivingTx.receivedAmount)}</span></p>
              )}
              <p className="text-gray-500">Pendente: <span className="text-amber-400 font-semibold">{formatCurrency(receivingTx.remainingAmount)}</span></p>
            </div>
            <form onSubmit={handleSubmit(onReceiptSubmit)} className="space-y-4">
              <Input label="Valor recebido (R$)" type="number" step="0.01" error={errors.amountReceived?.message} {...register("amountReceived")} />
              <Input label="Data do recebimento" type="date" error={errors.receiptDate?.message} {...register("receiptDate")} />
              <Select label="Conta destino" options={accountOptions} placeholder="Selecione a conta" error={errors.destinationAccountId?.message} {...register("destinationAccountId")} />
              <Input label="Observação (opcional)" placeholder="Ex: Recebido parcial em dinheiro" {...register("notes")} />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setReceivingTx(null)}>Cancelar</Button>
                <Button type="submit" loading={registering}>Registrar</Button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TxRow({ tx, onReceive }: { tx: Transaction; onReceive: (tx: Transaction) => void }) {
  const isCredit = tx.paymentMethod === "credit";
  const isExpense = tx.transactionType === "expense";

  return (
    <div className="flex items-start justify-between px-4 py-3 gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {/* Ícone */}
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isExpense ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
          {isCredit ? <CreditCard size={14} /> : <ArrowLeftRight size={14} />}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-white">{tx.description}</p>
            {tx.totalInstallments && tx.totalInstallments > 1 && (
              <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-gray-400">
                {tx.installmentNumber}/{tx.totalInstallments}x
              </span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{formatDate(tx.date)}</span>

            {/* Tipo do lançamento */}
            <Badge variant={isExpense ? "expense" : "income"}>
              {TRANSACTION_TYPE_LABELS[tx.transactionType]}
            </Badge>

            {/* Meio de pagamento */}
            <span className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[tx.paymentMethod]}</span>

            {/* Cartão / fatura */}
            {tx.creditCard && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <CreditCard size={10} /> {tx.creditCard.name}
              </span>
            )}
            {tx.invoice && (
              <span className="text-xs text-gray-500">
                Fatura {formatMonthYear(tx.invoice.referenceMonth)} · venc. {formatDate(tx.invoice.dueDate)}
              </span>
            )}

            {/* Previsão de recebimento */}
            {tx.competenceDate && (
              <span className="text-xs text-violet-400">
                Previsão: {formatDate(tx.competenceDate)}
              </span>
            )}

            {/* Status */}
            {tx.receiptStatus && (
              <Badge variant={tx.receiptStatus === "received" ? "income" : tx.receiptStatus === "partial" ? "default" : "neutral"}>
                {RECEIPT_STATUS_LABELS[tx.receiptStatus]}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Valor + ação */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{formatCurrency(tx.amount)}</p>
          {tx.receivedAmount > 0 && (
            <p className="text-xs text-emerald-400">Recebido: {formatCurrency(tx.receivedAmount)}</p>
          )}
          {tx.remainingAmount > 0 && (
            <p className="text-xs text-amber-400">Pendente: {formatCurrency(tx.remainingAmount)}</p>
          )}
        </div>
        {tx.receiptStatus !== "received" && (
          <Button size="sm" variant="secondary" onClick={() => onReceive(tx)}>
            <DollarSign size={12} /> Receber
          </Button>
        )}
      </div>
    </div>
  );
}
