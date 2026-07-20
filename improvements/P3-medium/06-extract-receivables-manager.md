# P3-06 — Extrair manager/queryset de Receivables

**Categoria:** Backend / DRY
**Estimativa:** Baixa

## Problema

O padrão de filtro de recebíveis pendentes aparece em 3+ lugares:

```python
Transaction.objects.filter(
    user=user,
    is_receivable=True,
    receipt_status__in=["pending", "partial"],
).exclude(parent_transaction__isnull=True, total_installments__gt=1)
```

Se a regra mudar (ex.: incluir/excluir algum status), precisa alterar em todos os lugares.

## Localização

- [backend/apps/transactions/schema.py:381-383](../../backend/apps/transactions/schema.py)
- [backend/apps/receivables/schema.py:79-83](../../backend/apps/receivables/schema.py)
- [backend/apps/receivables/schema.py:112-117](../../backend/apps/receivables/schema.py)

## Solução proposta

Criar manager custom em `Transaction`:

```python
# apps/transactions/models.py

class TransactionQuerySet(models.QuerySet):
    def pending_receivables(self):
        """Recebíveis ainda em aberto, ignorando transações-pai de parcelamento."""
        return self.filter(
            is_receivable=True,
            receipt_status__in=["pending", "partial"],
        ).exclude(parent_transaction__isnull=True, total_installments__gt=1)

    def for_user(self, user):
        return self.filter(user=user)


class Transaction(models.Model):
    ...
    objects = TransactionQuerySet.as_manager()
```

Uso:

```python
Transaction.objects.for_user(user).pending_receivables()
```

## Critérios de aceitação

- [ ] Manager/QuerySet criado
- [ ] Todos os 3 lugares usam o helper
- [ ] Comportamento idêntico
- [ ] Mudar a regra em um lugar reflete em todos

## Riscos / cuidados

- `as_manager()` substitui o default manager — verificar que admin e queries Django existentes ainda funcionam.
