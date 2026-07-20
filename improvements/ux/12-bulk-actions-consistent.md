# UX-12 — Bulk actions consistentes

**Categoria:** UI / Padronização
**Estimativa:** Baixa

## Problema

Hoje ReceivablesPage tem seleção múltipla com modal de bulk receive. TransactionsPage e InvoicesPage não têm seleção múltipla, mas poderiam ter (deletar em lote, mover categoria em lote).

Mesmo dentro de Receivables, a UI do "modo seleção" não está perfeitamente clara — usuário precisa descobrir que pode clicar com hold/checkbox.

## Solução

### Componente `<BulkActionsBar>` global

Aparece fixo no rodapé quando há seleção:

```tsx
<BulkActionsBar count={selected.size} onClearSelection={() => setSelected(new Set())}>
  <Button variant="secondary" onClick={...}>Marcar como recebido</Button>
  <Button variant="secondary" onClick={...}>Mudar categoria</Button>
  <Button variant="danger" onClick={...}>Deletar selecionados</Button>
</BulkActionsBar>
```

Animação: slide-up de baixo quando primeira seleção feita.

### Padrão por listagem

- Cada item tem checkbox visível no hover (desktop) ou após long-press (mobile)
- Header da listagem mostra "Selecionar todos" quando tem ao menos um selecionado
- Ações em lote contextuais ao tipo (Receivables: receber; Transactions: categorizar; Invoices: pagar)

## Critérios

- [ ] Componente `<BulkActionsBar>` reusável
- [ ] Aplicado em Transactions, Receivables, Invoices
- [ ] Animação suave aparecer/sumir
- [ ] Ações em lote: deletar, mudar categoria, mudar conta (onde fizer sentido)
- [ ] Confirmação para delete em lote
- [ ] Atalho `Esc` limpa seleção
