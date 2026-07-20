# P1-02 — N+1 em receivable_summary

**Categoria:** Backend / Performance
**Estimativa:** Baixa

## Problema

`receivable_summary` dispara uma query SQL extra para cada devedor para contar transações.
Com 50 devedores, são 51 queries em vez de 1.

## Localização

[backend/apps/receivables/schema.py:85-99](../../backend/apps/receivables/schema.py)

```python
txs = base_qs.values("debtor_name").annotate(
    total=Sum("amount"),
    received=Sum("received_amount"),
)

return [
    ReceivableSummaryType(
        ...
        transaction_count=base_qs.filter(debtor_name=row["debtor_name"]).count(),  # 1 query por linha!
    )
    for row in txs
]
```

## Solução proposta

Incluir `Count` na própria agregação:

```python
from django.db.models import Count

txs = base_qs.values("debtor_name").annotate(
    total=Sum("amount"),
    received=Sum("received_amount"),
    tx_count=Count("id"),
)

return [
    ReceivableSummaryType(
        debtor_name=row["debtor_name"] or "Sem nome",
        total_amount=float(row["total"]),
        received_amount=float(row["received"]),
        pending_amount=float(row["total"] - row["received"]),
        transaction_count=row["tx_count"],
    )
    for row in txs
]
```

## Critérios de aceitação

- [ ] `transaction_count` vem da agregação, sem queries adicionais
- [ ] Resultado numericamente idêntico ao atual
- [ ] (Opcional) Adicionar teste que assert que `len(connection.queries) == 1` na chamada

## Riscos / cuidados

- Nenhum — é uma otimização pura.
