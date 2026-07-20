# UX-01 — Skeleton loading consistente

**Categoria:** UI / Estado de carregamento
**Estimativa:** Baixa

## Problema

Cada componente implementa loading próprio: `<div className="h-24 animate-pulse rounded bg-surface-border" />`. Visual inconsistente.

## Solução

Criar componente `<Skeleton>` reutilizável:

```tsx
// components/ui/Skeleton.tsx
type SkeletonVariant = "card" | "text" | "circle" | "row" | "chart";

export function Skeleton({
  variant = "text",
  className,
  count = 1,
}: { variant?: SkeletonVariant; className?: string; count?: number }) {
  const base = "animate-pulse bg-surface-border rounded";

  const variants = {
    text: "h-4 w-full",
    card: "h-24 w-full rounded-xl",
    circle: "h-10 w-10 rounded-full",
    row: "h-12 w-full rounded-lg",
    chart: "h-44 w-full rounded-xl",
  };

  if (count > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn(base, variants[variant], className)} />
        ))}
      </div>
    );
  }
  return <div className={cn(base, variants[variant], className)} />;
}
```

Uso:

```tsx
{summaryLoading ? <Skeleton variant="card" /> : <SummaryCard ... />}
{txLoading ? <Skeleton variant="row" count={5} /> : transactions.map(...)}
```

## Critérios

- [ ] Componente Skeleton com variantes
- [ ] Substituir todos `animate-pulse` ad-hoc
- [ ] Animação suave (não pulsando bruscamente)
- [ ] Tema dark respeitado
