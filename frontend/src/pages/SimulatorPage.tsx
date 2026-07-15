import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Wallet, CreditCard as CardIcon } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import { CREDIT_CARDS_QUERY, ALL_INVOICES_QUERY } from "@/graphql/queries/creditCards";
import { cn, formatCurrency, formatDate, formatMonthYear, roundMoney, addMonths, todayISO } from "@/lib/utils";
import type { Account, CreditCard, InvoiceWithCard } from "@/types";

const TOOLTIP_STYLE = {
  contentStyle: { background: "#13131f", border: "1px solid #2a2a3a", borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "#fff" },
  itemStyle: { color: "#a0a0b0" },
};

type Mode = "income" | "card";

/** Divide o total em N parcelas (base + resto na última) — mesma regra usada no backend ao criar parcelamentos. */
function splitInstallments(total: number, n: number): number[] {
  const base = roundMoney(total / n);
  const amounts = Array(n).fill(base);
  amounts[n - 1] = roundMoney(total - base * (n - 1));
  return amounts;
}

export function SimulatorPage() {
  const [mode, setMode] = useState<Mode>("income");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Simulador</h1>
        <p className="mt-1 text-sm text-gray-400">
          Veja o impacto de um recebimento ou de uma compra parcelada antes de decidir — nada aqui é salvo.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-surface-border bg-surface-card p-1">
        <button
          onClick={() => setMode("income")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
            mode === "income" ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white"
          )}
        >
          <Wallet size={15} /> Recebimento parcelado
        </button>
        <button
          onClick={() => setMode("card")}
          className={cn(
            "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
            mode === "card" ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white"
          )}
        >
          <CardIcon size={15} /> Parcelamento no cartão
        </button>
      </div>

      {mode === "income" ? <IncomeSimulator /> : <CardSimulator />}
    </div>
  );
}

// ── Modo A: recebimento parcelado ─────────────────────────────────────────────

const incomeSchema = z.object({
  totalAmount: z.coerce.number().positive("Valor deve ser positivo"),
  installments: z.coerce.number().int().min(1).max(48),
  firstDate: z.string().min(1, "Data obrigatória"),
  accountId: z.string().min(1, "Conta obrigatória"),
});
type IncomeFormData = z.infer<typeof incomeSchema>;

