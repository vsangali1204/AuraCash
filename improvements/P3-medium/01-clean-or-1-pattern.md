# P3-01 — Substituir `or 1` para evitar divisão por zero

**Categoria:** Backend / Clareza
**Estimativa:** Trivial

## Problema

Padrão `total or 1` aparece para evitar `ZeroDivisionError` em cálculos de porcentagem. Funciona mas obscurece intenção.

## Localização

[backend/apps/transactions/schema.py:486, 508](../../backend/apps/transactions/schema.py)
[backend/apps/transactions/schema.py:680](../../backend/apps/transactions/schema.py)

```python
total_exp_cat = sum(float(r["total"]) for r in cat_data) or 1
expense_by_category = [
    CategoryExpense(
        ...
        percentage=round(float(r["total"]) / total_exp_cat * 100, 1),
    )
    for r in cat_data
]
```

Bug sutil: se `total_exp_cat == 0`, todas percentages dão 0% — mas o cálculo está dividindo por 1 e somando float real, dando valores quaisquer. Não é zero divisão, mas semanticamente errado.

## Solução proposta

```python
total_exp_cat = sum(float(r["total"]) for r in cat_data)
expense_by_category = [
    CategoryExpense(
        category_name=r["category__name"],
        category_color=r["category__color"],
        total=float(r["total"]),
        percentage=round(float(r["total"]) / total_exp_cat * 100, 1) if total_exp_cat > 0 else 0.0,
    )
    for r in cat_data
]
```

Ou extrair helper:

```python
def pct(value: float, total: float) -> float:
    if total <= 0:
        return 0.0
    return round(value / total * 100, 1)
```

## Critérios de aceitação

- [ ] Sem `or 1` em cálculos de porcentagem
- [ ] Percentagem é 0 quando total é 0 (não valor arbitrário)
- [ ] Helper `pct` ou inline com `if`

## Riscos / cuidados

- Nenhum.
