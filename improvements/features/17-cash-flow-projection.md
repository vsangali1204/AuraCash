# F-17 — Fluxo de caixa projetado (12 meses)

**Categoria:** Visualização
**Estimativa:** Média
**Valor pro usuário:** Alto

## O que é

Hoje a "projeção" só vê o mês atual. Estender para 12 meses à frente, considerando:
- Recorrências ativas (com start/end)
- Parcelas futuras de cartão
- Recebíveis com `competence_date` futuro
- Faturas projetadas (estimativa baseada em média)

## UI

Gráfico de linha em /reports ou /dashboard:
- Linha sólida: saldo projetado mês a mês
- Cone de incerteza ao redor (mais largo conforme distância)
- Eventos marcados na linha: vencimento de fatura, recebimento grande
- Tooltip detalhado: "Saldo projetado: X. Entradas: Y. Saídas: Z."

## Backend

```python
@strawberry.field
def cash_flow_projection(
    self, info, months_ahead: int = 12
) -> list[CashFlowMonth]:
    user = require_auth(info)
    today = timezone.localdate()

    points = []
    running_balance = current_total_balance(user)

    for i in range(months_ahead):
        target = today + relativedelta(months=i)
        y, m = target.year, target.month

        # Entradas projetadas
        income = (
            sum_future_income_transactions(user, y, m)
            + sum_active_recurrences(user, y, m, "income")
            + sum_pending_receivables(user, y, m)
        )

        # Saídas
        expense = (
            sum_future_expense_transactions(user, y, m)
            + sum_active_recurrences(user, y, m, "expense")
            + sum_pending_invoices_due(user, y, m)
            + sum_future_installments(user, y, m)
        )

        running_balance += income - expense
        points.append(CashFlowMonth(
            month=f"{y}-{m:02d}",
            opening_balance=running_balance - (income - expense),
            income=income,
            expense=expense,
            closing_balance=running_balance,
            uncertainty=compute_uncertainty(i),  # cresce com distância
        ))

    return points
```

## Critérios de aceitação

- [ ] Projeção de 12 meses
- [ ] Considera todos os fluxos previsíveis
- [ ] Cone de incerteza visualizado
- [ ] Alerta se em algum mês saldo fica negativo
- [ ] Drill-down: clicar no mês mostra detalhamento

## Considerações

- Performance: cachear pra usuário (invalidar quando criar/editar transação).
- "Estimativa de despesas variáveis" — média dos últimos 3 meses para categorias sem recorrência.
