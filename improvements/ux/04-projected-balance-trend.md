# UX-04 — Saldo projetado com indicador visual

**Categoria:** Visualização
**Estimativa:** Baixa

## Problema

"Saldo estimado fim do mês: R$ X" é só um número. Falta contexto: melhor/pior que mês passado? Em ritmo de meta?

## Solução

Enriquecer o card:

```
┌─────────────────────────────────────┐
│ Saldo estimado fim do mês           │
│                                     │
│ R$ 4.230  📈 +12% vs mês anterior   │
│                                     │
│ ▁▂▃▄▅▆▇  últimos 7 dias            │
└─────────────────────────────────────┘
```

Elementos:
- Valor principal grande
- Variação % vs mês anterior, com ícone trend
- Sparkline dos últimos 7 dias mostrando trajetória
- Cor adaptativa (verde se cresceu, vermelho se caiu)

## Sparkline

Lib `react-sparklines` ou Recharts:

```tsx
<ResponsiveContainer width={120} height={32}>
  <LineChart data={dailyBalances}>
    <Line type="monotone" dataKey="balance" stroke="currentColor" strokeWidth={1.5} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

## Backend

Adicionar campo `daily_balance_history` em `DashboardSummary`:

```python
@strawberry.type
class DashboardSummary:
    ...
    daily_balance_history: list[float]  # últimos 7 dias
```

## Critérios

- [ ] Card "Saldo Projetado" tem sparkline
- [ ] Mostra variação vs mês anterior
- [ ] Cor adapta ao trend
