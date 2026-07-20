# P3-04 — Remover refresh_from_db desnecessários

**Categoria:** Backend / Performance
**Estimativa:** Baixa

## Problema

Após `t.save()`, o código chama `t.refresh_from_db()` em vários lugares. Isso é só necessário quando:
- Há signals/triggers que modificam o objeto.
- Há `auto_now`/`auto_now_add` que você quer ler de volta no mesmo request.
- Campos foram modificados por F() expressions e você quer o valor resolvido.

No projeto, o uso parece preventivo e dispara uma query SELECT extra que não agrega valor.

## Localização

[backend/apps/transactions/schema.py:979, 1007](../../backend/apps/transactions/schema.py)

```python
t.save()
_propagate_installment_fields(t, input)
t.refresh_from_db()  # ← provavelmente desnecessário
return map_transaction(t)
```

## Solução proposta

Auditar cada `refresh_from_db()`:
- Se há `auto_now` e o cliente precisa do `updated_at` atualizado → manter.
- Se há F() expression no save → manter.
- Caso contrário → remover.

No caso em questão, `_propagate_installment_fields` modifica outros objetos (parent, siblings), não `t`. `t.refresh_from_db()` não traz benefício.

## Critérios de aceitação

- [ ] Cada uso de `refresh_from_db` revisado
- [ ] Removidos onde não há razão
- [ ] Onde mantidos, comentário explica por quê
- [ ] Testes cobrindo casos onde refresh é necessário (auto_now)

## Riscos / cuidados

- Em raros casos, signals podem modificar o objeto — verificar `post_save` signals existem.
