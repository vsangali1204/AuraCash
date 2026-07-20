# UX-06 — Light mode

**Categoria:** Design system
**Estimativa:** Média-alta

## Problema

App é 100% dark. Alguns usuários preferem light, ou alternam com base no horário.

## Pré-requisito

Tokens semânticos (UX-03) implementados.

## Solução

CSS variables por tema, alternadas via `class` no `<html>`:

```css
/* index.css */
:root {
  --color-bg: #ffffff;
  --color-card: #f9fafb;
  --color-border: #e5e7eb;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
}

.dark {
  --color-bg: #0f0f17;
  --color-card: #13131f;
  --color-border: #2a2a3a;
  --color-text-primary: #ffffff;
  --color-text-secondary: #a0a0b0;
}
```

`tailwind.config.js`:

```javascript
darkMode: "class",
theme: {
  extend: {
    colors: {
      bg: "var(--color-bg)",
      card: "var(--color-card)",
      border: "var(--color-border)",
      "text-primary": "var(--color-text-primary)",
      // ...
    },
  },
},
```

Toggle:

```tsx
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    () => localStorage.getItem("theme") as any || "system"
  );

  useEffect(() => {
    const actual = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.classList.toggle("dark", actual === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
```

## Toggle UI

Ícone sol/lua no Navbar. Dropdown com: Light / Dark / System.

## Critérios

- [ ] Tokens migrados para CSS variables
- [ ] Toggle no header
- [ ] Respeita preferência do SO se "system"
- [ ] Sem flicker no load (script `<head>` aplica classe antes do React montar)
- [ ] Charts (Recharts) também respeitam tema
