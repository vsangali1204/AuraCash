# UX-22 — Sticky header com saldo

**Categoria:** UI
**Estimativa:** Trivial

## Problema

Saldo total fica no topo da página e some quando o usuário rola. Em listas longas, perde-se a referência.

## Solução

Header com saldo fica `position: sticky` ou cria mini-header colapsado quando scroll passa de threshold.

```tsx
const [scrolled, setScrolled] = useState(false);

useEffect(() => {
  const onScroll = () => setScrolled(window.scrollY > 100);
  window.addEventListener("scroll", onScroll);
  return () => window.removeEventListener("scroll", onScroll);
}, []);

return (
  <>
    {scrolled && (
      <div className="fixed top-0 left-0 right-0 z-40 bg-surface-card/95 backdrop-blur border-b border-surface-border px-4 py-2 transition-all">
        <p className="text-xs text-text-secondary">Saldo</p>
        <p className="text-base font-semibold">{formatCurrency(totalBalance)}</p>
      </div>
    )}
    {/* resto da página */}
  </>
);
```

Animação de entrada (slide down).

### Variação

Em mobile, pode ser barra fina no topo com só o número e variação:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 R$ 4.230   📈 +2.3%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Critérios

- [ ] Aparece ao rolar para baixo
- [ ] Some ao voltar pro topo
- [ ] Backdrop blur pra não tampar
- [ ] Não conflita com Navbar
- [ ] Aplicar em dashboard, /receivables (saldo a receber)
