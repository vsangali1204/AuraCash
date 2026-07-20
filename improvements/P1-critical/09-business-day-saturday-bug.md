# P1-09 — get_execution_date trata sábado como dia útil

**Categoria:** Backend / Regra de negócio
**Estimativa:** Baixa

## Problema

A função `get_execution_date` no modelo `Recurrence`, quando `use_business_day=True`, considera sábado como dia útil. Isso é inusual em contextos brasileiros (folha de pagamento, recorrências bancárias) — normalmente "dia útil" exclui sábado E domingo.

## Localização

[backend/apps/recurrences/models.py:73-87](../../backend/apps/recurrences/models.py)

```python
n = self.day_of_month
count = 0
for d in range(1, calendar.monthrange(year, month)[1] + 1):
    dt = date(year, month, d)
    if dt.weekday() < 6:  # segunda a sábado (domingo=6 é ignorado)
        count += 1
        if count == n:
            return dt
```

`weekday()` retorna 0=segunda, 5=sábado, 6=domingo. O `< 6` inclui sábado.

## Solução proposta

**Antes de mudar**, confirmar com o produto/usuário se a intenção é:
- A: Apenas excluir domingos (comportamento atual — manter)
- B: Excluir sábado e domingo (comportamento típico bancário — mudar para `< 5`)
- C: Considerar feriados nacionais (mais complexo, precisa lib como `holidays` ou `workalendar`)

Se B (mais provável), trocar:

```python
if dt.weekday() < 5:  # segunda a sexta
```

E corrigir o segundo loop (fallback "último dia útil"):

```python
for d in range(calendar.monthrange(year, month)[1], 0, -1):
    dt = date(year, month, d)
    if dt.weekday() < 5:
        return dt
```

Se C, adicionar dependência:

```python
import holidays
br_holidays = holidays.country_holidays("BR")
if dt.weekday() < 5 and dt not in br_holidays:
    ...
```

## Critérios de aceitação

- [ ] Decisão A/B/C documentada
- [ ] Comportamento alinhado com expectativa do produto
- [ ] Comentário no código explica a regra ("dia útil = segunda a sexta, excluindo feriados nacionais")
- [ ] Teste cobrindo virada de mês com sábado/domingo

## Riscos / cuidados

- Se há usuários em produção dependendo do comportamento atual (sábado contando como útil), mudança quebra cronograma de recorrências existentes. Comunicar antes.
