# UX-17 — Atalhos de teclado em forms

**Categoria:** Velocidade
**Estimativa:** Baixa

## Problema

Forms exigem clicar em cada campo. Power users querem fluxo via teclado.

## Solução

### Atalhos em modals

- `Esc` — fecha modal (já deve funcionar, verificar)
- `Cmd+Enter` / `Ctrl+Enter` — submit
- `Tab` / `Shift+Tab` — navegar entre campos
- Datepicker abre ao focar (não precisa clicar no ícone)

### Datepicker via teclado

Quando focado:
- Setas: navegar dias
- `PageUp` / `PageDown`: mês
- `Shift+PageUp/Down`: ano
- `Enter`: selecionar
- Digite "ho" → "hoje", "am" → "amanhã" (heurística)

### Number input

- Setas: incrementa/decrementa em 1
- `Shift+seta`: incrementa em 10
- `Alt+seta`: incrementa em 0.01

## Implementação

```tsx
function useFormShortcuts(submitFn: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submitFn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitFn]);
}
```

Mostrar atalhos na UI (sutil, no rodapé do modal):

```
[Esc] fechar  [⌘ Enter] salvar
```

## Critérios

- [ ] Cmd+Enter submete forms
- [ ] Esc fecha modais
- [ ] Tab order lógico (não pula campos)
- [ ] Datepicker navegável via teclado
- [ ] Indicador visual dos atalhos
- [ ] Documentado em /help (UX-30 etc.)
