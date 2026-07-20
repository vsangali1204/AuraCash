# P1-03 — tasks.py (Celery) usar get_execution_date_in_range

**Categoria:** Backend / Consistência
**Estimativa:** Baixa

## Problema

Após a refatoração que centralizou os guards de `start_date`/`end_date` em `Recurrence.get_execution_date_in_range`, o arquivo `tasks.py` continua usando `get_execution_date` puro.

Hoje funciona porque o queryset filtra por `start_date__lte` e `end_date`, mas:
1. A duplicação aumenta o risco de bugs futuros (alguém esquece de manter os dois sincronizados).
2. Edge case: se `start_date == today` e a recorrência foi configurada para um `day_of_month` anterior ao dia atual, `get_execution_date` pode retornar uma data no passado. Hoje a comparação `exec_date != today` salva, mas é frágil.

## Localização

[backend/apps/recurrences/tasks.py:30](../../backend/apps/recurrences/tasks.py)

```python
for rec in recurrences:
    exec_date = rec.get_execution_date(today.year, today.month)
    if exec_date != today:
        continue
```

## Solução proposta

```python
for rec in recurrences:
    exec_date = rec.get_execution_date_in_range(today.year, today.month)
    if exec_date != today:
        continue
```

Também aproveitar para corrigir o import feio de `Q` (ver P2-02):

```python
from django.db.models import Q

recurrences = Recurrence.objects.filter(
    is_active=True,
    start_date__lte=today,
).filter(
    Q(end_date__isnull=True) | Q(end_date__gte=today)
).select_related("account", "credit_card", "category")
```

## Critérios de aceitação

- [ ] `tasks.py` usa `get_execution_date_in_range`
- [ ] Import de `Q` está limpo
- [ ] Task continua passando manualmente (rodar `process_recurrences.delay()` no shell)

## Riscos / cuidados

- Nenhum — semanticamente equivalente.
