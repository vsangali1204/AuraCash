# F-26 — Tags livres em transações

**Categoria:** Funcionalidade
**Estimativa:** Baixa
**Valor pro usuário:** Médio

## O que é

Além de categoria (taxonomia rígida), tags livres ("trabalho", "reembolsável", "férias-2026", "casamento"). N:N com transações. Filtro por tag.

## Modelo

```python
class Tag(models.Model):
    user = FK(User)
    name = CharField(50)
    color = CharField(7, null=True)

    class Meta:
        unique_together = [("user", "name")]


class Transaction(...):
    tags = ManyToManyField(Tag, related_name="transactions", blank=True)
```

## UI

- No form de transação, campo "Tags" com autocomplete e criação inline
- Visual: chips coloridos
- Em listagens, mostrar tags abaixo da descrição
- Filtro: input com chips de tags

## Critérios de aceitação

- [ ] CRUD de tags
- [ ] Autocomplete com criação inline ("digite e tab")
- [ ] Filtro por tag em /transactions
- [ ] Agrupamento por tag em relatórios
- [ ] Tag pode pertencer a múltiplas transações

## Considerações

- Performance: índice em `transaction_tags`.
- Categoria e tags coexistem; categoria é estrutural, tag é circunstancial.
