# UX-10 — Empty states melhores

**Categoria:** UI
**Estimativa:** Baixa

## Problema

Estados vazios são textos secos:
- "Nenhum lançamento registrado."
- "Sem despesas com categoria este mês."
- "Nenhuma conta cadastrada."

Não orientam o usuário, sem ilustração, sem CTA claro.

## Solução

Componente `<EmptyState>`:

```tsx
type EmptyStateProps = {
  icon?: ReactNode;
  illustration?: ReactNode;  // SVG opcional
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; to?: string };
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-12">
      {icon && <div className="mb-4 text-text-muted opacity-50">{icon}</div>}
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-text-secondary">{description}</p>}
      {action && (
        <Button className="mt-6" onClick={action.onClick} as={action.to ? Link : "button"} to={action.to}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

Uso:

```tsx
<EmptyState
  icon={<Wallet size={56} />}
  title="Nenhuma conta cadastrada"
  description="Cadastre sua primeira conta para começar a acompanhar suas finanças."
  action={{ label: "Criar conta", onClick: () => setModalOpen(true) }}
/>
```

## Para cada empty state

| Lugar | Título | CTA |
|---|---|---|
| Sem transações | "Sem lançamentos por aqui" | "Adicionar primeira" |
| Sem categorias | "Vamos categorizar?" | "Criar categoria" |
| Sem recorrências | "Automatize seu mês" | "Criar recorrência" |
| Sem cartões | "Adicione seu primeiro cartão" | "Cadastrar cartão" |
| Sem recebíveis | "Tudo em dia!" | (sem CTA) |

## Critérios

- [ ] Componente EmptyState reusável
- [ ] Aplicado em todos os empty states
- [ ] Ilustrações ou ícones grandes
- [ ] CTA quando aplicável
- [ ] Tom amigável, em pt-BR
