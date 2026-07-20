# UX-29 — Toast com ação de desfazer

**Categoria:** Microinteração / Segurança
**Estimativa:** Baixa

## Problema

Deletar item gera modal de confirmação. Funciona mas é fricção em ações que o usuário faz muito.

Padrão moderno: deletar imediato + toast "Desfazer" por 5s. Acelera sem perder reversibilidade.

## Solução

Pré-requisito: soft delete (F-30 / Audit log).

```tsx
async function handleDelete(tx: Transaction) {
  await deleteTransaction({ variables: { id: tx.id } });

  toast(
    (t) => (
      <div className="flex items-center gap-3">
        <span>Lançamento deletado</span>
        <button
          onClick={async () => {
            await undoDelete({ variables: { id: tx.id } });
            toast.dismiss(t.id);
            toast.success("Restaurado");
          }}
          className="text-sky-400 font-medium"
        >
          Desfazer
        </button>
      </div>
    ),
    { duration: 5000 }
  );
}
```

### Aplicar em

- Deletar transação
- Deletar recebível
- Deletar categoria (cuidado: se já tem transações associadas)
- Mudar categoria em lote
- Marcar recebido (undo desfaz o receipt)

### Visual

Manter o item visível na lista (opacity 0.5, ícone tachado) durante os 5s. Se "Desfazer", restaura visual. Se passar 5s, some.

## Critérios

- [ ] Soft delete implementado
- [ ] Toast com botão "Desfazer"
- [ ] Item fica em estado "deletando" por 5s
- [ ] Pode desfazer mesmo após dismiss do toast (página de histórico/lixeira)
- [ ] Funciona em mobile
