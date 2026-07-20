# F-21 — Exportar para Excel / CSV

**Categoria:** Funcionalidade
**Estimativa:** Baixa
**Valor pro usuário:** Médio (alto pra contador)

## O que é

Exportar listagem com filtros aplicados para XLSX ou CSV. Útil para IR, contador, backup.

## UI

Em qualquer listagem (transações, recebíveis, faturas), botão "Exportar" com dropdown:
- Excel (.xlsx)
- CSV (.csv, UTF-8)

## Implementação

### Frontend
Lib `xlsx` (SheetJS) ou `papaparse` pra CSV. Reusa dados já em memória — sem novo round-trip ao backend.

```typescript
import * as XLSX from "xlsx";

function exportToExcel(transactions: Transaction[]) {
  const rows = transactions.map(t => ({
    Data: t.date,
    Descrição: t.description,
    Categoria: t.category?.name ?? "",
    Conta: t.account?.name ?? "",
    Tipo: TRANSACTION_TYPE_LABELS[t.transactionType],
    Valor: t.amount,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transações");
  XLSX.writeFile(wb, `transacoes_${dateStr}.xlsx`);
}
```

### Backend (alternativa)
Se quiser arquivos grandes (10k+ linhas), gerar no backend com `openpyxl` e retornar URL pra download.

## Critérios de aceitação

- [ ] Botão "Exportar" em /transactions, /receivables, /invoices
- [ ] Exporta com filtros ativos
- [ ] Formato XLSX com headers em pt-BR
- [ ] CSV com separador correto pra Excel BR (`;`)
- [ ] Encoding UTF-8 com BOM (Excel pt-BR)
- [ ] Nome do arquivo descritivo: `auracash_transacoes_2026-06.xlsx`

## Considerações

- Linha de "Total" no final do XLSX.
- Cuidado com Decimal → string no CSV (não usar locale americano).
- Pra LGPD: exportar dados próprios é direito do usuário, manter mesmo no plano free.
