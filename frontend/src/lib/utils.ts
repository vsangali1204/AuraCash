import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export function formatMonthYear(dateStr: string): string {
  const [year, month] = dateStr.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(month) - 1]}/${year}`;
}

export function todayISO() {
  // Usa a data local (não UTC) para evitar problemas com fusos negativos
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Soma N meses a uma data ISO (YYYY-MM-DD), preservando o dia (com clamp no último dia do mês de destino). */
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const maxDay = new Date(year, month + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, maxDay))}`;
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Conta Corrente",
  savings: "Poupança",
  digital: "Carteira Digital",
  cash: "Dinheiro",
};

export const CATEGORY_TYPE_LABELS: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
  both: "Ambos",
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  debit: "Débito",
  pix: "PIX",
  cash: "Dinheiro",
  transfer: "Transferência",
  credit: "Crédito",
};

export const CREDIT_CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  other: "Outro",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  closed: "Fechada",
  paid: "Paga",
  partial: "Paga Parcial",
};

export const RECEIPT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  received: "Recebido",
};

export const RECURRENCE_TYPE_LABELS: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
};

export function invoiceStatusColor(status: string): string {
  return {
    open: "text-blue-400",
    closed: "text-amber-400",
    paid: "text-emerald-400",
    partial: "text-orange-400",
  }[status] ?? "text-gray-400";
}
