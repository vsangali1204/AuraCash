# AuraCash — Plano de Melhorias

Lista de melhorias identificadas em uma revisão geral do projeto.
Cada arquivo descreve uma melhoria atômica, com problema, localização, solução proposta e critérios de aceitação.

## Como usar

Cada item é independente — pode ser implementado isoladamente. Para o agente que for executar:

1. Leia o arquivo da melhoria.
2. Confirme que a situação descrita ainda existe (codebase pode ter mudado).
3. Implemente a solução proposta (ou justifique uma alternativa melhor).
4. Marque os critérios de aceitação no commit/PR.
5. Mova o arquivo para `improvements/done/` ou marque com `**Status: feito em <commit>**` no topo.

## Estrutura

```
improvements/
├── P1-critical/   bugs reais, risco de inconsistência ou segurança (10)
├── P2-high/       qualidade, performance, manutenção (10)
├── P3-medium/     cleanups e padronização (16)
├── P4-low/        polish e qualidade de vida (14)
├── features/      funcionalidades novas (30)
└── ux/            melhorias visuais e de experiência (37)
```

Total: **117 melhorias documentadas**.

---

## Bugs e refactor (P1-P4)

### P1 — Críticas (10)

- [01 — Atomic em mutations multi-write](P1-critical/01-atomic-transactions.md)
- [02 — N+1 em receivable_summary](P1-critical/02-n-plus-one-receivable-summary.md)
- [03 — tasks.py usar get_execution_date_in_range](P1-critical/03-tasks-py-use-helper.md)
- [04 — Refresh token sem rotação](P1-critical/04-refresh-token-rotation.md)
- [05 — pay_invoice aceita overpayment](P1-critical/05-pay-invoice-overpayment.md)
- [06 — update_recurrence silencia conta inválida](P1-critical/06-update-recurrence-silent-fail.md)
- [07 — update_credit_card não recalcula faturas](P1-critical/07-update-credit-card-recalc-invoices.md)
- [08 — Decimal em vez de float no GraphQL](P1-critical/08-decimal-instead-of-float.md)
- [09 — Dia útil inclui sábado](P1-critical/09-business-day-saturday-bug.md)
- [10 — closing_day edge case](P1-critical/10-closing-day-edge-case.md)

### P2 — Alto impacto (10)

- [01 — Substituir raise Exception genérico](P2-high/01-graphql-error-classes.md)
- [02 — Corrigir import feio de Q](P2-high/02-fix-q-import.md)
- [03 — Receipt aceita payment_method como input](P2-high/03-receipt-payment-method-input.md)
- [04 — pay_invoice aceita payment_method](P2-high/04-pay-invoice-payment-method.md)
- [05 — Adicionar testes](P2-high/05-add-tests.md)
- [06 — Quebrar transactions/schema.py](P2-high/06-split-transactions-schema.md)
- [07 — Quebrar ReceivablesPage.tsx](P2-high/07-split-receivables-page.md)
- [08 — Constante MONEY_TOLERANCE](P2-high/08-money-tolerance-constant.md)
- [09 — Cachear properties que disparam query](P2-high/09-cache-property-queries.md)
- [10 — Adicionar índices no banco](P2-high/10-add-db-indexes.md)

### P3 — Médio (8 escritos)

- [01 — Substituir padrão `or 1`](P3-medium/01-clean-or-1-pattern.md)
- [02 — Padronizar UNSET vs None](P3-medium/02-consistent-unset-defaults.md)
- [03 — Compilar regex de installment uma vez](P3-medium/03-compile-regex-once.md)
- [04 — Remover refresh_from_db desnecessários](P3-medium/04-remove-unnecessary-refresh-from-db.md)
- [05 — pending_invoices_amount calculado por fatura](P3-medium/05-pending-invoices-amount-mask.md)
- [06 — Extrair Receivables manager](P3-medium/06-extract-receivables-manager.md)
- [07 — Remover management commands one-off](P3-medium/07-remove-deprecated-management-commands.md)
- [08 — Padronizar mensagens de erro](P3-medium/08-standardize-error-messages.md)
- [09 — Apollo errorLink global](P3-medium/09-apollo-error-link.md)
- [10 — Renomear currentYearMonth](P3-medium/10-rename-current-year-month.md)
- [11 — Usar Intl.DateTimeFormat](P3-medium/11-use-intl-date-formats.md)

> Os itens P3-12 a P3-16 e P4 ainda não foram escritos como arquivos individuais — vide lista resumida em conversa.

---

## Funcionalidades novas

### Financeiro core
- [01 — Metas financeiras (Goals)](features/01-goals.md)
- [02 — Orçamento por categoria](features/02-budget-per-category.md)
- [03 — Importação de extrato OFX/CSV](features/03-import-ofx-csv.md)
- [04 — Importação de fatura PDF](features/04-import-invoice-pdf.md)
- [05 — Recebimentos recorrentes](features/05-recurring-receivables.md)
- [06 — Investimentos](features/06-investments.md)
- [07 — Patrimônio total (Net Worth)](features/07-net-worth.md)
- [08 — Parcelamento em outros meios](features/08-installments-non-credit.md)
- [09 — Empréstimos / Dívidas](features/09-loans.md)
- [10 — Workspace compartilhado](features/10-shared-workspace.md)

