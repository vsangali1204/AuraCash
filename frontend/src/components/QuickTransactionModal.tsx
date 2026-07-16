import { useEffect } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import { CATEGORIES_QUERY } from "@/graphql/queries/categories";
import { CREDIT_CARDS_QUERY } from "@/graphql/queries/creditCards";
import { CREATE_TRANSACTION_MUTATION, TRANSACTIONS_QUERY } from "@/graphql/queries/transactions";
import { todayISO } from "@/lib/utils";
import type { Account, Category, CreditCard } from "@/types";

const schema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  transactionType: z.enum(["expense", "income", "transfer"]),
  paymentMethod: z.string(),
  date: z.string().min(1, "Data obrigatória"),
  accountId: z.string().optional(), transferAccountId: z.string().optional(),
  creditCardId: z.string().optional(), totalInstallments: z.coerce.number().min(1).max(48).optional(),
  categoryId: z.string().optional(), notes: z.string().optional(), isReceivable: z.boolean().default(false),
  debtorName: z.string().optional(), competenceDate: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const paymentOptions = [
  { value: "debit", label: "Débito" }, { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" }, { value: "transfer", label: "Transferência" },
  { value: "credit", label: "Crédito" },
];

export function QuickTransactionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY, { skip: !open });
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY, { skip: !open });
  const { data: cardsData } = useQuery<{ creditCards: CreditCard[] }>(CREDIT_CARDS_QUERY, { skip: !open });
  const accounts = accountsData?.accounts ?? [];
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { transactionType: "expense", paymentMethod: "pix", date: todayISO(), totalInstallments: 1 },
  });
  const type = watch("transactionType");
  const payment = watch("paymentMethod");
  const isTransfer = type === "transfer";
  const isCredit = payment === "credit";
  const isReceivable = watch("isReceivable");

  useEffect(() => {
    if (open) reset({ transactionType: "expense", paymentMethod: "pix", date: todayISO(), totalInstallments: 1, accountId: accounts[0]?.id ?? "", isReceivable: false });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const [create, { loading }] = useMutation(CREATE_TRANSACTION_MUTATION, {
    refetchQueries: [TRANSACTIONS_QUERY, ACCOUNTS_QUERY],
    onCompleted: () => { toast.success("Lançamento criado!"); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  function setType(value: FormData["transactionType"]) {
    setValue("transactionType", value, { shouldDirty: true });
    setValue("paymentMethod", value === "transfer" ? "transfer" : payment === "transfer" ? "pix" : payment);
  }

  function submit(data: FormData) {
    const input: Record<string, unknown> = {
      description: data.description, amount: data.amount, transactionType: data.transactionType,
      paymentMethod: data.paymentMethod, date: data.date, categoryId: data.categoryId || null,
      notes: data.notes || null, isReceivable: data.isReceivable,
      debtorName: data.isReceivable ? data.debtorName || null : null,
      competenceDate: data.competenceDate || null,
    };
    if (data.paymentMethod === "credit") {
      input.creditCardId = data.creditCardId || null; input.accountId = null;
      input.totalInstallments = data.transactionType === "income" ? 1 : data.totalInstallments ?? 1;
    } else if (data.transactionType === "transfer") {
      input.accountId = data.accountId || null; input.transferAccountId = data.transferAccountId || null;
    } else input.accountId = data.accountId || null;
    create({ variables: { input } });
  }

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const categoryOptions = [{ value: "", label: "Sem categoria" }, ...(categoriesData?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))];
  const cardOptions = (cardsData?.creditCards ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <Modal open={open} onClose={onClose} title="Novo lançamento" size="lg" closeOnBackdropClick={!isDirty}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="flex overflow-hidden rounded-xl border border-surface-border">
          {(["expense", "income", "transfer"] as const).map((value, i) => (
            <button key={value} type="button" onClick={() => setType(value)} className={`flex-1 py-2.5 text-sm font-medium ${i ? "border-l border-surface-border" : ""} ${type === value ? "bg-sky-500/15 text-sky-400" : "text-gray-500 hover:text-gray-300"}`}>
              {{ expense: "Despesa", income: "Receita", transfer: "Transferência" }[value]}
            </button>
          ))}
        </div>
        <Input autoFocus label="Descrição" placeholder="Ex: Almoço, conta de luz..." error={errors.description?.message} {...register("description")} />
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
          <Input label="Valor (R$)" type="number" step="0.01" error={errors.amount?.message} {...register("amount")} />
          <Input label="Data" type="date" error={errors.date?.message} {...register("date")} />
        </div>
        <Select label="Pagamento" options={isTransfer ? paymentOptions : paymentOptions.filter((o) => o.value !== "transfer")} disabled={isTransfer} {...register("paymentMethod")} />
        {isCredit ? (
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
            <Select label="Cartão" options={cardOptions} placeholder="Selecione" {...register("creditCardId")} />
            {type === "expense" && <Input label="Parcelas" type="number" min={1} max={48} {...register("totalInstallments")} />}
          </div>
        ) : isTransfer ? (
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
            <Select label="Origem" options={accountOptions} placeholder="Selecione" {...register("accountId")} />
            <Select label="Destino" options={accountOptions} placeholder="Selecione" {...register("transferAccountId")} />
          </div>
        ) : <Select label="Conta" options={accountOptions} placeholder="Selecione" {...register("accountId")} />}
        <Select label="Categoria" options={categoryOptions} {...register("categoryId")} />
        {!isTransfer && (
          <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" className="h-4 w-4 accent-sky-500" {...register("isReceivable")} />
              Valor a receber <span className="text-xs text-gray-500">(será reembolsado)</span>
            </label>
            {isReceivable && <div className="grid grid-cols-1 gap-3 xs:grid-cols-2"><Input label="Devedor" {...register("debtorName")} /><Input label="Previsão" type="date" {...register("competenceDate")} /></div>}
          </div>
        )}
        <Input label="Observação" placeholder="Nota adicional (opcional)" {...register("notes")} />
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" loading={loading}>Criar lançamento</Button></div>
      </form>
    </Modal>
  );
}
