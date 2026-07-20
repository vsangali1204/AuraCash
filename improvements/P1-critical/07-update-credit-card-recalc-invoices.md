# P1-07 — update_credit_card muda closing/due_day sem recalcular faturas

**Categoria:** Backend / Regra de negócio
**Estimativa:** Média

## Problema

`update_credit_card` permite alterar `closing_day` e `due_day` sem reprocessar faturas existentes. Resultado:
- Faturas antigas mantêm closing_date e due_date calculados com os dias antigos.
- Transações futuras passarão a cair em faturas calculadas com os dias novos.
- O usuário vê um "gap" inconsistente.

Cenário concreto: cartão fecha dia 5, vence dia 15. Usuário muda para fecha dia 10, vence dia 20. Faturas dos meses anteriores ainda têm os dias antigos.

## Localização

[backend/apps/credit_cards/schema.py:210-238](../../backend/apps/credit_cards/schema.py)

```python
if input.closing_day is not None:
    card.closing_day = input.closing_day
if input.due_day is not None:
    card.due_day = input.due_day
```

## Solução proposta

Três opções:

**A — Bloquear se houver faturas com transações:**

```python
if (input.closing_day is not None or input.due_day is not None):
    has_invoices = Invoice.objects.filter(
        credit_card=card,
    ).exists()
    if has_invoices:
        raise Exception(
            "Não é possível alterar dias de fechamento/vencimento "
            "com faturas já criadas. Apague as faturas vazias primeiro."
        )
```

**B — Recalcular faturas abertas:**

```python
from .models import get_or_create_invoice

if input.closing_day is not None or input.due_day is not None:
    new_closing = input.closing_day or card.closing_day
    new_due = input.due_day or card.due_day
    card.closing_day = new_closing
    card.due_day = new_due
    card.save()

    # Recalcula apenas faturas ainda abertas
    open_invoices = Invoice.objects.filter(
        credit_card=card,
        status__in=["open", "closed"],
    )
    for inv in open_invoices:
        # recalcula closing_date e due_date usando os novos dias
        new_inv = compute_invoice_dates(card, inv.reference_month)
        inv.closing_date = new_inv["closing_date"]
        inv.due_date = new_inv["due_date"]
        inv.save()
```

**C — Versionar dias (preferível mas mais trabalho):** criar `CreditCardSchedule` com vigência `valid_from` para histórico.

## Critérios de aceitação

- [ ] Não é possível deixar faturas em estado inconsistente
- [ ] Decisão entre A/B/C documentada
- [ ] Teste cobrindo alteração com faturas existentes

## Riscos / cuidados

- Cuidado com faturas já parcialmente pagas — não recalcular se há `paid_amount > 0`.
- Migração de dados pode ser necessária se já houver cartões em produção.
