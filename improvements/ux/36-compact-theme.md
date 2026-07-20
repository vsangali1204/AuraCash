# UX-36 — Tema "compact" para power users

**Categoria:** UI / Customização
**Estimativa:** Baixa

## Problema

Padding e font-size atuais são confortáveis pra iniciantes, mas pra quem usa muito o app, ocupa muito espaço.

## Solução

Toggle global "Compacto":

```tsx
// Aplica classe no root
<html className={compactMode ? "compact" : ""}>
```

CSS:

```css
.compact {
  --space-1: 0.125rem;  /* era 0.25 */
  --space-2: 0.25rem;
  --space-3: 0.5rem;
  --space-4: 0.75rem;
  --font-base: 13px;     /* era 14 */
  --font-sm: 12px;
}

/* Tailwind respeita via fontSize/spacing extends */
```

Ou aplicar via Tailwind variants:

```tsx
<div className={cn(
  "px-4 py-3 text-sm",
  compact && "px-2 py-1.5 text-xs",
)}>
```

### Aplicar em

- Padding de listas (linhas mais finas)
- Padding de cards
- Font-size global (-1px)
- Ícones (-2px)
- Espaços entre elementos

## Critérios

- [ ] Toggle nas configurações
- [ ] Persistência por usuário
- [ ] Aplica em todas as listagens (não só dashboard)
- [ ] Atalho `Cmd+Shift+D` alterna (opcional)
- [ ] Charts respondem (height menor)

## Considerações

- Cuidado com touch targets em mobile: nunca < 32px.
- Acessibilidade: respeitar `prefers-larger-text`.
