# UX-37 — Loading de página com identidade visual

**Categoria:** Identidade / Polimento
**Estimativa:** Trivial

## Problema

Loading inicial da aplicação (antes do React montar) é tela branca/escura ou um spinner genérico. Perde oportunidade de transmitir marca.

## Solução

### Splash screen (initial load)

`index.html` mostra logo + gradient antes do JS carregar:

```html
<body>
  <div id="splash">
    <div class="splash-logo">AuraCash</div>
    <div class="splash-spinner"></div>
  </div>
  <div id="root"></div>
  <script>
    // Quando React monta, remove splash
    const splash = document.getElementById("splash");
    const root = document.getElementById("root");
    new MutationObserver(() => {
      if (root.children.length > 0) {
        splash.style.opacity = 0;
        setTimeout(() => splash.remove(), 300);
      }
    }).observe(root, { childList: true });
  </script>
</body>

<style>
#splash {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #13131f, #0f0f17);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  transition: opacity 0.3s;
}
.splash-logo {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(90deg, #0ea5e9, #8b5cf6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.splash-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(14, 165, 233, 0.2);
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
```

### Loading em transições de página

Componente `<PageLoader>` reutilizável com mesmo gradient:

```tsx
<div className="flex h-64 items-center justify-center">
  <div className="text-center">
    <div className="mx-auto h-8 w-8 rounded-full border-3 border-sky-500/20 border-t-sky-500 animate-spin" />
    <p className="mt-3 text-xs text-text-secondary">Carregando...</p>
  </div>
</div>
```

## Critérios

- [ ] Splash screen no `index.html` com gradient/logo
- [ ] Transição suave splash → app
- [ ] Componente `<PageLoader>` reutilizável
- [ ] Sem flash branco (cor de fundo já é dark no `<body>`)
- [ ] Funciona offline (SVG/CSS, sem fontes externas)
