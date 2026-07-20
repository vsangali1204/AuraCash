# F-07 — Patrimônio total (Net Worth)

**Categoria:** Funcionalidade
**Estimativa:** Baixa-média (depende de F-06)
**Valor pro usuário:** Alto

## O que é

Card e gráfico mostrando patrimônio líquido = ativos − passivos.

- Ativos: saldo em contas + investimentos + recebíveis pendentes
- Passivos: faturas em aberto + parcelas futuras + (opcional) empréstimos contraídos

## UI

### Card no dashboard
```
┌─────────────────────────────────────┐
│  Patrimônio Líquido       📈 +2.3%  │
│  R$ 45.230,00                       │
│                                     │
│  Ativos:    R$ 52.430               │
│  Passivos:  R$ 7.200                │
└─────────────────────────────────────┘
```

### Página /networth
- Breakdown detalhado de cada componente
- Gráfico de evolução de 12 meses
- Cone de incerteza projetando próximos 6 meses considerando recorrências e parcelas

## Backend

Query `net_worth(year, month)`:

```python
@strawberry.type
class NetWorthBreakdown:
    cash_total: float          # contas
    investments_total: float   # se F-06 implementado
    receivables_total: float   # a receber
    invoices_total: float      # faturas em aberto
    installments_future: float # parcelas futuras
    loans_total: float         # empréstimos (se F-09)
    assets: float              # soma de ativos
    liabilities: float         # soma de passivos
    net_worth: float           # assets - liabilities

@strawberry.type
class NetWorthPoint:
    month: str
    net_worth: float
    assets: float
    liabilities: float
```

## Snapshot mensal

Para histórico, salvar snapshot no fim de cada mês via task Celery:

```python
class NetWorthSnapshot(models.Model):
    user = FK(User)
    month = Date  # primeiro dia
    cash_total = Decimal
    investments_total = Decimal
    receivables_total = Decimal
    invoices_total = Decimal
    net_worth = Decimal
    created_at = DateTime
```

## Critérios de aceitação

- [ ] Card no dashboard com valor + variação vs mês anterior
- [ ] Página dedicada com breakdown detalhado
- [ ] Gráfico de evolução
- [ ] Snapshot mensal automático
- [ ] Projeção futura de 6 meses

## Considerações

- Pode existir sem F-06 (investimentos): só conta + receivables vs invoices.
- Decidir como tratar dívidas de cartão: somar valor da fatura aberta ou só o paid_amount restante?
