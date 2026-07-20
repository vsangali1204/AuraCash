# F-25 — Limite por categoria no cartão

**Categoria:** Funcionalidade
**Estimativa:** Baixa
**Valor pro usuário:** Médio

## O que é

Limitar quanto cada cartão pode gastar em cada categoria por mês. Útil pra disciplina ("não gastar mais que R$ 300 em iFood com o Nubank").

## Modelo

```python
class CardCategoryLimit(models.Model):
    credit_card = FK(CreditCard)
    category = FK(Category)
    monthly_limit = Decimal
    alert_at_pct = Int(default=80)

    class Meta:
        unique_together = [("credit_card", "category")]
```

## UI

Em /credit-cards, tab "Limites por categoria" para cada cartão:
- Lista categorias com gasto do mês corrente
- Permite definir limite por categoria
- Barra de progresso (verde/amarelo/vermelho)

Ao criar transação de cartão, ao selecionar categoria, mostrar:
- "Já gastei R$ 250 de R$ 300 em Alimentação neste cartão este mês"
- Alerta visual se ultrapassar

## Backend

```python
@strawberry.field
def card_category_usage(
    self, info, credit_card_id: ID, year: int, month: int
) -> list[CardCategoryUsage]:
    ...
    # Para cada limite configurado, calcula uso atual
```

## Critérios de aceitação

- [ ] CRUD de CardCategoryLimit
- [ ] Visualização de uso vs limite
- [ ] Alerta no form de transação quando se aproxima/passa do limite
- [ ] Notificação (F-11) quando atinge alert_at_pct

## Considerações

- Combina com F-02 (orçamento por categoria), mas mais granular (por cartão).
- Decisão: limite total da categoria vs por cartão somam ou são independentes?
