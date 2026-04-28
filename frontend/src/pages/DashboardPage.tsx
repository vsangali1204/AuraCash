import { useQuery } from "@apollo/client";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, Users, CreditCard, RefreshCw, Calculator } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DASHBOARD_SUMMARY_QUERY, TRANSACTIONS_QUERY } from "@/graphql/queries/transactions";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import { RECURRENCES_QUERY } from "@/graphql/queries/recurrences";
import { RECEIVABLE_SUMMARY_QUERY } from "@/graphql/queries/receivables";
import { formatCurrency, formatDate, formatMonthYear, TRANSACTION_TYPE_LABELS } from "@/lib/utils";
import type { Account, DashboardSummary, Recurrence, ReceivableSummary, Transaction } from "@/types";

const now = new Date();

const TOOLTIP_STYLE = {
  contentStyle: { background: "#13131f", border: "1px solid #2a2a3a", borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "#fff" },
  itemStyle: { color: "#a0a0b0" },
};

export function DashboardPage() {
  const { data: summaryData, loading: summaryLoading } = useQuery<{ dashboardSummary: DashboardSummary }>(
    DASHBOARD_SUMMARY_QUERY,
    { variables: { year: now.getFullYear(), month: now.getMonth() + 1 } }
  );

  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);
  const { data: txData } = useQuery<{ transactions: Transaction[] }>(TRANSACTIONS_QUERY, {
    variables: { limit: 8, offset: 0 },
  });
  const { data: recData } = useQuery<{ recurrences: Recurrence[] }>(RECURRENCES_QUERY, {
    variables: { activeOnly: true },
  });
  const { data: receivablesData } = useQuery<{ receivableSummary: ReceivableSummary[] }>(RECEIVABLE_SUMMARY_QUERY);

  const summary = summaryData?.dashboardSummary;
  const accounts = accountsData?.accounts ?? [];
  const transactions = txData?.transactions ?? [];
  const recurrences = (recData?.recurrences ?? []).filter((r) => r.isActive && r.nextExecutionDate);
  const receivables = receivablesData?.receivableSummary ?? [];
  const totalReceivable = receivables.reduce((s, r) => s + r.pendingAmount, 0);

  const monthLabel = now.toLocaleString("pt-BR", { month: "long", year: "numeric" });
  const balanceHistory = summary?.balanceHistory ?? [];
  const expenseByCategory = summary?.expenseByCategory ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 capitalize">{monthLabel}</p>
      </div>


      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <SummaryCard label="Saldo Total" value={summaryLoading ? null : (summary?.totalBalance ?? 0)} icon={<Wallet size={18} />} color="violet" />
        <SummaryCard label="Receitas do mês" value={summaryLoading ? null : (summary?.monthIncome ?? 0)} icon={<TrendingUp size={18} />} color="emerald" />
        <SummaryCard label="Despesas do mês" value={summaryLoading ? null : (summary?.monthExpense ?? 0)} icon={<TrendingDown size={18} />} color="red" />
        <SummaryCard
          label="A Receber"
          value={summaryLoading ? null : totalReceivable}
          icon={<Users size={18} />}
          color="amber"
        />
      </div>

      {/* Month projection */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            <Calculator size={15} />
          </div>
          <h2 className="text-sm font-semibold text-white">Projeção do Mês</h2>
          <span className="ml-auto text-xs text-gray-500 capitalize">{monthLabel}</span>
        </div>
        {summaryLoading ? (
          <div className="h-20 animate-pulse rounded bg-surface-border" />
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-0">
            {/* Income side */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Entradas confirmadas</span>
                <span className="text-sm font-medium text-emerald-400">{formatCurrency(summary?.monthIncome ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">A receber este mês</span>
                <span className="text-sm font-medium text-amber-400">{formatCurrency(summary?.monthReceivable ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-surface-border pt-2">
                <span className="text-xs font-semibold text-gray-300">Total de entradas</span>
                <span className="text-sm font-bold text-emerald-300">
                  {formatCurrency((summary?.monthIncome ?? 0) + (summary?.monthReceivable ?? 0))}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px bg-surface-border mx-6" />
            <div className="block sm:hidden h-px bg-surface-border" />

            {/* Expense + result side */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Despesas do mês</span>
                <span className="text-sm font-medium text-red-400">− {formatCurrency(summary?.monthExpense ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-surface-border pt-2 mt-auto">
                <span className="text-xs font-semibold text-gray-300">Saldo projetado</span>
                <span className={`text-base font-bold ${(summary?.projectedBalance ?? 0) >= 0 ? "text-violet-300" : "text-red-400"}`}>
                  {formatCurrency(summary?.projectedBalance ?? 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Balance history bar */}
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Receitas vs Despesas (12 meses)</h2>
            <Link to="/reports"><Button variant="ghost" size="sm">Ver relatórios</Button></Link>
          </div>
          {balanceHistory.length === 0 ? (
            <div className="flex h-44 items-center justify-center">
              <p className="text-sm text-gray-500">Sem dados suficientes.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <BarChart data={balanceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => formatMonthYear(v)} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Expense by category pie */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-white">Despesas por categoria</h2>
          {expenseByCategory.length === 0 ? (
            <div className="flex h-44 items-center justify-center">
              <p className="text-sm text-gray-500 text-center">Sem despesas com categoria este mês.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="total" nameKey="categoryName" cx="50%" cy="50%" outerRadius={55} innerRadius={32}>
                    {expenseByCategory.map((e, i) => <Cell key={i} fill={e.categoryColor} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {expenseByCategory.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.categoryColor }} />
                      <span className="text-xs text-gray-400 truncate max-w-[120px]">{item.categoryName}</span>
                    </div>
                    <span className="text-xs text-white">{item.percentage.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Accounts */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Contas</h2>
            <Link to="/accounts"><Button variant="ghost" size="sm">Ver todas</Button></Link>
          </div>
          {accounts.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma conta cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-lg bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                      style={{ backgroundColor: account.color + "33", color: account.color }}>
                      {account.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{account.name}</p>
                      <p className="text-xs text-gray-500">{account.bank || "—"}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${account.currentBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(account.currentBalance)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent transactions */}
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Últimos lançamentos</h2>
            <Link to="/transactions"><Button variant="ghost" size="sm">Ver todos</Button></Link>
          </div>
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum lançamento registrado.</p>
          ) : (
            <div className="space-y-1">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg p-2.5 hover:bg-surface transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: (t.category?.color ?? "#6366f1") + "22", color: t.category?.color ?? "#6366f1" }}>
                      <ArrowLeftRight size={13} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white leading-tight">{t.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-500">{formatDate(t.date)}</p>
                        {t.creditCard && <span className="text-xs text-gray-500 flex items-center gap-1"><CreditCard size={10} />{t.creditCard.name}</span>}
                        {t.category && (
                          <span className="inline-block rounded-full px-1.5 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: t.category.color + "22", color: t.category.color }}>
                            {t.category.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${t.transactionType === "income" ? "text-emerald-400" : t.transactionType === "expense" ? "text-red-400" : "text-blue-400"}`}>
                      {t.transactionType === "income" ? "+" : t.transactionType === "expense" ? "−" : ""}
                      {formatCurrency(t.amount)}
                    </p>
                    <Badge variant={t.transactionType === "income" ? "income" : t.transactionType === "expense" ? "expense" : "transfer"}>
                      {TRANSACTION_TYPE_LABELS[t.transactionType]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming recurrences + receivables */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Upcoming recurrences */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Próximas recorrências</h2>
            <Link to="/recurrences"><Button variant="ghost" size="sm">Ver todas</Button></Link>
          </div>
          {recurrences.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma recorrência ativa.</p>
          ) : (
            <div className="space-y-2">
              {recurrences.slice(0, 5).map((rec) => (
                <div key={rec.id} className="flex items-center justify-between rounded-lg bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${rec.recurrenceType === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                      <RefreshCw size={13} />
                    </div>
                    <div>
                      <p className="text-sm text-white">{rec.description}</p>
                      {rec.nextExecutionDate && (
                        <p className="text-xs text-gray-500">Próxima: {formatDate(rec.nextExecutionDate)}</p>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${rec.recurrenceType === "income" ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(rec.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* A receber */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">A receber</h2>
            <Link to="/receivables"><Button variant="ghost" size="sm">Ver todos</Button></Link>
          </div>
          {receivables.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum valor a receber pendente.</p>
          ) : (
            <div className="space-y-2">
              {receivables.slice(0, 5).map((r) => {
                const pct = r.totalAmount > 0 ? (r.receivedAmount / r.totalAmount) * 100 : 0;
                return (
                  <div key={r.debtorName} className="rounded-lg bg-surface p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold">
                          {r.debtorName[0].toUpperCase()}
                        </div>
                        <p className="text-sm text-white">{r.debtorName}</p>
                      </div>
                      <p className="text-sm font-semibold text-amber-400">{formatCurrency(r.pendingAmount)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-surface-border">
                        <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, icon, color,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  color: "violet" | "emerald" | "red" | "amber";
}) {
  const colorMap = {
    violet: { bg: "bg-violet-500/10", text: "text-violet-400", value: "text-violet-300" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", value: "text-emerald-300" },
    red: { bg: "bg-red-500/10", text: "text-red-400", value: "text-red-300" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", value: "text-amber-300" },
  };
  const c = colorMap[color];
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          {value === null ? (
            <div className="mt-1 h-6 w-24 animate-pulse rounded bg-surface-border" />
          ) : (
            <p className={`mt-1 text-base sm:text-xl font-bold ${c.value}`}>{formatCurrency(value)}</p>
          )}
        </div>
        <div className={`rounded-lg p-2 ${c.bg} ${c.text}`}>{icon}</div>
      </div>
    </Card>
  );
}
