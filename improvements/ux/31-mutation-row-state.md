# UX-31 — Estado visual da linha durante mutation

**Categoria:** Microinteração
**Estimativa:** Trivial

## Problema

Ao clicar "Salvar" ou "Deletar", a linha continua igual até a refetch completar. Usuário fica em dúvida se foi.

## Solução

Linha em mutation ganha estado visual:

```tsx
function TransactionRow({ tx, mutating }: { tx: Transaction; mutating?: boolean }) {
  return (
    <div className={cn(
      "flex items-center...",
      mutating && "opacity-50 pointer-events-none animate-pulse",
    )}>
      {mutating && <Loader2 className="absolute right-3 animate-spin" size={14} />}
      ...
    </div>
  );
}
```

### Optimistic UI

Aliado a mutations otimistas:

```tsx
const [deleteTx] = useMutation(DELETE_TRANSACTION_MUTATION, {
  optimisticResponse: { deleteTransaction: true },
  update: (cache, { data }) => {
    if (data?.deleteTransaction) {
      cache.modify({
        fields: {
          transactions: (existing, { readField }) =>
            existing.filter(ref => readField("id", ref) !== tx.id)
        }
      });
    }
  },
});
```

Item some imediatamente da lista (visualmente) e só "volta" se houver erro.

## Critérios

- [ ] Optimistic update em delete/edit
- [ ] Linha pulsa enquanto mutation roda
- [ ] Erro restaura linha + toast
- [ ] Aplicar em todas as listagens
