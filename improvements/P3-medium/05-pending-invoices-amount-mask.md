# P3-05 — pending_invoices_amount calculado por fatura

**Categoria:** Backend / Correção
**Estimativa:** Baixa

## Problema

O cálculo `pending_invoices_amount` aplica `max(0, total - paid)` no agregado de todas as faturas pendentes. Se uma fatura está com `paid_amount > total` (cenário do P1-05 overpayment, ou inconsistência), ela "compensa" o saldo de outras.

Resultado: dashboard mostra "faturas pendentes" menor do que o real.

## Localização

[backend/apps/transactions/schema.py:430-445](../../backend/apps/transactions/schema.py)

```python
pending_invoices_qs = InvoiceModel.objects.filter(
    credit_card__user=user,
    due_date__year=year,
    due_date__month=month,
).exclude(status=InvoiceModel.Status.PAID)

inv_tx_total = Transaction.objects.filter(
    user=user, invoice__in=pending_invoices_qs,
).aggregate(total=Coalesce(Sum("amount"), Value(0), output_field=DecimalField()))["total"]

inv_paid_total = pending_invoices_qs.aggregate(
    total=Coalesce(Sum("paid_amount"), Value(0), output_field=DecimalField())
)["total"]

pending_invoices_amount = max(0.0, float(inv_tx_total) - float(inv_paid_total))
```

## Solução proposta

Calcular saldo por fatura individualmente, depois somar (sem permitir negativo por fatura):

```python
from decimal import Decimal

pending_invoices_amount = 0.0
for inv in pending_invoices_qs:
    inv_total = inv.total_amount  # ou usar a versão annotated do P2-09
    inv_remaining = max(Decimal("0"), inv_total - inv.paid_amount)
    pending_invoices_amount += float(inv_remaining)
```

Ou em uma query usando Case/When (mais eficiente):

```python
from django.db.models import F, Sum, Case, When, Value, DecimalField
from django.db.models.functions import Coalesce, Greatest

# Annotate o saldo por fatura
pending_invoices_qs = pending_invoices_qs.annotate(
    inv_total=Coalesce(
        Sum("transactions__amount"),
        Value(Decimal("0")),
        output_field=DecimalField(),
    ),
    remaining=Greatest(
        F("inv_total") - F("paid_amount"),
        Value(Decimal("0")),
        output_field=DecimalField(),
    ),
)
pending_invoices_amount = float(
    pending_invoices_qs.aggregate(
        total=Coalesce(Sum("remaining"), Value(Decimal("0")), output_field=DecimalField())
    )["total"]
)
```

## Critérios de aceitação

- [ ] Cenário: 2 faturas, uma com paid > total (R$100 pago de R$80), outra com R$200 pendente. Dashboard mostra R$200 (não R$180)
- [ ] Teste cobrindo o caso

## Riscos / cuidados

- Resolver P1-05 antes elimina a fonte do problema, mas o dashboard ainda deve estar defensivo.
