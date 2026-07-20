# UX-23 — Gráficos mais ricos (Visx ou ECharts)

**Categoria:** Visualização
**Estimativa:** Alta

## Problema

Recharts é simples mas limitado:
- Tipos faltantes: sankey (fluxo), waterfall (variações), heatmap
- Customização limitada (animações, interações)
- Performance ruim em datasets grandes

## Alternativas

### Visx (Airbnb)
- Mais composable, low-level
- Mais trabalho mas total controle
- React-friendly

### ECharts (Apache)
- Muito feature-rich
- Performance alta
- Visual nativo bom
- Wrapper `echarts-for-react`

### Apex Charts
- Boas animações
- Free, pode bastar pra maioria dos casos

## Recomendação

Migrar gradualmente:
1. Manter Recharts para casos simples (bar, line)
2. Adicionar ECharts para:
   - Sankey: fluxo de caixa por categoria/conta
   - Heatmap: F-18
   - Waterfall: variações de saldo
   - Forecast cone: F-17

## Implementação

```bash
npm i echarts echarts-for-react
```

```tsx
import ReactECharts from "echarts-for-react";

<ReactECharts
  option={{
    series: [{
      type: "sankey",
      data: nodes,  // [{ name: "Salário" }, { name: "Aluguel" }]
      links: links,  // [{ source: "Salário", target: "Aluguel", value: 1500 }]
    }],
  }}
/>
```

## Critérios

- [ ] Decisão sobre lib (Visx vs ECharts)
- [ ] 1-2 gráficos novos implementados (sankey ou waterfall)
- [ ] Performance teste com 1000+ pontos
- [ ] Tema dark/light aplicado
