# P3-02 — Padronizar UNSET vs None em UpdateInputs

**Categoria:** Backend / Consistência
**Estimativa:** Baixa

## Problema

Em `UpdateRecurrenceInput`:
- `end_date: Optional[date] = strawberry.UNSET` — usa UNSET para distinguir "não passou" de "passou null" (correto para campos nullable).
- `start_date: Optional[date] = None` — usa None.

A diferença existe porque `start_date` é NOT NULL no modelo, então passar None nunca faz sentido. Mas a inconsistência confunde leitor.

## Localização

[backend/apps/recurrences/schema.py:91-105](../../backend/apps/recurrences/schema.py)

## Solução proposta

Documentar a convenção explicitamente:

```python
@strawberry.input
class UpdateRecurrenceInput:
    id: strawberry.ID
    description: Optional[str] = None
    amount: Optional[float] = None
    ...
    # NOT NULL no modelo — `None` aqui significa "não passou", não "limpe".
    start_date: Optional[date] = None
    # Nullable no modelo — usa UNSET para distinguir "não passou" (UNSET) de "limpar" (None).
    end_date: Optional[date] = strawberry.UNSET
    ...
```

E auditar todos os outros UpdateInputs do projeto pra aplicar a mesma convenção:

- `UpdateTransactionInput`: `competence_date` é nullable → deveria ser UNSET
- `UpdateCreditCardInput`: `account_id` é nullable → deveria ser UNSET
- `UpdateAccountInput`: avaliar campos

## Critérios de aceitação

- [ ] Convenção documentada em comentário no `UpdateRecurrenceInput`
- [ ] Outros UpdateInputs auditados e ajustados
- [ ] Testes cobrindo "limpar valor" (passar None explícito)

## Riscos / cuidados

- UNSET requer cuidado: `if input.x is not strawberry.UNSET:` em vez de `if input.x is not None:`. Auditar todos os call-sites.
