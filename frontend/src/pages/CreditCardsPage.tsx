import { useMutation, useQuery } from "@apollo/client";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, CreditCard as CardIcon, ChevronDown, ChevronUp, DollarSign } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
// Badge available for future use
import {
  CREDIT_CARDS_QUERY, INVOICES_QUERY,
  CREATE_CREDIT_CARD_MUTATION, UPDATE_CREDIT_CARD_MUTATION,
  DELETE_CREDIT_CARD_MUTATION, PAY_INVOICE_MUTATION,
} from "@/graphql/queries/creditCards";
import { INVOICE_TRANSACTIONS_QUERY } from "@/graphql/queries/transactions";
import { ACCOUNTS_QUERY } from "@/graphql/queries/accounts";
import {
  formatCurrency, formatDate, formatMonthYear,
  CREDIT_CARD_BRAND_LABELS, INVOICE_STATUS_LABELS, invoiceStatusColor, todayISO,
} from "@/lib/utils";
import type { Account, CreditCard, Invoice, Transaction } from "@/types";

const cardSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  brand: z.string(),
  totalLimit: z.coerce.number().positive("Limite deve ser positivo"),
  closingDay: z.coerce.number().min(1).max(31),
  dueDay: z.coerce.number().min(1).max(31),
  accountId: z.string().optional(),
});

const paySchema = z.object({
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  sourceAccountId: z.string().min(1, "Conta obrigatória"),
  paymentDate: z.string().min(1, "Data obrigatória"),
});

type CardFormData = z.infer<typeof cardSchema>;
type PayFormData = z.infer<typeof paySchema>;

const BRAND_OPTIONS = Object.entries(CREDIT_CARD_BRAND_LABELS).map(([v, l]) => ({ value: v, label: l }));
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

