# UX-19 — Bottom sheet em vez de Modal em mobile

**Categoria:** Mobile UX
**Estimativa:** Média

## Problema

`<Modal>` ocupa tela inteira em mobile e cobre tudo, isolando o usuário. Bottom sheet (puxa de baixo) é padrão mobile moderno: mantém contexto, mais ergonômico (polegar alcança).

## Solução

Lib `vaul` (do criador do Sonner) é leve e bem feita:

```bash
npm i vaul
```

```tsx
import { Drawer } from "vaul";

export function BottomSheet({ open, onClose, children, title }) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl bg-surface-card">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-surface-border" /> {/* handle */}
          <div className="px-4 py-3">
            <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
            <div className="mt-4">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

Decisão: usar Bottom sheet só em mobile, Modal em desktop. Componente híbrido:

```tsx
export function ResponsiveDialog({ ...props }) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  return isMobile ? <BottomSheet {...props} /> : <Modal {...props} />;
}
```

## Critérios

- [ ] Lib `vaul` instalada
- [ ] Componente `<ResponsiveDialog>` que escolhe sheet/modal pelo viewport
- [ ] Swipe down para fechar
- [ ] Handle visual no topo do sheet
- [ ] Animação suave
- [ ] Todos os modals existentes migrados (Transações, Recebíveis, etc.)

## Considerações

- Memória do feedback do usuário (preferências UI já definidas): "sempre Modal" como decisão.
  Esse item propõe **adicionar** sheet só em mobile pela ergonomia. Validar com usuário antes.
