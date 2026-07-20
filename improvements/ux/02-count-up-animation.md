# UX-02 — Animação count-up nos cards de resumo

**Categoria:** Microinteração
**Estimativa:** Trivial

## Problema

Cards "Saldo Total", "Receitas", "Despesas", "A Receber" aparecem com o valor já final. Animar de 0 ao valor em 600ms dá sensação de produto premium (estilo Stripe, Linear).

## Solução

```bash
npm i react-countup
```

```tsx
// components/ui/AnimatedNumber.tsx
import CountUp from "react-countup";

export function AnimatedNumber({
  value,
  duration = 0.6,
  prefix = "R$ ",
  decimals = 2,
}: { value: number; duration?: number; prefix?: string; decimals?: number }) {
  return (
    <CountUp
      end={value}
      duration={duration}
      decimals={decimals}
      separator="."
      decimal=","
      prefix={prefix}
      preserveValue
    />
  );
}
```

No SummaryCard, substituir `{formatCurrency(value)}` por:

```tsx
<AnimatedNumber value={value} />
```

## Considerações

- `preserveValue` evita re-animar a cada re-render.
- Em mobile, animação pode ser cara — desabilitar se `prefers-reduced-motion`.

## Critérios

- [ ] Cards de resumo do dashboard com count-up
- [ ] Respeita `prefers-reduced-motion`
- [ ] Sem flicker quando navega entre meses
