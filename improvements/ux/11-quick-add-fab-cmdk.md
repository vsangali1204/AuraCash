# UX-11 — Quick add (FAB mobile / Cmd+K desktop)

**Categoria:** Microinteração / Velocidade
**Estimativa:** Média

## Problema

Para criar nova transação, usuário precisa: ir em /transactions → clicar "Adicionar" → preencher. Muito cliques.

## Solução

### Mobile: Botão flutuante (FAB)

Botão fixo bottom-right, sempre visível. Click abre modal de "Nova transação".

```tsx
<button className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-sky-500 text-white shadow-lg hover:bg-sky-600 sm:hidden">
  <Plus size={24} />
</button>
```

### Desktop: Paleta de comandos (Cmd+K)

```bash
npm i cmdk
```

```tsx
<CommandPalette>
  <CommandPalette.Input placeholder="O que você quer fazer?" />
  <CommandPalette.List>
    <CommandPalette.Group heading="Criar">
      <CommandPalette.Item onSelect={() => openNewTx()}>
        <Plus size={14} /> Nova transação
      </CommandPalette.Item>
      <CommandPalette.Item onSelect={() => openNewRec()}>
        Nova recorrência
      </CommandPalette.Item>
      <CommandPalette.Item onSelect={() => navigateTo("/receivables")}>
        Adicionar a receber
      </CommandPalette.Item>
    </CommandPalette.Group>
    <CommandPalette.Group heading="Navegar">
      <CommandPalette.Item onSelect={() => nav("/dashboard")}>Dashboard</CommandPalette.Item>
      <CommandPalette.Item onSelect={() => nav("/accounts")}>Contas</CommandPalette.Item>
      ...
    </CommandPalette.Group>
    <CommandPalette.Group heading="Pesquisar">
      {results.map(r => <CommandPalette.Item ...>)}
    </CommandPalette.Group>
  </CommandPalette.List>
</CommandPalette>
```

Trigger com `Cmd+K` / `Ctrl+K`:

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen(true);
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

## Critérios

- [ ] FAB no mobile
- [ ] Cmd+K no desktop
- [ ] Lista contextual de comandos
- [ ] Busca fuzzy
- [ ] Atalhos rápidos: "n t" → nova transação
