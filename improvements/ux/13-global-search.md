# UX-13 — Pesquisa global

**Categoria:** Navegação
**Estimativa:** Média

## Problema

Pesquisar uma transação específica exige ir em /transactions e usar o filtro local. Não há jeito rápido de achar "aquela cobrança do João de março".

## Solução

Input "Pesquisar..." no Navbar. Busca em:
- Transações (descrição, devedor, notas)
- Recebíveis
- Categorias
- Contas
- Cartões
- Recorrências

Atalho `/` ou `Cmd+K` (combinar com UX-11).

### Backend

```python
@strawberry.field
def global_search(
    self, info, query: str, limit: int = 20
) -> GlobalSearchResults:
    user = require_auth(info)
    q = query.strip()
    if len(q) < 2:
        return GlobalSearchResults(transactions=[], categories=[], accounts=[], ...)

    transactions = Transaction.objects.filter(
        user=user,
    ).filter(
        Q(description__icontains=q) |
        Q(debtor_name__icontains=q) |
        Q(notes__icontains=q)
    ).order_by("-date")[:limit]

    categories = Category.objects.filter(user=user, name__icontains=q)[:5]
    accounts = Account.objects.filter(user=user, name__icontains=q)[:5]

    return GlobalSearchResults(...)
```

### UI

Dropdown abaixo do input com grupos:

```
🔎 banco

  TRANSAÇÕES (8)
  ├ Transferência banco Inter - 12/06 - R$ 500
  ├ Pagamento banco fatura - 25/05 - R$ 1.200
  └ Ver todas →

  CONTAS (1)
  └ Banco Inter - R$ 2.430

  CATEGORIAS (0)
```

## Critérios

- [ ] Input no Navbar
- [ ] Atalho `/` foca o input
- [ ] Resultados em grupos
- [ ] Navega para item clicado
- [ ] Debounce 300ms
- [ ] Highlight do termo nos resultados
