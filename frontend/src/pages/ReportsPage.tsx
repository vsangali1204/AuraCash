import { useQuery } from "@apollo/client";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  ChevronLeft, ChevronRight, BarChart2,
} from "lucide-react";

import { Card } from "@/components/ui/Card";
import { DASHBOARD_SUMMARY_QUERY } from "@/graphql/queries/transactions";
import { CREDIT_CARDS_QUERY, INVOICES_QUERY } from "@/graphql/queries/creditCards";
import { RECEIVABLE_SUMMARY_QUERY } from "@/graphql/queries/receivables";
import { formatCurrency, formatMonthYear } from "@/lib/utils";
import type { CreditCard as CreditCardType, DashboardSummary, Invoice, ReceivableSummary } from "@/types";

const now = new Date();
const MONTHS_LABEL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "#e5e7eb" },
  itemStyle: { color: "#9ca3af" },
};

export function ReportsPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedCardId, setSelectedCardId] = useState<string>("");

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const { data: summaryData, loading: summaryLoading } = useQuery<{ dashboardSummary: DashboardSummary }>(
    DASHBOARD_SUMMARY_QUERY, { variables: { year, month } }
  );

  const { data: cardsData } = useQuery<{ creditCards: CreditCardType[] }>(CREDIT_CARDS_QUERY);
  const { data: invoicesData } = useQuery<{ invoices: Invoice[] }>(INVOICES_QUERY, {
    variables: { creditCardId: selectedCardId },
    skip: !selectedCardId,
  });
  const { data: receivablesData } = useQuery<{ receivableSummary: ReceivableSummary[] }>(RECEIVABLE_SUMMARY_QUERY);

  const summary = summaryData?.dashboardSummary;
  const cards = cardsData?.creditCards ?? [];
  const invoices = invoicesData?.invoices ?? [];
  const receivables = receivablesData?.receivableSummary ?? [];

  const balanceHistory = summary?.balanceHistory ?? [];
  const expenseByCategory = summary?.expenseByCategory ?? [];
  const incomeByCategory = summary?.incomeByCategory ?? [];
  const totalReceivable = receivables.reduce((s, r) => s + r.pendingAmount, 0);

  // Computed stats from balance history
  const stats = useMemo(() => {
    if (balanceHistory.length === 0) return null;
    const incomes = balanceHistory.map(h => h.income);
    const expenses = balanceHistory.map(h => h.expense);
    const nets = balanceHistory.map(h => h.income - h.expense);
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const max = (arr: number[]) => Math.max(...arr);
    const bestMonthIdx = nets.indexOf(Math.max(...nets));
    const worstMonthIdx = nets.indexOf(Math.min(...nets));
    return {
      avgIncome: avg(incomes),
      avgExpense: avg(expenses),
      avgNet: avg(nets),
      maxIncome: max(incomes),
      maxExpense: max(expenses),
      bestMonth: balanceHistory[bestMonthIdx]?.month ?? "",
      worstMonth: balanceHistory[worstMonthIdx]?.month ?? "",
      bestNet: Math.max(...nets),
      worstNet: Math.min(...nets),
    };
  }, [balanceHistory]);

  // Running net balance (cumulative) from history
  const historyWithCumulative = useMemo(() => {
    let cum = 0;
    return balanceHistory.map(h => {
      cum += h.income - h.expense;
      return { ...h, cumulative: cum };
    });
  }, [balanceHistory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Relatórios</h1>
          <p className="text-sm text-gray-500">Análise financeira detalhada</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-lg border border-surface-border p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              {MONTHS_LABEL.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={nextMonth}
            className="rounded-lg border border-surface-border p-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-card" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Saldo Total" value={summary?.totalBalance ?? 0} icon={<DollarSign size={16} />} color="sky" />
          <StatCard label={`Receitas — ${MONTHS_LABEL[month - 1]}`} value={summary?.monthIncome ?? 0} icon={<TrendingUp size={16} />} color="emerald" />
          <StatCard label={`Despesas — ${MONTHS_LABEL[month - 1]}`} value={summary?.monthExpense ?? 0} icon={<TrendingDown size={16} />} color="red" />
          <StatCard label="A Receber (total)" value={totalReceivable} icon={<CreditCard size={16} />} color="amber" />
        </div>
      )}

      {/* Period statistics */}
      {stats && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <BarChart2 size={16} className="text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Estatísticas dos últimos 6 meses</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <MiniStat label="Receita média/mês" value={stats.avgIncome} color="emerald" />
            <MiniStat label="Despesa média/mês" value={stats.avgExpense} color="red" />
            <MiniStat
              label={`Melhor mês (${formatMonthYear(stats.bestMonth)})`}
              value={stats.bestNet}
              color={stats.bestNet >= 0 ? "emerald" : "red"}
            />
            <MiniStat
              label={`Pior mês (${formatMonthYear(stats.worstMonth)})`}
              value={stats.worstNet}
              color={stats.worstNet >= 0 ? "emerald" : "red"}
            />
          </div>
        </Card>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Balance history area chart */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Receitas vs Despesas (6 meses)</h3>
          {balanceHistory.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={balanceHistory} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickFormatter={formatMonthYear}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Net balance area chart */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Resultado líquido acumulado</h3>
          {balanceHistory.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={historyWithCumulative}>
                <defs>
                  <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickFormatter={formatMonthYear}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Resultado acumulado"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#gradNet)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Charts row 2 — categories */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Expense by category */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">
            Despesas por categoria — {MONTHS_LABEL[month - 1]}/{year}
          </h3>
          {expenseByCategory.length === 0 ? (
            <EmptyChart message="Sem despesas com categoria neste mês." />
          ) : (
            <CategoryPieChart data={expenseByCategory} />
          )}
        </Card>

        {/* Income by category */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">
            Receitas por categoria — {MONTHS_LABEL[month - 1]}/{year}
          </h3>
          {incomeByCategory.length === 0 ? (
            <EmptyChart message="Sem receitas com categoria neste mês." />
          ) : (
            <CategoryPieChart data={incomeByCategory} />
          )}
        </Card>
      </div>

      {/* Receivables + monthly breakdown */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Receivables by debtor */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">A receber por devedor</h3>
          {receivables.length === 0 ? (
            <EmptyChart message="Nenhum valor a receber pendente." />
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {receivables.map((r) => {
                const pct = r.totalAmount > 0 ? (r.receivedAmount / r.totalAmount) * 100 : 0;
                return (
                  <div key={r.debtorName}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-white">{r.debtorName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{r.transactionCount} lançamento{r.transactionCount !== 1 ? "s" : ""}</span>
                        <span className="text-xs font-medium text-amber-400">
                          {formatCurrency(r.pendingAmount)} pendente
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-surface-border">
                        <div
                          className="h-2 rounded-full bg-amber-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-12 text-right">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-gray-600">
                      <span>Total: {formatCurrency(r.totalAmount)}</span>
                      <span>Recebido: {formatCurrency(r.receivedAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Monthly summary table */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Resumo mensal (6 meses)</h3>
          {balanceHistory.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="pb-2 text-left font-medium text-gray-500">Mês</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Receitas</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Despesas</th>
                    <th className="pb-2 text-right font-medium text-gray-500">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {[...balanceHistory].reverse().map((row) => {
                    const net = row.income - row.expense;
                    return (
                      <tr key={row.month} className="hover:bg-surface-hover">
                        <td className="py-2 text-gray-300">{formatMonthYear(row.month)}</td>
                        <td className="py-2 text-right text-emerald-400">{formatCurrency(row.income)}</td>
                        <td className="py-2 text-right text-red-400">{formatCurrency(row.expense)}</td>
                        <td className={`py-2 text-right font-medium ${net >= 0 ? "text-sky-400" : "text-red-400"}`}>
                          {net >= 0 ? "+" : ""}{formatCurrency(net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {balanceHistory.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-surface-border font-semibold">
                      <td className="pt-2 text-gray-400">Total</td>
                      <td className="pt-2 text-right text-emerald-400">
                        {formatCurrency(balanceHistory.reduce((s, h) => s + h.income, 0))}
                      </td>
                      <td className="pt-2 text-right text-red-400">
                        {formatCurrency(balanceHistory.reduce((s, h) => s + h.expense, 0))}
                      </td>
                      <td className={`pt-2 text-right ${
                        balanceHistory.reduce((s, h) => s + h.income - h.expense, 0) >= 0
                          ? "text-sky-400" : "text-red-400"
                      }`}>
                        {formatCurrency(balanceHistory.reduce((s, h) => s + h.income - h.expense, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Credit card invoices */}
      {cards.length > 0 && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Histórico de faturas por cartão</h3>
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="">Selecione um cartão</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.brand})</option>
              ))}
            </select>
          </div>

          {!selectedCardId ? (
            <p className="py-8 text-center text-sm text-gray-500">Selecione um cartão para ver o histórico de faturas.</p>
          ) : invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Nenhuma fatura encontrada.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[...invoices].reverse().slice(-12)} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis
                    dataKey="referenceMonth"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    tickFormatter={formatMonthYear}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="totalAmount" name="Total fatura" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paidAmount" name="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-surface-border">
                      <th className="pb-2 text-left font-medium text-gray-500">Mês ref.</th>
                      <th className="pb-2 text-right font-medium text-gray-500">Vencimento</th>
                      <th className="pb-2 text-right font-medium text-gray-500">Total</th>
                      <th className="pb-2 text-right font-medium text-gray-500">Pago</th>
                      <th className="pb-2 text-right font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {[...invoices].reverse().slice(0, 6).map((inv) => (
                      <tr key={inv.id} className="hover:bg-surface-hover">
                        <td className="py-2 text-gray-300">{formatMonthYear(inv.referenceMonth)}</td>
                        <td className="py-2 text-right text-gray-400">{inv.dueDate ? new Date(inv.dueDate + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="py-2 text-right text-white font-medium">{formatCurrency(inv.totalAmount)}</td>
                        <td className="py-2 text-right text-emerald-400">{formatCurrency(inv.paidAmount)}</td>
                        <td className="py-2 text-right">
                          <InvoiceStatusBadge status={inv.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "sky" | "emerald" | "red" | "amber";
}) {
  const colorMap = {
    sky: { bg: "bg-sky-500/10", text: "text-sky-400", val: "text-sky-300" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", val: "text-emerald-300" },
    red: { bg: "bg-red-500/10", text: "text-red-400", val: "text-red-300" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", val: "text-amber-300" },
  };
  const c = colorMap[color];
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`mt-1 text-lg font-bold ${c.val}`}>{formatCurrency(value)}</p>
        </div>
        <div className={`rounded-lg p-2 ${c.bg} ${c.text}`}>{icon}</div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: "emerald" | "red" | "sky" }) {
  const cls = { emerald: "text-emerald-400", red: "text-red-400", sky: "text-sky-400" }[color];
  return (
    <div className="rounded-lg border border-surface-border p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${cls}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function EmptyChart({ message = "Sem dados suficientes." }: { message?: string }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function CategoryPieChart({ data }: { data: { categoryName: string; categoryColor: string; total: number; percentage: number }[] }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
      <div className="shrink-0 xl:w-48">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={48}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.categoryColor} />
              ))}
            </Pie>
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: number, _: string, props: { payload?: { categoryName?: string } }) => [
                formatCurrency(v),
                props.payload?.categoryName ?? "",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2">
        {data.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.categoryColor }} />
                <span className="text-xs text-gray-400 truncate">{item.categoryName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</span>
                <span className="text-xs font-medium text-white">{formatCurrency(item.total)}</span>
              </div>
            </div>
            <div className="h-1 rounded-full bg-surface-border">
              <div
                className="h-1 rounded-full transition-all"
                style={{ width: `${item.percentage}%`, backgroundColor: item.categoryColor }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: "Aberta", cls: "text-sky-400 bg-sky-500/10" },
    closed: { label: "Fechada", cls: "text-amber-400 bg-amber-500/10" },
    paid: { label: "Paga", cls: "text-emerald-400 bg-emerald-500/10" },
    partial: { label: "Parcial", cls: "text-orange-400 bg-orange-500/10" },
  };
  const s = map[status] ?? { label: status, cls: "text-gray-400 bg-gray-500/10" };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
  );
}
