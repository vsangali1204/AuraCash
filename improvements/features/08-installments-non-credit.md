# F-08 — Compras parceladas em outros meios (não-cartão)

**Categoria:** Funcionalidade
**Estimativa:** Baixa
**Valor pro usuário:** Médio

## O que é

Hoje parcelamento existe só para `credit_card`. Permitir parcelas em outros meios: financiamento, carnê, débito recorrente, boleto parcelado.

Caso de uso: compra de eletrodoméstico parcelado em boleto, financiamento de imóvel, IPTU em 10x.

## Mudança técnica

Em `create_transaction`:

```python
# Antes: parcelamento exige credit_card
if credit_card and input.total_installments > 1:
    ...

# Depois: parcelamento exige conta OU cartão, e gera parcelas com competence_date escalonado
if input.total_installments > 1:
    # Cria parent + N filhos
    # Cada filho tem competence_date = data + N meses
    # account é a mesma para todos (ou null se for boleto)
    ...
```

## UI

- Form de transação tem campo "Parcelas" mesmo quando não é crédito
- Validação: parcelas > 1 só faz sentido para `transaction_type="expense"`
- Visualização agrupada nas listagens

## Backend

```python
@strawberry.type
class TransactionType:
    ...
    installment_payment_method: Optional[str]  # debit/credit/transfer/cash/billet
```

Considerar adicionar tipo `billet` (boleto) em `PaymentMethod`.

## Critérios de aceitação

- [ ] Parcelas em débito/PIX/transfer/boleto suportadas
- [ ] `competence_date` correto em cada parcela
- [ ] Listagem agrupa parcelas (mostra parent, expande nas filhas)
- [ ] Recálculo de saldo da conta considera apenas parcelas já vencidas
- [ ] Edição da transação parent propaga para parcelas

## Considerações

- Quando a conta é nullable (boleto), validar que o `payment_method` é compatível.
- Cuidado com `account.current_balance`: parcelas futuras não devem reduzir saldo até a data.
