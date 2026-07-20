# P1-06 — update_recurrence silencia conta inválida

**Categoria:** Backend / Robustez
**Estimativa:** Baixa

## Problema

Se o usuário passar um `account_id` que não pertence a ele (ou que não existe), a mutation simplesmente ignora a atualização e a recorrência continua com a conta antiga. Sem erro, sem feedback. O frontend acha que deu certo.

Mesmo problema com `category_id`.

## Localização

[backend/apps/recurrences/schema.py:198-215](../../backend/apps/recurrences/schema.py)

```python
if input.account_id is not None:
    acc = Account.objects.filter(id=input.account_id, user=user).first()
    if acc:                     # ← se não acha, ignora silenciosamente
        rec.account = acc
...
if input.category_id is not None:
    rec.category = Category.objects.filter(id=input.category_id, user=user).first()
    # ← se não acha, .first() retorna None e sobrescreve a categoria atual!
```

A category é pior: sobrescreve com None.

## Solução proposta

```python
if input.account_id is not None:
    acc = Account.objects.filter(id=input.account_id, user=user).first()
    if not acc:
        raise Exception("Conta não encontrada.")
    rec.account = acc

if input.category_id is not None:
    cat = Category.objects.filter(id=input.category_id, user=user).first()
    if not cat:
        raise Exception("Categoria não encontrada.")
    rec.category = cat
```

Se a intenção é permitir "limpar categoria" passando string vazia ou null, usar `strawberry.UNSET` como já é feito em `end_date`:

```python
category_id: Optional[strawberry.ID] = strawberry.UNSET

if input.category_id is not strawberry.UNSET:
    if input.category_id is None:
        rec.category = None
    else:
        cat = Category.objects.filter(id=input.category_id, user=user).first()
        if not cat:
            raise Exception("Categoria não encontrada.")
        rec.category = cat
```

## Critérios de aceitação

- [ ] ID inválido em `account_id` → erro claro
- [ ] ID inválido em `category_id` → erro claro (não sobrescreve com None silenciosamente)
- [ ] `account_id` continua não permitindo None (modelo é NOT NULL)
- [ ] `category_id` permite None se a intenção for limpar — usar UNSET para distinguir "não passou" de "passou null"
- [ ] Mesma análise em `update_transaction`, `update_credit_card`, `update_account` (mesmo padrão)

## Riscos / cuidados

- Mudança de comportamento — frontend pode estar enviando IDs incorretos sem perceber. Validar antes de deployar.
