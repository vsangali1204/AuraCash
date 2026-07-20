# P2-08 — Constante MONEY_TOLERANCE

**Categoria:** Backend / DX
**Estimativa:** Trivial

## Problema

`Decimal("0.01")` aparece hardcoded em vários pontos como tolerância de arredondamento monetário:

```python
if inv.paid_amount >= total - Decimal("0.01"):
    inv.status = Invoice.Status.PAID
```

Se a regra mudar (ex.: 5 centavos), precisa achar todas as ocorrências.

## Localização

- [backend/apps/credit_cards/schema.py:250, 251, 301](../../backend/apps/credit_cards/schema.py)
- Possivelmente em outros lugares — grep por `Decimal("0.01")`

## Solução proposta

Criar `backend/shared/money.py`:

```python
from decimal import Decimal

# Tolerância para considerar dois valores monetários "iguais"
# Usada para evitar bugs de arredondamento em comparações (ex.: pagamento de fatura)
MONEY_TOLERANCE = Decimal("0.01")


def is_close(a: Decimal, b: Decimal, tol: Decimal = MONEY_TOLERANCE) -> bool:
    return abs(a - b) <= tol


def is_paid(paid: Decimal, total: Decimal) -> bool:
    return paid >= total - MONEY_TOLERANCE
```

Migrar:

```python
from shared.money import is_paid

if is_paid(inv.paid_amount, total) or payment >= remaining - MONEY_TOLERANCE:
    inv.status = Invoice.Status.PAID
```

## Critérios de aceitação

- [ ] `MONEY_TOLERANCE` definido em `shared/money.py`
- [ ] Sem `Decimal("0.01")` hardcoded no projeto (grep retorna 0)
- [ ] Helpers `is_close`, `is_paid` usados onde aplicável

## Riscos / cuidados

- Nenhum.
