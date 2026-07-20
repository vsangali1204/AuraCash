# F-19 — Top fornecedores/devedores

**Categoria:** Relatório
**Estimativa:** Baixa
**Valor pro usuário:** Médio

## O que é

Lista ranqueada de quem mais consumiu seu dinheiro (e quem mais deve a você).

Ex.:
- "Onde você mais gastou em junho:"
  1. Uber - R$ 420
  2. iFood - R$ 380
  3. Mercado XYZ - R$ 290

- "Quem mais te deve:"
  1. João - R$ 1.500
  2. Maria - R$ 800

## Critério de agregação

"Fornecedor" = primeiras N palavras da descrição da transação (heurística), normalizado:
- "Uber Eats - 25/12", "Uber - 22/12", "UberX" → "Uber" (similaridade)

Idealmente, criar tabela `Vendor` opcional:

```python
class Vendor(models.Model):
    user = FK(User)
    name = CharField
    aliases = JSONField  # ["Uber Eats", "UberX"]
    default_category = FK(Category, null=True)
```

Transação aponta para Vendor opcionalmente. Se não aponta, agrupa por similaridade de descrição.

## UI

- Tab em /reports "Top fornecedores"
- Filtros: período, categoria
- Lista paginada com total + número de transações
- Click vai para transações daquele fornecedor

## Backend

```python
@strawberry.field
def top_vendors(
    self, info,
    date_from: date,
    date_to: date,
    transaction_type: str = "expense",
    limit: int = 20,
) -> list[VendorSummary]:
    ...
    # Agrupa por descrição normalizada
    # Soma valores
    # Retorna top N
```

## Critérios de aceitação

- [ ] Lista funciona com agrupamento heurístico
- [ ] (Opcional) Modelo Vendor para agrupamento explícito
- [ ] Top devedores no /receivables
- [ ] Top fornecedores em /reports
- [ ] Click navega para detalhes

## Considerações

- Pode evoluir para "comparativo": gastei R$ 420 no Uber esse mês, vs R$ 380 mês passado.
