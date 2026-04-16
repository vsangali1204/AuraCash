import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, RefreshCw, Pause, Play } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  RECURRENCES_QUERY, CREATE_RECURRENCE_MUTATION,
  UPDATE_RECURRENCE_MUTATION, TOGGLE_RECURRENCE_MUTATION, DELETE_RECURRENCE_MUTATION,
} from "@/graphql/queries/recurrences";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import { CATEGORIES_QUERY } from "@/graphql/queries/categories";
import { CREDIT_CARDS_QUERY } from "@/graphql/queries/creditCards";
import {
  formatCurrency, formatDate, RECURRENCE_TYPE_LABELS, PAYMENT_METHOD_LABELS, todayISO,
} from "@/lib/utils";
import type { Account, Category, CreditCard, Recurrence } from "@/types";

const schema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  amount: z.coerce.number().positive("Valor positivo"),
  recurrenceType: z.string(),
  paymentMethod: z.string(),
  accountId: z.string().min(1, "Conta obrigatória"),
  dayOfMonth: z.coerce.number().min(1).max(31),
  startDate: z.string().min(1, "Data de início obrigatória"),
  creditCardId: z.string().optional(),
  categoryId: z.string().optional(),
  useBusinessDay: z.boolean().default(false),
  endDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const RECURRENCE_TYPE_OPTIONS = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
];

