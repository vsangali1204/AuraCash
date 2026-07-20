# F-04 — Importação de fatura de cartão (PDF/CSV)

**Categoria:** Funcionalidade
**Estimativa:** Alta
**Valor pro usuário:** Alto

## O que é

Upload de PDF de fatura. Parse → lista de compras → conferência → import.

## Estratégia técnica

- PDFs de cartão geralmente têm texto extraível (`pdfplumber`, `PyMuPDF`)
- Cada banco tem layout próprio: criar parser por banco (Nubank, Itaú, Inter, etc.)
- Identificar bandeira pelo header
- Para PDF escaneado: OCR via `pytesseract`

## Modelo

Reaproveita `ImportBatch` da F-03, mas vinculado a `Invoice`:

```python
class ImportBatch(...):
    invoice = FK(Invoice, null=True)
```

## UI

1. Página da fatura tem botão "Importar PDF"
2. Upload → parse → preview tabela editável
3. Cada linha tem: data, descrição, valor, categoria sugerida
4. Confirmação cria N `Transaction` na invoice

## Parser

Estrutura plugável:

```python
# apps/credit_cards/parsers/base.py
class InvoiceParser(ABC):
    bank_name: str
    @abstractmethod
    def can_parse(self, text: str) -> bool: ...
    @abstractmethod
    def parse(self, text: str) -> list[ParsedTransaction]: ...

# apps/credit_cards/parsers/nubank.py
class NubankParser(InvoiceParser):
    bank_name = "Nubank"
    def can_parse(self, text): return "Nubank" in text[:500]
    def parse(self, text): ...
```

## Critérios de aceitação

- [ ] Pelo menos 2 bancos suportados na v1 (Nubank, Itaú)
- [ ] Detecção automática de bandeira/parser
- [ ] Fallback: parser genérico com regex permissivo
- [ ] Preview editável antes de salvar
- [ ] Detecção de duplicatas
- [ ] Compras parceladas detectadas e modeladas como parent + filhos

## Considerações

- Compras parceladas em fatura mostram "1/12" — extrair número e total.
- Valores em USD → converter? Configuração por banco.
- IOF, anuidade, juros — categorias automáticas separadas.
