# P3-09 — Apollo errorLink global

**Categoria:** Frontend / DX
**Estimativa:** Baixa

## Problema

Cada `useMutation` no frontend tem seu próprio `onError` chamando `toast.error("...")`. Duplicação massiva, fácil esquecer em alguns lugares, e nada centraliza tratamento de erros transversais (sessão expirada, network down).

## Localização

Procurar `onError` no frontend:
```bash
grep -r "onError" frontend/src --include="*.tsx" --include="*.ts"
```

## Solução proposta

Adicionar `errorLink` no Apollo Client:

```typescript
// frontend/src/apollo/client.ts
import { ApolloClient, InMemoryCache, ApolloLink, HttpLink } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import toast from "react-hot-toast";

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const code = err.extensions?.code as string | undefined;

      // Sessão expirada → redireciona pra login
      if (code === "UNAUTHENTICATED") {
        // limpa token, redireciona
        localStorage.removeItem("access_token");
        window.location.href = "/login";
        return;
      }

      // Validação → o componente trata
      if (code === "VALIDATION_ERROR") {
        return;
      }

      // Outros → toast
      toast.error(err.message);
    }
  }

  if (networkError) {
    toast.error("Erro de conexão. Verifique sua internet.");
  }
});

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_API_URL,
});

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});
```

Nos componentes, remover `onError` redundantes:

```typescript
// Antes:
const [deleteTx] = useMutation(DELETE_TRANSACTION_MUTATION, {
  onError: (err) => toast.error(err.message),
});

// Depois:
const [deleteTx] = useMutation(DELETE_TRANSACTION_MUTATION);
```

`onError` local fica só para casos especiais (ex.: refetch específico).

## Critérios de aceitação

- [ ] errorLink configurado e funcional
- [ ] Sessão expirada redireciona para login
- [ ] `toast.error` redundante removido dos componentes
- [ ] Erros de validação não geram toast (component decide)

## Riscos / cuidados

- Combinar com P2-01 (error codes) — sem eles, não dá pra diferenciar erros no link.
