# P2-05 — Adicionar suite de testes

**Categoria:** DevOps / Qualidade
**Estimativa:** Alta

## Problema

Não existe diretório de testes em nenhum dos 7 apps Django nem no frontend. Casos de borda críticos (partial payment, parcelamento, recorrência com `start_date` futuro, virada de mês, dia de fechamento) não têm rede de segurança.

## Localização

`backend/apps/*/` — não existe `tests/` em nenhum.
`frontend/src/` — não existe `__tests__/` ou `*.test.tsx`.

## Solução proposta

### Backend

Configurar pytest-django:

```bash
pip install pytest pytest-django pytest-cov factory-boy
```

`backend/pytest.ini`:
```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings
python_files = test_*.py
addopts = --reuse-db --cov=apps --cov-report=term-missing
```

Estrutura por app:

```
backend/apps/transactions/tests/
├── __init__.py
├── conftest.py        # fixtures
├── factories.py       # factory_boy
├── test_models.py
├── test_queries.py
├── test_mutations_create.py
├── test_mutations_update.py
├── test_dashboard.py
└── test_partial_receipt.py
```

Casos prioritários:

1. **Parcelamento** — criar transação 12x R$ 10.50, soma das parcelas = R$ 126.00 com resto na última.
2. **Partial receipt** — receber R$ 30 de R$ 100, original fica quitado, novo recebível de R$ 70 +30 dias.
3. **Recorrência start_date futuro** — não aparece no dashboard antes da data.
4. **Recorrência end_date** — não aparece após end_date.
5. **Pay invoice exato com 0.01 de diferença** — marca como PAID (tolerância).
6. **Pay invoice overpayment** — rejeita (P1-05).
7. **Calendar** — recurrence respeita start/end.
8. **Closing day** — purchase no dia 5 com closing 5 (P1-10).
9. **Business day** — N-ésimo dia útil em meses com fins de semana.

### Frontend

Configurar Vitest + Testing Library:

```bash
npm i -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

`vite.config.ts`:
```typescript
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
}
```

Casos prioritários:
- ReceivablesPage: filtro funciona, PDF gera com período correto
- TransactionsPage: parcelamento divide valores certo
- Formulários: validação Zod

## Critérios de aceitação

- [ ] Pytest configurado, `pytest` roda no backend
- [ ] Vitest configurado, `npm test` roda no frontend
- [ ] Ao menos 1 teste por app no backend
- [ ] Cobertura ≥ 30% inicial (subir gradualmente)
- [ ] CI roda os testes (ver P4-13)

## Riscos / cuidados

- É trabalho grande — fazer em PRs separadas por área.
- Não tentar 100% de cobertura — foque em mutations e regras de negócio.
