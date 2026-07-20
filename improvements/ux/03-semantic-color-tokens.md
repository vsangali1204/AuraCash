# UX-03 — Tokens semânticos de cor

**Categoria:** Design system
**Estimativa:** Média

## Problema

Cores espalhadas hardcoded: `text-emerald-400`, `bg-red-500/10`, `#13131f`. Difícil de manter, impossível trocar tema.

## Solução

Definir tokens semânticos em `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      // Tokens semânticos
      success: { DEFAULT: "#10b981", muted: "rgba(16, 185, 129, 0.15)" },
      danger:  { DEFAULT: "#ef4444", muted: "rgba(239, 68, 68, 0.15)" },
      warning: { DEFAULT: "#f59e0b", muted: "rgba(245, 158, 11, 0.15)" },
      info:    { DEFAULT: "#0ea5e9", muted: "rgba(14, 165, 233, 0.15)" },

      // Surface
      surface: {
        bg: "#0f0f17",
        card: "#13131f",
        hover: "#1a1a28",
        border: "#2a2a3a",
      },

      // Text
      text: {
        primary: "#ffffff",
        secondary: "#a0a0b0",
        muted: "#6b7280",
      },
    },
  },
}
```

Migrar usos:

```tsx
// Antes
className="text-emerald-400 bg-emerald-500/10"

// Depois
className="text-success bg-success-muted"
```

## Critérios

- [ ] Tokens em `tailwind.config.js`
- [ ] Auditoria de cores hardcoded
- [ ] Migração ao menos no Dashboard e cards de resumo
- [ ] Base preparada para light mode (UX-06)
