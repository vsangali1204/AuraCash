# P1-08 — Usar Decimal em vez de float no GraphQL

**Categoria:** Backend / Precisão de dados
**Estimativa:** Alta

## Problema

Toda a camada GraphQL transporta valores monetários como `float`. Riscos:
- Precisão: valores > 2^53 perdem precisão (ok pra reais, mas teoricamente quebrado).
- Arredondamento: `0.1 + 0.2 == 0.30000000000000004` em JS e Python.
- Decimal no banco → float no GraphQL → JS Number → Decimal de novo introduz erros que somam ao longo do tempo.

Para um sistema financeiro, o caminho ideal é Decimal/string em todo o trajeto.

## Localização

Procurar por `amount: float`, `float(...)` em todos os schemas:

- [backend/apps/transactions/schema.py](../../backend/apps/transactions/schema.py) — várias
- [backend/apps/credit_cards/schema.py](../../backend/apps/credit_cards/schema.py)
- [backend/apps/receivables/schema.py](../../backend/apps/receivables/schema.py)
- [backend/apps/accounts/schema.py](../../backend/apps/accounts/schema.py)
- [backend/apps/recurrences/schema.py](../../backend/apps/recurrences/schema.py)

## Solução proposta

Strawberry tem suporte nativo a Decimal via scalar:

```python
from decimal import Decimal
import strawberry

@strawberry.type
class TransactionType:
    amount: Decimal  # Strawberry serializa como string em GraphQL
    ...
```

No frontend, usar `decimal.js` ou `big.js` para aritmética:

```typescript
import Decimal from "decimal.js";

const total = transactions.reduce(
  (s, t) => s.plus(t.amount),
  new Decimal(0),
);
```

Para display, converter pra Number só na hora de formatar:

```typescript
formatCurrency(Number(total.toFixed(2)))
```

## Estratégia de migração

Migrar incrementalmente — não tudo de uma vez:

1. Criar scalar custom `Money` que aceita float e Decimal (compat).
2. Migrar TransactionType primeiro.
3. Migrar agregações (DashboardSummary, etc.).
4. No frontend, criar tipo `Money = string` e helpers.
5. Atualizar componentes que fazem aritmética para usar decimal.js.
6. Remover suporte a float quando todo o codebase migrar.

## Critérios de aceitação

- [ ] Schema GraphQL retorna strings para valores monetários
- [ ] Frontend tem helpers `decimalAdd`, `decimalMul`, `formatMoney`
- [ ] Soma de 100 transações de R$ 0.10 dá exatamente R$ 10.00
- [ ] Sem regressões na UI

## Riscos / cuidados

- Mudança grande, alto risco de bug se não houver testes.
- Considerar fazer só DEPOIS de adicionar testes (P2-05).
- Pode ser feito por épico, não em uma única PR.