### Inteligência e automação
- [11 — Notificações](features/11-notifications.md)
- [12 — Categorização automática](features/12-auto-categorization.md)
- [13 — Conciliação de recebíveis](features/13-receivable-matching.md)
- [14 — Detecção de duplicatas](features/14-duplicate-detection.md)
- [15 — Insights mensais](features/15-monthly-insights.md)

### Relatórios e visualização
- [16 — Comparativo ano-a-ano](features/16-year-over-year.md)
- [17 — Fluxo de caixa projetado](features/17-cash-flow-projection.md)
- [18 — Heatmap de gastos](features/18-spending-heatmap.md)
- [19 — Top fornecedores/devedores](features/19-top-vendors.md)
- [20 — Relatório PDF mensal](features/20-monthly-pdf-report.md)
- [21 — Exportar Excel/CSV](features/21-export-excel-csv.md)

### Cartão de crédito
- [22 — Simulador de parcelamento](features/22-installment-simulator.md)
- [23 — Antecipação de fatura](features/23-invoice-prepayment.md)
- [24 — Melhor cartão pra usar agora](features/24-best-card-suggestion.md)
- [25 — Limite por categoria no cartão](features/25-card-category-limit.md)

### Organização
- [26 — Tags livres](features/26-tags.md)
- [27 — Anexos](features/27-attachments.md)
- [28 — Divisão de despesas](features/28-split-expense.md)
- [29 — Reembolsos corporativos](features/29-company-reimbursements.md)
- [30 — Auditoria / Histórico](features/30-audit-log.md)

---

## Melhorias visuais / UX

### Dashboard
- [01 — Skeleton loading consistente](ux/01-skeleton-loading.md)
- [02 — Animação count-up](ux/02-count-up-animation.md)
- [03 — Tokens semânticos de cor](ux/03-semantic-color-tokens.md)
- [04 — Saldo projetado com trend](ux/04-projected-balance-trend.md)
- [05 — Tour de onboarding](ux/05-onboarding-tour.md)
- [06 — Light mode](ux/06-light-mode.md)
- [07 — Período "Próximos 30 dias"](ux/07-rolling-30-days.md)

### Listagens
- [08 — Densidade ajustável](ux/08-density-toggle.md)
- [09 — Agrupamento configurável](ux/09-grouping-options.md)
- [10 — Empty states melhores](ux/10-empty-states.md)
- [11 — Quick add (FAB / Cmd+K)](ux/11-quick-add-fab-cmdk.md)
- [12 — Bulk actions consistentes](ux/12-bulk-actions-consistent.md)
- [13 — Pesquisa global](ux/13-global-search.md)

### Formulários
- [14 — Wizard de onboarding](ux/14-wizard-onboarding-card.md)
- [15 — Validação inline](ux/15-inline-validation.md)
- [16 — Autocomplete em descrições](ux/16-autocomplete-description.md)
- [17 — Atalhos de teclado](ux/17-form-shortcuts.md)
- [18 — Calculadora inline no valor](ux/18-inline-calculator.md)

### Mobile
- [19 — Bottom sheet](ux/19-bottom-sheet-mobile.md)
- [20 — Swipe actions](ux/20-swipe-actions.md)
- [21 — Pull to refresh](ux/21-pull-to-refresh.md)
- [22 — Sticky header com saldo](ux/22-sticky-balance-header.md)

### Gráficos
- [23 — Gráficos mais ricos (Visx/ECharts)](ux/23-better-charts.md)
- [24 — Tooltip enriquecido](ux/24-rich-chart-tooltip.md)
- [25 — Sparklines em cards](ux/25-sparklines-in-cards.md)
- [26 — Drill-down](ux/26-chart-drill-down.md)

### Calendário
- [27 — Vista semana/agenda](ux/27-calendar-week-agenda.md)
- [28 — Drag-and-drop reagendar](ux/28-drag-drop-reschedule.md)

### Microinterações
- [29 — Toast undo](ux/29-toast-undo.md)
- [30 — Confirmação inline](ux/30-inline-delete-confirm.md)
- [31 — Estado visual em mutation](ux/31-mutation-row-state.md)
- [32 — Haptic feedback](ux/32-haptic-feedback.md)
- [33 — Sons opcionais](ux/33-optional-sounds.md)

### Identidade
- [34 — Avatares de devedores](ux/34-debtor-avatars.md)
- [35 — Palette + ícones para categorias](ux/35-category-icons-palette.md)
- [36 — Tema compact](ux/36-compact-theme.md)
- [37 — Loading com identidade visual](ux/37-branded-loading.md)

---

## Sugestão de priorização

Se for atacar agora:

1. **P1-01, P1-03, P1-06** — bugs reais que podem corromper dados
2. **P2-01, P2-02** — fácil, melhora muito a base
3. **P2-05** — testes (base pra evoluir com segurança)
4. **UX-01, UX-10, UX-15** — melhorias visuais de impacto rápido
5. **F-03 (importação OFX)** — feature de maior valor pro usuário
6. **F-02 (orçamento)** + **F-01 (metas)** — features mais pedidas em apps financeiros
