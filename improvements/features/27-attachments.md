# F-27 — Anexos em transações

**Categoria:** Funcionalidade
**Estimativa:** Média
**Valor pro usuário:** Médio

## O que é

Anexar foto/PDF a uma transação: nota fiscal, boleto, recibo. Visualizar no detalhe.

## Modelo

```python
class TransactionAttachment(models.Model):
    transaction = FK(Transaction, related_name="attachments")
    file = FileField(upload_to="attachments/%Y/%m/")
    file_name = CharField  # nome original
    file_size = Int       # bytes
    content_type = CharField  # image/jpeg, application/pdf
    uploaded_at = DateTime
```

## Upload

- Frontend: drag-drop ou seleção de arquivo
- Frontend: usar `<input type="file" multiple>` ou lib como `react-dropzone`
- Backend: Strawberry suporta `Upload` scalar; valida tipo e tamanho (max 5MB)
- Storage: S3 / Cloudflare R2 / Backblaze para produção; FileSystem em dev

## UI

- Botão "Anexar" no modal de transação
- Preview de imagens em miniatura
- PDF: ícone + nome + botão "abrir"
- Modal de visualização em fullscreen
- Botão delete por anexo

## Critérios de aceitação

- [ ] Upload de imagens (jpg, png, webp) e PDF
- [ ] Tamanho máximo configurável
- [ ] Storage configurado (S3 ou similar)
- [ ] Preview de imagens
- [ ] Delete remove arquivo do storage
- [ ] Permissão: só dono da transação acessa

## Considerações

- LGPD/segurança: arquivos privados, URLs assinadas com expiração.
- Quota por usuário (plano free vs pago).
- Compressão de imagem antes de upload (lib `browser-image-compression`).
- Para faturas (F-04), anexar a Invoice em vez de Transaction.