function IncomeSimulator() {
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);
  const accounts = accountsData?.accounts ?? [];

  const { register, watch, formState: { errors } } = useForm<IncomeFormData>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { installments: 2, firstDate: todayISO(), accountId: "" },
  });

  const totalAmount = Number(watch("totalAmount")) || 0;
  const installments = Number(watch("installments")) || 1;
  const firstDate = watch("firstDate") || todayISO();
  const accountId = watch("accountId");

  const account = accounts.find((a) => a.id === accountId) ?? null;

  const schedule = useMemo(() => {
    if (!totalAmount || !installments) return [];
    return splitInstallments(totalAmount, installments).map((amount, i) => ({
      number: i + 1,
      date: addMonths(firstDate, i),
      amount,
    }));
  }, [totalAmount, installments, firstDate]);

  const chartData = useMemo(() => {
    if (!account || schedule.length === 0) return [];
    let cumulative = account.currentBalance;
    return schedule.map((s) => {
      cumulative = roundMoney(cumulative + s.amount);
      return { month: s.date.slice(0, 7), atual: account.currentBalance, simulado: cumulative };
    });
  }, [account, schedule]);

  const finalBalance = chartData.length > 0 ? chartData[chartData.length - 1].simulado : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-white">Dados do recebimento</h2>
        <form className="space-y-3">
          <Input
            label="Valor total (R$)"
            type="number"
            step="0.01"
            error={errors.totalAmount?.message}
            {...register("totalAmount")}
          />
          <Input
            label="Número de parcelas"
            type="number"
            min={1}
            max={48}
            error={errors.installments?.message}
            {...register("installments")}
          />
          <Input
            label="Data da 1ª parcela"
            type="date"
            error={errors.firstDate?.message}
            {...register("firstDate")}
          />
          <Select
            label="Conta de destino"
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            placeholder="Selecione a conta"
            error={errors.accountId?.message}
            {...register("accountId")}
          />
        </form>
      </Card>

      <div className="space-y-5">
        {!account || schedule.length === 0 ? (
          <Card className="flex h-full min-h-[220px] items-center justify-center">
            <p className="px-4 text-center text-sm text-gray-500">
              Preencha o valor, as parcelas e a conta para ver a simulação.
            </p>
          </Card>
        ) : (
          <>
            <Card>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs text-gray-500">Saldo atual — {account.name}</p>
                <p className="text-sm font-semibold text-white">{formatCurrency(account.currentBalance)}</p>
              </div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs text-gray-500">Saldo após receber tudo</p>
                <p className="text-sm font-bold text-emerald-400">{formatCurrency(finalBalance ?? 0)}</p>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => formatMonthYear(v)} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} labelFormatter={(v) => formatMonthYear(String(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="atual" name="Saldo atual" stroke="#6b7280" strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="simulado" name="Saldo simulado" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-[11px] text-gray-600">
                Considera só este recebimento somado ao saldo atual de {account.name} — não inclui outras contas, recorrências ou faturas.
              </p>
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-surface-border px-4 py-3">
                <p className="text-sm font-semibold text-white">Parcelas</p>
              </div>
              <div className="divide-y divide-surface-border/60">
                {schedule.map((s) => (
                  <div key={s.number} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/15 text-[11px] font-semibold text-sky-400">
                        {s.number}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(s.date)}</span>
                    </div>
                    <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(s.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modo B: parcelamento no cartão ────────────────────────────────────────────

const cardSchema = z.object({
  creditCardId: z.string().min(1, "Cartão obrigatório"),
  totalAmount: z.coerce.number().positive("Valor deve ser positivo"),
  installments: z.coerce.number().int().min(1).max(48),
  purchaseDate: z.string().min(1, "Data obrigatória"),
});
type CardFormData = z.infer<typeof cardSchema>;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Mês (YYYY-MM) da 1ª fatura que recebe a compra — mesma regra de get_first_invoice_month no backend. */
function getFirstInvoiceMonthYM(purchaseDate: string, closingDay: number): string {
  const [y, m, d] = purchaseDate.split("-").map(Number);
  if (d < closingDay) return `${y}-${String(m).padStart(2, "0")}`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Data de vencimento da fatura de referência — mesma regra de get_or_create_invoice no backend. */
function getInvoiceDueDate(ym: string, closingDay: number, dueDay: number): string {
  const [y, m] = ym.split("-").map(Number);
  if (dueDay >= closingDay) {
    const maxDay = daysInMonth(y, m);
    return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(dueDay, maxDay)).padStart(2, "0")}`;
  }
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const maxDay = daysInMonth(ny, nm);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(dueDay, maxDay)).padStart(2, "0")}`;
}

function CardSimulator() {
  const { data: cardsData } = useQuery<{ creditCards: CreditCard[] }>(CREDIT_CARDS_QUERY);
  const { data: allInvData } = useQuery<{ allInvoices: InvoiceWithCard[] }>(ALL_INVOICES_QUERY);
  const cards = cardsData?.creditCards ?? [];
  const allInvoices = allInvData?.allInvoices ?? [];

  const { register, watch, formState: { errors } } = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
    defaultValues: { creditCardId: "", installments: 1, purchaseDate: todayISO() },
  });

  const creditCardId = watch("creditCardId");
  const totalAmount = Number(watch("totalAmount")) || 0;
  const installments = Number(watch("installments")) || 1;
  const purchaseDate = watch("purchaseDate") || todayISO();

  const card = cards.find((c) => c.id === creditCardId) ?? null;

  const schedule = useMemo(() => {
    if (!card || !totalAmount || !installments) return [];
    const firstYm = getFirstInvoiceMonthYM(purchaseDate, card.closingDay);
    return splitInstallments(totalAmount, installments).map((amount, i) => {
      const ym = addMonths(`${firstYm}-01`, i).slice(0, 7);
      return { number: i + 1, ym, dueDate: getInvoiceDueDate(ym, card.closingDay, card.dueDay), amount };
    });
  }, [card, totalAmount, installments, purchaseDate]);

  const chartData = useMemo(() => {
    if (!card || schedule.length === 0) return [];
    return schedule.map((s) => {
      const existing = allInvoices.find(
        (inv) => inv.creditCardId === card.id && inv.referenceMonth.startsWith(s.ym)
      );
      const baseline = existing?.totalAmount ?? 0;
      return { month: s.ym, atual: baseline, simulada: roundMoney(baseline + s.amount) };
    });
  }, [card, schedule, allInvoices]);

  const availableAfter = card ? roundMoney(card.availableLimit - totalAmount) : null;
  const usedPctBefore = card && card.totalLimit > 0
    ? Math.min(100, ((card.totalLimit - card.availableLimit) / card.totalLimit) * 100)
    : 0;
  const usedPctAfter = card && card.totalLimit > 0 && availableAfter !== null
    ? Math.min(100, ((card.totalLimit - availableAfter) / card.totalLimit) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4 text-sm font-semibold text-white">Dados da compra</h2>
        <form className="space-y-3">
          <Select
            label="Cartão"
            options={cards.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Selecione o cartão"
            error={errors.creditCardId?.message}
            {...register("creditCardId")}
          />
          <Input
            label="Valor da compra (R$)"
            type="number"
            step="0.01"
            error={errors.totalAmount?.message}
            {...register("totalAmount")}
          />
          <Input
            label="Número de parcelas"
            type="number"
            min={1}
            max={48}
            error={errors.installments?.message}
            {...register("installments")}
          />
          <Input
            label="Data da compra"
            type="date"
            error={errors.purchaseDate?.message}
            {...register("purchaseDate")}
          />
        </form>
      </Card>

      <div className="space-y-5">
        {!card || schedule.length === 0 ? (
          <Card className="flex h-full min-h-[220px] items-center justify-center">
            <p className="px-4 text-center text-sm text-gray-500">
              Selecione o cartão, o valor e as parcelas para ver a simulação.
            </p>
          </Card>
        ) : (
          <>
            <Card>
              <p className="mb-3 text-sm font-semibold text-white">Impacto no limite</p>
              <p className="mb-3 text-xs text-gray-500">
                O limite disponível cai pelo valor total da compra assim que ela é registrada — mesmo parcelada, todas
                as parcelas já ficam reservadas nas faturas futuras.
              </p>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-gray-500">Disponível hoje</span>
                <span className="font-semibold text-emerald-400">{formatCurrency(card.availableLimit)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-border">
                <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${usedPctBefore}%` }} />
              </div>
              <div className="mb-2 mt-3 flex items-center justify-between text-xs">
                <span className="text-gray-500">Disponível após a compra</span>
                <span className={cn("font-semibold", (availableAfter ?? 0) < 0 ? "text-red-400" : "text-amber-400")}>
                  {formatCurrency(availableAfter ?? 0)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-border">
                <div
                  className={cn("h-1.5 rounded-full", usedPctAfter > 90 ? "bg-red-500" : "bg-amber-500")}
                  style={{ width: `${usedPctAfter}%` }}
                />
              </div>
            </Card>

            <Card>
              <p className="mb-4 text-sm font-semibold text-white">Faturas afetadas</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                  <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => formatMonthYear(v)} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} labelFormatter={(v) => formatMonthYear(String(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="atual" name="Fatura atual" fill="#6b7280" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="simulada" name="Fatura + parcela simulada" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-surface-border px-4 py-3">
                <p className="text-sm font-semibold text-white">Parcelas</p>
              </div>
              <div className="divide-y divide-surface-border/60">
                {schedule.map((s) => (
                  <div key={s.number} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/15 text-[11px] font-semibold text-orange-400">
                        {s.number}
                      </span>
                      <div>
                        <p className="text-xs capitalize text-gray-300">{formatMonthYear(s.ym)}</p>
                        <p className="text-[11px] text-gray-600">vence {formatDate(s.dueDate)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(s.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
