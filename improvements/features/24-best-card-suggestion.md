# F-24 — Sugestão do melhor cartão pra usar

**Categoria:** Funcionalidade
**Estimativa:** Baixa
**Valor pro usuário:** Médio (pra quem tem múltiplos cartões)

## O que é

Recomenda qual cartão usar agora baseado em:
- Limite disponível
- Quanto tempo até o vencimento (mais distante = mais prazo)
- Limite por categoria (se configurado)
- Cashback / pontos (se cadastrado)

## UI

Botão flutuante ou no header: "Melhor cartão agora"
- Mostra ranking dos cartões ativos
- Cada um com: nome, dias até vencimento, % do limite usado, motivo da posição

```
🥇 Nubank
   Vencimento: 25 dias  •  Limite: 62%  •  Próxima compra rende mais

🥈 Itaú
   Vencimento: 12 dias  •  Limite: 45%

🥉 Inter
   Vencimento: 5 dias  •  Limite: 88%  •  ⚠️ Quase no limite
```

## Backend

```python
@strawberry.field
def best_card_recommendation(
    self, info, purchase_date: Optional[date] = None,
) -> list[CardRecommendation]:
    user = require_auth(info)
    today = purchase_date or timezone.localdate()
    cards = CreditCard.objects.filter(user=user, is_active=True)

    recommendations = []
    for card in cards:
        first_invoice_month = get_first_invoice_month(card, today)
        invoice = Invoice.objects.filter(
            credit_card=card, reference_month=first_invoice_month
        ).first()
        days_until_due = (invoice.due_date - today).days if invoice else 30

        limit_used_pct = float(card.total_limit - card.available_limit) / float(card.total_limit) * 100

        score = (
            days_until_due * 2          # mais prazo é melhor
            - limit_used_pct * 0.5      # limite usado pesa
        )
        recommendations.append(CardRecommendation(
            card=map_credit_card(card),
            days_until_due=days_until_due,
            limit_used_pct=limit_used_pct,
            score=score,
            reason=...,
        ))
    return sorted(recommendations, key=lambda r: -r.score)
```

## Critérios de aceitação

- [ ] Endpoint retorna ranking justificado
- [ ] UI no header ou floating
- [ ] Considera fechamento e vencimento
- [ ] Considera limite disponível
- [ ] Mensagem clara do motivo

## Considerações

- Pode evoluir incluindo cashback (precisa cadastrar % por cartão por categoria).
- Atalho: ao criar transação, sugerir trocar pro melhor cartão.
