# UX-09 — Agrupamento configurável

**Categoria:** UI
**Estimativa:** Média

## Problema

ReceivablesPage agrupa por devedor. TransactionsPage agrupa por dia. Decisão hardcoded.

Diferentes contextos precisam de diferentes agrupamentos:
- Por dia (atual em transações)
- Por semana
- Por mês
- Por categoria
- Por conta/cartão
- Por método de pagamento

## Solução

Dropdown no header da listagem:

```
Agrupar por: [Data ▾]
              ├ Sem agrupamento
              ├ Data
              ├ Semana
              ├ Mês
              ├ Categoria
              ├ Conta
              └ Método
```

Lógica genérica:

```tsx
function groupTransactions(txs: Transaction[], by: GroupBy): Map<string, Transaction[]> {
  const keyFn: Record<GroupBy, (t: Transaction) => string> = {
    date: t => t.date,
    week: t => weekKey(t.date),
    month: t => t.date.slice(0, 7),
    category: t => t.category?.name ?? "Sem categoria",
    account: t => t.account?.name ?? "Sem conta",
    method: t => PAYMENT_METHOD_LABELS[t.paymentMethod],
  };
  return groupBy(txs, keyFn[by]);
}
```

## Critérios

- [ ] Dropdown de agrupamento
- [ ] Persistência por listagem
- [ ] Header de cada grupo com label + total
- [ ] Funciona com filtros aplicados
- [ ] Animação suave ao trocar