const PAYMENT_OPTIONS = [
  { value: "debit", label: "Débito" },
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

export function RecurrencesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recurrence | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const { data } = useQuery<{ recurrences: Recurrence[] }>(RECURRENCES_QUERY, { variables: { activeOnly: false } });
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const { data: cardsData } = useQuery<{ creditCards: CreditCard[] }>(CREDIT_CARDS_QUERY);

  const allRecurrences = data?.recurrences ?? [];
  const recurrences = allRecurrences.filter((r) =>
    filter === "all" ? true : filter === "active" ? r.isActive : !r.isActive
  );

  const accountOptions = (accountsData?.accounts ?? []).map((a) => ({ value: a.id, label: a.name }));
  const categoryOptions = [
    { value: "", label: "Sem categoria" },
    ...(categoriesData?.categories ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];
  const cardOptions = [
    { value: "", label: "Nenhum" },
    ...(cardsData?.creditCards ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  const {
    register, handleSubmit, reset, watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      recurrenceType: "expense", paymentMethod: "pix",
      dayOfMonth: 1, useBusinessDay: false, startDate: todayISO(),
    },
  });

  const paymentMethod = watch("paymentMethod");

  const [createRec, { loading: creating }] = useMutation(CREATE_RECURRENCE_MUTATION, {
    refetchQueries: [RECURRENCES_QUERY],
    onCompleted: () => { toast.success("Recorrência criada!"); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [updateRec, { loading: updating }] = useMutation(UPDATE_RECURRENCE_MUTATION, {
    refetchQueries: [RECURRENCES_QUERY],
    onCompleted: () => { toast.success("Recorrência atualizada!"); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [toggleRec] = useMutation(TOGGLE_RECURRENCE_MUTATION, {
    refetchQueries: [RECURRENCES_QUERY],
    onError: (e) => toast.error(e.message),
  });

  const [deleteRec, { loading: deleting }] = useMutation(DELETE_RECURRENCE_MUTATION, {
    refetchQueries: [RECURRENCES_QUERY],
    onCompleted: () => { toast.success("Recorrência removida!"); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    reset({ recurrenceType: "expense", paymentMethod: "pix", dayOfMonth: 1, useBusinessDay: false, startDate: todayISO() });
    setModalOpen(true);
  }

  function openEdit(rec: Recurrence) {
    setEditing(rec);
    reset({
      description: rec.description, amount: rec.amount,
      recurrenceType: rec.recurrenceType, paymentMethod: rec.paymentMethod,
      accountId: rec.accountId, dayOfMonth: rec.dayOfMonth,
      startDate: rec.startDate, creditCardId: rec.creditCardId ?? "",
      categoryId: rec.categoryId ?? "", useBusinessDay: rec.useBusinessDay,
      endDate: rec.endDate ?? "",
    });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  function onSubmit(data: FormData) {
    const baseInput = {
      description: data.description,
      amount: data.amount,
      recurrenceType: data.recurrenceType,
      paymentMethod: data.paymentMethod,
      accountId: data.accountId,
      dayOfMonth: data.dayOfMonth,
      useBusinessDay: data.useBusinessDay,
      categoryId: data.categoryId || null,
      endDate: data.endDate || null,
    };
    if (editing) {
      updateRec({ variables: { input: { id: editing.id, ...baseInput } } });
    } else {
      createRec({
        variables: {
          input: {
            ...baseInput,
            startDate: data.startDate,
            creditCardId: data.creditCardId || null,
          },
        },
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Recorrências</h1>
          <p className="text-sm text-gray-500">
            {allRecurrences.filter((r) => r.isActive).length} ativa(s) de {allRecurrences.length} total
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nova recorrência</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([["all", "Todas"], ["active", "Ativas"], ["inactive", "Pausadas"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${filter === v ? "bg-violet-600 text-white" : "border border-surface-border bg-surface-card text-gray-400 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {recurrences.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <RefreshCw size={40} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhuma recorrência {filter !== "all" ? "nessa categoria" : "cadastrada"}.</p>
          {filter === "all" && <Button onClick={openCreate}><Plus size={16} /> Nova recorrência</Button>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {recurrences.map((rec) => (
            <div key={rec.id} className={`rounded-xl border bg-surface-card p-4 transition-colors ${rec.isActive ? "border-surface-border" : "border-surface-border opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${rec.recurrenceType === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    <RefreshCw size={16} />
                  </div>
                  <div>
                    <p className="font-medium text-white">{rec.description}</p>
                    <p className="text-xs text-gray-500">
                      {rec.accountName} · {PAYMENT_METHOD_LABELS[rec.paymentMethod]} ·{" "}
                      {rec.useBusinessDay ? `${rec.dayOfMonth}º dia útil` : `Dia ${rec.dayOfMonth}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleRec({ variables: { id: rec.id } })}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-hover hover:text-white transition-colors">
                    {rec.isActive ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button onClick={() => openEdit(rec)} className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-hover hover:text-white transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteId(rec.id)} className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={rec.recurrenceType === "income" ? "income" : "expense"}>
                    {RECURRENCE_TYPE_LABELS[rec.recurrenceType]}
                  </Badge>
                  {rec.categoryName && (
                    <Badge variant="neutral">{rec.categoryName}</Badge>
                  )}
                  {!rec.isActive && <Badge variant="neutral">Pausada</Badge>}
                </div>
                <p className={`text-lg font-bold ${rec.recurrenceType === "income" ? "text-emerald-400" : "text-red-400"}`}>
                  {formatCurrency(rec.amount)}
                </p>
              </div>

              {rec.nextExecutionDate && rec.isActive && (
                <p className="mt-2 text-xs text-gray-500">
                  Próxima execução: <span className="text-violet-400">{formatDate(rec.nextExecutionDate)}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? "Editar recorrência" : "Nova recorrência"} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Descrição" placeholder="Ex: Salário, Spotify, Aluguel" error={errors.description?.message} {...register("description")} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" options={RECURRENCE_TYPE_OPTIONS} {...register("recurrenceType")} />
            <Input label="Valor (R$)" type="number" step="0.01" error={errors.amount?.message} {...register("amount")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Meio de pagamento" options={PAYMENT_OPTIONS} {...register("paymentMethod")} />
            <Select label="Conta" options={accountOptions} placeholder="Selecione" error={errors.accountId?.message} {...register("accountId")} />
          </div>
          {paymentMethod === "credit" && (
            <Select label="Cartão de crédito" options={cardOptions} {...register("creditCardId")} />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Dia do mês (1-31)" type="number" min={1} max={31} error={errors.dayOfMonth?.message} {...register("dayOfMonth")} />
            <Select label="Categoria" options={categoryOptions} {...register("categoryId")} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="useBusinessDay" className="h-4 w-4 rounded border-surface-border bg-surface-card accent-violet-500" {...register("useBusinessDay")} />
            <label htmlFor="useBusinessDay" className="text-sm text-gray-300">Usar N-ésimo dia útil do mês</label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data de início" type="date" error={errors.startDate?.message} {...register("startDate")} />
            <Input label="Data de término (opcional)" type="date" {...register("endDate")} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={creating || updating}>{editing ? "Salvar" : "Criar recorrência"}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir recorrência" size="sm">
        <p className="text-sm text-gray-400">Tem certeza? Os lançamentos já gerados não serão removidos.</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={() => deleteId && deleteRec({ variables: { id: deleteId } })}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
