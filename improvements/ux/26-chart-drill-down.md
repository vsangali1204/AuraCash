# UX-26 — Drill-down nos gráficos

**Categoria:** Navegação
**Estimativa:** Baixa

## Problema

Pie de "Despesas por categoria" mostra que "Alimentação = R$ 800". Mas pra ver as transações, usuário precisa ir em /transactions e filtrar manualmente.

## Solução

Tornar gráficos clicáveis. Cada elemento navega para listagem filtrada:

```tsx
<Pie
  data={expenseByCategory}
  onClick={(slice) => {
    navigate(`/transactions?category=${slice.categoryId}&from=${monthStart}&to=${monthEnd}`);
  }}
  cursor="pointer"
/>
```

### Aplicar em

- Pie de categoria → filtra transações dessa categoria/mês
- Bar de receitas/despesas → navega pro dashboard do mês clicado
- Card "Faturas pendentes" → /invoices filtrado por mês
- Card "A Receber" → /receivables
- Sparkline → mês correspondente ao ponto

## Critérios

- [ ] Click em slice do pie filtra transações
- [ ] Click em bar muda mês do dashboard
- [ ] Cursor `pointer` nos elementos clicáveis
- [ ] Filtros do destino mostram o que veio do drill-down (badge "Vindo de Despesas/Alimentação")
- [ ] Botão "Voltar" funciona naturalmente
