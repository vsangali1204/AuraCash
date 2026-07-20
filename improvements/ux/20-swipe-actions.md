# UX-20 — Swipe actions em listas (mobile)

**Categoria:** Mobile UX
**Estimativa:** Média

## Problema

Em mobile, para deletar uma transação: tap pra abrir detalhe → menu → confirmar. Lento.

## Solução

Padrão iOS Mail / Gmail: swipe na linha revela ações.

- Swipe para esquerda: ações destrutivas (deletar)
- Swipe para direita: ações positivas (marcar recebido, editar)

```
Antes do swipe:
┌─────────────────────────────────┐
│ Uber - 25/12 - R$ 25,00          │
└─────────────────────────────────┘

Após swipe esquerda:
┌─────────────────────────────────┐
│ Uber - 25/12 - R$ 25,00  [🗑️]   │
└─────────────────────────────────┘
```

## Implementação

Lib `react-swipeable-list`:

```bash
npm i react-swipeable-list
```

```tsx
import { SwipeableList, SwipeableListItem } from "react-swipeable-list";

<SwipeableList>
  {transactions.map(t => (
    <SwipeableListItem
      key={t.id}
      trailingActions={[
        { content: <DeleteAction />, onClick: () => deleteTx(t.id) }
      ]}
      leadingActions={[
        { content: <EditAction />, onClick: () => openEdit(t.id) }
      ]}
    >
      <TransactionRow tx={t} />
    </SwipeableListItem>
  ))}
</SwipeableList>
```

### Cuidados

- Threshold do swipe: 30-50% da largura
- Haptic feedback (UX-22) ao revelar ação
- Botão de confirmação após swipe full (não delete imediato)
- Em desktop, swipe substitui por hover actions

## Critérios

- [ ] Swipe funciona em /transactions
- [ ] Funciona em /receivables (swipe right pra marcar como recebido)
- [ ] Confirmação antes de delete
- [ ] Animação de spring suave
- [ ] Não interfere com scroll vertical
