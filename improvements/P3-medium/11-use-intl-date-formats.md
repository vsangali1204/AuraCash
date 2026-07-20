# P3-11 — Usar Intl.DateTimeFormat em vez de split manual

**Categoria:** Frontend / Robustez
**Estimativa:** Trivial

## Problema

`formatDate` e `formatMonthYear` fazem split manual em "-":

```typescript
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export function formatMonthYear(dateStr: string): string {
  const [year, month] = dateStr.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(month) - 1]}/${year}`;
}
```

Problemas:
- Se entrada vier em outro formato, quebra silenciosamente.
- `parseInt(month)` aceita "01abc" e retorna 1.
- Reinventa o que `Intl` faz nativamente, com risco maior.

## Localização

[frontend/src/lib/utils.ts:16-25](../../frontend/src/lib/utils.ts)

## Solução proposta

```typescript
const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
});

const MONTH_YEAR_FMT = new Intl.DateTimeFormat("pt-BR", {
  month: "short", year: "numeric",
});

export function formatDate(dateStr: string): string {
  // Cria date com fuso local (evita off-by-one por UTC)
  const [y, m, d] = dateStr.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

export function formatMonthYear(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return MONTH_YEAR_FMT.format(new Date(y, m - 1, 1));
}
```

**Atenção:** `new Date("2026-03-15")` interpreta como UTC, então em fuso BRT vira 14/03. Use `new Date(y, m-1, d)` que é fuso local.

## Critérios de aceitação

- [ ] Funções usam Intl
- [ ] Sem array hardcoded de meses
- [ ] Teste: `formatDate("2026-03-15")` → "15/03/2026"
- [ ] Teste de fuso: não há off-by-one

## Riscos / cuidados

- `Intl.DateTimeFormat("pt-BR", { month: "short" })` retorna "mar" minúsculo. Se quiser "Mar" capitalize manualmente ou use `month: "narrow"` (M).
