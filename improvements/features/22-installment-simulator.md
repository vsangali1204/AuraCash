# F-22 — Simulador de parcelamento

**Categoria:** Funcionalidade
**Estimativa:** Baixa
**Valor pro usuário:** Médio

## O que é

Antes de confirmar uma compra parcelada, mostrar impacto nas próximas N faturas.

## UI

No form de criar transação, quando seleciona crédito + parcelas > 1:
- Aparece um mini-card abaixo:
  ```
  Simulação do parcelamento:
  ┌─────────────────────────────────┐
  │ Fatura       Total      Adição  │
  │ Jun/2026    R$ 1.200   +R$ 100  │
  │ Jul/2026    R$ 980     +R$ 100  │
  │ Ago/2026    R$ 1.100   +R$ 100  │
  │ ...                             │
  └─────────────────────────────────┘
  ```
- Linha que destaca quando alguma fatura supera X% do salário (alerta)

## Backend

```python
@strawberry.field
def simulate_installment(
    self, info,
    credit_card_id: ID,
    purchase_date: date,
    total_amount: float,
    installments: int,
) -> list[InstallmentSimulation]:
    user = require_auth(info)
    card = ...
    base_amount = Decimal(str(total_amount)) / installments

    first_month = get_first_invoice_month(card, purchase_date)
    simulations = []
    for i in range(installments):
        inv_month = add_months(first_month, i)
        existing_total = current_invoice_total(card, inv_month)
        simulations.append(InstallmentSimulation(
            month=inv_month,
            existing_total=float(existing_total),
            installment_amount=float(base_amount),
            new_total=float(existing_total + base_amount),
        ))
    return simulations
```

## Critérios de aceitação

- [ ] Simulação aparece dinamicamente no form
- [ ] Atualiza quando muda card, total, ou número de parcelas
- [ ] Compara contra "limite mensal de fatura" (config opcional)
- [ ] Pode ser usada também ao editar transação parcelada

## Considerações

- Cache de invoices_totals: chamar a cada keystroke é caro.
- Não persistir nada até usuário confirmar.
