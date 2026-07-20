# UX-35 — Palette curada de cores + ícones para categorias

**Categoria:** UI / Identidade
**Estimativa:** Baixa

## Problema

Hoje categorias têm `color: string` (hex). Usuário escolhe color picker raw — facil escolher cores feias, fora do tema, ou com baixo contraste.

Também não há ícone — só uma cor.

## Solução

### Palette curada

20 cores bonitas, harmonizadas com o tema:

```tsx
const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#64748b", "#71717a", "#737373",
];
```

Picker visual com swatches:

```tsx
<div className="grid grid-cols-10 gap-2">
  {CATEGORY_COLORS.map(c => (
    <button
      key={c}
      onClick={() => setColor(c)}
      className={cn(
        "h-7 w-7 rounded-full border-2",
        color === c ? "border-white" : "border-transparent"
      )}
      style={{ backgroundColor: c }}
    />
  ))}
</div>
```

### Ícone por categoria

`Category.icon` armazena nome do ícone Lucide. Picker com search:

```tsx
import * as Icons from "lucide-react";

const POPULAR_ICONS = [
  "Utensils", "ShoppingCart", "Car", "Home", "Heart",
  "Book", "Gift", "Plane", "Coffee", "Music",
  "Smile", "Briefcase", "DollarSign", "TrendingUp",
];

<IconPicker value={icon} onChange={setIcon} popular={POPULAR_ICONS} />
```

### Backend

```python
class Category(...):
    color = CharField(7)
    icon = CharField(50, null=True, blank=True)  # nome do ícone Lucide
```

### Renderização

```tsx
function CategoryIcon({ category }: { category: Category }) {
  const Icon = (Icons as any)[category.icon ?? "Tag"];
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg"
      style={{ backgroundColor: category.color + "22", color: category.color }}>
      <Icon size={14} />
    </div>
  );
}
```

## Critérios

- [ ] Palette curada de 20 cores
- [ ] Picker de ícone com busca
- [ ] Backend salva `icon`
- [ ] Visualização: ícone+cor em todos os lugares
- [ ] Sugestões de ícones por nome de categoria ("Alimentação" → sugere Utensils)
