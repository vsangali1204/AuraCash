# UX-24 — Tooltip enriquecido nos gráficos

**Categoria:** Microinteração
**Estimativa:** Baixa

## Problema

Tooltip dos charts mostra só "Receitas: R$ X". Pouco insight.

## Solução

Tooltip customizado com mais contexto:

```tsx
function RichTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const prevData = previousMonth(data);
  const variation = ((data.income - prevData.income) / prevData.income) * 100;

  return (
    <div className="rounded-lg bg-surface-card border border-surface-border p-3 shadow-lg">
      <p className="text-xs text-text-secondary mb-2">{formatMonthYear(label)}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            Receitas
          </span>
          <span className="font-mono text-sm font-medium">
            {formatCurrency(data.income)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-danger" />
            Despesas
          </span>
          <span className="font-mono text-sm font-medium">
            {formatCurrency(data.expense)}
          </span>
        </div>
        <div className="border-t border-surface-border pt-1.5 flex justify-between">
          <span className="text-xs font-semibold">Saldo</span>
          <span className={`text-sm font-bold ${data.balance >= 0 ? "text-success" : "text-danger"}`}>
            {formatCurrency(data.balance)}
          </span>
        </div>
      </div>
      {variation && (
        <p className="mt-2 text-xs text-text-secondary">
          {variation > 0 ? "↑" : "↓"} {Math.abs(variation).toFixed(0)}% vs mês anterior
        </p>
      )}
    </div>
  );
}

<Tooltip content={<RichTooltip />} />
```

## Critérios

- [ ] Tooltip customizado em todos os charts do dashboard
- [ ] Mostra variação vs período anterior
- [ ] Link "Ver detalhes" navega
- [ ] Estilo coeso com cards
- [ ] Acessível (não trap focus se navegação via teclado)
