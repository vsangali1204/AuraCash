# F-23 — Antecipação de fatura

**Categoria:** Funcionalidade
**Estimativa:** Média
**Valor pro usuário:** Médio

## O que é

Permitir mover transações de uma fatura para outra (geralmente para anterior, para quitar antes). Alguns cartões oferecem desconto para antecipação.

## Casos de uso

- "Quero pagar a fatura de Set agora (em Ago)" → adianta vencimento
- "Quero passar essa compra grande para a próxima fatura" → reagendar

## Mutation

```python
@strawberry.mutation
def reassign_transaction_invoice(
    self, info, transaction_id: ID, target_invoice_id: ID
) -> TransactionType:
    user = require_auth(info)
    tx = Transaction.objects.filter(id=transaction_id, user=user).first()
    target_inv = Invoice.objects.filter(id=target_invoice_id, credit_card__user=user).first()

    # Validações
    if tx.credit_card_id != target_inv.credit_card_id:
        raise ValidationError("Cartão diferente.")
    if target_inv.status == "paid":
        raise ValidationError("Fatura destino já está paga.")

    tx.invoice = target_inv
    tx.competence_date = target_inv.due_date
    tx.save()
    return map_transaction(tx)


@strawberry.mutation
def prepay_invoice(
    self, info, invoice_id: ID, payment_date: date, amount: float,
    source_account_id: ID, discount_amount: float = 0,
) -> InvoiceType:
    """Quita fatura antes do vencimento com possível desconto."""
    # similar a pay_invoice, mas registra discount como receita ou redução
    ...
```

## UI

- Em listagem de transações da fatura, ícone "mover para outra fatura"
- Modal com seletor de fatura destino
- Em /invoices, botão "Antecipar pagamento" — abre form com data + valor + desconto opcional

## Critérios de aceitação

- [ ] Realocação de transação entre faturas do mesmo cartão
- [ ] Antecipação com desconto opcional
- [ ] Desconto registrado como ajuste positivo no histórico
- [ ] Não permite mover de/para fatura paga

## Considerações

- Realocar afeta o saldo de ambas as faturas — recalcular status de ambas.
- Idealmente, registro de auditoria pra ver realocações.
