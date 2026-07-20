# P2-10 — Adicionar índices no banco para consultas frequentes

**Categoria:** Backend / Performance
**Estimativa:** Baixa

## Problema

Queries frequentes não têm índice apropriado. Em um banco com milhares de transações, fica lento.

Consultas observadas:
- `Transaction(user, date)` — listagem geral
- `Transaction(user, is_receivable, receipt_status)` — recebíveis
- `Transaction(recurrence_id, date)` — verificação de duplicata em recorrência
- `Transaction(user, transaction_type, date)` — dashboard por tipo
- `Invoice(due_date, status)` — faturas vencendo
- `Invoice(credit_card, reference_month)` — já tem unique, ok

## Localização

[backend/apps/transactions/models.py](../../backend/apps/transactions/models.py)
[backend/apps/credit_cards/models.py](../../backend/apps/credit_cards/models.py)
[backend/apps/recurrences/models.py](../../backend/apps/recurrences/models.py)

## Solução proposta

Em `Transaction.Meta`:

```python
class Meta:
    verbose_name = "Lançamento"
    verbose_name_plural = "Lançamentos"
    ordering = ["-date", "-created_at"]
    indexes = [
        models.Index(fields=["user", "-date"], name="tx_user_date_idx"),
        models.Index(fields=["user", "is_receivable", "receipt_status"], name="tx_user_recvbl_idx"),
        models.Index(fields=["user", "transaction_type", "date"], name="tx_user_type_date_idx"),
        models.Index(fields=["recurrence", "date"], name="tx_recurrence_date_idx"),
        models.Index(fields=["user", "is_pending_recurrence"], name="tx_user_pending_idx"),
        models.Index(fields=["invoice"], name="tx_invoice_idx"),  # se ainda não tem
        models.Index(fields=["parent_transaction"], name="tx_parent_idx"),
    ]
```

Em `Invoice.Meta`:

```python
indexes = [
    models.Index(fields=["due_date", "status"], name="inv_due_status_idx"),
    models.Index(fields=["status"], name="inv_status_idx"),
]
```

Em `Recurrence.Meta`:

```python
indexes = [
    models.Index(fields=["user", "is_active"], name="rec_user_active_idx"),
]
```

Gerar migration:

```bash
python manage.py makemigrations
python manage.py migrate
```

## Critérios de aceitação

- [ ] Migrations geradas e revisadas
- [ ] Index nomes seguem convenção (`<table>_<cols>_idx`)
- [ ] EXPLAIN ANALYZE nas queries críticas mostra Index Scan, não Seq Scan
- [ ] (Bônus) Documentar quais índices servem quais queries em comentário

## Riscos / cuidados

- Em base grande, criação de índice pode demorar — usar `CONCURRENTLY` em produção:
  ```sql
  CREATE INDEX CONCURRENTLY ...
  ```
  Django não gera isso por padrão; pode ser necessário migration manual.
- Não criar índices "por garantia" — cada índice tem custo em write.
