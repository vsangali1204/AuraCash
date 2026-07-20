# P1-05 — pay_invoice aceita overpayment sem limite

**Categoria:** Backend / Regra de negócio
**Estimativa:** Baixa

## Problema

A mutation `pay_invoice` soma `paid_amount += payment` sem limitar ao saldo restante. Se o usuário digitar valor maior que o total da fatura, a fatura fica com `paid_amount > total_amount` (distorce relatórios) e ainda é marcada como PAID.

## Localização

[backend/apps/credit_cards/schema.py:282-307](../../backend/apps/credit_cards/schema.py)

```python
payment = Decimal(str(input.amount))
total = inv.total_amount
remaining = max(total - inv.paid_amount, Decimal("0"))

# Registra pagamento como despesa na conta
Transaction.objects.create(...)

inv.paid_amount += payment  # sem limite!
if inv.paid_amount >= total - Decimal("0.01") or payment >= remaining - Decimal("0.01"):
    inv.status = Invoice.Status.PAID
```

## Solução proposta

Validar antes de processar e limitar ao remaining:

```python
payment = Decimal(str(input.amount))
if payment <= Decimal("0"):
    raise ValueError("Valor deve ser positivo.")

total = inv.total_amount
remaining = max(total - inv.paid_amount, Decimal("0"))

if remaining <= Decimal("0.01"):
    raise ValueError("Fatura já está quitada.")

if payment > remaining + Decimal("0.01"):
    raise ValueError(
        f"Pagamento maior que o saldo restante. Restante: R$ {remaining:.2f}"
    )

# Registra exatamente o que foi pago
Transaction.objects.create(...)

inv.paid_amount += payment
if inv.paid_amount >= total - Decimal("0.01"):
    inv.status = Invoice.Status.PAID
else:
    inv.status = Invoice.Status.PARTIAL
inv.save()
```

## Critérios de aceitação

- [ ] Tentar pagar mais que o saldo retorna erro claro
- [ ] Tentar pagar fatura já quitada retorna erro
- [ ] Tentar pagar valor zero ou negativo retorna erro
- [ ] Pagamento exato (com tolerância de 0.01) ainda funciona
- [ ] Teste cobrindo cada caso

## Riscos / cuidados

- Verificar se o frontend já valida — pode estar deixando passar.
- Considerar UX: mostrar `remaining` no frontend pra evitar o erro.
