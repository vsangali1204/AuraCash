# UX-16 — Autocomplete em descrições

**Categoria:** Forms / Velocidade
**Estimativa:** Média

## Problema

Cadastro de transação manual é cansativo. Sempre os mesmos "Uber", "iFood", "Mercado XYZ". Toda vez precisa digitar tudo.

## Solução

Campo "Descrição" com dropdown de sugestões baseadas no histórico:

```tsx
<Combobox
  value={description}
  onChange={setDescription}
  onSelect={(item) => {
    setDescription(item.label);
    setCategory(item.category);  // pré-preenche categoria
    setAmount(item.lastAmount);   // pré-preenche último valor
  }}
  fetcher={async (q) => fetchDescriptionSuggestions(q)}
/>
```

### Backend

```python
@strawberry.field
def description_suggestions(
    self, info, query: str, limit: int = 8
) -> list[DescriptionSuggestion]:
    user = require_auth(info)
    if len(query) < 1:
        return []

    # Agrupa por descrição normalizada
    rows = (
        Transaction.objects.filter(
            user=user,
            description__icontains=query,
        )
        .values("description")
        .annotate(
            count=Count("id"),
            last_category_id=Max("category_id"),
            last_amount=Max("amount"),  # pode ser média
        )
        .order_by("-count")[:limit]
    )
    return [DescriptionSuggestion(...) for r in rows]
```

## UI

```
Descrição
┌──────────────────────────┐
│ ubu                       │
└──────────────────────────┘
  ╔══════════════════════════════════╗
  ║ Uber  •  R$ 25,00 •  Transporte  ║  ← Tab pra aceitar
  ║ Uber Eats  •  R$ 45 •  Alimentaç ║
  ║ Itaú • R$ 50 • ...               ║
  ╚══════════════════════════════════╝
```

## Critérios

- [ ] Suggestion API
- [ ] Combobox no campo descrição
- [ ] Tab/Enter aceita sugestão
- [ ] Aceitar preenche categoria + valor sugerido
- [ ] Cache local pra desempenho
- [ ] Funciona em /transactions e /receivables
