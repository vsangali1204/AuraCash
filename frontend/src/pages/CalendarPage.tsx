import { useQuery } from "@apollo/client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { CALENDAR_EVENTS_QUERY } from "@/graphql/queries/transactions";
import { formatCurrency } from "@/lib/utils";
import type { CalendarEvent } from "@/types";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const EVENT_TYPE_LABELS: Record<string, string> = {
  transaction: "Lançamento",
  invoice_due: "Vencimento de fatura",
  recurrence: "Recorrência",
  receivable: "A receber",
};

export function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data, loading } = useQuery<{ calendarEvents: CalendarEvent[] }>(CALENDAR_EVENTS_QUERY, {
    variables: { year, month },
  });

  const events = data?.calendarEvents ?? [];

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  events.forEach((e) => {
    const day = e.date.split("-")[2];
    if (!eventsByDate[day]) eventsByDate[day] = [];
    eventsByDate[day].push(e);
  });

  const selectedEvents = selectedDate
    ? eventsByDate[selectedDate.padStart(2, "0")] ?? []
    : [];

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Calendário Financeiro</h1>
        <p className="text-sm text-gray-500">Eventos financeiros do mês</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Calendar */}
        <Card className="xl:col-span-2">
          {/* Navigation */}
          <div className="mb-4 flex items-center justify-between">
            <button onClick={prevMonth} className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-semibold text-white">
              {MONTHS[month - 1]} {year}
            </h2>
            <button onClick={nextMonth} className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          {loading ? (
            <div className="h-64 animate-pulse rounded-lg bg-surface-border" />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const dayStr = String(day).padStart(2, "0");
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${dayStr}`;
                const dayEvents = eventsByDate[dayStr] ?? [];
                const isToday = dateStr === today;
                const isSelected = selectedDate === dayStr;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(isSelected ? null : dayStr)}
                    className={`relative flex min-h-[60px] flex-col items-center rounded-lg p-1.5 text-xs transition-colors ${
                      isSelected
                        ? "bg-violet-600/20 border border-violet-500/50"
                        : isToday
                        ? "bg-violet-600/10 border border-violet-500/20"
                        : "hover:bg-surface-hover"
                    }`}
                  >
                    <span className={`font-medium ${isToday ? "text-violet-400" : "text-gray-300"}`}>{day}</span>
                    {dayEvents.length > 0 && (
                      <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                        {dayEvents.slice(0, 3).map((e, i) => (
                          <div key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-gray-500 text-[10px]">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              { color: "#10b981", label: "Receita" },
              { color: "#ef4444", label: "Despesa" },
              { color: "#f97316", label: "Venc. fatura" },
              { color: "#8b5cf6", label: "Recorrência" },
              { color: "#3b82f6", label: "Transferência" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Side panel */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">
            {selectedDate
              ? `Dia ${parseInt(selectedDate)}/${month}/${year}`
              : "Selecione um dia"}
          </h3>

          {!selectedDate ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">Próximos eventos do mês:</p>
              {events.slice(0, 8).map((e, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg p-2 hover:bg-surface-hover">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                  <div>
                    <p className="text-xs text-white">{e.title}</p>
                    <p className="text-xs text-gray-500">
                      Dia {parseInt(e.date.split("-")[2])} · {EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}
                      {e.amount != null && ` · ${formatCurrency(e.amount)}`}
                    </p>
                  </div>
                </div>
              ))}
              {events.length === 0 && !loading && (
                <p className="text-sm text-gray-500">Nenhum evento este mês.</p>
              )}
            </div>
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum evento neste dia.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((e, i) => (
                <div key={i} className="rounded-lg border border-surface-border p-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{e.title}</p>
                      <p className="text-xs text-gray-500">{EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}</p>
                    </div>
                  </div>
                  {e.amount != null && (
                    <p className="mt-2 text-right text-sm font-semibold" style={{ color: e.color }}>
                      {formatCurrency(e.amount)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
