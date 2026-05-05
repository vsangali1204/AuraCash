import { useState } from "react";
import { useMutation } from "@apollo/client";
import { CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CONFIRM_PENDING_RECURRENCE_MUTATION,
  SKIP_PENDING_RECURRENCE_MUTATION,
  PENDING_RECURRENCES_QUERY,
} from "@/graphql/queries/transactions";
import { DASHBOARD_SUMMARY_QUERY } from "@/graphql/queries/transactions";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction } from "@/types";

interface Props {
  transactions: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  dashboardVars: { year: number; month: number };
}

const REFETCH = [
  { query: PENDING_RECURRENCES_QUERY },
  { query: ACCOUNTS_QUERY },
];

export function PendingRecurrencesModal({ transactions, isOpen, onClose, dashboardVars }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [confirmMutation] = useMutation(CONFIRM_PENDING_RECURRENCE_MUTATION, {
    refetchQueries: [...REFETCH, { query: DASHBOARD_SUMMARY_QUERY, variables: dashboardVars }],
  });
  const [skipMutation] = useMutation(SKIP_PENDING_RECURRENCE_MUTATION, {
    refetchQueries: [...REFETCH, { query: DASHBOARD_SUMMARY_QUERY, variables: dashboardVars }],
  });

  async function handleConfirm(t: Transaction) {
    const amount = editingId === t.id ? parseFloat(editValue.replace(",", ".")) : undefined;
    if (editingId === t.id && (isNaN(amount!) || amount! <= 0)) {
      toast.error("Valor inválido.");
      return;
    }
    setLoadingId(t.id);
    try {
      await confirmMutation({
        variables: { id: t.id, amount: editingId === t.id ? amount : null },
      });
      toast.success(`"${t.description}" confirmado!`);
      setEditingId(null);
      setEditValue("");
    } catch {
      toast.error("Erro ao confirmar lançamento.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleSkip(t: Transaction) {
    setLoadingId(t.id);
    try {
      await skipMutation({ variables: { id: t.id } });
      toast.success(`"${t.description}" ignorado.`);
    } catch {
      toast.error("Erro ao ignorar lançamento.");
    } finally {
      setLoadingId(null);
    }
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditValue(String(t.amount));
  }

  const remaining = transactions.filter((t) => !loadingId || loadingId !== t.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recorrências aguardando confirmação"
    >
      <div className="space-y-1 mb-4">
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <AlertCircle size={15} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            Confirme cada lançamento antes de efetivá-lo no saldo. Você pode alterar o valor se necessário.
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">Nenhuma recorrência pendente.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {transactions.map((t) => {
            const isLoading = loadingId === t.id;
            const isEditing = editingId === t.id;
            return (
              <div
                key={t.id}
                className={`rounded-lg border border-surface-border bg-surface p-3 transition-opacity ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${t.transactionType === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                      <RefreshCw size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{t.description}</p>
                      <p className="text-xs text-gray-500">{formatDate(t.date)} · {t.account?.name ?? t.creditCard?.name ?? "—"}</p>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                        className="w-28 h-7 text-sm text-right"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(t); if (e.key === "Escape") setEditingId(null); }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(t)}
                      className={`text-sm font-semibold shrink-0 hover:opacity-70 transition-opacity ${t.transactionType === "income" ? "text-emerald-400" : "text-red-400"}`}
                      title="Clique para editar o valor"
                    >
                      {formatCurrency(t.amount)}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 mt-2.5">
                  {isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => handleSkip(t)}
                    disabled={isLoading}
                  >
                    <XCircle size={14} className="mr-1" />
                    Ignorar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleConfirm(t)}
                    disabled={isLoading}
                  >
                    <CheckCircle size={14} className="mr-1" />
                    Confirmar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-end border-t border-surface-border pt-3">
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
  );
}
