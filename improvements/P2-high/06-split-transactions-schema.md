# P2-06 — Quebrar transactions/schema.py (1014 linhas)

**Categoria:** Backend / Manutenibilidade
**Estimativa:** Média

## Problema

`backend/apps/transactions/schema.py` tem 1014 linhas com:
- 7+ types
- 3 inputs
- 12+ queries (transactions, dashboard, calendar, installments, payment_method_summary, invoice_month_summary)
- 6+ mutations
- helpers de installment

É um god file — difícil navegar, blame fica confuso, conflitos de merge frequentes.

## Localização

[backend/apps/transactions/schema.py](../../backend/apps/transactions/schema.py)

## Solução proposta

Quebrar em módulo:

```
backend/apps/transactions/
├── schema/
│   ├── __init__.py        # exporta TransactionQuery, TransactionMutation
│   ├── types.py           # TransactionType, CategoryExpense, MonthBalance, etc.
│   ├── inputs.py          # CreateTransactionInput, UpdateTransactionInput, TransactionFilters
│   ├── helpers.py         # _propagate_installment_fields, _get_base_description, map_transaction
│   ├── queries/
│   │   ├── __init__.py
│   │   ├── transactions.py     # transactions, transaction, invoice_transactions, pending_recurrences
│   │   ├── dashboard.py        # dashboard_summary (a maior)
│   │   ├── calendar.py         # calendar_events
│   │   ├── installments.py     # installments_by_month
│   │   └── reports.py          # payment_method_summary, invoice_month_summary
│   └── mutations/
│       ├── __init__.py
│       ├── transactions.py     # create/update/delete_transaction
│       └── recurrences.py      # confirm/skip_pending_recurrence
```

`schema/__init__.py` reagrupa as classes:

```python
import strawberry
from .queries.transactions import TransactionQueryMixin
from .queries.dashboard import DashboardQueryMixin
# ...

@strawberry.type
class TransactionQuery(
    TransactionQueryMixin,
    DashboardQueryMixin,
    CalendarQueryMixin,
    InstallmentsQueryMixin,
    ReportsQueryMixin,
):
    pass
```

Ou se preferir, manter `TransactionQuery` única e só extrair as funções privadas (queries continuam métodos da classe, mas a lógica vive em funções de outros módulos).

## Critérios de aceitação

- [ ] Nenhum arquivo passa de ~300 linhas no app transactions
- [ ] Schema GraphQL gerado é idêntico ao anterior (rodar `gh diff` no schema serializado)
- [ ] Imports atualizados nos consumidores
- [ ] Sem regressão funcional

## Riscos / cuidados

- PRs grandes — fazer em commits pequenos por extração.
- Atenção a imports circulares: types.py importa de accounts/credit_cards, mutations importam de types.
