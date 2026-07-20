# UX-21 — Pull to refresh

**Categoria:** Mobile UX
**Estimativa:** Trivial

## Problema

Em mobile, atualizar dados exige sair e voltar da página. Não-natural.

## Solução

Lib `react-simple-pull-to-refresh`:

```bash
npm i react-simple-pull-to-refresh
```

```tsx
import PullToRefresh from "react-simple-pull-to-refresh";

<PullToRefresh
  onRefresh={async () => {
    await refetch();
    toast.success("Atualizado");
  }}
  pullDownThreshold={70}
  resistance={3}
>
  {/* conteúdo da página */}
</PullToRefresh>
```

### Aplicar em

- /dashboard
- /transactions
- /receivables
- /invoices
- /calendar

### UX

- Indicador visual de "arrasta pra atualizar"
- Spinner enquanto carrega
- Toast de confirmação ao terminar

## Critérios

- [ ] Funciona em listagens principais
- [ ] Threshold sensível (70-80px)
- [ ] Não conflita com scroll
- [ ] Feedback visual claro
- [ ] Apenas em viewport mobile (ou tablet)
