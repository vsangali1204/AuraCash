# P2-04 — pay_invoice aceita payment_method como input

**Categoria:** Backend / Regra de negócio
**Estimativa:** Trivial

## Problema

Mesma issue do P2-03, mas em `pay_invoice`. A transação de pagamento é sempre registrada como `payment_method="pix"`.

## Localização

[backend/apps/credit_cards/schema.py:292](../../backend/apps/credit_cards/schema.py)

```python
Transaction.objects.create(
    user=user,
    description=f"Pagamento fatura {inv.credit_card.name} ...",
    amount=payment,
    transaction_type="expense",
    payment_method="pix",  # ← hardcoded
    ...
)
```

## Solução proposta

Adicionar campo em `PayInvoiceInput`:

```python
@strawberry.input
class PayInvoiceInput:
    invoice_id: strawberry.ID
    amount: float
    source_account_id: strawberry.ID
    payment_date: date
    payment_method: str = "pix"  # novo
```

E usar:

```python
payment_method=input.payment_method,
```

Validar contra `VALID_PAYMENT_METHODS`.

## Critérios de aceitação

- [ ] Aceita payment_method opcional
- [ ] Frontend tem dropdown no modal de pagamento de fatura
- [ ] Default "pix" preservado para compat

## Riscos / cuidados

- Nenhum.
