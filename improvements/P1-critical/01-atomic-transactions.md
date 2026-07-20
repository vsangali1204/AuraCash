# P1-01 — Adicionar @transaction.atomic em mutations multi-write

**Categoria:** Backend / Integridade de dados
**Estimativa:** Média

## Problema

Várias mutations executam múltiplas escritas no banco (`save()` / `create()`) sem `@transaction.atomic`.
Se um erro ocorrer no meio (ex.: validação tardia, falha de FK, exceção), o estado fica parcialmente gravado:
- Parcela 3 de 10 criada, mas as parcelas 4-10 não.
- Receipt registrado, transação de recebimento criada, mas o lançamento original não foi atualizado.
- Em loops de migração (`migrate_partial_receivables`), metade dos itens migrados e metade não.

Para um sistema financeiro isso é inaceitável — pode resultar em saldo incorreto e exigir intervenção manual.

## Localização

- [backend/apps/transactions/schema.py:825-919](../../backend/apps/transactions/schema.py) — `create_transaction` com parcelamento (cria 1 pai + N parcelas)
- [backend/apps/receivables/schema.py:154-222](../../backend/apps/receivables/schema.py) — `create_receipt` (4 escritas: Receipt + Transaction recebimento + Transaction saldo + update original)
- [backend/apps/receivables/schema.py:225-327](../../backend/apps/receivables/schema.py) — `bulk_receive` (loop com múltiplas escritas por item)
- [backend/apps/receivables/schema.py:329-379](../../backend/apps/receivables/schema.py) — `migrate_partial_receivables` (loop)
- [backend/apps/credit_cards/schema.py:266-307](../../backend/apps/credit_cards/schema.py) — `pay_invoice` (Transaction + Invoice update)
- [backend/apps/recurrences/schema.py:239-293](../../backend/apps/recurrences/schema.py) — `process_recurrences` (loop)
- [backend/apps/recurrences/tasks.py](../../backend/apps/recurrences/tasks.py) — task Celery

## Solução proposta

Aplicar `@transaction.atomic` no decorator das mutations ou usar `with transaction.atomic():` em blocos críticos:

```python
from django.db import transaction

@strawberry.mutation
@transaction.atomic
def create_transaction(self, info, input):
    ...
```

Para loops que processam N itens onde queremos que cada item seja independente (ex.: `migrate_partial_receivables`), usar `transaction.atomic()` **dentro** do loop — assim uma falha não derruba o lote inteiro:

```python
for tx in partials:
    try:
        with transaction.atomic():
            # processa um item
            ...
    except Exception as e:
        logger.error("falha ao migrar %s: %s", tx.id, e)
        continue
```

## Critérios de aceitação

- [ ] Todas as mutations identificadas têm `@transaction.atomic`
- [ ] `migrate_partial_receivables` e `bulk_receive` usam atomic por item, não por mutation inteira
- [ ] `tasks.py` (Celery) tem atomic por recorrência processada
- [ ] Testes unitários simulando falha no meio verificam rollback

## Riscos / cuidados

- `select_for_update()` pode ser necessário em mutations que leem-modificam-escrevem (ex.: paid_amount de invoice) para evitar race condition.
- Atomic não rola back side effects fora do banco (envio de email, etc.) — não há nenhum hoje, mas atenção futura.
