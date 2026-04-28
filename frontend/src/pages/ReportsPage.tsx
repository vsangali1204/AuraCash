import { useQuery } from "@apollo/client";
import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { FileText, TrendingUp, TrendingDown, CreditCard } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { DASHBOARD_SUMMARY_QUERY } from "@/graphql/queries/transactions";
import { CREDIT_CARDS_QUERY, INVOICES_QUERY } from "@/graphql/queries/creditCards";
import { RECEIVABLE_SUMMARY_QUERY } from "@/graphql/queries/receivables";
import { formatCurrency, formatMonthYear } from "@/lib/utils";
import type { CreditCard as CreditCardType, DashboardSummary, Invoice, ReceivableSummary } from "@/types";

const now = new Date();
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const TOOLTIP_STYLE = {
  contentStyle: { background: "#13131f", border: "1px solid #2a2a3a", borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "#fff" },
  itemStyle: { color: "#a0a0b0" },
};

export function ReportsPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedCardId, setSelectedCardId] = useState<string>("");

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

  const totalReceivable = receivables.reduce((s, r) => s + r.pendingAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Relatórios</h1>
        <p className="text-sm text-gray-500">Análise financeira detalhada</p>
      </div>

      {/* Period selector */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
          >
            {MONTHS.map((m, i) => (
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
          <span className="text-xs text-gray-500">
            Período selecionado: {MONTHS[month - 1]} / {year}
          </span>
        </div>
      </Card>

      {/* Monthly summary cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-card" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Saldo Total" value={summary?.totalBalance ?? 0} icon={<FileText size={16} />} color="sky" />
          <StatCard label="Receitas" value={summary?.monthIncome ?? 0} icon={<TrendingUp size={16} />} color="emerald" />
          <StatCard label="Despesas" value={summary?.monthExpense ?? 0} icon={<TrendingDown size={16} />} color="red" />
          <StatCard label="A Receber" value={totalReceivable} icon={<CreditCard size={16} />} color="amber" />
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Balance history */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Histórico de saldo (12 meses)</h3>
          {balanceHistory.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-gray-500">Sem dados suficientes.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={balanceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickFormatter={(v) => formatMonthYear(v)}
                />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="income" name="Receitas" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expense" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="balance" name="Saldo" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Income vs expense bar */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Receitas vs Despesas</h3>
          {balanceHistory.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-gray-500">Sem dados suficientes.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={balanceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  tickFormatter={(v) => formatMonthYear(v)}
                />
                <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Expense by category pie */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Despesas por categoria — {MONTHS[month - 1]}</h3>
          {expenseByCategory.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-gray-500">Sem despesas com categoria neste mês.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="total"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={48}
                  >
                    {expenseByCategory.map((entry, i) => (
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
              <div className="space-y-2 min-w-[160px]">
                {expenseByCategory.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.categoryColor }} />
                      <span className="text-xs text-gray-400">{item.categoryName}</span>
                    </div>
                    <span className="text-xs font-semibold text-white">{item.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* A receber por devedor */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">A receber por devedor</h3>
          {receivables.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-gray-500">Nenhum valor a receber pendente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receivables.map((r) => {
                const pct = r.totalAmount > 0 ? (r.receivedAmount / r.totalAmount) * 100 : 0;
                return (
                  <div key={r.debtorName}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-white">{r.debtorName}</span>
                      <span className="text-xs text-gray-400">
                        {formatCurrency(r.pendingAmount)} pendente
                      </span>
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
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Credit card invoices */}
      {cards.length > 0 && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Faturas de cartão</h3>
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              className="rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="">Selecione um cartão</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
                <BarChart data={[...invoices].reverse().slice(-12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis
                    dataKey="referenceMonth"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    tickFormatter={(v) => formatMonthYear(v)}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="totalAmount" name="Total fatura" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paidAmount" name="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                {[...invoices].reverse().slice(0, 4).map((inv) => (
                  <div key={inv.id} className="rounded-lg border border-surface-border p-3">
                    <p className="text-xs text-gray-500">{formatMonthYear(inv.referenceMonth)}</p>
                    <p className="text-sm font-semibold text-white">{formatCurrency(inv.totalAmount)}</p>
                    <p className="text-xs text-emerald-400">Pago: {formatCurrency(inv.paidAmount)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

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
