# UX-15 — Validação inline em tempo real

**Categoria:** Forms
**Estimativa:** Baixa

## Problema

Zod valida só no submit. Usuário preenche tudo, clica enviar, vê 3 erros, corrige, envia de novo. Ruim.

## Solução

`react-hook-form` aceita `mode: "onBlur"` ou `mode: "onChange"`. Migrar:

```tsx
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: "onBlur",          // valida quando sai do campo
  reValidateMode: "onChange",  // depois valida em cada teclada
});
```

UI dos erros:
- Mensagem em vermelho abaixo do campo
- Borda do input fica vermelha
- Ícone de aviso no campo
- Animação suave de aparecer

```tsx
<div>
  <Input {...register("amount")} aria-invalid={!!errors.amount} />
  {errors.amount && (
    <p className="mt-1 text-xs text-danger flex items-center gap-1">
      <AlertCircle size={12} /> {errors.amount.message}
    </p>
  )}
</div>
```

Sucesso opcional:
- Checkmark verde quando campo está válido

## Critérios

- [ ] Validação onBlur em todos os forms
- [ ] Mensagem de erro inline (não toast)
- [ ] Estado visual: erro / sucesso / neutro
- [ ] Botão submit desabilitado se há erros
- [ ] Foco no primeiro erro ao tentar submeter
