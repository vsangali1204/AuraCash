# P1-04 — Refresh token sem rotação (replay attack)

**Categoria:** Backend / Segurança
**Estimativa:** Média

## Problema

A mutation `refresh_token` gera um novo par (access + refresh) mas **não invalida o refresh token antigo**. Isso permite:
- Replay: se um atacante captura um refresh token, pode usá-lo várias vezes até expirar.
- Não há mecanismo de revogar acesso (ex.: usuário troca senha, dispositivos antigos seguem logados).

## Localização

[backend/apps/users/schema.py:94-109](../../backend/apps/users/schema.py)

```python
@strawberry.mutation
def refresh_token(self, refresh_token: str) -> AuthPayload:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise Exception("Refresh token inválido ou expirado.")
    user = User.objects.filter(id=payload["user_id"], is_active=True).first()
    ...
    tokens = generate_tokens(user.id)  # gera novos mas não invalida o antigo
    return AuthPayload(...)
```

## Solução proposta

Opção A (denylist em cache): manter Redis/cache com os `jti` (token IDs) já usados:

```python
# generate_tokens passa a incluir jti único:
import uuid
refresh_payload = {
    "user_id": user_id,
    "type": "refresh",
    "jti": str(uuid.uuid4()),
    ...
}

# refresh_token verifica e adiciona ao denylist:
from django.core.cache import cache

def refresh_token(self, refresh_token: str) -> AuthPayload:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise Exception("Refresh token inválido ou expirado.")

    jti = payload.get("jti")
    if not jti or cache.get(f"jwt_denylist:{jti}"):
        raise Exception("Refresh token revogado.")

    # Marca o atual como usado (TTL = tempo restante até expiração)
    exp = payload["exp"]
    ttl = max(1, int(exp - datetime.now(tz=timezone.utc).timestamp()))
    cache.set(f"jwt_denylist:{jti}", "1", timeout=ttl)

    # Gera novos
    user = User.objects.filter(id=payload["user_id"], is_active=True).first()
    if not user:
        raise Exception("Usuário não encontrado.")
    tokens = generate_tokens(user.id)
    return AuthPayload(...)
```

Opção B (tabela RefreshToken): persistir refresh tokens no banco com flag `is_revoked`. Mais robusto mas exige migração.

## Critérios de aceitação

- [ ] Refresh token usado uma vez não pode ser usado de novo
- [ ] (Bônus) Mutation `logout` que adiciona o refresh atual ao denylist
- [ ] (Bônus) Mutation `logout_all_devices` que revoga todos do usuário (alterar uma `token_version` no User e incluir no payload)
- [ ] Teste: usar refresh duas vezes seguidas → segunda chamada falha

## Riscos / cuidados

- Cache distribuído necessário em produção (Redis), não memory cache.
- TTL precisa cobrir a expiração do token para o denylist não vazar segurança.
