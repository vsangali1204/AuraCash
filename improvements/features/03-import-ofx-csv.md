# F-03 — Importação de extrato OFX/CSV

**Categoria:** Funcionalidade core / Integração
**Estimativa:** Alta
**Valor pro usuário:** **MUITO ALTO** — é o feature mais pedido em apps financeiros

## O que é

Upload de arquivo OFX (padrão bancário) ou CSV. Sistema parseia, mostra preview, sugere categorização (com base no histórico), permite editar e confirma em lote.

## Fluxo

1. Tela `/import` com área de drop
2. Detecta formato (OFX, CSV)
3. Parse:
   - OFX: lib `ofxparse` no Python
   - CSV: aceitar formatos comuns (Nubank, Itaú, Bradesco) com mapeamento configurável
4. Para cada linha:
   - Match com transação existente (mesma data + valor) → marca como "já cadastrado"
   - Sem match → sugere categoria com base em descrições similares
5. Tela de preview: tabela editável
6. Botão "Importar X transações"

## Backend

```python
@strawberry.mutation
def import_statement(
    self, info, file: Upload, account_id: ID, format: str
) -> ImportPreview:
    # Parse → retorna preview sem persistir
    ...

@strawberry.mutation
def confirm_import(
    self, info, transactions: list[ImportedTransactionInput]
) -> int:
    # Cria em lote dentro de @transaction.atomic
    ...
```

## Modelo

```python
class ImportBatch(models.Model):
    user = FK(User)
    account = FK(Account)
    file_name = CharField
    imported_at = DateTime
    transaction_count = Int

# Cada Transaction ganha:
class Transaction(...):
    import_batch = FK(ImportBatch, null=True)  # permite "desfazer importação"
    external_id = CharField(null=True)  # ID do banco, evita duplicata
```

## Categorização sugerida

Algoritmo simples:
1. Procura transações do usuário com descrição similar (`SIMILARITY` Postgres ou fuzzy match)
2. Pega a categoria mais comum
3. Confidence score; usuário pode aceitar/rejeitar

## Critérios de aceitação

- [ ] OFX parsing com lib madura
- [ ] CSV com mapeamento configurável (data, descrição, valor)
- [ ] Detecção de duplicatas (`external_id` ou heurística)
- [ ] Categorização sugerida com confidence ≥ 60% pré-marca
- [ ] Botão "Desfazer importação" remove todas as transações do batch
- [ ] Suporta importação parcial (usuário desmarca linhas)

## Considerações

- Cuidado com fuso horário em OFX (UTC vs local).
- Saldo inicial: se OFX traz, comparar com `Account.initial_balance` e alertar divergência.
- Performance: 1000+ linhas exige paginação no preview.
