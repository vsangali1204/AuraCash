import { cn, formatCurrency, formatMonthYear } from "@/lib/utils";

interface InvoiceTimelinePoint {
  ym: string;
  totalAmount: number;
}

interface InvoiceTimelineProps {
  months: InvoiceTimelinePoint[];
  selectedYm: string;
  onSelect: (ym: string) => void;
}

const ITEM_WIDTH = 108;
const ITEM_GAP = 10;
const CHART_HEIGHT = 52;
const DOT_MARGIN = 10;

/** Timeline horizontal de faturas: caixa com mês + valor por ponto, ligadas por uma linha (estilo app de banco). */
export function InvoiceTimeline({ months, selectedYm, onSelect }: InvoiceTimelineProps) {
  if (months.length === 0) return null;

  const amounts = months.map((m) => m.totalAmount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const range = max - min;

  const step = ITEM_WIDTH + ITEM_GAP;
  const totalWidth = months.length * ITEM_WIDTH + (months.length - 1) * ITEM_GAP;

  function yFor(amount: number) {
    if (range === 0) return CHART_HEIGHT / 2;
    const pct = (amount - min) / range;
    return CHART_HEIGHT - DOT_MARGIN - pct * (CHART_HEIGHT - DOT_MARGIN * 2);
  }

  const points = months.map((m, i) => ({ ...m, x: i * step + ITEM_WIDTH / 2, y: yFor(m.totalAmount) }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="overflow-x-auto pb-1">
      <div className="relative" style={{ width: totalWidth, height: CHART_HEIGHT }}>
        <svg
          className="pointer-events-none absolute inset-0"
          width={totalWidth}
          height={CHART_HEIGHT}
          viewBox={`0 0 ${totalWidth} ${CHART_HEIGHT}`}
        >
          <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p) => (
            <circle
              key={p.ym}
              cx={p.x}
              cy={p.y}
              r={p.ym === selectedYm ? 5 : 3.5}
              fill={p.ym === selectedYm ? "#38bdf8" : "#0ea5e9"}
              stroke="#0b0b14"
              strokeWidth={p.ym === selectedYm ? 2 : 1}
            />
          ))}
        </svg>
      </div>
      <div className="flex gap-2.5">
        {months.map((m) => {
          const isSelected = m.ym === selectedYm;
          return (
            <button
              key={m.ym}
              onClick={() => onSelect(m.ym)}
              style={{ width: ITEM_WIDTH }}
              className={cn(
                "shrink-0 rounded-xl border px-2 py-2.5 text-center transition-all",
                isSelected
                  ? "border-sky-500/50 bg-sky-500/10"
                  : "border-surface-border bg-surface-card hover:border-sky-500/20"
              )}
            >
              <p className={cn("text-xs capitalize", isSelected ? "text-sky-300" : "text-gray-500")}>
                {formatMonthYear(m.ym)}
              </p>
              <p className={cn("mt-1 text-sm font-bold tabular-nums", isSelected ? "text-white" : "text-gray-300")}>
                {formatCurrency(m.totalAmount)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
