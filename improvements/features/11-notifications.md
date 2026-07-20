# F-11 — Notificações (push / email / in-app)

**Categoria:** Funcionalidade
**Estimativa:** Alta
**Valor pro usuário:** Alto

## O que é

Sistema de notificações para eventos importantes. Configurável por canal (push, email, in-app) e por tipo.

## Tipos de notificação

| Tipo | Canal padrão | Quando |
|---|---|---|
| `invoice_due_soon` | push + email | 3 dias antes do vencimento |
| `recurrence_pending` | push | recorrência aguardando confirmação há 2+ dias |
| `budget_exceeded` | push | categoria atinge 100% do orçamento |
| `budget_warning` | in-app | categoria atinge `alert_threshold` (80% padrão) |
| `receivable_overdue` | push + email | recebível passou da `competence_date` |
| `low_balance` | push | conta abaixo de R$ X (configurável por conta) |
| `goal_milestone` | in-app | meta atingiu 25/50/75/100% |
| `monthly_report` | email | dia 1 — resumo do mês anterior |

## Modelo

```python
class NotificationSettings(models.Model):
    user = FK(User)
    type = CharField  # invoice_due_soon, etc.
    push_enabled = Bool(default=True)
    email_enabled = Bool(default=False)
    in_app_enabled = Bool(default=True)
    threshold_value = Decimal(null=True)  # ex.: limite "low balance"


class Notification(models.Model):
    class Status(TextChoices):
        PENDING = "pending"
        SENT = "sent"
        READ = "read"
        DISMISSED = "dismissed"

    user = FK(User)
    type = CharField
    title = CharField
    body = TextField
    link = CharField(null=True)  # /transactions/123
    data = JSONField  # contexto extra
    status = CharField(choices=Status)
    sent_at = DateTime(null=True)
    read_at = DateTime(null=True)
    created_at = DateTime
```

## Backend

Task Celery diária que avalia condições e cria `Notification`:

```python
@shared_task
def check_notifications():
    for user in active_users():
        check_invoice_due_soon(user)
        check_recurrence_pending(user)
        check_budget(user)
        check_receivables_overdue(user)
        check_low_balance(user)
```

Push: Web Push API + Service Worker
Email: SMTP existente

## UI

- Sininho no header com badge de não-lidas
- Dropdown com lista de notificações
- Página `/notifications` com histórico completo e filtros
- Configurações: `/settings/notifications` — toggle por tipo/canal

## Critérios de aceitação

- [ ] CRUD de NotificationSettings
- [ ] Sininho com badge
- [ ] Push funcionando em browsers compatíveis
- [ ] Email funcionando
- [ ] Resumo mensal por email
- [ ] Lib `web-push` no backend
- [ ] Permissão de push solicitada na hora certa (não no primeiro load)

## Considerações

- Push exige HTTPS (em prod já tem).
- Salvar subscription do browser por device.
- Anti-spam: dedup notificações do mesmo evento no mesmo dia.
