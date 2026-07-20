# F-15 — Insights mensais automáticos

**Categoria:** Funcionalidade
**Estimativa:** Média
**Valor pro usuário:** Alto

## O que é

Texto/cards curtos com observações inteligentes sobre o mês:
- "Você gastou 23% a mais em Restaurantes que mês passado."
- "Sua reserva cresceu R$ 850 este mês — meta a caminho 🎯"
- "Salário caiu na mesma data que outubro — quer criar recorrência?"
- "67% dos seus gastos com Lazer foram em fim de semana."

Estilo Spotify Wrapped, mas mensal.

## Implementação

Cada insight é uma função que recebe contexto e retorna `Insight | None`:

```python
@dataclass
class Insight:
    title: str
    body: str
    icon: str
    severity: str  # info, success, warning
    link: Optional[str]  # navegação
    weight: int  # quanto mais alto, mais relevante


def insight_category_growth(user, year, month) -> Insight | None:
    current = expenses_by_cat(user, year, month)
    previous = expenses_by_cat(user, prev_year, prev_month)

    # Encontra a categoria com maior aumento %
    biggest_jump = max(
        ((cat, ((current[cat] - previous[cat]) / previous[cat]) * 100)
         for cat in current if cat in previous and previous[cat] > 0),
        key=lambda x: x[1],
        default=None,
    )
    if biggest_jump and biggest_jump[1] > 20:
        return Insight(
            title=f"Aumento em {biggest_jump[0].name}",
            body=f"Você gastou {biggest_jump[1]:.0f}% a mais que mês passado.",
            icon="trending-up",
            severity="warning",
            link=f"/transactions?category={biggest_jump[0].id}",
            weight=biggest_jump[1],
        )
    return None
```

Outros insights úteis:
- Detecção de transação recorrente não cadastrada
- Categoria com gasto fora do normal (vs últimos 6 meses)
- Cobrança duplicada (mesma desc + valor mensal)
- Saldo positivo crescente / decrescente
- Recebível atrasado há mais de X dias
- Limite do cartão muito usado

## UI

- Card no dashboard "Insights do mês" com 3-5 itens
- Carrossel/swipe em mobile
- Cada item tem link para tela relevante
- Permitir "Não mostrar mais este tipo"

## Critérios de aceitação

- [ ] Pelo menos 6 funções de insight implementadas
- [ ] Ordenação por `weight`
- [ ] Card no dashboard
- [ ] Insights persistidos ou recalculados sob demanda
- [ ] Toggle por usuário pra desabilitar

## Considerações

- Pode evoluir para "Coach financeiro" com LLM (mas mantenha versão sem LLM primeiro).
- Cache: insights mudam pouco no dia — recalcular 1x/dia via Celery.
