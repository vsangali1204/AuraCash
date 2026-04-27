import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  CATEGORIES_QUERY,
  CREATE_CATEGORY_MUTATION,
  UPDATE_CATEGORY_MUTATION,
  DELETE_CATEGORY_MUTATION,
} from "@/graphql/queries/categories";
import { CATEGORY_TYPE_LABELS } from "@/lib/utils";
import type { Category } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  categoryType: z.string(),
  color: z.string(),
});

type FormData = z.infer<typeof schema>;

const CATEGORY_TYPE_OPTIONS = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
  { value: "both", label: "Ambos" },
];

const COLOR_OPTIONS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#14b8a6", "#84cc16", "#a855f7",
];

const DEFAULT_CATEGORIES = [
  { name: "Alimentação", categoryType: "expense", color: "#f97316" },
  { name: "Transporte", categoryType: "expense", color: "#3b82f6" },
  { name: "Moradia", categoryType: "expense", color: "#8b5cf6" },
  { name: "Saúde", categoryType: "expense", color: "#ef4444" },
  { name: "Educação", categoryType: "expense", color: "#eab308" },
  { name: "Lazer", categoryType: "expense", color: "#22c55e" },
  { name: "Salário", categoryType: "income", color: "#10b981" },
  { name: "Freelance", categoryType: "income", color: "#06b6d4" },
  { name: "Outros", categoryType: "both", color: "#6b7280" },
];

export function CategoriesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const { data, loading } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const allCategories = data?.categories ?? [];

  const categories =
    filter === "all"
      ? allCategories
      : allCategories.filter((c) => c.categoryType === filter || c.categoryType === "both");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { categoryType: "expense", color: "#6366f1" },
  });

  const selectedColor = watch("color");

  const [createCategory, { loading: creating }] = useMutation(CREATE_CATEGORY_MUTATION, {
    refetchQueries: [CATEGORIES_QUERY],
    onCompleted: () => { toast.success("Categoria criada!"); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [updateCategory, { loading: updating }] = useMutation(UPDATE_CATEGORY_MUTATION, {
    refetchQueries: [CATEGORIES_QUERY],
    onCompleted: () => { toast.success("Categoria atualizada!"); closeModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [deleteCategory, { loading: deleting }] = useMutation(DELETE_CATEGORY_MUTATION, {
    refetchQueries: [CATEGORIES_QUERY],
    onCompleted: () => { toast.success("Categoria removida!"); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    reset({ categoryType: "expense", color: "#6366f1", name: "" });
    setModalOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    reset({ name: cat.name, categoryType: cat.categoryType, color: cat.color });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function onSubmit(data: FormData) {
    if (editing) {
      updateCategory({ variables: { input: { id: editing.id, ...data } } });
    } else {
      createCategory({ variables: { input: data } });
    }
  }

  function createDefaults() {
    DEFAULT_CATEGORIES.forEach((cat) => {
      createCategory({ variables: { input: cat } });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Categorias</h1>
          <p className="text-sm text-gray-500">{allCategories.length} categorias cadastradas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {allCategories.length === 0 && (
            <Button variant="secondary" onClick={createDefaults} className="flex-1 sm:flex-none">
              Criar padrões
            </Button>
          )}
          <Button onClick={openCreate} className="flex-1 sm:flex-none">
            <Plus size={16} /> Nova categoria
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "Todas" },
          { value: "expense", label: "Despesas" },
          { value: "income", label: "Receitas" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-violet-600 text-white"
                : "bg-surface-card text-gray-400 hover:text-white border border-surface-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-card" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <Tag size={40} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhuma categoria cadastrada.</p>
          <div className="flex gap-2">
            <Button onClick={createDefaults} variant="secondary">
              Criar categorias padrão
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> Nova categoria
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-card p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ backgroundColor: cat.color + "22", color: cat.color }}
                >
                  {cat.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{cat.name}</p>
                  <Badge
                    variant={
                      cat.categoryType === "income"
                        ? "income"
                        : cat.categoryType === "expense"
                        ? "expense"
                        : "neutral"
                    }
                  >
                    {CATEGORY_TYPE_LABELS[cat.categoryType]}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEdit(cat)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-surface-hover hover:text-white transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteId(cat.id)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Editar categoria" : "Nova categoria"}
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nome" placeholder="Ex: Alimentação" error={errors.name?.message} {...register("name")} />
          <Select label="Tipo" options={CATEGORY_TYPE_OPTIONS} {...register("categoryType")} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Cor</label>
            <div className="flex flex-wrap gap-2">
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
              {editing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir categoria" size="sm">
        <p className="text-sm text-gray-400">
          Tem certeza que deseja excluir esta categoria? Os lançamentos vinculados ficarão sem
          categoria.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={() => deleteId && deleteCategory({ variables: { id: deleteId } })}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
