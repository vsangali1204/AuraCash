# F-02 — Orçamento por categoria

**Categoria:** Funcionalidade core
**Estimativa:** Média
**Valor pro usuário:** Alto

## O que é

Definir limite mensal por categoria (ex.: Alimentação R$ 800, Lazer R$ 400). Sistema acompanha o consumo e alerta visualmente.

## Modelo

```python
class CategoryBudget(models.Model):
    user = FK(User)
    category = FK(Category)
    monthly_limit = Decimal
    alert_threshold = IntegerField(default=80)  # %
    is_active = Bool(default=True)
    valid_from = Date  # vigência (permite mudar limites ao longo do tempo)

    class Meta:
        unique_together = [("user", "category", "valid_from")]
```

## UI

- Página `/budgets` com lista de categorias e limites
- Card no dashboard "Orçamento do mês" — top 3 categorias mais próximas do limite
- Barra de progresso por categoria: verde < 80%, amarelo 80-100%, vermelho > 100%
- Notificação quando atinge `alert_threshold`

## Backend

Query `category_budgets_status(year, month)`:
```python
[
  {
    category: {...},
    limit: 800.0,
    spent: 650.0,
    remaining: 150.0,
    progress_pct: 81.25,
    status: "warning",  # ok / warning / over
  },
  ...
]
```

## Critérios de aceitação

- [ ] CRUD de orçamentos por categoria
- [ ] Cálculo correto considerando só transações `transaction_type="expense"`
- [ ] Card no dashboard ordenado por urgência
- [ ] Histórico: "no mês passado você ficou em 95% do limite"
- [ ] Sugestão de limite com base na média dos últimos 3 meses

## Considerações

- Permitir excluir categorias específicas do orçamento (ex.: "Aluguel" é fixo, não tem sentido limitar).
- Cuidado com cartão de crédito: a transação cai no mês da compra ou da fatura? Decisão de produto.
