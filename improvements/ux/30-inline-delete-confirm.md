# UX-30 — Confirmação inline em vez de modal

**Categoria:** Microinteração
**Estimativa:** Baixa

## Problema

Para qualquer delete, abre modal "Tem certeza?". Modal é pesado: interrompe contexto, requer atenção total.

## Solução

Para ações leves (delete em lista), confirmação inline:

```
Antes:
┌───────────────────────────────┐
│ Uber - R$ 25         [🗑️ ✏️] │
└───────────────────────────────┘

Após clicar delete:
┌────────────────────────────────────┐
│ ⚠️ Deletar?     [Cancelar] [Sim]  │
└────────────────────────────────────┘
```

A linha se transforma. Usuário confirma sem sair do contexto.

```tsx
const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

if (confirmingDelete === tx.id) {
  return (
    <div className="flex items-center justify-between bg-danger-muted px-4 py-2.5">
      <span className="text-sm text-danger">Deletar este lançamento?</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(null)}>
          Cancelar
        </Button>
        <Button size="sm" variant="danger" onClick={() => handleDelete(tx)}>
          Sim
        </Button>
      </div>
    </div>
  );
}
```

## Quando usar inline vs modal

| Cenário | Padrão |
|---|---|
| Deletar 1 transação | Inline |
| Deletar conta com 200 transações | Modal (escopo grande) |
| Deletar em lote | Modal (precisa explicar consequência) |
| Marcar como "pago" | Inline (positivo, baixo risco) |
| Restaurar | Inline |

## Critérios

- [ ] Padrão inline implementado
- [ ] Modal mantido para ações com escopo grande
- [ ] Esc cancela
- [ ] Animação suave (slide ou fade)
- [ ] Acessível com teclado
