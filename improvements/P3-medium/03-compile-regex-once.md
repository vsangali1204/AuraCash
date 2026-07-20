# P3-03 — Compilar regex de installment uma vez

**Categoria:** Backend / Performance micro
**Estimativa:** Trivial

## Problema

`_get_base_description` faz `re.match` em toda chamada com regex literal. Em propagação de installments, é chamado N vezes por update.

## Localização

[backend/apps/transactions/schema.py:719-722](../../backend/apps/transactions/schema.py)

```python
def _get_base_description(desc: str) -> str:
    import re
    m = re.match(r"^(.*)\s+\(\d+/\d+\)$", desc)
    return m.group(1) if m else desc
```

## Solução proposta

```python
import re

_INSTALLMENT_SUFFIX_RE = re.compile(r"^(.*)\s+\(\d+/\d+\)$")


def _get_base_description(desc: str) -> str:
    m = _INSTALLMENT_SUFFIX_RE.match(desc)
    return m.group(1) if m else desc
```

`re.match` já tem cache interno, então o ganho real é pequeno — mas o código fica mais limpo e explícito sobre a intenção.

## Critérios de aceitação

- [ ] Regex compilado no nível do módulo
- [ ] `import re` no topo, não dentro da função
- [ ] Comportamento idêntico

## Riscos / cuidados

- Nenhum.
