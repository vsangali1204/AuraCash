import { cn, INVOICE_STATUS_LABELS } from "@/lib/utils";

export function invoiceStatusConfig(status: string) {
  return (
    {
      open:    { bg: "bg-blue-500/12 text-blue-400",    dot: "bg-blue-400" },
      closed:  { bg: "bg-amber-500/12 text-amber-400",  dot: "bg-amber-400" },
      partial: { bg: "bg-orange-500/12 text-orange-400", dot: "bg-orange-400" },
      paid:    { bg: "bg-emerald-500/12 text-emerald-400", dot: "bg-emerald-400" },
    }[status] ?? { bg: "bg-gray-500/12 text-gray-400", dot: "bg-gray-400" }
  );
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const cfg = invoiceStatusConfig(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {INVOICE_STATUS_LABELS[status] ?? status}
    </span>
  );
}
