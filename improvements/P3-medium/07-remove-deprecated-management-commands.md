# P3-07 — Remover management commands one-off

**Categoria:** Backend / Cleanup
**Estimativa:** Trivial

## Problema

Management commands criados para migração pontual ficam no repo depois de executados, causando confusão.

## Localização

- `backend/apps/credit_cards/management/commands/fix_nubank_faturas.py` (mencionado em commit `714601b`)
- `backend/apps/receivables/management/commands/fix_debtor_names.py` (existe no projeto)

Confirmar com `find backend -path "*/management/commands/*" -name "*.py"`.

## Solução proposta

Para cada comando one-off:

1. Confirmar com o owner se já foi executado em produção.
2. Se sim, deletar o arquivo.
3. Se ainda é útil, renomear para deixar claro que é manutenção (ex.: `_fix_nubank_faturas_2026.py` ou mover para `scripts/oneoff/`).
4. Adicionar README em `scripts/oneoff/` documentando data de execução de cada um.

Para a mutation `migrate_partial_receivables` (também é one-off):
- Mesmo tratamento. Após executar, marcar como deprecated ou remover.

## Critérios de aceitação

- [ ] Comandos confirmados como executados foram removidos
- [ ] Os mantidos têm comentário explicando contexto
- [ ] (Opcional) Pasta `scripts/oneoff/` com README documentando histórico

## Riscos / cuidados

- Não remover se tiver chance de precisar rodar de novo (ex.: novos usuários podem ter dados antigos).
