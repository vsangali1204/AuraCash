import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  ACCOUNTS_QUERY,
  CREATE_ACCOUNT_MUTATION,
  UPDATE_ACCOUNT_MUTATION,
  DELETE_ACCOUNT_MUTATION,
} from "@/graphql/queries/accounts";
import { formatCurrency, ACCOUNT_TYPE_LABELS } from "@/lib/utils";
import type { Account } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  bank: z.string().optional(),
  accountType: z.string(),
  initialBalance: z.coerce.number(),
  color: z.string(),
});

type FormData = z.infer<typeof schema>;

const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const COLOR_OPTIONS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

export function AccountsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data, loading } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);
  const accounts = data?.accounts ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { accountType: "checking", color: "#6366f1", initialBalance: 0 },
  });

  const selectedColor = watch("color");

  const [createAccount, { loading: creating }] = useMutation(CREATE_ACCOUNT_MUTATION, {
    refetchQueries: [ACCOUNTS_QUERY],
    onCompleted: () => { toast.success("Conta criada!"); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [updateAccount, { loading: updating }] = useMutation(UPDATE_ACCOUNT_MUTATION, {
    refetchQueries: [ACCOUNTS_QUERY],
    onCompleted: () => { toast.success("Conta atualizada!"); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [deleteAccount, { loading: deleting }] = useMutation(DELETE_ACCOUNT_MUTATION, {
    refetchQueries: [ACCOUNTS_QUERY],
    onCompleted: () => { toast.success("Conta removida!"); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    reset({ accountType: "checking", color: "#6366f1", initialBalance: 0, name: "", bank: "" });
    setModalOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    reset({
      name: account.name,
      bank: account.bank,
      accountType: account.accountType,
      initialBalance: account.initialBalance,
      color: account.color,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function onSubmit(data: FormData) {
    if (editing) {
      updateAccount({ variables: { input: { id: editing.id, ...data } } });
    } else {
      createAccount({ variables: { input: data } });
    }
  }

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Contas Bancárias</h1>
          <p className="text-sm text-gray-500">
            Saldo total:{" "}
            <span className={totalBalance >= 0 ? "text-emerald-400" : "text-red-400"}>
              {formatCurrency(totalBalance)}
            </span>
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus size={16} /> Nova conta
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-card" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <Wallet size={40} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhuma conta cadastrada.</p>
          <Button onClick={openCreate} variant="secondary">
            <Plus size={16} /> Criar conta
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="relative">
              <div
                className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
                style={{ backgroundColor: account.color }}
              />
              <div className="pl-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white">{account.name}</p>
                    <p className="text-xs text-gray-500">
                      {account.bank || ACCOUNT_TYPE_LABELS[account.accountType]}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(account)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-surface-hover hover:text-white transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(account.id)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-gray-500">Saldo atual</p>
                  <p
                    className={`text-2xl font-bold ${
                      account.currentBalance >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {formatCurrency(account.currentBalance)}
                  </p>
                  {account.initialBalance !== 0 && (
                    <p className="text-xs text-gray-600">
                      Inicial: {formatCurrency(account.initialBalance)}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Editar conta" : "Nova conta"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nome da conta" placeholder="Ex: Nubank, BB Corrente" error={errors.name?.message} {...register("name")} />
          <Input label="Banco / Instituição" placeholder="Ex: Nubank" error={errors.bank?.message} {...register("bank")} />
          <Select
            label="Tipo de conta"
            options={ACCOUNT_TYPE_OPTIONS}
            {...register("accountType")}
          />
          <Input
            label="Saldo inicial (R$)"
            type="number"
            step="0.01"
            placeholder="0,00"
            error={errors.initialBalance?.message}
            {...register("initialBalance")}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue("color", color)}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    outline: selectedColor === color ? `2px solid ${color}` : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" loading={creating || updating}>
              {editing ? "Salvar" : "Criar conta"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir conta" size="sm">
        <p className="text-sm text-gray-400">
          Tem certeza que deseja excluir esta conta? Todos os lançamentos vinculados serão removidos.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={() => deleteId && deleteAccount({ variables: { id: deleteId } })}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
