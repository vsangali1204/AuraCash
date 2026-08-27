import { useMutation, useQuery } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  AlertTriangle, ArrowDown, ArrowUp, Archive, ArchiveRestore, CalendarClock,
  ChevronDown, CircleCheck, Coins, PiggyBank, Plus, Pencil, Target, Trash2,
  TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import {
  ARCHIVE_GOAL_MUTATION, CREATE_GOAL_CONTRIBUTION_MUTATION, CREATE_GOAL_MUTATION,
  DELETE_GOAL_CONTRIBUTION_MUTATION, DELETE_GOAL_MUTATION, GOALS_QUERY, GOAL_PLAN_QUERY,
  REORDER_GOALS_MUTATION, UPDATE_GOAL_MUTATION, UPDATE_GOAL_PLAN_SETTINGS_MUTATION,
} from "@/graphql/queries/goals";
import { cn, formatCurrency, formatDate, formatMonthYear, todayISO } from "@/lib/utils";
import type { Account, Goal, GoalPlan } from "@/types";

const COLOR_OPTIONS = [
  "#0ea5e9", "#6366f1", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#14b8a6", "#84cc16", "#f43f5e",
];

const STRATEGY_OPTIONS = [
  { value: "sequential", label: "Sequencial — uma meta por vez, na ordem de prioridade" },
  { value: "proportional", label: "Proporcional — todas as metas avançam juntas" },
];

const WINDOW_OPTIONS = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Últimos 12 meses" },
];

const goalSchema = z.object({
  name: z.string().min(1, "Dê um nome para a meta"),
  description: z.string().optional(),
  targetAmount: z.coerce.number().positive("Informe um valor maior que zero"),
  initialAmount: z.coerce.number().min(0, "Não pode ser negativo").default(0),
  monthlyContribution: z.string().optional(),
  targetDate: z.string().optional(),
  accountId: z.string().optional(),
  color: z.string(),
});
type GoalFormData = z.infer<typeof goalSchema>;

const contributionSchema = z.object({
  amount: z.coerce.number().refine((v) => v !== 0, "Informe um valor diferente de zero"),
  date: z.string().min(1, "Informe a data"),
  accountId: z.string().optional(),
  notes: z.string().optional(),
});
type ContributionFormData = z.infer<typeof contributionSchema>;

