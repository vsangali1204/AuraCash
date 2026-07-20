# F-06 — Investimentos

**Categoria:** Funcionalidade nova / módulo
**Estimativa:** Alta
**Valor pro usuário:** Alto (para quem investe)

## O que é

Módulo dedicado a investimentos: aportes, rendimento, posição atual, evolução. Entrada manual (sem integração com corretora) já agrega muito.

## Modelo

```python
class InvestmentAccount(models.Model):
    user = FK(User)
    name = CharField  # "Nubank Caixinha", "XP CDB"
    type = CharField(choices=...)  # fixed_income, stocks, fii, crypto, treasury
    broker = CharField(null=True)
    color = CharField
    is_active = Bool


class InvestmentMovement(models.Model):
    class Type(TextChoices):
        DEPOSIT = "deposit"      # aporte
        WITHDRAW = "withdraw"    # retirada
        YIELD = "yield"          # rendimento
        DIVIDEND = "dividend"    # provento
        FEE = "fee"              # taxa
        ADJUSTMENT = "adjustment" # ajuste de saldo

    account = FK(InvestmentAccount)
    type = CharField(choices=Type)
    amount = Decimal
    date = Date
    notes = TextField(null=True)
    from_account = FK(Account, null=True)  # conta de origem do aporte


class InvestmentPosition(models.Model):
    """Snapshot mensal pra acelerar queries de evolução."""
    account = FK(InvestmentAccount)
    month = Date  # primeiro dia
    balance = Decimal
```

## Funcionalidades

1. CRUD de InvestmentAccount
2. Lançar movimento (aporte, rendimento, retirada)
3. "Atualizar saldo" — usuário informa saldo atual da corretora; sistema calcula yield implícito
4. Dashboard de investimentos: total investido, rendimento %, gráfico
5. Card no dashboard geral: "Patrimônio em investimentos"

## UI

```
/investments
├── Resumo (cards: total, mês, rendimento %, taxa anual)
├── Lista de contas (por tipo)
├── Gráfico de evolução (12 meses)
├── Distribuição por tipo (pie)
└── Histórico de movimentações
```

## Critérios de aceitação

- [ ] CRUD de InvestmentAccount
- [ ] CRUD de InvestmentMovement
- [ ] Mutation `update_balance` que cria movimento `YIELD` calculado
- [ ] Aporte conecta com Account principal: gera Transaction de `expense` na conta + Movement de `deposit` no investimento
- [ ] Gráfico de evolução do patrimônio investido
- [ ] Cálculo de rentabilidade mensal e acumulada

## Considerações

- Para evolução fiel, exigir entrada manual mensal do saldo.
- Integração com APIs (Yahoo Finance, etc.) fica como fase 2.
