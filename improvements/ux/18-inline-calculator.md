# UX-18 — Calculadora inline no campo valor

**Categoria:** Microinteração
**Estimativa:** Baixa

## Problema

Cenários comuns:
- "Almoço foi R$ 47,80 mais a gorjeta de R$ 5"
- "Conta dividida em 4: R$ 180/4"
- "Dois itens: R$ 23,50 + R$ 18,90"

Hoje o usuário calcula fora (calculadora do celular) e digita o total.

## Solução

Campo de valor aceita expressões aritméticas e avalia ao perder foco:

```tsx
function evalExpression(input: string): number | null {
  // Remove R$, espaços, troca vírgula por ponto
  const sanitized = input.replace(/R\$|\s/g, "").replace(",", ".");
  // Aceita apenas dígitos, ponto e operadores
  if (!/^[\d.+\-*/().]+$/.test(sanitized)) return null;
  try {
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${sanitized})`)();
  } catch {
    return null;
  }
}
```

Comportamento:
- Usuário digita `15+25*3`
- Ao perder foco (blur), avalia: `90`
- Mostra resultado: `R$ 90,00`
- Em caso de erro, mantém input mas highlight vermelho

UI mostrando resultado prévio:
```
Valor
┌──────────────────────────┐
│ 15+25*3                   │
└──────────────────────────┘
  = R$ 90,00  ← preview em tempo real
```

## Segurança

`Function()` com input arbitrário é arriscado. Para 100% seguro, usar lib `expr-eval` ou `mathjs`:

```bash
npm i expr-eval
```

```typescript
import { Parser } from "expr-eval";
const result = Parser.evaluate(sanitized);
```

## Critérios

- [ ] Expressões simples (+, -, *, /, parênteses) funcionam
- [ ] Preview do resultado abaixo do campo
- [ ] Inválido: mostra erro suave, não bloqueia
- [ ] Lib segura (`mathjs` ou `expr-eval`), não `eval()`
- [ ] Aceita formato BR (vírgula como decimal)
