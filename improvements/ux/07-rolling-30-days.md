# UX-07 — Período "Próximos 30 dias"

**Categoria:** Visualização
**Estimativa:** Baixa

## Problema

Dashboard navega por mês civil (Jun, Jul...). Mas pra decisão prática, "próximos 30 dias" é mais útil — não importa se vira o mês.

## Solução

No seletor de período do dashboard, adicionar opção:

```
< Junho 2026 >    [Próximos 30 dias]
```

Quando ativo:
- Filtra transações por `date BETWEEN today AND today + 30 days`
- Cards de "Receitas/Despesas previstas" mostram só esse range
- Projeção: saldo hoje → saldo daqui 30 dias
- Calendário destaca o período

## Backend

`dashboard_summary` aceita modo rolling:

```python
@strawberry.field
def dashboard_summary(
    self, info,
    year: Optional[int] = None,
    month: Optional[int] = None,
    rolling_days: Optional[int] = None,
) -> DashboardSummary:
    if rolling_days:
        date_from = today
        date_to = today + timedelta(days=rolling_days)
    else:
        date_from = date(year, month, 1)
        date_to = last_day_of_month(year, month)
    # filtra usando date_from / date_to
```

## Critérios

- [ ] Botão "Próximos 30 dias" no dashboard
- [ ] Persistência da escolha (localStorage)
- [ ] Cards e gráficos refletem o período
- [ ] (Opcional) 7/15/30/60/90 dias
