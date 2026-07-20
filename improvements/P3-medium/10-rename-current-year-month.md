# P3-10 — Renomear `currentYearMonth` para deixar claro que é função

**Categoria:** Frontend / Clareza
**Estimativa:** Trivial

## Problema

```typescript
function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// Uso:
const [navMonth, setNavMonth] = useState(currentYearMonth);  // passa função como initializer
```

Quem lê pode pensar que está chamando a função e passando o objeto. Na verdade está passando a referência da função para o `useState` lazy initializer — comportamento correto, mas confuso.

## Localização

[frontend/src/pages/TransactionsPage.tsx:68-71, 95](../../frontend/src/pages/TransactionsPage.tsx)

Possivelmente em outras páginas.

## Solução proposta

Renomear com prefixo `get`:

```typescript
function getCurrentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

const [navMonth, setNavMonth] = useState(getCurrentYearMonth);
```

Mais explícito que é uma função, e o uso como initializer fica natural.

## Critérios de aceitação

- [ ] Função renomeada com prefixo `get`
- [ ] Buscar outras funções "computadas" sem prefixo (`monthISORangeDates`, etc.) e auditar nomenclatura

## Riscos / cuidados

- Nenhum.
