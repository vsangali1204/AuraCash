# F-01 — Metas financeiras (Goals)

**Categoria:** Funcionalidade core
**Estimativa:** Alta
**Valor pro usuário:** Alto — disciplina financeira é o caso de uso #1 de apps assim

## O que é

Permitir ao usuário criar metas de poupança com valor-alvo e prazo, ex.:
- "Reserva de emergência: R$ 10.000 até dez/2026"
- "Viagem julho: R$ 3.000 até jul/2026"

## Modelo de dados

```python
class Goal(models.Model):
    user = FK(User)
    name = CharField(200)
    target_amount = Decimal
    target_date = Date
    started_at = Date  # default today
    associated_account = FK(Account, null=True)  # opcional
    associated_category = FK(Category, null=True)  # categoria que move o progresso
    color = CharField(7)
    icon = CharField(50)
    is_archived = Bool(default=False)

    @property
    def current_amount(self) -> Decimal:
        # se tem categoria, soma transações de receita nessa categoria
        # se tem conta, usa current_balance
        ...

    @property
    def progress_pct(self) -> float: ...
    @property
    def monthly_required(self) -> Decimal: ...
```

## UI

- Página `/goals` com cards visuais (barra de progresso, dias restantes, valor mensal sugerido)
- Card no dashboard mostrando 2-3 metas com progresso
- Modal de criação com seletor de ícone/cor
- Visualização: barra de progresso + comparativo "ritmo atual vs ritmo necessário"

## Critérios de aceitação

- [ ] CRUD de metas
- [ ] Cálculo automático de progresso a partir de conta OU categoria
- [ ] Card no dashboard mostra próximas metas
- [ ] Alertas: meta atrasada, meta concluída
- [ ] Histórico de aportes (transações que contribuíram)

## Considerações

- Pode evoluir para "investimentos com objetivo" depois.
- Integrar com orçamento (F-02): meta tem prioridade sobre gasto livre.
