# P2-01 — Substituir `raise Exception` por classes de erro tipadas

**Categoria:** Backend / DX
**Estimativa:** Média

## Problema

35 ocorrências de `raise Exception(...)` no backend. Em GraphQL isso traz problemas:
- Frontend não consegue distinguir 404 de 400 de 403 programaticamente.
- Tracebacks são mascarados igual para tudo (logs ficam piores).
- Sem padronização, mensagens divergem.

## Localização

```
backend/apps/accounts/schema.py: 2
backend/apps/credit_cards/schema.py: 7
backend/apps/receivables/schema.py: 6
backend/apps/users/schema.py: 7
backend/apps/categories/schema.py: 3
backend/apps/transactions/schema.py: 5
backend/apps/recurrences/schema.py: 5
```

## Solução proposta

Criar `backend/shared/errors.py`:

```python
from graphql import GraphQLError


class NotFoundError(GraphQLError):
    def __init__(self, resource: str):
        super().__init__(
            f"{resource} não encontrado(a).",
            extensions={"code": "NOT_FOUND", "resource": resource},
        )


class ValidationError(GraphQLError):
    def __init__(self, message: str, field: str | None = None):
        super().__init__(
            message,
            extensions={"code": "VALIDATION_ERROR", "field": field},
        )


class PermissionError(GraphQLError):
    def __init__(self, message: str = "Sem permissão para esta operação."):
        super().__init__(
            message,
            extensions={"code": "FORBIDDEN"},
        )


class AuthError(GraphQLError):
    def __init__(self, message: str = "Autenticação necessária."):
        super().__init__(
            message,
            extensions={"code": "UNAUTHENTICATED"},
        )
```

Migrar callers:

```python
# Antes:
raise Exception("Lançamento não encontrado.")

# Depois:
from shared.errors import NotFoundError
raise NotFoundError("Lançamento")
```

No frontend, criar helper:

```typescript
function getErrorCode(err: ApolloError): string | undefined {
  return err.graphQLErrors[0]?.extensions?.code as string | undefined;
}

if (getErrorCode(err) === "NOT_FOUND") {
  toast.error("Item não existe mais. Atualizando lista...");
  refetch();
}
```

## Critérios de aceitação

- [ ] Zero `raise Exception(...)` em código de schema
- [ ] Pelo menos 4 classes criadas: NotFound, Validation, Permission, Auth
- [ ] Frontend tem `getErrorCode` ou similar
- [ ] Pelo menos um caso de uso real do code (ex.: NOT_FOUND dispara refetch)

## Riscos / cuidados

- Frontend que parseia mensagem por string vai quebrar — auditar primeiro.
- Strawberry pode reembrulhar GraphQLError; verificar que `extensions.code` chega no cliente.
