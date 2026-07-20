# UX-25 — Sparklines em cards de resumo

**Categoria:** Visualização
**Estimativa:** Baixa

## Problema

Cards "Saldo Total", "Receitas", "Despesas" mostram só valor atual. Sem contexto temporal.

## Solução

Mini-linha (sparkline) no card mostrando últimos 7-12 meses:

```
┌─────────────────────────────────┐
│ 💰 Saldo Total                   │
│                                  │
│ R$ 4.230  📈 +2.3%              │
│                                  │
│ ▁▂▃▄▅▆▇█  últimos 12 meses     │
└─────────────────────────────────┘
```

### Implementação

Lib `react-sparklines` ou Recharts (com `ResponsiveContainer` pequeno):

```tsx
import { LineChart, Line, ResponsiveContainer } from "recharts";

<ResponsiveContainer width="100%" height={32}>
  <LineChart data={history}>
    <Line
      type="monotone"
      dataKey="value"
      stroke={trend === "up" ? "#10b981" : "#ef4444"}
      strokeWidth={1.5}
      dot={false}
    />
  </LineChart>
</ResponsiveContainer>
```

Densidade de informação alta em pouco espaço (estilo Stripe Dashboard, Vercel).

## Backend

`DashboardSummary` precisa fornecer histórico:

```python
@strawberry.type
class DashboardSummary:
    ...
    balance_history_12mo: list[float]
    income_history_12mo: list[float]
    expense_history_12mo: list[float]
```

## Critérios

- [ ] Sparkline em cada SummaryCard
- [ ] Cor adapta à direção do trend
- [ ] Hover mostra valor do ponto
- [ ] Não compete com o número principal
