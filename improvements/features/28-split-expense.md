# F-28 — Divisão de despesas (split)

**Categoria:** Funcionalidade
**Estimativa:** Média
**Valor pro usuário:** Alto

## O que é

"Almoço R$ 80, dividido entre eu, João e Maria" → vira 1 despesa de R$ 26,67 sua + 2 recebíveis de R$ 26,67 cada (de João e Maria).

Tipo Splitwise simplificado.

## Modelo

```python
class ExpenseSplit(models.Model):
    parent_transaction = FK(Transaction, related_name="splits")
    debtor_name = CharField
    amount = Decimal
    receivable_transaction = FK(Transaction, null=True, related_name="split_source")
```

Quando criar split:
- A `parent_transaction` é a despesa total (R$ 80)
- Para cada participante (exceto você), cria:
  - `ExpenseSplit` (registro do split)
  - `Transaction` correspondente: `is_receivable=True`, `amount=split.amount`, `debtor_name=split.debtor_name`

A sua parte fica como despesa real (R$ 26,67 em conta) e o resto sai como recebíveis.

## UI

No form de transação, toggle "Dividir":
- Lista dinâmica: "Quem participa?"
- Cada participante: nome + valor (split igual ou customizado)
- Toggle: "Incluir mim na divisão"
- Preview: "Sua parte: R$ X. A receber: Y participantes × R$ Z"

Em transações:
- Despesa dividida mostra badge "Dividida"
- Expande mostra cada split e status (pendente/recebido)

## Critérios de aceitação

- [ ] CRUD de split
- [ ] Divisão igual + manual
- [ ] Recebíveis criados automaticamente
- [ ] Editar valor do split propaga para receivable
- [ ] Quando receivable é pago, marca split como settled
- [ ] Visualização: "X de Y splits recebidos"

## Considerações

- Caso ímpar: 80/3 = 26.66 + 26.66 + 26.68. Decidir quem absorve a fração.
- Quando alguém ainda não tem cadastro como devedor recorrente, salvar nome livre.
- Pode integrar com F-26 (tags): toda despesa dividida ganha tag "split" automática.
