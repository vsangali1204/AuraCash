# P2-03 — Recebimento aceita payment_method como input

**Categoria:** Backend / Regra de negócio
**Estimativa:** Baixa

## Problema

Ao criar um Receipt, a Transaction de recebimento gerada usa `payment_method="pix"` hardcoded — independente do meio real.
Se o usuário recebeu em dinheiro, transferência ou crédito de débito, fica gravado como PIX.

## Localização

- [backend/apps/receivables/schema.py:188](../../backend/apps/receivables/schema.py) — create_receipt
- [backend/apps/receivables/schema.py:287](../../backend/apps/receivables/schema.py) — bulk_receive (rateio)
- [backend/apps/receivables/schema.py:316](../../backend/apps/receivables/schema.py) — bulk_receive (integral)

```python
TransactionModel.objects.create(
    ...
    payment_method="pix",  # ← hardcoded
)
```

## Solução proposta

Adicionar `payment_method` opcional nos inputs com default "pix" para compat:

```python
@strawberry.input
class CreateReceiptInput:
    transaction_id: strawberry.ID
    amount_received: float
    receipt_date: date
    destination_account_id: strawberry.ID
    payment_method: str = "pix"  # novo
    notes: Optional[str] = None


@strawberry.input
class BulkReceiveInput:
    transaction_ids: list[strawberry.ID]
    receipt_date: date
    destination_account_id: strawberry.ID
    payment_method: str = "pix"  # novo
    notes: Optional[str] = None
    total_amount: Optional[float] = None
```

E nos `Transaction.objects.create`:

```python
TransactionModel.objects.create(
    ...
    payment_method=input.payment_method,
)
```

Validar contra `VALID_PAYMENT_METHODS` (importar de `transactions.schema` ou centralizar em constants).

## Critérios de aceitação

- [ ] Backend aceita payment_method opcional, validado
- [ ] Frontend tem dropdown para selecionar meio no modal de recebimento
- [ ] Default continua "pix" se não informado (compat)
- [ ] Testes cobrindo cada meio

## Riscos / cuidados

- Receivables antigos continuam com "pix" — não migrar retroativamente.
