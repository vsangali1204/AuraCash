# P2-09 — Cachear properties que disparam query

**Categoria:** Backend / Performance
**Estimativa:** Média

## Problema

`CreditCard.available_limit` e `Invoice.total_amount` são `@property` que disparam queries SQL toda vez que são acessados. Em listagens (`credit_cards`, `all_invoices`), isso é N+1:

- 10 cartões → 10 queries para `available_limit`
- 50 faturas → 50 queries para `total_amount`

## Localização

- [backend/apps/credit_cards/models.py:46-67](../../backend/apps/credit_cards/models.py) — `CreditCard.available_limit`
- [backend/apps/credit_cards/models.py:97-113](../../backend/apps/credit_cards/models.py) — `Invoice.total_amount`
- [backend/apps/credit_cards/schema.py:82-101](../../backend/apps/credit_cards/schema.py) — `map_credit_card` consome ambos
- [backend/apps/credit_cards/schema.py:174-181](../../backend/apps/credit_cards/schema.py) — `all_invoices` lista N

## Solução proposta

### Opção A — annotate no queryset

```python
from django.db.models import Sum, Case, When, F, Value, DecimalField
from django.db.models.functions import Coalesce

invoices_qs = Invoice.objects.filter(...).annotate(
    computed_total=Coalesce(
        Sum(
            Case(
                When(transactions__transaction_type="income", then=-F("transactions__amount")),
                default=F("transactions__amount"),
                output_field=DecimalField(),
            )
        ),
        Value(Decimal("0")),
        output_field=DecimalField(),
    )
)

# No map_invoice, usa inv.computed_total em vez de inv.total_amount
```

### Opção B — método que aceita prefetched data

```python
class Invoice(models.Model):
    def total_amount_from(self, transactions: list) -> Decimal:
        return sum(
            -t.amount if t.transaction_type == "income" else t.amount
            for t in transactions
            if t.invoice_id == self.id
        )
```

E no map:

```python
all_txs = Transaction.objects.filter(invoice__in=invoices)
all_txs_list = list(all_txs)
for inv in invoices:
    total = inv.total_amount_from(all_txs_list)
```

### Opção C — `cached_property` (não resolve N+1, mas evita chamadas múltiplas no mesmo request)

```python
from django.utils.functional import cached_property

class Invoice(models.Model):
    @cached_property
    def total_amount(self) -> Decimal:
        ...
```

Recomendação: **A** (annotate) para listagens, **C** para uso pontual.

## Critérios de aceitação

- [ ] `all_invoices` faz 1-2 queries total, não N+1
- [ ] `credit_cards` faz 1-2 queries total
- [ ] Benchmark antes/depois mostra queda em queries (use `django-debug-toolbar` ou `connection.queries`)
- [ ] Resultados numericamente idênticos

## Riscos / cuidados

- Cuidado com `Case/When` em `Sum` — testar com receitas (estornos) no cartão.
- `available_limit` precisa considerar `invoice__status__in=["open", "closed"]` — não esquecer.
