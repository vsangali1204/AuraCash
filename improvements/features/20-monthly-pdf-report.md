# F-20 — Relatório PDF mensal completo

**Categoria:** Relatório
**Estimativa:** Média
**Valor pro usuário:** Médio

## O que é

Hoje só recebíveis tem PDF. Estender para relatório mensal consolidado, exportável.

## Conteúdo

Página 1 — Resumo executivo
- Saldo total e variação
- Receitas vs despesas
- Patrimônio (se F-07)
- Top 3 categorias

Página 2 — Gráficos
- Receitas vs despesas (12 meses)
- Despesas por categoria (pie)
- Saldo das contas

Página 3 — Detalhamento por categoria
- Tabela com cada categoria, valor, % do total, variação vs mês anterior

Página 4-N — Listagem de transações
- Tabela com data, descrição, categoria, valor
- Filtros já aplicados (período, tipo)

Footer — Gerado em {data}, AuraCash, usuário

## Implementação

Reaproveitar arquitetura do `ReceivablesPDFReport.tsx`:
- React-PDF
- Componente `<MonthlyReportDoc {...props} />`
- Mutation/query backend gera dados agregados
- Frontend chama `downloadPdf` com prop

## Backend

```python
@strawberry.field
def monthly_report_data(
    self, info, year: int, month: int
) -> MonthlyReportData:
    ...
    # Reaproveita dashboard_summary + extras
```

## Critérios de aceitação

- [ ] PDF gerado com identidade visual AuraCash
- [ ] Inclui gráficos, tabelas, comparativos
- [ ] Botão "Gerar PDF" em /dashboard
- [ ] Schedule opcional: gerar e enviar por email todo dia 1
- [ ] Funciona offline (frontend gera)

## Considerações

- Para envio automático por email, gerar no backend com `weasyprint` ou similar.
- Permitir customizar quais seções incluir.
