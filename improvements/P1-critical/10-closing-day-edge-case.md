# P1-10 — Compra no dia exato do fechamento cai na próxima fatura

**Categoria:** Backend / Regra de negócio
**Estimativa:** Baixa

## Problema

`get_first_invoice_month` decide qual fatura recebe uma compra baseado em `purchase_date.day < closing_day`. Compra exatamente NO dia do fechamento vai para o **próximo mês**.

Bancos brasileiros geralmente consideram o dia de fechamento ainda como parte da fatura atual (a compra entra, e só compras a partir do dia seguinte vão para a próxima).

## Localização

[backend/apps/credit_cards/models.py:116-124](../../backend/apps/credit_cards/models.py)

```python
def get_first_invoice_month(credit_card: CreditCard, purchase_date: date) -> date:
    closing_day = credit_card.closing_day
    if purchase_date.day < closing_day:  # ← <= aqui mudaria comportamento
        return purchase_date.replace(day=1)
    # Após o fechamento → próxima fatura
    ...
```

## Solução proposta

Confirmar a regra com o produto. Se a regra correta for "fechamento inclui o próprio dia":

```python
if purchase_date.day <= closing_day:
    return purchase_date.replace(day=1)
```

Se a regra atual (`<`) for intencional (alguns cartões funcionam assim), pelo menos adicionar comentário explicativo:

```python
# Comportamento: compra no dia exato do fechamento já entra na próxima fatura.
# Convenção do banco emissor — confirmar com o usuário em cada cartão se possível.
if purchase_date.day < closing_day:
    ...
```

## Critérios de aceitação

- [ ] Regra documentada no docstring da função
- [ ] Decisão `<` vs `<=` validada com produto
- [ ] Teste cobrindo o caso `purchase_date.day == closing_day`

## Riscos / cuidados

- Mudança altera alocação de transações em faturas existentes — pode bagunçar histórico.
- Idealmente, fazer essa correção junto com a migração de dados que move transações afetadas.
- Considerar adicionar campo `closing_day_inclusive: bool` no CreditCard se houver dúvida — usuário escolhe.
