# P2-07 — Quebrar ReceivablesPage.tsx (1218 linhas)

**Categoria:** Frontend / Manutenibilidade
**Estimativa:** Média

## Problema

`frontend/src/pages/ReceivablesPage.tsx` tem 1218 linhas com:
- 2 modais (PDF, Bulk Receive)
- Lista agrupada por devedor
- Card de cada transação
- Filtros e tabs de período
- Lógica de seleção

É difícil navegar, componentes renderizam tudo junto, hard de testar isoladamente.

## Localização

[frontend/src/pages/ReceivablesPage.tsx](../../frontend/src/pages/ReceivablesPage.tsx)

## Solução proposta

Estrutura sugerida:

```
frontend/src/features/receivables/
├── ReceivablesPage.tsx          # ~200 linhas — só orquestra
├── components/
│   ├── ReceivablesHeader.tsx    # título, total, botão PDF
│   ├── PeriodTabs.tsx           # tabs overdue/this/next/all
│   ├── DebtorFilter.tsx         # input de busca
│   ├── BulkActionsBar.tsx       # quando há seleção
│   ├── DebtorGroup.tsx          # agrupamento por pessoa
│   ├── ReceivableItem.tsx       # card de uma transação
│   ├── ReceiveModal.tsx         # modal de recebimento individual
│   ├── BulkReceiveModal.tsx     # modal de rateio
│   └── PDFExportModal.tsx       # modal de PDF
├── hooks/
│   ├── useReceivables.ts        # encapsula query, grouping, filters
│   └── useReceivableSelection.ts # Set<id>, toggleAll, toggleOne
└── types.ts                     # PERIOD_TABS, DebtorGroup
```

`ReceivablesPage.tsx` fica enxuto:

```tsx
export function ReceivablesPage() {
  const { transactions, totalPending, isLoading } = useReceivables();
  const selection = useReceivableSelection(transactions);
  const [period, setPeriod] = useState<Period>("all");

  return (
    <div className="space-y-4">
      <ReceivablesHeader totalPending={totalPending} onExportPDF={...} />
      <PeriodTabs value={period} onChange={setPeriod} />
      <DebtorFilter value={filter} onChange={setFilter} />
      {selection.size > 0 && <BulkActionsBar ... />}
      {grouped.map(([key, txs]) => (
        <DebtorGroup key={key} name={key} transactions={txs} ... />
      ))}
      <ReceiveModal ... />
      <BulkReceiveModal ... />
      <PDFExportModal ... />
    </div>
  );
}
```

## Critérios de aceitação

- [ ] Nenhum arquivo do feature passa de ~300 linhas
- [ ] Comportamento idêntico (filtros, seleção, modais)
- [ ] Componentes têm `props` tipadas explicitamente
- [ ] Sem prop drilling — usar context se necessário
- [ ] PDF continua funcionando

## Riscos / cuidados

- Fazer em PRs pequenas — uma extração por vez.
- Testar manualmente cada extração antes da próxima.
- Cuidado com `useMemo` dependencies ao mover lógica entre arquivos.
