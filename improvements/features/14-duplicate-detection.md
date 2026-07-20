# F-14 — Detecção de duplicatas

**Categoria:** Funcionalidade
**Estimativa:** Baixa
**Valor pro usuário:** Médio

## O que é

Avisar quando o usuário tenta criar uma transação que parece duplicata de outra recente.

Cenários:
- Lança Uber 25,00 hoje, e meia hora depois lança "Uber 25,00" de novo (não notou que já tinha lançado).
- Importou extrato e algumas transações já existiam.
- Confirmou recorrência manualmente, depois a task automática rodou.

## Heurística

Considera duplicata se há outra transação com:
- Mesma `amount`
- Mesma `date` (ou ±1 dia)
- Mesma `account` ou mesmo `credit_card`
- Descrição com `SIMILARITY > 0.6` (Postgres trigram)

## UI

- Ao submeter form de transação, antes de salvar, chamar `check_duplicates`
- Se houver match com score alto, mostrar modal:
  ```
  ⚠️ Possível duplicata detectada
  Encontrei uma transação parecida criada há 30min:
  - Uber - 25/12 - R$ 25,00

  [Salvar mesmo assim]  [Cancelar]
  ```

## Backend

```python
@strawberry.field
def check_duplicates(
    self, info,
    description: str,
    amount: float,
    date: date,
    account_id: Optional[ID] = None,
    credit_card_id: Optional[ID] = None,
) -> list[TransactionType]:
    user = require_auth(info)
    qs = Transaction.objects.filter(
        user=user,
        amount=Decimal(str(amount)),
        date__range=(date - timedelta(days=1), date + timedelta(days=1)),
    )
    if account_id:
        qs = qs.filter(account_id=account_id)
    if credit_card_id:
        qs = qs.filter(credit_card_id=credit_card_id)

    # Filtra por similaridade de descrição
    # (usar django-postgres-extra ou raw SQL com pg_trgm)
    similar = [tx for tx in qs if similarity(tx.description, description) > 0.6]
    return [map_transaction(t) for t in similar[:5]]
```

## Critérios de aceitação

- [ ] Detecção funciona com ±1 dia e descrição similar
- [ ] Modal de confirmação amigável
- [ ] Usuário pode forçar salvar
- [ ] Importação (F-03) também usa essa lógica em batch

## Considerações

- Performance: criar índice em `(user, amount, date)`.
- Não bloquear cadastro — só avisar.
- Permitir desabilitar a verificação por preferência.
