# F-13 — Conciliação inteligente de recebíveis

**Categoria:** Funcionalidade
**Estimativa:** Média
**Valor pro usuário:** Médio-alto

## O que é

"Recebi R$ 350 do João. Qual cobrança era?" — sistema sugere matches de recebíveis pendentes do João com valor próximo.

## UI

### Em /receivables
Botão "Conciliar recebimento" → modal:
1. Informa valor recebido + data
2. Sistema lista recebíveis pendentes com score de match
3. Usuário confirma um ou múltiplos

### Em /transactions
Ao criar receita, se valor + data batem com algum recebível, sugerir conciliação automática.

## Backend

```python
@strawberry.field
def suggest_receivable_matches(
    self, info,
    amount: float,
    received_date: date,
    debtor_name: Optional[str] = None,
) -> list[ReceivableMatch]:
    user = require_auth(info)
    candidates = TransactionModel.objects.filter(
        user=user, is_receivable=True,
        receipt_status__in=["pending", "partial"],
    )
    if debtor_name:
        candidates = candidates.filter(debtor_name__icontains=debtor_name)

    matches = []
    for tx in candidates:
        score = compute_match_score(tx, amount, received_date)
        if score > 0.3:
            matches.append(ReceivableMatch(transaction=map_transaction(tx), score=score))
    return sorted(matches, key=lambda m: -m.score)[:5]


def compute_match_score(tx, amount, received_date) -> float:
    score = 0.0

    # Valor exato (peso 0.6)
    if abs(float(tx.remaining_amount) - amount) < 0.01:
        score += 0.6
    elif abs(float(tx.remaining_amount) - amount) / float(tx.remaining_amount) < 0.1:
        score += 0.3  # diferença < 10%

    # Data próxima (peso 0.3)
    days_diff = abs((tx.competence_date - received_date).days)
    if days_diff == 0: score += 0.3
    elif days_diff <= 3: score += 0.2
    elif days_diff <= 7: score += 0.1

    # Devedor conhecido (peso 0.1)
    if tx.debtor_name:
        score += 0.1

    return score
```

## Critérios de aceitação

- [ ] Query `suggest_receivable_matches` retorna ranqueado
- [ ] Modal de conciliação no /receivables
- [ ] Auto-sugestão em /transactions quando criar receita
- [ ] Multi-match: usuário pode marcar vários e o valor rateia
- [ ] Score visível: "98% match" ajuda a confiar

## Considerações

- Quanto mais débitos pendentes, mais lento. Limitar busca a últimos N meses.
- Cache de scores se a query for chamada várias vezes.
