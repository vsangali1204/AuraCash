# F-18 — Heatmap de gastos por dia

**Categoria:** Visualização
**Estimativa:** Baixa
**Valor pro usuário:** Médio

## O que é

Calendário visual com cor da intensidade de gasto por dia. Tipo GitHub contributions.

## UI

```
   D  S  T  Q  Q  S  S
   ░  ▒  ▒  ░  ▒  ▒  █     ← gradiente: claro = pouco, escuro = muito
   ▒  ▒  ░  ░  ▒  █  █
   ░  ░  ░  ▒  ▒  ▒  ▒
   ▒  ░  ░  ░  ▒  █  █
   ░  ░  ░  ░  ░  ▒  ▒
```

- 1 célula por dia
- Cor por escala (verde→amarelo→vermelho ou tema sky)
- Hover mostra valor + transações do dia
- Click navega para /transactions filtrado pelo dia

## Variações úteis

- Por categoria (filtro): só gastos com Alimentação
- Comparar dois períodos (heatmap espelhado)
- Visão por hora do dia (se tiver timestamp): "você gasta mais entre 18-22h"

## Backend

```python
@strawberry.field
def spending_heatmap(
    self, info,
    date_from: date,
    date_to: date,
    category_id: Optional[ID] = None,
) -> list[HeatmapCell]:
    user = require_auth(info)
    qs = Transaction.objects.filter(
        user=user,
        transaction_type="expense",
        date__range=(date_from, date_to),
    )
    if category_id:
        qs = qs.filter(category_id=category_id)

    cells = (
        qs.values("date")
        .annotate(total=Sum("amount"), count=Count("id"))
        .order_by("date")
    )
    return [HeatmapCell(...) for c in cells]
```

## Critérios de aceitação

- [ ] Calendário com cor por intensidade
- [ ] Tooltip com detalhe
- [ ] Click navega para detalhe
- [ ] Funciona em mobile (scroll horizontal)
- [ ] Filtro por categoria

## Considerações

- Bom em /reports como visualização alternativa.
- Combina bem com F-15 (insights).
