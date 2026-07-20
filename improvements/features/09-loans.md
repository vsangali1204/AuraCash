# F-09 — Empréstimos / Dívidas

**Categoria:** Funcionalidade
**Estimativa:** Alta
**Valor pro usuário:** Médio-alto

## O que é

Modelagem dedicada para empréstimos contraídos (consignado, financiamento, empréstimo pessoal). Distinto de parcelamento porque tem juros e amortização (Price ou SAC).

## Modelo

```python
class Loan(models.Model):
    class System(TextChoices):
        PRICE = "price"        # parcelas iguais
        SAC = "sac"            # amortização constante
        BULLET = "bullet"      # paga juros e quita no final

    user = FK(User)
    name = CharField  # "Financiamento veículo Banco X"
    principal = Decimal  # valor original
    interest_rate_monthly = Decimal  # taxa ao mês (%)
    term_months = Int  # prazo total
    start_date = Date
    system = CharField(choices=System)
    creditor = CharField  # quem emprestou
    debit_account = FK(Account, null=True)  # conta debitada
    is_active = Bool


class LoanInstallment(models.Model):
    loan = FK(Loan)
    number = Int  # 1 a N
    due_date = Date
    amount = Decimal       # valor total da parcela
    principal_part = Decimal  # amortização
    interest_part = Decimal   # juros
    paid_at = Date(null=True)
    related_transaction = FK(Transaction, null=True)
```

## Funcionalidades

1. Cadastrar empréstimo
2. Sistema gera todas as parcelas com cálculo correto
3. Pagar parcela → cria Transaction de despesa
4. Visualizar saldo devedor, juros pagos, juros restantes
5. Simulação: "Quitar antecipado" — calcular desconto

## Cálculos

### Price (parcelas iguais)
```python
def price_installment(P, i, n):
    """Parcela fixa do sistema Price."""
    if i == 0:
        return P / n
    return P * (i * (1 + i)**n) / ((1 + i)**n - 1)
```

### SAC (amortização constante)
```python
def sac_installment(P, i, n, k):
    """Parcela k do sistema SAC."""
    amort = P / n
    juros = (P - amort * (k - 1)) * i
    return amort + juros
```

## UI

- Página /loans com lista
- Detalhes do empréstimo: tabela de amortização completa
- Gráfico: principal vs juros ao longo do tempo
- Botão "Pagar próxima parcela"

## Critérios de aceitação

- [ ] Cadastro com Price ou SAC
- [ ] Geração automática da tabela de parcelas com cálculo correto
- [ ] Pagamento gera Transaction e marca parcela como paga
- [ ] Saldo devedor atualizado automaticamente
- [ ] Integração com Net Worth (F-07): empréstimo aparece como passivo

## Considerações

- IOF, seguro, taxas embutidas — campo adicional na parcela.
- Quitação antecipada: novo cronograma OU desconto à vista.
