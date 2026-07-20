# F-30 — Histórico / Auditoria

**Categoria:** Funcionalidade / segurança
**Estimativa:** Média
**Valor pro usuário:** Médio (essencial em workspace compartilhado)

## O que é

Registrar quem criou/editou/deletou cada item. Timeline visualizável. Permite desfazer ação acidental.

## Modelo

```python
class AuditLog(models.Model):
    class Action(TextChoices):
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"

    user = FK(User)  # quem fez
    action = CharField(choices=Action)
    model_name = CharField  # "Transaction", "CreditCard", etc.
    object_id = CharField  # str do PK
    changes = JSONField  # {"amount": {"old": 100, "new": 150}}
    description = CharField  # descrição amigável
    workspace = FK(Workspace, null=True)  # se F-10
    created_at = DateTime
```

## Implementação

Mixin pra rastrear automaticamente em mutations:

```python
class AuditedMutation:
    def log_change(self, info, action, instance, changes=None):
        from .models import AuditLog
        AuditLog.objects.create(
            user=info.context["user"],
            action=action,
            model_name=instance.__class__.__name__,
            object_id=str(instance.pk),
            changes=changes or {},
            description=f"{action} {instance}",
        )
```

Ou usar `django-simple-history` / `django-auditlog` (lib pronta).

## UI

- Página `/audit` com timeline filtrável (usuário, ação, modelo, data)
- Cada item de transação tem ícone "histórico" → mostra mudanças
- Em workspace compartilhado: "João editou esta transação há 2h"

## Soft delete + undo

Marcar como deletado em vez de remover de fato:

```python
class Transaction(...):
    deleted_at = DateTime(null=True)
    objects = TransactionQuerySet.as_manager()  # filtra deleted_at__isnull=True por padrão
    all_objects = models.Manager()  # acesso a tudo (admin)
```

Botão "Desfazer" no toast de delete (próximos 5s):

```python
@strawberry.mutation
def undo_delete(self, info, id: ID) -> TransactionType:
    tx = Transaction.all_objects.filter(id=id, user=user).first()
    tx.deleted_at = None
    tx.save()
    return map_transaction(tx)
```

## Critérios de aceitação

- [ ] AuditLog criado em todas as mutations principais
- [ ] Página de timeline filtrável
- [ ] Soft delete em entidades principais (Transaction, Invoice)
- [ ] Toast "Desfazer" com 5s de janela
- [ ] Histórico no detalhe de cada item

## Considerações

- Performance: AuditLog cresce rápido. Estratégia de retenção (90 dias?).
- Privacidade: log de ação não vaza valores sensíveis se workspace compartilhado.
