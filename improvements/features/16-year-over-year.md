# F-16 — Comparativo ano-a-ano

**Categoria:** Relatórios
**Estimativa:** Baixa
**Valor pro usuário:** Médio

## O que é

"Jun/2026 vs Jun/2025" — gráfico lado a lado com mesma estrutura. Identifica sazonalidade e crescimento.

## UI

Em /reports, adicionar tab "Ano a ano":
- Seletor de mês
- Gráfico de barras agrupado (azul = ano atual, cinza = ano anterior)
- Por categoria, com % de variação
- Por tipo (receita/despesa/saldo)

## Backend

```python
@strawberry.field
def year_over_year(
    self, info, month: int
) -> YearOverYearReport:
    user = require_auth(info)
    today = timezone.localdate()

    current_year = today.year
    prev_year = current_year - 1

    current = aggregate_by_category(user, current_year, month)
    previous = aggregate_by_category(user, prev_year, month)

    items = []
    for cat in set(current.keys()) | set(previous.keys()):
        cur_amount = current.get(cat, 0)
        prev_amount = previous.get(cat, 0)
        items.append(YoYCategoryItem(
            category=cat,
            current_amount=cur_amount,
            previous_amount=prev_amount,
            variation_pct=...,
        ))
    return YearOverYearReport(...)
```

## Critérios de aceitação

- [ ] Tab "Ano a ano" em /reports
- [ ] Comparativo por categoria, tipo e total
- [ ] Variação % visível
- [ ] Funciona em meses onde ano anterior não tinha dados

## Considerações

- Cuidado quando ano anterior tem categoria que não existe mais (deletada): tratar como "Categoria antiga".
