# F-05 — Recebimentos recorrentes

**Categoria:** Funcionalidade
**Estimativa:** Média
**Valor pro usuário:** Médio-alto

## O que é

Hoje recorrências geram transações (despesa ou receita). Permitir um terceiro tipo: **recebível recorrente** — gera entradas em "A Receber" mensalmente.

Caso de uso: mensalidade de aluno, assinatura cobrada de cliente, parcela de empréstimo que você concedeu.

## Modelo

Estender `Recurrence`:

```python
class Recurrence(...):
    class RecurrenceType(TextChoices):
        INCOME = "income"
        EXPENSE = "expense"
        RECEIVABLE = "receivable"  # novo

    debtor_name = CharField(null=True, blank=True)  # quando type=receivable
```

E `process_recurrences` cria:
```python
if rec.recurrence_type == "receivable":
    Transaction.objects.create(
        ...
        is_receivable=True,
        debtor_name=rec.debtor_name,
        receipt_status="pending",
        competence_date=exec_date,
        ...
    )
```

## UI

- Tab adicional na página de recorrências: "Recebíveis"
- Form de recorrência tem 3 opções de tipo
- Quando "Recebível", obrigatório informar `debtor_name`

## Critérios de aceitação

- [ ] Recurrence aceita type "receivable"
- [ ] Task Celery gera recebível na data configurada
- [ ] Recebível gerado aparece em /receivables
- [ ] Edição de recorrência atualiza recebíveis futuros (não os já confirmados)

## Considerações

- Decidir: gerar com `is_pending_recurrence=True` (precisa confirmação) ou direto na lista?
- Quando o devedor paga, o que acontece com a recorrência? Continua gerando próximas (sim, é o esperado).
