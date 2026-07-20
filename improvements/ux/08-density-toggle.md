# UX-08 — Densidade ajustável

**Categoria:** UI
**Estimativa:** Baixa

## Problema

Padding fixo em listas. Power users querem ver mais itens por tela; iniciantes preferem mais respiro.

## Solução

Toggle "Compacto / Confortável" nas configurações ou na própria listagem:

```tsx
type Density = "compact" | "comfortable";

const DENSITY_CLASSES = {
  compact: { row: "py-1.5 px-2 text-sm", icon: 12 },
  comfortable: { row: "py-3 px-4 text-base", icon: 16 },
};
```

Persistir em localStorage / preferência do usuário.

## UI

- Toggle no header da listagem (Transações, Recebíveis, Faturas)
- Ícone com 2/3 linhas estilizado
- Aplicar a todas as listas se for global

## Critérios

- [ ] Toggle funcional
- [ ] Persiste por sessão (localStorage) ou usuário (backend)
- [ ] Aplica em todas as listas longas
- [ ] Acessível via menu (não escondido)
