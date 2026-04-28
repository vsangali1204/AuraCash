import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  Plus, Trash2, Pencil, ArrowLeftRight, Search,
  CreditCard as CreditCardIcon, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  TRANSACTIONS_QUERY,
  CREATE_TRANSACTION_MUTATION,
  UPDATE_TRANSACTION_MUTATION,
  DELETE_TRANSACTION_MUTATION,
} from "@/graphql/queries/transactions";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import { CATEGORIES_QUERY } from "@/graphql/queries/categories";
import { CREDIT_CARDS_QUERY } from "@/graphql/queries/creditCards";
import {
  formatCurrency, formatDate, formatMonthYear,
  TRANSACTION_TYPE_LABELS, PAYMENT_METHOD_LABELS, todayISO,
} from "@/lib/utils";
import type { Account, Category, CreditCard, Transaction } from "@/types";

// ── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  transactionType: z.string(),
  paymentMethod: z.string(),
  date: z.string().min(1, "Data obrigatória"),
  accountId: z.string().optional(),
  transferAccountId: z.string().optional(),
  creditCardId: z.string().optional(),
  totalInstallments: z.coerce.number().min(1).max(48).optional(),
  categoryId: z.string().optional(),
  isReceivable: z.boolean().default(false),
  debtorName: z.string().optional(),
  competenceDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TRANSACTION_TYPE_OPTIONS = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
  { value: "transfer", label: "Transferência" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "debit", label: "Débito" },
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatMonthLabel(year: number, month: number) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function monthISORangeDates(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    dateFrom: `${year}-${pad(month)}-01`,
    dateTo: `${year}-${pad(month)}-${lastDay}`,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export function TransactionsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [navMonth, setNavMonth] = useState(currentYearMonth);
  const descRef = useRef<HTMLInputElement | null>(null);

  const { dateFrom, dateTo } = monthISORangeDates(navMonth.year, navMonth.month);

  const { data: txData, loading } = useQuery<{ transactions: Transaction[] }>(TRANSACTIONS_QUERY, {
    variables: {
      filters: {
        dateFrom,
        dateTo,
        ...(search ? { search } : {}),
        ...(typeFilter ? { transactionType: typeFilter } : {}),
      },
      limit: 200,
      offset: 0,
    },
  });

  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const { data: cardsData } = useQuery<{ creditCards: CreditCard[] }>(CREDIT_CARDS_QUERY);

  const transactions = txData?.transactions ?? [];
  const accounts = accountsData?.accounts ?? [];
  const categories = categoriesData?.categories ?? [];
  const cards = cardsData?.creditCards ?? [];

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const categoryOptions = [
    { value: "", label: "Sem categoria" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];
  const cardOptions = [
    { value: "", label: "Nenhum" },
    ...cards.map((c) => ({ value: c.id, label: c.name })),
  ];

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      transactionType: "expense",
      paymentMethod: "pix",
      date: todayISO(),
      isReceivable: false,
      totalInstallments: 1,
      competenceDate: "",
    },
  });

  const transactionType = watch("transactionType");
  const paymentMethod = watch("paymentMethod");
  const isReceivable = watch("isReceivable");
  const isCreditPayment = paymentMethod === "credit";
  const isTransfer = transactionType === "transfer";

  // Quando muda para transferência, força paymentMethod = "transfer"
  useEffect(() => {
    if (isTransfer && paymentMethod !== "transfer") {
      setValue("paymentMethod", "transfer");
    }
  }, [isTransfer, paymentMethod, setValue]);

  // Quando muda para crédito, força transactionType = "expense"
  useEffect(() => {
    if (isCreditPayment && transactionType !== "expense") {
      setValue("transactionType", "expense");
    }
  }, [isCreditPayment, transactionType, setValue]);

  const [createTransaction, { loading: creating }] = useMutation(CREATE_TRANSACTION_MUTATION, {
    refetchQueries: [TRANSACTIONS_QUERY, ACCOUNTS_QUERY],
    onCompleted: () => { toast.success("Lançamento criado!"); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [updateTransaction, { loading: updating }] = useMutation(UPDATE_TRANSACTION_MUTATION, {
    refetchQueries: [TRANSACTIONS_QUERY, ACCOUNTS_QUERY],
    onCompleted: () => { toast.success("Lançamento atualizado!"); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [deleteTransaction, { loading: deleting }] = useMutation(DELETE_TRANSACTION_MUTATION, {
    refetchQueries: [TRANSACTIONS_QUERY, ACCOUNTS_QUERY],
    onCompleted: () => { toast.success("Lançamento removido!"); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    reset({
      transactionType: "expense",
      paymentMethod: "pix",
      date: todayISO(),
      description: "",
      amount: undefined,
      accountId: accounts[0]?.id ?? "",
      categoryId: "",
      creditCardId: "",
      transferAccountId: "",
      totalInstallments: 1,
      isReceivable: false,
      debtorName: "",
      competenceDate: "",
      notes: "",
    });
    setModalOpen(true);
    // foca na descrição após animação
    setTimeout(() => descRef.current?.focus(), 100);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    reset({
      description: t.description,
      amount: t.amount,
      transactionType: t.transactionType,
      paymentMethod: t.paymentMethod,
      date: t.date,
      accountId: t.account?.id ?? "",
      creditCardId: t.creditCard?.id ?? "",
      transferAccountId: t.transferAccount?.id ?? "",   // ← fix: era ignorado antes
      categoryId: t.category?.id ?? "",
      isReceivable: t.isReceivable,
      debtorName: t.debtorName ?? "",
      competenceDate: t.competenceDate ?? "",
      notes: t.notes ?? "",
      totalInstallments: t.totalInstallments ?? 1,
    });
    setModalOpen(true);
    setTimeout(() => descRef.current?.focus(), 100);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function onSubmit(data: FormData) {
    const shared = {
      description: data.description,
      amount: data.amount,
      transactionType: data.transactionType,
      paymentMethod: data.paymentMethod,
      date: data.date,
      competenceDate: data.competenceDate || null,
      categoryId: data.categoryId || null,
      notes: data.notes || null,
      isReceivable: data.isReceivable,
      debtorName: data.isReceivable ? (data.debtorName || null) : null,
    };

    if (editing) {
      const accountId = data.paymentMethod === "credit" ? null : (data.accountId || null);
      updateTransaction({
        variables: { input: { id: editing.id, ...shared, accountId } },
      });
    } else {
      const createInput: Record<string, unknown> = { ...shared };
      if (data.paymentMethod === "credit") {
        createInput.creditCardId = data.creditCardId || null;
        createInput.accountId = null;
        createInput.totalInstallments = data.totalInstallments ?? 1;
      } else if (data.transactionType === "transfer") {
        createInput.accountId = data.accountId || null;
        createInput.transferAccountId = data.transferAccountId || null;
      } else {
        createInput.accountId = data.accountId || null;
      }
      createTransaction({ variables: { input: createInput } });
    }
  }

  // Navegação de mês
  function prevMonth() {
    setNavMonth(({ year, month }) => {
      const m = month - 1;
      return m === 0 ? { year: year - 1, month: 12 } : { year, month: m };
    });
  }
  function nextMonth() {
    setNavMonth(({ year, month }) => {
      const m = month + 1;
      return m === 13 ? { year: year + 1, month: 1 } : { year, month: m };
    });
  }

  // Agrupamento por data
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, t) => {
    if (!acc[t.date]) acc[t.date] = [];
    acc[t.date].push(t);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalIncome = transactions.filter(t => t.transactionType === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.transactionType === "expense").reduce((s, t) => s + t.amount, 0);

  // Ref callback para o campo de descrição
  const descRegister = register("description");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Lançamentos</h1>
          <p className="text-sm text-gray-500">{transactions.length} neste mês</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus size={16} /> Novo lançamento
        </Button>
      </div>

      {/* Navegação de mês + resumo */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="rounded-lg p-1.5 text-gray-400 hover:bg-surface-hover hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[160px] text-center text-sm font-medium text-white capitalize">
              {formatMonthLabel(navMonth.year, navMonth.month)}
            </span>
            <button onClick={nextMonth} className="rounded-lg p-1.5 text-gray-400 hover:bg-surface-hover hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-emerald-400">↑ {formatCurrency(totalIncome)}</span>
            <span className="text-red-400">↓ {formatCurrency(totalExpense)}</span>
            <span className={totalIncome - totalExpense >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
              = {formatCurrency(totalIncome - totalExpense)}
            </span>
          </div>
        </div>
      </Card>

      {/* Filtros */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lançamentos..."
              className="h-9 w-full rounded-lg border border-surface-border bg-surface pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "", label: "Todos" },
              { value: "income", label: "Receitas" },
              { value: "expense", label: "Despesas" },
              { value: "transfer", label: "Transferências" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setTypeFilter(tab.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  typeFilter === tab.value
                    ? "bg-violet-600 text-white"
                    : "bg-surface text-gray-400 hover:text-white border border-surface-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-card" />)}
        </div>
      ) : transactions.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <ArrowLeftRight size={40} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhum lançamento em {formatMonthLabel(navMonth.year, navMonth.month)}.</p>
          <Button onClick={openCreate}><Plus size={16} /> Novo lançamento</Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => {
            const dayTotal = grouped[dateKey].reduce((sum, t) => {
              if (t.transactionType === "income") return sum + t.amount;
              if (t.transactionType === "expense") return sum - t.amount;
              return sum;
            }, 0);

            return (
              <div key={dateKey}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{formatDate(dateKey)}</p>
                  <span className={`text-xs font-semibold ${dayTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {dayTotal >= 0 ? "+" : ""}{formatCurrency(dayTotal)}
                  </span>
                </div>
                <div className="space-y-1">
                  {grouped[dateKey].map((t) => (
                    <div
                      key={t.id}
                      className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-card px-3 py-3 sm:px-4 hover:border-violet-500/30 transition-colors group"
                    >
                      {/* Ícone */}
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5"
                        style={{ backgroundColor: (t.category?.color ?? "#6366f1") + "22", color: t.category?.color ?? "#6366f1" }}
                      >
                        {t.creditCard ? <CreditCardIcon size={14} /> : t.recurrence ? <RefreshCw size={14} /> : <ArrowLeftRight size={14} />}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-medium text-white leading-tight">{t.description}</p>
                              {t.totalInstallments && t.totalInstallments > 1 && (
                                <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-gray-400 shrink-0">
                                  {t.installmentNumber}/{t.totalInstallments}x
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                              {t.account && <span className="text-xs text-gray-500">{t.account.name}</span>}
                              {t.transferAccount && (
                                <span className="text-xs text-gray-500">→ {t.transferAccount.name}</span>
                              )}
                              {t.creditCard && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <CreditCardIcon size={10} />{t.creditCard.name}
                                </span>
                              )}
                              {t.invoice && (
                                <span className="text-xs text-gray-500">Fatura {formatMonthYear(t.invoice.referenceMonth)}</span>
                              )}
                              {t.isReceivable && t.debtorName && (
                                <span className="text-xs text-amber-400">↩ {t.debtorName}</span>
                              )}
                              {t.category && (
                                <span
                                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{ backgroundColor: t.category.color + "22", color: t.category.color }}
                                >
                                  {t.category.name}
                                </span>
                              )}
                              <span className="text-xs text-gray-600">{PAYMENT_METHOD_LABELS[t.paymentMethod]}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <p className={`text-sm font-semibold whitespace-nowrap ${
                              t.transactionType === "income" ? "text-emerald-400"
                              : t.transactionType === "expense" ? "text-red-400"
                              : "text-blue-400"
                            }`}>
                              {t.transactionType === "income" ? "+" : t.transactionType === "expense" ? "−" : ""}
                              {formatCurrency(t.amount)}
                            </p>
                            <div className="flex items-center gap-1">
                              <Badge variant={t.transactionType === "income" ? "income" : t.transactionType === "expense" ? "expense" : "transfer"}>
                                {TRANSACTION_TYPE_LABELS[t.transactionType]}
                              </Badge>
                              <button
                                onClick={() => openEdit(t)}
                                className="rounded-lg p-2 text-gray-500 hover:bg-surface-hover hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteId(t.id)}
                                className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação/edição */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? "Editar lançamento" : "Novo lançamento"} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Aviso para parcelados */}
          {editing && editing.totalInstallments && editing.totalInstallments > 1 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Este lançamento é parcelado ({editing.installmentNumber}/{editing.totalInstallments}x). Apenas este registro será alterado.
            </div>
          )}

          {/* Campos principais */}
          <Input
            label="Descrição"
            placeholder="Ex: Almoço, Conta de luz..."
            error={errors.description?.message}
            {...descRegister}
            ref={(el) => {
              descRegister.ref(el);
              descRef.current = el;
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor (R$)" type="number" step="0.01" placeholder="0,00" error={errors.amount?.message} {...register("amount")} />
            <Input label="Data" type="date" error={errors.date?.message} {...register("date")} />
          </div>

          {/* Tipo + método */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo"
              options={TRANSACTION_TYPE_OPTIONS}
              error={errors.transactionType?.message}
              {...register("transactionType")}
              disabled={isCreditPayment}
            />
            <Select
              label="Pagamento"
              options={PAYMENT_METHOD_OPTIONS}
              error={errors.paymentMethod?.message}
              {...register("paymentMethod")}
              disabled={isTransfer}
            />
          </div>

          {/* Campos condicionais */}
          {isCreditPayment ? (
            <div className="grid grid-cols-2 gap-3">
              <Select label="Cartão" options={cardOptions} placeholder="Selecione" error={errors.creditCardId?.message} {...register("creditCardId")} />
              {!editing && (
                <Input label="Parcelas" type="number" min={1} max={48} error={errors.totalInstallments?.message} {...register("totalInstallments")} />
              )}
            </div>
          ) : isTransfer ? (
            <div className="grid grid-cols-2 gap-3">
              <Select label="Origem" options={accountOptions} placeholder="Selecione" error={errors.accountId?.message} {...register("accountId")} />
              <Select label="Destino" options={accountOptions} placeholder="Selecione" error={errors.transferAccountId?.message} {...register("transferAccountId")} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Select label="Conta" options={accountOptions} placeholder="Conta" error={errors.accountId?.message} {...register("accountId")} />
              <Select label="Categoria" options={categoryOptions} {...register("categoryId")} />
            </div>
          )}

          {(isCreditPayment || isTransfer) && (
            <Select label="Categoria" options={categoryOptions} {...register("categoryId")} />
          )}

          {/* Valor a receber */}
          {!isTransfer && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isReceivable"
                  className="h-4 w-4 rounded border-surface-border bg-surface-card accent-violet-500"
                  {...register("isReceivable")}
                />
                <label htmlFor="isReceivable" className="text-sm text-gray-300">
                  Valor a receber
                  <span className="ml-1 text-xs text-gray-500">(será reembolsado)</span>
                </label>
              </div>
              {isReceivable && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Devedor" placeholder="Ex: João Silva" {...register("debtorName")} />
                  <Input label="Previsão" type="date" {...register("competenceDate")} />
                </div>
              )}
            </div>
          )}

          <Input label="Observação" placeholder="Nota adicional (opcional)" {...register("notes")} />

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={creating || updating}>
              {editing ? "Salvar alterações" : "Criar lançamento"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir lançamento" size="sm">
        <p className="text-sm text-gray-400">
          Tem certeza que deseja excluir este lançamento? O saldo será recalculado.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={() => deleteId && deleteTransaction({ variables: { id: deleteId } })}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
