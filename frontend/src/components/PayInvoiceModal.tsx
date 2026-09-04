import { useMutation } from "@apollo/client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { z } from "zod";
import { AlertCircle, DollarSign, Layers } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import {
  ALL_INVOICES_QUERY,
  CREDIT_CARDS_QUERY,
  INVOICES_QUERY,
  PAY_INVOICE_MUTATION,
} from "@/graphql/queries/creditCards";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import {
  cn,
  formatCurrency,
  formatMonthYear,
  invoiceOutstanding,
  invoiceSettled,
  roundMoney,
  todayISO,
} from "@/lib/utils";
import type { Account, Invoice } from "@/types";

const paySchema = z
  .object({
    mode: z.enum(["full", "installments"]),
    amount: z.coerce.number().min(0, "Valor não pode ser negativo"),
    sourceAccountId: z.string().min(1, "Conta obrigatória"),
    paymentDate: z.string().min(1, "Data obrigatória"),
    installmentsCount: z.coerce.number().int().optional(),
    installmentAmount: z.coerce.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "full") {
      if (data.amount <= 0) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "Valor deve ser positivo" });
      }
      return;
    }
    if (!data.installmentsCount || data.installmentsCount < 1 || data.installmentsCount > 48) {
      ctx.addIssue({ code: "custom", path: ["installmentsCount"], message: "Entre 1 e 48 parcelas" });
    }
    if (!data.installmentAmount || data.installmentAmount <= 0) {
      ctx.addIssue({ code: "custom", path: ["installmentAmount"], message: "Informe o valor da parcela" });
    }
  });

type PayFormData = z.infer<typeof paySchema>;

interface PayInvoiceModalProps {
  /** Fatura sendo paga; `null` mantém o modal fechado. */
  invoice: Invoice | null;
  accounts: Account[];
  /** Conta sugerida (a conta de pagamento do cartão, quando houver). */
  defaultAccountId?: string | null;
  onClose: () => void;
}

/**
 * Pagamento de fatura, nas duas formas que o banco oferece: quitar (total ou
 * parcial) ou parcelar — pagar uma entrada agora e jogar o restante para as
 * faturas seguintes em N parcelas de valor informado pelo usuário.
 */
