# P3-08 — Padronizar mensagens de erro

**Categoria:** Backend / UX
**Estimativa:** Baixa

## Problema

Mensagens inconsistentes:
- "Lançamento não encontrado."
- "Conta não encontrada."
- "Conta destino não encontrada."
- "Cartão de crédito não encontrado."
- "Cartão não encontrado." (variação)
- "Fatura não encontrada."
- "Lançamento a receber não encontrado."

Capitalização, terminologia, pontuação variam.

## Localização

Todos os schemas (`grep "raise Exception" backend/apps`).

## Solução proposta

Combinar com P2-01 (error classes). Centralizar em `backend/shared/errors.py`:

```python
RESOURCE_LABELS = {
    "transaction": "Lançamento",
    "account": "Conta",
    "credit_card": "Cartão",
    "invoice": "Fatura",
    "receivable": "Recebível",
    "receipt": "Recebimento",
    "category": "Categoria",
    "recurrence": "Recorrência",
}


class NotFoundError(GraphQLError):
    def __init__(self, resource: str):
        label = RESOURCE_LABELS.get(resource, resource.capitalize())
        super().__init__(
            f"{label} não encontrado(a).",
            extensions={"code": "NOT_FOUND", "resource": resource},
        )
```

Uso:

```python
raise NotFoundError("transaction")  # → "Lançamento não encontrado(a)."
raise NotFoundError("account")      # → "Conta não encontrado(a)."
```

Gênero pode ser ajustado por dicionário de gênero se quiser perfeito:

```python
RESOURCE_LABELS = {
    "transaction": ("Lançamento", "o"),
    "account": ("Conta", "a"),
    ...
}

def __init__(self, resource: str):
    label, art = RESOURCE_LABELS.get(resource, (resource, "o"))
    suffix = "encontrada" if art == "a" else "encontrado"
    super().__init__(f"{label} não {suffix}.", ...)
```

## Critérios de aceitação

- [ ] Mensagens de "não encontrado" usam o mesmo padrão
- [ ] Gênero correto (ou neutro padronizado)
- [ ] Pontuação final consistente
- [ ] Auditar outras categorias de erro (validação, permissão)

## Riscos / cuidados

- Frontend pode estar fazendo match exato em string — auditar antes.
