# UX-28 — Drag-and-drop para reagendar

**Categoria:** Microinteração
**Estimativa:** Média

## Problema

Pra mover uma transação de 25/12 pra 28/12, usuário precisa: abrir transação → mudar data → salvar. Cliques.

## Solução

No calendário, arrastar evento pra outro dia. Atualiza `date` da transação/recorrência.

Lib `@dnd-kit/core` (moderna, performática):

```bash
npm i @dnd-kit/core
```

```tsx
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";

function DraggableEvent({ event }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: event.id,
    data: event,
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ transform: ... }}>
      {event.title}
    </div>
  );
}

function DroppableDay({ date, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: date.toISOString(), data: { date } });
  return (
    <div ref={setNodeRef} className={isOver ? "bg-sky-500/10" : ""}>
      {children}
    </div>
  );
}

<DndContext onDragEnd={({ active, over }) => {
  if (over) updateTransactionDate(active.id, over.data.current.date);
}}>
  {/* calendário */}
</DndContext>
```

### Restrições

- Só transações (não invoices fixas)
- Não pode mover pro passado se já foi confirmada
- Recorrência: pergunta "Mover só essa instância ou toda recorrência?"

## Critérios

- [ ] Drag em transações no calendário
- [ ] Visual feedback ao arrastar (ghost)
- [ ] Highlight do dia destino
- [ ] Confirmação antes de salvar mudança grande
- [ ] Funciona em touch (mobile)
