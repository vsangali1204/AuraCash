# UX-32 — Haptic feedback em mobile

**Categoria:** Microinteração mobile
**Estimativa:** Trivial

## Problema

Em ações importantes (deletar, confirmar pagamento), nenhum feedback tátil em mobile. Sensação "barata".

## Solução

API `navigator.vibrate()`:

```typescript
// lib/haptic.ts
export const haptic = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(20),
  heavy: () => navigator.vibrate?.(50),
  success: () => navigator.vibrate?.([10, 30, 10]),
  warning: () => navigator.vibrate?.([20, 50, 20]),
  error: () => navigator.vibrate?.([50, 100, 50]),
};
```

Uso:

```tsx
async function handleDelete() {
  haptic.warning();
  if (await confirm()) {
    await deleteTx();
    haptic.success();
  }
}
```

### Quando usar

- **light**: hover/tap em itens
- **medium**: ação confirmada (botão padrão)
- **heavy**: ação destrutiva
- **success**: pagamento confirmado, recebido
- **error**: erro de validação

## Detecção e desativação

```typescript
export function isHapticAvailable(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}
```

Toggle nas configurações: "Vibração nas ações" (default on em mobile, off em desktop).

## Critérios

- [ ] Lib `haptic` criada
- [ ] Aplicado em ações principais
- [ ] Configurável pelo usuário
- [ ] Não vibra em desktop (mesmo se browser suportar)