/** "13 meses (set/2027)" — o prazo calculado, que é o que o usuário quer ver. */
function forecastLabel(months?: number | null, forecastDate?: string | null): string {
  if (months === 0) return "Meta já atingida";
  if (!months || !forecastDate) return "Sem previsão";
  const monthLabel = formatMonthYear(forecastDate);
  if (months === 1) return `1 mês · ${monthLabel}`;
  if (months < 12) return `${months} meses · ${monthLabel}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = years === 1 ? "1 ano" : `${years} anos`;
  const restPart = rest ? ` e ${rest} ${rest === 1 ? "mês" : "meses"}` : "";
  return `${yearPart}${restPart} · ${monthLabel}`;
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function StatLine({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "income" | "expense" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0 truncate text-gray-400">{label}</span>
      <span className={cn("shrink-0 font-medium tabular-nums",
        tone === "income" ? "text-emerald-400" : tone === "expense" ? "text-red-400" : "text-gray-200")}>
        {value}
      </span>
    </div>
  );
}

export function GoalsPage() {
  const [tab, setTab] = useState<"active" | "completed" | "archived">("active");
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contributionFor, setContributionFor] = useState<Goal | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [showCapacityDetail, setShowCapacityDetail] = useState(false);

  // Simulação: o usuário mexe no teto mensal e a projeção recalcula, sem gravar nada.
  const [budgetInput, setBudgetInput] = useState<number | null>(null);
  const [debouncedBudget, setDebouncedBudget] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [monthsWindow, setMonthsWindow] = useState<number | null>(null);
  const budgetInitialized = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedBudget(budgetInput), 350);
    return () => clearTimeout(timer);
  }, [budgetInput]);

  const { data, loading } = useQuery<{ goalPlan: GoalPlan }>(GOAL_PLAN_QUERY, {
    variables: { monthlyBudget: debouncedBudget, strategy, monthsWindow },
  });
  const { data: otherGoalsData } = useQuery<{ goals: Goal[] }>(GOALS_QUERY, {
    variables: { status: tab === "active" ? undefined : tab },
    skip: tab === "active",
  });
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);

  const plan = data?.goalPlan;
  const capacity = plan?.capacity;

  useEffect(() => {
    if (plan && !budgetInitialized.current) {
      budgetInitialized.current = true;
      setBudgetInput(plan.monthlyBudget);
      setDebouncedBudget(plan.monthlyBudget);
      setStrategy(plan.strategy);
      setMonthsWindow(plan.monthsWindow);
    }
  }, [plan]);

  const accountOptions = useMemo(
    () => [
      { value: "", label: "Nenhuma" },
      ...(accountsData?.accounts ?? []).map((a) => ({ value: a.id, label: a.name })),
    ],
    [accountsData]
  );

  const activeGoals = plan?.goals ?? [];
  const listedGoals = tab === "active" ? activeGoals : otherGoalsData?.goals ?? [];
  const available = capacity?.available ?? 0;
  const sliderMax = Math.max(Math.ceil(Math.max(available, budgetInput ?? 0) * 1.5), 500);
  const unreachableCount = activeGoals.filter((g) => !g.isReachable).length;

  const refetchAll = [
    { query: GOAL_PLAN_QUERY, variables: { monthlyBudget: debouncedBudget, strategy, monthsWindow } },
    { query: GOALS_QUERY, variables: { status: tab === "active" ? undefined : tab } },
  ];

  const [createGoal, { loading: creating }] = useMutation(CREATE_GOAL_MUTATION, {
    refetchQueries: refetchAll,
    onCompleted: () => { toast.success("Meta criada!"); closeGoalModal(); },
    onError: (e) => toast.error(e.message),
  });
  const [updateGoal, { loading: updating }] = useMutation(UPDATE_GOAL_MUTATION, {
    refetchQueries: refetchAll,
    onCompleted: () => { toast.success("Meta atualizada!"); closeGoalModal(); },
    onError: (e) => toast.error(e.message),
  });
  const [deleteGoal, { loading: deleting }] = useMutation(DELETE_GOAL_MUTATION, {
    refetchQueries: refetchAll,
    onCompleted: () => { toast.success("Meta removida!"); setDeleteGoalId(null); },
    onError: (e) => toast.error(e.message),
  });
  const [archiveGoal] = useMutation(ARCHIVE_GOAL_MUTATION, {
    refetchQueries: refetchAll,
    onCompleted: () => toast.success("Meta atualizada!"),
    onError: (e) => toast.error(e.message),
  });
  const [reorderGoals] = useMutation(REORDER_GOALS_MUTATION, {
    refetchQueries: refetchAll,
    onError: (e) => toast.error(e.message),
  });
  const [createContribution, { loading: contributing }] = useMutation(CREATE_GOAL_CONTRIBUTION_MUTATION, {
    refetchQueries: refetchAll,
    onCompleted: () => { toast.success("Aporte registrado!"); setContributionFor(null); },
    onError: (e) => toast.error(e.message),
  });
  const [deleteContribution] = useMutation(DELETE_GOAL_CONTRIBUTION_MUTATION, {
    refetchQueries: refetchAll,
    onCompleted: () => toast.success("Aporte removido!"),
    onError: (e) => toast.error(e.message),
  });
  const [saveSettings, { loading: savingSettings }] = useMutation(UPDATE_GOAL_PLAN_SETTINGS_MUTATION, {
    refetchQueries: refetchAll,
    onCompleted: () => toast.success("Plano salvo!"),
    onError: (e) => toast.error(e.message),
  });

  const goalForm = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: { color: COLOR_OPTIONS[1], initialAmount: 0 },
  });
  const contributionForm = useForm<ContributionFormData>({
    resolver: zodResolver(contributionSchema),
    defaultValues: { date: todayISO() },
  });
  const selectedColor = goalForm.watch("color");

  function openCreateGoal() {
    setEditing(null);
    goalForm.reset({
      name: "", description: "", targetAmount: undefined, initialAmount: 0,
      monthlyContribution: "", targetDate: "", accountId: "", color: COLOR_OPTIONS[1],
    });
    setGoalModalOpen(true);
  }

  function openEditGoal(goal: Goal) {
    setEditing(goal);
    goalForm.reset({
      name: goal.name,
      description: goal.description ?? "",
      targetAmount: goal.targetAmount,
      initialAmount: goal.initialAmount,
      monthlyContribution: goal.monthlyContribution != null ? String(goal.monthlyContribution) : "",
      targetDate: goal.targetDate ?? "",
      accountId: goal.accountId ?? "",
      color: goal.color,
    });
    setGoalModalOpen(true);
  }

  function closeGoalModal() { setGoalModalOpen(false); setEditing(null); }

  function openContribution(goal: Goal) {
    setContributionFor(goal);
    contributionForm.reset({ amount: undefined, date: todayISO(), accountId: goal.accountId ?? "", notes: "" });
  }

  function onSubmitGoal(form: GoalFormData) {
    const monthly = form.monthlyContribution?.trim();
    const input = {
      name: form.name,
      description: form.description ?? "",
      targetAmount: form.targetAmount,
      initialAmount: form.initialAmount,
      monthlyContribution: monthly ? Number(monthly) : null,
      targetDate: form.targetDate || null,
      accountId: form.accountId || null,
      color: form.color,
    };
    if (editing) updateGoal({ variables: { input: { id: editing.id, ...input } } });
    else createGoal({ variables: { input } });
  }

  function onSubmitContribution(form: ContributionFormData) {
    if (!contributionFor) return;
    createContribution({
      variables: {
        input: {
          goalId: contributionFor.id,
          amount: form.amount,
          date: form.date,
          accountId: form.accountId || null,
          notes: form.notes || null,
        },
      },
    });
  }

  function movePriority(goal: Goal, direction: -1 | 1) {
    const ordered = [...activeGoals];
    const index = ordered.findIndex((g) => g.id === goal.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    reorderGoals({ variables: { ids: ordered.map((g) => g.id) } });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planejamento"
        title="Metas financeiras"
        description="O prazo de cada meta é calculado a partir dos seus salários, contas fixas, faturas e gastos médios — você só decide quanto quer destinar por mês."
        action={<Button onClick={openCreateGoal}><Plus size={16} /> Nova meta</Button>}
      />

      {loading && !plan ? (
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-2xl bg-surface-card" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface-card" />
        </div>
      ) : (
        <>
          {/* ── Capacidade mensal ───────────────────────────────────────────── */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Quanto sobra por mês</h2>
              <button
                onClick={() => setShowCapacityDetail((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
              >
                {showCapacityDetail ? "Ocultar detalhes" : "Ver de onde vem"}
                <ChevronDown size={14} className={cn("transition-transform", showCapacityDetail && "rotate-180")} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                  <TrendingUp size={14} /> Entra por mês
                </div>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-white">
                  {formatCurrency(capacity?.totalIncome ?? 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {capacity?.incomeSources.length ?? 0} recorrência(s) de receita
                </p>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-red-400">
                  <TrendingDown size={14} /> Sai por mês
                </div>
                <p className="mt-1.5 text-xl font-bold tabular-nums text-white">
                  {formatCurrency(capacity?.totalExpenses ?? 0)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Fixas + faturas + gastos variáveis
                </p>
              </div>

              <div className={cn(
                "rounded-xl border p-4",
                available >= 0 ? "border-sky-500/25 bg-sky-500/[0.08]" : "border-amber-500/25 bg-amber-500/[0.08]"
              )}>
                <div className={cn("flex items-center gap-2 text-xs font-medium", available >= 0 ? "text-sky-400" : "text-amber-400")}>
                  <PiggyBank size={14} /> Sobra mensal
                </div>
                <p className={cn("mt-1.5 text-xl font-bold tabular-nums", available >= 0 ? "text-white" : "text-amber-300")}>
                  {formatCurrency(available)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Máximo disponível para metas
                </p>
              </div>
            </div>

            {showCapacityDetail && (
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-surface-border pt-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Receitas</p>
                  {capacity?.incomeSources.length ? (
                    capacity.incomeSources.map((source, i) => (
                      <StatLine
                        key={`${source.description}-${i}`}
                        label={`${source.description} · dia ${source.dayOfMonth} · ${source.accountName}`}
                        value={formatCurrency(source.amount)}
                        tone="income"
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      Nenhuma receita recorrente cadastrada. Cadastre seus salários em Recorrências para o cálculo ficar preciso.
                    </p>
                  )}
                  {!!capacity?.extraIncomeAverage && (
                    <StatLine
                      label={`Outras receitas (média de ${capacity.monthsWindow} meses)`}
                      value={formatCurrency(capacity.extraIncomeAverage)}
                      tone="income"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Compromissos</p>
                  {capacity?.expenseItems.length ? (
                    capacity.expenseItems.map((item, i) => (
                      <StatLine
                        key={`${item.description}-${i}`}
                        label={item.description}
                        value={formatCurrency(item.amount)}
                        tone="expense"
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Nenhuma despesa encontrada no período.</p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* ── Teto mensal destinado às metas ──────────────────────────────── */}
          <Card>
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-white">Quanto destinar às metas por mês</h2>
              <p className="text-xs text-gray-500">
                Este é o teto que você aceita guardar todo mês. A partir dele calculamos o prazo de cada meta.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-2xl font-bold tabular-nums text-white">
                    {formatCurrency(budgetInput ?? 0)}
                    <span className="ml-1 text-sm font-normal text-gray-500">/mês</span>
                  </p>
                  {available > 0 && (
                    <p className="text-xs text-gray-500">
                      {Math.round(((budgetInput ?? 0) / available) * 100)}% da sobra
                    </p>
                  )}
                </div>

                <input
                  type="range"
                  min={0}
                  max={sliderMax}
                  step={50}
                  value={budgetInput ?? 0}
                  onChange={(e) => setBudgetInput(Number(e.target.value))}
                  aria-label="Valor mensal destinado às metas"
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-sky-500"
                />

                <div className="flex flex-wrap gap-2">
                  {[0.25, 0.5, 0.75, 1].map((factor) => (
                    <button
                      key={factor}
                      type="button"
                      onClick={() => setBudgetInput(Math.round(Math.max(available, 0) * factor))}
                      className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-sky-500/40 hover:text-white"
                    >
                      {factor * 100}% da sobra
                    </button>
                  ))}
                  <Input
                    type="number"
                    min={0}
                    step="50"
                    aria-label="Valor exato por mês"
                    value={budgetInput ?? 0}
                    onChange={(e) => setBudgetInput(Number(e.target.value))}
                    className="h-9 w-32"
                  />
                </div>

                {plan?.exceedsCapacity && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 text-xs text-amber-300">
                    <AlertTriangle size={15} className="mt-px shrink-0" />
                    <span>
                      Esse valor passa da sua sobra mensal de {formatCurrency(available)}. O prazo abaixo só se
                      confirma se você cortar gastos ou aumentar a renda.
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Select
                  label="Como dividir entre as metas"
                  options={STRATEGY_OPTIONS}
                  value={strategy ?? "sequential"}
                  onChange={(e) => setStrategy(e.target.value)}
                />
                <Select
                  label="Base do cálculo de gastos"
                  options={WINDOW_OPTIONS}
                  value={String(monthsWindow ?? 3)}
                  onChange={(e) => setMonthsWindow(Number(e.target.value))}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    loading={savingSettings}
                    onClick={() =>
                      saveSettings({
                        variables: {
                          input: { monthlyBudget: budgetInput ?? 0, strategy, monthsWindow },
                        },
                      })
                    }
                  >
                    Salvar plano
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    title="Volta a usar a sobra mensal calculada"
                    onClick={() => {
                      setBudgetInput(Math.max(available, 0));
                      saveSettings({ variables: { input: { monthlyBudget: null, strategy, monthsWindow } } });
                    }}
                  >
                    Usar a sobra
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* ── Resumo do plano ─────────────────────────────────────────────── */}
          {activeGoals.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card padding="sm" className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-gray-500"><Target size={13} /> Total das metas</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">{formatCurrency(plan?.totalTarget ?? 0)}</p>
              </Card>
              <Card padding="sm" className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-gray-500"><Coins size={13} /> Já guardado</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-400">{formatCurrency(plan?.totalSaved ?? 0)}</p>
              </Card>
              <Card padding="sm" className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-gray-500"><Wallet size={13} /> Ainda falta</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">{formatCurrency(plan?.totalRemaining ?? 0)}</p>
              </Card>
              <Card padding="sm" className="p-4">
                <p className="flex items-center gap-1.5 text-xs text-gray-500"><CalendarClock size={13} /> Todas concluídas em</p>
                <p className="mt-1 text-lg font-bold text-sky-400">
                  {plan?.monthsUntilAllGoals
                    ? forecastLabel(plan.monthsUntilAllGoals, plan.allGoalsForecastDate)
                    : "—"}
                </p>
              </Card>
            </div>
          )}

          {unreachableCount > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 text-sm text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                {unreachableCount === 1
                  ? "1 meta não é alcançada com o valor mensal atual."
                  : `${unreachableCount} metas não são alcançadas com o valor mensal atual.`}{" "}
                Aumente o valor destinado por mês ou reduza os alvos.
              </span>
            </div>
          )}

          {/* ── Tabs ────────────────────────────────────────────────────────── */}
          <div className="flex gap-2">
            {([["active", "Ativas"], ["completed", "Concluídas"], ["archived", "Arquivadas"]] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  tab === value
                    ? "bg-sky-600 text-white"
                    : "border border-surface-border bg-surface-card text-gray-400 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Lista de metas ──────────────────────────────────────────────── */}
          {listedGoals.length === 0 ? (
            <EmptyState
              icon={Target}
              title={tab === "active" ? "Nenhuma meta ativa" : "Nada por aqui"}
              description={
                tab === "active"
                  ? "Crie sua primeira meta e descubra em quanto tempo ela sai, com base no que sobra todo mês."
                  : "As metas concluídas e arquivadas aparecem aqui."
              }
              action={tab === "active" ? <Button onClick={openCreateGoal}><Plus size={16} /> Nova meta</Button> : undefined}
            />
          ) : (
            <div className="space-y-3">
              {listedGoals.map((goal, index) => {
                const isActiveTab = tab === "active";
                const expanded = expandedGoal === goal.id;
                return (
                  <Card key={goal.id} className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
                        >
                          {goal.status === "completed" ? <CircleCheck size={18} /> : <Target size={18} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-white">{goal.name}</p>
                            {isActiveTab && <Badge variant="neutral">#{index + 1} na fila</Badge>}
                            {goal.status === "completed" && <Badge variant="income">Concluída</Badge>}
                            {goal.status === "archived" && <Badge variant="neutral">Arquivada</Badge>}
                            {isActiveTab && goal.onTrack === true && <Badge variant="income">Dentro do prazo</Badge>}
                            {isActiveTab && goal.onTrack === false && <Badge variant="expense">Fora do prazo desejado</Badge>}
                          </div>
                          {goal.description && <p className="mt-0.5 truncate text-xs text-gray-500">{goal.description}</p>}
                          {goal.accountName && <p className="mt-0.5 text-xs text-gray-500">Guardado em {goal.accountName}</p>}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                        {isActiveTab && (
                          <>
                            <button
                              onClick={() => movePriority(goal, -1)}
                              disabled={index === 0}
                              aria-label={`Subir prioridade de ${goal.name}`}
                              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-surface-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => movePriority(goal, 1)}
                              disabled={index === listedGoals.length - 1}
                              aria-label={`Descer prioridade de ${goal.name}`}
                              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-surface-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openContribution(goal)}
                          aria-label={`Registrar aporte em ${goal.name}`}
                          title="Registrar aporte"
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                        >
                          <Coins size={14} />
                        </button>
                        <button
                          onClick={() => openEditGoal(goal)}
                          aria-label={`Editar ${goal.name}`}
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-surface-hover hover:text-white"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => archiveGoal({ variables: { id: goal.id } })}
                          aria-label={goal.status === "archived" ? `Reativar ${goal.name}` : `Arquivar ${goal.name}`}
                          title={goal.status === "archived" ? "Reativar" : "Arquivar"}
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-surface-hover hover:text-white"
                        >
                          {goal.status === "archived" ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                        </button>
                        <button
                          onClick={() => setDeleteGoalId(goal.id)}
                          aria-label={`Excluir ${goal.name}`}
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <ProgressBar pct={goal.progressPct} color={goal.color} />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">
                          <span className="font-semibold text-white">{formatCurrency(goal.currentAmount)}</span>
                          {" de "}{formatCurrency(goal.targetAmount)}
                        </span>
                        <span className="tabular-nums text-gray-500">{goal.progressPct.toFixed(1)}%</span>
                      </div>
                    </div>

                    {isActiveTab && (
                      <div className="grid grid-cols-1 gap-3 border-t border-surface-border pt-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-gray-500">Aporte no 1º mês</p>
                          {goal.monthlyAllocation ? (
                            <p className="mt-0.5 font-semibold tabular-nums text-white">
                              {formatCurrency(goal.monthlyAllocation)}
                              {goal.monthlyContribution != null && (
                                <span className="ml-1 text-[11px] font-normal text-sky-400">(fixo)</span>
                              )}
                            </p>
                          ) : (
                            <>
                              <p className="mt-0.5 font-semibold text-gray-400">Na fila</p>
                              <p className="text-[11px] text-gray-500">
                                {goal.isReachable
                                  ? "começa quando as metas acima fecharem"
                                  : "nenhum valor sobra para esta meta"}
                              </p>
                            </>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-gray-500">Previsão de conclusão</p>
                          <p className={cn("mt-0.5 font-semibold", goal.isReachable ? "text-sky-400" : "text-amber-400")}>
                            {goal.isReachable
                              ? forecastLabel(goal.monthsToComplete, goal.forecastDate)
                              : "Inalcançável com o valor atual"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-gray-500">
                            {goal.targetDate ? "Prazo desejado" : "Falta juntar"}
                          </p>
                          <p className="mt-0.5 font-semibold tabular-nums text-gray-200">
                            {goal.targetDate ? formatDate(goal.targetDate) : formatCurrency(goal.remainingAmount)}
                          </p>
                          {goal.targetDate && goal.requiredMonthly != null && (
                            <p className="text-[11px] text-gray-500">
                              exige {formatCurrency(goal.requiredMonthly)}/mês
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <button
                        onClick={() => setExpandedGoal(expanded ? null : goal.id)}
                        className="flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors hover:text-white"
                      >
                        {goal.contributions.length} aporte(s)
                        <ChevronDown size={13} className={cn("transition-transform", expanded && "rotate-180")} />
                      </button>
                      {expanded && (
                        <div className="mt-2 space-y-1.5">
                          {goal.initialAmount > 0 && (
                            <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                              <span className="text-gray-400">Valor inicial informado na criação</span>
                              <span className="tabular-nums text-gray-300">{formatCurrency(goal.initialAmount)}</span>
                            </div>
                          )}
                          {goal.contributions.length === 0 && goal.initialAmount === 0 && (
                            <p className="text-xs text-gray-500">Nenhum aporte registrado ainda.</p>
                          )}
                          {goal.contributions.map((contribution) => (
                            <div key={contribution.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                              <span className="min-w-0 truncate text-gray-400">
                                {formatDate(contribution.date)}
                                {contribution.accountName ? ` · ${contribution.accountName}` : ""}
                                {contribution.notes ? ` · ${contribution.notes}` : ""}
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className={cn("tabular-nums", contribution.amount >= 0 ? "text-emerald-400" : "text-red-400")}>
                                  {formatCurrency(contribution.amount)}
                                </span>
                                <button
                                  onClick={() => deleteContribution({ variables: { id: contribution.id } })}
                                  aria-label="Remover aporte"
                                  className="rounded p-1 text-gray-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modal de meta ─────────────────────────────────────────────────── */}
      <Modal
        open={goalModalOpen}
        onClose={closeGoalModal}
        title={editing ? "Editar meta" : "Nova meta"}
        size="lg"
        closeOnBackdropClick={!goalForm.formState.isDirty}
      >
        <form onSubmit={goalForm.handleSubmit(onSubmitGoal)} className="space-y-4">
          <Input label="Nome da meta" placeholder="Ex: Reserva de emergência, Viagem, Carro"
            error={goalForm.formState.errors.name?.message} {...goalForm.register("name")} />
          <Input label="Descrição (opcional)" placeholder="Um detalhe para lembrar do porquê"
            {...goalForm.register("description")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Quanto quero juntar (R$)" type="number" step="0.01"
              error={goalForm.formState.errors.targetAmount?.message} {...goalForm.register("targetAmount")} />
            <Input label="Já tenho guardado (R$)" type="number" step="0.01"
              error={goalForm.formState.errors.initialAmount?.message} {...goalForm.register("initialAmount")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Aporte mensal fixo (opcional)"
              type="number"
              step="0.01"
              hint="Reserva esse valor para a meta antes do rateio automático"
              {...goalForm.register("monthlyContribution")}
            />
            <Input
              label="Prazo desejado (opcional)"
              type="date"
              hint="Só para comparar com a previsão calculada"
              {...goalForm.register("targetDate")}
            />
          </div>
          <Select label="Conta onde o dinheiro fica" options={accountOptions} {...goalForm.register("accountId")} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Cor</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => goalForm.setValue("color", color, { shouldDirty: true })}
                  aria-label={`Cor ${color}`}
                  aria-pressed={selectedColor === color}
                  className="h-9 w-9 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-surface"
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
            <Button type="button" variant="secondary" onClick={closeGoalModal}>Cancelar</Button>
            <Button type="submit" loading={creating || updating}>{editing ? "Salvar" : "Criar meta"}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal de aporte ───────────────────────────────────────────────── */}
      <Modal
        open={!!contributionFor}
        onClose={() => setContributionFor(null)}
        title={`Aporte — ${contributionFor?.name ?? ""}`}
        closeOnBackdropClick={!contributionForm.formState.isDirty}
      >
        <form onSubmit={contributionForm.handleSubmit(onSubmitContribution)} className="space-y-4">
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            hint="Use um valor negativo para registrar um resgate"
            error={contributionForm.formState.errors.amount?.message}
            {...contributionForm.register("amount")}
          />
          <Input label="Data" type="date" error={contributionForm.formState.errors.date?.message}
            {...contributionForm.register("date")} />
          <Select label="Conta de origem" options={accountOptions} {...contributionForm.register("accountId")} />
          <Input label="Observação (opcional)" {...contributionForm.register("notes")} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setContributionFor(null)}>Cancelar</Button>
            <Button type="submit" loading={contributing}>Registrar aporte</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal de exclusão ─────────────────────────────────────────────── */}
      <Modal open={!!deleteGoalId} onClose={() => setDeleteGoalId(null)} title="Excluir meta" size="sm" closeOnBackdropClick={false}>
        <p className="text-sm text-gray-400">
          Tem certeza? Os aportes registrados nesta meta também serão removidos.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteGoalId(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={() => deleteGoalId && deleteGoal({ variables: { id: deleteGoalId } })}>
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