export function CreditCardsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const { data: cardsData, loading } = useQuery<{ creditCards: CreditCard[] }>(CREDIT_CARDS_QUERY);
  const { data: accountsData } = useQuery<{ accounts: Account[] }>(ACCOUNTS_QUERY);
  const { data: invoicesData } = useQuery<{ invoices: Invoice[] }>(INVOICES_QUERY, {
    variables: { creditCardId: expandedCard },
    skip: !expandedCard,
  });

  const cards = cardsData?.creditCards ?? [];
  const accounts = accountsData?.accounts ?? [];
  const invoices = invoicesData?.invoices ?? [];
  const accountOptions = [
    { value: "", label: "Nenhuma" },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ];

  const cardForm = useForm<CardFormData>({
    resolver: zodResolver(cardSchema),
    defaultValues: { brand: "visa", totalLimit: 0, closingDay: 1, dueDay: 10, accountId: "" },
  });

  const payForm = useForm<PayFormData>({
    resolver: zodResolver(paySchema),
    defaultValues: { paymentDate: todayISO() },
  });

  const [createCard, { loading: creating }] = useMutation(CREATE_CREDIT_CARD_MUTATION, {
    refetchQueries: [CREDIT_CARDS_QUERY],
    onCompleted: () => { toast.success("Cartão criado!"); closeCardModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [updateCard, { loading: updating }] = useMutation(UPDATE_CREDIT_CARD_MUTATION, {
    refetchQueries: [CREDIT_CARDS_QUERY],
    onCompleted: () => { toast.success("Cartão atualizado!"); closeCardModal(); },
    onError: (e) => toast.error(e.message),
  });

  const [deleteCard, { loading: deleting }] = useMutation(DELETE_CREDIT_CARD_MUTATION, {
    refetchQueries: [CREDIT_CARDS_QUERY],
    onCompleted: () => { toast.success("Cartão removido!"); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  const [payInvoice, { loading: paying }] = useMutation(PAY_INVOICE_MUTATION, {
    refetchQueries: [CREDIT_CARDS_QUERY, INVOICES_QUERY],
    onCompleted: () => { toast.success("Pagamento registrado!"); setPayingInvoice(null); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    cardForm.reset({ brand: "visa", totalLimit: 0, closingDay: 1, dueDay: 10, accountId: "" });
    setModalOpen(true);
  }

  function openEdit(card: CreditCard) {
    setEditing(card);
    cardForm.reset({
      name: card.name, brand: card.brand,
      totalLimit: card.totalLimit, closingDay: card.closingDay,
      dueDay: card.dueDay, accountId: card.accountId ?? "",
    });
    setModalOpen(true);
  }

  function closeCardModal() { setModalOpen(false); setEditing(null); }

  function onCardSubmit(data: CardFormData) {
    const input = { ...data, accountId: data.accountId || null };
    if (editing) updateCard({ variables: { input: { id: editing.id, ...input } } });
    else createCard({ variables: { input } });
  }

  function onPaySubmit(data: PayFormData) {
    if (!payingInvoice) return;
    payInvoice({
      variables: {
        input: {
          invoiceId: payingInvoice.id,
          amount: data.amount,
          sourceAccountId: data.sourceAccountId,
          paymentDate: data.paymentDate,
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Cartões de Crédito</h1>
          <p className="text-sm text-gray-500">{cards.length} cartão(s) cadastrado(s)</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto"><Plus size={16} /> Novo cartão</Button>
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(2)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-surface-card" />)}</div>
      ) : cards.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <CardIcon size={40} className="text-gray-600" />
          <p className="text-sm text-gray-500">Nenhum cartão cadastrado.</p>
          <Button onClick={openCreate}><Plus size={16} /> Adicionar cartão</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => {
            const usedPercent = Math.min(100, ((card.totalLimit - card.availableLimit) / card.totalLimit) * 100);
            const isExpanded = expandedCard === card.id;

            return (
              <Card key={card.id} padding="none" className="overflow-hidden">
                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600/20">
                        <CardIcon size={20} className="text-sky-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{card.name}</p>
                        <p className="text-xs text-gray-500">
                          {CREDIT_CARD_BRAND_LABELS[card.brand]} · Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(card)} className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-hover hover:text-white transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteId(card.id)} className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Limite total</p>
                      <p className="text-sm font-semibold text-white">{formatCurrency(card.totalLimit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Disponível</p>
                      <p className="text-sm font-semibold text-emerald-400">{formatCurrency(card.availableLimit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Utilizado</p>
                      <p className="text-sm font-semibold text-amber-400">{formatCurrency(card.totalLimit - card.availableLimit)}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-surface-border">
                      <div className="h-1.5 rounded-full bg-sky-500 transition-all" style={{ width: `${usedPercent}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{usedPercent.toFixed(0)}% utilizado</p>
                  </div>

                  {card.currentInvoice && (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-surface-border bg-surface p-3">
                      <div>
                        <p className="text-xs text-gray-500">Fatura atual ({formatMonthYear(card.currentInvoice.referenceMonth)})</p>
                        <p className="text-sm font-semibold text-white">{formatCurrency(card.currentInvoice.totalAmount)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${invoiceStatusColor(card.currentInvoice.status)}`}>
                          {INVOICE_STATUS_LABELS[card.currentInvoice.status]}
                        </span>
                        {card.currentInvoice.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setPayingInvoice(card.currentInvoice!);
                              payForm.reset({
                                amount: card.currentInvoice!.totalAmount - card.currentInvoice!.paidAmount,
                                sourceAccountId: card.accountId ?? "",
                                paymentDate: todayISO(),
                              });
                            }}
                          >
                            <DollarSign size={12} /> Pagar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle faturas */}
                <button
                  onClick={() => setExpandedCard(isExpanded ? null : card.id)}
                  className="flex w-full items-center justify-between border-t border-surface-border px-5 py-3 text-xs text-gray-500 hover:bg-surface-hover transition-colors"
                >
                  <span>Ver histórico de faturas</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isExpanded && (
                  <div className="border-t border-surface-border p-4">
                    {invoices.length === 0 ? (
                      <p className="text-center text-sm text-gray-500 py-4">Nenhuma fatura.</p>
                    ) : (
                      <div className="space-y-2">
                        {invoices.map((inv) => (
                          <InvoiceRow key={inv.id} invoice={inv} accountOptions={accountOptions.filter(a => a.value)} onPay={(inv) => { setPayingInvoice(inv); payForm.reset({ amount: inv.totalAmount - inv.paidAmount, sourceAccountId: card.accountId ?? "", paymentDate: todayISO() }); }} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Card create/edit modal */}
      <Modal open={modalOpen} onClose={closeCardModal} title={editing ? "Editar cartão" : "Novo cartão"}>
        <form onSubmit={cardForm.handleSubmit(onCardSubmit)} className="space-y-4">
          <Input label="Nome do cartão" placeholder="Ex: Nubank Mastercard" error={cardForm.formState.errors.name?.message} {...cardForm.register("name")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Bandeira" options={BRAND_OPTIONS} {...cardForm.register("brand")} />
            <Input label="Limite total (R$)" type="number" step="0.01" error={cardForm.formState.errors.totalLimit?.message} {...cardForm.register("totalLimit")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Dia fechamento" options={DAY_OPTIONS} {...cardForm.register("closingDay")} />
            <Select label="Dia vencimento" options={DAY_OPTIONS} {...cardForm.register("dueDay")} />
          </div>
          <Select label="Conta para pagamento da fatura" options={accountOptions} {...cardForm.register("accountId")} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeCardModal}>Cancelar</Button>
            <Button type="submit" loading={creating || updating}>{editing ? "Salvar" : "Criar cartão"}</Button>
          </div>
        </form>
      </Modal>

      {/* Pay invoice modal */}
      <Modal open={!!payingInvoice} onClose={() => setPayingInvoice(null)} title="Pagar fatura" size="sm">
        {payingInvoice && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface p-3 text-sm">
              <p className="text-gray-500">Fatura {formatMonthYear(payingInvoice.referenceMonth)}</p>
              <p className="text-white font-semibold">{formatCurrency(payingInvoice.totalAmount)}</p>
              {payingInvoice.paidAmount > 0 && <p className="text-xs text-gray-500">Já pago: {formatCurrency(payingInvoice.paidAmount)}</p>}
            </div>
            <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="space-y-4">
              <Input label="Valor a pagar (R$)" type="number" step="0.01" error={payForm.formState.errors.amount?.message} {...payForm.register("amount")} />
              <Select label="Conta de origem" options={accountOptions.filter(a => a.value)} placeholder="Selecione a conta" error={payForm.formState.errors.sourceAccountId?.message} {...payForm.register("sourceAccountId")} />
              <Input label="Data do pagamento" type="date" error={payForm.formState.errors.paymentDate?.message} {...payForm.register("paymentDate")} />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setPayingInvoice(null)}>Cancelar</Button>
                <Button type="submit" loading={paying}>Registrar pagamento</Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir cartão" size="sm">
        <p className="text-sm text-gray-400">Tem certeza? Todas as faturas e lançamentos serão removidos.</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={() => deleteId && deleteCard({ variables: { id: deleteId } })}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}

function InvoiceRow({ invoice, onPay }: { invoice: Invoice; accountOptions?: {value: string; label: string}[]; onPay: (inv: Invoice) => void }) {
  const [showTx, setShowTx] = useState(false);
  const { data } = useQuery<{ invoiceTransactions: Transaction[] }>(INVOICE_TRANSACTIONS_QUERY, {
    variables: { invoiceId: invoice.id },
    skip: !showTx,
  });
  const txs = data?.invoiceTransactions ?? [];

  return (
    <div className="rounded-lg border border-surface-border">
      <div className="flex items-center justify-between p-3">
        <div>
          <p className="text-sm font-medium text-white">{formatMonthYear(invoice.referenceMonth)}</p>
          <p className="text-xs text-gray-500">Vence {formatDate(invoice.dueDate)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{formatCurrency(invoice.totalAmount)}</p>
            <span className={`text-xs font-medium ${invoiceStatusColor(invoice.status)}`}>{INVOICE_STATUS_LABELS[invoice.status]}</span>
          </div>
          {invoice.status !== "paid" && (
            <Button size="sm" variant="secondary" onClick={() => onPay(invoice)}><DollarSign size={12} /></Button>
          )}
          <button onClick={() => setShowTx(v => !v)} className="rounded p-1 text-gray-500 hover:text-white">
            {showTx ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      {showTx && (
        <div className="border-t border-surface-border px-3 pb-3 pt-2 space-y-1">
          {txs.length === 0 ? (
            <p className="text-xs text-gray-500">Nenhum lançamento.</p>
          ) : txs.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs py-1">
              <span className="text-gray-400">{t.description}</span>
              <span className="text-red-400 font-medium">{formatCurrency(t.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
