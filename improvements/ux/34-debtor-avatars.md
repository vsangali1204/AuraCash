# UX-34 — Avatares/fotos de devedores

**Categoria:** UI
**Estimativa:** Baixa

## Problema

Devedores são identificados só por nome. Em lista grande, sem identidade visual.

## Solução

### Inicial colorida (já existe)

Em ReceivablesPage, devedores têm círculo com inicial:
```
[ J ] João Silva  R$ 1.500
[ M ] Maria       R$ 800
```

Já funciona. Melhorar:
- Cor determinística por nome (hash → cor)
- Foto opcional via upload

### Modelo Debtor (opcional)

```python
class Debtor(models.Model):
    user = FK(User)
    name = CharField  # unique por user
    photo = ImageField(null=True, blank=True)
    color = CharField(7)  # hex
    notes = TextField(null=True)

    class Meta:
        unique_together = [("user", "name")]
```

Migration: criar Debtor a partir de cada `debtor_name` único existente. Transaction passa a apontar pra Debtor.

### Vantagens de ter modelo

- Histórico unificado: "Já recebi X de João total"
- Foto + cor + notas
- Contato (email/telefone) → ações futuras (lembrar via WhatsApp)
- Avatar em /receivables, /transactions, relatórios

## Critérios

- [ ] Cor determinística por nome (já pode ser feito sem modelo)
- [ ] (Opcional) Modelo Debtor com migration
- [ ] Upload de foto (lib upload)
- [ ] Foto aparece no avatar
- [ ] Página `/debtors` lista todos com totais e histórico
