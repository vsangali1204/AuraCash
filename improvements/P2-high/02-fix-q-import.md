# P2-02 — Corrigir `__import__("django.db.models", fromlist=["Q"])`

**Categoria:** Backend / Code smell
**Estimativa:** Trivial

## Problema

Em dois arquivos, há um workaround feio para importar `Q`:

```python
__import__("django.db.models", fromlist=["Q"]).Q(end_date__isnull=True)
| __import__("django.db.models", fromlist=["Q"]).Q(end_date__gte=today)
```

Não há razão para isso — `from django.db.models import Q` no topo do arquivo resolve. É puramente lixo de refactor mal-feito.

## Localização

- [backend/apps/recurrences/schema.py:253-254](../../backend/apps/recurrences/schema.py)
- [backend/apps/recurrences/tasks.py:25-26](../../backend/apps/recurrences/tasks.py)

## Solução proposta

Adicionar no topo do arquivo:

```python
from django.db.models import Q
```

E trocar:

```python
recurrences = Recurrence.objects.filter(
    is_active=True,
    start_date__lte=today,
).filter(
    Q(end_date__isnull=True) | Q(end_date__gte=today)
).select_related("account", "credit_card", "category")
```

## Critérios de aceitação

- [ ] Sem `__import__` em nenhum arquivo do projeto (`grep -r '__import__'` → vazio)
- [ ] Comportamento idêntico

## Riscos / cuidados

- Nenhum.