export function PayInvoiceModal({ invoice, accounts, defaultAccountId, onClose }: PayInvoiceModalProps) {
  const [payInvoice, { loading }] = useMutation(PAY_INVOICE_MUTATION, {
    refetchQueries: [CREDIT_CARDS_QUERY, ALL_INVOICES_QUERY, INVOICES_QUERY, ACCOUNTS_QUERY],
    onCompleted: (data) => {
      toast.success(
        data?.payInvoice?.financedAmount > 0 ? "Fatura parcelada!" : "Pagamento registrado!"
      );
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm<PayFormData>({
    resolver: zodResolver(paySchema),
    defaultValues: { mode: "full", paymentDate: todayISO() },
  });

  const outstanding = invoice ? invoiceOutstanding(invoice) : 0;

  // Reabre sempre no modo "pagar tudo", com o saldo em aberto pré-preenchido.
  const { reset } = form;
  useEffect(() => {
    if (!invoice) return;
    reset({
      mode: "full",
      amount: invoiceOutstanding(invoice),
      sourceAccountId: defaultAccountId ?? "",
      paymentDate: todayISO(),
      installmentsCount: undefined,
      installmentAmount: undefined,
    });
  }, [invoice, defaultAccountId, reset]);

  const mode = form.watch("mode");
  const amount = Number(form.watch("amount")) || 0;
  const count = Number(form.watch("installmentsCount")) || 0;
  const installment = Number(form.watch("installmentAmount")) || 0;

  const financed = roundMoney(outstanding - amount);
  const interest = roundMoney(count * installment - financed);

  function setMode(next: "full" | "installments") {
    form.setValue("mode", next);
    // No parcelamento o campo vira a entrada; deixar a fatura inteira ali não
    // sobraria nada para parcelar.
    form.setValue("amount", next === "full" ? outstanding : 0);
    form.clearErrors();
  }

  function onSubmit(data: PayFormData) {
    if (!invoice) return;
    const { mode: chosen, installmentsCount, installmentAmount, ...rest } = data;
    payInvoice({
      variables: {
        input: {
          invoiceId: invoice.id,
          ...rest,
          ...(chosen === "installments" ? { installmentsCount, installmentAmount } : {}),
        },
      },
    });
  }

  return (
    <Modal open={!!invoice} onClose={onClose} title="Pagar fatura" size="sm">
      {invoice && (
        <div className="space-y-4">
          <div className="rounded-xl border border-surface-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">Fatura</p>
                <p className="text-sm font-semibold text-white">
                  {formatMonthYear(invoice.referenceMonth)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold tabular-nums text-white">
                  {formatCurrency(invoice.totalAmount)}
                </p>
                {invoiceSettled(invoice) > 0 && (
                  <p className="text-xs text-amber-400">falta {formatCurrency(outstanding)}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("full")}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                mode === "full"
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-surface-border bg-surface hover:border-gray-600"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <DollarSign size={13} /> Pagamento
              </span>
              <span className="text-[11px] leading-tight text-gray-500">Total ou parcial</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("installments")}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                mode === "installments"
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-surface-border bg-surface hover:border-gray-600"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                <Layers size={13} /> Parcelar
              </span>
              <span className="text-[11px] leading-tight text-gray-500">Entrada + parcelas</span>
            </button>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <Input
              label={mode === "installments" ? "Valor pago agora (R$)" : "Valor a pagar (R$)"}
              type="number"
              step="0.01"
              hint={
                mode === "installments"
                  ? "O pagamento mínimo que o banco pediu. O restante vira parcelas."
                  : undefined
              }
              error={form.formState.errors.amount?.message}
              {...form.register("amount")}
            />

            {mode === "installments" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Qtd. de parcelas"
                    type="number"
                    min="1"
                    max="48"
                    placeholder="Ex.: 6"
                    error={form.formState.errors.installmentsCount?.message}
                    {...form.register("installmentsCount")}
                  />
                  <Input
                    label="Valor da parcela (R$)"
                    type="number"
                    step="0.01"
                    placeholder="Ex.: 560,00"
                    error={form.formState.errors.installmentAmount?.message}
                    {...form.register("installmentAmount")}
                  />
                </div>

                <div className="space-y-1.5 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Saldo a parcelar</span>
                    <span className="font-semibold tabular-nums text-white">
                      {formatCurrency(Math.max(0, financed))}
                    </span>
                  </div>
                  {count > 0 && installment > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">
                          {count}x de {formatCurrency(installment)}
                        </span>
                        <span className="font-semibold tabular-nums text-violet-300">
                          {formatCurrency(roundMoney(count * installment))}
                        </span>
                      </div>
                      {interest > 0.01 && (
                        <div className="flex items-center justify-between border-t border-violet-500/20 pt-1.5">
                          <span className="text-gray-400">Juros</span>
                          <span className="font-semibold tabular-nums text-amber-400">
                            {formatCurrency(interest)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <p className="pt-1 leading-relaxed text-gray-500">
                    As parcelas entram nas próximas faturas deste cartão, começando pela seguinte a{" "}
                    {formatMonthYear(invoice.referenceMonth)}.
                  </p>
                </div>

                {financed <= 0 && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-400">
                    <AlertCircle size={13} className="mt-px shrink-0" />
                    O valor pago já cobre a fatura inteira — não sobra nada para parcelar.
                  </p>
                )}
              </>
            )}

            <Select
              label="Conta de origem"
              options={[
                { value: "", label: "Selecione a conta" },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
              error={form.formState.errors.sourceAccountId?.message}
              {...form.register("sourceAccountId")}
            />
            <Input
              label="Data do pagamento"
              type="date"
              error={form.formState.errors.paymentDate?.message}
              {...form.register("paymentDate")}
            />

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                loading={loading}
                disabled={mode === "installments" && financed <= 0}
              >
                {mode === "installments" ? (
                  <>
                    <Layers size={14} /> Parcelar
                  </>
                ) : (
                  <>
                    <DollarSign size={14} /> Registrar
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
