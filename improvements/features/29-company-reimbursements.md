# F-29 — Reembolsos corporativos

**Categoria:** Funcionalidade
**Estimativa:** Baixa-média
**Valor pro usuário:** Médio (CLT/MEI com despesas corporativas)

## O que é

Marcar despesa como "Reembolsável" — automaticamente cria um recebível correspondente.

Caso de uso: você paga jantar do cliente, depois lança reembolso pra sua empresa, e quando receber, baixa.

## Mudança

```python
class Transaction(...):
    is_reimbursable = Bool(default=False)
    reimbursement_status = CharField(
        choices=[("pending", "Pendente"), ("requested", "Solicitado"), ("received", "Recebido")],
        null=True, blank=True,
    )
    reimbursement_company = CharField(null=True, blank=True)  # empresa que vai pagar
    related_reimbursement = FK("self", null=True, blank=True)  # recebível associado
```

Ao marcar `is_reimbursable=True` e setar `reimbursement_company`, sistema cria automaticamente um recebível:

```python
TransactionModel.objects.create(
    user=user,
    description=f"Reembolso: {tx.description}",
    amount=tx.amount,
    transaction_type="income",
    payment_method="transfer",
    date=tx.date,
    competence_date=tx.date + timedelta(days=15),  # config
    is_receivable=True,
    debtor_name=tx.reimbursement_company,
    receipt_status="pending",
    received_amount=Decimal("0"),
)
```

## UI

- Toggle "Reembolsável" no form (revela campo "Empresa")
- Filtro "Reembolsáveis pendentes" em /transactions
- Card no dashboard: "Aguardando reembolso: R$ X"

## Critérios de aceitação

- [ ] Toggle + campo empresa no form
- [ ] Recebível criado automaticamente
- [ ] Status sincronizado: receber dispara `reimbursement_status="received"`
- [ ] Filtro e visualização dedicada
- [ ] Relatório: total reembolsável por empresa por mês

## Considerações

- Combina com F-27 (anexos): nota fiscal pra reembolso.
- Tag "reembolsável" automática se F-26 também existir.
