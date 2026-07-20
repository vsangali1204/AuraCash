# F-10 — Workspace compartilhado (multiusuário)

**Categoria:** Funcionalidade / Arquitetura
**Estimativa:** Muito alta
**Valor pro usuário:** Alto (casais/famílias)

## O que é

Hoje todo dado é por `user`. Permitir conta compartilhada: 2+ usuários no mesmo workspace, com transações próprias e compartilhadas.

Caso de uso: casal compartilha aluguel, mercado, conta conjunta — mas cada um tem seu cartão e despesas pessoais.

## Mudança arquitetural

Introduzir `Workspace`:

```python
class Workspace(models.Model):
    name = CharField
    owner = FK(User)
    created_at = DateTime

class WorkspaceMember(models.Model):
    class Role(TextChoices):
        OWNER = "owner"
        ADMIN = "admin"
        MEMBER = "member"
        VIEWER = "viewer"

    workspace = FK(Workspace)
    user = FK(User)
    role = CharField(choices=Role)
    joined_at = DateTime

    class Meta:
        unique_together = [("workspace", "user")]
```

Em todos os modelos com `user`, **adicionar** `workspace`:

```python
class Transaction(...):
    user = FK(User)           # criador (mantém)
    workspace = FK(Workspace) # contexto
    is_shared = Bool(default=False)  # se False, só o criador vê
```

Auth context resolve workspace ativo (header `X-Workspace-Id` ou JWT claim).

## Funcionalidades

1. Convite por email
2. Aceitar/recusar convite
3. Listar membros, mudar role
4. Toggle "Compartilhar com workspace" em cada lançamento
5. Filtro "Meu / Compartilhado / Tudo"
6. Auditoria: quem criou/editou cada item

## UI

- Seletor de workspace no header (avatar com dropdown)
- Cada transação tem badge "Compartilhado" ou "Pessoal"
- Configurações > Workspace: membros, convites

## Critérios de aceitação

- [ ] Migration adiciona workspace a todos os modelos
- [ ] User cria conta → workspace pessoal automático
- [ ] Convite por email funciona
- [ ] RLS: usuário só vê o que tem acesso
- [ ] Toggle de compartilhamento por transação
- [ ] Audit log de mudanças em itens compartilhados

## Considerações

- **Migração massiva**: todos os dados existentes vão para workspace = user.personal_workspace
- **Privacidade**: opção de "ocultar valor" para membros viewer
- **Atomic ops**: criar workspace deve criar membership owner numa transação
- **Subscription**: workspace compartilhado pode ser feature premium
