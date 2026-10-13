import { forwardRef, type SelectHTMLAttributes } from "react";

import { Select } from "@/components/ui/Select";
import { addMonths, firstInvoiceMonth, formatMonthYear } from "@/lib/utils";
import type { CreditCard } from "@/types";

/** Quantas faturas para frente a 1ª parcela pode ser empurrada. */
const MAX_OFFSET = 3;

/** Fatura escolhida para a 1ª parcela, ou null quando é a que a data da compra já define. */
export function chosenFirstInvoiceMonth(card: CreditCard | undefined, date: string, offset: number) {
  if (!card || !date || !offset) return null;
  return addMonths(firstInvoiceMonth(date, card.closingDay), offset);
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  card: CreditCard;
  date: string;
  installments: number;
}

/** Fatura onde cai a 1ª parcela de uma compra no crédito. O valor é o
 * deslocamento (em meses) a partir da fatura que a data da compra define. */
export const InvoiceMonthSelect = forwardRef<HTMLSelectElement, Props>(
  ({ card, date, installments, ...props }, ref) => {
    const natural = firstInvoiceMonth(date, card.closingDay);
    const options = Array.from({ length: MAX_OFFSET + 1 }, (_, offset) => ({
      value: String(offset),
      label: formatMonthYear(addMonths(natural, offset)) + (offset === 0 ? " (pela data)" : ""),
    }));
    return (
      <Select
        ref={ref}
        label={installments > 1 ? "1ª parcela na fatura de" : "Fatura"}
        options={options}
        {...props}
      />
    );
  }
);
InvoiceMonthSelect.displayName = "InvoiceMonthSelect";
