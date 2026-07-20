# F-12 — Categorização automática

**Categoria:** Funcionalidade / ML leve
**Estimativa:** Média
**Valor pro usuário:** Alto

## O que é

Ao criar transação, sugerir categoria automaticamente com base no histórico do usuário.

Ex.: "Uber" → "Transporte"; "Padaria do João" → "Alimentação"; "Spotify" → "Lazer".

## Abordagem

Não precisa ML pesado. Algoritmo simples funciona bem:

### Opção A — Regra exata + fuzzy

```python
def suggest_category(user, description: str) -> tuple[Category, float] | None:
    desc_norm = normalize(description)  # lowercase, trim, sem acento

    # 1. Match exato no histórico
    exact = Transaction.objects.filter(
        user=user, description__iexact=description, category__isnull=False
    ).order_by("-date").first()
    if exact:
        return (exact.category, 1.0)

    # 2. Fuzzy (postgres trigram ou rapidfuzz)
    from rapidfuzz import process
    candidates = Transaction.objects.filter(
        user=user, category__isnull=False
    ).values_list("description", "category_id").distinct()
    matches = process.extract(
        desc_norm,
        [normalize(d) for d, _ in candidates],
        limit=5,
    )
    # Pondera por score + frequência
    ...
```

### Opção B — Aprendizado de regras

`CategoryRule` configurável:
```python
class CategoryRule(models.Model):
    user = FK(User)
    pattern = CharField  # regex ou substring
    match_type = CharField  # contains, exact, regex
    target_category = FK(Category)
    priority = Int
```

Sugestão tenta regras primeiro, depois fuzzy.

## UI

- No form de transação, ao perder foco do campo "Descrição", chamar query `suggest_category` e pré-preencher
- Mostrar "Sugerido automaticamente" abaixo do campo
- Botão "Criar regra" → "Sempre categorizar 'Uber*' como Transporte"

## Critérios de aceitação

- [ ] Backend retorna sugestão com confidence score
- [ ] Frontend pré-preenche se confidence > 0.7
- [ ] Pode aceitar ou trocar sem fricção
- [ ] CategoryRule editável pelo usuário
- [ ] Importação (F-03) usa o mesmo motor para sugerir em batch

## Considerações

- Performance: cache de embeddings/normalizações.
- Privacidade: tudo on-premise, sem ML externo.
- Cuidar de viés: se o usuário começou errando, vai sempre sugerir errado. Permitir "esquecer histórico" por descrição.
